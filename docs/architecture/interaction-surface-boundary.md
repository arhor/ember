---
summary: "Current issue #85 boundary for principal-aware surface input, transport occurrence correlation, and delivery intent/outcome without making surface metadata canonical memory."
read_when:
  - "Adding or changing an interaction surface such as CLI or messaging"
  - "Changing transport replay deduplication, surface principal provenance, or delivery attempt/outcome semantics"
role: design
discovery_status: current
---

# Interaction Surface Boundary

> Status: current design and executable seam from issue #85. Issue #86 now exercises
> this boundary through the concrete Telegram adapter documented in
> [Telegram Surface Runbook](telegram-surface-runbook.md). Telegram-specific runtime
> ownership is recorded separately in
> [ADR 0008](decisions/0008-add-systemd-supervised-telegram-transport-worker.md).

## Purpose

A surface is a window onto one continuing Ember, not an owner of identity, memory,
authority, or continuity. A transport update is likewise not automatically a new
semantic occurrence merely because it was received again.

This boundary applies the existing semantics from ADR 0001, ADR 0003, ADR 0005,
[Operational Model, Sessions, and Surfaces](../research/operational-model-sessions-and-surfaces.md),
and the existing AS-OPS-01/02/05/06 acceptance scenarios. It also consumes the
transport-independent interruption decision from
[Endogenous User Interruption Decision](endogenous-interruption-decision.md): a
`deliver` decision permits a later delivery attempt, but cognition completion and
user delivery remain separate facts.

Issue #85 itself added no resident channel framework and no new owner of Ember
continuity. Issue #86 later supplied concrete evidence for one resident Telegram
_transport_ worker under ADR 0008 while preserving this boundary's ownership rules:
canonical work remains short-lived and writer-lease bounded.

## Boundary

`src/runtime/interaction-boundary.ts` exposes a small surface-neutral seam around the
existing cognition runner.

```text
surface input
    |
    v
principal + surface provenance
    |
    v
transport occurrence correlation
    |                     \
    | new                  \ established replay
    v                       v
persist occurrence      suppress duplicate cognition
+ planned cognition ID
    |
    v
existing Ember context selection
    |
    v
cognition completes
    |
    v
delivery intent
    |
    v
attempt -> confirmed | failed | uncertain
```

The cognition projection remains built by Ember from canonical state. The logical
surface identifier is explicit cognition context, but transport occurrence, message,
thread, correlation, destination, and receipt metadata do not enter the provider
projection merely because the transport knows them.

## Inbound interaction

An inbound interaction carries:

- the asserted Ember principal;
- explicit provenance for that assertion;
- a surface identifier;
- Ember scope and user text;
- an optional delivery destination established for the occurrence; and
- optional transport occurrence metadata such as an external occurrence/update ID,
  message ID, thread ID, correlation ID, and source occurrence time.

The currently supported principal-provenance classes are deliberately narrow:

- `explicit_local_argument` for the local CLI-style path; and
- `configured_surface_mapping` for a surface whose account/chat identity has already
  been mapped by deployment policy to the supported local principal.

The Telegram adapter in issue #86 uses `configured_surface_mapping` only after
filtering to one configured private chat. A surface account or transport address is
evidence about a principal, not semantic authority by itself. Principal and runtime
assertions are validated before an inbound occurrence is accepted into the ledger.
#87 owns stronger principal/privacy validation across the real CLI and Telegram
surfaces.

### Occurrence identity and replay

When a transport supplies a stable occurrence identity, the operational correlation
key is:

```text
(surface_id, external_occurrence_id)
```

A replay with the same key must match the previously established principal,
provenance, scope, payload digest, delivery destination, and associated transport
metadata. If it matches, it resolves to the same Ember occurrence and the same planned
cognition ID. It does not create another user-command evidence item, cognition
episode, instruction, authority grant, or delivery intent.

If the same transport key arrives with conflicting metadata, destination, or payload,
Ember rejects the replay as contradictory evidence instead of guessing which
representation is canonical. In particular, a replay cannot redirect an already
established reply destination.

When no stable external occurrence ID exists, no transport-level deduplication is
performed. Identical text is never proof of occurrence identity. Two identical CLI
lines are two occurrences; two messaging updates with distinct stable IDs are also
two occurrences. This is the executable form of AS-OPS-01 and AS-OPS-02.

Telegram concretely supplies `update_id` as the stable transport occurrence evidence;
its `message_id`, optional thread ID, source time, and configured reply destination
remain correlated operational metadata rather than alternate occurrence identity.

