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

**Do not make Ember a LangGraph graph, thread, or state machine. LangGraph.js is a
strong candidate for future durable-execution mechanics, especially through the
Functional API, but only behind a narrow Ember-owned execution boundary whose
persisted LangGraph state remains operational and replaceable.**

LangGraph is unusually relevant to issue
[#177](https://github.com/arhor/ember/issues/177) because its low-level runtime
already implements mechanics Ember should not casually reinvent: checkpointing,
restart/resume, interrupts, task-result replay, durability modes, retries, graceful
drain, state inspection, and subgraph execution.

The danger is equally specific. LangGraph uses `thread_id` to identify accumulated
execution state and describes checkpointer-backed state as short-term memory. Ember
must not inherit those meanings. A LangGraph thread may identify one operational
run; a checkpoint may make that run resumable; neither may define Ember lineage,
memory, authority, current truth, delegation responsibility, or effect evidence.

The recommended posture is:

1. Prefer the Functional API for a future narrow durable executor because
   `entrypoint` and `task` preserve ordinary TypeScript control flow.
2. Treat replay rules as a real compatibility contract. Completed task results can
   be restored, unfinished tasks may execute again, and in-flight Functional API
   runs are sensitive to `task`/`interrupt` call ordering.
3. Keep LangGraph persistence operational. Store execution mechanics and references
   to Ember truth, never the only authoritative copy of that truth.
4. Revalidate canonical Ember state, currentness, authority, and uncertain effects
   before every consequential continuation after resume.
5. Hide `thread_id`, checkpoint IDs, `Command`, `interrupt`, `StateSnapshot`, node
   names, and checkpoint namespaces behind adapter types.
6. Keep ADR 0007 as the process-topology decision until a concrete durable workflow
   earns more machinery.

In short: **LangGraph may remember where an operation was; Ember must remember what
it means.**

## Evaluation baseline

This evaluation was performed on **2026-09-07** against:

- Ember's [Design Principles](../principles.md), accepted ADRs, and
  [Architecture Acceptance Scenarios](acceptance-scenarios.md);
- [Long-Lived Runtime Requirements](long-lived-runtime-requirements.md), ADR 0007,
  and the current systemd-supervised episodic runtime;
- the current canonical `StateStore`, including revision, writer-lease, and
  `DurabilityUncertain` behavior;
- the current `ProviderInvoker` seam and specialist currentness/reintegration rules;
- stable `@langchain/langgraph@1.4.14`; repository `main` was already on
  `1.4.15-rc.0` during this review;
- the current first-party LangGraph JavaScript documentation and source linked in
  [Sources](#sources).

The stable package is mature and widely used, but the release cadence is fast.
Version pinning and adapter isolation are therefore part of the recommendation.

No install-size, cold-start, RSS, or Raspberry Pi measurement is claimed here. The
SQLite checkpointer also introduces `better-sqlite3`, a native dependency whose
Node 26/ARM behavior must be measured on Ember's actual Pi before adoption.

## Classification scale

- **Class 1, direct:** mechanics can sit below an Ember interface with little
  semantic translation.
- **Class 2, firewall:** useful mechanics, but LangGraph concepts/state/control flow
  must be translated and prevented from becoming Ember semantics.
- **Class 3, coupled:** adopting the primitive would strongly pull Ember toward
  LangGraph-owned workflow, memory, agent, or state meaning.
- **Class 4, irrelevant:** no current earned Ember requirement needs it.

## Primitive inventory

### Strong candidates

- **Functional API (`entrypoint`, `task`) — Class 2.** Best candidate for adding
  durable mechanics while normal Ember code remains ordinary TypeScript. It needs a
  replay/versioning firewall.
- **Checkpointer interface (`BaseCheckpointSaver`, serializer protocol) — Class 2.**
  Mature persistence mechanics, provided serialized state remains operational.
- **Interrupt/resume (`interrupt`, `Command({ resume })`) — Class 2.** Excellent
  suspend/approval mechanism, provided approval semantics and currentness remain
  Ember-owned.
- **Graceful drain (`RunControl`, `requestDrain`, `GraphDrained`) — Class 1/2.**
  Strong fit for systemd SIGTERM and restart. Drain does not cancel in-flight async
  work, so Ember still owns uncertainty.
- **State/history inspection (`getState`, `getStateHistory`) — Class 2.** Excellent
  diagnostics for operational runs, never canonical Ember history.
- **Streaming — Class 2.** Useful progress transport after translating events into
  Ember-owned progress vocabulary.

### Useful with stronger caveats

- **Graph API (`StateGraph`, schemas, nodes, edges, reducers) — Class 2 for an
  isolated operational workflow, Class 3 as Ember's domain architecture.** Use only
  when a particular operation is naturally graph-shaped.
- **SQLite checkpointer — Class 2.** Natural first local restart spike; the native
  dependency and first-party “local workflows” positioning require measurement
  before production commitment.
- **Postgres/MongoDB/Redis checkpointers — Class 2.** Plausible production backends
  if later topology earns them; unnecessary weight today.
- **Retry/timeout/error handling — Class 2.** Good runtime mechanics, but generic
  retry policy must never decide whether an uncertain external effect is safe to
  repeat.
- **Tool tasks/`ToolNode` — Class 2.** Useful execution plumbing if Ember later owns
  an in-process tool loop; capability is not authority.
- **Subgraphs — Class 2 mechanically, Class 3 if treated as delegation semantics.**
  Useful nested execution, but child thread/state is not specialist identity or
  responsibility.
- **LangSmith tracing — Class 2.** Useful optional observability if Ember IDs remain
  primary and trace storage is non-canonical.

### Avoid as semantic owners

- **LangGraph `thread_id` as continuity — Class 3.** It is an execution locator, not
  Ember identity.
- **Checkpointer “short-term memory” as Ember memory — Class 3.** Thread-scoped graph
  state does not satisfy Ember provenance/currentness/history semantics.
- **LangGraph Store “long-term memory” as Ember memory — Class 3.** Cross-thread KV
  and retrieval can be useful infrastructure, but must not become canonical
  meanings or bypass context selection.
- **Replay/time travel for live effectful work — Class 3.** Replays downstream model
  calls, APIs, and interrupts; safe mainly for test/debug or rigorously fenced
  effects.
- **High-level LangChain agent loops and supervisor/swarm patterns — Class 3.** They
  bundle too much agent/delegation lifecycle meaning for Ember's current design.
- **Agent Server/hosted runtime as Ember's runtime owner — Class 3/4 now.** It adds a
  resident/control-plane topology Ember has not earned.

## Functional API versus Graph API

### Functional API: the better semantic shape

The Functional API is the most interesting LangGraph surface for Ember. Current
first-party documentation explicitly describes it as a way to add persistence,
human-in-the-loop, memory, and streaming to existing code while retaining ordinary
branching, loops, and function calls.

A future operation can therefore remain recognizable TypeScript:

```text
entrypoint
  ordinary TypeScript control flow
    -> task(...)
    -> task(...)
    -> interrupt(...)
    -> task(...)
```

That is a meaningful advantage. Ember does not need to become a domain graph merely
because one operation needs durable suspend/resume.

The price is replay discipline. On resume, a Functional API entrypoint starts again
from the beginning. Completed task/subgraph results are restored from checkpoints,
but ordinary code between those calls executes again.

Consequences:

- non-deterministic work that affects control flow belongs inside a `task`;
- side effects belong inside tasks and still require idempotency or reconciliation;
- a task that started but did not finish may execute again;
- time/random/network calls outside tasks can make resumed control flow diverge;
- adding, removing, or reordering `task` or `interrupt` calls before the resume point
  can associate cached/resume values with the wrong call;
- non-trivial changes with in-flight runs require draining or versioning.

That is acceptable for a **small, versioned execution adapter**. It is a poor reason
to make arbitrary Ember cognition “durable by decoration”.

**Recommendation: prefer Functional API for bounded durable operations, with small
versioned entrypoints and stable task/interrupt structure.**

### Graph API: clearer checkpoints, stronger conceptual gravity

The Graph API exposes state schemas, nodes, reducers, and edges explicitly. It is
highly inspectable, and plain nodes resume by re-running from the interrupted node's
beginning rather than replaying one large entrypoint.

It is also less position-sensitive than the Functional API when node bodies do not
use tasks or interrupts. Current backward-compatibility guidance says edge topology
itself is generally not persisted, while node names and state keys are persisted
contracts for in-flight threads.

The danger is architectural gravity. A graph called `EmberState`, with nodes such as
`remember`, `decide`, `delegate`, or `be_silent`, would turn runtime topology into a
theory of Ember.

A safe Graph API state is instead private operational data:

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

Those fields describe one operation, not Ember herself.

**Recommendation: use Graph API only where the operation is naturally graph-shaped,
and keep its state private to the adapter.**

## Thread identity must remain operational

LangGraph checkpointers use `thread_id` as the primary key for checkpoints and as the
identity required to resume interrupts.

For Ember:

```text
Ember lineageId
  != LangGraph thread_id
  != provider externalThreadId
  != surface conversation/chat ID
  != specialist runtime/session ID
```

A future adapter should expose something deliberately boring:

```text
OperationalRunRef {
  engine: "langgraph"
  executionDefinitionVersion: 1
  opaqueRunId: "..."
}
```

`opaqueRunId` may internally map to a LangGraph thread UUID. It should never be
derived from lineage, user principal, Telegram chat, or provider thread identity
merely for convenience.

Replacing LangGraph may make an unfinished operation require reconciliation or
restart. It must never make Ember forget who she is or what she knows.

## Checkpoints: resumable mechanics, not canonical state

LangGraph checkpoints contain graph values, next-node information, task/error and
interrupt metadata, checkpoint IDs, namespaces, and parent relationships. These are
excellent execution artifacts and the wrong place for Ember's only durable truth.

A safe checkpoint may contain:

- operation kind and execution-definition version;
- the canonical Ember revision observed at start;
- opaque objective, authority, cognition/delegation, and effect-attempt references;
- bounded immutable input already disclosed to the operation;
- task results required for replay;
- pending approval and resume data;
- idempotency keys and reconciliation hints;
- non-canonical progress/debug metadata.

A checkpoint must not be the sole authoritative home for:

- Ember lineage or constitutive boundaries;
- canonical meanings, supersession/currentness, or retained evidence;
- authority grants or capability policy;
- delegation responsibility or reintegration decisions;
- cancellation/effect evidence whose loss would force Ember to guess what happened;
- delivery truth or other durable observations already owned by Ember.

The boundary test is simple: **deleting the LangGraph checkpoint database may
destroy resumability, but it must not destroy Ember truth.**

### Durability modes

LangGraph exposes `exit`, `async`, and `sync` durability modes.

- `exit` persists when execution exits and cannot recover an intermediate crash.
- `async` persists while the next step runs and retains a small crash window.
- `sync` persists before the next step starts and gives the strongest checkpoint
  ordering at additional cost.

Ember should choose per operation. For consequential work whose restart correctness
depends on the previous phase being durable before the next one begins, `sync` is
the natural baseline to evaluate.

That does not replace Ember's own durability ordering. If an effect attempt must be
recorded before the external action, that record belongs through Ember's existing
canonical operational boundary before LangGraph crosses the effect boundary.

## Resume firewall: current Ember truth wins

A resumable checkpoint is not permission to continue.

Current specialist reintegration already reacquires or reuses the writer lease,
reloads canonical state, and rejects stale currentness before relying on a result.
The same principle should govern durable execution.

Before a resumed step can cause a consequential effect or canonical mutation:

```text
resume operational run
  -> load current Ember state
  -> acquire normal writer lease if required
  -> verify objective is still live/current
  -> verify authority still permits the action
  -> compare canonical revision where relevant
  -> inspect unresolved prior effect attempts
  -> reconcile uncertainty before retry
  -> continue OR terminate/replan
```

A LangGraph checkpoint is therefore a request to continue an operation, not proof
that continuation is still semantically valid.

This also protects background cognition and intentional non-action. Restart must not
replay an old cognition opportunity merely because a durable execution record
exists. Current Ember opportunity/currentness semantics decide whether work is still
warranted.

## Replay, side effects, and uncertain effects

LangGraph solves **mechanical replay**. Ember still owns **semantic retry safety**.

For the Functional API, completed task outputs are reused on resume. This is useful
for one run's model outputs and external reads because already completed work need
not be repeated.

An unfinished task is different. It may execute again. An effectful task therefore
needs at least one of:

- an external idempotency key tied to an Ember effect attempt;
- operation-specific read-before-write/reconciliation;
- an external receipt that proves the prior result;
- an Ember decision that retry is unsafe until uncertainty is resolved.

“LangGraph retried it” must never imply “retry was safe”.

Explicit time travel is even sharper. Replaying from an earlier checkpoint runs
nodes after that checkpoint again, including model calls, API requests, and
interrupts. For Ember this should be test/debug machinery by default, not ordinary
recovery for live effectful work.

Model calls are also non-deterministic work. They belong inside checkpointed
task/node boundaries when participating in a durable run. Reusing a previous model
result after resume is mechanically valid for that run, but the result remains
evidence/proposal. If canonical currentness changed during suspension, Ember may
need to discard it and replan.

## Interrupts and approvals

`interrupt()` is a strong mechanical match for “pause, persist, wait indefinitely,
then resume from another process”. It accepts serializable payloads and resumes with
`Command({ resume })` under the same thread ID.

The semantic firewall remains necessary because code before the interrupt can run
again:

- a Graph API node restarts from its beginning;
- a Functional API entrypoint replays from its beginning while restoring completed
  task results;
- interrupt ordering must remain stable for in-flight runs;
- effects before an interrupt must be idempotent or moved behind approval into a
  separate durable task/node.

A future Ember-facing seam can remain framework-neutral:

```text
ApprovalGate
  suspend(runRef, request) -> SuspendedObservation
  resume(runRef, decision) -> RunObservation
```

LangGraph may implement that with `interrupt` and `Command`. Ember owns why approval
is required, who may approve, what authority the response grants, whether it is
still current, and how edited action arguments change effect evidence.

## Retry, cancellation, and graceful shutdown

LangGraph 1.4 provides useful per-node retry policies, timeouts, and error handlers.
They should be conservative by default for effectful Ember work. A transient network
failure is not automatically safe to retry if the remote side may already have
applied the request.

Cancellation must preserve Ember's current uncertainty model. An abort signal can
stop cooperating local execution but cannot prove that remote work never happened or
was rolled back.

The adapter should expose an observation shaped conceptually like:

```text
CancellationObservation
  requested: true
  executionStopped: confirmed | unconfirmed
  effectStatus: none_known | known | uncertain
```

rather than a boolean `cancelled` that erases uncertainty.

`RunControl.requestDrain()` is particularly attractive for ADR 0007. Current docs
show a SIGTERM pattern that lets the current super-step finish, writes a resumable
checkpoint, and exits through `GraphDrained`; the same config can resume later.

The same docs explicitly state that drain **does not cancel in-flight async work**.
A hard shutdown bound still needs timeout/`AbortSignal`, and if an external operation
is not observed terminal before process death Ember must preserve the uncertainty.

**Recommendation: include graceful drain in the first restart spike.**

## Memory facilities: reject their semantic names

LangGraph documentation describes checkpointer-backed thread state as short-term
memory and Store-backed cross-thread information as long-term memory. These are
reasonable generic agent terms and do not match Ember's memory model.

Ember already distinguishes continuity, evidence, adopted meaning, currentness,
history, selected context, provenance, uncertainty, and commitments.

Therefore:

- checkpointer state is **execution state**, not Ember short-term memory;
- LangGraph Store is optional **operational/derived storage**, not Ember long-term
  memory;
- graph message history is not automatically evidence or current context;
- Store retrieval must never bypass Ember selection/currentness/provenance rules.

A future retrieval experiment may test a LangGraph Store as a rebuildable derived
index. That is a retrieval concern, not a reason to adopt LangGraph memory semantics.

## Tools, agents, subgraphs, and delegation

LangGraph's low-level nature is a positive fit: core durable execution can be used
without adopting a high-level LangChain agent as Ember.

For a future bounded tool loop, Ember could use Functional API tasks, custom graph
nodes, or `ToolNode` below the existing semantic boundary:

```text
Ember capability/authority decision
  -> LangGraph-visible tool description
  -> Ember-owned execution wrapper
  -> effect evidence / uncertainty
  -> operational LangGraph result
```

High-level `createAgent`, supervisor, or swarm patterns are less attractive because
they bundle message history, tool looping, routing, and thread lifecycle into an
agent/delegation model Ember already defines more carefully.

Subgraphs are useful mechanics but cannot define specialist continuity. Current
subgraph persistence modes make that especially clear:

- default per-invocation subgraphs start fresh per call while inheriting enough
  parent checkpointing for interrupts/durable execution;
- per-thread subgraphs accumulate child state across calls;
- stateless subgraphs have no durable resume;
- per-thread child state can conflict with parallel calls;
- checkpoint namespaces can depend on call order unless stable graph/node names are
  used.

For Ember, specialist purpose, authority, disclosure, observations, cancellation
uncertainty, and reintegration remain Ember-owned. A subgraph may later implement
the inside of a specialist adapter, but child completion remains delegated evidence,
not canonical acceptance.

## Streaming, testing, and observability

LangGraph can stream state values, updates, model messages/tokens, custom data, and
event projections. This is useful for progress, approval surfaces, and debugging.

Do not expose LangGraph event shapes directly. Translate them into a small
Ember-owned vocabulary such as:

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

Testing can likewise remain deterministic at the boundary. A fake/in-memory
checkpointer is sufficient for unit/contract tests of replay shape, while explicit
restart tests should use the real persistent backend under consideration. Model and
tool tasks can be replaced with deterministic fakes so core acceptance scenarios do
not require a live provider.

Operational debugging is one of LangGraph's strengths: checkpoints expose current
state, pending nodes/tasks, interrupts, errors, and history. Optional LangSmith
tracing adds richer traces.

Those artifacts remain non-canonical. LangGraph/LangSmith IDs may be attached to
Ember cognition/delegation/effect IDs, never replace them. Hosted tracing must remain
optional for local/self-hosted Ember.

## Replaceability and lock-in

The important lock-in surfaces are:

- **Thread/checkpoint IDs:** low cost if kept as opaque operational references.
- **Checkpoint serialization:** medium cost for suspended runs. Ember must never
  require decoding it to reconstruct canonical truth.
- **Graph state keys and node names:** medium-to-high cost for in-flight Graph API
  runs. Keep the schema private, small, versioned, and drain before incompatible
  changes.
- **Functional `task`/`interrupt` call order:** high compatibility sensitivity for
  in-flight runs. Keep entrypoints small and versioned; drain or introduce a new
  execution definition before incompatible refactors.
- **Task output schemas:** medium cost. Use explicit adapter DTOs; canonical meaning
  remains by reference.
- **`Command` and interrupt payloads:** medium cost if leaked. Translate them into
  Ember-owned approval/resume types.
- **Subgraph namespaces:** medium cost. Stable adapter-owned names only; never use a
  namespace as specialist identity.
- **LangGraph Store data:** high cost if it becomes the sole memory source. Keep
  canonical meaning elsewhere and derived data rebuildable.
- **LangSmith traces:** low cost if telemetry is optional.

### Latest code runs against old checkpoints

This is the most important production constraint found in the research.

Current LangGraph backward-compatibility guidance says in-flight threads are **not
pinned to the code version they started with**. Existing checkpoints resume under
the latest deployed graph code.

That means deployment compatibility is part of the durable execution contract:

- Graph API checkpoints must still satisfy current state schemas and referenced node
  names must still exist;
- Functional API task/interrupt ordering before a resume point must remain compatible;
- business behavior may require an explicit execution-definition version recorded
  when the run starts.

Before production adoption Ember therefore needs an in-flight migration policy:

1. drain old runs before incompatible deployment; or
2. keep an old execution definition available until those runs finish; or
3. reconcile/abandon and restart from an Ember-owned safe point.

Canonical meaning must never need migration out of an opaque checkpoint.

### Replacement strategy

If LangGraph is later removed:

- new operations start on the replacement executor;
- completed checkpoint history can be deleted according to retention policy;
- suspended runs either finish with the old adapter, reconcile and restart, or are
  explicitly abandoned;
- unrelated core/provider/surface/delegation code does not change;
- no canonical Ember-state migration is required.

That is the target definition of successful encapsulation.

## Proposed Ember-owned seam

Do not create a generic `AgentFramework` interface. The useful LangGraph capability
is narrower: durable execution of one bounded operation.

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

The adapter may use Functional API or Graph API internally. Callers do not know
about `thread_id`, `Command`, checkpoint namespaces, or graph state.

The port deliberately does **not** promise exactly-once effects. It promises
resumable execution observations. Effect truth remains Ember-owned.

## Mapping to current Ember architecture

### Keep unchanged

**`src/core/`** stays framework-free. No LangGraph IDs, graph schemas, node names,
commands, interrupts, or “memory” types belong in canonical models.

**`src/persistence/state-store.ts`** keeps canonical persistence, revision checks,
writer lease, atomic replacement, and `DurabilityUncertain` handling. A LangGraph
checkpointer is a second operational store, never a replacement.

**`src/providers/contract.ts`** remains the cognition provider seam. LangGraph may
orchestrate when a provider is called but need not become the provider abstraction.
Provider `externalThreadId` and LangGraph `thread_id` remain unrelated opaque IDs.

**`src/delegation/`** keeps specialist purpose, authority, disclosure, partial/final
observations, cancellation/effect uncertainty, currentness, and reintegration.
Subgraphs may later implement mechanics below that boundary.

### Plausible future insertion point

Only after a concrete operation earns durability, add a narrow runtime module, for
example:

```text
src/runtime/durable-execution.ts
src/runtime/langgraph-durable-execution.ts
```

No unrelated module should import `@langchain/langgraph` directly.

The first candidate should be a naturally long-lived approval-mediated operation,
not ordinary one-shot cognition or a simple systemd wake.

### ADR 0007 remains process owner

LangGraph is an in-process execution library. It does not replace systemd's current
responsibility for starting, supervising, and terminating workers.

A clean layering is:

```text
systemd
  -> Ember runtime boundary
       -> canonical StateStore / leases / truth
       -> DurableExecutionPort
            -> LangGraph + operational checkpoint DB
```

`RunControl` may improve graceful behavior inside the worker without transferring
outer runtime ownership to LangGraph.

## Operational fit

### Node 26 and TypeScript 7

Current `@langchain/langgraph` declares `node >=18`, so Ember's Node 26 baseline is
not excluded. The package is TypeScript-first and ships declarations.

The current repository development compiler range still names TypeScript 4.9/5.4
rather than TypeScript 7. Ember compiles with TypeScript 7.0.2. That is not evidence
of incompatibility, but it means compatibility should be proven with the actual
Ember compiler/config rather than inferred.

Pin the exact LangGraph version, compile a real adapter under Ember's current
TypeScript config, and keep framework types out of public core contracts.

### Dependency footprint

The stable npm package currently reports four direct runtime dependencies and is
normally installed alongside `@langchain/core`; `zod` is also a peer dependency in
the current package metadata. This is substantially more production dependency
surface than Ember currently carries, but still library-scale rather than a required
server stack.

No measured bundle/install/RSS cost is claimed. Measure the exact package subset
before adoption.

### Self-hosting and persistence

Core LangGraph runs as an ordinary local Node library. LangSmith and Agent
Server/deployment products are optional and must remain optional for Ember.

For the current single-host topology:

- `MemorySaver` is unsuitable for process-restart durability;
- `SqliteSaver` is the natural first local spike;
- Postgres/MongoDB/Redis are unnecessary until a stronger or distributed topology
  earns them.

First-party documentation describes SQLite as appropriate for local workflows and
Postgres as a production-oriented option. Do not turn the first spike into a storage
commitment by accident.

### Raspberry Pi

`@langchain/langgraph-checkpoint-sqlite` depends on `better-sqlite3`. On the Pi 5,
measure:

- Node 26/ARM64 native-module installation behavior;
- whether a local build is required;
- install/disk delta;
- cold-start latency and idle/active RSS;
- checkpoint latency under `sync` durability;
- database growth and retention/pruning behavior.

No benchmark found during this review answers those for Ember's exact environment.

### API maturity

LangGraph has a stable v1 line, substantial ecosystem usage, and explicit production
guidance for checkpoint compatibility and in-flight migrations. That is good evidence
of runtime maturity.

It also moves quickly: stable `1.4.14` was current while repository `main` already
identified as `1.4.15-rc.0`. Exact version pinning and adapter contract tests are
appropriate.

## Focused restart/replacement spikes

Documentation is sufficient for the architecture posture. Production adoption should
still require three small proofs.

### A. Suspend -> process restart -> resume

Use Functional API plus persistent SQLite:

1. process A starts a versioned entrypoint with `canonicalRevision=N` and opaque
   Ember references;
2. a side-effect-free task completes;
3. the run interrupts for approval;
4. process A exits completely;
5. process B rebuilds the same entrypoint/checkpointer;
6. it reloads current Ember canonical state before resume;
7. unchanged currentness resumes and completes;
8. changed revision/objective refuses the effectful continuation.

Also assert that completed task results do not rerun, and that unfinished effectful
tasks are retried only when Ember's idempotency/reconciliation contract permits it.

Repeat shutdown through `RunControl.requestDrain()` under the actual systemd worker.

### B. Replacement boundary

Suspend a run, then pretend LangGraph is being removed:

- inspect/classify the old operation through the Ember-owned port;
- finish it with the old adapter or reconcile and abandon/restart it;
- start an equivalent new operation through a fake/custom port implementation;
- prove no canonical state migration or unrelated code change is required.

### C. Compiler/Pi gate

On Ember's real deployment stack, verify:

- exact-package install and TypeScript 7 compilation;
- Node 26 execution;
- SQLite native dependency on ARM64;
- cold start and RSS;
- checkpoint growth/retention;
- restart/resume through actual systemd supervision.

## Recommendations for #175 synthesis

- **LangGraph as Ember architecture:** avoid.
- **Functional API:** strong candidate, wrap.
- **Graph API:** revisit selectively for naturally graph-shaped operations.
- **Checkpointer abstraction:** adopt candidate beneath a durable executor.
- **SQLite checkpointer:** first spike candidate, not canonical storage.
- **Other checkpointers:** revisit when stronger persistence is earned.
- **Thread/checkpoint IDs:** wrap as opaque operational references.
- **Interrupt/resume:** strong candidate, wrap behind Ember approval semantics.
- **Retry/timeout:** wrap conservatively; never infer effect safety.
- **Graceful drain:** strong mechanical candidate for systemd workers.
- **Replay/time travel:** avoid for live effects by default.
- **Streaming:** wrap behind Ember-owned progress events.
- **LangGraph memory/Store as Ember memory:** avoid.
- **Tool tasks/`ToolNode`:** revisit beneath authority/effect wrappers.
- **High-level agent/supervisor/swarm:** avoid as Ember core/delegation owner.
- **Subgraphs:** revisit beneath delegation mechanics only.
- **LangSmith:** optional observability candidate.
- **Agent Server/hosted runtime:** avoid for current topology.

## Answer to the key question

**Yes. LangGraph.js can provide a replaceable durable-execution layer beneath Ember
without making Ember graph-shaped, and the Functional API is the most promising
route. The seam is viable only if LangGraph state remains operational and Ember
explicitly owns resume validation, effect reconciliation, identity, authority,
delegation, and canonical persistence.**

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

If deleting the checkpoint database only loses resumability, and replacing LangGraph
only changes the adapter plus handling of in-flight operational runs, the boundary is
correct.

If Ember must decode a LangGraph checkpoint to remember who she is, what she was
allowed to do, whether an effect happened, or what a delegated result means, the
boundary has failed.

## Sources

First-party/current material used for this evaluation:

- [LangGraph.js repository](https://github.com/langchain-ai/langgraphjs) and
  [`@langchain/langgraph` package](https://www.npmjs.com/package/@langchain/langgraph).
- [Functional API](https://docs.langchain.com/oss/javascript/langgraph/functional-api)
  for `entrypoint`, `task`, replay, determinism, serialization, and idempotency.
- [Graph API](https://docs.langchain.com/oss/javascript/langgraph/graph-api) for
  explicit state/node/edge execution.
- [Persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence) and
  [Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)
  for thread/checkpoint/store semantics, durability modes, replay, and backends.
- [Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) for
  `interrupt`, `Command({ resume })`, re-execution, and approval patterns.
- [Fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance)
  for retries, timeouts, error handlers, cooperative drain, and SIGTERM behavior.
- [Backward compatibility](https://docs.langchain.com/oss/javascript/langgraph/backward-compatibility)
  for latest-code-on-old-checkpoint behavior, graph migration constraints, and
  Functional API positional replay compatibility.
- [Time travel](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel)
  for replay/fork behavior.
- [Subgraphs](https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs) for
  per-invocation, per-thread, and stateless persistence behavior.
- [Streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming) for
  values, updates, messages, custom data, and event streams.
- [Memory overview](https://docs.langchain.com/oss/javascript/concepts/memory) for
  LangGraph's thread-scoped versus cross-thread memory terminology.
- [`@langchain/langgraph` package metadata](https://github.com/langchain-ai/langgraphjs/blob/main/libs/langgraph-core/package.json)
  for Node engine, dependencies, peers, compiler metadata, and observed repository
  version.
- [`@langchain/langgraph-checkpoint-sqlite` metadata](https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint-sqlite/package.json)
  for the `better-sqlite3` dependency and Node engine.
- [LangGraph.js releases](https://github.com/langchain-ai/langgraphjs/releases) for
  current release cadence.

LangGraph moves quickly. Any production integration should pin package versions and
rerun the compatibility/restart spike rather than treating this 2026-09-07 snapshot
as a permanent API guarantee.

## Issue #177 definition-of-done mapping

- **Primitive inventory:** classified above as direct, firewall, coupled, or
  currently irrelevant/avoid.
- **Functional vs Graph API:** evaluated separately with different replay and
  compatibility costs.
- **Thread/checkpoint vs Ember continuity:** explicit identity and persistence
  firewalls above.
- **Replay/side effects/cancellation/uncertainty:** dedicated replay, approval,
  cancellation, and graceful-shutdown analysis.
- **Ember-owned seams:** `DurableExecutionPort`, approval gate, progress translation,
  and resume-time canonical firewall.
- **Replaceability:** persisted-state lock-in, latest-code compatibility, migration,
  and replacement strategy documented explicitly.
- **Operational fit:** Node 26, TypeScript 7 gate, dependency footprint, self-hosting,
  SQLite/native-module/Pi considerations, and API maturity recorded.
- **Suitable for #175:** recommendations use the common adopt/wrap/avoid/revisit
  framing.
