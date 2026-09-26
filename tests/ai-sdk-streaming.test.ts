import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { AiExecutor, AiStreamObservation, AiStreamObserver } from "../src/core/ai/contract.ts";
import type { CapabilityBinding } from "../src/core/capabilities/execution.ts";

import { createFileBackedRepositoriesForState } from "../src/composition/ember.ts";
import { createAiSdkCognitionExecutor } from "../src/core/ai/cognition.ts";
import { findCognition, executeCognition } from "../src/core/app/cognition-execution.ts";
import { createCapabilityExecutionLedger } from "../src/core/capabilities/execution.ts";
import { createLocalLookupCapability } from "../src/core/capabilities/local-lookup.ts";
import { startRuntime } from "../src/core/runtime-episode.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

const USAGE = {
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
} as const;

const AUTHORIZED = {
    status: "authorized",
    basis: "current_instruction",
    sourceId: "streaming-test-current-instruction",
    current: true,
} as const;

function streamChunks(chunks: object[], chunkDelayInMs = 0) {
    return {
        stream: simulateReadableStream({
            initialDelayInMs: 0,
            chunkDelayInMs,
            chunks: [{ type: "stream-start" as const, warnings: [] }, ...chunks],
        }),
    };
}

function structuredTextChunks(deltas: string[], finishReason: "stop" | "tool-calls" = "stop") {
    return [
        { type: "text-start" as const, id: "text-1" },
        ...deltas.map((delta) => ({ type: "text-delta" as const, id: "text-1", delta })),
        { type: "text-end" as const, id: "text-1" },
        {
            type: "finish" as const,
            finishReason: { raw: undefined, unified: finishReason },
            usage: USAGE,
        },
    ];
}

function observationSink(onObservation?: (observation: AiStreamObservation) => void) {
    const entries: AiStreamObservation[] = [];
    return {
        entries,
        observer: {
            observe(observation: AiStreamObservation) {
                entries.push(observation);
                onObservation?.(observation);
            },
        } satisfies AiStreamObserver,
    };
}

function withStreaming(provider: AiExecutor, stream: AiStreamObserver): AiExecutor {
    return (request, options) => provider(request, { ...options, stream });
}

function disclosedPayload(options) {
    const userMessage = options.prompt.find((message) => message.role === "user");
    assert.ok(userMessage && userMessage.role === "user");
    const part = userMessage.content[0];
    assert.equal(part.type, "text");
    return JSON.parse(part.text);
}

function selectedToolNames(options) {
    return (options.tools ?? [])
        .filter((candidate) => candidate.type === "function")
        .map((candidate) => candidate.name)
        .sort();
}

function lookupCapability(): CapabilityBinding {
    return createLocalLookupCapability({
        entries: { timezone: "UTC" },
        allowedKeys: ["timezone"],
        authority: AUTHORIZED,
    });
}

async function startedFixture() {
    const directory = await tempDir();
    const store = new StateStore(join(directory, "ember.json"));
    const populated = populatedState();
    await store.create(populated.state);
    const lease = await store.acquireWriteLease();
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-09-08T13:00:00Z" });
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

async function runStreaming(fixture, model, stream: AiStreamObserver, options = {}) {
    const provider = withStreaming(createAiSdkCognitionExecutor(model), stream);
    return executeCognition(createFileBackedRepositoriesForState(fixture.store), fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "current request",
        providerLabel: "ai-sdk-streaming",
        timeoutSeconds: 1,
        output: () => {},
        executor: provider,
        ...options,
    });
}

