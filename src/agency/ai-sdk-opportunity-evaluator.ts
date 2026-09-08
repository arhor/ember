import type { LanguageModel } from "ai";

import {
    AISDKError,
    APICallError,
    generateText,
    jsonSchema,
    NoObjectGeneratedError,
    Output,
    RetryError,
} from "ai";

import type { CognitionOpportunityDecision, MeaningId } from "../core/model.ts";
import type {
    CognitionOpportunityEvaluation,
    CognitionOpportunityEvaluator,
    CognitionOpportunityRequest,
} from "./cognition-opportunity.ts";

import { ProviderError, ValidationError } from "../core/errors.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";
import { COGNITION_OPPORTUNITY_CONTRACT_VERSION } from "./cognition-opportunity.ts";

interface AiSdkOpportunityOutput {
    contractVersion: 1;
    decision: CognitionOpportunityDecision;
    selectedMeaningIds: string[];
}

export const AI_SDK_OPPORTUNITY_INSTRUCTION = [
    "Evaluate only whether the projected current Ember state contains anything worth discretionary cognition now.",
    "The opportunity itself supplies no topic or motive; select only from projected Ember-owned meaning.",
    "Do not use tools, files, prior threads, or outside context.",
    "Return the decision through the supplied structured output schema rather than prose.",
    "For cognition or defer, select at least one projected meaning ID that materially grounds the decision.",
    "For no_cognition, select no meaning IDs.",
].join(" ");

const opportunityOutputSchema = jsonSchema<AiSdkOpportunityOutput>({
    type: "object",
    additionalProperties: false,
    properties: {
        contractVersion: { type: "integer", const: COGNITION_OPPORTUNITY_CONTRACT_VERSION },
        decision: { type: "string", enum: ["cognition", "defer", "no_cognition"] },
        selectedMeaningIds: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
        },
    },
    required: ["contractVersion", "decision", "selectedMeaningIds"],
});

const opportunityOutput = Output.object({
    schema: opportunityOutputSchema,
    name: "ember_cognition_opportunity_decision",
    description: "A bounded Ember decision about whether the current projected state warrants cognition.",
});

const MAX_AI_SDK_RETRIES = 0;

export interface AiSdkOpportunityEvaluatorOptions {
    timeoutSeconds?: number;
    signal?: AbortSignal;
}

export function createAiSdkOpportunityEvaluator(
    model: LanguageModel,
    options: AiSdkOpportunityEvaluatorOptions = {},
): CognitionOpportunityEvaluator {
    return (request) => evaluateCognitionOpportunityWithAiSdk(request, model, options);
}

export async function evaluateCognitionOpportunityWithAiSdk(
    request: CognitionOpportunityRequest,
    model: LanguageModel,
    { timeoutSeconds = 60, signal }: AiSdkOpportunityEvaluatorOptions = {},
): Promise<CognitionOpportunityEvaluation> {
    validateTimeout(timeoutSeconds);
    if (signal?.aborted) {
        throw cancellationError("AI SDK opportunity evaluation cancellation requested before invocation");
    }

    try {
        const result = await generateText({
            model,
            instructions: AI_SDK_OPPORTUNITY_INSTRUCTION,
            prompt: JSON.stringify({ projection: request.projection }),
            output: opportunityOutput,
            maxRetries: MAX_AI_SDK_RETRIES,
            timeout: Math.max(1, Math.ceil(timeoutSeconds * 1000)),
            abortSignal: signal,
        });

        return {
            contractVersion: result.output.contractVersion,
            decision: result.output.decision,
            // JSON Schema can prove string shape only. The Ember opportunity boundary
            // re-validates projection membership before these IDs acquire semantic force.
            selectedMeaningIds: [...result.output.selectedMeaningIds] as MeaningId[],
        };
    } catch (error) {
        if (error instanceof ProviderError || error instanceof ValidationError) {
            throw error;
        }
        throw translateAiSdkOpportunityFailure(error, signal);
    }
}

function validateTimeout(timeoutSeconds: number) {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
        throw new ProviderError("opportunity evaluator timeout must be a positive finite number");
    }
    if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS) {
        throw new ProviderError(`opportunity evaluator timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
    }
}

function translateAiSdkOpportunityFailure(error: unknown, signal?: AbortSignal): ProviderError | ValidationError {
    if (isTimeoutFailure(error)) {
        return new ProviderError("AI SDK opportunity evaluator timed out", { outcome: "timed_out" });
    }

    if (isCancellationFailure(error, signal)) {
        return cancellationError("AI SDK opportunity evaluation cancellation requested during invocation");
    }

    if (NoObjectGeneratedError.isInstance(error)) {
        return new ValidationError("AI SDK opportunity evaluator produced invalid structured output");
    }

    if (APICallError.isInstance(error)) {
        const status = error.statusCode;
        return new ProviderError(
            status === undefined
                ? "AI SDK opportunity evaluator API call failed"
                : `AI SDK opportunity evaluator API call failed (HTTP ${status})`,
        );
    }

    if (RetryError.isInstance(error)) {
        return new ProviderError("AI SDK opportunity evaluator exhausted its retry policy");
    }

    if (AISDKError.isInstance(error)) {
        return new ProviderError("AI SDK opportunity evaluator failed");
    }

    return new ProviderError(`AI SDK opportunity evaluator failed: ${errorMessage(error)}`, { cause: error });
}

function cancellationError(message: string) {
    return new ProviderError(message, {
        outcome: "cancellation_requested",
        termination: { reason: "explicit_cancellation", directChildExitObserved: false },
    });
}

function isTimeoutFailure(error: unknown): boolean {
    if (error instanceof DOMException && error.code === DOMException.TIMEOUT_ERR) {
        return true;
    }
    if (RetryError.isInstance(error) && error.lastError !== error) {
        return isTimeoutFailure(error.lastError);
    }
    if (AISDKError.isInstance(error) && error.cause !== error) {
        return isTimeoutFailure(error.cause);
    }
    return false;
}

function isCancellationFailure(error: unknown, signal?: AbortSignal): boolean {
    if (!signal?.aborted) {
        return false;
    }
    if (error === signal.reason) {
        return true;
    }
    if (error instanceof DOMException && error.code === DOMException.ABORT_ERR) {
        return true;
    }
    if (RetryError.isInstance(error)) {
        if (error.reason === "abort") {
            return true;
        }
        if (error.lastError !== error) {
            return isCancellationFailure(error.lastError, signal);
        }
    }
    if (AISDKError.isInstance(error) && error.cause !== error) {
        return isCancellationFailure(error.cause, signal);
    }
    return false;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
