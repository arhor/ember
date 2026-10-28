---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0029: Persist topic-free cognition decisions and explicit silence

Migration record from [cognition-opportunity](../cognition-opportunity.md), [endogenous-cognition-decision](../endogenous-cognition-decision.md), endogenous-silence-lifecycle (consolidated into this ADR; original source in Git history). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issues #73–#75 need an endogenous opportunity to explain why cognition is possible
without supplying its topic or fabricating user input. C18 consolidates opportunity,
evaluator and silence lifecycle under accepted ADRs 0001/0003/0005. It selects no
scheduler, heartbeat, daemon, motivational score or richer retrieval system.

## Decision

Represent each opportunity as one Ember-owned operational occurrence with current
runtime, explicit principal/scope, observation time and coarse enumerated mechanism.
No topic/task/reminder/concern ID/query/provider prompt or hidden scheduler payload
enters selection. Topic-bearing triggers follow their actual external semantics.
Reuse ordinary bounded projection selection with provenance, scope, currentness,
recovery and no raw transcript or wholesale canonical state. The evaluator receives
only the opportunity projection, not mechanism or `current_input`; no opportunity
creates user-command evidence. The internal empty-input compatibility call is safe
only while it cannot steer selection; revisit if ordinary selection begins using it.

Validate exactly contractVersion 1, decision `cognition | defer | no_cognition`, and
unique selected projected meaning IDs. Cognition/defer need nonempty grounding;
no_cognition needs none. Projection mutation cannot enlarge the validated envelope.
No free-form reason, hidden reasoning, model motivation or autobiographical memory
is adopted. A cognition decision permits later internal work; it is not completed
cognition, authority, interruption or delivery. The structured SDK adapter remains
beneath accepted ADR 0017's shape-versus-semantics boundary.

Keep pure nonmutating evaluation and durable `runCognitionOpportunity` distinct.
Persist `evaluating` before execution, then validated `decided` with one decision
or operational failed/timed_out/cancellation_requested/outcome_unknown. No-cognition
is positively established silence, never inferred from missing output or failure.
Record opportunity/runtime IDs, principal/scope/mechanism, observation/last-durable
times, projection revision and meaning/evidence IDs, selected grounding and
`interruptionStatus: not_attempted`, plus justified termination facts. No prompts,
replies, motives, new commitments or synthetic user turns enter this ledger.

Restart preserves decided silence; interrupted/still-evaluating occurrences become
outcome_unknown, including clean-stop closure before recording stop. Legacy v1 state
without the ledger remains valid and inspected as empty; new initial state includes
it. Repeated quiet opportunities accumulate operational occurrences without changing
meaning, evidence, commitments, ordinary cognition or delivery. Metrics count silence
separately from evaluating and each failure/unknown outcome.

## Consequences

- Intentional silence can be inspected without rewarding crashes as successful restraint.
- Bounded operational history grows with opportunities; it grants no motive or authority.
- Historical exact-token Codex instructions in the source conflict with current
  `ai/codex-opportunity.ts`, which delegates to the structured evaluator under ADR 0017.
  Phase acceptance qualified that section as historical and linked current
  mechanics; no runtime change or second control protocol is introduced.

## Implementation Plan

- **Affected paths:** [packages/core/src/agency/cognition-opportunity.ts](../../../packages/core/src/agency/cognition-opportunity.ts); [packages/core/src/ai/opportunity.ts](../../../packages/core/src/ai/opportunity.ts); [packages/core/src/ai/codex-opportunity.ts](../../../packages/core/src/ai/codex-opportunity.ts); [packages/core/src/runtime-episode.ts](../../../packages/core/src/runtime-episode.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Retain CO-01–04, evaluator invariants, ledger lifecycle and metric definitions; qualify obsolete exact-token Codex reproduction as historical following phase acceptance.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/agency/cognition-opportunity.test.ts`; `packages/core/src/agency/cognition-opportunity-lifecycle.test.ts`; `packages/core/src/ai/opportunity.test.ts`; `packages/core/src/ai/codex-opportunity.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.
- [x] The maintainer approved qualifying the obsolete Codex exact-token section as historical under accepted ADR 0017.

## Alternatives Considered

- Fake an ordinary user turn for a wake-up: reuses interaction plumbing but forges
  evidence and can smuggle a topic. Keep a pre-cognition opportunity boundary.
- Count missing replies as silence: cheap metrics but conflates failure/loss with
  a successful decision. Require a validated durable outcome.
- Let a scheduler choose the subject: valid for scheduled tasks, but not endogenous
  opportunities. Keep mechanism as provenance only.

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
