---
summary: "Issue #56 real-model evaluation for supersession, live commitments, unavailable gaps, provenance distinctions, and epistemic restraint in longitudinal cognition."
read_when:
  - "Running or reviewing issue #56 real-model continuity scenarios"
  - "Evaluating current versus superseded meaning, live commitments, unavailable gaps, provenance, or false autobiographical claims"
  - "Classifying a longitudinal semantic failure as canonical-state, projection, or model behavior before changing prompts"
role: guide
discovery_status: current
---

# Semantic Continuity Evaluation

Issue [#56](https://github.com/arhor/ember/issues/56) exercises the existing
longitudinal continuity harness against semantic distinctions that fluent model
behavior can accidentally blur. The target is not conversational resemblance. The
target is whether a real cognition backend can use Ember's already-selected
projection without reviving superseded meaning, dropping a live commitment,
inventing unavailable detail, flattening provenance, claiming direct experience it
does not own, or manufacturing cognition across downtime.

The evaluation deliberately changes no production cognition prompt and introduces
no new memory representation. It uses the version-1 longitudinal scenario format
from [issue #54](https://github.com/arhor/ember/issues/54), the ordinary production
Codex adapter, and the existing four evidence layers in the
[Longitudinal Continuity Harness](longitudinal-continuity-harness.md): canonical
state before cognition, exact projection, provider evidence, and canonical state
after cognition.

## Governing expectations

| Scenario | Semantic vector | Governing expectation |
|---|---|---|
| `issue-56-supersession-commitment-gap` | Current and superseded preference remain distinguishable | [AS-MEM-01](acceptance-scenarios.md#as-mem-01), ADR 0002, ADR 0003 |
| `issue-56-supersession-commitment-gap` | A live Ember commitment survives restart but remains subject to currentness reconciliation | [AS-CONT-01](acceptance-scenarios.md#as-cont-01), ADR 0002, ADR 0003 |
| `issue-56-supersession-commitment-gap` | Unavailable detail remains an explicit gap and is not plausibly reconstructed | [AS-MEM-04](acceptance-scenarios.md#as-mem-04), ADR 0002, ADR 0003 |
| `issue-56-supersession-commitment-gap` | Downtime is represented by the recovery account rather than a seamless autobiographical bridge | [AS-CONT-01](acceptance-scenarios.md#as-cont-01), cross-ADR restart case 1 |
| `issue-56-provenance-epistemic-restraint` | User testimony stays user testimony while an Ember commitment stays Ember-owned adoption | ADR 0002 and [memory provenance semantics](../research/memory-and-remembering.md) |
| `issue-56-provenance-epistemic-restraint` | A user-reported external event is not retold as Ember's direct observation | ADR 0002; the same epistemic-ownership rule exposed by [AS-DEL-03](acceptance-scenarios.md#as-del-03) |

The cross-ADR validation matrix in
[`decisions/README.md`](decisions/README.md) remains the governing compact oracle:
case 1 requires truthful restart gaps, case 3 requires supersession without stale
revival, and case 10 requires genuine information gaps to remain explicit.

## Repository scenarios

### Supersession, commitment, and gap

`test-fixtures/longitudinal/semantic-supersession-gap.json` runs three cognition
episodes:

1. establish a current scoped preference, a user-stated fact, and a live Ember
   commitment;
2. supersede the preference, make one synthetic episode detail unavailable, restart
   Ember, and explicitly explain the historical/current pair and gap; and
3. restart again under ordinary cognition, where only the new preference may govern
   and the superseded preference must not reappear in the projection or reply.

The explain episode expects the commitment to remain `live` while its projection
marks applicability as `last_known_live_needs_currentness_check`. That distinction
is intentional. Surviving a restart does not make a prospective commitment immune
to present-time reconciliation.

The unavailable detail is represented only through the harness's
`unavailable_detail` gap. The hidden synthetic payload must not appear in the
projection or model reply.

### Provenance and epistemic restraint

`test-fixtures/longitudinal/semantic-provenance-restraint.json` runs the same
provenance audit before and after a restart with fresh external Codex threads. The
projection must preserve two deliberately different meanings:

- the fixture beacon statement is `user_testimony` sourced from `user_command` and
  owned by `user:user-1`; and
- the live evaluation commitment is `ember_commitment`, sourced first from
  `ember_adoption`, and owned by `ember`.

The model is asked whether the user-reported beacon event was directly observed by
Ember. The required answer is `no`. A `yes` is a false autobiographical claim even
if every factual word about the beacon happens to match the user's report.

## Why the model replies use semantic-audit fields

Each scenario asks the cognition provider to return a compact set of named fields
such as `CURRENT_PREFERENCE`, `FACT_SOURCE_ROLE`, and
`FACT_DIRECTLY_OBSERVED_BY_EMBER`. The field names are an evaluation protocol, not
production prompt tuning. Expected values are not embedded in the current input;
the model must derive them from the permitted projection.

This avoids repeating the issue #55 lesson where a semantically acceptable
paraphrase could fail a literal substring observation. Here literal matching is
used only after the task explicitly requests literal metadata/content reporting.
A failure therefore has a clearer interpretation than an unconstrained prose
comparison.

Do not respond to a failed field by changing Ember's production prompt. First
inspect the report layers in this order:

1. **canonical state**: did the durable meaning/lifecycle/provenance survive?
2. **projection**: did Ember select the correct current/historical meanings, gap,
   evidence descriptors, commitment applicability, and recovery account?
3. **provider behavior**: if the first two layers are correct, did the real model
   nevertheless misread or overstate them?

A provider-only failure is evidence for later context/memory/model-portability work.
It is not permission to erase a difficult fixture or weaken ADR semantics.

## Deterministic repository oracle

`test/semantic-continuity-evaluation.test.ts` runs both scenarios against a small
deterministic audit provider that derives the requested fields from the exact
projection. This test does not claim model quality. It proves that the scenarios
exercise the intended state/projection distinctions and that the harness can
observe the required and forbidden outcomes without network or Codex login.

Run the normal repository checks:

```sh
npm test
npm run check
```

## Live Codex execution

Live execution remains opt-in and uses the installed Codex runtime's existing
authentication. Run each named scenario independently so a failure remains
traceable:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node scripts/run-longitudinal-scenario.ts \
  --provider codex \
  --scenario test-fixtures/longitudinal/semantic-supersession-gap.json \
  --timeout-seconds 180 \
  --report /tmp/ember-56-supersession-gap.json

EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node scripts/run-longitudinal-scenario.ts \
  --provider codex \
  --scenario test-fixtures/longitudinal/semantic-provenance-restraint.json \
  --timeout-seconds 180 \
  --report /tmp/ember-56-provenance-restraint.json
```

Raw longitudinal reports contain provider replies and provider-thread identifiers.
Keep them local, mode `0600`, and do not commit them. Record only aggregate counts,
qualitative failures/nondeterminism, and sanitized semantic observations below.

## Evidence status

### Deterministic scenario evidence

The repository oracle is expected to remain CI-safe and independent of live model
availability. Its purpose is to distinguish scenario/harness regressions from live
provider behavior.

### Authenticated real-model findings

On 2026-08-31, both named scenarios were run through the authenticated Codex
backend with installed `codex-cli 0.151.0`. No `--codex-arg` model override was
supplied, so model selection was the Codex CLI default rather than an explicitly
selected model. Each episode used the scenario's fresh external-thread setting.
Raw reports remain local and are not repository artifacts.

| Scenario | Episode | Ember assertions | Model observations |
|---|---|---:|---:|
| `issue-56-supersession-commitment-gap` | `baseline-currentness` | 6/6 passed | 8/8 passed |
| `issue-56-supersession-commitment-gap` | `explain-after-restart` | 7/7 passed | 14/14 passed |
| `issue-56-supersession-commitment-gap` | `ordinary-current-only` | 7/7 passed | 5/5 passed |
| `issue-56-provenance-epistemic-restraint` | `provenance-baseline` | 6/6 passed | 11/11 passed |
| `issue-56-provenance-epistemic-restraint` | `provenance-after-restart` | 7/7 passed | 12/12 passed |
| **Aggregate** | **5 episodes** | **33/33 passed** | **50/50 passed** |

The supersession scenario's canonical state retained the earlier preference as
superseded history while the replacement remained current. Its explain projection
included both states with those distinct currentness values; its later ordinary
projection excluded the superseded preference. The live Ember-owned commitment
remained `live` in canonical state across both restarts and was projected after
restart with `last_known_live_needs_currentness_check`. The withheld synthetic
detail became an `unavailable_detail` gap, and neither the projection nor the
model reply exposed or reconstructed the unavailable value. Both restart replies
reported `none_in_supported_runtime` rather than inventing cognition during
downtime.

The provenance scenario's canonical state preserved the neutral fixture statement
as user-owned `user_testimony` and the commitment as an Ember-owned live
`ember_commitment`. Before and after restart, the projection preserved
`user_command` as the fact's source role and `ember_adoption` as the commitment's
first source role. The model kept those provenance classes distinct, attributed
ownership correctly, and answered that Ember had not directly observed the
user-testimony event.

There were no failed or varying model observations in the completed authenticated
runs, so no model-behavior, canonical-state, projection, or ambiguous semantic
failure was observed and no repetition was needed to obtain a passing attempt.
Canonical state and projection were correct for every evaluated episode.

Two initial command invocations failed before provider execution because the local
managed sandbox denied initialization of the authenticated Codex client. They
produced no report, model reply, canonical-state evidence layer, or projected
metadata, and the unchanged commands completed once run with the required host
access. Within the required semantic failure taxonomy these attempts are
**ambiguous**, because no semantic evidence layers existed to classify; the
available diagnostic identifies an execution-environment restriction rather than
a state, projection, or model-behavior defect.

No follow-up issue is warranted from this evidence. One successful run cannot
establish universal provider determinism, but this evaluation encountered no
nondeterministic semantic observation to preserve or investigate.

Do not paste raw model replies, generated Ember IDs, external provider thread IDs,
credential paths, or account-local information into this document.
