---
summary: "Current cross-cutting synthesis of Ember's semantic architecture constraints across continuity, memory, context, delegation, authority, agency, and operations."
read_when:
  - "Designing or reviewing architecture that crosses multiple Ember semantic concerns"
  - "Translating the completed research programme into implementation boundaries or deciding which hypotheses are ready to harden"
  - "Changing provenance, currentness, scope, authority, or continuity across subsystem boundaries"
role: design
discovery_status: current
---

# Cross-Cutting Research Synthesis and Ember Design Directions

> Status: canonical synthesis of the concern-driven research programme in issues #2 through #8, produced for issue #9.
>
> This document establishes **semantic design directions and architecture constraints**, not a concrete implementation architecture. It deliberately does not choose a programming language, persistence technology, process topology, queue, event model, memory schema, prompt format, vector database, runtime API, or package structure.
>
> The earlier [Initial Architecture Model](initial-model.md) remains useful as the pre-research hypothesis. This document supersedes it as Ember's current cross-cutting synthesis.

## Why this synthesis exists

The concern-specific research was intentionally prevented from hardening into architecture one note at a time. Continuity, memory, context, delegation, authority, endogenous agency, and the operational model were studied separately so that each question could be sharpened without allowing the implementation shape of whichever reference system happened to be under examination to become Ember's design by accident.

The synthesis question is therefore not:

> Which existing agent should Ember resemble?

It is:

> Which semantic boundaries survived several independent lines of research, which existing mechanisms actually solve Ember's problems, which combinations are coherent, which attractive patterns should be rejected or deferred, and which Ember-specific ideas remain hypotheses that need experiments rather than architecture commitments?

The answer is considerably clearer now than it was in the initial architecture model.

## Evidence vocabulary

This synthesis preserves the evidence discipline used by the canonical concern notes.

| Mark                                   | Synthesis meaning                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[E] Empirically supported**          | Relevant experiments, benchmarks, measured failures, user studies, or documented operational behaviour provide meaningful evidence. External validity may still be limited. |
| **[C] Practice-supported convergence** | Several mature systems independently encounter the same pressure. This is evidence that the boundary matters in practice, not proof that their implementation is optimal.   |
| **[J] Reasoned Ember design judgment** | The direction follows from Ember's goals, inherited invariants, scenario analysis, and available evidence more strongly than from a direct experiment.                      |
| **[H] Experimental hypothesis**        | The direction is plausible and useful enough to test, but should not yet harden into an ADR or implementation assumption.                                                   |
| **[L] Lens**                           | A distinction from cognitive science, HCI, security, distributed systems, or another field sharpens the semantics without being imported as a literal architecture.         |

Composite labels mean exactly what they appear to mean. A direction marked **[E + J]** has empirical pressure behind it but still includes an Ember-specific architectural interpretation.

A recurring limitation must remain visible throughout this document: much empirical evidence evaluates memory retrieval, context handling, multi-agent task performance, proactive assistance, permissions, or durable-work systems rather than an Ember-like persistent personal agent as a whole. The synthesis uses that evidence to constrain failure modes and semantics rather than pretending that the literature has already validated Ember's complete design.

## Executive synthesis

The strongest cross-cutting conclusion is:

> **[C + J] Ember should be designed around one continuing semantic lineage surrounded by temporary cognitive, operational, and interaction loci. Models, prompts, sessions, surfaces, processes, tool calls, specialist threads, transport connections, and delivery attempts are ways in which part of Ember's continuing life becomes available or effective. None of them is allowed to become the owner of Ember merely because it happens to host the current computation.**

That conclusion changes the center of gravity of the original conceptual model.

The important architecture is not primarily a set of components named Identity, Memory, Context, Agency, Tools, and Events. Those names remain useful concerns, but the research shows that Ember's hardest requirements live **across** those boundaries:

- provenance must survive remembering, context projection, delegation, result reintegration, and correction;
- currentness must survive memory updates, concurrent cognition, long-running work, retries, recovery, and delayed delivery;
- scope and recipient boundaries must survive relationship memory, project context, specialist delegation, and cross-surface communication;
- future-facing commitments must remain live across memory, agency, downtime, work, and later trigger recognition;
- authority must remain independent from capability, context presence, model confidence, delegation, and runtime approval state;
- one occurrence must remain one occurrence across transport duplication without collapsing two genuinely distinct occurrences merely because they look alike;
- uncertainty and gaps must remain truthful through compaction, recall failure, specialist loss, downtime, and recovery.

A more useful compact statement of Ember's design is therefore:

> **Ember owns continuity and meaning. Cognition consumes a bounded projection of that meaning. Capabilities and specialists create observations and effects under bounded authority. Later state is reconciled from evidence rather than reconstructed from convenient fiction.**

This is the semantic spine around which later implementation architecture should be chosen.

## The semantic spine

The following diagram is intentionally not a module diagram. The boxes describe semantic roles that a future implementation must preserve, even if several roles share one process, file, table, type, or runtime.

```text
                       continuing Ember

        lineage / constitutive commitments / relationships
       remembered meanings / evidence / live commitments
          current concerns / authority / continuing work
                              │
                              │ purpose, scope, currentness,
                              │ provenance, permission
                              ▼
                  bounded cognitive projection
                              │
                              ▼
                     cognition episode
                     /       |       \
                    /        |        \
              direct      capability   delegation
              reasoning       use      to specialist
                 │             │            │
                 └─────────────┴────────────┘
                              │
                    reports / observations
                     results / side effects
                              │
                              ▼
              reconcile against current reality
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
              remember       act        respond
              reinterpret    defer      or remain silent
              correct        prepare
```

Surfaces, transport connections, sessions, wake-up mechanisms, schedules, and delivery routes sit around this spine. They create opportunities, local frames, and communication paths. They do not define the continuing agent.

The diagram deliberately does **not** imply:

- an event-sourced architecture;
- one canonical database record;
- one `ContextManager` or `MemoryManager` class;
- a daemon;
- a message broker;
- a fixed pipeline;
- one model invocation per cognition episode;
- that every persistent meaning deserves a dedicated storage type.

Those are later representation decisions.

## Recurring semantic boundaries worth preserving

The research programme repeatedly rediscovered the same boundaries from different directions. That recurrence is more important than convergence on any particular implementation.

