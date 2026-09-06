import type {
    CognitionOpportunityDecision,
    CognitionOpportunityMechanism,
    CognitionOpportunityOccurrence,
    EmberState,
    MeaningId,
    OpportunityId,
    RuntimeId,
} from "../core/model.ts";
import type { Projection } from "../core/projection.ts";
import type { StateStore } from "../persistence/state-store.ts";
import type { RepeatedCognitionAttentionOutcome } from "./endogenous-attention-control.ts";

import { ProviderError, StaleRevision, ValidationError } from "../core/errors.ts";
import {
    cloneState,
    COGNITION_OPPORTUNITY_MECHANISMS,
    newId,
    nowUtc,
    validateState,
    isRfc3339Utc,
} from "../core/model.ts";
import { buildProjection, findRuntime } from "../core/projection.ts";
import { decideRepeatedCognitionAttention } from "./endogenous-attention-control.ts";

export const COGNITION_OPPORTUNITY_CONTRACT_VERSION = 1 as const;

export type CognitionOpportunityProjection = Omit<Projection, "purpose" | "current_input"> & {
    purpose: "endogenous_decision";
};

export interface CognitionOpportunityRequest {
    contractVersion: 1;
    opportunityId: OpportunityId;
    projection: CognitionOpportunityProjection;
}

export interface CognitionOpportunityEvaluation {
    contractVersion: 1;
    decision: CognitionOpportunityDecision;
    selectedMeaningIds: MeaningId[];
}

export type CognitionOpportunityEvaluator = (
    request: CognitionOpportunityRequest,
) => Promise<CognitionOpportunityEvaluation>;

export interface CognitionOpportunityRecord {
    opportunityId: OpportunityId;
    runtimeId: RuntimeId;
    principal: string;
    activeScope: string;
    mechanism: CognitionOpportunityMechanism;
    observedAt: string;
    validatedRevision: number;
    projectedMeaningIds: MeaningId[];
    projectedEvidenceIds: CognitionOpportunityOccurrence["projectedEvidenceIds"];
    decision: CognitionOpportunityDecision;
    selectedMeaningIds: MeaningId[];
}

export interface EvaluateCognitionOpportunityOptions {
    runtimeId: RuntimeId;
    principal: string;
    scope: string;
    mechanism: CognitionOpportunityMechanism;
    evaluator: CognitionOpportunityEvaluator;
    timestamp?: string;
}

export interface RunCognitionOpportunityResult {
    state: EmberState;
    opportunityId: OpportunityId;
    evaluatorFailure: string | null;
    evaluatorInvoked: boolean;
    attentionOutcome: RepeatedCognitionAttentionOutcome;
    attentionSourceOpportunityId: OpportunityId | null;
}

interface PreparedOpportunity {
    opportunityId: OpportunityId;
    projection: CognitionOpportunityProjection;
    projectedMeaningIds: MeaningId[];
    projectedEvidenceIds: CognitionOpportunityOccurrence["projectedEvidenceIds"];
    timestamp: string;
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
        validatedRevision: projection.validatedRevision,
        lineage: projection.lineage,
        principal: projection.principal,
        activeScope: projection.activeScope,
        surface: projection.surface,
        current_time: projection.current_time,
        recoveryAccount: projection.recoveryAccount,
        meanings: projection.meanings,
        gaps: projection.gaps,
        selection: projection.selection,
    };
}

export async function evaluateCognitionOpportunity(
    state: EmberState,
    options: EvaluateCognitionOpportunityOptions,
): Promise<CognitionOpportunityRecord> {
    const prepared = prepareOpportunity(state, options);
    const result = await options.evaluator(requestFor(prepared));
    validateEvaluation(result, new Set(prepared.projectedMeaningIds));

    return {
        opportunityId: prepared.opportunityId,
        runtimeId: options.runtimeId,
        principal: options.principal,
        activeScope: options.scope,
        mechanism: options.mechanism,
        observedAt: prepared.timestamp,
        validatedRevision: prepared.projection.validatedRevision,
        projectedMeaningIds: prepared.projectedMeaningIds,
        projectedEvidenceIds: prepared.projectedEvidenceIds,
        decision: result.decision,
        selectedMeaningIds: [...result.selectedMeaningIds],
    };
}

