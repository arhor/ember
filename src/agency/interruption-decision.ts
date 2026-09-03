import { ValidationError } from "../core/errors.ts";
import {
  isRfc3339Utc,
  validateState,
  type CognitionId,
  type EmberState,
  type MeaningId,
  type OpportunityId,
} from "../core/model.ts";

export type InterruptionOutcome = "deliver" | "defer" | "suppress" | "no_delivery";
export type InterruptionAuthority = "authorized" | "unknown" | "denied";
export type InterruptionAttention = "available" | "quiet_period";
export type InterruptionUrgency = "ordinary" | "time_sensitive";
export type InterruptionBasis =
  | "no_completed_cognition"
  | "no_interruption_candidate"
  | "stale_grounding"
  | "authority_unknown"
  | "authority_denied"
  | "repeated_grounding"
  | "quiet_period"
  | "current_authorized_candidate";

export interface CompletedInternalCognition {
  opportunity_id: OpportunityId;
  cognition_id: CognitionId;
  principal: string;
  active_scope: string;
  validated_revision: number;
  status: "completed";
  used_meaning_ids: MeaningId[];
}

export interface InterruptionCandidate {
  grounding_meaning_ids: MeaningId[];
  urgency: InterruptionUrgency;
  urgency_meaning_ids: MeaningId[];
}

export interface InterruptionDecisionRequest {
  source: CompletedInternalCognition | null;
  candidate: InterruptionCandidate | null;
  authority: InterruptionAuthority;
  attention: InterruptionAttention;
  previously_delivered_grounding_sets?: MeaningId[][];
  considered_at: string;
}

export interface InterruptionDecisionRecord {
  opportunity_id: OpportunityId | null;
  cognition_id: CognitionId | null;
  considered_at: string;
  validated_revision: number | null;
  current_revision: number;
  outcome: InterruptionOutcome;
  basis: InterruptionBasis;
  grounding_meaning_ids: MeaningId[];
  urgency: InterruptionUrgency | null;
  authority: InterruptionAuthority;
  attention: InterruptionAttention;
}

export function decideUserInterruption(
  state: EmberState,
  request: InterruptionDecisionRequest,
): InterruptionDecisionRecord {
  validateState(state);
  validateRequest(state, request);

  const base = {
    opportunity_id: request.source?.opportunity_id ?? null,
    cognition_id: request.source?.cognition_id ?? null,
    considered_at: request.considered_at,
    validated_revision: request.source?.validated_revision ?? null,
    current_revision: state.revision,
    authority: request.authority,
    attention: request.attention,
  } as const;

  if (request.source === null) {
    return {
      ...base,
      outcome: "no_delivery",
      basis: "no_completed_cognition",
      grounding_meaning_ids: [],
      urgency: null,
    };
  }

  const source = request.source;
  const candidate = request.candidate;
  if (candidate === null) {
    return {
      ...base,
      outcome: "no_delivery",
      basis: "no_interruption_candidate",
      grounding_meaning_ids: [],
      urgency: null,
    };
  }

  const consideredAt = Date.parse(request.considered_at);
  const currentMeaningIds = new Set(
    state.meanings
      .filter(meaning =>
        meaning.currentness === "current"
        && meaning.scope === source.active_scope
        && Date.parse(meaning.applicable_from) <= consideredAt
        && (meaning.applicable_until === null || Date.parse(meaning.applicable_until) > consideredAt)
        && (meaning.kind !== "commitment" || meaning.prospective_lifecycle === "live"),
      )
      .map(meaning => meaning.meaning_id),
  );

  if (!candidate.grounding_meaning_ids.every(id => currentMeaningIds.has(id))) {
    return decision(base, candidate, "suppress", "stale_grounding");
  }

  if (request.authority === "denied") {
    return decision(base, candidate, "suppress", "authority_denied");
  }

  if (request.authority === "unknown") {
    return decision(base, candidate, "defer", "authority_unknown");
  }

  if (hasPreviouslyDeliveredGrounding(
    candidate.grounding_meaning_ids,
    request.previously_delivered_grounding_sets ?? [],
  )) {
    return decision(base, candidate, "suppress", "repeated_grounding");
  }

  if (request.attention === "quiet_period" && candidate.urgency === "ordinary") {
    return decision(base, candidate, "defer", "quiet_period");
  }

  return decision(base, candidate, "deliver", "current_authorized_candidate");
}