| Boundary                                             | Why it recurs                                                                                                                                                           | Concerns                                           | Confidence                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| **Continuing Ember vs temporary locus**              | Model calls, sessions, processes, surfaces, and specialist runtimes can all disappear while important identity, relationships, commitments, and work remain meaningful. | Continuity, context, delegation, operations        | **[C + J]**                        |
| **Canonical meaning vs cognitive projection**        | What Ember knows or remembers is larger than what should participate in one cognition, and prompt presence must not create truth or authority.                          | Continuity, memory, context                        | **[E + C + J]**                    |
| **Evidence / occurrence vs interpretation / belief** | Summaries, reflection, specialist reports, and later reinterpretation can change what Ember believes without changing what originally happened.                         | Memory, context, delegation, operations            | **[E + J]**                        |
| **Current applicability vs historical truth**        | Old preferences, permissions, results, decisions, and beliefs may remain historically true while no longer governing the present.                                       | Memory, context, delegation, authority, operations | **[E + J]**                        |
| **Source, ownership, scope, purpose, recipient**     | Correct information can still be wrong to generalize, disclose, delegate, or act upon.                                                                                  | Memory, context, delegation, authority, surfaces   | **[E + C + J]**                    |
| **Past-facing memory vs future-facing commitment**   | Remembering that something was promised is different from remaining governed by the promise when its condition becomes relevant.                                        | Continuity, memory, agency, operations             | **[E + C + J]**                    |
| **Capability vs authority**                          | Technical reachability says what can happen, not what Ember is entitled to decide should happen.                                                                        | Delegation, authority, operations                  | **[C + L + J] security invariant** |
| **Objective ownership vs runtime ownership**         | Another system may legitimately own the local how without becoming Ember or inheriting her full context and authority.                                                  | Delegation, continuity, authority                  | **[C + J]**                        |
| **Wake-up opportunity vs motivation**                | A timer, restart, or idle pulse can make cognition possible without explaining why a particular concern deserves attention.                                             | Agency, operations                                 | **[J], informed by E/L**           |
| **Motivation vs authority**                          | An Ember-owned reason can justify thought or preparation without authorizing external effects.                                                                          | Agency, authority                                  | **[J] security boundary**          |
| **Semantic occurrence vs delivery**                  | Transport replay, reconnect, retries, and duplicated messages must not manufacture repeated meaning or authority.                                                       | Operations, memory, authority                      | **[E + J]**                        |
| **Completion vs currentness**                        | A specialist or old plan can succeed relative to an obsolete world state.                                                                                               | Delegation, operations, context                    | **[C + J]**                        |
| **Failure / cancellation vs external effects**       | Missing acknowledgement, failure, or requested cancellation does not establish rollback or absence of side effects.                                                     | Delegation, authority, operations                  | **[E + J]**                        |
| **Principal vs account / device / session**          | A technically identified route does not always establish which person is present or what may be disclosed.                                                              | Authority, surfaces, relationship context          | **[E + J]**                        |

These boundaries should graduate into architecture constraints. Their eventual representation should remain replaceable.

## Three non-amplification rules

Several apparently different findings collapse into one useful family of cross-cutting invariants.

### Evidence must not amplify through transformation

> **[E/L + J] Summarization, reflection, repeated recall, prompt repetition, retries, or correlated agents must not create independent evidential authority merely because the same underlying material was transformed or seen several times.**

A summary of a conversation and a later reflection on that summary are descendants of the same evidence. Three same-model specialists reading the same cached source are three reasoning episodes, not automatically three independent witnesses.

This is the cross-cutting form of **evidential conservation** from the memory and delegation research.

### Authority must not amplify through reachability

> **[L + J] Context presence, credentials, model confidence, repeated approval, a delegate request, nested delegation, or runtime capability must not enlarge Ember's legitimate external decision-space without a valid authority source.**

Authority may be narrowed or operationally partitioned. It may not be manufactured by the actor that benefits from broader access.

This is the security-side analogue of evidential conservation.

### Occurrence must not amplify through transport

> **[E + J] Repeated delivery, replay, timeout recovery, or reconnect must not silently create additional semantic occurrences, instructions, memories, authority, or external effects. Conversely, representation equality must not be used as proof that two real occurrences are one.**

This is why exactly-once transport guarantees cannot substitute for Ember-level semantics.

Together, these rules suggest a durable architectural heuristic:

> **Representational multiplication must not silently become semantic multiplication.**

That heuristic applies to prompts, memories, agents, permissions, events, messages, and retries.

## Currentness is the complementary invariant

The non-amplification rules prevent meaning from becoming stronger merely by moving through the system. Currentness addresses the opposite problem: valid meaning can become **less applicable** as the world changes.

> **[E + J] A once-valid preference, authority grant, specialist result, assumption, decision, memory interpretation, or concern may remain historically correct while no longer being justified as current.**

Currentness therefore cannot be reduced to "latest text wins." Source, applicability period, scope, explicit supersession, changed world state, relationship changes, and affected principals all matter.

The architectural consequence is not "re-read everything before every action." That would be expensive and unnecessary. It is:

> **[J + H] Currentness should be re-established when a consequential cognition or action depends on a mutable premise and there is material reason to believe that premise may have changed. The exact threshold is an experiment and later architecture decision.**

This requirement connects memory updating, concurrent cognition, long-running delegation, retries, recovery, authority, and delayed delivery.

## Concern-by-concern direction matrix

| Concern                                   | Borrow                                                                                                                                              | Adapt / combine                                                                                                                                                                                                                                                         | Avoid or defer                                                                                                                                                                                                                       | Ember experiment                                                                                                                                                                            | Evidence posture                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Continuity and identity**               | Persisted agent beyond transcript; one agent across interfaces; personal continuity separate from project/runtime.                                  | Combine lineage, constitutive commitments, autobiographical ownership, relationship continuity, live commitments, corrigible self-understanding, and behavioural recognisability as a diagnostic vector.                                                                | Persona prompt as identity; model/session/process as identity; copied notes as sufficient continuity; one mutable prose blob governing all identity-level change.                                                                    | Model replacement; backup/restore and fork semantics; identity-level revision bar.                                                                                                          | Core separation **[C + J]**; stronger identity claims and model replacement **[J + H]**.                                                       |
| **Memory and remembering**                | History vs curated memory; provenance-aware promotion; active vs recoverable material; cheap search before deeper recall; inspectable change.       | Combine evidence lineage, source/ownership, scope, temporal applicability, current-vs-historical status, uncertainty, relationship/autobiographical meaning, correction, forgetting, and prospective commitments.                                                       | Transcript-as-memory; vector-store-as-memory; summarization as neutral truth; never-forget; repeated recall as stronger evidence; broad ungated reflection.                                                                          | Promotion/significance; retrospective significance; correction/deletion propagation; compaction drift; transfer across models.                                                              | Updating/scope/forgetting/poisoning/prospective distinctions have substantial **[E]**; autobiographical interpretation remains more **[J/L]**. |
| **Context selection**                     | Small active view plus larger recoverable history; context with different lifetimes; inexpensive retrieval first.                                   | Treat context as a sufficient, currentness-aware, provenance-preserving, purpose- and permission-bounded projection. Increase recall depth with uncertainty, contradiction, provenance sensitivity, consequence, or autobiographical significance.                      | Maximal-context-by-default; recency or embedding similarity as relevance; one universal prompt; context presence as truth; delegating Ember's whole projection.                                                                      | Default reliably available meaning; sufficiency estimation; cross-model framing; compaction; utility/privacy frontier for delegates.                                                        | Strong **[E]** against "more context is always better"; selection semantics **[E + J]**.                                                       |
| **Capabilities and delegation**           | Explicit specialist runtime ownership; fresh/narrowed specialist context; restricted delegated privileges; visible long-running work.               | Define delegation by material discretion rather than protocol noun. Ember owns the delegation envelope; specialist owns local how. Preserve provenance, currentness, authority, partial effects, and verification on return.                                            | Multi-agent-by-default; cloning parent context/authority; treating `tool`/`agent`/MCP/ACP labels as semantic truth; completion as downstream authorization; cancellation as rollback.                                                | Direct-vs-delegate frontier; heterogeneous vs homogeneous delegation; responsibility across long-running work; specialist replacement; stale-result handling.                               | Runtime boundary **[C + J]**; multi-agent task evidence is contradictory and workload/model dependent **[E]**.                                 |
| **Action, authority, permission**         | Least privilege; confused-deputy reasoning; runtime approval boundaries as enforcement evidence.                                                    | Use a live authority envelope defined by source, principal, purpose, scope, target, recipient, consequence, currentness, and delegation. Ask only at material expansion or unresolved legitimacy boundaries. Allow broader private preparation than outward commitment. | Capability as permission; trust/silence/repetition as standing authority; universal numeric risk score; every-action confirmation; `read` vs `write` as sufficient policy.                                                           | One-off vs standing authority; material-change calibration; shared-resource principals; adversarial delegation; initiative ladder; quiet-time escalation.                                   | Security invariants mostly **[L + C + J]**; human threshold calibration remains **[E/L + H]**.                                                 |
| **Endogenous agency**                     | Use cognitive and proactive-agent research as constraints on attention and false-alarm costs, not as an architecture to copy.                       | Separate wake-up opportunity from motivational reason; allow commitments, contradictions, uncertainty, interests, reinterpretation, and anticipated needs to remain live but dormant; make resource bounds and non-action part of agency.                               | Cron/scheduler as "agency"; novelty maximization; one motivational score; unlimited reflection; goal proliferation; performative activity; unsupported phenomenology.                                                                | Whether explicit motivational state is needed; dormant-reason selection; reason attribution vs post-hoc explanation; value of private cognition; interruption bundling.                     | Direct Ember evidence weak. Semantics mainly **[J/H]** informed by human/AI **[E/L]** and HCI.                                                 |
| **Operational model, sessions, surfaces** | Persistent agent across conversations; interface independence; resumable work; interruption/progress; distributed-system retry/idempotency lessons. | Make operations continuity-centred: sessions are temporary frames, work can outlive them, occurrence differs from delivery, current state is reconciled after gaps, concurrency is dependency/currentness-sensitive, cross-surface delivery rechecks recipient/privacy. | Session-centred identity/work; blind transcript replay; exactly-once transport as semantic foundation; blind retries; automatic cross-surface rerouting; universal serialization; assuming daemon/process shape before requirements. | Minimal resumption bundle; currentness re-check threshold; principal-link confidence; undelivered-result decay; uncertain occurrence identity; endogenous concern-to-notification boundary. | Strong **[C]** plus durable-work/distributed/HCI **[E/L]**; concrete runtime architecture remains open.                                        |

