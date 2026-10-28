---
status: "accepted"
date: "2026-09-25"
decision-makers: "Repository maintainer; original decision attribution not recorded"
---

# ADR 0009: Adopt pnpm as Ember's Package Manager

- **Decision class:** Implementation/toolchain, representation-level
- **Semantic baseline:** ADRs [0001](0001-continuity-belongs-to-ember.md) through [0005](0005-distinguish-operational-continuity.md)
- **Implementation baseline:** [ADR 0006](0006-adopt-typescript-on-nodejs-26.md)

## Context and decision boundary

ADR 0006 selected npm as part of a deliberately minimal TypeScript-on-Node.js
toolchain, choosing it as the smaller migration distance from Ember's original
zero-dependency slice rather than evaluating package managers on their own merits.

This decision revisits only the "Package manager" row of ADR 0006's minimal
toolchain policy table. It does not reopen the language, runtime, module format,
build, lint, format, coverage, or dependency-policy decisions in that ADR, and it
does not touch the semantic baseline in ADRs 0001-0005.

## Decision

Ember adopts pnpm as its package manager.

- The lockfile of record is `pnpm-lock.yaml`; `package-lock.json` is removed.
- `package.json` declares `"packageManager": "pnpm@<pinned version>"` so the pinned
  version is reproducible rather than floating to whatever pnpm happens to be on a
  contributor's or CI runner's `PATH`.
- CI and contributor commands use `pnpm install`, `pnpm check`, `pnpm test`, and
  the equivalent `pnpm <script>` form for other repository-native scripts, in
  place of the corresponding `npm ci` / `npm run <script>` forms.
- Repository scripts that previously shelled out to `npm run <script>` from within
  another script invoke `pnpm <script>` instead, so the toolchain does not depend
  on two package managers being installed simultaneously.

Everything ADR 0006 decided independently of the package-manager choice remains in
effect: Node.js 26 as the runtime, direct TypeScript execution with no build step,
no mandatory linter/formatter/coverage tool beyond what ADR 0006 already accepted,
and the same dependency-addition discipline. pnpm still resolves against the npm
registry; "npm package" continues to mean a package published to that registry,
independent of which client installs it.

## Rationale

pnpm's content-addressable store and strict, non-flat `node_modules` linking
catch phantom dependencies (a module resolving a package it never declared
because npm's flat `node_modules` happened to hoist it) earlier than npm does,
which matters for a project that treats explicit dependency ownership as part of
its architecture discipline (see [Source Layout and Surface Placement](../source-layout.md)
and its enforced-dependency-rules script). It also meaningfully reduces installed
disk usage and install time across the runtime and CI checkout, without requiring
a build step, bundler, or other toolchain addition ADR 0006 deliberately declined.

## Consequences

- ADR 0006's "Package manager" row and its illustrative `npm ci` / `npm run
check` / `npm test` command block are superseded by this ADR; the rest of ADR
  0006 is unaffected and remains governing.
- Historical documents that recorded npm commands actually run at the time (dated
  evaluation and validation reports under `docs/architecture/`) are not rewritten
  by this ADR; they remain accurate records of what was executed when they were
  written, not current operating instructions.
- Contributor-facing instructions, runbooks, and repository scripts are updated to
  invoke pnpm as part of adopting this decision.

## Native-format implementation guidance — 2026-10-27

This additive reconciliation preserves the original accepted decision, date, body
and existing section anchors. It records concrete ongoing implementation guidance,
not a new acceptance event or an instruction to repeat completed feature work.

## Context and Problem Statement

The package-manager decision replaces only ADR 0006’s npm choice so dependency ownership and reproducible installs use pnpm without reopening runtime semantics. See the [original context](#context-and-decision-boundary) for rationale and evidence.

## Implementation Plan

- **Affected paths:** [package.json](../../../package.json); [pnpm-lock.yaml](../../../pnpm-lock.yaml); [pnpm-workspace.yaml](../../../pnpm-workspace.yaml); [.github/workflows/ci.yml](../../../.github/workflows/ci.yml).
- **Dependencies and configuration:** no new package, schema, configuration or runtime
  change is introduced by this documentation reconciliation. Original ADRs and current
  manifests/instructions retain their separate governing scopes.
- **Patterns to follow:** Use the manifest-pinned package manager and workspace dependency declarations; keep dated npm experiment commands historical and current contributor scripts in pnpm form. Preserve the partial supersession scope rather than marking all of ADR 0006 superseded.
- **Patterns to avoid:** interpreting these implementation references as a new
  universal representation, silently resolving open semantic questions, or modifying
  historical evidence to make implementation appear complete.
- **Migration:** keep original dates/status/decision meaning and existing headings;
  retain research/evaluation provenance and link current subordinate decisions from
  the [ADR index](README.md). No production changes are required for this migration.

### Verification

- [x] Original accepted body, date, status and source/section traceability are preserved.
- [x] Current root manifest declares a pinned pnpm version, pnpm lockfile exists,
      and CI uses pnpm; no package-manager or dependency file is changed by reconciliation.
- [x] Verification remains bounded by the stated fixtures and unresolved questions;
      acceptance is not misreported as complete proof of every semantic requirement.

### Native-format reconciliation verification — 2026-10-27

The original accepted body, date, lifecycle and section identities were preserved.
The final deterministic run passed all 678 tests, including the focused traces above;
this does not establish universal proof of open semantic or deployment questions.
Metadata, required native sections, source/index traceability, local links/anchors,
and protected-package/original-skill integrity checks passed. No package or runtime
change was introduced. Root static checking still has the two previously recorded
AI finish-reason errors; they are unrelated to this documentation reconciliation.
