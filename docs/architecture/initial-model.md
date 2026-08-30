---
summary: "Pre-research architecture hypothesis retained to show how Ember's design assumptions evolved before the cross-cutting synthesis."
read_when:
  - "Tracing the architecture hypothesis that preceded the cross-cutting research synthesis"
  - "Comparing current design directions with the project's pre-research model"
role: design
discovery_status: superseded
superseded_by: docs/architecture/design-directions.md
---

# Initial Architecture Model

> Status: historical pre-synthesis research hypothesis, not an ADR.
>
> This document was written before the concern-driven research programme was completed. It remains useful as the hypothesis that shaped that research, but it is superseded as the current synthesis by [Cross-Cutting Research Synthesis and Ember Design Directions](design-directions.md).
>
> This document intentionally stays at the level of behavior, meaning, and responsibility. It does not propose classes, structures, event names, schemas, protocols, storage layouts, or package boundaries.

## Why this document exists

The projects studied so far solve many of the same practical problems in different ways. The useful question for Ember is not which implementation to copy, but which **semantic boundaries** repeatedly prove valuable.

Several themes recur:

- the conversation-facing part of an agent and the inner model/tool loop benefit from being separable;
- short-term conversation history and long-term memory are different things;
- identity and durable personal context should survive individual sessions;
- only a small portion of remembered information needs to be present all the time;
- larger history can remain searchable and be brought back only when relevant;
- specialist agents can own specialist work instead of Ember reproducing their internal workflows;
- proactive behavior needs a notion of attention and restraint, not merely schedules and notifications.

A useful working hypothesis is therefore:

> Ember should have a small understandable execution core, durable continuity that exists outside any one model call, disciplined context selection, and the ability to compose specialist capabilities without absorbing them into itself.

This is a direction for further research, not an implementation plan.

## The main semantic areas

At this stage it is enough to distinguish several responsibilities without deciding how many modules, processes, files, tables, or types they will eventually become.

### Interaction

Ember needs some way to receive what is happening and communicate back. The CLI will be the first such surface, but it should not define what Ember is.

A future message arriving through Telegram, a voice interaction, or a terminal conversation should all reach the same continuing agent rather than create separate identities.

### Conversation and action

During an interaction Ember needs to understand the current situation, decide what context matters, ask a model for judgment, use capabilities when appropriate, observe what happened, and eventually respond or choose another outcome.

The important research question is the behavior of this loop, not its future code shape.

### Continuity

Some information must outlive a conversation or process if Ember is to remain meaningfully continuous over time.

This may include, conceptually:

- a stable sense of identity and values;
- an evolving understanding of itself;
- an understanding of the people with whom it has ongoing relationships;
- durable memories;
- unfinished matters that may become relevant later;
- knowledge of what it is currently able and allowed to do.

These kinds of information need not have the same mutability, trust rules, or lifetime.

### Evidence and history

Ember should retain enough of what actually happened to support later recall, correction, and explanation.

Examples of things that may become evidence include:

- the user said something;
- Ember replied;
- Ember used a tool and observed the result;
- a specialist agent was asked to do some work and later returned a result;
- something relevant happened in an external system;
- a remembered fact was later corrected;
- an unfinished matter was resolved.

The important point is not to define a catalogue of technical events. It is to preserve the distinction between **what happened** and **what Ember later concludes from it**.

### Memory

Memory is not simply stored conversation history.

A useful distinction is:

- **history** preserves what happened;
- **memory** preserves what remains worth knowing;
- **context** is the small selection that matters right now.

A long conversation might therefore remain available as history without being injected into every future model call. Later reflection may decide that one part of it deserves to become durable memory, while most of it does not.

Memory should also retain enough provenance to answer questions such as:

- Where did this belief come from?
- Was it said directly by the user, inferred by Ember, or learned from an external source?
- Is there newer information that contradicts it?
- Is this still relevant?

Exactly how that provenance is represented is deliberately left open.

### Context

The model cannot see Ember's entire past and persistent state on every turn. Ember therefore needs to select what the model should know now.

Conceptually, context may draw from several kinds of information:

- relatively stable identity and behavioral principles;
- the current situation and interface;
- the current project or task;
- relevant relationship and user knowledge;
- a small amount of important long-term memory;
- unfinished matters relevant to the present conversation;
- older history recalled specifically because the current situation calls for it;
- recent observations from tools or external systems.