function decision(
  base: Omit<InterruptionDecisionRecord, "outcome" | "basis" | "grounding_meaning_ids" | "urgency">,
  candidate: InterruptionCandidate,
  outcome: InterruptionOutcome,
  basis: InterruptionBasis,
): InterruptionDecisionRecord {
  return {
    ...base,
    outcome,
    basis,
    grounding_meaning_ids: [...candidate.grounding_meaning_ids],
    urgency: candidate.urgency,
  };
}

function hasPreviouslyDeliveredGrounding(
  grounding: MeaningId[],
  deliveredSets: MeaningId[][],
): boolean {
  const current = new Set(grounding);
  return deliveredSets.some(previous =>
    previous.length === current.size
    && new Set(previous).size === previous.length
    && previous.every(id => current.has(id)),
  );
}

function validateRequest(state: EmberState, request: InterruptionDecisionRequest) {
  if (!(["authorized", "unknown", "denied"] as const).includes(request.authority)) {
    throw new ValidationError("interruption authority is invalid");
  }
  if (!(["available", "quiet_period"] as const).includes(request.attention)) {
    throw new ValidationError("interruption attention is invalid");
  }
  if (!isRfc3339Utc(request.considered_at)) {
    throw new ValidationError("interruption considered_at must be RFC 3339 UTC");
  }

  if (request.source === null) {
    if (request.candidate !== null) {
      throw new ValidationError("interruption candidate requires completed internal cognition");
    }
    return;
  }

  const source = request.source;
  if (source.status !== "completed") {
    throw new ValidationError("interruption source cognition must be completed");
  }
  if (source.principal !== state.runtime_contract.local_principal) {
    throw new ValidationError("interruption source principal differs from Ember runtime contract");
  }
  if (!Number.isSafeInteger(source.validated_revision) || source.validated_revision < 0) {
    throw new ValidationError("interruption source validated_revision must be a non-negative safe integer");
  }
  if (source.validated_revision > state.revision) {
    throw new ValidationError("interruption source cannot validate against a future Ember revision");
  }
  if (new Set(source.used_meaning_ids).size !== source.used_meaning_ids.length) {
    throw new ValidationError("interruption source used meanings must be unique");
  }

  if (request.candidate === null) return;

  const candidate = request.candidate;
  if (!(["ordinary", "time_sensitive"] as const).includes(candidate.urgency)) {
    throw new ValidationError("interruption urgency is invalid");
  }
  if (candidate.grounding_meaning_ids.length === 0) {
    throw new ValidationError("interruption candidate requires grounding meanings");
  }
  if (new Set(candidate.grounding_meaning_ids).size !== candidate.grounding_meaning_ids.length) {
    throw new ValidationError("interruption candidate grounding meanings must be unique");
  }

  const used = new Set(source.used_meaning_ids);
  if (!candidate.grounding_meaning_ids.every(id => used.has(id))) {
    throw new ValidationError("interruption candidate must remain grounded in completed cognition usage");
  }

  if (new Set(candidate.urgency_meaning_ids).size !== candidate.urgency_meaning_ids.length) {
    throw new ValidationError("interruption urgency grounding meanings must be unique");
  }
  const grounding = new Set(candidate.grounding_meaning_ids);
  if (!candidate.urgency_meaning_ids.every(id => grounding.has(id))) {
    throw new ValidationError("interruption urgency must be grounded in candidate meanings");
  }
  if (candidate.urgency === "time_sensitive" && candidate.urgency_meaning_ids.length === 0) {
    throw new ValidationError("time-sensitive interruption requires explicit urgency grounding");
  }
  if (candidate.urgency === "ordinary" && candidate.urgency_meaning_ids.length !== 0) {
    throw new ValidationError("ordinary interruption must not claim urgency grounding");
  }

  for (const delivered of request.previously_delivered_grounding_sets ?? []) {
    if (delivered.length === 0 || new Set(delivered).size !== delivered.length) {
      throw new ValidationError("previously delivered grounding sets must be non-empty and unique");
    }
  }
}
