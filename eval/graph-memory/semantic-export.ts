import type { EmberState, Evidence, EvidenceId, Meaning, MeaningId } from "../../src/core/model.ts";
import type { ProjectionMeaningReader } from "../../src/core/projection.ts";
import type { StateMaterialization } from "../../src/core/state-materialization.ts";

import { ValidationError } from "../../src/core/errors.ts";
import { validateState } from "../../src/core/model.ts";
import { cloneState } from "../../src/util.ts";

export const SEMANTIC_MEMORY_EXPORT_VERSION = 1;

type StripEvidencePayload<T extends Evidence> = T extends Evidence ? Omit<T, "payload" | "contentDigest"> : never;

export type SemanticEvidenceDescriptor = StripEvidencePayload<Evidence>;

export interface SemanticMemoryExportPolicy {
    principal: string;
    activeScope: string;
    explainIds?: Array<MeaningId | string>;
}

export interface SemanticMemoryExport {
    exportVersion: 1;
    sourceSchemaVersion: number;
    sourceRevision: number;
    lineageId: EmberState["lineage"]["lineageId"];
    principal: string;
    activeScope: string;
    includedScopes: string[];
    explainIds: MeaningId[];
    disclosurePolicy: { evidencePayloads: "excluded" };
    meanings: Meaning[];
    evidence: SemanticEvidenceDescriptor[];
}

export interface SemanticMemoryReader extends ProjectionMeaningReader {
    findEvidence(id: EvidenceId | string): SemanticEvidenceDescriptor | null;
    listEvidence(): SemanticEvidenceDescriptor[];
}

export interface SemanticMemoryExplanation {
    meaning: Meaning;
    source_evidence: SemanticEvidenceDescriptor[];
    related_detail_evidence: SemanticEvidenceDescriptor[];
    linked_meanings: Partial<Record<"supersedes" | "supersededBy", Meaning>>;
}

/**
 * Produces the representation-neutral, payload-minimised semantic export used by
 * the graph-memory spike. It is intentionally upstream of both Markdown rendering
 * and graph layout so neither representation becomes the semantic contract.
 */
export function buildSemanticMemoryExport(state: EmberState, policy: SemanticMemoryExportPolicy): SemanticMemoryExport {
    validateState(state);
    if (policy.principal !== state.runtimeContract.localPrincipal) {
        throw new ValidationError("semantic export principal does not match initialized local principal");
    }
    if (!policy.activeScope.trim()) throw new ValidationError("semantic export activeScope must be non-empty");

    const meaningsById = new Map(state.meanings.map((meaning) => [meaning.meaningId, meaning]));
    const explainIds = [...new Set(policy.explainIds ?? [])].map((id) => {
        const meaning = meaningsById.get(id as MeaningId);
        if (!meaning) throw new ValidationError(`semantic export explain meaning does not exist: ${id}`);
        return meaning.meaningId;
    });
    const selectedMeaningIds = new Set<MeaningId>();

    for (const meaning of state.meanings) {
        if (
            meaning.scope === policy.activeScope ||
            (meaning.kind === "relationship" && meaning.owner === `relationship:${policy.principal}`)
        ) {
            selectedMeaningIds.add(meaning.meaningId);
        }
    }
    for (const id of explainIds) {
        const meaning = meaningsById.get(id)!;
        selectedMeaningIds.add(meaning.meaningId);
        for (const linkedId of [meaning.supersedes, meaning.supersededBy]) {
            if (!linkedId) continue;
            if (!meaningsById.has(linkedId)) {
                throw new ValidationError(`semantic export linked meaning does not exist: ${linkedId}`);
            }
            selectedMeaningIds.add(linkedId);
        }
    }

    const meanings = state.meanings.filter((meaning) => selectedMeaningIds.has(meaning.meaningId)).map(cloneState);
    const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence]));
    const selectedEvidenceIds = new Set<EvidenceId>();

    const visitEvidence = (id: EvidenceId): void => {
        if (selectedEvidenceIds.has(id)) return;
        const evidence = evidenceById.get(id);
        if (!evidence) throw new ValidationError(`semantic export evidence does not exist: ${id}`);
        selectedEvidenceIds.add(id);
        for (const parentId of evidence.derivedFromEvidenceIds) visitEvidence(parentId);
    };

    for (const meaning of meanings) {
        for (const evidenceId of meaning.sourceEvidenceIds) visitEvidence(evidenceId);
    }
    const explicitExplainIds = new Set(explainIds);
    for (const evidence of state.evidence) {
        if (evidence.relatedMeaningId !== undefined && explicitExplainIds.has(evidence.relatedMeaningId)) {
            visitEvidence(evidence.evidenceId);
        }
    }

    const evidence = [...selectedEvidenceIds]
        .sort((left, right) => left.localeCompare(right))
        .map((id) => stripEvidencePayload(evidenceById.get(id)!));
    const includedScopes = [
        ...new Set([...meanings.map((meaning) => meaning.scope), ...evidence.map((item) => item.scope)]),
    ].sort();

    return {
        exportVersion: SEMANTIC_MEMORY_EXPORT_VERSION,
        sourceSchemaVersion: state.schemaVersion,
        sourceRevision: state.revision,
        lineageId: state.lineage.lineageId,
        principal: policy.principal,
        activeScope: policy.activeScope,
        includedScopes,
        explainIds,
        disclosurePolicy: { evidencePayloads: "excluded" },
        meanings,
        evidence,
    };
}

