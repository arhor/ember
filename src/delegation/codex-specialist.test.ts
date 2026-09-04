import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { ROOT, tempDir } from "../../tests/support.ts";
import {
    buildSpecialistPrompt,
    createSpecialistEpisode,
    inspectSpecialistEpisode,
    reconcileInterruptedSpecialist,
    reconcileSpecialistResult,
    recordSpecialistProcessLoss,
    runCodexSpecialist,
    setSpecialistDisposition,
} from "./codex-specialist.ts";

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
            context_projection: [
                {
                    content: "SAFE_SPECIALIST_MARKER_60",
                    provenance: "test fixture",
                    scope: "project:controlled-specialist-fixture",
                    currentness: "current",
                },
            ],
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
            currentness_basis: { objective_revision: "objective-1", context_revision: "context-1" },
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
        child.stdout.end(
            `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: JSON.stringify(report) } })}\n`,
        );
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

    assert.equal(
        await readFile(join(fixture.workspace, "specialist-result.txt"), "utf8"),
        "controlled specialist work\n",
    );
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

    const accepted = await reconcileSpecialistResult(
        fixture.recordPath,
        {
            objective_revision: "objective-1",
            context_revision: "context-1",
            objective_status: "current",
        },
        { disposition: "accepted" },
    );

    assert.equal(accepted.ember_disposition, "accepted");
});

test("successful specialist output should require currentness reconciliation before acceptance", async () => {
    const fixture = await episodeFixture();
    await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });

    await assert.rejects(
        setSpecialistDisposition(fixture.recordPath, "accepted"),
        /requires reconcileSpecialistResult/,
    );
});

test("requirement change during work should require re-evaluation without erasing historical success", async () => {
    const fixture = await episodeFixture();
    await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });

    const reconciled = await reconcileSpecialistResult(
        fixture.recordPath,
        {
            objective_revision: "objective-1",
            context_revision: "context-2-requirements-changed",
            objective_status: "current",
        },
        { now: () => "2026-09-02T12:00:00.000Z" },
    );

    assert.deepEqual(
        [reconciled.report_state, reconciled.ember_disposition],
        ["reported_success", "requires_re_evaluation"],
    );
    assert.equal(reconciled.currentness_evaluation?.applicability, "requires_re_evaluation");
    assert.deepEqual(reconciled.currentness_evaluation?.started_from, fixture.spec.currentness_basis);
});

test("re-evaluated result should support a later atomic currentness check and acceptance", async () => {
    const fixture = await episodeFixture();
    await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });
    await reconcileSpecialistResult(fixture.recordPath, {
        objective_revision: "objective-1",
        context_revision: "context-2",
        objective_status: "current",
    });

    const accepted = await reconcileSpecialistResult(
        fixture.recordPath,
        {
            objective_revision: "objective-1",
            context_revision: "context-2",
            objective_status: "current",
        },
        {
            re_evaluation: {
                disposition: "accepted",
                reason: "The changed requirement does not invalidate the artifact.",
            },
        },
    );

    assert.equal(accepted.ember_disposition, "accepted");
    assert.equal(accepted.currentness_evaluation?.applicability, "requires_re_evaluation");
    assert.equal(accepted.currentness_evaluation?.resolution?.disposition, "accepted");
});

test("currentness reconciliation should reject an in-flight episode", async () => {
    const fixture = await episodeFixture();
    const record = {
        record_version: 3,
        specification: fixture.spec,
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
        observations: [],
    };
    await mkdir(join(fixture.root, "episodes"));
    await writeFile(fixture.recordPath, `${JSON.stringify(record)}\n`);

    await assert.rejects(
        reconcileSpecialistResult(fixture.recordPath, {
            objective_revision: "objective-1",
            context_revision: "context-1",
            objective_status: "current",
        }),
        /only after a final report and observed exit/,
    );
});

test("late successful result after objective supersession should be classified stale", async () => {
    const fixture = await episodeFixture();
    await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });

    const reconciled = await reconcileSpecialistResult(fixture.recordPath, {
        objective_revision: "objective-2",
        context_revision: "context-2",
        objective_status: "superseded",
    });

    assert.deepEqual([reconciled.report_state, reconciled.ember_disposition], ["reported_success", "stale"]);
    assert.equal(reconciled.currentness_evaluation?.applicability, "stale");
    assert.equal(JSON.parse(await readFile(fixture.recordPath, "utf8")).report.objective_disposition, "completed");
});

