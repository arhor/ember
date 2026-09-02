---
summary: "Current design for one bounded Codex specialist work episode, separating Ember-owned purpose, disclosure, authority, evidence, lifecycle, and reintegration from Codex-owned local execution."
read_when:
  - "Implementing or reviewing Ember's first bounded specialist delegation to Codex"
  - "Defining specialist episode inputs, lifecycle evidence, cancellation, approval handling, or result reintegration"
  - "Checking how specialist-delegation scenarios AS-DEL-00 through AS-DEL-08 constrain a concrete runtime boundary"
role: design
discovery_status: current
---

# Minimal Codex Specialist-Delegation Boundary

> Status: current design for issue #59 and implementation input to issue #60.

## Purpose and scope

This design defines the smallest boundary through which Ember can delegate one
bounded repository work episode to Codex. The episode is delegation because Codex
may inspect the repository, choose intermediate steps and tools, revise its plan,
and decide when it has enough evidence to report a result. It is not one-shot
cognition, even when both paths happen to launch `codex exec`.

The first slice supports one Ember-owned objective, one Codex runtime attempt, one
explicit working tree, bounded tools and authority, durable boundary evidence,
cancellation request, and Ember-owned result interpretation. It deliberately does
not define a generic `AgentRuntime`, interchangeable specialist protocol, nested
delegation, scheduler, durable queue, universal permission model, or transparent
runtime failover.

