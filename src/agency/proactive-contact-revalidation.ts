import { randomUUID } from "node:crypto";

import type { EmberState } from "../core/model.ts";
import type { ContactAttentionWindow } from "./proactive-contact-attention-policy.ts";
import type { ProactiveContactIntentRecord } from "./proactive-contact-store.ts";

import { ValidationError } from "../core/errors.ts";
import { decideProactiveContactAttention } from "./proactive-contact-attention-policy.ts";

export interface ProactiveContactSurfaceObservation {
    surface_id: string;
    evidence_ids: string[];
}

export function revalidateProactiveContactForHandoff(
    state: EmberState,
    intent: ProactiveContactIntentRecord,
    consideredAt: string,
    surface: ProactiveContactSurfaceObservation,
) {
    const latest = intent.policy_decisions.at(-1);
    if (latest?.outcome !== "admit")
        throw new ValidationError("proactive handoff revalidation requires the latest admitted policy evidence");
    if (intent.disposition !== "pending" && intent.disposition !== "deferred")
        throw new ValidationError("proactive handoff revalidation requires a reconsiderable intent");
    return decideProactiveContactAttention(
        state,
        {
            contact_intent_id: intent.contact_intent_id,
            disposition: intent.disposition,
            principal: intent.principal,
            scope: intent.scope,
            created_at: intent.created_at,
            source_revision: intent.source.source_revision,
            grounding_meaning_ids: [...intent.source.grounding_meaning_ids],
            urgency: intent.urgency,
            urgency_meaning_ids: [...intent.urgency_meaning_ids],
            expires_at: intent.expires_at,
            representation: {
                digest: intent.representation.digest,
                currentness: intent.representation.currentness,
                evidence_ids: [...intent.representation.evidence_ids],
            },
            supersession: null,
        },
        {
            assessment_id: `contact-policy-${randomUUID()}`,
            considered_at: consideredAt,
            authority: structuredClone(latest.evidence.authority),
            attention: currentAttention(latest.evidence.attention, consideredAt),
            occurrence: structuredClone(latest.evidence.occurrence),
            surfaces: [
                {
                    surface_id: surface.surface_id,
                    preference_rank: 0,
                    status: "eligible",
                    evidence_ids: [...surface.evidence_ids],
                },
            ],
        },
    );
}

function currentAttention(previous: ContactAttentionWindow, consideredAt: string) {
    if (
        previous.status === "quiet_period" &&
        Date.parse(previous.starts_at) <= Date.parse(consideredAt) &&
        Date.parse(consideredAt) < Date.parse(previous.ends_at)
    )
        return structuredClone(previous);
    return {
        status: "available" as const,
        evidence_ids:
            previous.status === "available"
                ? [...previous.evidence_ids]
                : [...previous.evidence_ids, `contact-attention-window-elapsed:${previous.window_id}`],
    };
}
