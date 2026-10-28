export type ObjectiveLifecycle = "active" | "deferred" | "blocked" | "completed" | "abandoned";
export type ObjectiveEpisodeStatus = "running" | "completed" | "failed" | "outcome_unknown";
export type ObjectiveProgress =
    | "none_established"
    | "partial"
    | "condition_satisfied"
    | "failed_attempt"
    | "blocker_discovered"
    | "uncertain";
export type ResumeDecision = "continue" | "defer" | "block" | "complete" | "abandon";

export interface ObjectiveCheckpoint {
    checkpoint_id: `objective-checkpoint-${string}`;
    episode_id: `objective-episode-${string}`;
    objective_revision: number;
    acceptance_condition_ids: string[];
    progress: ObjectiveProgress;
    summary: string;
    evidence_ids: string[];
    assumptions: string[];
    uncertainty: string | null;
    proposed_next_step: string | null;
    recorded_at: string;
}

export interface ObjectiveEpisode {
    episode_id: `objective-episode-${string}`;
    objective_revision: number;
    runtime: { kind: string; runtime_id: string | null; provider_label: string | null; session_id: string | null };
    currentness_assessment_id: `objective-currentness-${string}`;
    started_at: string;
    ended_at: string | null;
    status: ObjectiveEpisodeStatus;
    outcome_detail: string | null;
}

export interface ObjectiveCurrentnessAssessment {
    assessment_id: `objective-currentness-${string}`;
    objective_revision: number;
    assessed_at: string;
    actor: string;
    decision: ResumeDecision;
    reason: string;
    evidence_ids: string[];
    prior_episode_reconciliations: Array<{
        episode_id: `objective-episode-${string}`;
        outcome: "still_running" | "outcome_unknown";
        detail: string;
    }>;
}

export interface DurableObjective {
    objective_id: `objective-${string}`;
    revision: number;
    purpose: string;
    success_conditions: Array<{ condition_id: string; description: string }>;
    principal: string;
    scope: string;
    creation: {
        source_evidence_id: string;
        occurrence_id: string;
        occurred_at: string;
        observed_at: string;
    };
    currentness_basis: string[];
    lifecycle: ObjectiveLifecycle;
    lifecycle_reason: string;
    next_step: { owner: "ember" | "principal" | "external" | "unknown"; description: string };
    created_at: string;
    updated_at: string;
    assessments: ObjectiveCurrentnessAssessment[];
    episodes: ObjectiveEpisode[];
    checkpoints: ObjectiveCheckpoint[];
}

export interface ObjectiveDocument {
    objective_ledger_version: 1;
    objectives: DurableObjective[];
}
