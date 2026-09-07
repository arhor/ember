import type { Projection } from "../core/projection.ts";
import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";
import type {
    CognitionOpportunityEvaluation,
    CognitionOpportunityEvaluator,
    CognitionOpportunityRequest,
} from "./cognition-opportunity.ts";

import { ValidationError } from "../core/errors.ts";
import { newId } from "../core/model.ts";
import { createCodexProvider } from "../providers/codex.ts";
import { COGNITION_OPPORTUNITY_CONTRACT_VERSION } from "./cognition-opportunity.ts";

export const CODEX_OPPORTUNITY_INSTRUCTION = [
    "Evaluate only whether the projected current Ember state contains anything worth discretionary cognition now.",
    "The opportunity itself supplies no topic or motive; select only from projected Ember-owned meaning.",
    "Do not use tools, files, prior threads, or outside context.",
    "Reply with exactly one token: cognition, defer, or no_cognition.",
    "For cognition or defer, set usedMeaningIds to at least one projected meaning that materially grounds the decision.",
    "For no_cognition, set usedMeaningIds to an empty list.",
].join(" ");

export interface CodexOpportunityEvaluatorOptions {
    command?: string;
    arguments_?: string[];
    timeoutSeconds?: number;
    signal?: AbortSignal;
    provider?: ProviderInvoker;
}

export function createCodexOpportunityEvaluator({
    command = "codex",
    arguments_: args = [],
    timeoutSeconds = 60,
    signal,
    provider,
}: CodexOpportunityEvaluatorOptions = {}): CognitionOpportunityEvaluator {
    const configuredProvider = provider ?? createCodexProvider({ command, arguments_: args });
    return (request) =>
        evaluateCognitionOpportunityWithCodex(request, {
            timeoutSeconds,
            signal,
            provider: configuredProvider,
        });
}

export async function evaluateCognitionOpportunityWithCodex(
    request: CognitionOpportunityRequest,
    {
        command = "codex",
        arguments_: args = [],
        timeoutSeconds = 60,
        signal,
        provider,
    }: CodexOpportunityEvaluatorOptions = {},
): Promise<CognitionOpportunityEvaluation> {
    const projection: Projection = {
        ...request.projection,
        purpose: "ordinary",
        current_input: CODEX_OPPORTUNITY_INSTRUCTION,
    };
    const providerRequest: ProviderRequest = {
        contractVersion: 1,
        cognitionId: newId("cognition"),
        projection,
        input: { text: CODEX_OPPORTUNITY_INSTRUCTION },
    };
    const configuredProvider = provider ?? createCodexProvider({ command, arguments_: args });
    const result = await configuredProvider(providerRequest, { timeoutSeconds, signal });
    const decision = result.reply.trim();
    if (decision !== "cognition" && decision !== "defer" && decision !== "no_cognition") {
        throw new ValidationError("Codex opportunity evaluator reply must be cognition, defer, or no_cognition");
    }
    return {
        contractVersion: COGNITION_OPPORTUNITY_CONTRACT_VERSION,
        decision,
        selectedMeaningIds: [...result.usedMeaningIds],
    };
}
