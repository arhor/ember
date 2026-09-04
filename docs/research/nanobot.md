---
summary: "Reference investigation of NanoBot's compact agent loop, agent-versus-project workspace separation, memory consolidation, and inspectable small-runtime patterns."
read_when:
  - "Comparing Ember with a compact agent runtime before choosing execution-loop or memory-consolidation machinery"
  - "Investigating agent-versus-project workspace separation or small-core trade-offs through NanoBot"
role: reference
discovery_status: current
---

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

The most useful implementation boundary is the split between two loops:

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

This gives NanoBot a clean separation between **one user-facing turn** and **one model-facing execution loop**.

NanoBot also distinguishes two filesystem scopes:

- **agent workspace**: identity, user profile, memory, custom skills, session namespace;
- **effective project workspace**: project instructions, shell working directory, ordinary filesystem boundary.

This lets one persistent agent move between projects without moving its identity and long-term memory into each repository.

## Memory model

NanoBot's implementation separates current conversation, compressed history, and curated long-term files:

```text
session.messages
      │
      │ context pressure
      ▼
Consolidator
      │
      ▼
memory/history.jsonl
      │
      │ scheduled reflection
      ▼
Dream
      │
      ├── SOUL.md
      ├── USER.md
      └── memory/MEMORY.md
```

The important semantic distinction is that `history.jsonl` is _material for memory_, not final memory itself.

`Dream` periodically reads recent history plus current durable files and makes bounded edits to the long-term state. NanoBot can also version these durable changes through Git, giving memory an audit and restore path.

## What works well?

### Separation between interaction and inner execution

The implementation uses `AgentLoop` and `AgentRunner`, but the transferable idea for Ember is simpler: dealing with a user-facing interaction is not the same responsibility as repeatedly asking a model to reason, use a tool, observe the result, and continue.

Keeping those concerns distinct should make it easier to add different interfaces without changing the basic reasoning-and-action cycle.

### Personal continuity is separate from project context

NanoBot's agent workspace and project workspace map well onto Ember's goals.

Working inside a repository should not make personal identity and long-term memory belong to that repository. One continuing agent should be able to move between projects while preserving its own history and relationships.

### History is not durable memory

The `history.jsonl -> Dream -> durable files` pipeline captures a useful semantic staging step: lived experience can remain available without every part of it immediately becoming a permanent belief.

### Memory changes are inspectable

Versioning long-term memory with Git is a simple but powerful implementation choice. Ember may eventually use something entirely different, but the important property is that automatic memory evolution should be understandable and correctable.

### The reasoning loop does not need to own every capability's lifecycle

NanoBot keeps MCP connection setup and shutdown outside the inner loop. The semantic lesson is that Ember can **use** a capability without becoming responsible for every implementation detail of how that capability stays alive.

## What may scale poorly for Ember?

### Durable identity is still primarily mutable prose

`SOUL.md`, `USER.md`, and `MEMORY.md` are elegant because they are inspectable, but Ember likely needs stronger semantic distinctions between stable identity, evolving self-understanding, relationships, remembered facts, experiences, and unfinished matters.

That observation does not imply a particular storage shape. Plain files may still turn out to be useful.

### Dream can change a broad range of long-term meaning at once

The Dream idea is attractive, but Ember should investigate more explicit limits on what reflection is allowed to revise. A reflection about one conversation should not casually redefine deeply stable identity or relationship principles.

### Provenance is less central than in some larger systems

NanoBot preserves history and versions, which helps reconstruction, but Ember's goals make the question "why do I remember this?" unusually important. We should investigate stronger links between remembered conclusions and the experiences from which they came.

## What should Ember borrow conceptually?

- keep the reasoning-and-action cycle small and understandable;
- keep personal continuity separate from whatever project is currently open;
- let history remain history before deciding that something deserves to become durable memory;
- move expensive reflection away from the immediate reply path when possible;
- make important long-term changes inspectable and correctable;
- let capabilities remain externally owned where that reduces coupling.

## What should Ember explore differently?

- distinguish stable identity, evolving self-understanding, relationship knowledge, memories, and unfinished matters by meaning rather than treating them as one undifferentiated body of prose;
- preserve enough evidence to explain where important remembered beliefs came from;
- place stricter limits around what background reflection may change;
- investigate attention and initiative as a question of meaning and relevance, not merely scheduled jobs;
- prefer specialist delegation for specialist work instead of steadily expanding Ember's own local toolset.

## Ember takeaway

NanoBot is the best reference in this set for **how little core machinery may actually be required**.

The lesson is not "copy NanoBot and add more features." It is:

> Preserve a compact execution spine, then place richer continuity semantics around it without allowing those semantics to collapse back into one giant prompt.
