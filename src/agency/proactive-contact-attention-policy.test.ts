import assert from "node:assert/strict";
import test from "node:test";

import type { MeaningId } from "../core/model.ts";
import type {
    ContactAttentionPolicyRequest,
    ProactiveContactIntentSnapshot,
} from "./proactive-contact-attention-policy.ts";

import { initialState } from "../core/model.ts";
import { rememberFact, transitionCommitment, undertake } from "../core/semantics.ts";
import { decideProactiveContactAttention } from "./proactive-contact-attention-policy.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";
const CREATED_AT = "2026-09-17T20:00:00Z";
const CONSIDERED_AT = "2026-09-17T22:30:00Z";
const DIGEST = `sha256:${"a".repeat(64)}` as const;

function fixture() {
    const previousNow = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = "2026-09-17T19:00:01Z";
    const state = initialState(PRINCIPAL, "2026-09-17T19:00:00Z");
    let commitmentId: MeaningId;
    let urgencyId: MeaningId;
    try {
        commitmentId = undertake(state, PRINCIPAL, "release", SCOPE, "Prepare the release before morning");
        urgencyId = rememberFact(
            state,
            PRINCIPAL,
            `user:${PRINCIPAL}`,
            "release-window",
            SCOPE,
            "The release window closes tonight",
        );
    } finally {
        if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previousNow;
    }
    return { state, commitmentId, urgencyId };
}

function intent(
    stateRevision: number,
    commitmentId: MeaningId,
    overrides: Partial<ProactiveContactIntentSnapshot> = {},
): ProactiveContactIntentSnapshot {
    return {
        contact_intent_id: "contact-intent-release-reminder",
        disposition: "pending",
        principal: PRINCIPAL,
        scope: SCOPE,
        created_at: CREATED_AT,
        source_revision: stateRevision,
        grounding_meaning_ids: [commitmentId],
        urgency: "ordinary",
        urgency_meaning_ids: [],
        expires_at: "2026-09-18T08:00:00Z",
        representation: {
            digest: DIGEST,
            currentness: "current",
            evidence_ids: ["evidence-representation-current"],
        },
        supersession: null,
        ...overrides,
    };
}

function request(overrides: Partial<ContactAttentionPolicyRequest> = {}): ContactAttentionPolicyRequest {
    return {
        assessment_id: "contact-policy-release-reminder",
        considered_at: CONSIDERED_AT,
        authority: { status: "authorized", evidence_ids: ["evidence-standing-contact-authority"] },
        attention: { status: "available", evidence_ids: ["evidence-attention-available"] },
        occurrence: { status: "distinct", related_intent_id: null, evidence_ids: ["evidence-distinct-occurrence"] },
        surfaces: [
            {
                surface_id: "surface-secondary",
                preference_rank: 2,
                status: "eligible",
                evidence_ids: ["evidence-secondary-eligible"],
            },
            {
                surface_id: "surface-preferred",
                preference_rank: 1,
                status: "eligible",
                evidence_ids: ["evidence-preferred-eligible"],
            },
        ],
        ...overrides,
    };
}

test("attention policy should admit the preferred eligible surface when the intent remains current", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId);
    const before = structuredClone(f.state);

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, request());

    // Then
    assert.deepEqual(
        [decision.outcome, decision.basis, decision.interruption, decision.selected_surface_id],
        ["admit", "current_authorized_intent", "interrupt", "surface-preferred"],
    );
    assert.equal(decision.current_revision, f.state.revision);
    assert.deepEqual(decision.evidence.grounding_meaning_ids, [f.commitmentId]);
    assert.deepEqual(f.state, before);
});

test("attention policy should defer ordinary contact until the quiet period ends when assessed during quiet time", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId);
    const policyRequest = request({
        attention: {
            status: "quiet_period",
            window_id: "principal-night",
            starts_at: "2026-09-17T22:00:00Z",
            ends_at: "2026-09-18T07:00:00Z",
            evidence_ids: ["evidence-principal-quiet-window"],
        },
    });

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, policyRequest);

    // Then
    assert.deepEqual(
        [decision.outcome, decision.basis, decision.interruption, decision.reconsider_after],
        ["defer", "quiet_period", "remain_silent", "2026-09-18T07:00:00Z"],
    );
    assert.deepEqual(decision.evidence.attention, policyRequest.attention);
});

