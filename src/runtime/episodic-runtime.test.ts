import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createSpecialistEpisode } from "../delegation/codex-specialist.ts";
import { initialState } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { ROOT, PRINCIPAL, SCOPE, tempDir } from "../../tests/support.ts";
import {
  EpisodicRecordStore,
  SystemdUserSupervisor,
  inspectEpisodicRuntime,
  reconcileEpisodicRuntime,
  renderReconciliationUnit,
  runWakeWorker,
  scheduleWake,
  specialistUnitName,
  startSpecialistEpisode,
  type CommandRunner,
  type EpisodicRuntimeConfig,
} from "./episodic-runtime.ts";

function runtimeConfig(root: string): EpisodicRuntimeConfig {
  return {
    config_version: 1,
    state_path: join(root, "ember.json"),
    records_directory: join(root, "runtime-records"),
    principal: PRINCIPAL,
    active_scope: SCOPE,
    node_path: process.execPath,
    runtime_entrypoint: join(ROOT, "bin", "ember-runtime.ts"),
    codex_command: "/usr/bin/codex",
    codex_arguments: [],
    opportunity_timeout_seconds: 60,
    systemd_run_command: "/usr/bin/systemd-run",
    systemctl_command: "/usr/bin/systemctl",
    stop_timeout_seconds: 30,
  };
}

function capturingRunner(unitState = "not-found\ninactive\n") {
  const calls: Array<{ command: string; args: string[] }> = [];
  const runner: CommandRunner = async (command, args) => {
    calls.push({ command, args: [...args] });
    return {
      code: 0,
      signal: null,
      stdout: command.endsWith("systemctl") && args.includes("show") ? unitState : "",
      stderr: "",
    };
  };
  return { calls, runner };
}

test("schedule wake should persist intent before creating one-shot systemd activation", async () => {
  const root = await tempDir();
  const config = runtimeConfig(root);
  const configPath = join(root, "runtime.json");
  const { calls, runner } = capturingRunner();

  const intent = await scheduleWake(config, configPath, "2026-09-04T10:00:00Z", {
    now: () => "2026-09-03T20:00:00Z",
    runner,
  });

  const persisted = JSON.parse(await readFile(join(config.records_directory, "wakes", intent.wake_id, "intent.json"), "utf8"));
  assert.equal(persisted.wake_id, intent.wake_id);
  assert.equal(persisted.mechanism, "external_timing");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.command, config.systemd_run_command);
  assert.ok(calls[0]!.args.includes(`--on-calendar=${intent.due_at}`));
  assert.ok(calls[0]!.args.includes("--property=Type=exec"));
  assert.ok(calls[0]!.args.includes("--property=Restart=no"));
  assert.ok(!calls[0]!.args.some(arg => arg.includes("Persistent")));
  assert.deepEqual(calls[0]!.args.slice(-6), [
    config.node_path,
    config.runtime_entrypoint,
    "run-wake",
    "--config",
    configPath,
    "--wake-id",
  ].slice(0, 0), "placeholder");
  assert.equal(calls[0]!.args.at(-1), intent.wake_id);
});

test("wake worker should record one external-timing opportunity and cleanly stop its runtime", async () => {
  const root = await tempDir();
  const config = runtimeConfig(root);
  const configPath = join(root, "runtime.json");
  const { runner } = capturingRunner();
  await new StateStore(config.state_path).create(initialState("Ember", PRINCIPAL, "2026-09-03T19:00:00Z"));
  const intent = await scheduleWake(config, configPath, "2026-09-03T20:00:00Z", { runner });

  const result = await runWakeWorker(config, intent.wake_id, {
    evaluator: async () => ({ contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] }),
  });

  assert.equal(result.status, "completed");
  assert.equal(result.decision, "no_cognition");
  const state = await new StateStore(config.state_path).load();
  const runtime = state.operations.runtime_episodes.at(-1)!;
  assert.equal(runtime.clean_stop_at === null, false);
  assert.equal(runtime.stop_reason, "episodic_wake_complete");
  const opportunity = state.operations.cognition_opportunities!.at(-1)!;
  assert.equal(opportunity.mechanism, "external_timing");
  assert.equal(opportunity.status, "decided");
  assert.equal(opportunity.decision, "no_cognition");
  const records = new EpisodicRecordStore(config.records_directory);
  assert.ok(await records.wakeObservation(intent.wake_id, "dispatching"));
  assert.ok(await records.wakeObservation(intent.wake_id, "completed"));
});

