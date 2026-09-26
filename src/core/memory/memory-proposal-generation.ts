import type { ConversationId, ProjectedConversationContext } from "../conversation-context.ts";
import type { MemoryProposal, MemoryProposalAssessment } from "../memory-proposal.ts";
import type { AgentActor, EmberState, EvidenceId, MeaningId } from "../model.ts";
import type { MemoryProposalGenerationStore } from "../persistence/memory-proposal-generation-store.ts";
import type { StateStore } from "../persistence/state-store.ts";

import { ProviderError, StaleRevision, ValidationError } from "../errors.ts";
import { assessMemoryProposal, resolveMemoryProposal } from "../memory-proposal.ts";
import { agentActor, isRfc3339Utc, nowUtc, validateState } from "../model.ts";
import { contentDigest, exactKeys, isObject } from "../util.ts";

export const MEMORY_PROPOSAL_GENERATION_CONTRACT_VERSION = 1;
export const MEMORY_PROPOSAL_GENERATION_MAX_PROPOSALS = 8;

export interface MemoryProposalGenerationProjection {
    projection_version: 1;
    principal: string;
    scope: string;
    agent_actor: AgentActor;
    conversation_id: ConversationId | null;
    turns: ProjectedConversationContext["turns"];
    current_meanings: Array<{
        meaning_id: MeaningId;
        kind: "fact" | "preference";
        owner: string;
        slot: string;
        scope: string;
        content: string;
        epistemic_role: string;
        uncertainty: string | null;
    }>;
    selection: {
        source_evidence_ids: EvidenceId[];
        current_meaning_ids: MeaningId[];
        excluded_turn_count: number;
    };
}

export interface MemoryProposalGenerationRequest {
    contractVersion: 1;
    generationId: `memory-generation-${string}`;
    proposedAt: string;
    projection: MemoryProposalGenerationProjection;
}

export interface MemoryProposalGenerationResult {
    contractVersion: 1;
    candidates: unknown[];
}

export type MemoryProposalGenerator = (
    request: MemoryProposalGenerationRequest,
) => Promise<MemoryProposalGenerationResult>;

export type MemoryProposalGenerationOutcome =
    | {
          status: "invalid" | "unsupported";
          candidate: unknown;
          assessment: Exclude<MemoryProposalAssessment, { status: "valid" }>;
      }
    | { status: "adopted" | "rejected"; proposal: MemoryProposal };

export interface MemoryProposalGenerationRun {
    generation_id: `memory-generation-${string}`;
    proposed_at: string;
    source_evidence_ids: EvidenceId[];
    outcomes: MemoryProposalGenerationOutcome[];
    state: EmberState;
}

export type MemoryStateRepository = Pick<StateStore, "load" | "commit">;
export type MemoryProposalGenerationRepository = Pick<MemoryProposalGenerationStore, "append" | "complete">;

export function buildMemoryProposalGenerationProjection(
    state: EmberState,
    conversation: ProjectedConversationContext,
    { principal, scope }: { principal: string; scope: string },
): MemoryProposalGenerationProjection {
    validateState(state);
    if (principal !== state.runtimeContract.localPrincipal) throw new ValidationError("proposal principal is invalid");
    if (!scope.trim()) throw new ValidationError("proposal scope must be non-empty");

    const evidenceById = new Map(state.evidence.map((item) => [item.evidenceId, item]));
    const turns = conversation.turns.filter((turn) => {
        const evidence = evidenceById.get(turn.evidence_id);
        return (
            evidence?.scope === scope &&
            ((evidence.sourceRole === "user_command" && evidence.availability === "available") ||
                evidence.sourceRole === "agent_expression_via_provider")
        );
    });
    const sourceEvidenceIds = turns
        .filter((turn) => evidenceById.get(turn.evidence_id)?.sourceRole === "user_command")
        .map((turn) => turn.evidence_id);
    const continuingAgentActor = agentActor(state.lineage.lineageId);
    const currentMeanings = state.meanings
        .filter(
            (meaning): meaning is Extract<(typeof state.meanings)[number], { kind: "fact" | "preference" }> =>
                meaning.currentness === "current" &&
                meaning.scope === scope &&
                (meaning.kind === "fact" || meaning.kind === "preference") &&
                ((meaning.owner === `user:${principal}` && meaning.epistemicRole === "user_testimony") ||
                    (meaning.kind === "fact" &&
                        meaning.owner === continuingAgentActor &&
                        meaning.epistemicRole === "agent_inference")),
        )
        .map((meaning) => ({
            meaning_id: meaning.meaningId,
            kind: meaning.kind,
            owner: meaning.owner,
            slot: meaning.slot,
            scope: meaning.scope,
            content: meaning.content,
            epistemic_role: meaning.epistemicRole,
            uncertainty: meaning.uncertainty,
        }));

    return {
        projection_version: 1,
        principal,
        scope,
        agent_actor: continuingAgentActor,
        conversation_id: conversation.conversation_id,
        turns,
        current_meanings: currentMeanings,
        selection: {
            source_evidence_ids: sourceEvidenceIds,
            current_meaning_ids: currentMeanings.map((meaning) => meaning.meaning_id),
            excluded_turn_count: conversation.turns.length - turns.length,
        },
    };
}