export async function runCognitionOpportunity(
    store: StateStore,
    state: EmberState,
    options: EvaluateCognitionOpportunityOptions,
): Promise<RunCognitionOpportunityResult> {
    const prepared = prepareOpportunity(state, options);
    const attention = decideRepeatedCognitionAttention(state.operations.cognitionOpportunities ?? [], {
        runtimeId: options.runtimeId,
        principal: options.principal,
        activeScope: options.scope,
        mechanism: options.mechanism,
        projectedMeaningIds: prepared.projectedMeaningIds,
        projectedEvidenceIds: prepared.projectedEvidenceIds,
    });

    if (attention.outcome === "defer_repeated_projection") {
        const deferred = cloneState(state);
        findRuntime(deferred, options.runtimeId).lastDurableObservationAt = prepared.timestamp;
        const occurrences = (deferred.operations.cognitionOpportunities ??= []);
        occurrences.push({
            opportunityId: prepared.opportunityId,
            runtimeId: options.runtimeId,
            principal: options.principal,
            activeScope: options.scope,
            mechanism: options.mechanism,
            observedAt: prepared.timestamp,
            lastDurableObservationAt: prepared.timestamp,
            validatedRevision: prepared.projection.validatedRevision,
            projectedMeaningIds: prepared.projectedMeaningIds,
            projectedEvidenceIds: prepared.projectedEvidenceIds,
            status: "decided",
            decision: "defer",
            selectedMeaningIds: [...attention.selectedMeaningIds],
            interruptionStatus: "not_attempted",
            providerTermination: null,
        });
        state = await store.commit(state.revision, deferred);
        return {
            state,
            opportunityId: prepared.opportunityId,
            evaluatorFailure: null,
            evaluatorInvoked: false,
            attentionOutcome: attention.outcome,
            attentionSourceOpportunityId: attention.source_opportunity_id,
        };
    }

    const started = cloneState(state);
    const runtime = findRuntime(started, options.runtimeId);
    runtime.lastDurableObservationAt = prepared.timestamp;
    const occurrences = (started.operations.cognitionOpportunities ??= []);
    occurrences.push({
        opportunityId: prepared.opportunityId,
        runtimeId: options.runtimeId,
        principal: options.principal,
        activeScope: options.scope,
        mechanism: options.mechanism,
        observedAt: prepared.timestamp,
        lastDurableObservationAt: prepared.timestamp,
        validatedRevision: prepared.projection.validatedRevision,
        projectedMeaningIds: prepared.projectedMeaningIds,
        projectedEvidenceIds: prepared.projectedEvidenceIds,
        status: "evaluating",
        decision: null,
        selectedMeaningIds: [],
        interruptionStatus: "not_attempted",
        providerTermination: null,
    });
    state = await store.commit(state.revision, started);

    let result: CognitionOpportunityEvaluation;
    try {
        result = await options.evaluator(requestFor(prepared));
        validateEvaluation(result, new Set(prepared.projectedMeaningIds));
    } catch (error) {
        if (!(error instanceof ProviderError) && !(error instanceof ValidationError)) {
            throw error;
        }
        const current = await store.load();
        if (current.revision !== state.revision) {
            throw new StaleRevision("canonical revision changed during cognition opportunity evaluation failure", {
                cause: error,
            });
        }
        const failed = cloneState(current);
        const occurrence = findCognitionOpportunity(failed, prepared.opportunityId);
        const at = nowUtc();

        occurrence.status = error instanceof ProviderError ? error.outcome : "failed";
        occurrence.lastDurableObservationAt = at;
        occurrence.providerTermination =
            error instanceof ProviderError && error.termination !== null
                ? {
                      reason: error.termination.reason,
                      directChildExitObserved: error.termination.directChildExitObserved,
                  }
                : null;

        findRuntime(failed, options.runtimeId).lastDurableObservationAt = at;
        state = await store.commit(current.revision, failed);
        return {
            state,
            opportunityId: prepared.opportunityId,
            evaluatorFailure: error.message,
            evaluatorInvoked: true,
            attentionOutcome: "evaluate",
            attentionSourceOpportunityId: null,
        };
    }

    const current = await store.load();
    if (current.revision !== state.revision) {
        throw new StaleRevision("canonical revision changed during cognition opportunity evaluation");
    }
    const completed = cloneState(current);
    const occurrence = findCognitionOpportunity(completed, prepared.opportunityId);
    const at = nowUtc();

    occurrence.status = "decided";
    occurrence.decision = result.decision;
    occurrence.selectedMeaningIds = [...result.selectedMeaningIds];
    occurrence.lastDurableObservationAt = at;
    occurrence.providerTermination = null;

    findRuntime(completed, options.runtimeId).lastDurableObservationAt = at;
    state = await store.commit(current.revision, completed);
    return {
        state,
        opportunityId: prepared.opportunityId,
        evaluatorFailure: null,
        evaluatorInvoked: true,
        attentionOutcome: "evaluate",
        attentionSourceOpportunityId: null,
    };
}

export function findCognitionOpportunity(
    state: EmberState,
    id: OpportunityId | string,
): CognitionOpportunityOccurrence {
    const value = state.operations.cognitionOpportunities?.find((item) => item.opportunityId === id);
    if (!value) {
        throw new ValidationError(`cognition opportunity does not exist: ${id}`);
    }
    return value;
}

