import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createEmberApplication } from "../src/core/app/application.ts";
import { composeEmberApplication, createFileBackedRepositoriesForState } from "../src/core/composition/ember.ts";
import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { InteractionLedgerStore, reconcileSurfaceDelivery } from "../src/runtime/interaction-boundary.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

test("restart sends a retained delivery intent that never crossed the external send boundary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-before-send-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState(PRINCIPAL));
    let providerCalls = 0;
    {
        const ledger = new InteractionLedgerStore(statePath);
        const dependencies = composeEmberApplication(
            {
                statePath,
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                executor: async () => {
                    providerCalls += 1;
                    return { contractVersion: 1, reply: "reply retained before send", usedMeaningIds: [] };
                },
            },
        );
        const createIntent = dependencies.repositories.interactions.createDeliveryIntent.bind(
            dependencies.repositories.interactions,
        );
        dependencies.repositories.interactions.createDeliveryIntent = async (...arguments_) => {
            await createIntent(...arguments_);
            throw new Error("simulated process loss after durable intent");
        };

        await assert.rejects(
            createEmberApplication(dependencies).interact(
                {
                    kind: "message",
                    principal: PRINCIPAL,
                    scope: SCOPE,
                    text: "prepare one durable reply",
                    surfaceId: "messaging:test",
                    principalProvenance: "configured_surface_mapping",
                    externalOccurrence: { occurrenceId: "update-before-send" },
                    deliveryDestinationId: "chat-before-send",
                },
                async () => assert.fail("transport must not start before the injected process loss"),
            ),
            /simulated process loss after durable intent/,
        );

        assert.equal(providerCalls, 1);
        const beforeRestart = await ledger.load();
        assert.equal(beforeRestart.deliveries.length, 1);
        assert.equal(beforeRestart.deliveries[0]?.representation?.text, "reply retained before send\n");
        assert.deepEqual(beforeRestart.deliveries[0]?.attempts, []);
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
