import type { AiExecutor } from "../ai/contract.ts";
import type { MemoryProposalGenerationResult, MemoryProposalGenerator } from "./memory-proposal-generation.ts";

import { ProviderError } from "../core/errors.ts";
import { initialState, newId } from "../core/model.ts";
import { buildProjection } from "../core/projection.ts";
import { startRuntime } from "../core/runtime-episode.ts";

export function createProviderMemoryProposalGenerator(
    provider: AiExecutor,
    timeoutSeconds: number,
): MemoryProposalGenerator {
    return async (request) => {
        const state = initialState(request.projection.principal, request.proposedAt);
        state.lineage.lineageId = request.projection.agent_actor.slice(
            "agent:".length,
        ) as typeof state.lineage.lineageId;
        const started = startRuntime(state, request.projection.principal, request.projection.scope);
        const instruction = [
            "Return only JSON with contractVersion 1 and candidates array.",
            "Candidates must follow the supplied memory proposal projection and may cite only its grounding evidence IDs.",
            "Each candidate must contain proposal_version, proposal_id, proposed_at, kind, owner, slot, scope, content, source_evidence_ids, epistemic_role, applicable_from, applicable_until, proposed_currentness, confidence {source, proposition, interpretation}, uncertainty, and supersedes_meaning_id.",
            "Supported kinds are fact, preference, relationship, and episode_meta; never propose commitments.",
            "Use an empty candidates array when no durable meaning is clearly supported.",
            JSON.stringify({
                generation_id: request.generationId,
                proposed_at: request.proposedAt,
                memory_proposal_projection: request.projection,
            }),
        ].join(" ");
        const projection = buildProjection(started.state, {
            principal: request.projection.principal,
            scope: request.projection.scope,
            surface: "memory_proposal_reflection",
            currentInput: instruction,
            currentTime: request.proposedAt,
            runtimeId: started.runtimeId,
        });
        const result = await provider(
            {
                contractVersion: 1,
                cognitionId: newId("cognition"),
                projection,
                input: { text: instruction },
            },
            { timeoutSeconds },
        );
        try {
            return JSON.parse(result.reply) as MemoryProposalGenerationResult;
        } catch (error) {
            throw new ProviderError("memory proposal provider returned invalid JSON", { cause: error });
        }
    };
}
