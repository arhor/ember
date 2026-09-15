import type { EvidenceId, Meaning, MeaningId } from "../../src/core/model.ts";
import type { SemanticEvidenceDescriptor, SemanticMemoryExport, SemanticMemoryReader } from "./semantic-export.ts";

export const GRAPH_MEMORY_PROTOTYPE_VERSION = 2;

export interface GraphResolutionFixture {
    meaningId: MeaningId | string;
    contextualSummary?: string;
}

export interface GraphMeaningNode {
    nodeKind: "meaning";
    nodeId: string;
    meaningId: MeaningId;
    semantic: Meaning;
}

export interface GraphMeaningReferenceNode {
    nodeKind: "meaning_reference";
    nodeId: string;
    meaningId: MeaningId;
}

export interface GraphEvidenceNode {
    nodeKind: "evidence";
    nodeId: string;
    evidenceId: EvidenceId;
    descriptor: SemanticEvidenceDescriptor;
}

export interface GraphResolutionNode {
    nodeKind: "resolution";
    nodeId: string;
    meaningId: MeaningId;
    level: 0 | 1 | 2;
    content: string | null;
    derivation: "canonical_content" | "fixture_derived" | "canonical_related_context";
    evidenceAuthority: "none";
}

export type GraphMemoryNode = GraphMeaningNode | GraphMeaningReferenceNode | GraphEvidenceNode | GraphResolutionNode;

export type GraphMemoryEdgeKind =
    | "supported_by"
    | "evidence_derived_from"
    | "supersedes"
    | "details_meaning"
    | "resolution_of"
    | "expands_to";

export interface GraphMemoryEdge {
    edgeKind: GraphMemoryEdgeKind;
    from: string;
    to: string;
    authority: "canonical_semantics" | "representation_only";
}

export interface GraphMemoryPrototype {
    representationVersion: 2;
    sourceExportVersion: SemanticMemoryExport["exportVersion"];
    sourceSchemaVersion: number;
    sourceRevision: number;
    lineageId: string;
    principal: string;
    activeScope: string;
    includedScopes: string[];
    explainIds: MeaningId[];
    purpose: "semantic_memory_evaluation";
    disclosurePolicy: SemanticMemoryExport["disclosurePolicy"];
    nodes: GraphMemoryNode[];
    edges: GraphMemoryEdge[];
}

export type GraphMemoryExpansionLevel =
    | {
          level: 0 | 1;
          meaningId: MeaningId;
          content: string;
          provenanceEvidenceIds: EvidenceId[];
          authority: "canonical_meaning" | "derived_non_evidence";
      }
    | {
          level: 2;
          meaningId: MeaningId;
          provenanceEvidenceIds: EvidenceId[];
          relatedDetailEvidence: GraphEvidenceNode[];
          linkedMeaningIds: MeaningId[];
          authority: "canonical_context_reference";
      }
    | {
          level: 3;
          meaningId: MeaningId;
          provenanceEvidenceIds: EvidenceId[];
          directSourceEvidence: GraphEvidenceNode[];
          evidenceLineage: GraphEvidenceNode[];
          rootEvidenceIds: EvidenceId[];
          authority: "canonical_evidence_reference";
      };

export interface GraphMemoryExpansion {
    meaningId: MeaningId;
    levels: GraphMemoryExpansionLevel[];
}

/**
 * Builds an evaluation-only graph-shaped representation from a representation-neutral
 * semantic export. The graph is therefore a candidate backing representation rather
 * than a second renderer layered on the Markdown inspection DTO.
 */
