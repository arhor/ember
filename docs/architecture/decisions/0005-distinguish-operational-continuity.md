# ADR 0005: Operational Continuity Distinguishes Work, Occurrence, Delivery, Effects, and Currentness

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision class:** Semantic, representation-neutral
- **Origin:** [Issue #20](https://github.com/arhor/ember/issues/20)

## Context and problem

Sessions, surfaces, connections, processes, cognition episodes, and specialist
threads have different lifetimes. Distributed delivery and external action also
produce duplicates, out-of-order observations, ambiguous timeouts, partial effects,
and results that become obsolete before they arrive.

Collapsing these meanings would let a closed window cancel work, a replay create a
second instruction, a timeout prove nothing happened, cancellation imply rollback,
or a restored prompt make stale premises current again.

## Decision

Ember's operational continuity preserves the following distinctions:

- work remains live while its purpose remains live, independently of the session,
  surface, transport, or specialist thread that initiated it;
- semantic occurrence is distinct from each attempt to deliver a representation
  of it;
- duplicate delivery does not create another occurrence, instruction, memory,
  authority grant, notification, or external effect when provenance establishes
  one underlying occurrence;
- representation equality does not prove that two real occurrences are one;
- occurrence time, Ember's observation time, and applicability time may differ;
- accepted, started, blocked, failed, timed out, cancellation requested,
  cancellation acknowledged, stopped, completed, and effects rolled back are
  different claims;
- failure, timeout, disconnect, restart, or cancellation does not prove absence or
  reversal of external effects;
- completion is distinct from present applicability; work can succeed historically
  for an objective or world state that is now obsolete;
- recovery establishes the strongest justified present from continuing Ember
  state, surviving evidence, current observation, and explicit uncertainty rather
  than blindly replaying old prompt state;
- downtime and irrecoverable operational history remain truthful gaps rather than
  fictional monitoring, thought, or seamless execution.

## Consequences and architectural constraints

- Ending a session does not silently cancel a delegated objective, live
  commitment, or unresolved responsibility. Their lifecycles need independent
  semantic reasons to end.
- Continuing work must preserve enough objective, constraints, authority
  provenance, assumptions, runtime ownership, known or possible effects,
  uncertainty, and currentness requirements to be resumed or reconciled truthfully.
- Before repeating consequential work after an ambiguous failure, Ember establishes
  current external state to the degree warranted unless repetition is independently
  known to be safe under the relevant contract.
- Retries, redelivery, and replay must not amplify occurrence, evidence, authority,
  or effects. Conversely, content-based deduplication must not erase distinct real
  occurrences.
- Concurrent cognition requires currentness checks where another actor can
  materially change a premise, authority, objective, recipient, shared resource,
  or consequence. Global serialization is not implied.
- Late results retain their original objective and provenance and are re-evaluated
  before reliance, action, notification, or cross-surface delivery.
- Result availability and delivery are separate decisions. A reachable surface is
  not automatically a suitable recipient or privacy context.
- Recovery may end with an explicit information gap. Operational presentation must
  never claim stronger facts about running, stopping, effects, delivery, or
  currentness than Ember can justify.
- Missed scheduled opportunities are reconsidered according to their purpose and
  temporal meaning rather than mechanically replayed.

## Deliberately unresolved representation questions

This decision does not choose:

- queues, event sourcing, brokers, deduplication or idempotency-key formats,
  transactions, locks, actors, or optimistic-concurrency mechanisms;
- retry algorithms, compensation models, or universal currentness checks;
- foreground process, daemon, service, supervisor, or other runtime topology;
- session, conversation, work, occurrence, delivery, or status representations;
- transport, IPC, specialist, or persistence protocols;
- the resumption-state bundle, result-expiry threshold, or notification policy;
- how occurrence identity is handled when a source provides no stable correlation.

Currentness-check thresholds, resumption bundles, cross-surface principal
confidence, undelivered-result decay, and uncertain occurrence identity remain
experiments.

## Representative scenarios and failure modes

- **Duplicate delivery:** two transport copies with stable common provenance remain
  one instruction; two identical intentional requests remain two occurrences.
- **Ambiguous timeout:** Ember preserves the possibility that the external effect
  occurred and inspects present state before an unsafe retry.
- **Session closes during work:** the work remains live if its purpose does; the
  closed view neither cancels nor owns the result.
- **Late specialist success:** a result can be correct for objective A after the
  user changed the objective to B; historical success does not complete B.
- **Recovery with a genuine gap:** Ember reconstructs what persisted, what can be
  observed now, and what remains unknown without replaying stale assumptions.
- **Cancellation during disconnect:** requested, acknowledged, stopped, and
  rollback status remain separate; known and possible effects remain visible.
- **Lower-privacy fallback surface:** the result remains durable and undelivered
  rather than being exposed merely because another surface is reachable.
- **Blind replay recovery:** an old prompt is resumed despite changed authority,
  preferences, objective, or external state.

## Traceability

| Canonical source | Decision basis |
|---|---|
| [Principles: interfaces do not own the agent](../../principles.md#12-interfaces-do-not-own-the-agent) and [graceful degradation](../../principles.md#14-graceful-degradation-beats-brittle-intelligence) | Establish temporary surfaces and truthful partial function as project-level constraints. |
| [Design directions: operational model](../design-directions.md#operational-model-continuity-centred-reconciliation-first) | Synthesises session independence, resumable work, occurrence/delivery, retries, gaps, and reconciliation. |
| [Design directions: ADR candidate 5](../design-directions.md#adr-candidate-5-operational-continuity-distinguishes-work-occurrence-delivery-and-currentness) | Records the synthesis-level candidate and its **[E + C + J]** basis. |
| [Operational central conclusion](../../research/operational-model-sessions-and-surfaces.md#central-conclusion) | Defines continuity-centred operation around temporary loci. |
| [Long-running work](../../research/operational-model-sessions-and-surfaces.md#long-running-work-is-independent-of-interaction-lifetime) | Makes work lifetime independent of initiating interaction and surface. |
| [Occurrence and delivery](../../research/operational-model-sessions-and-surfaces.md#semantic-occurrence-and-delivery-are-distinct) | Prevents transport duplication from manufacturing semantic multiplication. |
| [Retry semantics](../../research/operational-model-sessions-and-surfaces.md#retry-semantics-begin-with-epistemology) | Treats ambiguous failure as uncertainty about external state before scheduling another attempt. |
| [Recovery](../../research/operational-model-sessions-and-surfaces.md#recovery-is-reconciliation-not-replay) | Reconstructs the justified present and permits unresolved gaps. |
| [Operational invariants](../../research/operational-model-sessions-and-surfaces.md#operational-invariants-for-later-architecture) | Consolidates work liveness, currentness, delivery, failure, concurrency, downtime, and truthful presentation. |
| [Delegation progress, failure, and side effects](../../research/capabilities-and-delegation.md#progress-partial-results-failure-and-side-effects) | Separates progress/control-flow signals from rollback and known effects. |
| [Context reconstruction](../../research/context-selection-and-cognitive-framing.md#reconstruction-after-interruption-or-restart) | Requires current-situation reconstruction rather than old prompt recreation. |
| [Endogenous time and downtime](../../research/endogenous-agency-and-self-initiated-behavior.md#time-persistence-and-downtime) | Forbids claiming cognition or experience during unavailable intervals. |
