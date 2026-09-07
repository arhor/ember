import type { LanguageModel } from "ai";

import { generateText, jsonSchema, Output } from "ai";

import type { ProviderInvoker } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { CONTRACT_VERSION, MAX_PROVIDER_TIMEOUT_SECONDS, validateProviderResult } from "./contract.ts";

interface AiSdkProviderOutput {
    contractVersion: 1;
    reply: string;
    usedMeaningIds: string[];
}

const providerOutputSchema = jsonSchema<AiSdkProviderOutput>({
    type: "object",
    additionalProperties: false,
    properties: {
        contractVersion: { type: "integer", const: CONTRACT_VERSION },
        reply: { type: "string", minLength: 1 },
        usedMeaningIds: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
        },
    },
    required: ["contractVersion", "reply", "usedMeaningIds"],
});

const providerOutput = Output.object({
    schema: providerOutputSchema,
    name: "ember_provider_result",
    description: "A bounded Ember cognition result. usedMeaningIds may contain only IDs from the supplied projection.",
});

const INSTRUCTIONS = [
    "Answer the current Ember cognition request using only the supplied projection and current input.",
    "Return a structured result matching the requested schema.",
    "List in usedMeaningIds only meaning IDs from projection.selection.meaning_ids that actually contributed to the reply.",
].join(" ");

export function createAiSdkProvider(model: LanguageModel): ProviderInvoker {
    return async (_command, _arguments, request, { timeoutSeconds, signal }) => {
        validateTimeout(timeoutSeconds);
        if (signal?.aborted) {
            throw new ProviderError("provider cancellation requested before invocation", {
                outcome: "cancellation_requested",
                termination: { reason: "explicit_cancellation", directChildExitObserved: false },
            });
        }

        try {
            const result = await generateText({
                model,
                instructions: INSTRUCTIONS,
                prompt: JSON.stringify({ projection: request.projection, input: request.input }),
                output: providerOutput,
                maxRetries: 0,
                timeout: Math.max(1, Math.ceil(timeoutSeconds * 1000)),
                abortSignal: signal,
            });
            const candidate: unknown = result.output;
            validateProviderResult(candidate, new Set(request.projection.selection.meaning_ids));
            return candidate;
        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            if (signal?.aborted) {
                throw new ProviderError("provider cancellation requested during invocation", {
                    outcome: "cancellation_requested",
                    termination: { reason: "explicit_cancellation", directChildExitObserved: false },
                    cause: error,
                });
            }
            if (isTimeoutError(error)) {
                throw new ProviderError("provider timed out", {
                    outcome: "timed_out",
                    cause: error,
                });
            }
            throw new ProviderError(`AI SDK provider failed: ${errorMessage(error)}`, { cause: error });
        }
    };
}

function validateTimeout(timeoutSeconds: number) {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
}

function isTimeoutError(error: unknown) {
    return error instanceof Error && error.name === "TimeoutError";
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
