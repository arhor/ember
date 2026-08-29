---
summary: "Contributor and agent guide for running, authoring, validating, and extending Ember's documentation discovery metadata."
read_when:
  - "Adding or materially changing a Markdown document under docs/"
  - "Running documentation discovery or diagnosing metadata validation failures"
  - "Authoring summaries or read_when hints, or deciding which discovery role or status a document should declare"
role: guide
discovery_status: current
---

# Documentation Discovery Guide

The governing design is [Ember Agent-Aware Documentation Discovery Contract](documentation-discovery.md). This guide explains how to use and maintain the adopted implementation.

The central rule remains:

> Discovery metadata helps readers find knowledge. It does not create authority for that knowledge.

A document's repository role, its `discovery_status`, and any role-specific lifecycle such as an ADR's accepted/proposed status remain separate concepts.

## Commands

Run discovery from the repository root with Node.js built-ins only. Use Node.js 24.x locally for the same runtime exercised by CI; CI pins Node 24 explicitly. Ember intentionally does not introduce `package.json`, an npm dependency graph, or a package installation step solely for this feature. Using Node for this repository utility does not adopt Node.js as Ember's implementation runtime.

```bash
# Current foundations, decisions, design, scenarios, canonical research, and guides.
node scripts/docs-discovery.mjs list

# Default catalogue plus current supporting references, evidence maps, and source artifacts.
node scripts/docs-discovery.mjs list --deep

# Every participating document, including superseded and historical material.
node scripts/docs-discovery.mjs list --all

# H1-H4 structure for documents already selected from the catalogue.
node scripts/docs-discovery.mjs list --headings docs/research/memory-and-remembering.md

# Full-corpus metadata and lifecycle validation.
node scripts/docs-discovery.mjs check
```

The catalogue is deterministic and ephemeral. It is written to standard output and is not checked into the repository.

## Participating documents

V1 participation is simple:

- every human-authored `docs/**/*.md` file participates;
- root bootstrap files such as `README.md` and `AGENTS.md` do not;
- generated Markdown may be excluded only through the explicit `EXCLUDED_PATHS` set in `scripts/docs-discovery.mjs` and corresponding tests.

There are currently no generated Markdown exclusions.

Deleting frontmatter from a participating document therefore causes validation to fail. Metadata presence is not an opt-in switch that can silently hide a document.

## Metadata

A participating document starts with frontmatter shaped like this:

```yaml
---
summary: "Canonical semantics for persistent remembered meaning, including provenance, scope, currentness, correction, and forgetting."
read_when:
  - "Changing how corrected or superseded memory governs later behavior"
  - "Designing persistence for current versus historical remembered meaning"
role: research
discovery_status: current
---
```

A superseded document additionally declares a repository-relative replacement:

```yaml
superseded_by: docs/architecture/design-directions.md
```

### `summary`

Write one compact sentence that distinguishes the document's responsibility from nearby material. Describe what useful knowledge the reader will find, not merely the title or broad topic.

Prefer:

```yaml
summary: "Canonical semantics for persistent remembered meaning, including provenance, scope, currentness, correction, and forgetting."
```

Avoid:

```yaml
summary: "Memory document"
```

### `read_when`

Write a small set of recognizable task situations. Begin from work a contributor or agent may actually be doing, such as changing behavior, making a design decision, investigating a failure, checking evidence, or reconstructing provenance.

Prefer:

```yaml
read_when:
  - "Changing how remembered information is corrected, superseded, or forgotten"
  - "Investigating whether historical evidence should still govern current behavior"
```

Avoid keyword lists such as `memory`, `agents`, or hints broad enough to match nearly every task. The deterministic tool does not compare a task to these strings. A human or model reads them and judges relevance.

### `role`

Choose the document's repository knowledge function, not its topic:

| Role | Purpose | Normal depth |
| --- | --- | --- |
| `foundation` | Project purpose or durable principles | Default |
| `decision` | Decision record; its own lifecycle determines whether it governs | Default |
| `design` | Current or historical architecture/design direction | Default |
| `scenario` | Acceptance or evaluation fixtures for observable semantics | Default |
| `research` | Canonical Ember concern synthesis | Default |
| `guide` | Repository, contributor, authoring, or operational guidance | Default |
| `reference` | Supporting external-system or comparative investigation | Deep |
| `evidence` | Portable evidence map supporting canonical research | Deep |
| `source` | Preserved source research artifact | Deep |

