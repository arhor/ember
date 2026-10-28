---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0030: Represent dormant concerns with existing live commitments

Migration record from endogenous-concern-activation (consolidated into this ADR; original source in Git history). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issue #76 needs an existing concern to become worth thought when current consequences
change, without inventing a new motive store or activation machine. C19 records the
minimal commitment-based representation beneath the topic-free opportunity boundary.

## Decision

Use existing current/live Ember commitments for the first continuing concerns; add
no Concern family or persistent dormant status. Responsibility currentness and present
participation in cognition are separate. An unselected commitment can remain live
across arbitrarily many opportunities without mutation or fake motive accumulation.

Keep the mechanism identical and topic-free across quiet, dormant, active and closed
controls. The evaluator sees the normal projection: a relevant durable consequence
can ground cognition with the live commitment; a fulfilled/cancelled commitment does
not reappear in ordinary selection. A concern's existence alone cannot force cognition.

Close a v1 commitment through `transitionCommitment`: require a nonempty attributable
user occurrence in the same scope, append it to provenance, preserve the original
Ember adoption evidence, establish applicableUntil, and move current/live to historical/
fulfilled or historical/cancelled. This narrows the old minimal-slice statement that
discharge was deferred; it does not prescribe user-command-only discharge forever.
Future observation/delegation/renegotiation/expiry mechanisms require concrete semantics.

Ordinary selection requires commitment kind, currentness current, prospective lifecycle
live and matching scope. Explicit explanation can inspect historical commitments and
provenance. Inspection separates live/closed; opportunity projected/selected IDs explain
activation/nonactivation without retaining reasoning. No score, revisit_at, cron hint,
queue, cadence, interruption permission or new external authority is introduced.

## Consequences

- Dormancy is inspectable nonparticipation rather than a second canonical lifecycle.
- Explicit closure stops obsolete concerns resurfacing while preserving undertaking history.
- The narrow discharge evidence rule limits v1; future transitions require evidence,
  not an implicit generalization from this first implementation.

## Implementation Plan

- **Affected paths:** [packages/core/src/semantics.ts](../../../packages/core/src/semantics.ts); [packages/core/src/projection.ts](../../../packages/core/src/projection.ts); [packages/core/src/agency/cognition-opportunity.ts](../../../packages/core/src/agency/cognition-opportunity.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Preserve the four controlled activation cases, explicit discharge/currentness semantics and existing inspection/provenance detail.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/agency/dormant-concern-activation.test.ts`; `tests/endogenous-restart-harness.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Add a dormant concern class/state machine: offers rich scheduling hooks but duplicates
  existing live responsibility and was not required by the controlled scenarios.
- Mutate concern status whenever unselected: conflates attention with normative force.
- Never discharge commitments: preserves history but keeps closed responsibilities live.

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