export async function generateAndAdoptConversationMemories(
    store: MemoryStateRepository,
    ledger: MemoryProposalGenerationRepository,
    state: EmberState,
    conversation: ProjectedConversationContext,
    {
        principal,
        scope,
        generator,
        providerLabel = "memory-proposal-generator",
        timestamp = nowUtc(),
    }: {
        principal: string;
        scope: string;
        generator: MemoryProposalGenerator;
        providerLabel?: string;
        timestamp?: string;
    },
): Promise<MemoryProposalGenerationRun> {
    if (!isRfc3339Utc(timestamp)) throw new ValidationError("proposal generation time must be RFC 3339 UTC");
    const projection = buildMemoryProposalGenerationProjection(state, conversation, { principal, scope });
    const generationId = deterministicGenerationId(state, projection, timestamp);
    await ledger.append({
        generation_id: generationId,
        proposed_at: timestamp,
        completed_at: null,
        principal,
        scope,
        provider_label: providerLabel,
        source_evidence_ids: [...projection.selection.source_evidence_ids],
        status: "generating",
        outcomes: [],
        failure: null,
    });
    let result: MemoryProposalGenerationResult;
    try {
        result = await generator({
            contractVersion: MEMORY_PROPOSAL_GENERATION_CONTRACT_VERSION,
            generationId,
            proposedAt: timestamp,
            projection,
        });
        validateGeneratorResult(result);
    } catch (error) {
        const status = error instanceof ProviderError ? error.outcome : "failed";
        await ledger.complete(generationId, {
            completed_at: nowUtc(),
            status,
            outcomes: [],
            failure: boundedFailure(error),
        });
        throw error;
    }

    const outcomes: MemoryProposalGenerationOutcome[] = [];
    let current = state;
    try {
        for (const [index, generatedCandidate] of result.candidates.entries()) {
            const candidate: unknown = isObject(generatedCandidate)
                ? {
                      ...generatedCandidate,
                      proposal_id: `memory-proposal-${generationId.slice("memory-generation-".length)}-${index}`,
                      proposed_at: timestamp,
                  }
                : generatedCandidate;
            let assessment: MemoryProposalAssessment = assessMemoryProposal(current, candidate);
            if (assessment.status === "valid") {
                const unprojected = assessment.proposal.source_evidence_ids.find(
                    (id) => !projection.selection.source_evidence_ids.includes(id),
                );
                if (unprojected) {
                    assessment = {
                        status: "invalid",
                        reason: "missing_evidence",
                        detail: `source evidence is outside the bounded conversation projection: ${unprojected}`,
                    };
                }
            }
            if (assessment.status !== "valid") {
                outcomes.push({ status: assessment.status, candidate: structuredClone(candidate), assessment });
                continue;
            }
            const resolution = resolveMemoryProposal(current, assessment.proposal, current.revision, {
                decidedAt: timestamp,
            });
            if (resolution.proposal.status === "adopted") {
                const loaded = await store.load();
                if (loaded.revision !== current.revision) {
                    throw new StaleRevision("canonical revision changed during memory proposal adoption");
                }
                current = await store.commit(current.revision, resolution.state);
            }
            outcomes.push({ status: resolution.proposal.status, proposal: resolution.proposal });
        }
    } catch (error) {
        await ledger.complete(generationId, {
            completed_at: nowUtc(),
            status: "outcome_unknown",
            outcomes,
            failure: boundedFailure(error),
        });
        throw error;
    }

    await ledger.complete(generationId, {
        completed_at: nowUtc(),
        status: "completed",
        outcomes,
        failure: null,
    });

    return {
        generation_id: generationId,
        proposed_at: timestamp,
        source_evidence_ids: [...projection.selection.source_evidence_ids],
        outcomes,
        state: current,
    };
}

function boundedFailure(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, 512) || "memory proposal generation failed";
}

function validateGeneratorResult(value: unknown): asserts value is MemoryProposalGenerationResult {
    if (
        !isObject(value) ||
        !exactKeys(value, ["candidates", "contractVersion"]) ||
        value.contractVersion !== MEMORY_PROPOSAL_GENERATION_CONTRACT_VERSION ||
        !Array.isArray(value.candidates) ||
        value.candidates.length > MEMORY_PROPOSAL_GENERATION_MAX_PROPOSALS
    ) {
        throw new ValidationError("memory proposal generator result is invalid");
    }
}

function deterministicGenerationId(
    state: EmberState,
    projection: MemoryProposalGenerationProjection,
    timestamp: string,
): `memory-generation-${string}` {
    const digest = contentDigest(
        JSON.stringify([state.lineage.lineageId, state.revision, timestamp, projection.selection.source_evidence_ids]),
    );
    return `memory-generation-${digest.slice("sha256:".length)}`;
}
