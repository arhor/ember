---
summary: "Issue #216 representation-neutral semantics for Ember-owned conversational turns and bounded short-lived dialogue context across surfaces, restarts, and provider replacement."
read_when:
  - "Changing how recent dialogue, conversational turns, local references, or topic continuation participate in cognition"
  - "Changing cross-surface or restart conversation continuity without promoting transcripts into canonical memory"
  - "Deciding whether provider, session, thread, transport, or delivery identifiers may define conversational continuity"
role: design
discovery_status: current
---

# Ember-Owned Conversation Context and Turn Semantics

> Status: current semantic design for issue #216 and implementation boundary for
> issues #217 through #219.

## Purpose

Ember needs enough short-lived dialogue continuity to understand ordinary follow-up
utterances such as "that one", "the previous option", "why did you say that?", or
"continue from there" without turning every conversation into canonical memory or
outsourcing continuity to a provider-native chat thread.

This document defines that boundary before choosing a storage model, selection
algorithm, token budget, or provider representation.

It specializes the existing architecture rather than replacing it:

- [ADR 0002](decisions/0002-preserve-persistent-meaning.md) keeps historical evidence,
  durable meaning, current belief, commitments, and temporary context distinct;
- [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md) requires
  purpose-bounded, least-sufficient permitted projections;
- [Context Selection and Cognitive Framing Semantics](../research/context-selection-and-cognitive-framing.md)
  already identifies conversational trajectory as one possible influence on current
  cognition;
- [Operational Model, Sessions, and Surfaces](../research/operational-model-sessions-and-surfaces.md)
  establishes that conversation continuity follows discourse more closely than
  session or transport identity; and
- [Interaction Surface Boundary](interaction-surface-boundary.md) keeps semantic
  occurrence, surface provenance, delivery, and transport replay distinct.

The new design question is narrower:

> What must Ember own so an ongoing dialogue can continue truthfully when the next
> turn arrives through another process, provider invocation, or surface?

## Three layers must remain distinct

Natural conversation crosses three different semantic layers. Their lifecycles may
use the same persistence technology later, but their meanings must not collapse.

| Layer                       | Purpose                                                                                                                                   | Typical lifetime                                                              | What presence means                                                                         | What it must not imply                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Conversational material** | Resolve local references, assumptions, options, questions, and the active discourse trajectory.                                           | Short-lived and bounded, but potentially process-durable.                     | This dialogue material may participate in current cognition.                                | Canonical memory, belief, long-term significance, or permanent retention.                   |
| **Interaction evidence**    | Preserve accountable facts that an inbound occurrence, cognition, Ember expression, or delivery attempt happened.                         | Durable enough for provenance, replay, recovery, and inspection requirements. | Ember has evidence about an occurrence and its known outcome.                               | That every proposition in the occurrence is remembered or currently governing.             |
| **Canonical meaning**       | Carry durable remembered meaning, current beliefs/preferences, relationship state, commitments, interpretations, and other adopted state. | Durable according to its own lifecycle.                                       | Ember has deliberately retained meaning with provenance, scope, currentness, and lifecycle. | Exact transcript retention or automatic adoption merely because text appeared in dialogue. |

A crucial consequence is:

> **Transient does not mean process-local.** Conversational material may need to
> survive a clean restart or provider replacement while remaining semantically
> short-lived and non-canonical.

Likewise, durable evidence is not automatically durable meaning. Ember can retain
that an interaction occurred without adopting every utterance into memory, and she
can later expire dialogue payload needed only for local continuity while retaining
whatever lower-detail occurrence evidence is still justified.

## Working semantic model

### Conversational turn

A **conversational turn** is one participant-attributed contribution to the semantic
discourse trajectory.

For the current user-facing interaction boundary:

- an accepted inbound user occurrence contributes a **user turn**;
- a committed Ember expression contributes an **Ember turn**;
- a transport replay of an already established occurrence contributes no new turn;
- a delivery retry or duplicate delivery contributes no new turn;
- provider-internal messages, reasoning steps, tool calls, or thread events are not
  conversational turns merely because a provider observed them; and
- streaming chunks or transport fragments are not separate turns unless Ember has
  semantically produced separate participant contributions.

Turns are therefore defined by discourse contribution, not API call count, transport
message count, subprocess count, or provider message objects.

### Interaction exchange

