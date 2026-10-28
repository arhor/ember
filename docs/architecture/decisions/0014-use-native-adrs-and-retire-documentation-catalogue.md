---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0014: Use native ADRs and retire the documentation catalogue

## Context and Problem Statement

Ember previously required routing metadata on documentation and used a custom
catalogue to expose current, historical, and evidence documents. ADR 0010 adopted
an adapted ADR skill while preserving that catalogue. The maintainer subsequently
chose the original ADR skill unchanged and explicitly approved retiring the
catalogue on 2026-10-27. Maintaining a parallel metadata contract adds authoring
and tooling work without being needed for native Architecture Decision Records (ADRs).

## Decision

Use `.agents/skills/adr-skill/` unchanged, its original templates, native lifecycle
metadata, required Implementation Plan, and checkbox Verification sections.
Retire `ember-documentation`, custom catalogue metadata, parser, tests, package
commands, and CI projection checks. Discover repository knowledge through
[documentation navigation](../../README.md), directory indexes, the
[ADR index](README.md), and ordinary repository search. Read relevant sources
fully and use accepted ADRs as governing decisions; proposed records are proposals.

Preserve document paths, substantive knowledge, source attribution, dates, scenario
IDs, and historical/supersession distinctions. Move non-ADR historical labels and
replacement links into prose and indexes. Retain guides, scenarios, research, and
evidence in their own roles. Only real architectural decisions become ADRs during
the separately reviewed migration batches. Catalogue entries do not each become ADRs.

This replaces the policy in [deprecated ADR 0010](0010-adopt-adr-centered-documentation.md).
The three pilot ADRs remain proposed. Runtime behavior, packages under active
maintainer development, the lockfile, and TypeScript configuration are out of scope.

## Consequences

- Authors maintain ordinary indexes and links when adding or moving documents;
  no routing schema or custom discovery runtime needs maintenance.
- Automated routing/schema and supersession-chain checks disappear. Reviewers
  must check source lifecycle, index coverage, and local links explicitly.
- Historical discovery contracts remain available with clear retirement notices;
  their old commands and metadata requirements no longer govern authoring.
- Domain conversion and pilot acceptance remain tracked, separately reviewed work
  in the [migration plan](../../research/archive/adr-migration-plan.md).

## Implementation Plan

- **Affected paths**: `AGENTS.md`, `docs/**/*.md`, the old
  `.agents/skills/ember-documentation/` entry point, `scripts/docs-discovery.ts`,
  `tests/docs-discovery*.test.ts`, root `package.json`, and `.github/workflows/ci.yml`.
- **Dependencies**: no packages added, removed, or updated; remove obsolete script wiring only.
- **Patterns to follow**: preserve existing documentation paths and substantive
  bodies; use native ADR metadata and ordinary Markdown indexes. Clearly mark
  archived documents and link superseding sources.
- **Patterns to avoid**: modifying the original ADR skill, converting evidence or
  runbooks into invented decisions, approving proposed pilots by implication,
  or editing `packages/`, `pnpm-lock.yaml`, or `tsconfig.json`.
- **Migration**: remove routing frontmatter while carrying historical state into
  prose; add directory navigation; archive discovery contracts; remove catalogue
  tooling and CI references; route root instructions to the original skill.

### Verification

- [x] Every documentation file is reachable through directory indexes.
- [x] Native ADR metadata remains intact; old routing frontmatter is absent.
- [x] Historical/superseded documents retain explicit labels and replacement links.
- [x] Root checks and CI no longer invoke the deleted catalogue tooling.
- [x] Original ADR skill and protected package work remain byte-for-byte unchanged.
- [x] Local documentation links, formatting, and strict lint checks pass.

## Alternatives Considered

- Keep a separate catalogue with a native ADR projection: preserves automated
  filtering but retains a second metadata/tooling maintenance contract. The
  maintainer explicitly chose retirement.
- Adapt the ADR skill to Ember metadata: previously adopted, then deprecated
  because the maintainer prefers using the original skill unchanged.

## More Information

Acceptance records the maintainer's explicit direction, not acceptance of the pilot
or domain decisions. Reconsider automated discovery if index maintenance or missed
knowledge becomes a demonstrated problem; do not silently restore the old contract.

