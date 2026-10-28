---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0032: Separate completed cognition from permission to interrupt

Migration record from endogenous-interruption-decision (consolidated into this ADR; original source in Git history). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issue #78 needs useful internal thought without making every cognition or wake-up a
notification. C21 records the pure interruption gate; durable intent and transport
truth are separate C22/C23/C26 boundaries. It does not implement an endogenous runner.

## Decision

Require a validated CompletedInternalCognition handoff with opportunity and distinct
cognition identity, principal/scope, validated revision, explicit completed status and
actually used meaning IDs. An opportunity's cognition decision is not completion;
reject unfinished/invalid sources. Keep the foreground user-cognition contract intact
rather than fabricating a user turn or immediate delivery to reuse it.

A separate optional candidate carries only actually used grounding IDs, ordinary or
time_sensitive urgency, and explicit urgency grounding for time sensitivity. Reject
outside-used grounding or fabricated urgency. Reconcile all candidate grounding for
currentness, scope, applicability and live commitments before delivery permission.
Require explicit current authority: authorized proceeds, unknown defers, denied
suppresses. Usefulness, provider reach or urgency cannot manufacture permission.

Pure `decideUserInterruption` returns deliver, defer, suppress or no_delivery with
enumerated basis, never canonical mutation/commitment/authority creation or send.
Deliver permits a later attempt only. Ordinary quiet-period contact defers; grounded
time sensitivity may proceed only after authority/currentness checks. Suppress stale,
denied or exactly repeated successfully delivered grounding. Compare complete sets
order-independently: delivering A and B separately does not make A+B a repeat.
Prior-delivery history is operational evidence, not canonical memory.

Valid completed cognition with candidate null means no_delivery and may support a
separate successful no_contact decision; missing completed cognition means not evaluated
and cannot manufacture silence or intent. A non-null warranted candidate needs its
own durable intent before later attention/handoff disposition. No queue, transport,
notification budget, provider runner, automatic candidate or general standing-authority
subsystem is selected here.

## Consequences

- Thought can remain private; quiet useful thought is not failure or automatic contact.
- Callers must supply justified current authority and delivered-occurrence history.
- Completion, interruption permission, contact intent and delivery remain independently
  inspectable; pure results cannot be mistaken for durable contact decisions.

## Implementation Plan

- **Affected paths:** [packages/core/src/agency/interruption-decision.ts](../../../packages/core/src/agency/interruption-decision.ts); [packages/core/src/agency/proactive-contact-attention-policy.ts](../../../packages/core/src/agency/proactive-contact-attention-policy.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Preserve CompletedInternalCognition fields, eight deterministic scenarios and the no-source versus completed-no-candidate distinction.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/agency/interruption-decision.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Notify for every opportunity choosing cognition: collapses work admission/completion
  and bypasses current authority/attention.
- Notify for every completed thought: still conflates usefulness with permission/cost.
- Union all historically delivered IDs for repeat suppression: wrongly suppresses new
  combinations; require one complete previously delivered grounding set.

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
