---
summary: "Issue #71 synthesis of reproduced longitudinal context-selection failures, memory-modeling gaps, resolved projection defects, negative evidence, and implementation-neutral capability requirements for retrieval decisions."
read_when:
  - "Inventorying observed context-selection, currentness, provenance, deletion, or cognition failure modes"
  - "Deciding whether issue #72 warrants richer retrieval or indexing"
  - "Separating selection defects from memory-modeling gaps and empirical model behavior"
role: evidence
discovery_status: current
---

# Context Selection Failure Inventory

## Purpose and authority

Issue [#71](https://github.com/arhor/ember/issues/71) synthesizes the longitudinal
memory and context evidence from issues #66-#70 into a concrete failure inventory.
Its purpose is to tell downstream representation work what capability is actually
missing before any storage, retrieval, indexing, ranking, or model-specific mechanism
is chosen.

This document is evaluation evidence. It does not create new semantic authority.
The governing sources remain:

- [ADR 0002](decisions/0002-preserve-persistent-meaning.md), which requires persistent
  meaning to preserve provenance, scope, currentness, conflict, lifecycle, truthful
  gaps, forgetting, and deletion semantics;
- [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md), which
  requires purpose-bounded, least-sufficient permitted projections rather than
  canonical state wholesale;
- [Memory and Remembering Semantics](../research/memory-and-remembering.md);
- [Context Selection and Cognitive Framing Semantics](../research/context-selection-and-cognitive-framing.md);
- [Context Selection Harm Evaluation](context-selection-harm-evaluation.md), which
  supplies the omission/inclusion rubric applied below.

The executable evidence comes from the longitudinal harness and scenario corpus:

- `test-fixtures/longitudinal/memory-context-pressure.json`;
- `test-fixtures/longitudinal/currentness-pressure.json`;
- `test-fixtures/longitudinal/provenance-pressure.json`;
- `test-fixtures/longitudinal/degraded-context-pressure.json`;
- `eval/longitudinal/context-harm.ts` and its regression tests;
- the current `src/core/projection.ts` selection implementation.

## Executive finding

The longitudinal evidence does **not** show a recall-capacity failure that requires a
richer retrieval or indexing mechanism.

It shows one systematic current selection defect and two separate canonical-model
capability gaps:

1. **Selection defect:** ordinary projection admits irrelevant current same-scope
   meanings because v1 selection treats currentness plus scope as sufficient evidence
   of participation. This is repeatedly reproduced and creates `reduce` pressure.
2. **Modeling gap:** one exact semantic slot cannot represent multiple simultaneously
   current unresolved candidates. The current contradiction fixture must use separate
   report slots instead.
3. **Modeling/lifecycle gap:** forgotten and deleted meaning are not representable.
   Unavailable detail is correctly modeled as a different condition and must not be
   overloaded to mean deletion.

The corpus currently reproduces **no material relevant-omission failure**, **no stale
ordinary projection failure**, **no forbidden disclosure**, **no current provenance
collapse**, and **no unmarked unavailable-recall failure**. Empirical model-behavior
impact is not measured by the deterministic corpus.

That distinction matters for #72. The observed selection weakness occurs after the
relevant state is already available to Ember and while the current selector is
already scanning it. A vector store, embedding index, reranker, SQLite database, or
larger context window is therefore not justified by this evidence alone.

## Failure classes

This inventory uses cause classes rather than implementation labels.

| Class | Question |
| --- | --- |
| **Storage / modeling** | Can canonical Ember state truthfully represent the semantic distinction before selection begins? |
| **Selection** | Given representable and permitted state, does Ember choose the meanings that should participate in this cognition? |
| **Projection / currentness / provenance** | Does the selected projection preserve current-vs-historical status, scope, gaps, attribution, conflict, and evidence lineage? |
| **Model behavior** | Given a semantically correct projection, does the cognition provider nevertheless misuse, ignore, collapse, or fabricate from it? |

A failure can only be fixed at or before the layer that caused it. Retrieval cannot
recover a distinction that canonical state cannot represent, and a model wording
failure does not prove that Ember selected the wrong context.

## Current failure inventory

### SEL-01: irrelevant current same-scope meanings participate by default

**Status:** reproduced current failure.

**Class:** selection.

**Observed behavior:** `buildProjection()` selects every current `fact` and
`preference` whose scope equals the active scope. It does not distinguish a meaning
that is relevant to the current purpose from another current meaning that merely
shares the same scope. The longitudinal scenarios expose that behavior directly:

| Scenario / episode family | Irrelevant same-scope meanings selected | Relevant omission | Harm judgment |
| --- | ---: | --- | --- |
| `memory-context-pressure` | 64 generated ambient facts | none observed | `potential` inclusion, `reduce` pressure |
| `currentness-pressure` | 24 generated ambient facts | none observed | `potential` inclusion, `reduce` pressure |
| `provenance-pressure` | 12 generated ambient facts | none observed | `potential` inclusion, `reduce` pressure |
| `degraded-context-pressure` | 1 unrelated permitted fact | none observed | `potential` inclusion, `reduce` pressure |

The counts are evidence of systematic breadth, not a scalar severity formula. One
private disclosure could be more serious than hundreds of harmless distractors, and
the current corpus does not claim that 64 irrelevant facts cause 64 times the harm
of one.

**Governing expectation:** ADR 0003 requires a purpose-bounded projection that is
sufficient rather than maximal. The context research defines relevance by the
counterfactual consequence of omission and explicitly separates context quality from
retrieval quality. Scope and currentness are necessary constraints, not sufficient
relevance criteria.

**Severity / impact:** the #70 rubric classifies the observed condition as
`potential` inclusion harm with systematic `reduce` selection pressure. Unnecessary
material is exposed to cognition even when the scenario oracle says it cannot change
the justified task result. This creates avoidable privacy surface, distraction,
anchoring, position/interference, and context-cost pressure. Actual answer degradation
remains an empirical model question and is not promoted to `material` harm by this
inventory.

**Implementation-neutral missing capability:** Ember needs a way to discriminate
purpose-relevant participation among already permitted current meanings inside the
same scope, while retaining the ability to deepen or reconstruct context when a
narrower projection would omit governing history, provenance, contradiction, or a
truthful gap. The capability must be inspectable enough for the harness to explain
why a meaning participated or did not participate.

**What this does not establish:** it does not establish that the missing capability
must use semantic search, embeddings, a vector database, reranking, SQL indexes,
model-generated summaries, or any other particular representation. The 101 distinct
authored ambient/irrelevant fixture items across these scenario families are already
available to the current selector. The demonstrated problem is choosing participation,
not locating absent state.

### MODEL-01: exact-slot unresolved conflict cannot be represented directly

**Status:** confirmed executable modeling boundary exposed by #67; not a retrieval
failure.

**Class:** storage / modeling.

**Scenario evidence:** `currentness-pressure / baseline-with-unresolved-conflict`
keeps two contradictory migration reports current by assigning them different report
slots. The evaluation documents why this is necessary: v1 semantics permit only one
current meaning for an exact `kind + owner + slot + scope` tuple. `rememberFact`
therefore cannot preserve two simultaneously current candidate values in the same
exact fact slot. `tests/model-store.test.ts` independently regression-tests the
invariant by requiring validation to reject two current meanings that share an exact
slot.

The fixture successfully preserves contradiction because it models two attributable
reports, not because the exact-slot limitation disappeared.

**Governing expectation:** ADR 0002 and the memory research require unresolved
conflict to remain representable without recency silently becoming correction,
without forced synthesis, and without losing provenance. ADR 0003 requires both
relevant sides to participate when resolution matters.

**Severity / impact:** this is a representation-layer semantic blocker when the real
state requires multiple current candidates for one exact slot. It is not assigned a
#70 membership-harm score because the current model cannot honestly instantiate that
state for projection evaluation. Forcing such a case through overwrite, false
supersession, or invented slot separation could materially corrupt currentness or the
meaning of the disagreement.

**Implementation-neutral missing capability:** when observed scenarios require it,
canonical state needs a representation for unresolved competing current candidates or
an equivalent first-class disputed/currentness relation that preserves each
candidate's provenance and does not manufacture a winner.

**Boundary on the finding:** the current corpus has not shown that every
contradiction needs this richer exact-slot representation. Separate attributable
reports are sufficient for the exercised migration scenario. #72 must not treat this
known semantic boundary as evidence for a search index.

### MODEL-02: forgotten and deleted memory have no canonical lifecycle

**Status:** confirmed modeling/lifecycle gap exposed by #69; not a retrieval failure.

**Class:** storage / modeling.

**Scenario evidence:** `degraded-context-pressure / unavailable-after-restart`
correctly converts optional detail into an `unavailable_detail` gap and proves that
the old payload is not projected. The same scenario keeps private context canonical
but outside the permitted projection. Those are intentionally different conditions.

The #69 evaluation then probes deletion explicitly. The current model has no
forgotten/deleted lifecycle for meaning or evidence, and the fixture-only
`withholdDetail` operation rejects deletion-shaped use rather than relabeling
unavailability as deletion. The #69 regression test verifies that rejection leaves
state unchanged. This preserves the negative result instead of producing a false
green scenario.

**Governing expectation:** ADR 0002 treats forgetting as a legitimate lifecycle
outcome, requires privacy/security deletion to account for reconstructable
derivatives, and requires failed recall, unavailable evidence, absent memory,
forgetting, and deletion to remain distinguishable. AS-MEM-05 applies that semantic
pressure to privacy deletion.

**Severity / impact:** this is a boundary-sensitive semantic blocker when a real
forgetting or deletion obligation exists. The #70 classifier does not assign it a
`boundary_violation` because the corpus deliberately cannot instantiate deletion yet,
and this inventory does not fabricate that measurement. The practical impact is
nevertheless serious: Ember cannot truthfully express "this was deliberately
forgotten" or "this content was deleted and must not be reconstructable" as canonical
state. Leaving the content merely unavailable or merely unselected does not satisfy
the same semantics.

**Implementation-neutral missing capability:** canonical memory needs explicit
forgetting/deletion lifecycle semantics, including the scope of deletion, what event
existence may legitimately survive, how reconstructable derivatives are removed or
weakened, and how downstream claims are qualified when their supporting evidence is
removed. ADR 0002 deliberately leaves some propagation thresholds unresolved, so
this inventory does not invent them.

**What this does not establish:** no indexing or retrieval representation can by
itself supply deletion semantics. A future index would instead have to obey whatever
canonical forgetting/deletion rules are decided.

## Projection, currentness, and provenance results

The representative current corpus contains no unresolved current failure in this
class. That is substantive negative evidence, not an empty section.

### Currentness remains intact under the tested pressure

`currentness-pressure` reuses provider-thread history while changing a preference and
correcting a fact. The fresh Ember projection excludes the superseded values from
ordinary cognition, preserves them as attributable history, and deliberately
reintroduces them only for explicit historical reconstruction. The two contradictory
reports remain unresolved rather than being ordered into truth by recency.

The 24 irrelevant ambient facts still demonstrate SEL-01, but they do not turn the
passing currentness behavior into a currentness failure.

### Provenance remains intact under the tested pressure

`provenance-pressure` mixes user testimony, an external claim, direct observation,
two delegated reports, and two Ember inferences. The delegate/inference branch shares
one external evidence root, so repetition does not manufacture independent
corroboration. User correction preserves the old testimony as historical while the
new testimony becomes current.

Issue #68 did expose one projection-integrity defect during construction: projected
derived evidence originally carried only one parent hop and would lose the external
root beneath `inference -> delegated report -> external claim`. #68 fixed that by
projecting the transitive evidence closure. The current code and regression tests
therefore preserve full lineage for selected meanings.

That resolved defect remains useful evidence for future designs: reducing context
must not compact away the provenance ancestry needed to interpret a selected claim.
It is **not** a current reason to add broader retrieval machinery.

### Truthful degradation remains intact under the tested pressure

When requested detail becomes unavailable, explicit explanation includes the
`unavailable_detail` gap while omitting the missing payload. After another restart,
the gap remains canonical but does not participate in an unrelated ordinary
projection. Private wrong-scope context remains canonical and undisclosed.

This is the desired distinction among unavailable, deliberately excluded, and merely
irrelevant material. A richer selector must preserve it.

## Model-behavior failures: not established by the current evidence

The deterministic harness deliberately separates projection evidence from provider
reply behavior. The #70 rubric therefore records `empirical_cognition_impact` as
`not_measured`.

Optional live-model runs can test additional failure modes, including:

- distraction or position effects caused by the 1, 12, 24, or 64 irrelevant facts;
- resurrection of stale preference/fact text from a reused external provider thread
  even when Ember's fresh projection is correct;
- collapsing correlated delegated/inferred claims into independent corroboration;
- fabricating plausible missing detail despite an explicit unavailable-recall gap.

If one of those occurs while Ember's deterministic projection remains correct, it
must be classified as model/provider behavior or provider-adapter framing, not
retroactively as a retrieval or storage failure. Conversely, a fluent model reply
cannot repair a failed deterministic projection assertion.

## Negative evidence against unnecessary complexity

The current simple design already avoids several higher-order harms under the
representative longitudinal pressure:

1. **No relevant omission is reproduced.** Every scenario-declared relevant meaning
   needed by the exercised cognition is selected.
2. **Supersession is purpose-sensitive.** Old fact and preference values do not
   govern ordinary cognition but remain available for explicit explanation.
3. **Contradiction is not silently rewritten by recency.** Separate attributable
   reports can coexist without invented consensus.
4. **Wrong-scope private meaning stays out.** The tested forbidden markers never
   enter the cognition projection.
5. **Unavailable recall degrades truthfully.** The episode can remain supported while
   exact detail becomes unavailable, with an explicit gap when relevant.
6. **Provenance survives projection.** Source roles, correlation, and transitive
   evidence roots remain available for selected meanings.
7. **Raw transcript inclusion is not required by the tested cases.** The current
   projection records `raw_transcript_included: false` while preserving the required
   semantic evidence.

These results are evidence against indiscriminate context expansion and against
replacing working currentness/provenance/degradation semantics merely because richer
memory systems often use more elaborate storage.

## Known boundaries that are not current #72 drivers

Some v1 capabilities remain deliberately narrow without currently reproduced
selection pressure:

- relationship meaning is fixed-current and relationship supersession is not yet a
  supported transition;
- relevance in the harness is an authored oracle rather than a production relevance
  estimator;
- the generic harm classifier infers membership/currentness/gap/boundary signals but
  relies on semantic assertions for provenance integrity;
- the corpus exercises a local CLI-oriented projection boundary, not every future
  surface, delegate, or recipient;
- no live-model answer-quality effect has yet been measured for the reproduced
  irrelevant inclusion.

These are reasons to keep future designs testable, not evidence that a particular
retrieval technology is currently required.

## Requirements carried into #72

The evidence supports one immediate context-selection requirement and two independent
semantic-model requirements.

### Required selection capability

A #72 candidate may change representation only if needed, but it must address the
observed pressure in implementation-neutral terms:

> Select the least sufficient permitted subset of already available current meaning
> for the present purpose, with inspectable reasons and a way to deepen context when
> omission risk exceeds inclusion risk.

A candidate should be evaluated against the same corpus. At minimum it must:

- reduce or eliminate the 64/24/12/1 irrelevant same-scope selections that reproduce
  SEL-01;
- introduce no scenario-declared relevant omission;
- keep forbidden material out;
- preserve ordinary stale-value exclusion and explicit historical reconstruction;
- preserve unresolved contradiction and provenance lineage for selected claims;
- preserve truthful unavailable-detail gaps when relevant;
- keep omission and inclusion harm visible as separate regression dimensions.

### Independent semantic-model requirements

MODEL-01 and MODEL-02 must remain visible, but neither can be claimed solved merely
by adding retrieval/indexing:

- exact-slot unresolved conflict needs truthful canonical representation if future
  scenarios require multiple current candidates for one slot;
- forgetting/deletion needs an explicit lifecycle and derivative-handling semantics
  before a storage/index implementation can honor deletion correctly.

Those requirements may result in separate architecture work. They must not be hidden
inside a search-layer implementation.

## Representation decision for #72

Based solely on the current repository evidence, **richer retrieval or indexing is
not yet warranted as a necessary mechanism**.

The only reproduced current selection failure occurs while the relevant and
irrelevant meanings are already available and already traversed by the selector. The
missing capability is purpose-sensitive selection among available permitted state.
That capability may be implementable with the existing in-memory representation.
An index or retrieval layer becomes justified only if a concrete candidate needs it
to satisfy the observed requirement, or later evaluation reproduces a failure to
locate relevant permitted meaning at the required scale.

This is intentionally a negative representation conclusion, not a conclusion that
context selection is finished. SEL-01 is real and systematic. The evidence simply
constrains the next change to solve the demonstrated participation problem without
smuggling in unrelated storage complexity.

## Reproduction and follow-up

The deterministic evidence can be reproduced with the existing longitudinal tests,
including:

```sh
node --test tests/longitudinal-memory-context.test.ts
node --test tests/longitudinal-currentness.test.ts
node --test tests/longitudinal-provenance.test.ts
node --test tests/longitudinal-degraded-context.test.ts
node --test tests/longitudinal-context-harm.test.ts
```

Optional live longitudinal runs add model-behavior evidence but are not required to
establish the deterministic failure classes above.

When #72 evaluates a candidate representation, it should cite SEL-01 directly and
rerun the harm corpus before claiming improvement. If no richer mechanism is needed
to satisfy that requirement, #72 can close with the explicit negative decision
supported here rather than adding speculative retrieval infrastructure.
