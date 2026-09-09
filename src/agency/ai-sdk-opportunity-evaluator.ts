import type { LanguageModel } from "ai";

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

import type { CognitionOpportunityDecision, MeaningId } from "../core/model.ts";
import type {
    CognitionOpportunityEvaluation,
    CognitionOpportunityEvaluator,
    CognitionOpportunityRequest,
} from "./cognition-opportunity.ts";

import { ProviderError, ValidationError } from "../core/errors.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";
import { exactKeys, isObject } from "../util.ts";
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

const OPPORTUNITY_DECISIONS = ["cognition", "defer", "no_cognition"] as const;
const OPPORTUNITY_OUTPUT_KEYS = ["contractVersion", "decision", "selectedMeaningIds"] as const;

const opportunityOutputSchema = jsonSchema<AiSdkOpportunityOutput>(
    {
        type: "object",
        additionalProperties: false,
        properties: {
            contractVersion: { type: "integer", const: COGNITION_OPPORTUNITY_CONTRACT_VERSION },
            decision: { type: "string", enum: [...OPPORTUNITY_DECISIONS] },
            selectedMeaningIds: {
                type: "array",
                items: { type: "string" },
            },
        },
        required: [...OPPORTUNITY_OUTPUT_KEYS],
    },
    {
        validate(value) {
            if (
                !isObject(value) ||
                !exactKeys(value, OPPORTUNITY_OUTPUT_KEYS) ||
                value.contractVersion !== COGNITION_OPPORTUNITY_CONTRACT_VERSION ||
                !isOpportunityDecision(value.decision) ||
                !isStringList(value.selectedMeaningIds)
            ) {
                return {
                    success: false,
                    error: new Error("AI SDK opportunity output does not match its structured schema"),
                };
            }
            return {
                success: true,
                value: {
                    contractVersion: COGNITION_OPPORTUNITY_CONTRACT_VERSION,
                    decision: value.decision,
                    selectedMeaningIds: [...value.selectedMeaningIds],
                },
            };
        },
    },
);

const opportunityOutput = Output.object({
    schema: opportunityOutputSchema,
    name: "ember_cognition_opportunity_decision",
    description: "A bounded Ember decision about whether the current projected state warrants cognition.",
});

const MAX_AI_SDK_RETRIES = 0;

export interface AiSdkOpportunityEvaluatorOptions {
    timeoutSeconds?: number;
    signal?: AbortSignal | undefined;
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
            ...(signal === undefined ? {} : { abortSignal: signal }),
        });

        return {
            contractVersion: result.output.contractVersion,
            decision: result.output.decision,
            // Structured validation proves only representation shape. The Ember
            // opportunity boundary re-validates semantic projection membership.
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
        throw new ProviderError(
            `opportunity evaluator timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`,
        );
    }
}

function translateAiSdkOpportunityFailure(error: unknown, signal?: AbortSignal): ProviderError | ValidationError {
    if (isTimeoutFailure(error)) {
        return new ProviderError("AI SDK opportunity evaluator timed out", { outcome: "timed_out" });
    }

    if (isCancellationFailure(error, signal)) {
        return cancellationError("AI SDK opportunity evaluation cancellation requested during invocation");
    }

    if (
        NoObjectGeneratedError.isInstance(error) ||
        TypeValidationError.isInstance(error) ||
        JSONParseError.isInstance(error)
    ) {
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

function isOpportunityDecision(value: unknown): value is CognitionOpportunityDecision {
    return typeof value === "string" && OPPORTUNITY_DECISIONS.some((decision) => decision === value);
}

function isStringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
