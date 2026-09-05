import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ProviderInvoker } from "../providers/contract.ts";

import { initialState } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { InteractionLedgerStore, runSurfaceInteraction } from "./interaction-boundary.ts";
import { startRuntime } from "./runtime.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

interface Fixture {
    directory: string;
    store: StateStore;
    state: Awaited<ReturnType<StateStore["load"]>>;
    runtimeId: ReturnType<typeof startRuntime>["runtimeId"];
    close: () => Promise<void>;
}

async function fixture(): Promise<Fixture> {
    const directory = await mkdtemp(join(tmpdir(), "ember-interaction-"));
    const path = join(directory, "ember.json");
    const store = new StateStore(path);
    await store.create(initialState("Ember", PRINCIPAL));
    const lease = await store.acquireWriteLease();
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE);
    const state = await store.commit(loaded.revision, started.state);
    return {
        directory,
        store,
        state,
        runtimeId: started.runtimeId,
        close: async () => {
            await store.releaseWriteLease(lease);
            await rm(directory, { recursive: true, force: true });
        },
    };
}

function countingProvider(calls: { value: number }): ProviderInvoker {
    return async () => {
        calls.value += 1;
        return { contract_version: 1, reply: "reply", used_meaning_ids: [] };
    };
}

function options(
    runtimeId: Fixture["runtimeId"],
    provider: ProviderInvoker,
    output: (text: string) => void | Promise<void>,
) {
    return {
        runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "same text",
        command: "fixture-provider",
        timeoutSeconds: 1,
        provider,
        output,
    } as const;
}

test("CLI-shaped identical inputs remain distinct semantic occurrences", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const delivered: string[] = [];
        const provider = countingProvider(calls);

        const first = await runSurfaceInteraction(f.store, f.state, {
            ...options(f.runtimeId, provider, (text) => delivered.push(text)),
            surfaceId: "cli:local",
            principalProvenance: "explicit_local_argument",
        });
        const second = await runSurfaceInteraction(f.store, first.state, {
            ...options(f.runtimeId, provider, (text) => delivered.push(text)),
            surfaceId: "cli:local",
            principalProvenance: "explicit_local_argument",
        });

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 2);
        assert.notEqual(first.occurrenceId, second.occurrenceId);
        assert.notEqual(first.cognitionId, second.cognitionId);
        assert.equal(second.state.operations.cognition_episodes.length, 2);
        assert.equal(ledger.inbound_occurrences.length, 2);
        assert.equal(ledger.deliveries.length, 2);
        assert.deepEqual(delivered, ["reply\n", "reply\n"]);
    } finally {
        await f.close();
    }
});

test("replayed messaging update reuses one occurrence and does not repeat cognition or delivery", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const delivered: string[] = [];
        const provider = countingProvider(calls);
        const externalOccurrence = {
            occurrenceId: "update-42",
            messageId: "message-7",
            threadId: "chat-1",
            correlationId: "correlation-42",
            occurredAt: "2026-09-05T10:00:00Z",
        } as const;

        const first = await runSurfaceInteraction(f.store, f.state, {
            ...options(f.runtimeId, provider, (text) => delivered.push(text)),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence,
            deliveryDestinationId: "chat-1",
        });
        const second = await runSurfaceInteraction(f.store, first.state, {
            ...options(f.runtimeId, provider, (text) => delivered.push(text)),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence,
            deliveryDestinationId: "chat-1",
        });

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        const userEvidence = second.state.evidence.filter((evidence) => evidence.source_role === "user_command");
        assert.equal(calls.value, 1);
        assert.equal(second.replayed, true);
        assert.equal(first.occurrenceId, second.occurrenceId);
        assert.equal(first.cognitionId, second.cognitionId);
        assert.equal(second.state.operations.cognition_episodes.length, 1);
        assert.equal(userEvidence.length, 1);
        assert.equal(ledger.inbound_occurrences.length, 1);
        assert.equal(ledger.inbound_occurrences[0]?.receive_count, 2);
        assert.equal(ledger.deliveries.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "confirmed");
        assert.deepEqual(delivered, ["reply\n"]);
    } finally {
        await f.close();
    }
});

test("identical text with distinct transport occurrence ids remains distinct", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const provider = countingProvider(calls);
        const shared = {
            ...options(f.runtimeId, provider, () => {}),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping" as const,
        };

        const first = await runSurfaceInteraction(f.store, f.state, {
            ...shared,
            externalOccurrence: { occurrenceId: "update-1" },
        });
        const second = await runSurfaceInteraction(f.store, first.state, {
            ...shared,
            externalOccurrence: { occurrenceId: "update-2" },
        });

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 2);
        assert.equal(ledger.inbound_occurrences.length, 2);
        assert.notEqual(first.occurrenceId, second.occurrenceId);
    } finally {
        await f.close();
    }
});

test("conflicting replay metadata is rejected instead of becoming a second instruction", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const provider = countingProvider(calls);
        const first = await runSurfaceInteraction(f.store, f.state, {
            ...options(f.runtimeId, provider, () => {}),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-9", messageId: "message-9" },
        });

        await assert.rejects(
            runSurfaceInteraction(f.store, first.state, {
                ...options(f.runtimeId, provider, () => {}),
                text: "changed payload",
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "update-9", messageId: "message-9" },
            }),
            /replay conflicts with the established occurrence metadata/,
        );

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 1);
        assert.equal(ledger.inbound_occurrences.length, 1);
        assert.equal(ledger.inbound_occurrences[0]?.receive_count, 1);
    } finally {
        await f.close();
    }
});

test("completed cognition remains separate from an uncertain delivery attempt", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const provider = countingProvider(calls);

        await assert.rejects(
            runSurfaceInteraction(f.store, f.state, {
                ...options(f.runtimeId, provider, () => {
                    throw new Error("transport write failed");
                }),
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "update-failure" },
                deliveryDestinationId: "chat-failure",
            }),
            /transport write failed/,
        );

        const state = await f.store.load();
        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 1);
        assert.equal(state.operations.cognition_episodes.length, 1);
        assert.equal(state.operations.cognition_episodes[0]?.status, "completed");
        assert.equal(state.operations.cognition_episodes[0]?.delivery_status, "pending");
        assert.equal(ledger.deliveries.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "uncertain");
    } finally {
        await f.close();
    }
});
