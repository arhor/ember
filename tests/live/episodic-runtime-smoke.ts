#!/usr/bin/env node

import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { SpecialistEpisodeRecord } from "../../src/delegation/codex-specialist.ts";
import type { EpisodicRuntimeConfig, RuntimeObservation } from "../../src/runtime/episodic-runtime.ts";

import { initialState } from "../../src/core/model.ts";
import { createSpecialistEpisode, inspectSpecialistEpisode } from "../../src/delegation/codex-specialist.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import {
    EpisodicRecordStore,
    SystemdUserSupervisor,
    runCommand,
    scheduleWake,
    specialistUnitName,
    startSpecialistEpisode,
    wakeUnitName,
} from "../../src/runtime/episodic-runtime.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const PRINCIPAL = "live-runtime-smoke-user";
const SCOPE = "smoke:episodic-runtime";
const WAKE_TIMEOUT_MS = 90_000;
const SPECIALIST_TIMEOUT_MS = 240_000;

if (process.env.EMBER_RUN_LIVE_EPISODIC !== "1") {
    process.stderr.write("Run through `npm run smoke:runtime:live` to execute the real systemd + Codex smoke.\n");
    process.exitCode = 2;
} else if (process.platform !== "linux") {
    process.stderr.write("The episodic runtime live smoke requires Linux with a systemd user manager.\n");
    process.exitCode = 2;
} else {
    await main();
}

