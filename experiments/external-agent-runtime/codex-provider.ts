#!/usr/bin/env node

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateProviderResult, type ProviderRequest, type ProviderResult } from "../../src/providers/contract.ts";

const MAX_BYTES = 1024 * 1024;
const RESULT_SCHEMA = fileURLToPath(new URL("provider-result.schema.json", import.meta.url));

interface CodexOptions {
  command: string;
  argumentPrefix: string[];
  cwd: string;
}

export function buildCodexPrompt(request: ProviderRequest) {
  return [
    "Act only as a bounded cognition provider for Ember.",
    "The JSON below is the complete permitted projection for this episode. Do not use tools, files, prior threads, or outside context.",
    "Answer current_input. Return a ProviderResult matching the supplied schema.",
    "Set used_meaning_ids to only the projected meaning IDs materially used in the reply.",
    "Do not claim that the runtime owns Ember continuity or canonical state.",
    "<ember_provider_request>",
    JSON.stringify(request),
    "</ember_provider_request>",
  ].join("\n");
}

export async function invokeCodexExec(request: ProviderRequest, options: CodexOptions): Promise<ProviderResult> {
  const environment = { ...process.env };
  delete environment.OPENAI_API_KEY;
  const child = spawn(options.command, [
    ...options.argumentPrefix,
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox", "read-only",
    "--json",
    "--output-schema", RESULT_SCHEMA,
    "-C", options.cwd,
    "-",
  ], { cwd: options.cwd, env: environment, shell: false, stdio: ["pipe", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  child.stdout.on("data", (chunk: Buffer) => { stdoutBytes += chunk.length; if (stdoutBytes <= MAX_BYTES) stdout.push(chunk); });
  child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.length; if (stderrBytes <= MAX_BYTES) stderr.push(chunk); });
  child.stdin.end(buildCodexPrompt(request));
  const terminal = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  if (stdoutBytes > MAX_BYTES || stderrBytes > MAX_BYTES) throw new Error("Codex adapter output exceeded 1 MiB");
  const stdoutText = Buffer.concat(stdout).toString("utf8");
  const diagnostic = Buffer.concat(stderr).toString("utf8").trim();
  if (terminal.code !== 0) throw new Error(`Codex exited with ${terminal.signal ? `signal ${terminal.signal}` : `status ${terminal.code}`}${diagnostic || stdoutText.trim() ? `: ${diagnostic || stdoutText.trim()}` : ""}`);

  let candidate: unknown;
  for (const line of stdoutText.split("\n")) {
    if (!line.trim()) continue;
    const event: unknown = JSON.parse(line);
    if (!isRecord(event) || event.type !== "item.completed" || !isRecord(event.item) || event.item.type !== "agent_message" || typeof event.item.text !== "string") continue;
    candidate = JSON.parse(event.item.text);
  }
  validateProviderResult(candidate, new Set(request.projection.selection.meaning_ids));
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readRequest() {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BYTES) throw new Error("provider request exceeded 1 MiB");
    chunks.push(buffer);
  }
  const request: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!isRecord(request) || request.contract_version !== 1 || typeof request.cognition_id !== "string" || !isRecord(request.projection) || !isRecord(request.input) || typeof request.input.text !== "string") throw new Error("provider request is invalid");
  return request as unknown as ProviderRequest;
}

function parseArguments(arguments_: string[]) {
  let command = "codex";
  let cwd: string | undefined;
  let captureRequest: string | undefined;
  const argumentPrefix: string[] = [];
  for (let index = 0; index < arguments_.length; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (value === undefined) throw new Error("adapter options require values");
    if (name === "--codex-command") command = value;
    else if (name === "--codex-arg-prefix") argumentPrefix.push(value);
    else if (name === "--runtime-cwd") cwd = value;
    else if (name === "--capture-request") captureRequest = value;
    else throw new Error(`unsupported adapter option: ${name}`);
  }
  if (!cwd) throw new Error("--runtime-cwd is required");
  return { command, argumentPrefix, cwd, captureRequest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.resolve().then(async () => {
    const options = parseArguments(process.argv.slice(2));
    const request = await readRequest();
    if (options.captureRequest) await writeFile(options.captureRequest, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    const result = await invokeCodexExec(request, options);
    process.stdout.write(JSON.stringify(result));
  }).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