export function buildGraphMemoryPrototype(
    memory: SemanticMemoryExport,
    resolutionFixtures: GraphResolutionFixture[] = [],
): GraphMemoryPrototype {
    const nodes = new Map<string, GraphMemoryNode>();
    const edges: GraphMemoryEdge[] = [];
    const edgeKeys = new Set<string>();
    const resolutions = resolutionFixtureMap(memory, resolutionFixtures);

    const addEdge = (edge: GraphMemoryEdge): void => {
        const key = `${edge.edgeKind}\u0000${edge.from}\u0000${edge.to}`;
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push(edge);
    };

    const ensureMeaningReference = (meaningId: MeaningId): void => {
        const nodeId = meaningNodeId(meaningId);
        if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
                nodeKind: "meaning_reference",
                nodeId,
                meaningId,
            });
        }
    };

    for (const meaning of memory.meanings) {
        const nodeId = meaningNodeId(meaning.meaningId);
        nodes.set(nodeId, {
            nodeKind: "meaning",
            nodeId,
            meaningId: meaning.meaningId,
            semantic: {
                ...structuredClone(meaning),
                sourceEvidenceIds: [],
                supersedes: null,
                supersededBy: null,
            },
        });
    }
    for (const evidence of memory.evidence) {
        const nodeId = evidenceNodeId(evidence.evidenceId);
        nodes.set(nodeId, {
            nodeKind: "evidence",
            nodeId,
            evidenceId: evidence.evidenceId,
            descriptor: structuredClone(evidence),
        });
    }

    for (const meaning of memory.meanings) {
        const sourceNodeId = meaningNodeId(meaning.meaningId);
        for (const evidenceId of meaning.sourceEvidenceIds) {
            requireEvidenceNode(nodes, evidenceId);
            addEdge({
                edgeKind: "supported_by",
                from: sourceNodeId,
                to: evidenceNodeId(evidenceId),
                authority: "canonical_semantics",
            });
        }

        if (meaning.supersedes) {
            ensureMeaningReference(meaning.supersedes);
            addEdge({
                edgeKind: "supersedes",
                from: sourceNodeId,
                to: meaningNodeId(meaning.supersedes),
                authority: "canonical_semantics",
            });
        }

        const detailEvidenceIds = memory.evidence
            .filter((evidence) => evidence.relatedMeaningId === meaning.meaningId)
            .map((evidence) => evidence.evidenceId);
        addResolutionNodes(nodes, addEdge, meaning, resolutions.get(meaning.meaningId), detailEvidenceIds);
    }

    for (const evidence of memory.evidence) {
        const sourceNodeId = evidenceNodeId(evidence.evidenceId);
        for (const parentEvidenceId of evidence.derivedFromEvidenceIds) {
            requireEvidenceNode(nodes, parentEvidenceId);
            addEdge({
                edgeKind: "evidence_derived_from",
                from: sourceNodeId,
                to: evidenceNodeId(parentEvidenceId),
                authority: "canonical_semantics",
            });
        }

        if (evidence.relatedMeaningId) {
            ensureMeaningReference(evidence.relatedMeaningId);
            addEdge({
                edgeKind: "details_meaning",
                from: sourceNodeId,
                to: meaningNodeId(evidence.relatedMeaningId),
                authority: "canonical_semantics",
            });
        }
    }

    return {
        representationVersion: GRAPH_MEMORY_PROTOTYPE_VERSION,
        sourceExportVersion: memory.exportVersion,
        sourceSchemaVersion: memory.sourceSchemaVersion,
        sourceRevision: memory.sourceRevision,
        lineageId: memory.lineageId,
        principal: memory.principal,
        activeScope: memory.activeScope,
        includedScopes: [...memory.includedScopes],
        explainIds: [...memory.explainIds],
        purpose: "semantic_memory_evaluation",
        disclosurePolicy: structuredClone(memory.disclosurePolicy),
        nodes: [...nodes.values()],
        edges,
    };
}

/**
 * Exposes the four-resolution spike path.
 *
 * L1 is a deliberately derived, non-evidential summary. L2 contains references to
 * canonical detail evidence and linked meanings rather than invented detail text.
 * L3 recursively follows evidence derivation to provenance roots.
 */