test("cancelled objective should reject a late result while retaining its provenance", async () => {
    const fixture = await episodeFixture();
    await runCodexSpecialist(fixture.spec, { recordPath: fixture.recordPath, environment: { PATH: process.env.PATH } });

    const reconciled = await reconcileSpecialistResult(fixture.recordPath, {
        objective_revision: "objective-1",
        context_revision: "context-1",
        objective_status: "cancelled",
    });

    assert.equal(reconciled.ember_disposition, "rejected");
    assert.equal(reconciled.report_provenance?.episode_id, fixture.spec.episode_id);
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
    child.stdin.on("finish", () => controller.abort());
    fixture.spec.runtime_policy.timeout_seconds = 2;

    const promise = runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        signal: controller.signal,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });
    const record = await promise;

    assert.deepEqual(
        [record.runtime_state, record.report_state, record.ember_disposition],
        ["exited", "ambiguous", "unresolved"],
    );
    assert.match(record.possible_effects.join(" "), /may have occurred/);
    assert.equal(
        record.observations.some((item) => item.kind === "cancellation_requested"),
        true,
    );
    assert.equal((durableStateAtSignal as any).runtime_state, "cancellation_requested");
    assert.equal(
        (durableStateAtSignal as any).observations.some((item: any) => item.kind === "cancellation_requested"),
        true,
    );
    assert.equal((durableStateAtSignal as any).termination.reason, "explicit_cancellation");
    assert.deepEqual(record.termination, {
        reason: "explicit_cancellation",
        direct_child_exit_observed: true,
        all_specialist_work_stopped: "unknown",
    });
    assert.equal(record.recovery.retry_state, "prohibited_pending_reconciliation");
});

test("cancellation before specialist launch should not spawn or imply effects", async () => {
    const fixture = await episodeFixture();
    const controller = new AbortController();
    controller.abort();
    let spawnCalls = 0;

    const record = await runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        signal: controller.signal,
        spawnImpl: () => {
            spawnCalls += 1;
            throw new Error("must not spawn");
        },
    });

    assert.equal(spawnCalls, 0);
    assert.deepEqual(
        [record.runtime_state, record.recovery.effect_state, record.recovery.retry_state],
        ["cancellation_requested", "no_effect_established", "safe_without_reconciliation"],
    );
    assert.equal(
        record.observations.some((item) => item.kind === "launch_attempted"),
        false,
    );
    const restartedInspection = await inspectSpecialistEpisode(fixture.recordPath);
    await assert.rejects(
        recordSpecialistProcessLoss(fixture.recordPath, "Ember restarted"),
        /before launch was attempted/,
    );
    assert.deepEqual(
        [
            restartedInspection.runtime_state,
            restartedInspection.recovery.effect_state,
            restartedInspection.recovery.retry_state,
        ],
        ["cancellation_requested", "no_effect_established", "safe_without_reconciliation"],
    );
});

test("timeout should remain distinct from explicit cancellation", async () => {
    const fixture = await episodeFixture();
    const child = new EventEmitter() as any;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal: string) => {
        queueMicrotask(() => child.emit("close", null, signal));
        return true;
    };
    fixture.spec.runtime_policy.timeout_seconds = 0.005;

    const record = await runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });

    assert.equal(
        record.observations.some((item) => item.kind === "timeout_observed"),
        true,
    );
    assert.equal(
        record.observations.some((item) => item.kind === "cancellation_requested"),
        false,
    );
    assert.equal(record.termination?.reason, "timeout");
});

test("output limit should not invent an explicit cancellation observation", async () => {
    const fixture = await episodeFixture();
    const child = new EventEmitter() as any;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal: string) => {
        queueMicrotask(() => child.emit("close", null, signal));
        return true;
    };
    child.stdin.on("finish", () => child.stdout.write(Buffer.alloc(1024 * 1024 + 1)));

    const record = await runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });

    assert.equal(record.termination?.reason, "output_limit");
    assert.equal(
        record.observations.some((item) => item.kind === "output_limit_observed"),
        true,
    );
    assert.equal(
        record.observations.some((item) => item.kind === "cancellation_requested"),
        false,
    );
});

