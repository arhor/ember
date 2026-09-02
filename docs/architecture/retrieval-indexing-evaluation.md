---
summary: "Issue #72 evaluation concluding that current longitudinal evidence does not justify richer retrieval or indexing, while preserving SEL-01 as explicit future selection pressure."
read_when:
  - "Deciding whether Ember needs retrieval, indexing, embeddings, reranking, or a database for context selection"
  - "Revisiting issue #72 after new longitudinal omission, scale, or model-behavior evidence"
role: evidence
discovery_status: current
---

# Retrieval and Indexing Evaluation

## Purpose and authority

Issue [#72](https://github.com/arhor/ember/issues/72) asks whether the longitudinal
memory/context evidence now justifies a richer retrieval or indexing representation.
The issue is intentionally conditional: adding machinery is not success unless the
recorded failures require it.

This note records the representation decision after reviewing the parent epic and
issues #66-#71, the longitudinal corpus and harm rubric, the accepted semantic ADRs,
the current projection path, the current persistence path, and ADR 0006's dependency
policy.

This is evaluation evidence, not new semantic authority. The governing constraints
remain [ADR 0002](decisions/0002-preserve-persistent-meaning.md),
[ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md), and the
canonical [context-selection research](../research/context-selection-and-cognitive-framing.md).
The concrete failure evidence remains the
[context-selection failure inventory](context-selection-failure-inventory.md) and
[context-selection harm evaluation](context-selection-harm-evaluation.md).

## Decision

**Do not introduce richer retrieval or indexing in #72.**

Keep the current canonical state representation, file-backed persistence, and
projection representation unchanged. Do not add SQLite, a vector database,
embeddings, semantic search, reranking, a retrieval framework, or another runtime
package on the current evidence.

This is a negative representation decision, not a claim that context selection is
finished. The reproduced SEL-01 defect remains real: ordinary projection admits
irrelevant current same-scope meanings. The evidence shows that the missing
capability is purpose-sensitive participation among already available permitted
meaning, not a demonstrated inability to locate relevant state.

No subordinate ADR is added because #72 makes no durable representation change.
Accepted ADRs 0002, 0003, and 0006 already provide the applicable semantic and
implementation constraints.

## Evidence mapped to the decision

| Evidence | What it demonstrates | #72 consequence |
| --- | --- | --- |
| SEL-01 in the #71 failure inventory | The selector over-includes 64/24/12/1 scenario-declared irrelevant same-scope meanings while reproducing no relevant omission. | Preserve the need for a more selective, inspectable participation policy; do not misclassify the pressure as a recall-capacity failure. |
| #70 harm evaluation | Representative episodes consistently produce `reduce` pressure from potential irrelevant inclusion, with no material omission or boundary violation. | Default context should eventually shrink selectively, but indiscriminate retrieval expansion would move in the wrong direction. |
| Current `buildProjection()` | The selector already traverses canonical meanings and admits current fact/preference values by scope, plus live commitments and relationship meaning. | The reproduced irrelevant items are already found; another index would not solve why they participate. |
| Current `StateStore` | Canonical state is loaded as one validated JSON document and the reproduced corpus remains available to projection after restart. | The corpus contains no demonstrated persistence lookup failure that requires a secondary index. |
| Currentness/provenance/degraded-context regressions | Superseded values, evidence lineage, wrong-scope private meaning, and unavailable-detail gaps survive the tested projection behavior. | Any future selector may reduce breadth only while preserving these working distinctions. |
| MODEL-01 and MODEL-02 | Exact-slot unresolved conflict and forgetting/deletion are canonical modeling/lifecycle gaps. | Retrieval cannot repair them; they remain separate semantic-model work. |
| ADR 0006 dependency policy | Runtime dependencies must solve a concrete capability and justify their maintenance, security, and portability cost. | No new retrieval/storage dependency has earned that cost yet. |

The decisive negative evidence is the absence of a reproduced
`relevant_not_selected` condition. Every scenario-declared relevant meaning needed by
the representative cognition remains selected. The current pressure is therefore to
choose less from available state without losing governing meaning, not to find more
state through a richer retrieval representation.

## Current implementation boundary

The current implementation reinforces the failure classification rather than
contradicting it.

`src/core/projection.ts` validates canonical state and then iterates `state.meanings`
directly. For ordinary cognition it selects current facts and preferences in the
active scope, live commitments in that scope, and relationship meaning for the local
principal. The longitudinal ambient facts that reproduce SEL-01 satisfy those broad
membership predicates, so they are admitted even though the scenario oracle marks
them irrelevant to the present purpose.

`src/persistence/state-store.ts` reads the complete canonical document, validates it,
and returns the resulting state. The longitudinal restart scenarios demonstrate that
relevant state, provenance, currentness, and truthful gaps remain available after
persistence/reload. Nothing in the current failure corpus shows a relevant meaning
that exists canonically but cannot be located because the store lacks an index.

An index layered over the same predicates would still need a purpose-sensitive rule
to decide participation. Adding that index before the rule would increase mechanism
without addressing the demonstrated cause.

## Harm evaluation after the decision

Because #72 deliberately changes no selection behavior, the expected deterministic
harm result remains the #70 baseline:

- no reproduced relevant omission;
- potential inclusion harm from irrelevant same-scope meanings;
- `reduce` pressure across the representative longitudinal corpus;
- no new stale-value, forbidden-disclosure, provenance-collapse, or unavailable-gap
  regression introduced by #72, because the implementation is unchanged.

This issue therefore does not claim to have resolved SEL-01. It records that richer
retrieval/indexing is **not the smallest justified mechanism** for resolving it on the
present evidence.

## Revisit triggers

Reopen the representation question only when repository evidence demonstrates at
least one concrete pressure that the existing representation cannot satisfy cleanly,
for example:

1. a scenario-declared relevant permitted meaning is omitted because the selector
   cannot locate it at the required history size or latency;
2. a purpose-sensitive selector that otherwise satisfies SEL-01 requires an index to
   meet a measured operational constraint;
3. on-demand historical/provenance reconstruction becomes materially too expensive
   with the current representation and the cost is reproduced by the evaluation
   harness;
4. live-model or surface-specific evidence reveals a retrieval failure that remains
   after deterministic projection semantics are correct;
5. explicit forgetting/deletion semantics are designed and require a storage/index
   representation to enforce their lifecycle safely.

A future candidate must still be evaluated on both omission and inclusion harm. A
higher recall score, larger context window, or more fashionable storage layer is not
sufficient evidence by itself.

## Reproduction

The evidence supporting this decision is exercised by the existing deterministic
longitudinal suite, including:

```sh
node --test tests/longitudinal-memory-context.test.ts
node --test tests/longitudinal-currentness.test.ts
node --test tests/longitudinal-provenance.test.ts
node --test tests/longitudinal-degraded-context.test.ts
node --test tests/longitudinal-context-harm.test.ts
```

Documentation discovery for this note is validated by the repository's normal
`npm run check` / documentation-discovery checks.
