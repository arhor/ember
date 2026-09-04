import { performance } from "node:perf_hooks";
import { ValidationError } from "../core/errors.ts";
import {
    initialState,
    isRfc3339Utc,
    newId,
    type CognitionOpportunityDecision,
    type CognitionOpportunityOccurrence,
    type EmberState,
    type MeaningId,
} from "../core/model.ts";
import { rememberFact, transitionCommitment, undertake } from "../core/semantics.ts";
import { startRuntime } from "../runtime/runtime.ts";
import {
    buildCognitionOpportunityProjection,
    evaluateCognitionOpportunity,
    type CognitionOpportunityEvaluator,
} from "./cognition-opportunity.ts";
import {
    decideRepeatedCognitionAttention,
    type RepeatedCognitionAttentionOutcome,
} from "./endogenous-attention-control.ts";
import {
    decideUserInterruption,
    type CompletedInternalCognition,
    type InterruptionAttention,
    type InterruptionAuthority,
    type InterruptionOutcome,
    type InterruptionUrgency,
} from "./interruption-decision.ts";

export type SelectivityCaseKind =
    | "quiet"
    | "irrelevant_live_concern"
    | "worthwhile_current_concern"
    | "resolved_concern";
export type SelectivityExpectation = "silence" | "worthwhile" | "first_worthwhile_then_repetition";
export type FalsePositiveCategory =
    | "trivial_repetition"
    | "stale_concern_revival"
    | "post_hoc_fabricated_motive"
    | "unnecessary_user_interruption";
export type SelectivityAttentionControl = "repeated_projection" | "disabled";

export interface SelectivityWorkloadCase {
    case_id: string;
    kind: SelectivityCaseKind;
    opportunities: number;
    expected: SelectivityExpectation;
    attention: InterruptionAttention;
    authority: InterruptionAuthority;
    interruption_urgency: InterruptionUrgency;
}

export interface SelectivityWorkload {
    evaluation_version: 1;
    principal: string;
    scope: string;
    base_time: string;
    cases: SelectivityWorkloadCase[];
}

export interface EvaluationBackend {
    label: string;
    external_model: boolean;
    runtime_version: string | null;
    model_version: string | null;
}

export interface SelectivityEvaluationOptions {
    attentionControl?: SelectivityAttentionControl;
}

export interface SelectivityObservation {
    case_id: string;
    opportunity_index: number;
    decision: CognitionOpportunityDecision | "error";
    classification:
        | "intentional_silence"
        | "worthwhile_cognition"
        | "worthwhile_deferred_attention"
        | "false_positive_cognition"
        | "missed_worthwhile"
        | "evaluator_failure";
    false_positive_categories: FalsePositiveCategory[];
    selected_meaning_count: number;
    attention_outcome: RepeatedCognitionAttentionOutcome;
    evaluator_latency_ms: number | null;
    interruption_outcome: InterruptionOutcome;
}

export interface SelectivityEvaluationResult {
    evaluation_version: 1;
    backend: EvaluationBackend;
    runtime: {
        node: string;
        platform: NodeJS.Platform;
        arch: string;
    };
    policy: {
        mechanism: "foreground_probe";
        trigger_topic_present: false;
        attention_control: SelectivityAttentionControl;
        max_model_backed_evaluator_attempts_per_opportunity: 1;
        raw_reasoning_retained: false;
    };
    workload: {
        case_count: number;
        opportunity_count: number;
    };
    counts: {
        evaluator_calls: number;
        external_model_evaluator_attempts: number;
        attention_deferred_repeated_projection: number;
        intentional_silence: number;
        worthwhile_cognition: number;
        worthwhile_deferred_attention: number;
        false_positive_cognition: number;
        missed_worthwhile: number;
        evaluator_failures: number;
        false_positive_categories: Record<FalsePositiveCategory, number>;
        interruptions: Record<InterruptionOutcome, number>;
    };
    rates: {
        intentional_silence: { numerator: number; denominator: number };
        false_positive_cognition: { numerator: number; denominator: number };
    };
    latency_ms: {
        sample_count: number;
        min: number;
        median: number;
        p95: number;
        max: number;
        mean: number;
    };
    local_process_resources: {
        rss_start_bytes: number;
        rss_end_bytes: number;
        rss_peak_observed_bytes: number;
        user_cpu_ms: number;
        system_cpu_ms: number;
        external_child_process_resources: "not_observed_by_harness";
    };
    observations: SelectivityObservation[];
}

