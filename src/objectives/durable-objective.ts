import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { isRfc3339Utc } from "../core/model.ts";
import { replaceFileDurably } from "../persistence/file-replacement.ts";
import { StateStore } from "../persistence/state-store.ts";
import { exactKeys, isNotBlankString, isObject } from "../core/util.ts";

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

export class DurableObjectiveStore {
    readonly path: string;
    private readonly lock: StateStore;
    private mutationTail: Promise<void> = Promise.resolve();

    constructor(canonicalStatePath: string) {
        if (!canonicalStatePath.trim()) throw new ValidationError("objective store requires a state path");
        this.path = `${canonicalStatePath}.objectives.json`;
        this.lock = new StateStore(this.path);
    }

    async load(): Promise<ObjectiveDocument> {
        try {
            const value: unknown = JSON.parse(await readFile(this.path, "utf8"));
            validateObjectiveDocument(value);
            return value;
        } catch (error) {
            if (errorCode(error) === "ENOENT") return { objective_ledger_version: 1, objectives: [] };
            if (error instanceof ValidationError) throw error;
            throw new StoreUnavailable(`cannot read objective ledger: ${errorMessage(error)}`, { cause: error });
        }
    }

    async create(input: {
        purpose: string;
        successConditions: Array<{ conditionId: string; description: string }>;
        principal: string;
        scope: string;
        sourceEvidenceId: string;
        occurrenceId: string;
        occurredAt: string;
        observedAt: string;
        currentnessBasis: string[];
        nextStep: DurableObjective["next_step"];
    }): Promise<DurableObjective> {
        requireText(input.purpose, input.principal, input.scope, input.sourceEvidenceId, input.occurrenceId);
        requireTimestamp(input.occurredAt, input.observedAt);
        if (!input.successConditions.length || !input.currentnessBasis.length)
            throw new ValidationError("objective requires success conditions and a currentness basis");
        const objective: DurableObjective = {
            objective_id: `objective-${randomUUID()}`,
            revision: 1,
            purpose: input.purpose,
            success_conditions: input.successConditions.map(({ conditionId, description }) => ({
                condition_id: conditionId,
                description,
            })),
            principal: input.principal,
            scope: input.scope,
            creation: {
                source_evidence_id: input.sourceEvidenceId,
                occurrence_id: input.occurrenceId,
                occurred_at: input.occurredAt,
                observed_at: input.observedAt,
            },
            currentness_basis: [...input.currentnessBasis],
            lifecycle: "active",
            lifecycle_reason: "explicit user-authorized objective created",
            next_step: structuredClone(input.nextStep),
            created_at: input.observedAt,
            updated_at: input.observedAt,
            assessments: [],
            episodes: [],
            checkpoints: [],
        };
        validateObjective(objective);
        await this.mutate((document) => document.objectives.push(objective));
        return structuredClone(objective);
    }

    async resume(input: {
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
    }): Promise<{ objective: DurableObjective; episode: ObjectiveEpisode | null }> {
        return this.mutate((document) => {
            const objective = requiredObjective(document, input.objectiveId);
            requireMutableRevision(objective, input.expectedRevision);
            requireTimestamp(input.assessedAt);
            requireText(input.actor, input.reason);
            requireMonotonicObjectiveTime(objective, input.assessedAt, "objective assessment");
            if (!input.evidenceIds.length || !input.evidenceIds.every(isNotBlankString))
                throw new ValidationError("objective resume requires attributable currentness evidence");

            const runningEpisodes = objective.episodes.filter((episode) => episode.status === "running");
            validateRunningEpisodeReconciliations(runningEpisodes, input.priorEpisodeReconciliations);
            for (const reconciliation of input.priorEpisodeReconciliations) {
                if (reconciliation.outcome === "outcome_unknown") {
                    const episode = runningEpisodes.find(
                        (candidate) => candidate.episode_id === reconciliation.episode_id,
                    )!;
                    episode.status = "outcome_unknown";
                    episode.ended_at = input.assessedAt;
                    episode.outcome_detail = reconciliation.detail;
                }
            }
            const assessment: ObjectiveCurrentnessAssessment = {
                assessment_id: `objective-currentness-${randomUUID()}`,
                objective_revision: objective.revision,
                assessed_at: input.assessedAt,
                actor: input.actor,
                decision: input.decision,
                reason: input.reason,
                evidence_ids: [...input.evidenceIds],
                prior_episode_reconciliations: structuredClone(input.priorEpisodeReconciliations),
            };
            objective.assessments.push(assessment);
            objective.updated_at = input.assessedAt;
            objective.lifecycle_reason = input.reason;
            objective.next_step = structuredClone(input.nextStep);
            if (input.decision !== "continue") {
                if (input.decision === "complete") requireSatisfiedConditions(objective);
                objective.lifecycle =
                    input.decision === "defer"
                        ? "deferred"
                        : input.decision === "block"
                          ? "blocked"
                          : input.decision === "complete"
                            ? "completed"
                            : "abandoned";
                return { objective: structuredClone(objective), episode: null };
            }
            if (!input.runtime) throw new ValidationError("continuing an objective requires a bounded runtime episode");
            objective.lifecycle = "active";
            const episode: ObjectiveEpisode = {
                episode_id: `objective-episode-${randomUUID()}`,
                objective_revision: objective.revision,
                runtime: structuredClone(input.runtime),
                currentness_assessment_id: assessment.assessment_id,
                started_at: input.assessedAt,
                ended_at: null,
                status: "running",
                outcome_detail: null,
            };
            objective.episodes.push(episode);
            return { objective: structuredClone(objective), episode: structuredClone(episode) };
        });
    }

