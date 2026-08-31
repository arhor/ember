#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invokeCodexProvider } from "../src/ember/codex-provider.ts";
import { initialState } from "../src/ember/model.ts";
import { runCognition, startRuntime, stopRuntime } from "../src/ember/runtime.ts";
import { rememberFact, rememberPreference, rememberRelationship } from "../src/ember/semantics.ts";
import { StateStore } from "../src/ember/store.ts";

const PRINCIPAL = "user-1";
const SCOPE = `relationship:${PRINCIPAL}`;
const EXCLUDED_MARKER = "OUT_OF_SCOPE_MARKER_46";
const directory = await mkdtemp(join(tmpdir(), "ember-live-codex-"));
const statePath = join(directory, "ember.json");
const state = initialState("Ember", PRINCIPAL);
const relationshipId = rememberRelationship(state, PRINCIPAL, SCOPE, SCOPE, "Synthetic issue-46 collaborator fixture");
const factId = rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "fixture-server", SCOPE, "The synthetic fixture server uses EmberBoard 46 hardware");
rememberPreference(state, PRINCIPAL, `user:${PRINCIPAL}`, "unrelated-preference", "project:unrelated", EXCLUDED_MARKER);

const store = new StateStore(statePath);
await store.create(state);
const lease = await store.acquireWriteLease();
let reply = "";
try {
  const loaded = await store.load();
  const started = startRuntime(loaded, PRINCIPAL, SCOPE);
  const running = await store.commit(loaded.revision, started.state);
  const result = await runCognition(store, running, {
    runtimeId: started.runtimeId,
    principal: PRINCIPAL,
    scope: SCOPE,
    text: "According to the permitted projection, what hardware does the synthetic fixture server use? Answer in one sentence.",
    command: "codex",
    timeoutSeconds: 120,
    provider: invokeCodexProvider,
    output: text => { reply += text; },
  });
  if (result.providerFailure) throw new Error(result.providerFailure);
  const cognition = result.state.operations.cognition_episodes.find(item => item.cognition_id === result.cognitionId)!;
  const canonical = await readFile(statePath, "utf8");
  assert.deepEqual(new Set(cognition.selected_meaning_ids), new Set([relationshipId, factId]));
  assert.equal(canonical.includes(EXCLUDED_MARKER), true);
  assert.equal(reply.includes(EXCLUDED_MARKER), false);
  assert.equal(canonical.includes(reply.trim()), false);
  assert.match(reply, /EmberBoard 46/);
  const stopped = stopRuntime(result.state, started.runtimeId, { reason: "live_smoke_complete" });
  await store.commit(result.state.revision, stopped);
  process.stdout.write(`${JSON.stringify({
    provider: "codex exec",
    selected_meaning_count: cognition.selected_meaning_ids.length,
    used_meaning_count: cognition.used_meaning_ids.length,
    external_thread_recorded_as_operational_evidence: cognition.external_provider_thread_id !== null,
    out_of_scope_marker_disclosed: false,
    reply_retained_in_canonical_state: false,
    cognition_status: cognition.status,
    delivery_status: cognition.delivery_status,
    reply: reply.trim(),
  }, null, 2)}\n`);
} finally {
  try {
    await store.releaseWriteLease(lease);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
