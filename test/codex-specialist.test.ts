import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
      workspace: { path: resolve(workspace), expected_identity: "controlled fixture for issue 60", preserve_existing_changes: true }, currentness_basis: "episode-60 objective version 1",
    }),
  };
}

test("Codex specialist performs bounded work and preserves report as attributed unresolved evidence", async () => {
  const fixture = await episodeFixture();
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, command: process.execPath, argumentPrefix: [FIXTURE], timeoutSeconds: 5, environment: { PATH: process.env.PATH } });
  assert.equal(await readFile(join(fixture.workspace, "specialist-result.txt"), "utf8"), "controlled specialist work\n");
  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition, record.external_thread_id], ["exited", "reported_success", "unresolved", "thread-operational-60"]);
  assert.equal(record.report?.summary, "Created the requested controlled artifact.");
  assert.equal(JSON.parse(await readFile(fixture.recordPath, "utf8")).ember_disposition, "unresolved");
  const accepted = await setSpecialistDisposition(fixture.recordPath, "accepted");
  assert.equal(accepted.ember_disposition, "accepted");
});

test("specialist invocation makes workspace, context, and authority explicit without forwarding credentials", async () => {
  const fixture = await episodeFixture();
  let invocation: any, prompt = "";
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
  child.stdin.on("data", (chunk: Buffer) => { prompt += chunk.toString(); });
  const report = { contract_version: 1, summary: "blocked safely", objective_disposition: "blocked", artifacts_changed: [], artifacts_inspected: [], checks: [], known_effects: [], possible_effects: [], blockers: ["not run"], requested_follow_up: [] };
  const record = await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, timeoutSeconds: 1, environment: { PATH: "/safe", HOME: "/home", OPENAI_API_KEY: "secret" }, spawnImpl: (_command, args, options) => {
    invocation = { args, options };
    child.stdin.on("finish", () => { child.stdout.end(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(report) } })}\n`); child.stderr.end(); child.emit("close", 0, null); });
    return child;
  } });
  assert.equal(prompt, buildSpecialistPrompt(fixture.spec));
  assert.equal(invocation.options.cwd, fixture.workspace);
  assert.deepEqual(invocation.options.env, { PATH: "/safe", HOME: "/home" });
  assert.equal(invocation.args.includes("workspace-write"), true);
  assert.equal(record.report_state, "reported_failure");
});

test("cancellation records uncertainty and never claims that effects were rolled back", async () => {
  const fixture = await episodeFixture(); const controller = new AbortController();
  const child = new EventEmitter() as any; child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = (signal: string) => { queueMicrotask(() => child.emit("close", null, signal)); return true; };
  const promise = runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, timeoutSeconds: 2, signal: controller.signal, terminationGraceMs: 5, finalTerminationMs: 20, spawnImpl: () => child });
  controller.abort(); const record = await promise;
  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition], ["exited", "ambiguous", "unresolved"]);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
  assert.equal(record.observations.some(item => item.kind === "cancellation_requested"), true);
});
