import type { EmberState, MeaningId } from "../core/model.ts";

import { ValidationError } from "../core/errors.ts";
import { isRfc3339Utc, validateState } from "../core/model.ts";
import { isNotBlankString } from "../util.ts";

export type ContactAttentionOutcome = "admit" | "defer" | "suppress";
export type ContactAttentionBasis =
    | "current_authorized_intent"
    | "quiet_period"
    | "no_eligible_surface"
    | "authority_unknown"
    | "authority_denied"
    | "intent_expired"
    | "stale_grounding"
    | "representation_stale"
    | "representation_currentness_unknown"
    | "duplicate_intent"
    | "duplicate_identity_uncertain"
    | "superseded_intent";

export interface ProactiveContactIntentSnapshot {
    contact_intent_id: `contact-intent-${string}`;
    disposition: "pending" | "deferred";
    principal: string;
    scope: string;
    created_at: string;
    source_revision: number;
    grounding_meaning_ids: MeaningId[];
    urgency: "ordinary" | "time_sensitive";
    urgency_meaning_ids: MeaningId[];
    expires_at: string | null;
    representation: {
        digest: `sha256:${string}`;
        currentness: "current" | "stale" | "unknown";
        evidence_ids: string[];
    };
    supersession: null | {
        successor_intent_id: `contact-intent-${string}`;
        evidence_ids: string[];
    };
}

export interface ContactAuthorityAssessment {
    status: "authorized" | "unknown" | "denied";
    evidence_ids: string[];
}

export type ContactAttentionWindow =
    | {
          status: "available";
          evidence_ids: string[];
      }
    | {
          status: "quiet_period";
          window_id: string;
          starts_at: string;
          ends_at: string;
          evidence_ids: string[];
      };

export interface ContactOccurrenceAssessment {
    status: "distinct" | "confirmed_duplicate" | "identity_uncertain";
    related_intent_id: `contact-intent-${string}` | null;
    evidence_ids: string[];
}

export interface ContactSurfaceCandidate {
    surface_id: string;
    preference_rank: number;
    status: "eligible" | "temporarily_unavailable" | "ineligible";
    evidence_ids: string[];
}

export interface ContactAttentionPolicyRequest {
    assessment_id: `contact-policy-${string}`;
    considered_at: string;
    authority: ContactAuthorityAssessment;
    attention: ContactAttentionWindow;
    occurrence: ContactOccurrenceAssessment;
    surfaces: ContactSurfaceCandidate[];
}

export type ContactReconsiderationCondition =
    | { kind: "not_before"; at: string }
    | {
          kind: "evidence_change";
          signal:
              | "representation_currentness"
              | "successor_established_or_representation_revalidated"
              | "authority"
              | "occurrence_identity"
              | "surface_eligibility";
      };

interface ContactAttentionDecisionBase {
    assessment_id: `contact-policy-${string}`;
    contact_intent_id: `contact-intent-${string}`;
    considered_at: string;
    source_revision: number;
    current_revision: number;
    evidence: {
        grounding_meaning_ids: MeaningId[];
        representation_evidence_ids: string[];
        authority: ContactAuthorityAssessment;
        attention: ContactAttentionWindow;
        occurrence: ContactOccurrenceAssessment;
        surfaces: ContactSurfaceCandidate[];
        supersession_evidence_ids: string[];
    };
}

export type ContactAttentionDecisionRecord = ContactAttentionDecisionBase &
    (
        | {
              outcome: "admit";
              basis: "current_authorized_intent";
              interruption: "interrupt";
              selected_surface_id: string;
              next_step_owner: null;
              reconsideration: null;
          }
        | {
              outcome: "defer";
              basis:
                  | "quiet_period"
                  | "no_eligible_surface"
                  | "authority_unknown"
                  | "representation_stale"
                  | "representation_currentness_unknown"
                  | "duplicate_identity_uncertain";
              interruption: "remain_silent";
              selected_surface_id: null;
              next_step_owner: "ember_attention_policy" | "ember_intent_owner";
              reconsideration: ContactReconsiderationCondition;
          }
        | {
              outcome: "suppress";
              basis:
                  | "authority_denied"
                  | "intent_expired"
                  | "stale_grounding"
                  | "duplicate_intent"
                  | "superseded_intent";
              interruption: "remain_silent";
              selected_surface_id: null;
              next_step_owner: null;
              reconsideration: null;
          }
    );

