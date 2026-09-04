---
summary: "Issues #79/#95 evaluation methodology and evidence for endogenous selectivity, false-positive cognition, repeated-projection attention control, evaluator frequency, latency, and local process resources."
read_when:
  - "Evaluating endogenous false positives, quiet-period behavior, repeated cognition, or issue #95 attention controls"
  - "Comparing the pre-control #79 baseline with current endogenous selectivity"
  - "Deriving runtime wake-up, reconsideration, and resource requirements for issue #80"
role: design
discovery_status: current
---

# Endogenous Selectivity Evaluation

> Status: current evaluation artifact for issues #79 and #95. It evaluates the
> topic-free opportunity, silence, dormant-concern, currentness, interruption, and
> evidence-earned repeated-projection attention boundaries without choosing scheduler
> or service topology.

## Question

Does the bounded endogenous path produce selective attention, or does it spend
model/runtime work on low-value repeated cognition and risk unnecessary user
interruption? After issue #79 demonstrated a concrete repetition failure, does the
smallest issue #95 control remove that failure without suppressing useful cognition?

The evaluation keeps five things separate:

1. **semantic selectivity**: worthwhile cognition versus intentional silence versus
   false-positive cognition;
2. **attention deferral**: a pre-evaluator decision that an already-considered,
   unchanged projection does not justify repeating cognition now;
3. **user interruption**: whether completed useful cognition is delivered, deferred,
   suppressed, or kept internal;
4. **opportunity frequency and evaluator attempts**: how often an opportunity exists
   versus how often an evaluator is actually invoked; and
5. **local runtime overhead**: wall latency and Ember-process CPU/RSS observations,
   without pretending to observe external provider child-process resources.

## Reproducible workload

`test-fixtures/endogenous/selectivity-workload.json` is the canonical workload. It
contains 25 topic-free opportunities across six cases:

| Case                            | Opportunities | Intended pressure                                                                                          |
| ------------------------------- | ------------: | ---------------------------------------------------------------------------------------------------------- |
| `quiet-stretch`                 |            12 | Long quiet interval with no durable motive.                                                                |
| `irrelevant-live-concern`       |             4 | A live commitment exists but lacks the current consequence that would make it worth cognition now.         |
| `current-urgent-concern`        |             1 | A genuinely current concern with an imminent consequence should deserve cognition and may justify contact. |
| `current-ordinary-quiet-period` |             1 | Useful cognition during a quiet period should remain separate from immediate interruption.                 |
| `repeated-current-concern`      |             4 | The same unchanged worthwhile grounding is presented repeatedly to reveal repeated-thought pressure.       |
| `resolved-concern`              |             3 | A fulfilled concern must not be revived as current cognition.                                              |

Every opportunity uses the same enumerated `foreground_probe` mechanism. The trigger
contains no topic. Semantic differences come only from Ember-owned current state.

## False-positive rubric

The harness records these categories independently rather than collapsing them into a
single vague error rate:

- `trivial_repetition`: the same unchanged grounding earns cognition again after an
  earlier worthwhile cognition in the same controlled case;
- `stale_concern_revival`: cognition is selected in the resolved-concern control,
  reviving the concern from remaining current context after the commitment itself is
  historical;
- `post_hoc_fabricated_motive`: cognition is selected where a live concern exists but
  the controlled state lacks the consequence needed to make it worthwhile now; and
- `unnecessary_user_interruption`: the interruption boundary returns `deliver` in a
  case that should remain quiet, deferred, stale, or repetition-suppressed.

Deterministic adversarial controls exercise stale revival, fabricated motive, and the
first unnecessary interruption those false positives could cause. A provider/evaluator
failure is not counted as silence or as a semantic false positive. A grounded
attention `defer` is also distinct from completed cognition.

## Structural evaluator

The deterministic evaluator mirrors the current dormant-concern control: cognition is
selected only when both a live current commitment and the current
`release-window = Release is imminent` consequence are projected.

Two commands deliberately use the same workload and evaluator:

```bash
# Historical issue #79 behavior, with the issue #95 attention control disabled.
npm run eval:endogenous:baseline

# Current behavior, with the issue #95 repeated-projection control enabled.
npm run eval:endogenous
```