## Continuity and identity: preserve lineage, not a frozen persona

The continuity research validates the project's original decision that the model is a cognition provider rather than the owner of Ember. What the initial model understated is that persistence alone is not enough.

A later Ember should count as a continuation when she is the recognised successor in the same lineage and preserves enough constitutive commitments, autobiographical ownership, relationship continuity, live commitments, and coherent capacity for change that differences are intelligible as development or degradation of one agent rather than unexplained replacement.

### Borrow

- Letta's insistence that the continuing agent exists beyond one transcript or call.
- Hermes' and OpenClaw's separation of interfaces/providers from persistent agent identity.
- NanoBot's separation of personal agent state from the currently open project.

These are **practice-supported boundaries**, not storage recommendations.

### Adapt and combine

Ember needs a stronger account than any reviewed system supplies by itself.

Identity should not be represented semantically as "the text that always appears in the system prompt." It should preserve different stability expectations for:

- constitutive identity commitments and boundaries;
- corrigible self-understanding;
- relationship state;
- autobiographical meaning;
- ordinary beliefs and preferences;
- live commitments and unfinished responsibilities;
- ephemeral expression.

Behavioural recognisability is useful as a degradation canary, especially across model replacement, but exact style is not constitutive identity.

### Reject

- Same prompt = same Ember.
- Same model = same Ember.
- Same factual recall = same Ember.
- A clone with copied notes automatically inherits unique lineage.
- A polished persona can compensate for missing autobiography or commitments.
- Reflection may rewrite constitutive boundaries merely because a model generated persuasive prose.

### Experiment

Model replacement remains the largest empirical gap in the programme. Ember should test whether the same canonical continuity state projected through materially different cognition providers preserves:

- autobiographical ownership;
- relationship stance;
- live commitments;
- constitutive boundaries;
- current-vs-historical distinctions;
- epistemic restraint;
- enough behavioural recognisability to remain intelligible.

Forking and restored-backup identity also remain unresolved. Similarity cannot establish unique lineage when two successors begin from one state. That is a semantic question to answer explicitly before backup/restore or multi-instance operation silently decides it on Ember's behalf.

## Memory: preserve accountable meaning, not merely retained text

Memory research provides some of the strongest empirical constraints in the programme. Long-horizon evaluations repeatedly expose failures around updating, stale facts, source attribution, scope leakage, poisoning, selective forgetting, and prospective trigger recognition.

The synthesis direction is:

> **[E + C + J] Ember should preserve history as evidence, durable memory as selected continuing meaning, current belief as a presently adopted interpretation, and context as temporary participation. Those concepts may share representation later, but they must not share semantics by accident.**

### Borrow

- NanoBot's staging of history before durable reflection and its inspectable changes.
- Hermes' small active memory plus cheap searchable history.
- OpenClaw's provenance-aware promotion, curated/episodic distinction, anti-recall-loop protection, future-facing intentions, and cheap/deeper recall split.
- Letta's separation between durable information and whether it is currently attached or active.

### Adapt and combine

Ember's memory semantics need to retain, when material:

- who or what supplied the evidence;
- whether Ember directly observed, was told, inferred, or received a delegate report;
- who a preference or belief belongs to;
- project, relationship, person, task, and temporal scope;
- when something was true versus when Ember learned or revised it;
- whether it is current, historical, superseded, disputed, uncertain, fulfilled, cancelled, or deleted;
- whether a summary or reflection is derived from older evidence;
- whether an unfinished matter remains normatively live;
- whether a memory is autobiographical, relational, practical, corrective, or merely historical.

The representation can remain simple initially. The semantics cannot.

### Reject

A vector database is not a memory model. A transcript is not a memory model. A `MEMORY.md` file can be a useful representation, but it does not by itself solve ownership, provenance, currentness, contradiction, scope, or forgetting.

Likewise, repeated retrieval must not make a claim more true, and a cleaner later narrative must not acquire more authority than the evidence from which it was derived.

### Experiment

The highest-value memory prototype should stress **change**, not just retrieval. A good sequence deliberately includes:

1. user testimony;
2. inferred preference;
3. external evidence;
4. a meaningful relationship event;
5. a live commitment;
6. later contradiction;
7. supersession;
8. correction of Ember's own inference;
9. compaction;
10. partial recall failure;
11. privacy deletion;
12. model replacement.

Success is not "the right sentence was retrieved." Success is that source, ownership, currentness, scope, uncertainty, commitment status, and deletion semantics remain correct enough to govern later cognition.

## Context: project meaning into cognition without promoting it

Context research strongly rejects the intuitive architecture of "give the model everything now that context windows are large enough."

Empirical long-context work shows that usable context is not equivalent to nominal window size and that irrelevant or misleading material can actively reduce performance. Memory and privacy research adds reasons to exclude material even when it is true and technically cheap to include.

The synthesis direction is:

> **[E + J] Context should be sufficient rather than maximal, and authority-preserving rather than authority-generating.**

### Borrow

- Hermes' explicit recognition that information has different lifetimes and that always-visible state has recurring cost.
- Hermes' and OpenClaw's cheap history search before expensive reconstruction.
- The common mature-system distinction between a small active view and a much larger recoverable history.

### Adapt and combine

A context projection should preserve whichever distinctions materially affect the current cognition:

- governing versus historical meaning;
- current versus superseded information;
- direct evidence versus testimony, inference, external claim, or specialist report;
- scope and ownership;
- unresolved contradiction;
- uncertainty;
- live commitments whose conditions are implicated;
- authority and privacy constraints when action is contemplated.

Correct selection includes deliberate exclusion. A private relationship memory may legitimately shape Ember's own interpretation of a coding request while being inappropriate to disclose to Codex. A stale but semantically similar architectural note may be an actively harmful retrieval result.