test("attention policy should suppress a confirmed duplicate when occurrence evidence names the existing intent", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId);
    const policyRequest = request({
        occurrence: {
            status: "confirmed_duplicate",
            related_intent_id: "contact-intent-existing-release-reminder",
            evidence_ids: ["evidence-domain-correlation"],
        },
    });

    // When
    const first = decideProactiveContactAttention(f.state, contactIntent, policyRequest);
    const replay = decideProactiveContactAttention(f.state, contactIntent, policyRequest);

    // Then
    assert.deepEqual(first, replay);
    assert.deepEqual(
        [first.outcome, first.basis, first.interruption, first.selected_surface_id],
        ["suppress", "duplicate_intent", "remain_silent", null],
    );
    assert.deepEqual(first.evidence.occurrence, policyRequest.occurrence);
});

test("attention policy should suppress an intent when a successor has superseded it", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId, {
        supersession: {
            successor_intent_id: "contact-intent-revised-release-reminder",
            evidence_ids: ["evidence-successor-committed"],
        },
    });

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, request());

    // Then
    assert.deepEqual([decision.outcome, decision.basis], ["suppress", "superseded_intent"]);
    assert.deepEqual(decision.evidence.supersession_evidence_ids, ["evidence-successor-committed"]);
});

test("attention policy should suppress a stale intent when grounding changes before interruption", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId);
    transitionCommitment(f.state, PRINCIPAL, f.commitmentId, "fulfilled", "The release preparation is complete", {
        timestamp: "2026-09-17T21:00:00Z",
    });

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, request());

    // Then
    assert.deepEqual(
        [decision.outcome, decision.basis, decision.interruption],
        ["suppress", "stale_grounding", "remain_silent"],
    );
    assert.equal(decision.source_revision, contactIntent.source_revision);
    assert.equal(decision.current_revision, f.state.revision);
});

test("attention policy should defer when no surface is currently eligible", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId);
    const policyRequest = request({
        surfaces: [
            {
                surface_id: "surface-preferred",
                preference_rank: 1,
                status: "temporarily_unavailable",
                evidence_ids: ["evidence-surface-offline"],
            },
        ],
    });

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, policyRequest);

    // Then
    assert.deepEqual(
        [decision.outcome, decision.basis, decision.interruption, decision.selected_surface_id],
        ["defer", "no_eligible_surface", "remain_silent", null],
    );
});

test("attention policy should not derive contact authority from an eligible surface", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId);
    const policyRequest = request({
        authority: { status: "unknown", evidence_ids: ["evidence-authority-not-established"] },
    });

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, policyRequest);

    // Then
    assert.deepEqual(
        [decision.outcome, decision.basis, decision.selected_surface_id],
        ["defer", "authority_unknown", null],
    );
    assert.equal(decision.evidence.surfaces[0]?.status, "eligible");
});

test("attention policy should admit grounded time-sensitive contact when a quiet period is active", () => {
    // Given
    const f = fixture();
    const contactIntent = intent(f.state.revision, f.commitmentId, {
        grounding_meaning_ids: [f.commitmentId, f.urgencyId],
        urgency: "time_sensitive",
        urgency_meaning_ids: [f.urgencyId],
    });
    const policyRequest = request({
        attention: {
            status: "quiet_period",
            window_id: "principal-night",
            starts_at: "2026-09-17T22:00:00Z",
            ends_at: "2026-09-18T07:00:00Z",
            evidence_ids: ["evidence-principal-quiet-window"],
        },
    });

    // When
    const decision = decideProactiveContactAttention(f.state, contactIntent, policyRequest);

    // Then
    assert.deepEqual(
        [decision.outcome, decision.basis, decision.selected_surface_id],
        ["admit", "current_authorized_intent", "surface-preferred"],
    );
});
