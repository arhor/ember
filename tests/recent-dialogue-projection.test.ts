import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { EmberState } from "../src/core/model.ts";
import type { ProviderInvoker, ProviderRequest } from "../src/providers/contract.ts";

import { RECENT_DIALOGUE_MAX_EXCHANGES, RECENT_DIALOGUE_MAX_TURN_BYTES } from "../src/core/conversation-context.ts";
import { ProviderError } from "../src/core/errors.ts";
import { initialState } from "../src/core/model.ts";
import { rememberFact } from "../src/core/semantics.ts";
import { ConversationContextStore } from "../src/persistence/conversation-context-store.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { runCognition, startRuntime, stopRuntime } from "../src/runtime/runtime.ts";
import { PRINCIPAL, SCOPE, tempDir } from "./support.ts";

interface Fixture {
    directory: string;
    store: StateStore;
    lease: Awaited<ReturnType<StateStore["acquireWriteLease"]>>;
    state: EmberState;
    runtimeId: ReturnType<typeof startRuntime>["runtimeId"];
}

async function startedFixture(): Promise<Fixture> {
    const directory = await tempDir();
    const store = new StateStore(join(directory, "ember.json"));
    await store.create(initialState("Ember", PRINCIPAL, "2026-09-09T12:00:00Z"));
    const lease = await store.acquireWriteLease();
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-09-09T12:01:00Z" });
    const state = await store.commit(loaded.revision, started.state);
    return { directory, store, lease, state, runtimeId: started.runtimeId };
}

async function closeFixture(fixture: Fixture) {
    try {
        await fixture.store.releaseWriteLease(fixture.lease);
    } finally {
        await rm(fixture.directory, { recursive: true, force: true });
    }
}

function capturingProvider(requests: ProviderRequest[], reply: (request: ProviderRequest) => string): ProviderInvoker {
    return async (request) => {
        requests.push(structuredClone(request));
        return {
            contractVersion: 1,
            reply: reply(request),
            usedMeaningIds: [],
        };
    };
}

async function runTurn(
    fixture: Fixture,
    provider: ProviderInvoker,
    text: string,
    { surface = "local_cli" }: { surface?: string } = {},
) {
    const result = await runCognition(fixture.store, fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        surface,
        text,
        providerLabel: "fixture",
        provider,
        timeoutSeconds: 1,
        output: () => {},
    });
    fixture.state = result.state;
}

async function cleanRestart(fixture: Fixture) {
    const stopped = stopRuntime(fixture.state, fixture.runtimeId, { reason: "test_restart" });
    fixture.state = await fixture.store.commit(fixture.state.revision, stopped);
    await fixture.store.releaseWriteLease(fixture.lease);

    fixture.store = new StateStore(join(fixture.directory, "ember.json"));
    fixture.lease = await fixture.store.acquireWriteLease();
    const loaded = await fixture.store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE);
    fixture.state = await fixture.store.commit(loaded.revision, started.state);
    fixture.runtimeId = started.runtimeId;
}

test("second turn receives prior user and Ember turns separately from canonical meaning selection", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const provider = capturingProvider(requests, (request) =>
        request.input.text === "Choose between red and blue" ? "Red is first; blue is second." : "Using blue.",
    );
    try {
        await runTurn(fixture, provider, "Choose between red and blue");
        assert.deepEqual(requests[0]?.projection.conversation_context?.turns, []);

        await runTurn(fixture, provider, "Use the second one");
        const projection = requests[1]?.projection;
        assert.ok(projection?.conversation_context);
        assert.deepEqual(
            projection.conversation_context.turns.map((turn) => [turn.role, turn.content]),
            [
                ["user", "Choose between red and blue"],
                ["ember", "Red is first; blue is second."],
            ],
        );
        assert.equal(
            projection.conversation_context.turns[1]?.in_reply_to_evidence_id,
            projection.conversation_context.turns[0]?.evidence_id,
        );
        assert.equal(projection.conversation_context.turns[1]?.delivery_status, "displayed");
        assert.equal(projection.conversation_context.turns[1]?.user_awareness, "unknown");
        assert.deepEqual(projection.selection.evidence_ids, []);
        assert.equal(projection.conversation_context.selection.selected_evidence_ids.length, 2);
        assert.equal(projection.selection.raw_transcript_included, false);
    } finally {
        await closeFixture(fixture);
    }
});

