---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0031: Defer repeated cognition over unchanged projected grounding

Migration record from [endogenous-attention-control](../endogenous-attention-control.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issue #79 observed useful first cognition followed by three redundant evaluator calls
on unchanged projected grounding; later interruption policy already prevented user spam.
Issue #95 earned only a narrow pre-evaluator repetition control, not a universal timer,
cost budget, quiet-state cache or salience score. C20 preserves that evidence boundary.

## Decision

Before durable opportunity evaluation, inspect history for the same runtime, principal,
active scope and mechanism. If prior successful cognition selected validated grounding
on exactly the same projected meaning-ID and evidence-ID sets, and no different
projection appeared for that context since, persist a new decided/defer occurrence
with the prior cognition's selected grounding and not_attempted interruption. Skip
the evaluator. Defer does not claim no concern or permanent worthlessness.

A different projected meaning/evidence set, mechanism or runtime allows evaluation.
A different projection ends the repetition epoch; returning to an older shape evaluates
again rather than suppressing from arbitrary history. Repeated no_cognition remains
unsuppressed; failures, timeout, cancellation and unknown outcomes are not successful
prior thought. A control-produced defer creates no CompletedInternalCognition or
interruption handoff, commitment, authority or future-delivery promise.

Preserve the 25-opportunity workload as dated structural evidence: control saves
three evaluator calls (25 to 22), keeps three worthwhile cognitions, turns three
repeat false positives into three deferrals, and misses no worthwhile cognition in
that fixture. This is not a universal percentage/quality result.

Elapsed time can matter while meaning/evidence IDs remain unchanged. This control
ignores current_time for equality and invents no cooldown. A long-lived runtime can
therefore keep deferring until projection or runtime changes. Explicit reconsideration
epochs/time-sensitive runtime opportunities belong to the existing runtime requirements
and topology decisions, not a timer silently added here.

## Consequences

- Saves only demonstrated repeated-cognition work and preserves useful first evaluation.
- Quiet opportunities still cost evaluator calls; broader caching needs separate evidence.
- Long-runtime time sensitivity is an acknowledged limitation requiring truthful
  runtime/reconsideration ownership, not claimed solved by ID-set equality.

## Implementation Plan

- **Affected paths:** [packages/core/src/agency/endogenous-attention-control.ts](../../../packages/core/src/agency/endogenous-attention-control.ts); [packages/core/src/agency/cognition-opportunity.ts](../../../packages/core/src/agency/cognition-opportunity.ts); [packages/core/src/agency/endogenous-selectivity-evaluation.ts](../../../packages/core/src/agency/endogenous-selectivity-evaluation.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Retain measured baseline/control tables, reproduction modes and explicit time-sensitive reopening limitation.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/agency/endogenous-attention-control.test.ts`; `packages/core/src/agency/endogenous-selectivity-evaluation.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Fixed cooldown/global budget: easy operational bound but unearned duration/policy
  can suppress useful changed state.
- Cache all quiet outcomes: may save more calls but was not the measured failure.
- Suppress every historically seen set forever: saves repetition but loses reopening
  after a changed projection or fresh runtime.

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
