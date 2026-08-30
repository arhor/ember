---
summary: "Reference investigation of OpenClaw's runtime ownership boundaries, curated-versus-episodic memory, provenance-gated promotion, and specialist-runtime integration."
read_when:
  - "Comparing Ember with OpenClaw when designing specialist runtime ownership or memory promotion"
  - "Investigating curated versus episodic memory, provenance gates, or cheap-versus-deep recall patterns"
role: reference
discovery_status: current
---

# OpenClaw Architecture Notes

Reviewed against OpenClaw commit `19be0f6dc0942e56ec52f1ad9871511f37f404c9`.

Sources:

- [Agent runtime architecture](https://github.com/openclaw/openclaw/blob/19be0f6dc0942e56ec52f1ad9871511f37f404c9/docs/agent-runtime-architecture.md)
- [Agent runtimes](https://github.com/openclaw/openclaw/blob/19be0f6dc0942e56ec52f1ad9871511f37f404c9/docs/concepts/agent-runtimes.md)
- [Memory architecture](https://github.com/openclaw/openclaw/blob/19be0f6dc0942e56ec52f1ad9871511f37f404c9/docs/concepts/memory-architecture.md)

## What problem does it solve?

OpenClaw is a broad long-running personal-agent platform. It combines a built-in agent runtime with external/native harnesses, many interfaces and plugins, persistent state, memory, background work, and specialist runtime integration.

For Ember, OpenClaw is most valuable where it has already had to define ownership boundaries between multiple execution runtimes and where its memory system has evolved beyond a simple prompt file.

## Agent runtime ownership

OpenClaw separates four implementation concepts that are easy to collapse accidentally:

```text
provider       how a model is authenticated/discovered
model          which model is selected
agent runtime  which loop executes the prepared turn
channel        where input/output travels
```

This becomes especially important when Codex is involved.

The OpenClaw runtime can own the loop itself, or a specialist runtime such as Codex can own the model/tool loop while OpenClaw projects context into it and mirrors the result back into its own surrounding state.

The semantic lesson for Ember is simple:

> When specialist work is delegated, be clear about which system actually owns the specialist conversation, tools, and execution state.

Ember should not pretend to control internals that in reality belong to Codex or another specialist system.

## Reusable core vs product wiring

Current OpenClaw separates reusable agent-loop concerns from OpenClaw-specific wiring, sessions, resources, tools, hooks, providers, and runtime selection.

This is a useful response to a codebase that has grown large: the behavior of the agent and the breadth of the surrounding product need explicit boundaries.

## Memory architecture

OpenClaw's current memory model is considerably more sophisticated than a flat vector store or one `MEMORY.md`.

It distinguishes several meanings:

- human-authored instructions;
- small curated information intended to remain readily available;
- larger episodic notes and transcripts that are searched only when needed;
- future-facing intentions and scheduled work;
- review material produced while consolidating memory.

The most important boundary is between curated and episodic memory. Large amounts of experience do not automatically become always-visible context. They must earn promotion into the small curated set.

### Provenance

OpenClaw records where remembered information came from and treats owner-provided, agent-derived, external/untrusted, and system-generated information differently.

A notable rule is that provenance affects whether information is even eligible for promotion. Untrusted external material cannot become trusted long-term personal memory merely because a model found it convincing.

The system also tries to prevent recall loops: something that was merely recalled from existing memory should not be rediscovered as a new memory simply because it appeared in the model's context again.

### Dreaming and promotion

OpenClaw moves expensive curation away from the immediate reply path.

Conceptually, experience accumulates first, candidates are considered under hard eligibility rules, a model helps interpret what is worth retaining, and the result is checked before it changes curated memory.

The transferable lesson is not the exact machinery. It is the separation between:

1. what happened;
2. what may be worth remembering;
3. what is allowed to become trusted long-term memory.

### Two-lane recall

OpenClaw also separates cheap and expensive recall.

Common or obvious retrieval can happen without another model call. A deeper recall process is used only when the user appears to be asking about the past and simpler retrieval did not find enough.

This cost/quality distinction is attractive for Ember without committing to any specific index or retrieval technology.

## What works well?

### Ownership of delegated execution is explicit

This is the clearest lesson for Ember's future Codex and ACP integration.

If Codex is doing the coding work, Ember should focus on preparing relevant context, asking for the work, observing progress and completion where possible, and understanding the result. It should not duplicate or fake ownership of Codex's native shell, editing, compaction, or thread behavior.

### Model choice and execution ownership are different questions

Choosing a model does not necessarily determine who runs the specialist workflow. That conceptual separation will likely matter for Ember even if the eventual implementation looks very different from OpenClaw.

### Memory origin affects trust

This is one of the strongest patterns found in the research.

A personal and evolving memory system is especially vulnerable to quietly turning external information into personal belief. Ember should preserve enough provenance to distinguish direct user knowledge, its own inference, and untrusted external material.

### Promotion is gated

Language-model judgment is useful for deciding meaning, but hard boundaries should determine what the model is even permitted to promote or change.

### Past-facing memory and future-facing intentions are different

An unfinished intention is not simply another fact about history. Ember should keep that semantic distinction even if both eventually share some storage mechanism.

### Memory failure does not block replies

Optional reflection and recall should improve continuity when available, not make ordinary conversation brittle.

## What may scale poorly for Ember?

### Product breadth dominates the repository

OpenClaw solves many problems Ember intentionally does not need to own initially: many channels, plugins, UI surfaces, compatibility layers, deployment concerns, and legacy migration.

Its size is therefore a warning against copying implementation structure wholesale.

### Memory has become a substantial platform of its own

The current system has accumulated tiers, ranking, triggers, dreaming phases, provenance, project scope, deletion semantics, and deeper recall behavior.

Ember should borrow the hard-earned semantic invariants before borrowing the machinery.

### Human-readable files carry a lot of semantic weight

OpenClaw's inspectability is excellent, but its exact combination of Markdown files, annotations, and indexes is one representation choice among many. Ember should not decide during research whether the same representation is right for its own identity and relationship goals.

## What should Ember borrow conceptually?

- distinguish model choice from ownership of a specialist execution workflow;
- respect the state owned by systems to which work is delegated;
- distinguish curated memory, larger episodic history, and future-facing intentions;
- preserve where remembered information came from and how trustworthy that origin is;
- prevent recalled information from recursively creating duplicate memory;
- put hard eligibility rules around model-driven long-term changes;
- try cheap recall before expensive recall;
- keep background consolidation optional for interactive conversation;
- allow newer information to replace or correct older beliefs rather than only accumulating both.

## What should Ember explore differently?

- keep specialist-runtime variety very small at first;
- treat Codex and other specialists as optional capabilities around a compact personal agent;
- begin with fewer memory mechanisms and add complexity only when evidence justifies it;
- investigate identity and relationships as meanings in their own right rather than assuming `USER.md` and `MEMORY.md` are sufficient;
- develop a richer account of attention and initiative than schedules and standing intentions alone;
- choose the eventual representation of continuity only after these semantics are clearer.

## Ember takeaway

OpenClaw is the strongest reference for two areas:

1. **respecting ownership when specialist systems execute work**;
2. **memory safety and provenance**.

Its implementation breadth is not the template. Its hard-earned boundaries are.