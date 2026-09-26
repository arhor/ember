import assert from "node:assert/strict";
import test from "node:test";

import {
    buildGraphMemoryPrototype,
    expandGraphMemory,
    graphMemoryPrototypeStats,
    graphMemoryReader,
} from "../eval/graph-memory/prototype.ts";
import {
    buildSemanticMemoryExport,
    materializeSemanticMemoryExport,
    querySemanticMemory,
    semanticMemoryExportReader,
} from "../eval/graph-memory/semantic-export.ts";
import { renderMarkdownStateViews } from "../src/core/persistence/markdown-state-materializer.ts";
import { explanationView, selectProjectionMeanings, stateProjectionMeaningReader } from "../src/core/projection.ts";
import { supersede } from "../src/core/semantics.ts";
import { buildStateMaterialization } from "../src/core/state-materialization.ts";
import { populatedState, PRINCIPAL, RELATIONSHIP_SCOPE, SCOPE } from "./support.ts";

test("semantic export preserves Markdown v1 while graph uses the same representation-neutral query seam", () => {
    const { state, ids } = populatedState();
    const semanticExport = buildSemanticMemoryExport(state, {
        principal: PRINCIPAL,
        activeScope: RELATIONSHIP_SCOPE,
        explainIds: [ids.episode],
    });
    const canonicalMaterialization = buildStateMaterialization(state, {
        principal: PRINCIPAL,
        scope: RELATIONSHIP_SCOPE,
    });
    const exportedMaterialization = materializeSemanticMemoryExport(semanticExport);

    assert.deepEqual(exportedMaterialization, canonicalMaterialization);
    assert.deepEqual(
        renderMarkdownStateViews(exportedMaterialization),
        renderMarkdownStateViews(canonicalMaterialization),
    );

    const graph = buildGraphMemoryPrototype(semanticExport, [
        {
            meaningId: ids.episode,
            contextualSummary: "A prior continuity experiment has a remembered naming event.",
        },
    ]);
    const exportReader = semanticMemoryExportReader(semanticExport);
    const graphReader = graphMemoryReader(graph);
    const exportExplanation = querySemanticMemory(exportReader, ids.episode);
    const graphExplanation = querySemanticMemory(graphReader, ids.episode);
    assert.deepEqual(graphExplanation, exportExplanation);

    const episodeNode = graph.nodes.find((node) => node.nodeKind === "meaning" && node.meaningId === ids.episode);
    assert.ok(episodeNode?.nodeKind === "meaning");
    assert.deepEqual(episodeNode.semantic.sourceEvidenceIds, []);
    assert.deepEqual(
        graphReader.findMeaning(ids.episode)?.sourceEvidenceIds,
        exportReader.findMeaning(ids.episode)?.sourceEvidenceIds,
    );

    const canonicalExplanation = explanationView(state, ids.episode);
    assert.deepEqual(
        graphExplanation.source_evidence.map((evidence) => evidence.evidenceId),
        canonicalExplanation.source_evidence.map((evidence) => evidence.evidenceId),
    );
    assert.deepEqual(
        graphExplanation.related_detail_evidence.map((evidence) => evidence.evidenceId),
        canonicalExplanation.related_detail_evidence.map((evidence) => evidence.evidenceId),
    );

    const expansion = expandGraphMemory(graph, ids.episode);
    assert.deepEqual(
        expansion.levels.map((level) => level.level),
        [0, 1, 2, 3],
    );
    assert.equal(
        expansion.levels.every((level) => level.meaningId === ids.episode),
        true,
    );

    const l1 = expansion.levels.find((level) => level.level === 1);
    const l2 = expansion.levels.find((level) => level.level === 2);
    const l3 = expansion.levels.find((level) => level.level === 3);
    assert.ok(l1?.level === 1);
    assert.ok(l2?.level === 2);
    assert.ok(l3?.level === 3);
    assert.equal(l1.authority, "derived_non_evidence");
    assert.equal(l2.authority, "canonical_context_reference");
    assert.deepEqual(
        l2.relatedDetailEvidence.map((evidence) => evidence.evidenceId),
        [ids.detail],
    );
    assert.equal(l2.relatedDetailEvidence[0]!.descriptor.relatedMeaningId, ids.episode);
    assert.deepEqual(l3.rootEvidenceIds, l3.provenanceEvidenceIds);

    const resolutionNodeIds = new Set(
        graph.nodes.filter((node) => node.nodeKind === "resolution").map((node) => node.nodeId),
    );
    assert.equal(
        graph.edges.some((edge) => edge.edgeKind === "supported_by" && resolutionNodeIds.has(edge.from)),
        false,
    );
    assert.equal(JSON.stringify(graph).includes("Cinder"), false);
});

