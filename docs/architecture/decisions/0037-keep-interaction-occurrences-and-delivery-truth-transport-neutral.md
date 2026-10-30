---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0037: Keep interaction occurrences and delivery truth transport-neutral

Migration record from [interaction-surface-boundary](../interaction-surface-boundary.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

Issues #85–#88 established one ordinary interaction/occurrence boundary across CLI and
Telegram with restart-safe delivery. C26 records transport identity and effect truth;
accepted ADR 0015 already owns composition and ADR 0008 owns Telegram worker topology.
A surface is a window onto continuing Ember, not canonical identity, memory or authority.

## Decision

Accept explicit principal/provenance, logical surface, scope/text, optional destination
and transport occurrence metadata through the composed application. Current CLI uses
explicit_local_argument; Telegram uses configured_surface_mapping after private-chat
admission. Reject a mismatched initialized principal before accepting an occurrence.
Account/device/chat identifiers are evidence, never identity or ambient disclosure authority.

With stable external identity correlate by (surface_id, external_occurrence_id).
Replay must match principal/provenance/scope/payload digest/destination/transport metadata
and resolves the same occurrence/planned cognition ID without a new semantic command,
authority/evidence/cognition or delivery. Conflicting replay fails closed and cannot
redirect reply. No stable ID means no transport dedup; identical CLI lines or distinct
message IDs are independent occurrences. Telegram update_id is occurrence evidence;
message/thread/source time/destination remain correlated operational metadata.

Persist planned cognition identity before provider handoff, build valid projection,
then create canonical user evidence/cognition with that ID. After a pre-cognition crash,
reuse the planned ID; if canonical cognition exists, never invoke again for replay.
Commit validated expression before delivery intent, durable representation and send.
If a crash leaves completed cognition without retained outbound bytes, rebuild only
justified correlation and block invented content; do not rerun cognition to fake it.

Delivery has independent stable identity, surface/destination, expression/cognition
correlation, retained representation/digest and attempts. Record started before send;
confirmed means observed transport completion, not human awareness. Definite failure
and unsafe uncertainty differ; only definite retryable failure permits resend using
same identity/bytes. Started at loss becomes uncertain. Unknown outcome blocks blind
retry/cross-surface fallback. CLI stdout and Telegram sendMessage obey the same truth;
CLI destination is null, not a fabricated terminal identity. No exactly-once delivery claim.

Persist atomic/durable interactions sidecar under the existing cooperating writer
lifecycle; application owns short runtime/lease around admitted work, never idle polling.
There is no transaction across canonical and interaction files. Stable IDs and ordering
support recovery, not universal atomicity. Operational IDs/receipt counts/transport
history are not canonical memory or automatic provider context. Logical surface is
explicit cognition context; ordinary principal/scope/currentness/provenance selection
stays transport-independent. Naming an out-of-scope meaning in user text cannot
expand ordinary projection. Explicit CLI explanation keeps its distinct diagnostic
semantics; Telegram does not gain it implicitly. Inspection exposes correlated evidence
without exposing retained delivery representation text as ordinary context.

No arbitrary principal derivation, channel registry/plugin framework, per-surface
canonical copies, text dedup, or general authorization engine is introduced.

## Consequences

- Replay survives the inbound crash window without duplicating cognition or redirecting
  an established destination; missing content remains a truthful blocked gap.
- Delivery and cognition can succeed/fail independently; operators need explicit
  uncertainty/retry evidence rather than a single interaction-success bit.
- Richer transport metadata cannot silently widen context, privacy scope or authority.

## Implementation Plan

- **Affected paths:** [packages/core/src/app/application.ts](../../../packages/core/src/app/application.ts); [packages/core/src/app/contract.ts](../../../packages/core/src/app/contract.ts); [packages/core/src/runtime/interaction-boundary.ts](../../../packages/core/src/runtime/interaction-boundary.ts); [apps/cli/src/surface.ts](../../../apps/cli/src/surface.ts); [apps/telegram/src/surface.ts](../../../apps/telegram/src/surface.ts). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Retain SURF-85/SURF-87 matrices, replay metadata, inspection/privacy detail, delivery runbook links, and concrete surface mechanics; composition/topology decisions remain existing owners.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/app/application.test.ts`; `tests/cross-surface-semantics.test.ts`; `tests/delivery-reconciliation.test.ts`; `tests/delivery-before-send-recovery.test.ts`; `tests/telegram-delivery-reconciliation.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Deduplicate by content: easy comparison but merges distinct real instructions.
- Treat provider completion as delivered: simple status but loses output failure and awareness.
- Retry unknown sends on another surface: improves reachability but can duplicate an
  already-visible effect and violate disclosure/ownership constraints.

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

### Amendment — 2026-10-29

[ADR 0042](0042-share-conversation-commands-across-surfaces.md) adds shared deterministic conversation commands with their own admission and
delivery journal and permits remote explanation commands constrained to the active
principal and scope. Its explicit amendments replace this record's CLI-only
explanation restriction; ordinary cognition and delivery guarantees remain binding.
