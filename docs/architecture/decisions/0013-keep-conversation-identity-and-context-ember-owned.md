---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0013: Keep Conversation Identity and Context Ember-Owned

This accepted C03 migration record extracts the representation-neutral choice
from issue #216. The maintainer approved this record on 2026-10-27. It owns the
semantic decision; the [conversation reference](../conversation-context-turn-semantics.md)
retains detailed explanations, scenarios, and traceability. Original approval
attribution and a separate historical decision date are not recorded. Acceptance
does not choose a new schema, retention budget, or selection algorithm.

## Context and Problem Statement

Follow-up utterances need enough surviving discourse to resolve references without
turning dialogue into canonical memory or depending on a provider chat thread.
Processes, providers, sessions, and surfaces can change while the conversation
continues. Accepted ADRs 0001–0005 already constrain lineage, meaning, projection,
authority, occurrence, and recovery; this choice specializes conversation within
those constraints.

Conversational material, interaction evidence, and canonical meaning have different
roles and lifecycles. Short-lived context may be process-durable. Durable evidence
that an interaction occurred does not adopt every proposition in that interaction.

## Decision

Ember owns the correlation that establishes a continuing conversation trajectory and
selects its bounded current context. A trajectory follows discourse among compatible
participants and scope. Provider, process, transport, surface, principal, or scope
identity alone cannot establish that two interactions belong to the same conversation.

A turn is one attributed semantic contribution: accepted user input or an established
Ember expression. An exchange correlates an input with the expression or cognition
outcome attributable to it, including incomplete, failed, cancelled, or unknown
outcomes. Input acceptance, cognition completion, expression occurrence, delivery,
and user awareness remain separate facts.

Selected context may contain shared dialogue, participant-local prior expression
evidence, and unresolved operational status. A committed expression with unknown user
awareness may remain Ember-owned evidence but cannot silently become a shared premise,
accepted option, or an "as I said above" antecedent. Stronger later evidence, such as
an attributable user response referring to it, may resolve that gap. Delivery
confirmation alone does not establish awareness.

Cross-surface continuation requires compatible lineage, justified participant mapping,
a valid scope/disclosure boundary, evidence of discourse continuation, and enough
surviving material to interpret it. Recheck recipient and disclosure conditions on
each surface change; continuation may require a narrower projection.

A provider-native session may be a replaceable optimization only if Ember can
reconstruct the needed projection independently and prevent excluded, stale,
wrong-scope, or private provider-hidden history from reappearing as ghost context.

## Scope and non-goals

This decision governs the meaning of dialogue continuity, attribution, participation,
and uncertainty. It does not select TypeScript schemas, storage, explicit versus
derived conversation IDs, turn/token/age limits, topic classifiers, similarity
thresholds, compaction formats, foreground-trajectory counts, prompt formats, or
provider-session reuse. It does not adopt dialogue automatically as memory or choose
long-term archive retrieval. Those remain distinct choices under this boundary.

## Invariants

1. **Ember ownership:** continuity is reconstructible from Ember-owned state/evidence,
   independently of one provider, process, surface, or transport session.
2. **Turn uniqueness:** transport replay, provider retries, streaming fragments, and
   delivery retries do not create duplicate semantic contributions.
3. **Participant attribution:** user testimony and Ember expression retain their
   distinct authorship and provenance.
4. **Exchange correlation:** relate input to attributable expression/outcome without
   equating acceptance, cognition, expression, delivery, or awareness.
5. **Shared-ground discipline:** unknown awareness cannot become shared dialogue until
   stronger evidence justifies it.
6. **Conversation membership:** same principal/scope/session is insufficient by itself.
   Use discourse continuity or preserve ambiguity; unrelated topics may coexist.
7. **Cross-surface privacy:** continuation requires a newly valid recipient/disclosure
   boundary; account identifiers alone are evidence about a person, not the person.
8. **No transcript-as-memory:** retention, repetition, summary, or selection cannot
   automatically promote conversational content into canonical meaning.
9. **Expression availability:** still-relevant prior expressions survive clean
   restart/provider replacement in a faithful form sufficient for valid follow-ups.
10. **Bounded selection:** default participation is finite, inspectable, and justified
    by the present discourse. Recency, count, and token pressure are mechanics rather
    than definitions of semantic relevance.
11. **Currentness:** historical turns remain attributable without keeping corrected,
    closed, superseded, or unrelated local assumptions governing current dialogue.
12. **Provider independence:** provider-local state cannot bypass Ember's selection or
    become the only copy of required discourse continuity.
13. **Truthful interruption:** distinguish accepted input, unknown cognition,
    established expression, pending/failed/uncertain delivery, and justified delivery
    evidence. Do not reconstruct an uncommitted candidate as an Ember turn.
14. **Truthful degradation:** missing or compressed detail remains qualified; derived
    context is not stronger evidence and exact prior wording must not be invented.
15. **Inspectability:** explain selected material, current trajectory evidence, and
    operational IDs without presenting those IDs as semantic owners.

