---
summary: "Preserved Deep Research report behind the canonical operational-model synthesis; non-canonical source material retained for provenance and reconstruction."
read_when:
  - "Reconstructing the original operational-model research after the canonical note and evidence map are insufficient"
  - "Auditing source-level evidence, caveats, or research-session reasoning behind sessions, surfaces, recovery, retry, and delivery conclusions"
role: source
discovery_status: current
---

# Operational Model, Sessions, and Surfaces - Research Source

> **Source-material status:** non-canonical research artifact preserved behind the issue #8 synthesis. The canonical Ember-facing conclusions live in [Operational Model, Sessions, and Surfaces Semantics](../operational-model-sessions-and-surfaces.md), and the portable bibliography lives in the [evidence map](../operational-model-sessions-and-surfaces-references.md).
>
> An earlier automated research attempt was discarded because it inspected an unrelated repository named `ember`. None of that attempt's findings were used. This artifact records the corrected research grounded first in `arhor/ember` and then in external evidence.

## Research basis

Issue #8 asks what must remain semantically true when conversations, sessions, surfaces, transports, processes, delegated runtimes, and periods of availability appear and disappear around one continuing Ember.

Before external research, the following repository material was treated as canonical:

- issue #8, **Research operational model, sessions, and surfaces**;
- issue #10, **Research roadmap for Ember's semantic architecture**;
- the canonical issue #3 continuity research and evidence map;
- the canonical issue #4 memory research and evidence map;
- the canonical issue #5 context-selection research and evidence map;
- the canonical issue #6 capabilities/delegation research and evidence map;
- the canonical issue #7 authority research and evidence map;
- the canonical issue #2 endogenous-agency research and evidence map;
- the preserved Deep Research artifacts from the completed phases where they clarified provenance or rejected source-level overclaims;
- Ember's vision, principles, initial architecture model, and existing NanoBot, Hermes, OpenClaw, and Letta reconnaissance.

The inherited constraints were not reopened casually. No external evidence found in this phase provided a substantive reason to overturn them.

The research deliberately did **not** design a daemon, queue, broker, IPC layer, actor model, lock strategy, event schema, status enum, persistence layout, process topology, or deployment model.

## Initial semantic decomposition

The issue text itself exposes a central problem: the word _session_ often becomes a container for unrelated meanings.

A persistent personal agent has at least several different kinds of continuity in play:

- Ember herself remains the same continuing agent;
- a semantic conversation may continue or end;
- a temporary session may continue or end;
- a transport connection may continue or disappear;
- a surface may remain available or become unavailable;
- delegated work may continue after interaction ends;
- a specialist thread may continue independently of both Ember and the original conversation;
- a user or other principal may appear through several identities or several people may share one device;
- an external occurrence may happen once while its representation is delivered several times.

Treating all of these as one lifecycle creates false implications such as:

- closing the CLI stops Ember;
- expiring a session cancels Codex;
- reconnecting creates a new conversation;
- receiving the same webhook twice means the user asked twice;
- sharing the same surface means the same person is present;
- a stored session row proves the messaging channel is online;
- resuming history means old assumptions are current again.

The research therefore began from the opposite direction: determine which meanings differ before asking how future implementation might represent them.

## Sessions and conversations

### Session should be temporary

The inherited Ember architecture already describes sessions as temporary conversational or working context. The issue #8 research strengthens that boundary.

A session is useful because recent interaction creates local structure: pronouns resolve against nearby statements, temporary drafts exist, the current surface has particular affordances, and a participant may expect a coherent local flow.

None of those properties makes the session owner of Ember's persistent identity, relationships, durable memory, standing authority, commitments, or delegated work.

Current implementations converge on this pressure without converging on one design.

OpenClaw has session lifecycle/reset rules around a longer-lived agent and can project Gateway-owned session state into several clients. Hermes persists conversations as sessions, can resume or reset them, and keeps sessions with active background work from being reset. Letta now permits several concurrent conversations attached to one persistent agent with shared agent memory.

Those systems use different definitions and mechanics. Their convergence is therefore useful at the semantic level: _agent continuity and session continuity are not the same problem_.

### Conversation should follow discourse, not transport

