import type {
    CognitionOpportunityEvaluator,
    CognitionOpportunityRequest,
} from "@ember/application/agency/cognition-opportunity.ts";
import type { LanguageModel } from "ai";

import { createCodexLanguageModel } from "@ember/ai-sdk/codex.ts";
import { AI_SDK_OPPORTUNITY_INSTRUCTION, evaluateCognitionOpportunityWithAiSdk } from "@ember/ai-sdk/opportunity.ts";

export const CODEX_OPPORTUNITY_INSTRUCTION = AI_SDK_OPPORTUNITY_INSTRUCTION;

export interface CodexOpportunityEvaluatorOptions {
    command?: string;
    arguments_?: string[];
    timeoutSeconds?: number;
    signal?: AbortSignal | undefined;
    model?: LanguageModel | undefined;
    observeExternalThreadId?: (externalThreadId: string) => void;
}

export function createCodexOpportunityEvaluator(
    options: CodexOpportunityEvaluatorOptions = {},
): CognitionOpportunityEvaluator {
    return (request) => evaluateCognitionOpportunityWithCodex(request, options);
}

export function evaluateCognitionOpportunityWithCodex(
    request: CognitionOpportunityRequest,
    {
        command = "codex",
        arguments_: args = [],
        timeoutSeconds = 60,
        signal,
        observeExternalThreadId,
        model = createCodexLanguageModel({
            command,
            arguments_: args,
            timeoutSeconds,
            ...(observeExternalThreadId === undefined ? {} : { observeExternalThreadId }),
        }),
    }: CodexOpportunityEvaluatorOptions = {},
) {
    return evaluateCognitionOpportunityWithAiSdk(request, model, { timeoutSeconds, signal });
}