test("L3 recursively reaches original evidence roots for derived commitment provenance", () => {
    const { state, ids } = populatedState();
    const semanticExport = buildSemanticMemoryExport(state, {
        principal: PRINCIPAL,
        activeScope: SCOPE,
        explainIds: [ids.commitment],
    });
    const graph = buildGraphMemoryPrototype(semanticExport);

    assert.deepEqual(
        querySemanticMemory(graphMemoryReader(graph), ids.commitment),
        querySemanticMemory(semanticMemoryExportReader(semanticExport), ids.commitment),
    );

    const expansion = expandGraphMemory(graph, ids.commitment);
    const l3 = expansion.levels.find((level) => level.level === 3);
    assert.ok(l3?.level === 3);

    const canonicalEvidenceIds = explanationView(state, ids.commitment).source_evidence.map(
        (evidence) => evidence.evidenceId,
    );
    assert.deepEqual(
        l3.evidenceLineage.map((evidence) => evidence.evidenceId),
        canonicalEvidenceIds,
    );
    assert.equal(l3.directSourceEvidence[0]!.descriptor.sourceRole, "agent_adoption");
    assert.equal(l3.evidenceLineage.at(-1)!.descriptor.sourceRole, "user_command");
    assert.deepEqual(l3.rootEvidenceIds, [l3.evidenceLineage.at(-1)!.evidenceId]);
    assert.equal(
        expansion.levels.every((level) =>
            level.provenanceEvidenceIds.every((evidenceId) => canonicalEvidenceIds.includes(evidenceId)),
        ),
        true,
    );
});

