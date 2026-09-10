---
summary: "Issue #218 implementation contract for durable Ember-owned conversation trajectories across CLI, Telegram, process restarts, provider replacement, and explicit fresh-conversation boundaries."
read_when:
  - "Changing how conversation context continues across CLI, Telegram, runtime restart, or provider replacement"
  - "Changing conversation IDs, active trajectory persistence, fresh-conversation reset, or migration of the conversation sidecar"
  - "Debugging why recent dialogue did or did not participate in cognition after a surface or process boundary"
role: design
discovery_status: current
---

# Cross-Surface Conversation Continuity

> Status: current executable implementation contract for issue #218. The governing
> conversation semantics remain in
> [Conversation Context and Turn Semantics](conversation-context-turn-semantics.md).

## Purpose

Issue #217 introduced bounded recent-dialogue projection but deliberately selected
only exchanges from the same principal, scope, and surface. That was a safe temporary
mechanic, but it still made a surface transition behave like conversational amnesia.

Issue #218 removes that accidental ownership. Conversation identity is now represented
by an Ember-owned `conversation_id` persisted in the conversation sidecar. Runtime
IDs, provider thread/session IDs, CLI processes, Telegram chats, and logical surface
IDs remain operational provenance rather than conversation identity.

The current path is:

```text
accepted interaction
        ↓
resolve active Ember conversation for principal + scope
        ↓
select bounded exchanges carrying that conversation_id
        ↓
project source role/order/surface and uncertainty
        ↓
provider invocation
        ↓
record the new exchange in the same conversation
```

A clean runtime restart or a fresh provider invocation therefore does not create a
fresh conversation merely because operational machinery changed.

## Conversation sidecar v2

`<continuity-state-path>.conversation.json` is now schema version 2. It contains two
related but distinct structures:

- `active_trajectories`: the current Ember-owned conversation cursor for each supported
  principal/scope pair; and
- `exchanges`: bounded short-lived dialogue material, with each exchange explicitly
  carrying its `conversation_id` plus the source surface that supplied the turn.

The active trajectory is operational conversational state. It is durable enough to
survive process/provider replacement, but it is not canonical remembered meaning.
Its lifetime and bounded exchange payload remain governed by the transient-dialogue
semantics from the #216 design.

The current v2 persistence mechanic keeps one active trajectory per principal/scope
pair, but the store does **not** infer conversation membership from that pair.
`runCognition(...)` resolves an explicit membership intent above the store. Ordinary
adjacency may continue the active trajectory; an explicit boundary or an
ambiguous-discourse decision starts a different Ember-owned trajectory even when
principal, scope, surface, runtime, and provider are unchanged. The first interaction
creates an initial trajectory.

Principal/scope compatibility is therefore a safety boundary for candidate
continuation, not proof that arbitrary interactions belong to one conversation. The
current default policy uses ordinary adjacency when no stronger boundary signal is
supplied, matching the minimal heuristic permitted by #216. A future discourse router
can supply stronger continue/fresh decisions, split or resume multiple trajectories,
or preserve richer uncertainty without changing the persistence contract or promoting
surface IDs into semantic identity.

## Cross-surface continuation

CLI and Telegram can now participate in the same recent conversation when they use the
same permitted principal and scope and no explicit fresh-conversation boundary has
intervened.

The projected turns retain `source_surface`, so crossing a surface does not erase
provenance. What changes is only the selector: it follows `conversation_id` rather
than requiring surface equality.

This does not widen disclosure. A different principal/scope pair resolves a different
active trajectory, and the ordinary canonical projection still performs its existing
scope/currentness selection independently of conversational context.

Telegram update IDs, message IDs, thread IDs, and configured chat mappings remain in
the interaction boundary where they already serve replay, provenance, and delivery
truth. None of them becomes a conversation ID.

## Clean restart and provider replacement

The active conversation cursor and bounded dialogue material live outside the runtime
process. A clean stop followed by a newly constructed `StateStore`, a fresh runtime
episode, and another provider invocation can therefore select the same
`conversation_id` and recent turns.

