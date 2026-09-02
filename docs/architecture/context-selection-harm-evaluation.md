---
summary: "Issue #70 rubric and evaluated longitudinal evidence for omission harm, inclusion harm, truthful degradation, stale/current context, privacy boundaries, provenance integrity, and pressure to shrink or expand cognition projections."
read_when:
  - "Comparing omission harm with inclusion harm in Ember context selection"
  - "Interpreting longitudinal context-selection evidence before failure inventory or retrieval representation decisions"
  - "Deciding whether a smaller, larger, or differently balanced projection is justified by observed evidence"
role: evidence
discovery_status: current
---

# Context Selection Harm Evaluation

## Purpose and authority

Issue [#70](https://github.com/arhor/ember/issues/70) evaluates both sides of
context selection: harm from leaving relevant material out and harm from introducing
material that is irrelevant, stale, superseded, unavailable without qualification,
forbidden, provenance-distorting, or otherwise misleading.

This note applies the accepted semantics from ADR 0003 and
`docs/research/context-selection-and-cognitive-framing.md` to the deterministic
longitudinal evidence produced by #66-#69. It is evaluation evidence, not a new
retrieval policy and not a confidence calculus.

The executable ordinal classifier is
`eval/longitudinal/context-harm.ts`; regression coverage is
`tests/longitudinal-context-harm.test.ts`. Reproduce the deterministic evaluation
with:

```sh
node --test tests/longitudinal-context-harm.test.ts
```

The classifier consumes the shared harness `context_evaluation` output. It does not
consult provider replies. A live provider can therefore add empirical evidence about
cognitive distortion without changing the deterministic judgment about what Ember
selected, omitted, disclosed, or qualified.

## Evaluation discipline

The governing trade-off is not token count and not retrieval recall:

> Context should be sufficient rather than maximal. Additional material is justified
> when the expected harm of omission exceeds the expected harm of inclusion.

The rubric therefore uses ordinal categories rather than a synthetic scalar score.
The categories are intentionally asymmetric because some failures are observable at
the projection boundary while others require empirical cognition evidence.

| Judgment | Meaning |
| --- | --- |
| `none_observed` | The observed projection condition is semantically appropriate or no harm signal is present. This is not a claim that every model will behave perfectly. |
| `potential` | The projection contains an observable exposure that can create harm, but downstream cognitive impact is model-dependent and has not been measured here. |
| `material` | The projection violates a semantic condition that can materially change justified interpretation, currentness, uncertainty, or task outcome even before a model-specific effect is measured. |
| `boundary_violation` | The projection crosses a recipient, privacy, scope, or authority boundary that should have prevented disclosure. More model capacity cannot make the disclosure correct. |

These categories are ordinal descriptions, not arithmetic quantities. Ten
`potential` distractors do not automatically equal one `material` omission, and 64
irrelevant facts are not assigned 64 times the harm of one irrelevant fact.

## Observable harm taxonomy

### Omission harm

| Signal | Judgment | Interpretation |
| --- | --- | --- |
| Scenario-relevant meaning is not selected | `material` | Relevance is defined counterfactually: omission creates material risk of changing justified cognition. The projection needs expansion, reconstruction, translation, or a narrower task. |
| Relevant detail is unavailable but an explicit gap truthfully frames the limitation | `none_observed` for the unavailable content itself | Missing content is not fabricated. Whether the remaining projection is sufficient depends on consequence and task semantics. |
| Required context cannot legitimately cross a recipient boundary | `material` task pressure, but not permission to disclose | The correct response is to translate, narrow, retain the sensitive judgment, ask, defer, or abstain rather than convert omission pressure into a privacy leak. |

The current executable corpus contains no reproduced `relevant_not_selected`
condition. That absence is meaningful negative evidence: the current broad selector
has not yet failed these representative cases by under-selection.

### Inclusion harm

| Signal | Judgment | Interpretation |
| --- | --- | --- |
| Irrelevant permitted meaning is selected | `potential` | Unnecessary context exposure is observed. Distraction, anchoring, position interference, or degraded answer quality remain empirical model questions. |
| Superseded meaning is selected for an ordinary purpose where it is not relevant | `material` | Stale state can regain authority or distort currentness. |
| Superseded meaning is deliberately selected for historical/explanatory reconstruction and remains labeled historical | `none_observed` | Historical inclusion is purpose-sensitive evidence, not automatically stale-context harm. |
| Forbidden meaning is selected | `boundary_violation` | Privacy/scope/recipient rules were breached regardless of whether the model used the material. |
| Unavailable meaning participates with an explicit unavailable-detail gap | `none_observed` | The projection degrades truthfully rather than manufacturing continuity. |
| Unavailable meaning participates without the required gap | `material` | The projection risks unsupported certainty or false seamless recall. |
| Provenance, ownership, uncertainty, or conflict is collapsed while the underlying propositions remain selected | `material` | Inclusion can be harmful through framing, not only membership. Repeated derived reports must not become independent evidence and direct observation must not become testimony or inference. |
| Repeated/derived material receives false independent evidential salience | `material` when the projection changes evidential interpretation; otherwise `potential` when only unnecessary duplication is observed | Repetition does not manufacture corroboration. |

The generic executable classifier handles membership/currentness/gap/boundary signals.
Provenance distortion remains governed by semantic projection assertions because a
list of selected aliases alone cannot determine whether evidence lineage was
preserved correctly. The #68 fixture and tests provide that oracle for the current
provenance slice.

## Selection pressure

For downstream comparison the executable rubric reports an implementation-neutral
selection pressure:

| Pressure | Meaning |
| --- | --- |
| `stable` | No observed omission or harmful/potential inclusion pressure requires changing projection breadth. |
| `reduce` | Inclusion pressure exists without observed relevant omission. Prefer a smaller or more selective projection while preserving governing meaning. |
| `expand` | Material omission exists without inclusion pressure. Retrieve/reconstruct enough additional permitted context to restore sufficiency. |
| `rebalance` | Both sides are present. Neither indiscriminate expansion nor indiscriminate minimization is justified. |

This is deliberately not a retrieval prescription. `reduce` may eventually mean a
better semantic selector, ranking, task-specific projection, compaction, or another
representation-neutral capability. `expand` may mean on-demand reconstruction
rather than a larger default prompt.

## Representative corpus results

The current corpus was evaluated using the deterministic harness and scripted
provider layer. All Ember projection assertions pass independently of model reply
quality.

| Scenario / episode | Omission | Inclusion | Pressure | Interpretation |
| --- | --- | --- | --- | --- |
| `memory-context-pressure / baseline-long-history` | `none_observed` | `potential` | `reduce` | 64 generated same-scope facts are declared irrelevant yet selected. Relevant target, preference, and commitment are present; forbidden private context is absent. |
| `memory-context-pressure / changed-and-degraded` | `none_observed` | `potential` | `reduce` | The 64 irrelevant facts remain. The superseded preference is intentionally relevant to explanation and the unavailable episode carries an explicit gap, so neither is harm by itself. |
| `memory-context-pressure / ordinary-after-change` | `none_observed` | `potential` | `reduce` | Current preference governs; stale preference, private marker, and irrelevant degraded episode stay out. Ambient history still creates unnecessary inclusion. |
| `currentness-pressure / baseline-with-unresolved-conflict` | `none_observed` | `potential` | `reduce` | Both unresolved reports remain attributable and current while 24 irrelevant history facts are selected. Smaller context can remove noise without resolving the conflict. |
| `currentness-pressure / changed-preference` | `none_observed` | `potential` | `reduce` | Old preference is excluded despite reused provider-thread history; 24 irrelevant facts remain. |
| `currentness-pressure / corrected-fact` | `none_observed` | `potential` | `reduce` | Corrected fact and current preference replace stale values in ordinary projection; ambient irrelevant inclusion remains. |
| `currentness-pressure / explicit-history-reconstruction` | `none_observed` | `potential` | `reduce` | Old preference and fact become relevant again as labeled history. Removing them would create omission harm for the explanation; removing the 24 ambient facts would not. |
| `provenance-pressure / mixed-provenance-baseline` | `none_observed` | `potential` | `reduce` | Testimony, external claim, direct observation, delegates, and inferences remain distinct with transitive evidence roots; 12 irrelevant facts add noise. |
| `provenance-pressure / corrected-user-testimony` | `none_observed` | `potential` | `reduce` | Superseded testimony stays historical while current conflicting evidence retains provenance. The same 12 irrelevant facts remain selected. |
| `provenance-pressure / historical-provenance-reconstruction` | `none_observed` | `potential` | `reduce` | Historical user testimony is intentionally included with attribution. Provenance distinctions and correlated roots survive; irrelevant ambient facts remain unnecessary. |
| `degraded-context-pressure / available-detail-baseline` | `none_observed` | `potential` | `reduce` | Requested detail is recoverable and relevant, private context is withheld, but one irrelevant permitted lab note is selected. |
| `degraded-context-pressure / unavailable-after-restart` | `none_observed` | `potential` | `reduce` | The unavailable detail becomes a truthful projection gap after restart; the private meaning remains undisclosed. The irrelevant lab note is still selected. |
| `degraded-context-pressure / ordinary-after-second-restart` | `none_observed` | `potential` | `reduce` | The persistent gap remains canonical but does not participate when irrelevant. The private context stays out; the unrelated lab note still participates. |

No representative episode currently produces `material` omission,
`material` stale/unmarked-degradation inclusion, or a `boundary_violation`. The test
suite includes synthetic signal cases for those rubric branches so future scenarios
can classify them consistently when they are reproduced.

## What smaller projections improve

The strongest repeated finding is not that Ember lacks more recall. It is that the
current deterministic v1 selector is intentionally broad for same-scope current
facts and repeatedly admits material already declared irrelevant by the scenario:

- 64 ambient facts in the general memory/context pressure fixture;
- 24 ambient facts in currentness pressure;
- 12 ambient facts in provenance pressure;
- one unrelated same-scope fact in degraded-context pressure.

Removing those meanings would reduce unnecessary exposure while preserving every
currently declared relevant meaning, currentness relation, privacy boundary,
provenance distinction, live commitment, and truthful gap in these episodes.

This is evidence for **more selective projection**, not yet evidence for a specific
retrieval technology. The corpus does not justify embeddings, vector search,
reranking, SQLite, or a larger context window by itself.

## Where larger or deeper projections help

The corpus also demonstrates why "smaller" cannot become the objective in its own
right:

- explicit historical reconstruction requires superseded preference/fact/testimony
  that ordinary projection correctly excludes;
- provenance-sensitive reasoning requires the evidence lineage behind selected
  claims, even when a shorter topical summary would be smaller;
- unavailable recall requires a gap marker when the degraded meaning is relevant;
- unresolved contradiction requires both sides and their attribution rather than a
  cleaner single proposition.

These are targeted expansions driven by purpose and epistemic need. Omitting them in
those episodes would make a smaller projection worse.

## Where the current deterministic projection is sufficient

The current projection already demonstrates several important sufficiency results:

1. explicit fact/preference supersession keeps stale values out of ordinary
   cognition while retaining them for explanation;
2. forbidden wrong-scope private material stays outside the tested projections;
3. unavailable detail survives restart as an explicit gap instead of fabricated
   recall;
4. current provenance-aware facts preserve epistemic role and transitive derivation
   roots;
5. unresolved contradictory reports can coexist without recency inventing a
   correction;
6. selected relevant meanings are not omitted in the representative #66-#69 corpus.

These passing cases are negative evidence against replacing the current semantics or
adding retrieval machinery merely because richer systems commonly have it.

## Where the current projection begins to fail

The reproduced selection weakness is **over-inclusion of irrelevant current
same-scope facts**. This is a genuine selection defect relative to least-sufficient
context, but the present evidence establishes only unnecessary exposure, not a
measured answer-quality loss for a live model.

Two adjacent limitations belong to #71 rather than being mislabeled retrieval
failures here:

- #67 found that exact-slot unresolved conflict cannot yet represent two current
  candidate values in one semantic slot;
- #69 found that deleted/forgotten memory has no canonical lifecycle representation
  yet.

Those are modeling/semantic gaps. Expanding context cannot repair them.

## Empirical cognition boundary

No live-model episode is required to establish the deterministic results above.
`empirical_cognition_impact` therefore remains `not_measured` in the executable
rubric.

A live run can answer additional questions such as:

- whether 12, 24, or 64 irrelevant facts measurably distract a supported backend;
- whether reused external thread history resurrects stale values despite a correct
  fresh projection;
- whether a model collapses correlated provenance even when the projection exposes
  the correct lineage;
- whether an unavailable-detail gap prevents plausible fabrication rather than only
  known marker resurrection.

Those observations should be recorded as model behavior, not used to overwrite a
passing or failing Ember projection assertion.

## Limitations

1. Scenario relevance is an authored oracle. The harness verifies semantic facts
   such as supersession and unavailable evidence, but it cannot prove that an author
   labeled relevance correctly.
2. `potential` irrelevant-inclusion harm does not quantify distraction. Different
   providers, ordering, and filler content can behave differently.
3. The rubric does not convert counts into severity. One private disclosure can be
   more serious than hundreds of harmless distractors.
4. The current generic classifier cannot infer provenance distortion from membership
   alone. Provenance/currentness assertions remain necessary semantic evidence.
5. The corpus does not yet represent deletion/forgetting, so deletion-specific
   inclusion/omission harm cannot be measured honestly.
6. The fixtures exercise a minimal local projection boundary, not every future
   delegate, surface, or permission boundary.
7. A green deterministic projection does not prove a model will use the context
   correctly; a poor model reply does not prove selection was wrong.

## Evidence carried forward to #71 and #72

The reusable conclusion is deliberately narrow:

- **no representative relevant-omission failure is currently reproduced;**
- **irrelevant same-scope over-inclusion is reproduced consistently and creates
  `reduce` pressure;**
- **targeted historical/provenance/degradation expansion is necessary in specific
  purposes and should not be mistaken for inclusion harm;**
- **privacy/currentness/provenance distinctions already prevent several higher-order
  inclusion harms in the tested slice;**
- **the next failure inventory should separate this selection over-inclusion from
  the known exact-slot contradiction and deletion/forgetting modeling gaps;**
- **any richer retrieval/index representation must justify itself against these
  observed failure classes rather than against context size alone.**

That evidence is sufficient for #71 to inventory concrete failure modes without
assuming that a larger projection or fashionable retrieval layer is automatically
an improvement.
