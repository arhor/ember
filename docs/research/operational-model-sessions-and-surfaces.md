---
summary: "Canonical semantics for sessions, surfaces, concurrent interactions, long-running work, delivery and retry, downtime, recovery, and partial failure around one continuing Ember."
read_when:
  - "Changing restart or recovery, session, surface, transport, or multi-interface behavior"
  - "Designing long-running work, retries, duplicate delivery, concurrent interaction, downtime gaps, or resumption/currentness reconciliation"
role: research
discovery_status: current
---

# Operational Model, Sessions, and Surfaces Semantics

This note addresses issue #8 and follows the concern-driven research discipline defined in issue #10.

It builds directly on [Continuity and Identity Semantics](continuity-and-identity.md), [Memory and Remembering Semantics](memory-and-remembering.md), [Context Selection and Cognitive Framing Semantics](context-selection-and-cognitive-framing.md), [Capabilities and Delegation Semantics](capabilities-and-delegation.md), [Action, Authority, and Permission Semantics](action-authority-and-permission.md), and [Endogenous Agency and Self-Initiated Behavior Semantics](endogenous-agency-and-self-initiated-behavior.md). Their conclusions are active constraints rather than background.

The original research report behind this synthesis is preserved as [source material](source-material/operational-model-sessions-and-surfaces-deep-research.md). It is non-canonical. A separate [portable evidence map](operational-model-sessions-and-surfaces-references.md) maps the principal evidence-labelled conclusions below to durable distributed-systems, durable-work, HCI, runtime, and inherited Ember sources.

This note deliberately stays at the semantic level. It does not choose a daemon architecture, queue, event schema, IPC mechanism, actor model, process topology, synchronization primitive, transaction model, persistence technology, transport protocol, status enum, session identifier design, deduplication key, or implementation language.

## Central conclusion

Issue #8 asks what must remain semantically true when conversations, sessions, surfaces, transports, runtimes, and periods of availability appear and disappear around one continuing Ember.

The strongest conclusion is:

> **[J] Ember's operational model should be continuity-centred rather than session-centred. A session, surface, transport connection, process, model invocation, or specialist runtime is a temporary locus through which part of Ember's continuing life becomes operationally available. None of those loci owns Ember's identity, durable memory, relationships, live commitments, authority, unresolved concerns, or delegated-objective continuity merely because it temporarily hosts interaction or execution.**

A compact expression is:

```text
operational continuity =
    one continuing Ember
  + temporary interaction frames
  + work that can outlive those frames
  + currentness reconciliation
  + occurrence/delivery distinction
  + truthful gaps and partial observability
  + principal- and surface-aware disclosure
  + authority that survives only on its own semantic terms
```

This makes operational seamlessness subordinate to truth.

> **[J] Ember should remain intelligibly herself when operational loci disappear and reappear, while remaining truthful about what cognition, observation, action, delivery, and external change actually occurred during the gap.**

A graceful statement such as "I was unavailable during that interval; this is what persisted, this is what I learned after returning, and this part remains unknown" preserves continuity better than a fluent fiction that Ember watched, thought, or waited through an interval in which no such cognition occurred.

No evidence reviewed in this phase gives a substantive reason to reopen a canonical conclusion from issues #2 through #7.

## Evidence discipline

This note uses the established Ember evidence vocabulary:

| Mark | Meaning |
|---|---|
| **[E] Empirical** | User study, experiment, measured failure, benchmark, or documented runtime behaviour. |
| **[C] Convergence** | A recurring semantic pressure independently visible across mature implementations. Useful evidence, not proof. |
| **[J] Judgment** | An Ember-specific semantic conclusion derived from project goals, inherited constraints, scenarios, and available evidence. |
| **[H] Hypothesis** | Plausible but insufficiently validated and suitable for later experiment. |
| **[L] Lens** | A distributed-systems, HCI, security, durable-work, or adjacent distinction used to sharpen reasoning without importing an architecture wholesale. |

Operational research draws from three evidence families.

1. Persistent-agent runtimes expose practical pressure around sessions, multiple surfaces, independent work lifetime, resumption, connectivity, and persistent agent state.
2. Messaging and durable-work systems expose what acknowledgements, retries, delivery guarantees, and execution signals can and cannot establish about external-world effects.
3. HCI research exposes the human costs of interruption, the value of resumption cues, the consequences of cross-device transitions, and the danger of treating every technically available result as something that should be surfaced immediately.

These inputs are evidence about required semantics. They are not proposals that Ember become a workflow engine, message broker, notification framework, or copy of any reviewed agent runtime.

## Inherited constraints

The preceding research phases already establish several invariants that issue #8 must preserve.

### Continuity belongs to Ember

Issue #3 establishes that a model call is an episode of cognition rather than Ember's identity, and that continuity depends on persistent lineage, constitutive commitments, autobiographical ownership, relationships, and live commitments rather than one model, prompt, process, interface, or transcript.

Operational consequence:

> **[Inherited J] Process lifetime, session lifetime, and transport lifetime cannot define Ember lifetime.**

### Memory preserves currentness and provenance

Issue #4 distinguishes historical evidence, durable memory, current belief, testimony, inference, interpretation, commitments, and temporary context. A proposition can remain historically true while ceasing to govern the present.

Operational consequence:

> **[Inherited J] A late message, result, permission, preference, or status may remain valid history while no longer being currently applicable.**