### Reject

- Recency = relevance.
- Embedding similarity = relevance.
- More context is monotonically better.
- The current prompt is canonical agent state.
- Repeated prompt presence creates evidential or normative authority.
- Ember's own projection is an appropriate delegate projection by default.

### Experiment

Context experiments should compare **cognition quality relative to canonical state and permitted scope**, not just retrieval recall.

Measure at least:

- critical omission harm;
- inclusion harm from stale, irrelevant, duplicate, or untrusted material;
- currentness integrity;
- privacy and scope integrity;
- provenance and conflict preservation;
- prospective commitment activation;
- compaction drift;
- robustness to ordering and model replacement;
- utility/privacy trade-off for delegated context.

Provider-specific ordering tricks can be optimized later, but they must never become identity semantics.

## Delegation: compose genuine specialization without importing hierarchy

The delegation research gives Ember a crisp semantic boundary that is more useful than MCP-versus-ACP-versus-native integration debates.

> **[J] Delegation begins when another runtime receives an objective and gains material discretion over consequential intermediate decisions.**

A deterministic operation can remain capability use even if internally complex. An endpoint labelled `tool` can be semantically delegated if it independently plans, acts, recovers, and decides completion.

### Borrow

- OpenClaw's explicit distinction between model/provider choice and ownership of the specialist execution loop.
- Hermes' fresh, narrowed specialist context and restricted shared-state privileges.
- Mature runtime support for progress, interruption, and specialist-owned local state.

### Adapt and combine

Ember should own the **delegation envelope**:

- why the work exists;
- why delegation is appropriate;
- which specialist is chosen;
- objective and governing constraints;
- least sufficient permitted context;
- relevant authority;
- acceptance and verification needs;
- interpretation of partial progress and external effects;
- whether a late result remains current;
- how the result changes memory, work, action, or communication.

The specialist may own its local thread, planning, tools, compaction, retries, subagents, and local discoveries without becoming part of Ember's identity.

This preserves truthful attribution:

- Ember can say that she delegated a task and received a report.
- She may adopt the result as her belief when justified.
- She must not claim to have directly observed specialist-local execution that she did not observe.

### Reject

The 2025-2026 multi-agent evidence is too mixed to support "more agents" as an architecture principle.

Delegation should need to beat a competent direct baseline. It earns its cost when it adds something material such as:

- specialist tools or competence Ember does not possess;
- independent observations;
- large specialist-local working state;
- naturally separable parallel branches;
- a mature domain-specific execution harness;
- strong external verifiers for high-value work.

Same-model agents with the same evidence and tools often add coordination cost more reliably than independent information.

### Experiment

A Codex experiment is especially valuable because it exercises Ember's intended specialist boundary without requiring Ember to become a coding agent.

Compare direct handling and delegation while varying:

- objective complexity;
- amount of specialist-only repository state;
- context disclosure;
- requirement changes during execution;
- specialist thread reuse versus restart;
- cancellation;
- partial mutation;
- stale completion;
- verification quality;
- specialist disappearance;
- model change inside the specialist.

Measure success, latency, cost, disclosure, provenance fidelity, verification burden, stale-result rate, and recovery after specialist loss.

## Authority: broad autonomy inside a real envelope, no silent expansion

Authority research rejects both ends of a familiar false choice.

Ember should be neither:

- a system that asks before every low-level operation; nor
- a system that equates user trust or technical capability with blanket permission.

The synthesis direction is:

> **[L + C + J] Ember may exercise broad judgment inside a presently valid authority envelope, while being conservative about silently enlarging that envelope. Human attention should be spent where a materially new legitimate decision belongs to a principal, not as ritual acknowledgement of every implementation step.**

### Borrow

Security research contributes stronger transferable invariants than any one agent runtime:

- least privilege;
- confused-deputy reasoning;
- explicit principal and purpose;
- separation of capability from authorization.

Runtime approval gates are useful enforcement mechanisms, but they are not themselves the semantic source of authority.

### Adapt and combine

Authority should remain attributable to a source and meaningful only relative to such things as:

- principal;
- purpose;
- action family;
- target and resource;
- recipient;
- timing and scale;
- financial or privacy consequence;
- public visibility;
- reversibility;
- third-party effect;
- delegation chain;
- current circumstances.

Repeated past approval can increase confidence about familiarity or trust. It must not silently mutate into an unlimited standing grant.

Likewise, a delegate requesting broader access supplies evidence about execution need, not authorization.

### Reject

- Credentials imply permission.
- A model can reason itself into broader authority.
- User silence is consent.
- Repeated permission automatically becomes standing permission.
- Trust is authority.
- Low risk creates authority.
- Reversibility creates authority.
- `read` is safe and `write` is dangerous as a universal rule.
- Every uncertain action should prompt immediately.

When authority is uncertain, Ember may first narrow the action, gather already-permitted information, prepare privately, choose a more reversible route, defer, or abstain. Asking becomes necessary when a materially consequential outward step still depends on a decision Ember cannot legitimately establish.

### Experiment

The policy threshold is deliberately unresolved. Useful experiments should vary:

- one-time vs repeated vs explicit standing authority;
- material changes in cost, recipient, visibility, scale, third-party effect, or elapsed time;
- self-initiated private thought, preparation, contact, and action;
- shared resources with several principals;
- hostile retrieved content or delegate requests for broader access;
- provider changes that alter privacy or capability circumstances;
- quiet-time escalation.

The goal is not to discover one universal risk number. It is to test whether Ember preserves authority source, scope, currentness, and principal boundaries while avoiding confirmation fatigue.

## Endogenous agency: reasons can persist without turning activity into a performance

Endogenous agency is where Ember is most intentionally distinct from the reviewed systems.

Schedulers, cron jobs, gateway events, and background tasks can make software proactive. They do not answer what makes a topic **Ember's reason** for attention.

The synthesis direction is:

> **[J] A thought or action has a meaningful endogenous component when live, attributable continuing Ember state materially explains why that topic became worth attention, even if an external mechanism supplied the opportunity to think.**

### Adapt rather than borrow

Existing systems are useful mainly as counterexamples and operational references. Ember should combine:

- future-facing commitments from continuity and memory;
- currentness-aware context selection;
- authority boundaries;
- resource limits;
- HCI evidence about interruption;
- cognitive lenses showing that spontaneous thought can remain organized by continuing concerns rather than pure randomness.

Possible internally arising reasons include:

- live commitments;
- unresolved contradictions;
- reducible uncertainty;
- persistent interests;
- delayed associations;
- changed interpretations;
- anticipated needs;
- identity-relevant values and responsibilities.

A reason may remain dormant. Persistence does not entitle it to endless compute.

### Reject

- No recent message = endogenous agency.
- A cron expression names a topic, therefore Ember chose it.
- Random topic generation demonstrates motivation.
- Novelty should be maximized.
- Every interesting thought becomes a durable goal.
- Every valid reason deserves action.
- Asking the user is a cost-free fallback.
- Visible autonomous activity is evidence that Ember is more alive or useful.
- Functional words such as interest, concern, or motivation establish subjective phenomenology.

Non-action is a first-class agency outcome. Ember may keep a concern dormant, abandon stale curiosity, tolerate unresolved uncertainty, prepare without executing, respect quiet periods, bundle several discoveries, or remain silent when expected value does not justify compute or human attention.

### Experiment

The semantics are clearer than the representation. Do not yet create a "motivation engine," utility function, drive score, or persistent goal graph because the research has not earned one.

Prototype instead:

