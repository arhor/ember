import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ProviderInvoker } from "../src/providers/contract.ts";

import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import {
    InteractionLedgerStore,
    SurfaceDeliveryFailure,
    interactionLedgerInspectionView,
    reconcileSurfaceDelivery,
    runSurfaceInteraction,
} from "../src/runtime/interaction-boundary.ts";
import { startRuntime } from "../src/runtime/runtime.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-reconciliation-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState("Ember", PRINCIPAL));
    const lease = await store.acquireWriteLease();
    let leaseHeld = true;
    const releaseWriter = async () => {
        if (!leaseHeld) return;
        await store.releaseWriteLease(lease);
        leaseHeld = false;
    };
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE);
    const state = await store.commit(loaded.revision, started.state);
    return {
        directory,
        statePath,
        store,
        state,
        runtimeId: started.runtimeId,
        releaseWriter,
        close: async () => {
            await releaseWriter();
            await rm(directory, { recursive: true, force: true });
        },
    };
}

async function withRestartedWriter<T>(f: Awaited<ReturnType<typeof fixture>>, operation: (store: StateStore) => Promise<T>) {
    await f.releaseWriter();
    const restartedStore = new StateStore(f.statePath);
    const lease = await restartedStore.acquireWriteLease();
    try {
        return await operation(restartedStore);
    } finally {
        await restartedStore.releaseWriteLease(lease);
    }
}

function provider(calls: { value: number }): ProviderInvoker {
    return async () => {
        calls.value += 1;
        return { contract_version: 1, reply: "durable reply", used_meaning_ids: [] };
    };
}

async function createRetryableFailure(
    f: Awaited<ReturnType<typeof fixture>>,
    calls: { provider: number; delivery: number },
) {
    const providerCalls = { value: 0 };
    await assert.rejects(
        runSurfaceInteraction(f.store, f.state, {
            runtimeId: f.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "send this once",
            command: "fixture-provider",
            timeoutSeconds: 1,
            provider: provider(providerCalls),
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-retry" },
            deliveryDestinationId: "chat-retry",
            deliver: () => {
                calls.delivery += 1;
                throw new SurfaceDeliveryFailure("transport was unavailable before acceptance", {
                    outcome: "failed",
                    retryable: true,
                });
            },
        }),
        /transport was unavailable before acceptance/,
    );
    calls.provider = providerCalls.value;
    const ledger = await new InteractionLedgerStore(f.statePath).load();
    assert.equal(ledger.deliveries.length, 1);
    return ledger.deliveries[0]!;
}

test("definite retryable delivery failure survives restart and retries the same representation without new cognition", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, delivery: 0 };
        const failed = await createRetryableFailure(f, calls);
        assert.equal(failed.representation?.text, "durable reply\n");
        assert.equal(failed.attempts[0]?.outcome, "failed");
        assert.equal(failed.attempts[0]?.retryable, true);

        await withRestartedWriter(f, async (restartedStore) => {
            const result = await reconcileSurfaceDelivery(restartedStore, failed.delivery_id, (text) => {
                calls.delivery += 1;
                assert.equal(text, "durable reply\n");
                return { externalMessageId: "message-retry-ok" };
            });

            assert.equal(result.status, "confirmed");
            const state = await restartedStore.load();
            assert.equal(state.operations.cognition_episodes.length, 1);
            assert.equal(state.operations.cognition_episodes[0]?.delivery_status, "displayed");
        });

        assert.equal(calls.provider, 1);
        assert.equal(calls.delivery, 2);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.deepEqual(
            ledger.deliveries[0]?.attempts.map((attempt) => attempt.outcome),
            ["failed", "confirmed"],
        );
        assert.equal(ledger.deliveries[0]?.attempts[1]?.external_message_id, "message-retry-ok");
    } finally {
        await f.close();
    }
});

test("restart turns an unresolved started send into uncertainty instead of blindly resending", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, delivery: 0 };
        const failed = await createRetryableFailure(f, calls);
        const ledger = new InteractionLedgerStore(f.statePath);
        const started = await ledger.startDeliveryAttempt(failed.delivery_id);
        assert.equal(started.outcome, "started");

        await withRestartedWriter(f, async (restartedStore) => {
            let resendCalls = 0;
            const result = await reconcileSurfaceDelivery(restartedStore, failed.delivery_id, () => {
                resendCalls += 1;
            });

            assert.equal(result.status, "blocked_uncertain");
            assert.equal(result.attemptId, started.attempt_id);
            assert.equal(resendCalls, 0);
            const recovered = await new InteractionLedgerStore(f.statePath).load();
            assert.equal(recovered.deliveries[0]?.attempts.at(-1)?.outcome, "uncertain");
            assert.equal((await restartedStore.load()).operations.cognition_episodes[0]?.delivery_status, "pending");
        });
        assert.equal(calls.provider, 1);
    } finally {
        await f.close();
    }
});

test("confirmed delivery evidence reconciles canonical pending status without sending again", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, delivery: 0 };
        const failed = await createRetryableFailure(f, calls);
        const ledger = new InteractionLedgerStore(f.statePath);
        const started = await ledger.startDeliveryAttempt(failed.delivery_id);
        await ledger.finishDeliveryAttempt(started.attempt_id, "confirmed", {
            externalMessageId: "already-sent",
        });
        assert.equal((await f.store.load()).operations.cognition_episodes[0]?.delivery_status, "pending");

        await withRestartedWriter(f, async (restartedStore) => {
            let resendCalls = 0;
            const result = await reconcileSurfaceDelivery(restartedStore, failed.delivery_id, () => {
                resendCalls += 1;
            });

            assert.equal(result.status, "confirmed");
            assert.equal(resendCalls, 0);
            assert.equal((await restartedStore.load()).operations.cognition_episodes[0]?.delivery_status, "displayed");
        });
    } finally {
        await f.close();
    }
});

test("legacy interaction ledger migrates without inventing a lost delivery representation", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, delivery: 0 };
        await createRetryableFailure(f, calls);
        const current = await new InteractionLedgerStore(f.statePath).load();
        const legacy = {
            ledger_version: 1,
            inbound_occurrences: current.inbound_occurrences,
            deliveries: current.deliveries.map(({ representation: _representation, attempts, ...delivery }) => ({
                ...delivery,
                attempts: attempts.map(
                    ({ observed_at: _observedAt, retryable: _retryable, retry_after_seconds: _retryAfter, ...attempt }) =>
                        attempt,
                ),
            })),
        };
        await writeFile(`${f.statePath}.interactions.json`, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");

        const migrated = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(migrated.ledger_version, 2);
        assert.equal(migrated.deliveries[0]?.representation, null);
        assert.equal(migrated.deliveries[0]?.attempts[0]?.retryable, false);
        assert.equal(migrated.deliveries[0]?.attempts[0]?.observed_at, migrated.deliveries[0]?.attempts[0]?.attempted_at);
    } finally {
        await f.close();
    }
});

test("inspection exposes delivery representation availability and digest without the payload", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, delivery: 0 };
        await createRetryableFailure(f, calls);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        const inspected = interactionLedgerInspectionView(ledger);
        const serialized = JSON.stringify(inspected);
        assert.equal(serialized.includes("durable reply"), false);
        assert.equal(inspected.deliveries[0]?.representation.available, true);
        assert.match(inspected.deliveries[0]?.representation.content_digest ?? "", /^sha256:[0-9a-f]{64}$/);
    } finally {
        await f.close();
    }
});
