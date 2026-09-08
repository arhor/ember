import { appendFileSync } from "node:fs";

interface JsonRpcRequest {
    jsonrpc: "2.0";
    id?: string | number;
    method: string;
    params?: Record<string, unknown>;
}

const mode = process.env.EMBER_MCP_FIXTURE_MODE ?? "normal";
const logPath = process.env.EMBER_MCP_FIXTURE_LOG;
let buffer = "";

process.on("SIGTERM", () => {
    log({ event: "shutdown", signal: "SIGTERM" });
    process.exit(0);
});

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
    buffer += chunk;
    while (true) {
        const newline = buffer.indexOf("\n");
        if (newline < 0) return;
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (!line.trim()) continue;
        handle(JSON.parse(line) as JsonRpcRequest);
    }
});

function handle(request: JsonRpcRequest) {
    if (request.method === "server/discover") {
        respondError(request.id, -32601, "fixture uses legacy initialization");
        return;
    }

    if (request.method === "initialize") {
        respond(request.id, {
            protocolVersion: "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "ember-deterministic-fixture", version: "1.0.0" },
        });
        return;
    }

    if (request.method === "notifications/initialized") return;

    if (request.method === "tools/list") {
        log({ method: "tools/list" });
        if (mode === "discovery-failure") {
            respondError(request.id, -32000, "deterministic discovery failure");
            return;
        }
        respond(request.id, {
            tools: [
                {
                    name: "remote_lookup",
                    description: "Mechanically discovered deterministic lookup",
                    inputSchema: {
                        type: "object",
                        additionalProperties: false,
                        properties: { key: { type: "string" } },
                        required: ["key"],
                    },
                },
                {
                    name: "remote_hidden",
                    description: "Mechanically discoverable but not selected",
                    inputSchema: {
                        type: "object",
                        additionalProperties: false,
                        properties: { value: { type: "string" } },
                        required: ["value"],
                    },
                },
            ],
        });
        return;
    }

    if (request.method === "tools/call") {
        const name = typeof request.params?.name === "string" ? request.params.name : "";
        const args = isObject(request.params?.arguments) ? request.params.arguments : {};
        log({ method: "tools/call", name, arguments: args });

        if (mode === "disconnect-on-call") {
            process.exit(0);
        }
        if (mode === "timeout-on-call") return;
        if (mode === "tool-error") {
            respond(request.id, {
                content: [{ type: "text", text: "deterministic explicit tool failure" }],
                isError: true,
            });
            return;
        }

        if (name === "remote_lookup") {
            const key = typeof args.key === "string" ? args.key : "";
            respond(request.id, {
                content: [{ type: "text", text: key === "timezone" ? "UTC" : `unknown:${key}` }],
            });
            return;
        }

        respondError(request.id, -32602, `unknown tool: ${name}`);
        return;
    }

    if (request.id !== undefined) respondError(request.id, -32601, `unsupported method: ${request.method}`);
}

function respond(id: JsonRpcRequest["id"], result: unknown) {
    if (id === undefined) return;
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function respondError(id: JsonRpcRequest["id"], code: number, message: string) {
    if (id === undefined) return;
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

function log(event: unknown) {
    if (logPath) appendFileSync(logPath, `${JSON.stringify(event)}\n`, "utf8");
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
