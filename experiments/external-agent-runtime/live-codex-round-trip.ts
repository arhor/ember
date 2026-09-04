#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { initialState } from "../../src/core/model.ts";
import { rememberFact, rememberPreference, rememberRelationship } from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { runCognition, startRuntime } from "../../src/runtime/runtime.ts";

const PRINCIPAL = "user-1";
const SCOPE = "relationship:user-1";
const EXCLUDED_MARKER = "OUT_OF_SCOPE_MARKER_44";
const ADAPTER = fileURLToPath(new URL("codex-provider.ts", import.meta.url));

const directory = await mkdtemp(join(tmpdir(), "ember-codex-round-trip-"));
const runtimeCwd = join(directory, "runtime-cwd");
const statePath = join(directory, "ember.json");
const requestPath = join(directory, "provider-request.json");
await mkdir(runtimeCwd);

const initial = initialState("Ember", PRINCIPAL);
const relationshipId = rememberRelationship(
    initial,
    PRINCIPAL,
    `relationship:${PRINCIPAL}`,
    SCOPE,
    "Synthetic issue-44 collaborator fixture",
);
const factId = rememberFact(
    initial,
    PRINCIPAL,
    `user:${PRINCIPAL}`,
    "fixture-server",
    SCOPE,
    "The synthetic fixture server uses EmberBoard 42 hardware",
);
rememberPreference(
    initial,
    PRINCIPAL,
    `user:${PRINCIPAL}`,
    "unrelated-preference",
    "project:unrelated",
    EXCLUDED_MARKER,
);

const store = new StateStore(statePath);
await store.create(initial);
const lease = await store.acquireWriteLease();
let reply = "";
try {
    const loaded = await store.load();
    const started = startRuntime(loaded, PRINCIPAL, SCOPE);
    const state = await store.commit(loaded.revision, started.state);
    const result = await runCognition(store, state, {
        runtimeId: started.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "According to the permitted projection, what hardware does the synthetic fixture server use? Answer in one sentence.",
        command: process.execPath,
        arguments_: [ADAPTER, "--runtime-cwd", runtimeCwd, "--capture-request", requestPath],
        timeoutSeconds: 120,
        output: (text) => {
            reply += text;
        },
    });
    if (result.providerFailure) throw new Error(result.providerFailure);

    const request = JSON.parse(await readFile(requestPath, "utf8"));
    const canonical = await readFile(statePath, "utf8");
    const cognition = result.state.operations.cognition_episodes.find(
        (item) => item.cognition_id === result.cognitionId,
    )!;
    const expression = result.state.evidence.find((item) => item.evidence_id === cognition.expression_evidence_id)!;
    assert.equal(result.state.lineage.lineage_id, request.projection.lineage.lineage_id);
    assert.deepEqual(new Set(cognition.selected_meaning_ids), new Set([relationshipId, factId]));
    assert.equal(JSON.stringify(request).includes(EXCLUDED_MARKER), false);
    assert.equal(request.projection.selection.raw_transcript_included, false);
    assert.equal(cognition.status, "completed");
    assert.equal(cognition.delivery_status, "displayed");
    assert.equal(expression.source_role, "ember_expression_via_provider");
    assert.equal(canonical.includes(reply.trim()), false);
    assert.match(reply, /EmberBoard 42/);
    process.stdout.write(
        `${JSON.stringify(
            {
                provider: "codex exec",
                lineage_preserved: true,
                selected_meaning_count: cognition.selected_meaning_ids.length,
                used_meaning_count: cognition.used_meaning_ids.length,
                out_of_scope_marker_disclosed: false,
                raw_transcript_included: request.projection.selection.raw_transcript_included,
                cognition_status: cognition.status,
                delivery_status: cognition.delivery_status,
                expression_evidence_role: expression.source_role,
                reply_retained_in_canonical_state: false,
                reply: reply.trim(),
            },
            null,
            2,
        )}\n`,
    );
} finally {
    await store.releaseWriteLease(lease);
}