test("accepted user turns survive provider failure without inventing an Ember turn across surfaces", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    let failNext = true;
    const provider: ProviderInvoker = async (request) => {
        requests.push(structuredClone(request));
        if (failNext) {
            failNext = false;
            throw new ProviderError("fixture provider failure");
        }
        return { contractVersion: 1, reply: "Retried.", usedMeaningIds: [] };
    };
    try {
        await runTurn(fixture, provider, "Try the blue option", { surface: "local_cli" });
        await runTurn(fixture, provider, "Retry that", { surface: "telegram_bot" });

        const context = requests[1]?.projection.conversation_context;
        assert.ok(context);
        assert.deepEqual(
            context.turns.map((turn) => [turn.role, turn.content, turn.source_surface]),
            [["user", "Try the blue option", "local_cli"]],
        );
        assert.equal(context.selection.selected_cognition_ids.length, 1);
        assert.equal(context.selection.selected_evidence_ids.length, 1);
        assert.equal(context.selection.unavailable_expression_count, 0);
    } finally {
        await closeFixture(fixture);
    }
});

test("conversation sidecar preserves durable acceptance order when timestamps tie", async () => {
    const fixture = await startedFixture();
    const conversationStore = new ConversationContextStore(fixture.store.path);
    try {
        const startedAt = "2026-09-09T12:02:00Z";
        const conversationId = await conversationStore.currentConversation(PRINCIPAL, SCOPE, startedAt);
        await conversationStore.recordAcceptedInput({
            conversation_id: conversationId,
            cognition_id: "cognition-z",
            principal: PRINCIPAL,
            scope: SCOPE,
            surface: "local_cli",
            input_evidence_id: "evidence-z",
            started_at: startedAt,
        });
        await conversationStore.recordAcceptedInput({
            conversation_id: conversationId,
            cognition_id: "cognition-a",
            principal: PRINCIPAL,
            scope: SCOPE,
            surface: "local_cli",
            input_evidence_id: "evidence-a",
            started_at: startedAt,
        });

        const document = await conversationStore.load();
        assert.deepEqual(
            document.exchanges.map((exchange) => exchange.cognition_id),
            ["cognition-z", "cognition-a"],
        );
    } finally {
        await closeFixture(fixture);
    }
});

test("recent dialogue selection is deterministic and excludes exchanges beyond the bound", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const provider = capturingProvider(requests, (request) => `reply:${request.input.text}`);
    try {
        for (let index = 0; index < RECENT_DIALOGUE_MAX_EXCHANGES + 2; index += 1) {
            await runTurn(fixture, provider, `turn-${index}`);
        }
        await runTurn(fixture, provider, "probe");

        const context = requests.at(-1)?.projection.conversation_context;
        assert.ok(context);
        assert.equal(context.selection.selected_cognition_ids.length, RECENT_DIALOGUE_MAX_EXCHANGES);
        assert.equal(context.turns.length, RECENT_DIALOGUE_MAX_EXCHANGES * 2);
        assert.equal(context.selection.excluded_older_exchange_count, 2);
        assert.equal(
            context.turns.some((turn) => turn.content.includes("turn-0")),
            false,
        );
        assert.equal(
            context.turns.some((turn) => turn.content.includes("turn-1")),
            false,
        );
        assert.deepEqual(
            context.turns.filter((turn) => turn.role === "user").map((turn) => turn.content),
            ["turn-2", "turn-3", "turn-4", "turn-5"],
        );
    } finally {
        await closeFixture(fixture);
    }
});

test("conversation turn payloads are deterministically truncated to the byte bound", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const longReply = "🦊".repeat(RECENT_DIALOGUE_MAX_TURN_BYTES);
    const provider = capturingProvider(requests, (request) => (request.input.text === "long" ? longReply : "done"));
    try {
        await runTurn(fixture, provider, "long");
        await runTurn(fixture, provider, "inspect");

        const emberTurn = requests[1]?.projection.conversation_context?.turns.find((turn) => turn.role === "ember");
        assert.ok(emberTurn);
        assert.equal(emberTurn.content_truncated, true);
        assert.ok(Buffer.byteLength(emberTurn.content, "utf8") <= RECENT_DIALOGUE_MAX_TURN_BYTES);
        assert.equal(requests[1]?.projection.conversation_context?.selection.truncated_turn_count, 1);
    } finally {
        await closeFixture(fixture);
    }
});

test("surface changes continue the active Ember-owned conversation trajectory", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const provider = capturingProvider(requests, () => "ack");
    try {
        await runTurn(fixture, provider, "cli context", { surface: "local_cli" });
        const firstConversationId = requests[0]?.projection.conversation_context?.conversation_id;
        assert.ok(firstConversationId);

        await runTurn(fixture, provider, "continue that", { surface: "telegram_bot" });
        const context = requests[1]?.projection.conversation_context;
        assert.ok(context);
        assert.equal(context.conversation_id, firstConversationId);
        assert.deepEqual(
            context.turns.map((turn) => [turn.role, turn.content, turn.source_surface]),
            [
                ["user", "cli context", "local_cli"],
                ["ember", "ack", "local_cli"],
            ],
        );
        assert.equal(context.selection.strategy, "recent_same_conversation_v2");
    } finally {
        await closeFixture(fixture);
    }
});

