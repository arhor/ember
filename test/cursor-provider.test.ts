import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { buildCursorPrompt, cursorEnvironment, invokeCursorProvider } from "../src/ember/cursor-provider.ts";
import { parseArgs } from "../src/ember/cli.ts";
import { ProviderError } from "../src/ember/errors.ts";
import { buildProjection } from "../src/ember/projection.ts";
import { startRuntime } from "../src/ember/runtime.ts";
import { rememberPreference } from "../src/ember/semantics.ts";
import { captureError, command, populatedState, PRINCIPAL, ROOT, SCOPE, tempDir } from "./support.ts";

const SCRIPTED_CURSOR = join(ROOT, "test-fixtures", "providers", "scripted-cursor.ts");

function requestFixture() {
  const { state } = populatedState();
  rememberPreference(state, PRINCIPAL, `user:${PRINCIPAL}`, "private-marker", "project:private", "PRIVATE_CANONICAL_MARKER_90");
  const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-01T12:00:00Z" });
  const projection = buildProjection(started.state, { principal: PRINCIPAL, scope: SCOPE, currentInput: "What should I remember?", currentTime: "2026-09-01T12:00:01Z", runtimeId: started.runtimeId });
  return { contract_version: 1 as const, cognition_id: "cognition-cursor-test", projection, input: { text: "What should I remember?" } };
}

function childDouble({ output = "", error = "", exitCode = 0, closeOnKill = true } = {}) {
  const child = new EventEmitter();
  const stdin = new PassThrough(); const stdout = new PassThrough(); const stderr = new PassThrough(); const signals: unknown[] = [];
  Object.assign(child, { stdin, stdout, stderr, kill(signal: unknown) { signals.push(signal); if (closeOnKill) queueMicrotask(() => child.emit("close", null, signal)); return true; } });
  const complete = () => queueMicrotask(() => { if (output) stdout.write(output); if (error) stderr.write(error); stdout.end(); stderr.end(); child.emit("close", exitCode, null); });
  return { child, stdin, signals, complete };
}

function success(result: unknown, sessionId = "session-operational-90") {
  return `${JSON.stringify({ type: "result", subtype: "success", is_error: false, duration_ms: 1, duration_api_ms: 1, result: JSON.stringify(result), session_id: sessionId })}\n`;
}

test("Cursor provider should disclose only the bounded request when invoked with default isolation", async () => {
  // Given
  const request = requestFixture(); const used = request.projection.selection.meaning_ids[0]; let invocation: any; let prompt = "";
  const fixture = childDouble({ output: success({ contract_version: 1, reply: "bounded answer", used_meaning_ids: [used] }) });
  // When
  const result = await invokeCursorProvider("cursor-agent", [], request, { timeoutSeconds: 1, environment: { PATH: "/safe/bin", HOME: "/safe/home", CURSOR_API_KEY: "raw-key", PRIVATE_ENV_MARKER_90: "private" }, spawnImpl: (_command, arguments_, options) => { invocation = { arguments_, options, cwdEntries: readdirSync(options.cwd), toolPolicy: JSON.parse(readFileSync(join(options.cwd, ".cursor", "cli.json"), "utf8")) }; fixture.stdin.on("data", chunk => { prompt += chunk.toString("utf8"); }); fixture.complete(); return fixture.child as any; } });
  // Then
  assert.deepEqual(result, { contract_version: 1, reply: "bounded answer", used_meaning_ids: [used], operational: { external_thread_id: "session-operational-90" } });
  assert.equal(prompt, buildCursorPrompt(request)); assert.equal(prompt.includes("PRIVATE_CANONICAL_MARKER_90"), false); assert.deepEqual(invocation.cwdEntries, [".cursor"]);
  assert.deepEqual(invocation.toolPolicy, { permissions: { allow: [], deny: ["Shell(*)", "Read(*)", "Read(**)", "Write(*)", "Write(**)", "WebFetch(*)", "Mcp(*:*)"] } });
  assert.deepEqual(invocation.options.env, { PATH: "/safe/bin", HOME: "/safe/home" }); assert.deepEqual(invocation.arguments_, ["-p", "--output-format", "json", "--mode", "ask", "--sandbox", "enabled", "--trust", "--workspace", invocation.options.cwd]);
});

test("Cursor environment should omit credentials when runtime authentication is reused", () => {
  // Given
  const source = { PATH: "/bin", HOME: "/home/user", CURSOR_API_KEY: "secret", GH_TOKEN: "secret", CURSOR_API_ENDPOINT: "https://private.test" };
  // When
  const environment = cursorEnvironment(source);
  // Then
  assert.deepEqual(environment, { PATH: "/bin", HOME: "/home/user" });
});

test("Cursor provider should reject passthrough arguments that can override adapter boundaries", async () => {
  // Given
  const request = requestFixture(); const forbidden = [["--api-key", "secret"], ["--resume", "session"], ["--continue"], ["--workspace", "/private"], ["--mode", "plan"], ["--sandbox", "disabled"], ["--approve-mcps"]];
  // When
  const errors = await Promise.all(forbidden.map(arguments_ => captureError(() => invokeCursorProvider("cursor-agent", arguments_, request, { timeoutSeconds: 1 }))));
  // Then
  assert.equal(errors.every(error => error instanceof ProviderError && /unsupported Cursor adapter argument/.test(error.message)), true);
});

