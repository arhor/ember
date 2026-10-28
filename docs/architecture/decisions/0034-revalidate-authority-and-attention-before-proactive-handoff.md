---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0034: Revalidate authority and attention before proactive handoff

Migration record from [proactive-contact-attention-policy](../proactive-contact-attention-policy.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issue #227 needs a surface-neutral current policy gate for a durable pending/deferred
intent; #228 composes it with durable handoff. C23 selects a pure deterministic
admit/defer/suppress boundary, separate from cognition, persistence and delivery.

## Decision

Use current validated semantic state, a minimal live intent snapshot, stable assessment
ID/time and explicit authority/attention/occurrence/generic surface evidence. Copy
inputs into an inspectable decision: intent/source/current revisions, outcome/enumerated
basis, interrupt/remain_silent, selected surface only for admit, typed next owner and
bounded reconsideration for defer, and full relevant evidence. Require valid timestamps,
grounding/urgency and nonempty unique evidence IDs. Do not persist model rationale.

Evaluate in order: validate; suppress named successor; suppress expiry/stale grounding;
suppress denied authority; suppress confirmed duplicate; only then defer stale/unknown
representation, unknown authority or identity; defer ordinary quiet-period contact;
select eligible lowest rank with locale-independent UTF-16 code-unit surface-ID tie
break; defer no eligible surface; admit only after all checks. Every independent
terminal suppression precedes temporary deferral, so uncertain representation cannot
keep denied/duplicate contact live. Urgency/surface convenience cannot bypass it.

Reconcile meaning currentness, intent scope, applicability at considered_at and live
commitments rather than assuming equal/later revisions imply applicability/staleness.
Stale representation alone defers until revalidation/successor, not necessarily ended
purpose. Every deferral has an explicit owner/evidence-change condition or quiet-window
end. Evidence change means new attributable input, not spinning unchanged checks.
Quiet windows are inclusive-start/exclusive-end, bounded and evidenced; grounded
time-sensitive contact may proceed only through remaining checks. Surface eligibility
is routing evidence, never recipient identity, privacy permission, attention reservation
or authority. Text/digest equality does not prove duplicate occurrence.

Persist the complete record with the intent owner before handoff. Defer/suppress
advance intent disposition; admit alone remains attached to live intent until unique
correlated delivery/handoff exists. Production Telegram requires an explicit agency
revalidator before each first handoff, observing fresh authority/attention/occurrence/
surface and current grounding rather than replaying prior admit. Configured opt-in
proactive_contact_policy_path is re-read for each assessment; absent policy remains
fail-safe with no first handoff. Missing observer/fresh defer/suppress/different surface
sends nothing. The bridge consumes policy; it does not derive semantic policy itself.
No scheduler, notification budget, transport retry policy, authority synthesis or
setup UX is introduced.

## Consequences

- Deterministic terminal precedence preserves silence without hiding why contact blocked.
- New handoffs need fresh observations even if old admit remains stored.
- Deferral requires named next responsibility, not an implicit polling loop or user duty.

## Implementation Plan

- **Affected paths:** [packages/core/src/agency/proactive-contact-attention-policy.ts](../../../packages/core/src/agency/proactive-contact-attention-policy.ts); [packages/core/src/agency/configured-proactive-contact-policy.ts](../../../packages/core/src/agency/configured-proactive-contact-policy.ts); [packages/core/src/agency/proactive-contact-store.ts](../../../packages/core/src/agency/proactive-contact-store.ts); [apps/telegram/src/surface.ts](../../../apps/telegram/src/surface.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Retain nine-step order, six deferral owner/condition rows, twelve executable scenarios, fresh revalidator/opt-in policy and locale-independent tie-break.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/agency/proactive-contact-attention-policy.test.ts`; `tests/telegram-delivery-reconciliation.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Let transport choose policy from reachability: convenient but grants authority from
  technical delivery capability and moves domain policy into the wrong owner.
- Reuse an old admit indefinitely: low overhead but stale authority/quiet/currentness
  can permit inappropriate contact.
- Defer unknown representation before terminal denial/duplicate checks: keeps a dead
  occurrence live; terminal independent evidence must win.

## More Information

See the [ADR index](README.md) for governing accepted decisions and the
[migration plan](../../research/archive/adr-migration-plan.md) for source mapping and phase-review tasks.
The source references retain detailed evidence and unresolved representation choices.
Revisit when concrete behavior or measured operational pressure invalidates a constraint;
implementation changes must preserve accepted semantic authority/currentness/provenance
rather than treating richer runtime mechanics as permission.

### Migration verification — 2026-10-27

The combined run passed 210 deterministic tests across 24 files for the unchanged
implementation. A second review checked source invariants, evidence limits, original
headings/anchors, native metadata/template sections, sequential numeric identities,
source/index traceability, local links and protected-file integrity. No live model,
remote account or LangGraph install/benchmark was used. Tests verify selected existing
traces, not every semantic requirement: in particular they do not establish the missing
durable contact-decision/no_contact lifecycle recorded in ADR 0033. The maintainer accepted this record on 2026-10-27; source ownership is now transferred.

### Phase acceptance — 2026-10-27

The maintainer accepted M08, including historical qualification of the obsolete Codex
exact-token guidance and acknowledgement of the missing durable contact-decision/
no_contact ledger. That ledger remains open implementation work under M08-F02 in the
migration plan; this acceptance does not implement or verify it. Source paths, headings,
procedures and dated evidence remain available. No runtime, dependency, package or
original-skill changes are introduced by this documentation acceptance.
