#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileBackedRepositoriesForState } from "../../src/composition/ember.ts";
import { createAiSdkCognitionExecutor } from "../../src/core/ai/cognition.ts";
import { createCursorLanguageModel } from "../../src/core/ai/cursor.ts";
import { executeCognition } from "../../src/core/app/cognition-execution.ts";
import { initialState } from "../../src/core/model.ts";
import { startRuntime, stopRuntime } from "../../src/core/runtime-episode.ts";
import { rememberFact, rememberPreference, rememberRelationship } from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";

const principal = "user-1";
const scope = `relationship:${principal}`;
const marker = "OUT_OF_SCOPE_MARKER_90";
const directory = await mkdtemp(join(tmpdir(), "ember-live-cursor-"));
const statePath = join(directory, "ember.json");
const state = initialState(principal);
const relationshipId = rememberRelationship(state, principal, scope, scope, "Synthetic issue-90 collaborator fixture");
const factId = rememberFact(
    state,
    principal,
    `user:${principal}`,
    "fixture-server",
    scope,
    "The synthetic fixture server uses EmberBoard 90 hardware",
);
rememberPreference(state, principal, `user:${principal}`, "unrelated-preference", "project:unrelated", marker);
const store = new StateStore(statePath);
await store.create(state);
const lease = await store.acquireWriteLease();
try {
    const loaded = await store.load();
    const started = startRuntime(loaded, principal, scope);
    const running = await store.commit(loaded.revision, started.state);
    const result = await executeCognition(createFileBackedRepositoriesForState(store), running, {
        runtimeId: started.runtimeId,
        principal,
        scope,
        text: "According to the permitted projection, what hardware does the synthetic fixture server use? Answer in one sentence.",
        providerLabel: "cursor-agent",
        executor: createAiSdkCognitionExecutor(createCursorLanguageModel({ timeoutSeconds: 120 })),
        timeoutSeconds: 120,
    });
    if (result.providerFailure) throw new Error(result.providerFailure);
    const reply = result.expressionText ?? "";
    const cognition = result.state.operations.cognitionEpisodes.find(
        (item) => item.cognitionId === result.cognitionId,
    )!;
    const canonical = await readFile(statePath, "utf8");
    assert.deepEqual(new Set(cognition.selectedMeaningIds), new Set([relationshipId, factId]));
    assert.equal(reply.includes(marker), false);
    assert.equal(canonical.includes(reply.trim()), false);
    assert.match(reply, /EmberBoard 90/);
    await store.commit(
        result.state.revision,
        stopRuntime(result.state, started.runtimeId, { reason: "live_smoke_complete" }),
    );
    process.stdout.write(
        `${JSON.stringify({ executor: "Cursor Agent CLI", selected_meaning_count: cognition.selectedMeaningIds.length, used_meaning_count: cognition.usedMeaningIds.length, external_session_recorded_as_operational_evidence: cognition.externalProviderThreadId !== null, out_of_scope_marker_disclosed: false, reply_retained_in_canonical_state: false, cognition_status: cognition.status, deliveryStatus: cognition.deliveryStatus, reply: reply.trim() }, null, 2)}\n`,
    );
} finally {
    try {
        await store.releaseWriteLease(lease);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}
