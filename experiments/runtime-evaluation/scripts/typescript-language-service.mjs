#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const compiler = process.argv[2] ?? resolve("node_modules/.bin/tsc");
const child = spawn(compiler, ["--lsp", "--stdio"], { stdio: ["pipe", "pipe", "pipe"] });
let stderr = "";
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk).slice(-16_384);
});
let wire = Buffer.alloc(0);
const pending = new Map();
let nextId = 1;
child.stdout.on("data", (chunk) => {
    wire = Buffer.concat([wire, chunk]);
    drain();
});
child.once("error", (error) => {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
});

function send(message) {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
    child.stdin.write(body);
}

function request(method, params) {
    const id = nextId++;
    const message = { jsonrpc: "2.0", id, method };
    if (params !== undefined) message.params = params;
    send(message);
    return new Promise((resolvePromise, reject) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`TypeScript 7 LSP request timed out: ${method}; stderr=${stderr}`));
        }, 10_000);
        pending.set(id, {
            resolve: (value) => {
                clearTimeout(timer);
                resolvePromise(value);
            },
            reject: (error) => {
                clearTimeout(timer);
                reject(error);
            },
        });
    });
}

function drain() {
    while (true) {
        const separator = wire.indexOf("\r\n\r\n");
        if (separator < 0) return;
        const header = wire.subarray(0, separator).toString("ascii");
        const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(header);
        if (!match) throw new Error(`TypeScript 7 LSP response lacks Content-Length: ${header}`);
        const length = Number(match[1]);
        const bodyStart = separator + 4;
        if (wire.length < bodyStart + length) return;
        const body = wire.subarray(bodyStart, bodyStart + length).toString("utf8");
        wire = wire.subarray(bodyStart + length);
        const message = JSON.parse(body);
        if (message.method && message.id !== undefined) {
            send({ jsonrpc: "2.0", id: message.id, result: null });
            continue;
        }
        if (message.id !== undefined && pending.has(message.id)) {
            const entry = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
            else entry.resolve(message.result);
        }
    }
}

function lspPosition(text, offset) {
    const prefix = text.slice(0, offset);
    const lines = prefix.split("\n");
    return { line: lines.length - 1, character: lines.at(-1).length };
}

const rootUri = pathToFileURL(`${process.cwd()}/`).href;
const initialization = await request("initialize", {
    processId: process.pid,
    rootUri,
    capabilities: {},
    workspaceFolders: [{ uri: rootUri, name: "ember-runtime-evaluation" }],
});
send({ jsonrpc: "2.0", method: "initialized", params: {} });

const runtimePath = resolve("src/runtime.ts");
const runtimeText = await readFile(runtimePath, "utf8");
const offset = runtimeText.indexOf("buildProjection(state");
if (offset < 0) throw new Error("buildProjection call not found in runtime.ts");
const runtimeUri = pathToFileURL(runtimePath).href;
send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
        textDocument: { uri: runtimeUri, languageId: "typescript", version: 1, text: runtimeText },
    },
});
const definition = await request("textDocument/definition", {
    textDocument: { uri: runtimeUri },
    position: lspPosition(runtimeText, offset),
});
const locations = Array.isArray(definition) ? definition : definition ? [definition] : [];
const target = locations.find((location) =>
    String(location.uri ?? location.targetUri ?? "").endsWith("/src/projection.ts"),
);
if (!target) {
    throw new Error(`TypeScript 7 LSP did not resolve buildProjection to projection.ts: ${JSON.stringify(definition)}`);
}

const hover = await request("textDocument/hover", {
    textDocument: { uri: runtimeUri },
    position: lspPosition(runtimeText, offset),
});
if (!hover) throw new Error("TypeScript 7 LSP returned no hover for buildProjection");

await request("shutdown");
send({ jsonrpc: "2.0", method: "exit" });
child.stdin.end();
console.log(
    JSON.stringify({
        engine: "typescript-7-native-lsp",
        server: initialization?.serverInfo ?? null,
        source: "src/runtime.ts",
        definition: "src/projection.ts",
        hover: true,
    }),
);