Implementation verified on 2026-10-27: complete directory-index coverage, 1,259
local link targets resolved, routing metadata and active catalogue wiring removed,
11 original skill files unchanged, and 1,412 protected files unchanged. Scoped
formatting, strict lint, and diff whitespace checks passed. These checks verify
the retirement; they do not accept proposed pilots or complete domain conversion.

## Legacy document removal — 2026-10-28

Following the completed migration, the maintainer approved removing
`docs/documentation-discovery.md`, `docs/documentation-discovery-guide.md` and
`docs/documentation-discovery-evaluation.md` from the active tree. They described the
retired catalogue's schema, commands and evaluation, not the current ADR navigation.
Their original tracked versions remain in Git history; for example, use
`git log --all -- docs/documentation-discovery.md` to locate the historical contract.
This dated amendment supersedes the earlier retention/path-preservation choice only
for these three files. It does not remove research about other systems or the ADR history.

Reusable source-authority, conflict-resolution, search-fallback and ownership rules
are preserved in [documentation navigation](../../README.md#reading-authority-and-resolving-conflicts).
Indexes and historical traceability references now point to this cleanup record instead
of deleted files. The 119-source migration ledger retains the original filenames with
explicit removed/Git-history dispositions; earlier corpus counts and retention notes
remain dated migration history. No runtime, package or original-skill change is involved.

## Documentation organization — 2026-10-28

The maintainer approved four purpose-based top-level folders: `docs/architecture/decisions/` for decisions,
`docs/architecture/` for current explanations/contracts/scenarios, `docs/guides/` for
procedures, and `docs/research/` for syntheses, evidence maps and dated evaluations.
Selected superseded designs, original reports and the completed migration tracker live
under `docs/research/archive/`. Vision and principles remain at the documentation root.

Six redundant source documents were consolidated into their accepted ADRs: streaming
(0011), memory-proposal semantics (0019), dormant concerns (0030), interruption policy
(0032), silence lifecycle (0029), and specialist authority/context (0027). Their constraints
remain in those records; original source versions remain in Git history. Detailed current
implementation references, operational procedures, evidence and unresolved questions are
retained. This supersedes earlier path-preservation choices for those moves/removals.
Repository links and indexes follow the new responsibilities, not the historical locations.

The open contact-decision/no_contact task is recorded directly in ADR 0033. Accepted
semantics are not a claim that this missing runtime behavior is implemented. No package,
lockfile, TypeScript configuration or original ADR skill is changed by the reorganization.

Organization verification: 55 documents moved with original section identities retained;
six redundant decision sources consolidated, with unique observer/request representation
details preserved in ADR 0011 and the current specialist reference. All 38 ADR decision
bodies, native lifecycle/date metadata and all 40 scenario IDs are unchanged. Complete
indexes cover the four main folders and research archive; 1,831 local links/anchors
resolve. Scoped formatting, strict lint and whitespace checks pass. Protected package/
configuration and original-skill bytes are unchanged. This was documentation-only;
the existing runtime test suite was not rerun for path/index changes.

## Repository ADR convention — 2026-10-28

The maintainer explicitly requested `docs/architecture/decisions/` and a local skill
that enforces the existing numeric prefix convention. This supersedes the earlier
unchanged-skill policy and temporary `docs/adr/` location. Existing record numbers,
statuses, dates and decision bodies remain intact; links/indexes follow the move.

The skill's instructions, conventions, index template and creation/bootstrap helpers
now default to the canonical folder and `NNNN-title-with-dashes.md`. Choose one more
than the largest existing numeric prefix across every lifecycle status, starting at
0001 and padding to at least four digits; never reuse a gap. Keep numbered titles and
numeric index order. A skill-local CommonJS package boundary lets its existing Node
helpers execute inside Ember's ESM repository without changing root package settings.
The native ADR metadata, templates' required sections and decision workflow remain.
No application package, lockfile or TypeScript configuration is changed.

Convention verification: isolated ESM-host fixtures exercised fresh simple/MADR creation,
0001 bootstrap then 0002 creation, maximum-index allocation across gaps/deprecated
records, ignoring dated filenames, repeated titles, duplicate-number/invalid-strategy
rejection, preservation of existing bootstrap records, status changes and index updates.
All passed; no synthetic ADR was created in Ember. All 38 real IDs/dates/statuses and
protected package/configuration bytes are retained. Local links/anchors, scoped
formatting, helper lint and strict repository lint pass. The skill-creator Python
quick-validator could not run because PyYAML is unavailable; no dependency was installed.
