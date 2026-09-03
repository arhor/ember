---
summary: "Issue #80 requirements for Ember's eventual long-lived runtime, derived from implemented endogenous cognition, specialist delegation, continuity, recovery, locking, and resource evidence without selecting a service topology."
read_when:
  - "Comparing foreground, externally triggered, daemon, or supervised-service runtime topologies for issue #81"
  - "Implementing or reviewing unattended wake-up, long-running specialist work ownership, restart recovery, shutdown, locking, status, or runtime configuration"
  - "Checking which long-lived capabilities are actually earned by issues #48, #50, #79, and #95 before adding service machinery"
role: design
discovery_status: current
---

# Long-Lived Runtime Requirements

> Status: current requirements artifact for issue #80. This document derives the
> smallest operational capabilities earned by Ember's implemented specialist and
> endogenous-cognition slices. It deliberately does **not** select a foreground
> process, daemon, service manager, scheduler, queue, IPC protocol, or deployment
> topology. Issue #81 owns that comparison and decision.

## Purpose

Ember now has two behaviors whose semantic lifetime can exceed one ordinary CLI
interaction:

1. a bounded Codex specialist episode whose objective, authority, observations,
   uncertainty, and reintegration state are durable independently of the Codex
   thread; and
2. a topic-free cognition opportunity path that can reactivate durable concerns,
   choose intentional silence, defer repeated unchanged attention locally, and
   separately decide whether completed cognition deserves user interruption.

Those features create real operational pressure, but not every pressure implies a
resident daemon. This note identifies what the eventual runtime **must make
possible** and what simpler foreground or externally triggered execution still
satisfies.

The governing distinction remains ADR 0005: process lifetime, session lifetime,
work lifetime, occurrence, delivery, external effects, and current applicability are
separate facts. A runtime topology is acceptable only if it preserves those facts
rather than hiding them behind process-oriented statuses.

## Evidence base

The requirements below are derived from repository behavior and accepted design,
not from product convention.

| Evidence | Operational pressure actually demonstrated |
| --- | --- |
| `minimal-continuity-slice.md` and its runbook | Complete process restart can preserve Ember continuity through durable state; a foreground process is sufficient for ordinary cognition, explicit inspection, correction, and controlled restart. The current store uses one cooperative writer and truthful lock recovery. |
| `minimal-codex-specialist-delegation.md` and `src/delegation/codex-specialist.ts` | Specialist work has an Ember-owned durable episode specification and observations; the Codex child may produce effects before timeout/cancellation/process loss; cancellation intent, observed exit, continued work, effects, retry safety, and reintegration remain separate. |
| `specialist-result-reintegration.md` | A completed specialist report cannot be accepted from its launch snapshot alone; current objective/context revisions and present lifecycle must be checked before reliance. |
| `cognition-opportunity.md` through the issue #73-#78 design chain | An endogenous opportunity is topic-free, may end in silence, and is distinct from user input, provider failure, completed cognition, user interruption, and actual delivery. |
| `endogenous-interruption-decision.md` | Completed internal cognition may yield `deliver`, `defer`, `suppress`, or `no_delivery`; `deliver` only permits a later delivery layer and does not prove contact. Transport delivery remains intentionally unimplemented. |
| `endogenous-selectivity-evaluation.md` | Issue #79 reproduced redundant repeated cognition; issue #95 removed it with an unchanged-projection deferral. No fixed scheduler interval, quiet-state cache, global opportunity budget, or service topology was earned. |
| ADR 0005 and `operational-model-sessions-and-surfaces.md` | Long-running work survives interaction boundaries on its own semantic terms; restart reconciles the justified present; downtime remains a truthful gap; delivery and surface reachability do not define work completion or authority. |
| ADR 0006 | Node.js 26 is the selected implementation runtime. Ambient OS capability remains distinct from Ember authority, and new runtime dependencies/service machinery must solve concrete requirements. |

