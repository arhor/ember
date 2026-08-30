import assert from "node:assert/strict";
import test from "node:test";
import { buildProjection } from "../src/projection.ts";
import {
  describeMeaning,
  evidenceId,
  fixtureState,
  type MeaningId,
  meaningId,
  type Projection,
} from "../src/model.ts";
import { supersedePreference } from "../src/semantics.ts";
import { parsePersistentState } from "../src/validation.ts";

test("semantic variants are exhaustive and preference supersession stays typed", () => {
  const state = fixtureState();
  assert.deepEqual(state.meanings.map(describeMeaning), [
    "relationship:relationship:user-1",
    "fact:home-server",
    "preference:docs-rationale-detail",
    "commitment:restart-provenance-check",
    "episode:first-continuity-experiment",
  ]);
  const updated = supersedePreference(
    state,
    meaningId("meaning-preference-a"),
    "Prefer detailed architectural rationale",
  );
  const old = updated.meanings.find((meaning) =>
    meaning.meaning_id === meaningId("meaning-preference-a")
  );
  const current = updated.meanings.find((meaning) =>
    meaning.kind === "preference" && meaning.currentness === "current"
  );
  const successorEvidence = updated.evidence.find((evidence) =>
    evidence.evidence_id === current?.source_evidence_ids[0]
  );
  assert.equal(old?.currentness, "superseded");
  assert.equal(current?.content, "Prefer detailed architectural rationale");
  assert.notDeepEqual(current?.source_evidence_ids, old?.source_evidence_ids);
  assert.equal(successorEvidence?.source_role, "user_command");
  if (successorEvidence?.source_role === "user_command") {
    assert.equal(successorEvidence.payload, "Prefer detailed architectural rationale");
  }
  assert.doesNotThrow(() => parsePersistentState(JSON.stringify(updated)));
});

test("persisted JSON remains a runtime validation boundary", () => {
  const state = fixtureState();
  assert.equal(
    parsePersistentState(JSON.stringify(state)).lineage.lineage_id,
    state.lineage.lineage_id,
  );
  assert.throws(
    () => parsePersistentState(JSON.stringify({ ...state, schema_version: 99 })),
    /schema_version/,
  );
  const malformed = structuredClone(state) as unknown as {
    meanings: Array<Record<string, unknown>>;
  };
  malformed.meanings[0].kind = "invented";
  assert.throws(() => parsePersistentState(JSON.stringify(malformed)), /kind/);
});

test("persistent state, projection, CLI input, and branded identifiers stay compile-time distinct", () => {
  const state = fixtureState();
  const projection = buildProjection(state, "ordinary", {
    text: "continue",
    scope: "project:ember/docs",
    surface: "cli",
  });
  const source = evidenceId("evidence-example");
  function takesMeaningId(_value: MeaningId) {}
  function takesProjection(_value: Projection) {}
  const compileTimeOnly = () => {
    // @ts-expect-error Evidence IDs must not cross the meaning-ID boundary.
    takesMeaningId(source);
    // @ts-expect-error Canonical persistent state must not be passed where a bounded projection is required.
    takesProjection(state);
  };
  void compileTimeOnly;
  assert.equal(projection.selection.meaning_ids.length, 5);
});
