import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import test from "node:test";

import type { CapabilityBinding, CapabilityContext } from "../src/capabilities/execution.ts";
import type { McpCapabilityPolicy, McpCapabilitySource } from "../src/capabilities/mcp-ai-sdk.ts";

import { createCapabilityExecutionFirewall, createCapabilityExecutionLedger } from "../src/capabilities/execution.ts";
import { openAiSdkMcpStdioCapabilitySource, McpCapabilitySourceError } from "../src/capabilities/mcp-ai-sdk.ts";
import { newId } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { createAiSdkProvider } from "../src/providers/ai-sdk.ts";
import { findCognition, runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

const MCP_FIXTURE = fileURLToPath(new URL("./fixtures/mcp-server.ts", import.meta.url));
const AUTHORIZED = {
    status: "authorized",
    basis: "current_instruction",
    sourceId: "test-current-instruction",
    current: true,
} as const;
const USAGE = {
    inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 1, text: 1, reasoning: undefined },
} as const;

interface SourceFixture {
    directory: string;
    logPath: string;
    source: McpCapabilitySource;
}

function generated(value: unknown) {
    return {
        content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
        finishReason: { raw: undefined, unified: "stop" },
        usage: USAGE,
        warnings: [],
    };
}

function toolCall(toolName: string, input: unknown) {
    return {
        content: [
            {
                type: "tool-call",
                toolCallType: "function",
                toolCallId: "mcp-call-1",
                toolName,
                input: JSON.stringify(input),
            },
        ],
        finishReason: { raw: undefined, unified: "tool-calls" },
        usage: USAGE,
        warnings: [],
    };
}

function selectedToolNames(options) {
    return (options.tools ?? [])
        .filter((candidate) => candidate.type === "function")
        .map((candidate) => candidate.name)
        .sort();
}

function context(): CapabilityContext {
    return {
        cognitionId: newId("cognition"),
        principal: PRINCIPAL,
        scope: SCOPE,
        surface: "test",
        validatedRevision: 1,
    };
}

function policy(overrides: Partial<McpCapabilityPolicy> = {}): McpCapabilityPolicy {
    return {
        name: "mcpLookup",
        description: "Ember-approved lookup backed by a selected MCP tool",
        authorize: () => AUTHORIZED,
        ...overrides,
    };
}

async function openSource(mode = "normal", requestTimeoutMs = 250): Promise<SourceFixture> {
    const directory = await tempDir();
    const logPath = join(directory, "mcp-events.jsonl");
    try {
        const source = await openAiSdkMcpStdioCapabilitySource({
            serverLabel: "deterministic-test-source",
            command: process.execPath,
            args: [MCP_FIXTURE],
            env: {
                EMBER_MCP_FIXTURE_MODE: mode,
                EMBER_MCP_FIXTURE_LOG: logPath,
            },
            initializationTimeoutMs: 1_000,
            requestTimeoutMs,
            closeTimeoutMs: 1_000,
        });
        return { directory, logPath, source };
    } catch (error) {
        await rm(directory, { recursive: true, force: true });
        throw error;
    }
}

async function events(logPath: string) {
    try {
        return (await readFile(logPath, "utf8"))
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => JSON.parse(line));
    } catch (error) {
        if (isObject(error) && error.code === "ENOENT") return [];
        throw error;
    }
}

