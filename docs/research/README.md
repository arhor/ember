---
summary: "Research governance and navigation for Ember's canonical concern notes, evidence maps, preserved source artifacts, reviewed systems, and cross-cutting synthesis."
read_when:
  - "Adding or reviewing Ember research artifacts and needing the canonical, evidence, and source hierarchy"
  - "Tracing which research note, evidence map, or preserved source artifact owns a research concern"
role: guide
discovery_status: current
---

# Architecture Research

This directory records source-level reconnaissance of existing agent systems before Ember commits to its own implementation architecture.

The goal is not to rank projects or copy one wholesale. Each note asks the same questions:

1. What problem does the project solve?
2. How does its architecture approach that problem?
3. Which semantic boundaries appear to work well?
4. Which parts are consequences of product breadth rather than agent quality?
5. What ideas should Ember borrow?
6. What should Ember deliberately explore differently?

## Research vocabulary

When describing an **existing project**, use its real implementation vocabulary when that helps explain how it works. Names such as `AgentRunner`, concrete tools, files, stores, or runtime abstractions are observations about that project's implementation.

When translating those observations into **ideas for Ember**, return to natural language and semantic descriptions. Prefer statements such as "the agent remembers a durable fact", "the user corrected an earlier belief", or "specialist work was delegated and later returned" over proposed class names, event names, schemas, package names, or storage shapes.

During this phase, implementation-shaped vocabulary can accidentally turn a research hypothesis into an unexamined design commitment. Ember's representation should emerge from the semantics, not lead them.

Concern-driven notes:

- [Continuity and Identity Semantics](continuity-and-identity.md) — what it means for Ember to remain the same continuing agent across time, restarts, interfaces, and model changes.
  - [Portable evidence map and references](continuity-and-identity-references.md) — maps the note's evidence-labelled conclusions to durable paper, benchmark, DOI, project, and local-research links that remain usable outside the original Deep Research session.
- [Memory and Remembering Semantics](memory-and-remembering.md) — what it means for Ember to remember, how experience becomes durable meaning, and how memory remains attributable, scoped, correctable, supersedable, forgettable, and useful over time.
  - [Portable evidence map and references](memory-and-remembering-references.md) — maps the memory note's evidence-labelled conclusions to durable papers, benchmarks, DOI and project links, and local research that remain usable outside the original Deep Research session.
- [Context Selection and Cognitive Framing Semantics](context-selection-and-cognitive-framing.md) — what should shape Ember's point of view for a particular act of cognition, including selection, exclusion, relevance, ordering, reconstruction, compaction, graceful degradation, and delegated least-context boundaries.
  - [Portable evidence map and references](context-selection-and-cognitive-framing-references.md) — maps the context note's evidence-labelled conclusions to durable long-context, retrieval, compaction, privacy, security, and adjacent research sources.
- [Capabilities and Delegation Semantics](capabilities-and-delegation.md) — when Ember acts directly, uses a bounded capability, or delegates material discretion to another runtime, and what responsibility, provenance, context, continuity, and result-handling obligations survive that boundary.
  - [Portable evidence map and references](capabilities-and-delegation-references.md) — maps the delegation note's evidence-labelled conclusions to current runtime/protocol contracts, 2025–2026 multi-agent research, failure analyses, security/privacy evidence, and inherited Ember research.
- [Action, Authority, and Permission Semantics](action-authority-and-permission.md) — when Ember is legitimately entitled to decide and act without fresh authorization, including standing authority, material change, disclosure, third-party effects, confirmation fatigue, and delegated authority.
  - [Portable evidence map and references](action-authority-and-permission-references.md) — maps the authority note's security invariants and evidence-labelled conclusions to durable security, HCI, human-factors, privacy, multi-principal, and current runtime sources.
- [Endogenous Agency and Self-Initiated Behavior Semantics](endogenous-agency-and-self-initiated-behavior.md) — what makes attention or behavior meaningfully endogenous, how continuing concerns can motivate later cognition without equating wake-up mechanisms with motivation, and how initiative remains bounded by currentness, resources, attention, and authority.
  - [Portable evidence map and references](endogenous-agency-and-self-initiated-behavior-references.md) — maps the endogenous-agency note to durable cognitive-science, intrinsic-motivation, HCI, proactive-agent, benchmark, and inherited Ember sources.
- [Operational Model, Sessions, and Surfaces Semantics](operational-model-sessions-and-surfaces.md) — what remains semantically true across temporary sessions, multiple surfaces, concurrent interactions, long-running work, duplicate delivery, retries, downtime, recovery, and partial failure around one continuing Ember.
  - [Portable evidence map and references](operational-model-sessions-and-surfaces-references.md) — maps the operational note to durable runtime, distributed-systems, durable-work, HCI, cross-device, shared-device, and inherited Ember sources.

Source material:

- [Continuity and Identity Deep Research](source-material/continuity-and-identity-deep-research.md) — preserved original Deep Research export behind the continuity synthesis; non-canonical and retains ChatGPT-local citation markers for provenance.
- [Memory and Remembering Deep Research](source-material/memory-and-remembering-deep-research.md) — preserved original Deep Research export behind the memory synthesis; non-canonical and retains ChatGPT-local citation markers from the original Markdown export for provenance.
- [Context Selection and Cognitive Framing Deep Research](source-material/context-selection-and-cognitive-framing-deep-research.md) — preserved source research behind the context synthesis; non-canonical and retains the report's evidence ledger while omitting UI-only research metadata.
- [Capabilities and Delegation Deep Research](source-material/capabilities-and-delegation-deep-research.md) — preserved source research behind the capabilities and delegation synthesis; non-canonical and retains the substantive report and evidence ledger while omitting UI-only research metadata.
- [Action, Authority, and Permission Deep Research](source-material/action-authority-and-permission-deep-research.md) — preserved source research behind the authority synthesis; non-canonical and retains the substantive report and evidence ledger while omitting UI-only research metadata.
- [Endogenous Agency and Self-Initiated Behavior Deep Research](source-material/endogenous-agency-and-self-initiated-behavior-deep-research.md) — preserved source report behind issue #2; non-canonical and retains the original session-local citation markers while the portable evidence map reconstructs durable references for the synthesis.
- [Operational Model, Sessions, and Surfaces Deep Research](source-material/operational-model-sessions-and-surfaces-deep-research.md) — preserved corrected research report behind issue #8; non-canonical and records the source investigation while the portable evidence map supplies durable references.

Reviewed systems:

- [NanoBot](nanobot.md) — compact execution core and layered memory consolidation.
- [Hermes](hermes.md) — mature agent runtime patterns, prompt tiers, searchable sessions, and isolated delegation.
- [OpenClaw](openclaw.md) — runtime ownership, specialist harnesses, provenance-aware memory, and gated promotion.
- [Letta](letta.md) — persisted agent state and independently attachable memory/capability resources.

The pre-research working hypothesis lives in [Initial Architecture Model](../architecture/initial-model.md). The completed cross-cutting synthesis and current design direction lives in [Cross-Cutting Research Synthesis and Ember Design Directions](../architecture/design-directions.md).

## Architecture handoff

The completed research now constrains architecture through:

- [Ember Architecture](../architecture/README.md) — index of current and historical
  architecture material;
- [Semantic Architecture Decisions](../architecture/decisions/README.md) — the
  first accepted, representation-neutral decisions derived from the synthesis;
- [Ember Architecture Acceptance Scenarios](../architecture/acceptance-scenarios.md)
  — reusable cross-cutting fixtures for evaluating later architecture choices.