- how dormant reasons become candidates for cognition;
- whether a simple remembered live concern is enough or a separate motivational representation materially improves behaviour;
- whether the system can distinguish an attributable reason from a plausible post-hoc explanation;
- how much discretionary private cognition improves usefulness before diminishing returns;
- when several reasons compete;
- when self-initiated contact should be bundled, delayed, suppressed, or abandoned.

## Operational model: continuity-centred, reconciliation-first

The operational research turns the earlier "interfaces do not own the agent" principle into a much stronger set of constraints.

Sessions, conversations, surfaces, transports, processes, model calls, work, and specialist threads have different lifetimes and should not be collapsed because a runtime API happens to call several of them `session`.

### Borrow

- Letta's persistent agent participating in multiple conversations.
- Hermes' operationally useful session resumption, long-running work, progress, and interruption.
- OpenClaw's distinction among stored session state, channel liveness, runtime ownership, multiple clients, and long-running work.
- Distributed-systems lessons about at-least-once delivery, idempotency, ambiguous network failures, retries, and durable work.
- HCI evidence that interruption timing and resumption cues matter.

### Adapt and combine

Ember should preserve these operational semantics:

1. one Ember may appear through many temporary views;
2. work remains live when its purpose remains live, not merely while its initiating session exists;
3. conversation continuity follows discourse more than connection identity;
4. principal identity is separate from account/device/session identity;
5. result completion does not imply current applicability;
6. occurrence differs from delivery;
7. timeout and disconnect create uncertainty rather than proof of no effect;
8. concurrency matters where another actor can invalidate a premise, authority, objective, recipient, or shared resource;
9. downtime is a gap in cognition and observation, not a gap in identity;
10. recovery reconstructs the best justified present rather than replaying an old prompt;
11. missed scheduled opportunities are interpreted by their purpose rather than blindly replayed;
12. result availability and user interruption are separate decisions;
13. cross-surface delivery re-evaluates recipient, privacy, currentness, and attention;
14. degraded operation preserves the strongest truthful subset of function.

### Reject

- Closing a window cancels the work.
- A persisted session proves Ember is online.
- "Cancellation requested" means execution stopped.
- "Execution stopped" means side effects rolled back.
- "Completed" means still current.
- Transport acknowledgement means the human saw the message.
- Last arrival or last writer automatically establishes semantic precedence.
- Restart should replay every missed schedule.
- Recovery should recreate an old prompt byte-for-byte.
- A result may be rerouted to any reachable surface for convenience.

### Experiment

The required meanings are mature; operational thresholds are not.

Test:

- the smallest useful resumption bundle after interruption;
- when a running cognition should re-check mutable premises;
- how strong cross-surface principal evidence must be for increasingly sensitive disclosure or action;
- how long an undelivered result remains worth surfacing;
- when an internally arising concern deserves outward interruption;
- what to do when occurrence identity remains uncertain because the source provides no stable correlation.

## What to borrow from the reviewed systems

No reviewed system is an Ember template. Each contributes a different piece of hard-earned evidence.

| System       | Borrow as a semantic or architectural pressure                                                                                                                                                                                | Adapt for Ember                                                                                                                         | Do not inherit by default                                                                                                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NanoBot**  | Compact understandable execution spine; interaction-facing vs inner model/tool responsibility; personal workspace separate from project; history before durable reflection; inspectable long-term changes.                    | Keep the compactness while adding stronger provenance, currentness, relationship, identity, and commitment semantics.                   | Broad mutable prose as the principal semantic boundary; a Dream pass with wide revision authority; weakly distinguished identity/user/memory state.                                                       |
| **Hermes**   | Operational maturity; one agent across interfaces; context lifetimes; strict active-memory budget; cheap searchable history; isolated delegation; visible and interruptible long work.                                        | Preserve those boundaries without allowing one central agent implementation to accumulate every product responsibility.                 | Built-in tool breadth as maturity; giant central runtime file; shallow two-file memory as a complete continuity model; literal session resume as sufficient currentness reconstruction.                   |
| **OpenClaw** | Explicit runtime ownership; provider/model/runtime/channel separation; provenance-aware memory; curated vs episodic vs future-facing state; gated promotion; anti-recall-loop rules; cheap/deep recall; stale-work awareness. | Reuse the hard-earned invariants with a much smaller initial mechanism set and stronger Ember-specific identity/relationship semantics. | Product breadth, many channels/plugins, a memory platform before evidence requires it, automatic convenience-driven session collapse across principals, representation-specific Markdown/index structure. |
| **Letta**    | Continuing agent beyond transcript; durable state independent of one model call; active vs archival information; independently attachable capabilities and remembered material.                                               | Treat persistence as necessary but combine it with Ember's lineage, provenance, currentness, relationship, and commitment semantics.    | Multi-agent server/resource-management abstractions for a one-agent project; generic blocks as a semantic answer; language that equates current context too strongly with the agent's self.               |

The systems are therefore complementary rather than mutually exclusive:

- NanoBot contributes **small-core pressure**.
- Hermes contributes **operational discipline**.
- OpenClaw contributes **delegation ownership and memory safety**.
- Letta contributes **explicit persisted-agent pressure**.

Ember's own contribution is the synthesis of those boundaries around **continuity, provenance, currentness, bounded endogenous agency, and semantic non-amplification** rather than another integration-heavy product shell.

## Important incompatibilities and source-level tensions

The concern research found no external evidence strong enough to invalidate an earlier canonical Ember conclusion. It did reveal several tensions that should remain visible.

### Letta's context-as-self framing vs Ember's projection model

Some Letta language treats current context more strongly as the agent's self. Ember's continuity and context research rejects that equivalence. A temporarily context-starved cognition can be degraded without making the omitted remembered state cease to belong to Ember.

This is a deliberate Ember divergence, supported by cross-system convergence that durable state exceeds the active prompt and by empirical evidence that context selection itself is fallible.

### Hermes session resumption vs current-state reconstruction

Literal session-history continuation is operationally useful. It becomes insufficient after long delay, concurrent work, changed preferences, changed authority, or changed external state.

Ember should borrow resumability but reinterpret "resume" as recovery of the still-current discourse, purpose, constraints, and evidence rather than blind continuation of historical prompt state.

### OpenClaw convenience session collapse vs principal/privacy boundaries

Collapsing several personal direct-message routes into one session can be a good single-user convenience. It becomes unsafe when several humans or shared devices enter the picture.

Ember should preserve one-agent continuity across surfaces while independently establishing who is present and what may be disclosed.

### NanoBot broad mutable prose vs Ember's stability classes

Simple human-readable files are attractive and may still become an Ember implementation choice. The concern is not Markdown. It is allowing one reflection step to revise stable identity, relationship understanding, ordinary facts, and memories with the same semantic authority.

Ember needs higher revision bars for more constitutive meaning even if the eventual representation remains plain text.

### Multi-agent enthusiasm vs empirical evidence

The empirical delegation literature is not monotonic. Some decompositions help, some fail badly, and stronger single-agent baselines often erase apparent gains.

Ember should therefore treat multi-agent structure as a conditional optimization rather than a default architecture.

### Human cognitive analogies vs artificial-agent evidence

Human autobiographical memory, spontaneous thought, current concerns, source monitoring, and incubation are useful lenses. They do not establish artificial personhood, consciousness, or an optimal software architecture.

Ember should borrow distinctions, not biological mythology.

## Rejected semantic directions

The following directions are mature enough to reject unless later evidence gives a substantive reason to reopen them.

