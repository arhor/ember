---
summary: "Governing contract for agent-aware repository documentation discovery: metadata roles and currentness, disclosure depths, tooling, validation, and agent policy."
read_when:
  - "Changing documentation discovery metadata, tooling, validation, agent instructions, or disclosure behavior"
  - "Deciding how canonical, evidence, source, superseded, or historical repository knowledge should appear to agents"
role: design
discovery_status: current
---

# Ember Agent-Aware Documentation Discovery Contract

> Status: design contract for issue #26.
>
> This document defines how repository documentation should become discoverable to humans and coding agents. It does not define Ember runtime memory or context retrieval, and it does not implement the tooling described here.

## Why this contract exists

Ember keeps several kinds of durable repository knowledge with deliberately different semantic roles:

- project vision and principles;
- semantic architecture decisions;
- architecture design directions and acceptance scenarios;
- canonical concern-driven research syntheses;
- portable evidence maps;
- preserved source research artifacts;
- supporting investigations of external systems;
- repository, contributor, and operational guidance.

A flat index that makes every Markdown file equally prominent would improve findability while damaging epistemic hygiene. A preserved Deep Research export can be highly relevant without being the current Ember conclusion. A superseded architecture hypothesis can be useful history without being allowed to override later design or accepted decisions. Conversely, keeping deep evidence out of ordinary coding context must not make that evidence effectively disappear.

The discovery contract therefore has two jobs:

1. make likely-relevant repository knowledge cheap to discover before full documents are loaded;
2. preserve enough role and currentness information that routing relevance is not mistaken for authority.

The core rule is:

> **Discovery metadata routes agents to knowledge. It does not create, upgrade, or replace the authority of that knowledge.**

Authority continues to come from Ember's documentation and research governance. Vision and principles define project foundations. Accepted ADRs constrain implementation. Current architecture material explains design direction. Acceptance scenarios act as semantic evaluation fixtures. Canonical research records established research conclusions. Evidence and source material support or challenge those conclusions without becoming governing merely because they match a task strongly.

## Goals

The first version should:

- let an agent identify a small set of likely-relevant Ember documents from a compact deterministic catalogue;
- distinguish what a document contains from when it matters;
- expose the document's repository knowledge role and whether it participates in current, superseded, or historical discovery;
- keep current canonical material easy to discover while making evidence and preserved source material reachable through an explicit deeper mode;
- support progressive disclosure from repository policy to catalogue to selected headings to full source;
- make missing or malformed discovery metadata fail visibly rather than silently hiding important documents;
- remain useful to human contributors and understandable from repository source alone;
- require no model-specific API, search service, database, embeddings, or committed generated index;
- give #27 a deterministic implementation and validation target.

## Non-goals

This contract does not:

- define Ember's runtime memory, retrieval, or cognitive context system;
- replace Markdown links, architecture traceability, ADR lifecycle, research provenance, or evidence maps;
- make natural-language applicability hints executable policy;
- create a generic cross-project metadata standard;
- require a documentation website or publishing stack;
- introduce embeddings, vector search, semantic ranking, or a RAG service;
- automatically decide whether one natural-language hint is semantically better than another;
- encode every possible document lifecycle or taxonomy in frontmatter;
- require checked-in generated catalogues or heading maps.

## What Ember keeps from the OpenClaw pattern

