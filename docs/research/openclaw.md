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

OpenClaw separates four concepts that are easy to collapse accidentally:

```text
provider       how a model is authenticated/discovered
model          which model is selected
agent runtime  which loop executes the prepared turn
channel        where input/output travels
```

This becomes especially important when Codex is involved.

The OpenClaw runtime can own the loop itself, or a specialist runtime such as Codex can own the model/tool loop while OpenClaw projects context into it and mirrors the result back into its own surrounding state.

The key architectural question is therefore not merely "which model?" but:

> Who owns this execution loop and its canonical thread/tool state?

OpenClaw makes that ownership part of the runtime contract.

## Reusable core vs product wiring

Current OpenClaw separates:

- reusable agent-core contracts and loop primitives;
- OpenClaw-specific runtime wiring;
- session/resource loading;
- tools and policy;
- hooks and context pruning;
- model/provider transport;
- harness registry and runtime selection.

This is a useful response to a codebase that has grown large: execution semantics and product integration need explicit boundaries.

## Memory architecture

OpenClaw's current memory model is considerably more sophisticated than a flat vector store or one `MEMORY.md`.

It uses tiers:

```text
instructions   human-owned, always loaded
curated core   MEMORY.md / USER.md
 episodic      daily notes + transcripts, searched on demand
prospective    standing intents + scheduled work
review         DREAMS.md / consolidation reports
```

The most important boundary is curated vs episodic memory. Large episodic evidence does not enter the prompt automatically. It must pass a promotion process before becoming curated core memory.

### Provenance

OpenClaw records structured origin metadata such as:

- owner-authored;
- agent-derived;
- untrusted/external;
- system/scaffolding;
- session kind;
- observed time;
- supersession lineage.

A notable rule is that provenance is enforced at the **write path**. Untrusted or system-derived content is structurally ineligible for automatic promotion into curated memory rather than merely being assigned a lower model score.

The system also tries to prevent recall loops: information injected from memory is marked so that repeated recall does not get re-extracted as a new memory.

### Dreaming and promotion

OpenClaw moves expensive curation away from the interactive reply path.

The rough flow is:

```text
interactive evidence
        ↓
episodic tier + provenance
        ↓
deterministic eligibility/ranking
        ↓
bounded model consolidation
        ↓
structural validation
        ↓
MEMORY.md / USER.md
```

This is an excellent example of deterministic code surrounding model judgment.

### Two-lane recall

OpenClaw also separates cheap and expensive recall:

1. deterministic/bootstrap/search/trigger mechanisms with no additional model call;
2. a deeper recall agent only when the user appears to be asking about the past and cheap retrieval did not produce a strong result.

This is a strong cost/quality pattern for Ember.

## What works well?

### 1. Runtime ownership is explicit

This is the clearest architectural lesson for Ember's future Codex/ACP integration.

If Codex owns the coding loop, Ember should not pretend it owns every native shell, edit, compaction, or canonical-thread behavior inside that run.

Instead Ember should define an adapter contract around preparation, context projection, observation, cancellation, result interpretation, and state mirroring where supported.

### 2. Provider/model/runtime are orthogonal

Ember should avoid encoding "Codex" as a fake model provider or treating an ACP transport as identity.

A model choice and an execution-runtime choice are different decisions.

### 3. Memory provenance is structural

This is one of the strongest patterns found in the research.

Ember wants a personal and evolving memory system, which makes accidental poisoning more serious, not less. Origin and trust should therefore be persistent fields rather than prose caveats.

### 4. Promotion is gated

The `deterministic eligibility -> bounded model judgment -> validation` pattern is highly reusable.

### 5. Episodic and prospective state are distinct

OpenClaw's standing intents point toward something Ember needs: future-facing state should not be forced into the same abstraction as past-facing memory.

An unfinished intention is not simply a fact about history.

### 6. Memory failure does not block replies

Optional cognition should degrade gracefully.

## What may scale poorly for Ember?

### 1. Product breadth dominates the repository

OpenClaw solves many problems Ember intentionally does not need to own initially: many channels, plugins, UI surfaces, compatibility layers, deployment concerns, and legacy migration.

Its size is therefore a warning against copying implementation structure wholesale.

### 2. Memory has accumulated substantial policy complexity

The current system is thoughtful, but it demonstrates how quickly long-term memory becomes its own platform: tiers, ranking, triggers, dreaming phases, provenance, project scope, promotion, deletion semantics, and recall agents.

Ember should adopt the invariants before adopting the machinery.

### 3. Plain files remain an important persistence surface

Inspectability is excellent, but Ember may benefit from a typed canonical store with human-readable projections rather than encoding every semantic distinction into Markdown comments and SQLite indexes around those files.

## What should Ember borrow?

- explicit separation of provider, model, and execution runtime;
- a runtime ownership/compatibility contract for specialist agents;
- curated vs episodic vs prospective state distinctions;
- structural provenance and trust classification;
- recall-loop prevention;
- deterministic gates around model-driven memory promotion;
- cheap first-lane retrieval and expensive escalation only when needed;
- background consolidation that cannot block interactive replies;
- explicit supersession instead of merely accumulating contradictory facts.

## What should Ember deliberately do differently?

- keep the number of runtime types and compatibility paths very small initially;
- treat Codex/ACP delegation as optional capabilities around a compact core;
- start with fewer memory mechanisms and add them only when measurements justify them;
- model identity and relationships explicitly rather than treating `USER.md`/`MEMORY.md` as sufficient representations;
- develop an attention/initiative model that is broader than cron and standing intents;
- prefer a typed domain model with inspectable projections if that gives us cleaner provenance and evolution semantics.

## Ember takeaway

OpenClaw is the strongest reference for two areas:

1. **external agent-runtime ownership**;
2. **memory safety and provenance**.

Its implementation breadth is not the template. Its hard-earned boundaries are.