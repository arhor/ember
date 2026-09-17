---
summary: "Issue #226 contract for durable, surface-independent proactive-contact intent identity, evidence, lifecycle, restart reconciliation, deduplication, and separation from delivery truth."
read_when:
  - "Creating or changing the durable intent produced when endogenous cognition concludes that the principal should be contacted"
  - "Bridging proactive contact through attention policy into a messaging delivery without conflating intent, handoff, attempt, and delivery"
  - "Reconciling deferred, handed-off, duplicated, superseded, or uncertain proactive contact after restart"
role: design
discovery_status: current
---

# Durable Proactive-Contact Intent Semantics

## Purpose

Issue [#226](https://github.com/arhor/ember/issues/226) defines the Ember-owned
semantic object created after completed cognition concludes that contacting the
principal is warranted. It is the durable boundary between that conclusion and the
attention, surface-selection, delivery, and reconciliation work owned by later
issues in [epic #225](https://github.com/arhor/ember/issues/225).

The governing distinction is:

> **A proactive-contact intent records one still-current reason to offer a bounded
> representation to an intended principal. It is not a message, a delivery attempt,
> evidence of delivery, or proof that the principal became aware of it.**

This follows ADR 0005's separation of semantic occurrence, representation, delivery,
external effect, and current applicability. It also preserves the existing
[endogenous interruption decision](endogenous-interruption-decision.md): internal
cognition may conclude that no contact is appropriate, and even a warranted contact
must pass later authority, attention, and currentness policy before handoff.

## Boundary and decision result

The contact-decision boundary consumes completed cognition rather than a wake-up or
an opportunity's preliminary `cognition` decision. Its result is exactly one of:

- `no_contact`: a successful decision that the cognition should remain private or
  that contact is not currently warranted; or
- `create_intent`: one validated proactive-contact intent is committed before any
  surface or delivery operation begins.

`no_contact` creates no empty, closed, or synthetic intent. When inspection or
evaluation needs durable evidence of deliberate silence, the source cognition's
decision record may retain `no_contact`, its currentness basis, and a bounded
enumerated basis such as `private_only`, `insufficient_value`, `already_satisfied`,
or `not_current`. Absence of an intent alone does not establish deliberate silence:
it could also mean that contact evaluation never ran, failed, or was interrupted.

The two positive commits are ordered:

```text
completed endogenous cognition
          |
          v
 contact decision: no_contact -----------------> successful silence
          |
          v
 durable proactive-contact intent (pending)
          |
          v
 attention + authority + currentness policy
      /           |                 \
 deferred     suppressed        eligible handoff
                                      |
                                      v
                         surface delivery intent + attempts
```

Creating the semantic intent does not choose Telegram, prove interruption authority,
reserve human attention, or authorize disclosure. Those are later decisions made
against the intent's preserved principal, scope, evidence, and currentness basis.

## Required semantic responsibilities

A proactive-contact intent preserves at least:

| Responsibility                | Meaning                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable identity               | One Ember-owned `contact_intent_id` for this contact occurrence, independent of provider, process, thread, surface, transport, message identifier, or rendering text.                                                                                         |
| Purpose                       | A bounded, inspectable account of why contact may serve the principal and what the contact is meant to achieve. It is not hidden chain-of-thought and cannot manufacture a new commitment or authority grant.                                                 |
| Intended principal and scope  | The principal Ember intends to contact, the semantic/privacy scope in which the material may be disclosed, and any recipient constraints. A transport address is a later surface binding, not the principal's identity.                                       |
| Source cognition and evidence | The completed cognition occurrence, originating opportunity when applicable, grounding meaning/evidence IDs, and derivation provenance supporting the contact decision. Provider prose alone is not sufficient provenance.                                    |
| Representation                | The immutable surface-neutral representation to offer, or a stable reference to it, together with an integrity digest, availability status, and content/disclosure classification. Rendering may adapt it to a surface without changing its material meaning. |
| Currentness basis             | The source revision, material assumptions, grounding currentness, urgency or expiry basis, and conditions whose change requires revalidation, deferral, suppression, or supersession.                                                                         |
| Satisfaction boundary         | What would establish that this intent no longer needs contact: for example confirmed transport acceptance when that is sufficient, explicit recipient acknowledgement when awareness matters, or independent resolution of the underlying purpose.            |
| Lifecycle evidence            | Current disposition, attributable transitions and bases, occurrence and observation times, reconsideration condition, predecessor/successor links, next-step owner, and any delivery-intent correlation.                                                      |

The purpose and representation may contain human-readable material because later
delivery needs to preserve what Ember meant to communicate. Operator inspection and
future cognition projections should expose only the least-sufficient fields, such as
availability and digest, unless the content is permitted and necessary for that
purpose.

The object is surface- and SDK-independent. It contains no Telegram chat ID, Bot API
message ID, provider session, tool-call ID, SDK result type, retry count, or
transport-specific failure string. A later delivery record owns those mechanics and
correlates back to `contact_intent_id`.

## Lifecycle

The intent has one durable disposition. Delivery attempts and outcomes remain a
separate correlated lifecycle.

| Disposition  | Meaning and required evidence                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pending`    | The intent is live and has not been handed to a delivery owner. It awaits currentness, authority, attention, or surface eligibility evaluation. Pending does not mean immediately deliverable.                                                                  |
| `deferred`   | The intent remains live but should not be handed off now. The record identifies the basis, next-step owner, and a bounded reconsideration condition or time. Quiet hours and a temporarily unsuitable surface belong here rather than in transport retry state. |
| `suppressed` | This exact intent revision is closed without handoff because contact is denied, stale, redundant, inappropriate, or no longer worth the attention cost. Suppression is positive decision evidence, not inferred from inactivity.                                |
| `handed_off` | Responsibility for one correlated delivery occurrence has moved to a delivery owner. The handoff records that delivery intent's stable identity and representation digest. It does not mean a send started or succeeded.                                        |
| `satisfied`  | The intent's declared satisfaction boundary is established by attributable evidence. The basis may be a sufficient confirmed delivery, recipient acknowledgement, or independent resolution without delivery.                                                   |
| `superseded` | A named successor intent now carries the still-live purpose because material meaning, representation, recipient/scope, or currentness basis changed. The predecessor remains historical and cannot be delivered anew.                                           |
| `cancelled`  | An attributable principal or Ember policy decision ends this contact occurrence without establishing satisfaction and names the disposition of any correlated delivery or uncertainty. Cancellation does not imply recall, non-delivery, or rollback.           |

`pending` and `deferred` are live and may transition between each other after a fresh
policy assessment. `suppressed`, `satisfied`, `superseded`, and `cancelled` are
terminal for that intent. A later reason to contact creates a new, explicitly
related occurrence rather than reopening a terminal record.

`handed_off` transfers next-step ownership and remains the semantic disposition while
the correlated delivery may be unattempted, started, retryably failed, confirmed, or
uncertain. A confirmed delivery changes the intent to `satisfied` only when it meets
the intent's declared satisfaction boundary. If recipient awareness was required,
transport acceptance alone is insufficient.

A delivery owner may release a handoff back to `pending` only with definite evidence
that no attempt crossed the external boundary, no effect is possible, and ownership
of the correlated delivery occurrence has been relinquished. An uncertain attempt
can never be released this way merely to enable another send.

## Currentness, deferral, and supersession

Every policy pass and every handoff revalidates the intent against current Ember
state. At minimum it checks:

- that the intended principal and disclosure scope still apply;
- that source grounding remains current and any supporting commitment remains live;
- that the representation still truthfully reflects the grounded result;
- that urgency, expiry, attention, and authority premises have not materially
  changed; and
- that no predecessor, successor, satisfaction evidence, or correlated delivery
  already makes another contact inappropriate.

A temporary obstacle that leaves the same material contact appropriate produces
`deferred`. A material change cannot be patched invisibly into the old identity. It
creates a successor with a new identity and representation digest, then marks the
predecessor `superseded`. This preserves what Ember previously intended without
allowing old evidence or an old policy decision to authorize changed content.

Suppression closes the exact occurrence. It does not erase the source cognition or
grounding, and it does not assert that the underlying meaning is false. A future
contact may be valid only as a new occurrence with fresh provenance and currentness.

## Duplicate and occurrence rules

Duplicate control follows provenance, never content equality alone:

- replay or retry of one contact-decision occurrence resolves to its existing
  `contact_intent_id` and cannot create a second intent;
- one live or handed-off intent cannot acquire a second live delivery intent for the
  same representation revision;
- a stable domain correlation or explicit predecessor/successor relation may prove
  that two candidates represent one continuing contact occurrence;
- equal purpose text, equal representation bytes, or equal grounding sets do not by
  themselves merge independently arising contact occurrences; and
- when correlation is unavailable, Ember preserves that uncertainty and lets
  attention policy suppress or defer risky contact rather than inventing identity.

A materially revised representation is not a retry payload. It becomes a successor
intent. Conversely, transport retries keep the original handoff, delivery identity,
and representation digest; they do not rerun cognition or create another semantic
contact occurrence.

## Delivery handoff and truth

Handoff creates or binds exactly one delivery intent whose retained representation
matches the proactive intent's digest. The handoff records:

- `contact_intent_id` and the delivery intent's independent stable identity;
- selected surface and recipient binding as delivery-layer evidence;
- representation digest and availability;
- the policy/currentness revision that permitted handoff; and
- ownership transfer time and actor.

After this point the [delivery reconciliation runbook](delivery-reconciliation-runbook.md)
governs attempts and transport truth. In particular:

- `handed_off` is not `started`;
- `started` is not `confirmed`;
- `confirmed` transport acceptance is not necessarily human awareness;
- failure is retryable only with definite retryability evidence; and
- `uncertain` blocks blind retry and cross-surface fallback.

Changing surfaces must therefore reconcile the existing delivery occurrence first.
A more reachable or less private surface is not permission to create a second
delivery, weaken disclosure scope, or treat an uncertain first send as absent.

## Restart and reconciliation invariants

The durable ordering is:

1. validate completed cognition and the contact decision;
2. commit the `pending` proactive-contact intent;
3. apply current attention, authority, and currentness policy;
4. durably create the correlated delivery intent and handoff link before any
   external send boundary; and
5. let the delivery owner record `started` before invoking the transport.

After restart, a recovery owner holding the normal cooperating writer lease
reconciles by stable identities rather than rerunning cognition:

- `pending` and `deferred` intents are revalidated before any new handoff;
- a delivery record already correlated to the intent is adopted as the unique
  handoff even if the intent-side disposition was not advanced before process loss;
- `handed_off` with no resolvable correlated delivery is an inspectable blocked
  inconsistency, not permission to send;
- a latest delivery attempt still marked `started` becomes `uncertain` under the
  delivery contract and the intent remains `handed_off`;
- terminal intents never re-enter the eligible queue; and
- downtime creates no fictional contact decision, delivery attempt, or satisfaction
  evidence.

These invariants require crash-consistent correlation but do not prescribe a
database, transaction mechanism, queue, event-sourcing model, or runtime topology.

## Relationship to existing and later boundaries

- The [endogenous cognition decision](endogenous-cognition-decision.md) decides
  whether internal cognition is worthwhile; it does not create contact intent.
- The [endogenous interruption decision](endogenous-interruption-decision.md)
  supplies the current transport-independent policy vocabulary for deciding whether
  completed cognition may surface. A non-null candidate can feed intent creation;
  its `deliver`, `defer`, and `suppress` results are the pure precursor to later
  intent disposition, while `no_delivery` remains successful `no_contact`.
- Issue #227 owns the concrete attention policy that moves a live intent among
  `pending`, `deferred`, `suppressed`, and eligible handoff.
- Issue #228 owns the Telegram bridge and correlated delivery implementation.
- Issue #229 owns behavioral evaluation of helpful contact, unwanted interruption,
  deliberate silence, and duplicate suppression.

This issue defines no persistence encoding, provider prompt, model-control schema,
surface fallback order, quiet-hour configuration, Telegram operation, or generic
notification framework.

## Acceptance mapping

| Issue #226 criterion                   | Contract evidence                                                                                                                                          |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SDK/surface-independent intent         | Ember-owned identity and semantic destination contain no SDK, provider, surface, or transport identity; those appear only in correlated delivery evidence. |
| Explicit source and destination        | Required responsibilities include completed source cognition, grounding evidence, intended principal, disclosure scope, purpose, and representation.       |
| Delivery attempt is not delivery truth | Intent disposition and delivery lifecycle are separate; `handed_off`, `started`, `confirmed`, awareness, and satisfaction make different claims.           |
| Restart and supersession semantics     | Durable ordering, identity-based reconciliation, terminal-state rules, changed-representation successors, and uncertain-send blocking are explicit.        |
| Deliberate silence remains successful  | `no_contact` is a positive contact-decision result and creates no synthetic intent; absence alone does not falsely prove silence.                          |
