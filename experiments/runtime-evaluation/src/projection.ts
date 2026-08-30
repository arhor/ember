import type {
  CliInput,
  Meaning,
  MeaningId,
  PersistentState,
  Projection,
  ProjectionMeaning,
} from "./model.ts";

export function buildProjection(
  state: PersistentState,
  purpose: Projection["purpose"],
  input: CliInput,
  explainIds: readonly MeaningId[] = [],
): Projection {
  const principal = state.runtime_contract.local_principal;
  const selected = new Map<MeaningId, Meaning>();

  for (const meaning of state.meanings) {
    if (
      meaning.kind === "relationship" &&
      meaning.currentness === "current" &&
      meaning.owner === `relationship:${principal}`
    ) {
      selected.set(meaning.meaning_id, meaning);
    } else if (
      (meaning.kind === "fact" || meaning.kind === "preference") &&
      meaning.currentness === "current" &&
      meaning.scope === input.scope
    ) {
      selected.set(meaning.meaning_id, meaning);
    } else if (
      meaning.kind === "commitment" &&
      meaning.currentness === "current" &&
      meaning.prospective_lifecycle === "live" &&
      meaning.scope === input.scope
    ) {
      selected.set(meaning.meaning_id, meaning);
    }
  }

  if (purpose === "explain") {
    for (const id of new Set(explainIds)) {
      const meaning = findMeaning(state, id);
      selected.set(meaning.meaning_id, meaning);
      for (const linkedId of [meaning.supersedes, meaning.superseded_by]) {
        if (linkedId !== null) {
          const linked = findMeaning(state, linkedId);
          selected.set(linked.meaning_id, linked);
        }
      }
    }
  }

  const meanings: ProjectionMeaning[] = [...selected.values()].map((meaning) => ({
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

function findMeaning(state: PersistentState, id: MeaningId): Meaning {
  const meaning = state.meanings.find((candidate) => candidate.meaning_id === id);
  if (!meaning) throw new Error(`meaning does not exist: ${id}`);
  return meaning;
}