A semantic conversation can outlive a socket, terminal, voice call, or chat connection.

If the user discusses a repository bug in CLI, closes the terminal, and continues ten minutes later through Telegram, the transport changed but the discourse may clearly be the same unresolved conversation.

The inverse also occurs. A long-lived Telegram chat can contain many unrelated conversations. One technical session can contain several semantic threads.

This makes "resume" a current-context question rather than an identifier question. A future implementation may have technical identifiers, but the semantic requirement is to recover the relevant ongoing matter, its current constraints, and any changes that occurred during the gap.

## Surfaces and principals

The existing Ember vision already says interfaces are windows into one persistent agent.

Issue #8 adds a critical qualifier: _a window changes who can see what_.

A private CLI, private phone notification, family voice speaker, shared group chat, and web UI can all expose the same Ember while having different:

- physical audiences;
- authenticated identities;
- privacy expectations;
- response-length expectations;
- interruption costs;
- affordances for provenance or detail;
- ability to receive or display sensitive information.

Therefore "same Ember" cannot imply "same disclosure."

OpenClaw's current session model demonstrates the pressure directly. It supports a default shared direct-message session for single-user continuity, explicitly warns that this is unsafe when several people can message the agent, supports per-peer isolation, and offers identity links for the same human appearing across channels.

That implementation should not be copied literally, but it demonstrates a durable semantic distinction:

> principal identity, session identity, and agent identity are independent questions.

Family smart-home HCI provides independent evidence. In _FamiData Hub_ (CHI 2025), nearly all studied families used a single parent account for smart-home devices, and children often used those devices independently. Children described their digital identities as mixed with their parents' activity. The study is not about personal agents, but it is strong evidence against treating a shared account or device as proof of one human principal.

For Ember, this matters especially where relationship memory, private information, or standing authority is involved.

## Presence and liveness

A second overloaded concept is _presence_.

A persistent agent can be:

- continuous but offline;
- reachable through one surface but not another;
- idle while a delegate works;
- actively thinking while a transport is unavailable;
- connected to Telegram while memory retrieval is degraded;
- able to receive messages while unable to perform one external capability;
- fully unavailable for new cognition while durable state and specialist work persist elsewhere.

Current OpenClaw documentation makes one particularly useful distinction explicit: `openclaw sessions` lists persisted conversation rows and is **not** a channel/provider liveness check.

That is an implementation-specific statement with a broadly reusable lesson:

> persistence evidence is not connectivity evidence.

The same caution applies to other operational claims. An accepted task is not necessarily started. Started is not necessarily progressing. A cancellation request is not an observed stop. An observed stop is not rollback. A transport acknowledgement is not human attention.

Issue #8 therefore needs operational truth stronger than a future UI's simplified labels.

## Long-running work outside sessions

Issue #6 already established that delegated-objective continuity and specialist-thread continuity are distinct from Ember continuity.

Issue #8 asks what happens when the interaction that created the work disappears.

The key result is simple:

> if the objective remains semantically live, ending its initiating interaction is not enough reason to kill the work.

Hermes background sessions provide direct implementation evidence: a foreground session remains interactive while background work runs in separate sessions. OpenClaw supports multiple active runs around persistent session state. Codex runtime research from issue #6 already demonstrated independently resumable specialist work.

Again, these mechanisms are not architecture recommendations. They expose the pressure.

What must survive interaction closure is not the initiating transcript as such, but the meaning necessary to interpret the work later:

- objective;
- governing constraints;
- relevant authority;
- world-state assumptions;
- specialist ownership;
- known side effects;
- unresolved uncertainty;
- currentness conditions;
- cancellation state where relevant;
- how the result should be interpreted and whether it should be surfaced.

### Late success can become obsolete

A specialist can successfully complete old work after the user changes the objective.

This is a particularly important case because many runtime models expose terminal states such as "completed" that look stronger than they are.

Completion means the specialist believes the delegated objective reached its terminal success condition. It cannot establish:

- that the original objective remains current;
- that world state still matches the assumptions;
- that standing authority still applies;
- that a downstream action is authorized;
- that the user still needs to be interrupted.

This result is inherited from issue #6 but becomes operationally central in #8.