The representation-neutral constraints remain [ADRs 0003–0005](decisions/README.md)
and the [specialist-delegation acceptance subset](acceptance-scenarios.md#delegation-and-responsibility).
This document selects a narrow implementation boundary beneath those constraints;
it does not create another semantic decision. No subordinate ADR is warranted:
the Codex-specific episode representation is local and revisable, not a durable
cross-cutting choice.

## Ownership boundary

| Concern | Ember owns | Codex runtime owns |
| --- | --- | --- |
| Purpose | The live objective, why delegation is appropriate, acceptance constraints, and whether the objective remains current | Local interpretation needed to pursue the supplied objective |
| Context | Selection, permitted disclosure, provenance, scope, observation time, and omissions in the supplied projection | Task-local use, compaction, and scratch derivations from what was disclosed or observed in the workspace |
| Authority | The attributable authority envelope and every decision to grant, deny, narrow, or seek broader authority | Enforcement of its own sandbox and approval policy; a request for more access has no authority by itself |
| Execution | Starting the bounded episode, choosing the workspace and invocation policy, observing boundary events, and deciding whether to request cancellation | The local cognition, planning, tool, retry, and execution loop |
| Runtime state | Opaque runtime/thread identifiers only as operational evidence | Thread history, hidden reasoning, local plan, process state, and runtime scratch state |
| Evidence | Durable observations made at the boundary, their provenance, and any independent verification | Specialist-local observations and the report attributed to Codex |
| Completion | Whether the Ember-owned objective is satisfied and whether the result is still applicable | Whether Codex considers its local attempt done and what it reports |
| Effects | Reconciliation of known and possible effects before reliance, compensation, or retry | Effects caused by runtime-selected tool calls inside the entrusted boundary |
| Continuity | The continuing objective, episode record, unresolved responsibility, and reintegration into Ember history | At most continuity of the particular Codex thread; never Ember identity or objective ownership |

Ember can therefore truthfully say that it selected and bounded Codex, observed
particular boundary events, received a Codex report, and independently verified a
fact when it actually did so. It cannot turn Codex-local choices or observations
into Ember's direct experience. Conversely, attributing execution to Codex does
not remove Ember's responsibility for initiating or relying on the delegation.

## Episode input

Before launch, Ember persists an immutable episode specification. The names below
describe required meanings rather than requiring a public or generalized schema.

| Input | Required content |
| --- | --- |
| `episode_id` | Ember-generated identity for this delegation occurrence, independent of process and Codex thread IDs |
| `objective` | The bounded outcome Codex is asked to pursue, plus why it remains live |
| `acceptance` | Observable success constraints, prohibited outcomes, and evidence Ember needs before relying on the report |
| `context_projection` | Only the task facts, constraints, and source/currentness labels needed by this specialist; never a canonical store path or implicit memory dump |
| `authority_envelope` | Attributable principal and grant, purpose, permitted actions and disclosures, targets/recipients, material limits, and conditions requiring escalation |
| `workspace` | An explicit canonical path, expected repository identity or baseline when relevant, and whether existing user changes must be preserved |
| `runtime_policy` | Codex command/version evidence, narrowest runtime-enforceable sandbox/tool/network controls compatible with the task, configuration isolation, timeout/resource bounds, and session mode |
| `currentness_basis` | Machine-comparable `objective_revision` and `context_revision` captured at launch, against which a late result must be checked |

The working directory is both capability and disclosure. It is never inherited
from the Ember process by accident. Selecting a repository workspace intentionally
discloses repository-visible files, including project instructions discovered by
Codex, and may expose writable state. Additional directories, environment values,
credentials, network access, and user/runtime configuration are separately
selected. Environment forwarding uses an allowlist; credential possession is not
recorded as authority.

The prompt contains the objective, acceptance constraints, operationalized context
projection, authority limits, evidence request, and instructions to stop and report
when a material step lies outside the envelope. Private rationale is translated to
an operational constraint when that is sufficient. Prompt text, repository files,
tool output, and runtime instructions may provide evidence or constraints, but do
not become new authority sources merely by appearing in Codex context.

## Minimal Codex invocation

Issue #44 and the production cognition adapter prove useful process mechanics:
explicit stdin input, explicit cwd, filtered environment, configuration isolation,
bounded stdout/stderr, JSONL parsing, captured thread ID, timeout, abort handling,
two-stage child termination, and truthful unconfirmed termination. The specialist
adapter should reuse those mechanics without reusing the cognition contract or its
read-only isolated directory.

For the first specialist slice, Ember launches a Codex-specific `codex exec`
adapter with:

- an ephemeral Codex thread, retaining the emitted thread identifier only as
  operational evidence and leaving no runtime-local session to resume;
- the explicitly selected repository working directory;
- the narrowest runtime-enforceable sandbox and tool policy compatible with the
  task;
- user configuration, plugins, apps, skills, and ambient environment disabled or
  filtered unless the episode explicitly selects them; and
- JSONL boundary events plus a schema-constrained final specialist report.

Codex CLI controls are coarser than Ember's semantic authority envelope. Residual
technical reach inside the selected sandbox or workspace remains capability only;
it does not authorize Codex to use that reach. The prompt communicates the finer
authority limits, and Ember still reconciles observed and possible effects rather
than claiming that CLI policy exactly enforced every semantic constraint.

The final report contains at least a summary, claimed objective disposition,
artifacts changed or inspected, checks run and their results, known effects,
possible effects or uncertainty, blockers, and any requested follow-up. It is a
Codex-attributed candidate result, not canonical truth.

This slice does not require Codex App Server or SDK. `codex exec` already supplies
the needed repository agent loop, explicit cwd and sandbox, structured event
stream, output schema, cancellation via child termination, and an opaque thread
identifier. If issue #60 demonstrates that a live approval must be suspended and
resumed, or that reliable steering/progress cannot be represented from CLI events,
that is concrete pressure to reconsider App Server. The present design must not
simulate capabilities the CLI does not establish.

Persistent or resumable Codex threads are likewise deferred until recovery of the
same runtime-local episode becomes a concrete requirement. Specialist replacement
remains a new Ember episode rather than an implicit continuation through retained
Codex state.

## Boundary observations and durable state

Ember durably records state transitions and observations with observation time,
source, and supporting detail. Raw hidden reasoning is neither required nor
treated as evidence. At minimum the episode can preserve:

- specification persisted;
- launch attempted and direct child started or failed to start;
- Codex thread ID observed;
- credible progress or artifact observations exposed by the boundary;
- runtime approval/access request, including contemplated action and target when
  observable;
- cancellation requested, direct child exit observed, and any independent stop or
  rollback evidence as separate observations;
- final report received and schema validated;
- process exit, signal, timeout, output limit, or boundary loss;
- known effects, possible effects, and unresolved gaps; and
- Ember's later verification and reintegration decision.

These observations support, but do not collapse into, three independent state
dimensions:

| Dimension | Values needed by the first slice | Meaning |
| --- | --- | --- |
| Runtime attempt | `not_started`, `running`, `waiting_for_authority`, `cancellation_requested`, `exited`, `lost` | What Ember can justify about the operational locus |
| Specialist report | `none`, `partial`, `reported_success`, `reported_failure`, `ambiguous` | What Codex reported, not whether Ember's objective is complete |
| Ember disposition | `unresolved`, `blocked`, `accepted`, `qualified`, `rejected`, `stale` | Ember's current interpretation after checking evidence, objective, authority, and world state |

Known effects and possible effects are recorded alongside these dimensions rather
than inferred from them. In particular:

- `cancellation_requested` does not mean stopped or rolled back;
- direct child exit does not prove remote work or effects ended;
- timeout, failure, and specialist loss do not prove that nothing happened;
- `reported_success` does not mean the objective is accepted or current; and
- an accepted result does not grant authority for a downstream external action.

No automatic retry is allowed after execution began unless current observation
establishes that repetition is safe and live authority covers it. Replacement
specialist work is a new episode with a new `episode_id`; it can receive a newly
selected projection of prior boundary evidence but cannot masquerade as continuity
of the lost Codex-local episode.

## Lifecycle and control flow

1. **Prepare.** Ember confirms a live objective, selects Codex for the required
   discretion, builds the least-sufficient permitted projection and authority
   envelope, selects the explicit workspace/runtime policy, and persists the
   specification before launch.
2. **Launch.** The adapter starts one Codex attempt and records observable runtime
   identity and process evidence. A launch failure leaves the objective unresolved.
3. **Observe.** Ember records only credible boundary events. The initiating surface
   may end without ending the episode or objective; durable supervision is an
   implementation responsibility of issue #60, not a property of a UI session.
4. **Escalate or block.** Additional context, capability, or approval requests are
   returned to Ember with their purpose and consequences. Ember may narrow, deny,
   satisfy from already-authorized means, or seek a decision from the legitimate
   authority-holder. The initial CLI slice may end the attempt as blocked when it
   cannot safely mediate an interactive approval.
5. **Cancel.** Ember records cancellation intent before signalling the direct
   child, then separately records observed exit and effect evidence. An absent or
   incomplete acknowledgement leaves the runtime/effect outcome uncertain.
6. **Receive.** A valid final report and process exit are recorded as specialist
   evidence. Malformed output, timeout, failure, or lost runtime can still leave
   partial evidence and possible effects.
7. **Reconcile.** Ember compares the original objective and currentness basis with
   current Ember/world state, evaluates provenance and evidence, verifies where
   consequence warrants, and assigns an Ember disposition.
8. **Integrate.** Ember preserves only justified meaning: objective history,
   specialist attribution, accepted or rejected conclusions, effects, uncertainty,
   and unresolved responsibility. Delivery or downstream action is a separate
   authority/currentness decision.

Steering is not part of the first boundary. A material objective or authority
change either makes the returned work stale, causes a cancellation request, or
starts a new episode. This avoids inventing reliable mid-turn steering semantics
before the selected Codex surface demonstrates them.

## Disclosure and authority flow

```text
current Ember objective + canonical evidence + live attributable authority
                              |
                              v
             select least-sufficient permitted episode envelope
                              |
                              v
 explicit prompt + explicit workspace + explicit env/tools/sandbox -> Codex
                              ^                                  |
                              |                                  v
       Ember decides any expansion <- request/progress/report/effect evidence
                              |
                              v
       currentness check + verification + Ember-owned reintegration
```

Runtime approval and Ember authority are deliberately non-equivalent. A Codex
policy may block an authorized operation, or permit a technically reachable
operation Ember is not authorized to initiate. Approval handling therefore records
the contemplated action, target, purpose, disclosures, recoverability, affected
principals, prior effects, and requested scope. Ember approves only inside live
attributable authority; otherwise it narrows, blocks, or seeks meaningful approval.

## Acceptance-scenario responsibility map

| Scenario | Design responsibility |
| --- | --- |
| [AS-DEL-00](acceptance-scenarios.md#as-del-00) | Immutable Ember-owned envelope, Codex-owned local loop, attributed report, verification and reintegration |
| [AS-DEL-01](acceptance-scenarios.md#as-del-01) | Durable episode/objective independent of surface lifetime; only observed progress is claimed |
| [AS-DEL-02](acceptance-scenarios.md#as-del-02) | Immutable original objective plus currentness basis; `stale` is a valid Ember disposition |
| [AS-DEL-03](acceptance-scenarios.md#as-del-03) | Specialist report, boundary observation, and independent Ember verification have distinct provenance |
| [AS-DEL-04](acceptance-scenarios.md#as-del-04) | Cancellation intent, signal, observed exit, stop, rollback, and effects remain separate |
| [AS-DEL-05](acceptance-scenarios.md#as-del-05) | Explicit disclosure/authority envelope; expansion requests return to Ember and never self-authorize |
| [AS-DEL-06](acceptance-scenarios.md#as-del-06) | Orthogonal runtime, report, disposition, and effect state; no unsafe automatic retry |
| [AS-DEL-07](acceptance-scenarios.md#as-del-07) | Context-rich approval evidence and Ember-owned decision; safe blocked outcome when CLI mediation is insufficient |
| [AS-DEL-08](acceptance-scenarios.md#as-del-08) | Durable boundary evidence survives thread/runtime loss; replacement is a new episode, not fabricated continuation |

## Unresolved questions for implementation evidence

The following questions are intentionally concrete and do not create extension
points in advance:

- Which Codex JSONL events in the installed/supported CLI version are stable enough
  to count as credible progress, artifact, and approval-request observations?
- Can the first `codex exec` slice safely complete all intended repository work
  with a preselected workspace-write policy and blocked escalation, or does one
  acceptance case require live approval suspension/resumption?
- After direct-child termination, what additional observation can establish
  whether Codex-managed subprocesses or remote effects stopped?
- What minimal durable supervisor in issue #60 lets an episode outlive the
  initiating surface without prematurely choosing a general job system?
- Which repository baseline evidence is sufficient to distinguish specialist
  changes from pre-existing user changes and later concurrent changes?
- Which report fields can be validated mechanically, and which remain attributed
  Codex claims requiring inspection or tests?

These questions may change the Codex adapter or episode storage used by issue #60.
They do not weaken the ownership, authority, provenance, currentness, or uncertainty
requirements above.

## Implemented issue-60 slice

`src/delegation/codex-specialist.ts` implements this design as a deliberately separate
Codex-specific boundary. `createSpecialistEpisode` validates and captures the
explicit objective, acceptance constraints, bounded context, authority envelope,
canonical workspace path, runtime command/policy, and currentness basis.
`runCodexSpecialist` creates the episode record with exclusive creation before launch, invokes one ephemeral
`codex exec` in that exact workspace with `workspace-write`, filtered environment,
disabled user configuration/plugins/apps/skills, bounded JSONL and timeout, and a
strict report schema. Runtime and report state remain separate from the initially
`unresolved` Ember disposition; `setSpecialistDisposition` is an explicit later
interpretation step.

Issue #62 adds the production checkpoint implemented by
`reconcileSpecialistResult`. Before Ember may mark a result `accepted`, it compares
the immutable launch basis with a current checkpoint containing the objective
revision, relevant-context revision, and objective lifecycle status:

| Current checkpoint | Applicability | Ember disposition |
| --- | --- | --- |
| Objective and context revisions match; objective is current | `still_applicable` | Remains `unresolved`, or atomically receives the supplied verified disposition |
| Objective is superseded or its revision changed | `stale` | `stale` |
| Objective still matches but relevant context or requirements changed | `requires_re_evaluation` | `requires_re_evaluation` |
| Objective is cancelled | `rejected` | `rejected` |

The durable `currentness_evaluation` records the comparison time, launch basis,
current checkpoint, classification, and reason. Another process can therefore
inspect applicability after restart without consulting a Codex thread. The
Reconciliation is permitted only after a final report and observed child exit, so
an in-flight adapter cannot overwrite the decision with its older local record.
Calling reconciliation again from `requires_re_evaluation` is permitted, giving
the re-evaluation an explicit path to acceptance, qualification, or rejection.
That follow-up must supply the same current checkpoint and records a reasoned
resolution alongside the original `requires_re_evaluation` classification.
The current checkpoint and an optional verified final disposition are written in
the same transition; direct `setSpecialistDisposition(..., "accepted")` is
forbidden, preventing acceptance based on an older stored checkpoint.

The original report, `reported_success` state, and specialist provenance remain intact
when the current disposition becomes stale, requires re-evaluation, or rejected:
they establish historical evidence for the old premise, never current objective
completion. The specialist episode specification uses schema version 2 because the
structured derivation basis is intentionally incompatible with the free-form
version-1 basis. Issue #63 advances the record to version 3 to add durable
termination and recovery dimensions without changing the specialist report
contract.

The version-3 record keeps explicit cancellation and timeout as different
observations. When termination begins it separately records the initiating reason,
whether the direct child's exit was observed, and that the stop state of remote or
descendant work remains unknown. Direct-child exit is therefore never presented as
specialist-wide stop acknowledgement or rollback evidence. `inspectSpecialistEpisode`
loads and validates this inspection surface after restart. When restart establishes
that a previously committed `running`, `cancellation_requested`, or `timed_out`
attempt lost its supervisor, `recordSpecialistProcessLoss` converts it to durable
`lost`/`ambiguous` state without inventing a child exit.

Effect and retry recovery are likewise explicit. An attempt interrupted after
launch records `effects_possible` and `prohibited_pending_reconciliation`, even
when the requested work was expected to be harmless. Ember must observe the current
workspace plus any reachable remote or descendant targets and establish that
repetition is safe before a consequential retry. `reconcileInterruptedSpecialist`
records that additional observation. It permits retry only when the observation
establishes effect absence; observed effects keep retry prohibited until they are
resolved or deliberately accounted for. A pre-aborted episode is the narrower
case: no child is launched, non-effect is established at the boundary, and no
external-effect reconciliation is required.

Deterministic process coverage uses only a temporary controlled workspace and
`test-fixtures/providers/scripted-codex-specialist.ts`. It proves a real child
process can perform the bounded file change, while the durable record retains the
Codex report as attributed evidence rather than accepting it automatically. Fake
process coverage checks explicit cwd, prompt disclosure, environment filtering,
workspace sandbox selection, cancellation before launch, timeout distinct from
explicit cancellation, cancellation during harmless work and after a mutation may
have begun, unconfirmed direct-child termination, restart after supervisor loss,
the retry prohibition and reconciliation path, requirement change during work,
and a successful result arriving after objective supersession.

The opt-in live scenario is:

```bash
npm run smoke:specialist:live
```

It creates an ephemeral workspace outside Ember, asks authenticated Codex to create
one harmless text file, independently verifies the file, prints sanitized boundary
evidence, and removes the fixture. It never targets the Ember worktree by default.

### Observed and retained runtime limitations

- `codex exec` supplies no supported mid-turn authority mediation in this slice;
  the prompt requires Codex to report `blocked` when expansion is needed.
- Workspace-write is coarser than the semantic authority envelope. The durable
  record therefore preserves possible effects and never treats sandbox reach as
  authority.
- JSONL progress events are not promoted into durable semantic claims. The
  installed CLI can emit schema-shaped agent progress messages before its final
  message, so the adapter validates and retains the last schema-valid agent report;
  only child lifecycle, thread ID, and that final report cross the boundary.
- Cancellation observes only the direct child. Timeout, cancellation, output
  overflow, invalid report, or process loss remain ambiguous about prior effects.
  Automatic consequential retry is prohibited until current workspace and any
  reachable remote or descendant state have been reconciled sufficiently to
  establish that repetition is safe.
- Cancellation intent is persisted before signalling. If that durability write
  fails, the foreground supervisor records the failure in its returned evidence,
  still performs bounded best-effort direct-child termination to avoid abandoning
  a live runtime, and returns an ambiguous result; the last durable record may
  remain stale and recovery must preserve that gap.
- The record file is a minimal foreground supervisor artifact, not a scheduler.
  It survives the initiating call and preserves the episode boundary, but issue
  #60 does not add detached execution or process reattachment.

There is one deliberate narrowing from the issue-59 design: the first
implementation does not durably record intermediate artifact/progress events or
interactive approval requests because the selected CLI JSONL surface has not
established sufficiently stable, context-rich events for those claims. It records
a safely blocked final report or boundary uncertainty instead. No ownership,
authority, provenance, or currentness constraint is relaxed.
