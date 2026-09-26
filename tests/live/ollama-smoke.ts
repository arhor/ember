#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileBackedRepositoriesForState } from "../../src/composition/ember.ts";
import { createAiSdkCognitionExecutor } from "../../src/core/ai/cognition.ts";
import { createOllamaLanguageModel } from "../../src/core/ai/ollama.ts";
import { executeCognition } from "../../src/core/app/cognition-execution.ts";
import { initialState } from "../../src/core/model.ts";
import { startRuntime, stopRuntime } from "../../src/core/runtime-episode.ts";
import { rememberFact, rememberRelationship } from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";

const model = process.env.EMBER_OLLAMA_MODEL;
if (!model) throw new Error("set EMBER_OLLAMA_MODEL to a local Ollama model before running this smoke test");
const baseUrl = process.env.EMBER_OLLAMA_BASE_URL;
const principal = "user-1";
const scope = `relationship:${principal}`;
const directory = await mkdtemp(join(tmpdir(), "ember-live-ollama-"));
const statePath = join(directory, "ember.json");
const state = initialState(principal);
rememberRelationship(state, principal, scope, scope, "Synthetic Ollama smoke collaborator");
rememberFact(
    state,
    principal,
    `user:${principal}`,
    "fixture-server",
    scope,
    "The fixture server uses EmberBoard Ollama hardware",
);
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
        text: "According to the permitted projection, what hardware does the fixture server use? Answer in one sentence.",
        providerLabel: "ollama",
        executor: createAiSdkCognitionExecutor(
            createOllamaLanguageModel({ model, ...(baseUrl === undefined ? {} : { baseUrl }) }),
        ),
        timeoutSeconds: 120,
    });
    if (result.providerFailure) throw new Error(result.providerFailure);
    assert.match(result.expressionText ?? "", /EmberBoard Ollama/);
    await store.commit(
        result.state.revision,
        stopRuntime(result.state, started.runtimeId, { reason: "live_smoke_complete" }),
    );
    process.stdout.write(
        `${JSON.stringify({ provider: "ollama", model, base_url: baseUrl ?? "http://127.0.0.1:11434", cognition_status: "completed" })}\n`,
    );
} finally {
    try {
        await store.releaseWriteLease(lease);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}
