---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0028: Reintegrate specialist results through a currentness and provenance gate

Migration record from [source 1](../specialist-result-reintegration.md). This accepted ADR now owns the architectural decision; sources retain supporting
implementation details and dated evidence. Creation does not invent original approval attribution or decision dates.
The implementation plan describes existing behavior and ongoing constraints.

## Context and Problem Statement

Issue [#65](https://github.com/arhor/ember/issues/65) adds Ember-owned interpretation
after a final attributed specialist report. Runtime success does not establish truth,
present objective completion, current authority or safe effects. C17 records the gate
without introducing automatic canonical memory mutation or a second recovery model.

## Decision

Require final schema-valid report, report provenance and observed exit before
reintegration. Hold/reuse the canonical writer lease, reload state and reject stale
`ember_revision` before episode interpretation. The caller derives current objective,
context and authority meaning; numeric revision is concurrency evidence, not a
semantic substitute. Validate all corroborating records before mutating the primary.

Reuse existing objective/context currentness logic on an isolated candidate copy.
Compare launch objective/context revisions with the current checkpoint and objective
status; preserve stale/re-evaluation/cancelled history. Re-evaluate changed context
explicitly when warranted, without publishing a terminal disposition to the original
record before the whole audit decision is ready.

Classify report shape as complete, partial, failed or ambiguous-effect. Require current
attributable authority independently of launch authority. Without a reasoned Ember
semantic decision, withhold even current complete success. Full acceptance requires
complete result; partial/failed evidence may be qualified or rejected, not promoted
into completion. Possible unresolved effects stay withheld pending the existing
interruption-reconciliation boundary; explicit rejection does not erase effects.

Conserve evidence: attempts with the same disclosed context provenance/scope/currentness
and context revision form one correlated source group. More episode IDs are not
independent corroboration; distinct fingerprints do not establish statistical independence.
Authority provenance governs legitimate reliance, not factual support, and is excluded
from the evidence-correlation fingerprint. Include the primary episode and exactly
all considered unique attributable episodes in validated grouping.

Commit currentness, disposition and reintegration audit together in one primary-file
atomic replacement only after candidate validation. Re-read the original and abort if
changed before replacement; failure before rename leaves the original unchanged.
This optimistic check is not a shared interprocess lock for every specialist writer,
a filesystem compare-and-swap, or a cross-file transaction. Do not claim stronger
crash/durability guarantees than atomic episode publication supplies.

Audit decision ID/time, outcome, requested/resulting disposition, result shape/reason,
current canonical/objective/context/authority checkpoint, report provenance, correlated
source groups and canonical-mutation eligibility. `integrated` requires accepted or
qualified disposition under current authority and no ambiguous effects. Accepted
requires complete shape; rejected stays rejected; withheld cannot carry positive
terminal dispositions. Latest audit must match persisted report/currentness/disposition.
Contradictory syntactically valid records fail inspection after restart.

Only integrated decisions carry `eligible_after_agent_decision` and a decision ID for
a later existing canonical semantic operation to cite. Withheld/rejected are not
eligible. Reintegration itself creates no canonical meaning and grants no new outward
authority; downstream effect still needs current ADR-0004 checks. No generic vote,
confidence score, automatic memory ingestion or second currentness/recovery system.

## Consequences

- Historical specialist success can survive as evidence while present reliance is
  withheld, qualified, rejected or stale.
- Corroboration validation and atomic audit/disposition publication avoid a misleading
  accepted result without its supporting decision. Concurrency remains explicitly limited.
- Canonical mutation is a later separately validated operation, not a side effect of
  accepting specialist text or counting agreeing reports.

## Implementation Plan

- **Affected paths:** [reintegration gate](../../../packages/core/src/delegation/specialist-reintegration.ts),
  [currentness/recovery owner](../../../packages/core/src/delegation/codex-specialist.ts),
  [state lease](../../../packages/core/src/persistence/state-store.ts), and source reference.
- **Dependencies/configuration:** none; keep current audit/spec/record versions and
  canonical revision boundaries; no new transaction manager or automatic memory write.
- **Patterns to follow:** final provenance, lease-held current checkpoint, isolated
  candidate, shared currentness function, validated correlated evidence and one audit commit.
- **Patterns to avoid:** runtime success as acceptance, historical authority as current
  mandate, duplicate sources as corroboration, or optimistic check described as universal locking.
- **Migration:** architectural ownership is transferred here while retaining source
  checkpoint/outcome/audit schemas, inspection rules and deterministic cases. The source remains a supporting reference; no runtime/package edits are needed.

### Verification

- [x] `node --test packages/core/src/delegation/specialist-reintegration.test.ts`
      passes stale revision, absent decision, authority revocation, partial/failed/
      ambiguous results, evidence correlation, re-evaluation and contradictory-audit inspection.
- [x] Source review preserves all nine production steps, checkpoint fields, outcome
      matrix and durable audit consistency rules without adding canonical mutation.
- [x] Code inspection confirms optimistic original-file comparison plus atomic rename,
      not a universal specialist-record interprocess lock or cross-file transaction.

## Alternatives Considered

- Adopt successful reports immediately: low latency but loses current authority,
  objective/currentness, provenance and effect reconciliation gates.
- Count repeated attempts as votes: may look like corroboration while all derive from
  the same disclosed evidence. Preserve correlation and unestablished independence.
- Commit disposition before audit validation: simplifies staged writes but can publish
  unsupported acceptance after a failure. Build/validate one candidate and replace once.

## More Information

Constrained by accepted ADRs 0002, 0004 and 0005; see [the ADR index](README.md).
[Delegation ADR 0027](0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md)
retains execution/recovery ownership. Revisit if concurrency requirements exceed the
explicit optimistic boundary or a new semantic operation needs to cite this gate;
neither condition silently authorizes a new transaction/authority model.

### Migration verification — 2026-10-27

The combined targeted run passed all 98 deterministic tests across eight files:
capability execution, AI SDK capabilities, Calendar read/create, action-effects
evaluation, MCP, Codex specialist and reintegration. No live provider or real Calendar
service was invoked. A second source/code review checked the intended constraint
mapping, native template/metadata, numeric identities, source/index links and anchors.
These tests establish selected implementation traces, not universal semantic approval,
remote-effect, hostile-runtime or concurrency guarantees. The maintainer accepted this record on 2026-10-27; source ownership is now transferred.

### Phase acceptance — 2026-10-27

The maintainer approved M07, including qualification of the historical no-subordinate-
ADR wording in the specialist sources. This record owns its architectural decision;
existing source paths, headings, procedures, scenarios and evidence remain as supporting
references. Acceptance introduces no runtime, dependency, package or original-skill
change. Unrecorded historical approval dates and attribution remain unasserted.