Provider-native thread/session identifiers remain optional operational evidence. They
are neither consulted when resolving the active conversation nor required for
continuation. This keeps provider replacement from becoming a semantic reset and
prevents hidden provider history from becoming the only source of continuity.

An interrupted cognition remains truthful under the same rule. If an inbound user turn
was durably accepted but no Ember expression was established, the later conversation
may contain that user turn without inventing an Ember reply. Delivery status and user
awareness on established Ember expressions retain their existing uncertainty rather
than being upgraded merely because the conversation continued.

## Explicit fresh conversation

Starting a fresh conversation advances only the active conversation cursor for the
selected principal/scope pair:

```text
conversation-A (historical exchanges remain)
        ↓ explicit reset
conversation-B (active, initially empty transient context)
```

`ConversationContextStore.startFreshConversation(...)` is the surface-neutral host
operation. The CLI exposes it as:

```text
:new-conversation
```

The operation does **not**:

- delete prior conversation exchanges merely to make them inactive;
- delete canonical evidence;
- delete, supersede, or rewrite canonical meanings/preferences/relationship state;
- alter Ember lineage;
- change runtime identity, provider identity, or surface identity; or
- require a new process.

Consequently, the first cognition in the new trajectory receives an empty transient
conversation slice from the prior trajectory while ordinary eligible canonical memory
continues to participate through the existing projection rules.

A reset performed through one host surface affects later compatible surfaces because
the cursor belongs to Ember's conversation sidecar, not to the surface that requested
the reset.

## Migration from sidecar v1

Version 1 stored exchanges without an Ember-owned conversation ID and selected them by
principal, scope, and surface. Migration must therefore avoid claiming stronger
historical correlation than v1 evidence established.

The loader deterministically maps each legacy principal/scope/surface history to a
separate legacy conversation ID. For a principal/scope pair, the trajectory containing
the most recently accepted legacy exchange becomes active. Older legacy surface
histories remain separate rather than being silently merged.

The next accepted exchange writes the sidecar in v2 form. From that point onward, a
surface transition can continue the selected active Ember trajectory normally.

This migration is deliberately conservative: it preserves known v1 separation while
allowing v2 continuity prospectively.

## Inspection and invariants

The provider-facing `conversation_context` now carries `context_version: 2`, the
selected `conversation_id`, and inspectable membership metadata describing whether the
trajectory was continued or started and on what Ember-owned policy basis. Selection
metadata uses `recent_same_conversation_v2`. Individual turns continue to expose their source
surface, role, evidence/cognition correlation, delivery status, awareness uncertainty,
and truncation state.

The implementation maintains these invariants:

1. A conversation ID never crosses principal or scope boundaries.
2. At most one trajectory is active for one principal/scope pair.
3. Surface/runtime/provider identifiers never define conversation identity.
4. A fresh-conversation operation advances the active cursor instead of erasing
   historical canonical evidence or meaning.
5. Recent-dialogue selection remains bounded and deterministic for deterministic
   state and sidecar input.
6. An unavailable or unestablished expression cannot become a fabricated Ember turn.
7. Legacy v1 surface histories are not silently merged during migration.

## Validation

`tests/recent-dialogue-projection.test.ts` covers:

- ordinary second-turn reference context;
- provider failure without an invented Ember turn, including continuation through a
  different surface;
- deterministic ordering, boundedness, and UTF-8 payload truncation;
- CLI-shaped to Telegram-shaped continuation with source-surface provenance;
- clean process/store/runtime replacement while retaining the same conversation;
- explicit fresh-conversation reset with empty transient context and retained eligible
  canonical meaning/evidence; and
- conservative deterministic migration from the v1 surface-local sidecar.

These tests exercise the conversation seam directly. Existing concrete surface tests
continue to own Telegram transport identity, replay, destination, and delivery
semantics; issue #218 does not redefine those contracts.