While a turn remains needed, recover equivalent participant/principal/scope provenance,
occurrence identity, order and response correlation, faithful content, expression and
delivery status, awareness uncertainty, and recovery evidence. This is a semantic
requirement, not indefinite exact transcript retention. A clean gap does not imply
cognition during downtime. Replayed Telegram occurrences remain the same occurrence;
an identical new CLI input remains a new occurrence. Membership and replay identity
answer different questions.

## Alternatives Considered

The source rules out provider-owned conversation history, an immortal transcript keyed
only by principal/scope, unconditional latest-message inclusion, treating all retained
turns as shared ground, and automatic transcript-as-memory. These directions lose
replaceability, boundedness, disclosure, currentness, or epistemic distinctions.
A formal comparison of concrete schemas or selector algorithms is not recorded and
is deliberately outside this semantic choice.

## Consequences

- Locally relevant dialogue can survive process/provider replacement without becoming
  canonical memory or requiring a provider session to own continuity.
- Selection and persistence must retain enough structure and uncertainty for truthful
  interpretation; descriptor-only prior expression evidence can be insufficient.
- Context can shrink, omit obsolete topics, or degrade faithfully under pressure.
- Ambiguous continuation may require clarification, a fresh trajectory, or qualified
  linkage; similarity and technical identifiers cannot manufacture confident context.
- Implementation choices and their empirical coverage remain separately reviewable.

## Implementation Plan

Apply these constraints through the existing implementation; this plan does not
select a new storage model, numeric budget, or provider session mechanism.

- **Affected paths:** the [conversation contract](../../../packages/core/src/conversation-context.ts),
  [conversation persistence](../../../packages/core/src/persistence/conversation-context-store.ts),
  and [application coordination](../../../packages/core/src/app) retain their current
  ownership. Compatible refactoring may relocate code without changing the decision.
- **Patterns to follow:** retain participant attribution, occurrence/exchange correlation,
  currentness, bounded selection, and explicit awareness uncertainty in Ember-owned
  state and projections. Recover needed dialogue independently of the provider.
- **Patterns to avoid:** provider-hidden history as authority, principal/scope equality
  as guaranteed discourse identity, automatic transcript-as-memory, or confirmed
  transport delivery treated as established user awareness.
- **Dependencies and configuration:** this semantic boundary requires no new package,
  persistence format, configuration key, or fixed retention/token setting.
- **Migration and verification:** preserve the existing compatible implementation and
  exercise the cross-surface, conversation-validation, and conversation-evaluation
  tests linked below. Future representation changes must retain the same observable
  constraints. Existing implementation evidence is not work to repeat.

### Verification

- [x] The fifteen source invariants map to the fifteen invariant clauses here without
      adding a storage, runtime, or selection-policy commitment.
- [x] Cross-surface/restart fixtures preserve one justified trajectory with fresh
      provider invocations, explicit fresh-conversation boundaries, and scope isolation.
- [x] Conversation evaluation preserves bounded selection, direct-response evidence,
      unknown awareness, and the distinction between delivery and shared dialogue.
- [x] Recovery and replay scenario definitions preserve truthful gaps, turns, and
      recall limitations when compared with the original source.
- [x] All explicitly unresolved representation questions remain open at this layer.

## More Information

- [Original #216 semantics and detailed scenarios](../conversation-context-turn-semantics.md)
- [Persistent meaning](0002-preserve-persistent-meaning.md),
  [permitted projections](0003-use-least-sufficient-permitted-projections.md), and
  [operational continuity](0005-distinguish-operational-continuity.md)
- [Context research](../../research/context-selection-and-cognitive-framing.md),
  [operational research](../../research/operational-model-sessions-and-surfaces.md),
  and [acceptance catalogue](../acceptance-scenarios.md)
- [Current dialogue contract](../../../packages/core/src/conversation-context.ts),
  [conversation persistence](../../../packages/core/src/persistence/conversation-context-store.ts),
  [cross-surface conversation reference](../cross-surface-conversation-continuity.md),
  and [conversation evaluation guide](../../guides/conversation-coherence-evaluation.md)
- [Cross-surface/restart tests](../../../tests/cross-surface-continuity.test.ts),
  [ownership validation](../../../tests/conversation-context-validation.test.ts), and
  [conversation evaluation tests](../../../tests/conversation-evaluation.test.ts)

The implementation links are evidence for selected traces, not a claim that each
possible selector or conversation interpretation has been proved correct. Sidecar
versions, heuristics, and numeric budgets belong to their own implementation records.
Revisit the semantic boundary only when observed discourse failures or new scenarios
show an invariant is inadequate; changing a compatible representation does not by
itself require replacing this decision.

### Pilot acceptance — 2026-10-27

The maintainer approved this pilot batch. Review against the original ADR skill's
agent-readiness checklist found the source constraints, implementation references,
verification criteria, non-goals, and revisit conditions preserved. This is a
documentation migration; existing implementation evidence does not imply all future
representations are verified. No runtime or package changes were made.
