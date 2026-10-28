import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "./errors.ts";
import { initialState, newId, validateState } from "./model.ts";
import { startRuntime, stopRuntime, stopRuntimeAfterFailure } from "./runtime-episode.ts";
import { userEvidence } from "./semantics.ts";

const PRINCIPAL = "runtime-test-principal";
const SCOPE = "runtime-test-scope";

test("startRuntime should create initial recovery evidence when no prior runtime exists", () => {
    // Given
    const state = initialState(PRINCIPAL, "2026-09-23T08:00:00Z");

    // When
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T08:01:00Z" });

    // Then
    assert.equal(state.operations.runtimeEpisodes.length, 0);
    assert.deepEqual(started.state.operations.runtimeEpisodes, [
        {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            activeScope: SCOPE,
            startedAt: "2026-09-23T08:01:00Z",
            lastDurableObservationAt: "2026-09-23T08:01:00Z",
            cleanStopAt: null,
            stopReason: null,
            recoveryAccount: {
                previousRuntime: null,
                currentRuntime: started.runtimeId,
                gapKind: "initial_start",
                lastDurableObservationAt: null,
                cleanStopAt: null,
                restartAt: "2026-09-23T08:01:00Z",
                agentCognitionDuringInterval: "not_applicable",
                externalChangesDuringInterval: "unknown",
            },
        },
    ]);
});

test("stopRuntime should record a clean stop without mutating the supplied state when runtime is active", () => {
    // Given
    const initial = initialState(PRINCIPAL, "2026-09-23T08:00:00Z");
    const started = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T08:01:00Z" });

    // When
    const stopped = stopRuntime(started.state, started.runtimeId, {
        reason: "focused lifecycle test",
        timestamp: "2026-09-23T08:02:00Z",
    });

    // Then
    assert.equal(started.state.operations.runtimeEpisodes[0]!.cleanStopAt, null);
    assert.deepEqual(
        {
            lastDurableObservationAt: stopped.operations.runtimeEpisodes[0]!.lastDurableObservationAt,
            cleanStopAt: stopped.operations.runtimeEpisodes[0]!.cleanStopAt,
            stopReason: stopped.operations.runtimeEpisodes[0]!.stopReason,
        },
        {
            lastDurableObservationAt: "2026-09-23T08:02:00Z",
            cleanStopAt: "2026-09-23T08:02:00Z",
            stopReason: "focused lifecycle test",
        },
    );
});

test("stopRuntime should reject a second stop when runtime already stopped cleanly", () => {
    // Given
    const initial = initialState(PRINCIPAL, "2026-09-23T08:00:00Z");
    const started = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T08:01:00Z" });
    const stopped = stopRuntime(started.state, started.runtimeId, {
        reason: "first stop",
        timestamp: "2026-09-23T08:02:00Z",
    });

    // When
    const secondStop = () =>
        stopRuntime(stopped, started.runtimeId, {
            reason: "second stop",
            timestamp: "2026-09-23T08:03:00Z",
        });

    // Then
    assert.throws(secondStop, ValidationError);
});