async function main() {
    const systemdRun = await findExecutable("systemd-run");
    const systemctl = await findExecutable("systemctl");
    const codex = await findExecutable("codex");
    const journalctl = await findExecutable("journalctl", false);
    const manager = await runCommand(systemctl, ["--user", "show-environment"]);
    if (manager.code !== 0) {
        throw new Error(`systemd user manager is unavailable: ${manager.stderr.trim() || manager.stdout.trim()}`);
    }

    const root = await mkdtemp(join(tmpdir(), "ember-episodic-live-smoke-"));
    const statePath = join(root, "ember.json");
    const recordsDirectory = join(root, "runtime-records");
    const configPath = join(root, "runtime.json");
    const specialistWorkspace = join(root, "specialist-workspace");
    let wakeId: string | null = null;
    let specialistId: string | null = null;
    let succeeded = false;

    const config: EpisodicRuntimeConfig = {
        config_version: 1,
        state_path: statePath,
        records_directory: recordsDirectory,
        principal: PRINCIPAL,
        active_scope: SCOPE,
        node_path: process.execPath,
        runtime_entrypoint: resolve(ROOT, "bin", "ember-runtime.ts"),
        codex_command: codex,
        codex_arguments: [],
        opportunity_timeout_seconds: 90,
        systemd_run_command: systemdRun,
        systemctl_command: systemctl,
        stop_timeout_seconds: 30,
    };

    try {
        await new StateStore(statePath).create(initialState("Ember", PRINCIPAL));
        await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        await mkdir(specialistWorkspace);
        await writeFile(join(specialistWorkspace, "README.md"), "# Ember episodic runtime live smoke\n", "utf8");

        const supervisor = new SystemdUserSupervisor(config, configPath);
        const records = new EpisodicRecordStore(recordsDirectory);

        const dueAt = new Date(Date.now() + 10_000).toISOString();
        const wake = await scheduleWake(config, configPath, dueAt);
        wakeId = wake.wake_id;
        const wakeBase = wakeUnitName(wakeId);
        const initialTimerState = await supervisor.unitState(`${wakeBase}.timer`);
        assert.equal(initialTimerState, "active", `expected ${wakeBase}.timer to become active before the due time`);

        const wakeTerminal = await waitForWake(records, wakeId, WAKE_TIMEOUT_MS);
        assert.equal(
            wakeTerminal.kind,
            "completed",
            `wake worker did not complete cleanly: ${wakeTerminal.detail ?? wakeTerminal.kind}`,
        );
        assert.equal(wakeTerminal.evaluator_failure, null, `wake evaluator failed: ${wakeTerminal.evaluator_failure}`);
        assert.ok(
            ["cognition", "defer", "no_cognition"].includes(String(wakeTerminal.decision)),
            "wake did not persist a valid decision",
        );
        assert.ok(
            await records.wakeObservation(wakeId, "dispatching"),
            "wake never crossed the durable dispatching boundary",
        );
        await requireNonActive(supervisor, `${wakeBase}.service`);
        await requireNonActive(supervisor, `${wakeBase}.timer`);

        const spec = createSpecialistEpisode({
            objective: "Create smoke.txt containing exactly: ember episodic runtime live smoke",
            acceptance: [
                "smoke.txt is created in the selected workspace",
                "smoke.txt contains exactly the requested text followed by one newline",
                "No other workspace artifact is modified",
            ],
            context_projection: [
                {
                    content:
                        "This is an isolated temporary workspace used only for Ember episodic runtime live validation.",
                    provenance: "repository live smoke harness",
                    scope: SCOPE,
                    currentness: "current for this smoke attempt",
                },
            ],
            authority_envelope: {
                principal: PRINCIPAL,
                grant: "Create only smoke.txt in the selected temporary workspace",
                provenance: "explicit execution of the repository live smoke harness",
                currentness: "current for this smoke attempt",
                permitted_actions: ["inspect the selected workspace", "create smoke.txt in the selected workspace"],
                prohibited_actions: [
                    "network access",
                    "access outside the selected workspace",
                    "modify any other file",
                ],
                escalation_conditions: ["any additional access, authority, or consequential action is needed"],
            },
            runtime_capability: {
                filesystem: { scope: "selected_workspace", mode: "read_write" },
                network_reach: "not_established",
                tools: ["Codex runtime-selected workspace tools"],
                credentials: "allowlisted_runtime_auth",
            },
            workspace: {
                path: resolve(specialistWorkspace),
                expected_identity: "ephemeral episodic runtime smoke workspace",
                preserve_existing_changes: true,
            },
            runtime_policy: {
                command: codex,
                argument_prefix: [],
                sandbox: "workspace-write",
                network: "no_additional_grant",
                configuration: "isolated",
                environment: "allowlisted_runtime_auth",
                timeout_seconds: 180,
                stdout_limit_bytes: 1024 * 1024,
                session_mode: "ephemeral",
            },
            currentness_basis: {
                objective_revision: "episodic-live-smoke-objective-1",
                context_revision: "episodic-live-smoke-context-1",
            },
        });
        specialistId = await startSpecialistEpisode(config, configPath, spec);
        const specialist = await waitForSpecialist(records.specialistRecordPath(specialistId), SPECIALIST_TIMEOUT_MS);
        assert.equal(specialist.runtime_state, "exited", `specialist runtime ended as ${specialist.runtime_state}`);
        assert.equal(
            specialist.report_state,
            "reported_success",
            `specialist report ended as ${specialist.report_state}`,
        );
        assert.equal(
            specialist.report?.objective_disposition,
            "completed",
            "specialist did not report the smoke objective completed",
        );
        assert.deepEqual((await readdir(specialistWorkspace)).sort(), ["README.md", "smoke.txt"]);
        assert.equal(
            await readFile(join(specialistWorkspace, "README.md"), "utf8"),
            "# Ember episodic runtime live smoke\n",
        );
        assert.equal(
            await readFile(join(specialistWorkspace, "smoke.txt"), "utf8"),
            "ember episodic runtime live smoke\n",
            "specialist smoke artifact content differs from the bounded objective",
        );
        assert.ok(
            await records.specialistObservation(specialistId, "worker_started"),
            "specialist worker never established worker_started",
        );
        assert.ok(
            await records.specialistObservation(specialistId, "worker_completed"),
            "specialist worker never established worker_completed",
        );
        await requireNonActive(supervisor, `${specialistUnitName(specialistId)}.service`);

        succeeded = true;
        process.stdout.write(
            `${JSON.stringify(
                {
                    live_smoke_version: 1,
                    systemd_user_manager: "available",
                    node: process.execPath,
                    codex,
                    wake: {
                        wake_id: wakeId,
                        timer_observed_active: true,
                        terminal_kind: wakeTerminal.kind,
                        decision: wakeTerminal.decision,
                        evaluator_failure: wakeTerminal.evaluator_failure,
                        timer_left_active: false,
                        worker_left_active: false,
                    },
                    specialist: {
                        episode_id: specialistId,
                        runtime_state: specialist.runtime_state,
                        report_state: specialist.report_state,
                        objective_disposition: specialist.report?.objective_disposition ?? null,
                        smoke_artifact_verified: true,
                        worker_left_active: false,
                    },
                    persistent_units_installed: false,
                    result: "pass",
                },
                null,
                2,
            )}\n`,
        );
    } catch (error) {
        process.stderr.write(`Episodic runtime live smoke failed; temporary evidence is preserved at ${root}\n`);
        if (journalctl) {
            for (const unit of diagnosticUnits(wakeId, specialistId)) {
                const journal = await runCommand(journalctl, ["--user", "--unit", unit, "--no-pager", "--lines=80"]);
                if (journal.stdout.trim()) process.stderr.write(`\n--- journal: ${unit} ---\n${journal.stdout}`);
            }
        }
        throw error;
    } finally {
        await cleanupUnits(systemctl, wakeId, specialistId);
        if (succeeded) await rm(root, { recursive: true, force: true });
    }
}

