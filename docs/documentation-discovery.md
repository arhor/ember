# Ember Agent-Aware Documentation Discovery Contract

> Status: design contract for issue #26.
>
> This document defines how repository documentation should become discoverable to humans and coding agents. It does not define Ember runtime memory or context retrieval, and it does not implement the tooling described here.

## Why this contract exists

Ember already has several kinds of durable repository knowledge with deliberately different semantic roles:

- project vision and principles;
- accepted semantic architecture decisions;
- architecture design directions and acceptance scenarios;
- canonical concern-driven research syntheses;
- portable evidence maps;
- preserved source research artifacts;
- supporting investigations of external systems;
- repository, contributor, and operational guidance.

A flat index that makes every Markdown file equally prominent would improve findability while damaging epistemic hygiene. A preserved Deep Research export can be highly relevant to a question without being the current Ember conclusion. An old architecture hypothesis can contain useful history without being allowed to override a later synthesis or accepted ADR. Conversely, keeping deep evidence out of the ordinary coding context must not make that evidence effectively disappear.

The discovery contract therefore has two jobs:

1. make likely-relevant repository knowledge cheap to discover before full documents are loaded;
2. preserve enough role and currentness information that routing relevance is not mistaken for authority.

The core rule is:

> **Discovery metadata routes agents to knowledge. It does not create, upgrade, or replace the authority of that knowledge.**

Authority continues to come from Ember's documentation and research governance: vision and principles define project foundations, accepted ADRs constrain implementation, current architecture material explains design direction, acceptance scenarios act as semantic evaluation fixtures, canonical research records established research conclusions, and evidence/source material supports those conclusions without becoming governing merely because it matches a task strongly.

## Goals

The first version should:

- let an agent identify a small set of likely-relevant Ember documents from a compact deterministic catalogue;
- distinguish what a document contains from when it matters;
- expose the document's semantic role and whether it is current, superseded, or historical;
- keep canonical/current material easy to discover while making evidence and preserved source material available through an explicit deeper tier;
- support progressive disclosure from repository policy to catalogue to selected headings to full source;
- make missing or malformed discovery metadata fail visibly rather than silently hiding important documents;
- remain useful to human contributors and understandable from repository source alone;
- require no model-specific API, search service, database, embeddings, or generated committed index;
- give #27 a deterministic implementation and validation target.

## Non-goals

This contract does not:

- define Ember's runtime memory, retrieval, or cognitive context system;
- replace Markdown links, architecture traceability, ADR status, research provenance, or evidence maps;
- make natural-language applicability hints executable policy;
- create a generic cross-project metadata standard;
- require a documentation website or publishing stack;
- introduce embeddings, vector search, semantic ranking, or a RAG service;
- automatically decide whether one natural-language hint is semantically better than another;
- encode every possible document lifecycle or taxonomy in frontmatter;
- require checked-in generated catalogues or heading maps.

## What Ember keeps from the OpenClaw pattern

Issue #25 found that OpenClaw's useful repository-level mechanism is small: human-authored source documents carry a compact `summary` and `read_when`; deterministic tooling projects those fields into a cheap catalogue; agent policy tells the model when to consult it; an optional headings projection provides another disclosure layer; and deeper retrieval remains separate.

Ember should carry forward four parts directly:

1. **`summary` answers what is here.**
2. **`read_when` answers when it may matter.**
3. **Projection is deterministic and disposable.**
4. **The model judges relevance from natural-language hints.**

Ember should not copy OpenClaw's adjacent Mintlify metadata, publishing mirror, package-time docs map, `doc-schema-version`, or Ask Molty retrieval architecture. Those solve different problems.

Ember also needs one refinement that OpenClaw's ordinary docs corpus can mostly avoid: the compact projection must preserve a document's **semantic role** and **currentness**, because Ember intentionally keeps current conclusions, evidence maps, preserved source reports, and superseded design history side by side.

## Document model

### Participating source set

The first version treats the following human-authored Markdown as the discovery corpus:

