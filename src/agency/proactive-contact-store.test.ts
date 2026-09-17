import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { CognitionId, EvidenceId, MeaningId } from "../core/model.ts";
import type { ContactAttentionDecisionRecord } from "./proactive-contact-attention-policy.ts";

import { contentDigest } from "../util.ts";
import { ProactiveContactStore, proactiveContactInspectionView } from "./proactive-contact-store.ts";

const CREATED_AT = "2026-09-17T10:00:00Z";
const CONSIDERED_AT = "2026-09-17T10:01:00Z";
const HANDED_OFF_AT = "2026-09-17T10:02:00Z";
const TEXT = "The release needs your attention.";

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-proactive-contact-"));
    const statePath = join(directory, "ember.json");
    const store = new ProactiveContactStore(statePath);
    return { directory, statePath, store, close: () => rm(directory, { recursive: true, force: true }) };
}

function input() {
    return {
        contactIntentId: "contact-intent-release" as const,
        purpose: "Tell the principal that the release requires attention",
        principal: "max",
        scope: "private",
        source: {
            cognition_id: "cognition-source" as CognitionId,
            expression_evidence_id: "evidence-expression" as EvidenceId,
            opportunity_id: "opportunity-release",
            evidence_ids: ["evidence-source"],
            grounding_meaning_ids: ["meaning-release" as MeaningId],
            source_revision: 3,
        },
        groundingCurrentness: {
            status: "current" as const,
            evidence_ids: ["evidence-grounding-current"],
            assessed_at: CREATED_AT,
        },
        representation: {
            text: TEXT,
            currentness: "current" as const,
            evidence_ids: ["evidence-representation-current"],
            classification: "private",
        },
        urgency: "ordinary" as const,
        urgencyMeaningIds: [],
        expiresAt: null,
        satisfactionBoundary: "transport_acceptance" as const,
        createdAt: CREATED_AT,
    };
}

function decision(outcome: "admit" | "defer" | "suppress" = "admit"): ContactAttentionDecisionRecord {
    const base = {
        assessment_id: "contact-policy-release" as const,
        contact_intent_id: "contact-intent-release" as const,
        considered_at: CONSIDERED_AT,
        source_revision: 3,
        current_revision: 4,
        evidence: {
            grounding_meaning_ids: ["meaning-release" as MeaningId],
            representation_evidence_ids: ["evidence-representation-current"],
            authority: { status: "authorized" as const, evidence_ids: ["evidence-authority"] },
            attention: { status: "available" as const, evidence_ids: ["evidence-attention"] },
            occurrence: { status: "distinct" as const, related_intent_id: null, evidence_ids: ["evidence-distinct"] },
            surfaces: [
                {
                    surface_id: "telegram_bot",
                    preference_rank: 1,
                    status: "eligible" as const,
                    evidence_ids: ["evidence-telegram"],
                },
            ],
            supersession_evidence_ids: [],
        },
    };
    if (outcome === "admit")
        return {
            ...base,
            outcome,
            basis: "current_authorized_intent",
            interruption: "interrupt",
            selected_surface_id: "telegram_bot",
            next_step_owner: null,
            reconsideration: null,
        };
    if (outcome === "defer")
        return {
            ...base,
            outcome,
            basis: "no_eligible_surface",
            interruption: "remain_silent",
            selected_surface_id: null,
            next_step_owner: "ember_attention_policy",
            reconsideration: { kind: "evidence_change", signal: "surface_eligibility" },
        };
    return {
        ...base,
        outcome,
        basis: "authority_denied",
        interruption: "remain_silent",
        selected_surface_id: null,
        next_step_owner: null,
        reconsideration: null,
    };
}

test("proactive contact lifecycle persists an admitted handoff and redacts retained text", async () => {
    const f = await fixture();
    try {
        const created = await f.store.createIntent(input());
        assert.equal(created.disposition, "pending");
        assert.equal(created.representation.digest, contentDigest(TEXT));
        await f.store.recordPolicyDecision(decision());
        const handedOff = await f.store.commitHandoff({
            contactIntentId: created.contact_intent_id,
            assessmentId: "contact-policy-release",
            surfaceId: "telegram_bot",
            deliveryId: "delivery-release",
            representationDigest: created.representation.digest,
            handedOffAt: HANDED_OFF_AT,
        });
        assert.equal(handedOff.disposition, "handed_off");
        const satisfied = await f.store.recordReconciliationOutcome(created.contact_intent_id, {
            delivery_id: "delivery-release",
            attempt_id: "attempt-release",
            status: "confirmed",
            observed_at: "2026-09-17T10:03:00Z",
        });
        assert.equal(satisfied.disposition, "satisfied");
        const inspection = proactiveContactInspectionView(await f.store.load());
        assert.equal(JSON.stringify(inspection).includes(TEXT), false);
        assert.deepEqual(inspection.intents[0]?.representation, {
            available: true,
            digest: contentDigest(TEXT),
            currentness: "current",
            evidence_ids: ["evidence-representation-current"],
            classification: "private",
        });
    } finally {
        await f.close();
    }
});

test("policy replay is idempotent while conflicting replay and illegal transitions fail", async () => {
    const f = await fixture();
    try {
        await f.store.createIntent(input());
        const first = await f.store.recordPolicyDecision(decision("defer"));
        const replay = await f.store.recordPolicyDecision(decision("defer"));
        assert.deepEqual(replay, first);
        await assert.rejects(
            f.store.recordPolicyDecision({ ...decision("suppress"), assessment_id: "contact-policy-release" }),
            /replay conflicts/,
        );
        await assert.rejects(
            f.store.commitHandoff({
                contactIntentId: "contact-intent-release",
                assessmentId: "contact-policy-release",
                surfaceId: "telegram_bot",
                deliveryId: "delivery-release",
                representationDigest: contentDigest(TEXT),
                handedOffAt: HANDED_OFF_AT,
            }),
            /admitted assessment/,
        );
    } finally {
        await f.close();
    }
});

test("malformed persistence and cross-intent delivery correlation are rejected", async () => {
    const f = await fixture();
    try {
        await writeFile(f.store.path, '{"proactive_contacts_version":2,"intents":[]}\n', "utf8");
        await assert.rejects(f.store.load(), /version is unsupported/);

        const secondStore = new ProactiveContactStore(join(f.directory, "second.json"));
        const created = await secondStore.createIntent(input());
        await secondStore.recordPolicyDecision(decision());
        await secondStore.commitHandoff({
            contactIntentId: created.contact_intent_id,
            assessmentId: "contact-policy-release",
            surfaceId: "telegram_bot",
            deliveryId: "delivery-shared",
            representationDigest: created.representation.digest,
            handedOffAt: HANDED_OFF_AT,
        });
        const record = (await secondStore.load()).intents[0]!;
        const second = structuredClone(record);
        second.contact_intent_id = "contact-intent-two";
        second.policy_decisions[0]!.contact_intent_id = "contact-intent-two";
        const malformed = {
            proactive_contacts_version: 1,
            intents: [record, second],
        };
        await writeFile(f.store.path, `${JSON.stringify(malformed)}\n`, "utf8");
        await assert.rejects(f.store.load(), /correlated to multiple intents/);
    } finally {
        await f.close();
    }
});
