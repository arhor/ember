import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderError, ValidationError } from "../core/errors.ts";
import { cloneState, initialState, newId, validateState } from "../core/model.ts";
import { inspectionView } from "../core/projection.ts";
import { StateStore } from "../persistence/state-store.ts";
import { startRuntime, stopRuntime } from "../runtime/runtime.ts";
import {
    buildCognitionOpportunityProjection,
    cognitionOpportunityMetrics,
    runCognitionOpportunity,
    type CognitionOpportunityEvaluator,
} from "./cognition-opportunity.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";
const silent: CognitionOpportunityEvaluator = async () => ({
    contract_version: 1,
    decision: "no_cognition",
    selected_meaning_ids: [],
});

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-opportunity-"));
    const store = new StateStore(join(directory, "ember.json"));
    let state = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    await store.create(state);
    const lease = await store.acquireWriteLease();
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T00:00:01Z" });
    state = await store.commit(state.revision, started.state);
    return { directory, store, lease, state, runtimeId: started.runtimeId };
}

async function cleanup(
    directory: string,
    store: StateStore,
    lease: Awaited<ReturnType<StateStore["acquireWriteLease"]>>,
) {
    try {
        await store.releaseWriteLease(lease);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

test("repeated topic-free opportunities should persist intentional silence without fabricating memory", async () => {
    // Given
    const f = await fixture();
    let { state } = f;
    try {
        // When
        for (const timestamp of ["2026-09-03T00:01:00Z", "2026-09-03T00:02:00Z", "2026-09-03T00:03:00Z"]) {
            const result = await runCognitionOpportunity(f.store, state, {
                runtimeId: f.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                mechanism: "foreground_probe",
                evaluator: silent,
                timestamp,
            });
            assert.equal(result.evaluatorFailure, null);
            state = result.state;
        }

        // Then
        const opportunities = state.operations.cognition_opportunities ?? [];
        assert.equal(opportunities.length, 3);
        assert.ok(opportunities.every((item) => item.status === "decided" && item.decision === "no_cognition"));
        assert.ok(
            opportunities.every(
                (item) => item.selected_meaning_ids.length === 0 && item.interruption_status === "not_attempted",
            ),
        );
        assert.deepEqual(
            [state.meanings.length, state.evidence.length, state.operations.cognition_episodes.length],
            [0, 0, 0],
        );
        assert.deepEqual(cognitionOpportunityMetrics(state), {
            total: 3,
            evaluating: 0,
            decided: 3,
            cognition: 0,
            defer: 0,
            no_cognition: 3,
            failed: 0,
            timed_out: 0,
            cancellation_requested: 0,
            outcome_unknown: 0,
        });
        assert.equal(inspectionView(state).cognition_opportunities.length, 3);
        assert.equal(JSON.stringify(opportunities).includes("reason"), false);

        // And when a clean restart occurs, established silence remains established history.
        const stopped = stopRuntime(state, f.runtimeId, { reason: "test restart" });
        state = await f.store.commit(state.revision, stopped);
        await f.store.releaseWriteLease(f.lease);
        const reopened = new StateStore(f.store.path);
        const loaded = await reopened.load();
        const lease = await reopened.acquireWriteLease();
        try {
            const restarted = startRuntime(loaded, PRINCIPAL, SCOPE);
            const committed = await reopened.commit(loaded.revision, restarted.state);
            const persisted = committed.operations.cognition_opportunities ?? [];
            assert.equal(persisted.length, 3);
            assert.ok(persisted.every((item) => item.status === "decided" && item.decision === "no_cognition"));
            assert.deepEqual(
                [committed.meanings.length, committed.evidence.length, committed.operations.cognition_episodes.length],
                [0, 0, 0],
            );
        } finally {
            await reopened.releaseWriteLease(lease);
        }
        await rm(f.directory, { recursive: true, force: true });
    } catch (error) {
        if (f.store.lease) await f.store.releaseWriteLease(f.store.lease).catch(() => {});
        await rm(f.directory, { recursive: true, force: true });
        throw error;
    }
});

test("timeout should remain operational failure rather than being counted as silence", async () => {
    // Given
    const f = await fixture();
    let { state } = f;
    const timeout: CognitionOpportunityEvaluator = async () => {
        throw new ProviderError("synthetic timeout", {
            outcome: "timed_out",
            termination: { reason: "timeout", directChildExitObserved: true },
        });
    };
    try {
        // When
        const failed = await runCognitionOpportunity(f.store, state, {
            runtimeId: f.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator: timeout,
            timestamp: "2026-09-03T00:01:00Z",
        });
        state = failed.state;
        const quiet = await runCognitionOpportunity(f.store, state, {
            runtimeId: f.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator: silent,
            timestamp: "2026-09-03T00:02:00Z",
        });
        state = quiet.state;

        // Then
        assert.match(failed.evaluatorFailure ?? "", /synthetic timeout/);
        const [timedOut, noCognition] = state.operations.cognition_opportunities ?? [];
        assert.deepEqual([timedOut.status, timedOut.decision], ["timed_out", null]);
        assert.deepEqual([noCognition.status, noCognition.decision], ["decided", "no_cognition"]);
        const metrics = cognitionOpportunityMetrics(state);
        assert.equal(metrics.timed_out, 1);
        assert.equal(metrics.no_cognition, 1);
        assert.equal(metrics.failed, 0);
    } finally {
        await cleanup(f.directory, f.store, f.lease);
    }
});

test("inspection should distinguish cancellation and malformed evaluator failure from silence", async () => {
    // Given
    const f = await fixture();
    let { state } = f;
    const cancelled: CognitionOpportunityEvaluator = async () => {
        throw new ProviderError("synthetic cancellation", {
            outcome: "cancellation_requested",
            termination: { reason: "explicit_cancellation", directChildExitObserved: false },
        });
    };
    const malformed: CognitionOpportunityEvaluator = async () => ({
        contract_version: 1,
        decision: "invented" as never,
        selected_meaning_ids: [],
    });
    try {
        // When
        const cancellation = await runCognitionOpportunity(f.store, state, {
            runtimeId: f.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator: cancelled,
            timestamp: "2026-09-03T00:01:00Z",
        });
        state = cancellation.state;
        const failure = await runCognitionOpportunity(f.store, state, {
            runtimeId: f.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator: malformed,
            timestamp: "2026-09-03T00:02:00Z",
        });
        state = failure.state;
        const quiet = await runCognitionOpportunity(f.store, state, {
            runtimeId: f.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator: silent,
            timestamp: "2026-09-03T00:03:00Z",
        });
        state = quiet.state;

        // Then
        assert.match(cancellation.evaluatorFailure ?? "", /synthetic cancellation/);
        assert.match(failure.evaluatorFailure ?? "", /decision is invalid/);
        const inspected = inspectionView(state).cognition_opportunities;
        assert.deepEqual(
            inspected.map((item) => [item.status, item.decision]),
            [
                ["cancellation_requested", null],
                ["failed", null],
                ["decided", "no_cognition"],
            ],
        );
        const metrics = cognitionOpportunityMetrics(state);
        assert.deepEqual([metrics.cancellation_requested, metrics.failed, metrics.no_cognition], [1, 1, 1]);
    } finally {
        await cleanup(f.directory, f.store, f.lease);
    }
});

test("restart should convert an unfinished opportunity to outcome_unknown rather than silence", () => {
    // Given
    const initial = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    const started = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T00:00:01Z" });
    const state = cloneState(started.state);
    const projection = buildCognitionOpportunityProjection(state, {
        runtimeId: started.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        timestamp: "2026-09-03T00:01:00Z",
    });
    (state.operations.cognition_opportunities ??= []).push({
        opportunity_id: newId("opportunity"),
        runtime_id: started.runtimeId,
        principal: PRINCIPAL,
        active_scope: SCOPE,
        mechanism: "runtime_start",
        observed_at: "2026-09-03T00:01:00Z",
        last_durable_observation_at: "2026-09-03T00:01:00Z",
        validated_revision: state.revision,
        projected_meaning_ids: [...projection.selection.meaning_ids],
        projected_evidence_ids: [...projection.selection.evidence_ids],
        status: "evaluating",
        decision: null,
        selected_meaning_ids: [],
        interruption_status: "not_attempted",
        provider_termination: null,
    });
    validateState(state);

    // When
    const restarted = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T01:00:00Z" });

    // Then
    const occurrence = restarted.state.operations.cognition_opportunities?.[0];
    assert.equal(occurrence?.status, "outcome_unknown");
    assert.equal(occurrence?.decision, null);
    assert.equal(cognitionOpportunityMetrics(restarted.state).no_cognition, 0);
    assert.equal(cognitionOpportunityMetrics(restarted.state).outcome_unknown, 1);
});

test("schema v1 should continue accepting pre-75 states without an opportunity ledger", () => {
    // Given
    const legacy = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    delete legacy.operations.cognition_opportunities;

    // When / Then
    assert.doesNotThrow(() => validateState(legacy));
    assert.deepEqual(inspectionView(legacy).cognition_opportunities, []);
    assert.equal(cognitionOpportunityMetrics(legacy).total, 0);
});

test("durable validator should reject forged silence that claims a selected motive", () => {
    // Given
    const initial = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    const started = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T00:00:01Z" });
    const state = cloneState(started.state);
    const fake = "meaning-fabricated" as never;
    (state.operations.cognition_opportunities ??= []).push({
        opportunity_id: newId("opportunity"),
        runtime_id: started.runtimeId,
        principal: PRINCIPAL,
        active_scope: SCOPE,
        mechanism: "foreground_probe",
        observed_at: "2026-09-03T00:01:00Z",
        last_durable_observation_at: "2026-09-03T00:01:00Z",
        validated_revision: state.revision,
        projected_meaning_ids: [fake],
        projected_evidence_ids: [],
        status: "decided",
        decision: "no_cognition",
        selected_meaning_ids: [fake],
        interruption_status: "not_attempted",
        provider_termination: null,
    });

    // When / Then
    assert.throws(
        () => validateState(state),
        (error: unknown) => error instanceof ValidationError && /no_cognition must not select/.test(error.message),
    );
});
