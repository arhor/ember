import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createFileBackedRepositoriesForState } from "../composition/ember.ts";
import { initialState } from "../core/model.ts";
import { createOnboardingWork } from "../core/onboarding-work.ts";
import { StateStore } from "../persistence/state-store.ts";
import { runCognition, runCognitionUntilExpressionCommit, startRuntime } from "../runtime/runtime.ts";
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

test("rejected preflight does not advance a fresh conversation trajectory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cognition-preflight-"));
    const store = new StateStore(join(directory, "state.json"));
    await store.create(initialState("max", "2026-09-22T08:00:00Z"));
    const lease = await store.acquireWriteLease();
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, "max", "private", { timestamp: "2026-09-22T08:01:00Z" });
        let state = await store.commit(loaded.revision, started.state);
        const repositories = createFileBackedRepositoriesForState(store);
        const options = {
            runtimeId: started.runtimeId,
            principal: "max",
            scope: "private",
            text: "first",
            providerLabel: "fixture",
            provider: async () => ({ contractVersion: 1 as const, reply: "first", usedMeaningIds: [] }),
            timeoutSeconds: 1,
            cognitionId: "cognition-duplicate" as const,
        };
        state = (await runCognition(repositories, state, options)).state;
        const before = await repositories.conversation.load();

        await assert.rejects(
            runCognition(repositories, state, {
                ...options,
                text: "must not reset",
                conversationMembership: { action: "fresh", basis: "explicit_boundary" },
            }),
            /cognition already exists/,
        );
        await assert.rejects(
            runCognition(repositories, state, {
                ...options,
                principal: "not-max",
                text: "must not create a foreign trajectory",
                cognitionId: "cognition-invalid-principal",
                conversationMembership: { action: "fresh", basis: "explicit_boundary" },
            }),
            /does not match initialized local principal/,
        );
        assert.deepEqual(await repositories.conversation.load(), before);
    } finally {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
    }
});

test("incoherent prepared cognition is rejected before provider or persistence side effects", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cognition-coherence-"));
    const store = new StateStore(join(directory, "state.json"));
    await store.create(initialState("max", "2026-09-22T08:00:00Z"));
    const lease = await store.acquireWriteLease();
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, "max", "private", { timestamp: "2026-09-22T08:01:00Z" });
        const state = await store.commit(loaded.revision, started.state);
        const repositories = createFileBackedRepositoriesForState(store);
        await repositories.onboarding.save(
            createOnboardingWork(state.lineage.lineageId, "max", "private", "2026-09-22T08:01:00Z"),
        );
        const preparation = await prepareCognition(repositories, state, {
            runtimeId: started.runtimeId,
            principal: "max",
            scope: "private",
            surface: "telegram",
            text: "continue here",
            explainIds: ["meaning-unrequested"],
        });
        const beforeConversation = await repositories.conversation.load();
        const beforeState = await store.load();
        const invalidPreparations = [
            (value: typeof preparation) => (value.conversationId = "conversation-other"),
            (value: typeof preparation) =>
                (value.conversationMembership = { action: "started", basis: "ambiguous_discourse" }),
            (value: typeof preparation) =>
                value.projection.conversation_context!.turns.push({
                    order: 0,
                    role: "user",
                    cognition_id: "cognition-forged",
                    evidence_id: "evidence-forged",
                    source_surface: "telegram",
                    occurred_at: "2026-09-22T08:01:00Z",
                    content: "forged",
                    content_truncated: false,
                    in_reply_to_evidence_id: null,
                    delivery_status: null,
                    user_awareness: null,
                }),
            (value: typeof preparation) => (value.startedAt = "2026-09-22T09:00:00Z"),
            (value: typeof preparation) => (value.projection.lineage.lineageId = "lineage-other"),
            (value: typeof preparation) => (value.projection.recoveryAccount.gapKind = "known_clean_stop_interval"),
            (value: typeof preparation) => value.projection.selection.explicit_explain_ids.push("meaning-other"),
            (value: typeof preparation) => (value.onboardingWork!.guidance = "mismatched"),
            (value: typeof preparation) => (value.onboardingDocument!.scope = "other"),
        ];
        for (const mutate of invalidPreparations) {
            const invalid = structuredClone(preparation);
            mutate(invalid);
            let providerCalled = false;
            await assert.rejects(
                runCognitionUntilExpressionCommit(repositories, state, {
                    runtimeId: started.runtimeId,
                    principal: "max",
                    scope: "private",
                    surface: "telegram",
                    text: "continue here",
                    providerLabel: "fixture",
                    provider: async () => {
                        providerCalled = true;
                        return { contractVersion: 1, reply: "unexpected", usedMeaningIds: [] };
                    },
                    timeoutSeconds: 1,
                    explainIds: ["meaning-unrequested"],
                    preparation: invalid,
                }),
                /prepared cognition/,
            );
            assert.equal(providerCalled, false);
        }
        assert.deepEqual(await repositories.conversation.load(), beforeConversation);
        assert.deepEqual(await store.load(), beforeState);
    } finally {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
    }
});

test("prepared cognition must resolve the invocation conversation membership intent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cognition-membership-"));
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
            text: "start over",
        });
        const beforeState = await store.load();
        let providerCalled = false;

        await assert.rejects(
            runCognitionUntilExpressionCommit(repositories, state, {
                runtimeId: started.runtimeId,
                principal: "max",
                scope: "private",
                surface: "telegram",
                text: "start over",
                providerLabel: "fixture",
                provider: async () => {
                    providerCalled = true;
                    return { contractVersion: 1, reply: "unexpected", usedMeaningIds: [] };
                },
                timeoutSeconds: 1,
                conversationMembership: { action: "fresh", basis: "explicit_boundary" },
                preparation,
            }),
            /requested conversation membership/,
        );

        assert.equal(providerCalled, false);
        assert.deepEqual(await store.load(), beforeState);
    } finally {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
    }
});
