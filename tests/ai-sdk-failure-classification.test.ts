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
    const started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-09-08T11:30:00Z" });
    const state = await store.commit(loaded.revision, started.state);
    return { directory, store, lease, state, runtimeId: started.runtimeId };
}

async function closeFixture(fixture) {
    try {
        await fixture.store.releaseWriteLease(fixture.lease);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
}

test("AI SDK provider failure should not be overwritten by a later caller cancellation", async () => {
    const fixture = await startedFixture();
    const evidence = inferenceEvidenceSink();
    const controller = new AbortController();
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            const failure = new APICallError({
                message: "provider failed first",
                url: "https://provider.invalid/generate",
                requestBodyValues: {},
                statusCode: 503,
                isRetryable: true,
            });
            controller.abort();
            throw failure;
        },
    });

    try {
        const result = await runCognition(fixture.store, fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "current request",
            providerLabel: "ai-sdk",
            timeoutSeconds: 1,
            signal: controller.signal,
            output: () => {},
            provider: createAiSdkProvider(model, { inferenceEvidence: evidence }),
        });

        assert.equal(controller.signal.aborted, true);
        assert.match(result.providerFailure ?? "", /API call failed \(HTTP 503\)/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
        assert.deepEqual(evidence.entries.at(-1), {
            kind: "inference_failed",
            cognitionId: result.cognitionId,
            category: "provider_api",
            phase: "during_invocation",
            statusCode: 503,
        });
    } finally {
        await closeFixture(fixture);
    }
});