- `README.md`;
- `CONTRIBUTING.md` if/when it exists;
- `docs/**/*.md`.

`AGENTS.md` is not part of the catalogue. It is the policy layer that tells agents how to use the catalogue.

Generated output directories and machine-produced Markdown are excluded by explicit implementation configuration rather than by omitting their metadata accidentally. If generated Markdown later becomes common, #27 should add narrow named exclusions for those paths. The implementation must not silently exclude arbitrary directories merely because their names look archival or internal.

Every human-authored document inside the participating source set must either satisfy this contract or belong to an explicit tooling exclusion. Participation must not be purely opt-in through the presence of frontmatter: otherwise deleting metadata would make an important document silently disappear from discovery.

### Roles

Every participating document declares one `role`. The role describes the document's repository knowledge function, not its subject matter.

| Role | Meaning | Default discovery |
|---|---|---|
| `foundation` | Project purpose or durable design principles, such as `docs/vision.md` and `docs/principles.md`. | Yes |
| `decision` | A semantic or architecture decision that governs later work within its scope, such as an accepted ADR. | Yes |
| `design` | Current architecture/design direction that explains how constraints fit together without necessarily being a governing decision itself. | Yes |
| `scenario` | Acceptance, evaluation, or architecture-oracle scenarios used to test observable semantics. | Yes |
| `research` | Canonical Ember research synthesis or concern note whose conclusions are part of the current research baseline. | Yes |
| `guide` | Repository, contributor, authoring, operational, or navigation guidance. | Yes |
| `reference` | Supporting investigation or comparative note that informs work but is not itself a canonical Ember conclusion. Reviewed-system notes and the OpenClaw documentation investigation belong here. | Deep only |
| `evidence` | Portable evidence map or reference map supporting a canonical research conclusion. | Deep only |
| `source` | Preserved source research artifact retained for provenance and reconstruction. | Deep only |

The role vocabulary is intentionally about authority and use, not topics such as `memory`, `delegation`, or `cli`. Topic taxonomies are deferred because `read_when` already provides task-oriented routing without forcing a rigid ontology.

A metadata label does not manufacture the role it claims. For example, adding `role: decision` to a file does not make it an accepted ADR. The declaration is a projection of repository governance for routing and validation; repository review and the source document's governing conventions remain authoritative.

### Status

Every participating document declares one `status`:

- `current` — the document is valid for present-day work within the authority implied by its role;
- `superseded` — a newer document explicitly replaces it for current guidance;
- `historical` — the document is intentionally preserved as history and has no claim to govern current work.

A `superseded` document must also declare `superseded_by` with a repository-relative path to a participating document.

This status is deliberately narrower than every lifecycle concept a document might have. ADRs may still carry their own Accepted/Proposed/etc. decision status inside the ADR convention. Research may carry evidence labels. The discovery `status` exists only to answer the routing question: **should this document be treated as a current candidate for present work, or only as history?**

The current `docs/architecture/initial-model.md`, for example, should be `superseded` by `docs/architecture/design-directions.md`. It remains discoverable for historical investigation without competing with the current synthesis in ordinary routing.

## Metadata schema

The v1 frontmatter contract is deliberately small:

```yaml
---
summary: "Current purpose, scope, and long-term success criterion for Ember."
read_when:
  - "Changing Ember's product purpose or continuity goals"
  - "Evaluating whether a proposed feature belongs in Ember's core"
role: foundation
status: current
---
```

Required fields for every participating document:

### `summary`

A non-empty single-line string describing the document's responsibility and contents.

Good summaries distinguish the document from nearby material. They should answer "what useful knowledge will I find here?" rather than repeat the title.

Prefer:

```yaml
summary: "Accepted semantic constraints for persistent meaning, including provenance, scope, currentness, correction, and forgetting."
```

Avoid:

```yaml
summary: "Memory ADR"
```

### `read_when`

A non-empty list of natural-language task situations in which the document is likely to matter.

Hints should describe recognizable work, decisions, or investigations rather than keywords or topic labels. They are interpreted by the agent, not matched by deterministic code.

