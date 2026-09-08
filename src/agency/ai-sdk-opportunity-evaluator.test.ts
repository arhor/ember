import { APICallError } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import test from "node:test";

import type { CognitionOpportunityDecision } from "../core/model.ts";

import { ProviderError, ValidationError } from "../core/errors.ts";
import { initialState } from "../core/model.ts";
import { undertake } from "../core/semantics.ts";
import { startRuntime } from "../runtime/runtime.ts";
import { AI_SDK_OPPORTUNITY_INSTRUCTION, createAiSdkOpportunityEvaluator } from "./ai-sdk-opportunity-evaluator.ts";
import { evaluateCognitionOpportunity } from "./cognition-opportunity.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";

function fixture() {
    const state = initialState("Ember", PRINCIPAL, "2026-09-08T10:00:00Z");
    const commitment = undertake(
        state,
        PRINCIPAL,
        "structured-decision-check",
        SCOPE,
        "Check the typed AI SDK endogenous decision path",
    );
    const started = startRuntime(state, PRINCIPAL, SCOPE);
    return { ...started, commitment };
}

function generated(value: unknown) {
    return {
        content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }],
        finishReason: { raw: undefined, unified: "stop" as const },
        usage: {
            inputTokens: {
                total: 1,
                noCache: 1,
                cacheRead: undefined,
                cacheWrite: undefined,
            },
            outputTokens: {
                total: 1,
                text: 1,
                reasoning: undefined,
            },
        },
        warnings: [],
    };
}

function disclosedPayload(model: MockLanguageModelV3) {
    assert.equal(model.doGenerateCalls.length, 1);
    const userMessage = model.doGenerateCalls[0].prompt.find((message) => message.role === "user");
    assert.ok(userMessage && userMessage.role === "user");
    assert.equal(userMessage.content.length, 1);
    const part = userMessage.content[0];
    assert.equal(part.type, "text");
    return JSON.parse(part.text);
}

test("AI SDK evaluator should produce each opportunity decision through structured output", async () => {
    // Given
    const state = fixture();
    const cases: Array<{ decision: CognitionOpportunityDecision; selectedMeaningIds: string[] }> = [
        { decision: "cognition", selectedMeaningIds: [state.commitment] },
        { decision: "defer", selectedMeaningIds: [state.commitment] },
        { decision: "no_cognition", selectedMeaningIds: [] },
    ];

    for (const expected of cases) {
        const model = new MockLanguageModelV3({
            doGenerate: async () =>
                generated({
                    contractVersion: 1,
                    decision: expected.decision,
                    selectedMeaningIds: expected.selectedMeaningIds,
                }),
        });

        // When
        const record = await evaluateCognitionOpportunity(state.state, {
            runtimeId: state.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator: createAiSdkOpportunityEvaluator(model),
        });

        // Then
        assert.equal(record.decision, expected.decision);
        assert.deepEqual(record.selectedMeaningIds, expected.selectedMeaningIds);
        const disclosed = disclosedPayload(model);
        assert.deepEqual(Object.keys(disclosed), ["projection"]);
        assert.equal(disclosed.projection.purpose, "endogenous_decision");
        assert.equal("current_input" in disclosed.projection, false);
        assert.equal("mechanism" in disclosed, false);
        assert.doesNotMatch(JSON.stringify(model.doGenerateCalls[0].prompt), /foreground_probe/);
    }

    assert.doesNotMatch(AI_SDK_OPPORTUNITY_INSTRUCTION, /reply with exactly one token/i);
});

test("AI SDK evaluator should classify schema-invalid control output before Ember semantic validation", async () => {
    // Given
    const state = fixture();
    const model = new MockLanguageModelV3({
        doGenerate: async () =>
            generated({
                contractVersion: 1,
                decision: "maybe",
                selectedMeaningIds: [],
            }),
    });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(state.state, {
            runtimeId: state.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator: createAiSdkOpportunityEvaluator(model),
        }),
        (error) => error instanceof ValidationError && /invalid structured output/.test(error.message),
    );
});

test("AI SDK evaluator should leave projected meaning validity to the Ember opportunity boundary", async () => {
    // Given
    const state = fixture();
    const model = new MockLanguageModelV3({
        doGenerate: async () =>
            generated({
                contractVersion: 1,
                decision: "cognition",
                selectedMeaningIds: ["meaning-outside-projection"],
            }),
    });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(state.state, {
            runtimeId: state.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator: createAiSdkOpportunityEvaluator(model),
        }),
        (error) => error instanceof ValidationError && /outside its projection/.test(error.message),
    );
});

test("AI SDK evaluator should leave duplicate grounding policy to the Ember opportunity boundary", async () => {
    // Given
    const state = fixture();
    const model = new MockLanguageModelV3({
        doGenerate: async () =>
            generated({
                contractVersion: 1,
                decision: "cognition",
                selectedMeaningIds: [state.commitment, state.commitment],
            }),
    });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(state.state, {
            runtimeId: state.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator: createAiSdkOpportunityEvaluator(model),
        }),
        (error) => error instanceof ValidationError && /must not contain duplicates/.test(error.message),
    );
});

test("AI SDK evaluator should not retry a retryable provider failure implicitly", async () => {
    // Given
    const state = fixture();
    let calls = 0;
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            calls += 1;
            throw new APICallError({
                message: "provider detail should stay adapter-local",
                url: "https://provider.invalid/generate",
                requestBodyValues: { secret: "request" },
                statusCode: 503,
                responseBody: "secret response",
                isRetryable: true,
            });
        },
    });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(state.state, {
            runtimeId: state.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "external_timing",
            evaluator: createAiSdkOpportunityEvaluator(model),
        }),
        (error) => {
            assert.ok(error instanceof ProviderError);
            assert.match(error.message, /API call failed \(HTTP 503\)/);
            assert.equal(error.message.includes("provider detail"), false);
            assert.equal(error.message.includes("provider.invalid"), false);
            assert.equal(error.message.includes("secret response"), false);
            return true;
        },
    );
    assert.equal(calls, 1);
});