export function decideProactiveContactAttention(
    state: EmberState,
    intent: ProactiveContactIntentSnapshot,
    request: ContactAttentionPolicyRequest,
): ContactAttentionDecisionRecord {
    validateState(state);
    validateIntent(state, intent);
    validateRequest(intent, request);

    const base = decisionBase(state, intent, request);
    if (intent.supersession !== null) return suppressDecision(base, "superseded_intent");

    const consideredAt = Date.parse(request.considered_at);
    if (intent.expires_at !== null && Date.parse(intent.expires_at) <= consideredAt) {
        return suppressDecision(base, "intent_expired");
    }
    if (!hasCurrentGrounding(state, intent, consideredAt)) {
        return suppressDecision(base, "stale_grounding");
    }
    if (intent.representation.currentness === "stale") {
        return deferDecision(base, "representation_stale", "ember_intent_owner", {
            kind: "evidence_change",
            signal: "successor_established_or_representation_revalidated",
        });
    }
    if (intent.representation.currentness === "unknown") {
        return deferDecision(base, "representation_currentness_unknown", "ember_intent_owner", {
            kind: "evidence_change",
            signal: "representation_currentness",
        });
    }
    if (request.authority.status === "denied") return suppressDecision(base, "authority_denied");
    if (request.authority.status === "unknown") {
        return deferDecision(base, "authority_unknown", "ember_attention_policy", {
            kind: "evidence_change",
            signal: "authority",
        });
    }
    if (request.occurrence.status === "confirmed_duplicate") {
        return suppressDecision(base, "duplicate_intent");
    }
    if (request.occurrence.status === "identity_uncertain") {
        return deferDecision(base, "duplicate_identity_uncertain", "ember_attention_policy", {
            kind: "evidence_change",
            signal: "occurrence_identity",
        });
    }
    if (request.attention.status === "quiet_period" && intent.urgency === "ordinary") {
        return deferDecision(base, "quiet_period", "ember_attention_policy", {
            kind: "not_before",
            at: request.attention.ends_at,
        });
    }

    const selectedSurface = request.surfaces
        .filter((surface) => surface.status === "eligible")
        .toSorted(
            (left, right) =>
                left.preference_rank - right.preference_rank || compareCodeUnits(left.surface_id, right.surface_id),
        )[0];
    if (selectedSurface === undefined) {
        return deferDecision(base, "no_eligible_surface", "ember_attention_policy", {
            kind: "evidence_change",
            signal: "surface_eligibility",
        });
    }

    return {
        ...base,
        outcome: "admit",
        basis: "current_authorized_intent",
        interruption: "interrupt",
        selected_surface_id: selectedSurface.surface_id,
        next_step_owner: null,
        reconsideration: null,
    };
}

function decisionBase(
    state: EmberState,
    intent: ProactiveContactIntentSnapshot,
    request: ContactAttentionPolicyRequest,
): ContactAttentionDecisionBase {
    return {
        assessment_id: request.assessment_id,
        contact_intent_id: intent.contact_intent_id,
        considered_at: request.considered_at,
        source_revision: intent.source_revision,
        current_revision: state.revision,
        evidence: {
            grounding_meaning_ids: [...intent.grounding_meaning_ids],
            representation_evidence_ids: [...intent.representation.evidence_ids],
            authority: cloneAuthority(request.authority),
            attention: cloneAttention(request.attention),
            occurrence: cloneOccurrence(request.occurrence),
            surfaces: request.surfaces.map((surface) => ({ ...surface, evidence_ids: [...surface.evidence_ids] })),
            supersession_evidence_ids: [...(intent.supersession?.evidence_ids ?? [])],
        },
    };
}

function deferDecision(
    base: ReturnType<typeof decisionBase>,
    basis: Extract<ContactAttentionDecisionRecord, { outcome: "defer" }>["basis"],
    nextStepOwner: Extract<ContactAttentionDecisionRecord, { outcome: "defer" }>["next_step_owner"],
    reconsideration: ContactReconsiderationCondition,
): ContactAttentionDecisionRecord {
    return {
        ...base,
        outcome: "defer",
        basis,
        interruption: "remain_silent",
        selected_surface_id: null,
        next_step_owner: nextStepOwner,
        reconsideration,
    };
}

