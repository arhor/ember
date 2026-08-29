# Operational Model, Sessions, and Surfaces - Portable Evidence Map

This companion maps the evidence-labelled conclusions in [Operational Model, Sessions, and Surfaces Semantics](operational-model-sessions-and-surfaces.md) to sources that remain usable outside the originating ChatGPT session.

The canonical Ember-facing synthesis is the semantic note. The preserved [source research](source-material/operational-model-sessions-and-surfaces-deep-research.md) retains the broader narrative. This file is the portable layer: it records durable paper, DOI, official documentation, repository snapshot, and inherited Ember links and states what each source does and does not support.

Fast-moving runtime behaviour was rechecked on **2026-08-29**. Repository snapshots observed that day:

- OpenClaw: `8af1b4aceeab436a920126c15672c0b57fb238c6`
- Hermes Agent: `10e93c6ab958c7ec61cfc4416f4d4459e72ca8a7`
- Letta server repository: `4511fa0bc91f68fbab32b91f694617271ea9012b`

Runtime documentation should be revalidated before a later ADR if those systems materially change.

## Evidence key

| Mark | Meaning |
|---|---|
| **[E]** | Empirical evidence: experiment, user study, benchmark, measured behaviour, or documented runtime behaviour. |
| **[C]** | Convergence across mature implementations or independent engineering traditions. |
| **[J]** | Ember-specific semantic judgment derived from evidence, inherited constraints, and scenarios. |
| **[H]** | Hypothesis that remains suitable for prototype evaluation. |
| **[L]** | Conceptual lens imported without adopting the source framework wholesale. |

## Inherited Ember research

### E0 Continuity and Identity Semantics

- Canonical note: [continuity-and-identity.md](continuity-and-identity.md)
- Evidence map: [continuity-and-identity-references.md](continuity-and-identity-references.md)

**Carries forward:** continuity belongs to Ember rather than one model call, process, surface, or specialist runtime; model replacement can preserve continuity; commitments and autobiographical ownership can survive inactive periods; truthful gaps are preferable to fabricated experience.

### E1 Memory and Remembering Semantics

- Canonical note: [memory-and-remembering.md](memory-and-remembering.md)
- Evidence map: [memory-and-remembering-references.md](memory-and-remembering-references.md)

**Carries forward:** current truth and historical truth can coexist; occurrence time and learning time differ; provenance, correction, supersession, scope, and prospective commitments survive across sessions; absence of retrieval is not proof of absence of memory.

### E2 Context Selection and Cognitive Framing Semantics

- Canonical note: [context-selection-and-cognitive-framing.md](context-selection-and-cognitive-framing.md)
- Evidence map: [context-selection-and-cognitive-framing-references.md](context-selection-and-cognitive-framing-references.md)

**Carries forward:** context is a temporary projection; a limited surface must not become owner of identity; reconstruction after restart should recover the current situation rather than recreate the previous prompt; conflict and currentness must survive projection.

### E3 Capabilities and Delegation Semantics

- Canonical note: [capabilities-and-delegation.md](capabilities-and-delegation.md)
- Evidence map: [capabilities-and-delegation-references.md](capabilities-and-delegation-references.md)

**Carries forward:** Ember continuity, delegated-objective continuity, and specialist-thread continuity are distinct; delegated work may outlive conversation; cancellation and failure do not imply rollback; late successful results can be obsolete.

### E4 Action, Authority, and Permission Semantics

- Canonical note: [action-authority-and-permission.md](action-authority-and-permission.md)
- Evidence map: [action-authority-and-permission-references.md](action-authority-and-permission-references.md)

**Carries forward:** capability, authority, control, observability, responsibility, and runtime ownership are distinct; authority remains scoped, revocable, currentness-aware, recipient-sensitive, and circumstance-sensitive; interruption consumes human attention.

### E5 Endogenous Agency and Self-Initiated Behavior Semantics

- Canonical note: [endogenous-agency-and-self-initiated-behavior.md](endogenous-agency-and-self-initiated-behavior.md)
- Evidence map: [endogenous-agency-and-self-initiated-behavior-references.md](endogenous-agency-and-self-initiated-behavior-references.md)

**Carries forward:** wake-up opportunity and motivation are distinct; a live concern can remain dormant; useful non-action and quiet periods are legitimate; an inactive runtime must not be narrated as though cognition occurred during downtime.

## Evidence map for validated conclusions

