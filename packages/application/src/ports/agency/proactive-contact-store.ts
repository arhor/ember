import type {
    ContactAttentionDecisionRecord,
    ContactReconsiderationCondition,
} from "@ember/domain/agency/proactive-contact-attention-policy.ts";
import type { DeliveryReconciliationStatus } from "@ember/domain/interaction-contract.ts";
import type { CognitionId, EvidenceId, MeaningId } from "@ember/domain/model.ts";
export type ProactiveContactDisposition =
    | "pending"
    | "deferred"
    | "suppressed"
    | "handed_off"
    | "satisfied"
    | "superseded"
    | "cancelled";
export interface ProactiveContactHandoff {
    assessment_id: `contact-policy-${string}`;
    surface_id: string;
    delivery_id: string;
    representation_digest: `sha256:${string}`;
    handed_off_at: string;
}
export interface ProactiveContactDeliveryObservation {
    delivery_id: string;
    attempt_id: string | null;
    status: DeliveryReconciliationStatus;
    observed_at: string;
}
export interface ProactiveContactIntentRecord {
    contact_intent_id: `contact-intent-${string}`;
    purpose: string;
    principal: string;
    scope: string;
    source: {
        cognition_id: CognitionId;
        expression_evidence_id: EvidenceId;
        opportunity_id: string | null;
        evidence_ids: string[];
        grounding_meaning_ids: MeaningId[];
        source_revision: number;
    };
    grounding_currentness: {
        status: "current" | "stale" | "unknown";
        evidence_ids: string[];
        assessed_at: string;
    };
    representation: {
        text: string;
        digest: `sha256:${string}`;
        currentness: "current" | "stale" | "unknown";
        evidence_ids: string[];
        classification: string;
    };
    urgency: "ordinary" | "time_sensitive";
    urgency_meaning_ids: MeaningId[];
    expires_at: string | null;
    satisfaction_boundary: "transport_acceptance" | "recipient_acknowledgement" | "independent_resolution";
    disposition: ProactiveContactDisposition;
    created_at: string;
    updated_at: string;
    next_step_owner: string | null;
    reconsideration: ContactReconsiderationCondition | null;
    policy_decisions: ContactAttentionDecisionRecord[];
    handoff: ProactiveContactHandoff | null;
    delivery_observations: ProactiveContactDeliveryObservation[];
}
export interface ProactiveContactDocument {
    proactive_contacts_version: 1;
    intents: ProactiveContactIntentRecord[];
}
export interface CreateProactiveContactIntent {
    contactIntentId?: `contact-intent-${string}`;
    purpose: string;
    principal: string;
    scope: string;
    source: ProactiveContactIntentRecord["source"];
    groundingCurrentness: ProactiveContactIntentRecord["grounding_currentness"];
    representation: Omit<ProactiveContactIntentRecord["representation"], "digest"> & {
        digest?: `sha256:${string}`;
    };
    urgency: ProactiveContactIntentRecord["urgency"];
    urgencyMeaningIds: MeaningId[];
    expiresAt: string | null;
    satisfactionBoundary: ProactiveContactIntentRecord["satisfaction_boundary"];
    createdAt?: string;
}
export interface CommitProactiveContactHandoff {
    contactIntentId: `contact-intent-${string}`;
    assessmentId: `contact-policy-${string}`;
    surfaceId: string;
    deliveryId: string;
    representationDigest: `sha256:${string}`;
    handedOffAt?: string;
}
export interface ProactiveContactStore {
    readonly path: string;
    load(): Promise<ProactiveContactDocument>;
    createIntent(input: CreateProactiveContactIntent): Promise<ProactiveContactIntentRecord>;
    recordPolicyDecision(decision: ContactAttentionDecisionRecord): Promise<ProactiveContactIntentRecord>;
    adoptHandoff(input: CommitProactiveContactHandoff): Promise<ProactiveContactIntentRecord>;
    commitHandoff(input: CommitProactiveContactHandoff): Promise<ProactiveContactIntentRecord>;
    recordReconciliationOutcome(
        contactIntentId: `contact-intent-${string}`,
        observation: ProactiveContactDeliveryObservation,
    ): Promise<ProactiveContactIntentRecord>;
}