function suppressDecision(
    base: ReturnType<typeof decisionBase>,
    basis: Extract<ContactAttentionDecisionRecord, { outcome: "suppress" }>["basis"],
): ContactAttentionDecisionRecord {
    return {
        ...base,
        outcome: "suppress",
        basis,
        interruption: "remain_silent",
        selected_surface_id: null,
        next_step_owner: null,
        reconsideration: null,
    };
}

function compareCodeUnits(left: string, right: string): number {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function hasCurrentGrounding(state: EmberState, intent: ProactiveContactIntentSnapshot, consideredAt: number): boolean {
    const currentMeaningIds = new Set(
        state.meanings
            .filter(
                (meaning) =>
                    meaning.currentness === "current" &&
                    meaning.scope === intent.scope &&
                    Date.parse(meaning.applicableFrom) <= consideredAt &&
                    (meaning.applicableUntil === null || Date.parse(meaning.applicableUntil) > consideredAt) &&
                    (meaning.kind !== "commitment" || meaning.prospectiveLifecycle === "live"),
            )
            .map((meaning) => meaning.meaningId),
    );
    return intent.grounding_meaning_ids.every((meaningId) => currentMeaningIds.has(meaningId));
}

function validateIntent(state: EmberState, intent: ProactiveContactIntentSnapshot) {
    requirePrefixedId(intent.contact_intent_id, "contact-intent-", "contact intent id");
    if (!(intent.disposition === "pending" || intent.disposition === "deferred")) {
        throw new ValidationError("attention policy requires a pending or deferred contact intent");
    }
    if (intent.principal !== state.runtimeContract.localPrincipal) {
        throw new ValidationError("contact intent principal differs from Ember runtime contract");
    }
    requireText(intent.scope, "contact intent scope");
    requireTimestamp(intent.created_at, "contact intent created_at");
    requireRevision(intent.source_revision, "contact intent source revision");
    if (intent.source_revision > state.revision) {
        throw new ValidationError("contact intent cannot originate from a future Ember revision");
    }
    requireUniqueNonEmpty(intent.grounding_meaning_ids, "contact intent grounding meanings");
    if (!(intent.urgency === "ordinary" || intent.urgency === "time_sensitive")) {
        throw new ValidationError("contact intent urgency is invalid");
    }
    requireUnique(intent.urgency_meaning_ids, "contact intent urgency grounding meanings");
    const grounding = new Set(intent.grounding_meaning_ids);
    if (!intent.urgency_meaning_ids.every((meaningId) => grounding.has(meaningId))) {
        throw new ValidationError("contact intent urgency must be grounded in intent meanings");
    }
    if (intent.urgency === "time_sensitive" && intent.urgency_meaning_ids.length === 0) {
        throw new ValidationError("time-sensitive contact intent requires explicit urgency grounding");
    }
    if (intent.urgency === "ordinary" && intent.urgency_meaning_ids.length !== 0) {
        throw new ValidationError("ordinary contact intent must not claim urgency grounding");
    }
    if (intent.expires_at !== null) {
        requireTimestamp(intent.expires_at, "contact intent expires_at");
        if (Date.parse(intent.expires_at) <= Date.parse(intent.created_at)) {
            throw new ValidationError("contact intent expiry must follow creation");
        }
    }
    if (!/^sha256:[a-f\d]{64}$/.test(intent.representation.digest)) {
        throw new ValidationError("contact intent representation digest must be sha256");
    }
    if (!(["current", "stale", "unknown"] as const).includes(intent.representation.currentness)) {
        throw new ValidationError("contact intent representation currentness is invalid");
    }
    requireUniqueNonEmpty(intent.representation.evidence_ids, "representation currentness evidence");
    if (intent.supersession !== null) {
        requirePrefixedId(intent.supersession.successor_intent_id, "contact-intent-", "successor contact intent id");
        if (intent.supersession.successor_intent_id === intent.contact_intent_id) {
            throw new ValidationError("contact intent cannot supersede itself");
        }
        requireUniqueNonEmpty(intent.supersession.evidence_ids, "contact intent supersession evidence");
    }
}

function validateRequest(intent: ProactiveContactIntentSnapshot, request: ContactAttentionPolicyRequest) {
    requirePrefixedId(request.assessment_id, "contact-policy-", "contact policy assessment id");
    requireTimestamp(request.considered_at, "contact policy considered_at");
    if (Date.parse(request.considered_at) < Date.parse(intent.created_at)) {
        throw new ValidationError("contact policy cannot predate contact intent creation");
    }
    if (!(["authorized", "unknown", "denied"] as const).includes(request.authority.status)) {
        throw new ValidationError("contact authority assessment is invalid");
    }
    requireUniqueNonEmpty(request.authority.evidence_ids, "contact authority evidence");

    if (request.attention.status === "quiet_period") {
        requireText(request.attention.window_id, "quiet-period window id");
        requireTimestamp(request.attention.starts_at, "quiet-period starts_at");
        requireTimestamp(request.attention.ends_at, "quiet-period ends_at");
        const consideredAt = Date.parse(request.considered_at);
        if (
            Date.parse(request.attention.starts_at) >= Date.parse(request.attention.ends_at) ||
            consideredAt < Date.parse(request.attention.starts_at) ||
            consideredAt >= Date.parse(request.attention.ends_at)
        ) {
            throw new ValidationError("quiet-period window must contain the policy assessment time");
        }
    } else if (request.attention.status !== "available") {
        throw new ValidationError("contact attention window is invalid");
    }
    requireUniqueNonEmpty(request.attention.evidence_ids, "contact attention evidence");

    if (!(["distinct", "confirmed_duplicate", "identity_uncertain"] as const).includes(request.occurrence.status)) {
        throw new ValidationError("contact occurrence assessment is invalid");
    }
    if (request.occurrence.status === "distinct" && request.occurrence.related_intent_id !== null) {
        throw new ValidationError("distinct contact occurrence cannot name a related duplicate intent");
    }
    if (request.occurrence.status !== "distinct") {
        if (request.occurrence.related_intent_id === null) {
            throw new ValidationError("duplicate contact occurrence assessment requires a related intent");
        }
        requirePrefixedId(request.occurrence.related_intent_id, "contact-intent-", "related contact intent id");
        if (request.occurrence.related_intent_id === intent.contact_intent_id) {
            throw new ValidationError("contact intent cannot be a duplicate of itself");
        }
    }
    requireUniqueNonEmpty(request.occurrence.evidence_ids, "contact occurrence evidence");

    const surfaceIds = new Set<string>();
    for (const surface of request.surfaces) {
        requireText(surface.surface_id, "contact surface id");
        if (surfaceIds.has(surface.surface_id)) throw new ValidationError("contact surface candidates must be unique");
        surfaceIds.add(surface.surface_id);
        if (!Number.isSafeInteger(surface.preference_rank) || surface.preference_rank < 0) {
            throw new ValidationError("contact surface preference rank must be a non-negative safe integer");
        }
        if (!(["eligible", "temporarily_unavailable", "ineligible"] as const).includes(surface.status)) {
            throw new ValidationError("contact surface status is invalid");
        }
        requireUniqueNonEmpty(surface.evidence_ids, "contact surface evidence");
    }
}

function cloneAuthority(value: ContactAuthorityAssessment): ContactAuthorityAssessment {
    return { ...value, evidence_ids: [...value.evidence_ids] };
}

function cloneAttention(value: ContactAttentionWindow): ContactAttentionWindow {
    return { ...value, evidence_ids: [...value.evidence_ids] };
}

function cloneOccurrence(value: ContactOccurrenceAssessment): ContactOccurrenceAssessment {
    return { ...value, evidence_ids: [...value.evidence_ids] };
}

function requireText(value: unknown, label: string): asserts value is string {
    if (!isNotBlankString(value)) throw new ValidationError(`${label} must be non-empty`);
}

function requirePrefixedId(value: unknown, prefix: string, label: string): asserts value is string {
    requireText(value, label);
    if (!value.startsWith(prefix) || value.length === prefix.length) {
        throw new ValidationError(`${label} is invalid`);
    }
}

function requireTimestamp(value: unknown, label: string): asserts value is string {
    if (typeof value !== "string" || !isRfc3339Utc(value)) throw new ValidationError(`${label} must be RFC 3339 UTC`);
}

function requireRevision(value: unknown, label: string): asserts value is number {
    if (!Number.isSafeInteger(value) || (value as number) < 0) {
        throw new ValidationError(`${label} must be a non-negative safe integer`);
    }
}

function requireUnique(values: readonly unknown[], label: string) {
    if (values.some((value) => !isNotBlankString(value)) || new Set(values).size !== values.length) {
        throw new ValidationError(`${label} must contain unique non-empty ids`);
    }
}

function requireUniqueNonEmpty(values: readonly unknown[], label: string) {
    if (values.length === 0) throw new ValidationError(`${label} must be non-empty`);
    requireUnique(values, label);
}
