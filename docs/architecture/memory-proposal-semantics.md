---
summary: "Issue #221 SDK-independent contract for evidence-grounded memory proposals, supported meaning families, semantic metadata, invalid states, and non-canonical lifecycle."
read_when:
  - "Adding or changing proposals that may become durable Ember memory"
  - "Implementing memory adoption, rejection, supersession, or model-backed proposal generation"
  - "Deciding which conversation-derived claims may enter the canonical meaning boundary"
role: design
discovery_status: current
---

# Memory Proposal Semantics and Evidence Requirements

> Status: current implementation boundary for issue #221 and the first child of
> epic #220.

## Purpose and boundary

Ordinary interaction can contain material worth remembering, but neither transcript
retention nor a model assertion is canonical meaning. Ember therefore separates three
boundaries:

```text
durable evidence -> proposed memory -> deterministic adoption policy -> canonical meaning
```

This document and `src/core/memory-proposal.ts` define the first arrow and the proposal
lifecycle. Issue #222 owns adoption policy. Issue #223 may later use structured AI SDK
output to produce candidate syntax, but provider and SDK types do not participate in
this contract.

Assessing a candidate is read-only. A valid assessment produces a proposal whose
status is `proposed`; it does not append to `EmberState.meanings`, supersede an existing
meaning, or otherwise mutate canonical state.

## Proposal representation

A version-1 proposal identifies:

- its own proposal ID and proposal time;
- one proposed canonical meaning family, owner, semantic slot, scope, and content;
- one or more unique IDs resolving to durable Ember evidence in the same scope;
- the proposed epistemic role and applicability interval;
- explicit proposed currentness;
- separate source, proposition, and interpretation confidence dimensions;
- a nullable uncertainty explanation; and
- a nullable supersession target where that family supports supersession.

Confidence uses qualitative values (`high`, `medium`, `low`, or `not_applicable`). It
is proposal metadata for later policy, not permission, calibrated probability, or an
increase in the weight of its evidence. Multiple references to the same evidence are
rejected rather than counted as corroboration.

`uncertainty: null` explicitly says that the proposer supplied no uncertainty
qualification. It does not assert certainty.

## Supported proposal kinds

The currently proposable canonical families are:

| Kind           | Required ownership/provenance                                                                                              | Supersession                                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `fact`         | Owner must agree with user testimony, Ember inference/direct observation, external claim, or delegated report attribution. | Only a user-owned user-testimony fact may target a current user-testimony fact in the exact same owner/slot/scope. |
| `preference`   | Current user ownership and durable user testimony.                                                                         | May target a current preference in the exact same owner/slot/scope.                                                |
| `relationship` | Current relationship ownership, fixed `relationship` slot, and durable user testimony.                                     | Unsupported in v1.                                                                                                 |
| `episode_meta` | Ember or current relationship ownership and durable user testimony in v1.                                                  | Unsupported in v1.                                                                                                 |

`commitment` is an explicit `unsupported` assessment. A statement in conversation may
be evidence relevant to an undertaking, but it cannot manufacture an Ember-owned
normative commitment. The existing undertaking/authority boundary must create such a
commitment deliberately.

Unknown kinds are invalid rather than treated as an extension point.

## Evidence and provenance requirements

Every source evidence ID must resolve in the current durable `EmberState.evidence`
collection. Free-floating text, provider metadata, conversation/session IDs, or an
unpersisted transcript fragment cannot ground a proposal.

All grounding evidence must share the proposed scope. Unavailable user detail cannot
ground a content-bearing proposal: its surviving ID preserves a truthful gap, not the
forgotten payload or authority to reconstruct it.

Every cited item must retain the proposed epistemic distinction: user testimony
requires only user-command evidence, direct observations require only
Ember-observation evidence, and external/delegated evidence must additionally have a
source actor matching the proposed owner. An Ember inference is the deliberate
exception: a proposal cites its underlying durable roots, while later adoption would
have to create the Ember-inference evidence required by the canonical meaning model.
It may not relabel those roots as user testimony.

These checks establish traceability, not truth. Evidence-grounded proposals can still
be stale, conflicting, over-broad, insufficiently significant, or too uncertain to
adopt. Those are adoption-policy questions for issue #222.

## Lifecycle and truthful failure states

The contract distinguishes:

- `proposed`: validated candidate, still non-canonical, with no resolution;
- `adopted`: later policy accepted it and records the resulting canonical meaning ID;
- `rejected`: later policy declined it and records a reason;
- `invalid`: candidate representation, evidence, attribution, scope, or supersession
  violates this contract; and
- `unsupported`: the candidate asks for a known semantic family that this proposal
  boundary deliberately cannot create.

Invalid and unsupported assessments are not proposal lifecycle transitions: no valid
proposal was established. Adoption and rejection records carry decision time, and an
adopted record carries the new meaning ID. The transition mechanics and canonical
mutation are deliberately deferred to issue #222.

## Supersession constraints

A supersession proposal and its target must both be user-owned user testimony, because
that is the only correction path supported by the canonical v1 model. The target must
exist, remain current, and occupy the exact same kind/owner/slot/scope. The proposal
does not itself change either meaning. This prevents a generated candidate from
silently retiring unrelated, already historical, inferred, observed, external, or
delegated state.

Relationship and episode-meta supersession remain unsupported because the canonical
v1 meaning model does not support those transitions. Commitment lifecycle changes use
their existing explicit transition boundary rather than memory proposal supersession.

## Deterministic coverage

`src/core/memory-proposal.test.ts` covers non-mutating valid assessment, missing and
duplicate evidence, cross-scope evidence, unsupported commitment formation, exact-slot
supersession, unknown fields, and unknown kinds. Type tests keep proposed, adopted, and
rejected lifecycle records distinct.

## Traceability

This boundary applies the memory research distinction between retention and
remembering, preserves ADR 0002's provenance/scope/currentness/lifecycle requirements,
and maintains ADR 0004's separation of evidence or model confidence from authority.
It implements issue #221 without pre-implementing epic #220's later generation,
adoption-policy, or longitudinal-evaluation children.