test("cancellation during harmless work should not claim stop or non-effect", async () => {
    const fixture = await episodeFixture();
    const controller = new AbortController();
    const child = new EventEmitter() as any;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal: string) => {
        queueMicrotask(() => child.emit("close", null, signal));
        return true;
    };
    child.stdin.on("finish", () => controller.abort());

    const record = await runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        signal: controller.signal,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });

    assert.equal(record.termination?.all_specialist_work_stopped, "unknown");
    assert.equal(record.recovery.effect_state, "effects_possible");
});

test("cancellation after a workspace mutation may begin should survive restart and prohibit retry", async () => {
    const fixture = await episodeFixture();
    const controller = new AbortController();
    const child = new EventEmitter() as any;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal: string) => {
        queueMicrotask(() => child.emit("close", null, signal));
        return true;
    };
    child.stdin.on("finish", () => {
        writeFile(join(fixture.workspace, "partial-effect.txt"), "possible effect\n").then(() => controller.abort());
    });

    await runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        signal: controller.signal,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });
    const restartedInspection = await inspectSpecialistEpisode(fixture.recordPath);

    assert.equal(await readFile(join(fixture.workspace, "partial-effect.txt"), "utf8"), "possible effect\n");
    assert.equal(restartedInspection.recovery.retry_state, "prohibited_pending_reconciliation");
    assert.match(restartedInspection.recovery.reconciliation_required ?? "", /Observe the current workspace/);

    const reconciled = await reconcileInterruptedSpecialist(fixture.recordPath, {
        effects_absent: false,
        continued_work: "unknown",
        detail: "Observed partial-effect.txt after restart; the effect must be resolved before retry.",
    });
    assert.equal(reconciled.recovery.effect_state, "effects_known");
    assert.equal(reconciled.recovery.retry_state, "prohibited_pending_reconciliation");
});

test("effect absence alone should not permit retry while continued specialist work remains unknown", async () => {
    const fixture = await episodeFixture();
    const interrupted = {
        record_version: 3,
        specification: fixture.spec,
        runtime_state: "lost",
        report_state: "ambiguous",
        ember_disposition: "unresolved",
        termination: {
            reason: "explicit_cancellation",
            direct_child_exit_observed: true,
            all_specialist_work_stopped: "unknown",
        },
        recovery: {
            effect_state: "effects_possible",
            continued_work_state: "unknown",
            retry_state: "prohibited_pending_reconciliation",
            reconciliation_required: "Observe effects and continued work.",
        },
        known_effects: [],
        possible_effects: ["A detached descendant may still create an effect."],
        observations: [],
    };
    await mkdir(join(fixture.root, "episodes"));
    await writeFile(fixture.recordPath, `${JSON.stringify(interrupted)}\n`);

    const stillBlocked = await reconcileInterruptedSpecialist(fixture.recordPath, {
        effects_absent: true,
        continued_work: "unknown",
        detail: "No effect is visible yet, but descendant termination cannot be established.",
    });

    assert.equal(stillBlocked.recovery.effect_state, "no_effect_established");
    assert.equal(stillBlocked.recovery.continued_work_state, "unknown");
    assert.equal(stillBlocked.recovery.retry_state, "prohibited_pending_reconciliation");
    assert.equal(stillBlocked.termination?.all_specialist_work_stopped, "unknown");
    assert.match(stillBlocked.recovery.reconciliation_required ?? "", /continued specialist work/);
});

test("retry should become safe only after effects and continued work are both reconciled", async () => {
    const fixture = await episodeFixture();
    const interrupted = {
        record_version: 3,
        specification: fixture.spec,
        runtime_state: "lost",
        report_state: "ambiguous",
        ember_disposition: "unresolved",
        termination: { reason: "timeout", direct_child_exit_observed: true, all_specialist_work_stopped: "unknown" },
        recovery: {
            effect_state: "effects_possible",
            continued_work_state: "unknown",
            retry_state: "prohibited_pending_reconciliation",
            reconciliation_required: "Observe effects and continued work.",
        },
        known_effects: [],
        possible_effects: ["Effects may have occurred."],
        observations: [],
    };
    await mkdir(join(fixture.root, "episodes"));
    await writeFile(fixture.recordPath, `${JSON.stringify(interrupted)}\n`);

    const safe = await reconcileInterruptedSpecialist(fixture.recordPath, {
        effects_absent: true,
        continued_work: "stopped",
        detail: "Workspace and remote targets are unchanged, and no descendant or remote work remains active.",
    });

    assert.equal(safe.recovery.retry_state, "safe_without_reconciliation");
    assert.equal(safe.recovery.continued_work_state, "stopped");
    assert.equal(safe.termination?.all_specialist_work_stopped, "established");
});

