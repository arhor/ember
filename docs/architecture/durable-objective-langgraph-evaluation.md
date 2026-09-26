---
summary: "Issue #239 evidence-based evaluation deferring LangGraph.js adoption after comparing its durable execution primitives with Ember's implemented durable objectives, approvals, effects, and restart behavior."
read_when:
  - "Deciding whether Ember's implemented durable objectives justify adopting LangGraph.js"
  - "Changing objective checkpoint, resume, approval, effect replay, cancellation, or operational persistence mechanics"
  - "Revisiting the replacement seam and measurable triggers for a durable execution framework"
role: design
discovery_status: current
---

# Durable Objective LangGraph.js Evaluation

## Decision

**Defer LangGraph.js adoption.** The concrete implementation from issues
[#237](https://github.com/arhor/ember/issues/237) and
[#238](https://github.com/arhor/ember/issues/238) does not expose a durable-execution
gap large enough to justify a second agent runtime, checkpoint store, or replay model.

Ember's current mechanics already preserve objective identity and truthful progress
across processes and providers; require a fresh currentness assessment before each
later episode; distinguish partial, failed, running, and uncertain work; carry exact
proposal approval across restarts; revalidate before an effect; prevent duplicate
execution; and reintegrate confirmed, failed, or uncertain effect evidence. LangGraph
could automate suspension and execution-position recovery inside a multi-step run,
but the implemented objective flow has no resident or framework-owned run to suspend:
each episode ends at an explicit Ember boundary and the next episode is deliberately
created from current canonical truth.

Adoption now would therefore add operational state without replacing the hard parts.
Ember would still own objective identity, lifecycle, currentness, provenance,
authority, approval correlation, effect truth, completion, and reintegration. The
recommendation is **defer**, rather than reject, because a future bounded operation
with many restart-sensitive internal steps may earn LangGraph's Functional API.

## Evidence baseline

This evaluation was performed on **2026-09-17** against the merged implementation at
`510b18c`, including:

- `../../src/core/objectives`: 729 lines implementing the versioned
  Ember-owned objective ledger, validation, serialized/cross-process mutation,
  currentness assessment, episode reconciliation, checkpoint recording, and
  completion rules;
- `../../src/core/app`: 158 lines binding proposals to an exact
  objective revision, source episode, and step, revalidating them, and reintegrating
  effect outcomes;
- issue #238 also added 38 lines to `ActionProposalStore`, 10 lines to the Calendar
  effect path, and changed 38 lines in each of the CLI and Telegram surfaces to carry
  objective correlation and revalidation through their existing action paths;
- 783 lines of focused tests in the adjacent objective test files, including true
  store reconstruction, fresh provider/session evidence, uncertain interruption,
  concurrent evidence, later approval, duplicate-effect prevention, and uncertain
  effect reintegration;
- [Durable Objective Lifecycle and Ownership Semantics](durable-objective-lifecycle.md),
  [Durable Action Proposal and Approval Correlation](durable-action-proposal-approval.md),
  and the accepted operational-continuity and authority decisions.

Across the six touched production files, issues #237/#238 added 983 lines and removed 28. The 887 lines under `../../src/core/objectives` are the cohesive objective-store/coordinator
core; the other changes extend the existing action and surface boundaries. Line counts
describe maintenance surface, not automatically replaceable framework boilerplate.
Most of the core validates Ember meanings and causal evidence, while the other paths
preserve correlation at the effect boundary. LangGraph does not remove either
responsibility. Without an adoption prototype, assigning a smaller exact replaceable
line count would be false precision.

The comparison uses stable `@langchain/langgraph@1.4.15`,
`@langchain/langgraph-checkpoint-sqlite@1.0.4`, and current first-party documentation.
The operational evidence below comes from a pinned, disposable spike rather than an
Ember dependency or adoption prototype.

## Concrete comparison

| Requirement                            | Current Ember implementation                                                                                                                                                                                | LangGraph.js Functional API                                                                                                                                                                       | Net result now                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durable checkpoints                    | One atomic, versioned objective sidecar records attributable checkpoints against acceptance conditions, assumptions, uncertainty, and source episodes.                                                      | A checkpointer persists task results, execution position, interrupts, and thread history with selectable durability.                                                                              | LangGraph would add useful operational checkpoints but cannot replace the semantic ledger. Two stores or semantic duplication would result.                                               |
| Suspend/resume and human approval      | An episode records a proposal and exits. A later process loads the same objective and proposal, verifies exact approval, rechecks currentness, and starts a new episode. No provider session remains alive. | `interrupt()` persists graph state and resumes with `Command({ resume })` under the same `thread_id`; the interrupted node/function executes again according to replay rules.                     | The framework shortens control-flow plumbing only if one workflow invocation must remain suspended. The implemented flow needs durable evidence, not a suspended invocation.              |
| Functional resume/recovery             | Resume reconciles every running episode, preserves unknown outcomes, and never repeats an effect whose durable attempt is already confirmed or uncertain.                                                   | Resume re-enters the entrypoint from its beginning, restores completed task/subgraph results, and may rerun unfinished tasks. Non-task code runs again and interrupt matching is order-sensitive. | The useful restoration works in the spike, but unfinished effects still need Ember idempotency/reconciliation and entrypoint evolution needs discipline.                                  |
| Optional Graph API time travel         | Ember has no production requirement to fork or replay an objective from historical execution position.                                                                                                      | An intentionally selected historical checkpoint re-executes downstream nodes, including model calls, API requests, and interrupts.                                                                | This is a separate, optional capability and is not charged as a cost of the proposed Functional API seam. It should remain disabled for live effectful work unless separately earned.     |
| Progress/state handoff                 | Checkpoints carry observable progress and evidence; only a new currentness assessment selects a next step. Provider and runtime IDs remain episode evidence.                                                | Checkpointed task outputs and graph state pass operational data between invocations.                                                                                                              | Existing handoff is intentionally semantic and provider-independent. Mirroring it into graph state creates duplication unless a future operation has substantial private execution state. |
| Cancellation/termination observability | Objective abandonment blocks new pursuit while separately preserving running, failed, stopped, or unknown episode/effect evidence. It never equates a cancellation request with observed termination.       | Invocation cancellation or runtime drain can stop or preserve framework work, but cannot prove that remote work or an external effect stopped.                                                    | LangGraph may later improve local run control; it cannot replace the current truth model. There is no current objective-run cancellation loop for it to simplify.                         |
| Testability                            | Node's built-in test runner exercises public stores/coordinators with temporary files and injected deterministic clocks/IDs; no service is required.                                                        | In-memory checkpointers and graph/node inspection support deterministic tests, while a production checkpointer adds an integration matrix.                                                        | No present testability gap. Adoption adds framework replay and storage cases alongside the existing semantic oracle.                                                                      |
| Target-host operation                  | Current code adds no package or native dependency: it uses Node core APIs, the existing cooperating writer lease, and atomic file replacement under the systemd-supervised episodic topology.               | The measured Functional API plus local SQLite saver installs 60 packages/73.3 MiB and requires the native `better-sqlite3` addon.                                                                 | The candidate works on representative ARM, but its dependency, native-build, startup, and memory cost is disproportionate to the absent private-execution gap.                            |

## Operational footprint spike

The spike used the closest available representative environment, not the production
Raspberry Pi: Apple ARM64 on Darwin 25.6.0, Node 26.8.1, and npm 12.0.2. Results must
not be read as Linux/Pi performance numbers. They do answer whether the pinned local
stack installs and functions on Node 26/ARM, and establish its order of magnitude:

| Observation             | Result                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Packages                | `@langchain/langgraph@1.4.15` plus `@langchain/langgraph-checkpoint-sqlite@1.0.4` installed 60 transitive packages (61 including the spike root).                                                                                                                                                                     |
| Installed footprint     | `node_modules` used 75,052 KiB (73.3 MiB) and contained 5,620 files. The lockfile was 28 KiB.                                                                                                                                                                                                                         |
| Native compatibility    | The SQLite saver selected `better-sqlite3@12.11.1`. npm 12 blocked its install script by default; after explicit approval, a separate rebuild produced a working Node 26/Darwin ARM64 binding. This is evidence of compatibility on the representative host and of native deployment work, not proof for Linux ARM64. |
| Initial write/interrupt | A fresh process executed one task, persisted a SQLite checkpoint, and stopped at `interrupt()` in 16.654 ms measured inside the process (0.35 s wall clock); reported RSS was 197,705,728 bytes.                                                                                                                      |
| Cross-process resume    | A second process reopened the same SQLite file, resumed the interrupt, restored the completed task result, and finished in 17.455 ms inside the process (0.24 s wall clock); reported RSS was 198,541,312 bytes.                                                                                                      |
| Replay oracle           | The task appended one external marker before the interrupt. The marker count remained exactly one after resume, demonstrating completed-task restoration rather than re-execution.                                                                                                                                    |
| Persistent files        | The SQLite database grew from 4,096 bytes at interruption to 20,480 bytes after resume for this minimal run.                                                                                                                                                                                                          |

The timing and RSS values are single-run feasibility observations, not statistically
stable benchmarks. They include the LangGraph/SQLite process but no model provider,
Ember state, or production workload. The footprint conclusion relies primarily on the
reproducible dependency/install surface and the demonstrated native requirement; the
runtime observations guard against claiming the stack was assessed without executing
its persistent path.

The spike workflow was deliberately narrow: one Functional API `task`, one
`interrupt`, a file-backed `SqliteSaver`, process exit, and `Command({ resume: true })`
from a fresh process. That is the candidate seam proposed below. Agent Server, Graph
API state, time travel, model/tool packages, and hosted services were not installed or
measured.

## What remains Ember-owned in every apparent fit

LangGraph's primitives would be mechanics beneath the following non-replaceable
decisions:

- **Objective identity and canonical state:** `objective_id`, revision, purpose,
  acceptance conditions, lifecycle, and the objective ledger remain canonical.
  `thread_id`, checkpoint IDs, state, and execution position are opaque operational
  references only.
- **Currentness:** every resume and every consequential action reloads current Ember
  state and can continue, defer, block, complete, or abandon independently of the
  checkpoint's next executable step.
- **Authority and approvals:** an interrupt payload or resume value is transport
  evidence, not authority. Approval remains bound to the exact proposal presentation,
  parameters, objective revision, and principal evidence.
- **Provenance and progress:** task outputs remain evidence attributed to their
  episode/runtime. A framework-completed task or run does not establish objective
  progress or completion.
- **Effect truth:** Ember records the attempt before crossing the effect boundary,
  preserves confirmed/failed/unknown outcomes, and decides whether reconciliation or
  retry is permitted. Framework retry and replay are never proof that repetition is
  safe.
- **Reintegration:** Ember alone decides whether current canonical meaning may rely
  on a result and writes the resulting checkpoint or lifecycle transition.

Deleting a future LangGraph store may make an unfinished operation non-resumable. It
must not erase any fact Ember needs to explain the objective, authority, approvals,
known or possible effects, or why progress was accepted.

## Negative evidence

### State duplication is immediate

The current Ember objective and action ledgers already contain every durable item
needed by the implemented flow. The action ledger owns proposal presentation,
decision, attempt, and effect truth; the objective ledger owns lifecycle, episode,
checkpoint, and reintegration evidence. A LangGraph checkpoint would either repeat
some of those fields or contain only references plus private execution position. The
first choice creates competing state and migration/currentness risks. The second
provides little value because current episodes have no multi-step private execution
position to recover.

### The apparent code saving is mostly semantic leakage

The 887 production lines in `../../src/core/objectives` are not a hand-built workflow engine.
They encode schema validation, chronology, attribution, concurrency, stale-revision
rejection, completion evidence, approval binding, and truthful effect reintegration.
The remaining #238 production changes make proposal/objective identity and
revalidation reach the action store, Calendar effect boundary, CLI, and Telegram;
they likewise remain necessary with a framework executor. Replacing those checks with
thread state, interrupts, or checkpoint completion would make framework state
canonical Ember state and fail the acceptance contract.

The genuinely mechanical subset—serialized mutation, writer lease use, atomic JSON
replacement, and reconstruction—is already shared with Ember's local persistence
model. Replacing it for objectives alone would create a second persistence mechanism
rather than simplify the repository.

### Functional resume still requires effect discipline

Functional resume starts the entrypoint again. Completed task and subgraph results are
restored, as the spike confirms, but ordinary entrypoint code runs again and a task
that started without finishing may run again. Multiple interrupt resume values are
matched by order. Ember would therefore still need stable/versioned task and interrupt
structure, idempotency keys, attempt-before-effect recording, and reconciliation
guards in addition to the current duplicate-effect prevention.

Graph API time travel is distinct. It can intentionally replay downstream model
calls, API requests, and interrupts from a selected historical checkpoint, but the
Functional API-only seam below neither needs nor assumes that capability. If a later
proposal includes time travel, it requires its own effect-safety evaluation.

### Runtime coupling has no compensating capability yet

Adoption would add LangGraph types, execution identifiers, checkpointer lifecycle,
schema/version compatibility, dependency upgrades, and production-store tests. It
would also introduce a second agent-execution vocabulary beside the Vercel AI SDK.
No implemented requirement currently needs graph routing, durable internal task
results, parallel durable branches, or an indefinitely suspended invocation.

## Replacement seam if a future workflow earns adoption

Do not wrap `DurableObjectiveStore` in LangGraph. Keep the objective and action stores
canonical and introduce a narrow operational port only for the private execution of
one bounded episode:

```ts
interface DurableEpisodeExecutor {
  start(input: {
    objectiveId: string;
    objectiveRevision: number;
    episodeId: string;
    definition: string;
    definitionVersion: number;
    canonicalRevision: number;
  }): Promise<OperationalRunRef>;

  resume(input: {
    run: OperationalRunRef;
    currentnessAssessmentId: string;
    approvedProposalId?: string;
  }): Promise<OperationalRunObservation>;

  inspect(run: OperationalRunRef): Promise<OperationalRunObservation>;
  requestCancellation(run: OperationalRunRef): Promise<CancellationObservation>;
}
```

The LangGraph adapter may privately map `OperationalRunRef` to `thread_id` and use a
small, versioned Functional API entrypoint. Inputs contain references and immutable
bounded projections, not the only copy of Ember truth. Before each resume/effect, the
caller performs existing objective/action currentness checks. The adapter returns
observations; the existing stores decide progress and reintegration. Removing the
adapter leaves canonical history interpretable and allows unfinished runs to be
reconciled or restarted with another executor.

## Revisit triggers

Reopen the decision only when an implemented or immediately required operation shows
at least one measured pain point:

1. one episode contains several expensive or non-deterministic internal steps whose
   completed results are repeatedly lost across real process failures;
2. custom suspend/resume scheduling or correlation grows beyond the existing
   proposal-and-new-episode boundary and has produced correctness defects;
3. durable parallel branches, joins, or nested operational workflows require enough
   custom machinery that a Functional API spike replaces a material amount of code;
4. local cancellation/drain and run inspection cannot meet systemd recovery needs
   with the current episode evidence;
5. the now-proven representative ARM path is repeated on the actual Linux/Raspberry Pi
   target and satisfies explicit cold-start, RSS, disk, write-amplification, native
   build/update, and recovery budgets; and
6. a fixture-backed spike demonstrates fewer total production/test lines and no
   duplicate canonical state, hidden unsafe replay, or weakened acceptance scenario.

The spike must exercise clean restart, uncertain interruption, stale currentness,
later approval, confirmed and uncertain effects, duplicate prevention, cancellation
observation, checkpoint loss, and workflow-definition upgrade. Without that evidence,
the current Ember/systemd mechanics remain the smaller and safer implementation.

## Sources

- [LangGraph.js repository and release history](https://github.com/langchain-ai/langgraphjs)
- [LangGraph Functional API](https://docs.langchain.com/oss/javascript/langgraph/functional-api)
- [LangGraph interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangGraph time travel and replay](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel)
- [LangGraph testing](https://docs.langchain.com/oss/javascript/langgraph/test)
- [LangGraph deployment topology](https://docs.langchain.com/oss/javascript/langgraph/deploy)
- [LangSmith data storage and privacy](https://docs.langchain.com/langsmith/data-storage-and-privacy)
