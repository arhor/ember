# Initial Architecture Model

> Status: research hypothesis, not an ADR.
>
> This document intentionally avoids committing to a programming language, database, wire protocol, or final package layout.

## Synthesis

The surveyed systems repeatedly converge on several useful boundaries:

| Concern | NanoBot | Hermes | OpenClaw | Letta | Ember direction |
|---|---|---|---|---|---|
| Inner execution loop | `AgentRunner` | `AIAgent` | reusable agent core / harness | agent runtime | keep a small explicit kernel |
| Turn/interface orchestration | `AgentLoop` | entry points around `AIAgent` | gateway/runtime facade | API/server | separate from cognition loop |
| Persistent identity | `SOUL.md` | `SOUL.md` | workspace state | persisted agent state / identities | first-class typed state |
| Active memory | durable Markdown | bounded `MEMORY.md` + `USER.md` | curated core | memory blocks | small budgeted projection |
| Large history | JSONL history | SQLite + FTS5 sessions | episodic notes/transcripts + index | archival memory | immutable/append-friendly evidence store |
| Memory consolidation | Dream | agent-managed bounded memory | gated dreaming | agent memory operations | bounded reflection + validation |
| Provenance | history/versioning | limited | first-class trust metadata | resource metadata | first-class evidence metadata |
| Delegation | subagents/tools | isolated child agents | native runtimes + ACP | multi-agent/tools | specialist runtime capability |
| Future-facing state | cron | cron | standing intents + cron | schedules | explicit intents/open threads |
| Initiative | jobs/events | gateway + cron | triggers/intents | schedules | dedicated attention policy |

The strongest composite hypothesis is:

> Ember should combine a NanoBot-sized execution spine with Letta-like persistent agent state, OpenClaw-like memory provenance, and Hermes-like prompt/context discipline.

That does **not** mean implementing all features from all four systems.

## Proposed conceptual layers

```text
┌──────────────────────────────────────────────────────────────┐
│ Interfaces                                                   │
│ CLI first; messaging / voice later                           │
└─────────────────────────────┬────────────────────────────────┘
                              │ input / output
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Interaction Runtime                                          │
│ sessions, turn lifecycle, cancellation, streaming, delivery │
└─────────────────────────────┬────────────────────────────────┘
                              │ prepared turn
                              ▼
┌──────────────────────────────────────────────────────────────┐
│ Agent Kernel                                                  │
│ perceive → assemble context → model → act → observe → finish │
└───────────────┬──────────────────────┬───────────────────────┘
                │                      │
                ▼                      ▼
┌──────────────────────────┐  ┌───────────────────────────────┐
│ Continuity               │  │ Capabilities                  │
│ identity                 │  │ local tools                   │
│ self model               │  │ MCP                           │
│ relationship model       │  │ delegated runtimes            │
│ memory                   │  │   Codex                       │
│ open threads / intents   │  │   ACP agents                  │
└──────────────┬───────────┘  └───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ Evidence / Event Layer                                       │
│ transcripts, observations, actions, state-change provenance │
└──────────────────────────────────────────────────────────────┘
```

The key rule is that **the model sees a projection of this architecture, not the architecture itself**.

## 1. Agent Kernel

The kernel should remain intentionally small.

Its conceptual responsibilities are:

```text
receive prepared input
      ↓
request context projection
      ↓
invoke model
      ↓
model requests capability?
   ├── yes → execute/delegate → observation → continue
   └── no  → final response
      ↓
commit turn outcome/events
```

It should not directly contain:

- provider-specific authentication;
- SQLite queries;
- Telegram formatting;
- Codex thread internals;
- memory ranking algorithms;
- project-specific skills;
- Home Assistant logic.

The kernel coordinates interfaces to those systems.

### Candidate invariant

We should consider a soft complexity budget for the kernel itself. The exact number is premature, but the intent is important: a developer should be able to read the core execution path in one sitting.

## 2. Persistent Agent State