| Canonical conclusion | Basis | Principal portable evidence | Interpretation for Ember |
|---|---|---|---|
| Session continuity is not Ember continuity. | **[C + J]** | [R1 OpenClaw](#r1-openclaw-session-surface-and-runtime-behaviour), [R2 Letta](#r2-letta-persistent-agents-and-conversations), [R3 Hermes](#r3-hermes-sessions-surfaces-and-background-work), inherited E0 | Mature systems independently separate persistent agent state from individual sessions. Ember's stronger identity boundary is inherited from #3. |
| One semantic conversation may cross surfaces and sessions, while one session may host several threads. | **[C + J]** | [R1](#r1-openclaw-session-surface-and-runtime-behaviour), [R2](#r2-letta-persistent-agents-and-conversations), [R3](#r3-hermes-sessions-surfaces-and-background-work), [R13 Cross-Device Taxonomy](#r13-cross-device-taxonomy) | Multi-client and concurrent-conversation runtimes show feasibility; HCI shows cross-device interaction is a broad established design space. Exact mapping remains an Ember judgment. |
| Principal identity is distinct from account, device, session, or transport identity. | **[E + C + J]** | [R1](#r1-openclaw-session-surface-and-runtime-behaviour), [R14 FamiData Hub](#r14-famidata-hub-and-shared-device-identity-pressure), inherited E4 | OpenClaw requires explicit cross-channel identity linking; family HCI shows one adult account is often used by multiple people on shared devices. |
| Persisted session state is not evidence of live connectivity. | **[E, runtime]** | [R1](#r1-openclaw-session-surface-and-runtime-behaviour) | OpenClaw explicitly warns that session listings are persisted conversation rows rather than channel/provider liveness checks. |
| Long-running work can outlive the initiating interaction. | **[C + J]** | [R3](#r3-hermes-sessions-surfaces-and-background-work), [R1](#r1-openclaw-session-surface-and-runtime-behaviour), inherited E3 | Background work is independently implemented in mature runtimes. Ember inherits the stronger semantic rule that the work's objective, not the surface, owns its lifetime. |
| Semantic occurrence and delivery are distinct. | **[E/L + J]** | [R4 SQS standard delivery](#r4-amazon-sqs-at-least-once-delivery), [R5 PubSub exactly-once](#r5-google-cloud-pubsub-exactly-once-delivery), [R6 SQS deduplication identity](#r6-amazon-sqs-message-deduplication-identity) | Delivery systems routinely redeliver, replay, or scope exactly-once guarantees. Ember should treat transport copies as evidence about one or more occurrences rather than occurrences themselves. |
| Duplicate delivery must not manufacture duplicate semantic effect. | **[E/L + J]** | [R4](#r4-amazon-sqs-at-least-once-delivery), [R5](#r5-google-cloud-pubsub-exactly-once-delivery), [R6](#r6-amazon-sqs-message-deduplication-identity) | Infrastructure already requires deduplication-aware consumers; Ember extends the requirement to authority, memory, autobiography, and external action. |
| Identical content does not prove duplicate occurrence. | **[E/L + J]** | [R6](#r6-amazon-sqs-message-deduplication-identity) | AWS explicitly documents cases where identical bodies must be treated as unique and distinct bodies may need to be recognized as retries. Semantic identity cannot be derived from text equality alone. |
| Exactly-once is a scoped technical property, not a universal semantic foundation. | **[E + J]** | [R5](#r5-google-cloud-pubsub-exactly-once-delivery), [R6](#r6-amazon-sqs-message-deduplication-identity) | Exactly-once guarantees depend on concrete subscription, region, acknowledgement, or deduplication windows. Ember's semantic correctness must survive weaker transports. |
| Missing acknowledgement establishes uncertainty rather than proof that nothing happened. | **[E + J]** | [R7 Stripe](#r7-stripe-network-errors-and-idempotency), [R8 AWS Durable Execution](#r8-aws-durable-execution-error-and-retry-semantics), inherited E3 | Both systems explicitly preserve uncertainty when an external side effect may have started before the caller learned the result. |
| Consequential retry may require inspection of external state before repetition. | **[E + J]** | [R7](#r7-stripe-network-errors-and-idempotency), [R8](#r8-aws-durable-execution-error-and-retry-semantics), inherited E3 | Retry safety depends on effect semantics and evidence, not merely on a previous timeout. |
| Recovery should reconstruct goals and current relevant state rather than replay chronology alone. | **[E/L + J]** | [R9 Trafton et al.](#r9-trafton-et-al-resumption-goals), [R10 Parnin and DeLine](#r10-parnin-and-deline-task-resumption-cues), inherited E2 | Human task-resumption evidence supports recovering goals and contextual cues. Transfer to Ember is a lens, not a cognitive equivalence claim. |
| Result availability does not imply immediate notification is best. | **[E + J]** | [R11 Iqbal and Bailey](#r11-iqbal-and-bailey-notification-interruption), inherited E4/E5 | Deferred notifications at task breakpoints reduced frustration and reaction time in the studied setting. Ember should treat delivery timing as an attention decision rather than a transport reflex. |
| Cross-device interaction changes affordances without requiring distinct underlying identity. | **[E/L + J]** | [R13](#r13-cross-device-taxonomy), [R1](#r1-openclaw-session-surface-and-runtime-behaviour), [R2](#r2-letta-persistent-agents-and-conversations) | HCI provides a broad taxonomy of cross-device interaction; agent runtimes show one persistent state can be projected through several clients. |
| Shared devices can make surface identity ambiguous and privacy-sensitive. | **[E + J]** | [R14](#r14-famidata-hub-and-shared-device-identity-pressure), inherited E4 | Families in the study frequently shared one adult account across smart-home devices, and children reported mixed digital identities. This is direct pressure against equating device/account identity with a person. |
| Resume cues materially affect interrupted programming-task recovery. | **[E/L]** | [R10](#r10-parnin-and-deline-task-resumption-cues), [R12 Parnin and Rugaber](#r12-parnin-and-rugaber-resumption-strategies) | Programming studies show task resumption involves reconstructing plans and context, supporting Ember's distinction between resumption and transcript replay. |
| A truthful unresolved operational gap is preferable to invented seamlessness. | **[Inherited J]** | E0, E1, E2 plus [R7](#r7-stripe-network-errors-and-idempotency) and [R8](#r8-aws-durable-execution-error-and-retry-semantics) as uncertainty lenses | Infrastructure uncertainty and inherited autobiographical restraint both favour explicit unknowns over fabricated state. |

## Runtime and distributed-systems evidence

### R1 OpenClaw session, surface, and runtime behaviour

**OpenClaw documentation and repository**, rechecked **2026-08-29**. Repository snapshot observed: `8af1b4aceeab436a920126c15672c0b57fb238c6`.

- Session synchronization and attachment: https://docs.openclaw.ai/concepts/session-attachment
- Session management and DM isolation: https://docs.openclaw.ai/session
- Session CLI and liveness warning: https://docs.openclaw.ai/cli/sessions
- Repository snapshot: https://github.com/openclaw/openclaw/tree/8af1b4aceeab436a920126c15672c0b57fb238c6

**Supports [C/E]:** Gateway-owned session state can be projected into multiple clients; direct messages can be mapped through identity links; default DM sharing becomes unsafe when several humans can message the agent; session rows are explicitly not channel/provider liveness checks.

**Does not support:** importing OpenClaw's gateway, session store, routing rules, session scopes, process model, or delivery implementation into Ember.

### R2 Letta persistent agents and conversations

**Letta.** *Conversations: Shared Agent Memory Across Concurrent Experiences.* Published 2026-01-21. Letta repository snapshot observed on 2026-08-29: `4511fa0bc91f68fbab32b91f694617271ea9012b`.

- Product article: https://www.letta.com/blog/conversations/
- Repository snapshot: https://github.com/letta-ai/letta/tree/4511fa0bc91f68fbab32b91f694617271ea9012b

**Supports [C/E]:** one persisted agent can participate in multiple concurrent conversations while sharing identity and memory across them.

**Does not support:** treating a conversation as a universal privacy boundary or adopting Letta's product-level claims about context as Ember's definition of identity.

### R3 Hermes sessions, surfaces, and background work

**Nous Research Hermes Agent documentation**, rechecked 2026-08-29. Repository snapshot observed: `10e93c6ab958c7ec61cfc4416f4d4459e72ca8a7`.

- Sessions: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/sessions.md
- CLI background sessions: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/cli.md
- Messaging background sessions: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/messaging/index.md
- Slash commands and cross-platform handoff: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/slash-commands.md
- Snapshot: https://github.com/NousResearch/hermes-agent/tree/10e93c6ab958c7ec61cfc4416f4d4459e72ca8a7

**Supports [C/E]:** conversations are persisted as sessions across many surfaces; group sessions can be isolated per user; active background processes prevent session reset; background work runs in separate sessions; a CLI session can be handed to a messaging platform.

**Does not support:** equating transcript/session restoration with sufficient semantic recovery after a changed world state.

### R4 Amazon SQS at-least-once delivery

**Amazon Web Services.** *Amazon SQS standard queues.*

- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html

AWS documents that standard queues use at-least-once delivery, can deliver more than one copy of a message, and can occasionally deliver messages out of order.

**Supports [E/L]:** duplicate and out-of-order delivery are ordinary distributed-system behaviour that consumers must tolerate.

**Ember use:** delivery count and delivery order cannot by themselves define semantic occurrence count or semantic precedence.

### R5 Google Cloud PubSub exactly-once delivery

**Google Cloud.** *Exactly-once delivery.*

- https://cloud.google.com/pubsub/docs/exactly-once-delivery

Pub/Sub documents exactly-once semantics around acknowledgement behaviour, outstanding messages, and valid redeliveries. The guarantee is scoped to supported subscription behaviour rather than being a universal statement about all downstream effects.

**Supports [E/L]:** even a product explicitly offering exactly-once delivery needs precise scope around acknowledgement and redelivery.

**Ember use:** semantic correctness should not rely on assuming a transport globally guarantees one real-world effect.

### R6 Amazon SQS message deduplication identity

**Amazon Web Services.** *When to provide a message deduplication ID in Amazon SQS* and related FIFO documentation.

- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/providing-message-deduplication-id.html
- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagededuplicationid-property.html
- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html

AWS explicitly documents that producers may need different deduplication identities for identical message bodies that are semantically unique, or the same identity for retry-shaped messages whose bodies differ.

**Supports [E/L]:** content equality is not a sufficient definition of semantic identity.

**Ember use:** provenance and correlation must outrank raw text equality when distinguishing replay from repeated real occurrence.

### R7 Stripe network errors and idempotency

**Stripe.** *Advanced error handling.*

- https://docs.stripe.com/error-low-level

Stripe documents that after network errors clients may not know whether the server received a request; retry with the same idempotency key is used to reconcile that uncertainty. Stripe also describes some `500` responses as indeterminate because user-visible side effects can still occur.

**Supports [E/L]:** absence of a successful response is not proof of no side effect. Idempotency is useful because callers need to reconcile uncertain outcomes.

**Ember use:** transport failure must not be converted into false certainty about world state.

### R8 AWS Durable Execution error and retry semantics

**Amazon Web Services.** *AWS Durable Execution SDK Developer Guide - Error handling.*

- https://docs.aws.amazon.com/durable-execution/sdk-reference/error-handling/errors/

AWS documents at-most-once steps where interruption after the side-effecting body starts but before checkpointing causes a `step-interrupted` condition. The caller is instructed to inspect the external system before deciding how to proceed.

**Supports [E/L]:** process or checkpoint state can underdetermine whether an external effect occurred.

**Ember use:** retry after ambiguous side effects is first an epistemic/current-state problem, not merely a scheduling decision.

## HCI and resumption evidence

### R9 Trafton et al. resumption goals

**J. Gregory Trafton, Erik M. Altmann, Derek P. Brock, Farilee E. Mintz.** *Preparing to Resume an Interrupted Task: Effects of Prospective Goal Encoding and Retrospective Rehearsal.* International Journal of Human-Computer Studies 58(5), 2003, pp. 583-603.

- DOI: https://doi.org/10.1016/S1071-5819(03)00023-5
- Publisher: https://www.sciencedirect.com/science/article/pii/S1071581903000235

The experiment found that participants given an interruption lag prepared more and resumed the interrupted task faster.

**Supports [E/L]:** goals and state prepared for resumption affect recovery after interruption.

**Does not support:** treating Ember as having human working memory or importing the study's cognitive model literally.

### R10 Parnin and DeLine task resumption cues

**Chris Parnin, Robert DeLine.** *Evaluating Cues for Resuming Interrupted Programming Tasks.* CHI 2010.

- DOI: https://doi.org/10.1145/1753326.1753342
- Microsoft Research: https://www.microsoft.com/en-us/research/publication/evaluating-cues-for-resuming-interrupted-programming-tasks/

The work surveyed 371 programmers and ran a controlled study comparing automated resumption cues with note taking. The automated cues substantially improved successful task completion in the experiment.

**Supports [E/L]:** contextual resumption cues can materially improve continuation of interrupted complex work.

**Ember use:** recovery should reconstruct relevant goals, state, and changed assumptions rather than equate resumption with replaying the whole transcript.

### R11 Iqbal and Bailey notification interruption

**Shamsi T. Iqbal, Brian P. Bailey.** *Effects of Intelligent Notification Management on Users and Their Tasks.* CHI 2008, pp. 93-102.

- DOI: https://doi.org/10.1145/1357054.1357070
- University of Illinois record: https://experts.illinois.edu/en/publications/effects-of-intelligent-notification-management-on-users-and-their/

The study found that scheduling notifications at detected task breakpoints reduced frustration and reaction time compared with immediate delivery in the evaluated tasks.

**Supports [E]:** earliest possible notification is not always best for human attention.

**Ember use:** completion and availability should be separated from the decision to interrupt.

### R12 Parnin and Rugaber resumption strategies

**Chris Parnin, Spencer Rugaber.** *Resumption Strategies for Interrupted Programming Tasks.* ICPC 2009, pp. 80-89. Extended journal version: Software Quality Journal 19(1), 2011, pp. 5-34.

- ICPC DOI: https://doi.org/10.1109/ICPC.2009.5090030
- Journal DOI: https://doi.org/10.1007/s11219-010-9104-9
- Unpaywalled conference paper: https://chrisparnin.me/pdf/parnin-icpc09.pdf

The study analysed roughly 10,000 programming sessions and found that programmers often navigated and recovered task context before resuming edits.

**Supports [E/L]:** resuming complex work is a reconstruction process rather than simply returning to the last chronological point.

## Cross-device and shared-surface evidence

### R13 Cross-Device Taxonomy

**Frederik Brudy, Christian Holz, Roman Rädle, Chi-Jui Wu, Steven Houben, Clemens Nylandsted Klokmose, Nicolai Marquardt.** *Cross-Device Taxonomy: Survey, Opportunities and Challenges of Interactions Spanning Across Multiple Devices.* CHI 2019, Article 562, 28 pages.

- DOI: https://doi.org/10.1145/3290605.3300792
- Microsoft Research: https://www.microsoft.com/en-us/research/publication/cross-device-taxonomy-survey-opportunities-and-challenges-of-interactions-spanning-across-multiple-devices/
- Dataset: https://github.com/frederikbrudy/cross-device-taxonomy

The paper synthesizes a corpus of 510 cross-device papers and develops common terminology for interactions spanning multiple devices and surfaces.

**Supports [E/L]:** cross-device interaction is a mature design space with heterogeneous device affordances, transfer patterns, and evaluation concerns.

**Does not support:** a specific Ember surface architecture or an assumption that all state should be mirrored across devices.

### R14 FamiData Hub and shared-device identity pressure

**Ge Wang, Jun Zhao, Max Van Kleek, Roy Pea, Nigel Shadbolt.** *FamiData Hub: A Speculative Design Exploration with Families on Smart Home Datafication.* CHI 2025, Article 940.

- DOI: https://doi.org/10.1145/3706598.3713494
- Oxford repository: https://ora.ox.ac.uk/objects/uuid:14c09636-059b-4e11-8896-cb14f4eb01f0

The study involved 17 families, 30 children, and 25 parents. Nearly all families reported using a single parent account for smart-home devices, while children often used those devices independently under the adult account. Children also described frustration with their digital identities being mixed with their parents' use.

**Supports [E]:** device or account identity can diverge from the actual human participant in shared domestic settings.

**Ember use:** session continuity can never override uncertainty about who is actually present when disclosure or authority depends on principal identity.

## Reading the evidence conservatively

The evidence deliberately spans multiple domains because issue #8 itself crosses boundaries.

- Agent runtimes demonstrate implementation convergence around persistence, session separation, multiple surfaces, and background work.
- Distributed systems demonstrate that duplicate delivery, ordering, acknowledgement, and retry semantics are scoped and failure-sensitive.
- Payment and durable-work documentation demonstrates that a caller can lose certainty about external side effects even when its own local execution failed.
- HCI studies demonstrate that interruption and resumption carry real human costs and that context cues matter.
- Cross-device and family studies demonstrate that device continuity and human identity are not the same thing.

None of these bodies of evidence dictates Ember's process topology, queue model, event representation, status model, or persistence implementation.

The canonical note therefore keeps stronger cross-domain conclusions marked as **[J]**. In particular, how often Ember should revalidate mutable state under concurrency, how much resumption context is sufficient, and how strong principal evidence must be on a new surface remain experimental questions rather than established algorithms.