    async checkpoint(input: {
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
    }): Promise<ObjectiveCheckpoint> {
        return this.mutate((document) => {
            const objective = requiredObjective(document, input.objectiveId);
            const episode = objective.episodes.find((item) => item.episode_id === input.episodeId);
            if (!episode || episode.status !== "running")
                throw new ValidationError("checkpoint requires a running objective episode");
            requireTimestamp(input.recordedAt);
            requireText(input.summary);
            if (Date.parse(input.recordedAt) < Date.parse(episode.started_at))
                throw new ValidationError("checkpoint cannot predate its episode");
            if (!input.evidenceIds.length || !input.evidenceIds.every(isNotBlankString))
                throw new ValidationError("checkpoint requires attributable evidence");
            if (input.progress === "uncertain" && !isNotBlankString(input.uncertainty))
                throw new ValidationError("uncertain progress requires an uncertainty account");
            const knownConditions = new Set(objective.success_conditions.map((item) => item.condition_id));
            if (!input.acceptanceConditionIds.every((id) => knownConditions.has(id)))
                throw new ValidationError("checkpoint references an unknown acceptance condition");
            const checkpoint: ObjectiveCheckpoint = {
                checkpoint_id: `objective-checkpoint-${randomUUID()}`,
                episode_id: episode.episode_id,
                objective_revision: objective.revision,
                acceptance_condition_ids: [...input.acceptanceConditionIds],
                progress: input.progress,
                summary: input.summary,
                evidence_ids: [...input.evidenceIds],
                assumptions: [...input.assumptions],
                uncertainty: input.uncertainty,
                proposed_next_step: input.proposedNextStep,
                recorded_at: input.recordedAt,
            };
            objective.checkpoints.push(checkpoint);
            objective.updated_at = latestTimestamp(objective.updated_at, input.recordedAt);
            return structuredClone(checkpoint);
        });
    }

    async finishEpisode(input: {
        objectiveId: string;
        episodeId: string;
        status: Exclude<ObjectiveEpisodeStatus, "running">;
        endedAt: string;
        detail: string;
    }): Promise<ObjectiveEpisode> {
        return this.mutate((document) => {
            const objective = requiredObjective(document, input.objectiveId);
            const episode = objective.episodes.find((item) => item.episode_id === input.episodeId);
            if (!episode || episode.status !== "running") throw new ValidationError("objective episode is not running");
            requireTimestamp(input.endedAt);
            requireText(input.detail);
            if (Date.parse(input.endedAt) < Date.parse(episode.started_at))
                throw new ValidationError("episode outcome cannot predate its start");
            const latestCheckpoint = objective.checkpoints
                .filter((checkpoint) => checkpoint.episode_id === episode.episode_id)
                .reduce<string | null>(
                    (latest, checkpoint) =>
                        latest === null ? checkpoint.recorded_at : latestTimestamp(latest, checkpoint.recorded_at),
                    null,
                );
            if (latestCheckpoint !== null && Date.parse(input.endedAt) < Date.parse(latestCheckpoint))
                throw new ValidationError("episode outcome cannot predate its latest checkpoint");
            const latestStillRunningAssessment = latestStillRunningAssessmentAt(objective, episode.episode_id);
            if (
                latestStillRunningAssessment !== null &&
                Date.parse(input.endedAt) < Date.parse(latestStillRunningAssessment)
            )
                throw new ValidationError("episode outcome cannot predate evidence that it was still running");
            episode.status = input.status;
            episode.ended_at = input.endedAt;
            episode.outcome_detail = input.detail;
            objective.updated_at = latestTimestamp(objective.updated_at, input.endedAt);
            return structuredClone(episode);
        });
    }

