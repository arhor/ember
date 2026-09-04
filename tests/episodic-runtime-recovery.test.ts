import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { SpecialistEpisodeRecord } from "../src/delegation/codex-specialist.ts";
import type { CommandRunner, EpisodicRuntimeConfig } from "../src/runtime/episodic-runtime.ts";

import { runCognitionOpportunity } from "../src/agency/cognition-opportunity.ts";
import { ConcurrentWriter } from "../src/core/errors.ts";
import { initialState } from "../src/core/model.ts";
import { createSpecialistEpisode, inspectSpecialistEpisode } from "../src/delegation/codex-specialist.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import {
    EpisodicRecordStore,
    inspectEpisodicRuntime,
    reconcileEpisodicRuntime,
    runWakeWorker,
    scheduleWake,
    startSpecialistEpisode,
} from "../src/runtime/episodic-runtime.ts";
import { runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { captureError, PRINCIPAL, ROOT, SCOPE, tempDir } from "./support.ts";

const OBSERVED_AT = "2026-09-04T16:00:00Z";

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

function commandResult(stdout = "") {
    return { code: 0, signal: null, stdout, stderr: "" } as const;
}

function missingUnitRunner() {
    const calls: Array<{ command: string; args: string[] }> = [];
    const runner: CommandRunner = async (command, args) => {
        calls.push({ command, args: [...args] });
        return command === "/usr/bin/systemctl" && args.includes("show")
            ? commandResult("not-found\ninactive\n")
            : commandResult();
    };
    return { calls, runner };
}

function absentProcess() {
    const error = new Error("process does not exist") as NodeJS.ErrnoException;
    error.code = "ESRCH";
    throw error;
}

async function withFixedTime<T>(timestamp: string, action: () => Promise<T>): Promise<T> {
    const previous = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = timestamp;
    try {
        return await action();
    } finally {
        if (previous === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previous;
    }
}

function specialistSpec(root: string) {
    return createSpecialistEpisode({
        objective: "Inspect the recovery fixture",
        acceptance: ["Report the inspected fixture"],
        context_projection: [
            {
                content: "isolated recovery fixture",
                provenance: "issue 83 deterministic recovery suite",
                scope: SCOPE,
                currentness: "current",
            },
        ],
        authority_envelope: {
            principal: PRINCIPAL,
            grant: "Inspect only",
            provenance: "issue 83 deterministic recovery suite",
            currentness: "current",
            permitted_actions: ["inspect the selected workspace"],
            prohibited_actions: ["network access", "write files"],
            escalation_conditions: ["additional authority is required"],
        },
        runtime_capability: {
            filesystem: { scope: "selected_workspace", mode: "read_write" },
            network_reach: "not_established",
            tools: ["read"],
            credentials: "allowlisted_runtime_auth",
        },
        workspace: { path: root, expected_identity: "issue 83 recovery fixture", preserve_existing_changes: true },
        runtime_policy: {
            command: "/usr/bin/codex",
            argument_prefix: [],
            sandbox: "workspace-write",
            network: "no_additional_grant",
            configuration: "isolated",
            environment: "allowlisted_runtime_auth",
            timeout_seconds: 60,
            stdout_limit_bytes: 1024 * 1024,
            session_mode: "ephemeral",
        },
        currentness_basis: { objective_revision: "objective-83", context_revision: "context-83" },
    });
}

test("manager restart should re-arm one pending wake without manufacturing an opportunity", async () => {
    // Given
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    await new StateStore(config.state_path).create(initialState("Ember", PRINCIPAL, OBSERVED_AT));
    const scheduled = missingUnitRunner();
    const wake = await scheduleWake(config, configPath, "2026-09-05T18:00:00Z", {
        now: () => OBSERVED_AT,
        runner: scheduled.runner,
    });
    let timerRestored = false;
    const recoveryCalls: Array<{ command: string; args: string[] }> = [];
    const recoveryRunner: CommandRunner = async (command, args) => {
        recoveryCalls.push({ command, args: [...args] });
        if (command === config.systemd_run_command) {
            timerRestored = true;
            return commandResult();
        }
        if (command === config.systemctl_command && args.includes("show")) {
            const unit = args[2] ?? "";
            if (unit.endsWith(".timer") && timerRestored) return commandResult("loaded\nactive\n");
            return commandResult("not-found\ninactive\n");
        }
        return commandResult();
    };

    // When
    const first = await reconcileEpisodicRuntime(config, configPath, {
        runner: recoveryRunner,
        now: () => "2026-09-04T18:05:00Z",
    });
    const second = await reconcileEpisodicRuntime(config, configPath, {
        runner: recoveryRunner,
        now: () => "2026-09-04T18:06:00Z",
    });
    const state = await new StateStore(config.state_path).load();

    // Then
    assert.deepEqual(first.repairedWakes, [wake.wake_id]);
    assert.deepEqual(second.repairedWakes, []);
    assert.equal(recoveryCalls.filter((call) => call.command === config.systemd_run_command).length, 1);
    assert.equal(state.operations.cognition_opportunities?.length ?? 0, 0);
});

test("stale writer lock should fail closed until explicit quarantine, then dispatch the wake only once", async () => {
    // Given
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    await new StateStore(config.state_path).create(initialState("Ember", PRINCIPAL, OBSERVED_AT));
    const supervisor = missingUnitRunner();
    const wake = await scheduleWake(config, configPath, "2026-09-04T18:01:00Z", {
        now: () => OBSERVED_AT,
        runner: supervisor.runner,
    });
    const crashedWriter = new StateStore(config.state_path, {
        hostname: "issue-83-host",
        pid: 8383,
        kill: absentProcess,
    });
    const abandonedLease = await crashedWriter.acquireWriteLease();
    await abandonedLease.handle.close();
    const recoveryStore = new StateStore(config.state_path, {
        hostname: "issue-83-host",
        kill: absentProcess,
    });

    // When
    const blocked = await captureError(() => recoveryStore.acquireWriteLease());
    const beforeRecovery = await new StateStore(config.state_path).load();
    await recoveryStore.quarantineStaleLock({
        ownerToken: abandonedLease.metadata.owner_token,
        confirmQuiescent: true,
    });
    const completed = await runWakeWorker(config, wake.wake_id, {
        evaluator: async () => ({ contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] }),
        now: () => "2026-09-04T18:02:00Z",
    });
    const duplicate = await runWakeWorker(config, wake.wake_id, {
        evaluator: async () => ({ contract_version: 1, decision: "cognition", selected_meaning_ids: [] }),
        now: () => "2026-09-04T18:03:00Z",
    });
    const afterRecovery = await new StateStore(config.state_path).load();

    // Then
    assert.ok(blocked instanceof ConcurrentWriter);
    assert.equal(blocked.diagnosis.status, "apparently_stale");
    assert.equal(beforeRecovery.operations.cognition_opportunities?.length ?? 0, 0);
    assert.equal(completed.status, "completed");
    assert.equal(duplicate.status, "already_dispatched");
    assert.equal(afterRecovery.operations.cognition_opportunities?.length, 1);
});

test("process restart should classify in-flight cognition and opportunity as outcome unknown without replay", async () => {
    // Given
    const root = await tempDir();
    const config = runtimeConfig(root);
    const store = new StateStore(config.state_path);
    await store.create(initialState("Ember", PRINCIPAL, OBSERVED_AT));
    const lease = await store.acquireWriteLease();
    let state = await store.load();
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T16:01:00Z" });
    state = await store.commit(state.revision, started.state);
    const cognitionError = await withFixedTime("2026-09-04T17:00:00Z", () =>
        captureError(() =>
            runCognition(store, state, {
                runtimeId: started.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "preserve this in-flight boundary",
                command: "/unused/provider",
                timeoutSeconds: 1,
                output: () => {},
                provider: async () => {
                    throw new Error("simulated abrupt cognition process loss");
                },
            }),
        ),
    );
    state = await store.load();
    const opportunityError = await captureError(() =>
        runCognitionOpportunity(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            timestamp: "2026-09-04T18:02:00Z",
            evaluator: async () => {
                throw new Error("simulated abrupt opportunity process loss");
            },
        }),
    );
    await store.releaseWriteLease(lease);
    const beforeRestart = await store.load();

    // When
    const restartedStore = new StateStore(config.state_path);
    const restartLease = await restartedStore.acquireWriteLease();
    const persisted = await restartedStore.load();
    const restarted = startRuntime(persisted, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T18:05:00Z" });
    const afterRestart = await restartedStore.commit(persisted.revision, restarted.state);
    await restartedStore.releaseWriteLease(restartLease);

    // Then
    assert.match(cognitionError.message, /simulated abrupt cognition process loss/);
    assert.match(opportunityError.message, /simulated abrupt opportunity process loss/);
    assert.equal(beforeRestart.operations.cognition_episodes.length, 1);
    assert.equal(beforeRestart.operations.cognition_episodes[0]!.status, "started");
    assert.equal(beforeRestart.operations.cognition_opportunities?.length, 1);
    assert.equal(beforeRestart.operations.cognition_opportunities?.[0]!.status, "evaluating");
    assert.equal(afterRestart.operations.cognition_episodes.length, 1);
    assert.equal(afterRestart.operations.cognition_episodes[0]!.status, "outcome_unknown");
    assert.equal(afterRestart.operations.cognition_opportunities?.length, 1);
    assert.equal(afterRestart.operations.cognition_opportunities?.[0]!.status, "outcome_unknown");
    assert.equal(
        afterRestart.operations.runtime_episodes.at(-1)!.recovery_account.gap_kind,
        "uncertain_interruption_boundary",
    );
});

test("restart should preserve completed cognition with pending delivery instead of duplicating or claiming delivery", async () => {
    // Given
    const root = await tempDir();
    const config = runtimeConfig(root);
    const store = new StateStore(config.state_path);
    await store.create(initialState("Ember", PRINCIPAL, OBSERVED_AT));
    const lease = await store.acquireWriteLease();
    let state = await store.load();
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T16:01:00Z" });
    state = await store.commit(state.revision, started.state);
    let displayed = "";

    // When
    const crash = await withFixedTime("2026-09-04T17:00:00Z", () =>
        captureError(() =>
            runCognition(store, state, {
                runtimeId: started.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "render once",
                command: "/unused/provider",
                timeoutSeconds: 1,
                provider: async () => ({
                    contract_version: 1,
                    reply: "recovery-boundary reply",
                    used_meaning_ids: [],
                }),
                output: (text) => {
                    displayed += text;
                },
                hooks: {
                    afterDisplay: () => {
                        throw new Error("simulated process loss after display");
                    },
                },
            }),
        ),
    );
    await store.releaseWriteLease(lease);
    const beforeRestart = await store.load();
    const restartedStore = new StateStore(config.state_path);
    const restartLease = await restartedStore.acquireWriteLease();
    const persisted = await restartedStore.load();
    const restarted = startRuntime(persisted, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T18:05:00Z" });
    const afterRestart = await restartedStore.commit(persisted.revision, restarted.state);
    await restartedStore.releaseWriteLease(restartLease);

    // Then
    assert.match(crash.message, /simulated process loss after display/);
    assert.match(displayed, /recovery-boundary reply/);
    assert.equal(beforeRestart.operations.cognition_episodes.length, 1);
    assert.equal(beforeRestart.operations.cognition_episodes[0]!.status, "completed");
    assert.equal(beforeRestart.operations.cognition_episodes[0]!.delivery_status, "pending");
    assert.equal(afterRestart.operations.cognition_episodes.length, 1);
    assert.equal(afterRestart.operations.cognition_episodes[0]!.status, "completed");
    assert.equal(afterRestart.operations.cognition_episodes[0]!.delivery_status, "pending");
});

test("forced specialist loss should preserve effect uncertainty and prohibit blind retry", async () => {
    // Given
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const spec = specialistSpec(root);
    const launched = missingUnitRunner();
    await startSpecialistEpisode(config, configPath, spec, {
        runner: launched.runner,
        now: () => OBSERVED_AT,
    });
    const records = new EpisodicRecordStore(config.records_directory);
    const record: SpecialistEpisodeRecord = {
        record_version: 3,
        specification: spec,
        runtime_state: "running",
        report_state: "none",
        ember_disposition: "unresolved",
        recovery: {
            effect_state: "no_effect_established",
            continued_work_state: "not_applicable",
            retry_state: "not_applicable",
            reconciliation_required: null,
        },
        known_effects: [],
        possible_effects: [],
        observations: [
            { observed_at: OBSERVED_AT, kind: "specification_persisted" },
            { observed_at: OBSERVED_AT, kind: "launch_attempted" },
            { observed_at: OBSERVED_AT, kind: "child_started" },
        ],
    };
    await writeFile(records.specialistRecordPath(spec.episode_id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await assert.doesNotReject(() => inspectSpecialistEpisode(records.specialistRecordPath(spec.episode_id)));
    const recovery = missingUnitRunner();

    // When
    const first = await reconcileEpisodicRuntime(config, configPath, {
        runner: recovery.runner,
        now: () => "2026-09-04T18:05:00Z",
    });
    const second = await reconcileEpisodicRuntime(config, configPath, {
        runner: recovery.runner,
        now: () => "2026-09-04T18:06:00Z",
    });
    const recovered = await inspectSpecialistEpisode(records.specialistRecordPath(spec.episode_id));
    const status = await inspectEpisodicRuntime(config, configPath, { runner: recovery.runner });

    // Then
    assert.deepEqual(first.lostSpecialists, [spec.episode_id]);
    assert.deepEqual(second.lostSpecialists, []);
    assert.equal(recovered.runtime_state, "lost");
    assert.equal(recovered.report_state, "ambiguous");
    assert.equal(recovered.recovery.effect_state, "effects_possible");
    assert.equal(recovered.recovery.continued_work_state, "unknown");
    assert.equal(recovered.recovery.retry_state, "prohibited_pending_reconciliation");
    assert.ok(recovered.possible_effects.length > 0);
    assert.equal(status.specialists[0]!.status, "lost");
    assert.equal(status.specialists[0]!.unit_state, "not_found");
    assert.equal(status.specialists[0]!.retry_state, "prohibited_pending_reconciliation");
    assert.equal(recovery.calls.filter((call) => call.command === config.systemd_run_command).length, 0);
});

test("inspection should keep a supervisor-accepted pre-episode specialist gap explicit instead of inventing work outcome", async () => {
    // Given
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const spec = specialistSpec(root);
    const launched = missingUnitRunner();
    await startSpecialistEpisode(config, configPath, spec, {
        runner: launched.runner,
        now: () => OBSERVED_AT,
    });
    const records = new EpisodicRecordStore(config.records_directory);
    await records.observeSpecialist(spec.episode_id, {
        record_version: 1,
        observed_at: "2026-09-04T18:00:01Z",
        kind: "worker_started",
    });
    const recovery = missingUnitRunner();

    // When
    const reconciliation = await reconcileEpisodicRuntime(config, configPath, {
        runner: recovery.runner,
        now: () => "2026-09-04T18:05:00Z",
    });
    const status = await inspectEpisodicRuntime(config, configPath, { runner: recovery.runner });

    // Then
    assert.deepEqual(reconciliation.lostSpecialists, []);
    assert.equal(status.specialists[0]!.status, "running");
    assert.equal(status.specialists[0]!.unit_state, "not_found");
    assert.equal(status.specialists[0]!.runtime_state, null);
    assert.equal(status.specialists[0]!.report_state, null);
    assert.equal(status.specialists[0]!.retry_state, null);
});
