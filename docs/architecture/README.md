---
summary: "Navigation for Ember's current semantic architecture, accepted implementation decisions, acceptance scenarios, design evidence, and superseded architecture history."
read_when:
  - "Finding the current architecture sources that govern or evaluate an Ember implementation change"
  - "Tracing how project foundations, semantic decisions, runtime decisions, acceptance scenarios, and research relate"
role: guide
discovery_status: current
---

# Ember Architecture

Ember's canonical architecture is defined first by representation-neutral semantic
constraints. Implementation decisions may select concrete representations only
beneath that baseline.

The first continuity slice is implemented as native ESM TypeScript on Node.js 26.
ADR 0006 governs that representation, while the accepted semantic ADRs and
acceptance scenarios continue to govern its meaning.

Project foundations:

- [Vision](../vision.md) defines the purpose and continuity goal.
- [Design Principles](../principles.md) constrain how architecture may pursue it.

Current architecture material:

- [Cross-Cutting Research Synthesis and Ember Design Directions](design-directions.md)
  is the canonical synthesis of the completed concern-driven research programme.
- [Ember Architecture Decisions](decisions/README.md) records the accepted
  representation-neutral semantic baseline and subordinate implementation
  decisions.
- [ADR 0006: Adopt TypeScript on Node.js 26 as Ember's Implementation Runtime](decisions/0006-adopt-typescript-on-nodejs-26.md)
  records the selected language, runtime line, source/type-checking model, minimal
  toolchain, dependency policy, rejected alternatives, and revisit triggers.
- [Ember Architecture Acceptance Scenarios](acceptance-scenarios.md) turn the
  cross-cutting scenarios into a representation-neutral architecture oracle that
  implementation choices must preserve.
- [Minimal Continuity Vertical Slice](minimal-continuity-slice.md) specifies the
  deliberately narrow first executable design derived from the accepted ADRs and
  minimal acceptance subset.
- [Minimal Continuity Slice Runbook](minimal-continuity-runbook.md) records the
  validation, foreground CLI, restart probe, lock recovery, and optional
  live-provider smoke procedure for that executable experiment.
- [TypeScript Runtime Evaluation](typescript-runtime-evaluation.md) records issue
  #38's evidence comparing the Node.js 24 JavaScript control with TypeScript on
  Node.js 26 and Deno 2.9. It remains evidence for ADR 0006 rather than a source of
  semantic authority.
- [TypeScript Runtime Adoption Validation](typescript-adoption-validation.md)
  records issue #40's selected-stack confidence result, post-migration comparison,
  and runtime capability boundary.
- [Architecture Research](../research/README.md) contains the canonical concern
  notes and their evidence maps.

Historical material:

- [Initial Architecture Model](initial-model.md) is the pre-synthesis hypothesis.
  It remains useful as research history but does not override the synthesis or
  accepted decisions.

Implementation architecture must preserve the semantic baseline. ADR 0006 settles
the current implementation language/runtime baseline, but it does not settle
persistence technology, daemon/process topology, delegation protocols, memory
retrieval architecture, or package boundaries beyond the minimal runtime/toolchain
policy it explicitly records.
