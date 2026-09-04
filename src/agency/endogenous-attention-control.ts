import type {
    CognitionOpportunityMechanism,
    CognitionOpportunityOccurrence,
    MeaningId,
    OpportunityId,
    RuntimeId,
} from "../core/model.ts";

export type RepeatedCognitionAttentionOutcome = "evaluate" | "defer_repeated_projection";

export interface RepeatedCognitionAttentionRequest {
    runtime_id: RuntimeId;
    principal: string;
    active_scope: string;
    mechanism: CognitionOpportunityMechanism;
    projected_meaning_ids: MeaningId[];
    projected_evidence_ids: CognitionOpportunityOccurrence["projected_evidence_ids"];
}

export interface RepeatedCognitionAttentionDecision {
    outcome: RepeatedCognitionAttentionOutcome;
    source_opportunity_id: OpportunityId | null;
    selected_meaning_ids: MeaningId[];
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
        if (!sameContext(occurrence, request)) continue;

        if (!sameSnapshot(occurrence, request)) {
            return evaluate();
        }

        if (
            occurrence.status === "decided" &&
            occurrence.decision === "cognition" &&
            occurrence.selected_meaning_ids.length > 0
        ) {
            return {
                outcome: "defer_repeated_projection",
                source_opportunity_id: occurrence.opportunity_id,
                selected_meaning_ids: [...occurrence.selected_meaning_ids],
            };
        }
    }

    return evaluate();
}

function sameContext(occurrence: CognitionOpportunityOccurrence, request: RepeatedCognitionAttentionRequest): boolean {
    return (
        occurrence.runtime_id === request.runtime_id &&
        occurrence.principal === request.principal &&
        occurrence.active_scope === request.active_scope &&
        occurrence.mechanism === request.mechanism
    );
}

function sameSnapshot(occurrence: CognitionOpportunityOccurrence, request: RepeatedCognitionAttentionRequest): boolean {
    return (
        sameIds(occurrence.projected_meaning_ids, request.projected_meaning_ids) &&
        sameIds(occurrence.projected_evidence_ids, request.projected_evidence_ids)
    );
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
    if (left.length !== right.length) return false;
    const expected = new Set(left);
    return right.every((id) => expected.has(id));
}

function evaluate(): RepeatedCognitionAttentionDecision {
    return {
        outcome: "evaluate",
        source_opportunity_id: null,
        selected_meaning_ids: [],
    };
}
