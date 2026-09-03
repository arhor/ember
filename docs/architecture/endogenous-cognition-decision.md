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
> [bounded cognition-opportunity boundary](cognition-opportunity.md). Durable
> lifecycle semantics added by issue #75 are defined in
> [First-Class Endogenous Silence Lifecycle](endogenous-silence-lifecycle.md).

## Purpose

Issue #73 established that a wake-up may explain why cognition is possible now but
must not supply the topic or motive. Issue #74 makes the next boundary executable:
given a topic-free opportunity and a bounded projection of current Ember-owned
state, decide whether anything deserves discretionary cognition now.

The pure `evaluateCognitionOpportunity` seam remains useful for deterministic and
adapter-level evaluation. Issue #75 layers `runCognitionOpportunity` around that
same contract to make the attempt and its terminal outcome durable without turning
model-written reasons into canonical memory.

## Implemented seam

`src/agency/cognition-opportunity.ts` exposes a narrow evaluator contract:

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
That mechanism is operational provenance and is **not passed to the evaluator**.
There is no free-form trigger payload, reminder text, concern identifier, search
query, or task description in the evaluator request.

This is stronger than asking a model to ignore scheduler text: the decision contract
does not expose such text at all.

## Projection reuse without fabricated user input

The implementation reuses `buildProjection` selection rather than creating a
parallel context selector. The internal compatibility call supplies an empty
`currentInput` because the current v1 selector requires the field but does not use it
to choose a topic. `buildCognitionOpportunityProjection` then returns an
`endogenous_decision` projection that omits `current_input` entirely.

The evaluator receives:

- explicit principal and active scope;
- current relationship/fact/preference/commitment selection;
- provenance-bearing projected meanings/evidence;
- recovery/currentness qualification;
- no raw transcript;
- no user-input evidence created for the opportunity; and
- no synthetic user message.

If ordinary projection selection later begins using `current_input` materially, the
endogenous path must be revisited rather than letting an empty string become hidden
selection semantics.

Issue #72's longitudinal result remains negative evidence against adding a richer
retrieval/indexing subsystem here without observed need.

## Evaluator result contract

An evaluator returns exactly:

```json
{
  "contract_version": 1,
  "decision": "cognition | defer | no_cognition",
  "selected_meaning_ids": []
}
```

The boundary validates that every selected meaning was projected, selected IDs are
unique, `cognition`/`defer` identify at least one projected grounding meaning, and
`no_cognition` selects none.

There is deliberately no free-form `reason` field. Observable evidence is the
opportunity identity, projection revision/membership, decision, and selected
grounding IDs. Hidden reasoning or model-written motivational prose is not promoted
into Ember meaning.

## Pure and durable forms

`evaluateCognitionOpportunity` returns a bounded non-mutating record. It is useful
for deterministic controls and live-provider probes where persistence is not the
question under test.

`runCognitionOpportunity`, added by issue #75, uses the same evaluator request but
persists the attempt before evaluator execution and then persists either a validated
`decided` outcome or an operational terminal status. See
[endogenous-silence-lifecycle.md](endogenous-silence-lifecycle.md) for the lifecycle,
restart behavior, inspection, and metrics.

Neither form creates `user_command` evidence or an ordinary cognition episode merely
because a wake-up occurred. A `no_cognition` result also implies no user interruption
at this boundary; issue #78 owns later delivery/interruption decisions.

## Deterministic scenario controls

`src/agency/cognition-opportunity.test.ts` exercises the issue-73 CO-01/CO-02
counterfactual directly. Quiet state and live-concern state receive the same
`foreground_probe`; only Ember-owned projected state differs.

The tests also verify that evaluator mutation cannot enlarge the validated projection
envelope, topic-shaped mechanism values are rejected at runtime, no synthetic
current input leaks into the evaluator request, and selection outside projection is
rejected.

Issue #75 adds repeated durable-silence, timeout, restart, legacy-state, and forged
silence scenarios without changing this evaluator contract.

## Codex-backed live evaluator

`src/agency/codex-opportunity-evaluator.ts` provides an opt-in real-model evaluator
using the existing isolated Codex provider boundary.

For compatibility with the one-shot provider contract it uses one fixed evaluator
instruction as `input.text` and `Projection.current_input` *inside the adapter*.
That text is invariant across opportunities and only asks the provider to choose
`cognition`, `defer`, or `no_cognition` from projected state. It contains no scheduler
topic, concern name, or scenario-specific answer.

The actual opportunity mechanism remains absent from the provider request. Existing
`used_meaning_ids` becomes the evaluator's selected grounding IDs, and the core
opportunity boundary applies its stricter outcome validation.

### Reproduction

The optional subscription-backed probe remains:

```bash
EMBER_RUN_LIVE_ENDOGENOUS=1 node scripts/live-cognition-opportunity.ts
```

Normal tests do not require subscription access. The live probe is empirical model
validation, not a prerequisite for the deterministic issue #74/#75 semantics.

## Boundaries retained for later issues

- **#76** owns richer dormant-concern activation/lifecycle behavior.
- **#78** owns user interruption/delivery decisions.
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
| Dormant/current concerns can influence decision | Same-trigger deterministic scenario changes from `no_cognition` to `cognition` when a live commitment enters projected state. |
| Lack of worthwhile material terminates cleanly | `no_cognition` is a validated explicit outcome requiring no selected meaning. |
| Decision is inspectable without canonicalising internal reasons | Records use revision/projected IDs/outcome/selected IDs and have no free-form reason field. |
| Positive and negative scenarios exist | Deterministic CO-01/CO-02 controls cover quiet and current-concern states with identical mechanism input. |
| Real-model evaluation is opt-in | `live-cognition-opportunity.ts` is gated by `EMBER_RUN_LIVE_ENDOGENOUS=1`; normal tests use injected evaluators. |