async function waitForWake(
    records: EpisodicRecordStore,
    wakeId: string,
    timeoutMs: number,
): Promise<RuntimeObservation> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const failed = await records.wakeObservation(wakeId, "failed");
        if (failed) return failed;
        const completed = await records.wakeObservation(wakeId, "completed");
        if (completed) return completed;
        await delay(500);
    }
    throw new Error(`wake ${wakeId} did not reach a terminal durable observation before the live-smoke deadline`);
}

async function waitForSpecialist(recordPath: string, timeoutMs: number): Promise<SpecialistEpisodeRecord> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const record = await inspectSpecialistEpisode(recordPath);
            if (["exited", "lost"].includes(record.runtime_state)) return record;
        } catch (error) {
            if (errorCode(error) !== "ENOENT") throw error;
        }
        await delay(500);
    }
    throw new Error("specialist did not reach an exited/lost durable record before the live-smoke deadline");
}

async function requireNonActive(supervisor: SystemdUserSupervisor, unit: string) {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const state = await supervisor.unitState(unit);
        if (state !== "active") return;
        await delay(250);
    }
    throw new Error(`${unit} remained active after durable worker completion`);
}

async function cleanupUnits(systemctl: string, wakeId: string | null, specialistId: string | null) {
    for (const unit of diagnosticUnits(wakeId, specialistId)) {
        await runCommand(systemctl, ["--user", "stop", unit]).catch(() => {});
        await runCommand(systemctl, ["--user", "reset-failed", unit]).catch(() => {});
    }
}

function diagnosticUnits(wakeId: string | null, specialistId: string | null) {
    const units: string[] = [];
    if (wakeId) {
        const base = wakeUnitName(wakeId);
        units.push(`${base}.timer`, `${base}.service`);
    }
    if (specialistId) units.push(`${specialistUnitName(specialistId)}.service`);
    return units;
}

function findExecutable(name: string): Promise<string>;
function findExecutable(name: string, required: true): Promise<string>;
function findExecutable(name: string, required: false): Promise<string | null>;
async function findExecutable(name: string, required = true): Promise<string | null> {
    for (const directory of (process.env.PATH ?? "").split(delimiter)) {
        if (!directory) continue;
        const candidate = resolve(directory, name);
        try {
            await access(candidate, constants.X_OK);
            return await realpath(candidate);
        } catch {}
    }
    if (required) throw new Error(`${name} is not executable on PATH`);
    return null;
}

function errorCode(error: unknown) {
    return error !== null &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
}
