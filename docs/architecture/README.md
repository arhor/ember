---
summary: "Navigation for Ember's current semantic architecture, accepted decisions, acceptance scenarios, design experiments, and superseded architecture history."
read_when:
  - "Finding the current architecture sources that govern or evaluate an Ember implementation change"
  - "Tracing how project foundations, semantic decisions, acceptance scenarios, and research relate"
role: guide
discovery_status: current
---

# Ember Architecture

Ember's architecture is currently defined by semantic constraints rather than a
chosen runtime or persistence design.

Project foundations:

- [Vision](../vision.md) defines the purpose and continuity goal.
- [Design Principles](../principles.md) constrain how architecture may pursue it.

Current architecture material:

- [Cross-Cutting Research Synthesis and Ember Design Directions](design-directions.md)
  is the canonical synthesis of the completed concern-driven research programme.
- [Semantic Architecture Decisions](decisions/README.md) records the first
  accepted, representation-neutral constraints derived from that synthesis.
- [Issue #21](https://github.com/arhor/ember/issues/21) tracks the forthcoming
  Ember Architecture Acceptance Scenarios that turn cross-cutting scenarios into
  reusable architecture acceptance fixtures.
- [Architecture Research](../research/README.md) contains the canonical concern
  notes and their evidence maps.

Historical material:

- [Initial Architecture Model](initial-model.md) is the pre-synthesis hypothesis.
  It remains useful as research history but does not override the synthesis or
  accepted decisions.

Implementation architecture should follow these semantic constraints. Language,
persistence, process topology, protocols, package boundaries, and other concrete
representations remain open until evidence or a later decision justifies them.