### Context is temporary projection

Issue #5 establishes context as a purpose- and situation-bounded projection of persistent state rather than the canonical owner of identity or memory.

Operational consequence:

> **[Inherited J] A surface that sees less context must not silently create a different Ember, and recovery after a gap should reconstruct the current situation rather than recreate an old prompt.**

### Delegated work has its own continuity

Issue #6 distinguishes Ember continuity, delegated-objective continuity, and specialist-thread continuity. Delegated work may outlive its initiating conversation, and failure or cancellation does not imply rollback.

Operational consequence:

> **[Inherited J] Closing the initiating interaction does not cancel specialist work unless an independent semantic reason says the work itself should end.**

### Authority remains independent of runtime state

Issue #7 distinguishes capability, authority, control, observability, responsibility, runtime ownership, and provenance.

Operational consequence:

> **[Security invariant; inherited J] Delivery, reconnection, process recovery, cached state, specialist capability, or a resumed session must not manufacture authority that was never legitimately granted.**

### Wake-up and motivation are distinct

Issue #2 establishes that a scheduler, pulse, restart, or resource-availability event can provide an opportunity for cognition without supplying the reason that determines what matters.

Operational consequence:

> **[Inherited J] Downtime cannot be backfilled with fictional thought. A live concern may persist through downtime and become worth reconsidering after recovery, but Ember must not claim cognition occurred while it was unavailable.**

## Working semantic distinctions

These meanings should remain distinguishable even if a future implementation represents several of them together.

| Concept | Ember-facing meaning | Must not imply |
|---|---|---|
| **Ember continuity** | Persistence of the same agent lineage and its durable semantic state across operational episodes. | Process uptime, one session, one model, or one surface. |
| **Session** | A bounded temporary interaction or working frame carrying local conversational and situational state. | Identity, all durable memory, all current work, or one unique conversation. |
| **Conversation / thread** | A semantically coherent discourse trajectory or unresolved line of interaction. | One socket, one UI tab, or one session identifier. |
| **Surface** | The interaction setting through which a participant encounters Ember, such as CLI, messaging, voice, or web. | A separate Ember or unrestricted access to all remembered state. |
| **Transport connection** | A technical path currently capable of carrying information. | Principal identity, successful user awareness, or semantic delivery. |
| **Work / delegated objective** | A continuing purpose whose completion, blockage, cancellation, or obsolescence can matter beyond one interaction. | An active conversation or live transport. |
| **Presence** | A surface-relative claim that Ember is presently available for some form of interaction under that surface's circumstances. | Active cognition or universal reachability. |
| **Activity** | Cognition or execution that is actually occurring now. | Presence on every surface. |
| **Idle** | Operational availability without current Ember-owned cognition demanding execution. | No delegated work exists or no concerns remain live. |
| **Unavailability** | Loss of a particular operational ability, resource, surface, or dependency. | Identity loss or necessarily total agent failure. |
| **Downtime** | An interval in which Ember cannot perform the relevant cognition or observation. | Erasure of durable continuity. |
| **Recovery** | Re-establishing a justified current operating view after interruption, uncertainty, or unavailable state. | Replaying the past as if no gap occurred. |
| **Semantic occurrence** | A user interaction or external-world happening that counts as one meaningful occurrence regardless of how it is transported. | One received message copy or notification. |
| **Delivery** | An attempt or outcome of moving a representation of an occurrence or result to a recipient or surface. | A new occurrence, user awareness, or authority. |