test("AI SDK streaming should emit ordered provisional reply snapshots before authoritative completion", async () => {
    const fixture = await startedFixture();
    const observations = observationSink();
    const model = new MockLanguageModelV3({
        doStream: async (options) => {
            const disclosed = disclosedPayload(options);
            const usedMeaningId = disclosed.projection.selection.meaning_ids[0];
            return streamChunks(
                structuredTextChunks([
                    '{"contractVersion":1,"reply":"STREAM-SENTINEL',
                    " grows",
                    ` into final","usedMeaningIds":["${usedMeaningId}"]}`,
                ]),
            );
        },
    });

    try {
        const result = await runStreaming(fixture, model, observations.observer);

        assert.equal(result.providerFailure, null);
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "completed");
        assert.equal(cognition.usedMeaningIds.length, 1);
        assert.ok(observations.entries.length >= 2);
        assert.ok(observations.entries.every((entry) => entry.kind === "provisional_text_snapshot"));
        const snapshots = observations.entries.map((entry) => entry.text);
        assert.equal(snapshots.at(-1), "STREAM-SENTINEL grows into final");
        for (let index = 1; index < snapshots.length; index += 1) {
            assert.ok(snapshots[index].startsWith(snapshots[index - 1]));
        }
        assert.equal(result.expressionText, "STREAM-SENTINEL grows into final\n");
        assert.equal(JSON.stringify(result.state).includes("STREAM-SENTINEL"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK streaming should keep final usedMeaningIds validation authoritative after provisional output", async () => {
    const fixture = await startedFixture();
    const observations = observationSink();
    const model = new MockLanguageModelV3({
        doStream: async () =>
            streamChunks(
                structuredTextChunks([
                    '{"contractVersion":1,"reply":"VISIBLE-BUT-INVALID","usedMeaningIds":[',
                    `"${fixture.ids.fact}"]}`,
                ]),
            ),
    });

    try {
        const result = await runStreaming(fixture, model, observations.observer);

        assert.match(result.providerFailure, /outside its projection/);
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "failed");
        assert.equal(cognition.expressionEvidenceId, null);
        assert.ok(observations.entries.some((entry) => entry.text.includes("VISIBLE-BUT-INVALID")));
        assert.equal(JSON.stringify(result.state).includes("VISIBLE-BUT-INVALID"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK streaming should report failure after visible provisional output without committing an expression", async () => {
    const fixture = await startedFixture();
    const observations = observationSink();
    const model = new MockLanguageModelV3({
        doStream: async () =>
            streamChunks([
                { type: "text-start" as const, id: "text-1" },
                {
                    type: "text-delta" as const,
                    id: "text-1",
                    delta: '{"contractVersion":1,"reply":"VISIBLE-PARTIAL","usedMeaningIds":',
                },
                { type: "error" as const, error: new Error("deterministic streamed failure") },
            ]),
    });

    try {
        const result = await runStreaming(fixture, model, observations.observer);

        assert.match(result.providerFailure, /streamed failure|AI SDK provider failed/);
        assert.ok(observations.entries.some((entry) => entry.text === "VISIBLE-PARTIAL"));
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "failed");
        assert.equal(cognition.expressionEvidenceId, null);
        assert.equal(JSON.stringify(result.state).includes("VISIBLE-PARTIAL"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK streaming should propagate abort after provisional output as cancellation_requested", async () => {
    const fixture = await startedFixture();
    const controller = new AbortController();
    const observations = observationSink(() => controller.abort());
    const model = new MockLanguageModelV3({
        doStream: async () =>
            streamChunks(
                structuredTextChunks(['{"contractVersion":1,"reply":"ABORT-VISIBLE', '","usedMeaningIds":[]}']),
                10,
            ),
    });

    try {
        const result = await runStreaming(fixture, model, observations.observer, { signal: controller.signal });

        assert.equal(controller.signal.aborted, true);
        assert.ok(observations.entries.length >= 1);
        assert.match(result.providerFailure, /cancellation requested/);
        const cognition = findCognition(result.state, result.cognitionId);
        assert.equal(cognition.status, "cancellation_requested");
        assert.equal(cognition.expressionEvidenceId, null);
        assert.equal(JSON.stringify(result.state).includes("ABORT-VISIBLE"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK streamed tool loops should still execute through the Ember capability firewall", async () => {
    const fixture = await startedFixture();
    const observations = observationSink();
    const ledger = createCapabilityExecutionLedger();
    const capability = lookupCapability();
    let step = 0;
    const model = new MockLanguageModelV3({
        doStream: async (options) => {
            if (step++ === 0) {
                assert.deepEqual(selectedToolNames(options), ["localLookup"]);
                return streamChunks([
                    {
                        type: "tool-call" as const,
                        toolCallId: "stream-call-1",
                        toolName: "localLookup",
                        input: JSON.stringify({ key: "timezone" }),
                    },
                    {
                        type: "finish" as const,
                        finishReason: { raw: undefined, unified: "tool-calls" as const },
                        usage: USAGE,
                    },
                ]);
            }
            const prompt = JSON.stringify(options.prompt);
            assert.match(prompt, /capability_execution_evidence/);
            assert.match(prompt, /"value":"UTC"/);
            return streamChunks(
                structuredTextChunks(['{"contractVersion":1,"reply":"streamed tool result","usedMeaningIds":[]}']),
            );
        },
    });

    try {
        const result = await runStreaming(fixture, model, observations.observer, {
            selectCapabilities: () => [capability],
            capabilityLedger: ledger,
        });

        assert.equal(result.providerFailure, null);
        assert.equal(findCognition(result.state, result.cognitionId).status, "completed");
        assert.equal(model.doStreamCalls.length, 2);
        assert.equal(ledger.entries.length, 1);
        assert.equal(ledger.entries[0].capability, "localLookup");
        assert.equal(ledger.entries[0].outcome, "succeeded");
        assert.equal(ledger.entries[0].executionAttempted, true);
        assert.equal(observations.entries.at(-1)?.text, "streamed tool result");
        assert.equal(JSON.stringify(result.state).includes("stream-call-1"), false);
    } finally {
        await closeFixture(fixture);
    }
});