An **interaction exchange** is the Ember-owned correlation between an accepted
inbound user turn and the cognition/expression outcome attributable to that input.

The correlation does not claim that every input receives exactly one successful
reply. An exchange can remain incomplete or have no Ember expression because
cognition failed, timed out, was cancelled, or ended with an unknown outcome. An
expression can exist while delivery remains failed or uncertain.

This separation preserves several existing truths:

```text
input accepted
    != cognition completed
    != Ember expression committed
    != delivery confirmed
    != user awareness
```

The direct-response relation is nevertheless valuable conversational evidence. If a
later user says "your previous answer", Ember should be able to identify which Ember
turn was the response to which user turn without pretending that delivery certainty
is stronger than the evidence allows.

### Conversation trajectory

A **conversation trajectory** is a semantically coherent, locally continuing line of
discourse among compatible participants and scope. It can span runtime episodes,
provider invocations, transport connections, and surfaces.

A trajectory is not required to coincide with one session. One session can contain
several distinct topics or threads, while one conversation can continue after a
session or surface changes.

### Conversation context

**Conversation context** is the bounded, currentness-sensitive Ember-owned view of a
conversation trajectory that is eligible to participate in the current act of
cognition because it is needed to interpret the present turn.

It can include participant-attributed turn content plus the minimum linkage and
status needed to interpret that content, for example:

- who contributed a turn;
- the order and direct-response relation among relevant turns;
- which local question, referent, option set, correction, or assumption remains live;
- which scope and principal/recipient boundary governed the contribution; and
- whether an interruption, failed expression, or uncertain delivery limits what Ember
  can truthfully infer about shared discourse.

Conversation context is only one input to the broader cognition projection governed
by ADR 0003. Canonical meanings, current observations, live commitments, and other
admissible evidence may participate beside it. The conversational slice does not own
or replace the full projection.

## Conversation identity is Ember-owned

No provider, surface, process, or transport identifier may be the canonical answer to
"which conversation is this?"

Ember must own the correlation that says a later turn continues an earlier discourse
trajectory. A future representation may use an Ember-generated identifier, a
recoverable relation among turns, or another mechanism. The representation is not
settled here. The semantic requirement is that the relation can survive replacement
of any one operational locus.

### Same principal and scope are necessary evidence, not sufficient identity

Two interactions with the same principal and `activeScope` do not automatically
belong to the same conversation.

The same principal can have several concurrent or resumable topics in one scope. A
single terminal, Telegram chat, or provider thread can likewise contain unrelated
conversation trajectories.

Conversation membership should instead be justified by discourse continuity. Useful
forms of evidence include:

- an Ember-owned direct-response correlation;
- an explicit user continuation or resumption such as "continue the Docker topic";
- a locally unresolved referent, question, choice, correction, or plan that the new
  turn clearly continues;
- a previously established Ember-owned conversation correlation whose participant,
  scope, and disclosure conditions remain compatible; and
- ordinary adjacency when no conflicting topic or interruption evidence makes that
  inference unsafe.

The following signals are supporting or operational evidence only and are never
sufficient by themselves:

- same principal;
- same `activeScope`;
- same surface;
- same Telegram chat or thread;
- same terminal process;
- same provider thread/session;
- similar wording;
- close timestamps; or
- the fact that one interaction happened immediately after another at the transport
  layer.

When evidence is genuinely ambiguous, Ember should preserve that ambiguity rather
than silently merging unrelated dialogue. A later implementation may ask for
clarification, start a fresh trajectory, or retain candidate linkage with explicit
uncertainty. It must not manufacture confident shared context from a weak technical
identifier.

## Cross-surface continuity

A surface is a window onto one continuing Ember. Conversation identity therefore can
continue from CLI to Telegram or another future surface when the later interaction is
justifiably part of the same discourse trajectory.

A surface change does not itself break the conversation, but it creates a fresh
recipient/disclosure check.

Cross-surface continuation requires at least:

1. compatible Ember lineage;
2. justified principal/participant mapping rather than transport identity alone;
3. compatible semantic scope and disclosure boundary;
4. evidence that the later turn continues the earlier discourse trajectory; and
5. enough surviving conversational material to interpret the continuation without
   inventing lost detail.

The conversation may therefore remain the same while the selected projection becomes
narrower on the new surface. Cross-surface continuity is not permission to expose all
recent dialogue merely because Ember remembers it.

