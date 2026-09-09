import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { EmberState } from "../src/core/model.ts";
import type { ProviderInvoker, ProviderRequest } from "../src/providers/contract.ts";

import {
    RECENT_DIALOGUE_MAX_EXCHANGES,
    RECENT_DIALOGUE_MAX_TURN_BYTES,
} from "../src/core/conversation-context.ts";
import { ProviderError } from "../src/core/errors.ts";
import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { runCognition, startRuntime } from "../src/runtime/runtime.ts";
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

function capturingProvider(
    requests: ProviderRequest[],
    reply: (request: ProviderRequest) => string,
): ProviderInvoker {
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

test("accepted user turns survive provider failure without inventing an Ember turn", async () => {
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
        await runTurn(fixture, provider, "Try the blue option");
        await runTurn(fixture, provider, "Retry that");

        const context = requests[1]?.projection.conversation_context;
        assert.ok(context);
        assert.deepEqual(
            context.turns.map((turn) => [turn.role, turn.content]),
            [["user", "Try the blue option"]],
        );
        assert.equal(context.selection.selected_cognition_ids.length, 1);
        assert.equal(context.selection.selected_evidence_ids.length, 1);
        assert.equal(context.selection.unavailable_expression_count, 0);
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
        assert.equal(context.turns.some((turn) => turn.content.includes("turn-0")), false);
        assert.equal(context.turns.some((turn) => turn.content.includes("turn-1")), false);
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
    const provider = capturingProvider(requests, (request) =>
        request.input.text === "long" ? longReply : "done",
    );
    try {
        await runTurn(fixture, provider, "long");
        await runTurn(fixture, provider, "inspect");

        const emberTurn = requests[1]?.projection.conversation_context?.turns.find(
            (turn) => turn.role === "ember",
        );
        assert.ok(emberTurn);
        assert.equal(emberTurn.content_truncated, true);
        assert.ok(Buffer.byteLength(emberTurn.content, "utf8") <= RECENT_DIALOGUE_MAX_TURN_BYTES);
        assert.equal(requests[1]?.projection.conversation_context?.selection.truncated_turn_count, 1);
    } finally {
        await closeFixture(fixture);
    }
});

test("surface changes do not silently inherit dialogue before cross-surface correlation semantics exist", async () => {
    const fixture = await startedFixture();
    const requests: ProviderRequest[] = [];
    const provider = capturingProvider(requests, () => "ack");
    try {
        await runTurn(fixture, provider, "cli-only context", { surface: "local_cli" });
        await runTurn(fixture, provider, "telegram turn", { surface: "telegram" });

        assert.deepEqual(requests[1]?.projection.conversation_context?.turns, []);
        assert.equal(
            requests[1]?.projection.conversation_context?.selection.strategy,
            "recent_same_principal_scope_surface_v1",
        );
    } finally {
        await closeFixture(fixture);
    }
});
