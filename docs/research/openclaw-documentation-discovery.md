---
summary: "Reference investigation that extracts OpenClaw's lightweight agent-aware documentation pattern and separates it from publishing infrastructure and indexed retrieval."
read_when:
  - "Investigating the provenance or external precedent behind Ember's documentation-discovery contract"
  - "Comparing lightweight metadata projection with semantic search, RAG, docs publishing, or OpenClaw's Ask Molty retrieval layer"
role: reference
discovery_status: current
---

# OpenClaw Agent-Aware Documentation Discovery

Investigated on 2026-08-29 against `openclaw/openclaw` commit [`f5eea3197c55c0ed0e609d182bd88a7f09ec55e9`](https://github.com/openclaw/openclaw/commit/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9). The separate Ask Molty retrieval system was inspected at `openclaw/ask-molty` commit [`fe1e882f5d920e4b44b0eb4e96fc8c80f8cc1a10`](https://github.com/openclaw/ask-molty/commit/fe1e882f5d920e4b44b0eb4e96fc8c80f8cc1a10).

This note is a focused engineering investigation of OpenClaw's repository documentation-discovery pattern. It extracts the reusable mechanism and its boundaries. It does not propose Ember's final metadata schema or implement Ember tooling; those decisions belong to #26 and #27.

## Executive finding

OpenClaw's repository-level documentation discovery is much smaller than it first appears.

It is not semantic search, a documentation database, or a RAG system. Its core is:

1. human-authored Markdown/MDX documents remain the source artifacts;
2. two pieces of frontmatter provide routing information: `summary` says what a document contains and `read_when` says when it is likely to matter;
3. a deterministic script projects only path, summary, and applicability hints into a compact catalogue;
4. repository agent policy tells the model to consult that catalogue and use its own judgment to choose documents;
5. an optional heading projection offers one more level of structure without loading full documents;
6. the model opens source documents only after routing;
7. a separate, substantially heavier retrieval system exists for broad documentation/source/GitHub search.

The important abstraction is therefore **progressive disclosure over canonical source documents**, not the particular YAML keys or Node script.

A useful mental model is:

```text
repository policy
    -> compact routing catalogue
        -> optional heading map
            -> selected source document
                -> deeper retrieval/evidence when necessary
```

The deterministic machinery makes repository knowledge visible cheaply. The language model still decides relevance. Neither the catalogue nor the heading map becomes a new source of truth.

## 1. The mechanism in current OpenClaw

### 1.1 Knowledge artifacts remain ordinary source documents

The mechanism operates over Markdown and MDX files under `docs/`. There is no separate registry that authors must keep in sync with each page.

Current [`scripts/docs-list.js`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/docs-list.js) recursively discovers `.md` and `.mdx` files from the repository-root `docs` directory, sorts paths deterministically, and reads routing metadata directly from frontmatter.

This is significant: the primary knowledge artifact and the thing that declares how it should be discovered are colocated. Renaming or moving a document cannot leave behind a separately maintained routing record unless another generated projection has been committed incorrectly.

OpenClaw does deliberately exclude some subtrees. The compact `docs:list` catalogue excludes `archive` and `research`. The heading map additionally excludes `.generated`, `assets`, `images`, `internal`, `snippets`, `AGENTS.md`, `CLAUDE.md`, and the `docs_map.md` stub itself. These are concrete OpenClaw policy choices, not a generic definition of what documentation is authoritative.

### 1.2 `summary` and `read_when` form the actual discovery contract

The current discovery parser is intentionally narrow. Despite richer frontmatter existing throughout the docs corpus, `docs:list` mechanically consumes only:

| Field | Used by repository discovery? | Observed role |
| --- | --- | --- |
| `summary` | Yes | Compact description of what the page contains. Required by `docs:list`. |
| `read_when` | Yes | One or more natural-language applicability hints. Optional. |
| `title` | No | Presentation/publishing metadata, not part of `docs:list` routing. |
| `doc-schema-version` | No | Docs authoring/schema convention, not consumed by `docs:list`. |
| `redirect`, `sidebarTitle`, `status`, and other page metadata | No | Page/publishing concerns outside the compact discovery mechanism. |

Representative pages make the separation visible. For example, [`docs/reference/wizard.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/docs/reference/wizard.md) carries `summary`, `doc-schema-version`, `title`, and `redirect`, while the discovery script only extracts `summary` and `read_when`. Searches of the current scripts found no `doc-schema-version` consumer in `scripts/`.

That distinction is worth preserving conceptually:

- `summary` answers **what knowledge is here?**
- `read_when` answers **under what task circumstances might I need it?**

Neither field says that the document is canonical, current, trusted, or authoritative. In OpenClaw much of that is supplied by repository structure and surrounding documentation policy rather than the routing metadata itself.

### 1.3 `read_when` is interpreted by the model, not matched by an algorithm

There is no rule engine that compares a task against `read_when` strings.

`docs:list` prints natural-language hints. Root `AGENTS.md`, the docs-specific agent prompt, and documentation skills tell the agent to read relevant documents when those hints match the task. The matching step is therefore model judgment over a compact projection.

This is one of the strongest parts of the design. The hints can say things such as "Changing agent invocation or defaults" or "Running or debugging the gateway process" without requiring a tag ontology, exact keywords, embeddings, or a model-specific API.

It also means the hints are advisory routing cues rather than executable policy. A poor hint can reduce retrieval quality, and the script cannot prove semantic correctness.

### 1.4 Compact output deliberately omits most document content

With no arguments, `pnpm docs:list` renders a stable human-readable catalogue approximately shaped as:

```text
Listing all markdown files in docs folder:
path/to/page.md - Short summary of the page
  Read when: first applicability hint; second applicability hint
...
```

It ends with an explicit reminder that when the task matches a `Read when` hint, the agent should read that document before coding and should suggest missing documentation coverage.

The compact projection does **not** include:

- page body text;
- headings;
- snippets;
- similarity scores;
- extracted keywords;
- a model-generated summary;
- timestamps;
- canonicality or authority ranking;
- dependency or related-page graphs.

That omission is part of the mechanism, not a deficiency to fill automatically. The catalogue is cheap enough to expose broad repository knowledge without prematurely injecting all of it into working context.

### 1.5 Missing metadata is visible, but current validation is permissive

The parser reports useful per-page failures such as missing frontmatter, unterminated frontmatter, missing `summary`, or empty `summary`. However, those page-level errors are printed in the listing rather than making the entire command fail.

The command itself fails for global misuse, such as running outside a repository with a `docs` directory or passing unsupported arguments. Its focused tests in [`test/scripts/docs-list.test.ts`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/test/scripts/docs-list.test.ts) exercise missing-directory behavior, scalar and list `read_when`, YAML terminators, MDX handling, heading extraction, code fences, escaping, routes, frontmatter stripping, and path normalization.

This gives OpenClaw strong regression protection for the projection algorithm, but weaker enforcement of corpus-wide routing quality.

At the inspected snapshot, [`check:docs`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/package.json) runs formatting, docs linting, template linting, MDX checks, glossary checks, link checks, and config-example checks. It does not invoke `docs:list`. Therefore the discovery layer itself should not be described as a hard completeness gate in current OpenClaw.

This is a useful caution for Ember: a catalogue that displays metadata errors is not the same thing as CI that prevents metadata drift.

## 2. Optional structural projection: `--headings`

`pnpm docs:list --headings` provides a second discovery layer.

Rather than including page bodies, it generates a Markdown map containing each participating document's route and H1-H4 headings. The implementation strips frontmatter, ignores headings inside fenced code, normalizes Markdown decoration, escapes HTML, and generates deterministic routes for `.md`, `.mdx`, and `index` pages.

This creates a useful progression:

```text
path + summary + read_when
    -> path + route + H1-H4 structure
        -> full document
```

The second projection helps when the compact hint identifies several plausible pages, or when an agent needs to know whether a particular section exists before paying the context cost of opening the whole page.

### 2.1 The expanded map is deliberately transient

OpenClaw used to maintain a generated docs map as a checked artifact. Commit [`385f1dee165f0a9557e3dd67e83b7b1bc48b06e2`](https://github.com/openclaw/openclaw/commit/385f1dee165f0a9557e3dd67e83b7b1bc48b06e2), "docs: generate docs map at publish time", changed that model.

Current [`docs/AGENTS.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/docs/AGENTS.md) says to keep only a small source stub at `docs/docs_map.md` and never commit the expanded heading mirror. [`docs/docs_map.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/docs/docs_map.md) explains that the public and packaged map is generated from all docs headings.

Packaging makes the projection's non-canonical nature unusually explicit. [`scripts/package-docs-map.mjs`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/package-docs-map.mjs) temporarily replaces the stub with generated content while assembling a package, records a receipt, and restores the source state afterwards.

That is a strong transferable principle:

> A discovery index should be reconstructable from source and should not quietly become a second body of documentation that authors can edit independently.

## 3. Agent policy turns metadata into a workflow

The frontmatter alone does not create agent-aware documentation. OpenClaw closes the loop with explicit repository policy.

### 3.1 Root policy routes agents into discovery

The current root [`AGENTS.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/AGENTS.md) keeps root instructions terse and delegates detailed workflows to scoped instructions and skills. For docs/user-visible work it instructs agents to run `pnpm docs:list` and then read only relevant docs.

This avoids the tempting alternative of copying a hand-maintained document index into `AGENTS.md`. The policy remains small while the deterministic projection tracks the actual corpus.

### 3.2 Specialized workflows reuse the same routing mechanism

The docs maintenance prompt at [`.github/codex/prompts/docs-agent.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/.github/codex/prompts/docs-agent.md) makes `pnpm docs:list` the first required workflow step and tells the agent to read relevant docs based on `read_when` hints before inspecting the triggering change.

The [`openclaw-refactor-docs` skill](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/.agents/skills/openclaw-refactor-docs/SKILL.md) uses the same pattern: load the docs standard, run `pnpm docs:list`, then read only the target and likely related pages required for the refactor.

This shows an important boundary between responsibilities:

- **metadata** describes documents;
- **the deterministic projection** exposes that metadata cheaply;
- **agent policy** says when to consult the projection and how aggressively to follow it;
- **the model** interprets task-to-hint relevance.

None of those layers alone is the complete pattern.

## 4. Human authoring workflow

OpenClaw's authoring side is intentionally human-readable.

The original convention uses natural-language summaries and task-oriented hints. A document author does not need to maintain embeddings, keywords, an external registry, or a classifier. Documentation-specific skills reinforce the convention when pages are created or materially refactored.

The `openclaw-refactor-docs` skill, for example, asks authors to choose a title, `summary`, `doc-schema-version: 1`, and `read_when` hints for a new page, then verify docs tooling. That broader authoring contract should not be confused with the smaller discovery contract: the current repository discovery script still reads only `summary` and `read_when`.

Good `read_when` hints in the inspected corpus tend to describe **work situations**, not subject tags:

```yaml
summary: "Repository script entry points and compatibility notes"
read_when:
  - Looking for an existing script before adding a new one
  - Running repository checks, tests, docs, Docker, release, or GitHub helper scripts
  - Updating package scripts or CI workflow script references
```

That formulation is more useful to an acting agent than metadata such as `topic: scripts`, because it expresses why the page should enter context.

The human cost is correspondingly simple but real: authors must keep the summary and hints accurate when the page's responsibility changes.

## 5. How the pattern evolved

The history suggests a stable small core with later improvements around portability, coverage, and progressive disclosure rather than increasing semantic machinery.

### 2025-12-09: initial adoption

Commit [`bc3a14cde2a6a8722a88edee30545de438abcbba`](https://github.com/openclaw/openclaw/commit/bc3a14cde2a6a8722a88edee30545de438abcbba), "docs: add docs:list helper and front matter", introduced the helper and bulk-added `summary`/`read_when` metadata across documentation.

This is useful historical evidence because the routing convention was not an accidental side effect of Mintlify frontmatter. The helper and the routing metadata were introduced together as an explicit repository workflow.

### Late 2025 to early 2026: execution hardening

Subsequent changes made the tool resolve from the working checkout and moved script execution from Bun to Node. Commit [`5f21bf735ab32c9cf5e08370a26881e560bc8949`](https://github.com/openclaw/openclaw/commit/5f21bf735ab32c9cf5e08370a26881e560bc8949) changed `docs:list` to `node scripts/docs-list.js`; later changes hardened Node-safe behavior.

These changes are operational rather than semantic. The core path-summary-applicability projection stayed intact.

### 2026: broader source coverage and parser robustness

The script later gained MDX support and more robust YAML frontmatter terminator handling. The focused tests now cover these edge cases.

Again, the evolution is telling: OpenClaw invested in making the simple projection reliable across its actual corpus rather than adding ranking algorithms.

### 2026-08-01: structural discovery without a committed mirror

Commit [`385f1dee165f0a9557e3dd67e83b7b1bc48b06e2`](https://github.com/openclaw/openclaw/commit/385f1dee165f0a9557e3dd67e83b7b1bc48b06e2) added on-demand heading projection and moved public/package map generation into publishing/packaging. The source repository retained only the compact stub.

This is the most important later evolution for the portable framework: when the compact catalogue became insufficient for some navigation tasks, OpenClaw added another **projection layer**, not another canonical knowledge store.

## 6. Publishing and CI are adjacent, not the essence

OpenClaw has substantial documentation infrastructure around the discovery mechanism:

- Mintlify conventions;
- a separate `openclaw/docs` publishing mirror;
- generated localization artifacts;
- link and MDX validation;
- schema validation for configuration examples;
- generated plugin and maturity docs;
- R2 publishing and docs hosting.

The current [docs sync workflow](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/.github/workflows/docs-sync-publish.yml) mirrors source docs into the publishing repository and validates the published MDX. [`scripts/docs-sync-publish.mjs`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/docs-sync-publish.mjs) participates in that transformation and imports the same heading-map renderer.

These systems show that the projection can be reused at publication boundaries, but they are not prerequisites for agent-aware repository discovery.

In particular, Ember should not infer that it needs Mintlify, a docs mirror, localization, a `doc-schema-version`, or package-time materialization merely because those things coexist with `summary` and `read_when` in OpenClaw.

## 7. Ask Molty is a separate retrieval layer

OpenClaw's Ask Molty system is important mainly because it demonstrates where the simple repository pattern stops.

The current [`openclaw/ask-molty` AGENTS.md](https://github.com/openclaw/ask-molty/blob/fe1e882f5d920e4b44b0eb4e96fc8c80f8cc1a10/AGENTS.md) describes a read-only exported workspace containing documentation, source code, and GitHub issues/PRs. Its default artifacts include:

```text
docs-search.jsonl
source-search.jsonl
github-search.jsonl
workspace-manifest.json
workspace/
  docs/
  source/
  github/
```

The Worker loads indexes, ranks candidates, mounts only selected files into a small in-memory workspace, then exposes model tools such as `search_workspace`, `read_workspace`, `list_workspace`, and a constrained read-only shell. The [README](https://github.com/openclaw/ask-molty/blob/fe1e882f5d920e4b44b0eb4e96fc8c80f8cc1a10/README.md) explicitly describes this deterministic candidate-retrieval step before model-driven reads.

Ask Molty also carries a richer evidence policy: docs are canonical documentation, source is implementation truth, and GitHub issues/PRs are discussion/status evidence.

This is qualitatively different from `docs:list`:

| Repository discovery | Ask Molty retrieval |
| --- | --- |
| Works from the source checkout | Runs as a dedicated docs AI service |
| Projects path + human summary + applicability | Builds searchable JSONL indexes and a virtual workspace |
| Lets the model interpret hints | Deterministically ranks candidates before model reads |
| Documentation only | Documentation + source + GitHub discussion/status evidence |
| No separate retrieval store | Exported retrieval artifacts and runtime |
| Near-zero architectural footprint | Dedicated exporter, worker, retrieval logic, tools, auth, deployment |

The reusable lesson is not that every project should eventually build Ask Molty. It is that a simple discovery contract should leave an **escape hatch** for deeper retrieval when repository scale or question type actually justifies it.

## 8. Failure modes and scaling limits

OpenClaw's pattern is strong because it is small, but its simplicity has identifiable limits.

### Stale `summary`

A stale summary can route an agent away from the correct page or make an obsolete responsibility look current. The projection is deterministic but can only be as correct as author-maintained metadata.

Mitigation belongs mostly in review discipline and metadata validation. No algorithm can infer the intended responsibility of a page perfectly from its body.

### Vague or overly broad `read_when`

Hints such as "when working on agents" provide little discrimination. Conversely, a very narrow hint can miss valid tasks phrased differently.

Because matching is model judgment, authors should phrase hints as recognizable task situations and accept some overlap. Turning them into a rigid taxonomy would lose much of the mechanism's flexibility.

### No matching hint

Absence of an obvious match cannot safely mean absence of relevant repository knowledge. OpenClaw's root reminder partly addresses this by encouraging missing coverage to be suggested, but the mechanism still needs an agent policy for fallback behavior.

A portable policy should allow the agent to use summaries, headings, neighboring docs, or ordinary source search when hints are insufficient.

### Too many matching hints

If many pages contain broad applicability hints, the compact list stops reducing context. At that point the next response should not be "load all matches". Structural projection, better authoring, document-class boundaries, or a deeper retrieval layer can restore selectivity.

### Overlapping topics

Two documents may cover the same subject for different purposes, such as a guide versus reference or a canonical conclusion versus supporting evidence. `summary` and `read_when` can describe that distinction but do not enforce authority or precedence.

This is especially relevant to Ember, whose research corpus intentionally contains canonical syntheses, portable evidence maps, and preserved non-canonical source artifacts about the same concern.

### Outdated or superseded documents

OpenClaw largely relies on directory/publishing conventions and human maintenance to keep obsolete material out of ordinary routing. The two discovery fields do not encode supersession.

A project with more explicit historical/evidence strata may need a small additional authority/currentness signal or deliberate source-set separation. That is a #26 decision, not something to copy preemptively.

### Corpus growth

The right threshold for moving beyond a flat compact catalogue is symptom-based, not a magic document count. The pattern begins to lose value when:

- the catalogue itself becomes a significant context cost;
- most tasks match many entries;
- document roles or authority differ in ways the projection cannot express;
- questions routinely require evidence across many artifacts;
- users need search over source, discussions, and docs together.

OpenClaw's own architecture illustrates the progression: the repository uses a tiny `docs:list` mechanism, while the public Ask Molty experience uses a dedicated indexed retrieval pipeline.

## 9. Portable framework

The following framework separates the invariant from OpenClaw's implementation choices.

| Element | Essential invariant | Useful OpenClaw choice | Project-specific convention | Optional enhancement |
| --- | --- | --- | --- | --- |
| **1. Knowledge artifacts** | Durable source documents remain authoritative; discovery points to them. | Markdown/MDX files with colocated frontmatter. | `docs/**`, plus OpenClaw-specific exclusions. | Other human-readable or structured source formats. |
| **2. Routing metadata** | Describe both what a document contains and when it matters. | `summary` + natural-language `read_when`. | `title`, `doc-schema-version`, redirects, sidebar/status metadata belong to other docs concerns. | Role/currentness/supersession metadata where a real corpus requires it. |
| **3. Deterministic projection** | Produce a reproducible compact catalogue without model calls. | Sorted `path - summary` plus `Read when` lines from a zero-dependency Node script. | `pnpm docs:list` command name and exact formatting. | JSON output, filters, or multiple source sets if concrete consumers need them. |
| **4. Optional structural projection** | Expose more structure without eagerly loading full sources. | H1-H4 heading map from `--headings`. | Mintlify route generation and package/public docs map. | Section summaries or other deterministic structure, only if headings are insufficient. |
| **5. Agent policy** | Tell agents when to consult discovery, how to interpret hints, and when to open full sources. | Root/scoped `AGENTS.md`, docs agent prompt, and skills all reuse `docs:list`. | OpenClaw's exact workflow triggers and docs-specific rules. | Task-specific policies for design, coding, review, research, or operations. |
| **6. Validation** | Prevent syntax/projection breakage and make metadata omissions visible. | Focused tests for parser/projection behavior plus broader docs checks. | OpenClaw's MDX, Mintlify, i18n, config-example, and publishing checks. | Hard CI failure for missing required routing metadata or invalid participating documents. |
| **7. Escape hatch / deeper retrieval** | The compact mechanism must not pretend to solve every retrieval problem. | Open full docs directly; use Ask Molty for indexed docs/source/GitHub retrieval in the separate public system. | Ask Molty's Cloudflare/R2/Gitcrawl/workspace architecture. | Search/ranking, embeddings, or richer evidence retrieval only when scale or use cases justify them. |

The invariant can be summarized more compactly:

> Keep canonical knowledge in inspectable source artifacts, attach lightweight routing cues, generate disposable deterministic projections, let agent policy interpret them progressively, validate the contract, and escalate to deeper retrieval only when the cheap layers are insufficient.

## 10. What Ember should carry forward into #26

### Carry forward the `what` / `when` distinction

This is the clearest OpenClaw idea to retain. Ember should have a compact, author-readable way to tell an agent both what a document contains and when it becomes relevant.

The exact field names can remain open, but `summary` and `read_when` are already understandable and have good precedent.

### Keep routing metadata separate from authority metadata

OpenClaw's routing fields do not establish truth or precedence. That becomes more important in Ember because its corpus intentionally contains different epistemic roles:

- current vision and principles;
- semantic ADRs and architecture direction;
- canonical research syntheses;
- portable evidence maps;
- preserved source research artifacts.

A source artifact can match a task strongly while still being the wrong thing to treat as the current conclusion. #26 should therefore decide authority/currentness deliberately rather than assuming retrieval relevance implies canonicality.

### Prefer deterministic, ephemeral projections

The compact catalogue should be generated from source, not separately authored. If Ember later adds a heading map, OpenClaw's transient model is preferable to a committed expanded mirror unless a concrete consumer requires a checked artifact.

This reduces duplicate truth and makes stale-index bugs structurally harder to create.

### Let the model interpret natural-language applicability

Ember does not need tags, embeddings, or a rigid task ontology for the first version. Human-authored applicability statements can remain natural language, with deterministic tooling responsible only for collecting and presenting them.

### Make validation slightly stricter than OpenClaw if participation is explicit

OpenClaw's `docs:list` surfaces missing metadata but does not currently make `check:docs` fail on it. Ember can improve on this without adding complexity: once #26 defines which document classes participate, a deterministic check can fail when required routing metadata is missing or syntactically invalid for those participating documents.

This would prevent silent discovery rot while still avoiding impossible semantic validation of hint quality.

### Treat deeper evidence as a separate disclosure tier

Ember has a reason to be more explicit here than OpenClaw's ordinary repo docs: its canonical research notes, evidence maps, and preserved Deep Research artifacts intentionally form layers of increasing evidential depth.

The compact default catalogue should make deeper material reachable without making it equally eager. A coding or design task usually needs the canonical conclusion first; an investigation into why a conclusion exists may then descend into the evidence map and preserved source artifact.

That is the closest Ember analogue to the boundary between OpenClaw's cheap repo discovery and heavier Ask Molty retrieval, but it can initially remain entirely file-based and deterministic.

### Keep `AGENTS.md` as policy, not an index

OpenClaw's root instructions work because they route the agent into a generated catalogue rather than duplicating the docs tree. Ember should preserve that separation when #26 specifies agent policy.

### Do not copy adjacent infrastructure without a use case

The following should **not** be inherited merely because they surround OpenClaw's mechanism:

- Mintlify-specific metadata and link rules;
- a separate docs publishing repository;
- `doc-schema-version` unless Ember has an actual schema-migration need;
- package-time materialization of a docs map;
- translation machinery;
- Ask Molty's indexed workspace, Gitcrawl mirror, Worker, R2, or model tools;
- embeddings/vector search;
- OpenClaw's exact excluded-directory list.

## 11. Questions #26 still needs to answer

This investigation intentionally leaves the Ember-specific contract open. The next design task should decide:

1. Which Ember document classes participate in the compact default catalogue and which belong only to deeper evidence/archive discovery?
2. Are `summary` and `read_when` sufficient routing metadata once Ember's canonical/evidence distinction is considered?
3. If one additional field is needed, is it best understood as document role, currentness/canonicality, or supersession, and what concrete routing/validation decision consumes it?
4. Should heading projection exist in v1 or remain an optional follow-up until the compact catalogue proves insufficient?
5. What exact fallback should agents use when no hint obviously matches?
6. What precedence rule should agents follow when multiple relevant documents disagree?
7. Which participating documents should fail CI when routing metadata is missing?
8. How should preserved research source artifacts remain discoverable without entering ordinary coding context eagerly?

Those questions are specific to Ember's knowledge governance. OpenClaw supplies a useful mechanism, but not their answers.

## 12. Source map

### Current OpenClaw snapshot

- [`scripts/docs-list.js`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/docs-list.js): compact catalogue parser/renderer and `--headings` projection.
- [`test/scripts/docs-list.test.ts`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/test/scripts/docs-list.test.ts): focused behavior and edge-case tests.
- [`AGENTS.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/AGENTS.md): repository-level policy routing docs work through `docs:list`.
- [`docs/AGENTS.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/docs/AGENTS.md): docs authoring/publishing policy and transient docs-map rule.
- [`.github/codex/prompts/docs-agent.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/.github/codex/prompts/docs-agent.md): specialized agent workflow using `read_when` hints.
- [`.agents/skills/openclaw-refactor-docs/SKILL.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/.agents/skills/openclaw-refactor-docs/SKILL.md): authoring/refactor workflow that applies frontmatter conventions and runs discovery/checks.
- [`docs/docs_map.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/docs/docs_map.md): source stub explaining on-demand/public heading-map generation.
- [`scripts/package-docs-map.mjs`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/package-docs-map.mjs): temporary package-time materialization and restoration.
- [`.github/workflows/docs-sync-publish.yml`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/.github/workflows/docs-sync-publish.yml) and [`scripts/docs-sync-publish.mjs`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/docs-sync-publish.mjs): publishing boundary and reuse of generated docs structure.
- [`package.json`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/package.json): current command surface and `check:docs` composition.
- [`docs/reference/wizard.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/docs/reference/wizard.md) and [`scripts/README.md`](https://github.com/openclaw/openclaw/blob/f5eea3197c55c0ed0e609d182bd88a7f09ec55e9/scripts/README.md): representative frontmatter showing discovery and non-discovery fields.

### Historical evolution

- [`bc3a14cde2a6a8722a88edee30545de438abcbba`](https://github.com/openclaw/openclaw/commit/bc3a14cde2a6a8722a88edee30545de438abcbba): initial `docs:list` helper and bulk `summary`/`read_when` frontmatter adoption, 2025-12-09.
- [`5f21bf735ab32c9cf5e08370a26881e560bc8949`](https://github.com/openclaw/openclaw/commit/5f21bf735ab32c9cf5e08370a26881e560bc8949): move repository scripts, including `docs:list`, to Node, 2026-01-18.
- [`385f1dee165f0a9557e3dd67e83b7b1bc48b06e2`](https://github.com/openclaw/openclaw/commit/385f1dee165f0a9557e3dd67e83b7b1bc48b06e2): generate the expanded docs map at publish/package time instead of keeping the mirror as source, 2026-08-01.
- [`d2515856e0cce3833e0a3f2b4d62dca515e5bd65`](https://github.com/openclaw/openclaw/commit/d2515856e0cce3833e0a3f2b4d62dca515e5bd65): frontmatter terminator robustness, 2026-08-28.

### Separate deeper retrieval system

- [`openclaw/ask-molty` AGENTS.md](https://github.com/openclaw/ask-molty/blob/fe1e882f5d920e4b44b0eb4e96fc8c80f8cc1a10/AGENTS.md): retrieval architecture, source classes, evidence roles, and model tools.
- [`openclaw/ask-molty` README](https://github.com/openclaw/ask-molty/blob/fe1e882f5d920e4b44b0eb4e96fc8c80f8cc1a10/README.md): exported workspace shape and deterministic candidate retrieval.

## Takeaway

The part of OpenClaw worth borrowing is surprisingly small and elegant.

Its strength does not come from clever search. It comes from a disciplined separation of concerns:

- authors keep durable knowledge in normal documents;
- lightweight metadata exposes intent;
- deterministic tooling produces cheap projections;
- agent instructions turn those projections into a reading policy;
- full documents remain canonical;
- additional structure or retrieval is introduced only as a deeper layer.

For Ember, the important extension is not more retrieval machinery. It is preserving Ember's stronger distinction between **relevance** and **authority** while adopting the same progressive-disclosure shape.
