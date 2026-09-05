---
summary: "Current interaction boundary for principal-aware CLI/Telegram input, least-sufficient cross-surface context, transport occurrence correlation, and delivery provenance without making surface metadata semantic authority or canonical memory."
read_when:
  - "Adding or changing an interaction surface such as CLI or messaging"
  - "Changing transport replay deduplication, surface principal provenance, cross-surface privacy, context scope, inspection, or delivery attempt/outcome semantics"
role: design
discovery_status: current
---

# Interaction Surface Boundary

> Status: current design and executable seam from issue #85, exercised by Telegram in
> issue #86 and hardened across the real CLI and Telegram surfaces by issue #87.
> Telegram-specific runtime ownership is recorded separately in
> [ADR 0008](decisions/0008-add-systemd-supervised-telegram-transport-worker.md).

## Purpose

A surface is a window onto one continuing Ember, not an owner of identity, memory,
authority, or continuity. A transport update is likewise not automatically a new
semantic occurrence merely because it was received again.

This boundary applies the existing semantics from ADR 0001, ADR 0003, ADR 0004, ADR
0005, [Operational Model, Sessions, and Surfaces](../research/operational-model-sessions-and-surfaces.md),
and the existing AS-OPS-01/02/05/06 acceptance scenarios. It also consumes the
transport-independent interruption decision from
[Endogenous User Interruption Decision](endogenous-interruption-decision.md): a
`deliver` decision permits a later delivery attempt, but cognition completion and
user delivery remain separate facts.

Issue #85 itself added no resident channel framework and no new owner of Ember
continuity. Issue #86 later supplied concrete evidence for one resident Telegram
_transport_ worker under ADR 0008 while preserving this boundary's ownership rules:
canonical work remains short-lived and writer-lease bounded. Issue #87 does not add a
new authorization framework; it makes the already-required principal, ordinary-scope
privacy, and delivery distinctions executable across both current surfaces.

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

- `explicit_local_argument` for the local CLI path; and
- `configured_surface_mapping` for a surface whose account/chat identity has already
  been mapped by deployment policy to the supported local principal.

The production CLI now invokes this boundary directly for ordinary cognition and
`:ask --explain`, so its asserted principal is represented with
`explicit_local_argument` rather than existing only as an implicit caller convention.
The Telegram adapter uses `configured_surface_mapping` only after filtering to one
configured private chat.

A surface account, chat ID, transport address, session, or device is evidence about a
principal. It is not semantic authority by itself. The configured Telegram chat can
therefore prove that an update arrived through the deployment mapping, but it cannot
manufacture a different Ember principal or widen ordinary context selection. A
configured principal that does not match the initialized continuity state's local
principal is rejected before Telegram input becomes an accepted interaction
occurrence.

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
`runCognition` accepts that ID optionally while preserving its previous default of
generating one itself for direct lower-level callers.

The ordering is intentional:

1. validate the principal/runtime assertions;
2. establish and durably record the transport occurrence with a planned cognition ID;
3. build the projection using the existing cognition purpose and selection semantics;
4. create canonical user evidence and cognition using that same ID only after the
   projection is valid; and
5. on transport replay, inspect canonical state for that ID before considering any
   new cognition.

If the process disappears after step 2 but before canonical cognition is established,
a later replay can safely reuse the planned ID. If cognition already happened, the
replay does not invoke the provider again. This prevents a transport retry from
manufacturing a second semantic request without requiring exactly-once transport
delivery.

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

The production CLI uses the same lifecycle as Telegram. A local output write creates a
delivery intent after expression commit and records a confirmed attempt after the
write completes; an output failure remains uncertain. The CLI has no external
transport destination ID, so its delivery destination is `null` rather than a fake
terminal/session identity.

The Telegram adapter records a successful `sendMessage` response as `confirmed` and
may retain Telegram's returned outbound `message_id` as operational evidence; an
explicit Bot API rejection is `failed`; network/protocol ambiguity is `uncertain`. No
Telegram-specific delivery truth bypasses this boundary.

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
lease only while processing one accepted update, never while idly long polling. The
interactive CLI already holds that same writer lease while accepting local input.

