import { createHash } from "node:crypto";

import type { MeaningId, PersistentState, PreferenceMeaning, UserEvidence } from "./model.ts";

import { evidenceId, meaningId } from "./model.ts";

export function supersedePreference(state: PersistentState, oldId: MeaningId, replacement: string): PersistentState {
    if (!replacement.trim()) throw new Error("replacement preference must not be empty");
    const old = state.meanings.find(
        (meaning): meaning is PreferenceMeaning => meaning.kind === "preference" && meaning.meaningId === oldId,
    );
    if (!old || old.currentness !== "current") {
        throw new Error("only a current preference can be superseded");
    }
    const principal = state.runtimeContract.localPrincipal;
    if (old.owner !== `user:${principal}`) {
        throw new Error("preference owner must match the local principal");
    }

    const successorId = meaningId(`${old.meaningId}-successor`);
    const successorEvidenceId = evidenceId(`evidence-${old.meaningId.slice("meaning-".length)}-successor`);
    if (state.meanings.some((meaning) => meaning.meaningId === successorId)) {
        throw new Error("successor meaning identifier already exists");
    }
    if (state.evidence.some((evidence) => evidence.evidenceId === successorEvidenceId)) {
        throw new Error("successor evidence identifier already exists");
    }

    const now = "2026-08-30T12:00:00.000Z";
    const successorEvidence: UserEvidence = {
        evidenceId: successorEvidenceId,
        sourceRole: "user_command",
        sourceActor: old.owner,
        assertedPrincipal: principal,
        occurredAt: now,
        observedAt: now,
        derivedFromEvidenceIds: [],
        scope: old.scope,
        payloadMode: "retained_optional",
        availability: "available",
        payload: replacement,
        contentDigest: digest(replacement),
    };
    const successor: PreferenceMeaning = {
        ...old,
        meaningId: successorId,
        content: replacement,
        sourceEvidenceIds: [successorEvidence.evidenceId],
        learnedAt: now,
        applicableFrom: now,
        currentness: "current",
        supersedes: old.meaningId,
        supersededBy: null,
    };
    const meanings = state.meanings.map((meaning) =>
        meaning.meaningId === old.meaningId
            ? { ...old, currentness: "superseded" as const, supersededBy: successorId }
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
