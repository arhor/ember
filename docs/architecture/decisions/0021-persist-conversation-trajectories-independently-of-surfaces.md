---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0021: Persist conversation trajectories independently of surfaces

Accepted migration record from [the original source](../cross-surface-conversation-continuity.md). This ADR owns the architectural decision; the source retains
detailed implementation references and dated evidence. The record documents existing choices and
constraints; no unrecorded historical approval date or alternatives meeting is claimed.

## Context and Problem Statement

Issue [#217](https://github.com/arhor/ember/issues/217) initially selected recent
dialogue by principal/scope/surface. Issue [#218](https://github.com/arhor/ember/issues/218)
removed surface-driven amnesia by persisting an Ember-owned trajectory. This C10
record records the implemented v2 representation beneath accepted semantic
[ADR 0013](0013-keep-conversation-identity-and-context-ember-owned.md); it does not
make one minimal membership heuristic a universal definition of conversation.

## Decision

Persist explicit Ember-owned `conversation_id` and bounded exchanges outside the
provider/process in `<continuity-state-path>.conversation.json`, schema version 2.
Keep active trajectories separate from exchange payloads. Each exchange retains
its source surface and evidence/cognition correlation. This short-lived, process-
durable operational conversation state is not canonical remembered meaning.

Keep at most one active trajectory per supported principal/scope pair in the current
representation. Application preparation resolves explicit membership intent above the
store. Initial input starts a trajectory; ordinary adjacency can continue it when no
stronger boundary exists; explicit or ambiguous-discourse boundaries can start fresh
even for the same principal/scope/surface/provider. Principal/scope compatibility is
necessary safety evidence, not sufficient proof of discourse identity. Richer routers,
multiple trajectories, and qualified linkage remain future compatible choices.

Cross-surface selection follows conversation identity instead of surface equality,
retaining source provenance and current scope/disclosure rules. Runtime, provider
thread, Telegram update/message/chat, or logical surface IDs do not define conversation
identity; transport IDs continue to govern replay and delivery separately. A fresh
provider invocation or clean process/store/runtime restart can continue the same
surviving trajectory without hidden provider history.

A durably accepted input may survive interrupted cognition without a fabricated Ember
reply. Only established expression participates as an Ember turn; delivery state and
awareness uncertainty remain distinct and never strengthen merely through continuation.

`startFreshConversation` advances only the selected pair's active cursor; CLI
`:new-conversation` exposes it. Prior bounded exchanges can remain historical; reset
does not delete canonical evidence/meaning, supersede preferences, alter lineage,
change provider/runtime identity, or require a new process. Subsequent compatible
surfaces see the new cursor. Prior-trajectory transient context is empty while ordinary
eligible canonical memory remains independently selectable.

Migrate v1 conservatively: deterministically assign a separate legacy conversation ID
to each principal/scope/surface history, choose the trajectory with the latest accepted
exchange as active for the pair, and do not silently merge older surface histories.
The next accepted exchange writes v2; future cross-surface continuity is prospective.

Expose `context_version: 2`, selected conversation ID, membership action/basis, and
`recent_same_conversation_v2`. Turns retain role/order/surface, evidence/cognition
correlation, delivery/awareness and truncation facts. Selection stays bounded and
deterministic for fixed state/sidecar input. A conversation ID cannot cross principal
or scope boundaries. Unknown history remains a gap, not an empty canonical memory.

## Consequences

- Local conversation survives compatible surface/process/provider changes while
  preserving explicit fresh starts and privacy boundaries.
- One active cursor is a bounded implementation choice; richer routing needs evidence
  and can evolve without promoting principal equality into semantic membership.
- Conservative legacy migration preserves historical separation rather than inventing
  stronger cross-surface correlation after the fact.

## Implementation Plan

- **Affected paths:** [conversation contract/selection](../../../packages/core/src/conversation-context.ts),
  [sidecar store](../../../packages/core/src/persistence/conversation-context-store.ts),
  [preparation](../../../packages/core/src/app/cognition-preparation.ts), and source reference.
- **Dependencies/configuration:** none added; retain schema-v2 migration and existing
  fresh-conversation operator surface. No new router or retention values are selected.
- **Patterns to follow:** membership above store, explicit IDs, bounded durable dialogue,
  conservative v1 migration, and independent canonical selection.
- **Patterns to avoid:** merging legacy surfaces, resetting canonical memory, same
  account as automatic disclosure permission, or provider history as continuity owner.
- **Migration:** decision ownership is transferred to this ADR; keep detailed
  sidecar fields, migration examples, command, and inspection procedure in the source.

### Verification

- [x] `node --test tests/recent-dialogue-projection.test.ts tests/cross-surface-continuity.test.ts`
      passes continuation/restart, fresh reset, bounded selection, provenance, and v1 migration.
- [x] `node --test tests/conversation-context-validation.test.ts tests/conversation-evaluation.test.ts`
      passes semantic membership/scope and awareness/recovery checks.
- [x] Source review preserves all seven implementation invariants without upgrading
      the default adjacency heuristic into universal conversation semantics.

## Alternatives Considered

- Continue surface-local histories: preserves simple partitioning but loses dialogue
  when the same justified trajectory crosses CLI/Telegram.
- Merge every legacy history by principal/scope: easy migration but invents discourse
  correlation not established in v1. Preserve histories separately.
- Use provider/session IDs or one immortal transcript: supplies ready keys but violates
  provider independence, boundedness, currentness, and semantic membership.

## More Information

The source retains the detailed v1/v2 operational contract under this ADR. Revisit the cursor/heuristic when observed discourse needs richer
routing; keep the accepted semantic boundary rather than declaring a new identity model.

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