## Semantic occurrence versus delivery

Distributed-systems evidence sharpened a distinction already latent in Ember's history/memory model.

Amazon SQS standard queues explicitly use at-least-once delivery and may deliver a message more than once or out of order. Google Pub/Sub's exactly-once feature provides deliberately scoped acknowledgement/redelivery semantics. Amazon's FIFO documentation uses explicit deduplication identity because message-body equality is not enough: sometimes identical bodies must be treated as unique, while changed bodies can still represent retries of one intended occurrence.

The important Ember conclusion is above all of those mechanisms:

> what happened and how many times it was delivered are different questions.

This matters for more than message processing.

If one user request is delivered twice, Ember must not infer two independent grants of authority, two autobiographical events, two memories, or two intended external side effects.

But Ember must also avoid the inverse mistake. Two messages with identical text can be two intentional user actions. Two identical external events can genuinely happen twice.

Therefore semantic identity cannot be defined by content equality alone.

Source correlation, provenance, causal history, timing, and context can provide evidence. When they do not settle the question, uncertainty should remain uncertainty.

## Retry and uncertain external effects

The most useful external evidence here came from systems dealing with real side effects.

Stripe's advanced error documentation explicitly states that after a network failure a client may not know whether the server received the request. Idempotency keys let the client retry the _same intended operation_ and recover a definitive answer. Stripe also treats some server errors as indeterminate because user-visible effects may already exist.

AWS Durable Execution has an even sharper example. For an at-most-once step, if execution is interrupted after the side-effecting body starts but before the SDK checkpoints the result, the SDK does not simply rerun the step. It reports an interrupted condition and instructs the caller to inspect the external system before deciding what to do next.

Neither source means Ember should use Stripe's API strategy or AWS Durable Execution.

They demonstrate a semantic invariant:

> transport or runtime failure can remove knowledge about world state without undoing world state.

This is exactly the distinction Ember needs after a timeout, crash, disconnect, or lost specialist acknowledgement.

The safe conclusion is not "always retry" or "never retry." It is:

> consequential retry after ambiguous failure may require re-establishing external state first, unless the operation is independently known to be safe to repeat.

The consequence level matters. Re-reading status is different from charging a card or sending a public message.

A related conclusion is that _retry_ is itself semantic. Re-executing the same function call after the objective, target, authority, or world state changed may no longer be the same attempt at all.

## Concurrency

Issue #8 deliberately forbids choosing locks, transactions, queues, or actors. That does not prevent identifying what those future mechanisms would need to preserve.

The semantic concurrency problem is stale justification.

Imagine two interactions begin almost together:

- one starts preparing an action under preference A;
- the other changes the preference to B.

The first cognition may be internally coherent and still become wrong for current outward action.

Or:

- one session authorizes a repository operation;
- another revokes or narrows that authority;
- the first specialist continues running.

Or:

- two surfaces try to update the same external state;
- each assumes the old version still exists.

The important problem is not "parallelism" as such. Two unrelated conversations can proceed safely.

Concurrency becomes semantically relevant when another interaction can change a premise, authority, objective, recipient, shared resource, or consequence that the current cognition depends on.

Current OpenClaw session-state work exposes a concrete version of this pressure with stale-assumption reconciliation among concurrent sessions. That implementation should not be copied. The pressure it exposes is useful.

This leads to a likely future evaluation question rather than an algorithm:

> when does consequence and dependency justify re-establishing currentness before committing an outward action?

Checking every mutable fact before every thought is wasteful. Never checking is unsafe. Issue #8 leaves the threshold open.

## Downtime

The issue #2 research supplies the most important rule:

> if Ember did not run cognition or observation, she must not later narrate those as experiences.

This makes downtime a semantic gap, not merely an availability metric.

Suppose the Raspberry Pi is offline overnight.

During that interval:

- a commitment can remain durably live;
- the world can change;
- messages can be sent toward Ember;
- a remote specialist may continue work;
- a schedule can pass;
- a condition can become true;
- Ember herself may be unable to notice any of those things.

On restart, Ember can truthfully say that the commitment persisted and is being reconsidered now. She cannot claim she spent the night watching it or chose not to speak at 02:00 if no cognition occurred.

