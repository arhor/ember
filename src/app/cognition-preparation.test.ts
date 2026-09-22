import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFileBackedRepositoriesForState } from "../composition/ember.ts";
import { initialState } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { runCognitionUntilExpressionCommit, startRuntime } from "../runtime/runtime.ts";
import { prepareCognition } from "./cognition-preparation.ts";

test("application preparation builds the provider projection before cognition execution", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cognition-preparation-"));
    const store = new StateStore(join(directory, "state.json"));
    await store.create(initialState("max", "2026-09-22T08:00:00Z"));
    const lease = await store.acquireWriteLease();
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, "max", "private", { timestamp: "2026-09-22T08:01:00Z" });
        const state = await store.commit(loaded.revision, started.state);
        const repositories = createFileBackedRepositoriesForState(store);
        const preparation = await prepareCognition(repositories, state, {
            runtimeId: started.runtimeId,
            principal: "max",
            scope: "private",
            surface: "telegram",
            text: "continue here",
        });

        assert.equal(preparation.projection.current_input, "continue here");
        assert.equal(preparation.projection.surface, "telegram");
        assert.equal(preparation.projection.conversation_context?.conversation_id, preparation.conversationId);
        assert.deepEqual(preparation.projection.conversation_context?.turns, []);

        let receivedProjection: unknown = null;
        const committed = await runCognitionUntilExpressionCommit(repositories, state, {
            runtimeId: started.runtimeId,
            principal: "max",
            scope: "private",
            surface: "telegram",
            text: "continue here",
            providerLabel: "fixture",
            provider: async (request) => {
                receivedProjection = request.projection;
                return { contractVersion: 1, reply: "continued", usedMeaningIds: [] };
            },
            timeoutSeconds: 1,
            preparation,
        });

        assert.deepEqual(receivedProjection, preparation.projection);
        assert.equal(committed.expressionText, "continued\n");
    } finally {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
    }
});

test("low-level cognition execution rejects an unprepared invocation without calling the provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-unprepared-cognition-"));
    const store = new StateStore(join(directory, "state.json"));
    await store.create(initialState("max", "2026-09-22T08:00:00Z"));
    const lease = await store.acquireWriteLease();
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, "max", "private", { timestamp: "2026-09-22T08:01:00Z" });
        const state = await store.commit(loaded.revision, started.state);
        let providerCalled = false;

        await assert.rejects(
            runCognitionUntilExpressionCommit(createFileBackedRepositoriesForState(store), state, {
                runtimeId: started.runtimeId,
                principal: "max",
                scope: "private",
                text: "not prepared",
                providerLabel: "fixture",
                provider: async () => {
                    providerCalled = true;
                    return { contractVersion: 1, reply: "unexpected", usedMeaningIds: [] };
                },
                timeoutSeconds: 1,
            }),
            /requires an already-built Ember projection/,
        );
        assert.equal(providerCalled, false);
        assert.deepEqual(
            (await createFileBackedRepositoriesForState(store).conversation.load()).active_trajectories,
            [],
        );
    } finally {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
    }
});