test("reconciliation should re-arm only wakes that have not begun dispatch", async () => {
  const root = await tempDir();
  const config = runtimeConfig(root);
  const configPath = join(root, "runtime.json");
  const initial = capturingRunner();
  const pending = await scheduleWake(config, configPath, "2026-09-04T10:00:00Z", { runner: initial.runner });
  const ambiguous = await scheduleWake(config, configPath, "2026-09-04T11:00:00Z", { runner: initial.runner });
  const records = new EpisodicRecordStore(config.records_directory);
  await records.observeWake(ambiguous.wake_id, {
    record_version: 1,
    kind: "dispatching",
    observed_at: "2026-09-03T20:00:00Z",
  });
  const recovery = capturingRunner();

  const result = await reconcileEpisodicRuntime(config, configPath, { runner: recovery.runner });

  assert.deepEqual(result.repairedWakes, [pending.wake_id]);
  assert.deepEqual(result.ambiguousWakes, [ambiguous.wake_id]);
  const wakeStarts = recovery.calls.filter(call => call.command === config.systemd_run_command);
  assert.equal(wakeStarts.length, 1);
  assert.equal(wakeStarts[0]!.args.at(-1), pending.wake_id);
});

test("specialist launch should persist the spec and disable blind process restart", async () => {
  const root = await tempDir();
  const config = runtimeConfig(root);
  const configPath = join(root, "runtime.json");
  const spec = createSpecialistEpisode({
    objective: "Inspect the controlled workspace",
    acceptance: ["Report inspected files"],
    context_projection: [{ content: "controlled fixture", provenance: "test", scope: SCOPE, currentness: "current" }],
    authority_envelope: {
      principal: PRINCIPAL,
      grant: "Inspect only",
      provenance: "test",
      currentness: "current",
      permitted_actions: ["inspect selected workspace"],
      prohibited_actions: ["network access", "write files"],
      escalation_conditions: ["additional authority is required"],
    },
    runtime_capability: {
      filesystem: { scope: "selected_workspace", mode: "read_write" },
      network_reach: "not_established",
      tools: ["read"],
      credentials: "allowlisted_runtime_auth",
    },
    workspace: { path: root, expected_identity: "runtime test", preserve_existing_changes: true },
    runtime_policy: {
      command: config.codex_command,
      argument_prefix: [],
      sandbox: "workspace-write",
      network: "no_additional_grant",
      configuration: "isolated",
      environment: "allowlisted_runtime_auth",
      timeout_seconds: 60,
      stdout_limit_bytes: 1024 * 1024,
      session_mode: "ephemeral",
    },
    currentness_basis: { objective_revision: "objective-1", context_revision: "context-1" },
  });
  const { calls, runner } = capturingRunner();

  await startSpecialistEpisode(config, configPath, spec, { runner });

  const persisted = JSON.parse(await readFile(join(config.records_directory, "specialists", spec.episode_id, "spec.json"), "utf8"));
  assert.equal(persisted.episode_id, spec.episode_id);
  assert.equal(calls.length, 1);
  const args = calls[0]!.args;
  assert.ok(args.includes("--property=Restart=no"));
  assert.ok(args.includes("--property=KillMode=mixed"));
  assert.ok(args.includes(`--property=TimeoutStopSec=${config.stop_timeout_seconds}s`));
  assert.equal(args.at(-1), spec.episode_id);
  assert.ok(await new EpisodicRecordStore(config.records_directory).specialistObservation(spec.episode_id, "launch_accepted"));
});

test("status should join durable runtime records with systemd observation without treating either as Ember identity", async () => {
  const root = await tempDir();
  const config = runtimeConfig(root);
  const configPath = join(root, "runtime.json");
  const first = capturingRunner();
  const wake = await scheduleWake(config, configPath, "2026-09-04T10:00:00Z", { runner: first.runner });
  const statusRunner = capturingRunner("loaded\nactive\n");

  const status = await inspectEpisodicRuntime(config, configPath, { runner: statusRunner.runner });

  assert.equal(status.wakes.length, 1);
  assert.equal(status.wakes[0]!.wake_id, wake.wake_id);
  assert.equal(status.wakes[0]!.status, "pending");
  assert.equal(status.wakes[0]!.timer_state, "active");
});

test("reconciliation unit should be one-shot and contain only explicit configured paths", async () => {
  const root = await tempDir();
  const config = runtimeConfig(root);
  const configPath = join(root, "runtime.json");

  const unit = renderReconciliationUnit(config, configPath);

  assert.match(unit, /Type=oneshot/);
  assert.match(unit, /Restart=no/);
  assert.match(unit, /reconcile --config/);
  assert.match(unit, new RegExp(config.node_path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(unit, new RegExp(configPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("systemd supervisor should refuse relative runtime configuration paths", () => {
  const config = runtimeConfig("/tmp/ember-runtime-test");
  assert.throws(() => new SystemdUserSupervisor(config, "runtime.json"), /absolute path/);
  assert.equal(specialistUnitName("episode-abc"), "ember-specialist-episode-abc");
});