interface Scenario {
    state: EmberState;
    runtimeId: ReturnType<typeof startRuntime>["runtimeId"];
    urgencyMeaningId: MeaningId | null;
}

export function parseSelectivityWorkload(value: unknown): SelectivityWorkload {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new ValidationError("endogenous selectivity workload must be an object");
    }
    const workload = value as Partial<SelectivityWorkload>;
    if (workload.evaluation_version !== 1)
        throw new ValidationError("unsupported endogenous selectivity workload version");
    if (typeof workload.principal !== "string" || !workload.principal.trim())
        throw new ValidationError("selectivity workload principal is required");
    if (typeof workload.scope !== "string" || !workload.scope.trim())
        throw new ValidationError("selectivity workload scope is required");
    if (!isRfc3339Utc(workload.base_time))
        throw new ValidationError("selectivity workload base_time must be RFC 3339 UTC");
    if (!Array.isArray(workload.cases) || workload.cases.length === 0)
        throw new ValidationError("selectivity workload requires cases");

    const ids = new Set<string>();
    for (const item of workload.cases) {
        if (item === null || typeof item !== "object" || Array.isArray(item))
            throw new ValidationError("selectivity workload case must be an object");
        const testCase = item as SelectivityWorkloadCase;
        if (typeof testCase.case_id !== "string" || !testCase.case_id.trim())
            throw new ValidationError("selectivity case_id is required");
        if (ids.has(testCase.case_id)) throw new ValidationError("selectivity case_id must be unique");
        ids.add(testCase.case_id);
        if (
            !["quiet", "irrelevant_live_concern", "worthwhile_current_concern", "resolved_concern"].includes(
                testCase.kind,
            )
        )
            throw new ValidationError("selectivity case kind is invalid");
        if (!Number.isSafeInteger(testCase.opportunities) || testCase.opportunities < 1)
            throw new ValidationError("selectivity opportunities must be a positive safe integer");
        if (!["silence", "worthwhile", "first_worthwhile_then_repetition"].includes(testCase.expected))
            throw new ValidationError("selectivity expectation is invalid");
        if (!["available", "quiet_period"].includes(testCase.attention))
            throw new ValidationError("selectivity attention is invalid");
        if (!["authorized", "unknown", "denied"].includes(testCase.authority))
            throw new ValidationError("selectivity authority is invalid");
        if (!["ordinary", "time_sensitive"].includes(testCase.interruption_urgency))
            throw new ValidationError("selectivity urgency is invalid");
    }
    return structuredClone(workload as SelectivityWorkload);
}