test("clean process restart continues the same conversation with a fresh provider invocation", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const provider = capturingProvider(requests, () => "ack");
    try {
        await runTurn(fixture, provider, "before restart", { surface: "local_cli" });
        const conversationId = requests[0]?.projection.conversation_context?.conversation_id;
        assert.ok(conversationId);

        await cleanRestart(fixture);
        await runTurn(fixture, provider, "after restart", { surface: "telegram_bot" });

        const context = requests[1]?.projection.conversation_context;
        assert.ok(context);
        assert.equal(context.conversation_id, conversationId);
        assert.deepEqual(
            context.turns.map((turn) => [turn.role, turn.content, turn.source_surface]),
            [
                ["user", "before restart", "local_cli"],
                ["ember", "ack", "local_cli"],
            ],
        );
    } finally {
        await closeFixture(fixture);
    }
});

test("starting a fresh conversation clears only transient dialogue and preserves canonical meaning and evidence", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const provider = capturingProvider(requests, () => "ack");
    const conversationStore = new ConversationContextStore(fixture.store.path);
    try {
        const candidate = structuredClone(fixture.state);
        const meaningId = rememberFact(
            candidate,
            PRINCIPAL,
            `user:${PRINCIPAL}`,
            "preferred-editor",
            SCOPE,
            "The preferred editor is Helix.",
        );
        fixture.state = await fixture.store.commit(fixture.state.revision, candidate);

        await runTurn(fixture, provider, "old trajectory", { surface: "local_cli" });
        const beforeReset = await conversationStore.load();
        const oldConversationId = beforeReset.active_trajectories[0]?.conversation_id;
        assert.ok(oldConversationId);
        const canonicalEvidenceIds = fixture.state.evidence.map((evidence) => evidence.evidenceId);

        const freshConversationId = await conversationStore.startFreshConversation(PRINCIPAL, SCOPE);
        assert.notEqual(freshConversationId, oldConversationId);
        assert.deepEqual(
            fixture.state.evidence.map((evidence) => evidence.evidenceId),
            canonicalEvidenceIds,
        );

        const afterReset = await conversationStore.load();
        assert.equal(afterReset.exchanges.some((exchange) => exchange.conversation_id === oldConversationId), true);
        assert.equal(afterReset.active_trajectories[0]?.conversation_id, freshConversationId);

        await runTurn(fixture, provider, "fresh trajectory", { surface: "telegram_bot" });
        const projection = requests[1]?.projection;
        assert.ok(projection?.conversation_context);
        assert.equal(projection.conversation_context.conversation_id, freshConversationId);
        assert.deepEqual(projection.conversation_context.turns, []);
        assert.equal(projection.selection.meaning_ids.includes(meaningId), true);

        const afterNewTurn = await conversationStore.load();
        assert.equal(afterNewTurn.exchanges.some((exchange) => exchange.conversation_id === oldConversationId), true);
        assert.equal(afterNewTurn.exchanges.some((exchange) => exchange.conversation_id === freshConversationId), true);
    } finally {
        await closeFixture(fixture);
    }
});

test("legacy surface-local histories migrate without silently merging unrelated trajectories", async () => {
    const fixture = await startedFixture();
    const conversationStore = new ConversationContextStore(fixture.store.path);
    try {
        await writeFile(
            conversationStore.path,
            `${JSON.stringify(
                {
                    conversation_context_version: 1,
                    exchanges: [
                        {
                            cognition_id: "cognition-cli",
                            principal: PRINCIPAL,
                            scope: SCOPE,
                            surface: "local_cli",
                            input_evidence_id: "evidence-cli",
                            started_at: "2026-09-09T12:02:00Z",
                            expression_evidence_id: null,
                            expression_occurred_at: null,
                            expression_content: null,
                            expression_content_truncated: null,
                        },
                        {
                            cognition_id: "cognition-telegram",
                            principal: PRINCIPAL,
                            scope: SCOPE,
                            surface: "telegram_bot",
                            input_evidence_id: "evidence-telegram",
                            started_at: "2026-09-09T12:03:00Z",
                            expression_evidence_id: null,
                            expression_occurred_at: null,
                            expression_content: null,
                            expression_content_truncated: null,
                        },
                    ],
                },
                null,
                2,
            )}\n`,
        );

        const migrated = await conversationStore.load();
        assert.equal(migrated.conversation_context_version, 2);
        assert.notEqual(migrated.exchanges[0]?.conversation_id, migrated.exchanges[1]?.conversation_id);
        assert.equal(migrated.active_trajectories.length, 1);
        assert.equal(migrated.active_trajectories[0]?.conversation_id, migrated.exchanges[1]?.conversation_id);
    } finally {
        await closeFixture(fixture);
    }
});
