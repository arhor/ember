---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0035: Keep durable objectives independent of execution episodes

Migration record from [durable-objective-lifecycle](../durable-objective-lifecycle.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issues #236–#238 need continuing purpose across bounded processes/providers, later
approval and external effects. C24 records semantic objective ownership plus the
current minimal ledger, not a workflow engine, scheduler or new endogenous goal source.

## Decision

Create a durable objective only from explicit user request or authorization for work
across episodes, with principal/scope and typed creation provenance. Ordinary one-turn
work need not become an objective. Model suggestions, observations, concerns, standing
capability or Ember-origin motive cannot currently create one. Stable objective ID is
not provider/session/episode/message/title identity; equal wording is not sameness.

Preserve purpose/success constraints, named acceptance conditions, principal/scope,
creation evidence, revision/material currentness basis, attributable lifecycle/history,
episodes/checkpoints/effects/approval correlation, and next-step responsibility.
An objective is not authority or an automatic commitment completion. Materially changed
purpose requires attributable revision or explicit successor; never overwrite old meaning.

Separate active/deferred/blocked live states from terminal completed/abandoned for an
objective revision. Completion requires Ember judgment against every named condition
using current attributable evidence and bounded uncertainty. A terminal revision never
returns live; corrected completion/reopening requires a new revision or successor,
and abandoned pursuit needs fresh user authorization. Current minimal implementation
does not add general revision/successor creation. Uncertainty qualifies progress,
authority/effect/currentness, not a catch-all lifecycle status or completion by absence.

Episodes are bounded attempts with own identity, revision/input/authority/runtime,
start/end/last-observed state and effects; sequential/concurrent episodes can yield
checkpoints. Provider success is not objective completion; failure can provide useful
progress; cancellation does not itself abandon the purpose. Checkpoints retain named
conditions, evidence/provenance, assumptions, uncertainty, progress and suggested next
step as advice. Duplicate/correlated reports cannot manufacture independent progress.
Explicit Ember resume assessment makes the next step operative, not checkpoint text.

Before later work/reliance, reconcile live revision/purpose, newer instructions,
prior still-running/lost/uncertain work, checkpoint applicability, current authority/
privacy/resource/attention/consequence and duplicate-effect risk. Preserve downtime
gaps; no blind prompt/thread replay. For every running episode explicitly establish
still_running or loss/outcome_unknown; disappearance alone cannot prove stop.
A defer/block/complete/abandon assessment starts no episode; continue starts a new one.

Cancellation identifies objective/episode/proposal/delivery target and entitlement,
blocks new pursuit/not-started effects, requests stop where possible and separately
retains acknowledgements, observed stop, descendants/remote effects and compensation.
Abandoned objective may retain running/unknown work; late results stay history, not
reactivation. Ambiguous stop blocks new consequential progress while clarified.
Rollback/compensation is a separate authorized effect.

Bind objective action proposals to exact objective/revision/source episode/step and
acceptance conditions; revalidate immediately before effect. Proposal approval is not
general objective authority. Action ledger owns confirmed/failed/unknown effects;
reintegrate into objective checkpoints with proposal/attempt IDs and Ember progress
judgment. Unknown effects forbid consequential retry; abandoned/revised objectives
invalidate unused authority without erasing already-started effects.

Keep the versioned objectives sidecar Ember-owned and serialize mutations per store
instance plus cooperative cross-instance lease/durable replacement. Runtime/provider
IDs stay episode evidence. Validate causal chronology without total-ordering concurrent
episodes; updated_at is max history time. Latest relevant checkpoint uses recorded_at,
not append order; every tied-latest checkpoint must establish a condition without
uncertainty, else completion blocks. Terminal reports cannot predate own checkpoints
or explicit still-running observations. General scheduling/decomposition/progress
percentages/retry/notification/rollback and successor schema remain open.

## Consequences

- Continuing purpose survives provider/process replacement without freezing operational runs.
- Evidence and effect reconciliation remain necessary even after abandonment or useful
  episode completion; stored percentages/run finish reasons cannot replace judgment.
- Conservative chronology/completion and unsupported terminal reopening may require
  explicit new work rather than mutating an old terminal record.

## Implementation Plan

- **Affected paths:** [packages/core/src/objectives/durable-objective.ts](../../../packages/core/src/objectives/durable-objective.ts); [packages/core/src/app/objective-action.ts](../../../packages/core/src/app/objective-action.ts); [packages/core/src/capabilities/action-proposal.ts](../../../packages/core/src/capabilities/action-proposal.ts); [packages/core/src/integrations/google-calendar/create.ts](../../../packages/core/src/integrations/google-calendar/create.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Retain all lifecycle/progress/next-owner/resume/cancellation distinctions, six scenarios, ledger chronology and later-approval/effect correlation; no generalized successor API is selected.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/objectives/durable-objective.test.ts`; `packages/core/src/app/objective-action.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Provider thread/workflow state as objective: easy resumability but makes operational
  checkpoint loss redefine purpose, identity and current truth.
- Complete objectives when a worker completes: simple status propagation but ignores
  current acceptance conditions, partial progress and effect uncertainty.
- Create goals from every observation/model suggestion: expansive agency but exceeds
  the explicit-user-intent creation boundary selected for this implementation.

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
