---
summary: "Issue #177 evaluation of LangGraph.js as a replaceable durable-execution, checkpointing, interrupt/resume, and orchestration layer beneath Ember-owned continuity, authority, delegation, and canonical state semantics."
read_when:
  - "Considering LangGraph.js for durable execution, checkpointing, interrupts, restart recovery, workflows, or subgraphs in Ember"
  - "Comparing Functional API and Graph API coupling for an Ember-owned durable execution seam"
  - "Reviewing whether LangGraph threads, checkpoints, state, memory, or replay semantics may remain operational rather than canonical"
role: design
discovery_status: current
---

# LangGraph.js Durable Execution Evaluation

## Decision

**Do not make Ember a LangGraph graph, thread, or state machine. LangGraph.js is a strong candidate for future durable execution mechanics, especially through the Functional API, but only behind a narrow Ember-owned execution boundary whose persisted LangGraph state is operational and replaceable.**

LangGraph is unusually relevant to issue [#177](https://github.com/arhor/ember/issues/177) because its lower-level runtime already implements several pieces Ember should not casually reinvent: checkpointing, restart/resume, human interrupts, task-result replay, per-step durability, retries, graceful drain, state inspection, and subgraph execution.

The danger is equally specific. LangGraph deliberately treats a `thread_id` as the identity through which accumulated execution state is stored and resumed, and its documentation describes checkpointer state as short-term memory. Ember must not inherit those meanings. A LangGraph thread can identify one operational run; a checkpoint can make that run resumable; neither may define Ember lineage, memory, authority, current truth, or the evidence required to reconcile uncertain effects.

The recommended posture is:

1. **Prefer the Functional API for a future narrow durable executor.** `entrypoint` and `task` let ordinary TypeScript control flow remain ordinary TypeScript instead of making graph topology Ember's domain architecture.
2. **Treat replay rules as a real contract, not an implementation detail.** Completed task results can be restored on resume, but the entrypoint body replays from the beginning; unfinished tasks may execute again; side effects require idempotency/reconciliation; and in-flight Functional API runs are sensitive to the ordering of `task` and `interrupt` calls.
3. **Keep all LangGraph persistence operational.** Store execution phase, bounded inputs, task outputs, approval payloads, idempotency keys, and references to Ember state. Do not store the only authoritative copy of Ember meanings, lineage, authority, delegation responsibility, or effect evidence in a checkpoint or LangGraph Store.
4. **Revalidate Ember truth after every consequential resume.** Before a resumed run performs an external effect or commits canonical state, reacquire the normal `StateStore` writer boundary where required, reload current Ember state, validate revision/currentness/authority, and reconcile any ambiguous prior effect.
5. **Hide LangGraph-specific control flow behind adapter types.** `thread_id`, checkpoint IDs, `Command`, `interrupt`, `StateSnapshot`, graph node names, and checkpoint namespaces must not leak into `src/core/` contracts.
6. **Do not replace ADR 0007 merely because LangGraph is durable.** The current systemd-supervised episodic topology is simpler and already satisfies current earned requirements. Introduce LangGraph only for a concrete multi-step operation whose suspend/restart/retry complexity exceeds those mechanisms.

In short: **LangGraph may remember where an operation was; Ember must remember what it means.**

## Evaluation baseline

This evaluation was performed on **2026-09-07** against:

- Ember's [Design Principles](../principles.md), accepted ADRs, and [Architecture Acceptance Scenarios](acceptance-scenarios.md);
- the [Long-Lived Runtime Requirements](long-lived-runtime-requirements.md), ADR 0007, and the current systemd-supervised episodic runtime;
- the current canonical `StateStore`, whose revision/lease/durability semantics remain Ember-owned;
- the current `ProviderInvoker` cognition boundary and specialist reintegration/currentness rules;
- the current stable `@langchain/langgraph@1.4.14` package and repository `main`, which was already on `1.4.15-rc.0` during this review;
- current first-party LangGraph JavaScript documentation and source linked in [Sources](#sources).

The package is mature and widely used, but it is evolving quickly. The observed release/main mismatch and current production guidance around in-flight workflow compatibility make version pinning and adapter isolation mandatory if Ember adopts it.

This evaluation does **not** claim a measured install size, cold-start time, idle RSS, or Raspberry Pi result. Those are deployment measurements, not properties that can be inferred from package metadata. The local SQLite checkpointer also introduces `better-sqlite3`, a native dependency whose Node 26/ARM behavior should be measured on the actual Pi before adoption.

## Classification scale

| Class | Meaning |
| --- | --- |
| **1 - direct** | Useful mechanics can sit beneath an Ember-owned interface with little semantic translation. |
| **2 - firewall** | Useful, but LangGraph concepts/state/control flow must be translated and prevented from becoming Ember semantics. |
| **3 - coupled** | Strongly pulls Ember toward LangGraph-owned state, memory, workflow, or agent meaning. |
| **4 - irrelevant** | Does not currently solve an earned Ember requirement. |

## Primitive inventory

| LangGraph primitive | Current surface | Class | Ember fit | Recommendation |
| --- | --- | ---: | --- | --- |
| Functional API | `entrypoint`, `task`, ordinary TS control flow | **2** | Best way to borrow durability without making Ember graph-shaped; replay/order rules still matter | **Strong future candidate behind a port** |
| Graph API | `StateGraph`, state schema, nodes, edges, reducers | **2** for isolated execution, **3** as domain model | Powerful and inspectable, but graph state/topology can easily become application semantics | **Use only for naturally graph-shaped operational workflows** |
| Checkpointer interface | `BaseCheckpointSaver`, `SerializerProtocol` | **2** | Clean durable-mechanics boundary, but serialized state is LangGraph-shaped | **Wrap / keep operational** |
| SQLite checkpointer | `@langchain/langgraph-checkpoint-sqlite` | **2** | Attractive single-host restart backend; native dependency and production guidance require measurement | **Primary spike candidate, not canonical storage** |
| Postgres/MongoDB/Redis checkpointers | separate persistence packages | **2** | Production-grade options if topology later needs them; much heavier than current Pi/file topology | **Revisit when earned** |
| `thread_id` / checkpoint IDs | checkpoint primary key and resume identity | **2** | Good opaque execution locator; dangerous if treated as continuity/session identity | **Map to `OperationalRunRef` only** |
| Interrupt/resume | `interrupt`, `Command({ resume })` | **2** | Strong approval/suspend mechanics; node/entrypoint replay and stable ordering must be fenced | **Wrap behind Ember approval/resume semantics** |
| Durability modes | `exit`, `async`, `sync` | **2** | Useful explicit tradeoff; Ember consequential transitions should prefer durability that supports truthful recovery | **Choose per operation, default conservatively** |
| Retry/timeout/error handling | node retry policies, timeouts, handlers | **2** | Useful mechanics, but retry safety depends on Ember effect certainty/idempotency | **Wrap / never infer semantic retry safety** |
| Graceful drain | `RunControl`, `requestDrain`, `GraphDrained` | **1/2** | Good fit for systemd SIGTERM and restart; does not cancel in-flight async work | **Strong mechanical candidate** |
| State/history inspection | `getState`, `getStateHistory` | **2** | Excellent operational diagnostics; must not become canonical Ember history | **Use for runtime inspection only** |
| Replay/time travel | checkpoint replay, `updateState`, fork | **3** for live effectful Ember work | Re-executes downstream model/API/interrupt work and can fork operational state | **Debug/test only unless effects are fenced** |
| Streaming | values, updates, messages, custom/event streams | **2** | Useful progress transport; LangGraph event shapes should not leak into surfaces | **Translate to Ember-owned progress events** |
| Tool execution | tasks, `ToolNode`, LangChain-compatible tools | **2** | Useful execution plumbing; capability is not authority and completion is not effect certainty | **Revisit for bounded tool loop** |
| High-level agent loop | LangChain `createAgent`, LangGraph-backed agent patterns | **3** | Wants message/tool/thread lifecycle to define the application loop | **Avoid as Ember core** |
| Checkpointer “short-term memory” | thread-scoped graph state | **3** as Ember memory | Conflicts directly with Ember continuity/history/memory/context distinctions | **Never canonical memory** |
| LangGraph Store “long-term memory” | cross-thread key/value and retrieval | **3** as Ember memory, **2** as disposable operational KV | Can hold generic data but its memory model bypasses Ember provenance/currentness | **Avoid for canonical meanings** |
| Subgraphs | per-invocation/per-thread/stateless nested graphs | **2** mechanically, **3** as delegation semantics | Useful for nested execution; per-thread child memory/namespace rules must not define specialist identity | **Revisit beneath delegation adapter** |
| Supervisor/swarm packages | multi-agent routing/handoff patterns | **3** | Too close to defining delegation, responsibility, and specialist continuity | **Avoid as Ember delegation owner** |
| LangSmith tracing | optional tracing/debugging | **2** | Useful downstream telemetry; trace storage must remain non-canonical and optional | **Candidate behind telemetry seam** |
| Agent Server / hosted deployment | remote thread/run APIs, managed persistence | **3/4** now | Adds a resident/control-plane runtime Ember does not currently need | **Avoid for current topology** |

## Functional API versus Graph API

### Functional API: best semantic shape, sharper replay discipline

The Functional API is the most interesting LangGraph surface for Ember. First-party documentation explicitly positions it as a way to add persistence, human-in-the-loop, and streaming to existing code while keeping normal branching, loops, and function calls. The durable primitives are small:

```text
entrypoint
  ordinary TypeScript control flow
    -> task(...)
    -> task(...)
    -> interrupt(...)
    -> task(...)
```

That matters because Ember does not want an execution library to dictate her domain architecture. A future operation such as “prepare bounded work -> ask for approval -> execute -> reconcile -> report” can remain recognisable TypeScript rather than becoming a canonical graph of Ember cognition.

The price is replay semantics.

When a Functional API run resumes, execution begins again at the start of the entrypoint. Completed task/subgraph results are loaded from the checkpoint rather than recomputed, but ordinary code between those calls executes again. Therefore:

- every non-deterministic operation that influences control flow belongs inside a `task`;
- every side effect belongs inside a task and still needs idempotency because a task that began but did not finish can run again;
- time/random/network calls outside tasks can cause resumed control flow to diverge;
- adding, removing, or reordering `task` or `interrupt` calls before a resume point can associate cached values/resume data with the wrong call;
- materially changing an entrypoint with in-flight runs requires a drain/versioning strategy.

This is acceptable for a **small, versioned execution adapter**. It is a poor foundation for making arbitrary Ember cognition or canonical-state evolution “durable by decoration”.

**Recommendation: prefer Functional API for future bounded durable operations, but keep entrypoints small, versioned, and operational.**

### Graph API: more explicit runtime state, more architectural pressure

The Graph API exposes state schemas, nodes, reducers, and edges directly. It has two advantages for durable execution:

1. checkpoint boundaries and the next node are highly inspectable; and
2. a plain graph node resumes by re-running from that node's beginning rather than replaying one large entrypoint from the top.

It is also less position-sensitive than the Functional API when node internals do not use tasks/interrupts. LangGraph's compatibility guidance says edge topology itself is generally not persisted, while node names and state keys are persisted contracts for in-flight threads.

The downside is conceptual gravity. A graph called `EmberState`, with nodes such as `remember`, `decide`, `delegate`, or `be_silent`, would quickly turn operational topology into a theory of Ember. That is precisely what issue #177 asks us to avoid.

A safe Graph API use would instead have private adapter state such as:

```text
DurableOperationState
  executionVersion
  canonicalRevisionAtStart
  objectiveRef
  authorityRef
  phase
  pendingApprovalRef
  effectAttemptRefs
  taskOutputs
```

Those fields describe one operation. They do not describe Ember herself.

**Recommendation: use Graph API only when the operation is genuinely easier to understand as a graph, and keep graph state private to the adapter.**

## Thread identity is operational identity, not continuity

LangGraph checkpointers use `thread_id` as the primary key for storing and retrieving checkpoints. A thread contains accumulated state across a sequence of runs and is required for resume after an interrupt.

That meaning must stop at the adapter boundary.

For Ember:

```text
Ember lineageId
  != LangGraph thread_id
  != provider externalThreadId
  != surface conversation/chat ID
  != specialist runtime/session ID
```

A future mapping can be deliberately boring:

```text
OperationalRunRef {
  engine: "langgraph"
  runKind: "approved_external_action_v1"
  threadId: opaque UUID
}
```

The thread ID should be generated per durable operational run (or other explicitly defined operational scope), never derived from Ember lineage, user principal, Telegram chat, or provider thread identity merely for convenience.

If LangGraph is removed, losing the mapping should at worst make an unfinished operation require reconciliation/restart. It must not make Ember forget who she is or what she knows.

## Checkpoints: resumable mechanics, not canonical state

LangGraph checkpoints contain graph values, next-node information, task/error/interrupt metadata, checkpoint identifiers, namespaces, and parent relationships. They are excellent execution artifacts. They are the wrong place to make the only durable copy of Ember meaning.

A safe checkpoint may contain:

- operation kind/version;
- the Ember canonical revision observed when the operation started;
- opaque IDs referencing objective, authority, cognition/delegation episode, and effect attempts;
- bounded immutable input already disclosed to the operation;
- task results required for replay;
- pending approval payload and resume data;
- idempotency keys and reconciliation hints;
- non-canonical progress/debug metadata.

A checkpoint must not be the sole authoritative home for:

- Ember lineage or constitutive boundaries;
- canonical meanings, supersession/currentness, or retained evidence;
- authority grants or capability policy;
- delegation responsibility and reintegration decisions;
- cancellation/effect evidence whose loss would force Ember to guess what happened;
- delivery truth or other observations that Ember currently preserves durably.

The test is the same one that should govern any framework persistence: **deleting the LangGraph checkpoint database may destroy resumability, but it must not destroy Ember truth.**

### Durability mode

LangGraph exposes `exit`, `async`, and `sync` durability modes. `exit` cannot recover from a crash in the middle of a long run; `async` has a small crash window; `sync` writes the checkpoint before proceeding to the next step.

Ember should not choose globally. A future adapter should choose the least expensive mode that still preserves the operation's recovery requirement. For consequential external work where restart correctness depends on the previous step being durable before the next one begins, `sync` is the natural baseline to evaluate.

That still does not replace Ember's own ordering requirements. If an effect attempt must be represented in canonical operational evidence before execution, that record belongs through Ember's existing durability boundary before the LangGraph task crosses the external boundary.

## Resume firewall: revalidate current Ember truth

A resumed workflow is not entitled to continue merely because its checkpoint is internally consistent.

Current Ember design already rejects stale specialist results by reacquiring/reusing the writer lease, reloading canonical state, and checking current revision/lifecycle before reliance. The same pattern should govern durable execution.

Before any resumed step that can cause a consequential external effect or canonical mutation:

```text
resume LangGraph run
  -> load current Ember state
  -> acquire normal writer lease if mutation/reconciliation requires it
  -> verify objective is still live/current
  -> verify authority still permits this action
  -> compare expected/current canonical revision where relevant
  -> inspect unresolved effect attempts
  -> reconcile uncertainty before retry
  -> continue OR terminate/replan
```

This makes a LangGraph checkpoint a request to continue an operation, not proof that continuation is still semantically valid.

The rule also protects background cognition and intentional non-action. A durable runtime must not replay an old cognition opportunity after downtime merely because a checkpoint exists. Current opportunity/currentness semantics decide whether any work is still warranted.

## Replay, side effects, and uncertain effects

LangGraph solves **mechanical replay**. Ember still owns **semantic retry safety**.

### Completed task replay

For the Functional API, completed task results are reused when the entrypoint replays. This is useful for model calls, deterministic computation, and successful external reads whose result should stay fixed for that run.

### Incomplete task replay

A task that started but did not successfully finish may execute again after resume. Therefore an effectful task needs one of:

- an external idempotency key tied to the Ember effect attempt;
- an operation-specific read-before-write/reconciliation check;
- a durable external receipt that can prove the previous result;
- an Ember decision that retry is unsafe until a human or reconciliation path resolves uncertainty.

“LangGraph retried it” must never be treated as proof that retry was safe.

### Explicit replay/time travel

LangGraph can replay or fork from old checkpoints. Nodes after the chosen checkpoint execute again, including model calls, API requests, and interrupts. That is excellent for debugging pure workflows and dangerous around real effects.

For Ember, time travel should therefore be **test/debug machinery**, not a general recovery operation. Never replay a live effectful thread from an earlier checkpoint unless the adapter's idempotency/reconciliation contract makes each downstream effect safe.

### Model calls

Model calls are non-deterministic work. Within a durable operation they should live inside a task/node boundary whose output is checkpointed. Reusing a prior model output during resume is mechanically correct for one run, but that output is still evidence/proposal, not canonical current meaning. If canonical revision/currentness changed while suspended, Ember may need to discard the old output and replan rather than resume it.

## Interrupts and approvals

`interrupt()` is a strong mechanical match for “pause here, persist enough state, wait indefinitely, resume from another process”. It supports JSON-serializable payloads and resumes with `Command({ resume })` using the same thread ID.

The semantic firewall is mandatory because the runtime re-executes code before the interrupt when resuming:

- in a graph node, the node starts again from its beginning;
- in a Functional API entrypoint, the entrypoint replays from its beginning and restores completed task results;
- interrupt ordering must remain stable for in-flight runs;
- side effects before an interrupt must be idempotent or moved into their own durable task/node after approval.

A future Ember-facing seam might look like:

```text
ApprovalGate
  suspend(runRef, request: ApprovalRequest) -> SuspendedObservation
  resume(runRef, decision: ApprovalDecision) -> RunObservation
```

The LangGraph adapter may encode this with `interrupt` and `Command`. Ember owns:

- why approval is required;
- who may approve;
- what authority is granted or withheld;
- whether the decision is still current when resumed;
- how edits to proposed tool/action inputs change the authority/effect record.

An approval response should never mutate canonical state merely because `Command` can update graph state.

## Retry, timeout, cancellation, and graceful shutdown

### Retries and timeouts

LangGraph 1.4 supports per-node retry policies, timeouts, and error handlers. Those are useful mechanics but should be conservative by default for effectful Ember work.

A transient HTTP failure is not automatically retryable when the remote side may already have applied the request. Ember's existing distinction between timeout/cancellation and `outcome_unknown` must dominate generic retry classifications.

### Cancellation

LangGraph can cooperate with abort signals in execution paths, but no in-process cancellation primitive can prove that remote effects were absent or rolled back. Ember should continue recording cancellation intent separately from observed termination/effect evidence.

The correct adapter result is something like:

```text
CancellationObservation
  requested: true
  executionStopped: confirmed | unconfirmed
  effectStatus: none_known | known | uncertain
```

not a boolean `cancelled` that erases uncertainty.

### Graceful drain

`RunControl.requestDrain()` is particularly attractive for Ember's systemd topology. LangGraph can finish the current super-step, persist a resumable checkpoint, and stop with `GraphDrained`; the same config can resume on the next startup.

This maps well to SIGTERM from the external supervisor without transferring runtime ownership to LangGraph. Importantly, first-party docs state that drain **does not cancel in-flight async work**. A hard shutdown bound still needs a timeout/`AbortSignal`, and if the process dies before an external operation is observed terminal, Ember must classify the resulting uncertainty exactly as today.

**Recommendation: if LangGraph is ever adopted, include drain behavior in the first restart spike.**

## Memory facilities: explicitly reject their semantic names

LangGraph documentation calls checkpointer-backed thread state “short-term memory” and Store-backed cross-thread information “long-term memory”. Those are useful generic agent concepts but are not Ember's memory semantics.

Ember already distinguishes:

- continuity from provider/surface/runtime sessions;
- evidence from adopted meaning;
- current meaning from historical/superseded meaning;
- durable memory from selected context;
- provenance and uncertainty from convenience retrieval;
- live commitments from transcript history.

Therefore:

- checkpointer state is **execution state**, not Ember short-term memory;
- LangGraph Store is **optional operational/derived storage**, not Ember long-term memory;
- message history in graph state is not automatically evidence or current context;
- semantic retrieval from Store must not bypass Ember's selection/currentness/provenance rules.

If a future retrieval problem earns a LangGraph Store experiment, it should behave like a rebuildable candidate index over Ember-owned source records. That question belongs with retrieval evaluation, not with durable execution adoption.

## Tools and agent loops

LangGraph itself is low-level and can be used without adopting LangChain's top-level agent abstraction. That is a positive fit.

For a future bounded tool loop, Ember could use:

- Functional API tasks around model/tool calls;
- a custom StateGraph node sequence; or
- `ToolNode` for generic tool execution mechanics.

None of those may define authority. The safe shape remains:

```text
Ember capability/authority decision
  -> LangGraph-visible tool description
  -> Ember-owned execution wrapper
  -> effect evidence / uncertainty
  -> LangGraph operational result
```

A high-level `createAgent` or supervisor/swarm pattern is less attractive because it bundles message history, tool looping, routing, and thread lifecycle into the application's agent model. Issue #177 does not identify a failure in Ember that requires transferring those semantics.

**Recommendation: reuse lower-level task/tool mechanics if earned; avoid adopting a LangGraph-backed `Agent` as Ember.**

## Streaming and progress

LangGraph can stream full state values, state updates, model messages/tokens, custom data, and richer event projections. This is mechanically useful for specialist progress, approvals, debugging, and surfaces.

Do not expose LangGraph stream tuples/events directly through Ember APIs. Translate them into a deliberately small Ember-owned stream:

```text
ExecutionProgress
  started
  phase_changed
  progress
  awaiting_approval
  completed
  failed
  cancellation_requested
  outcome_unknown
```

Provider token events or debug snapshots can be optional details below that boundary. Canonical lifecycle remains the operational ledger/state model, not “the last event LangGraph emitted before the process disappeared”.

**Recommendation: wrap; easy to replace once event translation is centralized.**

## Subgraphs and delegation

Subgraphs are useful execution composition, but their persistence modes reveal exactly why they cannot define Ember specialist continuity:

- default per-invocation subgraphs start fresh for each call while inheriting enough parent checkpointing for interrupts/durable execution;
- per-thread subgraphs accumulate child state across calls;
- stateless subgraphs have no durable resume;
- per-thread state can conflict with parallel calls;
- checkpoint namespaces can depend on call ordering unless stable graph/node names are used.

For Ember, a specialist is not “whatever subgraph lives in this checkpoint namespace”. Specialist purpose, authority, disclosure, observations, cancellation uncertainty, and reintegration are already Ember-owned.

A LangGraph subgraph could one day execute the inside of a specialist adapter, but:

- specialist episode IDs remain Ember IDs;
- per-thread child memory is optional operational state;
- child completion is only delegated evidence;
- currentness/reintegration remains a separate Ember decision;
- replacing LangGraph may abandon/restart the operational subgraph without losing the specialist's durable semantic record.

Supervisor/swarm packages should be treated as higher-level orchestration patterns, not as definitions of Ember delegation.

## Observability and inspection

LangGraph has unusually good inspectability for a library runtime:

- checkpoint history exposes what state was durable and which nodes/tasks were next;
- interrupts/errors are visible in state snapshots;
- streaming can expose step-by-step progress;
- optional LangSmith tracing adds richer execution traces.

This is useful, but trace/checkpoint history is still operational evidence. A LangSmith trace ID must not replace Ember cognition/delegation/effect IDs, and losing trace retention must not erase a truth Ember needs to preserve.

A safe observability seam is provider-neutral:

```text
ExecutionTelemetry
  span(operationKind, emberRefs, attributes)
  event(kind, emberRefs, attributes)
```

LangGraph/LangSmith may implement automatic instrumentation beneath that seam. Hosted tracing should remain optional for a local/self-hosted Ember deployment.

## Replaceability and lock-in analysis

### Persisted-state lock-in

| LangGraph artifact | Removal cost if used | Mitigation |
| --- | --- | --- |
| `thread_id` / checkpoint IDs | Low if opaque operational refs | Never derive Ember identity from them; keep mapping outside canonical semantics |
| Checkpoint serialization | Medium for suspended runs | Treat database as operational; never require decoding it to reconstruct Ember truth |
| Graph state keys | Medium to high for in-flight Graph API runs | Keep private adapter schema small and versioned; drain/deprecate before incompatible changes |
| Node names | Medium for interrupted/in-flight runs | Stable versioned names; do not expose as Ember semantic vocabulary |
| Functional `task`/`interrupt` call order | High for in-flight runs during refactors | Small entrypoints, versioned definitions, drain old runs or introduce a new entrypoint |
| Task output schema | Medium | Use explicit adapter DTOs and version them; canonical meaning stays by reference |
| `Command` / interrupt payloads | Medium if leaked to callers | Translate to Ember-owned approval/resume types |
| Checkpoint namespaces/subgraph ordering | Medium | Stable adapter-owned graph names; avoid using namespace as specialist identity |
| LangGraph Store data | High if sole memory source | Do not store canonical meaning/authority/effect truth there; derived data must be rebuildable |
| LangSmith traces | Low | Treat as optional telemetry; retain necessary Ember evidence elsewhere |

### The important deployment constraint

LangGraph does **not** pin an in-flight thread to the workflow code version it started with. Current documentation says the latest deployed graph code is used when existing threads resume.

That makes deployment compatibility part of the durable execution contract:

- Graph API: old checkpoint state must still fit current schemas and referenced node names must still exist;
- Functional API: `task`/`interrupt` ordering before a resume point must remain compatible;
- business behavior may need an explicit execution version captured at run start.

This is not disqualifying. It simply means a LangGraph adapter needs an **in-flight migration policy** before production adoption:

1. drain old runs before incompatible deployment; or
2. keep old execution definitions available until their runs finish; or
3. abandon/reconcile and restart from an Ember-owned safe point; never migrate canonical meaning out of an opaque checkpoint.

### Replacement strategy

If Ember later replaces LangGraph with another runtime or custom code:

- completed checkpoints can be deleted according to retention policy;
- new operations start on the new executor;
- suspended old operations either finish on pinned old adapter code, are reconciled and restarted, or are explicitly abandoned;
- no unrelated core/provider/surface/delegation code should need LangGraph-state migration.

That is the target definition of successful encapsulation.

## Proposed Ember-owned seam

Do not create a generic `AgentFramework` interface. LangGraph's useful capability is narrower: durable execution of a bounded operation.

A conceptual port is sufficient:

```text
DurableExecutionPort
  start(kind, input, canonicalFence) -> RunObservation
  resume(runRef, resumeInput?, canonicalFence) -> RunObservation
  inspect(runRef) -> RunObservation
  requestCancel(runRef) -> CancellationObservation

OperationalRunRef
  engine
  executionDefinitionVersion
  opaqueRunId

CanonicalFence
  canonicalRevision
  objectiveRef?
  authorityRef?
```

The implementation may use Functional API or Graph API internally. Callers do not know about `thread_id`, `Command`, checkpoint namespaces, or graph state.

The port should **not** promise exactly-once effects. It promises resumable execution observations. Effect truth remains an Ember-owned concern.

## Concrete mapping to current Ember architecture

### Keep unchanged

**`src/core/`**

No LangGraph identifiers, state schemas, node names, `Command`, interrupts, or “memory” types belong in canonical Ember models. Lineage, evidence, meanings, currentness, authority semantics, opportunity/silence outcomes, cancellation uncertainty, and delivery truth stay independent.

**`src/persistence/state-store.ts`**

Keep canonical persistence, revision checks, cooperative writer lease, atomic replacement, and `DurabilityUncertain` handling Ember-owned. A LangGraph checkpointer is a second operational store, not a replacement.

**`src/providers/contract.ts`**

Keep `ProviderInvoker` as the cognition provider seam. LangGraph may orchestrate when a provider is called, but it need not become the model/provider contract. Provider `externalThreadId` and LangGraph `thread_id` remain unrelated opaque operational identifiers.

**`src/delegation/`**

Keep specialist purpose, authority, disclosure, cancellation/effect evidence, partial results, currentness, and reintegration semantics. Subgraphs may later implement mechanics below that line.

### Plausible future insertion point

Introduce a small runtime module only after a concrete operation earns it, for example:

```text
src/runtime/durable-execution.ts          Ember-owned port/types
src/runtime/langgraph-durable-execution.ts adapter implementation
```

No other module should import `@langchain/langgraph` directly.

The first candidate operation should be something naturally long-lived and approval-mediated, not ordinary one-shot cognition or a simple systemd wake.

### ADR 0007 remains the owner of process topology

LangGraph is an in-process/runtime library. It does not by itself replace systemd's responsibility for starting, supervising, and terminating Ember processes. `RunControl` can improve what happens **inside** a supervised worker during SIGTERM, but systemd remains the outer owner under the current topology.

That separation is desirable:

```text
systemd
  starts/stops worker
       |
       v
Ember runtime boundary
  loads canonical state / owns leases / records truth
       |
       v
DurableExecutionPort
       |
       v
LangGraph + operational checkpoint DB
```

## Operational fit

### Node 26 and TypeScript 7

The current `@langchain/langgraph` package declares `node >=18`, so Ember's Node 26 baseline is not excluded. The library is TypeScript-first and ships declarations.

However, the current repository's development compiler range still names TypeScript 4.9/5.4-era versions rather than TypeScript 7. Ember currently compiles with TypeScript 7.0.2. That is not evidence of incompatibility, but it means **TypeScript 7 compatibility should be proven rather than inferred** with an install/typecheck spike.

Recommendation:

- pin the exact LangGraph version used by the spike;
- compile a real adapter under Ember's current TS 7 config;
- avoid leaking framework types through public Ember contracts, which also reduces compiler/version coupling.

### Self-hosting and cloud coupling

Core LangGraph runs as an ordinary library and can be used without LangChain's high-level agent APIs or a hosted runtime. A persistent checkpointer can be provided directly in-process.

LangSmith tracing and Agent Server/deployment features are optional additions. They should remain optional for Ember. Adopting core LangGraph must not create a requirement for a cloud account or remote control plane.

### Persistence choices

For Ember's current single-host topology:

- `MemorySaver` is unsuitable for restart durability because it is process memory;
- `SqliteSaver` is the natural first spike because it is local and file-backed;
- Postgres/MongoDB/Redis are unnecessary operational weight unless a future multi-process/distributed requirement earns them.

First-party docs characterize SQLite as local/development oriented and Postgres as a production option. That is a reason to test actual durability/concurrency expectations rather than assuming SQLite is a production commitment.

### Raspberry Pi considerations

`@langchain/langgraph-checkpoint-sqlite` depends on `better-sqlite3`, which is a native module. On a Raspberry Pi 5 this creates practical questions absent from pure-JS package metadata:

- availability/compatibility of prebuilt ARM64 binaries for the selected Node 26 line;
- whether local compilation is required;
- install/disk delta;
- cold-start latency;
- idle/active RSS;
- checkpoint write latency in `sync` durability mode;
- database growth and pruning/retention behavior.

No benchmark was found that answers those for Ember's exact environment. Measure them before making LangGraph mandatory on the Pi.

### API maturity and churn

LangGraph has a stable v1 line and substantial ecosystem usage. Its documentation has explicit production guidance for checkpoint migrations and in-flight runs, which is a sign of runtime maturity.

At the same time, releases remain frequent: stable `1.4.14` was current while repository `main` already identified as `1.4.15-rc.0`. Newer 1.4 functionality includes node timeouts/error handling and cooperative drain. This argues for exact version pinning and contract tests around the adapter rather than importing current framework types throughout Ember.

## Focused restart/replacement spike

Documentation is sufficient to decide the architecture posture, but issue #177's most valuable implementation proof is small and concrete.

### Spike A: suspend -> process restart -> resume

Use the Functional API and a persistent SQLite checkpointer:

1. process A creates one versioned entrypoint;
2. it receives `canonicalRevision=N` plus opaque Ember refs;
3. a side-effect-free task completes;
4. the workflow calls `interrupt()` for approval;
5. process A exits completely;
6. process B reconstructs the same workflow and checkpointer;
7. before resume it reloads Ember canonical state;
8. with unchanged revision/currentness it resumes through `Command({ resume })` and completes;
9. repeat with canonical revision/objective changed and prove the adapter refuses the effectful continuation.

Assertions:

- the LangGraph thread ID is never used as lineage/provider/surface identity;
- canonical Ember state contains enough truth even if the checkpoint DB is deleted;
- completed task results do not rerun after restart;
- an unfinished effectful task is assumed retryable **only** when its Ember idempotency/reconciliation contract says so;
- SIGTERM drain produces a resumable observation without claiming in-flight async work was cancelled.

### Spike B: replacement boundary

Run one operation until suspended, then pretend LangGraph is being removed:

- inspect the old operational run through the port;
- classify it as suspended/needs reconciliation using Ember-owned metadata;
- either finish it with the old adapter or abandon/restart from a safe Ember checkpoint;
- start a new equivalent operation with a fake/custom `DurableExecutionPort` implementation;
- prove no canonical state migration or unrelated code change is required.

### Spike C: compiler/Pi gate

On Ember's actual deployment stack, measure:

- `npm install` and TS 7 compilation with the exact packages;
- Node 26 execution;
- SQLite native module behavior on ARM64;
- cold start and RSS;
- checkpoint DB growth and pruning;
- restart/resume under the actual systemd worker boundary.

Production adoption should wait for these results.

## Final recommendation matrix

| Area | Recommendation now | Why |
| --- | --- | --- |
| LangGraph as Ember architecture | **Avoid** | Graph/thread/state/memory concepts would take semantic ownership Ember intentionally keeps explicit |
| Functional API | **Strong candidate / wrap** | Gives durable mechanics while keeping ordinary TS control flow; replay/order constraints need a firewall |
| Graph API | **Revisit selectively** | Excellent for explicit operational workflows, but creates stronger topology/state coupling |
| Checkpointer abstraction | **Adopt candidate beneath executor** | Mature persistence interface; framework serialization must remain operational |
| SQLite checkpointer | **Spike first** | Best fit for single-host/local restart testing; native dependency and production limits need measurement |
| Postgres/Mongo/Redis checkpointers | **Revisit** | Useful only when stronger/distributed persistence is earned |
| `thread_id` / checkpoint IDs | **Wrap as opaque refs** | Required mechanics, never identity/continuity |
| Interrupt/resume | **Strong candidate / wrap** | Excellent approval and suspend mechanics if Ember authority/currentness stays outside |
| Retry/timeout | **Wrap conservatively** | Mechanical retry policy cannot decide effect safety |
| Graceful drain | **Strong candidate** | Fits systemd SIGTERM/restart well; still does not cancel in-flight async effects |
| Replay/time travel | **Avoid for live effects** | Intentionally re-executes downstream work; safe mainly for test/debug or rigorously idempotent workflows |
| Streaming | **Wrap** | Useful progress transport, low lock-in after event translation |
| LangGraph memory/Store as Ember memory | **Avoid** | Conflicts with provenance/currentness/history/context semantics |
| ToolNode/tasks for tool execution | **Revisit / wrap** | Good mechanics; capability/authority/effect evidence stay Ember-owned |
| High-level agent/supervisor/swarm | **Avoid as core** | Too much agent/delegation lifecycle ownership |
| Subgraphs | **Revisit beneath delegation** | Useful nested execution, but child state/thread is not specialist identity or responsibility |
| LangSmith observability | **Optional candidate** | Strong diagnostics, non-canonical if IDs/evidence remain Ember-owned |
| Agent Server / hosted runtime | **Avoid now** | Adds topology/control-plane ownership current Ember does not need |

## Answer to the key question

**Yes. LangGraph.js can provide a replaceable durable execution layer beneath Ember without making Ember graph-shaped, and the Functional API is the most promising route. But the replacement seam is viable only if LangGraph state remains operational and if Ember explicitly owns resume validation, effect reconciliation, identity, authority, and canonical persistence.**

The decisive constraints are not syntax. They are persisted-state and replay semantics:

```text
Ember semantics / canonical state
    |
    +-- currentness + authority + effect truth
    |
    +-- DurableExecutionPort
            |
            +-- LangGraph Functional API
            |      +-- checkpointer
            |      +-- task replay
            |      +-- interrupt/resume
            |      +-- drain/retry/streaming
            |
            +-- future custom/other runtime
```

If the LangGraph database can be discarded or drained without losing Ember meaning, and if replacing the implementation changes only the adapter plus handling of in-flight operational runs, the boundary is correct.

If Ember must decode a LangGraph checkpoint to remember who she is, what she was allowed to do, whether an effect happened, or what a delegated result means, the boundary has already failed.

## Sources

First-party/current material used for this evaluation:

- [LangGraph.js repository](https://github.com/langchain-ai/langgraphjs) and [`@langchain/langgraph` package metadata](https://www.npmjs.com/package/@langchain/langgraph).
- [Functional API overview](https://docs.langchain.com/oss/javascript/langgraph/functional-api) for `entrypoint`, `task`, replay, determinism, serialization, and side-effect/idempotency rules.
- [Graph API overview](https://docs.langchain.com/oss/javascript/langgraph/graph-api) for explicit state/node/edge execution.
- [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence) and [Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers) for thread/checkpoint/store semantics, state inspection, replay, durability modes, and persistence backends.
- [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) for `interrupt`, `Command({ resume })`, restart/re-execution behavior, and approval/tool patterns.
- [Fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance) for retries, timeouts, error handlers, cooperative drain, SIGTERM pattern, and the explicit limitation that drain does not cancel in-flight async work.
- [Backward compatibility](https://docs.langchain.com/oss/javascript/langgraph/backward-compatibility) for latest-code-on-old-checkpoint behavior, node/state compatibility, Functional API positional replay constraints, and deployment/drain guidance.
- [Time travel](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel) for replay/fork behavior.
- [Subgraphs](https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs) for per-invocation, per-thread, stateless persistence and checkpoint-namespace constraints.
- [Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming) for values/updates/messages/custom/event streams.
- [Memory overview](https://docs.langchain.com/oss/javascript/concepts/memory) for LangGraph's thread-scoped versus cross-thread memory terminology.
- [`@langchain/langgraph` package source metadata](https://github.com/langchain-ai/langgraphjs/blob/main/libs/langgraph-core/package.json) for Node engine, package dependencies, peer dependencies, and observed repository version.
- [`@langchain/langgraph-checkpoint-sqlite` package metadata](https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint-sqlite/package.json) for the `better-sqlite3` dependency and Node engine.
- [LangGraph.js releases](https://github.com/langchain-ai/langgraphjs/releases) for current stable/pre-release cadence.

The documentation is live and LangGraph moves quickly. Production integration should pin source/package versions and rerun the compatibility/restart spike rather than treating this 2026-09-07 observation as a permanent API guarantee.

## Issue #177 definition-of-done mapping

| Requirement | Result |
| --- | --- |
| Relevant LangGraph.js primitives inventoried | Primitive inventory plus per-area analysis above |
| Functional API and Graph API evaluated separately | Dedicated comparison with coupling/replay tradeoffs |
| Thread/checkpoint state distinguished from Ember continuity/canonical state | Explicit identity and checkpoint firewalls |
| Replay/side-effect/cancellation implications evaluated | Replay, incomplete tasks, idempotency, uncertainty, drain, cancellation sections |
| Attractive primitives have Ember-owned seams | `DurableExecutionPort`, approval gate, progress/telemetry translations |
| Replaceability and persisted-state lock-in analyzed | Lock-in table, deployment compatibility, replacement strategy |
| Runtime/dependency/self-hosting costs recorded | Node 26/TS 7, SQLite/native dependency, Pi measurement gate, optional cloud analysis |
| Current Ember architecture mapped | `src/core`, `StateStore`, provider, delegation, ADR 0007 mapping |
| Suitable for #175 synthesis | Final recommendation matrix uses adopt/wrap/avoid/revisit framing |
