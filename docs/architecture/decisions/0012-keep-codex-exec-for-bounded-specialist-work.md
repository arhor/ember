---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0012: Keep Codex Exec for Bounded Specialist Work

This accepted C02 migration record reconstructs issue #64's integration choice.
The maintainer approved this record on 2026-10-27. The
[original evaluation](../../research/codex-specialist-integration-evaluation.md) remains dated
supporting evidence; this ADR owns the integration decision. Evidence was collected
on 2026-09-02 against Codex CLI 0.152.1. Acceptance does not claim that observations
were rerun or that an original formal approval date is known.

## Context and Problem Statement

Ember's implemented specialist boundary needs bounded attempts, explicit workspace
and runtime policy, attributable structured reports, best-effort cancellation, and
truthful uncertainty after boundary loss. AS-DEL-00 through AS-DEL-08 do not require
suspending a live turn for approval mediation, steering that same turn, or recovering
a provider-local thread as the continuing agent.

The evaluation compared the existing subprocess boundary with a richer App Server
client and the TypeScript SDK. A richer integration does not remove Ember's ownership
of context, authority, currentness, effects, provenance, or reintegration.

## Decision

Keep `codex exec` for the existing bounded specialist implementation. Defer App Server
until an accepted requirement demonstrates a need for a capability the current
boundary cannot provide. Do not add the TypeScript SDK solely to replace an already
bounded invocation wrapper or adopt provider session semantics by convenience.

Ember persists the episode specification before launch, supplies a selected workspace
and explicit runtime policy, validates the final structured report, and records
observations attributable to the external specialist. Runtime access is capability
evidence, not semantic authority. Cancellation request, child exit, absence of
further work, rollback, and effect absence remain separate facts.

When the current boundary cannot safely mediate an approval, the episode may end
blocked with an attributable expansion request. Ending the attempt is distinct from
resuming the same turn after a live human decision. Provider thread identifiers may
support diagnostics and correlation without owning Ember continuity.

## Scope and non-goals

This choice concerns the specialist integration surface. It does not adopt a generic
agent orchestration framework, grant interactive approval mediation, authorize
reattachment to an unknown thread, or weaken the episode's authority envelope.
Python integration is outside Ember's selected TypeScript runtime; the source's
Python SDK observation is retained as dated context, not a new runtime option.

## Alternatives Considered

- **Codex App Server:** the dated evaluation identifies bidirectional approval,
  in-turn steering, protocol interruption, richer events, and thread operations as
  material additional capabilities. Adoption would also require initialization,
  request correlation, server-initiated requests, event reduction, pending approval
  durability, disconnect/restart handling, version compatibility, retained-thread
  cleanup, and long-lived supervision. No evaluated accepted scenario earns that
  ownership yet.
- **TypeScript SDK:** an idiomatic language wrapper and thread helpers could reduce
  invocation boilerplate. The source does not establish an unmet requirement that
  justifies a new dependency or changed session semantics for the one-attempt path.
- **Existing exec boundary:** meets the evaluated requirements with a smaller
  operational surface. It retains safe limitations and effect uncertainty.

These are the source evaluation's dated comparisons. This migration does not claim
they describe every later CLI, protocol, or SDK release.

## Consequences

The current implementation remains auditable and avoids a stateful protocol client.
Live approval mediation, same-turn steering, and reattachment remain unavailable
unless separately earned. A larger integration would leave the hard semantic checks
with Ember and would need explicit operational ownership and deterministic coverage.

## Implementation Plan

The following plan records the existing implementation and ongoing boundary
constraints. The original feature work is completed; no new dependency or
configuration change is required by this migration.

The choice is already implemented; there is no pending SDK migration in this ADR.

- [Specialist implementation](../../../packages/core/src/delegation/codex-specialist.ts)
  owns explicit episode creation, bounded invocation, recorded outcomes, currentness,
  and reintegration.
- [Deterministic specialist tests](../../../packages/core/src/delegation/codex-specialist.test.ts)
  cover runtime policy, provenance, cancellation uncertainty, scope, and disposition.
- [Specialist boundary](../minimal-codex-specialist-delegation.md),
  [context/authority flow](0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md), and
  [reintegration reference](../specialist-result-reintegration.md) retain current
  contract details; their later consolidation belongs to C16/C17.
- [Dated comparison](../../research/codex-specialist-integration-evaluation.md) retains exact
  observations, versions, source references, and the requirement matrix.

### Verification

- [x] Deterministic specialist tests pass without a live Codex invocation.
- [x] AS-DEL-00 through AS-DEL-08 remain linked and unchanged.
- [x] The record preserves blocked versus live-mediated approval and cancellation
      versus effect-absence distinctions.
- [x] Source review confirms all adoption triggers and dated evidence limitations.

## More Information

The [delegation acceptance catalogue](../acceptance-scenarios.md#delegation-and-responsibility)
and ADRs [0003](0003-use-least-sufficient-permitted-projections.md),
[0004](0004-separate-capability-from-authority.md), and
[0005](0005-distinguish-operational-continuity.md) constrain any replacement.

Reopen only when an accepted requirement needs at least one of:

1. an attempt suspended for an attributable approval and continued as the same attempt;
2. steering a live turn without cancelling and starting a new episode;
3. supported reattachment to a retained thread instead of a new Ember episode; or
4. durable intermediate progress unavailable reliably through the CLI JSONL boundary.

Then prototype on a disposable workspace. Preserve AS-DEL-04 uncertainty across
interrupt/disconnect, enforce the live authority envelope, record exact runtime and
protocol/schema versions, and compare deterministic coverage and operational cost.
Do not replace exec until the newly required scenario passes the richer boundary.

### Pilot acceptance — 2026-10-27

The maintainer approved this pilot batch. Review against the original ADR skill's
agent-readiness checklist found the source constraints, implementation references,
verification criteria, non-goals, and revisit conditions preserved. This is a
documentation migration; existing implementation evidence does not imply all future
representations are verified. No runtime or package changes were made.
