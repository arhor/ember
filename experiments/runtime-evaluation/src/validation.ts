import { createHash } from "node:crypto";

import type { EmberAdoptionEvidence, Evidence, Meaning, PersistentState, UserEvidence } from "./model.ts";

import { evidenceId, lineageId, meaningId } from "./model.ts";

const KINDS = new Set(["relationship", "fact", "preference", "commitment", "episode_meta"]);
const CURRENTNESS = new Set(["current", "superseded", "historical"]);

const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function parsePersistentState(text: string): PersistentState {
    const value: unknown = JSON.parse(text);
    return validatePersistentState(value);
}

export function validatePersistentState(value: unknown): PersistentState {
    if (!record(value)) throw new Error("state must be an object");
    if (value.schemaVersion !== 1) throw new Error("unsupported schemaVersion");
    if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) {
        throw new Error("revision must be a non-negative safe integer");
    }

    const contract = value.runtimeContract;
    if (
        !record(contract) ||
        !nonempty(contract.localPrincipal) ||
        contract.topology !== "single-principal-single-writer"
    ) {
        throw new Error("runtimeContract is invalid");
    }
    const lineage = value.lineage;
    if (
        !record(lineage) ||
        !nonempty(lineage.lineageId) ||
        !nonempty(lineage.displayName) ||
        !nonempty(lineage.establishedAt) ||
        !Array.isArray(lineage.constitutiveBoundaries)
    ) {
        throw new Error("lineage is invalid");
    }
    lineageId(lineage.lineageId);

    if (!Array.isArray(value.evidence) || !Array.isArray(value.meanings)) {
        throw new Error("state collections are invalid");
    }
    const evidence = value.evidence.map(validateEvidence);
    const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
    if (evidenceById.size !== evidence.length) throw new Error("evidence IDs must be unique");
    for (const item of evidence) {
        if (item.sourceRole === "ember_adoption") {
            const source = evidenceById.get(item.derivedFromEvidenceIds[0]);
            if (!source) throw new Error("adoption source evidence does not exist");
            if (source.sourceRole !== "user_command") {
                throw new Error("Ember adoption must derive from attributable user evidence");
            }
        }
    }

    const meanings = value.meanings.map(validateMeaning);
    validateMeaningGraph(meanings, evidenceById);

    const operations = value.operations;
    if (
        !record(operations) ||
        !Array.isArray(operations.runtimeEpisodes) ||
        !Array.isArray(operations.cognitionEpisodes)
    ) {
        throw new Error("operations are invalid");
    }

    return {
        schemaVersion: 1,
        revision: Number(value.revision),
        runtimeContract: {
            localPrincipal: contract.localPrincipal,
            topology: "single-principal-single-writer",
        },
        lineage: {
            lineageId: lineageId(lineage.lineageId),
            displayName: lineage.displayName,
            establishedAt: lineage.establishedAt,
            constitutiveBoundaries: lineage.constitutiveBoundaries.map((boundary) => {
                if (!record(boundary) || boundary.boundaryId !== "minimal-continuity-v1" || !nonempty(boundary.text)) {
                    throw new Error("constitutive boundary is invalid");
                }
                return { boundaryId: "minimal-continuity-v1" as const, text: boundary.text };
            }),
        },
        evidence,
        meanings,
        operations: {
            runtimeEpisodes: operations.runtimeEpisodes,
            cognitionEpisodes: operations.cognitionEpisodes,
        },
    };
}