Ember's canonical persistent state should be richer than one system prompt.

A candidate domain decomposition:

```text
AgentState
├── Identity
│   ├── core principles
│   ├── communication/personality traits
│   └── protected boundaries
│
├── SelfModel
│   ├── mutable preferences
│   ├── learned tendencies
│   └── current self-description
│
├── Relationships
│   └── RelationshipState
│       ├── person identity
│       ├── durable shared context
│       ├── interaction preferences
│       └── relationship-specific memories
│
├── Memory
│   ├── curated semantic memory
│   ├── episodic references
│   └── provenance
│
├── OpenThreads
│   ├── unresolved questions
│   ├── promises/follow-ups
│   └── active intentions
│
└── CapabilityState
    ├── available capabilities
    ├── permissions
    └── runtime bindings
```

This is a semantic model, not a proposed class tree. Some of these concepts may eventually share physical storage.

### Write policy matters

Not every part of `AgentState` should have equal mutability.

For example:

- `Identity.core principles` may require explicit human approval to change;
- the `SelfModel` may evolve through reflection;
- user corrections should immediately supersede conflicting user-model memories;
- relationship state may have stricter provenance requirements than temporary project facts.

This is an area where Ember should be more deliberate than generic memory-block systems.

## 3. Evidence before memory

We should strongly consider an append-friendly evidence layer as the ground beneath derived memory.

Candidate event types might include:

```text
UserMessageObserved
AssistantMessageProduced
ToolCalled
ToolResultObserved
DelegationStarted
DelegationCompleted
ExternalEventObserved
MemoryCandidateExtracted
MemoryPromoted
MemorySuperseded
IdentityStateChanged
ThreadOpened
ThreadResolved
```

This does **not** require full event sourcing as an implementation architecture.

The useful property is simpler:

> Important derived state should retain enough links to evidence that we can explain and correct it.

For example:

```text
MemoryEntry
├── content
├── semantic type
├── confidence
├── origin class
├── observed_at
├── source_event_ids[]
├── supersedes[]
└── status
```

This gives Ember a better answer to "why do you remember this?" than cosine similarity against anonymous snippets.

## 4. Memory pipeline

The initial memory architecture should remain simpler than current OpenClaw while retaining its best invariants.

Candidate flow:

```text
turn/event
   ↓
append evidence
   ↓
cheap candidate extraction
   ↓
Episodic / candidate store
   ↓
reflection trigger
   ↓
deterministic eligibility
   ↓
bounded model interpretation
   ↓
validation + provenance checks
   ↓
curated memory / user / relationship / self-model update
```

### Memory categories

At minimum we should keep these concepts separate even if storage initially shares tables:

- **semantic**: durable facts and learned information;
- **episodic**: references to meaningful experiences/events;
- **user/relationship**: facts whose meaning depends on a particular person/relationship;
- **decisions**: conclusions plus rationale/evidence;
- **open threads**: unresolved future-facing state.

Raw transcripts remain evidence, not memory.

### Recall lanes

A sensible initial strategy could have two lanes:

1. **cheap lane**: curated active memory + exact/full-text lookup + deterministic relevance;
2. **deep lane**: semantic or model-assisted recall only when cheap recall is insufficient.

We should not start by requiring a vector database for every turn.

## 5. Context Assembler

Context assembly deserves its own subsystem rather than becoming string concatenation inside the kernel.

A candidate projection order inspired by Hermes:

```text
stable
  identity principles
  operating policy
  model/tool guidance
  selected skills

situational
  current interface
  current project/workspace
  current task/session

continuity
  selected user/relationship state
  curated memories
  open relevant threads

per-turn ephemeral
  recalled evidence
  external events
  temporary capability output
```

These layers may map differently to model-provider caching APIs. The semantic distinction should exist regardless of provider.

### Important rule

The context assembler is allowed to *select and project* persistent state. It should not silently redefine canonical identity or memory while doing so.

## 6. Capabilities