Prefer:

```yaml
read_when:
  - "Changing how corrected or superseded memory governs later behavior"
  - "Designing persistence for current versus historical remembered meaning"
```

Avoid:

```yaml
read_when:
  - "memory"
  - "agents"
```

Hints may overlap across documents when the same task genuinely crosses concerns. The goal is useful discrimination, not artificial uniqueness.

### `role`

One of the roles defined above. It tells the projection and the agent how the source participates in Ember's knowledge governance and which discovery depth it belongs to.

### `status`

One of `current`, `superseded`, or `historical`.

### `superseded_by`

Required only when `status: superseded`. The value is a repository-relative path to the current replacement.

Example:

```yaml
---
summary: "Pre-research architecture hypothesis retained to show how Ember's design assumptions evolved."
read_when:
  - "Tracing the architecture hypothesis that preceded the cross-cutting research synthesis"
  - "Comparing current design directions with the project's pre-research model"
role: design
status: superseded
superseded_by: docs/architecture/design-directions.md
---
```

### Fields deliberately omitted from v1

The first version does **not** add:

- `schema_version` or `doc-schema-version` — the corpus is small enough to migrate atomically if the contract changes;
- `canonical: true/false` — canonicality is represented by the role semantics and existing governance, not a free-floating boolean that could disagree with them;
- `discovery_tier` — default versus deep discovery is derived deterministically from `role` and `status`;
- topic tags, concern IDs, keywords, or task categories — `read_when` provides the routing signal without a rigid ontology;
- `related`, `depends_on`, or link graphs — normal Markdown links and existing ADR/scenario traceability already express concrete relationships;
- `title` — the document's H1 remains the human source of its title;
- generated summaries, embeddings, scores, timestamps, or model annotations.

If a future field cannot be shown to change routing, validation, or conflict handling for a real Ember task, it should remain out of the contract.

## Discovery tiers

Ember uses two normal discovery depths plus an explicit maintenance/history view.

### Default discovery

Default discovery contains only `status: current` documents with roles:

- `foundation`;
- `decision`;
- `design`;
- `scenario`;
- `research`;
- `guide`.

This is the catalogue an agent should normally consult before semantically meaningful coding, design, review, or documentation work.

It deliberately includes canonical research summaries but not evidence maps or preserved research source artifacts. Listing a canonical research note is cheap; loading its full body remains selective.

### Deep discovery

Deep discovery adds current documents with roles:

- `reference`;
- `evidence`;
- `source`.

This tier is used when the task is investigative rather than merely implementation-oriented, for example:

- determining why a canonical conclusion exists;
- checking the quality or provenance of evidence behind a conclusion;
- comparing Ember's decision with a reviewed external system;
- reconstructing a Deep Research source trail;
- challenging or revisiting a conclusion with new evidence.

Deep discovery makes evidence reachable without making it routine coding context.

### All/history view

A maintenance-oriented all-documents view includes superseded and historical material as well as both discovery depths. Superseded entries must visibly name their replacement.

Historical material is not included in default or deep routing merely because its `read_when` matches the task. An agent investigating history can request it explicitly.

## Progressive disclosure flow

The intended flow is:

```text
repository policy (AGENTS.md)
    -> compact default catalogue
        -> optional deep catalogue when rationale/evidence is needed
            -> headings for selected long documents
                -> selected full source documents
                    -> linked evidence/source material when needed
```

Each layer is a projection or a source read. None becomes a second canonical knowledge store.

### Layer 1: repository policy

`AGENTS.md` explains when to consult documentation discovery, how to interpret roles and status, how to escalate, and how to handle conflicts. It must not duplicate a manually maintained list of Ember documents.

### Layer 2: compact catalogue

The compact catalogue emits only bounded routing information:

```text
docs/architecture/decisions/0002-preserve-persistent-meaning.md [decision, current]
  Summary: Accepted semantic constraints for persistent meaning, including provenance, scope, currentness, correction, and forgetting.
  Read when: Changing how corrected or superseded memory governs later behavior; designing persistence for current versus historical remembered meaning
```

