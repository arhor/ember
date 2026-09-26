import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { EpisodicRuntimeConfig } from "./episodic-runtime.ts";

import { FakeBackgroundHost } from "../../../tests/fake-background-host.ts";
import { ROOT, PRINCIPAL, SCOPE, tempDir } from "../../../tests/support.ts";
import { createSpecialistEpisode } from "../delegation/codex-specialist.ts";
import { initialState } from "../model.ts";
import { StateStore } from "../persistence/state-store.ts";
import {
    EpisodicRecordStore,
    inspectEpisodicRuntime,
    reconcileEpisodicRuntime,
    runWakeWorker,
    scheduleWake,
    specialistJobId,
    startSpecialistEpisode,
} from "./episodic-runtime.ts";

function runtimeConfig(root: string): EpisodicRuntimeConfig {
    return {
        config_version: 1,
        state_path: join(root, "ember.json"),
        records_directory: join(root, "runtime-records"),
        principal: PRINCIPAL,
        activeScope: SCOPE,
        node_path: process.execPath,
        runtime_entrypoint: join(ROOT, "bin", "ember-runtime.ts"),
        codex_command: "/usr/bin/codex",
        codex_arguments: [],
        opportunity_timeout_seconds: 60,
        stop_timeout_seconds: 30,
    };
}

test("schedule wake should persist intent before requesting host activation", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const host = new FakeBackgroundHost();

    const intent = await scheduleWake(config, configPath, "2026-09-04T10:00:00.250Z", host, {
        now: () => "2026-09-03T20:00:00Z",
    });

    const persisted = JSON.parse(
        await readFile(join(config.records_directory, "wakes", intent.wake_id, "intent.json"), "utf8"),
    );
    assert.equal(persisted.wake_id, intent.wake_id);
    assert.equal(persisted.mechanism, "external_timing");
    assert.equal(persisted.due_at, intent.due_at);
    assert.deepEqual(host.calls, [
        {
            operation: "scheduleWake",
            dueAt: intent.due_at,
            job: {
                jobId: `ember-wake-${intent.wake_id}`,
                executable: config.node_path,
                arguments: [config.runtime_entrypoint, "run-wake", "--config", configPath, "--wake-id", intent.wake_id],
            },
        },
    ]);
});

test("schedule wake should preserve the exact host-neutral due time", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const host = new FakeBackgroundHost();

    await scheduleWake(config, configPath, "2026-09-04T10:00:00Z", host, {
        now: () => "2026-09-03T20:00:00Z",
    });

    assert.equal(host.calls[0]!.operation, "scheduleWake");
    assert.equal(host.calls[0]!.operation === "scheduleWake" ? host.calls[0]!.dueAt : null, "2026-09-04T10:00:00Z");
});

test("schedule wake should dispatch an already-due one-shot without creating a timer in the past", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const host = new FakeBackgroundHost();

    const intent = await scheduleWake(config, configPath, "2026-09-03T19:59:00Z", host, {
        now: () => "2026-09-03T20:00:00Z",
    });

    assert.equal(host.calls.length, 1);
    assert.equal(host.calls[0]!.operation, "start");
    assert.equal(
        host.calls[0]!.operation === "start" ? host.calls[0]!.job.jobId : null,
        `ember-wake-${intent.wake_id}`,
    );
});

test("wake worker should record one external-timing opportunity and cleanly stop its runtime", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const host = new FakeBackgroundHost();
    await new StateStore(config.state_path).create(initialState(PRINCIPAL, "2026-09-03T19:00:00Z"));
    const intent = await scheduleWake(config, configPath, "2026-09-03T20:00:00Z", host, {
        now: () => "2026-09-03T19:30:00Z",
    });

    const result = await runWakeWorker(config, intent.wake_id, {
        evaluator: async () => ({ contractVersion: 1, decision: "no_cognition", selectedMeaningIds: [] }),
    });

    assert.equal(result.status, "completed");
    assert.equal(result.decision, "no_cognition");
    const state = await new StateStore(config.state_path).load();
    const runtime = state.operations.runtimeEpisodes.at(-1)!;
    assert.equal(runtime.cleanStopAt === null, false);
    assert.equal(runtime.stopReason, "episodic_wake_complete");
    const opportunity = state.operations.cognitionOpportunities!.at(-1)!;
    assert.equal(opportunity.mechanism, "external_timing");
    assert.equal(opportunity.status, "decided");
    assert.equal(opportunity.decision, "no_cognition");
    const records = new EpisodicRecordStore(config.records_directory);
    assert.ok(await records.wakeObservation(intent.wake_id, "dispatching"));
    assert.ok(await records.wakeObservation(intent.wake_id, "completed"));
});

