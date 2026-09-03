import { ValidationError } from "../core/errors.ts";
import { newId } from "../core/model.ts";
import type { Projection } from "../core/projection.ts";
import { invokeCodexProvider } from "../providers/codex.ts";
import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";
import {
  COGNITION_OPPORTUNITY_CONTRACT_VERSION,
  type CognitionOpportunityEvaluation,
  type CognitionOpportunityEvaluator,
  type CognitionOpportunityRequest,
} from "./cognition-opportunity.ts";

export const CODEX_OPPORTUNITY_INSTRUCTION = [
  "Evaluate only whether the projected current Ember state contains anything worth discretionary cognition now.",
  "The opportunity itself supplies no topic or motive; select only from projected Ember-owned meaning.",
  "Do not use tools, files, prior threads, or outside context.",
  "Reply with exactly one token: cognition, defer, or no_cognition.",
  "For cognition or defer, set used_meaning_ids to at least one projected meaning that materially grounds the decision.",
  "For no_cognition, set used_meaning_ids to an empty list.",
] .join(" ");

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
  provider = invokeCodexProvider,
}: CodexOpportunityEvaluatorOptions = {}): CognitionOpportunityEvaluator {
  return request => evaluateCognitionOpportunityWithCodex(request, {
    command,
    arguments_: args,
    timeoutSeconds,
    signal,
    provider,
  });
}

export async function evaluateCognitionOpportunityWithCodex(
  request: CognitionOpportunityRequest,
  {
    command = "codex",
    arguments_: args = [],
    timeoutSeconds = 60,
    signal,
    provider = invokeCodexProvider,
  }: CodexOpportunityEvaluatorOptions = {},
): Promise<CognitionOpportunityEvaluation> {
  const projection: Projection = {
    ...request.projection,
    purpose: "ordinary",
    current_input: CODEX_OPPORTUNITY_INSTRUCTION,
  };
  const providerRequest: ProviderRequest = {
    contract_version: 1,
    cognition_id: newId("cognition"),
    projection,
    input: { text: CODEX_OPPORTUNITY_INSTRUCTION },
  };
  const result = await provider(command, args, providerRequest, { timeoutSeconds, signal });
  const decision = result.reply.trim();
  if (decision !== "cognition" && decision !== "defer" && decision !== "no_cognition") {
    throw new ValidationError("Codex opportunity evaluator reply must be cognition, defer, or no_cognition");
  }
  return {
    contract_version: COGNITION_OPPORTUNITY_CONTRACT_VERSION,
    decision,
    selected_meaning_ids: [...result.used_meaning_ids],
  };
}
