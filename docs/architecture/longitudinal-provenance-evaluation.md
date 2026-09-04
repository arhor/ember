---
summary: "Issue #68 evaluation evidence for provenance-aware longitudinal memory across user testimony, Ember inference, external claims, direct observations, delegated reports, correlated derivation, correction, and historical inspection."
read_when:
  - "Reviewing provenance behavior across testimony, inference, external evidence, direct observation, or specialist reports"
  - "Interpreting correlated or derived evidence before omission/inclusion harm synthesis in #70 or failure inventory work in #71"
  - "Checking whether a correction or historical reconstruction preserves attribution instead of laundering evidence classes"
role: evidence
discovery_status: current
---

# Longitudinal Provenance Evaluation

## Purpose and authority

Issue [#68](https://github.com/arhor/ember/issues/68) extends the shared
longitudinal evaluation seam from #54 and #66 with the provenance distinctions
required by ADR 0002 and the memory/delegation research. This document records
implementation/evaluation evidence. It does not make repetition into epistemic
weight, define a confidence calculus, or replace the governing semantic sources.

The executable fixture is
`test-fixtures/longitudinal/provenance-pressure.json`; deterministic coverage is
`tests/longitudinal-provenance.test.ts`. Reproduce it with:

```sh
npm run eval:provenance
node --test tests/longitudinal-provenance.test.ts
```

The same fixture can be passed to the opt-in live runner:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node scripts/run-longitudinal-scenario.ts \
  --scenario test-fixtures/longitudinal/provenance-pressure.json \
  --provider codex \
  --timeout-seconds 180
```

The live reply tokens are empirical model observations, not calibrated confidence
measurements. Deterministic assertions remain the oracle for canonical provenance,
derivation roots, projection membership, currentness, and historical attribution.

## Representation exercised

The minimal state now distinguishes provenance-aware **fact** propositions with
explicit epistemic roles:

- `user_testimony`, sourced by a retained user-command occurrence;
- `external_claim`, owned by a named `external:<source>` and sourced by an external
  claim occurrence;
- `direct_observation`, Ember-owned and sourced by an Ember observation occurrence;
- `delegated_report`, owned by a named `delegate:<delegate>` and sourced by a
  delegated-report occurrence;
- `ember_inference`, Ember-owned and required to derive from at least one earlier
  evidence occurrence.

This is intentionally not a universal memory taxonomy. Preferences, relationship
meaning, episode metadata, and commitments retain the narrower rules of the current
vertical slice. The task adds only the distinctions needed to exercise the accepted
provenance semantics without inventing retrieval or persistence machinery.

Evidence derivation is an acyclic graph. A projected meaning carries its immediate
source evidence plus the complete transitive ancestry of that evidence. Thus a
later inference can be traced through a delegated report to the original external
claim instead of losing the root after one hop. The minimal v1 representation also
requires every derivation edge and every meaning-to-source edge to stay within one
evidence scope, preventing selected derived facts from laundering ancestor evidence
across a context boundary. Semantic operations reject cross-scope derivation before
mutating state, while canonical validation provides defense in depth. Validation
also rejects derivation cycles and source/epistemic-role mismatches.

## Scenario map

Twelve irrelevant same-scope facts create ordinary history pressure before the
fixture establishes one release question with conflicting and correlated evidence.

| Episode                                | Pressure                                                                                                                                                                                          | Deterministic oracle                                                                                                                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mixed-provenance-baseline`            | User testimony and an external dashboard say green; Ember directly observes a red smoke check; two delegates repeat the same dashboard; two Ember inferences descend from those delegate reports. | All five provenance classes remain explicit. The delegate/inference branch has one external root, so the green side has two independent roots total: user testimony and dashboard. The red observation has one separate root.                                                    |
| `corrected-user-testimony`             | The user corrects green testimony to red after an Ember restart while the provider thread still contains the old statement.                                                                       | Old testimony becomes historical and is absent from ordinary projection; the new user occurrence remains user testimony. The dashboard/delegate/inference branch still has one green root, while current red evidence has two roots: corrected testimony and direct observation. |
| `historical-provenance-reconstruction` | A fresh provider thread explicitly reconstructs the user correction.                                                                                                                              | Old and new user reports are both projected with their original user-command attribution; old testimony remains superseded rather than silently current. External, observed, delegated, and inferred claims retain their distinct classes and derivation roots.                  |

## Findings

### Repetition does not manufacture corroboration

`delegate_a` and `delegate_b` are separate report occurrences, but both derive from
the same `external_dashboard` evidence. `inference_a` and `inference_b` derive from
those reports. The projection recursively exposes the same dashboard root beneath
all four derived meanings.

The deterministic test therefore counts independent support by root evidence IDs,
not by the number of descendant reports or inferences. Four descendants still add
only one external root. This directly exercises ADR 0002's evidential-conservation
constraint and the delegation finding that correlated specialists are multiple
reasoning episodes, not automatically multiple independent sources.

### Conflict remains attributable instead of becoming a majority vote

The baseline deliberately contains many green-looking descendants and one red direct
observation. The representation does not resolve truth by recency or claim count.
Each proposition carries its source class and actor, so later cognition can see that
several green statements are one correlated chain while the direct observation is a
separate root.

The fixture records root cardinalities only as transparent evaluation facts. It does
not claim that two roots are twice as trustworthy as one, or define domain-specific
source reliability. #70 can apply a harm rubric to omission/inclusion decisions
without inheriting a fabricated scalar confidence model.

### Correction preserves provenance through currentness and history

The user correction uses the existing explicit supersession transition. The old
meaning remains `user_testimony`, retains its original source evidence ID, and moves
to historical state. The replacement is a new user-testimony meaning backed by a
new user occurrence. Ordinary projection excludes the superseded green report;
explicit historical explanation includes both versions with attribution intact.

Supersession remains deliberately restricted to the user-testimony fact/preference
path supported by the current slice. #68 does not invent a generic rule for
superseding external claims, observations, or delegate reports merely to make the
fixture symmetrical.

### Full derivation lineage is part of context integrity

Before #68, projection exposed only one parent hop for derived evidence. That was
sufficient for the adoption path but would lose an external root beneath
`inference -> delegated report -> external claim`. Projection and explanation now
carry the transitive evidence closure, while canonical IDs and derivation links
remain unchanged in durable state.

That change is semantic conservation, not broader retrieval. It does not select
extra meanings; it preserves the ancestry of evidence for meanings already selected.

## Empirical model observation

The live fixture asks the provider to emit explicit audit tokens after reasoning over
the supplied projection:

- baseline: `GREEN_ROOTS=2 RED_ROOTS=1` and `CORRELATED_NOT_INDEPENDENT`;
- after correction: `GREEN_ROOTS=1 RED_ROOTS=2` and
  `CORRELATED_NOT_INDEPENDENT`;
- historical reconstruction: `HISTORICAL_USER_TESTIMONY` while keeping provenance
  classes distinct.

A failure here is model-level evidence that cognition collapsed source classes,
counted correlated descendants as independent, or mishandled historical testimony.
It does not rewrite the deterministic state/projection result. Conversely, a model
that prints the desired tokens cannot repair a failed Ember assertion.

## Evidence carried forward to #70 and #71

Issue #68 leaves reusable repository evidence for:

1. omission/inclusion analysis where provenance changes the harm of leaving a claim
   out or allowing it to dominate context;
2. correlated evidence inflation as a distinct failure mode from ordinary noisy
   context;
3. source-class collapse between testimony, external evidence, direct observation,
   delegated report, and Ember inference;
4. provenance loss across correction, restart, and historical reconstruction;
5. transitive-lineage loss between a derived claim and its independent evidence root.

No embeddings, vector store, reranker, SQLite schema, confidence score, or generic
retrieval policy is introduced. Those remain downstream decisions justified only by
observed failures rather than by the existence of this provenance vocabulary.