### Stable cognition handoff

The ledger allocates a cognition ID before invoking the existing cognition runner.
`runCognition` now accepts that ID optionally while preserving its previous default of
generating one itself.

The ordering is intentional:

1. validate the principal/runtime assertions;
2. establish and durably record the transport occurrence with a planned cognition ID;
3. create the canonical user evidence and cognition episode using that same ID; and
4. on transport replay, inspect canonical state for that ID before considering any
   new cognition.

If the process disappears after step 2 but before step 3, a later replay can safely
reuse the planned ID. If step 3 already happened, the replay does not invoke the
provider again. This prevents a transport retry from manufacturing a second semantic
request without requiring exactly-once transport delivery.

If cognition already completed but the process failed before its delivery intent was
persisted, a replay reconstructs the missing intent from the committed expression and
the occurrence's already-established surface/destination. It still does not repeat
cognition or automatically retry delivery; richer reconciliation remains #88 work.

## Outbound delivery

A completed provider-backed cognition first commits its Ember expression evidence.
Only after that commit does the interaction boundary create a delivery intent.
Delivery is therefore not part of the proof that cognition completed.

A delivery record contains:

- the cognition and expression evidence being represented;
- the chosen surface and optional destination;
- the time delivery became intended; and
- zero or more delivery attempts.

Each attempt has an observed outcome:

- `confirmed`: the boundary observed the configured delivery operation complete;
- `failed`: a transport adapter has definite evidence that this attempt failed; or
- `uncertain`: the delivery operation threw or disconnected after the attempt may
  have become externally visible.

`confirmed` is still transport evidence. It does not prove that a human read or
understood the expression. #88 owns richer reconnect, retry, acknowledgement, and
reconciliation policy.

The CLI-compatible output path records a delivery intent after expression commit and
a confirmed attempt after the output write completes. If the write throws, the
cognition remains completed while the delivery attempt is recorded as uncertain.

The Telegram adapter uses the same lifecycle. A successful `sendMessage` response is
`confirmed` and may retain Telegram's returned outbound `message_id` as operational
evidence; an explicit Bot API rejection is `failed`; network/protocol ambiguity is
`uncertain`. No Telegram-specific delivery truth bypasses this boundary.

## Operational ledger, not canonical memory

Transport occurrence and delivery records live in a sidecar operational document:

```text
<continuity-state-path>.interactions.json
```

The sidecar is durable because replay correlation and delivery uncertainty must
survive process boundaries. It is not canonical semantic memory:

- message, thread, update, correlation, and destination IDs are not Ember meanings;
- transport receipt count does not become autobiographical truth by itself;
- transport metadata is not automatically projected into cognition;
- deleting or rotating transport metadata must not redefine Ember identity; and
- a surface identifier never becomes the Ember lineage identifier.

The sidecar is written atomically with file and directory synchronization, following
the same local durability discipline as the continuity store. Its mutations are
expected to occur under the existing single-principal/single-writer lifecycle. The
Telegram worker preserves that assumption by acquiring the normal `StateStore` writer
lease only while processing one accepted update, never while idly long polling.

The ledger and canonical state are deliberately separate, so there is no claim of a
cross-file transaction. The ordering and stable cognition ID make inbound replay
idempotent across the important crash boundary. #88 owns reconciliation for richer
outbound retry/recovery gaps.

## CLI and Telegram messaging surface

The existing CLI behavior remains valid. A CLI-shaped caller uses the existing logical
surface `local_cli`, principal provenance `explicit_local_argument`, and no external
occurrence ID. Each submitted line is therefore a fresh occurrence even when text is
identical. Direct callers of `runCognition` retain `local_cli` as the compatibility
default.

The issue #86 Telegram adapter uses the same seam with logical surface `telegram_bot`,
`configured_surface_mapping`, a configured private-chat delivery destination, and
stable Telegram `update_id` occurrence evidence. Replayed updates resolve to the
already-established occurrence rather than reaching cognition twice. Telegram
chat/message/thread identifiers remain operational metadata and cannot replace Ember
principal, scope, lineage, memory, or authority semantics.

Telegram-specific parsing, Bot API long polling, token-file authentication, private
chat mapping, concrete `sendMessage` delivery, and systemd supervision live outside
this shared boundary in `src/surfaces/telegram.ts`, `bin/ember-telegram.ts`, the
Telegram runbook, and ADR 0008. They do not redefine occurrence identity, cognition
surface context, or the delivery lifecycle.

