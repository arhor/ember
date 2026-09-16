---
summary: "Issue #232 semantics for durable, proposal-specific human approval correlated across turns, surfaces, and process restarts without relying on provider or tool state."
read_when:
  - "Implementing or changing approval requests for consequential actions or disclosures"
  - "Correlating a human approval or rejection with an action proposal across conversation turns, surfaces, or process restarts"
  - "Deciding whether an approved proposal is still current enough to execute"
role: design
discovery_status: current
---

# Durable Action Proposal and Approval Correlation

## Purpose

Issue [#232](https://github.com/arhor/ember/issues/232) defines the semantic boundary
between contemplating a consequential effect, asking a human to decide, interpreting
their response, and executing. It refines ADR 0004's authority envelope and ADR
0005's operational continuity without choosing an approval UI, persistence engine,
policy language, or capability framework.

The governing rule is:

> **Approval authorizes one identified, still-current proposal whose material
> meaning the approving principal was shown and was entitled to decide. It does not
> authorize a provider invocation, tool call, conversation, or category of future
> actions.**

## Proposal is an Ember-owned semantic object

An **action proposal** is Ember's durable description of a contemplated external
effect or disclosure before execution. It is independent of the model output,
provider thread, tool-call identifier, capability binding, specialist runtime, and
surface message used to create or present it.

A proposal preserves at least:

| Field                   | Semantic responsibility                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `proposal_id`           | Stable Ember-owned identity for this occurrence of the proposed decision; never derived only from display text or parameters.                                                             |
| action and parameters   | The operation, target, recipient, resource, quantity, content/disclosure boundary, and other values that determine the material effect.                                                   |
| purpose and consequence | Why the action is proposed, who or what it serves, expected effects, cost, recoverability, public visibility, security significance, and material third-party impact.                     |
| principal and scope     | The principal on whose behalf Ember would act, the authority-holder or holders entitled to decide, and the semantic/privacy scope in which the proposal may be disclosed and resolved.    |
| source provenance       | The source cognition, instruction, canonical meaning, observations, specialist request, and other evidence that justified proposing the action, without treating any of them as approval. |
| currentness basis       | The assumptions and observed versions or facts whose material change requires revalidation, plus any explicit expiry condition or time.                                                   |
| lifecycle evidence      | Creation, presentation attempts, resolution, expiry, supersession, execution correlation, and known or possible effects, with occurrence and observation times where relevant.            |

The representation may additionally contain a machine-normalized action payload and
a human-facing explanation. Neither substitutes for the other. Display text alone
is too lossy for execution; an opaque payload alone does not establish meaningful
human approval.

Creating or displaying a proposal has no external action effect and grants no
authority. Two identical proposals are distinct occurrences unless stable provenance
establishes that one is merely a duplicate delivery. Revising any material parameter
creates a new proposal identity; the predecessor is superseded rather than mutated
under an old approval.

## Approval and rejection are proposal-specific decisions

An **approval decision** is durable evidence that an authenticated principal made a
decision about one exact `proposal_id`. It records:

- the decision (`approved` or `rejected`) and its own stable occurrence identity;
- the deciding principal and evidence used to map the interaction to that principal;
- the proposal identity and the material action parameters or an integrity-bound
  snapshot/digest that were presented and decided;
- the scope, surface, conversation turn or other interaction evidence through which
  the decision arrived;
- the authority provenance establishing that the principal could decide the affected
  interests; and
- occurrence and observation time, plus any explicit conditions, narrowing, or
  expiry stated by the principal.

Approval does not mutate historical proposal content. It adds a correlated authority
event. Rejection likewise resolves only that proposal; it is not a universal ban on
similar future actions. A conditional response is approval only if its conditions can
be represented as a precise, narrower proposal. Otherwise Ember creates that revised
proposal and seeks a decision on it.

A provider's or tool runtime's approval flag may be operational evidence that a gate
was crossed. It is not this authority event. Ember translates legitimate human input
into its own record before any runtime resumes.

## Correlation across turns, surfaces, and restart

The correlation key is `proposal_id`, not adjacency, wording, provider session,
surface thread, or the bare token "yes". The proposal, its presentation evidence, and
its resolution survive process restart in Ember-owned durable state.

A response may resolve a proposal when all of the following hold:

1. it unambiguously identifies exactly one unresolved proposal, through an explicit
   proposal reference or equally strong Ember-owned reply correlation;
2. the responding principal is authenticated strongly enough for the consequence and
   is entitled to decide the affected scope;
3. the response meaning is an unambiguous approval or rejection of the presented
   material parameters; and
4. no scope, disclosure, currentness, expiry, or supersession conflict invalidates
   the correlation.

A change of surface does not invalidate approval or create it. Cross-surface
resolution is permitted when principal mapping, disclosure scope, and explicit
proposal correlation remain valid. A lower-privacy or shared surface may be unsuitable
for presenting or resolving the proposal even if it can technically carry a reply.

Conversation identity is useful supporting evidence but never sufficient. After a
restart, Ember reconstructs unresolved proposals and correlation evidence from its
own state; provider history is optional evidence and must not be the only place where
the pending decision exists.

When multiple proposals are pending, a reply such as "yes", "do it", an emoji, or a
reaction without unique reply correlation is ambiguous and fails closed. The same is
true when principal identity, authority, or the intended parameters are uncertain.
Ember may ask a clarifying question that names the proposal and material effect, but
must not guess, select the most recent proposal merely by recency, or treat the reply
as global standing authority.

Duplicate delivery of one approval event remains one decision. Two separately
authored approvals remain distinct evidence even if their text is identical.

## Lifecycle and currentness

A proposal has an independent lifecycle:

```text
pending -> approved -> execution-eligible -> execution-correlated
   |          |               |
   +-> rejected               +-> stale / expired / superseded
   +-> expired
   +-> superseded
```

`approved` records historical authorization; it does not guarantee present execution
eligibility. Immediately before crossing the external-effect boundary, Ember must
revalidate:

- the proposal is the exact approved identity and its integrity-bound material
  parameters have not changed;
- the approval is authentic, attributable, in scope, and not revoked or expired;
- the proposal has not been rejected, superseded, executed, or made uncertain by a
  prior attempt;
- purpose, target, recipient, resource, price or quantity, disclosure, recoverability,
  security significance, affected principals, and authority chain still fit;
- the source objective and relevant canonical meaning remain current; and
- external facts named by the proposal's currentness basis remain sufficiently fresh
  for the consequence.

Expiry is a declared time or condition after which a proposal cannot execute without
a new decision. Staleness is a currentness conclusion that material assumptions may
no longer fit, even if no clock deadline elapsed. Supersession means another proposal
or changed objective has replaced this contemplated occurrence. All remain durable
historical evidence but confer no live mandate.

If revalidation fails materially, Ember blocks execution and records why. A changed
proposal receives a new identity and requires fresh approval. If a permitted check
can establish that nothing material changed, the same approved proposal may become
execution-eligible; revalidation itself must not silently broaden its scope.

Approval is consumed for the proposal's declared occurrence semantics. It cannot be
replayed to execute the same non-repeatable effect twice or copied to a similar
proposal. After an attempt begins, timeout, cancellation, disconnect, or restart does
not restore unused approval or prove that no effect occurred. Ember preserves the
attempt correlation and reconciles external state before any consequential retry;
the retry may itself require a new proposal and approval.

## Boundary with capability execution

The capability firewall may return `approval_required`, but that result is only the
reason to create or correlate an action proposal. The proposal must exist before a
human decision and must not be synthesized retroactively from a provider transcript.

Execution receives the approved, revalidated proposal identity and binds every
attempt and outcome to it. The executor must reject a payload whose material
parameters differ from the approved snapshot. Capability selection, schema validity,
runtime permission, and technical credentials remain necessary mechanics where
applicable; none replaces semantic approval.

No provider or specialist may broaden a proposal while preserving its ID. A
specialist approval request is source evidence from which Ember may formulate a
proposal, not an authority source and not automatically the human-facing proposal.

## Representative scenarios

### Ambiguous conversational assent

Two pending proposals exist: publish a repository comment and send a calendar
invitation. The user sends "yes" without a reply reference. Ember records an
unresolved interaction or asks which proposal they mean. Neither action executes.

### Cross-surface decision after restart

Ember presents a proposal on the CLI, persists it, and stops. After restart the same
authenticated principal approves its explicit proposal reference through Telegram.
Ember may correlate the decision only if Telegram's principal mapping and privacy
scope are compatible, then still revalidates currentness before execution. No
provider thread continuity is required.

### Material parameter change

The user approves sending a named draft to one recipient. The recipient or attachment
changes before execution. The original proposal becomes superseded or stale. Ember
creates a new proposal; the earlier approval cannot authorize it.

### Expired price or external state

The user approves a purchase bounded to a quoted price and expiry. After the quote
expires, the historical approval remains attributable but execution is blocked until
the current proposal is re-established and approved as required.

### Crash after execution begins

Ember durably correlates the attempt to the approved proposal, invokes the external
capability, and crashes before learning the result. Recovery records an uncertain
effect and reconciles current state. It does not replay the approval as though the
first attempt never occurred.

## Deliberately unresolved representation questions

This design does not choose:

- database tables, files, event sourcing, serialization, hashes, signatures, or lock
  protocols;
- concrete identifiers, schemas, APIs, prompts, buttons, notifications, or expiry
  durations;
- authentication mechanisms or universal confidence thresholds for principal
  mapping;
- a risk score, action taxonomy, policy DSL, or standing-authority representation;
- whether one UI may batch several independently identifiable proposals; or
- retry, compensation, or reconciliation mechanics for a particular capability.

Those choices must preserve the proposal identity, parameter binding, authority
provenance, fail-closed correlation, and revalidation semantics above.

## Traceability

| Governing source                                                                              | Constraint carried forward                                                                         |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [ADR 0002](decisions/0002-preserve-persistent-meaning.md)                                     | Authority, proposal, decision, currentness, and supersession retain provenance and history.        |
| [ADR 0004](decisions/0004-separate-capability-from-authority.md)                              | Capability and runtime permission do not create authority; material change requires re-evaluation. |
| [ADR 0005](decisions/0005-distinguish-operational-continuity.md)                              | Occurrence, delivery, effects, restart recovery, and current applicability remain distinct.        |
| [Action, Authority, and Permission Semantics](../research/action-authority-and-permission.md) | Approval must be meaningful, attributable, bounded, and current rather than a ritual confirmation. |
| [Conversation Context and Turn Semantics](conversation-context-turn-semantics.md)             | Conversation and surface signals are supporting evidence, not sufficient semantic identity.        |
| [Capability Execution Boundary](capability-execution-boundary.md)                             | Ember owns approval and effect semantics outside provider tool mechanics.                          |
| [AS-DEL-07](acceptance-scenarios.md#as-del-07)                                                | A specialist approval request preserves the exact contemplated action without becoming authority.  |
