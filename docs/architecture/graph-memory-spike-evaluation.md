---
summary: "Issue #260 graph-backed and multi-resolution memory spike, prototype evidence, storage comparison, and evidence-gated recommendation."
read_when:
  - "Evaluating a graph-backed or multi-resolution representation for Ember memory"
  - "Deciding whether Markdown v1 preserves enough lineage for later graph conversion"
  - "Revisiting graph storage or traversal mechanics under issue #240"
role: evidence
discovery_status: current
---

# Graph-Backed and Multi-Resolution Memory Spike

## Purpose and authority

Issue [#260](https://github.com/arhor/ember/issues/260) asks whether the representation
boundary from #257 can support graph-shaped and multi-resolution memory without changing
Ember's canonical semantics or its cognition consumers.

This document records spike evidence and a representation recommendation. It is not a
new semantic authority. The governing contract remains
[Semantic-State Representation and Projection Boundary](semantic-state-representation-boundary.md),
with currentness and adoption governed by the existing memory semantics and retrieval
remaining downstream of permission and scope filtering under issue #240.

Research references were checked on 2026-09-15.

## Recommendation

**Keep the current canonical state and Markdown v1 representation for production. Do
not adopt a graph database yet.**

The strengthened spike inserts an evaluation-only semantic export upstream of both
representations. The export regenerates the same Markdown v1 materialization and feeds
the graph prototype, while one representation-neutral explanation query returns the
same result over export-backed and graph-backed readers. Stable meaning IDs, provenance,
currentness, supersession, scope, ownership, and uncertainty therefore survive a real
adapter boundary rather than merely two renderers sharing the filesystem DTO.

It also demonstrates an L0 through L3 expansion path in which generated summaries never
gain evidential authority, real attached detail evidence remains linked at L2, and L3
recursively reaches evidence derivation roots such as the original user command behind
an agent adoption or inference.

The smallest useful result is therefore architectural confidence, not a new dependency.

If measured pressure under #240 later earns persisted graph mechanics, evaluate a
narrow SQLite adjacency representation first. Node 26 already ships `node:sqlite`, and
SQLite recursive CTEs can walk trees and graphs without adding a separate service or
npm runtime dependency. Node 26.8.2 still labels `node:sqlite` as Stability 1.2,
"Release candidate", so this is a future candidate rather than a production decision
from this spike.

Use a dedicated property-graph engine only if future evaluation demonstrates that its
query model or traversal performance pays for the additional native dependency and
operational surface.

## Shared representation boundary

The first version of this spike built the graph from `StateMaterialization`. Independent
review correctly identified that as too weak: it proved two renderers could consume the
same filesystem-inspection DTO, not that a graph-shaped backing representation could sit
behind an Ember-owned semantic query seam.

A second review found a subtler version of the same problem: introducing a new eval-only
reader plus a new eval-only explanation query proved that such a seam could be invented,
but did not prove that an existing cognition consumer could cross it unchanged.

The final executable path therefore puts a small representation-neutral read port under
the real meaning-selection phase used by `buildProjection()`:

```text
                         ProjectionMeaningReader
                        /                       \
canonical state adapter                         graph spike adapter
        |                                              |
        +------------> selectProjectionMeanings() <----+
                              |
                              v
                    existing buildProjection()
                    consumer/output contract
```

`buildProjection()` now delegates only its semantic meaning-selection step to
`selectProjectionMeanings()`; runtime applicability, evidence projection, disclosure
gaps, conversation context, and the public `Projection` contract remain unchanged.
The production path still supplies a canonical-state reader. The spike supplies both a
flat semantic-export reader and a graph reader to the exact same production selector and
requires identical ordered selected meanings, including the existing production case
where an explain request explicitly names meanings outside the active project scope.

The semantic export is purpose-bounded rather than pretending every included record has
one scope. Its top-level `activeScope` records the cognition scope, `includedScopes`
records the scopes actually present in the selected semantic closure, and `explainIds`
records the explicit explain request. The export contains the exact active-scope records
needed to preserve Markdown v1, the principal relationship meaning used by ordinary
cognition, explicitly requested explain meanings, their one-hop supersession links, and
the evidence lineage/details required for those selected records. This lets an explain
request cross scope exactly where production already permits it without broadening the
export to every record in those other scopes.

The graph adapter also cannot satisfy that proof by reading duplicated relationship
fields from node properties. Graph meaning nodes deliberately store empty
`sourceEvidenceIds`, `supersedes`, and `supersededBy` relationship fields; the
reader reconstructs them from `supported_by` and `supersedes` edges. Evidence
derivation and detail relationships are likewise reconstructed from
`evidence_derived_from` and `details_meaning` edges. A control test removes the
`supersedes` edge and proves that cognition selection then loses the linked historical
meaning.

The separate semantic-export boundary still proves Markdown continuity:

```text
validated canonical state
        |
        v
evaluation semantic export
   /                   \
  v                     v
Markdown adapter        graph-shaped v2
  |
  v
Markdown v1
```

`materializeSemanticMemoryExport()` reconstructs the current
`StateMaterialization` contract from the semantic export, and the tests require its
rendered Markdown to be byte-identical to the existing
`buildStateMaterialization()` path. `querySemanticMemory()` additionally checks
explanation/provenance parity over the flat export and graph readers.

The graph/export prototypes remain under `eval/graph-memory/` and add no production
package or graph dependency. The only production-core change is the small read-port and
selector extraction inside `projection.ts`; it preserves existing cognition behavior
while making the representation boundary executable.

## Multi-resolution model

The strengthened spike represents one stable remembered meaning at several resolutions:

| Level | Contents                                                                                | Identity                                  | Evidential authority                                                                    |
| ----- | --------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| L0    | Canonical concise remembered meaning                                                    | Existing `meaningId`                      | Canonical meaning grounded by source evidence                                           |
| L1    | Fixture-provided contextual summary standing in for a future summarizer                 | Same `meaningId`                          | Derived, non-evidence                                                                   |
| L2    | Canonical references to attached detail evidence and linked meanings                    | Same `meaningId`; existing referenced IDs | Resolution node has no authority; referenced canonical records keep their own semantics |
| L3    | Direct source evidence plus recursively followed derivation lineage to provenance roots | Existing `EvidenceId` values              | Canonical evidence references                                                           |

Only L1 is synthetic text. L2 no longer accepts arbitrary "episode detail" prose. For the
realistic episode fixture, the canonical `attachDetail()` evidence is represented by
its existing evidence ID and `relatedMeaningId`, while its retained payload remains
excluded by the export disclosure policy. This distinguishes "detail evidence related
to a meaning" from "evidence supporting a meaning" instead of flattening both into one
edge.

L3 begins from the meaning's direct `supported_by` evidence and recursively follows
`evidence_derived_from`. A commitment therefore expands from its
`agent_adoption` evidence to the original `user_command` that the adoption derives
from. The same rule handles agent inference chains.

Resolution nodes receive no `EvidenceId`, use
`evidenceAuthority: "none"`, and never originate a `supported_by` edge. Re-rendering,
re-summarizing, backlinks, graph degree, or repeated retrieval cannot manufacture
corroboration. If an authorized future query needs a retained original payload, it must
resolve the existing evidence ID through an Ember-owned disclosure-aware evidence
boundary rather than reconstructing text from Markdown or a summary.

## Graph vocabulary

The prototype distinguishes semantic relationships copied from canonical state from
representation-only navigation.

Canonical-semantic edges:

- `supported_by`: meaning to one of its direct source evidence IDs;
- `evidence_derived_from`: evidence to a canonical parent evidence ID;
- `supersedes`: replacement meaning to the meaning it supersedes; and
- `details_meaning`: evidence whose canonical metadata names a related meaning.

Representation-only edges:

- `resolution_of`: L0/L1/L2 node to its stable meaning; and
- `expands_to`: navigation from a coarser resolution toward a finer resolution and
  ultimately source evidence.

The spike intentionally does **not** infer generic `relatesTo`, `involves`,
`changed`, commitment links, or relationship links merely because two meanings share
text, scope, owner, time, or graph neighborhood. Those edges become semantic only when
Ember has a canonical rule and provenance that justifies them. `supersedes` already
represents one precise kind of change and should not be diluted into a similarity edge.

This keeps graph traversal from becoming a second, accidental semantics engine.

## Fidelity and migration

Markdown v1 already preserves the information needed to inspect a future graph mapping:

- source schema version, canonical revision, and lineage ID;
- stable meaning IDs;
- kind, owner, semantic slot, and scope;
- currentness and prospective lifecycle;
- learned/applicability times and uncertainty;
- supersession IDs; and
- source evidence IDs plus source role, actor, occurrence/observation time, and visible
  derivation references.

That is enough to make later conversion inspectable and to correlate Markdown and graph
views. It does **not** make Markdown v1 a lossless migration source.

Markdown intentionally excludes retained evidence payloads and is a purpose-bounded
materialized view. A production graph-v2 migration that claims losslessness must
therefore originate from validated canonical state or a future lossless semantic
export. It must not reconstruct hidden evidence, scope, lifecycle, or authority from
rendered prose.

No Markdown v1 field needs to be added by #260. Preserving the existing stable IDs and
lineage metadata is the important migration hedge.

## Prototype evidence

`tests/graph-memory-spike.test.ts` exercises the realistic fixture already used by
Markdown materialization, including an attached episode detail and a commitment whose
direct adoption evidence derives from the user's original command.

It demonstrates that:

1. a representation-neutral semantic export can reconstruct the existing
   `StateMaterialization` object and byte-identical Markdown v1 output;
2. the production `selectProjectionMeanings()` cognition-selection behavior returns
   identical ordered results over canonical state, semantic-export, and graph-backed
   readers for the existing cross-scope explain fixture;
3. the cross-scope episode explanation preserves canonical source-evidence lineage and
   attached-detail evidence through both export and graph readers;
4. removing a canonical `supersedes` graph edge changes cognition selection,
   proving the graph adapter consumes graph relationships rather than copied node fields;
5. one representation-neutral explanation query returns identical semantic results over
   the export-backed reader and graph-backed reader;
6. graph-query evidence IDs agree with Ember's existing `explanationView()` semantics;
7. one episode keeps the same `meaningId` from L0 through L3;
8. L1 is derived non-evidence, while L2 references the real canonical attached-detail
   evidence rather than invented fixture detail text;
9. retained optional detail payload `Cinder` does not leak through the semantic export
   or graph despite the detail evidence itself remaining inspectable;
10. a commitment's L3 path recursively traverses
    `agent_adoption -> user_command`, matching the canonical evidence lineage and
    reaching the original provenance root;
11. superseded and replacement meanings retain canonical currentness and reciprocal IDs,
    and the graph mirrors rather than decides supersession; and
12. repeated construction from the same semantic export and resolution fixture is
    deterministic.

The representative relationship-scope fixture produces 14 graph nodes, 19 edges, and a
9,907-byte JSON serialization. On the 2026-09-15 GitHub-hosted x64 CI runner, 1,000
rebuilds averaged about 0.066 ms each and the process RSS increased by about 0.63 MiB
across the loop. The structural counts/serialized bytes are deterministic; the timing
and RSS delta are explicitly directional process measurements, not a Raspberry Pi
capacity claim or retained-per-graph heap measurement.

`eval/graph-memory/measure.ts` reproduces the same measurement shape so it can later be
rerun on the target Pi.

## External patterns and what Ember should borrow

### RAPTOR and GraphRAG

RAPTOR builds a tree of recursively summarized text at different abstraction levels and
retrieves across those levels. Microsoft GraphRAG similarly builds hierarchical graph
communities and bottom-up summaries.

These systems support the usefulness of multi-resolution navigation and retrieval, but
they do not supply Ember's authority model. Ember should borrow the ability to move
between resolutions while retaining its own semantic identity and provenance rules.

References:

- RAPTOR, ICLR 2024:
  https://proceedings.iclr.cc/paper_files/paper/2024/hash/8a2acd174940dbca361a6398a4f9df91-Abstract-Conference.html
- Microsoft GraphRAG:
  https://microsoft.github.io/graphrag/

### Graphiti

Graphiti is closer to Ember's memory problem because it models evolving temporal facts
and traces derived graph facts back to source episodes. Its useful lesson is that
history and provenance should survive updates rather than being replaced by a flat
"latest summary".

Its full stack is not a good Ember dependency for this spike. It performs autonomous
graph extraction and hybrid retrieval and is implemented around Python plus graph
storage backends. Those mechanics overlap with semantic decisions Ember deliberately
owns, including adoption, currentness, provenance, and scope.

Reference:

- https://github.com/getzep/graphiti

## Storage and operational comparison

| Candidate                                      | Useful properties                                                                                     | Cost or risk for Ember now                                                                                              | Spike conclusion                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Plain typed TS object graph                    | Zero new dependency or service; exact control of semantic versus navigation edges                     | Ephemeral and linear-memory; not a persistence/index solution                                                           | Correct mechanism for proving the boundary                                        |
| Node `node:sqlite` plus `nodes`/`edges` tables | In-process; already shipped with Node 26; recursive CTE graph walks; normal indexes and transactions  | Node 26.8.2 still marks the module release-candidate; schema/query work remains ours                                    | Preferred narrow future mechanic to evaluate first if #240 earns it               |
| Ladybug                                        | Embedded property graph, Cypher, on-disk/in-memory modes; Node native module has Linux aarch64 builds | Native binary dependency and much broader graph engine than this spike needs                                            | Technically Pi-compatible candidate, but only after measured graph-query pressure |
| SurrealDB embedded Node engine                 | In-process Node addon; explicit graph relations/traversal; memory, RocksDB, and SurrealKV storage     | Broad multi-model database and native engine add substantial surface beyond the demonstrated need                       | Too broad for the present evidence                                                |
| CozoDB                                         | Embedded relational/graph/vector database, recursive Datalog, Node Linux ARM64 support                | Attractive mechanics but latest published upstream release found in this spike is from December 2023                    | Negative evidence: do not choose a stale dependency for new Ember storage         |
| Neo4j                                          | Mature graph semantics and tooling                                                                    | Separate JVM/service resource class with heap and page-cache tuning; contradicts Ember's zero-resident-process baseline | Reject for the Pi-class default host                                              |
| Kuzu                                           | Historically attractive embedded Cypher graph design                                                  | Upstream repository was archived on 2025-10-10                                                                          | Do not adopt                                                                      |
| Graphiti                                       | Temporal provenance and episode lineage are semantically instructive                                  | Python/LLM extraction plus graph backend and its own memory semantics                                                   | Reference design only, not an Ember storage dependency                            |

Primary storage references:

- Node SQLite: https://nodejs.org/api/sqlite.html
- SQLite recursive CTE graph traversal: https://www.sqlite.org/lang_with.html
- Ladybug overview: https://docs.ladybugdb.com/
- Ladybug system requirements: https://docs.ladybugdb.com/system-requirements/
- SurrealDB embedded JavaScript engines:
  https://surrealdb.com/docs/reference/javascript/concepts/embedded-engines
- SurrealDB graph traversal:
  https://surrealdb.com/docs/learn/data-models/graph/graph-traversal
- CozoDB repository and platform matrix: https://github.com/cozodb/cozo
- CozoDB releases: https://github.com/cozodb/cozo/releases
- Neo4j memory configuration:
  https://neo4j.com/docs/operations-manual/current/configuration/configuration-settings/
- Archived Kuzu repository: https://github.com/kuzudb/kuzu

## Raspberry Pi-class implications

The current runtime resource evidence records zero resident Ember Node processes while
idle on the Pi-class topology and roughly the same 95 to 100 MiB active Ember-root
memory class as the hosted baseline. A graph design should not casually discard that
property.

The spike prototype preserves the topology:

- no resident graph service;
- no new production package;
- no native addon;
- graph allocation exists only in the evaluation process that builds it; and
- the graph is built from a purpose-bounded semantic export rather than every retained
  canonical record; the export labels its active cognition scope separately from the
  scopes actually included for relationship continuity or explicit explanation.

For the current realistic relationship-scope fixture, the in-memory graph shape is 14
nodes and 19 edges with a 9,907-byte JSON serialization. The hosted-runner 1,000-build
sample averaged approximately 0.066 ms/build and showed roughly +0.63 MiB RSS over the
whole loop. The RSS number includes allocator/JIT/GC noise and is not interpretable as retained
heap cost per graph; it is retained only as a directional baseline for future
comparison.

A narrow SQLite representation could preserve the same in-process episodic topology.
It should still be benchmarked on the actual Pi before adoption for database-open cost,
steady-state RSS, write amplification, indexed traversal latency, compaction/checkpoint
behavior, and restart recovery.

Ladybug remains the strongest dedicated embedded property-graph candidate found by this
spike. Its current documentation describes an in-process Cypher engine and active Linux
ARM64 Node packages, so ARM compatibility does not reject it. Its native engine should
nevertheless earn itself through a workload where SQLite adjacency or Ember's canonical
references are measurably inadequate.

CozoDB is mechanically interesting because it combines recursive Datalog with embedded
Node/ARM64 support, but the latest upstream release found during this review is from
December 2023. For a new durable-memory dependency, that maintenance signal outweighs
its otherwise attractive feature fit.

Neo4j remains in the wrong operational class for Ember's default target. Its own
guidance describes separate JVM heap and page-cache allocation and recommends leaving
about 2 to 4 GiB for the operating system on a dedicated server. That is incompatible
with treating it as a low-overhead addition to Ember's Pi baseline.

## Revisit triggers under #240

Do not adopt graph persistence because the representation is plausible. Revisit it when
repository evidence demonstrates at least one concrete pressure such as:

1. a relevant, permitted meaning is omitted or too slow to locate at realistic history
   size even after selection semantics are correct;
2. repeated provenance, supersession, episode, or relationship traversals become a
   measured bottleneck;
3. canonical scans or materialization exceed an explicit Pi latency/RSS budget on a
   realistic memory corpus;
4. a purpose-sensitive retrieval policy works semantically but needs durable adjacency
   or indexes to meet its operational target; or
5. a product capability requires explicit multi-hop relationship queries that cannot be
   expressed cleanly with existing canonical references.

Any candidate must still preserve the #240 order:

```text
canonical meanings/evidence
        |
        v
permission + scope filter
        |
        v
retrieval/traversal
        |
        v
relevance + currentness ranking
        |
        v
least-sufficient projection
```

Graph connectivity, embeddings, summary frequency, or traversal score remain relevance
signals at most. They never decide permission, ownership, authority, currentness, or
corroboration.

## Reproduction

The focused spike tests and directional measurement are:

```sh
node --test tests/graph-memory-spike.test.ts
node eval/graph-memory/measure.ts
```

The measurement command should be rerun on the actual Pi before any storage adoption
decision; hosted-runner timing/RSS is only a comparison baseline.

Normal repository validation should also remain green:

```sh
npm test
npm run check
```

No production graph/vector dependency is introduced by this spike.
