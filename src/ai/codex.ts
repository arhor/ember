import type {
    LanguageModelV4,
    LanguageModelV4CallOptions,
    LanguageModelV4GenerateResult,
    LanguageModelV4StreamPart,
    LanguageModelV4Usage,
} from "@ai-sdk/provider";

import type { CodexProviderConfig } from "../providers/codex.ts";
import type { AiExecutionRequest } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { invokeCodexProvider } from "../providers/codex.ts";
import { isObject } from "../util.ts";
import { validateAiExecutionResult } from "./contract.ts";

const EMPTY_USAGE: LanguageModelV4Usage = {
    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};
const FINISH_REASON = { unified: "stop" as const, raw: "stop" };

export interface CodexLanguageModelConfig extends CodexProviderConfig {
    timeoutSeconds: number;
}

/** Codex subscription-runtime bridge beneath the shared AI SDK executor. */
export function createCodexLanguageModel({
    command = "codex",
    arguments_: args = [],
    timeoutSeconds,
    ...adapterOptions
}: CodexLanguageModelConfig): LanguageModelV4 {
    return {
        specificationVersion: "v4",
        provider: "codex",
        modelId: command,
        supportedUrls: {},
        async doGenerate(options) {
            const result = await invoke(options);
            return generateResult(result);
        },
        async doStream(options) {
            const result = await invoke(options);
            const text = JSON.stringify(result);
            return {
                stream: new ReadableStream<LanguageModelV4StreamPart>({
                    start(controller) {
                        controller.enqueue({ type: "stream-start", warnings: [] });
                        controller.enqueue({ type: "text-start", id: "codex-result" });
                        controller.enqueue({ type: "text-delta", id: "codex-result", delta: text });
                        controller.enqueue({ type: "text-end", id: "codex-result" });
                        controller.enqueue({ type: "finish", finishReason: FINISH_REASON, usage: EMPTY_USAGE });
                        controller.close();
                    },
                }),
            };
        },
    };

    async function invoke(options: LanguageModelV4CallOptions) {
        validateCallOptions(options);
        const request = executionRequest(options);
        const invocationSignal = relayCallerCancellation(options.abortSignal);
        try {
            const result = await invokeCodexProvider(command, args, request, {
                ...adapterOptions,
                timeoutSeconds,
                ...(invocationSignal.signal === undefined ? {} : { signal: invocationSignal.signal }),
            });
            validateAiExecutionResult(result, new Set(request.projection.selection.meaning_ids));
            return result;
        } finally {
            invocationSignal.dispose();
        }
    }
}

function relayCallerCancellation(source: AbortSignal | undefined): {
    signal: AbortSignal | undefined;
    dispose(): void;
} {
    if (source === undefined) return { signal: undefined, dispose() {} };
    const controller = new AbortController();
    const relay = () => {
        if (!isSdkTimeout(source.reason)) controller.abort(source.reason);
    };
    if (source.aborted) relay();
    else source.addEventListener("abort", relay, { once: true });
    return {
        signal: controller.signal,
        dispose: () => source.removeEventListener("abort", relay),
    };
}

function isSdkTimeout(reason: unknown) {
    return (reason instanceof Error || reason instanceof DOMException) && reason.name === "TimeoutError";
}

function generateResult(result: Awaited<ReturnType<typeof invokeCodexProvider>>): LanguageModelV4GenerateResult {
    return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        finishReason: FINISH_REASON,
        usage: EMPTY_USAGE,
        warnings: [],
    };
}

function executionRequest(options: LanguageModelV4CallOptions): AiExecutionRequest {
    if (options.prompt.length !== 2) throw new ProviderError("Codex AI bridge requires one instruction and one input");
    const [instruction, input] = options.prompt;
    if (instruction?.role !== "system" || typeof instruction.content !== "string" || !instruction.content.trim())
        throw new ProviderError("Codex AI bridge requires text instructions");
    if (input?.role !== "user" || input.content.length !== 1 || input.content[0]?.type !== "text")
        throw new ProviderError("Codex AI bridge supports only one text input");
    let candidate: unknown;
    try {
        candidate = JSON.parse(input.content[0].text);
    } catch (error) {
        throw new ProviderError("Codex AI bridge input must be valid JSON", { cause: error });
    }
    if (
        !isObject(candidate) ||
        candidate.contractVersion !== 1 ||
        typeof candidate.cognitionId !== "string" ||
        !isObject(candidate.projection) ||
        !isObject(candidate.input) ||
        typeof candidate.input.text !== "string"
    ) {
        throw new ProviderError("Codex AI bridge input does not match the Ember execution contract");
    }
    return candidate as unknown as AiExecutionRequest;
}

function validateCallOptions(options: LanguageModelV4CallOptions) {
    if (options.responseFormat?.type !== "json" || options.responseFormat.schema === undefined)
        throw new ProviderError("Codex AI bridge requires a JSON response schema");
    if (options.tools !== undefined && options.tools.length > 0)
        throw new ProviderError("Codex AI bridge does not support tools");
    const unsupported = [
        options.maxOutputTokens,
        options.temperature,
        options.stopSequences,
        options.topP,
        options.topK,
        options.presencePenalty,
        options.frequencyPenalty,
        options.seed,
        options.reasoning,
        options.providerOptions,
    ];
    if (unsupported.some((value) => value !== undefined))
        throw new ProviderError("Codex AI bridge received unsupported model settings");
}