export function expandGraphMemory(graph: GraphMemoryPrototype, id: MeaningId | string): GraphMemoryExpansion {
    const meaning = graph.nodes.find(
        (node): node is GraphMeaningNode => node.nodeKind === "meaning" && node.meaningId === id,
    );
    if (!meaning) throw new Error(`graph memory meaning does not exist: ${id}`);

    const directSourceEvidence = graph.edges
        .filter((edge) => edge.edgeKind === "supported_by" && edge.from === meaning.nodeId)
        .map((edge) => graphEvidenceNode(graph, edge.to));
    const evidenceLineage = graphEvidenceLineage(
        graph,
        directSourceEvidence.map((evidence) => evidence.evidenceId),
    );
    const provenanceEvidenceIds = evidenceLineage.map((evidence) => evidence.evidenceId);
    const rootEvidenceIds = evidenceLineage
        .filter(
            (evidence) =>
                !graph.edges.some((edge) => edge.edgeKind === "evidence_derived_from" && edge.from === evidence.nodeId),
        )
        .map((evidence) => evidence.evidenceId);

    const relatedDetailEvidence = graph.edges
        .filter((edge) => edge.edgeKind === "details_meaning" && edge.to === meaning.nodeId)
        .map((edge) => graphEvidenceNode(graph, edge.from))
        .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
    const linkedMeaningIds = graphLinkedMeaningIds(graph, meaning.meaningId);

    const resolutions = graph.nodes
        .filter(
            (node): node is GraphResolutionNode =>
                node.nodeKind === "resolution" && node.meaningId === meaning.meaningId,
        )
        .sort((left, right) => left.level - right.level);

    const levels: GraphMemoryExpansionLevel[] = resolutions.map((resolution) => {
        if (resolution.level === 2) {
            return {
                level: 2,
                meaningId: meaning.meaningId,
                provenanceEvidenceIds: [...provenanceEvidenceIds],
                relatedDetailEvidence: structuredClone(relatedDetailEvidence),
                linkedMeaningIds: [...linkedMeaningIds],
                authority: "canonical_context_reference",
            };
        }
        return {
            level: resolution.level,
            meaningId: meaning.meaningId,
            content: resolution.content!,
            provenanceEvidenceIds: [...provenanceEvidenceIds],
            authority: resolution.level === 0 ? "canonical_meaning" : "derived_non_evidence",
        };
    });
    levels.push({
        level: 3,
        meaningId: meaning.meaningId,
        provenanceEvidenceIds: [...provenanceEvidenceIds],
        directSourceEvidence: structuredClone(directSourceEvidence),
        evidenceLineage: structuredClone(evidenceLineage),
        rootEvidenceIds: [...rootEvidenceIds],
        authority: "canonical_evidence_reference",
    });

    return { meaningId: meaning.meaningId, levels };
}

export function graphMemoryReader(graph: GraphMemoryPrototype): SemanticMemoryReader {
    return {
        listMeanings() {
            return graph.nodes
                .filter((node): node is GraphMeaningNode => node.nodeKind === "meaning")
                .map((node) => graphMeaning(graph, node.meaningId));
        },
        findMeaning(id) {
            const node = graph.nodes.find(
                (candidate): candidate is GraphMeaningNode =>
                    candidate.nodeKind === "meaning" && candidate.meaningId === id,
            );
            return node ? graphMeaning(graph, node.meaningId) : null;
        },
        linkedMeaningIds(id) {
            return graphLinkedMeaningIds(graph, id);
        },
        findEvidence(id) {
            const node = graph.nodes.find(
                (candidate): candidate is GraphEvidenceNode =>
                    candidate.nodeKind === "evidence" && candidate.evidenceId === id,
            );
            return node ? graphEvidenceDescriptor(graph, node) : null;
        },
        listEvidence() {
            return graph.nodes
                .filter((node): node is GraphEvidenceNode => node.nodeKind === "evidence")
                .map((node) => graphEvidenceDescriptor(graph, node));
        },
    };
}

export function graphMemoryPrototypeStats(graph: GraphMemoryPrototype) {
    return {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        serializedBytes: Buffer.byteLength(JSON.stringify(graph), "utf8"),
    };
}

