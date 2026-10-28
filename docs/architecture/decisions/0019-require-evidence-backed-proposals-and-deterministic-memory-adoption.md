---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0019: Require evidence-backed proposals and deterministic memory adoption

Accepted migration record from the original source (consolidated into this ADR; original source in Git history). This ADR owns the architectural decision; the source retains
detailed implementation references and dated evidence. The record documents existing choices and
constraints; no unrecorded historical approval date or alternatives meeting is claimed.

## Context and Problem Statement

Issues [#221](https://github.com/arhor/ember/issues/221) and
[#222](https://github.com/arhor/ember/issues/222), under epic #220, need ordinary
interaction to yield inspectable memory without making transcript retention or model
assertion canonical truth. This C08 migration extracts the existing proposal and
bounded v1 adoption policy. It introduces no broader significance, authority, or
commitment-creation policy.

## Decision

Keep four explicit stages: durable evidence, non-canonical proposal, deterministic
adoption policy, and canonical commit. `assessMemoryProposal` is read-only; valid
assessment creates a `proposed` record with no resolution and never mutates meaning.
`resolveMemoryProposal` revalidates against an explicit expected canonical revision
and returns a replacement state. The caller commits through the matching optimistic
revision boundary under the canonical writer lease.

A version-1 candidate carries proposal identity/time, family, owner, semantic slot,
scope/content, unique durable evidence IDs, epistemic role, applicability, currentness,
separate source/proposition/interpretation confidence, uncertainty, and optional
supersession target. Confidence is qualitative (`high`, `medium`, `low`,
`not_applicable`), not calibrated truth or authority. Null uncertainty is an absent
qualification, not certainty; repeated evidence IDs are invalid, not corroboration.

Support `fact`, `preference`, `relationship`, and `episode_meta`. Facts retain the
owner/provenance required by testimony, inference, observation, external claim, or
delegated report. Preferences require current user ownership and user testimony;
relationship requires current relationship ownership, the relationship slot, and user
testimony; episode meta requires Ember/current relationship ownership and user testimony
in v1. Fact/preference applicability ends remain null. Unknown kinds are invalid;
commitment candidates are explicitly unsupported because undertaking must remain a
deliberate Ember-owned normative boundary.

Every evidence ID resolves to current durable evidence in the same scope. Unavailable
user detail cannot ground content. Each cited item must match the proposed epistemic
role; external/delegated source actors match the owner. Inference cites its durable
roots rather than relabeling those roots as testimony; adoption creates one distinct
Ember-inference evidence occurrence derived from the roots and cites it. Traceability
alone does not prove truth, significance, currentness, or suitability for adoption.

Reject with inspectable reasons for stale revision, no-longer-valid proposal, any low
confidence dimension, duplicate current meaning, implicit same-slot conflict, stale or
invalid supersession, or deterministic ID collision. Identical content named as a
supersession target cannot manufacture a correction. IDs derive deterministically
from lineage/revision, proposal identity/time, decision time, and ID role; identical
inputs produce identical outcomes without input mutation.

Only current user-owned user-testimony facts/preferences can be superseded, with exact
kind/owner/slot/scope equality. Install predecessor/successor links and new meaning
atomically in one replacement candidate; retain old evidence/meaning as history.
Relationship/episode-meta supersession and commitment changes remain unsupported here.

`proposed`, `adopted`, and `rejected` are proposal lifecycle states; adoption records
the new canonical meaning ID and decision time, rejection records reason/time.
Invalid and unsupported assessments establish no valid proposal lifecycle.

## Consequences

- Proposal validity, acceptance, and persistence remain separately inspectable.
- Conservative v1 restrictions reject potentially useful candidates; expanding families,
  confidence policy, or correction paths requires explicit semantics and tests.
- Callers must handle revision conflicts and commit failure; model output cannot bypass
  the policy or mutate canonical meaning directly.

## Implementation Plan

- **Affected paths:** [proposal contract/policy](../../../packages/core/src/memory-proposal.ts),
  [canonical store](../../../packages/core/src/persistence/state-store.ts), and retained
  source reference. Existing behavior is implemented; this is documentation extraction.
- **Dependencies/configuration:** none added/updated; no new schema or confidence policy.
- **Patterns to follow:** unknown input, read-only assessment, deterministic replacement,
  explicit expected revision, validated commit, reciprocal supersession.
- **Patterns to avoid:** transcript-as-memory, implicit correction, duplicate evidence
  treated as corroboration, or automatic commitment creation.
- **Migration:** architectural ownership is transferred to this ADR; retain exact
  candidate fields, reason taxonomy, and examples in the source. It remains a supporting reference.

### Verification

- [x] `node --test packages/core/src/memory-proposal.test.ts` passes assessment,
      provenance, family/applicability, confidence, deterministic adoption, and correction cases.
- [x] Source review preserves v1 family/provenance restrictions and truthful lifecycle.
- [x] No canonical policy, runtime code, package, or original ADR skill change occurs.

## Alternatives Considered

- Directly adopt model assertions or retained transcript: simple ingestion but lacks
  independent provenance, ownership, currentness, and deliberate undertaking gates.
- Let content similarity implicitly correct current memory: convenient deduplication
  but loses explicit stable identity and reciprocal supersession. Require explicit targets.

## More Information

Subordinate to [ADR 0002](0002-preserve-persistent-meaning.md),
[ADR 0003](0003-use-least-sufficient-permitted-projections.md), and
[ADR 0004](0004-separate-capability-from-authority.md).
Revisit v1 policy only when observed rejected cases justify a separately validated
extension; evidence confidence alone cannot grant outward authority.

### Migration verification — 2026-10-27

All 97 targeted deterministic tests across eleven files passed for the unchanged
implementation. A second source/contract review checked family/provenance limits,
partial adoption, conversation membership/migration, representation fidelity/editing,
and snapshot/lease uncertainty across this batch. Native metadata/template sections,
index/source traceability, and local links/anchors were audited. No live provider,
new dependency, runtime behavior change, or acceptance is inferred from these tests.
The maintainer accepted this record in the M06 phase review on 2026-10-27.

### Phase acceptance — 2026-10-27

The maintainer approved M06, including the ADR 0020 source-wording correction.
This ADR now owns its architectural decision. Source paths, headings, detailed
procedures, scenarios, and evidence remain available as supporting references.
The implementation plan describes existing behavior and ongoing constraints; no
package, runtime, dependency, or original skill change is introduced by acceptance.
Original approval attribution absent from historical sources remains unasserted.