    async get(objectiveId: string): Promise<DurableObjective | null> {
        const objective = (await this.load()).objectives.find((item) => item.objective_id === objectiveId);
        return objective ? structuredClone(objective) : null;
    }

    private async mutate<T>(update: (document: ObjectiveDocument) => T): Promise<T> {
        const precedingMutation = this.mutationTail;
        let releaseMutation!: () => void;
        this.mutationTail = new Promise<void>((resolve) => {
            releaseMutation = resolve;
        });
        await precedingMutation;
        let lease = null;
        try {
            lease = await this.lock.acquireWriteLease();
            const document = await this.load();
            const result = update(document);
            validateObjectiveDocument(document);
            await mkdir(dirname(this.path), { recursive: true });
            await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
                durabilityUncertainMessage: "objective ledger replacement may be visible without durable sync",
            });
            return result;
        } finally {
            try {
                if (lease !== null) await this.lock.releaseWriteLease(lease);
            } finally {
                releaseMutation();
            }
        }
    }
}

export function validateObjectiveDocument(value: unknown): asserts value is ObjectiveDocument {
    if (
        !isObject(value) ||
        !exactKeys(value, ["objective_ledger_version", "objectives"]) ||
        value.objective_ledger_version !== 1 ||
        !Array.isArray(value.objectives)
    )
        throw new ValidationError("objective document is invalid");
    const ids = new Set<string>();
    for (const objective of value.objectives) {
        validateObjective(objective);
        if (ids.has(objective.objective_id)) throw new ValidationError("objective identity is duplicated");
        ids.add(objective.objective_id);
    }
}

function validateObjective(value: unknown): asserts value is DurableObjective {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "assessments",
            "checkpoints",
            "created_at",
            "creation",
            "currentness_basis",
            "episodes",
            "lifecycle",
            "lifecycle_reason",
            "next_step",
            "objective_id",
            "principal",
            "purpose",
            "revision",
            "scope",
            "success_conditions",
            "updated_at",
        ])
    )
        throw new ValidationError("objective record is invalid");
    if (
        !isNotBlankString(value.objective_id) ||
        !value.objective_id.startsWith("objective-") ||
        !Number.isInteger(value.revision) ||
        value.revision < 1 ||
        !isNotBlankString(value.purpose) ||
        !isNotBlankString(value.principal) ||
        !isNotBlankString(value.scope) ||
        !["active", "deferred", "blocked", "completed", "abandoned"].includes(String(value.lifecycle)) ||
        !isNotBlankString(value.lifecycle_reason) ||
        !isRfc3339Utc(value.created_at) ||
        !isRfc3339Utc(value.updated_at) ||
        !Array.isArray(value.currentness_basis) ||
        !value.currentness_basis.length ||
        !value.currentness_basis.every(isNotBlankString) ||
        !Array.isArray(value.success_conditions) ||
        !value.success_conditions.length ||
        !Array.isArray(value.assessments) ||
        !Array.isArray(value.episodes) ||
        !Array.isArray(value.checkpoints) ||
        !validCreation(value.creation) ||
        !validNextStep(value.next_step)
    )
        throw new ValidationError("objective record is invalid");
    const conditions = new Set<string>();
    for (const condition of value.success_conditions) {
        if (
            !isObject(condition) ||
            !exactKeys(condition, ["condition_id", "description"]) ||
            !isNotBlankString(condition.condition_id) ||
            !isNotBlankString(condition.description) ||
            conditions.has(condition.condition_id)
        )
            throw new ValidationError("objective success condition is invalid");
        conditions.add(condition.condition_id);
    }
    const assessments = new Set<string>();
    for (const assessment of value.assessments) {
        if (!validAssessment(assessment, value.revision) || assessments.has(assessment.assessment_id))
            throw new ValidationError("objective currentness assessment is invalid");
        assessments.add(assessment.assessment_id);
    }
    const episodes = new Set<string>();
    for (const episode of value.episodes) {
        if (!validEpisode(episode, value.revision, assessments) || episodes.has(episode.episode_id))
            throw new ValidationError("objective episode is invalid");
        episodes.add(episode.episode_id);
    }
    const checkpoints = new Set<string>();
    for (const checkpoint of value.checkpoints) {
        if (
            !validCheckpoint(checkpoint, value.revision, episodes, conditions) ||
            checkpoints.has(checkpoint.checkpoint_id)
        )
            throw new ValidationError("objective checkpoint is invalid");
        checkpoints.add(checkpoint.checkpoint_id);
    }
    if (value.lifecycle === "completed" && value.episodes.some((episode) => episode.status === "running"))
        throw new ValidationError("completed objective has a running episode");
    validateObjectiveChronology(value as unknown as DurableObjective);
}

