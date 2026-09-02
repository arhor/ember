---
summary: "Current issue-65 design for reintegrating Codex specialist results against current Ember state while preserving provenance, effect uncertainty, authority, and evidential correlation."
read_when:
  - "Changing how a specialist report is accepted, qualified, rejected, withheld, or allowed to influence canonical Ember meaning"
  - "Inspecting specialist currentness, authority, partial results, ambiguous effects, duplicate evidence, or reintegration decisions after restart"
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
correlated evidence, accompanied by unresolved external effects, or no longer
covered by current authority. Reintegration therefore belongs to Ember and happens
only after the specialist attempt has ended with a final attributed report.

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
2. **Check the present, not the launch snapshot.** The caller supplies a
   `SpecialistReintegrationCheckpoint` derived from current Ember state. It records
   the current canonical `ember_revision`, objective revision and lifecycle,
   relevant-context revision, plus an attributable current-authority assessment.
   The objective/context portion is passed through `reconcileSpecialistResult` and
   compared with the immutable launch basis. The launch authority record remains
   historical evidence; it cannot substitute for the current authority checkpoint.
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
6. **Respect authority and effect uncertainty.** Revoked, superseded, or uncertain
   current authority blocks positive integration even when the report itself is
   technically correct. `effects_possible` likewise blocks positive integration
   until the independent issue-63 recovery path reconciles the present external
   state. Ember may still reject a report while authority or effects are unresolved;
   rejection does not claim restored authority, non-effect, or rollback.
7. **Gate canonical mutation.** Reintegration never copies specialist claims into
   canonical meaning. The durable decision marks a canonical mutation only as
   `eligible_after_ember_decision`, with the reintegration decision ID that a later
   semantic mutation can cite. Withheld or rejected results remain `not_eligible`.

This is intentionally stricter than the adjacent one-shot `runCognition` path.
`runCognition` can reject a provider response when its optimistic canonical revision
changed. A specialist can outlive the initiating moment and may already have caused
external effects, so reintegration additionally preserves the exact current Ember
revision used for the decision, objective/context applicability, current authority,
provenance, partiality, effect state, and evidential correlation.

## Current reintegration checkpoint

The issue-65 checkpoint is an inspection record, not a new authority source:

| Field | Meaning |
| --- | --- |
| `ember_revision` | The canonical Ember state revision from which the reintegration assessment was derived |
| `objective_revision` | The current objective revision compared with the immutable launch basis |
| `context_revision` | The current relevant-context revision compared with the immutable launch basis |
| `objective_status` | Whether the delegated objective is still `current`, `superseded`, or `cancelled` |
| `authority.status` | Whether current attributable authority is `current`, `revoked`, `superseded`, or `uncertain` |
| `authority.provenance` | The current source Ember relied on to assess authority, retained for later explanation |
| `authority.reason` | Why that source is or is not presently applicable to reliance on the result |

`authority.provenance` is intentionally absent from the evidence-correlation
fingerprint. Authority governs legitimate reliance; it is not evidential support
for the specialist's factual claims and must not make two same-source attempts look
independent.

## Decision outcomes

| Condition | Reintegration outcome | Ember disposition / meaning |
| --- | --- | --- |
| Current, complete result; no semantic decision yet | `withheld` | Report remains attributable evidence; no canonical mutation is eligible |
| Current objective/context/authority, complete result; reasoned Ember acceptance | `integrated` | `accepted`; a later canonical mutation may cite the decision ID |
| Current authority revoked, superseded, or uncertain | `withheld` for positive reliance | The report remains evidence, but the old launch grant does not authorize present reliance |
| Current partial result; attempted full acceptance | `withheld` | Objective completion is not established |
| Current partial result; reasoned qualification | `integrated` | `qualified`; useful attributable remainder may be relied on within the qualification |
| Objective superseded or revision changed | `withheld` | `stale`; historical success survives without completing the current objective |
| Relevant context changed | `withheld` until re-evaluated | `requires_re_evaluation`; positive integration needs an explicit current-context reason |
| Objective cancelled/inapplicable | `rejected` | Report remains historical evidence with its provenance |
| Explicit Ember rejection | `rejected` | Rejection is semantic non-reliance and does not erase unresolved effects |
| Effects remain possible | `withheld` for positive reliance | Current effect reconciliation is required before integration |

`requested_disposition` and `resulting_disposition` are both recorded. This makes a
failed attempt to accept stale, partial, authority-invalid, or ambiguous evidence
inspectable rather than silently collapsing the attempted interpretation into the
final state.

For a positive current result, the final `accepted` or `qualified` disposition is
written through `reconcileSpecialistResult` itself. This preserves issue #62's
atomic final currentness-plus-disposition transition. The companion audit is then
appended only if the persisted disposition still matches the result being audited;
a competing disposition change fails instead of being overwritten.

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
    checkpoint:
      ember_revision
      objective_revision
      context_revision
      objective_status
      authority
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
- which canonical Ember revision, current objective/context checkpoint, and
  attributable authority assessment Ember evaluated;
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
current Ember revision + objective/context + authority
      |
      v
effect + provenance + correlation checks
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

- current success records the exact current Ember revision, remains withheld until
  a reasoned Ember decision, then becomes inspectably integrated;
- revoked current authority withholds otherwise-current technical success;
- stale technical success remains historical and does not complete the superseding
  objective;
- a partial blocked result cannot be promoted to full completion but can be
  explicitly qualified;
- an ambiguous-effect success remains withheld until the issue-63 reconciliation
  path establishes the relevant present state, while explicit rejection preserves
  effect ambiguity rather than claiming rollback;
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
