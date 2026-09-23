import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "./errors.ts";
import { initialState } from "./model.ts";
import { startRuntime, stopRuntime } from "./runtime-episode.ts";

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
