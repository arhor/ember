import assert from "node:assert/strict";
import test from "node:test";
import { cloneState, initialState, type EmberState, type MeaningId } from "../core/model.ts";
import { rememberFact, transitionCommitment, undertake } from "../core/semantics.ts";
import { startRuntime } from "../runtime/runtime.ts";
import { evaluateCognitionOpportunity, type CognitionOpportunityEvaluator } from "./cognition-opportunity.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";
const OPPORTUNITY_AT = "2026-09-04T12:00:00Z";

const consequenceAwareEvaluator: CognitionOpportunityEvaluator = async request => {
  const commitment = request.projection.meanings.find(item => item.kind === "commitment" && item.currentness === "current" && item.prospective_lifecycle === "live");
  const consequence = request.projection.meanings.find(item => item.kind === "fact" && item.slot === "release-window" && item.currentness === "current" && item.content === "Release is imminent");
  if (!commitment || !consequence) return { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
  return { contract_version: 1, decision: "cognition", selected_meaning_ids: [commitment.meaning_id, consequence.meaning_id] };
};

function scenario({ concern = false, relevant = false, resolved = false }: { concern?: boolean; relevant?: boolean; resolved?: boolean }) {
  const state = initialState("Ember", PRINCIPAL, "2026-09-03T00:00:00Z");
  let commitmentId: MeaningId | null = null;
  if (concern) commitmentId = undertake(state, PRINCIPAL, "release-preparation", SCOPE, "Prepare the release notes before release");
  if (relevant) rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "release-window", SCOPE, "Release is imminent");
  if (resolved && commitmentId) transitionCommitment(state, PRINCIPAL, commitmentId, "fulfilled", "The release notes are complete", { timestamp: "2026-09-03T10:00:00Z" });
  const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-09-04T00:00:00Z" });
  return { state: started.state, runtimeId: started.runtimeId, commitmentId };
}

async function evaluate(state: EmberState, runtimeId: ReturnType<typeof startRuntime>["runtimeId"]) {
  return evaluateCognitionOpportunity(state, { runtimeId, principal: PRINCIPAL, scope: SCOPE, mechanism: "foreground_probe", evaluator: consequenceAwareEvaluator, timestamp: OPPORTUNITY_AT });
}

test("same topic-free opportunity should activate a live concern only when current durable consequence makes it relevant", async () => {
  const absent = scenario({});
  const irrelevant = scenario({ concern: true });
  const relevant = scenario({ concern: true, relevant: true });
  const resolved = scenario({ concern: true, relevant: true, resolved: true });

  const [absentResult, irrelevantResult, relevantResult, resolvedResult] = await Promise.all([
    evaluate(absent.state, absent.runtimeId),
    evaluate(irrelevant.state, irrelevant.runtimeId),
    evaluate(relevant.state, relevant.runtimeId),
    evaluate(resolved.state, resolved.runtimeId),
  ]);

  assert.deepEqual([absentResult.mechanism, irrelevantResult.mechanism, relevantResult.mechanism, resolvedResult.mechanism], ["foreground_probe", "foreground_probe", "foreground_probe", "foreground_probe"]);
  assert.deepEqual([absentResult.decision, irrelevantResult.decision, relevantResult.decision, resolvedResult.decision], ["no_cognition", "no_cognition", "cognition", "no_cognition"]);

  assert.equal(absentResult.projected_meaning_ids.length, 0);
  assert.ok(irrelevant.commitmentId && irrelevantResult.projected_meaning_ids.includes(irrelevant.commitmentId));
  assert.deepEqual(irrelevantResult.selected_meaning_ids, []);
  assert.ok(relevant.commitmentId && relevantResult.selected_meaning_ids.includes(relevant.commitmentId));
  assert.equal(relevantResult.selected_meaning_ids.length, 2);
  assert.ok(resolved.commitmentId && !resolvedResult.projected_meaning_ids.includes(resolved.commitmentId));

  const closed = resolved.state.meanings.find(item => item.meaning_id === resolved.commitmentId);
  assert.deepEqual([closed?.currentness, closed?.prospective_lifecycle, closed?.applicable_until], ["historical", "fulfilled", "2026-09-03T10:00:00Z"]);
  assert.equal(closed?.source_evidence_ids.length, 2);
});

test("a still-live but irrelevant concern should remain dormant across repeated opportunities without state churn", async () => {
  const fixture = scenario({ concern: true });
  const before = cloneState(fixture.state);
  const first = await evaluate(fixture.state, fixture.runtimeId);
  const second = await evaluate(fixture.state, fixture.runtimeId);
  assert.deepEqual([first.decision, second.decision], ["no_cognition", "no_cognition"]);
  assert.ok(fixture.commitmentId && first.projected_meaning_ids.includes(fixture.commitmentId));
  assert.ok(fixture.commitmentId && second.projected_meaning_ids.includes(fixture.commitmentId));
  assert.deepEqual(fixture.state, before);
});

test("commitment discharge should require attributable evidence and reject repeated discharge", () => {
  const fixture = scenario({ concern: true });
  assert.ok(fixture.commitmentId);
  const transitionEvidence = transitionCommitment(fixture.state, PRINCIPAL, fixture.commitmentId!, "cancelled", "The release work was cancelled", { timestamp: "2026-09-04T01:00:00Z" });
  const commitment = fixture.state.meanings.find(item => item.meaning_id === fixture.commitmentId);
  const evidence = fixture.state.evidence.find(item => item.evidence_id === transitionEvidence);
  assert.deepEqual([commitment?.currentness, commitment?.prospective_lifecycle, evidence?.source_role, evidence?.source_actor], ["historical", "cancelled", "user_command", `user:${PRINCIPAL}`]);
  assert.throws(() => transitionCommitment(fixture.state, PRINCIPAL, fixture.commitmentId!, "fulfilled", "Actually done"), /only a live current commitment/);
});
