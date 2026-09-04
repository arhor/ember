import { createHash } from "node:crypto";
import {
    evidenceId,
    type MeaningId,
    meaningId,
    type PersistentState,
    type PreferenceMeaning,
    type UserEvidence,
} from "./model.ts";

export function supersedePreference(state: PersistentState, oldId: MeaningId, replacement: string): PersistentState {
    if (!replacement.trim()) throw new Error("replacement preference must not be empty");
    const old = state.meanings.find(
        (meaning): meaning is PreferenceMeaning => meaning.kind === "preference" && meaning.meaning_id === oldId,
    );
    if (!old || old.currentness !== "current") {
        throw new Error("only a current preference can be superseded");
    }
    const principal = state.runtime_contract.local_principal;
    if (old.owner !== `user:${principal}`) {
        throw new Error("preference owner must match the local principal");
    }

    const successorId = meaningId(`${old.meaning_id}-successor`);
    const successorEvidenceId = evidenceId(`evidence-${old.meaning_id.slice("meaning-".length)}-successor`);
    if (state.meanings.some((meaning) => meaning.meaning_id === successorId)) {
        throw new Error("successor meaning identifier already exists");
    }
    if (state.evidence.some((evidence) => evidence.evidence_id === successorEvidenceId)) {
        throw new Error("successor evidence identifier already exists");
    }

    const now = "2026-08-30T12:00:00.000Z";
    const successorEvidence: UserEvidence = {
        evidence_id: successorEvidenceId,
        source_role: "user_command",
        source_actor: old.owner,
        asserted_principal: principal,
        occurred_at: now,
        observed_at: now,
        derived_from_evidence_ids: [],
        scope: old.scope,
        payload_mode: "retained_optional",
        availability: "available",
        payload: replacement,
        content_digest: digest(replacement),
    };
    const successor: PreferenceMeaning = {
        ...old,
        meaning_id: successorId,
        content: replacement,
        source_evidence_ids: [successorEvidence.evidence_id],
        learned_at: now,
        applicable_from: now,
        currentness: "current",
        supersedes: old.meaning_id,
        superseded_by: null,
    };
    const meanings = state.meanings.map((meaning) =>
        meaning.meaning_id === old.meaning_id
            ? { ...old, currentness: "superseded" as const, superseded_by: successorId }
            : meaning,
    );
    return {
        ...state,
        evidence: [...state.evidence, successorEvidence],
        meanings: [...meanings, successor],
    };
}

function digest(payload: string): `sha256:${string}` {
    return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}