function validateMeaningGraph(meanings: readonly Meaning[], evidenceById: ReadonlyMap<string, Evidence>) {
    const meaningsById = new Map(meanings.map((meaning) => [meaning.meaningId, meaning]));
    if (meaningsById.size !== meanings.length) throw new Error("meaning IDs must be unique");

    const currentSlots = new Set<string>();
    for (const meaning of meanings) {
        if (!meaning.sourceEvidenceIds.every((id) => evidenceById.has(id))) {
            throw new Error("meaning source evidence does not exist");
        }
        if (meaning.currentness === "current") {
            const slot = `${meaning.kind}\u0000${meaning.owner}\u0000${meaning.slot}\u0000${meaning.scope}`;
            if (currentSlots.has(slot)) throw new Error("two current meanings share one semantic slot");
            currentSlots.add(slot);
            if (meaning.supersededBy !== null) {
                throw new Error("current meaning cannot already be superseded");
            }
        }
        if (meaning.currentness === "superseded" && meaning.supersededBy === null) {
            throw new Error("superseded meaning must identify its successor");
        }

        if (meaning.supersedes !== null) {
            if (meaning.supersedes === meaning.meaningId) {
                throw new Error("meaning cannot supersede itself");
            }
            const predecessor = meaningsById.get(meaning.supersedes);
            if (!predecessor) throw new Error("supersession predecessor does not exist");
            assertCompatibleSupersession(predecessor, meaning);
            if (predecessor.supersededBy !== meaning.meaningId) {
                throw new Error("supersession predecessor does not link back to successor");
            }
            if (predecessor.currentness === "current") {
                throw new Error("supersession predecessor cannot remain current");
            }
        }

        if (meaning.supersededBy !== null) {
            if (meaning.supersededBy === meaning.meaningId) {
                throw new Error("meaning cannot supersede itself");
            }
            const successor = meaningsById.get(meaning.supersededBy);
            if (!successor) throw new Error("supersession successor does not exist");
            assertCompatibleSupersession(meaning, successor);
            if (successor.supersedes !== meaning.meaningId) {
                throw new Error("supersession successor does not link back to predecessor");
            }
        }
    }
}

function assertCompatibleSupersession(predecessor: Meaning, successor: Meaning): void {
    if (
        predecessor.kind !== successor.kind ||
        predecessor.owner !== successor.owner ||
        predecessor.slot !== successor.slot ||
        predecessor.scope !== successor.scope
    ) {
        throw new Error("supersession must preserve kind, owner, slot, and scope");
    }
    if (
        (predecessor.kind !== "fact" && predecessor.kind !== "preference") ||
        (successor.kind !== "fact" && successor.kind !== "preference")
    ) {
        throw new Error("only facts and preferences may participate in supersession");
    }
}

function validateEvidence(value: unknown): Evidence {
    if (!record(value) || !nonempty(value.evidenceId) || !nonempty(value.sourceRole)) {
        throw new Error("evidence identity or role is invalid");
    }
    const id = evidenceId(value.evidenceId);
    if (
        !nonempty(value.sourceActor) ||
        !nonempty(value.assertedPrincipal) ||
        !nonempty(value.occurredAt) ||
        !nonempty(value.observedAt) ||
        !nonempty(value.scope) ||
        !Array.isArray(value.derivedFromEvidenceIds) ||
        !value.derivedFromEvidenceIds.every(nonempty)
    ) {
        throw new Error("evidence provenance fields are invalid");
    }

    if (value.sourceRole === "user_command") {
        if (
            value.sourceActor !== `user:${value.assertedPrincipal}` ||
            value.derivedFromEvidenceIds.length !== 0 ||
            value.payloadMode !== "retained_optional" ||
            value.availability !== "available" ||
            typeof value.payload !== "string" ||
            !nonempty(value.contentDigest) ||
            value.contentDigest !== digest(value.payload)
        ) {
            throw new Error("user evidence is invalid");
        }
        const result: UserEvidence = {
            evidenceId: id,
            sourceRole: "user_command",
            sourceActor: value.sourceActor as `user:${string}`,
            assertedPrincipal: value.assertedPrincipal,
            occurredAt: value.occurredAt,
            observedAt: value.observedAt,
            derivedFromEvidenceIds: [],
            scope: value.scope,
            payloadMode: "retained_optional",
            availability: "available",
            payload: value.payload,
            contentDigest: value.contentDigest as `sha256:${string}`,
        };
        return result;
    }

    if (value.sourceRole === "ember_adoption") {
        if (
            value.sourceActor !== "ember" ||
            value.derivedFromEvidenceIds.length !== 1 ||
            value.payloadMode !== "descriptor_only"
        ) {
            throw new Error("Ember adoption evidence is invalid");
        }
        const result: EmberAdoptionEvidence = {
            evidenceId: id,
            sourceRole: "ember_adoption",
            sourceActor: "ember",
            assertedPrincipal: value.assertedPrincipal,
            occurredAt: value.occurredAt,
            observedAt: value.observedAt,
            derivedFromEvidenceIds: [evidenceId(value.derivedFromEvidenceIds[0])],
            scope: value.scope,
            payloadMode: "descriptor_only",
        };
        return result;
    }

    throw new Error("unsupported evidence role");
}

