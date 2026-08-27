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

Around it are relatively explicit subsystems:

```text
entry points
   │
   ▼
AIAgent
   ├── prompt builder
   ├── provider resolver
   ├── context engine / compressor
   ├── tool registry
   └── persistence
          │
          ├── SQLite sessions + FTS5
          ├── bounded memory
          └── external memory providers
```

Hermes deliberately keeps the same agent core behind CLI, messaging gateway, ACP, and other surfaces.

## Prompt assembly

One particularly strong idea is the explicit prompt tiering:

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

The ordering is designed around both semantics and prompt-cache stability.

Hermes also distinguishes cached system-prompt state from API-call-time ephemeral additions. This is important because not every useful piece of context deserves to mutate the long-lived prompt prefix.

## Memory model

Hermes uses two small always-visible curated stores:

- `MEMORY.md` for durable agent/work/environment facts;
- `USER.md` for user preferences and profile information.

Both have strict character budgets and are frozen into the system prompt at session start. Mid-session writes persist immediately but do not mutate the cached prompt snapshot.

Past conversation history lives separately in SQLite and is searchable through FTS5 via `session_search`.

This creates a simple two-speed memory model:

```text
small curated memory     always present
large session history    retrieved on demand
```

## Delegation model

Hermes' `delegate_task` implementation is especially relevant.

A delegated child receives:

- a fresh conversation with no parent transcript;
- its own task identity and terminal session;
- inherited toolsets with dangerous/shared-state capabilities removed;
- focused context built for the delegated goal.

The parent sees only the delegation call and the final result, not the child's full intermediate trajectory.

Shared-state capabilities such as memory writes, scheduling, messaging, and recursive delegation are restricted by default.

This is a strong example of **context isolation as architecture**, not merely prompt wording.

## What works well?

### 1. Platform-agnostic core

CLI and messaging concerns stay outside `AIAgent`. Ember should preserve this property from the beginning.

### 2. Prompt tiers are explicit

The stable/context/volatile split gives us a useful vocabulary for Ember's future context assembler.

It also reinforces a deeper principle: identity state, project context, memory, and ephemeral events have different lifecycles and should not be concatenated casually.

### 3. Bounded always-on memory

Hermes accepts that always-in-context memory is expensive and therefore keeps it intentionally tiny.

The exact Markdown implementation is not necessarily right for Ember, but the budget discipline is.

### 4. Searchable raw sessions remain separate

Using FTS5 for cheap exact-ish recall before invoking heavier semantic or model-assisted retrieval is a compelling baseline.

Not every recall query needs embeddings or a dedicated LLM call.

### 5. Delegated contexts are isolated

Fresh child context plus explicit capability restrictions is a pattern worth keeping even if Ember delegates to external runtimes rather than spawning copies of itself.

### 6. Interruptibility and observable execution

Hermes treats cancellation and visible tool execution as design principles. These become increasingly important once an agent can act autonomously or run long delegated tasks.

## What may scale poorly for Ember?

### 1. `AIAgent` owns too many responsibilities

Hermes' own architecture documentation describes `run_agent.py` as a large central file. Prompt, provider, tools, retry, persistence, compression, and callbacks all converge there.

For Ember we should preserve a narrower kernel and let orchestration policies compose around it.

### 2. Tool breadth becomes architecture pressure

Seventy-plus tools and many terminal/browser backends are useful product features, but they increase the number of states the central agent must understand.

Ember should prefer external capability standards and specialist runtimes instead of measuring maturity by built-in tool count.

### 3. Curated memory is intentionally shallow

Two bounded text files work very well for high-value facts, but Ember's goals require richer semantics around episodes, provenance, contradiction, relationships, and evolving self-model state.

### 4. Import-time registry patterns are convenient but implicit

Hermes tools self-register during import. Ember should consider more explicit construction to keep dependencies visible and testable.

## What should Ember borrow?

- one core across interfaces;
- stable/context/volatile prompt tiers;
- separation of cached prompt state from per-turn ephemeral context;
- strict budgets for always-visible memory;
- cheap searchable session history as a first retrieval lane;
- explicit cancellation and execution observability;
- isolated delegation contexts;
- capability restrictions for delegated work;
- provider/runtime resolution as a separable concern.

## What should Ember deliberately do differently?

- keep the central agent loop narrower than Hermes' `AIAgent`;
- avoid accumulating a huge built-in tool catalog;
- give identity, relationships, episodes, and durable knowledge separate semantics;
- make provenance part of persisted state;
- treat external specialist runtimes as preferred delegation targets for specialist work;
- make initiative/attention an explicit subsystem rather than expressing autonomy mostly through cron and gateway events.

## Ember takeaway

Hermes is a valuable reference for **operational maturity**.

The goal is not to reproduce its breadth. The useful lesson is to copy the boundaries that survived that breadth: prompt tiers, platform independence, bounded active memory, searchable history, cancellation, and delegation isolation.