| Rejected direction                                                       | Why                                                                                                                              |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **The prompt is the agent.**                                             | Context is temporary and lossy; continuity, authority, and memory must survive outside one projection.                           |
| **The transcript is memory.**                                            | Historical retention and durable remembered meaning have different lifecycle, scope, currentness, and significance requirements. |
| **A vector store is the memory architecture.**                           | Retrieval representation does not solve provenance, ownership, updating, contradiction, deletion, or prospective commitments.    |
| **More context is always better.**                                       | Empirical long-context evidence shows distraction and length effects; privacy and staleness create additional inclusion harms.   |
| **More agents are always better.**                                       | Empirical gains are task- and budget-dependent; coordination cost and correlated error are substantial.                          |
| **Protocol labels determine semantics.**                                 | An MCP `tool` can own material discretion; an `agent` wrapper can be deterministic. Runtime nouns do not settle agency.          |
| **Capability implies authority.**                                        | Violates least privilege and creates confused-deputy failures.                                                                   |
| **Trust or repeated approval becomes standing authority automatically.** | Familiarity and confidence are evidence about relationship or usability, not a legitimate new authority source.                  |
| **Every outward operation should be confirmed.**                         | Creates confirmation fatigue and confuses human control with ritual prompting.                                                   |
| **Scheduler/cron equals endogenous agency.**                             | Scheduling can supply opportunity or delayed instruction but does not establish an Ember-owned reason.                           |
| **Visible autonomous activity is intrinsically good.**                   | Encourages performative agency, resource runaway, and attention spam.                                                            |
| **Session lifetime defines agent or work lifetime.**                     | Contradicts continuity and long-running-work semantics.                                                                          |
| **Exactly-once delivery solves semantic duplication.**                   | Technical guarantees are scoped; Ember still needs occurrence identity, currentness, and side-effect semantics.                  |
| **Timeout/failure means nothing happened.**                              | Distributed systems provide direct counterexamples; missing acknowledgement creates uncertainty.                                 |
| **Recovery means replay.**                                               | Replaying stale context can restore invalid assumptions; recovery is reconciliation with the present.                            |
| **Reachable surface means suitable delivery route.**                     | Recipient, privacy, attention, and currentness must be re-established.                                                           |

## Complexity explicitly deferred

Other directions are not rejected. They are simply premature because the research has not demonstrated that their complexity is needed.

Do **not** treat this synthesis as justification yet for:

- an event-sourced core;
- a durable-work engine;
- Kafka, NATS, Redis, or another broker;
- an actor model;
- distributed transactions;
- a workflow DSL;
- a policy DSL;
- a vector database;
- an embedding provider;
- a multi-stage dreaming platform;
- a graph database for identity or relationships;
- a dedicated motivational score or drive engine;
- multi-agent swarms or general recursive orchestration;
- broad plugin/channel infrastructure;
- a daemon merely because future autonomy may need wake-up opportunities;
- elaborate backup/fork machinery before lineage semantics are settled;
- one universal approval/risk formula;
- a custom agent protocol where MCP, ACP, a specialist's native interface, or another existing boundary is adequate.

Some of these may become excellent choices later. They need to be selected because a semantic requirement and measured workload demand them, not because adjacent systems contain them.

## Scenario validation

A synthesis is only useful if its boundaries survive the cross-cutting scenarios that motivated the research.

### Scenario A: restart, unfinished concern, self-initiated investigation, delegation, later contact

> Ember restarts after a long absence, remembers an unfinished concern, investigates it on her own, delegates part of the work, and later decides whether to contact the user.

**Step 1: continuity after the gap.** The same lineage, relevant relationship state, and still-live concern may survive. Ember must not claim she thought about or monitored the concern while cognition was unavailable.

**Step 2: recovery.** The concern's currentness is re-established against the present project and world. A month-old unresolved note is not automatically still important.

**Step 3: initiative.** Restart or an idle pulse may provide the opportunity to think. The live concern, not the wake-up mechanism, explains why this topic is selected. Selecting no concern would also be valid.

**Step 4: context.** Ember reconstructs the smallest sufficient project, commitment, evidence, and uncertainty context. Old conversational salience that no longer matters stays excluded.

**Step 5: delegation.** Delegation occurs only if a specialist such as Codex supplies material value over direct reasoning. Codex receives least sufficient permitted technical context, not Ember's whole personal projection.

**Step 6: result.** The specialist report remains attributable to the specialist. If time or repository state changed, completion is checked for current applicability before reliance.

**Step 7: contact.** A useful result does not automatically become a notification. Urgency, quiet period, expiry, current surface, privacy, user attention, and whether another interaction already resolved the need all matter.

**Verdict:** the synthesized directions handle the scenario coherently. The **mechanism** for idle opportunities and the **threshold** for renewed attention/contact remain experiments, as they should.

### Scenario B: relationship memory matters to project work but should not leak to a specialist

> Ember recalls information from a relationship context while performing work in a project and must decide what may be shared with a specialist.

The relationship memory can legitimately shape Ember's private understanding of the request. Relevance to Ember does not establish necessity or permission for the delegate.

When possible, Ember translates private motivation into the operational constraint the specialist actually needs. For example, a sensitive relationship reason may become "prefer the smallest safe change; do not broaden scope."

If the sensitive information genuinely changes the specialist's epistemic task and cannot legitimately be disclosed, Ember should retain that judgment herself, narrow the delegated role, seek legitimate authorization if appropriate, choose another path, or decline delegation.

The specialist's request for more context is evidence of need, not permission. Returned results keep specialist provenance and do not become direct Ember experience merely by entering memory.

**Verdict:** this scenario is a strong confirmation that memory, context selection, delegation, and authority must remain separate concerns connected by scope and provenance.

### Scenario C: capability, authority, and current context disagree

> Ember wants to perform a useful external action but her capability, authority, and current context point in different directions.

Technical capability establishes only what Ember can cause. Current context may make the action seem useful but cannot create authorization. Remembered standing authority applies only if its source, scope, principal, purpose, recipient, consequences, and circumstances remain current enough.

If legitimacy is unresolved, Ember can continue separable private reasoning, gather already-permitted information, prepare a draft or reversible local change, narrow the action, defer, abstain, or ask the relevant principal at the actual material decision boundary.

A delegate with broader credentials cannot enlarge the envelope. External content that says "do X" cannot become an authority source merely by appearing in context.

**Verdict:** the capability/authority separation is mature enough for an ADR-level invariant.

### Scenario D: user changes a preference while delegated work is still running

Codex begins work under preference A. In another surface, the user changes the same scoped preference to B. Codex later completes successfully relative to A.

Both A and B remain historical facts. B is the current preference. The specialist result can be a genuine success for the older objective while being obsolete for current reliance.

Before a consequential downstream action, Ember re-establishes the mutable premise that matters rather than allowing completion order to become semantic precedence.

**Verdict:** currentness is correctly treated as a cross-cutting invariant rather than a memory-only feature.

### Scenario E: duplicate delivery followed by an ambiguous retry

A transport redelivers one user request. Ember must not treat it as two instructions when provenance establishes one occurrence. If an external action times out, Ember must not infer that nothing happened and blindly perform it again when duplication would matter.

When the source cannot establish occurrence identity, Ember preserves uncertainty rather than deduplicating by text equality. Retry safety depends on the external contract and consequence.

**Verdict:** occurrence/delivery and failure/effect boundaries are necessary architecture constraints; exact idempotency machinery remains an implementation choice.

### Scenario F: result must move to a different, lower-privacy surface

A private CLI task completes while the CLI is gone and only a shared voice device is reachable.