function resolutionFixtureMap(
    memory: SemanticMemoryExport,
    fixtures: GraphResolutionFixture[],
): Map<MeaningId, GraphResolutionFixture> {
    const selected = new Set(memory.meanings.map((meaning) => meaning.meaningId));
    const result = new Map<MeaningId, GraphResolutionFixture>();

    for (const fixture of fixtures) {
        const meaningId = fixture.meaningId as MeaningId;
        if (!selected.has(meaningId)) {
            throw new Error(`resolution fixture refers to meaning outside the semantic export: ${fixture.meaningId}`);
        }
        if (result.has(meaningId)) {
            throw new Error(`duplicate resolution fixture for meaning: ${fixture.meaningId}`);
        }
        if (fixture.contextualSummary !== undefined && !fixture.contextualSummary.trim()) {
            throw new Error(`contextualSummary must be non-empty when provided for meaning: ${fixture.meaningId}`);
        }
        result.set(meaningId, fixture);
    }

    return result;
}

function addResolutionNodes(
    nodes: Map<string, GraphMemoryNode>,
    addEdge: (edge: GraphMemoryEdge) => void,
    meaning: Meaning,
    fixture: GraphResolutionFixture | undefined,
    detailEvidenceIds: EvidenceId[],
): void {
    const levels: GraphResolutionNode[] = [
        {
            nodeKind: "resolution",
            nodeId: resolutionNodeId(meaning.meaningId, 0),
            meaningId: meaning.meaningId,
            level: 0,
            content: meaning.content,
            derivation: "canonical_content",
            evidenceAuthority: "none",
        },
    ];
    if (fixture?.contextualSummary !== undefined) {
        levels.push({
            nodeKind: "resolution",
            nodeId: resolutionNodeId(meaning.meaningId, 1),
            meaningId: meaning.meaningId,
            level: 1,
            content: fixture.contextualSummary,
            derivation: "fixture_derived",
            evidenceAuthority: "none",
        });
    }
    levels.push({
        nodeKind: "resolution",
        nodeId: resolutionNodeId(meaning.meaningId, 2),
        meaningId: meaning.meaningId,
        level: 2,
        content: null,
        derivation: "canonical_related_context",
        evidenceAuthority: "none",
    });

    let previousResolutionId: string | null = null;
    for (const resolution of levels) {
        nodes.set(resolution.nodeId, resolution);
        addEdge({
            edgeKind: "resolution_of",
            from: resolution.nodeId,
            to: meaningNodeId(meaning.meaningId),
            authority: "representation_only",
        });
        if (previousResolutionId !== null) {
            addEdge({
                edgeKind: "expands_to",
                from: previousResolutionId,
                to: resolution.nodeId,
                authority: "representation_only",
            });
        }
        previousResolutionId = resolution.nodeId;
    }

    for (const evidenceId of detailEvidenceIds) {
        addEdge({
            edgeKind: "expands_to",
            from: previousResolutionId!,
            to: evidenceNodeId(evidenceId),
            authority: "representation_only",
        });
    }
    for (const linkedMeaningId of [meaning.supersedes, meaning.supersededBy]) {
        if (!linkedMeaningId) continue;
        addEdge({
            edgeKind: "expands_to",
            from: previousResolutionId!,
            to: meaningNodeId(linkedMeaningId),
            authority: "representation_only",
        });
    }
    for (const evidenceId of meaning.sourceEvidenceIds) {
        addEdge({
            edgeKind: "expands_to",
            from: previousResolutionId!,
            to: evidenceNodeId(evidenceId),
            authority: "representation_only",
        });
    }
}

function graphMeaning(graph: GraphMemoryPrototype, meaningId: MeaningId): Meaning {
    const node = graph.nodes.find(
        (candidate): candidate is GraphMeaningNode =>
            candidate.nodeKind === "meaning" && candidate.meaningId === meaningId,
    );
    if (!node) throw new Error(`graph memory meaning node does not exist: ${meaningId}`);

    const sourceEvidenceIds = graph.edges
        .filter((edge) => edge.edgeKind === "supported_by" && edge.from === node.nodeId)
        .map((edge) => graphEvidenceNode(graph, edge.to).evidenceId);
    const supersedes = graph.edges.find((edge) => edge.edgeKind === "supersedes" && edge.from === node.nodeId);
    const supersededBy = graph.edges.find((edge) => edge.edgeKind === "supersedes" && edge.to === node.nodeId);

    const semantic = structuredClone(node.semantic);
    if (semantic.kind === "fact" || semantic.kind === "preference") {
        return {
            ...semantic,
            sourceEvidenceIds,
            supersedes: supersedes ? graphMeaningId(graph, supersedes.to) : null,
            supersededBy: supersededBy ? graphMeaningId(graph, supersededBy.from) : null,
        };
    }
    return {
        ...semantic,
        sourceEvidenceIds,
    };
}

