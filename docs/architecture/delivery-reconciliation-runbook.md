---
summary: "Transport-neutral runbook for durable outbound delivery intent, restart reconciliation, retryable failure, uncertain sends, and inbound acknowledgement after cognition commit."
read_when:
  - "Changing messaging delivery retry, reconnect, restart, or acknowledgement behavior"
  - "Debugging pending, failed, uncertain, or replayed surface delivery"
role: guide
discovery_status: current
---

# Delivery Reconciliation Runbook

> Status: current transport-neutral recovery policy from issue #88. Telegram maps its
> concrete Bot API evidence into these states, but Telegram-specific error prose does
> not define Ember delivery truth.

## Purpose

A completed cognition, an attempted external send, and a confirmed delivery are three
separate facts. Restart or reconnect must preserve those distinctions rather than
turning missing observations into success, failure, or permission to retry.

This runbook extends the interaction boundary from issue #85 using the same epistemic
discipline as ADR 0005 and process-loss recovery from issue #83:

- durable observations may justify a stronger claim;
- absence of an observation is not evidence of the opposite outcome; and
- `uncertain` is a blocked state, not an implicit retry instruction.

## Durable checkpoints

For a provider-backed surface response, the supported ordering is:

1. cognition completes and canonical expression evidence is committed;
2. the exact outbound representation is retained in the operational interaction
   ledger as part of the delivery intent;
3. a delivery attempt is durably recorded as `started` before crossing the external
   transport boundary;
4. the transport operation runs; and
5. the attempt is completed as `confirmed`, `failed`, or `uncertain` when such an
   observation is available.

The retained representation is operational recovery state, not canonical memory. It
exists so a later retry can send the same committed result without running cognition
again. Operator inspection exposes only representation availability and content
digest, never the retained text itself.

## Attempt outcomes

`started` means Ember durably recorded that an external send was about to be attempted,
but no terminal observation has been committed yet. If a process restarts with a
latest `started` attempt, reconciliation converts that boundary to `uncertain`. It does
not resend automatically because the external effect may already have occurred.

`confirmed` means the configured transport operation returned evidence of acceptance.
It may include an external message identifier. It does not mean the human recipient
read or understood the message.

`failed` means the adapter has definite evidence that this attempt did not succeed.
A failed attempt is retryable only when the adapter explicitly supplies that fact.
Optional retry-delay evidence is retained independently of transport-specific wording.

`uncertain` means Ember cannot establish whether the external effect happened. Network
loss after request submission, process loss after a `started` checkpoint, unreadable
or contradictory transport acknowledgement, and similar ambiguous boundaries must
remain uncertain until stronger external evidence exists.

## Reconciliation decision

Reconciliation always refers to the original delivery intent and original retained
representation. It never creates a second cognition merely to recover transport state.

The decision order is:

- canonical cognition already `displayed`: return `confirmed`; do not send;
- latest attempt `started`: record `uncertain`; do not send;
- latest attempt `confirmed`: reconcile canonical `delivery_status` to `displayed`;
  do not send;
- latest attempt `uncertain`: return `blocked_uncertain`; do not send;
- latest attempt definite non-retryable `failed`: return `failed_non_retryable`;
- retained representation unavailable: return `blocked_missing_representation`;
- retryable failure with a future retry time: return `retry_later`;
- retryable failure whose delay has elapsed, or an intent with no prior attempt:
  create a new `started` attempt and send the retained representation.

A retry that itself becomes uncertain is blocked exactly like any other uncertain
attempt. There is no retry loop that converts repeated ambiguity into confidence.

## Inbound acknowledgement and replay

Inbound acknowledgement and outbound delivery are intentionally decoupled after
cognition becomes durable.

If an accepted inbound occurrence has produced durable cognition and delivery intent,
a definite or uncertain outbound failure does not require replaying the inbound update
as a retry mechanism. The transport worker may advance its inbound acknowledgement
checkpoint while the outbound delivery remains pending in the interaction ledger.

If the transport nevertheless replays the same stable inbound occurrence, the
existing `(surface_id, external_occurrence_id)` correlation still resolves to the same
occurrence and cognition. Identical text alone remains insufficient evidence of
replay identity.

## Telegram mapping

Telegram is one adapter onto this state machine:

- successful `sendMessage` with a valid returned `message_id` becomes `confirmed`;
- an explicit non-retryable Bot API rejection becomes definite `failed`;
- Bot API flood control with a valid `parameters.retry_after` becomes definite
  retryable `failed` with a transport-neutral retry delay;
- network loss, server-side ambiguity, malformed acknowledgement, or interruption
  after request submission becomes `uncertain`.

Long polling may therefore advance `offset` after the inbound update produced durable
cognition even when outbound delivery failed. Redelivery is driven from the durable
outbound intent, not by asking Telegram to replay the user message.

## Restart procedure

A recovery owner must hold the normal cooperating `StateStore` writer lease before
reconciling delivery state. This preserves the same single-writer rule as ordinary
surface processing.

For each pending delivery owned by the surface:

1. load canonical state and interaction ledger;
2. validate that the delivery refers to the matching completed cognition and
   expression evidence;
3. classify the latest durable attempt using the decision order above;
4. retry only a definite retryable failure whose delay has elapsed;
5. never retry `uncertain` automatically; and
6. if confirmed delivery exists while canonical status is still `pending`, reconcile
   canonical status to `displayed` without sending again.

The current Telegram helper applies this procedure only to Telegram deliveries whose
canonical cognition remains pending and whose destination still matches the configured
private chat.

## Inspection

`ember inspect --json` exposes occurrence metadata, delivery intent, attempt timing,
outcome, retryability, retry delay, and external message IDs. A retained representation
is rendered only as:

```json
{
  "available": true,
  "content_digest": "sha256:..."
}
```

The payload itself stays out of operator inspection and provider cognition context.
This keeps restart recovery possible without turning the interaction sidecar into a
second user-visible transcript or canonical memory store.

## Failure and crash boundaries

The following distinctions are deliberate:

- crash before delivery intent exists: inbound replay may reconstruct intent from the
  already completed cognition, but must not repeat cognition;
- crash after intent but before `started`: reconciliation may safely attempt the
  retained representation because no send boundary was durably entered;
- crash after `started` but before terminal observation: mark `uncertain` and block
  automatic resend;
- definite retryable failure: retain the same intent and representation and retry only
  when allowed by explicit retry evidence;
- confirmed transport result before canonical `displayed` commit: reconcile canonical
  status from the confirmed ledger without sending again.

These are at-least-once transport realities represented truthfully. Ember does not
claim exactly-once delivery.

## Deterministic confidence

Repository tests cover:

- stable inbound replay without duplicate cognition or response;
- distinct occurrences for identical text with different transport identities;
- definite retryable failure surviving process restart;
- redelivery of the exact retained representation without another provider call;
- process loss after `started` becoming `uncertain` without resend;
- confirmed sidecar evidence reconciling canonical pending delivery without resend;
- migration of legacy interaction ledgers without inventing missing representations;
- CLI inspection redacting retained payload text;
- Telegram flood-control delay gating redelivery;
- outbound failure not preventing durable inbound acknowledgement; and
- uncertain Telegram delivery remaining blocked during reconciliation.

Run the normal repository checks:

```bash
npm run check
npm test
```

## Deliberate limits

This policy does not provide exactly-once delivery, recipient read receipts, automatic
resolution of uncertain sends, generic multi-transport scheduling, multi-message
chunk reconciliation, or a second canonical transcript. A future adapter may provide
stronger external reconciliation evidence, but it must map that evidence into the same
transport-neutral truth states rather than weakening them.
