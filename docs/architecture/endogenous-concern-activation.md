---
summary: "Current issue #76 design for reactivating durable live commitments from topic-free cognition opportunities without storing dormancy as a second lifecycle or injecting scheduler topics."
read_when:
  - "Implementing or reviewing dormant concern activation from cognition opportunities"
  - "Changing commitment discharge, endogenous relevance scenarios, or concern projection semantics"
  - "Explaining why a live concern did or did not participate in an endogenous decision"
role: design
discovery_status: current
---

# Endogenous Concern Activation

> Status: current implementation/evaluation design for issue #76, layered on the
> [endogenous cognition decision boundary](endogenous-cognition-decision.md) and
> [first-class silence lifecycle](endogenous-silence-lifecycle.md).

## Decision

Issue #76 does **not** introduce a new `Concern` meaning or a persistent `dormant`
status. The existing Ember-owned `commitment` is sufficient for the first continuing
concern scenarios.

A live commitment may be cognitively dormant across arbitrarily many opportunities.
Dormancy means only that the current opportunity did not select it as grounding for
`cognition` or `defer`; it is not a second canonical lifecycle state.

This keeps two questions separate:

- **Does the responsibility still exist?** `current + live` commitment lifecycle.
- **Does it deserve cognition now?** opportunity decision and selected grounding IDs.

## Topic-free activation

The wake-up mechanism remains one of the coarse issue-73 mechanisms and contains no
concern identifier, reminder text, query, or desired conclusion. The evaluator sees
the normal bounded projection only.

Controlled issue-76 scenarios use the same `foreground_probe` and the same evaluator:

| Durable state | Expected decision |
| --- | --- |
| no concern | `no_cognition` |
| live commitment with no current consequence making it relevant | `no_cognition`; commitment is projected but unselected |
| same live commitment plus a current durable consequence | `cognition`; commitment and consequence are selected grounding meanings |
| same consequence after the commitment is fulfilled | `no_cognition`; historical commitment is not in ordinary projection |

The topic therefore comes from the continuing commitment plus present Ember-owned
state, not from the opportunity mechanism.

## Dormancy is non-mutation

An irrelevant live commitment remains `current + live`. Repeated opportunities may
continue to project it and choose `no_cognition` without changing the commitment,
creating a fake motive, or accumulating an activation state machine.

This follows the research distinction between motivational currentness and current
participation in cognition: a concern can remain live while being cognitively dormant.
Later false-positive/resource evaluation may earn stronger attention controls, but
issue #76 does not introduce a motivational score, priority queue, `revisit_at`, or
cron hint.

## Minimal commitment discharge

The previous v1 validator intentionally rejected commitment discharge without a named
transition. Issue #76 implements the smallest transition required to prevent stale
concerns from reactivating forever:

```text
current + live
   |\
   | +--> historical + cancelled
   +----> historical + fulfilled
```

`transitionCommitment` requires a non-empty attributable user occurrence in the same
scope. That occurrence is appended to the commitment's provenance and establishes
`applicable_until`; the original Ember adoption evidence remains intact. The
transition therefore changes current normative force without erasing that Ember once
undertook the commitment.

This issue supersedes only the earlier statement in
[minimal-continuity-slice.md](minimal-continuity-slice.md) that named commitment
discharge was deferred from schema v1. That statement described the narrower slice
before endogenous concern activation required a concrete transition. The rest of the
minimal continuity design remains current.

This initial transition seam is deliberately narrow. It does not claim that future
commitment discharge must always originate in a user command. Direct observation,
specialist evidence, renegotiation, expiry, or richer concern types should be added
only when a concrete scenario requires them.

## Projection and inspection

Ordinary projection includes a commitment only when all are true:

- `kind === commitment`;
- `currentness === current`;
- `prospective_lifecycle === live`; and
- scope matches the active cognition scope.

Explicit explanation may still reconstruct a historical fulfilled/cancelled
commitment and its provenance. `inspectionView()` exposes live commitments separately
from closed commitments, while opportunity records retain the projected and selected
meaning IDs that explain activation or non-activation without raw model reasoning.

## Boundaries

- #77 must prove that the same live/closed distinction survives a complete process
  restart and fresh provider thread.
- #78 decides whether internal cognition should interrupt the user.
- #79/#95 evaluate false-positive/resource pressure before introducing stronger
  attention controls.
- #51/#80/#81 own runtime scheduling/topology only after behavioral evidence earns
  those choices.

## Definition-of-done mapping

| Issue #76 requirement | Implemented evidence |
| --- | --- |
| Dormant concerns may deserve renewed attention | Same evaluator activates a live commitment only when current consequence state makes it relevant. |
| Wake-up does not name concern | All controls use the same `foreground_probe`; mechanism never reaches evaluator request. |
| Relevant concern surfaces from durable state | Commitment and current consequence are selected from normal projection. |
| Dormant state does not force repeated cognition | Repeated irrelevant opportunities return `no_cognition` while the commitment and state remain unchanged. |
| Resolved concerns do not reactivate | Fulfilled/cancelled commitments become historical and are excluded from ordinary projection. |
| Behavior is explainable | Commitment provenance plus projected/selected opportunity IDs distinguish available, activated, dormant, and closed state. |
| New durable representation preserves provenance/currentness | No concern type is added; commitment discharge retains adoption evidence and adds attributable transition evidence plus applicability end. |