test("Cursor provider should allow only one explicit model selection argument", async () => {
  // Given
  const request = requestFixture(); const fixture = childDouble({ output: success({ contract_version: 1, reply: "answer", used_meaning_ids: [] }) }); const cwd = await tempDir(); let arguments_: string[] = [];
  // When
  await invokeCursorProvider("cursor-agent", ["--model", "composer-2"], request, { timeoutSeconds: 1, cwd, spawnImpl: (_command, values) => { arguments_ = values; fixture.complete(); return fixture.child as any; } });
  // Then
  assert.deepEqual(arguments_.slice(0, 2), ["--model", "composer-2"]);
});

test("Cursor provider should reject a result that claims meaning outside the projection", async () => {
  // Given
  const request = requestFixture(); const fixture = childDouble({ output: success({ contract_version: 1, reply: "bad", used_meaning_ids: ["outside"] }) }); const cwd = await tempDir();
  // When
  const error = await captureError(() => invokeCursorProvider("cursor-agent", [], request, { timeoutSeconds: 1, cwd, spawnImpl: () => { fixture.complete(); return fixture.child as any; } }));
  // Then
  assert.equal(error instanceof ProviderError, true); assert.match(error.message, /outside its projection/);
});

test("Cursor provider should reject success when resumed session differs from requested session", async () => {
  // Given
  const request = requestFixture(); const fixture = childDouble({ output: success({ contract_version: 1, reply: "answer", used_meaning_ids: [] }, "other-session") }); const cwd = await tempDir();
  // When
  const error = await captureError(() => invokeCursorProvider("cursor-agent", [], request, { timeoutSeconds: 1, cwd, session: { mode: "resume", externalSessionId: "requested-session" }, spawnImpl: () => { fixture.complete(); return fixture.child as any; } }));
  // Then
  assert.match(error.message, /resumed a different session/);
});

test("Cursor provider should distinguish timeout when direct child exit is observed", async () => {
  // Given
  const request = requestFixture(); const fixture = childDouble(); const cwd = await tempDir();
  // When
  const error = await captureError(() => invokeCursorProvider("cursor-agent", [], request, { timeoutSeconds: 0.005, cwd, terminationGraceMs: 5, finalTerminationMs: 20, spawnImpl: () => fixture.child as any }));
  // Then
  assert.deepEqual([error.outcome, error.termination, fixture.signals], ["timed_out", { reason: "timeout", directChildExitObserved: true }, ["SIGTERM"]]);
});

test("Cursor provider should preserve ambiguous cancellation when direct child exit is not observed", async () => {
  // Given
  const request = requestFixture(); const fixture = childDouble({ closeOnKill: false }); const cwd = await tempDir(); const controller = new AbortController(); queueMicrotask(() => controller.abort());
  // When
  const error = await captureError(() => invokeCursorProvider("cursor-agent", [], request, { timeoutSeconds: 1, signal: controller.signal, cwd, terminationGraceMs: 5, finalTerminationMs: 20, spawnImpl: () => fixture.child as any }));
  // Then
  assert.deepEqual([error.outcome, error.terminationConfirmed, error.termination, fixture.signals], ["outcome_unknown", false, { reason: "explicit_cancellation", directChildExitObserved: false }, ["SIGTERM", "SIGKILL"]]);
});

test("CLI parser should select Cursor with its runtime-specific arguments when requested", () => {
  // Given
  const arguments_ = ["run", "--state", "/tmp/ember.json", "--principal", PRINCIPAL, "--scope", SCOPE, "--provider", "cursor", "--cursor-arg", "--model", "--cursor-arg", "composer-2", "--provider-timeout-seconds", "120"];
  // When
  const parsed = parseArgs(arguments_);
  // Then
  assert.deepEqual(parsed, { command: "run", state: "/tmp/ember.json", principal: PRINCIPAL, scope: SCOPE, providerKind: "cursor", providerCommand: "cursor-agent", providerArgs: ["--model", "composer-2"], providerTimeoutSeconds: 120 });
});

test("CLI run should complete bounded cognition when Cursor backend is selected", async () => {
  // Given
  const directory = await tempDir(); const statePath = join(directory, "ember.json"); await command(["init", "--state", statePath, "--name", "Ember", "--principal", PRINCIPAL]);
  // When
  const executed = await command(["run", "--state", statePath, "--principal", PRINCIPAL, "--scope", SCOPE, "--provider", "cursor", "--cursor-command", SCRIPTED_CURSOR, "--provider-timeout-seconds", "2"], { stdin: "hello through Cursor\n:quit\n" }); const state = JSON.parse(await readFile(statePath, "utf8")); const cognition = state.operations.cognition_episodes.at(-1);
  // Then
  assert.deepEqual([executed.code, executed.stdout.includes("CURSOR_CLI_RESPONSE"), cognition.status, cognition.external_provider_thread_id], [0, true, "completed", "session-cli-90"]); assert.equal(JSON.stringify(state).includes("CURSOR_CLI_RESPONSE"), false);
});
