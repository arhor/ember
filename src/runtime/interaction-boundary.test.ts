import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ProviderInvoker, ProviderRequest } from "../providers/contract.ts";
import type { SurfaceDeliveryReceipt } from "./interaction-boundary.ts";

import { executeInteraction } from "../app/application.ts";
import { createFileBackedRepositoriesForState } from "../composition/ember.ts";
import { initialState } from "../core/model.ts";
import { startRuntime } from "../core/runtime-episode.ts";
import { StateStore } from "../persistence/state-store.ts";
import { InteractionLedgerStore, SurfaceDeliveryFailure } from "./interaction-boundary.ts";

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
    await store.create(initialState(PRINCIPAL));
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

function countingProvider(calls: { value: number }, observe?: (request: ProviderRequest) => void): ProviderInvoker {
    return async (request) => {
        calls.value += 1;
        observe?.(request);
        return { contractVersion: 1, reply: "reply", usedMeaningIds: [] };
    };
}

function options(
    runtimeId: Fixture["runtimeId"],
    provider: ProviderInvoker,
    deliver: (text: string) => void | SurfaceDeliveryReceipt | Promise<void | SurfaceDeliveryReceipt>,
) {
    return {
        runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "same text",
        providerLabel: "fixture-provider",
        timeoutSeconds: 1,
        executor: provider,
        deliver,
    } as const;
}

test("CLI-shaped identical inputs remain distinct semantic occurrences", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const delivered: string[] = [];
        const provider = countingProvider(calls);

        const first = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...options(f.runtimeId, provider, (text) => {
                delivered.push(text);
            }),
            surfaceId: "local_cli",
            principalProvenance: "explicit_local_argument",
        });
        const second = await executeInteraction(createFileBackedRepositoriesForState(f.store), first.state, {
            ...options(f.runtimeId, provider, (text) => {
                delivered.push(text);
            }),
            surfaceId: "local_cli",
            principalProvenance: "explicit_local_argument",
        });

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 2);
        assert.notEqual(first.occurrenceId, second.occurrenceId);
        assert.notEqual(first.cognitionId, second.cognitionId);
        assert.equal(second.state.operations.cognitionEpisodes.length, 2);
        assert.equal(ledger.inbound_occurrences.length, 2);
        assert.equal(ledger.deliveries.length, 2);
        assert.deepEqual(delivered, ["reply\n", "reply\n"]);
    } finally {
        await f.close();
    }
});

test("surface delivery representation is durable before memory reflection starts", async () => {
    const f = await fixture();
    try {
        let reflected = false;
        const delivered: string[] = [];
        const result = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...options(f.runtimeId, countingProvider({ value: 0 }), (text) => {
                delivered.push(text);
            }),
            surfaceId: "local_cli",
            principalProvenance: "explicit_local_argument",
            postTurn: async () => {
                const ledger = await new InteractionLedgerStore(f.store.path).load();
                assert.equal(ledger.deliveries.length, 1);
                assert.equal(ledger.deliveries[0]?.representation?.text, "reply\n");
                assert.deepEqual(ledger.deliveries[0]?.attempts, []);
                reflected = true;
                return { memoryProposalFailure: null, onboardingProgressFailure: null };
            },
        });

        assert.equal(reflected, true);
        assert.equal(result.memoryProposalFailure, null);
        assert.deepEqual(delivered, ["reply\n"]);
    } finally {
        await f.close();
    }
});

