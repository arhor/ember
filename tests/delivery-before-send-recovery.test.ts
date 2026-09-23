import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFileBackedRepositoriesForState } from "../src/composition/ember.ts";
import { initialState } from "../src/core/model.ts";
import { startRuntime } from "../src/core/runtime-episode.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import {
    InteractionLedgerStore,
    reconcileSurfaceDelivery,
    runSurfaceInteraction,
} from "../src/runtime/interaction-boundary.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

test("restart sends a retained delivery intent that never crossed the external send boundary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-before-send-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState(PRINCIPAL));
    const lease = await store.acquireWriteLease();
    let providerCalls = 0;
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, PRINCIPAL, SCOPE);
        const state = await store.commit(loaded.revision, started.state);
        const ledger = new InteractionLedgerStore(statePath);
        const repositories = createFileBackedRepositoriesForState(store);
        const createIntent = repositories.interactions.createDeliveryIntent.bind(repositories.interactions);
        repositories.interactions.createDeliveryIntent = async (...arguments_) => {
            await createIntent(...arguments_);
            throw new Error("simulated process loss after durable intent");
        };

        await assert.rejects(
            runSurfaceInteraction(repositories, state, {
                runtimeId: started.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "prepare one durable reply",
                providerLabel: "fixture-provider",
                timeoutSeconds: 1,
                executor: async () => {
                    providerCalls += 1;
                    return { contractVersion: 1, reply: "reply retained before send", usedMeaningIds: [] };
                },
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "update-before-send" },
                deliveryDestinationId: "chat-before-send",
                deliver: () => assert.fail("transport must not start before the injected process loss"),
            }),
            /simulated process loss after durable intent/,
        );

        assert.equal(providerCalls, 1);
        const beforeRestart = await ledger.load();
        assert.equal(beforeRestart.deliveries.length, 1);
        assert.equal(beforeRestart.deliveries[0]?.representation?.text, "reply retained before send\n");
        assert.deepEqual(beforeRestart.deliveries[0]?.attempts, []);
    } finally {
        await store.releaseWriteLease(lease);
    }

    try {
        const restartedStore = new StateStore(statePath);
        const restartedLease = await restartedStore.acquireWriteLease();
        try {
            const ledger = await new InteractionLedgerStore(statePath).load();
            const delivery = ledger.deliveries[0];
            assert.ok(delivery);
            let sends = 0;
            const result = await reconcileSurfaceDelivery(
                createFileBackedRepositoriesForState(restartedStore),
                delivery.delivery_id,
                (text) => {
                    sends += 1;
                    assert.equal(text, "reply retained before send\n");
                    return { externalMessageId: "message-after-restart" };
                },
            );

            assert.equal(result.status, "confirmed");
            assert.equal(sends, 1);
            assert.equal(providerCalls, 1);
            const recovered = await new InteractionLedgerStore(statePath).load();
            assert.equal(recovered.deliveries[0]?.attempts.length, 1);
            assert.equal(recovered.deliveries[0]?.attempts[0]?.outcome, "confirmed");
            assert.equal(recovered.deliveries[0]?.attempts[0]?.external_message_id, "message-after-restart");
            assert.equal((await restartedStore.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "displayed");
        } finally {
            await restartedStore.releaseWriteLease(restartedLease);
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
