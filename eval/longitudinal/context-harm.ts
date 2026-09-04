export type HarmJudgment = "none_observed" | "potential" | "material" | "boundary_violation";

export type HarmFindingKind =
    | "relevant_omission"
    | "irrelevant_inclusion"
    | "stale_inclusion"
    | "forbidden_inclusion"
    | "purposeful_historical_inclusion"
    | "truthful_degraded_inclusion"
    | "unmarked_degraded_inclusion";

export interface ContextEvaluationInput {
    declared: {
        relevant: string[];
        irrelevant: string[];
        superseded: string[];
        unavailable: string[];
        forbidden: string[];
    };
    selected_meanings: string[];
    omission_candidates: {
        relevant_not_selected: string[];
    };
    inclusion_candidates: {
        irrelevant_selected: string[];
        superseded_selected: string[];
        forbidden_selected: string[];
    };
    degradation_signals: {
        unavailable_selected: string[];
        unavailable_with_projection_gap: string[];
    };
}

export interface HarmFinding {
    kind: HarmFindingKind;
    judgment: HarmJudgment;
    meanings: string[];
    rationale: string;
}

export interface HarmDimension {
    judgment: HarmJudgment;
    findings: HarmFinding[];
}

export interface ContextHarmEvaluation {
    omission: HarmDimension;
    inclusion: HarmDimension;
    selection_pressure: "stable" | "reduce" | "expand" | "rebalance";
    empirical_cognition_impact: "not_measured";
}

const JUDGMENT_RANK: Record<HarmJudgment, number> = {
    none_observed: 0,
    potential: 1,
    material: 2,
    boundary_violation: 3,
};

export function evaluateContextHarm(context: ContextEvaluationInput): ContextHarmEvaluation {
    const relevant = new Set(context.declared.relevant);
    const superseded = new Set(context.declared.superseded);
    const unavailable = new Set(context.declared.unavailable);
    const unavailableWithGap = new Set(context.degradation_signals.unavailable_with_projection_gap);
    const forbiddenSelected = new Set(context.inclusion_candidates.forbidden_selected);
    const supersededSelected = new Set(context.inclusion_candidates.superseded_selected);
    const unavailableSelected = new Set(context.degradation_signals.unavailable_selected);

    const omissionFindings: HarmFinding[] = [];
    if (context.omission_candidates.relevant_not_selected.length > 0) {
        omissionFindings.push({
            kind: "relevant_omission",
            judgment: "material",
            meanings: [...context.omission_candidates.relevant_not_selected],
            rationale:
                "The scenario declares these meanings relevant, so omitting them creates a material risk of changing justified cognition.",
        });
    }

    const inclusionFindings: HarmFinding[] = [];
    if (forbiddenSelected.size > 0) {
        inclusionFindings.push({
            kind: "forbidden_inclusion",
            judgment: "boundary_violation",
            meanings: [...forbiddenSelected],
            rationale:
                "The projection exposed material the scenario declares forbidden for this recipient or purpose boundary.",
        });
    }

    const purposefulHistorical = [...supersededSelected].filter(
        (alias) => relevant.has(alias) && !forbiddenSelected.has(alias),
    );
    if (purposefulHistorical.length > 0) {
        inclusionFindings.push({
            kind: "purposeful_historical_inclusion",
            judgment: "none_observed",
            meanings: purposefulHistorical,
            rationale:
                "Superseded meaning is relevant to the present historical or explanatory purpose, so its labeled inclusion is not inclusion harm by itself.",
        });
    }

    const staleSelected = [...supersededSelected].filter(
        (alias) => !relevant.has(alias) && !forbiddenSelected.has(alias),
    );
    if (staleSelected.length > 0) {
        inclusionFindings.push({
            kind: "stale_inclusion",
            judgment: "material",
            meanings: staleSelected,
            rationale:
                "Superseded meaning is selected without being relevant to the present purpose, creating material currentness and stale-authority risk.",
        });
    }

    const truthfulDegraded = [...unavailableSelected].filter(
        (alias) => unavailableWithGap.has(alias) && !forbiddenSelected.has(alias),
    );
    if (truthfulDegraded.length > 0) {
        inclusionFindings.push({
            kind: "truthful_degraded_inclusion",
            judgment: "none_observed",
            meanings: truthfulDegraded,
            rationale:
                "The meaning participates together with an explicit unavailable-detail gap, preserving truthful degradation instead of fabricating recall.",
        });
    }

    const unmarkedDegraded = [...unavailableSelected].filter(
        (alias) => unavailable.has(alias) && !unavailableWithGap.has(alias) && !forbiddenSelected.has(alias),
    );
    if (unmarkedDegraded.length > 0) {
        inclusionFindings.push({
            kind: "unmarked_degraded_inclusion",
            judgment: "material",
            meanings: unmarkedDegraded,
            rationale:
                "Unavailable material participates without the projection carrying the corresponding gap, risking false continuity or unsupported certainty.",
        });
    }

    const higherSpecificity = new Set([...forbiddenSelected, ...supersededSelected, ...unavailableSelected]);
    const irrelevantSelected = context.inclusion_candidates.irrelevant_selected.filter(
        (alias) => !higherSpecificity.has(alias),
    );
    if (irrelevantSelected.length > 0) {
        inclusionFindings.push({
            kind: "irrelevant_inclusion",
            judgment: "potential",
            meanings: irrelevantSelected,
            rationale:
                "The projection includes material the scenario declares irrelevant. The unnecessary exposure is observable, while any downstream model distraction remains empirical rather than proven here.",
        });
    }

    const omission = dimension(omissionFindings);
    const inclusion = dimension(inclusionFindings);
    const omissionPressure = JUDGMENT_RANK[omission.judgment] > 0;
    const inclusionPressure = JUDGMENT_RANK[inclusion.judgment] > 0;

    return {
        omission,
        inclusion,
        selection_pressure:
            omissionPressure && inclusionPressure
                ? "rebalance"
                : omissionPressure
                  ? "expand"
                  : inclusionPressure
                    ? "reduce"
                    : "stable",
        empirical_cognition_impact: "not_measured",
    };
}

function dimension(findings: HarmFinding[]): HarmDimension {
    return {
        judgment: findings.reduce<HarmJudgment>((current, finding) => {
            return JUDGMENT_RANK[finding.judgment] > JUDGMENT_RANK[current] ? finding.judgment : current;
        }, "none_observed"),
        findings,
    };
}
