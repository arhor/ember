import type { JSONSchema7, LanguageModel } from "ai";

import {
    AISDKError,
    APICallError,
    generateText,
    JSONParseError,
    jsonSchema,
    NoObjectGeneratedError,
    Output,
    RetryError,
    TypeValidationError,
} from "ai";

import type { ConversationId, ProjectedConversationContext } from "../core/conversation-context.ts";
import type { MemoryProposal, MemoryProposalAssessment } from "../core/memory-proposal.ts";
import type { EmberState, EvidenceId, MeaningId } from "../core/model.ts";
import type { StateStore } from "../persistence/state-store.ts";

import { ProviderError, StaleRevision, ValidationError } from "../core/errors.ts";
import { assessMemoryProposal, resolveMemoryProposal } from "../core/memory-proposal.ts";
import { isRfc3339Utc, nowUtc, validateState } from "../core/model.ts";
import { MemoryProposalGenerationStore } from "../persistence/memory-proposal-generation-store.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";
import { contentDigest, exactKeys, isObject } from "../util.ts";

export const MEMORY_PROPOSAL_GENERATION_CONTRACT_VERSION = 1;
export const MEMORY_PROPOSAL_GENERATION_MAX_PROPOSALS = 8;

export interface MemoryProposalGenerationProjection {
    projection_version: 1;
    principal: string;
    scope: string;
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
                evidence.sourceRole === "ember_expression_via_provider")
        );
    });
    const sourceEvidenceIds = turns
        .filter((turn) => evidenceById.get(turn.evidence_id)?.sourceRole === "user_command")
        .map((turn) => turn.evidence_id);
    const currentMeanings = state.meanings
        .filter(
            (meaning): meaning is Extract<(typeof state.meanings)[number], { kind: "fact" | "preference" }> =>
                meaning.currentness === "current" &&
                meaning.scope === scope &&
                (meaning.kind === "fact" || meaning.kind === "preference") &&
                meaning.owner === `user:${principal}` &&
                meaning.epistemicRole === "user_testimony",
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
    store: StateStore,
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
    const ledger = new MemoryProposalGenerationStore(store.path);
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

export const AI_SDK_MEMORY_PROPOSAL_INSTRUCTION = [
    "Inspect only the supplied bounded Ember conversation projection.",
    "Return zero or more durable-memory candidates through the structured schema; an empty list is a valid no-proposal result.",
    "Cite only supplied user evidence IDs and preserve the exact principal and scope.",
    "Prefer stable user facts, preferences, relationship meaning, or episode metadata; never propose commitments.",
    "Use a supplied current meaning ID as supersedes_meaning_id only for an explicit correction in the same semantic slot.",
    "Do not treat Ember replies, conversation IDs, provider context, or unstated implications as user testimony.",
].join(" ");

const confidenceSchema: JSONSchema7 = {
    type: "object",
    additionalProperties: false,
    properties: {
        source: { type: "string", enum: ["high", "medium", "low", "not_applicable"] },
        proposition: { type: "string", enum: ["high", "medium", "low", "not_applicable"] },
        interpretation: { type: "string", enum: ["high", "medium", "low", "not_applicable"] },
    },
    required: ["source", "proposition", "interpretation"],
};

const candidateSchema: JSONSchema7 = {
    type: "object",
    additionalProperties: false,
    properties: {
        proposal_version: { type: "integer", const: 1 },
        proposal_id: { type: "string" },
        proposed_at: { type: "string" },
        kind: { type: "string", enum: ["relationship", "fact", "preference", "episode_meta"] },
        owner: { type: "string" },
        slot: { type: "string" },
        scope: { type: "string" },
        content: { type: "string" },
        source_evidence_ids: { type: "array", minItems: 1, items: { type: "string" }, uniqueItems: true },
        epistemic_role: { type: "string", enum: ["user_testimony", "ember_inference"] },
        applicable_from: { type: "string" },
        applicable_until: { anyOf: [{ type: "string" }, { type: "null" }] },
        proposed_currentness: { type: "string", const: "current" },
        confidence: confidenceSchema,
        uncertainty: { anyOf: [{ type: "string" }, { type: "null" }] },
        supersedes_meaning_id: { anyOf: [{ type: "string" }, { type: "null" }] },
    },
    required: [
        "proposal_version",
        "proposal_id",
        "proposed_at",
        "kind",
        "owner",
        "slot",
        "scope",
        "content",
        "source_evidence_ids",
        "epistemic_role",
        "applicable_from",
        "applicable_until",
        "proposed_currentness",
        "confidence",
        "uncertainty",
        "supersedes_meaning_id",
    ],
};

const aiSdkOutput = Output.object({
    schema: jsonSchema<MemoryProposalGenerationResult>({
        type: "object",
        additionalProperties: false,
        properties: {
            contractVersion: { type: "integer", const: MEMORY_PROPOSAL_GENERATION_CONTRACT_VERSION },
            candidates: { type: "array", maxItems: MEMORY_PROPOSAL_GENERATION_MAX_PROPOSALS, items: candidateSchema },
        },
        required: ["contractVersion", "candidates"],
    }),
    name: "ember_memory_proposals",
    description: "Evidence-grounded, non-canonical candidates for Ember memory adoption.",
});

export function createAiSdkMemoryProposalGenerator(
    model: LanguageModel,
    { timeoutSeconds = 60, signal }: { timeoutSeconds?: number; signal?: AbortSignal } = {},
): MemoryProposalGenerator {
    validateTimeout(timeoutSeconds);
    return async (request) => {
        if (signal?.aborted) throw cancellationError("memory proposal generation cancelled before invocation");
        try {
            const generated = await generateText({
                model,
                instructions: AI_SDK_MEMORY_PROPOSAL_INSTRUCTION,
                prompt: JSON.stringify({
                    generation_id: request.generationId,
                    proposed_at: request.proposedAt,
                    projection: request.projection,
                }),
                output: aiSdkOutput,
                maxRetries: 0,
                timeout: Math.max(1, Math.ceil(timeoutSeconds * 1000)),
                ...(signal === undefined ? {} : { abortSignal: signal }),
            });
            return generated.output;
        } catch (error) {
            throw translateFailure(error, signal);
        }
    };
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

function validateTimeout(timeoutSeconds: number) {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS) {
        throw new ProviderError(
            `memory proposal timeout must be between 0 and ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`,
        );
    }
}

function translateFailure(error: unknown, signal?: AbortSignal): ProviderError | ValidationError {
    if (error instanceof ProviderError || error instanceof ValidationError) return error;
    if (error instanceof DOMException && error.code === DOMException.TIMEOUT_ERR)
        return new ProviderError("memory proposal generation timed out", { outcome: "timed_out" });
    if (signal?.aborted)
        return cancellationError("memory proposal generation cancellation requested during invocation");
    if (
        NoObjectGeneratedError.isInstance(error) ||
        TypeValidationError.isInstance(error) ||
        JSONParseError.isInstance(error)
    )
        return new ValidationError("memory proposal generator produced invalid structured output");
    if (APICallError.isInstance(error))
        return new ProviderError(
            error.statusCode === undefined
                ? "memory proposal API call failed"
                : `memory proposal API call failed (HTTP ${error.statusCode})`,
        );
    if (RetryError.isInstance(error)) return new ProviderError("memory proposal generator exhausted its retry policy");
    if (AISDKError.isInstance(error)) return new ProviderError("memory proposal generator failed");
    return new ProviderError(
        `memory proposal generator failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
    );
}

function cancellationError(message: string) {
    return new ProviderError(message, {
        outcome: "cancellation_requested",
        termination: { reason: "explicit_cancellation", directChildExitObserved: false },
    });
}
