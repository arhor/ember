import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { InteractionLedgerStore, reconcileSurfaceDelivery } from "../src/runtime/interaction-boundary.ts";
import { runCognition, startRuntime } from "../src/runtime/runtime.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

test("restart sends a retained delivery intent that never crossed the external send boundary", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-before-send-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState("Ember", PRINCIPAL));
    const lease = await store.acquireWriteLease();
    let providerCalls = 0;
    let outputCalls = 0;
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, PRINCIPAL, SCOPE);
        const state = await store.commit(loaded.revision, started.state);
        const ledger = new InteractionLedgerStore(statePath);

        await assert.rejects(
            runCognition(store, state, {
                runtimeId: started.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "prepare one durable reply",
                command: "fixture-provider",
                timeoutSeconds: 1,
                provider: async () => {
                    providerCalls += 1;
                    return { contract_version: 1, reply: "reply retained before send", used_meaning_ids: [] };
                },
                output: () => {
                    outputCalls += 1;
                },
                hooks: {
                    afterExpressionCommit: async (committed, outputText) => {
                        const cognition = committed.operations.cognition_episodes.at(-1);
                        assert.ok(cognition?.expression_evidence_id);
                        await ledger.createDeliveryIntent({
                            cognitionId: cognition.cognition_id,
                            expressionEvidenceId: cognition.expression_evidence_id,
                            surfaceId: "messaging:test",
                            destinationId: "chat-before-send",
                            representationText: outputText,
                        });
                        throw new Error("simulated process loss before external send");
                    },
                },
            }),
            /simulated process loss before external send/,
        );

        assert.equal(providerCalls, 1);
        assert.equal(outputCalls, 0);
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
            const result = await reconcileSurfaceDelivery(restartedStore, delivery.delivery_id, (text) => {
                sends += 1;
                assert.equal(text, "reply retained before send\n");
                return { externalMessageId: "message-after-restart" };
            });

            assert.equal(result.status, "confirmed");
            assert.equal(sends, 1);
            assert.equal(providerCalls, 1);
            const recovered = await new InteractionLedgerStore(statePath).load();
            assert.equal(recovered.deliveries[0]?.attempts.length, 1);
            assert.equal(recovered.deliveries[0]?.attempts[0]?.outcome, "confirmed");
            assert.equal(recovered.deliveries[0]?.attempts[0]?.external_message_id, "message-after-restart");
            assert.equal((await restartedStore.load()).operations.cognition_episodes[0]?.delivery_status, "displayed");
        } finally {
            await restartedStore.releaseWriteLease(restartedLease);
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
