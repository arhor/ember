import { APICallError } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { InferenceEvidence } from "../src/providers/ai-sdk.ts";

import { StateStore } from "../src/persistence/state-store.ts";
import { createAiSdkProvider } from "../src/providers/ai-sdk.ts";
import { findCognition, runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

function generated(value, response = undefined, overrides = {}) {
    return {
        content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
        finishReason: { raw: undefined, unified: "stop" },
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
        ...(response ? { response } : {}),
        ...overrides,
    };
}

function inferenceEvidenceSink() {
    const entries: InferenceEvidence[] = [];
    return {
        entries,
        record(evidence: InferenceEvidence) {
            entries.push(evidence);
        },
    };
}

async function startedFixture() {
    const directory = await tempDir();
    const store = new StateStore(join(directory, "ember.json"));
    const populated = populatedState();
    await store.create(populated.state);
    const lease = await store.acquireWriteLease();
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-09-07T12:00:00Z" });
    const state = await store.commit(loaded.revision, started.state);
    return { directory, store, lease, state, runtimeId: started.runtimeId, ids: populated.ids };
}

async function closeFixture(fixture) {
    try {
        await fixture.store.releaseWriteLease(fixture.lease);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
}

async function runWithModel(fixture, model, options = {}, providerOptions = {}) {
    return runCognition(fixture.store, fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "current request",
        providerLabel: "ai-sdk",
        timeoutSeconds: 1,
        output: () => {},
        provider: createAiSdkProvider(model, providerOptions),
        ...options,
    });
}

function disclosedPayload(model) {
    assert.equal(model.doGenerateCalls.length, 1);
    const userMessage = model.doGenerateCalls[0].prompt.find((message) => message.role === "user");
    assert.ok(userMessage && userMessage.role === "user");
    assert.equal(userMessage.content.length, 1);
    const part = userMessage.content[0];
    assert.equal(part.type, "text");
    return JSON.parse(part.text);
}

function waitForAbort(abortSignal) {
    return new Promise((_, reject) => {
        assert.ok(abortSignal);
        const rejectForAbort = () => reject(abortSignal.reason);
        if (abortSignal.aborted) {
            rejectForAbort();
        } else {
            abortSignal.addEventListener("abort", rejectForAbort, { once: true });
        }
    });
}

test("AI SDK adapter should disclose only the selected projection and current input through the real cognition path", async () => {
    // Given
    const fixture = await startedFixture();
    const model = new MockLanguageModelV3({
        provider: "secret-sdk-provider",
        modelId: "secret-sdk-model",
        doGenerate: async (options) => {
            const userMessage = options.prompt.find((message) => message.role === "user");
            assert.ok(userMessage && userMessage.role === "user");
            const part = userMessage.content[0];
            assert.equal(part.type, "text");
            const disclosed = JSON.parse(part.text);
            return generated(
                {
                    contractVersion: 1,
                    reply: "bounded reply",
                    usedMeaningIds: disclosed.projection.selection.meaning_ids.slice(0, 1),
                },
                {
                    id: "secret-sdk-response-id",
                    modelId: "secret-sdk-response-model",
                    timestamp: new Date("2026-09-07T12:00:01Z"),
                },
            );
        },
    });
    try {
        // When
        const result = await runWithModel(fixture, model);
        const disclosed = disclosedPayload(model);
        // Then
        assert.deepEqual(Object.keys(disclosed).sort(), ["input", "projection"]);
        assert.equal(disclosed.input.text, "current request");
        assert.equal(disclosed.projection.current_input, "current request");
        assert.ok(disclosed.projection.selection.meaning_ids.length > 0);
        assert.ok(!disclosed.projection.selection.meaning_ids.includes(fixture.ids.fact));
        assert.equal(JSON.stringify(disclosed).includes(fixture.ids.fact), false);
        assert.equal(result.providerFailure, null);
        assert.equal(findCognition(result.state, result.cognitionId).status, "completed");
        const serializedState = JSON.stringify(result.state);
        assert.equal(serializedState.includes("secret-sdk-provider"), false);
        assert.equal(serializedState.includes("secret-sdk-model"), false);
        assert.equal(serializedState.includes("secret-sdk-response-id"), false);
        assert.equal(serializedState.includes("secret-sdk-response-model"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK lifecycle evidence should retain normalized diagnostics without raw request or provider payload leakage", async () => {
    // Given
    const fixture = await startedFixture();
    const evidence = inferenceEvidenceSink();
    const model = new MockLanguageModelV3({
        provider: "diagnostic-provider",
        modelId: "diagnostic-model",
        doGenerate: async () =>
            generated(
                { contractVersion: 1, reply: "diagnostic reply", usedMeaningIds: [] },
                {
                    id: "secret-response-id",
                    modelId: "provider-response-model",
                    timestamp: new Date("2026-09-07T12:00:01Z"),
                },
                {
                    finishReason: { raw: "provider-stop", unified: "stop" },
                    usage: {
                        inputTokens: {
                            total: 7,
                            noCache: 5,
                            cacheRead: 2,
                            cacheWrite: 1,
                        },
                        outputTokens: {
                            total: 5,
                            text: 3,
                            reasoning: 2,
                        },
                    },
                    warnings: [
                        {
                            type: "unsupported",
                            feature: "diagnostic-feature",
                            details: "secret-warning-details",
                        },
                        { type: "other", message: "secret-other-warning" },
                    ],
                    providerMetadata: {
                        secretProvider: { trace: "secret-provider-trace" },
                    },
                },
            ),
    });
    try {
        // When
        const result = await runWithModel(fixture, model, {}, { inferenceEvidence: evidence });
        // Then
        assert.equal(result.providerFailure, null);
        assert.deepEqual(
            evidence.entries.map((entry) => entry.kind),
            ["inference_started", "model_step_completed", "inference_completed"],
        );
        assert.deepEqual(evidence.entries[0], {
            kind: "inference_started",
            cognitionId: result.cognitionId,
            provider: "diagnostic-provider",
            modelId: "diagnostic-model",
            retryLimit: 0,
        });
        assert.deepEqual(evidence.entries[1], {
            kind: "model_step_completed",
            cognitionId: result.cognitionId,
            stepNumber: 0,
            provider: "diagnostic-provider",
            modelId: "diagnostic-model",
            responseModelId: "provider-response-model",
            finishReason: "stop",
            rawFinishReason: "provider-stop",
            usage: {
                inputTokens: 7,
                inputNoCacheTokens: 5,
                inputCacheReadTokens: 2,
                inputCacheWriteTokens: 1,
                outputTokens: 5,
                outputTextTokens: 3,
                outputReasoningTokens: 2,
                totalTokens: 12,
            },
            warnings: [
                { type: "unsupported", feature: "diagnostic-feature" },
                { type: "other" },
            ],
        });
        const completed = evidence.entries[2];
        assert.equal(completed.kind, "inference_completed");
        if (completed.kind === "inference_completed") {
            assert.equal(completed.stepCount, 1);
            assert.equal(completed.finishReason, "stop");
            assert.equal(completed.usage.totalTokens, 12);
        }
        const serializedEvidence = JSON.stringify(evidence.entries);
        assert.equal(serializedEvidence.includes("current request"), false);
        assert.equal(serializedEvidence.includes("secret-response-id"), false);
        assert.equal(serializedEvidence.includes("secret-warning-details"), false);
        assert.equal(serializedEvidence.includes("secret-other-warning"), false);
        assert.equal(serializedEvidence.includes("secret-provider-trace"), false);
        assert.equal(JSON.stringify(result.state).includes("diagnostic-provider"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK structured output should still be rejected when it claims a meaning outside the supplied projection", async () => {
    // Given
    const fixture = await startedFixture();
    const model = new MockLanguageModelV3({
        doGenerate: async () =>
            generated({
                contractVersion: 1,
                reply: "invalid provenance",
                usedMeaningIds: [fixture.ids.fact],
            }),
    });
    try {
        // When
        const result = await runWithModel(fixture, model);
        // Then
        assert.match(result.providerFailure, /outside its projection/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK malformed structured output should map through supported SDK output errors", async () => {
    // Given
    const fixture = await startedFixture();
    const evidence = inferenceEvidenceSink();
    const model = new MockLanguageModelV3({ doGenerate: async () => generated('{"contractVersion":1') });
    try {
        // When
        const result = await runWithModel(fixture, model, {}, { inferenceEvidence: evidence });
        // Then
        assert.match(result.providerFailure ?? "", /invalid structured output/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
        assert.equal(evidence.entries.at(-1)?.kind, "inference_failed");
        assert.deepEqual(evidence.entries.at(-1), {
            kind: "inference_failed",
            cognitionId: result.cognitionId,
            category: "invalid_output",
            phase: "during_invocation",
        });
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK timeout should map to Ember timed_out semantics", async () => {
    // Given
    const fixture = await startedFixture();
    const model = new MockLanguageModelV3({ doGenerate: async ({ abortSignal }) => waitForAbort(abortSignal) });
    try {
        // When
        const result = await runWithModel(fixture, model, { timeoutSeconds: 0.01 });
        // Then
        assert.match(result.providerFailure, /timed out/);
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "timed_out");
        assert.equal(cognition.providerTermination, null);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK timeout classification should use the standard timeout code rather than a stringly error name", async () => {
    // Given
    const fixture = await startedFixture();
    const timeout = new DOMException("deterministic timeout", "TimeoutError");
    Object.defineProperty(timeout, "name", { value: "renamed-timeout" });
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            throw timeout;
        },
    });
    try {
        // When
        const result = await runWithModel(fixture, model);
        // Then
        assert.match(result.providerFailure, /timed out/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "timed_out");
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK timeout should remain timed_out when caller cancellation follows it", async () => {
    // Given
    const fixture = await startedFixture();
    const controller = new AbortController();
    const model = new MockLanguageModelV3({
        doGenerate: async ({ abortSignal }) => {
            try {
                return await waitForAbort(abortSignal);
            } catch (error) {
                controller.abort();
                throw error;
            }
        },
    });
    try {
        // When
        const result = await runWithModel(fixture, model, {
            timeoutSeconds: 0.01,
            signal: controller.signal,
        });
        // Then
        assert.equal(controller.signal.aborted, true);
        assert.match(result.providerFailure, /timed out/);
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "timed_out");
        assert.equal(cognition.providerTermination, null);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK abort should map to Ember cancellation_requested semantics", async () => {
    // Given
    const fixture = await startedFixture();
    const controller = new AbortController();
    const model = new MockLanguageModelV3({ doGenerate: async ({ abortSignal }) => waitForAbort(abortSignal) });
    const cancellation = setTimeout(() => controller.abort(), 5);
    try {
        // When
        const result = await runWithModel(fixture, model, { signal: controller.signal });
        // Then
        assert.match(result.providerFailure, /cancellation requested/);
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "cancellation_requested");
        assert.deepEqual(cognition.providerTermination, {
            reason: "explicit_cancellation",
            directChildExitObserved: false,
        });
    } finally {
        clearTimeout(cancellation);
        await closeFixture(fixture);
    }
});

test("AI SDK already-aborted requests should be classified before model work begins", async () => {
    // Given
    const fixture = await startedFixture();
    const evidence = inferenceEvidenceSink();
    const controller = new AbortController();
    controller.abort();
    const model = new MockLanguageModelV3({
        doGenerate: async () => generated({ contractVersion: 1, reply: "should not run", usedMeaningIds: [] }),
    });
    try {
        // When
        const result = await runWithModel(fixture, model, { signal: controller.signal }, { inferenceEvidence: evidence });
        // Then
        assert.equal(model.doGenerateCalls.length, 0);
        assert.match(result.providerFailure, /before invocation/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "cancellation_requested");
        assert.deepEqual(evidence.entries, [
            {
                kind: "inference_failed",
                cognitionId: result.cognitionId,
                category: "cancellation",
                phase: "before_invocation",
            },
        ]);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK API failures should be classified without leaking SDK request or response payloads", async () => {
    // Given
    const fixture = await startedFixture();
    const evidence = inferenceEvidenceSink();
    let calls = 0;
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            calls += 1;
            throw new APICallError({
                message: "secret provider explanation",
                url: "https://secret-provider.invalid/generate",
                requestBodyValues: { prompt: "secret-request-body" },
                statusCode: 503,
                responseBody: "secret-response-body",
                isRetryable: true,
            });
        },
    });
    try {
        // When
        const result = await runWithModel(fixture, model, {}, { inferenceEvidence: evidence });
        // Then
        assert.equal(calls, 1);
        assert.match(result.providerFailure ?? "", /API call failed \(HTTP 503\)/);
        assert.equal(result.providerFailure?.includes("secret"), false);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
        assert.deepEqual(evidence.entries.at(-1), {
            kind: "inference_failed",
            cognitionId: result.cognitionId,
            category: "provider_api",
            phase: "during_invocation",
            statusCode: 503,
        });
        const serializedEvidence = JSON.stringify(evidence.entries);
        assert.equal(serializedEvidence.includes("secret-request-body"), false);
        assert.equal(serializedEvidence.includes("secret-response-body"), false);
        assert.equal(serializedEvidence.includes("secret-provider.invalid"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK model failure should stay adapter-local and should not be retried implicitly", async () => {
    // Given
    const fixture = await startedFixture();
    let calls = 0;
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            calls += 1;
            throw new Error("mock model failure");
        },
    });
    try {
        // When
        const result = await runWithModel(fixture, model);
        // Then
        assert.match(result.providerFailure, /AI SDK provider failed: mock model failure/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
        assert.equal(calls, 1);
    } finally {
        await closeFixture(fixture);
    }
});
