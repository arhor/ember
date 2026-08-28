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

Source material:

- [Continuity and Identity Deep Research](source-material/continuity-and-identity-deep-research.md) — preserved original Deep Research export behind the continuity synthesis; non-canonical and retains ChatGPT-local citation markers for provenance.
- [Memory and Remembering Deep Research](source-material/memory-and-remembering-deep-research.md) — preserved original Deep Research export behind the memory synthesis; non-canonical and retains ChatGPT-local citation markers for provenance.
- [Context Selection and Cognitive Framing Deep Research](source-material/context-selection-and-cognitive-framing-deep-research.md) — preserved source research behind the context synthesis; non-canonical and retains the report's evidence ledger while omitting UI-only research metadata.
- [Capabilities and Delegation Deep Research](source-material/capabilities-and-delegation-deep-research.md) — preserved source research behind the capabilities and delegation synthesis; non-canonical and retains the substantive report and evidence ledger while omitting UI-only research metadata.

Reviewed systems:

- [NanoBot](nanobot.md) — compact execution core and layered memory consolidation.
- [Hermes](hermes.md) — mature agent runtime patterns, prompt tiers, searchable sessions, and isolated delegation.
- [OpenClaw](openclaw.md) — runtime ownership, specialist harnesses, provenance-aware memory, and gated promotion.
- [Letta](letta.md) — persisted agent state and independently attachable memory/capability resources.

The current synthesis lives in [Initial Architecture Model](../architecture/initial-model.md).