A group surface, shared device, forwarded message, or uncertain recipient would make
participant compatibility weaker even when the same account identifier appears. The
safe rule from the operational research still applies: account and surface identity
are evidence about a person, not the person themselves.

## Provider threads and sessions are operational evidence only

Provider-native thread/session identifiers may be useful for diagnostics, cost,
latency, caching, or adapter-local operation. They do not define Ember conversation
identity and must not be the only place where required conversational state exists.

In particular:

- changing provider must not erase the conversation;
- starting a fresh provider invocation must not erase the conversation;
- losing an external provider thread ID must not erase the conversation;
- receiving the same provider thread ID must not prove that two Ember interactions
  belong to the same conversation; and
- provider-hidden history must not reintroduce dialogue Ember deliberately excluded
  from the current projection.

The last point prevents **ghost context**: a provider-native chat session silently
remembering material that Ember's own selector considered stale, wrong-scope,
private, or irrelevant.

A provider session may later be used as a replaceable optimization only if Ember can
still reconstruct the semantically required conversational projection herself and
can prevent provider-local hidden state from becoming an uninspectable source of
continuity or authority.

## What must survive process or provider replacement

A conversation can continue truthfully after process or provider replacement only if
Ember retains enough of the still-current discourse outside that replaced locus.

For every conversational turn that remains relevant to continuation, the architecture
must be able to recover the equivalent of:

- participant attribution;
- principal and scope provenance sufficient to enforce the current disclosure
  boundary;
- semantic occurrence identity so replay does not manufacture duplicate turns;
- ordering and direct-response/correlation relationships needed to resolve the local
  trajectory;
- turn content, or a provenance-preserving representation faithful enough for the
  references that remain live;
- whether the contribution was user input or an Ember expression;
- whether an Ember expression is established, absent, or unknown after interruption;
- the distinction between expression occurrence and delivery state; and
- enough recovery/interruption evidence to avoid pretending cognition or observation
  happened during a gap.

Not all of this must remain forever. It must remain while omission would materially
change justified interpretation of the current turn.

### Ember's own previous expression must be recoverable while locally relevant

The existing minimal continuity slice deliberately records
`ember_expression_via_provider` as descriptor-only evidence and does not retain the
reply payload. That was sufficient for its earlier continuity fixtures because those
fixtures intentionally did not depend on conversational references to Ember's own
prior wording.

It is not sufficient for this epic.

If the user asks "why did you say that?" after a clean restart, Ember needs an
Ember-owned short-lived representation of the relevant prior expression, or another
faithful representation that preserves enough of its content to answer truthfully.
That material must remain separate from canonical memory and separate from a provider
transcript.

This is an implementation requirement for #217/#218, not a decision to promote reply
text into durable remembered meaning.

## Boundedness and currentness

### Boundedness is semantic before it is numeric

Conversation context must be bounded, but this design does not define the bound as
"last N messages", a fixed time interval, or a token count.

A turn deserves current conversational participation when omitting it creates a
material risk of misunderstanding the present discourse, for example because it
contains:

- the antecedent of a pronoun or elliptical phrase;
- the options behind "the first one" or "the other approach";
- an unresolved question whose answer the user is continuing;
- a local correction or qualification still governing the exchange;
- a currently active reasoning or planning thread; or
- wording the user explicitly asks Ember to explain, compare, or continue.

Conversely, selection should normally stop carrying turns merely because they are
recent when they belong to:

- a completed or abandoned topic;
- a superseded local assumption;
- a detached side discussion;
- an incompatible principal, recipient, or scope;
- repetitive material that adds no needed discourse relation; or
- history whose only remaining significance is already represented by canonical
  meaning and whose exact conversational form no longer matters.

A concrete implementation may use recency, turn count, token pressure, summaries, or
other heuristics. Those are candidate mechanics beneath the semantic boundary, not
the definition of relevance.

### Dialogue currentness is not proposition currentness

A historical turn remains evidence of what was said even after it stops governing
current dialogue. The propositions inside it may have independent currentness in
canonical memory.

For example, an old turn saying "let's use option A for now" can remain historically
accurate even after the conversation adopts option B. Context selection should not
keep A as a live local assumption merely because the text is recent, while durable
memory should not rewrite the historical fact that A was previously discussed.

### Pressure may cause truthful degradation

