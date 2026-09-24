import type {
    LanguageModelV4,
    LanguageModelV4CallOptions,
    LanguageModelV4GenerateResult,
    LanguageModelV4StreamPart,
    LanguageModelV4Usage,
} from "@ai-sdk/provider";

import type { CursorProviderConfig } from "./providers/cursor.ts";
import type { AiExecutionRequest } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { buildCursorPrompt, invokeCursorStructured } from "./providers/cursor.ts";
import { isObject } from "../util.ts";
import { relayCallerCancellation } from "./abort.ts";
import { validateAiExecutionResult } from "./contract.ts";

const EMPTY_USAGE: LanguageModelV4Usage = {
    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};
const FINISH_REASON = { unified: "stop" as const, raw: "stop" };

export interface CursorLanguageModelConfig extends CursorProviderConfig {
    timeoutSeconds: number;
}

/** Cursor subscription-runtime bridge beneath the shared AI SDK executor. */
export function createCursorLanguageModel({
    command = "cursor-agent",
    arguments_: args = [],
    timeoutSeconds,
    ...adapterOptions
}: CursorLanguageModelConfig): LanguageModelV4 {
    return {
        specificationVersion: "v4",
        provider: "cursor",
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
                        controller.enqueue({ type: "text-start", id: "cursor-result" });
                        controller.enqueue({ type: "text-delta", id: "cursor-result", delta: text });
                        controller.enqueue({ type: "text-end", id: "cursor-result" });
                        controller.enqueue({
                            type: "finish",
                            finishReason: FINISH_REASON,
                            usage: EMPTY_USAGE,
                            providerMetadata: cursorMetadata(invocation.externalThreadId),
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
            const parsed = await invokeCursorStructured(
                command,
                args,
                request === null ? structuredPrompt(options) : buildCursorPrompt(request, true),
                {
                    ...adapterOptions,
                    timeoutSeconds,
                    ...(invocationSignal.signal === undefined ? {} : { signal: invocationSignal.signal }),
                },
            );
            if (request !== null)
                validateAiExecutionResult(parsed.result, new Set(request.projection.selection.meaning_ids));
            return { result: parsed.result, externalThreadId: parsed.externalSessionId };
        } finally {
            invocationSignal.dispose();
        }
    }
}

function generateResult(invocation: { result: unknown; externalThreadId: string }): LanguageModelV4GenerateResult {
    return {
        content: [{ type: "text", text: JSON.stringify(invocation.result) }],
        finishReason: FINISH_REASON,
        usage: EMPTY_USAGE,
        warnings: [],
        providerMetadata: cursorMetadata(invocation.externalThreadId),
    };
}

function cursorMetadata(externalThreadId: string) {
    return { cursor: { externalThreadId } };
}

function executionRequest(options: LanguageModelV4CallOptions): AiExecutionRequest | null {
    if (options.prompt.length !== 2) throw new ProviderError("Cursor AI bridge requires one instruction and one input");
    const [instruction, input] = options.prompt;
    if (instruction?.role !== "system" || typeof instruction.content !== "string" || !instruction.content.trim())
        throw new ProviderError("Cursor AI bridge requires text instructions");
    if (input?.role !== "user" || input.content.length !== 1 || input.content[0]?.type !== "text")
        throw new ProviderError("Cursor AI bridge supports only one text input");
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
        throw new ProviderError("Cursor AI bridge supports only text structured-control prompts");
    const schema = options.responseFormat?.type === "json" ? options.responseFormat.schema : undefined;
    return [
        instruction.content,
        "Return only one JSON value matching this output schema:",
        JSON.stringify(schema),
        input.content[0].text,
    ].join("\n");
}

function validateCallOptions(options: LanguageModelV4CallOptions) {
    if (options.responseFormat?.type !== "json" || options.responseFormat.schema === undefined)
        throw new ProviderError("Cursor AI bridge requires a JSON response schema");
    if (options.tools !== undefined && options.tools.length > 0)
        throw new ProviderError("Cursor AI bridge does not support tools");
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
        throw new ProviderError("Cursor AI bridge received unsupported model settings");
}
