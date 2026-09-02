---
summary: "Current issue-65 design for reintegrating Codex specialist results against current Ember state while preserving provenance, effect uncertainty, authority, evidential correlation, and crash-consistent inspection."
read_when:
  - "Changing how a specialist report is accepted, qualified, rejected, withheld, or allowed to influence canonical Ember meaning"
  - "Inspecting specialist currentness, authority, partial or failed results, ambiguous effects, duplicate evidence, or reintegration decisions after restart"
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
Technical success does not by itself establish truth, current applicability,
authority, completion, or safe external effects. Reintegration therefore belongs
to Ember and occurs only after a final attributed specialist report exists.

The governing constraints remain [ADR 0002](decisions/0002-preserve-persistent-meaning.md),
[ADR 0004](decisions/0004-separate-capability-from-authority.md),
[ADR 0005](decisions/0005-distinguish-operational-continuity.md), and the
[delegation acceptance scenarios](acceptance-scenarios.md#delegation-and-responsibility).

## Production decision path

`src/delegation/specialist-reintegration.ts` layers the issue-65 decision over the
existing version-3 specialist episode record:

1. **Hold the current canonical revision.** The caller supplies a `StateStore` and
   `SpecialistReintegrationCheckpoint`. Reintegration acquires or reuses the
   StateStore writer lease, reloads canonical state, and rejects a stale
   `ember_revision` before specialist interpretation begins.
2. **Require attributed evidence.** The episode must have an observed exit plus a
   final schema-valid report and `report_provenance`.
3. **Validate corroborating evidence before commitment.** Supporting specialist
   attempts are loaded and validated before any mutation of the primary episode.
4. **Reuse issue-62 currentness semantics on an isolated candidate record.** The
   existing `reconcileSpecialistResult` implementation evaluates objective and
   context currentness against a temporary candidate copy of the episode. It may
   also resolve changed-context re-evaluation there. The canonical episode file is
   still untouched at this point.
5. **Interpret result shape and present authority.** Ember classifies the returned
   evidence as `complete`, `partial`, `failed`, or `ambiguous_effect`, and separately
   checks the current attributable authority checkpoint.
6. **Conserve evidence.** Attempts derived from the same disclosed context
   provenance, scope, currentness, and context revision remain one correlated source
   group. Multiple episode IDs never manufacture independent corroboration.
7. **Require an Ember-owned semantic decision.** A current report without such a
   decision is withheld. `accepted` requires a complete result. Partial or failed
   evidence may not be promoted into full completion; useful evidence may instead
   be qualified or rejected.
8. **Commit currentness, disposition, and audit together.** After the decision is
   complete in the isolated candidate, Ember appends the issue-65 audit and replaces
   the primary episode with one atomic rename. A failure before that rename leaves
   the original episode unchanged. Reintegration also re-reads the original before
   replacement and aborts if another writer changed it meanwhile.
9. **Gate later canonical mutation.** Only an `integrated` audit decision carries
   `canonical_mutation.eligibility = eligible_after_ember_decision`. Withheld and
   rejected results are always `not_eligible`.

This keeps issue #62 as the single implementation of specialist objective/context
currentness while making the larger issue-65 transition crash-consistent. There is
no interval in which a terminal specialist disposition has been committed to the
primary episode but the reintegration audit has not.

## Current checkpoint

| Field | Meaning |
| --- | --- |
| `ember_revision` | Exact canonical Ember revision against which the decision was derived and held stable |
| `objective_revision` | Current objective revision compared with the delegation-start basis |
| `context_revision` | Current relevant-context revision compared with the delegation-start basis |
| `objective_status` | `current`, `superseded`, or `cancelled` |
| `authority.status` | `current`, `revoked`, `superseded`, or `uncertain` |
| `authority.provenance` | Attributable source used for the current authority assessment |
| `authority.reason` | Why that authority assessment applies |

The numeric Ember revision is a concurrency boundary, not a substitute for semantic
assessment. The caller remains responsible for deriving objective, context, and
authority meaning from current canonical state.

Authority provenance is deliberately absent from the evidence-correlation
fingerprint. Authority controls legitimate reliance; it is not factual support for
the specialist claim.

## Decision outcomes

| Condition | Outcome | Meaning |
| --- | --- | --- |
| Canonical `ember_revision` already changed | no decision persisted | Caller must rebuild the checkpoint |
| Current complete result, no Ember decision | `withheld` | Attributed evidence only |
| Current complete result, reasoned acceptance | `integrated` | `accepted`; later canonical mutation may cite the decision ID |
| Current non-complete result, attempted acceptance | `withheld` | Completion is not established |
| Current partial or failed evidence, reasoned qualification | `integrated` | `qualified`; reliance is limited to the qualification |
| Current authority revoked, superseded, or uncertain | `withheld` | Historical launch authority does not authorize present reliance |
| Objective superseded or revision changed | `withheld` | `stale`; historical result survives without completing the current objective |
| Relevant context changed | `withheld` until re-evaluated | `requires_re_evaluation` |
| Objective cancelled/inapplicable | `rejected` | Report remains historical evidence |
| Explicit Ember rejection | `rejected` | Semantic non-reliance; unresolved effects are not erased |
| Effects remain possible | `withheld` | Issue-63 recovery must establish the relevant present state first |

## Durable audit and validation

Each committed decision appends:

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

`inspectSpecialistReintegration(recordPath)` validates the audit before returning it.
Validation covers both field shape and semantic relationships, including:

- the latest audited disposition must equal the persisted specialist disposition;
- latest report provenance and currentness checkpoint must match the episode;
- `eligible_after_ember_decision` is valid only for `integrated` decisions;
- `integrated` decisions must result in `accepted` or `qualified` under current
  authority and without ambiguous effects;
- `accepted` is valid only for `complete` results;
- `rejected` decisions must result in `rejected`;
- withheld decisions may not carry terminal positive dispositions;
- corroboration groups must contain unique attributable episode IDs and must cover
  exactly the considered episode set; and
- the primary episode must always be part of the considered evidence.

Therefore a syntactically valid but contradictory durable JSON object such as
`outcome: withheld` together with
`canonical_mutation.eligibility: eligible_after_ember_decision` is rejected during
inspection rather than becoming a trusted canonical-mutation gate after restart.

## Canonical mutation boundary

Issue #65 does not introduce a new canonical-memory mutation. It establishes the
gate that a future existing semantic operation must cite:

```text
specialist report
      |
      v
live Ember revision + objective/context + current authority
      |
      v
provenance + effect + correlation checks
      |
      v
Ember-owned semantic decision
      |
      v
atomic episode disposition + reintegration audit
      |
      v
eligible_after_ember_decision + decision_id
      |
      v
later canonical semantic operation may rely on that decision
```

The specialist report itself, runtime success, number of agreeing attempts,
filesystem reach, and historical authority are never such a citation. Any later
outward action still requires its own current ADR-0004 authority check.

## Deterministic acceptance coverage

`src/delegation/specialist-reintegration.test.ts` covers:

- stale canonical Ember revision with no episode mutation;
- current success withheld until a reasoned Ember acceptance;
- revoked current authority;
- stale successful output;
- partial output blocked from full acceptance but allowed to be qualified;
- failed output blocked from full acceptance;
- ambiguous effects withheld until independent issue-63 reconciliation;
- explicit rejection without pretending effects were rolled back;
- invalid corroborating evidence failing before any terminal disposition or audit is
  committed;
- same-evidence attempts remaining one correlated source group;
- changed-context re-evaluation; and
- post-restart inspection rejecting a contradictory canonical-mutation gate.

The normal specialist tests continue to own runtime execution, cancellation,
currentness mechanics, and effect-recovery behavior. Issue #65 composes those facts
into one inspectable Ember-owned reintegration decision.

## Non-goals

This slice intentionally does not add a generic voting/confidence system, claim
statistical independence from different fingerprints, create canonical memory from
specialist text automatically, grant new authority, or introduce a second recovery
or currentness model.
