import { meaningId, type MeaningId, type PersistentState, type PreferenceMeaning } from "./model.ts";

export function supersedePreference(state: PersistentState, oldId: MeaningId, replacement: string): PersistentState {
  const old = state.meanings.find((meaning): meaning is PreferenceMeaning => meaning.kind === "preference" && meaning.meaning_id === oldId);
  if (!old || old.currentness !== "current") throw new Error("only a current preference can be superseded");
  const successorId = meaningId(`${old.meaning_id}-successor`);
  const now = "2026-08-30T12:00:00.000Z";
  const successor: PreferenceMeaning = {
    ...old,
    meaning_id: successorId,
    content: replacement,
    learned_at: now,
    applicable_from: now,
    currentness: "current",
    supersedes: old.meaning_id,
    superseded_by: null,
  };
  const meanings = state.meanings.map((meaning) =>
    meaning.meaning_id === old.meaning_id
      ? { ...old, currentness: "superseded" as const, superseded_by: successorId }
      : meaning
  );
  return { ...state, meanings: [...meanings, successor] };
}