## Requirement vocabulary

The words **must**, **should**, and **may** below describe implementation-neutral
runtime requirements:

- **must**: required to preserve already accepted or implemented behavior;
- **should**: strongly indicated by current evidence but may be satisfied in more
  than one way by #81;
- **may**: an allowed implementation choice, not an earned requirement.

A requirement does not imply that one permanently resident Ember process must own
it. A short-lived process plus an external trigger or supervisor may satisfy a
requirement if the same semantics and failure behavior are preserved.

## R1. Unattended cognition opportunities must be possible without attaching a CLI

A live concern can remain current while no foreground interactive session exists.
The eventual operational arrangement must therefore be able to cause a topic-free
cognition opportunity without requiring the user to first open the CLI.

The wake-up mechanism must supply **opportunity**, not motive:

- it must not encode the concern or conclusion that should be considered;
- the ordinary bounded projection remains the source of current semantic material;
- `no_cognition` remains a successful result;
- opportunity creation must not imply that cognition actually ran; and
- missed opportunities during downtime must not be backfilled as fictional thought.

This can be satisfied by a resident loop, an OS/service-manager timer, another local
trigger, or a future surface/runtime event. #80 does not choose among them.

### Not earned

Issues #79/#95 provide no evidence for a universal period such as "every N minutes",
a cron-like prompt, or one evaluator call per wall-clock interval. Any topology that
requires such a cadence merely for architectural convenience would be adding policy,
not implementing a demonstrated requirement.

## R2. Elapsed time must be able to reopen attention when time is semantically relevant

Issue #95's repeated-projection control intentionally defers an unchanged bounded
projection after successful cognition. A fresh runtime currently reopens evaluation,
but restart cadence must not become an accidental attention policy.

The eventual runtime must therefore provide a topology-independent way for elapsed
time to matter **when** the meaning of a current concern depends on time. The exact
representation is unresolved. Valid implementations could include a new currentness
observation, a reconsideration epoch, or another explicit projection-relevant fact.

The runtime must not:

- keep a semantically time-sensitive concern deferred forever merely because its
  non-time projection identifiers are unchanged; or
- manufacture periodic cognition solely to avoid that failure.

No fixed reconsideration duration is currently earned.

## R3. Live specialist work must have operational ownership independent of the initiating surface

A specialist objective can remain live after the interaction that created it ends.
The eventual runtime must make it possible for that work to retain an operational
owner while no initiating CLI is attached.

For an in-flight specialist episode, the owner must be able to preserve or later
establish the strongest justified facts about:

- whether launch was attempted and a direct child was observed;
- whether the specialist is still believed to be running, blocked, exited, or lost;
- cancellation intent versus observed termination;
- known and possible workspace, descendant, remote, or other external effects;
- partial/final specialist evidence already observed; and
- what reconciliation is required before consequential retry or result acceptance.

This does not require preserving a Codex thread. Current specialist design treats
replacement as a new Ember episode and keeps Codex-local continuity non-canonical.

If the selected topology cannot keep the original local child/runtime observable
across an interaction boundary, it must still durably classify the resulting loss
and uncertainty rather than silently treating the work as stopped or complete.

## R4. Operationally significant state must be durable before consequential transitions

Existing slices already persist important evidence before acting:

- the specialist episode specification is written before launch;
- cancellation intent is persisted before signalling the child when possible;
- currentness/reintegration decisions are durably recorded; and
- Ember continuity state survives complete process replacement.

A long-lived topology must preserve that ordering discipline. Process memory may
cache operational data, but restart correctness cannot depend on memory that was
never durably represented before a consequential transition.

Durable state remains semantic/operational evidence, not proof that the process that
wrote it is still alive.

## R5. Restart must reconcile incomplete work instead of replaying it

On startup after an unclean stop, runtime loss, or host restart, Ember must inspect
surviving evidence and reconstruct the strongest justified present.

