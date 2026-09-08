import type { LanguageModel } from "ai";
import type { CapabilityBinding, CapabilityExecutionLedger } from "../capabilities/execution.ts";
import type { ProviderInvoker, ProviderRequest } from "./contract.ts";

import { generateText, isStepCount, jsonSchema, Output, tool } from "ai";

import { createCapabilityExecutionFirewall } from "../capabilities/execution.ts";
import { ProviderError } from "../core/errors.ts";
import { CONTRACT_VERSION, MAX_PROVIDER_TIMEOUT_SECONDS, validateProviderResult } from "./contract.ts";

interface AiSdkProviderOutput {
    contractVersion: 1;
    reply: string;
    usedMeaningIds: string[];
}

export interface AiSdkProviderOptions {
    selectCapabilities?: (request: ProviderRequest) => readonly CapabilityBinding[];
    capabilityLedger?: CapabilityExecutionLedger;
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
    "Answer the current Ember cognition request using only the supplied projection, current input, and explicitly supplied capabilities.",
    "Capability results are bounded operational evidence, not canonical Ember meaning or proof of broader authority.",
    "A denied, rejected, failed, blocked, or uncertain capability result must be interpreted as such rather than treated as success.",
    "Return a structured result matching the requested schema.",
    "List in usedMeaningIds only meaning IDs from projection.selection.meaning_ids that actually contributed to the reply.",
].join(" ");

const MAX_TOOL_LOOP_STEPS = 4;

export function createAiSdkProvider(model: LanguageModel, options: AiSdkProviderOptions = {}): ProviderInvoker {
    return async (request, { timeoutSeconds, signal }) => {
        validateTimeout(timeoutSeconds);
        if (signal?.aborted) {
            throw new ProviderError("provider cancellation requested before invocation", {
                outcome: "cancellation_requested",
                termination: { reason: "explicit_cancellation", directChildExitObserved: false },
            });
        }

        try {
            const capabilities = options.selectCapabilities?.(request) ?? [];
            const firewall = createCapabilityExecutionFirewall(
                capabilities,
                {
                    cognitionId: request.cognitionId,
                    principal: request.projection.principal,
                    scope: request.projection.activeScope,
                    surface: request.projection.surface,
                    validatedRevision: request.projection.validatedRevision,
                },
                options.capabilityLedger,
            );
            const tools = Object.fromEntries(
                capabilities.map((capability) => [
                    capability.name,
                    tool({
                        description: capability.description,
                        inputSchema: jsonSchema(capability.inputSchema as Parameters<typeof jsonSchema>[0]),
                        execute: (input, { abortSignal }) => firewall.execute(capability.name, input, { signal: abortSignal }),
                    }),
                ]),
            );

            const result = await generateText({
                model,
                instructions: INSTRUCTIONS,
                prompt: JSON.stringify({ projection: request.projection, input: request.input }),
                output: providerOutput,
                tools,
                stopWhen: isStepCount(MAX_TOOL_LOOP_STEPS),
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
            if (signal?.aborted && error === signal.reason) {
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
            if (signal?.aborted) {
                throw new ProviderError("provider cancellation requested during invocation", {
                    outcome: "cancellation_requested",
                    termination: { reason: "explicit_cancellation", directChildExitObserved: false },
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
