import type { ActionProposalRecord, ActionProposalStore } from "../capabilities/action-proposal.ts";
import type { CapabilityJsonValue } from "../capabilities/execution.ts";
import type { DurableObjectiveStore, ObjectiveCheckpoint, ObjectiveProgress } from "../objectives/durable-objective.ts";

import { ValidationError } from "../errors.ts";

export interface ObjectiveActionStep {
    objectiveId: string;
    objectiveRevision: number;
    episodeId: string;
    stepId: string;
    acceptanceConditionIds: string[];
}

/**
 * Joins the objective and action ledgers without making either ledger subordinate to
 * a provider session. The action ledger remains authoritative for effect truth; an
 * objective checkpoint only reintegrates that attributed result.
 */
export class ObjectiveActionCoordinator {
    private readonly objectives: DurableObjectiveStore;
    private readonly actions: ActionProposalStore;

    constructor(objectives: DurableObjectiveStore, actions: ActionProposalStore) {
        this.objectives = objectives;
        this.actions = actions;
    }

    async createProposal(
        input: ObjectiveActionStep & {
            capability: string;
            principal: string;
            scope: string;
            purpose: string;
            consequence: string;
            payload: CapabilityJsonValue;
            target: { label: string; fingerprint: `sha256:${string}` };
            sourceIds: readonly string[];
            createdAt: string;
            expiresAt: string;
        },
    ): Promise<ActionProposalRecord> {
        await this.requireCurrentStep(input, true);
        return this.actions.create({
            capability: input.capability,
            principal: input.principal,
            scope: input.scope,
            purpose: input.purpose,
            consequence: input.consequence,
            payload: input.payload,
            target: input.target,
            sourceIds: input.sourceIds,
            createdAt: input.createdAt,
            expiresAt: input.expiresAt,
            objectiveStep: {
                objective_id: input.objectiveId as `objective-${string}`,
                objective_revision: input.objectiveRevision,
                episode_id: input.episodeId as `objective-episode-${string}`,
                step_id: input.stepId,
                acceptance_condition_ids: [...input.acceptanceConditionIds],
            },
        });
    }

    async revalidate(proposalId: string): Promise<{ status: "current" } | { status: "stale"; reason: string }> {
        const proposal = await this.actions.get(proposalId);
        if (!proposal?.objective_step) return { status: "stale", reason: "proposal is not bound to an objective step" };
        try {
            await this.requireCurrentStep(
                {
                    objectiveId: proposal.objective_step.objective_id,
                    objectiveRevision: proposal.objective_step.objective_revision,
                    episodeId: proposal.objective_step.episode_id,
                    stepId: proposal.objective_step.step_id,
                    acceptanceConditionIds: proposal.objective_step.acceptance_condition_ids,
                    principal: proposal.principal,
                    scope: proposal.scope,
                },
                false,
            );
            return { status: "current" };
        } catch (error) {
            return { status: "stale", reason: error instanceof Error ? error.message : String(error) };
        }
    }

    async reintegrate(input: {
        objectiveId: string;
        episodeId: string;
        proposalId: string;
        recordedAt: string;
        confirmedProgress?: Extract<ObjectiveProgress, "partial" | "condition_satisfied">;
        summary: string;
        proposedNextStep: string | null;
    }): Promise<ObjectiveCheckpoint> {
        const proposal = await this.actions.get(input.proposalId);
        if (!proposal?.objective_step || proposal.objective_step.objective_id !== input.objectiveId)
            throw new ValidationError("action outcome does not belong to this objective");
        if (!proposal.attempt || proposal.status === "executing")
            throw new ValidationError("action effect is not terminal enough to reintegrate");

        const progress = progressFor(proposal, input.confirmedProgress);
        const uncertainty =
            proposal.status === "outcome_unknown"
                ? `Effect truth remains uncertain for ${proposal.proposal_id}; consequential retry is unsafe.`
                : null;
        return this.objectives.checkpoint({
            objectiveId: input.objectiveId,
            episodeId: input.episodeId,
            recordedAt: input.recordedAt,
            acceptanceConditionIds: proposal.objective_step.acceptance_condition_ids,
            progress,
            summary: input.summary,
            evidenceIds: [proposal.proposal_id, proposal.attempt.attempt_id],
            assumptions: [],
            uncertainty,
            proposedNextStep: input.proposedNextStep,
        });
    }

    private async requireCurrentStep(
        input: ObjectiveActionStep & { principal: string; scope: string },
        requireRunningEpisode: boolean,
    ) {
        const objective = await this.objectives.get(input.objectiveId);
        if (!objective) throw new ValidationError("objective action references a missing objective");
        if (objective.revision !== input.objectiveRevision)
            throw new ValidationError("objective action references a stale objective revision");
        if (objective.lifecycle === "completed" || objective.lifecycle === "abandoned")
            throw new ValidationError("objective action references a terminal objective");
        if (objective.principal !== input.principal || objective.scope !== input.scope)
            throw new ValidationError("objective action crosses the objective principal or scope");
        const episode = objective.episodes.find((candidate) => candidate.episode_id === input.episodeId);
        if (!episode) throw new ValidationError("objective action references an unknown episode");
        if (requireRunningEpisode && episode.status !== "running")
            throw new ValidationError("objective action proposal requires a running source episode");
        const conditions = new Set(objective.success_conditions.map((condition) => condition.condition_id));
        if (
            !input.stepId.trim() ||
            !input.acceptanceConditionIds.length ||
            !input.acceptanceConditionIds.every((condition) => conditions.has(condition))
        )
            throw new ValidationError("objective action references an invalid concrete step");
    }
}

function progressFor(
    proposal: ActionProposalRecord,
    confirmed: "partial" | "condition_satisfied" | undefined,
): ObjectiveProgress {
    if (proposal.status === "succeeded") {
        if (!confirmed) throw new ValidationError("confirmed effect reintegration requires a progress judgment");
        return confirmed;
    }
    if (proposal.status === "failed") return "failed_attempt";
    if (proposal.status === "outcome_unknown") return "uncertain";
    throw new ValidationError(`action status is not an effect outcome: ${proposal.status}`);
}