This is not a break in identity. It is continuity with a gap in experience.

## Recovery

The wrong recovery metaphor is replay.

Replaying all old history can still recreate a stale situation. An old objective may have changed. Authority may have been revoked. A result may have arrived elsewhere. The external world may no longer match the state that existed before the crash.

Issue #5 already established that reconstruction should restore the current situation rather than the old prompt. Issue #8 extends that idea operationally.

Recovery should reconcile:

- surviving durable continuity;
- known pre-gap state;
- evidence that arrived during the gap;
- current observable external state;
- changed preferences and authority;
- active or dormant work;
- the principal and surface now present;
- explicit unknowns.

HCI interruption research is useful as a lens here.

Trafton, Altmann, Brock, and Mintz (2003) experimentally showed that people who had an interruption lag prepared more and resumed faster, supporting the role of prospective resumption goals.

Parnin and DeLine (CHI 2010) surveyed 371 programmers and experimentally evaluated automated resumption cues. Their cues improved task-completion success compared with notes alone in the study.

Parnin and Rugaber's broader programming-session analysis found that programmers often spend time navigating and reconstructing context before editing after an interruption.

These human findings do not imply that Ember has human working memory. They do support a narrow engineering insight:

> resumption depends on recovering purpose and relevant state, not merely on preserving chronology.

### Unresolved recovery is legitimate

Sometimes the evidence is genuinely missing.

An external service may have no audit log. A sensor may itself have been offline. A specialist may disappear without reporting terminal state.

The correct recovery state can therefore include "unknown."

That is compatible with Ember continuity. Fabricating a bridge is not.

## Missed scheduled opportunities

A scheduler firing is not a complete semantic description of the underlying intention.

If Ember was offline at 02:00, several very different obligations might have been missed:

- perform something at exactly 02:00;
- perform it once any time after 02:00;
- check every night so the morning view is current;
- give Ember an opportunity to reconsider a live concern;
- notify the user if a condition becomes true.

A future runtime cannot safely apply one generic "catch up missed jobs" rule to all of them.

The semantic requirement is to reconsider the purpose and time meaning.

An exact-time opportunity may have expired. An overdue obligation may still matter. A periodic observation may only require one fresh observation now. A missed wake-up opportunity cannot be described as cognition that happened at 02:00.

This is an important bridge between #2 and #8: mechanism can be missed, while the underlying reason may survive.

## Interruption and notification

A result becoming available is not the same thing as that result deserving immediate user attention.

Iqbal and Bailey's CHI 2008 experiment found that scheduling notifications at task breakpoints reduced frustration and reaction time relative to immediate delivery in the studied tasks.

The study does not provide an Ember notification algorithm. It directly challenges a naive operational principle: "deliver as soon as technically possible."

Issue #2 independently requires quiet periods and useful non-action. Issue #7 treats contact as an attention-consuming external action.

Together these support:

> completion -> candidate information
>
> candidate information != automatic interruption

The choice also interacts with surfaces. A result from a private CLI task might be suitable for a private Telegram message but not for a family voice speaker or group channel.

Reachability is therefore not enough to choose delivery route.

## Cross-device interaction

Brudy et al.'s CHI 2019 Cross-Device Taxonomy synthesizes 510 papers on interactions spanning multiple devices. Its value for Ember is not a particular interaction pattern. It shows that cross-device experiences form a broad design space where devices differ in affordances, transfer patterns, roles, and evaluation criteria.

The semantic implication for Ember is conservative:

> continuity across surfaces should preserve the agent while allowing presentation, privacy, interruption, and context projection to differ.

Mirroring everything everywhere would be the opposite of this requirement.

## Graceful degradation

Ember's principles already prefer graceful degradation.

Operational research clarifies what must remain true when degradation occurs.

If memory retrieval is down, Ember may still converse about current visible context, but should not pretend old preferences or authority were successfully recalled.

If Telegram is down, CLI may remain functional.

If a specialist is unreachable, the delegated objective can remain live but blocked.

If external search is unavailable, local cognition can continue without falsely implying fresh verification.

If the cognition provider changes, continuity can survive while privacy, capability, or behavioural assumptions may need re-evaluation.