test("startRuntime should preserve clean recovery evidence when prior runtime stopped explicitly", () => {
    // Given
    const initial = initialState(PRINCIPAL, "2026-09-23T08:00:00Z");
    const first = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T08:01:00Z" });
    const stopped = stopRuntime(first.state, first.runtimeId, {
        reason: "clean restart test",
        timestamp: "2026-09-23T08:02:00Z",
    });

    // When
    const restarted = startRuntime(stopped, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T09:00:00Z" });

    // Then
    assert.deepEqual(restarted.state.operations.runtimeEpisodes[1]!.recoveryAccount, {
        previousRuntime: first.runtimeId,
        currentRuntime: restarted.runtimeId,
        gapKind: "known_clean_stop_interval",
        lastDurableObservationAt: "2026-09-23T08:02:00Z",
        cleanStopAt: "2026-09-23T08:02:00Z",
        restartAt: "2026-09-23T09:00:00Z",
        agentCognitionDuringInterval: "none_in_supported_runtime",
        externalChangesDuringInterval: "unknown",
    });
});

test("startRuntime should preserve uncertain recovery evidence and terminalize in-flight work when prior runtime was interrupted", () => {
    // Given
    const initial = initialState(PRINCIPAL, "2026-09-23T08:00:00Z");
    const first = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T08:01:00Z" });
    const input = userEvidence(first.state, PRINCIPAL, SCOPE, "unfinished input", {
        timestamp: "2026-09-23T08:02:00Z",
    });
    const cognitionId = newId("cognition");
    const opportunityId = newId("opportunity");
    first.state.operations.runtimeEpisodes[0]!.lastDurableObservationAt = "2026-09-23T08:03:00Z";
    first.state.operations.cognitionEpisodes.push({
        cognitionId,
        runtimeId: first.runtimeId,
        principal: PRINCIPAL,
        activeScope: SCOPE,
        providerLabel: "focused-test-provider",
        purpose: "ordinary",
        startedAt: "2026-09-23T08:02:00Z",
        lastDurableObservationAt: "2026-09-23T08:02:00Z",
        status: "started",
        selectedMeaningIds: [],
        selectedEvidenceIds: [],
        usedMeaningIds: [],
        inputEvidenceId: input.evidenceId,
        expressionEvidenceId: null,
        deliveryStatus: "not_attempted",
        externalProviderThreadId: null,
        providerTermination: null,
    });
    first.state.operations.cognitionOpportunities!.push({
        opportunityId,
        runtimeId: first.runtimeId,
        principal: PRINCIPAL,
        activeScope: SCOPE,
        mechanism: "runtime_start",
        observedAt: "2026-09-23T08:03:00Z",
        lastDurableObservationAt: "2026-09-23T08:03:00Z",
        validatedRevision: first.state.revision,
        projectedMeaningIds: [],
        projectedEvidenceIds: [],
        status: "evaluating",
        decision: null,
        selectedMeaningIds: [],
        interruptionStatus: "not_attempted",
        providerTermination: null,
    });
    validateState(first.state);

    // When
    const restarted = startRuntime(first.state, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T09:00:00Z" });

    // Then
    assert.deepEqual(restarted.state.operations.runtimeEpisodes[1]!.recoveryAccount, {
        previousRuntime: first.runtimeId,
        currentRuntime: restarted.runtimeId,
        gapKind: "uncertain_interruption_boundary",
        lastDurableObservationAt: "2026-09-23T08:03:00Z",
        cleanStopAt: null,
        restartAt: "2026-09-23T09:00:00Z",
        agentCognitionDuringInterval: "unknown_after_last_durable_observation",
        externalChangesDuringInterval: "unknown",
    });
    assert.deepEqual(
        {
            cognitionStatus: restarted.state.operations.cognitionEpisodes[0]!.status,
            cognitionObservedAt: restarted.state.operations.cognitionEpisodes[0]!.lastDurableObservationAt,
            opportunityStatus: restarted.state.operations.cognitionOpportunities![0]!.status,
            opportunityObservedAt: restarted.state.operations.cognitionOpportunities![0]!.lastDurableObservationAt,
        },
        {
            cognitionStatus: "outcome_unknown",
            cognitionObservedAt: "2026-09-23T08:02:00Z",
            opportunityStatus: "outcome_unknown",
            opportunityObservedAt: "2026-09-23T09:00:00Z",
        },
    );
});

test("stopRuntimeAfterFailure should terminalize in-flight cognition when application interaction fails", () => {
    // Given
    const initial = initialState(PRINCIPAL, "2026-09-23T08:00:00Z");
    const started = startRuntime(initial, PRINCIPAL, SCOPE, { timestamp: "2026-09-23T08:01:00Z" });
    const input = userEvidence(started.state, PRINCIPAL, SCOPE, "unfinished input", {
        timestamp: "2026-09-23T08:02:00Z",
    });
    started.state.operations.runtimeEpisodes[0]!.lastDurableObservationAt = "2026-09-23T08:02:00Z";
    started.state.operations.cognitionEpisodes.push({
        cognitionId: newId("cognition"),
        runtimeId: started.runtimeId,
        principal: PRINCIPAL,
        activeScope: SCOPE,
        providerLabel: "focused-test-provider",
        purpose: "ordinary",
        startedAt: "2026-09-23T08:02:00Z",
        lastDurableObservationAt: "2026-09-23T08:02:00Z",
        status: "started",
        selectedMeaningIds: [],
        selectedEvidenceIds: [],
        usedMeaningIds: [],
        inputEvidenceId: input.evidenceId,
        expressionEvidenceId: null,
        deliveryStatus: "not_attempted",
        externalProviderThreadId: null,
        providerTermination: null,
    });
    validateState(started.state);

    // When
    const stopped = stopRuntimeAfterFailure(started.state, started.runtimeId, {
        reason: "application_interaction_failed",
        timestamp: "2026-09-23T08:03:00Z",
    });

    // Then
    assert.deepEqual(
        {
            runtimeStoppedAt: stopped.operations.runtimeEpisodes[0]!.cleanStopAt,
            cognitionStatus: stopped.operations.cognitionEpisodes[0]!.status,
            cognitionObservedAt: stopped.operations.cognitionEpisodes[0]!.lastDurableObservationAt,
        },
        {
            runtimeStoppedAt: "2026-09-23T08:03:00Z",
            cognitionStatus: "outcome_unknown",
            cognitionObservedAt: "2026-09-23T08:03:00Z",
        },
    );
});
