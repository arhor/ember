---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0015: Centralize application coordination and inward dependencies

## Context and Problem Statement

The implemented application shape from epic [#303](https://github.com/arhor/ember/issues/303)
must serve CLI and Telegram without duplicating cognition, canonical persistence,
or recovery policy inside each transport. [Canonical application flow](../canonical-application-flow.md)
and [source layout](../source-layout.md) already document this choice and its
implementation. This C04 record extracts the durable ownership decision; it does
not introduce a second application architecture or reorganize packages under development.

## Decision

Keep one transport-neutral `EmberApplication.interact(InteractionEvent, TransportSend)`
boundary for ordinary user interactions. Executable/bootstrap composition assembles
repositories, the configured AI executor, structured controls, and capability selection
before supplying the application to conversational surface adapters.

The application coordinates admission, canonical writer lease, continuity binding,
runtime episode, occurrence/replay admission, conversation/projection preparation,
cognition, post-turn work, durable delivery intent, and delivery reconciliation.
Commit validated cognition/expression and retained delivery representation before
transport send. Replay reuses the established cognition identity. Post-turn failures
remain diagnostics rather than erasing cognition or implying delivery success.
Release the writer lease in the outer `finally`, including failure paths.

Surface adapters map input/provenance, enforce transport admission, and perform concrete
send/poll/reconciliation work through injected collaborators. They do not construct
providers, canonical stores, or the application. Explicit setup, recovery, and operator
commands can own their actual operational responsibilities; their co-location does not
exempt ordinary conversational modules from the boundary.

Dependencies point inward: apps depend on core, core does not depend on apps, and
one concrete app does not depend on another. Application orchestration cannot import
surfaces; semantic modules cannot import AI SDK mechanics; AI infrastructure cannot
own canonical persistence/semantic mutation; service-manager mechanics belong under
host infrastructure. Bootstrap may create or restore continuity, then enters the same
ordinary interaction path. Telegram installation remains a trusted-host operator task.

Keep canonical continuity, conversation context, transport occurrence/delivery,
onboarding, memory proposal generation, and provider evidence as distinct responsibilities.
A process, provider session, transport chat, or service unit does not own identity.

Non-goals: a generic dependency injection framework, surface registry, event bus,
new bootstrap architecture, new package boundaries, or changes to active package work.
Existing file locations are implementation references, not a ban on compatible refactoring.

## Consequences

- Cross-surface behavior can be tested through one application boundary; retain the
  shared regression and dependency checks when moving code.
- Composition must supply explicit collaborators; operator exceptions need narrow
  ownership rather than being inherited by every file in a surface package.
- The current import checker covers selected production roots, not every possible
  future package or behavior. Review new ownership boundaries explicitly.

## Implementation Plan

- **Affected paths:** existing [application contract](../../../packages/core/src/app/contract.ts),
  [application coordinator](../../../packages/core/src/app/application.ts),
  [composition](../../../packages/core/src/composition/ember.ts),
  [CLI surface](../../../apps/cli/src/surface.ts), [Telegram surface](../../../apps/telegram/src/surface.ts),
  [dependency checker](../../../scripts/check-dependencies.ts), and the two source references.
- **Dependencies/configuration:** no additions, upgrades, environment keys, or package
  moves. Preserve current explicit composition and workspace relationships.
- **Patterns to follow:** the ten-step message sequence in the application-flow
  reference, transport-neutral contracts, durable intent before send, and lease cleanup.
- **Patterns to avoid:** private surface composition, SDK types in semantic contracts,
  infrastructure-owned canonical mutation, or treating operational IDs as identity.
- **Migration:** transfer decision ownership to this ADR; keep
  source maps, entry-point traces, command placement, and operational detail at their
  existing paths. This ADR owns the decision; source documents retain detailed implementation references.

### Verification

- [x] `node scripts/check-dependencies.ts` passes for the existing production roots.
- [x] `node --test tests/check-dependencies.test.ts tests/cross-surface-semantics.test.ts`
      passes for dependency enforcement and cross-surface admission/replay/delivery behavior.
- [x] Source review preserves all six durable responsibilities, the ten-step interaction
      flow, operator exceptions, and dependency direction without prescribing new packages.

## Alternatives Considered

- Let each transport construct and coordinate its own providers/stores: makes adapters
  locally self-contained but duplicates lifecycle/authority/recovery policy and prevents
  a single ordinary interaction owner. The source explicitly rejects this direction.
- Introduce a generic registry, event bus, or dependency injection framework: may help
  a demonstrated extensibility requirement, but multiple surfaces alone do not justify
  the extra indirection. Keep explicit construction points instead.

## More Information

Subordinate to accepted ADRs 0001–0009; see the [ADR index](README.md) for their scopes.
The source maps remain maintained implementation references, including test/evaluation
placement and host responsibilities. Revisit if a concrete interaction requirement
cannot fit the shared application contract while preserving those decisions. No
separate historical approval date or meeting record is asserted by this migration.

### Migration verification — 2026-10-27

The combined targeted run passed all 91 tests across eleven files; the production
dependency check also passed. Source comparison preserves this record's constraints,
non-goals, and evidence limitations. No live-provider observation, runtime change, or
acceptance is implied by these deterministic results. The maintainer accepted this batch on 2026-10-27. This ADR now owns its decision;
source documents retain operational detail and dated evidence.

### Phase acceptance — 2026-10-27

The maintainer authorized completion of M05 following the concrete phase review.
Source ownership is transferred to this accepted ADR. Implementation paths and
ongoing verification constraints describe the existing system; no runtime work,
dependency change, or package reorganization is introduced by acceptance. Historical
approval attribution not recorded in the original sources remains unknown.