At minimum the recovery path must be able to identify:

- specialist attempts that were nonterminal when supervision disappeared;
- cancellation/timeout states whose direct-child or descendant outcome is unknown;
- possible or known effects that prohibit blind retry;
- unresolved currentness checks before reintegration;
- live concerns/opportunities that remain semantically current; and
- genuine operational gaps that cannot be reconstructed.

Recovery must not automatically:

- rerun a specialist episode because its previous process disappeared;
- mark work failed merely because the supervisor restarted;
- claim a cancelled child stopped all work or rolled back effects;
- recreate an old cognition prompt as though its assumptions were still current; or
- replay every missed cognition opportunity accumulated during downtime.

Issue #83 should turn these requirements into deterministic recovery scenarios
against the topology selected by #81/#94.

## R6. Clean shutdown must preserve work truth, not merely terminate processes

The selected runtime needs a defined clean-shutdown boundary. Shutting down the
runtime may stop its ability to observe or execute work, but it must not silently
rewrite the lifecycle of Ember-owned objectives or concerns.

Before exit the runtime should, as applicable:

- stop accepting new operational work;
- persist the shutdown observation needed to distinguish a clean gap from a crash;
- release or transfer any writer ownership safely;
- either finish, explicitly request cancellation of, transfer ownership of, or
  truthfully classify each in-flight specialist attempt; and
- leave unresolved work/concerns durable for later reconciliation.

Whether shutdown waits for work, requests cancellation, or hands work to another
supervised locus is a topology choice for #81. "Kill children and call everything
cancelled" is not semantically sufficient.

## R7. Single-writer and concurrency safety must survive the topology change

The current continuity store uses a cooperative exclusive-create writer lock and
fails closed when ownership is live, foreign-host, malformed, permission-denied, or
indeterminate. Stale-lock recovery requires explicit quiescence evidence rather than
age alone.

A long-lived runtime must retain equivalent safety properties:

- two Ember writers must not concurrently mutate the same canonical state without a
  new reviewed concurrency design;
- double-start or overlapping trigger execution must fail safely or coordinate
  through an explicit writer boundary;
- crash recovery must not treat elapsed lock age as proof that no writer exists;
- PID/process identity must remain operational evidence only, never Ember identity;
- read-only status/inspection should remain possible without manufacturing write
  ownership where feasible.

A daemon/service manager does not by itself solve writer correctness. Likewise an
external periodic trigger is acceptable only if overlapping invocations cannot
violate the store boundary.

## R8. Status and inspection must expose semantic-operational truth, not only service liveness

The eventual runtime must provide an operator-visible way to distinguish at least:

- runtime reachable/running versus Ember continuity state present on disk;
- idle runtime versus in-flight specialist work;
- live, blocked, lost, timed-out, or cancellation-requested specialist attempts;
- unresolved recovery/effect reconciliation;
- current pending concerns/opportunities where the implementation can justify them;
- last clean/unclean runtime boundary and truthful downtime gaps; and
- degraded conditions such as state-lock contention or unavailable provider/runtime
  capability.

A process-manager status such as `active (running)` may be included but cannot be the
complete Ember status surface. Conversely, Ember status must not claim a provider,
child process, external effect, or delivery is healthy merely because the core
process is alive.

## R9. Runtime configuration must be explicit and secrets must remain runtime-owned where already established

Long-lived execution removes some ambient assumptions that are convenient in an
interactive shell. The selected topology must therefore have an explicit,
inspectable configuration boundary for the capabilities it actually needs, including
as applicable:

- canonical state path and local principal/configuration identity;
- provider/specialist executable selection and bounded arguments;
- opportunity/wake-up policy inputs actually earned by evidence;
- workspace roots or other delegated-work capability boundaries;
- log/status/runtime directories when required by the topology; and
- host/service-manager integration settings.

