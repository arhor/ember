#!/usr/bin/env node
import { initialState, type EmberState, type MeaningId } from "../../src/core/model.ts";
import { inspectionView } from "../../src/core/projection.ts";
import { rememberFact, supersede, transitionCommitment, undertake } from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { startRuntime, stopRuntime } from "../../src/runtime/runtime.ts";
import { createCodexOpportunityEvaluator } from "../../src/agency/codex-opportunity-evaluator.ts";
import { runCognitionOpportunity, type CognitionOpportunityEvaluator } from "../../src/agency/cognition-opportunity.ts";
import type { EndogenousRestartScenarioKind } from "../../eval/endogenous-restart/harness.ts";

const [phase, kindRaw, statePath, mode = "fixture", codexCommand = "codex", timeoutRaw = "120"] = process.argv.slice(2);
const kind = kindRaw as EndogenousRestartScenarioKind;
const PRINCIPAL = "user-1";
const SCOPE = "project:ember/endogenous-restart";
const store = new StateStore(statePath);

const deterministicEvaluator: CognitionOpportunityEvaluator = async request => {
  const concern = request.projection.meanings.find(item => item.kind === "commitment" && item.prospective_lifecycle === "live");
  const consequence = request.projection.meanings.find(item => item.slot === "release-window" && item.content === "Release is imminent");
  return concern && consequence
    ? { contract_version: 1, decision: "cognition", selected_meaning_ids: [concern.meaning_id, consequence.meaning_id] }
    : { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
};

if (phase === "prepare") {
  let state = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
  const aliases: Record<string, MeaningId> = {};
  if (kind !== "silence") {
    aliases.concern = undertake(state, PRINCIPAL, "release-preparation", SCOPE, "Prepare the release notes before release");
    aliases["old-consequence"] = rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "release-window", SCOPE, "Release is imminent");
  }
  if (kind === "resolved") transitionCommitment(state, PRINCIPAL, aliases.concern, "fulfilled", "Release notes are complete", { timestamp: "2026-09-03T00:01:00Z" });
  if (kind === "superseded") aliases["current-consequence"] = supersede(state, PRINCIPAL, aliases["old-consequence"], "Release is postponed");
  await store.create(state);
  const lease = await store.acquireWriteLease();
  try {
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-03T00:02:00Z" });
    state = await store.commit(state.revision, started.state);
    state = await store.commit(state.revision, stopRuntime(state, started.runtimeId, { reason: "restart scenario boundary", timestamp: "2026-09-03T00:03:00Z" }));
    process.stdout.write(JSON.stringify({ lineage_id: state.lineage.lineage_id, runtime_id: started.runtimeId }));
  } finally { await store.releaseWriteLease(lease); }
} else if (phase === "restart") {
  const lease = await store.acquireWriteLease();
  try {
    let state = await store.load();
    const aliases = aliasesFor(state);
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T00:00:00Z" });
    state = await store.commit(state.revision, started.state);
    const evaluator = mode === "live" ? createCodexOpportunityEvaluator({ command: codexCommand, timeoutSeconds: Number(timeoutRaw) }) : deterministicEvaluator;
    const result = await runCognitionOpportunity(store, state, { runtimeId: started.runtimeId, principal: PRINCIPAL, scope: SCOPE, mechanism: "runtime_start", evaluator, timestamp: "2026-09-04T00:00:01Z" });
    if (result.evaluatorFailure) throw new Error(result.evaluatorFailure);
    state = result.state;
    const occurrence = state.operations.cognition_opportunities!.at(-1)!;
    const view = inspectionView(state);
    process.stdout.write(JSON.stringify({
      lineage_id: state.lineage.lineage_id,
      runtime_id: started.runtimeId,
      decision: occurrence.decision,
      selected_aliases: occurrence.selected_meaning_ids.map(id => aliases.get(id) ?? "<unaliased>").sort(),
      current_aliases: view.current_meanings.map(item => aliases.get(item.meaning_id)).filter(Boolean).sort(),
      historical_aliases: view.historical_meanings.map(item => aliases.get(item.meaning_id)).filter(Boolean).sort(),
      gap_kind: state.operations.runtime_episodes.at(-1)!.recovery_account.gap_kind,
      downtime_cognition: state.operations.runtime_episodes.at(-1)!.recovery_account.ember_cognition_during_interval,
      provider_thread_mode: mode === "live" ? "ephemeral" : "deterministic_no_session",
    }));
  } finally { await store.releaseWriteLease(lease); }
} else throw new Error("expected prepare or restart phase");

function aliasesFor(state: EmberState) {
  const aliases = new Map<string, string>();
  for (const meaning of state.meanings) {
    if (meaning.kind === "commitment") aliases.set(meaning.meaning_id, "concern");
    else if (meaning.slot === "release-window" && meaning.content === "Release is imminent") aliases.set(meaning.meaning_id, "old-consequence");
    else if (meaning.slot === "release-window") aliases.set(meaning.meaning_id, "current-consequence");
  }
  return aliases;
}