No body text, generated semantic score, keyword extraction, or model summary appears here.

### Layer 3: selected headings

Because several Ember design and research documents are already tens of kilobytes long, v1 should support on-demand heading projection for **selected paths** rather than generating one whole-corpus heading map by default.

Conceptually:

```text
docs:list --headings docs/research/memory-and-remembering.md
```

The output should include H1-H4 headings in source order, excluding fenced code blocks and frontmatter. Requiring explicit paths keeps this layer bounded and makes it useful after the compact catalogue has already narrowed the search.

### Layer 4: full source

The agent opens only the documents required to perform the task correctly.

### Layer 5: deeper evidence/source

Evidence maps and source artifacts are opened when the task requires provenance, challenge, reconstruction, or deeper justification. Ordinary implementation work should not load them merely because they exist.

## Agent usage policy

The root agent instructions introduced by #27 should express policy approximately equivalent to the following.

### When discovery is required

Consult the default documentation catalogue before work that can change or judge Ember's durable semantics or architecture, including:

- continuity, identity, memory, currentness, context selection, agency, delegation, authority, permissions, sessions, surfaces, or long-running work;
- architecture or persistence design;
- behavior that must satisfy semantic ADRs or architecture acceptance scenarios;
- changes to canonical documentation, ADRs, research, scenarios, or repository governance;
- review of changes in those areas;
- new capabilities or external effects whose meaning crosses an established semantic boundary.

A purely local implementation detail may skip discovery when it cannot plausibly change observable semantics or documented contracts. Examples include a spelling fix, a mechanical rename with no semantic change, or debugging an isolated implementation defect whose expected behavior is already unambiguous from nearby code/tests.

When uncertain whether a change is semantically meaningful, consulting the compact catalogue is cheaper than guessing.

### How to interpret `read_when`

`read_when` is a routing hint, not an exhaustive trigger list. A strong semantic match means the document should normally be inspected before making the relevant decision. A missing literal phrase does not mean the document is irrelevant.

Agents should combine:

- the task;
- `summary`;
- `read_when`;
- role;
- status;
- links and headings from already-selected documents.

### Escalation

1. Start with default discovery for semantically meaningful work.
2. Select the smallest plausible current document set.
3. For a long selected document, inspect its heading projection before reading the whole source when that can narrow the needed sections.
4. Use deep discovery when the task asks "why", challenges a conclusion, requires provenance, compares external systems, or otherwise needs supporting evidence.
5. Open source artifacts only when evidence maps or the investigation require that depth.

The existence of a deeper tier must never be interpreted as "less true" in a generic sense. It means "not normally governing current implementation directly." A preserved source artifact can contain excellent evidence while still being non-canonical.

### Conflict handling

When relevant documents disagree, agents must not resolve the conflict by retrieval order, path order, modification time, number of matching hints, or how confident one document sounds.

Use role and repository governance instead:

- `foundation` constrains the project's purpose and durable principles;
- accepted `decision` documents govern later implementation and design within their scope;
- `scenario` documents are acceptance oracles for observable semantics and should agree with governing decisions;
- current `design` documents explain the present architecture direction within those constraints;
- canonical `research` records established research conclusions and rationale, but a later accepted decision may deliberately choose among research-supported options;
- `guide` governs repository or operational procedure in its stated scope but does not override semantic foundations or decisions;
- `reference`, `evidence`, and `source` may justify, challenge, or explain current conclusions but do not silently override them;
- `superseded` and `historical` documents do not govern current work.

If two sources that should be mutually consistent actually conflict, treat that as a repository inconsistency. Identify both sources and resolve or surface the inconsistency rather than silently choosing one.

### No obvious match

No matching `read_when` hint means "routing metadata did not settle this," not "the repository has no relevant knowledge."

Fallback order:

