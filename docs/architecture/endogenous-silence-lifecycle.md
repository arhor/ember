---
summary: "Current issue #75 lifecycle for durable, inspectable intentional no-cognition outcomes that remain distinct from evaluator failure, cancellation, timeout, deferral, and user interruption."
read_when:
  - "Implementing or reviewing durable endogenous cognition-opportunity outcomes"
  - "Distinguishing intentional silence from evaluator failure, cancellation, timeout, or outcome uncertainty"
  - "Evaluating repeated quiet opportunities or restart behavior without fabricated motives"
role: design
discovery_status: current
---

# First-Class Endogenous Silence Lifecycle

> Status: current implementation/evaluation design for issue #75, layered on the
> [endogenous cognition decision boundary](endogenous-cognition-decision.md).

## Purpose

Issue #74 established a topic-free decision contract whose successful outcomes are
`cognition`, `defer`, and `no_cognition`. Issue #75 makes those outcomes durable and
inspectable so that silence is not inferred from missing output.

The governing distinction is:

> **Intentional silence is positively established operational history. Absence of a
> cognition episode, provider reply, or user interruption is not enough to prove it.**

This matters because the same absence could otherwise mean a correct `no_cognition`
decision, a timeout, cancellation, malformed evaluator output, process loss, or work
that is still in progress.

## Durable occurrence model

New v1 state records may contain `operations.cognition_opportunities`. Older v1
states that predate issue #75 remain valid without the field; inspection treats the
missing legacy ledger as empty. New `initialState()` documents create it explicitly.

Each occurrence records only bounded operational evidence:

- Ember-owned opportunity identity;
- owning runtime, principal, scope, and coarse topic-free mechanism;
- observation and last durable observation times;
- the state revision from which the bounded projection was built;
- projected meaning/evidence IDs;
- lifecycle status;
- a validated decision only when one was actually established;
- selected grounding meaning IDs for `cognition` or `defer`;
- `interruption_status: not_attempted`; and
- bounded provider-termination evidence when one exists.

There is deliberately no free-form reason, model-written motivation, prompt text,
reply text, chain-of-thought, new commitment, or remembered autobiographical meaning
in this occurrence.

## Lifecycle

`runCognitionOpportunity` uses a two-commit boundary around evaluator execution:

```text
bounded projection prepared
          |
          v
   durable evaluating
          |
          v
      evaluator call
      /           \
     v             v
 durable         durable operational
 decided         terminal status
```

Successful `decided` occurrences carry exactly one of:

- `cognition`: at least one projected meaning grounds spending cognition now;
- `defer`: at least one projected meaning remains relevant, but cognition should not
  proceed now; or
- `no_cognition`: no projected meaning is selected and no cognition episode or user
  interruption is implied.

Operational terminal states are separate:

- `failed`;
- `timed_out`;
- `cancellation_requested`; and
- `outcome_unknown`.

A provider timeout therefore cannot be counted as silence. A malformed evaluator
result is recorded as `failed`, not silently converted into `no_cognition`.

## Restart semantics

A durable `decided / no_cognition` occurrence survives restart unchanged. It is
historical evidence that Ember evaluated a topic-free opportunity and successfully
chose not to spend further cognition at that time.

An occurrence still marked `evaluating` at a runtime discontinuity cannot be
upgraded to silence. Recovery changes it to `outcome_unknown`. A clean runtime stop
also closes any still-evaluating occurrence as `outcome_unknown` before the stop is
recorded.

This preserves the same rule used elsewhere in Ember: operational uncertainty must
not be rewritten into a convenient semantic outcome.

## Inspection and metrics

`inspectionView()` exposes `cognition_opportunities` alongside runtime and cognition
episodes. `cognitionOpportunityMetrics()` counts:

- total and currently evaluating occurrences;
- decided `cognition`, `defer`, and `no_cognition` outcomes independently; and
- failed, timed-out, cancellation-requested, and outcome-unknown occurrences.

This lets evaluation measure useful silence without rewarding crashes or provider
failures as false negatives.

## Repeated quiet opportunities

The deterministic issue-75 scenario runs multiple byte-equivalent topic-free
opportunities against quiet state. Every opportunity may independently establish
`no_cognition` while all of these remain unchanged:

- canonical meanings;
- evidence;
- commitments;
- ordinary cognition episodes; and
- user-facing delivery/interruption state.

Repeated silence therefore accumulates only operational occurrence history. It does
not manufacture a motive merely because Ember was given another chance to think.

## Boundaries retained for later issues

Issue #75 does not decide when a dormant concern should reactivate, how salience is
ranked, when user interruption is worthwhile, how often wake-ups occur, or whether a
daemon is required.

- #76 owns richer dormant-concern activation/lifecycle behavior.
- #78 owns user interruption/delivery decisions.
- #79/#95 own measured false-positive and attention-cost pressure.
- #80/#81 own runtime/topology choices if later evidence earns them.

The current ledger is therefore deliberately an operational lifecycle record, not a
scheduler, motivational store, or second memory system.

## Definition-of-done mapping

| Issue #75 requirement | Implemented evidence |
| --- | --- |
| Explicit successful no-cognition/no-interruption outcome | Durable `decided / no_cognition` occurrence with empty selected meanings and `interruption_status: not_attempted`. |
| Distinguish silence from failure/cancellation | Separate `failed`, `timed_out`, `cancellation_requested`, and `outcome_unknown` statuses. |
| No fabricated motives or memory | Occurrences contain IDs/status only; repeated-silence tests leave meanings, evidence, commitments, and cognition episodes unchanged. |
| Repeated quiet scenarios | Deterministic tests persist three independent successful silent opportunities. |
| Metrics count silence separately | `cognitionOpportunityMetrics()` reports `no_cognition` independently from all failure classes. |
| Restart/inspection defined without raw reasoning | `inspectionView()` exposes durable occurrences; decided silence survives, unfinished evaluation becomes `outcome_unknown`. |