test("graph spike preserves currentness, supersession, and linked semantic queries", () => {
    const { state, ids } = populatedState();
    const replacement = supersede(state, PRINCIPAL, ids.preference, "Prefer detailed architectural rationale", {
        reason: "The preference changed",
    });
    const ordinaryExport = buildSemanticMemoryExport(state, {
        principal: PRINCIPAL,
        activeScope: SCOPE,
    });
    const ordinaryReader = semanticMemoryExportReader(ordinaryExport);
    assert.equal(ordinaryReader.findMeaning(ids.fact), null);
    assert.equal(ordinaryReader.findMeaning(ids.episode), null);

    const explainIds = [ids.fact, ids.preference, ids.episode];
    const semanticExport = buildSemanticMemoryExport(state, {
        principal: PRINCIPAL,
        activeScope: SCOPE,
        explainIds,
    });
    assert.equal(semanticExport.activeScope, SCOPE);
    assert.deepEqual(semanticExport.includedScopes, [SCOPE, RELATIONSHIP_SCOPE].sort());
    assert.deepEqual(semanticExport.explainIds, explainIds);
    assert.deepEqual(
        materializeSemanticMemoryExport(semanticExport),
        buildStateMaterialization(state, { principal: PRINCIPAL, scope: SCOPE }),
    );
    const graph = buildGraphMemoryPrototype(semanticExport);

    const previousNode = graph.nodes.find((node) => node.nodeKind === "meaning" && node.meaningId === ids.preference);
    const currentNode = graph.nodes.find((node) => node.nodeKind === "meaning" && node.meaningId === replacement);
    assert.ok(previousNode?.nodeKind === "meaning");
    assert.ok(currentNode?.nodeKind === "meaning");
    assert.equal(previousNode.semantic.currentness, "superseded");
    assert.equal(previousNode.semantic.supersededBy, null);
    assert.equal(currentNode.semantic.currentness, "current");
    assert.equal(currentNode.semantic.supersedes, null);

    const graphReader = graphMemoryReader(graph);
    const previous = graphReader.findMeaning(ids.preference);
    const current = graphReader.findMeaning(replacement);
    assert.equal(previous?.supersededBy, replacement);
    assert.equal(current?.supersedes, ids.preference);

    assert.equal(
        graph.edges.some(
            (edge) =>
                edge.edgeKind === "supersedes" &&
                edge.from === `meaning:${replacement}` &&
                edge.to === `meaning:${ids.preference}` &&
                edge.authority === "canonical_semantics",
        ),
        true,
    );

    const exportReader = semanticMemoryExportReader(semanticExport);
    const exportExplanation = querySemanticMemory(exportReader, replacement);
    const graphExplanation = querySemanticMemory(graphReader, replacement);
    assert.deepEqual(graphExplanation, exportExplanation);
    assert.equal(graphExplanation.linked_meanings.supersedes?.meaningId, ids.preference);

    const selectionOptions = {
        principal: PRINCIPAL,
        scope: SCOPE,
        purpose: "explain" as const,
        explainIds,
    };
    const canonicalSelection = selectProjectionMeanings(stateProjectionMeaningReader(state), selectionOptions);
    const exportSelection = selectProjectionMeanings(exportReader, selectionOptions);
    const graphSelection = selectProjectionMeanings(graphReader, selectionOptions);
    assert.deepEqual(
        exportSelection.map((meaning) => meaning.meaningId),
        canonicalSelection.map((meaning) => meaning.meaningId),
    );
    assert.deepEqual(
        graphSelection.map((meaning) => meaning.meaningId),
        canonicalSelection.map((meaning) => meaning.meaningId),
    );
    assert.equal(
        graphSelection.some((meaning) => meaning.meaningId === ids.fact),
        true,
    );
    assert.equal(
        graphSelection.some((meaning) => meaning.meaningId === ids.episode),
        true,
    );
    assert.equal(
        graphSelection.some((meaning) => meaning.meaningId === ids.preference),
        true,
    );
    assert.equal(
        graphSelection.some((meaning) => meaning.meaningId === replacement),
        true,
    );

    const canonicalEpisode = explanationView(state, ids.episode);
    const exportEpisode = querySemanticMemory(exportReader, ids.episode);
    const graphEpisode = querySemanticMemory(graphReader, ids.episode);
    assert.deepEqual(graphEpisode, exportEpisode);
    assert.deepEqual(
        graphEpisode.source_evidence.map((evidence) => evidence.evidenceId),
        canonicalEpisode.source_evidence.map((evidence) => evidence.evidenceId),
    );
    assert.deepEqual(
        graphEpisode.related_detail_evidence.map((evidence) => evidence.evidenceId),
        canonicalEpisode.related_detail_evidence.map((evidence) => evidence.evidenceId),
    );

    const graphWithoutSupersession = structuredClone(graph);
    graphWithoutSupersession.edges = graphWithoutSupersession.edges.filter((edge) => edge.edgeKind !== "supersedes");
    const brokenSelection = selectProjectionMeanings(graphMemoryReader(graphWithoutSupersession), {
        ...selectionOptions,
        explainIds: [replacement],
    });
    assert.equal(
        brokenSelection.some((meaning) => meaning.meaningId === ids.preference),
        false,
    );

    const expansion = expandGraphMemory(graph, replacement);
    const l2 = expansion.levels.find((level) => level.level === 2);
    assert.ok(l2?.level === 2);
    assert.deepEqual(l2.linkedMeaningIds, [ids.preference]);
});

test("graph spike is deterministic and records a bounded structural footprint", () => {
    const { state, ids } = populatedState();
    const semanticExport = buildSemanticMemoryExport(state, {
        principal: PRINCIPAL,
        activeScope: RELATIONSHIP_SCOPE,
        explainIds: [ids.episode],
    });
    const fixture = [
        {
            meaningId: ids.episode,
            contextualSummary: "A compact contextual view.",
        },
    ];
    const first = buildGraphMemoryPrototype(semanticExport, fixture);
    const second = buildGraphMemoryPrototype(semanticExport, fixture);

    assert.deepEqual(second, first);
    const stats = graphMemoryPrototypeStats(first);
    assert.equal(stats.nodeCount > 0, true);
    assert.equal(stats.edgeCount > 0, true);
    assert.equal(stats.serializedBytes > 0, true);
});
