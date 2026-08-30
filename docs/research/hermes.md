---
summary: "Reference investigation of Hermes' mature runtime, prompt lifetime tiers, searchable session history, and delegation that narrows context and shared-state authority."
read_when:
  - "Comparing Ember with a mature multi-surface agent runtime or evaluating operational complexity trade-offs"
  - "Investigating prompt lifetime tiers, searchable history, or isolated specialist delegation through Hermes"
role: reference
discovery_status: current
---

# Hermes Architecture Notes

Reviewed against Hermes Agent commit `0dfba37b11ff2ca908ae2df85b55f4f4c9b7fd8b`.

Sources:

- [Architecture](https://github.com/NousResearch/hermes-agent/blob/0dfba37b11ff2ca908ae2df85b55f4f4c9b7fd8b/website/docs/developer-guide/architecture.md)
- [Prompt assembly](https://github.com/NousResearch/hermes-agent/blob/0dfba37b11ff2ca908ae2df85b55f4f4c9b7fd8b/website/docs/developer-guide/prompt-assembly.md)
- [Persistent memory](https://github.com/NousResearch/hermes-agent/blob/0dfba37b11ff2ca908ae2df85b55f4f4c9b7fd8b/website/docs/user-guide/features/memory.md)
- [Delegation implementation](https://github.com/NousResearch/hermes-agent/blob/0dfba37b11ff2ca908ae2df85b55f4f4c9b7fd8b/tools/delegate_tool.py)

## What problem does it solve?

Hermes is a broad agent platform: one agent core serves CLI, gateway, API, ACP, batch execution, cron, many tools, plugins, memory providers, and delegated subagents.

It is useful to Ember as a reference for a project that has already crossed the boundary from "small agent" into "mature runtime with many operational concerns."

## How does it solve it?

The center is `AIAgent`, which owns prompt construction, provider resolution, model calls, tool dispatch, retries, compression, callbacks, and persistence.

Around it are relatively explicit subsystems for prompt assembly, providers, tools, context compression, sessions, memory, and external interfaces.

Hermes deliberately keeps the same agent core behind CLI, messaging gateway, ACP, and other surfaces.

## Prompt assembly

One particularly strong implementation idea is the explicit prompt tiering:

```text
stable
  identity, tools, skills, environment/platform guidance
      ↓
context
  caller context + repository instruction files
      ↓
volatile
  memory snapshot, user profile, timestamp/session/provider data
```

The ordering is designed around both meaning and prompt-cache stability.

Hermes also distinguishes cached system-prompt state from additions that exist only for one model call. The transferable lesson is that information with different lifetimes should not be casually flattened into one giant prompt.

## Memory model

Hermes uses two small always-visible curated stores:

- `MEMORY.md` for durable agent/work/environment facts;
- `USER.md` for user preferences and profile information.

Both have strict character budgets and are frozen into the system prompt at session start. Past conversation history lives separately in SQLite and is searchable through FTS5 via `session_search`.

The useful semantic distinction is therefore:

```text
small amount of important remembered information    usually present
large conversation history                          recovered when needed
```

## Delegation model

Hermes' `delegate_task` implementation is especially relevant.

A delegated child receives a fresh conversation rather than the parent's whole transcript, gets only the capabilities appropriate for the task, and returns a focused result rather than flooding the parent conversation with every intermediate step.

Shared-state actions such as modifying memory, scheduling work, messaging the user, or recursively delegating are restricted by default.

The semantic lesson is **delegation should narrow context and authority**, not merely clone the parent agent with all of its privileges.

## What works well?

### One continuing agent can appear through several interfaces

CLI and messaging concerns stay outside `AIAgent`. Ember should preserve the underlying property: changing how the user reaches the agent should not create a different identity.

### Context has different lifetimes

Hermes' stable/context/volatile tiers provide a useful way to think about Ember's future context without yet deciding how Ember will represent it.

Identity, current project information, remembered knowledge, and one-turn observations do not mean the same thing and should not share a lifecycle by accident.

### Always-visible memory is deliberately small

Hermes accepts that every piece of persistent memory included on every turn has a recurring token and attention cost. That budget discipline is worth keeping regardless of storage technology.

### Large history remains searchable

Cheap full-text session search is a compelling baseline. Not every attempt to remember the past needs embeddings or another model call.

### Delegated work is isolated

Fresh context and reduced authority are valuable even if Ember ultimately delegates to external specialist systems rather than copies of itself.

### Long-running actions can be interrupted and observed

Once an agent can act or delegate work, the user needs to see what is happening and retain the ability to stop it.

## What may scale poorly for Ember?

### Too many responsibilities converge in the central implementation

Hermes' own documentation describes `run_agent.py` as a large central file. Its breadth shows why Ember should try to preserve a narrower conceptual center even as capabilities grow.

### Built-in tool breadth creates pressure on the agent itself

Seventy-plus tools and many execution backends are useful product features, but Ember does not need to measure maturity by how many specialized abilities live locally.

### Curated memory is intentionally shallow

Two bounded text files work well for high-value facts, but Ember's goals raise additional questions about experiences, relationships, evolving self-understanding, contradiction, and provenance.

### Some implementation wiring is implicit

Hermes uses convenient import-time registration patterns. That is a useful implementation observation, but there is no reason for Ember to choose an equivalent mechanism during research.

## What should Ember borrow conceptually?

- one continuing agent across interfaces;
- explicit distinctions between long-lived, situational, and ephemeral context;
- strict budgets for information that is always shown to the model;
- cheap searchable history before more expensive recall methods;
- interruption and visible progress for long-running work;
- narrowed context and authority when work is delegated;
- model/provider concerns that do not define personal identity.

## What should Ember explore differently?

- keep the basic reasoning-and-action cycle narrower as the project grows;
- resist turning every useful external ability into a built-in tool;
- distinguish identity, relationships, experiences, and durable knowledge by meaning;
- preserve enough provenance to explain important remembered beliefs;
- prefer specialist systems for specialist work;
- investigate initiative as a question of attention and relevance rather than primarily schedules and gateway events.

## Ember takeaway

Hermes is a valuable reference for **operational maturity**.

The goal is not to reproduce its breadth. The useful lesson is to keep the ideas that survived that breadth: context discipline, interface independence, bounded active memory, searchable history, interruptibility, and delegation isolation.