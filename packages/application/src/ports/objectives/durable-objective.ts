import type {
    ObjectiveEpisodeStatus,
    ObjectiveProgress,
    ResumeDecision,
    ObjectiveCheckpoint,
    ObjectiveEpisode,
    ObjectiveCurrentnessAssessment,
    DurableObjective,
    ObjectiveDocument,
} from "@ember/domain/objectives/durable-objective.ts";
export type {
    ObjectiveLifecycle,
    ObjectiveEpisodeStatus,
    ObjectiveProgress,
    ResumeDecision,
    ObjectiveCheckpoint,
    ObjectiveEpisode,
    ObjectiveCurrentnessAssessment,
    DurableObjective,
    ObjectiveDocument,
} from "@ember/domain/objectives/durable-objective.ts";
export interface DurableObjectiveStore {
    readonly path: string;
    load(): Promise<ObjectiveDocument>;
    create(input: {
        purpose: string;
        successConditions: Array<{
            conditionId: string;
            description: string;
        }>;
        principal: string;
        scope: string;
        sourceEvidenceId: string;
        occurrenceId: string;
        occurredAt: string;
        observedAt: string;
        currentnessBasis: string[];
        nextStep: DurableObjective["next_step"];
    }): Promise<DurableObjective>;
    resume(input: {
        objectiveId: string;
        expectedRevision: number;
        assessedAt: string;
        actor: string;
        decision: ResumeDecision;
        reason: string;
        evidenceIds: string[];
        priorEpisodeReconciliations: ObjectiveCurrentnessAssessment["prior_episode_reconciliations"];
        nextStep: DurableObjective["next_step"];
        runtime?: ObjectiveEpisode["runtime"];
    }): Promise<{
        objective: DurableObjective;
        episode: ObjectiveEpisode | null;
    }>;
    checkpoint(input: {
        objectiveId: string;
        episodeId: string;
        recordedAt: string;
        acceptanceConditionIds: string[];
        progress: ObjectiveProgress;
        summary: string;
        evidenceIds: string[];
        assumptions: string[];
        uncertainty: string | null;
        proposedNextStep: string | null;
    }): Promise<ObjectiveCheckpoint>;
    finishEpisode(input: {
        objectiveId: string;
        episodeId: string;
        status: Exclude<ObjectiveEpisodeStatus, "running">;
        endedAt: string;
        detail: string;
    }): Promise<ObjectiveEpisode>;
    get(objectiveId: string): Promise<DurableObjective | null>;
}
