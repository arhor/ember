---
summary: "Issue #79 evaluation methodology and structural baseline for endogenous selectivity, false-positive cognition, interruption pressure, model-call frequency, latency, and local process resource observations."
read_when:
  - "Evaluating issue #79, endogenous false positives, quiet-period behavior, or repeated cognition"
  - "Deciding whether issue #95 needs attention, backoff, budgeting, or suppression controls"
  - "Deriving runtime wake-up and resource requirements for issue #80"
role: design
discovery_status: current
---

# Endogenous Selectivity Evaluation

> Status: current issue #79 evaluation artifact. It evaluates the implemented
> topic-free opportunity, silence, dormant-concern, restart/currentness, and
> interruption boundaries from #73-#78 without choosing scheduler or service topology.

## Question

Does the current bounded endogenous path produce selective attention, or does it
spend model/runtime work on low-value repeated cognition and risk unnecessary user
interruption?

The evaluation keeps four things separate:

1. **semantic selectivity**: worthwhile cognition versus intentional silence versus
   false-positive cognition;
2. **user interruption**: whether completed useful cognition is delivered, deferred,
   suppressed, or kept internal;
3. **opportunity frequency and model calls**: how often the decision evaluator is
   invoked; and
4. **local runtime overhead**: wall latency and Ember-process CPU/RSS observations,
   without pretending to observe external provider child-process resources that the
   harness does not expose.

## Reproducible workload

`test-fixtures/endogenous/selectivity-workload.json` is the canonical workload. It
contains 25 topic-free opportunities across six cases:

| Case | Opportunities | Intended pressure |
| --- | ---: | --- |
| `quiet-stretch` | 12 | Long quiet interval with no durable motive. |
| `irrelevant-live-concern` | 4 | A live commitment exists but lacks the current consequence that would make it worth cognition now. |
| `current-urgent-concern` | 1 | A genuinely current concern with an imminent consequence should deserve cognition and may justify contact. |
| `current-ordinary-quiet-period` | 1 | Useful cognition during a quiet period should remain separate from immediate interruption. |
| `repeated-current-concern` | 4 | The same unchanged worthwhile grounding is presented repeatedly to reveal repeated-thought pressure. |
| `resolved-concern` | 3 | A fulfilled concern must not be revived as current cognition. |

Every opportunity uses the same enumerated `foreground_probe` mechanism. The trigger
contains no topic. Semantic differences come only from Ember-owned current state.

## False-positive rubric

The harness records these categories independently rather than collapsing them into a
single vague error rate:

- `trivial_repetition`: the same unchanged grounding earns cognition again after an
  earlier worthwhile cognition in the same controlled case;
- `stale_concern_revival`: cognition is selected from a case whose concern has already
  become historical/resolved;
- `post_hoc_fabricated_motive`: cognition is selected where the controlled state lacks
  the consequence needed to make the live concern worthwhile now; and
- `unnecessary_user_interruption`: the interruption boundary returns `deliver` in a
  case that should remain quiet, deferred, stale, or repetition-suppressed.

A provider/evaluator failure is not counted as silence or as a semantic false
positive. A worthwhile `defer` decision is also distinct from completed cognition.

## Structural control evaluator

The default command uses a deterministic evaluator that mirrors the current
#76 dormant-concern control: cognition is selected only when both a live current
commitment and the current `release-window = Release is imminent` consequence are
projected.

Run:

```bash
npm run eval:endogenous
```

The exact semantic baseline for the checked-in 25-opportunity workload is:

| Observation | Count |
| --- | ---: |
| evaluator calls | 25 |
| intentional silence | 19 |
| worthwhile cognition | 3 |
| false-positive cognition | 3 |
| missed worthwhile cognition | 0 |
| evaluator failures | 0 |
| trivial repetition | 3 |
| stale concern revival | 0 |
| post-hoc fabricated motive | 0 |
| unnecessary user interruption | 0 |
| interruption `deliver` | 2 |
| interruption `defer` | 1 |
| interruption `suppress` | 3 |
| interruption `no_delivery` | 19 |

The three false positives are deliberate structural probes: after the first useful
cognition, the evaluator receives the same unchanged current grounding again and has
no representation of prior thought in its bounded opportunity projection. The
current #78 interruption boundary prevents those repeated thoughts from becoming
repeated user interruptions by suppressing the already-delivered grounding set.