If the bounded conversational layer cannot retain exact detail indefinitely, it may
shrink or transform the locally relevant history, provided it preserves provenance
and does not strengthen the source.

When exact wording is no longer recoverable, Ember should degrade truthfully:

- retain enough current discourse structure when possible;
- preserve that a detail was omitted or compressed when that matters;
- recover durable canonical meaning independently when relevant; and
- avoid claiming exact recall of a prior utterance that no longer survives.

A summary of prior dialogue is derived context, not stronger evidence than the turns
from which it came. Repeated inclusion or compaction cannot promote it into canonical
memory.

## Restart and interruption semantics

### Clean restart

A clean process stop does not end a conversation by itself.

If a trajectory remains current and its needed conversational material survives, a
new process should be able to continue it with a fresh provider invocation. The new
process may know that a clean inactive interval occurred and should not claim any
Ember cognition during that interval beyond the established recovery evidence.

A clean restart therefore tests whether conversation continuity is Ember-owned rather
than process-owned.

### Ambiguous interruption

An uncertain crash boundary must not be repaired by inventing a neat transcript.

After recovery, Ember should distinguish at least these cases when evidence supports
them:

- inbound turn durably accepted, no expression established;
- cognition outcome unknown;
- Ember expression durably established, delivery not attempted;
- Ember expression durably established, delivery failed;
- Ember expression durably established, delivery uncertain; and
- delivery confirmed by the available transport evidence.

Only an established Ember expression can participate as an Ember conversational turn.
An uncommitted provider candidate or unknown cognition result cannot be reconstructed
as though Ember definitely said it.

Likewise, a committed expression with uncertain delivery remains part of Ember's own
interaction history, but Ember must not infer that the user saw it. A later user
response can itself become new evidence that the expression was received or otherwise
known to them.

### Replay after interruption

The existing surface occurrence key continues to govern transport replay. A Telegram
replay with the same stable external occurrence identity and matching metadata must
resolve to the already established user turn/exchange rather than creating another
turn. An identical CLI line remains a new occurrence because identical text is not
occurrence identity.

Conversation correlation sits above this replay rule. Replay answers "is this the
same occurrence?" Conversation membership answers "which discourse trajectory does
this occurrence continue?" They must not be conflated.

## Representative scenarios

| Scenario                                     | Correct conversation semantics                                                                                                        | Failure                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Consecutive CLI follow-up**                | `"Use the second option"` can resolve against the still-live option set from prior turns without making those turns canonical memory. | Current input is sent alone, or the whole transcript is treated as durable memory.                      |
| **Telegram transport replay**                | The replay maps to the existing inbound turn and exchange; no duplicate cognition or dialogue turn appears.                           | Duplicate delivery creates a second semantic request or false repetition.                              |
| **CLI -> Telegram continuation**             | The same Ember-owned conversation can continue when principal/disclosure compatibility and discourse linkage are justified.           | Surface change forces a new conversation, or same account automatically exposes unrelated CLI dialogue. |
| **Same principal/scope, new topic**          | A fresh topic can start a different trajectory even in the same terminal/chat and scope.                                              | Principal + scope are treated as one immortal transcript.                                              |
| **Clean restart**                            | Still-current local dialogue survives outside the process and is projected into a fresh provider invocation.                          | Conversation disappears because the process/provider thread ended.                                     |
| **Provider replacement**                     | A new provider receives Ember-selected current dialogue and can continue without the old provider session.                            | External provider thread ID is treated as the only continuity key.                                     |
| **Expression committed, delivery uncertain** | Ember may retain the expression as her turn while remaining uncertain whether the user saw it.                                        | `expression committed` is reported as `user received`, or uncertainty causes blind re-expression.      |
| **Cognition outcome unknown**                | Recovery records the gap and does not fabricate an Ember turn.                                                                        | A provider-local partial/candidate reply is inserted into history as though Ember said it.             |
| **Old topic resumed explicitly**             | Ember may reconstruct enough of the prior trajectory if still permitted and available; missing detail remains a gap.                  | Every old turn stays in default context forever, or resumed context is invented from vague similarity. |

## Implementation and evaluation invariants for #217-#219

The child tasks under epic #215 must preserve all of the following invariants.

1. **Ember ownership:** conversational continuity is reconstructible from Ember-owned
   state/evidence and does not depend on one provider, process, surface, or transport
   session.
2. **Turn uniqueness:** transport replay, provider retries, streaming fragments, and
   delivery retries do not manufacture duplicate semantic turns.