The ledger and canonical state are deliberately separate, so there is no claim of a
cross-file transaction. The ordering and stable cognition ID make inbound replay
idempotent across the important crash boundary. #88 owns reconciliation for richer
outbound retry/recovery gaps.

### Inspection and explanation

`ember inspect --state ... --principal ...` now exposes the interaction sidecar next
to canonical inspection data. The operational section makes it possible to answer:

- which logical surface accepted an occurrence;
- which Ember principal was asserted and whether that assertion came from an explicit
  local argument or configured surface mapping;
- which external occurrence/destination metadata was correlated without promoting it
  to memory;
- whether a delivery was intended; and
- which attempts were confirmed, failed, or uncertain and which external outbound
  message ID, if any, was observed.

Inspection is an operator view of durable evidence, not cognition context. Making
transport provenance inspectable does not make it automatically available to a
provider projection.

The existing explicit CLI explanation paths retain their established semantics. In
particular, #87 does not globally reinterpret an explicitly requested explanation ID
as ordinary surface scope selection. Telegram currently exposes only ordinary text
cognition, not a remote `:ask --explain` command, so no transport mapping gains that
explicit diagnostic expansion implicitly.

## CLI and Telegram messaging surface

The production CLI uses logical surface `local_cli`, principal provenance
`explicit_local_argument`, and no external occurrence ID. Each submitted cognition
line is therefore a fresh occurrence even when text is identical. `:ask --explain`
uses the same occurrence/delivery boundary while retaining the pre-existing explicit
explanation selection semantics. Direct lower-level callers of `runCognition` retain
`local_cli` as the compatibility default.

The Telegram adapter uses logical surface `telegram_bot`,
`configured_surface_mapping`, a configured private-chat delivery destination, and
stable Telegram `update_id` occurrence evidence. Replayed updates resolve to the
already-established occurrence rather than reaching cognition twice. Telegram
chat/message/thread identifiers remain operational metadata and cannot replace Ember
principal, scope, lineage, memory, or authority semantics.

Telegram-specific parsing, Bot API long polling, token-file authentication, private
chat mapping, concrete `sendMessage` delivery, and systemd supervision live outside
this shared boundary in `src/surfaces/telegram.ts`, `bin/ember-telegram.ts`, the
Telegram runbook, and ADR 0008. They do not redefine occurrence identity, cognition
surface context, ordinary context selection, or the delivery lifecycle.

## Privacy and context selection

The surface boundary does not broaden cognition context merely because one transport
carries richer metadata. `runCognition` calls Ember's projection builder with the
asserted principal, active scope, logical surface, current text, purpose, and canonical
state. The projection receives the logical surface so cognition never falsely claims
a Telegram-originated interaction came from `local_cli`; it does not receive transport
IDs or transport history.

For ordinary cognition, the active scope remains the selection boundary independently
of transport. A meaning available to CLI cognition in one scope is not automatically
available to a Telegram interaction running in another scope merely because both
surfaces belong to the same continuing Ember. Conversely, when CLI and Telegram
deliberately use the same scope, ordinary projection selection is governed by the same
semantic rules; Telegram's richer update/chat/message metadata does not expand the
selected meaning set.

The concrete attempted-over-disclosure fixture makes the distinction explicit: a
valid, mapped Telegram message can literally name the ID of a canonical meaning from a
different scope and ask for it to be revealed. The request text is preserved as the
current input, but ordinary selection still excludes that meaning and its content.
Knowing an identifier, arriving through a recognized chat, and asking for more context
are evidence of user intent, not mechanisms that silently rewrite ordinary projection
policy.

This is the issue #87 application of ADR 0003 and ADR 0004 without changing the
existing explicit explanation contract: technical access, richer transport history,
or a recognized Telegram chat cannot create ordinary disclosure authority. Surface
identity and transport history remain evidence, while principal and projection policy
remain Ember-owned inputs.

## Executable acceptance scenarios

The focused tests in `src/runtime/interaction-boundary.test.ts` instantiate the issue
#85 transport semantics. `src/surfaces/telegram.test.ts` exercises those rules through
the concrete Telegram adapter. `tests/cross-surface-semantics.test.ts` now validates
the same principal/privacy/delivery invariants across both real logical surfaces.