If a transport can receive but not send, Ember may learn new facts without being able to acknowledge them to the user.

The general rule is:

> preserve the strongest truthful subset of function still justified.

Graceful degradation is not simulated success.

## Source tensions

No evidence required reopening prior Ember conclusions, but three tensions were recorded.

### Letta context framing

Current Letta product language can describe context much more strongly as constitutive of the agent's self. Ember's canonical issue #3/#5 research instead treats context as a temporary projection of a continuing agent.

The Letta framing is a product philosophy and implementation model, not empirical evidence that Ember's distinction is wrong.

### OpenClaw default DM sharing

OpenClaw's default shared direct-message session is convenient under a one-user assumption and is explicitly documented as dangerous when several humans can message the agent.

For Ember this strengthens the distinction among:

- same agent;
- same conversation;
- same session;
- same human principal;
- same disclosure scope.

### Hermes literal session resumption

Hermes can restore a prior conversation session and history, which is valuable operational behaviour.

Ember needs a stronger notion after substantial time or external change. Restoring history is evidence for reconstruction, not proof that every restored assumption is current.

## Research synthesis

The operational research can be condensed into ten requirements.

1. **One Ember, many temporary views.** Session, surface, process, transport, and model lifetime do not define identity.
2. **Work outlives views when its purpose remains live.** Session closure does not silently cancel work or commitments.
3. **Currentness must be earned after change.** Historical validity and present applicability are different.
4. **Delivery is not occurrence.** Transport repetition must not manufacture repeated semantic meaning.
5. **Failure signals have limited epistemic meaning.** Timeout and cancellation cannot establish external-world rollback.
6. **Recovery is reconciliation.** Reconstruct the present from durable state, evidence, observation, and explicit gaps.
7. **Concurrency invalidates assumptions, not identity.** Coordinate only where semantic dependencies exist.
8. **Surface changes disclosure and interaction, not Ember.** Same-agent continuity does not imply all-state visibility.
9. **Downtime must remain truthful.** Durable concerns can cross gaps that Ember did not experience.
10. **Operational presentation must never outrun knowledge.** Simplified status must preserve uncertainty about running, effects, currentness, reachability, and delivery.

The main research achievement is therefore negative in the useful sense: issue #8 does not justify choosing daemon plus event bus, workflow engine, queue, actor system, or any other operational machinery yet.

Instead it makes those later choices easier to evaluate.

A candidate architecture should have to demonstrate how it preserves:

- continuing identity across process and surface boundaries;
- independent lifetimes for sessions, conversations, and work;
- principal and privacy distinctions;
- currentness under concurrency;
- occurrence/delivery separation;
- truthful retry uncertainty;
- recovery without fabricated experience;
- purpose-sensitive missed work;
- graceful degradation;
- attention-aware delivery.

The machinery should earn its place by preserving those semantics, rather than supplying the semantics merely because its APIs happen to expose nouns such as `session`, `task`, `message`, `event`, or `workflow`.

## Portable source list

The durable bibliography and interpretation notes are maintained in [the portable evidence map](../operational-model-sessions-and-surfaces-references.md). Principal external sources include:

- OpenClaw session synchronization, session management, and liveness documentation, examined 2026-08-29;
- Letta's 2026 Conversations API announcement and current repository snapshot;
- Hermes Agent current sessions, background-work, messaging, and handoff documentation;
- Amazon SQS at-least-once and FIFO deduplication documentation;
- Google Cloud Pub/Sub exactly-once delivery documentation;
- Stripe advanced network-error and idempotency documentation;
- AWS Durable Execution error-handling documentation;
- Trafton et al. (2003), DOI `10.1016/S1071-5819(03)00023-5`;
- Parnin and DeLine (2010), DOI `10.1145/1753326.1753342`;
- Iqbal and Bailey (2008), DOI `10.1145/1357054.1357070`;
- Parnin and Rugaber (2009/2011), DOI `10.1109/ICPC.2009.5090030` and `10.1007/s11219-010-9104-9`;
- Brudy et al. (2019), DOI `10.1145/3290605.3300792`;
- Wang et al. (2025), DOI `10.1145/3706598.3713494`.
