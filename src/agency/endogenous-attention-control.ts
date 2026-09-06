import type {
    CognitionOpportunityMechanism,
    CognitionOpportunityOccurrence,
    MeaningId,
    OpportunityId,
    RuntimeId,
} from "../core/model.ts";

import { sameContent } from "../util.ts";

export type RepeatedCognitionAttentionOutcome = "evaluate" | "defer_repeated_projection";

export interface RepeatedCognitionAttentionRequest {
    runtimeId: RuntimeId;
    principal: string;
    activeScope: string;
    mechanism: CognitionOpportunityMechanism;
    projectedMeaningIds: MeaningId[];
    projectedEvidenceIds: CognitionOpportunityOccurrence["projectedEvidenceIds"];
}

export interface RepeatedCognitionAttentionDecision {
    outcome: RepeatedCognitionAttentionOutcome;
    source_opportunity_id: OpportunityId | null;
    selectedMeaningIds: MeaningId[];
}

/**
 * Suppress only the concrete repeated-cognition failure reproduced by issue #79:
 * a second topic-free opportunity in the same runtime and mechanism sees exactly the
 * same projected meaning/evidence snapshot after that snapshot already produced
 * cognition.
 *
 * The first different snapshot ends the repetition epoch. A new runtime also starts a
 * fresh epoch. This deliberately avoids inventing a time budget or scheduler cadence.
 */
export function decideRepeatedCognitionAttention(
    history: readonly CognitionOpportunityOccurrence[],
    request: RepeatedCognitionAttentionRequest,
): RepeatedCognitionAttentionDecision {
    for (let index = history.length - 1; index >= 0; index -= 1) {
        const occurrence = history[index];
        if (!sameContext(occurrence, request)) {
            continue;
        }
        if (!sameSnapshot(occurrence, request)) {
            return evaluate();
        }
        if (
            occurrence.status === "decided" &&
            occurrence.decision === "cognition" &&
            occurrence.selectedMeaningIds.length > 0
        ) {
            return {
                outcome: "defer_repeated_projection",
                source_opportunity_id: occurrence.opportunityId,
                selectedMeaningIds: [...occurrence.selectedMeaningIds],
            };
        }
    }

    return evaluate();
}

function sameContext(occurrence: CognitionOpportunityOccurrence, request: RepeatedCognitionAttentionRequest): boolean {
    return (
        occurrence.runtimeId === request.runtimeId &&
        occurrence.principal === request.principal &&
        occurrence.activeScope === request.activeScope &&
        occurrence.mechanism === request.mechanism
    );
}

function sameSnapshot(occurrence: CognitionOpportunityOccurrence, request: RepeatedCognitionAttentionRequest): boolean {
    return (
        sameContent(occurrence.projectedMeaningIds, request.projectedMeaningIds) &&
        sameContent(occurrence.projectedEvidenceIds, request.projectedEvidenceIds)
    );
}

function evaluate(): RepeatedCognitionAttentionDecision {
    return {
        outcome: "evaluate",
        source_opportunity_id: null,
        selectedMeaningIds: [],
    };
}
