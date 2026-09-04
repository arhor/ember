---
summary: "Issue #95 evidence-earned repeated-projection attention control that defers duplicate endogenous cognition before evaluator invocation without inventing scheduler cadence."
read_when:
  - "Changing issue #95 endogenous attention, repeated cognition, or evaluator-cost controls"
  - "Deciding when an unchanged endogenous concern may be reconsidered"
  - "Deriving issue #80 runtime requirements from repeated-projection suppression"
role: design
discovery_status: current
---

# Endogenous Attention Control

> Status: current issue #95 design. This control is intentionally narrower than a
> generic rate limit, budget, scheduler, cooldown, or motivational score.

## Evidence that earns the control

Issue #79 reproduced one concrete failure in the current endogenous path:

- the first cognition over a current concern was worthwhile;
- three subsequent opportunities saw the same unchanged projected grounding;
- all three invoked the evaluator again and selected cognition again; and
- the later #78 interruption boundary prevented those repeated thoughts from becoming
  repeated user-facing interruptions.

The observed problem is therefore **repeated cognition and evaluator cost over an
unchanged grounding snapshot**, not a general lack of silence, stale-currentness
failure, or interruption-policy failure.

No #79 evidence justifies a universal motivational score, a fixed timer, a global
opportunity budget, or a daemon cadence. Issue #95 implements only the smallest
control needed for the reproduced repetition.

## Decision

Before the durable `runCognitionOpportunity` path invokes its evaluator, Ember checks
recent durable cognition-opportunity history for the same:

- runtime;
- principal;
- active scope; and
- opportunity mechanism.

If a prior successful `decision: cognition` occurred on **exactly the same projected
meaning-ID and evidence-ID sets**, and no different projection for that context has
appeared since, the new opportunity is recorded as:

```text
status: decided
decision: defer
selected_meaning_ids: <the prior cognition grounding>
interruption_status: not_attempted
```

The evaluator is not invoked.

`defer` is deliberate. The control is not claiming that no concern exists or that
cognition would be worthless forever. It says that the already-grounded concern does
not justify repeating the same discretionary cognition on this unchanged snapshot.

The control creates no new motive or topic. Its grounding is copied only from a prior
successful cognition whose selected meanings were already validated inside the same
bounded projection.

## Reopening cognition

Suppression is deliberately conservative.

A new evaluator attempt is allowed when:

- the projected meaning set changes;
- the projected evidence set changes;
- the opportunity mechanism changes; or
- a new runtime begins.

A different projection ends the current repetition epoch. If a later projection
happens to return to an older shape, Ember evaluates it again rather than reaching
arbitrarily far into history and suppressing it forever.

This protects the useful first cognition and allows changed current state to earn new
attention without requiring a synthetic score or timeout.

## What is not suppressed

Repeated `no_cognition` results are not suppressed by this control. The #79 quiet
stretch therefore still evaluates each topic-free opportunity and may return
intentional silence repeatedly.

That is intentional. #79 demonstrated a concrete repeated-_cognition_ failure but did
not establish an evidence-backed cadence, quiet-state cache duration, or opportunity
rate limit. Suppressing quiet opportunities would be a different policy decision and
would require its own evidence.

Provider failures, cancellation, timeout, and outcome-unknown states also do not
become evidence that a concern was already adequately thought through.

## Interruption remains separate

The control runs before internal cognition. A control-produced `defer` therefore does
not create a `CompletedInternalCognition` handoff and does not enter the #78
interruption decision at all.

This keeps the lifecycle distinct:

```text
topic-free opportunity
        ↓
repeated-projection attention control
        ├─ defer unchanged repeated cognition
        └─ evaluate
              ↓
        cognition / defer / no_cognition
              ↓
        completed internal cognition, when one actually occurs
              ↓
        separate interruption decision
```

Deferring cognition does not grant authority, create a commitment, or imply later
user delivery.

## Evaluation result

The same versioned 25-opportunity #79 workload is retained in two modes:

- `npm run eval:endogenous:baseline` disables the #95 control and reproduces the
  pre-control evidence; and
- `npm run eval:endogenous` enables the current repeated-projection control.

The deterministic structural control changes the reproduced repetition case from:

```text
cognition, cognition, cognition, cognition
```

to:

```text
cognition, defer, defer, defer
```

while preserving the first useful cognition, the long quiet stretch, the ordinary
quiet-period cognition, and the stale/fabricated-motive adversarial rubric.

The expected aggregate change is:

| Observation                             | #79 baseline | #95 control |
| --------------------------------------- | -----------: | ----------: |
| opportunities                           |           25 |          25 |
| evaluator calls                         |           25 |          22 |
| worthwhile cognition                    |            3 |           3 |
| repeated-projection attention deferrals |            0 |           3 |
| false-positive cognition                |            3 |           0 |
| missed worthwhile cognition             |            0 |           0 |
| trivial repetition                      |            3 |           0 |

The three saved evaluator calls are structural evidence for this workload. They do not
establish a universal percentage reduction for a future runtime.

## Known boundary handed to #80

Time itself can change the consequence of a live concern. A deadline may approach
while the durable meaning/evidence IDs remain unchanged. The current projection also
contains `current_time`, but #95 intentionally does **not** turn elapsed wall time into
an arbitrary cooldown such as "reconsider every N minutes."

Consequently, a very long-lived runtime with an unchanged meaning/evidence projection
can continue deferring the same concern until the projection changes or the runtime
changes.

Issue #80 must decide whether the eventual runtime topology needs an explicit,
evidence-backed **reconsideration epoch** or another way for time-sensitive current
state to produce a materially changed projection. That requirement belongs with
runtime opportunity semantics and scheduling evidence, not inside this issue as an
invented timer.

## Non-goals

Issue #95 does not introduce:

- a daemon, heartbeat, cron schedule, or service topology;
- a fixed cooldown duration;
- a global token/model-call budget;
- a motivational priority score;
- suppression of all repeated silence;
- a new durable motive type;
- interruption or delivery retry policy; or
- authority to perform external action.
