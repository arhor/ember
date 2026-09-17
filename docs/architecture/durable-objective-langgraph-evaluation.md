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

- `src/objectives/durable-objective.ts`: 729 lines implementing the versioned
  Ember-owned objective ledger, validation, serialized/cross-process mutation,
  currentness assessment, episode reconciliation, checkpoint recording, and
  completion rules;
- `src/objectives/objective-action.ts`: 158 lines binding proposals to an exact
  objective revision, source episode, and step, revalidating them, and reintegrating
  effect outcomes;
- 783 lines of focused tests in the adjacent objective test files, including true
  store reconstruction, fresh provider/session evidence, uncertain interruption,
  concurrent evidence, later approval, duplicate-effect prevention, and uncertain
  effect reintegration;
- [Durable Objective Lifecycle and Ownership Semantics](durable-objective-lifecycle.md),
  [Durable Action Proposal and Approval Correlation](durable-action-proposal-approval.md),
  and the accepted operational-continuity and authority decisions.

Line counts describe current maintenance surface, not automatically replaceable
framework boilerplate. Most of `durable-objective.ts` validates Ember meanings and
causal evidence. LangGraph does not remove that responsibility.

The comparison uses stable `@langchain/langgraph@1.4.15` and current first-party
documentation. No LangGraph package or production checkpointer was installed: the
decision follows from the absence of a replacement target after tracing the current
code. Consequently this evaluation makes no measured claim about Raspberry Pi RSS,
cold start, disk use, or native-checkpointer compatibility.

## Concrete comparison

| Requirement                            | Current Ember implementation                                                                                                                                                                                | LangGraph.js Functional API                                                                                                                                                   | Net result now                                                                                                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Durable checkpoints                    | One atomic, versioned objective sidecar records attributable checkpoints against acceptance conditions, assumptions, uncertainty, and source episodes.                                                      | A checkpointer persists task results, execution position, interrupts, and thread history with selectable durability.                                                          | LangGraph would add useful operational checkpoints but cannot replace the semantic ledger. Two stores or semantic duplication would result.                                               |
| Suspend/resume and human approval      | An episode records a proposal and exits. A later process loads the same objective and proposal, verifies exact approval, rechecks currentness, and starts a new episode. No provider session remains alive. | `interrupt()` persists graph state and resumes with `Command({ resume })` under the same `thread_id`; the interrupted node/function executes again according to replay rules. | The framework shortens control-flow plumbing only if one workflow invocation must remain suspended. The implemented flow needs durable evidence, not a suspended invocation.              |
| Replay/recovery                        | Resume reconciles every running episode, preserves unknown outcomes, and never repeats an effect whose durable attempt is already confirmed or uncertain.                                                   | Completed tasks can be reused; unfinished work may execute again. Time travel re-executes downstream model calls, API calls, and interrupts.                                  | LangGraph mechanical replay does not establish semantic retry safety and introduces another replay path that Ember must firewall.                                                         |
| Progress/state handoff                 | Checkpoints carry observable progress and evidence; only a new currentness assessment selects a next step. Provider and runtime IDs remain episode evidence.                                                | Checkpointed task outputs and graph state pass operational data between invocations.                                                                                          | Existing handoff is intentionally semantic and provider-independent. Mirroring it into graph state creates duplication unless a future operation has substantial private execution state. |
| Cancellation/termination observability | Objective abandonment blocks new pursuit while separately preserving running, failed, stopped, or unknown episode/effect evidence. It never equates a cancellation request with observed termination.       | Invocation cancellation or runtime drain can stop or preserve framework work, but cannot prove that remote work or an external effect stopped.                                | LangGraph may later improve local run control; it cannot replace the current truth model. There is no current objective-run cancellation loop for it to simplify.                         |
| Testability                            | Node's built-in test runner exercises public stores/coordinators with temporary files and injected deterministic clocks/IDs; no service is required.                                                        | In-memory checkpointers and graph/node inspection support deterministic tests, while a production checkpointer adds an integration matrix.                                    | No present testability gap. Adoption adds framework replay and storage cases alongside the existing semantic oracle.                                                                      |
| Target-host operation                  | Current code uses Node core APIs, the existing cooperating writer lease, and atomic file replacement under the systemd-supervised episodic topology.                                                        | Core adds another package/runtime vocabulary; durable production use also needs a supported persistent checkpointer. Hosted Agent Server is a materially larger topology.     | Current operation is smaller. A Pi measurement is warranted only after a workflow earns a spike; package capability alone is not a reason to install it.                                  |

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

The objective ledger already contains every durable item needed by the implemented
flow. A LangGraph checkpoint would either repeat objective lifecycle/progress fields
or contain only an objective reference plus private execution position. The first
choice creates competing state and migration/currentness risks. The second provides
little value because current episodes have no multi-step private execution position
to recover.

### The apparent code saving is mostly semantic leakage

The 887 production lines in `src/objectives/` are not a hand-built workflow engine.
They encode schema validation, chronology, attribution, concurrency, stale-revision
rejection, completion evidence, approval binding, and truthful effect reintegration.
Replacing those checks with thread state, interrupts, or checkpoint completion would
make framework state canonical Ember state and fail the acceptance contract.

The genuinely mechanical subset—serialized mutation, writer lease use, atomic JSON
replacement, and reconstruction—is already shared with Ember's local persistence
model. Replacing it for objectives alone would create a second persistence mechanism
rather than simplify the repository.

### Replay behavior raises rather than removes effect work

Functional and Graph API resume can rerun ordinary code, unfinished tasks, or an
interrupted node. Explicit time travel re-executes downstream API requests and
interrupts. Ember would need versioned workflows, stable task/interrupt ordering,
idempotency keys, attempt-before-effect recording, and reconciliation guards in
addition to the current duplicate-effect prevention.

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
5. operational measurements show that the chosen checkpointer works on the target
   Node 26/ARM host within explicit cold-start, RSS, disk, write-amplification, and
   recovery budgets; and
6. a fixture-backed spike demonstrates fewer total production/test lines and no
   duplicate canonical state, hidden unsafe replay, or weakened acceptance scenario.

The spike must exercise clean restart, uncertain interruption, stale currentness,
later approval, confirmed and uncertain effects, duplicate prevention, cancellation
observation, checkpoint loss, and workflow-definition upgrade. Without that evidence,
the current Ember/systemd mechanics remain the smaller and safer implementation.

## Sources

- [LangGraph.js repository and release history](https://github.com/langchain-ai/langgraphjs)
- [LangGraph interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangGraph time travel and replay](https://docs.langchain.com/oss/javascript/langgraph/use-time-travel)
- [LangGraph testing](https://docs.langchain.com/oss/javascript/langgraph/test)
- [LangGraph deployment topology](https://docs.langchain.com/oss/javascript/langgraph/deploy)
- [LangSmith data storage and privacy](https://docs.langchain.com/langsmith/data-storage-and-privacy)