export const scriptedSelectivityEvaluator: CognitionOpportunityEvaluator = async (request) => {
    const commitment = request.projection.meanings.find(
        (item) => item.kind === "commitment" && item.currentness === "current" && item.prospective_lifecycle === "live",
    );
    const urgency = request.projection.meanings.find(
        (item) =>
            item.kind === "fact" &&
            item.slot === "release-window" &&
            item.currentness === "current" &&
            item.content === "Release is imminent",
    );
    if (!commitment || !urgency) {
        return { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
    }
    return {
        contract_version: 1,
        decision: "cognition",
        selected_meaning_ids: [commitment.meaning_id, urgency.meaning_id],
    };
};

export async function runEndogenousSelectivityEvaluation(
    workload: SelectivityWorkload,
    evaluator: CognitionOpportunityEvaluator,
    backend: EvaluationBackend,
    { attentionControl = "repeated_projection" }: SelectivityEvaluationOptions = {},
): Promise<SelectivityEvaluationResult> {
    const validated = parseSelectivityWorkload(workload);
    const observations: SelectivityObservation[] = [];
    const latencies: number[] = [];
    const memoryStart = process.memoryUsage();
    const resourceStart = process.resourceUsage();
    let peakRss = memoryStart.rss;
    let evaluatorCalls = 0;
    let globalOpportunityIndex = 0;

    for (const testCase of validated.cases) {
        const scenario = buildScenario(validated, testCase);
        const deliveredGroundingSets: MeaningId[][] = [];
        const history: CognitionOpportunityOccurrence[] = [];

        for (let opportunityIndex = 0; opportunityIndex < testCase.opportunities; opportunityIndex++) {
            const consideredAt = addSeconds(validated.base_time, 300 + globalOpportunityIndex);
            globalOpportunityIndex += 1;
            const projection = buildCognitionOpportunityProjection(scenario.state, {
                runtimeId: scenario.runtimeId,
                principal: validated.principal,
                scope: validated.scope,
                timestamp: consideredAt,
            });
            const attention =
                attentionControl === "repeated_projection"
                    ? decideRepeatedCognitionAttention(history, {
                          runtime_id: scenario.runtimeId,
                          principal: validated.principal,
                          active_scope: validated.scope,
                          mechanism: "foreground_probe",
                          projected_meaning_ids: [...projection.selection.meaning_ids],
                          projected_evidence_ids: [...projection.selection.evidence_ids],
                      })
                    : {
                          outcome: "evaluate" as const,
                          source_opportunity_id: null,
                          selected_meaning_ids: [] as MeaningId[],
                      };

            let decision: CognitionOpportunityDecision | "error" = "error";
            let selectedMeaningIds: MeaningId[] = [];
            let evaluatorFailed = false;
            let evaluatorLatency: number | null = null;
            let historyStatus: CognitionOpportunityOccurrence["status"] = "decided";
            let historyOpportunityId = newId("opportunity");

            if (attention.outcome === "defer_repeated_projection") {
                decision = "defer";
                selectedMeaningIds = [...attention.selected_meaning_ids];
            } else {
                evaluatorCalls += 1;
                const startedAt = performance.now();
                try {
                    const evaluated = await evaluateCognitionOpportunity(scenario.state, {
                        runtimeId: scenario.runtimeId,
                        principal: validated.principal,
                        scope: validated.scope,
                        mechanism: "foreground_probe",
                        evaluator,
                        timestamp: consideredAt,
                    });
                    decision = evaluated.decision;
                    selectedMeaningIds = [...evaluated.selected_meaning_ids];
                    historyOpportunityId = evaluated.opportunity_id;
                } catch {
                    evaluatorFailed = true;
                    historyStatus = "failed";
                }
                evaluatorLatency = performance.now() - startedAt;
                latencies.push(evaluatorLatency);
            }

            history.push({
                opportunity_id: historyOpportunityId,
                runtime_id: scenario.runtimeId,
                principal: validated.principal,
                active_scope: validated.scope,
                mechanism: "foreground_probe",
                observed_at: consideredAt,
                last_durable_observation_at: consideredAt,
                validated_revision: projection.validated_revision,
                projected_meaning_ids: [...projection.selection.meaning_ids],
                projected_evidence_ids: [...projection.selection.evidence_ids],
                status: historyStatus,
                decision: historyStatus === "decided" ? (decision as CognitionOpportunityDecision) : null,
                selected_meaning_ids: historyStatus === "decided" ? [...selectedMeaningIds] : [],
                interruption_status: "not_attempted",
                provider_termination: null,
            });

            peakRss = Math.max(peakRss, process.memoryUsage().rss);

            const falsePositiveCategories: FalsePositiveCategory[] = [];
            const classification = classify(
                testCase,
                opportunityIndex,
                decision,
                evaluatorFailed,
                falsePositiveCategories,
            );
            let interruptionOutcome: InterruptionOutcome = "no_delivery";

            if (decision === "cognition") {
                const source: CompletedInternalCognition = {
                    opportunity_id: newId("opportunity"),
                    cognition_id: newId("cognition"),
                    principal: validated.principal,
                    active_scope: validated.scope,
                    validated_revision: scenario.state.revision,
                    status: "completed",
                    used_meaning_ids: selectedMeaningIds,
                };
                const urgencyGrounded =
                    testCase.interruption_urgency === "time_sensitive" &&
                    scenario.urgencyMeaningId !== null &&
                    selectedMeaningIds.includes(scenario.urgencyMeaningId);
                const interruption = decideUserInterruption(scenario.state, {
                    source,
                    candidate: {
                        grounding_meaning_ids: selectedMeaningIds,
                        urgency: urgencyGrounded ? "time_sensitive" : "ordinary",
                        urgency_meaning_ids:
                            urgencyGrounded && scenario.urgencyMeaningId !== null ? [scenario.urgencyMeaningId] : [],
                    },
                    authority: testCase.authority,
                    attention: testCase.attention,
                    previously_delivered_grounding_sets: deliveredGroundingSets,
                    considered_at: consideredAt,
                });
                interruptionOutcome = interruption.outcome;
                if (interruption.outcome === "deliver") deliveredGroundingSets.push([...selectedMeaningIds]);
                if (interruption.outcome === "deliver" && interruptionShouldNotDeliver(testCase, opportunityIndex)) {
                    falsePositiveCategories.push("unnecessary_user_interruption");
                }
            }

            observations.push({
                case_id: testCase.case_id,
                opportunity_index: opportunityIndex,
                decision,
                classification,
                false_positive_categories: falsePositiveCategories,
                selected_meaning_count: selectedMeaningIds.length,
                attention_outcome: attention.outcome,
                evaluator_latency_ms: evaluatorLatency === null ? null : round(evaluatorLatency),
                interruption_outcome: interruptionOutcome,
            });
        }
    }

    const memoryEnd = process.memoryUsage();
    const resourceEnd = process.resourceUsage();
    const opportunityCount = observations.length;
    const falsePositiveCounts: Record<FalsePositiveCategory, number> = {
        trivial_repetition: 0,
        stale_concern_revival: 0,
        post_hoc_fabricated_motive: 0,
        unnecessary_user_interruption: 0,
    };
    const interruptionCounts: Record<InterruptionOutcome, number> = {
        deliver: 0,
        defer: 0,
        suppress: 0,
        no_delivery: 0,
    };
    for (const observation of observations) {
        for (const category of observation.false_positive_categories) falsePositiveCounts[category] += 1;
        interruptionCounts[observation.interruption_outcome] += 1;
    }

    const count = (classification: SelectivityObservation["classification"]) =>
        observations.filter((item) => item.classification === classification).length;
    const falsePositiveCognition = count("false_positive_cognition");
    const intentionalSilence = count("intentional_silence");

    return {
        evaluation_version: 1,
        backend: { ...backend },
        runtime: { node: process.version, platform: process.platform, arch: process.arch },
        policy: {
            mechanism: "foreground_probe",
            trigger_topic_present: false,
            attention_control: attentionControl,
            max_model_backed_evaluator_attempts_per_opportunity: 1,
            raw_reasoning_retained: false,
        },
        workload: { case_count: validated.cases.length, opportunity_count: opportunityCount },
        counts: {
            evaluator_calls: evaluatorCalls,
            external_model_evaluator_attempts: backend.external_model ? evaluatorCalls : 0,
            attention_deferred_repeated_projection: observations.filter(
                (item) => item.attention_outcome === "defer_repeated_projection",
            ).length,
            intentional_silence: intentionalSilence,
            worthwhile_cognition: count("worthwhile_cognition"),
            worthwhile_deferred_attention: count("worthwhile_deferred_attention"),
            false_positive_cognition: falsePositiveCognition,
            missed_worthwhile: count("missed_worthwhile"),
            evaluator_failures: count("evaluator_failure"),
            false_positive_categories: falsePositiveCounts,
            interruptions: interruptionCounts,
        },
        rates: {
            intentional_silence: { numerator: intentionalSilence, denominator: opportunityCount },
            false_positive_cognition: { numerator: falsePositiveCognition, denominator: opportunityCount },
        },
        latency_ms: summarizeLatency(latencies),
        local_process_resources: {
            rss_start_bytes: memoryStart.rss,
            rss_end_bytes: memoryEnd.rss,
            rss_peak_observed_bytes: Math.max(peakRss, memoryEnd.rss),
            user_cpu_ms: round((resourceEnd.userCPUTime - resourceStart.userCPUTime) / 1000),
            system_cpu_ms: round((resourceEnd.systemCPUTime - resourceStart.systemCPUTime) / 1000),
            external_child_process_resources: "not_observed_by_harness",
        },
        observations,
    };
}

function classify(
    testCase: SelectivityWorkloadCase,
    opportunityIndex: number,
    decision: CognitionOpportunityDecision | "error",
    evaluatorFailed: boolean,
    falsePositiveCategories: FalsePositiveCategory[],
): SelectivityObservation["classification"] {
    if (evaluatorFailed || decision === "error") return "evaluator_failure";
    const repeated = testCase.expected === "first_worthwhile_then_repetition" && opportunityIndex > 0;
    if (repeated) {
        if (decision === "no_cognition") return "intentional_silence";
        if (decision === "cognition") {
            falsePositiveCategories.push("trivial_repetition");
            return "false_positive_cognition";
        }
        return "worthwhile_deferred_attention";
    }
    if (testCase.expected === "silence") {
        if (decision === "no_cognition") return "intentional_silence";
        if (decision === "cognition") {
            falsePositiveCategories.push(
                testCase.kind === "resolved_concern" ? "stale_concern_revival" : "post_hoc_fabricated_motive",
            );
            return "false_positive_cognition";
        }
        return "worthwhile_deferred_attention";
    }
    if (decision === "cognition") return "worthwhile_cognition";
    if (decision === "defer") return "worthwhile_deferred_attention";
    return "missed_worthwhile";
}

function interruptionShouldNotDeliver(testCase: SelectivityWorkloadCase, opportunityIndex: number): boolean {
    return (
        testCase.expected === "silence" ||
        (testCase.expected === "first_worthwhile_then_repetition" && opportunityIndex > 0) ||
        testCase.attention === "quiet_period"
    );
}

function buildScenario(workload: SelectivityWorkload, testCase: SelectivityWorkloadCase): Scenario {
    const previousNow = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = addSeconds(workload.base_time, 1);
    try {
        const state = initialState("Ember", workload.principal, workload.base_time);
        let commitmentId: MeaningId | null = null;
        let urgencyMeaningId: MeaningId | null = null;
        if (testCase.kind !== "quiet") {
            commitmentId = undertake(
                state,
                workload.principal,
                `selectivity-${testCase.case_id}`,
                workload.scope,
                "Prepare release notes before release",
            );
        }
        if (testCase.kind === "worthwhile_current_concern" || testCase.kind === "resolved_concern") {
            urgencyMeaningId = rememberFact(
                state,
                workload.principal,
                `user:${workload.principal}`,
                "release-window",
                workload.scope,
                "Release is imminent",
            );
        }
        if (testCase.kind === "resolved_concern" && commitmentId !== null) {
            transitionCommitment(state, workload.principal, commitmentId, "fulfilled", "Release notes are complete", {
                timestamp: addSeconds(workload.base_time, 60),
            });
        }
        const started = startRuntime(state, workload.principal, workload.scope, {
            timestamp: addSeconds(workload.base_time, 120),
        });
        return { state: started.state, runtimeId: started.runtimeId, urgencyMeaningId };
    } finally {
        if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previousNow;
    }
}

function summarizeLatency(values: number[]) {
    if (values.length === 0) return { sample_count: 0, min: 0, median: 0, p95: 0, max: 0, mean: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
    return {
        sample_count: values.length,
        min: round(sorted[0]),
        median: round(quantile(0.5)),
        p95: round(quantile(0.95)),
        max: round(sorted.at(-1) ?? 0),
        mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    };
}

function addSeconds(timestamp: string, seconds: number): string {
    return new Date(Date.parse(timestamp) + seconds * 1000).toISOString();
}

function round(value: number): number {
    return Math.round(value * 1000) / 1000;
}
