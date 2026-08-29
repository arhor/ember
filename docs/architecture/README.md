# Ember Architecture

Ember's canonical architecture is defined by semantic constraints rather than a
settled runtime or persistence design. The first continuity slice now adds one
provisional executable representation for a deliberately narrow experiment.

Project foundations:

- [Vision](../vision.md) defines the purpose and continuity goal.
- [Design Principles](../principles.md) constrain how architecture may pursue it.

Current architecture material:

- [Cross-Cutting Research Synthesis and Ember Design Directions](design-directions.md)
  is the canonical synthesis of the completed concern-driven research programme.
- [Semantic Architecture Decisions](decisions/README.md) records the first
  accepted, representation-neutral constraints derived from that synthesis.
- [Ember Architecture Acceptance Scenarios](acceptance-scenarios.md) turn the
  cross-cutting scenarios into a representation-neutral architecture oracle.
- [Minimal Continuity Vertical Slice](minimal-continuity-slice.md) specifies the
  deliberately narrow first executable design derived from the accepted ADRs and
  minimal acceptance subset.
- [Architecture Research](../research/README.md) contains the canonical concern
  notes and their evidence maps.

Historical material:

- [Initial Architecture Model](initial-model.md) is the pre-synthesis hypothesis.
  It remains useful as research history but does not override the synthesis or
  accepted decisions.

Implementation architecture should follow these semantic constraints. The
continuity slice makes provisional concrete choices only for its three-fixture
experiment; it does not settle Ember's long-term language, persistence, process
topology, protocols, or package boundaries.