test("reconciliation should re-arm only future wakes that have not begun dispatch", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const initial = new FakeBackgroundHost();
    const pending = await scheduleWake(config, configPath, "2026-09-04T10:00:00Z", initial, {
        now: () => "2026-09-03T20:00:00Z",
    });
    const ambiguous = await scheduleWake(config, configPath, "2026-09-04T11:00:00Z", initial, {
        now: () => "2026-09-03T20:00:00Z",
    });
    const records = new EpisodicRecordStore(config.records_directory);
    await records.observeWake(ambiguous.wake_id, {
        record_version: 1,
        kind: "dispatching",
        observedAt: "2026-09-03T20:00:00Z",
    });
    const recovery = new FakeBackgroundHost();

    const result = await reconcileEpisodicRuntime(config, configPath, recovery, {
        now: () => "2026-09-03T20:05:00Z",
    });

    assert.deepEqual(result.repairedWakes, [pending.wake_id]);
    assert.deepEqual(result.startedDueWakes, []);
    assert.deepEqual(result.ambiguousWakes, [ambiguous.wake_id]);
    const wakeStarts = recovery.calls.filter((call) => call.operation === "scheduleWake");
    assert.equal(wakeStarts.length, 1);
    assert.equal(
        wakeStarts[0]!.operation === "scheduleWake" ? wakeStarts[0]!.job.jobId : null,
        `ember-wake-${pending.wake_id}`,
    );
});

test("reconciliation should dispatch one due pending wake now instead of replaying historical ticks", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const initial = new FakeBackgroundHost();
    const due = await scheduleWake(config, configPath, "2026-09-03T20:10:00Z", initial, {
        now: () => "2026-09-03T20:00:00Z",
    });
    const recovery = new FakeBackgroundHost();

    const result = await reconcileEpisodicRuntime(config, configPath, recovery, {
        now: () => "2026-09-03T20:20:00Z",
    });

    assert.deepEqual(result.startedDueWakes, [due.wake_id]);
    assert.deepEqual(result.repairedWakes, []);
    const start = recovery.calls.find((call) => call.operation === "start")!;
    assert.ok(start);
    assert.equal(start.operation === "start" ? start.job.jobId : null, `ember-wake-${due.wake_id}`);
});

test("specialist launch should persist the spec and disable blind process restart", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const spec = createSpecialistEpisode({
        objective: "Inspect the controlled workspace",
        acceptance: ["Report inspected files"],
        context_projection: [
            { content: "controlled fixture", provenance: "test", scope: SCOPE, currentness: "current" },
        ],
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
    const host = new FakeBackgroundHost();

    await startSpecialistEpisode(config, configPath, spec, host);

    const persisted = JSON.parse(
        await readFile(join(config.records_directory, "specialists", spec.episode_id, "spec.json"), "utf8"),
    );
    assert.equal(persisted.episode_id, spec.episode_id);
    assert.equal(host.calls.length, 1);
    const start = host.calls[0]!;
    assert.equal(start.operation, "start");
    assert.equal(start.operation === "start" ? start.job.jobId : null, specialistJobId(spec.episode_id));
    assert.equal(start.operation === "start" ? start.job.stopTimeoutSeconds : null, config.stop_timeout_seconds);
    assert.ok(
        await new EpisodicRecordStore(config.records_directory).specialistObservation(
            spec.episode_id,
            "launch_accepted",
        ),
    );
});

test("status should join durable runtime outcomes with one logical host observation", async () => {
    const root = await tempDir();
    const config = runtimeConfig(root);
    const configPath = join(root, "runtime.json");
    const host = new FakeBackgroundHost();
    const wake = await scheduleWake(config, configPath, "2026-09-04T10:00:00Z", host, {
        now: () => "2026-09-03T20:00:00Z",
    });
    const status = await inspectEpisodicRuntime(config, configPath, host);

    assert.equal(status.wakes.length, 1);
    assert.equal(status.wakes[0]!.wake_id, wake.wake_id);
    assert.equal(status.wakes[0]!.status, "pending");
    assert.equal(status.wakes[0]!.decision, null);
    assert.equal(status.wakes[0]!.evaluator_failure, null);
    assert.equal(status.wakes[0]!.host_job, `ember-wake-${wake.wake_id}`);
    assert.equal(status.wakes[0]!.host_state, "scheduled");
});

test("runtime record kinds should fail closed before they can become filesystem paths", async () => {
    const root = await tempDir();
    const records = new EpisodicRecordStore(join(root, "runtime-records"));

    await assert.rejects(
        records.observeWake("wake-safe", {
            record_version: 1,
            kind: "../../escape",
            observedAt: "2026-09-03T20:00:00Z",
        }),
        /record kind is invalid/,
    );
});

test("background specialist job identifiers should remain opaque host input", () => {
    assert.equal(specialistJobId("episode-abc"), "ember-specialist-episode-abc");
});