Existing subscription-backed provider authentication remains owned by the external
runtime. Ember must not copy Codex credentials into canonical state or service
configuration merely to make unattended execution convenient. A service deployment
may need deliberate access to the runtime-owned credential store, but that is host
capability/configuration, not new Ember authority.

Machine-specific paths, tokens, chat identifiers, and credentials must not become
committed repository defaults.

## R10. Resource behavior must be measurable as a resident core and attributed child processes

The current endogenous evaluation measured one scripted orchestration process at
roughly 94-100 MiB RSS on one CI host and explicitly did **not** observe external
Codex child-process resources. Earlier runtime evaluation showed only small
workload-specific Node/Deno resident differences. Neither result is a steady-state
service budget.

Therefore #81/#94 must choose a topology that #82 can measure reproducibly, and the
implementation must make it practical to distinguish:

- resident Ember core process(es);
- transient cognition/specialist runtime children; and
- any supervisor/service-manager process cost that is materially attributable to
  the deployment.

No numeric RSS/CPU threshold is earned by current evidence. The resource requirement
is instead: avoid adding permanently resident machinery that has no demonstrated
semantic/operational purpose, and keep the topology observable enough for #82/#84 to
measure real idle and active cost.

## R11. Interruption handoff must survive runtime boundaries; transport delivery is not yet required

Issue #78 already separates completed internal cognition from the later interruption
decision. A current authorized candidate may yield `deliver`, but that outcome only
permits a later delivery layer to attempt contact; it is not itself delivery evidence.
`defer` similarly means the candidate may remain useful without being surfaced now.

For unattended cognition, the selected runtime must therefore avoid making an
interruption outcome depend on the continued existence of the process that computed
it. If a `deliver` or semantically live `defer` handoff needs to survive a runtime
boundary before any delivery layer can act, #81/#94 must preserve enough operational
state to resume from that handoff truthfully rather than recomputing or dropping it
silently.

That requirement does **not** yet earn transport infrastructure. #51 does not
currently require:

- a notification queue or generic delivery scheduler;
- Telegram delivery;
- cross-surface routing;
- retrying outbound messages while offline;
- durable transport occurrence/deduplication state owned by #85/#88; or
- treating a reachable surface as the owner of a result.

The topology should expose a narrow handoff boundary that can later be consumed by
#52 without implementing future surface semantics early. Actual delivery attempts,
transport retry/replay, recipient mapping, and delivery uncertainty remain work for
the secondary-surface epic.

## R12. Platform and supervision assumptions must remain explicit

Current repository execution is proven on Node.js 26 and a local Linux filesystem.
The lock runbook and process termination behavior already contain Linux-specific
observations. #81 must therefore state which hosts it is selecting for the first
long-lived deployment and which parts remain portable Ember core semantics.

The requirements in this document do not demand systemd, launchd, containers,
Windows services, or multi-host execution. If one platform-specific supervisor is
selected, startup/restart/install details may be platform-specific while durable
Ember semantics remain independent of that supervisor's identity and state model.

## Negative evidence: what still works without a daemon

The completed slices leave substantial evidence against premature service
complexity.

| Capability | Foreground process or simpler trigger remains sufficient because... |
| --- | --- |
| Ordinary user-requested cognition | The current CLI can load durable state, construct a fresh bounded projection, invoke a provider, record lifecycle evidence, and stop cleanly. |
| Continuity across downtime | Ember identity/current meaning already survive complete process absence. No resident process is required merely to remain the same Ember. |
| Manual inspection/correction/recovery | `inspect`, `check`, lock diagnosis, correction, and explicit recovery operations are naturally short-lived commands. |
| Topic-free cognition opportunity | A short-lived externally triggered invocation can satisfy the semantic opportunity boundary if trigger overlap, attention reconsideration, and store locking are handled correctly. |
| Quiet periods | Silence requires no resident cognition loop. #79/#95 explicitly provide no evidence for continuous polling or a fixed opportunity cadence. |
| Durable specialist history after completion/loss | Episode records and reintegration evidence survive process exit without preserving a Codex thread. |
| Transport delivery | There is no second production surface yet, so unattended outbound transport is not part of #51's demonstrated requirement set. The narrow interruption handoff in R11 is sufficient for #81. |

