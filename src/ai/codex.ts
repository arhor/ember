import type {
    LanguageModelV4,
    LanguageModelV4CallOptions,
    LanguageModelV4GenerateResult,
    LanguageModelV4StreamPart,
    LanguageModelV4Usage,
} from "@ai-sdk/provider";

import type { AiExecutionRequest } from "./contract.ts";
import type { CodexProviderConfig } from "./providers/codex.ts";

import { ProviderError } from "../core/errors.ts";
import { isObject } from "../core/util.ts";
import { relayCallerCancellation } from "./abort.ts";
import { validateAiExecutionResult } from "./contract.ts";
import { buildCodexPrompt, invokeCodexStructured } from "./providers/codex.ts";

const EMPTY_USAGE: LanguageModelV4Usage = {
    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};
const FINISH_REASON = { unified: "stop" as const, raw: "stop" };

export interface CodexLanguageModelConfig extends CodexProviderConfig {
    timeoutSeconds: number;
    observeExternalThreadId?: (externalThreadId: string) => void;
}

/** Codex subscription-runtime bridge beneath the shared AI SDK executor. */
export function createCodexLanguageModel({
    command = "codex",
    arguments_: args = [],
    timeoutSeconds,
    observeExternalThreadId,
    ...adapterOptions
}: CodexLanguageModelConfig): LanguageModelV4 {
    return {
        specificationVersion: "v4",
        provider: "codex",
        modelId: command,
        supportedUrls: {},
        async doGenerate(options) {
            const invocation = await invoke(options);
            return generateResult(invocation);
        },
        async doStream(options) {
            const invocation = await invoke(options);
            const text = JSON.stringify(invocation.result);
            return {
                stream: new ReadableStream<LanguageModelV4StreamPart>({
                    start(controller) {
                        controller.enqueue({ type: "stream-start", warnings: [] });
                        controller.enqueue({ type: "text-start", id: "codex-result" });
                        controller.enqueue({ type: "text-delta", id: "codex-result", delta: text });
                        controller.enqueue({ type: "text-end", id: "codex-result" });
                        controller.enqueue({
                            type: "finish",
                            finishReason: FINISH_REASON,
                            usage: EMPTY_USAGE,
                            ...(invocation.externalThreadId === undefined
                                ? {}
                                : { providerMetadata: codexMetadata(invocation.externalThreadId) }),
                        });
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
            const parsed = await invokeCodexStructured(
                command,
                args,
                {
                    prompt: request === null ? structuredPrompt(options) : buildCodexPrompt(request, true),
                    schema: options.responseFormat!.type === "json" ? options.responseFormat!.schema : undefined,
                },
                {
                    ...adapterOptions,
                    timeoutSeconds,
                    ...(invocationSignal.signal === undefined ? {} : { signal: invocationSignal.signal }),
                },
            );
            if (parsed.externalThreadId !== undefined) observeExternalThreadId?.(parsed.externalThreadId);
            if (request !== null)
                validateAiExecutionResult(parsed.result, new Set(request.projection.selection.meaning_ids));
            return parsed.externalThreadId === undefined
                ? { result: parsed.result }
                : { result: parsed.result, externalThreadId: parsed.externalThreadId };
        } finally {
            invocationSignal.dispose();
        }
    }
}

function generateResult(invocation: { result: unknown; externalThreadId?: string }): LanguageModelV4GenerateResult {
    return {
        content: [{ type: "text", text: JSON.stringify(invocation.result) }],
        finishReason: FINISH_REASON,
        usage: EMPTY_USAGE,
        warnings: [],
        ...(invocation.externalThreadId === undefined
            ? {}
            : { providerMetadata: codexMetadata(invocation.externalThreadId) }),
    };
}

function codexMetadata(externalThreadId: string) {
    return { codex: { externalThreadId } };
}

function executionRequest(options: LanguageModelV4CallOptions): AiExecutionRequest | null {
    if (options.prompt.length !== 2) throw new ProviderError("Codex AI bridge requires one instruction and one input");
    const [instruction, input] = options.prompt;
    if (instruction?.role !== "system" || typeof instruction.content !== "string" || !instruction.content.trim())
        throw new ProviderError("Codex AI bridge requires text instructions");
    if (input?.role !== "user" || input.content.length !== 1 || input.content[0]?.type !== "text")
        throw new ProviderError("Codex AI bridge supports only one text input");
    let candidate: unknown;
    try {
        candidate = JSON.parse(input.content[0].text);
    } catch {
        return null;
    }
    if (
        !isObject(candidate) ||
        candidate.contractVersion !== 1 ||
        typeof candidate.cognitionId !== "string" ||
        !isObject(candidate.projection) ||
        !isObject(candidate.input) ||
        typeof candidate.input.text !== "string"
    ) {
        return null;
    }
    return candidate as unknown as AiExecutionRequest;
}

function structuredPrompt(options: LanguageModelV4CallOptions) {
    const [instruction, input] = options.prompt;
    if (instruction?.role !== "system" || input?.role !== "user" || input.content[0]?.type !== "text")
        throw new ProviderError("Codex AI bridge supports only text structured-control prompts");
    return [
        instruction.content,
        "Return only one JSON value matching the supplied output schema.",
        input.content[0].text,
    ].join("\n");
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
