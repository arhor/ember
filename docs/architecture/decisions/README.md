---
summary: "Index and cross-ADR validation matrix for Ember's accepted representation-neutral semantic architecture decisions."
read_when:
  - "Checking which accepted semantic decisions constrain an architecture or implementation change"
  - "Validating restart, memory correction, delegation, authority, delivery, or recovery behavior across multiple ADRs"
role: guide
discovery_status: current
---

# Semantic Architecture Decisions

These ADRs form the stable semantic boundary between Ember's completed research
programme and later implementation architecture. They constrain what a future
representation must mean without selecting how it is represented.

| ID | Decision | Status |
|---|---|---|
| [0001](0001-continuity-belongs-to-ember.md) | Continuity Belongs to Ember, Not an Operational Locus | Accepted |
| [0002](0002-preserve-persistent-meaning.md) | Persistent Meaning Preserves Provenance, Scope, Currentness, and Lifecycle | Accepted |
| [0003](0003-use-least-sufficient-permitted-projections.md) | Cognition and Delegation Receive Least Sufficient Permitted Projections | Accepted |
| [0004](0004-separate-capability-from-authority.md) | Capability and Authority Are Independent, and Authority Cannot Self-Amplify | Accepted |
| [0005](0005-distinguish-operational-continuity.md) | Operational Continuity Distinguishes Work, Occurrence, Delivery, Effects, and Currentness | Accepted |

## Decision discipline

- These decisions preserve semantic invariants. They do not select a storage
  schema, prompt layout, runtime topology, protocol, or implementation language.
- A later representation may change without replacing an ADR when it preserves
  the decision's meaning and constraints.
- A later proposal that cannot preserve one of these decisions must explicitly
  supersede the affected ADR rather than violating it for convenience.
- Questions labelled unresolved remain open hypotheses. An accepted ADR must not
  be read as having resolved them indirectly.

## Cross-ADR validation matrix

The following cases are the mandatory validation set from
[issue #20](https://github.com/arhor/ember/issues/20). "Governing ADRs" identifies
the decisions that jointly constrain each case; it does not prescribe a mechanism.

| # | Case | Governing ADRs | Required semantic result |
|---|---|---|---|
| 1 | Restart after long inactivity | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0004](0004-separate-capability-from-authority.md), [0005](0005-distinguish-operational-continuity.md) | The recognised lineage may continue, but live commitments, authority, work, mutable premises, and the current cognitive projection are reconciled with the present. The inactive interval remains a truthful gap. |
| 2 | Model replacement with unchanged canonical state | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md) | The model remains a cognition provider rather than the identity owner. It receives the same governing meanings through an appropriate projection; preservation quality remains an empirical question. |
| 3 | Corrected or superseded memory | [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md) | The correction governs where current, while the older state can remain attributable history. Selection must not revive it as current merely because it is similar or recent. |
| 4 | Relationship information relevant to Ember but inappropriate for a delegate | [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0004](0004-separate-capability-from-authority.md) | Ember may use permitted relationship meaning privately. The delegate receives only a sufficient permitted projection or a truthful operational consequence, not the private source by default. |
| 5 | Specialist result arriving after the objective changed | [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0005](0005-distinguish-operational-continuity.md) | The specialist report remains attributable and may be a historical success for the old objective. It is checked against the current objective before reliance, action, or delivery. |
| 6 | Capability exists but authority is absent or stale | [0002](0002-preserve-persistent-meaning.md), [0004](0004-separate-capability-from-authority.md) | Outward action or disclosure does not occur merely because it is possible. A stale grant remains history; private preparation may continue only inside the live envelope. |
| 7 | Duplicate delivery of one occurrence | [0002](0002-preserve-persistent-meaning.md), [0004](0004-separate-capability-from-authority.md), [0005](0005-distinguish-operational-continuity.md) | One established occurrence produces neither duplicate instruction, evidence, authority, memory, nor effect. Identical content alone still cannot prove that two real occurrences are one. |
| 8 | Ambiguous timeout after a possible external side effect | [0002](0002-preserve-persistent-meaning.md), [0004](0004-separate-capability-from-authority.md), [0005](0005-distinguish-operational-continuity.md) | Effect uncertainty survives. Ember establishes present external state to the degree warranted before a consequential retry and does not treat failure or cancellation as rollback. |
| 9 | A session ends while work remains live | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0005](0005-distinguish-operational-continuity.md) | Work continues to exist while its purpose remains live. Its objective, constraints, delegation boundary, authority provenance, effects, and uncertainty remain recoverable independently of the session. |
| 10 | Recovery with a genuine information gap | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0005](0005-distinguish-operational-continuity.md) | Recovery constructs the strongest justified present from surviving evidence and observation, explicitly preserves the gap, and never invents a seamless bridge. |

The set is internally consistent across all ten cases. The decisions deliberately
leave representation, policy thresholds, and failure-recovery mechanisms open.
[Issue #21](https://github.com/arhor/ember/issues/21) tracks the broader reusable
acceptance catalogue for evaluating those later choices.
