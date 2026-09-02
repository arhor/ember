import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { buildSpecialistPrompt, createSpecialistEpisode, runCodexSpecialist, setSpecialistDisposition } from "./codex-specialist.ts";
import { ROOT, tempDir } from "../../tests/support.ts";

const FIXTURE = join(ROOT, "test-fixtures/providers/scripted-codex-specialist.ts");

async function episodeFixture() {
  const root = await tempDir();
  const workspace = join(root, "controlled-workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "README.md"), "safe fixture\n");
  return {
    root,
    workspace,
    recordPath: join(root, "episodes", "episode-60.json"),
    spec: createSpecialistEpisode({
      episode_id: "episode-60",
      objective: "Create specialist-result.txt containing controlled specialist work.",
      acceptance: ["Only specialist-result.txt changes", "The file contains controlled specialist work"],
      context_projection: [{
        content: "SAFE_SPECIALIST_MARKER_60",
        provenance: "test fixture",
        scope: "project:controlled-specialist-fixture",
        currentness: "current",
      }],
      authority_envelope: {
        principal: "user-1",
        grant: "Modify this controlled fixture only",
        provenance: "explicit current test instruction from user-1",
        currentness: "current for episode-60 objective version 1",
        permitted_actions: ["read and write files in the selected workspace"],
        prohibited_actions: ["network access", "changes outside the workspace"],
        escalation_conditions: ["any broader access is needed"],
      },
      runtime_capability: {
        filesystem: { scope: "selected_workspace", mode: "read_write" },
        network_reach: "not_established",
        tools: ["Codex runtime-selected workspace tools"],
        credentials: "allowlisted_runtime_auth",
      },
      workspace: {
        path: resolve(workspace),
        expected_identity: "controlled fixture for issue 60",
        preserve_existing_changes: true,
      },
      runtime_policy: {
        command: process.execPath,
        argument_prefix: [FIXTURE],
        sandbox: "workspace-write",
        network: "no_additional_grant",
        configuration: "isolated",
        environment: "allowlisted_runtime_auth",
        timeout_seconds: 5,
        stdout_limit_bytes: 1024 * 1024,
        session_mode: "ephemeral",
      },
      currentness_basis: "episode-60 objective version 1",
    }),
  };
}

function blockedReport(overrides: Record<string, unknown> = {}) {
  return {
    contract_version: 1,
    summary: "blocked safely",
    objective_disposition: "blocked",
    artifacts_changed: [],
    artifacts_inspected: [],
    checks: [],
    known_effects: [],
    possible_effects: [],
    blockers: ["not run"],
    requested_follow_up: [],
    expansion_requests: [],
    ...overrides,
  };
}

function childReturning(report: unknown) {
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  child.stdin.on("finish", () => {
    child.stdout.end(`${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(report) } })}\n`);
    child.stderr.end();
    child.emit("close", 0, null);
  });
  return child;
}

test("Codex specialist should preserve report as attributed unresolved evidence when bounded work completes", async () => {
  const fixture = await episodeFixture();

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    environment: { PATH: process.env.PATH },
  });

  assert.equal(await readFile(join(fixture.workspace, "specialist-result.txt"), "utf8"), "controlled specialist work\n");
  assert.deepEqual(
    [record.runtime_state, record.report_state, record.ember_disposition, record.external_thread_id],
    ["exited", "reported_success", "unresolved", "thread-operational-60"],
  );
  assert.equal(record.report?.summary, "Created the requested controlled artifact.");
  assert.deepEqual(record.report_provenance, {
    source_role: "specialist_report",
    source: "codex_specialist",
    episode_id: fixture.spec.episode_id,
  });
  assert.deepEqual(record.specification.authority_envelope, fixture.spec.authority_envelope);
  assert.deepEqual(record.report?.known_effects, ["Created specialist-result.txt in the selected workspace."]);
  assert.deepEqual(record.known_effects, []);
  assert.deepEqual(record.possible_effects, []);
  assert.equal(JSON.parse(await readFile(fixture.recordPath, "utf8")).ember_disposition, "unresolved");
});

test("specialist disposition should become accepted when Ember explicitly interprets an unresolved report", async () => {
  const fixture = await episodeFixture();
  await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    environment: { PATH: process.env.PATH },
  });

  const accepted = await setSpecialistDisposition(fixture.recordPath, "accepted");

  assert.equal(accepted.ember_disposition, "accepted");
});

