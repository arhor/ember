import type {
    LanguageModelV4,
    LanguageModelV4CallOptions,
    LanguageModelV4GenerateResult,
    LanguageModelV4StreamPart,
    LanguageModelV4Usage,
} from "@ai-sdk/provider";

import type { ProcessProviderConfig } from "../providers/process.ts";
import type { AiExecutionRequest } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { createProcessProvider } from "../providers/process.ts";
import { isObject } from "../util.ts";
import { relayCallerCancellation } from "./abort.ts";

const EMPTY_USAGE: LanguageModelV4Usage = {
    inputTokens: { total: undefined, noCache: undefined, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: undefined, text: undefined, reasoning: undefined },
};
const FINISH_REASON = { unified: "stop" as const, raw: "stop" };

export interface ProcessLanguageModelConfig extends ProcessProviderConfig {
    timeoutSeconds: number;
}

/** Compatibility model bridge for Ember's explicit JSON process protocol. */
export function createProcessLanguageModel({ timeoutSeconds, ...config }: ProcessLanguageModelConfig): LanguageModelV4 {
    const provider = createProcessProvider(config);
    return {
        specificationVersion: "v4",
        provider: "ember-process",
        modelId: config.command,
        supportedUrls: {},
        async doGenerate(options) {
            return generateResult(await invoke(options));
        },
        async doStream(options) {
            const text = JSON.stringify(await invoke(options));
            return {
                stream: new ReadableStream<LanguageModelV4StreamPart>({
                    start(controller) {
                        controller.enqueue({ type: "stream-start", warnings: [] });
                        controller.enqueue({ type: "text-start", id: "process-result" });
                        controller.enqueue({ type: "text-delta", id: "process-result", delta: text });
                        controller.enqueue({ type: "text-end", id: "process-result" });
                        controller.enqueue({ type: "finish", finishReason: FINISH_REASON, usage: EMPTY_USAGE });
                        controller.close();
                    },
                }),
            };
        },
    };

    async function invoke(options: LanguageModelV4CallOptions) {
        if (options.tools !== undefined && options.tools.length > 0)
            throw new ProviderError("process AI bridge does not support tools");
        const request = executionRequest(options);
        const invocationSignal = relayCallerCancellation(options.abortSignal);
        try {
            return await provider(request, {
                timeoutSeconds,
                ...(invocationSignal.signal === undefined ? {} : { signal: invocationSignal.signal }),
            });
        } finally {
            invocationSignal.dispose();
        }
    }
}

function generateResult(result: unknown): LanguageModelV4GenerateResult {
    return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        finishReason: FINISH_REASON,
        usage: EMPTY_USAGE,
        warnings: [],
    };
}

function executionRequest(options: LanguageModelV4CallOptions): AiExecutionRequest {
    const input = options.prompt[1];
    if (
        options.prompt.length !== 2 ||
        options.prompt[0]?.role !== "system" ||
        input?.role !== "user" ||
        input.content.length !== 1 ||
        input.content[0]?.type !== "text"
    )
        throw new ProviderError("process AI bridge supports only ordinary text cognition");
    let candidate: unknown;
    try {
        candidate = JSON.parse(input.content[0].text);
    } catch (error) {
        throw new ProviderError("process AI bridge input must be valid JSON", { cause: error });
    }
    if (
        !isObject(candidate) ||
        candidate.contractVersion !== 1 ||
        typeof candidate.cognitionId !== "string" ||
        !isObject(candidate.projection) ||
        !isObject(candidate.input) ||
        typeof candidate.input.text !== "string"
    )
        throw new ProviderError("process AI bridge input does not match the Ember execution contract");
    return candidate as unknown as AiExecutionRequest;
}