3. **Participant attribution:** selected dialogue preserves who contributed each turn
   and does not collapse user testimony into Ember expression or vice versa.
4. **Exchange correlation:** an inbound turn can be related to its expression outcome
   without pretending that acceptance, cognition, expression, delivery, and awareness
   are the same event.
5. **Conversation membership:** same principal/scope/session is insufficient by
   itself; discourse continuity is established or remains explicitly uncertain.
6. **Cross-surface privacy:** a conversation may continue across surfaces only under
   a newly valid recipient/disclosure boundary.
7. **No transcript-as-memory:** conversation material does not become canonical
   meaning merely because it is retained, repeated, summarized, or selected.
8. **Expression availability:** locally relevant Ember expressions remain recoverable
   across clean restart/provider replacement with enough fidelity to resolve valid
   follow-up references.
9. **Bounded selection:** default conversational participation is finite and
   inspectable; stale or unrelated dialogue can leave the projection without being
   rewritten as forgotten canonical state.
10. **Currentness:** a historically accurate prior turn does not remain a governing
    local assumption after correction, topic change, closure, or supersession.
11. **Provider independence:** provider-native thread/session state is operational
    evidence or optimization only; hidden provider history cannot bypass Ember's own
    selection boundary.
12. **Truthful interruption:** unknown cognition/expression/delivery boundaries remain
    unknown until stronger evidence resolves them; recovery does not synthesize a
    clean transcript.
13. **Truthful degradation:** when required conversational detail is unavailable,
    Ember exposes or behaves consistently with that gap rather than inventing exact
    recall.
14. **Inspectability:** implementation/evaluation can explain which dialogue material
    participated, why it was considered part of the current trajectory, and which
    operational identifiers were merely supporting evidence.

These invariants are the architecture oracle for #217's selection mechanics, #218's
cross-surface/restart persistence, and #219's longitudinal evaluation.

## Deliberately unresolved representation questions

This design does not choose:

- a `Conversation`, `Turn`, or `Exchange` TypeScript schema;
- where short-lived dialogue payloads are stored;
- whether an Ember-owned conversation correlation is represented by an explicit ID,
  derived relation, or another structure;
- a fixed number of turns, token budget, time-to-live, or inactivity timeout;
- a topic classifier or semantic-similarity threshold;
- compaction or summarization format;
- whether several trajectories can be simultaneously foregrounded;
- provider prompt/message formatting;
- provider-native session reuse as an optimization;
- automatic promotion of dialogue into canonical memory; or
- long-term retrieval/indexing for large historical conversation archives.

Automatic memory adoption belongs to epic #220. Retrieval/indexing at scale belongs
to the later roadmap work that earns it through actual pressure.

## Traceability

| Source                                                                                                      | Constraint inherited here                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Issue #215](https://github.com/arhor/ember/issues/215)                                                     | Natural multi-turn conversation needs bounded Ember-owned recent dialogue across CLI, Telegram, and restarts without transcript-as-memory.                                                  |
| [Continuity and Identity Semantics](../research/continuity-and-identity.md)                                 | Model, process, interface, and temporary context do not own Ember identity or continuity.                                                                                                   |
| [Memory and Remembering Semantics](../research/memory-and-remembering.md)                                   | Raw history, durable memory, current belief, and temporary context have different meanings and lifecycles.                                                                                  |
| [Context Selection and Cognitive Framing Semantics](../research/context-selection-and-cognitive-framing.md) | Conversational trajectory is selected by material relevance and remains authority-preserving rather than authority-generating.                                                              |
| [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md)                                    | Cognition receives sufficient rather than maximal permitted projections; selection includes deliberate exclusion.                                                                          |
| [Operational Model, Sessions, and Surfaces](../research/operational-model-sessions-and-surfaces.md)         | Conversation follows semantic discourse continuity rather than session, transport, or surface identity.                                                                                    |
| [Interaction Surface Boundary](interaction-surface-boundary.md)                                             | Principal provenance, semantic occurrence/replay, cognition, expression, and delivery remain distinct.                                                                                     |
| [Minimal Continuity Vertical Slice](minimal-continuity-slice.md)                                            | The current executable slice is provider-session-independent but intentionally drops reply payload; #215 now requires a short-lived Ember-owned dialogue layer beyond that earlier fixture. |
