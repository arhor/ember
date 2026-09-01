import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { buildSpecialistPrompt, createSpecialistEpisode, runCodexSpecialist, setSpecialistDisposition } from "../src/ember/codex-specialist.ts";
import { ROOT, tempDir } from "./support.ts";

const FIXTURE = join(ROOT, "test-fixtures/providers/scripted-codex-specialist.ts");

async function episodeFixture() {
  const root = await tempDir();
  const workspace = join(root, "controlled-workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "README.md"), "safe fixture\n");
  return {
    root, workspace, recordPath: join(root, "episodes", "episode-60.json"),
    spec: createSpecialistEpisode({
      episode_id: "episode-60", objective: "Create specialist-result.txt containing controlled specialist work.",
      acceptance: ["Only specialist-result.txt changes", "The file contains controlled specialist work"],
      context_projection: [{ content: "SAFE_SPECIALIST_MARKER_60", provenance: "test fixture", currentness: "current" }],
      authority_envelope: { principal: "user-1", grant: "Modify this controlled fixture only", permitted_actions: ["read and write files in the selected workspace"], prohibited_actions: ["network access", "changes outside the workspace"], escalation_conditions: ["any broader access is needed"] },
      workspace: { path: resolve(workspace), expected_identity: "controlled fixture for issue 60", preserve_existing_changes: true },
      runtime_policy: { command: process.execPath, argument_prefix: [FIXTURE], sandbox: "workspace-write", network: "no_additional_grant", configuration: "isolated", environment: "allowlisted_runtime_auth", timeout_seconds: 5, stdout_limit_bytes: 1024 * 1024, session_mode: "ephemeral" },
      currentness_basis: "episode-60 objective version 1",
    }),
  };
}

test("Codex specialist should preserve report as attributed unresolved evidence when bounded work completes", async () => {
  // Given
  const fixture = await episodeFixture();

  // When
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });

  // Then
  assert.equal(await readFile(join(fixture.workspace, "specialist-result.txt"), "utf8"), "controlled specialist work\n");
  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition, record.external_thread_id], ["exited", "reported_success", "unresolved", "thread-operational-60"]);
  assert.equal(record.report?.summary, "Created the requested controlled artifact.");
  assert.equal(JSON.parse(await readFile(fixture.recordPath, "utf8")).ember_disposition, "unresolved");
});

test("specialist disposition should become accepted when Ember explicitly interprets an unresolved report", async () => {
  // Given
  const fixture = await episodeFixture();
  await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });

  // When
  const accepted = await setSpecialistDisposition(fixture.recordPath, "accepted");

  // Then
  assert.equal(accepted.ember_disposition, "accepted");
});

test("Codex specialist should persist explicit runtime policy without forwarding credentials when invocation starts", async () => {
  // Given
  const fixture = await episodeFixture();
  let invocation: any, persistedPolicy: unknown, prompt = "";
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
  child.stdin.on("data", (chunk: Buffer) => { prompt += chunk.toString(); });
  const report = { contract_version: 1, summary: "blocked safely", objective_disposition: "blocked", artifacts_changed: [], artifacts_inspected: [], checks: [], known_effects: [], possible_effects: [], blockers: ["not run"], requested_follow_up: [] };
  fixture.spec.runtime_policy.timeout_seconds = 1;

  // When
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: "/safe", HOME: "/home", OPENAI_API_KEY: "secret" }, spawnImpl: (command, args, options) => {
    invocation = { command, args, options };
    persistedPolicy = JSON.parse(readFileSync(fixture.recordPath, "utf8")).specification.runtime_policy;
    child.stdin.on("finish", () => { child.stdout.end(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(report) } })}\n`); child.stderr.end(); child.emit("close", 0, null); });
    return child;
  } });

  // Then
  assert.equal(prompt, buildSpecialistPrompt(fixture.spec));
  assert.deepEqual(persistedPolicy, fixture.spec.runtime_policy);
  assert.equal(invocation.command, process.execPath);
  assert.equal(invocation.options.cwd, fixture.workspace);
  assert.deepEqual(invocation.options.env, { PATH: "/safe", HOME: "/home" });
  assert.equal(invocation.args.includes("workspace-write"), true);
  assert.equal(record.report_state, "reported_failure");
});

test("Codex specialist should preserve effect uncertainty when cancellation is requested", async () => {
  // Given
  const fixture = await episodeFixture(); const controller = new AbortController();
  let durableStateAtSignal: unknown;
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = (signal: string) => {
    durableStateAtSignal = JSON.parse(readFileSync(fixture.recordPath, "utf8"));
    queueMicrotask(() => child.emit("close", null, signal));
    return true;
  };
  fixture.spec.runtime_policy.timeout_seconds = 2;

  // When
  const promise = runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, signal: controller.signal, terminationGraceMs: 5, finalTerminationMs: 20, spawnImpl: () => child });
  controller.abort(); const record = await promise;

  // Then
  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition], ["exited", "ambiguous", "unresolved"]);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
  assert.equal(record.observations.some(item => item.kind === "cancellation_requested"), true);
  assert.equal((durableStateAtSignal as any).runtime_state, "cancellation_requested");
  assert.equal((durableStateAtSignal as any).observations.some((item: any) => item.kind === "cancellation_requested"), true);
});

test("Codex specialist should record an ambiguous boundary failure when prompt delivery emits EPIPE", async () => {
  // Given
  const fixture = await episodeFixture();
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = (signal: string) => { queueMicrotask(() => child.emit("close", null, signal)); return true; };
  child.stdin.on("finish", () => child.stdin.emit("error", new Error("write EPIPE")));

  // When
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, terminationGraceMs: 5, finalTerminationMs: 20, spawnImpl: () => child });

  // Then
  assert.equal(record.report_state, "ambiguous");
  assert.match(record.observations.find(item => item.kind === "boundary_failure")?.detail ?? "", /EPIPE/);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
});

test("Codex specialist should reject malformed external evidence when report arrays contain invalid elements", async () => {
  // Given
  const fixture = await episodeFixture();
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
  const malformed = { contract_version: 1, summary: "unsupported evidence", objective_disposition: "completed", artifacts_changed: [42], artifacts_inspected: [], checks: ["trust me"], known_effects: [null], possible_effects: [], blockers: [], requested_follow_up: [], unsupported: true };
  child.stdin.on("finish", () => { child.stdout.end(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(malformed) } })}\n`); child.stderr.end(); child.emit("close", 0, null); });

  // When
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, spawnImpl: () => child });

  // Then
  assert.equal(record.report_state, "ambiguous");
  assert.equal(record.report, undefined);
  assert.match(record.observations.find(item => item.kind === "boundary_failure")?.detail ?? "", /report is invalid/);
});

test("Codex specialist should settle ambiguously when cancellation intent cannot be persisted", async () => {
  // Given
  const fixture = await episodeFixture();
  const controller = new AbortController();
  const signals: string[] = [];
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = (signal: string) => { signals.push(signal); queueMicrotask(() => child.emit("close", null, signal)); return true; };
  child.stdin.on("finish", () => { void (async () => {
    await rm(fixture.recordPath);
    await mkdir(fixture.recordPath);
    controller.abort();
  })(); });

  // When
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, signal: controller.signal, terminationGraceMs: 5, finalTerminationMs: 20, spawnImpl: () => child });

  // Then
  assert.deepEqual(signals, ["SIGTERM"]);
  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition], ["exited", "ambiguous", "unresolved"]);
  assert.match(record.observations.find(item => item.kind === "boundary_failure")?.detail ?? "", /could not be persisted before signalling/);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
});
