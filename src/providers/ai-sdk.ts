import type { CallWarning, LanguageModel, LanguageModelUsage } from "ai";

import {
    AISDKError,
    APICallError,
    generateText,
    InvalidResponseDataError,
    InvalidToolInputError,
    isStepCount,
    JSONParseError,
    jsonSchema,
    MissingToolResultsError,
    NoContentGeneratedError,
    NoObjectGeneratedError,
    NoOutputGeneratedError,
    NoSuchToolError,
    Output,
    RetryError,
    tool,
    ToolCallRepairError,
    ToolChoiceViolationError,
    TypeValidationError,
} from "ai";

import type { CapabilityBinding, CapabilityExecutionLedger } from "../capabilities/execution.ts";
import type { CognitionId } from "../core/model.ts";
import type { ProviderInvoker, ProviderRequest } from "./contract.ts";

import { createCapabilityExecutionFirewall } from "../capabilities/execution.ts";
import { ProviderError } from "../core/errors.ts";
import { CONTRACT_VERSION, MAX_PROVIDER_TIMEOUT_SECONDS, validateProviderResult } from "./contract.ts";

interface AiSdkProviderOutput {
    contractVersion: 1;
    reply: string;
    usedMeaningIds: string[];
}

export type InferenceFinishReason = "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other";

export interface InferenceUsageEvidence {
    inputTokens?: number;
    inputNoCacheTokens?: number;
    inputCacheReadTokens?: number;
    inputCacheWriteTokens?: number;
    outputTokens?: number;
    outputTextTokens?: number;
    outputReasoningTokens?: number;
    totalTokens?: number;
}

export type InferenceWarningEvidence =
    | { type: "unsupported" | "compatibility"; feature: string }
    | { type: "deprecated"; setting: string }
    | { type: "other" };

export type InferenceFailureCategory =
    | "cancellation"
    | "timeout"
    | "provider_api"
    | "retry_exhausted"
    | "invalid_output"
    | "invalid_tool_call"
    | "unknown";

export type InferenceEvidence =
    | {
          kind: "inference_started";
          cognitionId: CognitionId;
          provider: string;
          modelId: string;
          retryLimit: number;
      }
    | {
          kind: "model_step_completed";
          cognitionId: CognitionId;
          stepNumber: number;
          provider: string;
          modelId: string;
          responseModelId?: string;
          finishReason: InferenceFinishReason;
          rawFinishReason?: string;
          usage: InferenceUsageEvidence;
          warnings: InferenceWarningEvidence[];
      }
    | {
          kind: "tool_dispatch_started";
          cognitionId: CognitionId;
          capability: string;
      }
    | {
          kind: "tool_dispatch_completed";
          cognitionId: CognitionId;
          capability: string;
          sdkOutcome: "result" | "error";
          durationMs: number;
      }
    | {
          kind: "inference_completed";
          cognitionId: CognitionId;
          stepCount: number;
          provider: string;
          modelId: string;
          finishReason: InferenceFinishReason;
          rawFinishReason?: string;
          usage: InferenceUsageEvidence;
          warnings: InferenceWarningEvidence[];
      }
    | {
          kind: "inference_failed";
          cognitionId: CognitionId;
          category: InferenceFailureCategory;
          phase: "before_invocation" | "during_invocation";
          statusCode?: number;
          retryReason?: "maxRetriesExceeded" | "errorNotRetryable" | "abort";
      };

export interface InferenceEvidenceSink {
    record(evidence: InferenceEvidence): void | PromiseLike<void>;
}