The model sees a **projection** of Ember's state and history. That projection must not silently become the source of truth for the state itself.

### Capabilities

Ember should be able to affect and inspect the outside world without having to implement every integration internally.

Some capabilities may be simple tools. Others may be sophisticated specialist systems with their own state and execution behavior.

For example, coding work can be handed to Codex. Ember does not need to imitate Codex's repository search, patching, shell execution, sandboxing, and coding-specific reasoning. Instead, Ember needs to know when delegation makes sense, what context to provide, how to observe the outcome, and what that outcome means to the ongoing interaction.

The same principle should apply to future specialist agents and external services.

### Attention and initiative

This is one of the areas where Ember should deliberately leave room for invention.

Current agent systems often express autonomy mainly through schedules, background jobs, or direct reactions to incoming events. For Ember, a more useful question is:

> When something happens without the user explicitly asking about it, should Ember care?

For example, after learning that Codex finished a task, Ember might:

- decide that nothing further matters;
- remember the result for later;
- inspect the result more closely;
- take another safe action;
- defer attention until a better moment;
- tell the user because the result is useful or important.

The interesting research problem is the judgment between those outcomes and the boundaries around that judgment.

Permissions, interruption limits, quiet periods, repeated-event suppression, and similar hard boundaries are likely better handled deterministically. Relevance and meaning are places where model judgment may add value. The exact mechanism remains open.

### Sessions

A session is temporary conversational or working context. It is not Ember's identity.

Ending a session should not erase what Ember has durably learned, nor should starting a new interface create a new agent by accident.

What should persist across sessions, what should expire, and what should merely remain searchable are central continuity questions that need dedicated research.

### Observability and correction

A personal agent that remembers, acts, and sometimes initiates interaction needs to be inspectable.

It should eventually be possible to understand things such as:

- what Ember currently remembers;
- why it remembers something;
- what information was considered relevant to a particular interaction;
- what external actions or delegations took place;
- what changed in its longer-term understanding;
- why an external occurrence did or did not result in an interruption;
- how an incorrect memory or conclusion can be corrected.

This requirement is semantic. It does not yet imply structured logs, an event store, a database history table, or any particular UI.

## Questions deliberately left unanswered

The research so far does **not** establish:

- which programming language Ember should use;
- whether Ember should usually run in the foreground or as a long-lived local process;
- which persistence technology should hold durable state;
- whether history is represented as files, database records, an event log, or something else;
- whether semantic embeddings are necessary at all, and if so where;
- how identity, relationships, memories, and unfinished matters should be represented internally;
- how model providers should be abstracted;
- whether Codex should be reached through its native app-server interface, ACP, or another supported boundary;
- how extensions should be packaged;
- how background reflection should be scheduled or triggered.

Those are implementation and architecture decisions to make only after their semantic requirements are clearer.

## Research language rule

Until that point, Ember's own design notes should prefer sentences such as:

- "the user sent a message";
- "Ember asked a specialist agent to work on the task";
- "the specialist agent finished and returned a result";
- "Ember decided that part of the conversation was worth remembering";
- "new information contradicted an older memory";
- "something happened that might deserve the user's attention".

They should avoid prematurely translating those statements into class names, event names, schemas, method signatures, or storage records.

Concrete implementation names are still useful when documenting **how an existing project works**, because there they are observations rather than design commitments for Ember.

## Proposed next research sequence

Before writing the execution loop, investigate these questions in roughly this order:

1. **Continuity:** what exactly must survive for tomorrow's Ember to be a meaningful continuation of today's?
2. **Memory and evidence:** what should be remembered, what should merely remain recoverable history, and how can corrections and provenance work?
3. **Delegation:** what does Ember need to know and control when specialist systems such as Codex perform work on its behalf?
4. **Context:** how should Ember decide which pieces of its much larger persistent world belong in the present model call?
5. **Attention and initiative:** when should Ember act, defer, remember, speak, or deliberately do nothing without an explicit request?
6. **Operational needs:** only then determine what those semantics imply for process lifetime, persistence, language, and concrete architecture.

The goal of this phase is to understand the creature before naming its bones. 🔥