This distinguishes a real issue: **user-facing spam is currently bounded better than
model-call/repeated-cognition cost**.

## Model invocation frequency

The present model-backed opportunity path performs one evaluator invocation per
opportunity. Therefore, before any future pre-evaluator attention control exists:

```text
external model calls = cognition opportunities
```

`no_cognition` saves downstream cognition and delivery, but it does not save the
model call used to decide `no_cognition` when the evaluator itself is model-backed.
A fixed high-frequency wake-up policy would therefore translate directly into fixed
high-frequency model traffic even during long quiet stretches.

This is a concrete requirement input for #80 and a concrete control pressure for
#95. It is **not** evidence that Ember needs a daemon or any particular scheduler.

## Latency and resource measurement

Every run records:

- per-opportunity evaluator wall latency plus min/median/p95/max/mean summary;
- Node version, platform, and architecture;
- Ember process RSS at start/end and the maximum RSS sample observed after an
  opportunity;
- Ember process user/system CPU consumed during the workload; and
- whether the backend is an external-model backend.

The harness deliberately reports external child-process resources as
`not_observed_by_harness`. It does not infer Codex RSS/CPU from Ember's process
metrics. Those costs belong in later representative runtime measurement (#82/#84)
or a provider-specific measurement that can actually attribute the process tree.

The deterministic evaluation runs in the normal `Continuity vertical slice` CI job
on Node 26.8.1, so each relevant pull request leaves host-specific latency/resource
observations in the workflow log. Those numbers are evidence for that host/run, not a
portable performance constant and therefore are not copied here as timeless values.

## Optional live Codex evaluation

A subscription-backed live run reuses the supported Codex opportunity evaluator:

```bash
npm run eval:endogenous:live
```

The command requires `EMBER_RUN_LIVE_ENDOGENOUS_EVAL=1` through the package script,
records the installed `codex --version` in the backend label, records an optional
`EMBER_CODEX_MODEL_LABEL` when the operator can identify the selected model, and
uses the same workload/rubric as the deterministic control.

Normal tests and CI do not require Codex authentication. This environment cannot
access the user's local subscription-backed CLI, so issue #79 does not claim live
provider-quality numbers from an unexecuted run. When a live run is performed, its
JSON is directly comparable with the structural baseline because workload version,
case IDs, decision categories, runtime metadata, and policy inputs are preserved.

## Findings and handoff

### #95 attention-control pressure

The structural control demonstrates a concrete repeated-cognition failure category:
three unchanged post-first opportunities still produce cognition. #95 therefore has
evidence to evaluate the smallest repeated-concern suppression/backoff mechanism.
The control should target repeat pressure without making the first worthwhile
cognition disappear and without conflating interruption suppression with cognition
suppression.

No evidence here justifies a broad motivational score, generic scheduler budget, or
new durable motive class.

### #80 runtime requirements

The evaluation establishes these implementation-neutral runtime pressures:

- model-backed opportunity cost scales one-for-one with opportunity frequency until a
  pre-evaluator control exists;
- quiet periods must be able to contain many successful no-cognition outcomes without
  generating user interruption;
- runtime metrics must distinguish Ember-process overhead from external provider
  child-process cost; and
- scheduling frequency should remain a policy/topology decision derived from measured
  value/cost rather than being embedded in the cognition trigger.

It does **not** establish that a permanently resident service, fixed timer, or cron
schedule is required.

## Definition-of-done mapping

| Issue #79 requirement | Evidence |
| --- | --- |
| Distinguish worthwhile cognition, silence, and false positives | Typed observation classifications and exact deterministic workload counts. |
| Include repetition, stale revival, fabricated motive, unnecessary interruption | Four independent false-positive categories in the harness and fixture cases that can exercise each. |
| Record model calls, latency, and local resources cautiously | Per-run evaluator/external-model call counts, latency summary, Node/platform metadata, Ember RSS/CPU, and explicit non-observation of child-process resources. |
| Demonstrate long quiet stretches | Twelve consecutive topic-free quiet opportunities deterministically produce `no_cognition` and `no_delivery`. |
| Identify runtime pressure | One model-backed evaluator call per opportunity and separate provider-process attribution are handed to #80. |
| Reproducible corpus/methodology | Versioned JSON workload, deterministic tests, CLI runner, live Codex mode, and CI execution are all repository artifacts. |
