import { MockLanguageModelV4 } from "ai/test";
import assert from "node:assert/strict";
import test from "node:test";

import { ProviderError, ValidationError } from "../core/errors.ts";
import { createAiSdkOnboardingProgressEvaluator } from "./onboarding-progress.ts";

const REQUEST = {
    projection: {} as never,
    onboardingWork: { work_version: 1 as const, status: "active" as const, guidance: "optional", topics: [] },
    input: "skip onboarding",
};

test("onboarding progress evaluator should normalize timeout when AI SDK deadline expires", async () => {
    // Given
    const model = new MockLanguageModelV4({
        doGenerate: async () => {
            throw new DOMException("deadline elapsed", "TimeoutError");
        },
    });
    const evaluator = createAiSdkOnboardingProgressEvaluator(model, 1);

    // When
    let error: unknown;
    try {
        await evaluator(REQUEST);
    } catch (caught) {
        error = caught;
    }

    // Then
    assert.ok(error instanceof ProviderError);
    assert.equal(error.outcome, "timed_out");
});

test("onboarding progress evaluator should normalize invalid output when model returns malformed JSON", async () => {
    // Given
    const model = new MockLanguageModelV4({
        doGenerate: async () => ({
            content: [{ type: "text", text: '{"decision_version":1' }],
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
                inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 1, text: 1, reasoning: 0 },
            },
            warnings: [],
        }),
    });
    const evaluator = createAiSdkOnboardingProgressEvaluator(model, 1);

    // When
    let error: unknown;
    try {
        await evaluator(REQUEST);
    } catch (caught) {
        error = caught;
    }

    // Then
    assert.ok(error instanceof ValidationError);
    assert.match(error.message, /invalid structured output/);
});
