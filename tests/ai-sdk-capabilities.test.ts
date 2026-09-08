import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { CapabilityBinding } from "../src/capabilities/execution.ts";
import type { InferenceEvidence } from "../src/providers/ai-sdk.ts";

import { createCapabilityExecutionLedger } from "../src/capabilities/execution.ts";
import { createLocalLookupCapability } from "../src/capabilities/local-lookup.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { createAiSdkProvider } from "../src/providers/ai-sdk.ts";
import { findCognition, runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

const AUTHORIZED = {
    status: "authorized",
    basis: "current_instruction",
    sourceId: "test-current-instruction",
    current: true,
} as const;

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

function generated(value) {
    return {
        content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
        finishReason: { raw: undefined, unified: "stop" },
        usage: USAGE,
        warnings: [],
    };
}

function toolCall(toolName: string, input: unknown, toolCallId = "call-1") {
    return {
        content: [
            {
                type: "tool-call",
                toolCallType: "function",
                toolCallId,
                toolName,
                input: JSON.stringify(input),
            },
        ],
        finishReason: { raw: undefined, unified: "tool-calls" },
        usage: USAGE,
        warnings: [],
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
    const started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-09-08T06:00:00Z" });
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

async function runWithCapabilities(
    fixture,
    model,
    capabilities: readonly CapabilityBinding[],
    ledger = undefined,
    inferenceEvidence = undefined,
) {
    return runCognition(fixture.store, fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "current request",
        providerLabel: "ai-sdk",
        timeoutSeconds: 1,
        output: () => {},
        provider: createAiSdkProvider(model, {
            selectCapabilities: () => capabilities,
            capabilityLedger: ledger,
            inferenceEvidence,
        }),
    });
}

function selectedToolNames(options) {
    return (options.tools ?? [])
        .filter((candidate) => candidate.type === "function")
        .map((candidate) => candidate.name)
        .sort();
}

function disclosedPayload(options) {
    const userMessage = options.prompt.find((message) => message.role === "user");
    assert.ok(userMessage && userMessage.role === "user");
    const part = userMessage.content[0];
    assert.equal(part.type, "text");
    return JSON.parse(part.text);
}

function lookupCapability(overrides = {}): CapabilityBinding {
    return {
        ...createLocalLookupCapability({
            entries: { timezone: "UTC", locale: "en-GB", hidden: "not-selected" },
            allowedKeys: ["timezone", "locale"],
            authority: AUTHORIZED,
        }),
        ...overrides,
    };
}

function countingCapability(base: CapabilityBinding, onExecution: () => void): CapabilityBinding {
    return {
        ...base,
        async execute(context, input, options) {
            onExecution();
            return base.execute(context, input, options);
        },
    };
}

test("AI SDK should expose only Ember-selected capabilities and return bounded capability evidence to the model loop", async () => {
    const fixture = await startedFixture();
    const ledger = createCapabilityExecutionLedger();
    const inference = inferenceEvidenceSink();
    let executions = 0;
    let step = 0;
    let usedMeaningId: string | undefined;
    const capability = countingCapability(lookupCapability(), () => {
        executions += 1;
    });
    const model = new MockLanguageModelV3({
        provider: "secret-tool-provider",
        modelId: "secret-tool-model",
        doGenerate: async (options) => {
            if (step++ === 0) {
                assert.deepEqual(selectedToolNames(options), ["localLookup"]);
                const disclosed = disclosedPayload(options);
                usedMeaningId = disclosed.projection.selection.meaning_ids[0];
                return toolCall("localLookup", { key: "timezone" });
            }
            const prompt = JSON.stringify(options.prompt);
            assert.match(prompt, /capability_execution_evidence/);
            assert.match(prompt, /"outcome":"succeeded"/);
            assert.match(prompt, /"value":"UTC"/);
            return generated({
                contractVersion: 1,
                reply: "bounded capability reply",
                usedMeaningIds: usedMeaningId ? [usedMeaningId] : [],
            });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, [capability], ledger, inference);

        assert.equal(result.providerFailure, null);
        assert.equal(findCognition(result.state, result.cognitionId).status, "completed");
        assert.equal(executions, 1);
        assert.equal(model.doGenerateCalls.length, 2);
        assert.equal(ledger.entries.length, 1);
        assert.deepEqual(ledger.entries[0], {
            kind: "capability_execution_evidence",
            cognitionId: result.cognitionId,
            capability: "localLookup",
            outcome: "succeeded",
            executionAttempted: true,
            retry: "unsafe",
            authority: { basis: "current_instruction", sourceId: "test-current-instruction" },
            output: { key: "timezone", value: "UTC" },
        });
        const toolObservations = inference.entries.filter(
            (entry) => entry.kind === "tool_dispatch_started" || entry.kind === "tool_dispatch_completed",
        );
        assert.equal(toolObservations.length, 2);
        assert.deepEqual(toolObservations[0], {
            kind: "tool_dispatch_started",
            cognitionId: result.cognitionId,
            capability: "localLookup",
        });
        assert.equal(toolObservations[1]?.kind, "tool_dispatch_completed");
        if (toolObservations[1]?.kind === "tool_dispatch_completed") {
            assert.equal(toolObservations[1].capability, "localLookup");
            assert.equal(toolObservations[1].sdkOutcome, "result");
            assert.ok(toolObservations[1].durationMs >= 0);
        }
        const serializedInference = JSON.stringify(inference.entries);
        assert.equal(serializedInference.includes("timezone"), false);
        assert.equal(serializedInference.includes("UTC"), false);
        assert.equal(serializedInference.includes("call-1"), false);
        const serializedState = JSON.stringify(result.state);
        assert.equal(serializedState.includes("secret-tool-provider"), false);
        assert.equal(serializedState.includes("secret-tool-model"), false);
        assert.equal(serializedState.includes("call-1"), false);
        assert.equal(serializedState.includes("capability_execution_evidence"), false);
        assert.equal(serializedState.includes("localLookup"), false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK should not expose a capability that Ember did not select for the cognition", async () => {
    const fixture = await startedFixture();
    const model = new MockLanguageModelV3({
        doGenerate: async (options) => {
            assert.deepEqual(selectedToolNames(options), []);
            return generated({ contractVersion: 1, reply: "no capability selected", usedMeaningIds: [] });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, []);

        assert.equal(result.providerFailure, null);
        assert.equal(findCognition(result.state, result.cognitionId).status, "completed");
        assert.equal(model.doGenerateCalls.length, 1);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK tool availability should not bypass Ember authority denial", async () => {
    const fixture = await startedFixture();
    const ledger = createCapabilityExecutionLedger();
    let executions = 0;
    let step = 0;
    const capability = countingCapability(
        lookupCapability({
            authorize: () => ({ status: "denied", reason: "no live authority for this capability request" }),
        }),
        () => {
            executions += 1;
        },
    );
    const model = new MockLanguageModelV3({
        doGenerate: async (options) => {
            if (step++ === 0) {
                assert.deepEqual(selectedToolNames(options), ["localLookup"]);
                return toolCall("localLookup", { key: "timezone" });
            }
            const prompt = JSON.stringify(options.prompt);
            assert.match(prompt, /authority_denied/);
            assert.match(prompt, /no live authority/);
            return generated({ contractVersion: 1, reply: "authority denied", usedMeaningIds: [] });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, [capability], ledger);

        assert.equal(result.providerFailure, null);
        assert.equal(executions, 0);
        assert.equal(ledger.entries.length, 1);
        assert.equal(ledger.entries[0].outcome, "authority_denied");
        assert.equal(ledger.entries[0].executionAttempted, false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK structurally valid but out-of-policy capability input should not execute", async () => {
    const fixture = await startedFixture();
    const ledger = createCapabilityExecutionLedger();
    let executions = 0;
    let step = 0;
    const capability = countingCapability(lookupCapability(), () => {
        executions += 1;
    });
    const model = new MockLanguageModelV3({
        doGenerate: async (options) => {
            if (step++ === 0) return toolCall("localLookup", { key: "hidden" });
            assert.match(JSON.stringify(options.prompt), /input_rejected/);
            return generated({ contractVersion: 1, reply: "input rejected", usedMeaningIds: [] });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, [capability], ledger);

        assert.equal(result.providerFailure, null);
        assert.equal(executions, 0);
        assert.equal(ledger.entries.length, 1);
        assert.equal(ledger.entries[0].outcome, "input_rejected");
        assert.equal(ledger.entries[0].executionAttempted, false);
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK schema-invalid capability input should fail mechanically before Ember execution", async () => {
    const fixture = await startedFixture();
    let executions = 0;
    const capability = countingCapability(lookupCapability(), () => {
        executions += 1;
    });
    const model = new MockLanguageModelV3({
        doGenerate: async () => toolCall("localLookup", { keys: ["timezone"] }),
    });

    try {
        const result = await runWithCapabilities(fixture, model, [capability]);

        assert.ok(result.providerFailure);
        assert.equal(executions, 0);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK capability execution failure should re-enter cognition as bounded failure evidence", async () => {
    const fixture = await startedFixture();
    const ledger = createCapabilityExecutionLedger();
    let step = 0;
    const capability = lookupCapability({
        execute: () => {
            throw new Error("local capability failure");
        },
    });
    const model = new MockLanguageModelV3({
        doGenerate: async (options) => {
            if (step++ === 0) return toolCall("localLookup", { key: "timezone" });
            const prompt = JSON.stringify(options.prompt);
            assert.match(prompt, /"outcome":"failed"/);
            assert.match(prompt, /local capability failure/);
            return generated({ contractVersion: 1, reply: "capability failed", usedMeaningIds: [] });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, [capability], ledger);

        assert.equal(result.providerFailure, null);
        assert.equal(ledger.entries.length, 1);
        assert.equal(ledger.entries[0].outcome, "failed");
        assert.equal(ledger.entries[0].executionAttempted, true);
        assert.equal(ledger.entries[0].retry, "unsafe");
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK repeated model requests should not repeat one effectful capability occurrence", async () => {
    const fixture = await startedFixture();
    const ledger = createCapabilityExecutionLedger();
    let executions = 0;
    let step = 0;
    const capability = countingCapability(lookupCapability(), () => {
        executions += 1;
    });
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            if (step++ === 0) return toolCall("localLookup", { key: "timezone" }, "call-1");
            if (step === 2) return toolCall("localLookup", { key: "timezone" }, "call-2");
            return generated({ contractVersion: 1, reply: "second occurrence blocked", usedMeaningIds: [] });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, [capability], ledger);

        assert.equal(result.providerFailure, null);
        assert.equal(executions, 1);
        assert.equal(model.doGenerateCalls.length, 3);
        assert.deepEqual(
            ledger.entries.map((entry) => entry.outcome),
            ["succeeded", "occurrence_blocked"],
        );
        assert.equal(ledger.entries[1].executionAttempted, false);
        assert.equal(ledger.entries[1].retry, "unsafe");
    } finally {
        await closeFixture(fixture);
    }
});

test("AI SDK capability success should not bypass final Ember provider-result validation", async () => {
    const fixture = await startedFixture();
    let step = 0;
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            if (step++ === 0) return toolCall("localLookup", { key: "timezone" });
            return generated({
                contractVersion: 1,
                reply: "invalid final provenance",
                usedMeaningIds: [fixture.ids.fact],
            });
        },
    });

    try {
        const result = await runWithCapabilities(fixture, model, [lookupCapability()]);

        assert.match(result.providerFailure ?? "", /outside its projection/);
        assert.equal(findCognition(result.state, result.cognitionId).status, "failed");
    } finally {
        await closeFixture(fixture);
    }
});