[Issue #25's OpenClaw investigation](research/openclaw-documentation-discovery.md) found that the useful repository-level mechanism is small: human-authored source documents carry compact `summary` and `read_when` metadata; deterministic tooling projects those fields into a cheap catalogue; agent policy tells the model when to consult it; an optional heading projection provides another disclosure layer; and deeper retrieval remains separate.

Ember should carry forward four parts directly:

1. **`summary` answers what is here.**
2. **`read_when` answers when it may matter.**
3. **Projection is deterministic and disposable.**
4. **The model judges relevance from natural-language hints.**

Ember should not copy OpenClaw's adjacent Mintlify metadata, publishing mirror, package-time docs map, `doc-schema-version`, or Ask Molty retrieval architecture. Those solve different problems.

Ember needs one refinement that OpenClaw's ordinary docs corpus can mostly avoid: the compact projection must preserve a document's **role** and **discovery currentness**, because Ember intentionally keeps current conclusions, evidence maps, preserved source reports, and superseded design history side by side.

## Participating documents

### V1 discovery corpus

The first version applies the discovery metadata contract to:

- human-authored `docs/**/*.md` files.

Every human-authored Markdown document under `docs/` must either satisfy the contract or belong to an explicit tooling exclusion. Participation must not be opt-in through the mere presence of frontmatter: deleting metadata must not make an important document silently disappear.

Generated Markdown, if introduced later, is excluded only through explicit named configuration that is test-covered. The implementation must not infer authority or participation solely from convenient directory names.

### Root bootstrap surfaces are deliberately outside v1

The following root-level documents do **not** require discovery frontmatter in v1:

- `README.md`;
- `AGENTS.md`;
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and similar root convention files if they appear.

This is deliberate rather than accidental. These files are already bootstrap or human-facing repository surfaces, and putting routing frontmatter into them would make agent metadata part of their primary rendered presentation. `AGENTS.md` has a different responsibility entirely: it is the policy layer that tells agents how to use discovery.

If contributor or operational guidance grows large enough to benefit from discovery, the durable detailed guide should live under `docs/` and the conventional root file can remain a concise human entry point linking to it. The source set can be widened later if a concrete use case justifies the presentation and maintenance cost.

## Document roles

Every participating document declares one `role`. A role describes the document's repository knowledge function, not its subject matter or currentness.

| Role         | Meaning                                                                                                                                                  | Normal discovery depth |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `foundation` | Project purpose or durable design principles.                                                                                                            | Default                |
| `decision`   | A decision record such as an ADR. Whether it governs work comes from that decision record's own lifecycle and governance, not from the role label alone. | Default                |
| `design`     | Architecture or design direction that explains how constraints fit together without necessarily being a governing decision itself.                       | Default                |
| `scenario`   | Acceptance, evaluation, or architecture-oracle scenarios used to test observable semantics.                                                              | Default                |
| `research`   | A canonical Ember research synthesis or concern note. Whether it is current is expressed separately by `discovery_status`.                               | Default                |
| `guide`      | Repository, contributor, authoring, operational, or navigation guidance under `docs/`.                                                                   | Default                |
| `reference`  | Supporting investigation or comparative note that informs work but is not itself a canonical Ember conclusion.                                           | Deep                   |
| `evidence`   | Portable evidence map or reference map supporting a canonical research conclusion.                                                                       | Deep                   |
| `source`     | Preserved source research artifact retained for provenance and reconstruction.                                                                           | Deep                   |

The role vocabulary is intentionally about repository knowledge function rather than topics such as `memory`, `delegation`, or `cli`. Topic taxonomies are deferred because `read_when` already provides task-oriented routing without forcing a rigid ontology.

A metadata label does not manufacture the role or authority it claims. Adding `role: decision` does not make a proposed ADR accepted. Adding `role: research` does not make arbitrary prose a canonical research conclusion. Metadata projects governance into discovery; repository review and the source document's own conventions remain authoritative.

## Discovery status

Every participating document declares one `discovery_status`:

- `current` means the document is eligible for present-day discovery within its role. It does **not** imply that a role-specific proposal has been accepted or approved;
- `superseded` means a newer participating document replaces it for current guidance;
- `historical` means the document is intentionally retained as history and makes no claim to govern current work.

A `superseded` document must also declare `superseded_by` with a repository-relative path.

The field is deliberately named `discovery_status`, not plain `status`. ADRs or other document conventions may legitimately have their own lifecycle field such as `status: accepted` or `status: proposed`. Those meanings are independent. Discovery currentness must not overwrite or impersonate role-specific lifecycle.

If role-specific lifecycle affects authority, an agent must read the source document before relying on it as governing. The compact catalogue is not proof that a `decision` is accepted.

The current `docs/architecture/initial-model.md`, for example, should be `discovery_status: superseded` with `superseded_by: docs/architecture/design-directions.md`. It remains available for historical investigation without competing with the current synthesis in ordinary routing.

## Representative Ember classification

The contract is role-based rather than path-authority-based, but #27 should not have to rediscover the intended classification of the existing corpus. Representative assignments are:

| Document class / representative path                                               | Role         | Discovery status                                                                                        | Depth            |
| ---------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- | ---------------- |
| `docs/vision.md`, `docs/principles.md`                                             | `foundation` | `current`                                                                                               | Default          |
| `docs/architecture/design-directions.md`                                           | `design`     | `current`                                                                                               | Default          |
| `docs/architecture/initial-model.md`                                               | `design`     | `superseded`                                                                                            | All/history only |
| accepted or proposed ADR source files                                              | `decision`   | normally `current` while actively relevant; decision authority still comes from the ADR lifecycle       | Default          |
| `docs/architecture/acceptance-scenarios.md`                                        | `scenario`   | `current`                                                                                               | Default          |
| architecture/research navigation README files under `docs/`                        | `guide`      | `current`                                                                                               | Default          |
| canonical concern notes such as `docs/research/memory-and-remembering.md`          | `research`   | `current`                                                                                               | Default          |
| portable `*-references.md` evidence maps                                           | `evidence`   | `current` while supporting the current canonical note                                                   | Deep             |
| `docs/research/source-material/*-deep-research.md`                                 | `source`     | `current` while retained as the source artifact for current research; the content remains non-canonical | Deep             |
| reviewed-system notes such as `nanobot.md`, `hermes.md`, `openclaw.md`, `letta.md` | `reference`  | `current`                                                                                               | Deep             |
| `docs/research/openclaw-documentation-discovery.md`                                | `reference`  | `current`                                                                                               | Deep             |
| this `docs/documentation-discovery.md` contract                                    | `design`     | `current`                                                                                               | Default          |

Directory placement helps identify candidates, but the metadata remains explicit because two files in the same research directory can have different semantic roles.

## Metadata schema

The v1 frontmatter contract is deliberately small:

```yaml
---
summary: "Current purpose, scope, and long-term success criterion for Ember."
read_when:
  - "Changing Ember's product purpose or continuity goals"
  - "Evaluating whether a proposed feature belongs in Ember's core"
role: foundation
discovery_status: current
---
```

### `summary`

Required. A non-empty single-line string describing the document's responsibility and contents.

Good summaries distinguish a document from nearby material. They answer "what useful knowledge will I find here?" rather than merely repeating the title.

Prefer:

```yaml
summary: "Semantic constraints for persistent meaning, including provenance, scope, currentness, correction, and forgetting."
```

Avoid:

```yaml
summary: "Memory document"
```

### `read_when`

Required. A non-empty list of natural-language task situations in which the document is likely to matter.

Hints describe recognizable work, decisions, failures, or investigations rather than keywords or topic labels. They are interpreted by the agent, not matched by deterministic semantic code.

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

Hints may overlap across documents when a task genuinely crosses concerns. The goal is useful discrimination, not artificial uniqueness.

### `role`

Required. One role from the table above.

### `discovery_status`

Required. One of `current`, `superseded`, or `historical`.

### `superseded_by`

Required only for `discovery_status: superseded`. The value is a repository-relative path to a participating document.

Example:

```yaml
---
summary: "Pre-research architecture hypothesis retained to show how Ember's design assumptions evolved."
read_when:
  - "Tracing the architecture hypothesis that preceded the cross-cutting research synthesis"
  - "Comparing current design directions with the project's pre-research model"
role: design
discovery_status: superseded
superseded_by: docs/architecture/design-directions.md
---
```

### Fields deliberately omitted from v1

The first version does **not** add:

- `schema_version` or `doc-schema-version`: the corpus is small enough to migrate atomically if the contract changes;
- `canonical: true/false`: canonicality continues to come from role semantics and existing governance rather than a free-floating boolean that can disagree with them;
- `discovery_tier`: default versus deep discovery is derived from `role` and `discovery_status`;
- generic approval or proposal state: role-specific lifecycle remains with ADR or document governance until a recurring cross-role need justifies another projected field;
- topic tags, concern IDs, keywords, or task categories: `read_when` supplies task-oriented routing without a rigid ontology;
- `related`, `depends_on`, or link graphs: normal Markdown links and existing ADR/scenario traceability already express concrete relationships;
- `title`: the source H1 remains the human title;
- generated summaries, embeddings, scores, timestamps, or model annotations.

If a future field cannot be shown to change routing, validation, or conflict handling for a real Ember scenario, it should remain out of the contract.

## Discovery depths

Ember uses two ordinary discovery depths plus an explicit history/maintenance view.

### Default discovery

Default discovery contains only `discovery_status: current` documents with roles:

- `foundation`;
- `decision`;
- `design`;
- `scenario`;
- `research`;
- `guide`.

This is the catalogue an agent normally consults before semantically meaningful coding, design, review, or documentation work.

It deliberately exposes canonical research summaries without eagerly loading research bodies. Evidence maps, reviewed-system notes, and preserved source artifacts remain outside this ordinary projection.

### Deep discovery

Deep discovery contains the default catalogue plus `discovery_status: current` documents with roles:

- `reference`;
- `evidence`;
- `source`.

Use it when the task is investigative rather than merely implementation-oriented, for example:

- determining why a canonical conclusion exists;
- checking evidence quality or provenance;
- comparing Ember with a reviewed external system;
- reconstructing a Deep Research trail;
- challenging or revisiting a conclusion with new evidence.

Deep discovery makes evidence reachable without making it routine coding context.

### All/history view

An all-documents view contains every participating document, including `superseded` and `historical` entries from both depths. Superseded entries visibly name their replacement.

Use this view for repository maintenance, governance audits, or questions about how Ember's design evolved. Historical material is not added by `--deep` merely because the question is investigative.

## Progressive disclosure

The intended flow is:

```text
repository policy (AGENTS.md)
    -> compact default catalogue
        -> selected current documents
            -> optional selected headings
                -> selected full source

and, when needed:

    default catalogue
        -> deep catalogue for supporting evidence/reference/source
        -> all/history view for superseded or historical material
```

Every catalogue or heading view is a deterministic projection. None is a new canonical source.

### Layer 1: repository policy

`AGENTS.md` explains when to consult discovery, how to interpret role/discovery status, how to escalate, and how to handle conflicts. It must not duplicate a manually maintained docs tree.

### Layer 2: compact catalogue

The compact catalogue emits bounded routing information such as:

```text
docs/architecture/decisions/0002-preserve-persistent-meaning.md [decision, current]
  Summary: Semantic constraints for persistent meaning, including provenance, scope, currentness, correction, and forgetting.
  Read when: Changing how corrected or superseded memory governs later behavior; designing persistence for current versus historical remembered meaning
```

The compact display may shorten the field label to `current`, but the source metadata field remains `discovery_status`.

No body text, generated semantic score, keyword extraction, or model-generated summary belongs here.

### Layer 3: selected headings

Several Ember research and architecture documents are already tens of kilobytes long. V1 should therefore support heading projection for **explicitly selected paths**, not a whole-corpus heading mirror.

Conceptually:

```text
docs:list --headings docs/research/memory-and-remembering.md
```

The projection includes H1-H4 headings in source order, strips frontmatter, and ignores headings inside fenced code blocks. Requiring explicit paths keeps this layer bounded and useful after the compact catalogue has already narrowed the search.

### Layer 4: full source

The agent opens only the documents required to perform the task correctly.

### Layer 5: deeper evidence or history

Evidence maps and source artifacts are opened when provenance, challenge, reconstruction, or deeper justification requires them. Superseded and historical documents are opened only when history or governance requires them.

## Agent usage policy

### When discovery is required

Consult the default catalogue before work that can change or judge Ember's durable semantics or architecture, including:

- continuity, identity, memory, currentness, context selection, agency, delegation, authority, permissions, sessions, surfaces, or long-running work;
- architecture or persistence design;
- behavior that must satisfy semantic ADRs or architecture acceptance scenarios;
- changes to canonical documentation, ADRs, research, scenarios, or repository governance;
- review of changes in those areas;
- capabilities or external effects whose meaning crosses an established semantic boundary.

A purely local implementation detail may skip discovery when it cannot plausibly change observable semantics or documented contracts. Examples include a spelling fix, a mechanical rename with no semantic change, or an isolated parser defect whose expected behavior is already unambiguous from nearby code and tests.

When uncertain whether a change is semantically meaningful, consulting the compact catalogue is cheaper than guessing.

### How to interpret `read_when`

`read_when` is a routing hint, not an exhaustive trigger list. A strong semantic match means the document should normally be inspected before making the relevant decision. A missing literal phrase does not mean the document is irrelevant.

Agents combine:

- the task;
- `summary`;
- `read_when`;
- role;
- discovery status;
- links and headings from already-selected documents.

The deterministic tool does not compute task relevance or ranking.

### Escalation

1. Start with default discovery for semantically meaningful work.
2. Select the smallest plausible current document set.
3. For a long selected document, inspect its headings first when that can narrow the read.
4. Use deep discovery when the task asks why, challenges a conclusion, requires provenance, or compares external systems.
5. Use the all/history view when the task concerns superseded guidance, repository evolution, or historical material.
6. Open preserved source artifacts only when evidence maps or the investigation genuinely require that depth.

The deeper tier does not mean "less true" in a generic sense. It means "not normally governing current implementation directly." A preserved source artifact can contain excellent evidence while still being non-canonical.

### Conflict handling

When relevant documents disagree, agents must not resolve the conflict by retrieval order, path order, modification time, number of matching hints, or how confident one document sounds.

Use repository governance instead:

- `foundation` constrains project purpose and durable principles;
- a `decision` record governs only when its own lifecycle says it is accepted or otherwise active for that scope;
- `scenario` documents are acceptance oracles for observable semantics and should agree with governing decisions;
- current `design` documents explain present architecture direction within those constraints;
- canonical `research` records established research conclusions and rationale, but a later accepted decision may deliberately choose among research-supported options;
- `guide` governs repository or operational procedure in its stated scope but does not override semantic foundations or decisions;
- `reference`, `evidence`, and `source` may justify, challenge, or explain current conclusions but do not silently override them;
- `discovery_status: superseded` and `historical` documents do not govern current work.

Role/discovery status from the compact catalogue is enough to decide what to inspect, not enough to prove every role-specific authority fact. When authority matters, read the relevant source document.

If sources that should be mutually consistent actually conflict, treat that as a repository inconsistency. Identify both sources and resolve or surface the inconsistency rather than silently choosing one.

### No obvious match

No matching `read_when` hint means "routing metadata did not settle this," not "the repository has no relevant knowledge."

Fallback order:

1. inspect summaries in the default catalogue for conceptually adjacent documents;
2. inspect headings for the most plausible candidates;
3. use ordinary repository/source search;
4. use deep discovery for evidence, supporting investigations, or preserved source material;
5. use the all/history view for superseded or historical knowledge;
6. if important current knowledge was discoverable only through fallback, improve its `summary` or `read_when` when appropriate.

Agents must not treat omission from the current prompt or context as evidence that a repository fact or document does not exist.

## Deterministic tooling contract for #27

The implementation language is deliberately not chosen here. #27 should use Ember's adopted project toolchain if one exists by then and should not introduce a separate application runtime solely for documentation discovery.

### Source paths and exclusions

The tool scans human-authored `docs/**/*.md` from repository root.

Explicit generated-file exclusions, if any exist by #27, live in one inspectable configuration or code location and are covered by tests. Root bootstrap files remain outside the v1 source set by contract, not by accidental glob behavior.

### Command surface

The intended behaviors are conceptually:

```text
docs:list
docs:list --deep
docs:list --all
docs:list --headings <path> [<path> ...]
docs:check
```

The concrete invocation may be a repository script, build task, or executable wrapper. These names specify behavior rather than a package manager choice.

### `docs:list`

- scans the participating source set from repository root;
- emits current default-depth documents;
- sorts entries lexicographically by normalized repository-relative path;
- preserves author order inside `read_when`;
- emits path, role, discovery status, summary, applicability hints, and `superseded_by` when relevant;
- writes only to stdout/stderr and does not modify repository files.

### `docs:list --deep`

Produces the default catalogue plus current `reference`, `evidence`, and `source` documents.

### `docs:list --all`

Produces all participating documents, including superseded and historical entries. It is primarily for maintenance, governance, and historical investigation.

### `docs:list --headings <paths...>`

- requires one or more explicit participating Markdown paths;
- validates each requested path;
- emits H1-H4 headings in document order;
- strips frontmatter;
- ignores headings inside fenced code blocks;
- does not generate routes, anchors, or publishing metadata Ember does not otherwise need;
- does not create or update a committed docs map.

### `docs:check`

Validates the complete participating corpus and exits non-zero on contract violations. It is the full-corpus validation command suitable for CI and local pre-merge checks.

`docs:list` must never silently hide malformed participating documents. It may emit a usable partial projection alongside diagnostics, but if a contract violation can make catalogue completeness uncertain, the command exits non-zero. `docs:check` remains the authoritative exhaustive validation surface.

### Runtime and dependency footprint

The implementation must be:

- local and deterministic;
- network-free;
- model-free;
- database-free;
- service-free;
- cheap enough to run routinely.

If Ember already has an adopted runtime and dependency ecosystem when #27 starts, reuse it and prefer an existing parser library from that ecosystem.

If Ember still has no implementation toolchain, the discovery utility should be self-contained and zero-dependency rather than introducing a package manager or dependency graph solely for docs discovery. In that case #27 may explicitly constrain the accepted frontmatter syntax to the simple v1 constructs this contract needs and reject unsupported YAML features. The supported syntax must be documented and test-covered rather than pretending a hand-written parser implements arbitrary YAML.

A small parser dependency becomes reasonable once it belongs to an already-adopted project runtime. A long-lived service, hidden index, or broad docs framework does not.

### Repository-root behavior and failures

The command surface is defined from repository root. Running it where the expected repository markers and `docs/` source path are unavailable must fail with a concise actionable message rather than scanning an arbitrary current directory.

The tool should report all validation errors in one run where practical. Missing or invalid required metadata must never turn into silent omission from a successful catalogue.

## Validation contract

#27 should enforce only what deterministic tooling can actually know.

### Required checks

For every participating document:

- frontmatter is valid according to the parser/syntax supported by the implementation;
- `summary` exists, is a non-empty single-line string, and is not whitespace-only;
- `read_when` exists, is a non-empty list, and every item is a non-empty string;
- exact duplicate `read_when` entries inside one document are rejected after trimming whitespace;
- `role` is one allowed value;
- `discovery_status` is one allowed value;
- `discovery_status: superseded` requires `superseded_by`;
- `superseded_by` points to an existing participating document and cannot point to itself;
- a supersession target has discovery status `current` or `superseded`, never `historical`;
- supersession chains are acyclic and every chain terminates at a `current` document;
- `superseded_by` is absent for `current` and `historical` documents;
- generated/excluded paths are explicit and test-covered;
- output ordering and formatting are deterministic across repeated runs.

Exact duplicate applicability hints across different documents should produce at most a maintenance warning. Different documents can legitimately apply to the same task.

### What validation must not pretend to prove

The tool must not attempt to prove that:

- a summary is semantically complete;
- a `read_when` hint is broad or narrow enough;
- a document truly deserves the role declared by governance;
- a `decision` document is accepted merely because its role says `decision`;
- two natural-language hints are semantic duplicates;
- a research conclusion is correct;
- an ADR and acceptance scenario are substantively consistent;
- a task deterministically maps to a particular document set.

Those remain authoring, review, and evaluation responsibilities.

## Authoring rules

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
- avoids embedding implementation choices the document itself does not require.

Prefer a few strong hints over a long pseudo-taxonomy.

When a document's responsibility changes materially, updating its routing metadata is part of updating the document.

## Task-oriented evaluation

The deterministic catalogue does **not** accept a task and does not calculate task-to-document matches. Therefore #27 must not fake routing quality with a semantic matcher or a unit test that claims to prove natural-language relevance.

Evaluation has two parts:

1. **Deterministic structural checks** verify that representative documents are present in the right discovery depth, carry valid metadata, and remain reachable through default/deep/all behavior.
2. **Qualitative task review** gives a human or coding agent a realistic task plus the generated catalogue and records whether the intended documents are obvious candidates, whether unrelated material can remain unopened, and whether escalation to deep/history is understandable.

The seven scenarios below define expected reading behavior, not a hidden deterministic ranking algorithm.

### 1. Change continuity or restart behavior

**Task:** Change how Ember resumes after a complete process restart and long inactivity.

**Expected candidates:** continuity and operational semantic ADRs, restart/recovery acceptance scenarios, current design directions, and the canonical continuity/operational research notes when rationale is needed.

**Do not eagerly load:** every memory/delegation/authority research note, evidence maps, reviewed-system notes, or preserved Deep Research exports.

### 2. Change memory/currentness behavior

**Task:** Change how a corrected preference supersedes older remembered state while preserving history.

**Expected candidates:** persistent-meaning and least-sufficient-projection ADRs, memory/currentness scenarios, canonical memory and context-selection research, and cross-cutting design direction where currentness matters.

**Do not eagerly load:** unrelated authority/agency research, evidence maps, or source artifacts.

### 3. Decide whether information may be sent to a specialist

**Task:** Decide whether relationship information relevant to Ember may be included in a coding specialist's delegated context.

**Expected candidates:** least-sufficient-permitted-projection and capability/authority decisions, relevant delegation/privacy scenarios, and canonical delegation, context-selection, and authority research.

**Do not eagerly load:** continuity source research, all reviewed-system notes, or every evidence map.

### 4. Change authority around an external action

**Task:** Allow Ember to perform an external action under a standing grant after circumstances have changed.

**Expected candidates:** capability/authority and persistent-meaning decisions, authority/currentness scenarios, canonical authority research, and operational research only where retries, stale work, or effects matter.

**Do not eagerly load:** general reviewed-system research or source artifacts.

### 5. Modify architecture acceptance scenarios

**Task:** Add a fixture for a new concurrency/currentness failure case.

**Expected candidates:** the acceptance-scenario catalogue, governing decisions traced by the new scenario, current design directions, and canonical research only for distinctions not already settled by those decisions.

**Do not eagerly load:** all canonical research merely because the scenario catalogue links to it, and never all preserved source material.

### 6. Debug an implementation detail with no semantic change

**Task:** Fix a local parser bug whose expected behavior is already established by nearby tests and does not alter Ember semantics.

**Expected behavior:** discovery may legitimately be skipped. If consulted, repository/operational guide material should usually be enough.

**Do not eagerly load:** semantic ADRs, canonical research, evidence maps, or source research merely because they are important repository documents.

This case matters because success includes the mechanism staying out of the way when broad semantic context has no value.

### 7. Investigate why a research conclusion exists

**Task:** Determine why the memory research concluded that current belief must remain distinct from historical evidence, deeply enough to challenge the conclusion or verify its basis.

**Expected progression:**

1. canonical memory research through default discovery;
2. memory portable evidence map through deep discovery;
3. preserved memory Deep Research export through deep discovery only if reconstruction of the original investigation is actually needed.

**Do not eagerly load:** unrelated decisions, every other concern note, or all preserved source artifacts.

This is the clearest test that deeper evidence remains reachable without becoming ordinary coding context.

## Maintenance and evolution

The contract should evolve only in response to observed routing failures.

Signals that may justify a richer mechanism later include:

- the compact catalogue itself becomes a meaningful context burden;
- ordinary tasks routinely leave too many plausible documents;
- role/discovery status cannot express a recurring authority distinction;
- non-accepted decision records become common enough that their lifecycle needs compact projection;
- contributors repeatedly need cross-corpus search over code, issues, and docs rather than repository documentation discovery;
- heading projections are insufficient to narrow large documents;
- deterministic source search becomes a material bottleneck.

These are symptoms to measure, not reasons to pre-build a retrieval platform.

## Deliberately deferred enhancements

The following are deferred from #27 unless implementation exposes a concrete blocker:

- JSON or machine-protocol output in addition to human-readable output;
- root-level README/contributor/security files participating in frontmatter discovery;
- topic tags or concern ontologies;
- generic proposal/approval lifecycle metadata;
- automatic ranking, scoring, embeddings, or vector search;
- LLM-generated summaries or applicability hints;
- a checked-in generated documentation map;
- a docs website or publishing framework;
- schema-version metadata;
- richer discovery lifecycle states beyond current/superseded/historical;
- cross-project standardization;
- automatic semantic-quality scoring for metadata;
- indexing code, issues, PRs, or external documentation into the same mechanism.

## Implementation plan for #27

#27 should implement and adopt this contract in small steps:

1. **Inventory the actual merged `docs/` corpus.** Reconcile this design with whichever ADRs and acceptance scenarios have landed by then and identify genuinely generated Markdown exclusions.
2. **Add frontmatter to participating documents.** Classify current documents using the roles above. Mark the initial architecture model superseded by the current design synthesis. Keep evidence maps and source artifacts in the deep tier through metadata roles rather than path-only assumptions.
3. **Implement deterministic catalogue and validation tooling.** Support default, deep, all/history, selected-headings, and full-check behaviors with stable ordering and explicit failures.
4. **Add focused deterministic tests.** Cover parsing, role/discovery-status validation, supersession targets/chains, missing metadata, depth filtering, deterministic ordering, selected heading extraction, fenced-code handling, exclusions, and repository-root failure behavior.
5. **Run task-oriented evaluation without inventing semantic matching.** Use structural assertions for tier membership and metadata invariants, then exercise the seven realistic tasks against the generated catalogue and record qualitative findings. Do not add task-query/ranking code or whole-corpus snapshots merely to make model judgment look deterministic.
6. **Add root agent policy.** Introduce or update `AGENTS.md` with compact rules for when to consult discovery, progressive disclosure, conflict handling, fallback, and the reminder that current-context omission is not repository absence. Do not copy the docs tree into it.
7. **Wire `docs:check` into routine validation.** If CI exists, make metadata contract violations fail it. Otherwise document the command as a required repository validation surface so CI can adopt it when introduced.
8. **Evaluate before enriching.** Fix summaries and applicability hints first. Add fields or retrieval machinery only if a concrete failure remains after authoring improvements.

## Decision summary

For Ember v1:

- discovery metadata applies to human-authored `docs/**/*.md`, while root bootstrap/human convention files remain outside the catalogue;
- use human-authored Markdown frontmatter;
- keep OpenClaw's `summary` / `read_when` distinction;
- add `role` because Ember has materially different repository knowledge classes;
- add `discovery_status` plus conditional `superseded_by` because current and historical architecture intentionally coexist, while avoiding collision with ADR or other role-specific `status`;
- keep role-specific authority and lifecycle in their governing source conventions rather than pretending discovery metadata can replace them;
- derive discovery depth from `role + discovery_status` rather than adding another field;
- default to current foundations, decisions, design, scenarios, canonical research, and guides;
- require deep discovery for supporting references, evidence maps, and preserved source artifacts;
- require the all/history view for superseded and historical material;
- generate compact catalogues and selected-document headings ephemerally;
- validate participation strictly enough that missing metadata cannot make important docs silently vanish;
- let model judgment interpret task-oriented hints while deterministic code enforces syntax, membership, lifecycle consistency, and projection behavior;
- keep `AGENTS.md` as routing policy, never a hand-maintained document index;
- treat conflicts as governance problems to resolve explicitly, never as ranking problems;
- keep the first implementation self-contained if Ember still lacks an adopted runtime;
- defer richer retrieval until Ember demonstrates a real need for it.

This is the smallest contract that preserves the useful part of OpenClaw's pattern while respecting Ember's stronger distinction between current conclusions, supporting evidence, and preserved research history.