test("making continued work harmless should permit retry without claiming it stopped", async () => {
    const fixture = await episodeFixture();
    const interrupted = {
        record_version: 3,
        specification: fixture.spec,
        runtime_state: "lost",
        report_state: "ambiguous",
        ember_disposition: "unresolved",
        termination: {
            reason: "explicit_cancellation",
            direct_child_exit_observed: true,
            all_specialist_work_stopped: "unknown",
        },
        recovery: {
            effect_state: "effects_possible",
            continued_work_state: "unknown",
            retry_state: "prohibited_pending_reconciliation",
            reconciliation_required: "Observe effects and continued work.",
        },
        known_effects: [],
        possible_effects: ["A detached descendant may still be running."],
        observations: [],
    };
    await mkdir(join(fixture.root, "episodes"));
    await writeFile(fixture.recordPath, `${JSON.stringify(interrupted)}\n`);

    const safe = await reconcileInterruptedSpecialist(fixture.recordPath, {
        effects_absent: true,
        continued_work: "made_harmless",
        detail: "No effect exists and the surviving descendant's write capability has been revoked.",
    });

    assert.equal(safe.recovery.retry_state, "safe_without_reconciliation");
    assert.equal(safe.recovery.continued_work_state, "made_harmless");
    assert.equal(safe.termination?.all_specialist_work_stopped, "unknown");
});

test("unconfirmed direct-child termination should persist unknown stop and effect state", async () => {
    const fixture = await episodeFixture();
    const controller = new AbortController();
    const signals: string[] = [];
    const child = new EventEmitter() as any;
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal: string) => {
        signals.push(signal);
        return true;
    };
    child.stdin.on("finish", () => controller.abort());

    const record = await runCodexSpecialist(fixture.spec, {
        recordPath: fixture.recordPath,
        signal: controller.signal,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });

    assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
    assert.deepEqual(
        [
            record.runtime_state,
            record.termination?.direct_child_exit_observed,
            record.termination?.all_specialist_work_stopped,
        ],
        ["lost", false, "unknown"],
    );
    assert.equal(
        (await inspectSpecialistEpisode(fixture.recordPath)).recovery.retry_state,
        "prohibited_pending_reconciliation",
    );
});

test("process-loss recovery should convert a committed running attempt to durable ambiguity", async () => {
    const fixture = await episodeFixture();
    const running = {
        record_version: 3,
        specification: fixture.spec,
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
            { observed_at: "2026-09-02T09:59:59.000Z", kind: "launch_attempted" },
            { observed_at: "2026-09-02T10:00:00.000Z", kind: "child_started" },
        ],
    };
    await mkdir(join(fixture.root, "episodes"));
    await writeFile(fixture.recordPath, `${JSON.stringify(running)}\n`);

    const recovered = await recordSpecialistProcessLoss(
        fixture.recordPath,
        "Ember restarted without an attachable child",
    );
    const restartedInspection = await inspectSpecialistEpisode(fixture.recordPath);

    assert.deepEqual([recovered.runtime_state, recovered.report_state], ["lost", "ambiguous"]);
    assert.equal(restartedInspection.termination?.direct_child_exit_observed, false);
    assert.equal(restartedInspection.termination?.all_specialist_work_stopped, "unknown");
    assert.equal(restartedInspection.recovery.retry_state, "prohibited_pending_reconciliation");
    assert.match(restartedInspection.possible_effects.join(" "), /continued across process loss/);
});

