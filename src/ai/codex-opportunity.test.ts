import { MockLanguageModelV4 } from "ai/test";
import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCognitionOpportunity } from "../agency/cognition-opportunity.ts";
import { ValidationError } from "../core/errors.ts";
import { initialState } from "../core/model.ts";
import { startRuntime } from "../core/runtime-episode.ts";
import { undertake } from "../core/semantics.ts";
import { CODEX_OPPORTUNITY_INSTRUCTION, createCodexOpportunityEvaluator } from "./codex-opportunity.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";

function fixture() {
    const state = initialState(PRINCIPAL, "2026-09-03T05:00:00Z");
    const commitment = undertake(
        state,
        PRINCIPAL,
        "decision-check",
        SCOPE,
        "Check the bounded endogenous decision path",
    );
    const started = startRuntime(state, PRINCIPAL, SCOPE);
    return { ...started, commitment };
}

test("Codex evaluator should use fixed decision framing rather than wake-up topic text", async () => {
    // Given
    const state = fixture();
    let captured: any;
    const model = new MockLanguageModelV4({
        doGenerate: async (options) => {
            captured = options;
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            contractVersion: 1,
                            decision: "cognition",
                            selectedMeaningIds: [state.commitment],
                        }),
                    },
                ],
                finishReason: { unified: "stop", raw: "stop" },
                usage: {
                    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                    outputTokens: { total: 1, text: 1, reasoning: 0 },
                },
                warnings: [],
            };
        },
    });

    // When
    const record = await evaluateCognitionOpportunity(state.state, {
        runtimeId: state.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        mechanism: "foreground_probe",
        evaluator: createCodexOpportunityEvaluator({ model, command: "codex-fixture" }),
    });

    // Then
    assert.equal(record.decision, "cognition");
    assert.ok(captured);
    assert.equal(captured.prompt[0].content, CODEX_OPPORTUNITY_INSTRUCTION);
    assert.doesNotMatch(CODEX_OPPORTUNITY_INSTRUCTION, /decision-check|bounded endogenous decision path/);
    assert.doesNotMatch(JSON.stringify(captured), /foreground_probe/);
});

test("Codex evaluator should reject prose instead of a bounded decision token", async () => {
    // Given
    const state = fixture();
    const model = new MockLanguageModelV4({
        doGenerate: async () => ({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        contractVersion: 1,
                        decision: "I think cognition would be useful",
                        selectedMeaningIds: [state.commitment],
                    }),
                },
            ],
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
            warnings: [],
        }),
    });

    // When
    let error: unknown;
    try {
        await evaluateCognitionOpportunity(state.state, {
            runtimeId: state.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator: createCodexOpportunityEvaluator({ model }),
        });
    } catch (caught) {
        error = caught;
    }

    // Then
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /invalid structured output/);
});