test("Codex specialist should persist explicit runtime policy without forwarding credentials when invocation starts", async () => {
  const fixture = await episodeFixture();
  let invocation: any;
  let persistedPolicy: unknown;
  let prompt = "";
  const child = childReturning(blockedReport());
  child.stdin.on("data", (chunk: Buffer) => {
    prompt += chunk.toString();
  });
  fixture.spec.runtime_policy.timeout_seconds = 1;

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    environment: { PATH: "/safe", HOME: "/home", OPENAI_API_KEY: "secret" },
    spawnImpl: (command, args, options) => {
      invocation = { command, args, options };
      persistedPolicy = JSON.parse(readFileSync(fixture.recordPath, "utf8")).specification.runtime_policy;
      return child;
    },
  });

  assert.equal(prompt, buildSpecialistPrompt(fixture.spec));
  assert.deepEqual(persistedPolicy, fixture.spec.runtime_policy);
  assert.equal(invocation.command, process.execPath);
  assert.equal(invocation.options.cwd, fixture.workspace);
  assert.deepEqual(invocation.options.env, { PATH: "/safe", HOME: "/home" });
  assert.equal(invocation.args.includes("workspace-write"), true);
  assert.equal(record.report_state, "reported_failure");
});

test("Codex specialist should preserve effect uncertainty when cancellation is requested", async () => {
  const fixture = await episodeFixture();
  const controller = new AbortController();
  let durableStateAtSignal: unknown;
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal: string) => {
    durableStateAtSignal = JSON.parse(readFileSync(fixture.recordPath, "utf8"));
    queueMicrotask(() => child.emit("close", null, signal));
    return true;
  };
  fixture.spec.runtime_policy.timeout_seconds = 2;

  const promise = runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    signal: controller.signal,
    terminationGraceMs: 5,
    finalTerminationMs: 20,
    spawnImpl: () => child,
  });
  controller.abort();
  const record = await promise;

  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition], ["exited", "ambiguous", "unresolved"]);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
  assert.equal(record.observations.some((item) => item.kind === "cancellation_requested"), true);
  assert.equal((durableStateAtSignal as any).runtime_state, "cancellation_requested");
  assert.equal((durableStateAtSignal as any).observations.some((item: any) => item.kind === "cancellation_requested"), true);
});

test("Codex specialist should record an ambiguous boundary failure when prompt delivery emits EPIPE", async () => {
  const fixture = await episodeFixture();
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal: string) => {
    queueMicrotask(() => child.emit("close", null, signal));
    return true;
  };
  child.stdin.on("finish", () => child.stdin.emit("error", new Error("write EPIPE")));

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    terminationGraceMs: 5,
    finalTerminationMs: 20,
    spawnImpl: () => child,
  });

  assert.equal(record.report_state, "ambiguous");
  assert.match(record.observations.find((item) => item.kind === "boundary_failure")?.detail ?? "", /EPIPE/);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
});

test("Codex specialist should reject malformed external evidence when report arrays contain invalid elements", async () => {
  const fixture = await episodeFixture();
  const malformed = {
    contract_version: 1,
    summary: "unsupported evidence",
    objective_disposition: "completed",
    artifacts_changed: [42],
    artifacts_inspected: [],
    checks: ["trust me"],
    known_effects: [null],
    possible_effects: [],
    blockers: [],
    requested_follow_up: [],
    expansion_requests: [],
    unsupported: true,
  };

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    spawnImpl: () => childReturning(malformed),
  });

  assert.equal(record.report_state, "ambiguous");
  assert.equal(record.report, undefined);
  assert.match(record.observations.find((item) => item.kind === "boundary_failure")?.detail ?? "", /report is invalid/);
});

test("Codex specialist should settle ambiguously when cancellation intent cannot be persisted", async () => {
  const fixture = await episodeFixture();
  const controller = new AbortController();
  const signals: string[] = [];
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = (signal: string) => {
    signals.push(signal);
    queueMicrotask(() => child.emit("close", null, signal));
    return true;
  };
  child.stdin.on("finish", () => {
    void (async () => {
      await rm(fixture.recordPath);
      await mkdir(fixture.recordPath);
      controller.abort();
    })();
  });

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    signal: controller.signal,
    terminationGraceMs: 5,
    finalTerminationMs: 20,
    spawnImpl: () => child,
  });

  assert.deepEqual(signals, ["SIGTERM"]);
  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition], ["exited", "ambiguous", "unresolved"]);
  assert.match(record.observations.find((item) => item.kind === "boundary_failure")?.detail ?? "", /could not be persisted before signalling/);
  assert.match(record.possible_effects.join(" "), /may have occurred/);
});