function validateMeaning(value: unknown): Meaning {
    if (!record(value) || !nonempty(value.meaningId) || !nonempty(value.kind) || !KINDS.has(value.kind)) {
        throw new Error("meaning identity or kind is invalid");
    }
    if (!nonempty(value.owner) || !nonempty(value.slot) || !nonempty(value.scope) || !nonempty(value.content)) {
        throw new Error("meaning routing fields are invalid");
    }
    if (
        !Array.isArray(value.sourceEvidenceIds) ||
        value.sourceEvidenceIds.length === 0 ||
        !value.sourceEvidenceIds.every(nonempty)
    ) {
        throw new Error("meaning source evidence is invalid");
    }
    if (!nonempty(value.epistemicRole) || !nonempty(value.learnedAt) || !nonempty(value.applicableFrom)) {
        throw new Error("meaning temporal fields are invalid");
    }
    if (value.applicableUntil !== null && !nonempty(value.applicableUntil)) {
        throw new Error("meaning applicableUntil is invalid");
    }
    if (!nonempty(value.currentness) || !CURRENTNESS.has(value.currentness)) {
        throw new Error("meaning currentness is invalid");
    }
    if (!("uncertainty" in value) || (value.uncertainty !== null && typeof value.uncertainty !== "string")) {
        throw new Error("meaning uncertainty is invalid");
    }
    if (!nonempty(value.prospectiveLifecycle)) {
        throw new Error("meaning prospective lifecycle is invalid");
    }
    const supersedes = optionalMeaningId(value.supersedes);
    const supersededBy = optionalMeaningId(value.supersededBy);
    const common = {
        meaningId: meaningId(value.meaningId),
        owner: value.owner,
        slot: value.slot,
        scope: value.scope,
        content: value.content,
        sourceEvidenceIds: value.sourceEvidenceIds.map(evidenceId),
        epistemicRole: value.epistemicRole,
        learnedAt: value.learnedAt,
        applicableFrom: value.applicableFrom,
        applicableUntil: value.applicableUntil,
        currentness: value.currentness as Meaning["currentness"],
        uncertainty: value.uncertainty,
    };
    switch (value.kind) {
        case "relationship":
            if (
                !value.owner.startsWith("relationship:") ||
                value.prospectiveLifecycle !== "none" ||
                supersedes ||
                supersededBy
            ) {
                throw new Error("relationship meaning is invalid");
            }
            return {
                ...common,
                kind: "relationship",
                owner: value.owner as `relationship:${string}`,
                prospectiveLifecycle: "none",
                supersedes: null,
                supersededBy: null,
            };
        case "fact":
        case "preference":
            if (!value.owner.startsWith("user:") || value.prospectiveLifecycle !== "none") {
                throw new Error(`${value.kind} meaning is invalid`);
            }
            return {
                ...common,
                kind: value.kind,
                owner: value.owner as `user:${string}`,
                prospectiveLifecycle: "none",
                supersedes,
                supersededBy: supersededBy,
            };
        case "commitment":
            if (value.owner !== "ember" || value.prospectiveLifecycle !== "live" || supersedes || supersededBy) {
                throw new Error("commitment meaning is invalid");
            }
            return {
                ...common,
                kind: "commitment",
                owner: "ember",
                prospectiveLifecycle: "live",
                supersedes: null,
                supersededBy: null,
            };
        case "episode_meta":
            if (value.prospectiveLifecycle !== "none" || supersedes || supersededBy) {
                throw new Error("episode meaning is invalid");
            }
            return {
                ...common,
                kind: "episode_meta",
                prospectiveLifecycle: "none",
                supersedes: null,
                supersededBy: null,
            };
        default:
            throw new Error("unsupported meaning kind");
    }
}

function optionalMeaningId(value: unknown) {
    if (value === null) return null;
    if (!nonempty(value)) throw new Error("supersession link is invalid");
    return meaningId(value);
}

function digest(payload: string): `sha256:${string}` {
    return `sha256:${createHash("sha256").update(payload, "utf8").digest("hex")}`;
}