async function closeSourceFixture(fixture: SourceFixture) {
    try {
        await fixture.source.close();
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
}

async function startedRuntimeFixture() {
    const directory = await tempDir();
    const store = new StateStore(join(directory, "ember.json"));
    const populated = populatedState();
    await store.create(populated.state);
    const lease = await store.acquireWriteLease();
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-09-08T07:00:00Z" });
    const state = await store.commit(loaded.revision, started.state);
    return { directory, store, lease, state, runtimeId: started.runtimeId };
}

async function closeRuntimeFixture(fixture) {
    try {
        await fixture.store.releaseWriteLease(fixture.lease);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
}

async function discoverLookup(source: McpCapabilitySource, overrides: Partial<McpCapabilityPolicy> = {}) {
    const discovered = await source.discover();
    assert.deepEqual(
        discovered.map((tool) => tool.sourceToolName).sort(),
        ["remote_hidden", "remote_lookup"],
    );
    const lookup = discovered.find((tool) => tool.sourceToolName === "remote_lookup");
    assert.equal(lookup?.sourceDescription, "Mechanically discovered deterministic lookup");
    return source.bind("remote_lookup", policy(overrides));
}

function toolCalls(logged: readonly unknown[]) {
    return logged.filter((event) => isObject(event) && event.method === "tools/call");
}

test("MCP discovery should remain mechanical while only Ember-mapped selected capabilities enter the real AI SDK cognition loop", async () => {
    const sourceFixture = await openSource();
    const runtimeFixture = await startedRuntimeFixture();
    const ledger = createCapabilityExecutionLedger();
    let step = 0;
    let sourceClosed = false;

    try {
        const capability = await discoverLookup(sourceFixture.source);
        const model = new MockLanguageModelV3({
            provider: "mcp-test-provider",
            modelId: "mcp-test-model",
            doGenerate: async (options) => {
                if (step++ === 0) {
                    assert.deepEqual(selectedToolNames(options), ["mcpLookup"]);
                    assert.equal(JSON.stringify(options.tools).includes("remote_hidden"), false);
                    assert.equal(JSON.stringify(options.tools).includes("remote_lookup"), false);
                    return toolCall("mcpLookup", { key: "timezone" });
                }
                const prompt = JSON.stringify(options.prompt);
                assert.match(prompt, /capability_execution_evidence/);
                assert.match(prompt, /"outcome":"succeeded"/);
                assert.match(prompt, /UTC/);
                return generated({ contractVersion: 1, reply: "MCP-backed lookup completed", usedMeaningIds: [] });
            },
        });

        const result = await runCognition(runtimeFixture.store, runtimeFixture.state, {
            runtimeId: runtimeFixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "look up the timezone",
            providerLabel: "ai-sdk-mcp",
            timeoutSeconds: 1,
            output: () => {},
            provider: createAiSdkProvider(model, {
                selectCapabilities: () => [capability],
                capabilityLedger: ledger,
            }),
        });

        assert.equal(result.providerFailure, null);
        assert.equal(findCognition(result.state, result.cognitionId).status, "completed");
        assert.equal(ledger.entries.length, 1);
        assert.equal(ledger.entries[0].outcome, "succeeded");
        assert.deepEqual(ledger.entries[0].output, { text: ["UTC"] });
        const logged = await events(sourceFixture.logPath);
        assert.equal(toolCalls(logged).length, 1);
        assert.equal(JSON.stringify(logged).includes("remote_hidden\",\"arguments"), false);

        const serializedState = JSON.stringify(result.state);
        for (const operationalIdentifier of [
            "remote_lookup",
            "remote_hidden",
            "mcp-call-1",
            "mcp-test-provider",
            "mcp-test-model",
            "deterministic-test-source",
            "capability_execution_evidence",
        ]) {
            assert.equal(serializedState.includes(operationalIdentifier), false, operationalIdentifier);
        }

        await sourceFixture.source.close();
        sourceClosed = true;
        const afterClose = await events(sourceFixture.logPath);
        assert.ok(afterClose.some((event) => isObject(event) && event.event === "shutdown"));
    } finally {
        if (!sourceClosed) await sourceFixture.source.close().catch(() => {});
        await rm(sourceFixture.directory, { recursive: true, force: true });
        await closeRuntimeFixture(runtimeFixture);
    }
});

test("MCP technical reachability should not bypass Ember authority denial", async () => {
    const fixture = await openSource();
    try {
        const capability = await discoverLookup(fixture.source, {
            authorize: () => ({ status: "denied", reason: "no current authority for remote lookup" }),
        });
        const result = await createCapabilityExecutionFirewall([capability], context()).execute("mcpLookup", {
            key: "timezone",
        });

        assert.equal(result.outcome, "authority_denied");
        assert.equal(result.executionAttempted, false);
        assert.equal(toolCalls(await events(fixture.logPath)).length, 0);
    } finally {
        await closeSourceFixture(fixture);
    }
});

test("MCP capability semantic argument rejection should happen before remote invocation", async () => {
    const fixture = await openSource();
    try {
        const capability = await discoverLookup(fixture.source, {
            validateInput: (_context, input) =>
                isObject(input) && input.key === "timezone"
                    ? { status: "allowed" }
                    : { status: "rejected", reason: "key is outside the Ember-selected target set" },
        });
        const result = await createCapabilityExecutionFirewall([capability], context()).execute("mcpLookup", {
            key: "hidden",
        });

        assert.equal(result.outcome, "input_rejected");
        assert.equal(result.executionAttempted, false);
        assert.equal(toolCalls(await events(fixture.logPath)).length, 0);
    } finally {
        await closeSourceFixture(fixture);
    }
});

test("MCP discovery failure should remain a source failure before any tool effect is attempted", async () => {
    const fixture = await openSource("discovery-failure");
    try {
        await assert.rejects(
            fixture.source.discover(),
            (error) => error instanceof McpCapabilitySourceError && error.phase === "discovery",
        );
        assert.equal(toolCalls(await events(fixture.logPath)).length, 0);
    } finally {
        await closeSourceFixture(fixture);
    }
});

test("MCP source closure before request submission should produce safely retryable pre-effect failure evidence", async () => {
    const fixture = await openSource();
    let closed = false;
    try {
        const capability = await discoverLookup(fixture.source);
        await fixture.source.close();
        closed = true;
        const result = await createCapabilityExecutionFirewall([capability], context()).execute("mcpLookup", {
            key: "timezone",
        });

        assert.equal(result.outcome, "failed");
        assert.equal(result.executionAttempted, true);
        assert.equal(result.retry, "safe");
        assert.match(result.reason ?? "", /no remote effect began/);
        const logged = await events(fixture.logPath);
        assert.equal(toolCalls(logged).length, 0);
        assert.ok(logged.some((event) => isObject(event) && event.event === "shutdown"));
    } finally {
        if (!closed) await fixture.source.close().catch(() => {});
        await rm(fixture.directory, { recursive: true, force: true });
    }
});

test("MCP explicit tool failure should remain observed failure rather than success or transport uncertainty", async () => {
    const fixture = await openSource("tool-error");
    try {
        const capability = await discoverLookup(fixture.source);
        const result = await createCapabilityExecutionFirewall([capability], context()).execute("mcpLookup", {
            key: "timezone",
        });

        assert.equal(result.outcome, "failed");
        assert.equal(result.executionAttempted, true);
        assert.equal(result.retry, "unsafe");
        assert.match(result.reason ?? "", /explicit tool failure/);
        assert.equal(toolCalls(await events(fixture.logPath)).length, 1);
    } finally {
        await closeSourceFixture(fixture);
    }
});

test("MCP timeout after request submission should preserve outcome uncertainty and never retry blindly", async () => {
    const fixture = await openSource("timeout-on-call", 50);
    try {
        const capability = await discoverLookup(fixture.source);
        const result = await createCapabilityExecutionFirewall([capability], context()).execute("mcpLookup", {
            key: "timezone",
        });

        assert.equal(result.outcome, "outcome_unknown");
        assert.equal(result.executionAttempted, true);
        assert.equal(result.retry, "unsafe");
        assert.match(result.reason ?? "", /effects may have occurred/);
        assert.equal(toolCalls(await events(fixture.logPath)).length, 1);
    } finally {
        await closeSourceFixture(fixture);
    }
});

test("MCP disconnect after request submission should preserve outcome uncertainty and never retry blindly", async () => {
    const fixture = await openSource("disconnect-on-call", 250);
    try {
        const capability = await discoverLookup(fixture.source);
        const result = await createCapabilityExecutionFirewall([capability], context()).execute("mcpLookup", {
            key: "timezone",
        });

        assert.equal(result.outcome, "outcome_unknown");
        assert.equal(result.executionAttempted, true);
        assert.equal(result.retry, "unsafe");
        assert.equal(toolCalls(await events(fixture.logPath)).length, 1);
    } finally {
        await closeSourceFixture(fixture);
    }
});

function isObject(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
