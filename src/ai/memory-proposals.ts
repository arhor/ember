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

import type { MemoryProposalGenerationResult, MemoryProposalGenerator } from "../memory/memory-proposal-generation.ts";

import { ProviderError, ValidationError } from "../core/errors.ts";
import {
    MEMORY_PROPOSAL_GENERATION_CONTRACT_VERSION,
    MEMORY_PROPOSAL_GENERATION_MAX_PROPOSALS,
} from "../memory/memory-proposal-generation.ts";
import { MAX_AI_TIMEOUT_SECONDS } from "./contract.ts";

export const AI_SDK_MEMORY_PROPOSAL_INSTRUCTION = [
    "Inspect only the supplied bounded conversation projection for the continuing agent.",
    "Return zero or more durable-memory candidates through the structured schema; an empty list is a valid no-proposal result.",
    "Cite only supplied user evidence IDs and preserve the exact principal and scope.",
    "Prefer stable user facts, preferences, relationship meaning, episode metadata, or genuinely supported self-related facts; never propose commitments.",
    "For self-related facts owned by the continuing agent, use projection.agent_actor with epistemic_role agent_inference. Preferred name and self-description are ordinary mutable facts, not lineage identity.",
    "When the user tells the agent what name to use for itself (for example asking to be called a different name), propose kind fact, owner projection.agent_actor, slot preferred_name, scope projection.scope (the current conversation scope, matching the cited evidence, never the agent_actor string itself), epistemic_role agent_inference, content the requested name. Never propose kind relationship for this; relationship proposals are owner relationship:<principal> with the fixed slot relationship and describe the relationship itself, not a name.",
    "When the user describes what personality, tone, or interaction style they want from the agent, propose kind fact, owner projection.agent_actor, slot self_description, scope projection.scope, epistemic_role agent_inference, content a concise first-person self-description reflecting that steering. Never propose kind preference for this; preference proposals are owned by user:<principal> and describe the user's own preferences, not the agent's self-description.",
    "Use a supplied current meaning ID as supersedes_meaning_id only for an explicit correction in the same semantic slot.",
    "Do not treat agent replies, conversation IDs, provider context, or unstated implications as user testimony.",
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
        epistemic_role: { type: "string", enum: ["user_testimony", "agent_inference"] },
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
    description: "Evidence-grounded, non-canonical candidates for continuing-agent memory adoption.",
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

function validateTimeout(timeoutSeconds: number) {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > MAX_AI_TIMEOUT_SECONDS)
        throw new ProviderError(`memory proposal timeout must be between 0 and ${MAX_AI_TIMEOUT_SECONDS} seconds`);
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
