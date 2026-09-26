import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { AiExecutor } from "../src/core/ai/contract.ts";

import { createEmberApplication } from "../src/app/application.ts";
import { composeEmberApplication, createFileBackedRepositoriesForState } from "../src/composition/ember.ts";
import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import {
    InteractionLedgerStore,
    interactionLedgerInspectionView,
    reconcileSurfaceDelivery,
} from "../src/runtime/interaction-boundary.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-reconciliation-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState(PRINCIPAL));
    return {
        directory,
        statePath,
        store,
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

async function withRestartedWriter<T>(
    f: Awaited<ReturnType<typeof fixture>>,
    operation: (store: StateStore) => Promise<T>,
) {
    const restartedStore = new StateStore(f.statePath);
    const lease = await restartedStore.acquireWriteLease();
    try {
        return await operation(restartedStore);
    } finally {
        await restartedStore.releaseWriteLease(lease);
    }
}

function provider(calls: { value: number }): AiExecutor {
    return async () => {
        calls.value += 1;
        return { contractVersion: 1, reply: "durable reply", usedMeaningIds: [] };
    };
}

async function createRetryableFailure(
    f: Awaited<ReturnType<typeof fixture>>,
    calls: { provider: number; delivery: number },
) {
    const providerCalls = { value: 0 };
    const application = createEmberApplication(
        composeEmberApplication(
            {
                statePath: f.statePath,
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            { executor: provider(providerCalls) },
        ),
    );
    const result = await application.interact(
        {
            kind: "message",
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "send this once",
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-retry" },
            deliveryDestinationId: "chat-retry",
        },
        async () => {
            calls.delivery += 1;
            return {
                outcome: "failed",
                retryable: true,
                retryAfterSeconds: null,
                externalMessageId: null,
            };
        },
    );
    assert.equal(result.delivery?.status, "retryable_failure");
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
            const result = await reconcileSurfaceDelivery(
                createFileBackedRepositoriesForState(restartedStore),
                failed.delivery_id,
                (text) => {
                    calls.delivery += 1;
                    assert.equal(text, "durable reply\n");
                    return { externalMessageId: "message-retry-ok" };
                },
            );

            assert.equal(result.status, "confirmed");
            const state = await restartedStore.load();
            assert.equal(state.operations.cognitionEpisodes.length, 1);
            assert.equal(state.operations.cognitionEpisodes[0]?.deliveryStatus, "displayed");
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
            const result = await reconcileSurfaceDelivery(
                createFileBackedRepositoriesForState(restartedStore),
                failed.delivery_id,
                () => {
                    resendCalls += 1;
                },
            );

            assert.equal(result.status, "blocked_uncertain");
            assert.equal(result.attemptId, started.attempt_id);
            assert.equal(resendCalls, 0);
            const recovered = await new InteractionLedgerStore(f.statePath).load();
            assert.equal(recovered.deliveries[0]?.attempts.at(-1)?.outcome, "uncertain");
            assert.equal((await restartedStore.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
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
        assert.equal((await f.store.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "pending");

        await withRestartedWriter(f, async (restartedStore) => {
            let resendCalls = 0;
            const result = await reconcileSurfaceDelivery(
                createFileBackedRepositoriesForState(restartedStore),
                failed.delivery_id,
                () => {
                    resendCalls += 1;
                },
            );

            assert.equal(result.status, "confirmed");
            assert.equal(resendCalls, 0);
            assert.equal((await restartedStore.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "displayed");
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
            deliveries: current.deliveries.map(
                ({ representation: _representation, origin: _origin, send_fence: _fence, attempts, ...delivery }) => ({
                    ...delivery,
                    attempts: attempts.map(
                        ({
                            observedAt: _observedAt,
                            retryable: _retryable,
                            retry_after_seconds: _retryAfter,
                            ...attempt
                        }) => attempt,
                    ),
                }),
            ),
        };
        await writeFile(`${f.statePath}.interactions.json`, `${JSON.stringify(legacy, null, 2)}\n`, "utf8");

        const migrated = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(migrated.ledger_version, 3);
        assert.deepEqual(migrated.deliveries[0]?.origin, { kind: "ordinary_cognition" });
        assert.equal(migrated.deliveries[0]?.representation, null);
        assert.equal(migrated.deliveries[0]?.attempts[0]?.retryable, false);
        assert.equal(
            migrated.deliveries[0]?.attempts[0]?.observedAt,
            migrated.deliveries[0]?.attempts[0]?.attempted_at,
        );
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
        assert.match(inspected.deliveries[0]?.representation.contentDigest ?? "", /^sha256:[0-9a-f]{64}$/);
    } finally {
        await f.close();
    }
});

test("a proactive no-further-send fence withdraws an unattempted delivery", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, delivery: 0 };
        const source = await createRetryableFailure(f, calls);
        const ledger = new InteractionLedgerStore(f.statePath);
        const proactive = await ledger.createDeliveryIntent({
            cognitionId: source.cognitionId,
            expressionEvidenceId: source.expressionEvidenceId,
            surfaceId: "messaging:test",
            destinationId: "chat-proactive",
            representationText: "proactive retained representation",
            origin: {
                kind: "proactive_contact",
                contact_intent_id: "contact-intent-fenced",
                policy_assessment_id: "contact-policy-fenced",
            },
        });
        await ledger.fenceDelivery(proactive.delivery_id, "intent_cancelled", "2026-09-17T15:00:00Z");
        let sends = 0;
        const result = await reconcileSurfaceDelivery(
            createFileBackedRepositoriesForState(f.store),
            proactive.delivery_id,
            () => {
                sends += 1;
            },
            { observedAt: "2026-09-17T15:01:00Z" },
        );
        assert.equal(result.status, "withdrawn");
        assert.equal(sends, 0);
    } finally {
        await f.close();
    }
});