Capabilities should expose what Ember can do without forcing the core to know implementation details.

Candidate categories:

```text
Capability
├── ToolCapability
│   ├── local built-in
│   └── MCP
│
└── AgentRuntimeCapability
    ├── Codex native adapter
    └── ACP adapter
```

A delegated agent runtime is deliberately not modelled as just another stateless function call. It may own:

- a canonical thread;
- native tools;
- native compaction;
- cancellation semantics;
- approvals;
- streaming events.

The adapter should therefore expose a runtime ownership contract similar in spirit to OpenClaw's harness model.

### First specialist target

Coding work should be delegated rather than reimplemented.

An early Ember should be able to recognize a coding task and run something conceptually like:

```text
Ember context + task
        ↓
Codex runtime
        ↓
execution events / result
        ↓
Ember interprets result
        ↓
reply / memory / follow-up
```

The exact Codex integration path should be researched separately before implementation.

## 7. Initiative and attention

This is one of the main areas where Ember should deliberately experiment rather than copy existing projects.

Most current systems model autonomy primarily through schedules, background jobs, or message events.

Ember should investigate an explicit attention stage:

```text
Event
  ↓
Eligibility gate
  ↓
Attention evaluation
  ↓
Outcome
  ├── ignore
  ├── remember only
  ├── act silently
  ├── schedule/defer
  └── contact user
```

### Deterministic vs model responsibilities

Deterministic code should probably own:

- permissions;
- quiet periods / interruption budgets;
- event deduplication;
- urgency ceilings;
- cooldowns;
- lifecycle and retry rules.

The model can help judge:

- relevance;
- semantic urgency;
- whether context makes an event worth surfacing;
- how to communicate it.

This keeps "initiative" from becoming an unconstrained background chatbot.

## 8. Sessions

A session is a conversational/execution scope, not the identity of Ember.

Sessions should contain transient state such as:

- transcript references;
- selected workspace/project;
- active model/runtime;
- current task context;
- streaming/execution state;
- temporary recalled context.

Stopping a session should not erase the persistent agent.

## 9. Interface boundary

CLI should be the first public surface because it keeps early development observable and cheap.

The conceptual dependency should remain:

```text
CLI → interaction runtime → agent kernel
```

not:

```text
agent kernel → terminal implementation
```

This preserves room for future messaging and voice surfaces without forking the agent.

## 10. Observability

A personal agent with memory and initiative needs first-class observability earlier than a normal chatbot.

We should eventually be able to inspect:

- active session state;
- current context projection;
- model/tool/delegation events;
- memory candidates and promotions;
- provenance for durable memory;
- identity/self-model changes;
- open threads;
- why an event did or did not trigger an interruption.

This may initially be plain CLI output and structured logs rather than a dedicated UI.

## Explicit non-decisions

The research does **not** yet establish:

- Go vs Rust vs another implementation language;
- SQLite vs another canonical persistence store;
- whether evidence should be fully event-sourced;
- embeddings/vector storage choice;
- exact schema for identity or relationships;
- model-provider abstraction shape;
- Codex native app-server vs ACP integration details;
- plugin architecture;
- process model for background reflection;
- whether Ember initially runs as a foreground CLI process or a small local daemon with CLI client.

Those deserve focused decisions rather than being smuggled into an initial scaffold.

## Proposed next research sequence

Before writing the agent loop, investigate these questions in order:

1. **Continuity model**: define what must persist and which state is allowed to evolve automatically.
2. **Evidence and memory model**: define raw history, provenance, promotion, correction, and supersession.
3. **Runtime ownership**: define the contract for local tools vs delegated agents, especially Codex.
4. **Context assembly**: define how persistent state is projected into bounded model context.
5. **Initiative model**: define events, attention, interruption, and non-action.
6. **Operational shape**: foreground CLI vs daemon + CLI, then choose language/runtime based on the resulting requirements.

Only after those questions should package layout and implementation language become architecture decisions.