The strongest pressure **for** a long-lived operational locus is not continuity by
itself. It is the combination of unattended opportunities and owning/observing
specialist work while no interactive process is attached. #81 should compare whether
those pressures are best satisfied by one resident Ember process, supervised
short-lived executions plus external ownership, or another smaller local arrangement.

## Requirement-to-topology handoff for #81

Issue #81 should evaluate every candidate topology against the following questions.

| Area | Candidate must answer |
| --- | --- |
| Process ownership | What operational locus owns an in-flight Codex child/runtime after the initiating interaction ends? What happens if that locus disappears? |
| Startup | How are double-start, existing live writer, malformed/stale lock, and incomplete prior work handled? |
| Shutdown | What happens to new work, writer ownership, current specialist attempts, unresolved concerns, and clean-gap evidence? |
| Wake-up | What creates topic-free opportunities with no attached CLI, and how is overlap prevented without encoding motive? |
| Reconsideration | How can elapsed time materially reopen an unchanged concern without using restart frequency as hidden policy? |
| Restart/recovery | Which durable records are scanned/reconciled, and how are unknown effects or continued specialist work exposed? |
| Locking/concurrency | How does the topology preserve one-writer safety across service restart, external triggers, and manual CLI commands? |
| Status/inspection | How can an operator distinguish service liveness, idle state, in-flight work, uncertainty, blocked recovery, and provider capability? |
| Configuration/secrets | Where do state paths, provider commands, policy inputs, and runtime-owned auth access come from without committing secrets? |
| Resource envelope | What is permanently resident, what is transient, and how can #82 attribute RSS/CPU/process counts? |
| Platform scope | Which process-manager/OS assumptions are first-class deployment constraints and which semantics remain portable? |
| Interruption/delivery handoff | How does a semantically live `deliver`/`defer` handoff survive a runtime boundary without prematurely implementing transport semantics from #52? |

## Explicit non-requirements

No current evidence requires any of the following:

- a generic background job framework;
- a durable message broker or generic delivery queue;
- distributed or multi-host coordination;
- persistent Codex sessions;
- automatic specialist retry after ambiguous failure;
- replay of missed endogenous opportunities;
- fixed-rate polling or cron prompts;
- a general scheduler API;
- Telegram or cross-surface transport delivery;
- generic plugin/runtime abstraction;
- service identity as Ember identity; or
- a new persistence technology merely because the process becomes long-lived.

Any of these may become justified by later evidence. None should be treated as an
input assumption to #81.

## Definition-of-done mapping

| Issue #80 requirement | This artifact |
| --- | --- |
| What must survive with no foreground CLI | R1-R6 separate unattended opportunity, specialist work ownership, durable transition evidence, recovery, and shutdown from interaction lifetime. |
| Wake-up, long-running work, cancellation, recovery, locking, delivery | R1-R9 and R11 state the earned requirement or explicit non-requirement for each, including the interruption handoff without transport pre-implementation. |
| #79/#95 attention/backoff/resource findings | R2 captures time-sensitive reconsideration; R10 keeps resource claims measurable and non-numeric; the negative-evidence table preserves the absence of a fixed cadence/global budget. |
| Durable semantic vs ephemeral runtime state | R3-R8 repeatedly distinguish objective/concern/episode evidence from child PID, process liveness, supervisor status, and runtime caches. |
| Negative evidence against unnecessary service complexity | The dedicated negative-evidence table identifies capabilities that remain satisfied by foreground or externally triggered execution. |
| Implementation-neutral input to #81 | The handoff table names questions every topology must answer while this document chooses none. |