function validCreation(value: unknown) {
    return (
        isObject(value) &&
        exactKeys(value, ["observed_at", "occurred_at", "occurrence_id", "source_evidence_id"]) &&
        isNotBlankString(value.source_evidence_id) &&
        isNotBlankString(value.occurrence_id) &&
        isRfc3339Utc(value.occurred_at) &&
        isRfc3339Utc(value.observed_at)
    );
}
function validNextStep(value: unknown) {
    return (
        isObject(value) &&
        exactKeys(value, ["description", "owner"]) &&
        ["ember", "principal", "external", "unknown"].includes(String(value.owner)) &&
        isNotBlankString(value.description)
    );
}
function validAssessment(value: unknown, revision: number) {
    return (
        isObject(value) &&
        exactKeys(value, [
            "actor",
            "assessed_at",
            "assessment_id",
            "decision",
            "evidence_ids",
            "objective_revision",
            "prior_episode_reconciliations",
            "reason",
        ]) &&
        isNotBlankString(value.assessment_id) &&
        value.assessment_id.startsWith("objective-currentness-") &&
        value.objective_revision === revision &&
        isRfc3339Utc(value.assessed_at) &&
        isNotBlankString(value.actor) &&
        ["continue", "defer", "block", "complete", "abandon"].includes(String(value.decision)) &&
        isNotBlankString(value.reason) &&
        Array.isArray(value.evidence_ids) &&
        value.evidence_ids.length > 0 &&
        value.evidence_ids.every(isNotBlankString) &&
        Array.isArray(value.prior_episode_reconciliations) &&
        value.prior_episode_reconciliations.every(validEpisodeReconciliation)
    );
}
function validEpisode(value: unknown, revision: number, assessments: Set<string>) {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "currentness_assessment_id",
            "ended_at",
            "episode_id",
            "objective_revision",
            "outcome_detail",
            "runtime",
            "started_at",
            "status",
        ]) ||
        !isNotBlankString(value.episode_id) ||
        !value.episode_id.startsWith("objective-episode-") ||
        value.objective_revision !== revision ||
        !assessments.has(String(value.currentness_assessment_id)) ||
        !isRfc3339Utc(value.started_at) ||
        !["running", "completed", "failed", "outcome_unknown"].includes(String(value.status)) ||
        !isObject(value.runtime) ||
        !exactKeys(value.runtime, ["kind", "provider_label", "runtime_id", "session_id"]) ||
        !isNotBlankString(value.runtime.kind) ||
        !nullableText(value.runtime.runtime_id) ||
        !nullableText(value.runtime.provider_label) ||
        !nullableText(value.runtime.session_id)
    )
        return false;
    return value.status === "running"
        ? value.ended_at === null && value.outcome_detail === null
        : isRfc3339Utc(value.ended_at) && isNotBlankString(value.outcome_detail);
}
function validCheckpoint(value: unknown, revision: number, episodes: Set<string>, conditions: Set<string>) {
    return (
        isObject(value) &&
        exactKeys(value, [
            "acceptance_condition_ids",
            "assumptions",
            "checkpoint_id",
            "episode_id",
            "evidence_ids",
            "objective_revision",
            "progress",
            "proposed_next_step",
            "recorded_at",
            "summary",
            "uncertainty",
        ]) &&
        isNotBlankString(value.checkpoint_id) &&
        value.checkpoint_id.startsWith("objective-checkpoint-") &&
        episodes.has(String(value.episode_id)) &&
        value.objective_revision === revision &&
        Array.isArray(value.acceptance_condition_ids) &&
        value.acceptance_condition_ids.every((id) => typeof id === "string" && conditions.has(id)) &&
        [
            "none_established",
            "partial",
            "condition_satisfied",
            "failed_attempt",
            "blocker_discovered",
            "uncertain",
        ].includes(String(value.progress)) &&
        isNotBlankString(value.summary) &&
        Array.isArray(value.evidence_ids) &&
        value.evidence_ids.length > 0 &&
        value.evidence_ids.every(isNotBlankString) &&
        Array.isArray(value.assumptions) &&
        value.assumptions.every(isNotBlankString) &&
        nullableText(value.uncertainty) &&
        nullableText(value.proposed_next_step) &&
        isRfc3339Utc(value.recorded_at) &&
        (value.progress !== "uncertain" || isNotBlankString(value.uncertainty))
    );
}