1. inspect summaries in the default catalogue for conceptually adjacent documents;
2. inspect headings for the most plausible candidates;
3. use ordinary repository/source search;
4. use deep discovery if the question is evidential or historical;
5. if important knowledge was discoverable only through fallback, improve its `summary` or `read_when` as part of the change when appropriate.

Agents must not treat omission from the current prompt/context as evidence that a repository fact or document does not exist.

## Deterministic tooling contract for #27

The exact implementation language is deliberately not chosen here. #27 should use the repository's adopted development toolchain if one exists by then. It should not introduce a separate application runtime solely for documentation discovery unless that trade-off is explicitly justified.

Regardless of implementation language, the tool must satisfy the following behavior.

### Command surface

The intended user-facing commands are conceptually:

```text
docs:list
docs:list --deep
docs:list --all
docs:list --headings <path> [<path> ...]
docs:check
```

The concrete invocation may be a repository script, build task, or executable wrapper. The names above define behavior, not a package manager choice.

### `docs:list`

- scans the participating source set from repository root;
- validates metadata before producing a successful catalogue;
- emits current default-tier documents;
- sorts entries lexicographically by normalized repository-relative path;
- preserves author order inside `read_when`;
- emits path, role, status, summary, applicability hints, and `superseded_by` when applicable;
- writes only to stdout/stderr and does not modify the repository.

### `docs:list --deep`

Produces the default catalogue plus current `reference`, `evidence`, and `source` documents.

### `docs:list --all`

Produces all participating documents, including superseded and historical entries. It is primarily for maintenance and auditing.

### `docs:list --headings <paths...>`

- requires one or more explicit participating Markdown paths;
- validates each requested path;
- emits H1-H4 headings in document order;
- strips frontmatter;
- ignores headings inside fenced code blocks;
- does not generate routes, anchors, or publishing metadata Ember does not otherwise need;
- does not create or update a committed docs map.

### `docs:check`

Validates the complete participating corpus and exits non-zero on contract violations. It should be suitable for CI and local pre-merge checks.

### Runtime and dependency footprint

The implementation must be:

- local and deterministic;
- network-free;
- model-free;
- database-free;
- service-free;
- cheap enough to run on every documentation/CI check.

Prefer the repository's existing runtime and parser libraries. If the repository still has no established implementation toolchain when #27 begins, introducing one small development-only frontmatter parser is acceptable; introducing a package manager, long-lived service, search index, or broad docs framework solely for this feature is not.

### Repository-root behavior and failures

The command surface is defined from repository root. Running it where the expected repository markers/source paths are unavailable must fail with a concise actionable message rather than scanning an arbitrary current directory.

A document with missing or invalid required metadata must never be silently omitted from a successful catalogue. The tool should report all discovered validation errors in one run where practical, emit any useful diagnostics, and exit non-zero.

## Validation contract

#27 should enforce the parts that deterministic tooling can actually know.

### Required checks

For every participating document:

- frontmatter is syntactically valid;
- `summary` exists, is a non-empty single-line string, and is not whitespace-only;
- `read_when` exists, is a non-empty list, and every item is a non-empty string;
- exact duplicate `read_when` entries inside one document are rejected after trimming whitespace;
- `role` is one allowed value;
- `status` is one allowed value;
- `status: superseded` requires `superseded_by`;
- `superseded_by` points to an existing participating document and cannot point to itself;
- `superseded_by` chains are acyclic;
- `superseded_by` is absent for `current` and `historical` documents;
- generated/excluded paths are explicit and test-covered;
- output ordering and formatting are deterministic across repeated runs.

Exact duplicate applicability hints across different documents should produce at most a maintenance warning, not a hard failure. Different documents can legitimately apply to the same task.

### What validation must not pretend to prove

The tool should not attempt to prove that:

- a summary is semantically complete;
- a `read_when` hint is broad or narrow enough;
- one document truly deserves the role declared by governance;
- two natural-language hints are semantically duplicates;
- a research conclusion is correct;
- an ADR and acceptance scenario are substantively consistent.

Those remain authoring, review, and evaluation responsibilities.

## Authoring rules