This preserves a reproducible before/after comparison rather than rewriting the old
failure out of the corpus.

## Issue #79 baseline

With attention control disabled, the exact structural baseline is:

| Observation                   | Count |
| ----------------------------- | ----: |
| opportunities                 |    25 |
| evaluator calls               |    25 |
| intentional silence           |    19 |
| worthwhile cognition          |     3 |
| attention deferrals           |     0 |
| false-positive cognition      |     3 |
| missed worthwhile cognition   |     0 |
| evaluator failures            |     0 |
| trivial repetition            |     3 |
| stale concern revival         |     0 |
| post-hoc fabricated motive    |     0 |
| unnecessary user interruption |     0 |
| interruption `deliver`        |     2 |
| interruption `defer`          |     1 |
| interruption `suppress`       |     3 |
| interruption `no_delivery`    |    19 |

The three false positives are the reproduced issue #79 failure. After the first useful
cognition, the evaluator receives the same unchanged current grounding three more
times and selects cognition three more times. The #78 interruption boundary prevents
those repeated thoughts from becoming repeated user interruptions, but it does not
save the evaluator work or repeated internal cognition.

## Issue #95 controlled result

Issue #95 adds only the evidence-earned repeated-projection boundary documented in
`endogenous-attention-control.md`. The current deterministic result is expected to be:

| Observation                   | #79 baseline | #95 control |
| ----------------------------- | -----------: | ----------: |
| opportunities                 |           25 |          25 |
| evaluator calls               |           25 |          22 |
| intentional silence           |           19 |          19 |
| worthwhile cognition          |            3 |           3 |
| grounded attention deferrals  |            0 |           3 |
| false-positive cognition      |            3 |           0 |
| missed worthwhile cognition   |            0 |           0 |
| evaluator failures            |            0 |           0 |
| trivial repetition            |            3 |           0 |
| stale concern revival         |            0 |           0 |
| post-hoc fabricated motive    |            0 |           0 |
| unnecessary user interruption |            0 |           0 |
| interruption `deliver`        |            2 |           2 |
| interruption `defer`          |            1 |           1 |
| interruption `suppress`       |            3 |           0 |
| interruption `no_delivery`    |           19 |          22 |

The repeated case changes from:

```text
cognition, cognition, cognition, cognition
```

to:

```text
cognition, defer, defer, defer
```

The three deferrals occur **before evaluator invocation** and preserve the selected
meaning grounding from the prior successful cognition. They are therefore not
reported as `no_cognition` and they do not fabricate new reasons.

The reduction from 25 to 22 evaluator calls is specific to this corpus. It is evidence
that the control eliminates the reproduced redundant attempts, not a universal 12%
resource-saving claim.

## Omission and suppression-harm checks

A reduction in false positives is insufficient if it merely creates false negatives.
The current regression corpus therefore requires all of the following:

- the first useful cognition in an unchanged concern still occurs;
- all three later unchanged repetitions become grounded `defer` outcomes;
- a changed projected meaning/evidence snapshot reopens evaluator access;
- a new runtime reopens evaluator access;
- twelve quiet opportunities still successfully choose `no_cognition` rather than
  being relabelled as attention deferrals;
- ordinary useful cognition during a quiet period still occurs internally and is
  separately deferred at the interruption boundary; and
- the adversarial fabricated-motive and stale-revival controls remain executable with
  the #95 control disabled so the rubric itself cannot be hidden by the new policy.

This is deliberately more conservative than a generic cache or cooldown.

## Evaluator-attempt frequency

Before issue #95, a model-backed opportunity path structurally attempted one external
evaluator invocation for every opportunity:

```text
external-model evaluator attempts = cognition opportunities
```

With the repeated-projection control, the upper bound remains one evaluator attempt
per opportunity, but exact unchanged repetitions after successful cognition may now
be resolved locally as grounded deferrals:

```text
external-model evaluator attempts <= cognition opportunities
```

This is deliberately phrased as an **attempt**, not proof that a provider process
successfully reached or billed a model. The harness cannot observe that boundary in
all failure modes.

The quiet stretch still invokes its evaluator twelve times. Issue #79 did not provide
evidence for a quiet-state cache duration or global opportunity rate limit, so issue
#95 does not invent one.

