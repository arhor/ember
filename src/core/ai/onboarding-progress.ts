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

import type { OnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import type { OnboardingProgressDecision } from "../onboarding-work.ts";

import { ONBOARDING_PROGRESS_INSTRUCTION } from "../../onboarding/progress-evaluator.ts";
import { ProviderError, ValidationError } from "../errors.ts";
import { validateOnboardingProgressDecision } from "../onboarding-work.ts";
import { MAX_AI_TIMEOUT_SECONDS } from "./contract.ts";

const onboardingProgressOutput = Output.object({
    schema: jsonSchema<OnboardingProgressDecision>({
        type: "object",
        additionalProperties: false,
        properties: {
            decision_version: { type: "integer", const: 1 },
            updates: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        topic: {
                            type: "string",
                            enum: ["forms_of_address", "agent_personality", "expectations", "optional_capabilities"],
                        },
                        action: { type: "string", enum: ["leave_open", "defer", "decline", "resolve", "resume"] },
                        basis: { type: "string" },
                    },
                    required: ["topic", "action", "basis"],
                },
            },
        },
        required: ["decision_version", "updates"],
    }),
    name: "ember_onboarding_progress",
    description: "An evidence-bounded interpretation of explicit onboarding progress in the current user input.",
});

export function createAiSdkOnboardingProgressEvaluator(
    model: LanguageModel,
    timeoutSeconds: number,
): OnboardingProgressEvaluator {
    validateTimeout(timeoutSeconds);
    return async ({ onboardingWork, input }) => {
        try {
            const result = await generateText({
                model,
                instructions: ONBOARDING_PROGRESS_INSTRUCTION,
                prompt: JSON.stringify({ onboarding_work: onboardingWork, current_user_input: input }),
                output: onboardingProgressOutput,
                maxRetries: 0,
                timeout: Math.max(1, Math.ceil(timeoutSeconds * 1000)),
            });
            validateOnboardingProgressDecision(result.output, input);
            return result.output;
        } catch (error) {
            throw translateFailure(error);
        }
    };
}

function validateTimeout(timeoutSeconds: number) {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0 || timeoutSeconds > MAX_AI_TIMEOUT_SECONDS)
        throw new ProviderError(`onboarding progress timeout must be between 0 and ${MAX_AI_TIMEOUT_SECONDS} seconds`);
}

function translateFailure(error: unknown): ProviderError | ValidationError {
    if (error instanceof ProviderError || error instanceof ValidationError) return error;
    if (isTimeoutFailure(error))
        return new ProviderError("onboarding progress evaluation timed out", { outcome: "timed_out" });
    if (error instanceof DOMException && error.code === DOMException.ABORT_ERR)
        return new ProviderError("onboarding progress evaluation cancellation requested", {
            outcome: "cancellation_requested",
            termination: { reason: "explicit_cancellation", directChildExitObserved: false },
        });
    if (
        NoObjectGeneratedError.isInstance(error) ||
        TypeValidationError.isInstance(error) ||
        JSONParseError.isInstance(error)
    )
        return new ValidationError("onboarding progress evaluator produced invalid structured output");
    if (APICallError.isInstance(error))
        return new ProviderError(
            error.statusCode === undefined
                ? "onboarding progress API call failed"
                : `onboarding progress API call failed (HTTP ${error.statusCode})`,
        );
    if (RetryError.isInstance(error))
        return new ProviderError("onboarding progress evaluator exhausted its retry policy");
    if (AISDKError.isInstance(error)) return new ProviderError("onboarding progress evaluator failed");
    return new ProviderError(
        `onboarding progress evaluator failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
    );
}

function isTimeoutFailure(error: unknown): boolean {
    if (error instanceof DOMException && error.code === DOMException.TIMEOUT_ERR) return true;
    if (RetryError.isInstance(error) && error.lastError !== error) return isTimeoutFailure(error.lastError);
    if (AISDKError.isInstance(error) && error.cause !== error) return isTimeoutFailure(error.cause);
    return false;
}