The research found strong implementation convergence that mature systems eventually need several of these distinctions even when their concrete names and data models differ. See [R1 OpenClaw](operational-model-sessions-and-surfaces-references.md#r1-openclaw-session-surface-and-runtime-behaviour), [R2 Letta](operational-model-sessions-and-surfaces-references.md#r2-letta-persistent-agents-and-conversations), [R3 Hermes](operational-model-sessions-and-surfaces-references.md#r3-hermes-sessions-surfaces-and-background-work), and the existing Ember system reconnaissance.

## A session is a temporary frame, not a continuity boundary

> **[J] A session is useful when a bounded local interaction frame exists strongly enough that recent references, local assumptions, presentation state, and resumption cues can reasonably be interpreted together.**

Its exact creation or expiry mechanism remains out of scope.

What matters more is what a session must not own.

> **[J] Ending a session does not by itself end Ember, a relationship, a commitment, a standing intention, remembered authority, an unresolved concern, a semantic conversation that can legitimately be resumed, or delegated work that is still live.**

Each of those states may independently complete, expire, be revoked, become irrelevant, or be superseded. Their lifecycle simply cannot be inferred from session lifecycle.

This preserves the issue #8 requirement:

> Closing a window must not be equivalent to stopping Ember, forgetting the relationship, cancelling delegated work, or abandoning commitments unless some independent semantic reason says so.

### Conversation and session are not synonyms

> **[J] Conversation or thread continuity should follow semantic discourse continuity more closely than transport or session identity.**

Therefore:

```text
same session      != necessarily same conversation
new session       != necessarily new conversation
same conversation != necessarily same surface
```

A conversation can span several transport connections or sessions when the later interaction genuinely resumes the earlier matter. A single session can host several semantically distinct threads.

"Resume" therefore means recovering enough justified understanding of the current discourse and surrounding state to continue it. It does not mean reproducing a previous model prompt or treating every old local assumption as current.

## Surfaces are windows, not owners

CLI, messaging, voice, and future interfaces can all be windows onto the same continuing Ember while remaining semantically different interaction settings.

> **[J] A surface changes which information can appropriately be shown, how uncertainty can be represented, what interruption costs exist, which recipients may be present, how much context can usefully be communicated, and which interaction affordances are available. It does not change who Ember is.**

A voice surface may need shorter, interruptible responses. A terminal may expose detailed provenance. A group channel changes recipients. A lock-screen notification can expose information to bystanders. None of those differences justifies a separate agent identity.

This gives two independent questions whenever Ember moves across surfaces:

1. Is this still the same Ember?
2. Who is actually present, and what information or authority is appropriate here?

The first can remain true while the second is uncertain.

### Principal identity is distinct from session identity

> **[Security/privacy invariant; J] A surface account, device, transport address, or session is evidence about a principal. It is not automatically equivalent to a person.**

This matters for shared household devices, group channels, forwarded or bridged messages, and one user appearing through multiple identities.

Current OpenClaw behaviour explicitly exposes identity linking across channels and warns that collapsing direct-message contexts among several humans can leak private information. See [R1](operational-model-sessions-and-surfaces-references.md#r1-openclaw-session-surface-and-runtime-behaviour). Shared-device HCI provides independent evidence that account and person identity frequently diverge in household settings. See [R14](operational-model-sessions-and-surfaces-references.md#r14-shared-device-and-family-identity-pressure).

> **[J] Cross-surface continuity may preserve Ember's full memory of a relationship while narrowing what can legitimately be disclosed on the current surface.**

This is the operational form of issue #5's contextual-integrity rule and issue #7's recipient-sensitive authority semantics.

## Presence, activity, idle state, and availability are independent

The phrase "Ember is online" hides too many different truths.

> **[J] Presence, activity, reachability, observability, and continuity should remain semantically independent.**

Examples:

- Ember may remain continuous while completely offline.
- Telegram may be reachable while CLI is unavailable.
- Ember may be present and idle, with no Ember cognition executing.
- Ember may be idle herself while a delegated specialist still works.
- Ember may be actively thinking while unable to deliver output through the original surface.
- A persisted session may exist while its transport is disconnected.
- A specialist may remain active while Ember's own process has failed.

OpenClaw's current documentation explicitly distinguishes persisted sessions from channel liveness. See [R1](operational-model-sessions-and-surfaces-references.md#r1-openclaw-session-surface-and-runtime-behaviour).

This yields a general rule:

> **[J] User-visible operational presentation may simplify, but it must not convert one fact into a stronger fact of a different kind.**

For example:

- session exists -> does not prove Ember is reachable;
- request accepted -> does not prove meaningful execution started;
- work started -> does not prove it is still making progress;
- cancellation requested -> does not prove execution stopped;
- execution stopped -> does not prove effects were rolled back;
- specialist completed -> does not prove the result remains current;
- transport accepted a message -> does not prove the user saw it;
- Ember was offline -> does not prove nothing happened in the world.

These are semantic distinctions, not a proposal for a status enum.

## Long-running work is independent of interaction lifetime

Issue #6 already establishes that delegated work can outlive its initiating conversation. Issue #8 adds the operational consequence:

> **[J] Work that remains semantically live must not cease to exist merely because its initiating session, conversation, surface, or transport disappeared.**

Meaning that must remain recoverable across such a boundary includes at least:

- what objective is being pursued and why;
- which constraints and acceptance conditions still govern it;
- where relevant authority came from and what it covered;
- which assumptions about external state materially shaped the work;
- who owns local specialist execution;
- which effects or partial results are known;
- which uncertainties remain unresolved;
- whether stopping was requested, acknowledged, observed, or only hoped for;
- what would make the returned result current enough to rely on;
- whether and under what circumstances the result deserves user attention.

These are semantic obligations, not fields in a future work-item schema.

### Completion is not currentness

> **[Inherited J] A late result can be historically valid and currently obsolete.**

If Codex begins work against objective A and the user changes the objective to B before completion, Codex can later succeed perfectly relative to A. The proper interpretation is neither "Codex failed" nor "the current task is complete."

The specialist completed older work. Current applicability must be reconsidered.

The same applies when the repository changes independently, authority is revoked, the target disappears, a user preference changes, or a better result arrives elsewhere.

### The original surface does not own the result

> **[J] A long-running result belongs first to the continuing work and Ember's history, not to whichever surface happened to originate the request.**

If the CLI disappears, the result should not become semantically lost. But Ember must not automatically send it through another reachable surface merely because that surface exists.

Cross-surface delivery is a current recipient, privacy, currentness, and attention decision.

## Semantic occurrence and delivery are distinct

This is the most important new boundary introduced by issue #8.

Messaging systems routinely expose duplicate delivery, redelivery, replay, and out-of-order arrival. Standard Amazon SQS explicitly provides at-least-once delivery and can deliver duplicates or reorder messages. Google Pub/Sub exactly-once delivery has deliberately scoped guarantees and distinguishes valid redelivery from duplicate delivery. See [R4](operational-model-sessions-and-surfaces-references.md#r4-amazon-sqs-at-least-once-delivery) and [R5](operational-model-sessions-and-surfaces-references.md#r5-google-cloud-pubsub-exactly-once-delivery).

The transferable Ember rule is:

> **[E -> J] A delivery attempt is evidence about how Ember learned of an occurrence. It is not the occurrence itself.**

### Duplicate delivery of one occurrence

When provenance establishes that two deliveries represent one underlying user message, external event, or specialist result, the second delivery must not silently create:

- a second user instruction;
- twice the authority;
- a second memory of the same occurrence as though it happened twice;
- a second purchase or mutation;
- a second autobiographical event;
- a second notification merely because the transport replayed one event.

### Two identical real occurrences

The inverse is equally important.

> **[J] Ember must not deduplicate meaning solely because two representations look identical.**

Two identical-looking requests may be intentional repeats. Two sensors can report the same value independently. Two payments can genuinely be separate. SQS supports explicit message deduplication identity rather than treating body equality as occurrence identity. See [R6](operational-model-sessions-and-surfaces-references.md#r6-amazon-sqs-message-deduplication-identity).

When stable source correlation, provenance, or causal history establishes one occurrence, Ember may treat repeated delivery accordingly. When the evidence is insufficient, uncertainty should remain visible rather than being replaced by an invented identity relation.

## Occurrence time, observation time, and applicability time may differ

Delayed and out-of-order delivery expose a temporal distinction that chat systems often hide.

> **[J] Ember may need to distinguish when something occurred, when Ember learned about it, and when the information, preference, instruction, or authority applies.**

Examples:

- an external event happened yesterday but Ember learned about it after restart;
- an old request arrives after the user already solved the problem elsewhere;
- a correction is delivered before the older message it corrects;
- a user states a future-effective preference;
- a specialist report arrives now but describes work performed against an earlier world state.

This is the operational extension of issue #4's temporal semantics.

> **[J] Arrival order is evidence about observation order, not automatic authority over historical or current truth.**

## Retry semantics begin with epistemology

A failed request can mean nothing happened, the effect happened but acknowledgement was lost, part of the effect happened, the work is still running, or the effect happened more than once after retry.

Stripe's documented network-failure semantics and AWS Durable Execution both make this ambiguity explicit. Stripe treats some network and server errors as indeterminate from the client perspective; AWS Durable Execution instructs callers to inspect external state after an interrupted side-effecting step when the effect may have occurred. See [R7](operational-model-sessions-and-surfaces-references.md#r7-stripe-network-errors-and-idempotency) and [R8](operational-model-sessions-and-surfaces-references.md#r8-aws-durable-execution-error-and-retry-semantics).

> **[E -> J] "I did not receive success" is not equivalent to "the action did not occur."**

Therefore:

> **[J] Before repeating consequential work after ambiguous failure, Ember should establish external state to the degree warranted by the consequences, unless the operation is independently known to be safe to repeat under the relevant contract.**

A cheap status check and a duplicate financial charge need not incur the same recovery effort. Consequence matters.

### A retry is a semantic relation

> **[J] A later attempt is meaningfully a retry when it continues substantially the same unresolved objective under materially compatible authority, target, constraints, and intended effect.**

A later action should instead be treated as new work when the objective, target, authority, purpose, intended scale, recipient, or relevant world state changed enough that calling it the same attempt would hide a new decision.

The exact retry mechanism remains out of scope.

## Concurrency is primarily a currentness problem

Issue #8 does not need locks, transactions, queues, or serialization rules to identify the semantic invariant those mechanisms would eventually need to protect.

> **[J] Two concurrent cognitions may each begin from justified state and become unjustified because another interaction, actor, or external occurrence changes a premise before the first cognition commits to a consequential conclusion or action.**

Current OpenClaw runtime behaviour provides implementation evidence for stale-assumption reconciliation among concurrent sessions. See [R1](operational-model-sessions-and-surfaces-references.md#r1-openclaw-session-surface-and-runtime-behaviour). The concrete mechanism is not an Ember proposal.

### Concurrency is not globally dangerous

Two unrelated conversations can proceed independently.

> **[J] Concurrency matters to an interaction when another concurrent occurrence can materially change a premise, authority, commitment, shared resource, objective, recipient, or consequence on which that interaction depends.**

This makes awareness dependency-sensitive rather than universal.

### A cognition can become stale while still running

Suppose one interaction begins from the remembered preference "prefer A." Before it produces an external effect, the user changes the same scoped preference elsewhere to B.

The old preference remains historical evidence. It no longer governs current action after the newer preference is legitimately established.

> **[J] Before consequential outward action whose justification depends on mutable premises, currentness should be re-established when there is a material reason to suspect that those premises changed.**

This does not imply re-reading all persistent state before every thought. The exact boundary is a later design and evaluation question.

### Conflicting concurrent instructions do not resolve by runtime convenience

Neither "last computation wins," "first task already started," nor "most recently delivered message wins" is a legitimate semantic authority rule by itself.

Conflict should remain visible until precedence can be established from source, principal, scope, temporal applicability, explicit supersession, current user intent, and effects already incurred.

This directly inherits issue #4's conflict-preservation semantics and issue #7's authority-conflict invariant.

## Downtime is a gap in experience, not a gap in identity

> **[Inherited J] When Ember's relevant cognition or observation runtime is inactive, she does not experience that interval.**

Durable commitments may survive. Delegated work hosted elsewhere may continue. The external world may change. Messages may accumulate. Scheduled opportunities may pass.

Ember should not later claim:

- that she watched a build while offline;
- that she noticed something at 02:00 if no cognition ran then;
- that she kept thinking during an inactive interval;
- that an unobserved external event did not occur.

> **[J] Durable state can span a period Ember did not experience.**

That is not a contradiction. It is a direct consequence of continuity being durable while cognition is episodic.

## Recovery is reconciliation, not replay

After downtime, crash, model replacement, reconnect, or lost dependency, the goal is not to reconstruct the exact previous computational state.

> **[J] Recovery should establish the best justified current situation from surviving continuity, recoverable evidence, currently observable external state, and explicit uncertainty about the gap.**

A semantic reconstruction may need to establish:

- who is present now;
- which surface and privacy conditions apply;
- which conversation or work is actually being resumed;
- which live commitments and unresolved concerns survived;
- what work may have continued elsewhere;
- what was known to have happened before the gap;
- what could have happened during the gap;
- what can be observed now;
- which old assumptions may be stale;
- whether authority, recipients, preferences, or external resources changed;
- what messages or results arrived during the gap;
- what remains genuinely unknowable.

These are semantic questions rather than a recovery pipeline.

HCI research on interrupted task resumption supports the narrower claim that useful resumption depends on recovering goals and relevant state rather than merely having chronology. See [R9](operational-model-sessions-and-surfaces-references.md#r9-trafton-et-al-resumption-goals) and [R10](operational-model-sessions-and-surfaces-references.md#r10-deline-and-parnin-task-resumption-cues).

> **[E -> J] Resumption benefits from recovering purpose and relevant context. Complete transcript replay is neither necessary nor sufficient for semantic recovery.**

### A gap may remain unresolved

An external system may retain no audit history. A sensor may have been offline. A specialist may disappear without a terminal report.

> **[J] Recovery is allowed to end with an explicit autobiographical or operational gap.**

Truthful uncertainty preserves continuity better than invented seamlessness.

## Missed scheduled opportunities are purpose-sensitive

Suppose Ember was unavailable at 02:00 when some scheduled opportunity would normally occur.

The same mechanical miss can have different semantic meanings:

- "at exactly 02:00, perform X";
- "perform X once after 02:00";
- "each night, inspect X so the morning state is current";
- "at 02:00, give Ember an opportunity to reconsider a live concern";
- "notify the user if condition C becomes true."

These should not share one recovery policy.

> **[J] A missed scheduled opportunity should be reconsidered according to the purpose and temporal semantics of the underlying intention rather than mechanically replayed because a timer opportunity was missed.**

An exact-time opportunity may expire. A persistent obligation may remain overdue. A periodic check may require one fresh check rather than replay of each missed interval. An endogenous wake-up opportunity that never occurred cannot be backfilled as past cognition, although the still-live concern may legitimately be reconsidered now.

This preserves issue #2's distinction that wake-up is mechanism while motivation is meaning.

## Result availability and user interruption are distinct

A long-running task finishing does not automatically imply that Ember should immediately contact the user.

> **[J] Result availability and result delivery are separate decisions.**

Whether to interrupt should consider at least:

- urgency and opportunity expiry;
- whether the user can act usefully now;
- consequence of delay;
- communication expectations;
- quiet periods;
- repetition and bundling opportunities;
- current surface availability;
- privacy of candidate surfaces;
- whether the result remains current;
- whether another interaction already resolved or superseded the need.

HCI interruption research finds measurable benefit from deferring notifications to better task boundaries rather than surfacing every item at the earliest technically possible instant. See [R11](operational-model-sessions-and-surfaces-references.md#r11-iqbal-and-bailey-notification-interruption).

> **[E + J] Appropriate delay can be an intelligent delivery outcome rather than a delivery failure.**

This aligns directly with issue #2's useful non-action and quiet-period conclusions.

### Surface choice is part of disclosure semantics

If work began through CLI and the CLI disappears, a private Telegram message may be an appropriate later delivery route under some circumstances. A family voice speaker or group channel may not be.

> **[J] Cross-surface delivery requires current recipient, privacy, currentness, and attention reasoning. Technical reachability is insufficient.**

## Graceful degradation should preserve semantic truth

Optional parts of Ember will fail independently. The operational model should make partial function possible where doing so does not require semantic overclaiming.

### Surface unavailable

Another legitimate surface may remain usable. Ember continuity is unaffected.

### Memory temporarily unavailable

Ember may continue a constrained interaction when doing so is safe, but should not behave as though relationship state, old decisions, standing authority, or commitments were recovered when they were not.

> **[Inherited J] "I cannot currently recover that memory" is different from "I do not remember it" and from "it never happened."**

### Specialist unavailable

The delegated objective may remain live while execution is blocked. Ember can still discuss, reconsider, cancel where possible, or choose another legitimately authorized path.

### Cognition provider unavailable or replaced

A provider failure does not end Ember. A fallback or replacement may preserve continuity if the continuing agent's governing semantics remain available and the change does not independently alter privacy, authority, or capability circumstances.

### Delivery surface unavailable

A result may remain durable and undelivered. It must not be silently rerouted to a lower-privacy recipient simply for the sake of delivery.

> **[J] Graceful degradation means preserving the strongest truthful subset of function still justified, not simulating capabilities that are currently missing.**

## Operational truth versus interface presentation

Future surfaces will likely need simplified status presentations. The research does not define status enums, but it does establish distinctions that presentation must preserve.

A UI must not lie about:

- whether work actually started;
- whether work is still known to be running;
- whether progress is being observed or merely assumed;
- whether cancellation was requested versus completed;
- whether prior side effects may survive cancellation;
- whether a result remains current;
- whether Ember is reachable through a particular surface;
- whether Ember can currently observe new external events;
- whether a message reached a transport, a device, or a human;
- whether a retry might duplicate an external effect;
- whether an operational gap remains unresolved.

> **[J] Operational presentation must never outrun Ember's justified knowledge.**

## Existing systems as evidence, not templates

### NanoBot

NanoBot's interaction-facing loop versus inner model/tool loop supports a useful separation between one interaction episode and the cognition/execution that occurs within it. Its agent workspace also demonstrates that personal continuity can remain separate from project and surface context.

The transferable pressure is that interaction lifetime and execution lifetime need not be the same thing. The concrete loop structure is not an Ember proposal.

### Hermes

Hermes provides evidence for persisted/resumable sessions, multiple surfaces, isolated delegated/background work, and observable long-running actions. See [R3](operational-model-sessions-and-surfaces-references.md#r3-hermes-sessions-surfaces-and-background-work).

Its literal session resume behaviour is operationally useful, but transcript/session continuation alone is insufficient for Ember after substantial time, concurrency, or world change. Current applicability must still be reconstructed.

### OpenClaw

OpenClaw provides especially strong implementation evidence around multiple clients projecting a shared session, identity linking across channels, persistent delivery context, separation of stored sessions from channel liveness, long-running work, and stale-assumption reconciliation across concurrent work. See [R1](operational-model-sessions-and-surfaces-references.md#r1-openclaw-session-surface-and-runtime-behaviour).

Its gateway, session database, task records, delivery machinery, and recovery mechanisms are product implementation choices rather than an Ember template.

Its single-user-oriented ability to collapse personal direct messages into one session also demonstrates why the same convenient mechanism can become a privacy hazard under multiple principals.

### Letta

Letta provides evidence that one persistent agent can participate in several concurrent conversations while sharing durable agent memory. See [R2](operational-model-sessions-and-surfaces-references.md#r2-letta-persistent-agents-and-conversations).

Some current Letta language treats context much more strongly as the agent's self. That product framing conflicts with Ember's canonical issue #3/#5 separation between identity and temporary projection, but no empirical evidence found in this phase justifies reopening Ember's distinction.

## Failure modes

| Failure | Example | Why it matters |
|---|---|---|
| **Session capture** | Closing a terminal silently cancels a live commitment or delegated objective. | Temporary interaction lifetime becomes owner of durable meaning. |
| **Surface fission** | Telegram and CLI behave as separate Embers because they see different local context. | Context omission becomes identity fracture. |
| **Principal collapse** | A shared device is treated as definitive proof that the usual user is speaking. | Relationship memory or authority leaks to the wrong person. |
| **Presence overclaim** | A persisted session is displayed as proof that Ember can currently observe new events. | Storage state becomes liveness fiction. |
| **Delivery multiplication** | Reconnect replay turns one user request into two semantic instructions or external effects. | Transport behaviour manufactures meaning. |
| **Content deduplication** | Two intentional identical requests are collapsed because their text matches. | Representation equality is mistaken for occurrence identity. |
| **Timeout certainty** | No response is treated as proof that an external mutation failed. | Transport uncertainty becomes false world-state certainty. |
| **Retry duplication** | Ember repeats a purchase after timeout without establishing whether the first charge occurred. | Retry becomes a second unintended effect. |
| **Arrival-order authority** | An older delayed instruction overrides a newer correction because it arrived last. | Observation order is confused with applicability. |
| **Last-writer convenience** | Two concurrent interactions conflict and whichever completes last silently becomes current. | Concurrency erases provenance and legitimate precedence. |
| **Stale cognition** | A long-running action commits based on a preference or authority premise changed elsewhere. | Reasoning remains locally coherent but globally obsolete. |
| **Seamless downtime fiction** | Ember says she monitored or thought through an interval while offline. | Continuity is preserved through invented experience. |
| **Blind replay recovery** | Restart simply continues an old prompt despite changed world state and authority. | Recovery reproduces stale assumptions rather than current situation. |
| **Missed-schedule stampede** | Restart mechanically executes every missed scheduled check regardless of purpose. | Wake-up mechanism is mistaken for semantic obligation. |
| **Notification eagerness** | Every completed result immediately interrupts the user. | Availability is mistaken for attention-worthiness. |
| **Delivery-route leakage** | A result from private CLI is rerouted to a shared voice surface because it is reachable. | Technical delivery success violates recipient/privacy semantics. |
| **Degraded-state bluffing** | Memory is unavailable but Ember speaks as though old preferences and authority were successfully recovered. | Graceful degradation becomes semantic fabrication. |

## Scenario catalogue

These scenarios should be preserved for issue #9 and later architecture validation.

| Scenario | Required semantic interpretation |
|---|---|
| **Cross-surface continuation** | Same Ember. Potentially same conversation. Reconstruct the current thread; do not assume all CLI-visible material is appropriate for Telegram. |
| **Voice to text** | Same Ember and thread may continue while presentation affordances change. Speech-local references may need reconstruction. |
| **Long-running Codex work** | Session ended; delegated objective did not. Specialist runtime remains attributable for local execution. |
| **Late obsolete result** | Historical success may be obsolete. Re-evaluate current applicability before relying on it. |
| **No active conversation** | A live concern can remain part of Ember's continuing state and later motivate cognition without requiring a session. |
| **Concurrent unrelated messages** | May proceed independently when neither can materially change the other's assumptions or authority. |
| **Conflicting concurrent actions** | Preserve conflict, currentness, and provenance before consequential reliance. Do not infer precedence from completion order. |
| **Preference change during work** | Old preference remains historical; downstream consequential action should use current applicable preference. |
| **Overlapping voice and text** | Global continuity can coexist with local conversational framing and surface-specific privacy. |
| **Offline overnight** | Ember continuity persists. Ember did not think or observe during unavailable intervals unless another legitimate runtime actually did so. |
| **Missed scheduled opportunity** | Reconsider purpose: expire, perform once now, resume recurrence, or retain as missed history. Never fabricate missed cognition. |
| **Crash mid-operation** | External outcome is uncertain unless independent evidence establishes it. Failure of acknowledgement is not proof of no effect. |
| **Duplicate result after reconnect** | One semantic result when provenance establishes redelivery. Do not count it twice merely because transport did. |
| **Duplicate request with side effect** | Establish whether the first effect occurred before unsafe retry when consequence warrants. |
| **Out-of-order delivery** | Observation order and applicability order remain distinct. |
| **Delayed user message** | Re-establish currentness and authority before consequentially executing an old request. |
| **Surface outage** | Other surfaces and internal work can remain functional. One channel failure is not whole-agent unavailability. |
| **Memory subsystem unavailable** | Degrade truthfully. Retrieval failure is not proof of absent history or memory. |
| **Ambiguous shared device** | Transport identity is insufficient for sensitive disclosure or broad authority. |
| **Quiet period** | Completion does not mandate interruption. Consider urgency, expiry, user attention, and standing expectations. |
| **Cancellation during disconnect** | Cancellation intent can survive the surface. Requested, acknowledged, stopped, and rolled back remain different facts. |
| **Reconnect replay** | Replay must not manufacture new semantic occurrences. |
| **Two identical real events** | Do not collapse them merely by content equality. |
| **Model replacement after downtime** | Same Ember can continue if continuity semantics survive; new provider behaviour does not create a new identity. |
| **Lower-privacy surface** | Relationship and memory may remain internally available while disclosure narrows for the current recipient and audience. |

## Validated conclusions

| Conclusion | Basis |
|---|---|
| Session continuity is not Ember continuity. | **[C + J]** |
| A session is a temporary interaction or working frame whose end does not by itself terminate durable state or live work. | **[C + J]** |
| Conversation continuity follows semantic discourse more closely than transport or session lifetime. | **[J]** |
| One conversation may span several sessions and surfaces; one session may contain several threads. | **[C + J]** |
| Surface changes presentation, privacy, recipient, and interaction affordances rather than identity. | **[C + J]** |
| Principal identity is distinct from session, account, device, and transport identity. | **[E + C + J]** |
| Presence, activity, idle state, reachability, observability, and continuity are distinct. | **[C + J]** |
| A persisted session is not evidence of live connectivity. | **[E, documented runtime behaviour]** |
| Long-running work may outlive the session and surface that initiated it. | **[C + J]** |
| Completion of long-running work does not imply current applicability or downstream authorization. | **[Inherited J]** |
| A result belongs semantically to continuing work and Ember history before it belongs to a delivery surface. | **[J]** |
| Semantic occurrence and delivery are distinct. | **[E/L + J]** |
| Duplicate delivery must not manufacture additional authority, memory, occurrence, or side effect. | **[E/L + J]** |
| Identical content does not prove duplicate occurrence. | **[E/L + J]** |
| Exactly-once guarantees are scoped technical properties, not an adequate universal semantic foundation. | **[E + J]** |
| Occurrence time, observation time, and applicability time may differ. | **[E/L + J]** |
| Timeout or missing response establishes uncertainty, not failure. | **[E + J]** |
| Consequential ambiguous retries require external-state establishment proportional to consequence unless repetition is independently safe. | **[E + inherited J]** |
| Concurrency matters when another actor can materially change premises, authority, shared state, objective, recipient, or consequence. | **[C + J]** |
| Concurrent cognition can become stale while still running. | **[C + J]** |
| Not every concurrent interaction needs global awareness of every other interaction. | **[J]** |
| Downtime is a gap in Ember's experience, not a break in identity. | **[Inherited J]** |
| External events and delegated work may continue during Ember downtime without becoming Ember's direct experience. | **[Inherited J]** |
| Recovery is current-state reconciliation rather than prompt replay. | **[E/L + inherited J]** |
| A truthful unresolved gap is preferable to invented seamless continuity. | **[Inherited J]** |
| Missed scheduled opportunities require purpose-sensitive reconsideration rather than unconditional backfill. | **[J]** |
| Result availability and notification are distinct; deliberate non-interruption can be correct. | **[E + J]** |
| Cross-surface delivery must re-evaluate recipient, privacy, currentness, and attention context. | **[E/L + J]** |
| Partial operational failure should degrade functionality rather than semantic honesty. | **[J]** |
| User-visible operational state must not claim stronger facts than Ember actually knows. | **[E/L + J]** |

## Operational invariants for later architecture

The research can be compressed into ten invariants that future implementation choices must preserve.

### 1. One Ember, many temporary views

Session, surface, process, transport, and model lifetime do not define identity.

### 2. Work outlives views when its purpose remains live

Ending conversation does not silently cancel delegated objectives, commitments, or unresolved responsibilities.

### 3. Currentness must be earned after change

A once-valid result, preference, authority grant, or assumption may remain historical while ceasing to govern the present.

### 4. Delivery is not occurrence

Transport repetition must not manufacture repeated meaning, while identical content must not be collapsed without evidence.

### 5. Failure signals have limited epistemic meaning

Timeout, disconnect, cancellation, and restart do not by themselves establish what changed in the external world.

### 6. Recovery is reconciliation

Re-establish the present from durable continuity, surviving evidence, current observation, and explicit gaps.

### 7. Concurrency invalidates assumptions, not identity

Coordinate where shared semantic dependencies exist. Do not turn all parallel cognition into one global conversation.

### 8. Surface changes admissible disclosure and interaction, not the agent

One continuing relationship can have different current disclosure boundaries across surfaces.

### 9. Downtime must remain truthful

Persistent commitments may cross an interval Ember did not experience. No fabricated monitoring or hidden thought fills the gap.

### 10. Operational presentation must never outrun knowledge

Ember should expose uncertainty about running, stopping, effects, reachability, currentness, and delivery rather than use smoother but stronger claims.

## Open questions and experiments

### How much resumption state is sufficient? **[H]**

HCI evidence supports resumption cues, but the optimal semantic bundle for a persistent personal agent is unknown. Objective, unresolved question, recent decisions, governing constraints, and salient changes may matter more than chronological transcript length.

### When should concurrent cognition re-establish currentness? **[H]**

Checking every mutable premise before every cognitive step would be wasteful. Never checking creates stale-action failures. The useful boundary is likely consequence- and dependency-sensitive, but this phase does not establish the threshold.

### How strong must cross-surface principal evidence be? **[H]**

Identity linking improves continuity while shared devices make over-linking dangerous. Appropriate confidence likely depends on disclosure and action consequence.

### How long do undelivered results remain worth surfacing? **[H]**

Result relevance may decay independently of correctness. The right behaviour likely depends on urgency, user attention, opportunity expiry, and whether another interaction has superseded the need.

### When should endogenous concerns become user interruptions? **[H]**

Issue #2 establishes internally arising reasons and useful non-action; issue #8 establishes delivery as a separate attention action. The threshold for converting internal salience into outward contact remains an experimental question.

### How should uncertain occurrence identity be handled without source correlation? **[H]**

The safe requirement is clear: do not invent certainty. The best operational response likely depends heavily on consequence and source characteristics.

## Conflicts with prior research

No new empirical or runtime evidence found during this phase substantively challenges the canonical conclusions from issues #2 through #7.

Three source-level tensions are worth preserving.

1. Some current Letta language treats context more strongly as the agent's self. That product framing conflicts with Ember's issue #3/#5 distinction between persistent identity and temporary projection, but it is not empirical evidence strong enough to reopen Ember's conclusion.
2. OpenClaw can intentionally collapse several personal direct-message surfaces into one default session under a single-user assumption. Its own documentation warns that this becomes unsafe when several humans share those routes. Ember should therefore preserve the distinction among continuity, principal identity, session state, and disclosure scope.
3. Systems such as Hermes support literal session-history resumption, which is operationally useful but insufficient after substantial elapsed time, concurrency, or changed world state. Ember must reconstruct current applicability rather than assume that restored historical context remains governing.

These tensions strengthen rather than weaken the inherited boundaries.

## Carry-forward to issue #9

Issue #9 should inherit the following operational conclusions without reopening them casually:

- Ember is the continuing agent; sessions, surfaces, transports, processes, model calls, and specialist runtimes are temporary operational loci.
- conversation continuity, session continuity, work continuity, specialist-thread continuity, and Ember continuity are distinct;
- one semantic conversation can span surfaces and sessions;
- principal identity and disclosure scope must be established independently of session continuity;
- long-running work can survive initiating interactions;
- a result can be successful yet obsolete;
- semantic occurrence is distinct from delivery;
- retry after uncertain failure is an epistemic problem before it is a scheduling problem;
- concurrency primarily creates stale-premise and conflicting-currentness problems;
- downtime is a truthful gap in cognition and observation rather than an identity break;
- recovery reconciles current state rather than replaying old prompts;
- missed opportunities require purpose-sensitive reconsideration;
- result availability does not mandate interruption;
- partial failure should degrade capability without manufacturing false certainty;
- future operational machinery should be judged by how well it preserves these semantics rather than by architectural fashion.

Issue #9 may compare candidate directions as **borrow**, **adapt/combine**, **avoid/defer**, or **Ember experiment**, but should not silently collapse these meanings merely because a convenient runtime API uses one object called a session, task, event, connection, or conversation.

## Scope deliberately left open

This research does not decide:

- whether Ember normally runs as a foreground process, daemon, service, or something else;
- how sessions, conversations, work, occurrences, or delivery are represented;
- queue or broker choice;
- whether an event log exists;
- event or command schemas;
- deduplication identifiers;
- transactions, locks, actors, optimistic concurrency, or serialization strategies;
- retry algorithms;
- process supervision;
- IPC or network protocols;
- concrete delivery routing;
- database or filesystem layout;
- runtime language;
- concrete status models or UI.

Those choices should follow from the semantic invariants above and the cross-cutting synthesis rather than retroactively define them.