export function cognitionOpportunityMetrics(state: EmberState) {
    validateState(state);
    const occurrences = state.operations.cognitionOpportunities ?? [];
    const decided = occurrences.filter((item) => item.status === "decided");
    return {
        total: occurrences.length,
        evaluating: occurrences.filter((item) => item.status === "evaluating").length,
        decided: decided.length,
        cognition: decided.filter((item) => item.decision === "cognition").length,
        defer: decided.filter((item) => item.decision === "defer").length,
        no_cognition: decided.filter((item) => item.decision === "no_cognition").length,
        failed: occurrences.filter((item) => item.status === "failed").length,
        timed_out: occurrences.filter((item) => item.status === "timed_out").length,
        cancellation_requested: occurrences.filter((item) => item.status === "cancellation_requested").length,
        outcome_unknown: occurrences.filter((item) => item.status === "outcome_unknown").length,
    };
}

function prepareOpportunity(state: EmberState, options: EvaluateCognitionOpportunityOptions): PreparedOpportunity {
    validateMechanism(options.mechanism);
    const timestamp = options.timestamp ?? nowUtc();
    const projection = buildCognitionOpportunityProjection(state, {
        runtimeId: options.runtimeId,
        principal: options.principal,
        scope: options.scope,
        timestamp,
    });
    return {
        opportunityId: newId("opportunity"),
        projection,
        projectedMeaningIds: [...projection.selection.meaning_ids],
        projectedEvidenceIds: [...projection.selection.evidence_ids],
        timestamp,
    };
}

function requestFor(prepared: PreparedOpportunity): CognitionOpportunityRequest {
    return {
        contractVersion: COGNITION_OPPORTUNITY_CONTRACT_VERSION,
        opportunityId: prepared.opportunityId,
        projection: cloneState(prepared.projection),
    };
}

function validateMechanism(mechanism: CognitionOpportunityMechanism) {
    if (!COGNITION_OPPORTUNITY_MECHANISMS.includes(mechanism)) {
        throw new ValidationError("cognition opportunity mechanism is invalid");
    }
}

function validateOpportunityContext(
    state: EmberState,
    runtimeId: RuntimeId,
    principal: string,
    scope: string,
    timestamp: string,
) {
    validateState(state);
    if (!isRfc3339Utc(timestamp)) {
        throw new ValidationError("cognition opportunity timestamp must be RFC 3339 UTC");
    }
    const runtime = findRuntime(state, runtimeId);

    if (runtime.cleanStopAt !== null) {
        throw new ValidationError("cognition opportunity requires an active runtime");
    }
    if (runtime.principal !== principal) {
        throw new ValidationError("cognition opportunity principal differs from owning runtime");
    }
    if (runtime.activeScope !== scope) {
        throw new ValidationError("cognition opportunity scope differs from owning runtime");
    }
    if (Date.parse(timestamp) < Date.parse(runtime.startedAt)) {
        throw new ValidationError("cognition opportunity cannot precede its runtime");
    }
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
    const expected = ["contractVersion", "decision", "selectedMeaningIds"].sort();

    if (JSON.stringify(fields) !== JSON.stringify(expected)) {
        throw new ValidationError("cognition opportunity evaluation contains missing or unsupported fields");
    }
    if (object.contractVersion !== COGNITION_OPPORTUNITY_CONTRACT_VERSION) {
        throw new ValidationError("cognition opportunity evaluation contractVersion is unsupported");
    }
    if (!["cognition", "defer", "no_cognition"].includes(String(object.decision))) {
        throw new ValidationError("cognition opportunity evaluation decision is invalid");
    }
    if (!Array.isArray(object.selectedMeaningIds) || !object.selectedMeaningIds.every((id) => typeof id === "string")) {
        throw new ValidationError("cognition opportunity selectedMeaningIds must be a string list");
    }
    if (new Set(object.selectedMeaningIds).size !== object.selectedMeaningIds.length) {
        throw new ValidationError("cognition opportunity selectedMeaningIds must not contain duplicates");
    }
    if (!object.selectedMeaningIds.every((id) => projectedMeaningIds.has(id))) {
        throw new ValidationError("cognition opportunity selected a meaning outside its projection");
    }
    if (object.decision === "no_cognition" && object.selectedMeaningIds.length !== 0) {
        throw new ValidationError("no_cognition must not select a meaning");
    }
    if ((object.decision === "cognition" || object.decision === "defer") && object.selectedMeaningIds.length === 0) {
        throw new ValidationError(`${object.decision} must select at least one projected meaning`);
    }
}
