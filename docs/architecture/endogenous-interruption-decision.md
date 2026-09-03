---
summary: "Current issue #78 boundary for deciding when completed internal cognition may justify user interruption, separating cognition from delivery and enforcing currentness, authority, attention, urgency grounding, and anti-repeat checks."
read_when:
  - "Implementing or reviewing issue #78 or endogenous user interruption decisions"
  - "Changing when internal cognition may become user-facing delivery"
  - "Evaluating quiet-period deferral, stale concern suppression, repeated-thought spam, or interruption authority"
role: design
discovery_status: current
---

# Endogenous User Interruption Decision

> Status: current transport-independent design and executable policy seam for issue
> #78. It follows the topic-free cognition-opportunity work from #73-#77 and does
> not implement Telegram, transport delivery, or a generic notification scheduler.

## Purpose

An endogenous opportunity choosing `cognition` means only that something deserves
internal thought. It does **not** mean that cognition has completed, and it does not
mean the user should be contacted. A completed internal cognition result is likewise
not a delivery command.

The interruption decision is therefore a later, separate lifecycle step. It consumes
a bounded handoff from completed internal cognition plus current semantic and
operational evidence, and may still choose no delivery.

This boundary implements the distinction already required by
[AS-AGY-05](acceptance-scenarios.md#as-agy-05): a useful current result during a
quiet period may be preserved and deferred instead of surfaced immediately. It also
follows ADR 0004's rule that capability and internal preference cannot manufacture
authority, and ADR 0005's separation of cognition, occurrence, delivery, effects,
and currentness.

## Boundary

`src/agency/interruption-decision.ts` exposes `decideUserInterruption`. It is a pure,
transport-independent policy step:

```text
topic-free opportunity -> decides cognition is worthwhile
                              |
                              v
                       internal cognition
                              |
                              v
                   CompletedInternalCognition
                              +
                 separate interruption candidate
                              +
                    current Ember meanings
                              +
                    explicit authority signal
                              +
                    current attention context
                              +
              prior successful-delivery grounding
                              |
                              v
             deliver | defer | suppress | no_delivery
```

The function does not mutate canonical state, create a commitment, create authority,
or attempt delivery. `deliver` only permits a later delivery layer to try contact;
it is not evidence that contact happened.

### Completed-internal-cognition handoff

Issue #74's `CognitionOpportunityRecord` is deliberately **not** accepted as an
interruption source. Its `decision: cognition` is a decision to begin cognition, not
evidence that cognition completed. Treating it as completed reasoning would collapse
two lifecycle stages and let a wake-up decision become a notification shortcut.

`CompletedInternalCognition` instead requires:

- the originating opportunity ID for provenance;
- a distinct cognition ID;
- principal and active scope;
- the revision against which the cognition result was validated;
- an explicit `status: completed`; and
- meaning IDs actually used by that completed cognition.

The current foreground `CognitionEpisode` representation is not reused as this
handoff because its v1 invariant models user-requested cognition whose successful
expression immediately enters delivery state. #78 does not weaken that existing
foreground contract merely to simulate endogenous execution. The bounded handoff is
the seam a later endogenous-cognition runner can produce without fabricating a user
request or claiming a delivery attempt.

## Authority is an explicit input

Ember v1 does not yet have a general durable standing-authority representation for
user interruption. Inventing one inside #78 would conflate this boundary with the
broader authority model and future surface/runtime work.

The policy therefore requires an explicit current authority classification:

- `authorized` permits the decision to proceed to timing/repetition checks;
- `unknown` defers rather than guessing permission; and
- `denied` suppresses the candidate.

The caller must derive that classification from the applicable authority policy and
current principal/recipient context. `decideUserInterruption` never infers authority
from provider capability, usefulness, urgency, or the existence of cognition.

## Candidate and currentness grounding

Completed internal cognition may produce no interruption candidate at all.
`candidate: null` yields `no_delivery`, so useful internal reasoning can remain
internal without being treated as failure.

A candidate contains only:

- grounding meaning IDs that the completed cognition actually used;
- `ordinary` or `time_sensitive` urgency; and
- explicit urgency-grounding meaning IDs when urgency is `time_sensitive`.

The policy rejects a candidate that reaches outside completed-cognition usage or
fabricates time sensitivity without grounding. Before any positive delivery outcome,
all candidate grounding is reconciled against current Ember state. Grounding is
stale when it is no longer current, no longer applicable, out of the active scope,
or represents a commitment that is no longer live.

This means previously valid internal reasoning may later be suppressed without
rewriting its historical truth.

## Outcome semantics

| Outcome | Meaning |
| --- | --- |
| `deliver` | A current candidate has explicit interruption authority and passes currentness, repetition, and attention checks. This permits a later delivery attempt; it is not proof of delivery. |
| `defer` | A candidate remains potentially useful but authority is unknown or ordinary contact falls in a quiet period. Underlying meaning remains unchanged. |
| `suppress` | A candidate exists but should not surface because grounding became stale, authority is denied, or the same complete grounding set already produced a successful delivery. Suppression does not erase cognition or source meanings. |
| `no_delivery` | There is no completed internal cognition source, or completed cognition produced no interruption candidate. |

The record uses an enumerated `basis` rather than model-written prose. Inspection and
evaluation therefore do not require persisting hidden reasoning or post-hoc motive
text as canonical meaning.

## Attention and urgency

`quiet_period` is an operational attention context, not a semantic fact about the
underlying concern. An ordinary candidate is deferred during a quiet period. A
`time_sensitive` candidate may proceed only when urgency is explicitly grounded and
authority is still current.

This preserves the research distinction that reason to communicate, timing, and
attention cost are separate. The policy cannot fabricate urgency merely to escape
quiet-period deferral.

## Anti-repeat rule

The caller may supply complete grounding sets from successful prior user deliveries.
A new candidate is `suppress / repeated_grounding` only when its entire grounding set
matches one prior delivered set, independent of ID ordering.

This is intentionally narrower than taking the union of every previously delivered
meaning. If A and B were delivered separately, a newly justified A+B combination is
not automatically classified as a repeat. At the same time, repeated internal thought
over exactly the same durable basis does not earn repeated interruption.

The delivery-grounding history is an operational input, not canonical memory.
#79/#95 may later earn a richer budget/backoff rule; #85/#88 own durable transport
occurrence and delivery correlation when a secondary surface exists.

## Executable scenarios

`src/agency/interruption-decision.test.ts` covers the issue contract directly:

1. **Useful interruption:** completed, current, authorized, time-sensitive internal
   reasoning may yield `deliver` while canonical state remains unchanged.
2. **Quiet-period defer:** useful ordinary cognition yields `defer` rather than an
   automatic notification.
3. **Authority boundary:** `unknown` defers and `denied` suppresses; cognition cannot
   mint permission.
4. **Repeated-thought spam:** an exactly repeated delivered grounding set is
   suppressed, while meanings delivered separately do not create a false repeat.
5. **Stale concern:** a resolved/historical commitment suppresses a candidate even
   when earlier internal cognition was valid.
6. **No delivery:** completed cognition may have no interruption candidate, and lack
   of completed cognition never becomes delivery.
7. **Grounding validation:** candidates cannot reach outside meanings actually used
   by completed cognition or claim ungrounded urgency.
8. **Lifecycle separation:** an unfinished cognition source is rejected rather than
   being treated as a completed interruption reason.

These scenarios are deterministic and require no live provider or messaging token.

## Deliberate limits

This issue does **not**:

- treat an opportunity's `decision: cognition` as completed reasoning;
- implement the provider runner that will produce endogenous internal cognition;
- send or queue messages;
- define Telegram or other transport identities;
- claim delivery success;
- introduce a durable generic authority subsystem;
- persist transport retry/replay state;
- create a scheduler, notification budget, or backoff mechanism; or
- automatically turn completed cognition into an interruption candidate.

Those boundaries remain with #79/#95 for evaluation-earned attention control,
#80/#81/#94 for long-lived runtime topology, and #52/#85-#88 for delivery surfaces
and transport uncertainty.

## Definition-of-done mapping

| Issue #78 requirement | Implemented evidence |
| --- | --- |
| Cognition and interruption are separate lifecycle decisions | Opportunity selection is not accepted as completed cognition; `CompletedInternalCognition` is a later handoff and interruption policy is a separate call. |
| Candidate reasons use current concern/urgency/authority evidence | Candidate IDs must have been used by completed cognition and remain current; time-sensitive urgency requires explicit grounding; authority is separate input. |
| Useful cognition may end without user delivery | `candidate: null -> no_delivery`; quiet periods and unknown authority can also defer. |
| Interruption cannot create authority or commitments | Function is pure and tests assert canonical state is unchanged; authority must be supplied explicitly. |
| Useful/defer/suppress/repeat/stale scenarios | Eight deterministic tests cover all named cases and the cognition-completion boundary. |
| Transport independence | No messaging/Telegram dependency or transport identifier appears in the contract. |
