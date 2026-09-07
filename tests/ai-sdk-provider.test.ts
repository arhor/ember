import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { StateStore } from "../src/persistence/state-store.ts";
import { createAiSdkProvider } from "../src/providers/ai-sdk.ts";
import { findCognition, runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

function generated(value, response = undefined) {
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

async function runWithModel(fixture, model, options = {}) {
    return runCognition(fixture.store, fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "current request",
        command: "ai-sdk",
        timeoutSeconds: 1,
        output: () => {},
        provider: createAiSdkProvider(model),
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

test("AI SDK malformed structured output should become an ordinary Ember provider failure", async () => {
    // Given
    const fixture = await startedFixture();
    const model = new MockLanguageModelV3({ doGenerate: async () => generated('{"contractVersion":1') });
    try {
        // When
        const result = await runWithModel(fixture, model);
        // Then
        assert.ok(result.providerFailure);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
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