| Scenario                                                                             | Expected result                                                                                                      | Canonical trace      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | -------------------- |
| SURF-85-01: identical CLI-shaped text is entered twice                               | Two occurrence IDs, two cognition episodes, two deliveries                                                           | AS-OPS-02            |
| SURF-85-02: one stable messaging update is replayed                                  | One occurrence, one user-command evidence item, one cognition, one delivery intent; receipt count records the replay | AS-OPS-01            |
| SURF-85-03: two stable messaging IDs carry identical text                            | Two occurrences and two cognitions                                                                                   | AS-OPS-02            |
| SURF-85-04: the same stable transport ID reappears with conflicting payload/metadata | Reject the conflicting replay; do not create a second cognition                                                      | AS-OPS-01, AS-OPS-02 |
| SURF-85-05: a principal assertion is rejected before acceptance                      | No occurrence and no cognition are established                                                                       | AS-OPS-05            |
| SURF-85-06: cognition completes and the output operation then fails                  | Cognition remains completed; delivery intent exists; attempt is `uncertain`                                          | AS-OPS-03, AS-OPS-06 |

Issue #87 adds the following concrete cross-surface fixtures:

| Scenario                                                               | Expected result                                                                                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| SURF-87-01: CLI and Telegram use the same principal and ordinary scope | Both projections select the same scope-governed meanings; only logical `surface` and current input differ                       |
| SURF-87-02: Telegram carries update/chat/message history               | Transport IDs remain in the interaction ledger and do not expand or appear in cognition projection                              |
| SURF-87-03: configured chat is paired with a different Ember principal | Reject before provider invocation, accepted occurrence, cognition, or delivery                                                   |
| SURF-87-04: mapped Telegram input names an out-of-scope meaning ID      | Request text is visible, but the named meaning and its private content remain absent from ordinary cognition projection          |
| SURF-87-05: operator inspects interactions after CLI and Telegram use   | Inspection shows surface/principal provenance, destination, delivery intent, attempt outcome, and external receipt when known   |

AS-OPS-05 remains the governing privacy fixture for cross-surface delivery. The
implementation validates the principal before acceptance, keeps transport metadata
outside canonical meaning, preserves ordinary scope selection at projection time, and
makes operational provenance inspectable without injecting it into provider context.

## Deliberate limits

The shared boundary does not:

- derive a principal directly from an arbitrary transport account;
- claim one recognized device/chat proves a human is exclusively present forever;
- make message/thread IDs canonical memory;
- deduplicate by text equality;
- promise exactly-once delivery;
- claim `confirmed` means the user observed the message;
- automatically retry an uncertain delivery;
- retain provider reply text inside transport metadata;
- add per-surface copies of canonical memory;
- redefine the existing explicit explanation-selection contract; or
- create a generic channel/plugin or general-purpose authorization framework.

The concrete Telegram adapter remains deliberately narrow: one configured private
chat, one existing local principal, one configured active scope, ordinary text
messages, and no automatic uncertain-send retry. #88 owns reconnect/retry/recovery and
richer delivery uncertainty, and #89 owns end-to-end CLI/Telegram continuity
validation.

## Definition-of-done mapping

| Issue #87 requirement                                        | Repository outcome                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Principal assertion/resolution explicit for CLI and Telegram | Production CLI uses `explicit_local_argument`; Telegram uses `configured_surface_mapping`; both resolve to the initialized local principal.     |
| Surface identity is not semantic authority                   | Matching Telegram transport identity cannot manufacture a different Ember principal or bypass ordinary projection selection.                   |
| Least-sufficient privacy remains transport-independent       | Both surfaces use `buildProjection`; same ordinary scope yields the same selected meanings and transport metadata adds nothing.                 |
| Attempted over-disclosure fails closed                       | Telegram may name an out-of-scope meaning ID in current input, but ordinary projection excludes the meaning and its private content.            |
| Delivery provenance remains distinct                         | Interaction ledger keeps destination, delivery intent, attempt, outcome, and optional external outbound message ID separately from cognition.   |
| Inspection explains relevant provenance                      | `ember inspect` includes operational occurrences and deliveries with surface, principal provenance, destinations, and observed attempt results. |
| Deployment mapping stays configurable without committed IDs  | Telegram mapping remains local configuration (`principal`, `active_scope`, `chat_id`); no real personal identifier is committed in repository.  |
