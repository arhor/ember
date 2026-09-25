---
summary: "Accepted implementation decision replacing npm with pnpm as Ember's package manager while leaving ADR 0006's language, runtime, and toolchain-minimalism decisions unchanged."
read_when:
  - "Changing Ember's package manager, lockfile, or dependency-installation tooling"
  - "Reviewing which package manager a script, CI step, runbook, or contributor command should invoke"
role: decision
discovery_status: current
---

# ADR 0009: Adopt pnpm as Ember's Package Manager

- **Status:** Accepted
- **Date:** 2026-09-25
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
