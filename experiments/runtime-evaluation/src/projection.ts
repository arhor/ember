import type { CliInput, Meaning, MeaningId, PersistentState, Projection, ProjectionMeaning } from "./model.ts";

export function buildProjection(
    state: PersistentState,
    purpose: Projection["purpose"],
    input: CliInput,
    explainIds: readonly MeaningId[] = [],
): Projection {
    const principal = state.runtimeContract.localPrincipal;
    const selected = new Map<MeaningId, Meaning>();

    for (const meaning of state.meanings) {
        if (
            meaning.kind === "relationship" &&
            meaning.currentness === "current" &&
            meaning.owner === `relationship:${principal}`
        ) {
            selected.set(meaning.meaningId, meaning);
        } else if (
            (meaning.kind === "fact" || meaning.kind === "preference") &&
            meaning.currentness === "current" &&
            meaning.scope === input.scope
        ) {
            selected.set(meaning.meaningId, meaning);
        } else if (
            meaning.kind === "commitment" &&
            meaning.currentness === "current" &&
            meaning.prospectiveLifecycle === "live" &&
            meaning.scope === input.scope
        ) {
            selected.set(meaning.meaningId, meaning);
        }
    }

    if (purpose === "explain") {
        for (const id of new Set(explainIds)) {
            const meaning = findMeaning(state, id);
            selected.set(meaning.meaningId, meaning);
            for (const linkedId of [meaning.supersedes, meaning.supersededBy]) {
                if (linkedId !== null) {
                    const linked = findMeaning(state, linkedId);
                    selected.set(linked.meaningId, linked);
                }
            }
        }
    }

    const meanings: ProjectionMeaning[] = [...selected.values()].map((meaning) => ({
        meaningId: meaning.meaningId,
        kind: meaning.kind,
        owner: meaning.owner,
        slot: meaning.slot,
        scope: meaning.scope,
        content: meaning.content,
        sourceEvidenceIds: meaning.sourceEvidenceIds,
        currentness: meaning.currentness,
    }));
    return {
        purpose,
        lineage: { lineageId: state.lineage.lineageId, displayName: state.lineage.displayName },
        selection: { meaning_ids: meanings.map((meaning) => meaning.meaningId), meanings },
        input,
    };
}

function findMeaning(state: PersistentState, id: MeaningId): Meaning {
    const meaning = state.meanings.find((candidate) => candidate.meaningId === id);
    if (!meaning) throw new Error(`meaning does not exist: ${id}`);
    return meaning;
}