test("process-loss recovery should preserve ambiguity after launch attempt but before child-start commit", async () => {
    const fixture = await episodeFixture();
    const launching = {
        record_version: 3,
        specification: fixture.spec,
        runtime_state: "not_started",
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
        observations: [{ observed_at: "2026-09-02T10:00:00.000Z", kind: "launch_attempted" }],
    };
    await mkdir(join(fixture.root, "episodes"));
    await writeFile(fixture.recordPath, `${JSON.stringify(launching)}\n`);

    const recovered = await recordSpecialistProcessLoss(
        fixture.recordPath,
        "Ember restarted before child start was committed",
    );

    assert.deepEqual([recovered.runtime_state, recovered.report_state], ["lost", "ambiguous"]);
    assert.equal(recovered.recovery.effect_state, "effects_possible");
    assert.equal(recovered.recovery.continued_work_state, "unknown");
    assert.equal(recovered.recovery.retry_state, "prohibited_pending_reconciliation");
    assert.equal(recovered.termination?.reason, "boundary_failure");
    assert.equal(recovered.termination?.direct_child_exit_observed, false);
});

for (const interrupted of [
    { runtimeState: "cancellation_requested", reason: "explicit_cancellation", observation: "cancellation_requested" },
    { runtimeState: "timed_out", reason: "timeout", observation: "timeout_observed" },
] as const) {
    test(`process-loss recovery should preserve committed ${interrupted.reason} reason`, async () => {
        const fixture = await episodeFixture();
        const record = {
            record_version: 3,
            specification: fixture.spec,
            runtime_state: interrupted.runtimeState,
            report_state: "none",
            ember_disposition: "unresolved",
            termination: {
                reason: interrupted.reason,
                direct_child_exit_observed: false,
                all_specialist_work_stopped: "unknown",
            },
            recovery: {
                effect_state: "no_effect_established",
                continued_work_state: "not_applicable",
                retry_state: "not_applicable",
                reconciliation_required: null,
            },
            known_effects: [],
            possible_effects: [],
            observations: [
                { observed_at: "2026-09-02T09:59:59.000Z", kind: "launch_attempted" },
                { observed_at: "2026-09-02T10:00:00.000Z", kind: interrupted.observation },
            ],
        };
        await mkdir(join(fixture.root, "episodes"));
        await writeFile(fixture.recordPath, `${JSON.stringify(record)}\n`);

        const recovered = await recordSpecialistProcessLoss(
            fixture.recordPath,
            "Ember restarted before child exit was observed",
        );

        assert.equal(recovered.termination?.reason, interrupted.reason);
        assert.equal(recovered.termination?.direct_child_exit_observed, false);
        assert.equal(recovered.termination?.all_specialist_work_stopped, "unknown");
    });
}

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
    assert.match(
        record.observations.find((item) => item.kind === "boundary_failure")?.detail ?? "",
        /report is invalid/,
    );
    assert.deepEqual(
        [record.recovery.effect_state, record.recovery.retry_state],
        ["effects_possible", "prohibited_pending_reconciliation"],
    );
    assert.match(record.recovery.reconciliation_required ?? "", /Observe the current workspace/);
    assert.equal(
        (await inspectSpecialistEpisode(fixture.recordPath)).recovery.retry_state,
        "prohibited_pending_reconciliation",
    );
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
    assert.deepEqual(
        [record.runtime_state, record.report_state, record.ember_disposition],
        ["exited", "ambiguous", "unresolved"],
    );
    assert.match(
        record.observations.find((item) => item.kind === "boundary_failure")?.detail ?? "",
        /could not be persisted before signalling/,
    );
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

    assert.deepEqual(
        [record.runtime_state, record.report_state, record.ember_disposition],
        ["exited", "ambiguous", "unresolved"],
    );
    assert.equal(persisted.report_state, "ambiguous");
    assert.equal(
        persisted.observations.some((item: any) => item.kind === "child_exit_observed"),
        true,
    );
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
        expansion_requests: [
            {
                kind: "additional_context",
                request: "Provide the omitted project-owner rationale.",
                purpose: "Determine whether the requested file change is still desired.",
                consequence: "Additional Ember context would be disclosed to the coding specialist.",
                requires_decision_from: "Ember disclosure authority",
            },
        ],
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
    assert.equal(
        record.specification.context_projection.every((item) => item.scope === "project:controlled-specialist-fixture"),
        true,
    );
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
        expansion_requests: [
            {
                kind: "additional_authority",
                request: "Authorize creating specialist-result.txt.",
                purpose: "Complete the requested workspace change.",
                consequence: "The specialist would create a new file in the selected workspace.",
                requires_decision_from: "authority holder for the workspace mutation",
            },
        ],
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
