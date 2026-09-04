import assert from "node:assert/strict";
import test from "node:test";

import type { MeaningId } from "../core/model.ts";
import type { CompletedInternalCognition, InterruptionDecisionRequest } from "./interruption-decision.ts";

import { initialState } from "../core/model.ts";
import { rememberFact, transitionCommitment, undertake } from "../core/semantics.ts";
import { decideUserInterruption } from "./interruption-decision.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";
const AT = "2026-09-05T12:00:00Z";

function fixture() {
    const previousNow = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = "2026-09-03T00:00:01Z";
    const state = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
    let commitmentId: MeaningId;
    let urgencyId: MeaningId;
    try {
        commitmentId = undertake(
            state,
            PRINCIPAL,
            "release-preparation",
            SCOPE,
            "Prepare the release notes before release",
        );
        urgencyId = rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "release-window", SCOPE, "Release is imminent");
    } finally {
        if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previousNow;
    }
    const source: CompletedInternalCognition = {
        opportunity_id: "opportunity-1" as CompletedInternalCognition["opportunity_id"],
        cognition_id: "cognition-1" as CompletedInternalCognition["cognition_id"],
        principal: PRINCIPAL,
        active_scope: SCOPE,
        validated_revision: state.revision,
        status: "completed",
        used_meaning_ids: [commitmentId, urgencyId],
    };
    return { state, source, commitmentId, urgencyId };
}

function request(
    source: CompletedInternalCognition | null,
    commitmentId: MeaningId,
    urgencyId: MeaningId,
    overrides: Partial<InterruptionDecisionRequest> = {},
): InterruptionDecisionRequest {
    return {
        source,
        candidate:
            source === null
                ? null
                : {
                      grounding_meaning_ids: [commitmentId, urgencyId],
                      urgency: "time_sensitive",
                      urgency_meaning_ids: [urgencyId],
                  },
        authority: "authorized",
        attention: "available",
        previously_delivered_grounding_sets: [],
        considered_at: AT,
        ...overrides,
    };
}

test("current authorized time-sensitive internal result may justify interruption", () => {
    const f = fixture();
    const before = structuredClone(f.state);

    const result = decideUserInterruption(f.state, request(f.source, f.commitmentId, f.urgencyId));

    assert.deepEqual([result.outcome, result.basis], ["deliver", "current_authorized_candidate"]);
    assert.equal(result.cognition_id, f.source.cognition_id);
    assert.deepEqual(f.state, before);
});

test("ordinary internal result should defer during a quiet period", () => {
    const f = fixture();
    const result = decideUserInterruption(
        f.state,
        request(f.source, f.commitmentId, f.urgencyId, {
            candidate: {
                grounding_meaning_ids: [f.commitmentId],
                urgency: "ordinary",
                urgency_meaning_ids: [],
            },
            attention: "quiet_period",
        }),
    );

    assert.deepEqual([result.outcome, result.basis], ["defer", "quiet_period"]);
});

test("internal cognition must not manufacture interruption authority", () => {
    const f = fixture();
    const unknown = decideUserInterruption(
        f.state,
        request(f.source, f.commitmentId, f.urgencyId, { authority: "unknown" }),
    );
    const denied = decideUserInterruption(
        f.state,
        request(f.source, f.commitmentId, f.urgencyId, { authority: "denied" }),
    );

    assert.deepEqual([unknown.outcome, unknown.basis], ["defer", "authority_unknown"]);
    assert.deepEqual([denied.outcome, denied.basis], ["suppress", "authority_denied"]);
});

test("only an actually repeated delivered grounding set should be suppressed", () => {
    const f = fixture();
    const repeated = decideUserInterruption(
        f.state,
        request(f.source, f.commitmentId, f.urgencyId, {
            previously_delivered_grounding_sets: [[f.urgencyId, f.commitmentId]],
        }),
    );
    const combinedForFirstTime = decideUserInterruption(
        f.state,
        request(f.source, f.commitmentId, f.urgencyId, {
            previously_delivered_grounding_sets: [[f.commitmentId], [f.urgencyId]],
        }),
    );

    assert.deepEqual([repeated.outcome, repeated.basis], ["suppress", "repeated_grounding"]);
    assert.deepEqual(
        [combinedForFirstTime.outcome, combinedForFirstTime.basis],
        ["deliver", "current_authorized_candidate"],
    );
});

test("resolved concern should suppress a stale interruption candidate", () => {
    const f = fixture();
    transitionCommitment(f.state, PRINCIPAL, f.commitmentId, "fulfilled", "The release notes are complete", {
        timestamp: "2026-09-04T12:00:00Z",
    });

    const result = decideUserInterruption(f.state, request(f.source, f.commitmentId, f.urgencyId));

    assert.deepEqual([result.outcome, result.basis], ["suppress", "stale_grounding"]);
});

test("completed cognition may end without a delivery candidate, and absent cognition stays no-delivery", () => {
    const f = fixture();
    const withoutCandidate = decideUserInterruption(
        f.state,
        request(f.source, f.commitmentId, f.urgencyId, { candidate: null }),
    );
    const withoutCognition = decideUserInterruption(f.state, request(null, f.commitmentId, f.urgencyId));

    assert.deepEqual([withoutCandidate.outcome, withoutCandidate.basis], ["no_delivery", "no_interruption_candidate"]);
    assert.deepEqual([withoutCognition.outcome, withoutCognition.basis], ["no_delivery", "no_completed_cognition"]);
});

test("candidate and urgency claims must stay inside completed cognition grounding", () => {
    const f = fixture();
    const outside = "meaning-outside" as MeaningId;
    assert.throws(
        () =>
            decideUserInterruption(
                f.state,
                request(f.source, f.commitmentId, f.urgencyId, {
                    candidate: {
                        grounding_meaning_ids: [outside],
                        urgency: "ordinary",
                        urgency_meaning_ids: [],
                    },
                }),
            ),
        /completed cognition usage/,
    );
    assert.throws(
        () =>
            decideUserInterruption(
                f.state,
                request(f.source, f.commitmentId, f.urgencyId, {
                    candidate: {
                        grounding_meaning_ids: [f.commitmentId, f.urgencyId],
                        urgency: "time_sensitive",
                        urgency_meaning_ids: [],
                    },
                }),
            ),
        /explicit urgency grounding/,
    );
});

test("interruption requires a completed internal cognition source", () => {
    const f = fixture();
    const unfinished = { ...f.source, status: "started" as never };

    assert.throws(
        () => decideUserInterruption(f.state, request(unfinished, f.commitmentId, f.urgencyId)),
        /source cognition must be completed/,
    );
    assert.throws(
        () =>
            decideUserInterruption(
                f.state,
                request(null, f.commitmentId, f.urgencyId, {
                    candidate: {
                        grounding_meaning_ids: [f.commitmentId],
                        urgency: "ordinary",
                        urgency_meaning_ids: [],
                    },
                }),
            ),
        /candidate requires completed internal cognition/,
    );
});