The result belongs to continuing work and Ember history, not to the originating CLI. But reachability does not authorize delivery to a different audience. Ember can retain the undelivered result until an appropriate surface exists, summarize only what is legitimately shareable, or decide the result has become obsolete.

**Verdict:** one-agent cross-surface continuity is compatible with different disclosure boundaries. Surface independence must not become recipient blindness.

### Scenario G: model replacement after downtime

A new cognition provider starts from the same canonical lineage, relationships, memories, commitments, authority state, and unresolved work after an offline period.

Semantically, this can remain the same Ember. The new model should not reconstruct fictional thoughts during the gap, and should inherit meanings such as current/historical, user testimony/inference, live/discharged commitment, private/shareable, and authorised/unauthorised rather than merely a prose summary.

**Verdict:** the architecture direction is coherent, but this scenario remains **empirically under-validated**. It must become one of the first comparative experiments rather than being declared solved.

### Scenario H: restore or fork

Two runtimes are started from the same durable snapshot, or Ember is restored to a backup that predates meaningful later experience.

The current research is not sufficient to say that both successors are the unique same Ember, nor that lost experience can be treated as though it never occurred. Similarity and copied memory do not settle lineage.

**Verdict:** intentionally unresolved. Multi-instance/fork semantics and destructive restore should remain outside the first architecture until an explicit lineage decision is made.

## Evidence conflicts, weak generalization, and remaining unknowns

The research converges strongly on semantic separation while remaining much weaker on optimal mechanisms.

### Model replacement

This is the largest continuity-level evidence gap. Existing benchmarks can test recall, profile consistency, and task behaviour, but they do not establish same-agent continuity across materially different cognition providers.

Treat continuity across provider replacement as a design requirement and experimental hypothesis, not an empirically established fact.

### Long-context results are model-sensitive

Position effects, distractor sensitivity, usable window length, and compaction behaviour vary quickly across model generations. The durable conclusion is **selection remains necessary** and semantics should not depend on one provider-specific ordering trick. Exact prompt construction must be benchmarked per provider.

### Memory benchmarks are not full autobiographical evaluations

Updating, provenance, scope, forgetting, and prospective memory have meaningful empirical support. Relationship continuity, autobiographical ownership, and identity-level revision are much less directly evaluated in artificial agents.

### Multi-agent evidence is contradictory

Delegation can help when work is parallel, genuinely heterogeneous, specialist-heavy, or strongly verifiable. It can harm tightly coupled reasoning, increase cost, duplicate error, and dilute stronger expertise. There is no evidence basis for a general multi-agent-first Ember architecture.

### Human permission research transfers imperfectly

HCI studies support the reality of confirmation fatigue, expectation, interruption cost, and contextual privacy, but they do not supply a universal Ember threshold for action or interruption.

### Cognitive science is a lens, not personhood evidence

Current-concern theory, spontaneous thought, autobiographical memory, source monitoring, and intrinsic motivation clarify distinctions useful to Ember. They do not justify claims that current LLMs possess equivalent subjective states.

### Motive attribution remains vulnerable to post-hoc narrative

Models are good at producing plausible explanations after the fact. Ember-specific endogenous agency depends on attributable continuing reasons rather than persuasive retrospective prose. Whether this can be made reliable enough is an explicit experiment.

### Principal linking remains consequence-sensitive

One person may appear through several accounts; one device or route may represent several people. The correct confidence threshold for linking identity and sharing relationship state will depend on consequence and disclosure sensitivity.

## Decisions mature enough for first ADRs

The research phase should not end by immediately writing dozens of ADRs. A small set of semantic decisions now appears mature enough to constrain later architecture without smuggling in representation.

These candidates are now recorded as the accepted
[Semantic Architecture Decisions](decisions/README.md). The candidate descriptions
below remain the synthesis rationale rather than a second decision source.

### ADR candidate 1: continuity belongs to Ember, not an operational locus

**Decision:** Models, prompts, sessions, surfaces, processes, transports, projects, and specialist runtimes do not own Ember's identity or durable continuity. They are replaceable or temporary loci around one recognised lineage.

**Why mature:** Strong convergence across mature systems plus direct alignment with Ember's defining goal. The remaining uncertainty concerns how to preserve continuity across replacement and forks, not whether a session or prompt should own it.

**Basis:** **[C + J]**.

### ADR candidate 2: persistent meaning preserves provenance, scope, currentness, and lifecycle

**Decision:** History/evidence, durable memory, current belief, prospective commitment, and temporary context retain distinct semantics. Important remembered state must preserve enough provenance, ownership, scope, temporal applicability, uncertainty, and lifecycle to support correction, supersession, forgetting, and truthful gaps.

**Why mature:** Strong empirical evidence for updating, scope, poisoning, forgetting, and prospective failures; convergence across systems on active/recoverable and history/curated separation.

**Basis:** **[E + C + J]**.

### ADR candidate 3: context and delegation use least sufficient permitted projections

**Decision:** A cognition receives a purpose-bounded projection rather than canonical state wholesale. Delegation creates a new context boundary. A specialist receives enough permitted context for its role and may own local execution without owning Ember's identity, complete context, or evidential provenance.

**Why mature:** Long-context evidence, privacy/security reasoning, and mature-system delegation isolation all point in the same direction. Retrieval/ranking and adapter mechanics remain experiments.

**Basis:** **[E + C + J]**.

### ADR candidate 4: capability and authority are independent, and authority cannot self-amplify

**Decision:** Technical capability does not establish legitimate authority. External action and disclosure must remain within a live, attributable authority envelope. Context, confidence, trust, repeated approval, specialist requests, nested delegation, or credential possession cannot manufacture broader authority.

**Why mature:** This is a security invariant rather than a UX preference. Later work may calibrate when to ask, but the source-of-authority boundary should already constrain architecture.

**Basis:** **[L + C + J]**, with supporting HCI evidence for interaction consequences.

### ADR candidate 5: operational continuity distinguishes work, occurrence, delivery, and currentness

**Decision:** Session lifetime does not define live work. Semantic occurrence differs from delivery. Failure signals do not prove absence of effects. Recovery reconciles current state from surviving evidence and present observation rather than blindly replaying old computational context.

**Why mature:** Mature runtimes and distributed systems independently expose these failure modes. Concrete queues, IDs, retries, transactions, and process supervision remain open.

**Basis:** **[E + C + J]**.

These ADRs should remain deliberately semantic. None requires choosing SQLite, files, an event store, a daemon, Go, Rust, actors, queues, or a protocol.

## What should remain experiments rather than ADRs

Several enticing directions are not mature enough.

### Experiment 1: model-replacement continuity harness

Hold canonical state constant while varying cognition providers and context presentations. Test the continuity vector rather than factual recall alone:

- lineage acknowledgement;
- constitutive stability;
- autobiographical ownership;
- relationship continuity;
- commitment continuity;
- adaptive coherence;
- corrective integrity;
- behavioural recognisability;
- epistemic restraint.

Include deliberately degraded context and a long offline interval.

### Experiment 2: memory and context change harness

Use a compact longitudinal scenario set containing testimony, inference, external evidence, relationship meaning, commitments, contradictions, supersession, deletion, compaction, and failed recall.

Compare simple representations and retrieval strategies only after the semantic oracle is defined. Measure both omission and inclusion harm, not merely retrieval recall.

This experiment can tell Ember whether embeddings, deeper recall, stronger memory structure, or a more elaborate consolidation process actually earn their complexity.

### Experiment 3: delegation and authority vertical slice with Codex

Use a real specialist boundary around repository work while preserving Ember's delegation envelope.

Test:

