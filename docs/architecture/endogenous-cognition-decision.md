---
summary: "Current implementation and evaluation boundary for deciding whether topic-free opportunities deserve cognition, using bounded Ember state and inspectable outcome evidence without persisting model-written motives."
read_when:
  - "Implementing or reviewing issue #74's endogenous cognition decision path"
  - "Evaluating cognition, defer, or no-cognition outcomes from a topic-free opportunity"
  - "Changing the Codex-backed endogenous decision evaluator or its deterministic scenario controls"
role: design
discovery_status: current
---

# Endogenous Cognition Decision Boundary

> Status: current implementation/evaluation design for issue #74, beneath the
> [bounded cognition-opportunity boundary](cognition-opportunity.md).

## Purpose

Issue #73 established that a wake-up may explain why cognition is possible now but
must not supply the topic or motive. Issue #74 makes the next boundary executable:
given a topic-free opportunity and a bounded projection of current Ember-owned
state, decide whether anything deserves discretionary cognition now.

The implementation deliberately stops before issue #75's durable intentional-silence
lifecycle. An issue-74 decision record is inspectable evaluation evidence returned by
the decision boundary. It is **not** silently promoted into canonical memory or a
new durable motive. Issue #75 can harden the representation of successful silence
only after this boundary has demonstrated the required distinction.

## Implemented seam

`src/agency/cognition-opportunity.ts` introduces a narrow evaluator contract:

```text
current Ember state + active runtime
              |
              v
normal bounded projection selection
              |
              v
 OpportunityProjection
 (no current_input, no trigger mechanism)
              |
              v
      OpportunityEvaluator
              |
      +-------+--------+
      |       |        |
 cognition   defer   no_cognition
```

The caller supplies only a coarse, enumerated opportunity mechanism such as
`foreground_probe`, `runtime_start`, `idle_opportunity`, or `external_timing`.
That mechanism is retained in the returned occurrence record for operational
inspection but is **not passed to the evaluator**. There is no free-form trigger
payload, reminder text, concern identifier, search query, or task description in the
evaluator request.

This is stronger than merely asking a model to ignore scheduler text: the decision
contract does not expose such text at all.

## Projection reuse without fabricated user input

The implementation reuses the current `buildProjection` selection path rather than
creating a parallel context selector. The internal compatibility call supplies an
empty `currentInput` because the existing v1 selector requires the field but does not
use it to inject or select a topic. `buildCognitionOpportunityProjection` then
returns an `endogenous_decision` projection that omits `current_input` entirely.

The evaluator therefore receives:

- the same explicit principal and active scope as current cognition;
- the same current relationship/fact/preference/commitment selection rules;
- the same provenance-bearing projected meanings/evidence;
- the same recovery account and currentness qualification;
- no raw transcript;
- no user-input evidence created for the opportunity; and
- no synthetic user message.

This compatibility bridge should remain narrow. If ordinary projection selection
later begins using `current_input` materially, the endogenous path must be revisited
rather than allowing an empty string to become hidden selection semantics.

Issue #72's longitudinal result remains active negative evidence against adding a
new retrieval/indexing subsystem here. The endogenous boundary starts from the
current projection discipline and must earn any richer selection mechanism through
observed omission/inclusion harm.

## Evaluator result contract

An evaluator returns exactly:

```json
{
  "contract_version": 1,
  "decision": "cognition | defer | no_cognition",
  "selected_meaning_ids": []
}
```

The boundary validates that:

- every selected meaning was present in the bounded projection;
- selected IDs are unique;
- `cognition` and `defer` identify at least one projected meaning that grounds the
  decision; and
- `no_cognition` selects no meaning.

There is intentionally no free-form `reason` field. A model-generated explanation
may be useful transiently for debugging, but issue #74 does not need hidden reasoning
or model-written motivational prose to establish the observable decision. The
inspectable evidence is the opportunity occurrence, projection revision and
membership, outcome, and selected grounding IDs.

## Returned decision record

`evaluateCognitionOpportunity` returns a bounded non-canonical record containing:

- Ember-generated opportunity identity;
- owning runtime, principal, and active scope;
- coarse opportunity mechanism and observation time;
- validated canonical revision;
- projected meaning/evidence IDs;
- `cognition`, `defer`, or `no_cognition`; and
- selected grounding meaning IDs.

The function does not mutate `EmberState`, create `user_command` evidence, create an
ordinary cognition episode, or create a delivery attempt. This keeps issue #74 from
pre-empting issue #75's durable silence representation or issue #78's user
interruption boundary.