Good routing metadata should survive wording changes in a task.

### Summaries

A good summary:

- states the document's responsibility, not just its topic;
- distinguishes the page from adjacent roles;
- mentions important boundaries when they affect routing;
- fits comfortably in one compact catalogue entry.

### Applicability hints

A good `read_when` entry:

- describes work the reader might actually be doing;
- begins from a task, decision, failure, or investigation rather than a keyword;
- is specific enough to discriminate while remaining phrasing-independent;
- avoids embedding implementation choices that the document itself does not require.

Prefer a few strong hints over a long pseudo-taxonomy.

When a document's responsibility changes materially, updating its routing metadata is part of updating the document.

## Task-oriented routing evaluation

#27 should validate the mechanism against realistic Ember work rather than only parser fixtures. The evaluation does not need an automated language model judge. It can use expected catalogue membership and documented human review of whether the hints make the intended route obvious.

### 1. Change continuity or restart behavior

**Task:** Change how Ember resumes after a complete process restart and long inactivity.

**Expected default route:**

- continuity and operational semantic ADRs (`decision`);
- architecture acceptance scenarios covering restart/recovery (`scenario`);
- current cross-cutting design directions (`design`);
- canonical continuity and operational-model research notes (`research`) should be discoverable as rationale when needed.

**Should not be eagerly loaded:** all memory/delegation/authority research, evidence maps, reviewed-system notes, or preserved Deep Research exports.

### 2. Change memory/currentness behavior

**Task:** Change how a corrected preference supersedes older remembered state while preserving history.

**Expected default route:**

- persistent-meaning and least-sufficient-projection ADRs;
- memory/currentness acceptance scenarios;
- canonical memory and context-selection research;
- current design directions where cross-cutting currentness matters.

**Should not be eagerly loaded:** unrelated authority/agency research, evidence maps, or source artifacts.

### 3. Decide whether information may be sent to a specialist

**Task:** Decide whether relationship information relevant to Ember may be included in a coding specialist's delegated context.

**Expected default route:**

- least-sufficient-permitted-projection ADR;
- capability/authority ADR;
- delegation and authority acceptance scenarios;
- canonical delegation, context-selection, and authority research.

**Should not be eagerly loaded:** continuity source research, reviewed-system notes, or every evidence map.

### 4. Change authority around an external action

**Task:** Allow Ember to perform an external action under a standing grant after circumstances have changed.

**Expected default route:**

- capability/authority and persistent-meaning ADRs;
- authority/currentness acceptance scenarios;
- canonical action-authority research;
- operational research only where retries, stale work, or effects matter.

**Should not be eagerly loaded:** general reviewed-system research or source artifacts.

### 5. Modify architecture acceptance scenarios

**Task:** Add a fixture for a new concurrency/currentness failure case.

**Expected default route:**

- the acceptance-scenario catalogue itself;
- the governing ADRs traced by the new scenario;
- current design directions;
- canonical research only for semantic distinctions not already settled by the governing decisions.

**Should not be eagerly loaded:** all canonical research merely because the scenario document links to it, and never all preserved source material.

### 6. Debug an implementation detail with no semantic change

**Task:** Fix a local parser bug whose expected behavior is already established by nearby tests and does not alter Ember semantics.

**Expected route:** discovery may legitimately be skipped. If consulted, repository/operational `guide` material should be enough.

**Should not be eagerly loaded:** semantic ADRs, canonical research, evidence maps, or source research merely because they are important documents in the repository.

This case is important: success means the discovery mechanism can stay out of the way when broad semantic context has no value.

### 7. Investigate why a research conclusion exists

**Task:** Determine why the memory research concluded that current belief must remain distinct from historical evidence, deeply enough to challenge the conclusion or verify its basis.

**Expected progression:**

1. canonical memory research (`research`);
2. memory portable evidence map (`evidence`) through deep discovery;
3. preserved memory Deep Research export (`source`) only if the evidence map or question requires reconstruction of the original investigation.

**Should not be eagerly loaded:** unrelated ADRs, all other concern research, or every preserved source artifact.

