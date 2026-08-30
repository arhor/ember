import type { CliInput, PersistentState, Projection, ProjectionMeaning } from "./model.ts";

export function buildProjection(state: PersistentState, purpose: Projection["purpose"], input: CliInput): Projection {
  const selected = state.meanings.filter((meaning) => purpose === "explain" || meaning.currentness === "current");
  const meanings: ProjectionMeaning[] = selected.map((meaning) => ({
    meaning_id: meaning.meaning_id,
    kind: meaning.kind,
    owner: meaning.owner,
    slot: meaning.slot,
    scope: meaning.scope,
    content: meaning.content,
    source_evidence_ids: meaning.source_evidence_ids,
    currentness: meaning.currentness,
  }));
  return {
    purpose,
    lineage: { lineage_id: state.lineage.lineage_id, display_name: state.lineage.display_name },
    selection: { meaning_ids: meanings.map((meaning) => meaning.meaning_id), meanings },
    input,
  };
}