Operational/provider failure is also not collapsed into `no_cognition`. An evaluator
that fails throws through its existing provider/error semantics; intentional silence
requires an explicit validated `no_cognition` result.

## Deterministic scenario controls

`src/agency/cognition-opportunity.test.ts` exercises the issue-73 CO-01/CO-02
counterfactual directly.

Two states receive the same `foreground_probe` mechanism and the same evaluator:

| Scenario | Durable state difference | Expected outcome |
| --- | --- | --- |
| Quiet state | No current live commitment in the bounded projection | `no_cognition`, no selected meaning |
| Current concern | One live Ember commitment in the bounded projection | `cognition`, commitment ID selected |

The deterministic evaluator sees only the projection. It has no access to the
mechanism or any hidden scheduler payload. The tests also verify that evaluation
leaves canonical state unchanged, does not create user evidence, rejects selection
outside the projection, rejects a fabricated selected reason for `no_cognition`, and
rejects opportunities attached to a stopped runtime.

These tests are semantic controls, not a claim that every live commitment should
always trigger cognition. Later evaluation may decide that a current concern should
be deferred or ignored because of value, currentness, resource, or attention
pressure. The contract merely proves that current Ember-owned state can materially
change the decision while an identical topic-free wake-up does not.

## Codex-backed live evaluator

`src/agency/codex-opportunity-evaluator.ts` provides an opt-in real-model evaluator
using the already-supported isolated Codex provider boundary.

The adapter does **not** call `runCognition` and therefore does not create synthetic
`userEvidence`. For compatibility with the existing one-shot provider contract it
uses one fixed evaluator instruction as `input.text` and `Projection.current_input`
inside the adapter. That text is invariant across opportunities and says only to
choose `cognition`, `defer`, or `no_cognition` from projected state. It contains no
scheduler topic, concern name, or scenario-specific desired answer.

This fixed instruction is evaluator framing, not wake-up provenance. The actual
opportunity mechanism remains absent from the provider request.

The provider reply must be exactly one bounded decision token. Existing
`used_meaning_ids` becomes the evaluator's selected grounding IDs; the core
opportunity boundary then applies its stricter outcome validation.

### Reproduction

A live subscription-backed probe is available without making normal tests depend on
Codex access:

```bash
EMBER_RUN_LIVE_ENDOGENOUS=1 node scripts/live-cognition-opportunity.ts
```

`EMBER_CODEX_COMMAND` may select another installed `codex` executable path. The
script runs two synthetic states through the same `foreground_probe` mechanism:
quiet state and a state containing one current live commitment. It requires the quiet
case to return `no_cognition` and the current-concern case to return either
`cognition` or `defer` with grounding meaning evidence.

The emitted report contains outcome/count evidence only. It does not retain raw
model reasoning, provider prose, user credentials, or hidden runtime state.

## Boundary with following issues

Issue #74 establishes only whether cognition currently deserves attention.

- **#75** owns the durable/inspectable successful-silence lifecycle and its
  distinction from provider failure, timeout, and cancellation.
- **#76** owns activation and lifecycle behavior for dormant concerns beyond the
  first live-commitment control.
- **#78** owns the independent decision to interrupt/deliver to the user.
- **#79/#95** own measured false-positive/cost pressure and any evidence-earned
  attention control.
- **#80/#81** own runtime requirements/topology once observed behavior demonstrates
  them.

No scheduler, daemon, heartbeat frequency, motivational score, generic stimulus bus,
or new durable concern class is introduced here.

## Definition-of-done mapping

| Issue #74 requirement | Implemented evidence |
| --- | --- |
| Decision comes from bounded Ember state | Evaluator request contains `OpportunityProjection` only; mechanism metadata is excluded. |
| Dormant/current concerns can influence decision | Deterministic same-trigger scenario changes from `no_cognition` to `cognition` when a live commitment enters projected state. |
| Lack of worthwhile material terminates cleanly | `no_cognition` is a validated result requiring no selected meaning, provider reply, delivery, or canonical mutation. |
| Decision is inspectable without canonicalising internal reasons | Returned record contains revision, projected IDs, outcome, and selected grounding IDs; there is no free-form reason field. |
| Positive and negative scenarios exist | Deterministic CO-01/CO-02 controls cover quiet and current-concern states with identical mechanism input. |
| Real-model evaluation is opt-in | `live-cognition-opportunity.ts` uses subscription-backed Codex only under explicit `EMBER_RUN_LIVE_ENDOGENOUS=1`; normal tests use injected evaluators. |