test("Codex specialist should persist an ambiguous terminal record when failure diagnostics are invalid UTF-8", async () => {
  const fixture = await episodeFixture();
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  child.stdin.on("finish", () => {
    child.stdout.end();
    child.stderr.end(Buffer.from([0xff]));
    child.emit("close", 2, null);
  });

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    spawnImpl: () => child,
  });
  const persisted = JSON.parse(await readFile(fixture.recordPath, "utf8"));

  assert.deepEqual([record.runtime_state, record.report_state, record.ember_disposition], ["exited", "ambiguous", "unresolved"]);
  assert.equal(persisted.report_state, "ambiguous");
  assert.equal(persisted.observations.some((item: any) => item.kind === "child_exit_observed"), true);
  assert.match(record.observations.find((item) => item.kind === "boundary_failure")?.detail ?? "", /�/);
});

test("AS-DEL-05 should withhold out-of-scope canonical meaning and preserve a context expansion request", async () => {
  const fixture = await episodeFixture();
  const canonicalContext = [
    ...fixture.spec.context_projection,
    {
      content: "PRIVATE_RELATIONSHIP_CONTEXT_MUST_NOT_REACH_CODEX",
      provenance: "canonical relationship meaning",
      scope: "relationship:user-1",
      currentness: "current",
    },
  ];
  const withheldCanonicalMeaning = canonicalContext.find((item) => item.scope === "relationship:user-1")!;
  let prompt = "";
  const report = blockedReport({
    blockers: ["Need project-owner rationale that was not disclosed."],
    expansion_requests: [{
      kind: "additional_context",
      request: "Provide the omitted project-owner rationale.",
      purpose: "Determine whether the requested file change is still desired.",
      consequence: "Additional Ember context would be disclosed to the coding specialist.",
      requires_decision_from: "Ember disclosure authority",
    }],
  });
  const child = childReturning(report);
  child.stdin.on("data", (chunk: Buffer) => {
    prompt += chunk.toString();
  });

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    spawnImpl: () => child,
  });

  assert.equal(prompt.includes(withheldCanonicalMeaning.content), false);
  assert.equal(prompt.includes("SAFE_SPECIALIST_MARKER_60"), true);
  assert.deepEqual(record.report?.expansion_requests, report.expansion_requests);
  assert.equal(record.ember_disposition, "unresolved");
  assert.equal(record.specification.context_projection.every((item) => item.scope === "project:controlled-specialist-fixture"), true);
});

test("AS-DEL-07 should not turn workspace write capability into broader Ember authority", async () => {
  const fixture = await episodeFixture();
  fixture.spec.authority_envelope = {
    principal: "user-1",
    grant: "Inspect the controlled fixture and report what change would be needed",
    provenance: "explicit current test instruction from user-1",
    currentness: "current for the read-only AS-DEL-07 attempt",
    permitted_actions: ["read files in the selected workspace"],
    prohibited_actions: ["write files even though the runtime sandbox can technically do so"],
    escalation_conditions: ["a write is required to satisfy the objective"],
  };
  const report = blockedReport({
    blockers: ["Writing specialist-result.txt exceeds the entrusted authority."],
    expansion_requests: [{
      kind: "additional_authority",
      request: "Authorize creating specialist-result.txt.",
      purpose: "Complete the requested workspace change.",
      consequence: "The specialist would create a new file in the selected workspace.",
      requires_decision_from: "authority holder for the workspace mutation",
    }],
  });
  let prompt = "";
  const child = childReturning(report);
  child.stdin.on("data", (chunk: Buffer) => {
    prompt += chunk.toString();
  });

  const record = await runCodexSpecialist(fixture.spec, {
    recordPath: fixture.recordPath,
    spawnImpl: () => child,
  });

  assert.equal(prompt.includes("Runtime capability is not authority"), true);
  assert.equal(prompt.includes('"mode":"read_write"'), true);
  assert.equal(prompt.includes('"permitted_actions":["read files in the selected workspace"]'), true);
  assert.equal(record.specification.runtime_capability.filesystem.mode, "read_write");
  assert.deepEqual(record.specification.authority_envelope, fixture.spec.authority_envelope);
  assert.deepEqual(record.report?.expansion_requests, report.expansion_requests);
  assert.equal(record.report_state, "reported_failure");
  assert.equal(record.ember_disposition, "unresolved");
  await assert.rejects(readFile(join(fixture.workspace, "specialist-result.txt"), "utf8"), /ENOENT/);
});