This scenario is the clearest test that deeper evidence remains discoverable without becoming ordinary coding context.

## Maintenance and evolution

The discovery contract should evolve only in response to observed routing failures.

Signals that may justify a richer mechanism later include:

- the compact catalogue itself becomes a meaningful context burden;
- ordinary tasks routinely match too many documents;
- role/status cannot express a recurring authority distinction;
- users repeatedly need cross-corpus search over code, issues, and docs rather than repository documentation discovery;
- heading projections are insufficient to narrow large documents;
- deterministic source search becomes a material contributor bottleneck.

Those are symptoms to measure, not reasons to pre-build a retrieval platform.

## Deliberately deferred enhancements

The following are explicitly deferred from #27 unless implementation uncovers a concrete blocker:

- JSON or machine-protocol output in addition to the human-readable catalogue;
- topic tags or concern ontologies;
- automatic ranking, scoring, embeddings, or vector search;
- LLM-generated summaries or `read_when` hints;
- a checked-in generated documentation map;
- a docs website or publishing framework;
- schema-version metadata;
- richer lifecycle states beyond current/superseded/historical;
- cross-project standardization;
- automatic semantic-quality scoring for metadata;
- indexing code, issues, PRs, or external documentation into the same mechanism.

## Implementation plan for #27

#27 should implement and adopt this contract in small steps:

1. **Inventory the actual merged corpus.** Reconcile this design with whatever architecture ADRs and acceptance scenarios have landed by then, and identify any genuinely generated Markdown exclusions.
2. **Add frontmatter to the participating source set.** Classify current documents using the roles above. Mark the initial architecture model superseded by the current design synthesis. Keep evidence maps and source artifacts in the deep tier through their roles rather than path-only assumptions.
3. **Implement deterministic catalogue and validation tooling.** Support default, deep, all, selected-headings, and check behaviors with stable ordering and explicit failures.
4. **Add focused tests.** Cover parsing, role/status validation, supersession links/cycles, missing metadata, deterministic ordering, depth filtering, selected heading extraction, fenced-code handling, and repository-root failure behavior.
5. **Add task-routing fixtures.** Encode the seven scenarios above as expected representative catalogue routes or snapshot fixtures so later metadata changes cannot silently make important classes disappear.
6. **Add root agent policy.** Introduce or update `AGENTS.md` with compact rules for when to consult discovery, progressive disclosure, conflict handling, fallback, and the reminder that current-context omission is not repository absence. Do not copy the docs tree into the file.
7. **Wire `docs:check` into routine validation.** If CI exists, make metadata contract violations fail it. Otherwise make the command part of the documented repository validation surface so CI can adopt it when introduced.
8. **Evaluate before enriching.** Run the realistic routing scenarios against the migrated corpus. Fix summaries/hints first. Add fields or retrieval machinery only if a concrete failure remains after authoring improvements.

## Decision summary

For Ember v1:

- use human-authored Markdown frontmatter;
- keep OpenClaw's `summary` / `read_when` distinction;
- add `role` because Ember has materially different knowledge-authority classes;
- add `status` plus conditional `superseded_by` because current and historical architecture intentionally coexist;
- derive discovery depth from `role + status` rather than adding another field;
- default to current foundations, decisions, design, scenarios, canonical research, and guides;
- require explicit deep discovery for supporting references, evidence maps, and preserved source artifacts;
- generate compact catalogues and selected-document headings ephemerally;
- validate participation strictly enough that missing metadata cannot make important docs silently vanish;
- let model judgment interpret task-oriented hints while deterministic code enforces syntax, membership, status, and projection behavior;
- keep `AGENTS.md` as routing policy, never a hand-maintained document index;
- treat conflicts as governance problems to resolve explicitly, never as ranking problems;
- defer richer retrieval until Ember demonstrates a real need for it.

This is the smallest contract that preserves the useful part of OpenClaw's pattern while respecting Ember's stronger distinction between current conclusions, supporting evidence, and preserved research history.
