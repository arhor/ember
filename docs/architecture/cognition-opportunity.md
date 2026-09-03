---
summary: "Current design for a topic-free cognition opportunity that exposes bounded current Ember state without turning wake-up mechanism into motive, user input, or a scheduler-owned topic."
read_when:
  - "Implementing or reviewing topic-free endogenous cognition opportunities, wake-ups, idle pulses, or the decision to remain silent"
  - "Changing the boundary between runtime wake-up mechanisms, bounded state projection, and endogenous cognition"
  - "Implementing issue #74 or evaluating AS-AGY-01 and AS-AGY-02 against an executable opportunity boundary"
role: design
discovery_status: current
---

# Bounded Cognition-Opportunity Boundary

> Status: current design for issue #73 and implementation input to issue #74.

## Purpose and scope

This design defines the smallest semantic boundary through which Ember can receive
an opportunity for endogenous cognition without receiving a topic, conclusion, or
new authority in the trigger itself.

The boundary is deliberately smaller than a scheduler, heartbeat, background
service, motivational system, or cognition loop. It says what an opportunity means,
what current state may be made available at that boundary, how the opportunity is
attributed, which outcomes are allowed, and how it relates to existing runtime and
cognition episodes. It does not decide how or how often opportunities are created.

The governing constraints remain the canonical
[endogenous-agency research](../research/endogenous-agency-and-self-initiated-behavior.md),
[operational-model research](../research/operational-model-sessions-and-surfaces.md),
[ADRs 0001, 0003, and 0005](decisions/README.md), and the
[agency acceptance scenarios](acceptance-scenarios.md#endogenous-agency-and-attention).
This document selects a narrow implementation boundary beneath those semantics; it
does not create another semantic ADR.

The central invariant is:

> **A cognition opportunity explains why cognition is possible now. Ember-owned
> current state must explain what, if anything, deserves cognition.**

## Why the current ordinary cognition path cannot represent wake-up directly

The current production path is intentionally user-input shaped:

- `runCognition` accepts required `text`;
- it records that text as `userEvidence` before invoking a provider;
- `ProviderRequest` requires `input.text`; and
- `Projection` currently carries `current_input` as a string.

That is correct for ordinary interactive cognition, but it means a wake-up must not
be implemented by calling `runCognition` with an empty string or a synthetic prompt
such as `you may think now`. Either representation would make a non-user occurrence
look like user evidence and risk letting the trigger text determine the topic.

Issue #74 therefore needs a boundary *before* ordinary cognition. It may reuse the
existing projection-selection semantics, provider adapters, and cognition machinery
after a topic has earned attention, but the opportunity itself is not an ordinary
user request and must not be persisted as one.

## Semantic contract

A cognition opportunity is one bounded operational occurrence with these meanings:

| Concern | Required meaning |
| --- | --- |
| Opportunity identity | Ember can distinguish this opportunity occurrence from another opportunity, user request, scheduled task payload, delegated result, or cognition episode. The identity is Ember-owned and independent of process/provider thread IDs. |
| Runtime locus | The opportunity is observed in one current runtime episode. Runtime identity locates the observation but does not own Ember continuity or the concern that may later be selected. |
| Principal and scope | The same explicit principal/scope boundary used for normal projection selection applies. Wake-up creates neither a new principal nor broader disclosure. |
| Observation time | The opportunity records when Ember could evaluate current state. Time may affect currentness or urgency, but it is not itself a topic or motive. |
| Mechanism provenance | The occurrence may identify the mechanism that made evaluation possible, for example a foreground probe, runtime start, idle opportunity, or future scheduler tick. This is operational provenance only. |
| Topic | **Absent.** The opportunity does not carry a subject, task, desired conclusion, concern ID to activate, search query, reminder text, or provider prompt that predetermines what deserves attention. |
| Current state | Candidate state is supplied only through Ember's normal least-sufficient permitted projection boundary. Canonical storage is not handed directly to the endogenous decision step. |
| Authority | None is added. Motivation may later justify thought or preparation; external action or user interruption remains behind its own authority/currentness boundary. |

A trigger that already says `revisit project X`, `research Y`, `send Z`, or an
equivalent topic-bearing instruction is not a cognition opportunity in this sense.
It is an externally specified occurrence and must be routed according to its actual
semantics rather than relabelled as endogenous wake-up.

## Topic-free does not mean provenance-free

Removing the topic does not require making the trigger mysterious. Ember should be
able to inspect why an opportunity was available without treating that explanation
as motivation.

Useful mechanism provenance can include:

- the current runtime episode;
- observation time;
- a coarse source kind such as foreground test/probe, startup/recovery opportunity,
  idle opportunity, or a future external timing mechanism;
- an opaque external occurrence identifier when one is needed for deduplication;
  and
- bounded operational facts needed to establish that the opportunity is current
  and not a replay.

Mechanism metadata must not contain a hidden topic field under another name. In
particular, scheduler job names, free-form reminder text, queue payloads, or event
summaries are not safe opportunity provenance when they materially steer subject
selection.

## Projection boundary

The opportunity decision receives a bounded projection of current Ember-owned state,
not the canonical store and not a synthetic conversation turn.

The current `buildProjection` implementation already establishes the important
selection invariants that should be reused rather than forked:

- principal and active scope are explicit;
- current facts and preferences are selected by scope;
- live commitments can participate without becoming transcript replay;
- relationship meaning is tied to the principal;
- restart recovery can mark live commitments as needing a currentness check;
- selected meaning/evidence IDs remain inspectable; and
- raw transcript is excluded.

Issue #74 may need the smallest representation extension that lets this projection
be built for an endogenous decision without fabricating `current_input`. Whether
that is represented as a nullable input, a discriminated stimulus kind, or another
narrow internal shape is an implementation decision. Whatever representation is
chosen must preserve these observable rules:

1. the opportunity contributes **no topic text** to candidate selection;
2. no `user_command` / user-input evidence is created merely because an
   opportunity occurred;
3. the decision step sees no canonical state outside the selected projection;
4. selected state retains provenance/currentness information needed to tell a live
   concern from stale or superseded history; and
5. the same principal, scope, recovery, privacy, and evidence-selection rules remain
   authoritative.

This is intentionally not a new retrieval subsystem. Richer selection/indexing was
left unwarranted by the longitudinal evaluation in issue #72; endogenous cognition
must begin from the current projection discipline and earn any later change through
its own evaluation evidence.

## Opportunity lifecycle and allowed outcomes

An opportunity can be understood as the following semantic progression:

```text
topic-free opportunity observed
            |
            v
bounded current projection assembled
            |
            v
is anything worth cognition now?
      /             |              \
     v              v               v
 cognition         defer        no cognition
     |
     v
ordinary/private cognition lifecycle
```

The three decision outcomes are distinct:

| Outcome | Meaning |
| --- | --- |
| `cognition` | Current projected state contains at least one sufficiently worthwhile concern/topic to justify spending cognition resources now. The selected concern, not the opportunity mechanism, explains the topic. |
| `defer` | A potentially relevant concern exists, but currentness, competing foreground work, resource/attention limits, missing evidence, or another bounded reason makes cognition inappropriate now. The concern may remain live without becoming a scheduled prompt. |
| `no_cognition` | Nothing in the current bounded state warrants further discretionary cognition. This is a successful endogenous outcome, not provider failure, timeout, missing output, or an obligation to invent activity. |

Issue #75 will harden the durable/inspectable representation of intentional silence
and distinguish it from operational failure. Issue #73 only requires the lifecycle
to leave room for that truthful distinction.

Operational failure while evaluating an opportunity is not a fourth semantic
choice. Failure, cancellation, unavailable provider state, or uncertain termination
must remain operational evidence about the attempted decision and must never be
reported as intentional `no_cognition`.

## Relation to runtime and cognition episodes

A cognition opportunity and a cognition episode are different occurrences.

- The opportunity belongs to a current runtime locus but is not the runtime itself.
- Observing an opportunity does not prove cognition occurred.
- Choosing `no_cognition` or `defer` need not create an ordinary cognition episode.
- If `cognition` is chosen, the resulting cognition episode should reference the
  opportunity/decision evidence needed to explain why this cognition became
  eligible, while keeping hidden model reasoning non-canonical.
- Provider thread IDs remain operational evidence only and cannot identify an
  opportunity, concern, or Ember continuity.
- A restart can create a new opportunity from surviving current state; it cannot
  backfill cognition into the downtime interval.

An implementation may introduce an inspectable *decision attempt* distinct from a
full cognition episode if real-model evaluation requires it. That record should
capture occurrence, projection selection, outcome, and bounded evidence needed for
evaluation, not raw chain-of-thought or a model-generated story promoted to durable
motivation.

## Focused acceptance refinements for issues #73 and #74

The canonical catalogue already supplies the representation-neutral baseline:
[AS-AGY-01](acceptance-scenarios.md#as-agy-01) requires a topic-free pulse to permit
successful silence, while [AS-AGY-02](acceptance-scenarios.md#as-agy-02) requires a
persisting concern, rather than the wake-up, to explain renewed attention. The
following focused refinements make that baseline directly executable by issue #74
without changing its semantics.

### CO-01 — Same opportunity, quiet state

- **Given:** A current runtime, explicit principal/scope, and projected durable state
  containing no live concern with sufficient current value.
- **When:** A cognition opportunity with fixed topic-free mechanism provenance is
  evaluated.
- **Then:** `no_cognition` is an allowed successful outcome; no user-input evidence,
  provider reply, delivery attempt, invented concern, or synthetic motive is
  required.
- **Proves:** [AS-AGY-01](acceptance-scenarios.md#as-agy-01).

### CO-02 — Same opportunity, live concern

- **Given:** The *same* opportunity input/provenance as CO-01, but current projected
  durable state contains one live, applicable concern or commitment whose present
  consequence can justify attention.
- **When:** The opportunity is evaluated.
- **Then:** The decision may select that concern for cognition. Recorded evidence
  can identify selected meaning/provenance, but the opportunity mechanism remains
  topic-free and cannot be cited as the motivational source.
- **Proves:** [AS-AGY-02](acceptance-scenarios.md#as-agy-02) and the counterfactual
  distinction between wake-up and motive.

### CO-03 — Topic-bearing trigger is rejected from this boundary

- **Given:** A trigger payload names a task, subject, concern, reminder, desired
  action, or desired conclusion.
- **When:** The caller attempts to submit it as a cognition opportunity.
- **Then:** The opportunity boundary rejects/reclassifies it rather than stripping
  attribution and pretending the resulting topic was endogenous.
- **Proves:** wake-up mechanism cannot smuggle in the content it later claims Ember
  selected herself.

### CO-04 — Opportunity after restart

- **Given:** A surviving live concern exists before a clean or uncertain runtime
  gap, and no supported Ember cognition is established during that gap.
- **When:** A fresh runtime receives a topic-free cognition opportunity and builds a
  current bounded projection.
- **Then:** Surviving state may make the concern eligible after a currentness check,
  or the decision may defer/remain silent. Nothing may claim that the wake-up or
  downtime itself performed cognition.
- **Proves:** ADR 0001/0005 continuity and recovery semantics remain intact at the
  endogenous boundary.

For deterministic evaluation, CO-01 and CO-02 must use byte-for-byte equivalent
opportunity mechanism inputs wherever practical; only Ember-owned durable state
should differ. This is the strongest guard against accidentally teaching a test
harness or scheduler to answer the endogenous decision in advance.

## Implementation handoff for issue #74

Issue #74 can implement the smallest evaluable decision path from this design. It
should not need to reconstruct the semantics from the research corpus.

The expected implementation shape is deliberately narrow:

1. introduce an explicit internal opportunity occurrence/input that cannot contain
   topic text;
2. obtain candidate state through the existing projection-selection boundary rather
   than direct store access;
3. add only the projection/request representation needed to distinguish endogenous
   evaluation from ordinary user input;
4. evaluate `cognition`, `defer`, or `no_cognition` with deterministic fakes and an
   opt-in real-model path;
5. record bounded decision occurrence/outcome/projection evidence for inspection,
   without persisting hidden reasoning or model-written motivational prose as
   canonical meaning;
6. create an ordinary/private cognition episode only after `cognition` is selected;
7. keep user delivery/interruption out of this step; issue #78 owns that later
   boundary; and
8. keep scheduling/topology out of this step; issues #79/#80/#81 determine whether
   observed behavior eventually earns attention controls or a long-lived runtime.

The production Codex adapter may be reused after the decision boundary proves that
model cognition is warranted, but issue #74's deterministic tests must not depend
on subscription access.

## Non-goals and deferred representation choices

This issue deliberately does **not** choose:

- periodic frequency, timers, cron, heartbeat cadence, OS scheduler, daemon, service,
  queue, or process topology;
- a motivational score, priority formula, curiosity reward, token budget, or
  universal salience ranking;
- a new durable concern class when existing live commitments/current meanings are
  sufficient for the first scenarios;
- notification policy or user interruption;
- automatic external action or additional authority;
- richer retrieval/indexing machinery;
- a generic event bus or stimulus framework; or
- a provider-owned memory/session for endogenous continuity.

These remain separate questions because the accepted semantics do not require them
to define a truthful topic-free opportunity.

## Definition-of-done mapping

| Issue #73 requirement | Design result |
| --- | --- |
| Distinct from user request, scheduled task payload, and delegated result | The semantic contract and current-path analysis define a separate opportunity occurrence and reject topic-bearing payloads. |
| Trigger does not smuggle in a topic | Topic absence is an invariant; CO-01/CO-02 hold opportunity inputs constant while durable state changes. |
| Current durable state uses normal projection boundary | The projection section explicitly reuses current principal/scope/currentness/provenance selection and forbids direct canonical-store disclosure. |
| Cognition, defer, and no cognition are possible | The lifecycle defines all three as separate outcomes and keeps operational failure distinct. |
| No daemon or fixed scheduler required | Scheduling and topology are explicit non-goals; foreground probes are valid opportunity mechanisms. |
| #74 can implement from repository artifacts | The implementation handoff defines the minimal boundary, deterministic controls, evidence expectations, and anti-patterns. |