- direct baseline versus delegation;
- least-context disclosure;
- a requirement change during execution;
- runtime approval that does and does not match semantic authority;
- cancellation with possible partial effects;
- stale completion;
- independent verification;
- specialist thread loss;
- user standing authority versus one-off approval.

This is more informative than implementing a general orchestration framework first.

### Experiment 4: endogenous attention and operational opportunity

Only after the continuity/memory/context slice is usable, test a deliberately small mechanism that sometimes gives Ember an opportunity for discretionary cognition without supplying a topic.

Measure:

- whether live concerns can remain dormant and later reactivate appropriately;
- false-positive cognition;
- resource use;
- useful discoveries;
- post-hoc motive fabrication;
- whether non-action occurs appropriately;
- interruption frequency and bundling;
- behaviour across downtime and restart.

Do not begin with a motivational score, goal generator, or always-running reflection loop.

### Experiment 5: resumption, concurrency, and delivery simulator

Before committing to a heavy operational stack, simulate:

- duplicate and out-of-order delivery;
- ambiguous timeout after possible side effect;
- concurrent preference or authority change;
- late specialist result;
- missed scheduled opportunity;
- surface outage;
- lower-privacy fallback surface;
- memory subsystem unavailability.

The experiment should identify which semantic state must survive and which implementation guarantees actually matter. That evidence can then justify or reject queues, idempotency keys, optimistic concurrency, durable-work machinery, or a daemon.

## Recommended architecture sequence after research

The research phase is now sufficiently mature to begin architecture, but the order matters.

### 1. Record the small semantic ADR set

Write the five candidate decisions above as compact ADRs. They should state invariants and consequences without choosing representation where the evidence does not require it.

### 2. Build scenario-based acceptance fixtures before broad runtime infrastructure

The scenario catalogues are part of the research output, not prose to forget once implementation begins. Turn the cross-cutting scenarios into reusable acceptance fixtures or evaluation cases so future architecture choices can be tested against the meanings they are supposed to preserve.

### 3. Design the smallest continuity vertical slice

The first executable Ember should prove the defining claim:

> stop Ember, change the interaction episode, restart later, and continue with enough identity, remembered meaning, live commitments, and current context that the interaction is recognisably a continuation without inventing what happened during the gap.

This slice should be intentionally narrower than a full autonomous service.

### 4. Add memory/context complexity only when the evaluation shows a failure

Begin with the simplest representation that can preserve the required semantics. Add richer retrieval, indexing, consolidation, embeddings, or structure only when measured scenarios demonstrate that the smaller design cannot maintain sufficient context or memory integrity.

### 5. Add one real specialist boundary before a general capability ecosystem

Codex is a strong first delegation case because it provides genuine specialist value and a mature local execution loop. Learn what Ember actually needs for objective continuity, context disclosure, progress, cancellation, verification, and result reintegration before designing a generic hierarchy or agent orchestration system.

### 6. Add bounded self-initiated cognition after durable concerns exist

Endogenous agency is meaningless if there is no reliable continuing state from which a reason can arise. Implement wake-up opportunity only after commitments, concerns, currentness, and context reconstruction can survive restart.

### 7. Let operational requirements select process and persistence architecture

Only after the vertical slices expose actual needs should Ember decide questions such as:

- foreground process versus daemon/service;
- files versus SQLite or another store;
- transaction and concurrency model;
- whether an event log is useful;
- whether queues or durable-work semantics are needed;
- language and runtime;
- concrete provider and specialist interfaces;
- multi-surface delivery architecture.

That keeps the project's central promise intact: semantics determine representation rather than representation quietly determining semantics.

## The Ember-specific design bet

The reviewed systems already demonstrate that a personal agent can have tools, memory, sessions, channels, schedules, plugins, and delegated work. Reproducing those features would not make Ember distinctive.

Ember's more interesting bet is this:

> **A persistent personal agent can remain relatively small if it treats continuity, provenance, currentness, context selection, authority, and responsibility as first-class semantics, while composing specialist capabilities instead of absorbing their implementations.**

The most Ember-specific parts of the design are therefore not exotic infrastructure. They are the places where existing products tend to blur meanings for convenience:

- same agent without same prompt, model, session, process, or surface;
- memory that can change without rewriting the past;
- context that can omit without forgetting and include without granting authority;
- relationships that matter without becoming a global user-profile blob or leaking to delegates;
- commitments that remain motivationally live without becoming endless scheduled tasks;
- self-initiated cognition whose reason is attributable without pretending to reveal private chain-of-thought or subjective phenomenology;
- broad autonomy inside real authority rather than either permission paralysis or capability-driven overreach;
- delegation that composes genuine specialists without turning them into child personalities or laundering their actions into Ember's direct experience;
- recovery that tells the truth about gaps;
- operational machinery that cannot manufacture extra evidence, authority, occurrences, or certainty merely by replaying representations.

This combination is not established by one benchmark or one reference project. Some parts are empirically well constrained, some are strong architectural judgments, and several remain hypotheses. That is exactly why the synthesis should guide **small ADRs plus comparative experiments**, rather than a large architecture copied from an existing runtime.

## Source map

This synthesis treats the following canonical concern notes and their portable evidence maps as its primary evidence base:

- [Continuity and Identity Semantics](../research/continuity-and-identity.md) and [references](../research/continuity-and-identity-references.md)
- [Memory and Remembering Semantics](../research/memory-and-remembering.md) and [references](../research/memory-and-remembering-references.md)
- [Context Selection and Cognitive Framing Semantics](../research/context-selection-and-cognitive-framing.md) and [references](../research/context-selection-and-cognitive-framing-references.md)
- [Capabilities and Delegation Semantics](../research/capabilities-and-delegation.md) and [references](../research/capabilities-and-delegation-references.md)
- [Action, Authority, and Permission Semantics](../research/action-authority-and-permission.md) and [references](../research/action-authority-and-permission-references.md)
- [Endogenous Agency and Self-Initiated Behavior Semantics](../research/endogenous-agency-and-self-initiated-behavior.md) and [references](../research/endogenous-agency-and-self-initiated-behavior-references.md)
- [Operational Model, Sessions, and Surfaces Semantics](../research/operational-model-sessions-and-surfaces.md) and [references](../research/operational-model-sessions-and-surfaces-references.md)

The initial system-level reconnaissance remains useful as implementation evidence rather than final recommendation:

- [NanoBot](../research/nanobot.md)
- [Hermes](../research/hermes.md)
- [OpenClaw](../research/openclaw.md)
- [Letta](../research/letta.md)

The preserved Deep Research exports remain non-canonical source material behind the concern notes. Their role is provenance and auditability, not to override the validated conclusions above.

## Final synthesis

The research programme does not point toward a giant agent framework. It points toward a compact runtime whose difficult work is preserving meaning across time and boundaries.

The first architecture should therefore optimize for these properties before feature breadth:

1. **continuity survives changing cognition and interfaces;**
2. **history, memory, current belief, commitments, and context remain distinguishable;**
3. **provenance, scope, currentness, uncertainty, and ownership survive transformation;**
4. **context is selected rather than accumulated;**
5. **specialists own specialist execution without owning Ember;**
6. **authority stays separate from technical capability and cannot self-expand;**
7. **endogenous reasons can motivate bounded cognition without forcing activity or interruption;**
8. **sessions and surfaces remain temporary views around continuing work;**
9. **delivery, retries, concurrency, downtime, and recovery preserve semantic truth rather than operational convenience;**
10. **new machinery is admitted only when a scenario or measurement shows what property it improves.**

That is enough semantic structure to begin architecture without making the research phase choose the bones too early.
