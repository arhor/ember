import type { ClaudeCodeSettings } from "ai-sdk-provider-claude-code";

import { createAuthenticationError } from "ai-sdk-provider-claude-code";
import { MockLanguageModelV3 } from "ai/test";
import assert from "node:assert/strict";
import { test } from "node:test";

import { ProviderError } from "../src/core/errors.ts";
import { createClaudeCodeProvider, createClaudeCodeProviderWithDependencies } from "../src/providers/claude-code.ts";
import { captureError, emptyRequest } from "./support.ts";

function generated(value: unknown) {
    return {
        content: [{ type: "text" as const, text: JSON.stringify(value) }],
        finishReason: { unified: "stop" as const, raw: undefined },
        usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
    };
}

function testProvider(model: MockLanguageModelV3, capture: (settings: ClaudeCodeSettings) => void = () => {}) {
    const removed: string[] = [];
    const provider = createClaudeCodeProviderWithDependencies(
        {},
        {
            createModel: (_modelId, settings) => {
                capture(settings);
                return model;
            },
            createTemporaryDirectory: async () => "/isolated/ember-claude-code-test",
            removeTemporaryDirectory: async (directory) => {
                removed.push(directory);
            },
            environment: {
                PATH: "/bin",
                HOME: "/home/test",
                CLAUDE_CONFIG_DIR: "/home/test/.claude-alt",
                ANTHROPIC_API_KEY: "must-not-pass",
                ANTHROPIC_BASE_URL: "https://must-not-pass.example",
                CLAUDE_CODE_OAUTH_TOKEN: "must-not-pass",
                CLAUDE_CODE_USE_BEDROCK: "1",
                AWS_ACCESS_KEY_ID: "must-not-pass",
                GOOGLE_APPLICATION_CREDENTIALS: "/must-not-pass.json",
            },
        },
    );
    return { provider, removed };
}

test("Claude Code adapter fixes one-shot isolation and subscription-only environment policy", async () => {
    let captured: ClaudeCodeSettings | undefined;
    const model = new MockLanguageModelV3({
        doGenerate: async () => generated({ contractVersion: 1, reply: "isolated", usedMeaningIds: [] }),
    });
    const { provider, removed } = testProvider(model, (settings) => {
        captured = settings;
    });

    const result = await provider(emptyRequest(), { timeoutSeconds: 1 });

    assert.deepEqual(result, { contractVersion: 1, reply: "isolated", usedMeaningIds: [] });
    assert.ok(captured);
    assert.equal(captured.cwd, "/isolated/ember-claude-code-test");
    assert.equal(captured.maxTurns, 1);
    assert.equal(captured.permissionPrompts, "none");
    assert.deepEqual(captured.tools, []);
    assert.deepEqual(captured.allowedTools, []);
    assert.deepEqual(captured.mcpServers, {});
    assert.equal(captured.strictMcpConfig, true);
    assert.deepEqual(captured.settingSources, []);
    assert.deepEqual(captured.skills, []);
    assert.deepEqual(captured.plugins, []);
    assert.deepEqual(captured.agents, {});
    assert.equal(captured.persistSession, false);
    assert.equal(captured.streamingInput, "off");
    assert.equal(captured.logger, false);
    assert.equal(captured.env?.ANTHROPIC_API_KEY, undefined);
    assert.equal(captured.env?.ANTHROPIC_BASE_URL, undefined);
    assert.equal(captured.env?.CLAUDE_CODE_OAUTH_TOKEN, undefined);
    assert.equal(captured.env?.CLAUDE_CODE_USE_BEDROCK, undefined);
    assert.equal(captured.env?.AWS_ACCESS_KEY_ID, undefined);
    assert.equal(captured.env?.GOOGLE_APPLICATION_CREDENTIALS, undefined);
    assert.equal(Object.hasOwn(captured.env ?? {}, "CLAUDE_CONFIG_DIR"), false);
    assert.equal(Object.hasOwn(captured, "resume"), false);
    assert.equal(Object.hasOwn(captured, "continue"), false);
    assert.equal(Object.hasOwn(captured, "sessionId"), false);
    assert.equal(Object.hasOwn(captured, "settings"), false);
    assert.equal(Object.hasOwn(captured, "sdkOptions"), false);
    assert.deepEqual(removed, ["/isolated/ember-claude-code-test"]);
});

test("Claude Code adapter applies Ember provenance validation after AI SDK structured output", async () => {
    const model = new MockLanguageModelV3({
        doGenerate: async () => generated({ contractVersion: 1, reply: "bad provenance", usedMeaningIds: ["outside"] }),
    });
    const { provider } = testProvider(model);

    const error = await captureError(() => provider(emptyRequest(), { timeoutSeconds: 1 }));

    assert.ok(error instanceof ProviderError);
    assert.match(error.message, /outside its projection/i);
});

test("Claude Code adapter maps provider authentication failure without exposing raw diagnostics", async () => {
    const model = new MockLanguageModelV3({
        doGenerate: async () => {
            throw createAuthenticationError({ message: "raw provider authentication detail" });
        },
    });
    const { provider } = testProvider(model);

    const error = await captureError(() => provider(emptyRequest(), { timeoutSeconds: 1 }));

    assert.ok(error instanceof ProviderError);
    assert.match(error.message, /subscription authentication is unavailable/i);
    assert.match(error.message, /claude auth login/);
    assert.equal(error.message.includes("raw provider authentication detail"), false);
});

test("Claude Code adapter preserves cancellation uncertainty from the shared AI SDK boundary", async () => {
    const controller = new AbortController();
    const model = new MockLanguageModelV3({
        doGenerate: async ({ abortSignal }) =>
            new Promise((_, reject) => {
                abortSignal?.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
            }),
    });
    const { provider } = testProvider(model);
    const pending = captureError(() => provider(emptyRequest(), { timeoutSeconds: 10, signal: controller.signal }));

    controller.abort(new DOMException("cancelled", "AbortError"));
    const error = await pending;

    assert.ok(error instanceof ProviderError);
    assert.equal(error.outcome, "cancellation_requested");
    assert.deepEqual(error.termination, { reason: "explicit_cancellation", directChildExitObserved: false });
});

test("Claude Code adapter preserves timeout semantics from the shared AI SDK boundary", async () => {
    const model = new MockLanguageModelV3({
        doGenerate: async ({ abortSignal }) =>
            new Promise((_, reject) => {
                abortSignal?.addEventListener("abort", () => reject(abortSignal.reason), { once: true });
            }),
    });
    const { provider } = testProvider(model);

    const error = await captureError(() => provider(emptyRequest(), { timeoutSeconds: 0.01 }));

    assert.ok(error instanceof ProviderError);
    assert.equal(error.outcome, "timed_out");
    assert.equal(error.termination, null);
});

test("Claude Code adapter rejects provider-specific escape hatches", () => {
    assert.throws(
        () => createClaudeCodeProvider({ sdkOptions: { resume: "unsafe" } } as never),
        /unsupported Claude Code provider option: sdkOptions/,
    );
    assert.throws(() => createClaudeCodeProvider({ model: "" }), /model must be a non-empty string/);
});
