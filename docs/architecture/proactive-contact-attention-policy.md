---
summary: "Issue #227 Ember-owned gate for currentness, authority, quiet-window, duplicate, and surface-eligibility decisions before proactive contact handoff."
read_when:
  - "Changing whether a pending or deferred proactive-contact intent may interrupt the principal"
  - "Adding quiet periods, duplicate suppression, currentness revalidation, or surface selection for proactive contact"
  - "Bridging a proactive-contact intent into delivery without moving interruption policy into Telegram or another transport"
role: design
discovery_status: current
---

# Proactive-Contact Attention Policy

## Purpose

Issue [#227](https://github.com/arhor/ember/issues/227) implements the Ember-owned
gate between a durable [proactive-contact intent](proactive-contact-intent.md) and a
later surface delivery handoff. The gate decides whether one live intent may
interrupt the principal now, should remain live for reconsideration, or should be
closed without handoff.

The boundary is deliberately surface-neutral:

```text
pending or deferred proactive-contact intent
                    +
      current Ember semantic state
                    +
 current authority and attention evidence
                    +
 occurrence / duplicate evidence
                    +
 generic eligible-surface observations
                    |
                    v
        admit | defer | suppress
                    |
           admit only: selected
          generic surface identity
                    |
                    v
    later delivery handoff and reconciliation
```

An `admit` result permits a later owner to create or bind a delivery occurrence. It
does not send a message, reserve attention, prove delivery, or satisfy the contact
intent. `defer` and `suppress` are first-class decisions to remain silent now.

## Executable boundary

`src/agency/proactive-contact-attention-policy.ts` exposes
`decideProactiveContactAttention`. It is a pure policy function over:

- current validated `EmberState`;
- a `pending` or `deferred` `ProactiveContactIntentSnapshot`;
- a caller-supplied stable assessment identity and assessment time;
- explicit current authority, attention-window, occurrence, and generic surface
  evidence.

The function does not mutate canonical state or persist an intent transition. It
returns a complete `ContactAttentionDecisionRecord` for the durable intent owner to
commit before any admitted handoff. Keeping computation pure makes deterministic
replay possible while keeping durable ordering and crash consistency with the owner
of the intent ledger.

The input snapshot carries the least policy-relevant part of the issue #226 intent:
stable identity, live disposition, principal and scope, creation and source
revision, grounding, urgency and expiry, representation digest/currentness, and an
optional named successor. It contains no provider session, Telegram chat, transport
message, or delivery-attempt identity.

## Decision record and evidence

Every result preserves:

- caller-supplied `assessment_id`, contact-intent ID, assessment time, source
  revision, and the current Ember revision used for revalidation;
- one enumerated `outcome` and `basis` rather than generated rationale prose;
- whether the present result is `interrupt` or `remain_silent`;
- a selected generic surface only for `admit`;
- the quiet-window end as `reconsider_after` when quiet time caused deferral; and
- snapshots of grounding, representation, authority, attention, occurrence,
  surface, and supersession evidence used by the decision.

Evidence identifiers must be explicit, non-empty, and unique within each input.
The policy result copies the evidence rather than retaining mutable caller-owned
arrays. A durable owner can therefore record exactly what justified a transition
without promoting policy evidence into canonical memory or treating hidden model
reasoning as rationale.

## Evaluation order

The gate uses a conservative deterministic order:

1. Validate the state, live intent snapshot, policy assessment, timestamps,
   grounding, urgency, and evidence shapes.
2. Suppress a predecessor when a named successor is already established.
3. Suppress an expired intent or one whose semantic grounding is no longer current,
   applicable in scope, or live.
4. Suppress a representation known to be stale; defer when representation
   currentness is unknown.
5. Suppress denied authority and defer unknown authority.
6. Suppress a provenance-confirmed duplicate; defer when occurrence identity is
   uncertain.
7. Defer ordinary contact during a bounded quiet period. Explicitly grounded
   time-sensitive contact may continue through the remaining checks.
8. Select the lowest-ranked eligible generic surface, with surface identity as a
   deterministic tie-breaker. Defer if no surface is currently eligible.
9. Admit only after every preceding check passes.

This order ensures that a convenient surface or apparent urgency cannot rescue a
stale, unauthorized, duplicated, or superseded contact occurrence.

## Currentness before interruption

Every assessment reconciles the old intent against the supplied current Ember
state. The policy does not treat equality between `source_revision` and the current
revision as proof of applicability, nor does a later revision automatically make
the intent stale.

Instead, all grounding meanings must still:

- be `current`;
- belong to the intent's scope;
- apply at `considered_at`; and
- remain `live` when the grounding is a commitment.

The policy also checks explicit expiry and representation currentness. Known stale
grounding, expiry, or representation suppresses the exact intent. Unknown
representation currentness defers instead of inventing confidence. The decision
records both source and current revisions so inspection can establish that a fresh
assessment occurred after time or state changed.

## Quiet periods and attention windows

Attention is an operational input, not a semantic fact about the concern. A quiet
period has a stable window ID, inclusive start, exclusive end, and attributable
evidence. The assessment time must fall inside that window.

Ordinary contact during the window yields `defer / quiet_period`, remains silent,
and records the window end for bounded reconsideration. Time-sensitive contact may
continue only when urgency has explicit grounding inside the intent's grounding
set. Urgency does not bypass currentness or authority.

An `available` attention observation has evidence too. It means only that the
attention-window check does not require deferral; it does not establish authority,
surface suitability, or delivery success.

## Duplicate and supersession handling

Duplicate assessment is provenance-based:

- `confirmed_duplicate` names the related intent and suppresses this occurrence;
- `identity_uncertain` names the possibly related intent and defers because the
  policy cannot safely invent sameness or distinctness; and
- `distinct` carries evidence that no related duplicate identity is being asserted.

Text or representation equality is not accepted as occurrence identity by this
function. The caller must derive the assessment from stable domain correlation,
ledger identity, or other attributable occurrence evidence.

A named successor is stronger than a duplicate hint: it suppresses the predecessor
as `superseded_intent`. This policy does not create the successor or perform the
delivery fence required when a predecessor was already handed off. Those lifecycle
rules remain owned by the proactive-contact intent and delivery reconciler.

## Surface eligibility is not authority

Surface observations use opaque `surface_id` values plus preference rank, status,
and evidence. The policy understands only:

- `eligible` — currently suitable for selection;
- `temporarily_unavailable` — not selectable now, but not a semantic denial; and
- `ineligible` — not suitable under current routing/privacy policy.

An eligible or preferred surface cannot manufacture contact authority. Authority is
checked independently and first. Likewise, the absence of an eligible surface
defers the semantic intent rather than suppressing its underlying reason or creating
a transport retry.

The selected surface ID is routing evidence for the later handoff. It is not a
recipient identity, privacy grant, Telegram chat ID, availability promise, or proof
that a delivery owner accepted responsibility.

## Executable scenarios

`src/agency/proactive-contact-attention-policy.test.ts` deterministically covers:

1. admission with preference-ranked generic eligible surfaces;
2. ordinary-contact deferral through the end of a bounded quiet period;
3. replay-stable suppression of a provenance-confirmed duplicate;
4. suppression of an intent with a named successor;
5. fresh grounding revalidation after the underlying commitment becomes fulfilled;
6. deferral when all surfaces are unavailable;
7. authority remaining unknown despite an eligible surface; and
8. grounded time-sensitive contact continuing through a quiet-period check.

The tests use no provider, network, Telegram identifier, wall-clock dependency, or
transport implementation.

## Relationship to adjacent work

- The [endogenous interruption decision](endogenous-interruption-decision.md)
  decides whether completed internal cognition supplies a contact candidate. A
  warranted candidate becomes one durable intent before this policy runs.
- The [proactive-contact intent contract](proactive-contact-intent.md) owns stable
  intent identity, lifecycle, restart reconciliation, satisfaction, supersession,
  and separation from delivery truth.
- Issue #228 owns committing an admitted handoff into a correlated Telegram
  delivery occurrence and reconciling its attempts and outcomes.
- The [delivery reconciliation runbook](delivery-reconciliation-runbook.md) owns
  delivery uncertainty, retries, acknowledgement, and recovery after handoff.

This issue does not define quiet-hour configuration UX, a notification budget,
Telegram reachability, intent-ledger persistence, transport retry, or generic
delivery scheduling.

## Acceptance mapping

| Issue #227 criterion                     | Implemented evidence                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admit, defer, or suppress with rationale | Typed outcomes and enumerated bases return a complete assessment record with copied currentness, authority, attention, occurrence, surface, and supersession evidence.        |
| Deterministic quiet and duplicate cases  | Bounded quiet windows, provenance-classified occurrence inputs, deterministic evaluation order, and replay assertions are covered by the focused unit suite.                  |
| Re-evaluate stale intents                | Every assessment checks current meanings, applicability, live commitments, expiry, and representation currentness while recording source and assessment revisions.            |
| Telegram does not own policy             | The module is under `src/agency/`, accepts opaque surface IDs, imports no surface or transport module, and only returns permission for a later handoff.                       |
| Silence remains first-class              | Every `defer` and `suppress` record explicitly returns `remain_silent`; quiet deferral additionally records a bounded reconsideration time instead of losing the live intent. |
