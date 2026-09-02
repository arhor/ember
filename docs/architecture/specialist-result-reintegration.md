---
summary: "Current issue-65 design for reintegrating Codex specialist results against current Ember state while preserving provenance, effect uncertainty, and evidential correlation."
read_when:
  - "Changing how a specialist report is accepted, qualified, rejected, withheld, or allowed to influence canonical Ember meaning"
  - "Inspecting specialist currentness, partial results, ambiguous effects, duplicate evidence, or reintegration decisions after restart"
  - "Reviewing AS-DEL-00, AS-DEL-02, AS-DEL-03, or AS-DEL-06 against the production specialist boundary"
role: design
discovery_status: current
---

# Specialist Result Reintegration

> Status: current companion design for issue #65. This note completes the final
> semantic step of the [minimal Codex specialist-delegation boundary](minimal-codex-specialist-delegation.md)
> without replacing its runtime, authority, currentness, or recovery models.

## Purpose

A Codex report is durable specialist evidence, not a canonical state mutation.
Even a technically successful report can be stale, only partially useful, based on
correlated evidence, or accompanied by unresolved external effects. Reintegration
therefore belongs to Ember and happens only after the specialist attempt has ended
with a final attributed report.

The governing constraints remain [ADR 0002](decisions/0002-preserve-persistent-meaning.md),
[ADR 0004](decisions/0004-separate-capability-from-authority.md),
[ADR 0005](decisions/0005-distinguish-operational-continuity.md), and the
[delegation acceptance scenarios](acceptance-scenarios.md#delegation-and-responsibility).
The production representation below is deliberately local to the first Codex
boundary. It does not introduce a generic agent result protocol or a second
canonical-state model.

## Production decision path

`src/delegation/specialist-reintegration.ts` layers one explicit semantic decision
path over the existing episode record and issue-62 currentness checkpoint:

1. **Require attributed result evidence.** Reintegration starts only after an
   observed specialist exit and a schema-valid final report with
   `report_provenance`. The report remains Codex-owned evidence throughout the
   decision.
2. **Check the present, not the launch snapshot.** The path calls
   `reconcileSpecialistResult` with a current checkpoint containing objective
   revision, relevant-context revision, and objective lifecycle. The immutable
   launch basis remains historical input to that comparison.
3. **Classify what actually returned.** The existing durable report/effect fields
   are interpreted as `complete`, `partial`, `failed`, or `ambiguous_effect` for
   the reintegration decision. This does not modify the Codex report contract.
4. **Conserve evidence.** Optional corroborating specialist records are grouped by
   a fingerprint of their disclosed context provenance, scope, currentness, and
   context revision. Repeated attempts from the same derivation basis remain one
   correlated source group. The implementation never asserts independence merely
   because multiple episode IDs exist.
5. **Require an Ember-owned semantic decision.** A current report with no Ember
   decision is `withheld`. Positive integration requires an explicit reasoned
   `accepted` or `qualified` decision. A partial result cannot establish full
   completion through `accepted`; Ember may instead qualify the useful remainder
   or reject it.
6. **Respect effect uncertainty.** `effects_possible` blocks positive integration
   until the independent issue-63 recovery path reconciles the present external
   state. Ember may still reject a report while effects remain unresolved; rejection
   does not claim non-effect or rollback.
7. **Gate canonical mutation.** Reintegration never copies specialist claims into
   canonical meaning. The durable decision marks a canonical mutation only as
   `eligible_after_ember_decision`, with the reintegration decision ID that a later
   semantic mutation can cite. Withheld or rejected results remain `not_eligible`.

This is intentionally stricter than the adjacent one-shot `runCognition` path.
`runCognition` can reject a provider response when its optimistic canonical revision
changed. A specialist can outlive the initiating moment and may already have caused
external effects, so reintegration additionally preserves applicability,
provenance, partiality, effect state, and evidential correlation.

## Decision outcomes

| Condition | Reintegration outcome | Ember disposition / meaning |
| --- | --- | --- |
| Current, complete result; no semantic decision yet | `withheld` | Report remains attributable evidence; no canonical mutation is eligible |
| Current, complete result; reasoned Ember acceptance | `integrated` | `accepted`; a later canonical mutation may cite the decision ID |
| Current partial result; attempted full acceptance | `withheld` | Objective completion is not established |
| Current partial result; reasoned qualification | `integrated` | `qualified`; useful attributable remainder may be relied on within the qualification |
| Objective superseded or revision changed | `withheld` | `stale`; historical success survives without completing the current objective |
| Relevant context changed | `withheld` until re-evaluated | `requires_re_evaluation`; positive integration needs an explicit current-context reason |
| Objective cancelled/inapplicable | `rejected` | Report remains historical evidence with its provenance |
| Explicit Ember rejection | `rejected` | Rejection is semantic non-reliance and does not erase unresolved effects |
| Effects remain possible | `withheld` for positive reliance | Current effect reconciliation is required before integration |

`requested_disposition` and `resulting_disposition` are both recorded. This makes a
failed attempt to accept stale, partial, or ambiguous evidence inspectable rather
than silently collapsing the attempted interpretation into the final state.

## Durable inspection after restart

Reintegration appends an issue-65 audit object to the same durable specialist record:

```text
reintegration:
  audit_version: 1
  history[]:
    decision_id
    decided_at
    outcome
    requested_disposition
    resulting_disposition
    result_shape
    reason
    checkpoint
    report_provenance
    corroboration
    canonical_mutation
```

`inspectSpecialistReintegration(recordPath)` returns the normal validated specialist
record plus this audit and its latest decision. The existing
`inspectSpecialistEpisode` remains valid because the version-3 specialist record
validator deliberately validates the owned fields without interpreting the
issue-65 companion audit. The audit therefore survives restart without turning
reintegration metadata into specialist-owned report content.

The audit answers the questions needed for post-restart explanation:

- which exact specialist episode supplied the report;
- which current objective/context checkpoint Ember evaluated;
- whether the returned evidence was complete, partial, or effect-ambiguous;
- which other specialist attempts were considered and which shared one evidence
  basis;
- whether Ember integrated, withheld, or rejected the result, and why; and
- whether a later canonical mutation is eligible and which Ember decision must be
  cited for that eligibility.

A `basis_fingerprint` is a local correlation aid, not an epistemic proof. Different
fingerprints do not establish independent witnesses. Model, tool, assumption, and
observation overlap can still correlate failures, so the audit records
`independence: not_established` rather than manufacturing confidence.

## Canonical mutation boundary

Issue #65 deliberately does not add a new canonical-memory mutation just to prove
reintegration. That would couple specialist transport to unrelated meaning types.
Instead, the reintegration audit exposes a narrow gate:

```text
specialist report
      |
      v
currentness + effect + provenance + correlation checks
      |
      v
Ember semantic decision with reason
      |
      v
canonical_mutation.eligibility = eligible_after_ember_decision
canonical_mutation.decision_id = reintegration-...
      |
      v
later existing semantic operation may cite that Ember decision
```

The specialist report itself is never such a citation. Runtime success, number of
agreeing attempts, filesystem reach, and previous authority likewise cannot create
canonical authority. A downstream outward action still requires its own current
[ADR-0004](decisions/0004-separate-capability-from-authority.md) authority check.

## Deterministic acceptance coverage

`src/delegation/specialist-reintegration.test.ts` exercises the final boundary with
persisted version-3 episode fixtures:

- current success remains withheld until a reasoned Ember decision, then becomes
  inspectably integrated;
- stale technical success remains historical and does not complete the superseding
  objective;
- a partial blocked result cannot be promoted to full completion but can be
  explicitly qualified;
- an ambiguous-effect success remains withheld until the issue-63 reconciliation
  path establishes the relevant present state;
- two specialist attempts derived from the same context evidence remain one source
  group rather than two independent corroborations; and
- changed relevant context requires a separate current-context semantic
  re-evaluation before positive integration.

The normal specialist process tests continue to own runtime, cancellation,
currentness, and recovery mechanics. Issue #65 reuses those durable facts rather
than constructing a parallel state machine.

## Non-goals and limits

This slice intentionally does not add:

- a generic multi-specialist voting or confidence system;
- a claim that different evidence fingerprints prove statistical independence;
- automatic canonical memory creation from specialist text;
- automatic retry after rejected, stale, partial, or ambiguous results;
- a new authority grant for downstream action; or
- a second representation for cancellation, recovery, or currentness.

Future canonical specialist-derived beliefs can reuse the existing Ember semantic
operations when a concrete product path needs them. The important invariant earned
here is that such a mutation must be downstream of an inspectable Ember-owned
reintegration decision, never downstream of specialist completion alone.