function requiredObjective(document: ObjectiveDocument, objectiveId: string) {
    const objective = document.objectives.find((item) => item.objective_id === objectiveId);
    if (!objective) throw new ValidationError(`objective does not exist: ${objectiveId}`);
    return objective;
}
function requireMutableRevision(objective: DurableObjective, revision: number) {
    if (objective.revision !== revision) throw new ValidationError("objective revision is stale");
    if (objective.lifecycle === "completed" || objective.lifecycle === "abandoned")
        throw new ValidationError("terminal objective cannot resume");
}
function requireSatisfiedConditions(objective: DurableObjective) {
    for (const condition of objective.success_conditions) {
        const relevant = objective.checkpoints.filter((checkpoint) =>
            checkpoint.acceptance_condition_ids.includes(condition.condition_id),
        );
        const latestRecordedAt = relevant.reduce<string | null>(
            (latest, checkpoint) =>
                latest === null ? checkpoint.recorded_at : latestTimestamp(latest, checkpoint.recorded_at),
            null,
        );
        const latest = relevant.filter((checkpoint) => checkpoint.recorded_at === latestRecordedAt);
        if (
            latest.length === 0 ||
            latest.some(
                (checkpoint) => checkpoint.progress !== "condition_satisfied" || checkpoint.uncertainty !== null,
            )
        )
            throw new ValidationError(
                `objective completion is not established for condition: ${condition.condition_id}`,
            );
    }
}
function validateRunningEpisodeReconciliations(
    runningEpisodes: ObjectiveEpisode[],
    reconciliations: ObjectiveCurrentnessAssessment["prior_episode_reconciliations"],
) {
    if (!Array.isArray(reconciliations)) throw new ValidationError("objective resume requires episode reconciliation");
    const runningIds = new Set(runningEpisodes.map((episode) => episode.episode_id));
    const reconciledIds = new Set<string>();
    for (const reconciliation of reconciliations) {
        if (
            !validEpisodeReconciliation(reconciliation) ||
            !runningIds.has(reconciliation.episode_id) ||
            reconciledIds.has(reconciliation.episode_id)
        )
            throw new ValidationError("objective resume contains invalid episode reconciliation");
        reconciledIds.add(reconciliation.episode_id);
    }
    if (reconciledIds.size !== runningIds.size)
        throw new ValidationError("objective resume must reconcile every running episode");
}
function validEpisodeReconciliation(value: unknown) {
    return (
        isObject(value) &&
        exactKeys(value, ["detail", "episode_id", "outcome"]) &&
        isNotBlankString(value.episode_id) &&
        value.episode_id.startsWith("objective-episode-") &&
        (value.outcome === "still_running" || value.outcome === "outcome_unknown") &&
        isNotBlankString(value.detail)
    );
}
function requireMonotonicObjectiveTime(objective: DurableObjective, timestamp: string, event: string) {
    if (Date.parse(timestamp) < Date.parse(objective.updated_at))
        throw new ValidationError(`${event} cannot predate the objective's latest durable event`);
}
function latestTimestamp(left: string, right: string) {
    return Date.parse(left) >= Date.parse(right) ? left : right;
}
function latestStillRunningAssessmentAt(objective: DurableObjective, episodeId: string) {
    return objective.assessments
        .filter((assessment) =>
            assessment.prior_episode_reconciliations.some(
                (reconciliation) =>
                    reconciliation.episode_id === episodeId && reconciliation.outcome === "still_running",
            ),
        )
        .reduce<string | null>(
            (latest, assessment) =>
                latest === null ? assessment.assessed_at : latestTimestamp(latest, assessment.assessed_at),
            null,
        );
}
function validateObjectiveChronology(objective: DurableObjective) {
    if (Date.parse(objective.creation.observed_at) < Date.parse(objective.creation.occurred_at))
        throw new ValidationError("objective creation observation predates its occurrence");
    let latest = Date.parse(objective.created_at);
    for (const assessment of objective.assessments) {
        const timestamp = Date.parse(assessment.assessed_at);
        if (timestamp < latest) throw new ValidationError("objective assessments are not chronological");
        latest = timestamp;
    }
    const episodeIds = new Set(objective.episodes.map((episode) => episode.episode_id));
    for (const assessment of objective.assessments) {
        const ids = new Set<string>();
        for (const reconciliation of assessment.prior_episode_reconciliations) {
            const episode = objective.episodes.find((candidate) => candidate.episode_id === reconciliation.episode_id);
            if (
                !episodeIds.has(reconciliation.episode_id) ||
                ids.has(reconciliation.episode_id) ||
                !episode ||
                Date.parse(episode.started_at) > Date.parse(assessment.assessed_at) ||
                (reconciliation.outcome === "outcome_unknown" && episode.ended_at !== assessment.assessed_at)
            )
                throw new ValidationError("objective assessment episode reconciliation is invalid");
            ids.add(reconciliation.episode_id);
        }
    }
    for (const episode of objective.episodes) {
        const assessment = objective.assessments.find(
            (candidate) => candidate.assessment_id === episode.currentness_assessment_id,
        )!;
        if (episode.started_at !== assessment.assessed_at)
            throw new ValidationError("objective episode start does not match its currentness assessment");
        if (episode.ended_at !== null && Date.parse(episode.ended_at) < Date.parse(episode.started_at))
            throw new ValidationError("objective episode ends before it starts");
        const latestStillRunning = latestStillRunningAssessmentAt(objective, episode.episode_id);
        if (
            episode.ended_at !== null &&
            latestStillRunning !== null &&
            Date.parse(episode.ended_at) < Date.parse(latestStillRunning)
        )
            throw new ValidationError("objective episode ends before evidence that it was still running");
    }
    for (const checkpoint of objective.checkpoints) {
        const episode = objective.episodes.find((candidate) => candidate.episode_id === checkpoint.episode_id)!;
        if (
            Date.parse(checkpoint.recorded_at) < Date.parse(episode.started_at) ||
            (episode.ended_at !== null && Date.parse(checkpoint.recorded_at) > Date.parse(episode.ended_at))
        )
            throw new ValidationError("objective checkpoint falls outside its episode");
    }
    const allTimes = [
        objective.created_at,
        ...objective.assessments.map((item) => item.assessed_at),
        ...objective.episodes.flatMap((item) => [item.started_at, ...(item.ended_at === null ? [] : [item.ended_at])]),
        ...objective.checkpoints.map((item) => item.recorded_at),
    ];
    if (allTimes.some((timestamp) => Date.parse(timestamp) > Date.parse(objective.updated_at)))
        throw new ValidationError("objective updated time predates durable history");
}
function requireText(...values: unknown[]) {
    if (!values.every(isNotBlankString)) throw new ValidationError("objective text fields must be non-empty");
}
function requireTimestamp(...values: unknown[]) {
    if (!values.every(isRfc3339Utc)) throw new ValidationError("objective timestamps must be RFC 3339 UTC");
}
function nullableText(value: unknown): value is string | null {
    return value === null || isNotBlankString(value);
}
function errorCode(error: unknown) {
    return isObject(error) && typeof error.code === "string" ? error.code : null;
}
function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