function graphLinkedMeaningIds(graph: GraphMemoryPrototype, id: MeaningId | string): MeaningId[] {
    const nodeId = meaningNodeId(id as MeaningId);
    const result: MeaningId[] = [];
    for (const edge of graph.edges) {
        if (edge.edgeKind !== "supersedes") continue;
        if (edge.from === nodeId) result.push(graphMeaningId(graph, edge.to));
        if (edge.to === nodeId) result.push(graphMeaningId(graph, edge.from));
    }
    return result;
}

function graphMeaningId(graph: GraphMemoryPrototype, nodeId: string): MeaningId {
    const node = graph.nodes.find(
        (candidate): candidate is GraphMeaningNode | GraphMeaningReferenceNode =>
            (candidate.nodeKind === "meaning" || candidate.nodeKind === "meaning_reference") &&
            candidate.nodeId === nodeId,
    );
    if (!node) throw new Error(`graph memory meaning node does not exist: ${nodeId}`);
    return node.meaningId;
}

function graphEvidenceDescriptor(graph: GraphMemoryPrototype, node: GraphEvidenceNode): SemanticEvidenceDescriptor {
    const descriptor = structuredClone(node.descriptor) as SemanticEvidenceDescriptor & {
        derivedFromEvidenceIds: EvidenceId[];
        relatedMeaningId?: MeaningId;
    };
    descriptor.derivedFromEvidenceIds = graph.edges
        .filter((edge) => edge.edgeKind === "evidence_derived_from" && edge.from === node.nodeId)
        .map((edge) => graphEvidenceNode(graph, edge.to).evidenceId);

    const relatedMeaning = graph.edges.find((edge) => edge.edgeKind === "details_meaning" && edge.from === node.nodeId);
    if (relatedMeaning) {
        descriptor.relatedMeaningId = graphMeaningId(graph, relatedMeaning.to);
    } else {
        delete descriptor.relatedMeaningId;
    }
    return descriptor as SemanticEvidenceDescriptor;
}

function graphEvidenceLineage(graph: GraphMemoryPrototype, ids: EvidenceId[]): GraphEvidenceNode[] {
    const result: GraphEvidenceNode[] = [];
    const seen = new Set<EvidenceId>();

    const visit = (id: EvidenceId): void => {
        if (seen.has(id)) return;
        const evidence = graphEvidenceNode(graph, evidenceNodeId(id));
        seen.add(id);
        result.push(evidence);
        const parentIds = graph.edges
            .filter((edge) => edge.edgeKind === "evidence_derived_from" && edge.from === evidence.nodeId)
            .map((edge) => graphEvidenceNode(graph, edge.to).evidenceId);
        for (const parentId of parentIds) visit(parentId);
    };

    for (const id of ids) visit(id);
    return result;
}

function graphEvidenceNode(graph: GraphMemoryPrototype, nodeId: string): GraphEvidenceNode {
    const node = graph.nodes.find(
        (candidate): candidate is GraphEvidenceNode => candidate.nodeKind === "evidence" && candidate.nodeId === nodeId,
    );
    if (!node) throw new Error(`graph memory evidence node does not exist: ${nodeId}`);
    return node;
}

function requireEvidenceNode(nodes: Map<string, GraphMemoryNode>, evidenceId: EvidenceId): void {
    const node = nodes.get(evidenceNodeId(evidenceId));
    if (node?.nodeKind !== "evidence") throw new Error(`semantic export is missing evidence: ${evidenceId}`);
}

function meaningNodeId(meaningId: MeaningId): string {
    return `meaning:${meaningId}`;
}

function evidenceNodeId(evidenceId: EvidenceId): string {
    return `evidence:${evidenceId}`;
}

function resolutionNodeId(meaningId: MeaningId, level: 0 | 1 | 2): string {
    return `resolution:${meaningId}:L${level}`;
}