## Privacy and context selection

The surface boundary does not broaden cognition context. After occurrence
correlation, `runCognition` still calls Ember's existing projection builder with the
asserted principal, active scope, logical surface, current text, purpose, and
canonical state. The projection receives the logical surface so cognition never
falsely claims a Telegram-originated interaction came from `local_cli`; it does not
receive transport IDs or transport history.

This preserves ADR 0003 and AS-OPS-05: a reachable transport or richer transport
history cannot by itself justify disclosure of more Ember state. Recipient mapping,
privacy policy, and surface-appropriate disclosure remain explicit decisions. Issue
#87 now owns the next validation step against the concrete Telegram surface.

## Executable acceptance scenarios

The focused tests in `src/runtime/interaction-boundary.test.ts` instantiate existing
canonical operational scenarios without adding stronger semantics than the accepted
catalogue. `src/surfaces/telegram.test.ts` then exercises the same rules through the
concrete second transport.

| Scenario                                                                             | Expected result                                                                                                      | Canonical trace      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------- |
| SURF-85-01: identical CLI-shaped text is entered twice                               | Two occurrence IDs, two cognition episodes, two deliveries                                                           | AS-OPS-02            |
| SURF-85-02: one stable messaging update is replayed                                  | One occurrence, one user-command evidence item, one cognition, one delivery intent; receipt count records the replay | AS-OPS-01            |
| SURF-85-03: two stable messaging IDs carry identical text                            | Two occurrences and two cognitions                                                                                   | AS-OPS-02            |
| SURF-85-04: the same stable transport ID reappears with conflicting payload/metadata | Reject the conflicting replay; do not create a second cognition                                                      | AS-OPS-01, AS-OPS-02 |
| SURF-85-05: a principal assertion is rejected before acceptance                      | No occurrence and no cognition are established                                                                       | AS-OPS-05            |
| SURF-85-06: cognition completes and the output operation then fails                  | Cognition remains completed; delivery intent exists; attempt is `uncertain`                                          | AS-OPS-03, AS-OPS-06 |

AS-OPS-05 remains the governing privacy fixture for cross-surface delivery. The
implementation supports it by validating the principal before acceptance, keeping
transport metadata outside canonical meaning, and projecting only the logical surface
rather than transport-local IDs; #87 adds dedicated CLI/Telegram principal/privacy
acceptance coverage.

## Deliberate limits

The shared issue #85 boundary does not:

- derive a principal directly from an arbitrary transport account;
- make message/thread IDs canonical memory;
- deduplicate by text equality;
- promise exactly-once delivery;
- claim `confirmed` means the user observed the message;
- automatically retry an uncertain delivery;
- retain provider reply text inside transport metadata; or
- create a generic channel/plugin framework.

The concrete Telegram adapter added by #86 remains deliberately narrow: one configured
private chat, ordinary text messages, and no automatic uncertain-send retry. #87 owns
cross-surface principal/privacy validation, #88 owns reconnect/retry/recovery and
richer delivery uncertainty, and #89 owns end-to-end CLI/Telegram continuity
validation.

## Definition-of-done mapping

| Issue #85 requirement                                        | Repository outcome                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Explicit principal/surface provenance                        | `SurfaceInteractionOptions` requires `surfaceId` and `principalProvenance`; inbound records preserve both.                    |
| Replay correlation without text dedupe                       | Stable `(surface_id, external_occurrence_id)` correlation; no-ID inputs remain distinct regardless of text.                   |
| Duplicate transport occurrence does not duplicate semantics  | Stable planned cognition ID plus replay lookup suppresses duplicate user evidence, cognition, and delivery.                   |
| Delivery intent and outcome differ from cognition completion | Expression commits before intent; attempts separately record `confirmed`, `failed`, or `uncertain`.                           |
| Surface-local IDs remain operational                         | Message/thread/update/destination IDs stay in the interaction sidecar and never become canonical meanings or projection.      |
| Privacy/context remains Ember-owned                          | Existing `buildProjection` remains the context boundary; it receives only the logical surface, not transport-local metadata.  |
| CLI plus messaging without generic framework                 | CLI-shaped and Telegram cases use one narrow runtime seam with no transport registry/plugin hierarchy.                        |
| Telegram uses the seam without redefining semantics          | #86 supplies mapped principal/surface provenance, stable update metadata, destination, and concrete I/O around this boundary. |