export interface AiSdkProviderOptions {
    selectCapabilities?: (request: ProviderRequest) => readonly CapabilityBinding[];
    capabilityLedger?: CapabilityExecutionLedger;
    inferenceEvidence?: InferenceEvidenceSink;
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
const MAX_AI_SDK_RETRIES = 0;

export function createAiSdkProvider(model: LanguageModel, options: AiSdkProviderOptions = {}): ProviderInvoker {
    return async (request, { timeoutSeconds, signal }) => {
        validateTimeout(timeoutSeconds);
        if (signal?.aborted) {
            await recordInferenceEvidence(options.inferenceEvidence, {
                kind: "inference_failed",
                cognitionId: request.cognitionId,
                category: "cancellation",
                phase: "before_invocation",
            });
            throw cancellationError("provider cancellation requested before invocation");
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
                        execute: (input, { abortSignal }) =>
                            firewall.execute(capability.name, input, { signal: abortSignal }),
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
                maxRetries: MAX_AI_SDK_RETRIES,
                timeout: Math.max(1, Math.ceil(timeoutSeconds * 1000)),
                abortSignal: signal,
                onStart: (event) =>
                    recordInferenceEvidence(options.inferenceEvidence, {
                        kind: "inference_started",
                        cognitionId: request.cognitionId,
                        provider: event.provider,
                        modelId: event.modelId,
                        retryLimit: event.maxRetries,
                    }),
                onStepEnd: (event) =>
                    recordInferenceEvidence(options.inferenceEvidence, {
                        kind: "model_step_completed",
                        cognitionId: request.cognitionId,
                        stepNumber: event.stepNumber,
                        provider: event.model.provider,
                        modelId: event.model.modelId,
                        ...(event.response.modelId ? { responseModelId: event.response.modelId } : {}),
                        finishReason: event.finishReason,
                        ...(event.rawFinishReason ? { rawFinishReason: event.rawFinishReason } : {}),
                        usage: usageEvidence(event.usage),
                        warnings: warningEvidence(event.warnings),
                    }),
                onToolExecutionStart: (event) =>
                    recordInferenceEvidence(options.inferenceEvidence, {
                        kind: "tool_dispatch_started",
                        cognitionId: request.cognitionId,
                        capability: event.toolCall.toolName,
                    }),
                onToolExecutionEnd: (event) =>
                    recordInferenceEvidence(options.inferenceEvidence, {
                        kind: "tool_dispatch_completed",
                        cognitionId: request.cognitionId,
                        capability: event.toolCall.toolName,
                        sdkOutcome: event.toolOutput.type === "tool-error" ? "error" : "result",
                        durationMs: Math.max(0, Math.round(event.toolExecutionMs)),
                    }),
                onEnd: (event) =>
                    recordInferenceEvidence(options.inferenceEvidence, {
                        kind: "inference_completed",
                        cognitionId: request.cognitionId,
                        stepCount: event.steps.length,
                        provider: event.model.provider,
                        modelId: event.model.modelId,
                        finishReason: event.finishReason,
                        ...(event.rawFinishReason ? { rawFinishReason: event.rawFinishReason } : {}),
                        usage: usageEvidence(event.usage),
                        warnings: warningEvidence(event.warnings),
                    }),
            });
            const candidate: unknown = result.output;
            validateProviderResult(candidate, new Set(request.projection.selection.meaning_ids));
            return candidate;
        } catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            const translated = translateAiSdkFailure(error, signal);
            await recordInferenceEvidence(options.inferenceEvidence, {
                kind: "inference_failed",
                cognitionId: request.cognitionId,
                category: translated.category,
                phase: "during_invocation",
                ...(translated.statusCode === undefined ? {} : { statusCode: translated.statusCode }),
                ...(translated.retryReason === undefined ? {} : { retryReason: translated.retryReason }),
            });
            throw translated.error;
        }
    };
}

function validateTimeout(timeoutSeconds: number) {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
}

