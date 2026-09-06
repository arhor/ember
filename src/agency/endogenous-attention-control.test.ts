import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CognitionOpportunityOccurrence, EvidenceId, MeaningId, RuntimeId } from "../core/model.ts";
import type { CognitionOpportunityEvaluator } from "./cognition-opportunity.ts";

import { initialState, newId } from "../core/model.ts";
import { rememberFact, undertake } from "../core/semantics.ts";
import { StateStore } from "../persistence/state-store.ts";
import { startRuntime } from "../runtime/runtime.ts";
import { runCognitionOpportunity } from "./cognition-opportunity.ts";
import { decideRepeatedCognitionAttention } from "./endogenous-attention-control.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";

function decidedCognition({
    runtimeId,
    meaningIds,
    evidenceIds,
}: {
    runtimeId: RuntimeId;
    meaningIds: MeaningId[];
    evidenceIds: EvidenceId[];
}): CognitionOpportunityOccurrence {
    return {
        opportunityId: newId("opportunity"),
        runtimeId: runtimeId,
        principal: PRINCIPAL,
        activeScope: SCOPE,
        mechanism: "foreground_probe",
        observedAt: "2026-09-03T00:01:00Z",
        lastDurableObservationAt: "2026-09-03T00:01:01Z",
        validatedRevision: 1,
        projectedMeaningIds: [...meaningIds],
        projectedEvidenceIds: [...evidenceIds],
        status: "decided",
        decision: "cognition",
        selectedMeaningIds: [...meaningIds],
        interruptionStatus: "not_attempted",
        providerTermination: null,
    };
}

test("same projection in the same runtime should defer only after prior cognition", () => {
    const runtimeId = newId("runtime");
    const meaningId = newId("meaning");
    const evidenceId = newId("evidence");
    const history = [decidedCognition({ runtimeId, meaningIds: [meaningId], evidenceIds: [evidenceId] })];

    const repeated = decideRepeatedCognitionAttention(history, {
        runtimeId: runtimeId,
        principal: PRINCIPAL,
        activeScope: SCOPE,
        mechanism: "foreground_probe",
        projectedMeaningIds: [meaningId],
        projectedEvidenceIds: [evidenceId],
    });
    const changed = decideRepeatedCognitionAttention(history, {
        runtimeId: runtimeId,
        principal: PRINCIPAL,
        activeScope: SCOPE,
        mechanism: "foreground_probe",
        projectedMeaningIds: [meaningId, newId("meaning")],
        projectedEvidenceIds: [evidenceId],
    });
    const restarted = decideRepeatedCognitionAttention(history, {
        runtimeId: newId("runtime"),
        principal: PRINCIPAL,
        activeScope: SCOPE,
        mechanism: "foreground_probe",
        projectedMeaningIds: [meaningId],
        projectedEvidenceIds: [evidenceId],
    });

    assert.equal(repeated.outcome, "defer_repeated_projection");
    assert.deepEqual(repeated.selectedMeaningIds, [meaningId]);
    assert.equal(changed.outcome, "evaluate");
    assert.equal(restarted.outcome, "evaluate");
});

test("durable opportunity path should skip repeated evaluator work but reopen after projection change", async () => {
    const previousNow = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = "2026-09-03T00:00:00Z";
    const directory = await mkdtemp(join(tmpdir(), "ember-attention-control-"));
    const store = new StateStore(join(directory, "ember.json"));
    let state = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    undertake(state, PRINCIPAL, "release-notes", SCOPE, "Prepare release notes before release");
    rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "release-window", SCOPE, "Release is imminent");
    await store.create(state);
    const lease = await store.acquireWriteLease();
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T00:00:01Z" });
    state = await store.commit(state.revision, started.state);

    let evaluatorCalls = 0;
    const evaluator: CognitionOpportunityEvaluator = async (request) => {
        evaluatorCalls += 1;
        return {
            contractVersion: 1,
            decision: "cognition",
            selectedMeaningIds: [...request.projection.selection.meaning_ids],
        };
    };

    try {
        process.env.EMBER_TEST_NOW = "2026-09-03T00:01:01Z";
        const first = await runCognitionOpportunity(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator,
            timestamp: "2026-09-03T00:01:00Z",
        });
        state = first.state;

        process.env.EMBER_TEST_NOW = "2026-09-03T00:02:01Z";
        const repeated = await runCognitionOpportunity(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator,
            timestamp: "2026-09-03T00:02:00Z",
        });
        state = repeated.state;

        assert.equal(first.evaluatorInvoked, true);
        assert.equal(first.attentionOutcome, "evaluate");
        assert.equal(repeated.evaluatorInvoked, false);
        assert.equal(repeated.attentionOutcome, "defer_repeated_projection");
        assert.equal(repeated.attentionSourceOpportunityId, first.opportunityId);
        assert.equal(evaluatorCalls, 1);
        assert.deepEqual(
            (state.operations.cognitionOpportunities ?? []).map((item) => item.decision),
            ["cognition", "defer"],
        );

        process.env.EMBER_TEST_NOW = "2026-09-03T00:02:30Z";
        rememberFact(
            state,
            PRINCIPAL,
            `user:${PRINCIPAL}`,
            "release-channel",
            SCOPE,
            "Release will use the stable channel",
        );
        state = await store.commit(state.revision, state);

        process.env.EMBER_TEST_NOW = "2026-09-03T00:03:01Z";
        const changed = await runCognitionOpportunity(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator,
            timestamp: "2026-09-03T00:03:00Z",
        });
        state = changed.state;

        assert.equal(changed.evaluatorInvoked, true);
        assert.equal(changed.attentionOutcome, "evaluate");
        assert.equal(evaluatorCalls, 2);
        assert.deepEqual(
            (state.operations.cognitionOpportunities ?? []).map((item) => item.decision),
            ["cognition", "defer", "cognition"],
        );
    } finally {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
        if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previousNow;
    }
});