/**
 * Reconstructs the existing Markdown materialization DTO from the semantic export.
 * Tests compare the rendered bytes with buildStateMaterialization() so the spike
 * proves the export boundary preserves Markdown v1 rather than defining a second
 * convenient-but-different selector.
 */
export function materializeSemanticMemoryExport(memory: SemanticMemoryExport): StateMaterialization {
    const evidenceById = new Map(memory.evidence.map((evidence) => [evidence.evidenceId, evidence]));
    const selected = memory.meanings
        .filter((meaning) => meaning.scope === memory.activeScope)
        .sort((left, right) => left.meaningId.localeCompare(right.meaningId))
        .map((meaning) => ({
            ...cloneState(meaning),
            sourceEvidence: meaning.sourceEvidenceIds.map((id) => {
                const evidence = evidenceById.get(id);
                if (!evidence) throw new ValidationError(`semantic export is missing direct evidence: ${id}`);
                return cloneState(evidence);
            }),
        }));

    return {
        materializationVersion: 1,
        sourceSchemaVersion: memory.sourceSchemaVersion,
        sourceRevision: memory.sourceRevision,
        lineageId: memory.lineageId,
        purpose: "filesystem_inspection",
        disclosurePolicy: {
            principal: memory.principal,
            scope: memory.activeScope,
            evidencePayloads: "excluded",
        },
        interactionModes: {
            "SELF.md": "generated_only",
            "USER.md": "selective_proposal_authoring",
            "RELATIONSHIP.md": "generated_only",
            "MEMORY.md": "generated_only",
        },
        views: {
            "SELF.md": selected.filter((meaning) => meaning.owner === `agent:${memory.lineageId}`),
            "USER.md": selected.filter((meaning) => meaning.owner === `user:${memory.principal}`),
            "RELATIONSHIP.md": selected.filter((meaning) => meaning.owner === `relationship:${memory.principal}`),
            "MEMORY.md": selected,
        },
    };
}

export function semanticMemoryExportReader(memory: SemanticMemoryExport): SemanticMemoryReader {
    return {
        listMeanings() {
            return cloneState(memory.meanings);
        },
        findMeaning(id) {
            const meaning = memory.meanings.find((candidate) => candidate.meaningId === id);
            return meaning ? cloneState(meaning) : null;
        },
        linkedMeaningIds(id) {
            const meaning = memory.meanings.find((candidate) => candidate.meaningId === id);
            if (!meaning) return [];
            return [meaning.supersedes, meaning.supersededBy].filter((linked): linked is MeaningId => linked !== null);
        },
        findEvidence(id) {
            const evidence = memory.evidence.find((candidate) => candidate.evidenceId === id);
            return evidence ? cloneState(evidence) : null;
        },
        listEvidence() {
            return cloneState(memory.evidence);
        },
    };
}

/** A representation-neutral explanation query mirroring Ember explanation semantics. */
export function querySemanticMemory(reader: SemanticMemoryReader, id: MeaningId | string): SemanticMemoryExplanation {
    const meaning = reader.findMeaning(id);
    if (!meaning) throw new ValidationError(`semantic memory meaning does not exist: ${id}`);

    const sourceEvidence = evidenceLineage(meaning.sourceEvidenceIds, reader);
    const linked: SemanticMemoryExplanation["linked_meanings"] = {};
    for (const field of ["supersedes", "supersededBy"] as const) {
        const linkedId = meaning[field];
        if (!linkedId) continue;
        const linkedMeaning = reader.findMeaning(linkedId);
        if (!linkedMeaning) throw new ValidationError(`semantic memory linked meaning does not exist: ${linkedId}`);
        linked[field] = linkedMeaning;
    }

    const relatedDetailEvidence = reader
        .listEvidence()
        .filter((evidence) => evidence.relatedMeaningId === meaning.meaningId)
        .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

    return {
        meaning: cloneState(meaning),
        source_evidence: sourceEvidence,
        related_detail_evidence: relatedDetailEvidence,
        linked_meanings: linked,
    };
}

function evidenceLineage(ids: EvidenceId[], reader: SemanticMemoryReader): SemanticEvidenceDescriptor[] {
    const result: SemanticEvidenceDescriptor[] = [];
    const seen = new Set<EvidenceId>();

    const visit = (id: EvidenceId): void => {
        if (seen.has(id)) return;
        const evidence = reader.findEvidence(id);
        if (!evidence) throw new ValidationError(`semantic memory evidence lineage refers to absent evidence: ${id}`);
        seen.add(id);
        result.push(evidence);
        for (const parentId of evidence.derivedFromEvidenceIds) visit(parentId);
    };

    for (const id of ids) visit(id);
    return result;
}

function stripEvidencePayload(evidence: Evidence): SemanticEvidenceDescriptor {
    const descriptor = cloneState(evidence) as Evidence & { payload?: string; contentDigest?: string };
    delete descriptor.payload;
    delete descriptor.contentDigest;
    return descriptor as SemanticEvidenceDescriptor;
}