## Latency and resource measurement

Every run records:

- evaluator latency only for opportunities where the evaluator was actually invoked,
  including a sample count;
- Node version, platform, and architecture;
- backend runtime version when an external runtime reports one;
- optional model label when the operator can establish it without guessing;
- Ember process RSS at start/end and the maximum RSS sample observed; and
- Ember process user/system CPU consumed during the workload.

The harness deliberately reports external child-process resources as
`not_observed_by_harness`. It does not infer Codex RSS/CPU from Ember's process
metrics. Those costs belong in later representative runtime measurement (#82/#84)
or a provider-specific measurement that can actually attribute the process tree.

### Historical #79 CI structural snapshot

A deterministic run on GitHub Actions `ubuntu-latest` during PR #127, workflow run
`33788919425`, recorded this **single-host, single-run** pre-control snapshot:

| Field                                             |                              Observation |
| ------------------------------------------------- | ---------------------------------------: |
| Node / platform                                   |                     `v26.8.1`, Linux x64 |
| Backend                                           |            `scripted-structural-control` |
| Opportunities / evaluator calls                   |                                  25 / 25 |
| Evaluator latency min / median / p95 / max / mean | 0.148 / 0.282 / 1.069 / 1.223 / 0.407 ms |
| RSS start                                         |              98,496,512 bytes (93.9 MiB) |
| RSS end / observed peak                           |             104,542,208 bytes (99.7 MiB) |
| User CPU across workload                          |                                37.574 ms |
| System CPU across workload                        |                                 1.594 ms |
| External child-process resources                  |                             not observed |

These values describe the scripted orchestration workload on that runner. They are
not Codex latency, not steady-state service cost, and not a portable performance
constant. Post-#95 runs should compare structured results rather than treating this
snapshot as a threshold.

## Optional live Codex evaluation

A subscription-backed live run reuses the supported Codex opportunity evaluator and
the current attention control:

```bash
npm run eval:endogenous:live
```

The command requires `EMBER_RUN_LIVE_ENDOGENOUS_EVAL=1`, records `codex --version` as
`runtime_version`, records `EMBER_CODEX_MODEL_LABEL` only when the operator can
identify the selected model, and uses the same workload/rubric.

Normal tests and CI do not require Codex authentication. A later live result is
directly comparable because workload version, case IDs, decision categories, runtime
metadata, attention policy, and evaluator-attempt counts are preserved.

## Runtime handoff to #80

Issue #95 intentionally avoids a time-based cooldown. Research says time can change
the consequence of a live concern, but the current repeated-projection key is based on
the bounded projected meaning/evidence snapshot, not elapsed wall time.

A very long-lived runtime can therefore keep deferring an unchanged snapshot even as
`current_time` advances. A restart reopens evaluation, but restart cadence must not
become an accidental attention policy.

Issue #80 must decide whether the eventual runtime needs an explicit evidence-backed
reconsideration epoch, a time-sensitive projection change, or another topology-neutral
way to let elapsed time materially reopen a live concern. No fixed interval is earned
by issues #79/#95.

## Definition-of-done mapping

| Requirement                                      | Evidence                                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Control maps to a named #79 finding              | It targets only `trivial_repetition` over an unchanged projection after prior cognition.                                                            |
| Grounded, topic-free control                     | Matching uses current bounded projection IDs plus durable prior opportunity history; it creates no topic or motive.                                 |
| Silence, cognition, interruption remain distinct | Quiet opportunities remain `no_cognition`; repeated useful grounding becomes `defer`; interruption runs only after actual completed cognition.      |
| Reduced false positives without omission harm    | Before/after workload plus projection-change/new-runtime regressions require 3 -> 0 repetition false positives with no missed worthwhile cognition. |
| Resource bounds below semantic baseline          | The policy skips only redundant evaluator attempts and does not choose scheduler frequency or a global budget.                                      |
| Runtime/topology requirement handed to #80       | Time-only reconsideration in a long-lived runtime is recorded explicitly rather than hidden in an arbitrary cooldown.                               |
| Reproducible from repository artifacts           | Versioned workload, baseline/current CLI modes, deterministic tests, and current design documents are checked in.                                   |