test("replayed messaging update reuses one occurrence and does not repeat cognition or delivery", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const delivered: string[] = [];
        const provider = countingProvider(calls, (request) => {
            assert.equal(request.projection.surface, "messaging:test");
            assert.equal(JSON.stringify(request.projection).includes("update-42"), false);
        });
        const externalOccurrence = {
            occurrenceId: "update-42",
            messageId: "message-7",
            threadId: "chat-1",
            correlationId: "correlation-42",
            occurredAt: "2026-09-05T10:00:00Z",
        } as const;
        const deliver = (text: string) => {
            delivered.push(text);
            return { externalMessageId: "outbound-message-7" };
        };

        const first = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...options(f.runtimeId, provider, deliver),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence,
            deliveryDestinationId: "chat-1",
        });
        const second = await executeInteraction(createFileBackedRepositoriesForState(f.store), first.state, {
            ...options(f.runtimeId, provider, deliver),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence,
            deliveryDestinationId: "chat-1",
        });

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        const userEvidence = second.state.evidence.filter((evidence) => evidence.sourceRole === "user_command");
        assert.equal(calls.value, 1);
        assert.equal(second.replayed, true);
        assert.equal(first.occurrenceId, second.occurrenceId);
        assert.equal(first.cognitionId, second.cognitionId);
        assert.equal(second.state.operations.cognitionEpisodes.length, 1);
        assert.equal(userEvidence.length, 1);
        assert.equal(ledger.inbound_occurrences.length, 1);
        assert.equal(ledger.inbound_occurrences[0]?.receive_count, 2);
        assert.equal(ledger.inbound_occurrences[0]?.delivery_destination_id, "chat-1");
        assert.equal(ledger.deliveries.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "confirmed");
        assert.equal(ledger.deliveries[0]?.attempts[0]?.external_message_id, "outbound-message-7");
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

        const first = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...shared,
            externalOccurrence: { occurrenceId: "update-1" },
        });
        const second = await executeInteraction(createFileBackedRepositoriesForState(f.store), first.state, {
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
        const first = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...options(f.runtimeId, provider, () => {}),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-9", messageId: "message-9" },
            deliveryDestinationId: "chat-9",
        });

        await assert.rejects(
            executeInteraction(createFileBackedRepositoriesForState(f.store), first.state, {
                ...options(f.runtimeId, provider, () => {}),
                text: "changed payload",
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "update-9", messageId: "message-9" },
                deliveryDestinationId: "chat-9",
            }),
            /replay conflicts with the established occurrence metadata/,
        );
        await assert.rejects(
            executeInteraction(createFileBackedRepositoriesForState(f.store), first.state, {
                ...options(f.runtimeId, provider, () => {}),
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "update-9", messageId: "message-9" },
                deliveryDestinationId: "other-chat",
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

test("rejected principal assertion does not establish an accepted occurrence", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const provider = countingProvider(calls);

        await assert.rejects(
            executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
                ...options(f.runtimeId, provider, () => {}),
                principal: "intruder",
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "unauthorized-update" },
            }),
            /principal/,
        );

        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 0);
        assert.equal(ledger.inbound_occurrences.length, 0);
    } finally {
        await f.close();
    }
});

test("invalid surface cognition preflight does not advance a fresh conversation trajectory", async () => {
    const f = await fixture();
    try {
        const repositories = createFileBackedRepositoriesForState(f.store);
        const before = await repositories.conversation.load();
        let providerCalled = false;

        await assert.rejects(
            executeInteraction(repositories, f.state, {
                ...options(
                    f.runtimeId,
                    async () => {
                        providerCalled = true;
                        return { contractVersion: 1, reply: "unexpected", usedMeaningIds: [] };
                    },
                    () => {},
                ),
                providerLabel: "   ",
                surfaceId: "local_cli",
                principalProvenance: "explicit_local_argument",
                conversationMembership: { action: "fresh", basis: "explicit_boundary" },
            }),
            /provider label must be non-empty/,
        );

        assert.equal(providerCalled, false);
        assert.deepEqual(await repositories.conversation.load(), before);
    } finally {
        await f.close();
    }
});

test("completed cognition remains separate from an uncertain delivery attempt", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const provider = countingProvider(calls);

        const result = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...options(f.runtimeId, provider, () => {
                throw new Error("transport write failed");
            }),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-failure" },
            deliveryDestinationId: "chat-failure",
        });
        assert.equal(result.delivery?.status, "blocked_uncertain");

        const state = await f.store.load();
        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 1);
        assert.equal(state.operations.cognitionEpisodes.length, 1);
        assert.equal(state.operations.cognitionEpisodes[0]?.status, "completed");
        assert.equal(state.operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
        assert.equal(ledger.deliveries.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "uncertain");
    } finally {
        await f.close();
    }
});

test("surface adapter can record a definite failed delivery attempt", async () => {
    const f = await fixture();
    try {
        const calls = { value: 0 };
        const provider = countingProvider(calls);

        const result = await executeInteraction(createFileBackedRepositoriesForState(f.store), f.state, {
            ...options(f.runtimeId, provider, () => {
                throw new SurfaceDeliveryFailure("transport rejected send", {
                    outcome: "failed",
                    externalMessageId: "rejected-message-1",
                });
            }),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-definite-failure" },
            deliveryDestinationId: "chat-definite-failure",
        });
        assert.equal(result.delivery?.status, "failed_non_retryable");

        const state = await f.store.load();
        const ledger = await new InteractionLedgerStore(f.store.path).load();
        assert.equal(calls.value, 1);
        assert.equal(state.operations.cognitionEpisodes[0]?.status, "completed");
        assert.equal(state.operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "failed");
        assert.equal(ledger.deliveries[0]?.attempts[0]?.external_message_id, "rejected-message-1");
    } finally {
        await f.close();
    }
});
