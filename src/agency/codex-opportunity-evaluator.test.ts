import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../core/errors.ts";
import { initialState } from "../core/model.ts";
import { undertake } from "../core/semantics.ts";
import { startRuntime } from "../runtime/runtime.ts";
import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";
import { evaluateCognitionOpportunity } from "./cognition-opportunity.ts";
import {
  CODEX_OPPORTUNITY_INSTRUCTION,
  createCodexOpportunityEvaluator,
} from "./codex-opportunity-evaluator.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";

function fixture() {
  const state = initialState("Ember", PRINCIPAL, "2026-09-03T05:00:00Z");
  const commitment = undertake(state, PRINCIPAL, "decision-check", SCOPE, "Check the bounded endogenous decision path");
  const started = startRuntime(state, PRINCIPAL, SCOPE);
  return { ...started, commitment };
}

test("Codex evaluator should use fixed decision framing rather than wake-up topic text", async () => {
  // Given
  const state = fixture();
  let captured: ProviderRequest | null = null;
  const provider: ProviderInvoker = async (_command, _args, request) => {
    captured = request;
    return { contract_version: 1, reply: "cognition", used_meaning_ids: [state.commitment] };
  };

  // When
  const record = await evaluateCognitionOpportunity(state.state, {
    runtimeId: state.runtimeId,
    principal: PRINCIPAL,
    scope: SCOPE,
    mechanism: "foreground_probe",
    evaluator: createCodexOpportunityEvaluator({ provider, command: "codex-fixture" }),
  });

  // Then
  assert.equal(record.decision, "cognition");
  assert.ok(captured);
  assert.equal(captured.input.text, CODEX_OPPORTUNITY_INSTRUCTION);
  assert.equal(captured.projection.current_input, CODEX_OPPORTUNITY_INSTRUCTION);
  assert.equal(captured.projection.purpose, "ordinary");
  assert.doesNotMatch(CODEX_OPPORTUNITY_INSTRUCTION, /decision-check|bounded endogenous decision path/);
  assert.doesNotMatch(JSON.stringify(captured), /foreground_probe/);
});

test("Codex evaluator should reject prose instead of a bounded decision token", async () => {
  // Given
  const state = fixture();
  const provider: ProviderInvoker = async () => ({
    contract_version: 1,
    reply: "I think cognition would be useful",
    used_meaning_ids: [state.commitment],
  });

  // When / Then
  await assert.rejects(
    evaluateCognitionOpportunity(state.state, {
      runtimeId: state.runtimeId,
      principal: PRINCIPAL,
      scope: SCOPE,
      mechanism: "idle_opportunity",
      evaluator: createCodexOpportunityEvaluator({ provider }),
    }),
    error => error instanceof ValidationError && /reply must be cognition/.test(error.message),
  );
});
