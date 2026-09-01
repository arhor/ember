#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invokeCursorProvider } from "../src/ember/cursor-provider.ts";
import { initialState } from "../src/ember/model.ts";
import { runCognition, startRuntime, stopRuntime } from "../src/ember/runtime.ts";
import { rememberFact, rememberPreference, rememberRelationship } from "../src/ember/semantics.ts";
import { StateStore } from "../src/ember/store.ts";

const principal = "user-1"; const scope = `relationship:${principal}`; const marker = "OUT_OF_SCOPE_MARKER_90";
const directory = await mkdtemp(join(tmpdir(), "ember-live-cursor-")); const statePath = join(directory, "ember.json");
const state = initialState("Ember", principal); const relationshipId = rememberRelationship(state, principal, scope, scope, "Synthetic issue-90 collaborator fixture");
const factId = rememberFact(state, principal, `user:${principal}`, "fixture-server", scope, "The synthetic fixture server uses EmberBoard 90 hardware");
rememberPreference(state, principal, `user:${principal}`, "unrelated-preference", "project:unrelated", marker);
const store = new StateStore(statePath); await store.create(state); const lease = await store.acquireWriteLease(); let reply = "";
try {
  const loaded = await store.load(); const started = startRuntime(loaded, principal, scope); const running = await store.commit(loaded.revision, started.state);
  const result = await runCognition(store, running, { runtimeId: started.runtimeId, principal, scope, text: "According to the permitted projection, what hardware does the synthetic fixture server use? Answer in one sentence.", command: "cursor-agent", timeoutSeconds: 120, provider: invokeCursorProvider, output: text => { reply += text; } });
  if (result.providerFailure) throw new Error(result.providerFailure); const cognition = result.state.operations.cognition_episodes.find(item => item.cognition_id === result.cognitionId)!; const canonical = await readFile(statePath, "utf8");
  assert.deepEqual(new Set(cognition.selected_meaning_ids), new Set([relationshipId, factId])); assert.equal(reply.includes(marker), false); assert.equal(canonical.includes(reply.trim()), false); assert.match(reply, /EmberBoard 90/);
  await store.commit(result.state.revision, stopRuntime(result.state, started.runtimeId, { reason: "live_smoke_complete" }));
  process.stdout.write(`${JSON.stringify({ provider: "Cursor Agent CLI", selected_meaning_count: cognition.selected_meaning_ids.length, used_meaning_count: cognition.used_meaning_ids.length, external_session_recorded_as_operational_evidence: cognition.external_provider_thread_id !== null, out_of_scope_marker_disclosed: false, reply_retained_in_canonical_state: false, cognition_status: cognition.status, delivery_status: cognition.delivery_status, reply: reply.trim() }, null, 2)}\n`);
} finally { try { await store.releaseWriteLease(lease); } finally { await rm(directory, { recursive: true, force: true }); } }