A role label projects existing governance into discovery. It cannot turn arbitrary prose into a canonical research result or make a proposed decision accepted.

### `discovery_status`

Use one of:

- `current`: eligible for present-day discovery within its role;
- `superseded`: retained but replaced by another participating document;
- `historical`: retained as history without a current governing claim.

A superseded document must point through `superseded_by` to another participating document. Supersession chains must be acyclic and end at a current document.

Do not use `discovery_status` as a substitute for role-specific lifecycle. For example, an ADR may simultaneously have `role: decision`, `discovery_status: current`, and its own `status: proposed`. The first two make it discoverable; only the ADR lifecycle says whether it governs.

## Ember frontmatter subset

Participating files use familiar YAML-style `---` frontmatter delimiters, but the discovery utility implements an **Ember-specific frontmatter grammar**, not a general YAML parser. This distinction is intentional: Ember has not adopted an implementation runtime or dependency ecosystem, so v1 keeps the parser small, inspectable, and zero-dependency rather than approximating arbitrary YAML. This tooling choice does not establish an Ember application runtime.

The accepted grammar is limited to what the v1 contract needs:

- a `---` opening delimiter on the first line and a `---` closing delimiter;
- top-level `key: scalar` fields;
- non-empty plain or quoted scalar strings;
- block lists with exactly two spaces before `-`;
- additional simple scalar fields belonging to another document lifecycle, such as `status: accepted`;
- plain scalars are treated as literal strings; YAML implicit typing and comment semantics are not part of this grammar.

Features outside that grammar, including inline collections, nested mappings, anchors, folded/literal multiline scalars, and arbitrary indentation, are rejected when encountered. If Ember later adopts a project runtime with a normal YAML parser, replacing this narrow parser can be considered, but the discovery contract and its observable behavior should remain unchanged.

## Default, deep, and history disclosure

The three catalogue modes answer different questions.

**Default discovery** is normal pre-work routing. It contains current `foundation`, `decision`, `design`, `scenario`, `research`, and `guide` documents.

**Deep discovery** adds current `reference`, `evidence`, and `source` material. Use it when checking why a conclusion exists, challenging evidence, reconstructing provenance, or comparing external systems. Deep does not mean less true. It means the material is not normally the direct governing input to ordinary implementation work.

**All/history discovery** additionally exposes superseded and historical documents. Use it for repository evolution and governance questions. A deep investigation does not automatically make old guidance current.

## Selected-document headings

Heading projection is deliberately a second step after document selection:

```bash
node scripts/docs-discovery.mjs list --headings \
  docs/architecture/design-directions.md \
  docs/research/context-selection-and-cognitive-framing.md
```

The command accepts explicit participating paths only, emits H1-H4 headings in source order, strips frontmatter, and ignores apparent headings inside fenced code blocks. It does not build routes, anchors, a checked-in docs map, or a whole-corpus structural index.

## Adding a participating document

When adding `docs/**/*.md`:

1. decide its existing repository knowledge role before writing metadata;
2. add a distinguishing `summary`;
3. add a few task-oriented `read_when` hints;
4. set `discovery_status` independently from any document-specific lifecycle;
5. add `superseded_by` only when the document is actually superseded;
6. inspect `list`, `--deep`, or `--all` to make sure it appears at the intended disclosure depth;
7. run unit tests and `check` before merging.

Do not copy identical hints across a directory merely to satisfy validation. A directory can contain canonical research, evidence, source artifacts, and reference investigations with intentionally different routing behavior.

## Validation

Run:

```bash
node --test tests/docs-discovery.test.mjs tests/docs-discovery-repository.test.mjs
node scripts/docs-discovery.mjs check
```

`check` validates syntax, required fields, role/status values, exact duplicate hints within a document, supersession targets and chains, participation, and explicit exclusions. Exact duplicate hints across documents are reported as maintenance warnings because legitimate overlap is possible.

Validation intentionally does **not** claim to prove that a summary is semantically complete, that a hint is ideally broad, that a role declaration is justified by governance, that an ADR is accepted, or that a task maps deterministically to a document set. Those require review and task-oriented evaluation.

## What this system intentionally does not do

The discovery layer has no task-query interface. It does not search semantically, score, rank, classify, embed, rerank, infer topics, call a model, maintain a database, create a hidden index, or replace ordinary repository search.

Its job is narrower: expose a trustworthy compact catalogue so a human or model can decide what to read next while keeping current canonical material, deeper evidence, and history distinguishable.
