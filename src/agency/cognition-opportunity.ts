import { randomUUID } from "node:crypto";
import { ValidationError } from "../core/errors.ts";
import {
  isRfc3339Utc,
  nowUtc,
  validateState,
  type EmberState,
  type EvidenceId,
  type MeaningId,
  type RuntimeId,
} from "../core/model.ts";
import {
  buildProjection,
  findRuntime,
  type Projection,
} from "../core/projection.ts";

export const COGNITION_OPPORTUNITY_CONTRACT_VERSION = 1 as const;

export type CognitionOpportunityMechanism =
  | "foreground_probe"
  | "runtime_start"
  | "idle_opportunity"
  | "external_timing";

export type CognitionOpportunityDecision = "cognition" | "defer" | "no_cognition";

export type CognitionOpportunityProjection = Omit<Projection, "purpose" | "current_input"> & {
  purpose: "endogenous_decision";
};

export interface CognitionOpportunityRequest {
  contract_version: 1;
  opportunity_id: string;
  projection: CognitionOpportunityProjection;
}

export interface CognitionOpportunityEvaluation {
  contract_version: 1;
  decision: CognitionOpportunityDecision;
  selected_meaning_ids: MeaningId[];
}

export type CognitionOpportunityEvaluator = (
  request: CognitionOpportunityRequest,
) => Promise<CognitionOpportunityEvaluation>;

export interface CognitionOpportunityRecord {
  opportunity_id: string;
  runtime_id: RuntimeId;
  principal: string;
  active_scope: string;
  mechanism: CognitionOpportunityMechanism;
  observed_at: string;
  validated_revision: number;
  projected_meaning_ids: MeaningId[];
  projected_evidence_ids: EvidenceId[];
  decision: CognitionOpportunityDecision;
  selected_meaning_ids: MeaningId[];
}

export interface EvaluateCognitionOpportunityOptions {
  runtimeId: RuntimeId;
  principal: string;
  scope: string;
  mechanism: CognitionOpportunityMechanism;
  evaluator: CognitionOpportunityEvaluator;
  timestamp?: string;
}

export function buildCognitionOpportunityProjection(
  state: EmberState,
  {
    runtimeId,
    principal,
    scope,
    timestamp = nowUtc(),
  }: Pick<EvaluateCognitionOpportunityOptions, "runtimeId" | "principal" | "scope" | "timestamp">,
): CognitionOpportunityProjection {
  validateOpportunityContext(state, runtimeId, principal, scope, timestamp);
  const projection = buildProjection(state, {
    runtimeId,
    principal,
    scope,
    currentInput: "",
    currentTime: timestamp,
    purpose: "ordinary",
  });

  return {
    projection_version: projection.projection_version,
    purpose: "endogenous_decision",
    validated_revision: projection.validated_revision,
    lineage: projection.lineage,
    principal: projection.principal,
    active_scope: projection.active_scope,
    surface: projection.surface,
    current_time: projection.current_time,
    recovery_account: projection.recovery_account,
    meanings: projection.meanings,
    gaps: projection.gaps,
    selection: projection.selection,
  };
}

export async function evaluateCognitionOpportunity(
  state: EmberState,
  {
    runtimeId,
    principal,
    scope,
    mechanism,
    evaluator,
    timestamp = nowUtc(),
  }: EvaluateCognitionOpportunityOptions,
): Promise<CognitionOpportunityRecord> {
  const projection = buildCognitionOpportunityProjection(state, {
    runtimeId,
    principal,
    scope,
    timestamp,
  });
  const opportunityId = `opportunity-${randomUUID()}`;
  const result = await evaluator({
    contract_version: COGNITION_OPPORTUNITY_CONTRACT_VERSION,
    opportunity_id: opportunityId,
    projection,
  });
  validateEvaluation(result, new Set(projection.selection.meaning_ids));

  return {
    opportunity_id: opportunityId,
    runtime_id: runtimeId,
    principal,
    active_scope: scope,
    mechanism,
    observed_at: timestamp,
    validated_revision: projection.validated_revision,
    projected_meaning_ids: [...projection.selection.meaning_ids],
    projected_evidence_ids: [...projection.selection.evidence_ids],
    decision: result.decision,
    selected_meaning_ids: [...result.selected_meaning_ids],
  };
}

function validateOpportunityContext(
  state: EmberState,
  runtimeId: RuntimeId,
  principal: string,
  scope: string,
  timestamp: string,
) {
  validateState(state);
  if (!isRfc3339Utc(timestamp)) throw new ValidationError("cognition opportunity timestamp must be RFC 3339 UTC");
  const runtime = findRuntime(state, runtimeId);
  if (runtime.clean_stop_at !== null) throw new ValidationError("cognition opportunity requires an active runtime");
  if (runtime.principal !== principal) throw new ValidationError("cognition opportunity principal differs from owning runtime");
  if (runtime.active_scope !== scope) throw new ValidationError("cognition opportunity scope differs from owning runtime");
}

function validateEvaluation(
  value: unknown,
  projectedMeaningIds: ReadonlySet<MeaningId | string>,
): asserts value is CognitionOpportunityEvaluation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("cognition opportunity evaluation must be an object");
  }
  const object = value as Record<string, unknown>;
  const fields = Object.keys(object).sort();
  const expected = ["contract_version", "decision", "selected_meaning_ids"].sort();
  if (JSON.stringify(fields) !== JSON.stringify(expected)) {
    throw new ValidationError("cognition opportunity evaluation contains missing or unsupported fields");
  }
  if (object.contract_version !== COGNITION_OPPORTUNITY_CONTRACT_VERSION) {
    throw new ValidationError("cognition opportunity evaluation contract_version is unsupported");
  }
  if (!["cognition", "defer", "no_cognition"].includes(String(object.decision))) {
    throw new ValidationError("cognition opportunity evaluation decision is invalid");
  }
  if (!Array.isArray(object.selected_meaning_ids) || !object.selected_meaning_ids.every(id => typeof id === "string")) {
    throw new ValidationError("cognition opportunity selected_meaning_ids must be a string list");
  }
  if (new Set(object.selected_meaning_ids).size !== object.selected_meaning_ids.length) {
    throw new ValidationError("cognition opportunity selected_meaning_ids must not contain duplicates");
  }
  if (!object.selected_meaning_ids.every(id => projectedMeaningIds.has(id))) {
    throw new ValidationError("cognition opportunity selected a meaning outside its projection");
  }
  if (object.decision === "no_cognition" && object.selected_meaning_ids.length !== 0) {
    throw new ValidationError("no_cognition must not select a meaning");
  }
  if ((object.decision === "cognition" || object.decision === "defer") && object.selected_meaning_ids.length === 0) {
    throw new ValidationError(`${object.decision} must select at least one projected meaning`);
  }
}
