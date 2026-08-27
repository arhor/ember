# NanoBot Architecture Notes

Reviewed against NanoBot commit `29025f5a8bfaeed8a8c0daf22c770afd9d023dd0`.

Sources:

- [Architecture](https://github.com/HKUDS/nanobot/blob/29025f5a8bfaeed8a8c0daf22c770afd9d023dd0/docs/architecture.md)
- [Memory design](https://github.com/HKUDS/nanobot/blob/29025f5a8bfaeed8a8c0daf22c770afd9d023dd0/docs/memory.md)
- [Agent runner](https://github.com/HKUDS/nanobot/blob/29025f5a8bfaeed8a8c0daf22c770afd9d023dd0/nanobot/agent/runner.py)

## What problem does it solve?

NanoBot aims to provide a compact general-purpose personal agent while still supporting sessions, tools, MCP, multiple interfaces, project workspaces, and persistent memory.

Its value for Ember is not merely that it is small. NanoBot shows how far a relatively compact architecture can stretch before a project needs a large platform layer.

## How does it solve it?

The most useful boundary is the split between two loops:

```text
Channel
   ↓
MessageBus
   ↓
AgentLoop         product/session-facing turn ownership
   ↓
AgentRunner       provider/tool execution loop
   ├── LLM provider
   └── tools
```

`AgentLoop` owns routing, effective session/workspace, context construction, hooks, and outbound messages. `AgentRunner` owns model calls, tool calls, retries, streaming, context governance, and runtime limits.

This is a clean separation between **one user-facing turn** and **one model-facing execution loop**.

NanoBot also distinguishes two filesystem scopes:

- **agent workspace**: identity, user profile, memory, custom skills, session namespace;
- **effective project workspace**: project instructions, shell working directory, ordinary filesystem boundary.

This lets one persistent agent move between projects without moving its identity and long-term memory into each repository.

## Memory model

NanoBot's memory pipeline is deliberately layered:

```text
session.messages
      │
      │ context pressure
      ▼
Consolidator
      │
      ▼
memory/history.jsonl       append-only compressed evidence
      │
      │ scheduled reflection
      ▼
Dream
      │
      ├── SOUL.md
      ├── USER.md
      └── memory/MEMORY.md
```

The important distinction is that `history.jsonl` is *material for memory*, not final memory itself.

`Dream` periodically reads recent history plus current durable files and makes bounded edits to the long-term state. NanoBot can also version these durable changes through Git, giving memory an audit and restore path.

## What works well?

### 1. AgentLoop / AgentRunner separation

This is probably the strongest pattern to borrow directly.

Ember will need a boundary between:

- interaction/session orchestration;
- the inner model/tool loop.

Keeping those distinct makes it possible to add CLI, events, or other interfaces without contaminating the core execution loop.

### 2. Agent workspace vs project workspace

This maps almost perfectly onto Ember's goals.

Identity and personal memory should not become repository-local merely because the current task happens inside a repository.

### 3. History is not durable memory

NanoBot's `history.jsonl -> Dream -> durable files` pipeline is conceptually stronger than writing every extracted fact straight into a vector store.

It creates a staging boundary where experiences can be interpreted before they enter always-relevant memory.

### 4. Memory changes are inspectable

Versioning long-term memory with Git is a simple but powerful idea. Ember may use a different mechanism, but the property is important: automatic memory evolution should be observable and correctable.

### 5. Application-owned infrastructure lifecycle

NanoBot keeps MCP connection lifecycle outside the core loop. Composition roots own connection setup and shutdown and share a tool registry with the agent.

This is a healthy direction for Ember: the agent should *use* capabilities without owning every transport lifecycle internally.

## What may scale poorly for Ember?

### 1. Durable identity is still primarily Markdown

`SOUL.md`, `USER.md`, and `MEMORY.md` are elegant because they are inspectable, but they conflate several semantic concerns into mutable prose.

For Ember we probably want stronger distinctions between:

- identity principles;
- self-model;
- relationship/user state;
- semantic facts;
- episodes;
- open threads;
- provenance.

Plain files may remain a useful projection or editing surface without being the complete domain model.

### 2. Dream performs broad interpretive mutation

The Dream idea is excellent, but Ember should explore narrower typed outputs and stronger validation around what a reflection pass is allowed to change.

A model should not be able to rewrite high-value identity state merely because one reflection prompt inferred that it should.

### 3. Memory provenance is relatively coarse

NanoBot preserves history and versions, which helps reconstruction, but Ember should make source evidence a first-class property of remembered information rather than relying mostly on file history and prose.

## What should Ember borrow?

- the separation between turn orchestration and model/tool execution;
- separate agent-owned and project-owned state roots;
- an append-only intermediate history/evidence layer;
- background consolidation rather than constant inline memory mutation;
- inspectable and reversible durable-memory changes;
- external ownership of capability lifecycle such as MCP connections;
- an explicit goal of keeping the core loop small.

## What should Ember deliberately do differently?

- model identity as persistent domain state rather than only a `SOUL.md` prompt fragment;
- distinguish multiple memory semantics rather than one general `MEMORY.md`;
- attach provenance and supersession metadata structurally;
- make reflection outputs typed and bounded;
- add an explicit event/attention model for initiative;
- treat specialist agent delegation as a first-class capability boundary rather than growing local tools until Ember becomes a specialist itself.

## Ember takeaway

NanoBot is the best reference for **how little core machinery is actually required**.

The lesson is not "copy NanoBot and add more features." It is:

> Preserve a compact execution spine, then put richer continuity semantics around it without allowing those semantics to collapse back into one giant prompt.