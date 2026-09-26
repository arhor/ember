---
summary: "Issue #236 semantic lifecycle for Ember-owned durable objectives, multi-episode progress evidence, restart currentness, next-step ownership, and cancellation without implied rollback."
read_when:
  - "Creating, advancing, resuming, completing, abandoning, or cancelling work that may span multiple runtime episodes"
  - "Associating checkpoints, partial results, blockers, uncertain outcomes, approvals, or external effects with a durable objective"
  - "Deciding whether a provider session, specialist attempt, workflow runtime, or process may own objective continuity or choose the next step"
role: design
discovery_status: current
---

# Durable Objective Lifecycle and Ownership Semantics

## Purpose

Issue [#236](https://github.com/arhor/ember/issues/236) defines the Ember-owned
semantic boundary for an objective that can outlive a runtime episode, provider
invocation, interaction surface, or process. It is the design foundation for the
multi-episode objective epic [#235](https://github.com/arhor/ember/issues/235). Issue
#237 now selects the minimal persistence schema described below without selecting a
scheduler or workflow engine. Issue
[#238](https://github.com/arhor/ember/issues/238) composes that schema with the
durable action ledger through `../../src/core/app`.

This design specializes existing architecture and, as of issue
[#237](https://github.com/arhor/ember/issues/237), has a minimal executable
implementation in `../../src/core/objectives`:

- [ADR 0001](decisions/0001-continuity-belongs-to-ember.md) makes continuity
  independent of operational loci;
- [ADR 0002](decisions/0002-preserve-persistent-meaning.md) requires provenance,
  scope, currentness, uncertainty, and lifecycle to survive with durable meaning;
- [ADR 0004](decisions/0004-separate-capability-from-authority.md) keeps an
  objective's purpose separate from authority for consequential action;
- [ADR 0005](decisions/0005-distinguish-operational-continuity.md) distinguishes
  continuing work, runtime status, completion, effects, cancellation, and present
  applicability; and
- [Durable Action Proposal and Approval Correlation](durable-action-proposal-approval.md)
  already owns proposal-specific approval and external-effect correlation.

The governing rule is:

> **An objective is Ember's durable account of a continuing purpose and its current
> disposition. Episodes may advance it and produce evidence, but no episode,
> provider thread, surface, worker, or workflow runtime owns its identity or may
> silently decide that it is complete.**

## Objective identity and durable meaning

An **objective** is a durable, inspectable semantic object describing a purpose
whose progress or resolution can matter beyond one bounded attempt. It is not every
user request: work that is fully handled within one interaction need not acquire a
durable objective merely because persistence is available.

For epic #235, an objective may be created only from explicit user intent: a
user-requested purpose or work the user has explicitly authorized Ember to pursue
across episodes. The creation evidence must establish that intent, the principal,
and the authorized scope. An observation, model suggestion, remembered concern,
standing capability, or Ember-originated motive may inform already-authorized work,
but none is currently eligible to create a durable objective. The representation
must retain typed creation provenance so a later endogenous-agency design can add
other eligible roots deliberately without weakening or retroactively reinterpreting
this boundary.

An objective preserves at least these responsibilities:

| Responsibility               | Meaning                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stable identity              | One Ember-owned identity for this continuing purpose, independent of provider, process, thread, surface, episode, or display text. Similar wording does not merge two real objectives; a retry or resume does not create a new objective when the same purpose remains live.         |
| Purpose and success boundary | Why the work exists, the intended outcome, governing constraints, acceptance conditions, and evidence sufficient for Ember to judge resolution.                                                                                                                                      |
| Principal and semantic scope | On whose behalf the objective exists, whose interests are implicated, where its information may be used or disclosed, and which authority boundaries may constrain particular steps.                                                                                                 |
| Creation evidence            | The explicit user request or authorization from which Ember established the objective, including principal, authorized scope, occurrence identity, and occurrence and observation time where relevant. Creation records provenance; it does not enlarge authority beyond the source. |
| Currentness basis            | Material assumptions, dependent canonical meaning, objective revision, relevant external facts, authority premises, and expiry or reconsideration conditions that must be checked before progress is relied upon or new action begins.                                               |
| Lifecycle evidence           | Attributable transitions, reasons, actors, times, checkpoints, associated episodes, approvals, known or possible effects, and unresolved uncertainty. History is appended or superseded rather than rewritten to make the present look seamless.                                     |
| Next-step responsibility     | Who currently has responsibility to decide or supply the next meaningful step, what condition can make progress possible, and whether that responsibility includes decision authority or only operational execution.                                                                 |

Objective identity is not derived from an initiating message, conversation,
provider call, specialist task, action proposal, runtime job, or mutable title. A
materially changed purpose is either an explicit revision of the same objective when
its continuity remains intelligible, or a successor objective with the predecessor
superseded. Implementations must preserve the relationship rather than overwriting
the old purpose under the old identity.

An objective is not itself an authority grant. It may preserve authority provenance
that covers ordinary means within its scope, but each consequential action or
disclosure still requires a live attributable authority envelope. Likewise, an
objective may cite a commitment without making all commitments objectives or
silently completing the commitment when operational work ends.

## Lifecycle and progress are separate dimensions

The objective lifecycle records Ember's present disposition toward the purpose:

| State         | Meaning                                                                                                                                                                                                                                      | Required transition evidence                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **active**    | The purpose remains current and Ember may select or continue an eligible next step now. Active does not mean a process or provider is running.                                                                                               | A currentness assessment and an attributable reason to pursue the purpose.                                                                                                             |
| **deferred**  | The purpose remains live, but Ember intentionally will not pursue it now. A reconsideration condition, time, or reason is retained.                                                                                                          | Why deferral is appropriate, who made that decision, and what may reopen consideration.                                                                                                |
| **blocked**   | The purpose remains live, but progress presently depends on a named missing input, authority decision, dependency, resource, external condition, or responsible party. Waiting for approval is a typed blocker, not implicit approval state. | The blocker, its provenance, who can resolve or reassess it, and any safe reconsideration trigger.                                                                                     |
| **completed** | Ember has judged the objective's success boundary satisfied from adequate attributable evidence.                                                                                                                                             | The completion decision, satisfied conditions, supporting evidence/checkpoints, currentness assessment, and any residual uncertainty or effects that do not negate the stated success. |
| **abandoned** | Ember or an authorized principal has ended pursuit without establishing successful completion. Cancellation is one reason for abandonment; obsolescence, replacement, infeasibility, or a deliberate decision may be others.                 | The reason, attributable decision source, scope, time, and disposition of unresolved work, effects, approvals, and uncertainty.                                                        |

`active`, `deferred`, and `blocked` are live states. `completed` and `abandoned` are
terminal for that objective revision, but their historical evidence and external
effects remain. A terminal revision never returns to a live state.

If new evidence shows that completion was mistaken, Ember records an attributable
correction to the completion claim and creates either a new current revision of the
same objective or an explicitly related successor objective. That new revision or
successor has its own lifecycle disposition, currentness basis, and success boundary;
the prior revision remains terminal historical evidence and cannot represent resumed
work. Reopening after abandonment follows the same rule and requires an attributable
new user instruction or authorization. Whether continuity of purpose warrants a new
revision or a successor is a semantic judgment, but resuming by mutating a terminal
revision is invalid.

**Uncertain is not a catch-all lifecycle state.** Uncertainty qualifies the claim it
belongs to: progress may be uncertain, an episode outcome unknown, an effect
ambiguous, authority indeterminate, or currentness unresolved. Until uncertainty
material to success is resolved, Ember must not infer `completed`. An objective can
therefore be active, deferred, or blocked while carrying uncertain progress or
effects. If even its live purpose cannot currently be established, it is blocked on
currentness or explicitly deferred for reconciliation, not declared complete or
abandoned by absence of evidence.

The lifecycle must not collapse these distinct facts:

- objective disposition;
- episode or worker execution status;
- progress toward acceptance conditions;
- next-step responsibility;
- approval or authority state;
- external-effect outcome; and
- result delivery or user awareness.

A completed episode can leave an objective active. A failed episode can still
provide useful progress. A blocked objective can have no running episode. A
completed objective can retain an uncertain side effect that requires separate
reconciliation.

## Episodes are bounded attempts, not objective identity

An **objective episode** is one bounded interval in which an operational locus
attempts to assess, plan, or advance an objective. Each episode has its own stable
identity, objective identity and revision basis, purpose-bounded inputs, runtime
owner, authority envelope, start evidence, observations, terminal or last-known
execution condition, and known or possible effects.

One objective may have sequential or concurrent episodes. One episode may generate
several checkpoints. A later process or provider resumes the objective by starting a
new episode after reconciliation; it does not need to recreate or continue the old
provider thread. Provider sessions and workflow checkpoints may be useful local
mechanics, but they remain replaceable evidence beneath the Ember-owned objective.

An episode report is attributed evidence. Its runtime states such as accepted,
started, blocked, failed, timed out, cancellation requested, stopped, or completed
do not directly assign the objective lifecycle. In particular:

- runtime `completed` means the runtime claims its bounded episode finished; Ember
  still judges the objective success boundary and current applicability;
- runtime `failed` or lost means objective completion was not established by that
  episode, not that no useful work or external effect occurred;
- episode cancellation does not by itself abandon the objective; another path may
  remain appropriate; and
- disappearance of the episode owner creates an operational gap to reconcile, not
  a new objective identity or proof that execution stopped.

Concurrent episodes must retain their shared objective/revision correlation. Their
agreement is not automatically independent evidence, and a late episode is checked
against the current objective before its result changes lifecycle or drives action.

## Progress and checkpoint evidence

A **checkpoint** is durable, attributable evidence about the objective at a point in
its history. It supports inspection and a later next-step decision; it is not a
serialized model mind, a promise of resumability, or proof of completion.

A checkpoint records enough meaning to establish:

- the objective identity and revision it concerns;
- the contributing episode or Ember decision and its evidence provenance;
- which acceptance condition, sub-purpose, constraint, or blocker it addresses;
- what was observed, produced, attempted, decided, or left unresolved;
- known and possible external effects and their correlation;
- assumptions and currentness basis at the time;
- progress confidence and uncertainty, without upgrading a report into direct
  observation; and
- the proposed next step, if any, as advice rather than self-authorizing control.

Checkpoint evidence is append-only or explicitly superseded. A newer checkpoint can
correct an interpretation while retaining the prior record. Duplicate observation
of one underlying occurrence does not manufacture progress; independently sourced
evidence remains separately attributable.

Progress is always relative to named acceptance conditions. Useful classifications
include no established progress, partial progress, condition satisfied, failed
attempt, blocker discovered, and uncertain progress. Percent-complete alone is not a
sufficient semantic claim. Partial work must not be promoted to full completion,
and a checkpoint that was valid for an older objective revision remains historical
evidence until currentness review establishes whether it still applies.

Before setting `completed`, Ember performs a completion decision that:

1. reads the current objective revision and success boundary;
2. evaluates relevant checkpoint and effect evidence with provenance;
3. resolves or explicitly bounds uncertainty material to success;
4. rechecks changed assumptions, authority where reliance or follow-on action needs
   it, and present external state proportionate to consequence; and
5. records why the evidence establishes every required acceptance condition.

Neither a provider's finish reason nor an episode's self-report can substitute for
this decision.

## Ownership of the next step

Objective ownership and runtime ownership answer different questions:

- **Ember owns objective continuity and lifecycle judgment.** Ember preserves why
  the work exists, evaluates currentness and evidence, chooses among legitimate next
  steps, and records completion, deferral, blockage, or abandonment.
- **A principal owns decisions within their authority boundary.** Ember cannot infer
  a choice whose consequence belongs to that principal. Approval, clarification, or
  cancellation must remain attributable to the entitled source.
- **An episode runtime owns its bounded local execution loop.** It may choose
  intermediate means allowed by its delegation envelope and report progress,
  blockers, or suggested continuations. It does not thereby own the durable
  objective or authority outside that envelope.
- **A dependency or external actor may own delivery of a missing condition.** This
  explains a blocker; it does not transfer Ember's responsibility to reassess the
  objective truthfully.

Every live objective has an inspectable next-step disposition: Ember may act,
Ember must reconsider at a stated condition, a named principal must decide, an
external dependency is awaited, or no legitimate next step is currently known.
Assigning responsibility does not claim control, availability, consent, or a
deadline. A model- or specialist-proposed next step becomes operative only after an
Ember-owned currentness, scope, and authority decision.

## Restart and resume are reconciliation

After process loss, downtime, provider replacement, or a new surface interaction,
Ember reconstructs the strongest justified present from durable objective state,
episode/checkpoint evidence, current canonical meaning, permitted current
observation, and explicit gaps.

Before a new episode begins or a consequential result is relied upon, resume checks:

1. that the objective identity and purpose remain live and the intended revision is
   still current;
2. whether a newer instruction, objective, completion, abandonment, or changed
   principal/scope supersedes the planned work;
3. which prior episodes are terminal, still externally observable, lost, or
   uncertain, and whether they may still produce results or effects;
4. whether checkpoints remain applicable under changed canonical meaning, external
   facts, constraints, acceptance conditions, or dependencies;
5. whether the proposed next step still fits current authority, privacy, resource,
   attention, and consequence boundaries; and
6. whether duplicate or unsafe execution is possible, especially after an ambiguous
   prior attempt.

The outcome may be a new episode, continued deferral, a named blocker, abandonment,
completion from newly sufficient evidence, or explicit unresolved uncertainty.
Resume never means blindly replaying an old prompt, continuing a provider thread as
the source of truth, or re-running an apparently lost attempt.

Downtime is not objective progress. If no evidence survives for an interval, the
gap remains inspectable rather than being filled with inferred work.

## Cancellation, stopping, and effects

A **cancellation request** is an attributable instruction or Ember decision that
continued pursuit, or a specified in-flight episode, is no longer wanted. It must
identify its target and scope: stopping one episode, stopping future episodes,
abandoning the objective, withdrawing an action proposal, and requesting rollback
are different acts.

For objective-level cancellation:

1. record the request and the authority provenance of the actor entitled to end or
   narrow the purpose;
2. prevent new objective episodes and not-yet-started consequential steps while the
   decision is applied;
3. request cancellation from each affected in-flight runtime where possible;
4. preserve cancellation requested, acknowledged, observed stopped, descendant or
   remote work status, and rollback/compensation outcome as separate evidence;
5. reconcile known and possible effects, approvals, checkpoints, and late results;
   and
6. mark the objective `abandoned` for the cancellation reason when pursuit has ended,
   while retaining any unresolved operational or effect uncertainty.

The abandoned transition does not claim all execution stopped. If a child, remote
job, or effect remains uncertain, the objective history says so and separate
reconciliation remains required. A late result belongs to the abandoned objective's
history; it does not silently reactivate or complete it. A rollback or compensating
action is a new authorized effect with its own evidence, not a property implied by
cancellation.

An ambiguous conversational "stop" fails closed for new consequential progress
while Ember establishes which objective, episode, proposal, or delivery it targets.
It must not be guessed away or treated as proof of rollback.

## Composition with approvals and external effects

Objectives explain continuing purpose; action proposals identify exact contemplated
external effects. One objective may produce many proposals across episodes. Every
proposal cites its source objective and revision, while approvals remain bound to
the proposal's exact material parameters rather than granting general objective
authority.

Before execution, proposal revalidation includes the objective's currentness. After
an attempt, the proposal/effect lifecycle remains authoritative for whether an
effect succeeded, failed, or is uncertain. Objective completion may depend on that
evidence, but it must not rewrite it. Cancelling or abandoning an objective blocks
unused proposal authority where applicable; it does not prove an already-started
effect absent or reversed.

The executable composition binds each objective-originated proposal to the exact
`objective_id`, revision, source episode, concrete `step_id`, and affected acceptance
conditions. `ObjectiveActionCoordinator` validates that binding when the proposal is
created, and the approved Google Calendar write revalidates it immediately before
the effect boundary. A terminal or revision-mismatched objective therefore makes the
proposal stale even when its historical human approval remains valid evidence.

After execution, the action ledger remains authoritative for the attempt and effect
outcome. Reintegration cites the proposal and attempt identities in a new objective
checkpoint: confirmed success still requires an Ember progress judgment, confirmed
failure becomes a failed attempt, and `outcome_unknown` becomes uncertain progress
that explicitly forbids consequential retry before reconciliation. Replaying the
same proposal cannot create another effect because the consumed or uncertain attempt
remains durable across process and provider replacement.

## Representative scenarios

### Restart between useful episodes

Episode 1 produces an attributable partial checkpoint and exits. After a complete
process restart, Ember reloads the same objective, rechecks its purpose and changed
repository state, and starts episode 2 with a least-sufficient current projection.
The new provider thread is not objective identity, and episode 1's completion did
not falsely complete the objective.

### Failed episode with useful evidence

A specialist fails after discovering the actual blocker and modifying no external
state. Ember records the failure, qualified discovery, and blocker. The objective is
`blocked`, not `completed`; the checkpoint remains usable according to its provenance
and currentness.

### Timeout with uncertain effect

An episode times out after requesting a consequential external action. The objective
retains the attempt and possible effect. It cannot retry merely because the worker
disappeared or mark the objective complete merely because its intended outcome is
now observed without occurrence correlation. Reconciliation establishes the
strongest justified account first.

### User changes the purpose

While an episode pursues revision A, the principal materially changes the desired
outcome. Ember records revision B or a successor objective and makes A historical.
A late success against A remains attributable evidence; it does not complete B.

### Cancellation while remote work may continue

The principal cancels the objective. Ember records objective abandonment and asks
the remote runtime to stop. Until termination and effects are observed, status says
that cancellation was requested and remote outcome remains uncertain. It does not
claim rollback.

### Approval in a later episode

Episode 1 creates an exact action proposal and the objective becomes blocked awaiting
a named principal decision. Approval arrives after restart on another suitable
surface. Ember correlates it to the proposal, revalidates the objective and effect,
and starts a new execution episode. The old provider session is irrelevant.

## Deliberately unresolved representation questions

This design and the issue #237 implementation do not choose:

- a generalized dependency or successor-revision storage schema beyond the
  objective, episode, assessment, and checkpoint records described below;
- a scheduler, queue, DAG, workflow engine, LangGraph adoption, resident daemon, or
  provider-native continuation mechanism;
- universal decomposition, prioritization, progress scoring, retry, expiry, or
  notification policies;
- a global rule for whether changed purpose revises an objective or creates a
  successor beyond requiring explicit attributable continuity;
- automatic rollback, compensation, or external reconciliation mechanics; or
- how much episode-local state a particular runtime may need for efficient local
  continuation.

Issue #237 chooses the smallest durable representation described below. Issue #238
should compose later-episode approvals and effects with
the existing proposal contract. Issue #239 may recommend durable-execution
infrastructure only from concrete missing capability evidence; this design does not
make a workflow framework the owner of objective meaning.

## Minimal durable implementation

Issue #237 resolves the representation needed for the first executable slice with a
versioned objective ledger stored beside canonical Ember state as
`<state-path>.objectives.json`. The sidecar is an Ember-owned semantic record, not a
provider or workflow checkpoint. Its replacement uses the same cooperating
single-writer and durable-file-replacement mechanics as other semantic sidecars.

Each objective record keeps its stable identity and revision, explicit creation
provenance, purpose and named success conditions, principal and scope, currentness
basis, lifecycle disposition, next-step ownership, currentness assessments,
episodes, and checkpoints. Runtime IDs, provider labels, and provider session IDs
are retained only inside episode evidence and never contribute to objective
identity.

Starting any later episode requires an explicit `resume` assessment with fresh
evidence, a reason, and an account of prior-episode reconciliation. A `continue`
decision creates a new bounded episode; `defer`, `block`, `complete`, and `abandon`
update the objective disposition without launching work. Completion is accepted only
when the latest relevant checkpoint establishes every named success condition without
unresolved uncertainty. Every running episode must receive an explicit reconciliation
outcome: an episode established to remain observable stays `running`, while only an
episode for which current evidence establishes loss is durably changed to
`outcome_unknown`. This preserves legitimate concurrent work as well as operational
gaps without fabricating liveness, loss, failure, completion, or absence of effects.
Abandonment may therefore preserve a truthfully `running` remote episode: it prevents
new pursuit but does not claim that already-started execution stopped. Terminal
objectives cannot be resumed in place, and late episode evidence remains part of their
history.

Checkpoints name the acceptance conditions they address and preserve progress
classification, attributable evidence, assumptions, uncertainty, and any suggested
next step. Suggestions remain evidence: only a later Ember-owned resume assessment
can make a next step operative. Episode completion likewise does not complete the
objective. This slice deliberately leaves revision/successor creation, scheduling,
and approval/effect composition to the later work identified above.

Ledger mutations are serialized within each store instance in addition to using the
cross-instance writer lease, so concurrent episode/checkpoint appends cannot share a
re-entrant lease and overwrite one another. Mutation and load validation also enforce
causal chronology without imposing a false total ordering across concurrent episodes:
an episode cannot end before it starts or before its own checkpoints, and a checkpoint
must fall within its episode's observed interval. Late-arriving evidence may therefore
carry an earlier valid occurrence time than another episode's already-recorded event;
`updated_at` remains monotonic as the maximum timestamp in durable history.
Completion selects relevant checkpoint evidence by maximum `recorded_at`, never by
append order. If multiple relevant checkpoints share that latest timestamp, every
tied checkpoint must establish the condition without uncertainty; conflicting tied
evidence prevents completion rather than receiving an arbitrary ordering.

Episode chronology also includes assessments that explicitly established the episode
as `still_running`. A subsequently received terminal report cannot claim an
`ended_at` earlier than such an assessment; it must be represented as corrected or
uncertain evidence instead of making the durable history internally contradictory.

## Acceptance mapping

| Issue #236 criterion                                                                                  | Design guarantee                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Objective continuity is independent from provider/runtime session identity.                           | Stable objective identity is Ember-owned; episodes, provider threads, workers, surfaces, and workflow runtimes are bounded operational loci.                                                  |
| Lifecycle and currentness/restart semantics are explicit.                                             | The five lifecycle states, orthogonal uncertainty, transition evidence, resume reconciliation, and mandatory new-revision/successor rule for terminal reopening define the required boundary. |
| Partial/failed/uncertain episode evidence can be associated without falsely completing the objective. | Checkpoints retain episode provenance and progress classification; only an Ember-owned completion decision against current acceptance conditions sets `completed`.                            |
| Architecture docs and discovery validation pass.                                                      | This current design document carries discovery metadata and is linked from the architecture guide; repository validation supplies the executable check.                                       |