function translateAiSdkFailure(
    error: unknown,
    signal?: AbortSignal,
): {
    error: ProviderError;
    category: InferenceFailureCategory;
    statusCode?: number;
    retryReason?: "maxRetriesExceeded" | "errorNotRetryable" | "abort";
} {
    if (isTimeoutFailure(error)) {
        return {
            error: new ProviderError("provider timed out", { outcome: "timed_out" }),
            category: "timeout",
        };
    }

    if (isCancellationFailure(error, signal)) {
        return {
            error: cancellationError("provider cancellation requested during invocation"),
            category: "cancellation",
        };
    }

    if (APICallError.isInstance(error)) {
        const status = error.statusCode;
        return {
            error: new ProviderError(
                status === undefined
                    ? "AI SDK provider API call failed"
                    : `AI SDK provider API call failed (HTTP ${status})`,
            ),
            category: "provider_api",
            ...(status === undefined ? {} : { statusCode: status }),
        };
    }

    if (RetryError.isInstance(error)) {
        const status = APICallError.isInstance(error.lastError) ? error.lastError.statusCode : undefined;
        return {
            error: new ProviderError("AI SDK provider request exhausted its retry policy"),
            category: "retry_exhausted",
            retryReason: error.reason,
            ...(status === undefined ? {} : { statusCode: status }),
        };
    }

    if (
        NoOutputGeneratedError.isInstance(error) ||
        NoObjectGeneratedError.isInstance(error) ||
        NoContentGeneratedError.isInstance(error) ||
        TypeValidationError.isInstance(error) ||
        JSONParseError.isInstance(error) ||
        InvalidResponseDataError.isInstance(error)
    ) {
        return {
            error: new ProviderError("AI SDK provider produced invalid structured output"),
            category: "invalid_output",
        };
    }

    if (
        InvalidToolInputError.isInstance(error) ||
        NoSuchToolError.isInstance(error) ||
        ToolCallRepairError.isInstance(error) ||
        ToolChoiceViolationError.isInstance(error) ||
        MissingToolResultsError.isInstance(error)
    ) {
        return {
            error: new ProviderError("AI SDK rejected an invalid tool call"),
            category: "invalid_tool_call",
        };
    }

    if (AISDKError.isInstance(error)) {
        return {
            error: new ProviderError("AI SDK provider failed"),
            category: "unknown",
        };
    }

    return {
        error: new ProviderError(`AI SDK provider failed: ${errorMessage(error)}`, {
            cause: error,
        }),
        category: "unknown",
    };
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

function usageEvidence(usage: LanguageModelUsage): InferenceUsageEvidence {
    return {
        ...(usage.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
        ...(usage.inputTokenDetails.noCacheTokens === undefined
            ? {}
            : { inputNoCacheTokens: usage.inputTokenDetails.noCacheTokens }),
        ...(usage.inputTokenDetails.cacheReadTokens === undefined
            ? {}
            : { inputCacheReadTokens: usage.inputTokenDetails.cacheReadTokens }),
        ...(usage.inputTokenDetails.cacheWriteTokens === undefined
            ? {}
            : { inputCacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens }),
        ...(usage.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens }),
        ...(usage.outputTokenDetails.textTokens === undefined
            ? {}
            : { outputTextTokens: usage.outputTokenDetails.textTokens }),
        ...(usage.outputTokenDetails.reasoningTokens === undefined
            ? {}
            : { outputReasoningTokens: usage.outputTokenDetails.reasoningTokens }),
        ...(usage.totalTokens === undefined ? {} : { totalTokens: usage.totalTokens }),
    };
}

function warningEvidence(warnings: readonly CallWarning[] | undefined): InferenceWarningEvidence[] {
    return (warnings ?? []).map((warning) => {
        switch (warning.type) {
            case "unsupported":
            case "compatibility":
                return { type: warning.type, feature: warning.feature };
            case "deprecated":
                return { type: warning.type, setting: warning.setting };
            case "other":
                return { type: warning.type };
        }
    });
}

async function recordInferenceEvidence(sink: InferenceEvidenceSink | undefined, evidence: InferenceEvidence) {
    try {
        await sink?.record(evidence);
    } catch {
        // Diagnostics must not change cognition semantics or provider outcomes.
    }
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
