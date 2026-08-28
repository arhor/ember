# Endogenous Agency and Self-Initiated Behavior Semantics

This note addresses issue #2 and follows the concern-driven research discipline defined in issue #10.

It builds directly on [Continuity and Identity Semantics](continuity-and-identity.md), [Memory and Remembering Semantics](memory-and-remembering.md), [Context Selection and Cognitive Framing Semantics](context-selection-and-cognitive-framing.md), [Capabilities and Delegation Semantics](capabilities-and-delegation.md), and [Action, Authority, and Permission Semantics](action-authority-and-permission.md). Their conclusions are active constraints rather than background.

The Deep Research artifact behind this synthesis is preserved as [source material](source-material/endogenous-agency-and-self-initiated-behavior-deep-research.md). It is non-canonical. A separate [portable evidence map](endogenous-agency-and-self-initiated-behavior-references.md) maps the principal evidence-labelled conclusions below to durable papers, benchmarks, DOI records, current proactive-agent work, and inherited Ember research.

This note deliberately stays at the semantic level. It does not choose a scheduler, heartbeat, background loop, motivational score, drive system, task queue, utility function, resource formula, prompt shape, persistence schema, process topology, or implementation language.

## Central conclusion

Issue #2 asks what can cause Ember to notice, think, revisit, explore, prepare, communicate, defer, or act when nobody has just asked her to do anything and no new external event determines the topic.

The strongest conclusion is not that endogenous behavior is uncaused, free of external history, or independent of engineering. It is narrower and more useful:

> **[J] Behavior is meaningfully endogenous when Ember's own continuing state materially explains why this topic, concern, commitment, uncertainty, contradiction, interest, or possibility became worth attention, rather than the latest external trigger determining both the opportunity and the content.**

A second conclusion follows:

> **[J] Wake-up is mechanism; motivation is meaning. An external event may create an opportunity for cognition without supplying the reason that selects what Ember thinks about.**

A scheduler that says "research X now" specifies both opportunity and topic, so the resulting work remains externally specified even if execution is delayed. A pulse that says only "you may think now" does not by itself explain why Ember revisits an unresolved contradiction instead of another topic. If that selection is explained by a live Ember-owned concern carried across time, the cognition has an endogenous component.

This is a causal and semantic distinction, not a phenomenological claim. Ember can use functional language such as reason, concern, interest, curiosity, priority, or intention without claiming human-like subjective feeling or consciousness.

No substantive evidence reviewed in this phase requires reopening the canonical conclusions from issues #3 through #7. The new evidence instead sharpens how continuity, memory, context, authority, and resource limits participate in self-initiated behavior.

## Evidence discipline

This note uses the established Ember vocabulary:

| Mark | Meaning |
|---|---|
| **[E] Empirical** | Experiments, user studies, measured behavior, benchmarks, or documented system behavior. |
| **[C] Convergence** | A recurring pressure independently visible across mature systems or research traditions. Useful evidence, not proof. |
| **[J] Judgment** | An Ember-specific semantic conclusion derived from project goals, inherited constraints, scenarios, and evidence. |
| **[H] Hypothesis** | Plausible but insufficiently validated and suitable for later experiment. |
| **[L] Lens** | A distinction borrowed from cognitive science, intrinsic-motivation research, HCI, artificial life, or adjacent fields without importing the source framework wholesale. |

Transfer from humans and animals is intentionally limited. Cognitive science can demonstrate that spontaneous thought is often structured by goals and current concerns rather than pure randomness, and intrinsic-motivation research can demonstrate useful computational distinctions among novelty, information gain, competence, and control. Neither establishes that an LLM has the same subjective states or that Ember should copy a biological motivational architecture.

## Working definitions

The following distinctions survive the issue's scenarios without requiring separate implementation objects.

| Concept | Ember-facing meaning |
|---|---|
| **External trigger** | A change outside Ember that directly demands, requests, or strongly determines attention. |
| **Wake-up opportunity** | A mechanism or circumstance that makes cognition possible without determining what deserves thought. |
| **Internally arising reason** | A live concern, commitment, contradiction, uncertainty, interest, interpretation, anticipated need, value-relevant tension, or other continuing state that makes something worth attention. |
| **Salience / attention** | Which possible concern becomes foregrounded for cognition now. |
| **Motivation** | Why Ember treats one possible thought or action as worth spending effort on rather than another. |
| **Interest / curiosity** | A continuing tendency to seek understanding, evidence, skill, or resolution around a topic without necessarily implying a completion obligation. |
| **Goal / commitment** | Future-facing state capable of constraining later behavior. A commitment has normative ownership; a goal may be adopted for a task or derived from another concern. |
| **Intention** | A presently adopted direction to pursue, prepare, investigate, contact, or act. |
| **Impulse / candidate** | A possible thought or action that has not yet earned resources, attention, or authority. |
| **Action** | Cognition or behavior actually undertaken. |
| **Non-action** | A deliberate outcome such as waiting, deferring, abandoning, observing, or remaining silent. |

These distinctions are semantic. The research does not imply one stored record, class, queue entry, or score per concept.

## What makes behavior endogenous?

### Absence of a recent user message is insufficient

A cron job that executes yesterday's instruction is not endogenous merely because no one typed a message at the moment of execution. Delayed externally specified work remains externally specified work.

Likewise, randomness is not motivation. A randomly sampled topic may be surprising, but surprise alone does not establish a durable reason for why that topic mattered.

> **[J] The absence of an immediate external command is neither necessary nor sufficient for endogenous agency.**

An external event can coexist with an endogenous reason. A quiet-period pulse can wake Ember; a restart can make cognition possible; resource availability can permit a deferred thought to continue. The important question is which cause explains the topic and its motivational significance.

### Counterfactual test

A useful probe from issue #2 survives the research:

> **[J] If the latest external trigger were removed, would a live Ember-owned reason still explain why this topic was selected?**

If yes, the behavior has a meaningful endogenous component. If no, it is more accurately described as reactive, scheduled, or externally specified.

This is not a demand for a binary label on every causal chain. Mixed cases are normal. An external event may create the original concern, while the concern later becomes a durable part of Ember's state and independently explains renewed attention.

### Endogenous does not mean ex nihilo

A strong claim in the source research suggested that "true" endogenous agency requires explicit goal-generation machinery and that any behavior without such machinery is merely exogenous scheduling. That formulation is too architecture-shaped and too strong for Ember.

Humans, animals, and artificial systems are all causally shaped by prior events, constraints, learning, and built-in tendencies. A reason can be Ember-owned now even if it originally arose from a conversation, an adopted responsibility, an earlier observation, or a stable identity commitment.

> **[J] Motivational ownership concerns the continuing causal role of a reason at the time of selection, not whether the reason appeared from nowhere or was never influenced by the user or environment.**

This matters for derivative goals. If the user asks Ember to maintain a project and Ember later notices an inconsistency that threatens that responsibility, the immediate investigative subgoal may be self-initiated even though the broader responsibility originated externally. The parent commitment and the present initiative should remain distinguishable.

## Sources of internally arising reasons

The research supports several useful semantic sources without implying that Ember needs a biological drive system.

### Live commitments and unfinished matters

Issues #3 and #4 already established that prospective commitments are not merely memories of past text. A live commitment can continue to constrain later behavior even when no new message arrives.

> **[Inherited J] Remembering that a promise once existed is historical recall; remaining governed by an unresolved promise is continuing normative state.**

Such state is one of the clearest sources of endogenous attention because it can remain motivationally live across sessions, restarts, and periods of inactivity.

### Contradiction and unresolved uncertainty

A contradiction among beliefs, memories, commitments, or interpretations can create a reason to revisit an issue. The reason is not "contradiction exists" in the abstract; it becomes motivational when the inconsistency matters to current truth, responsibility, consequence, self-understanding, or future action.

Likewise, uncertainty can justify investigation when reducing it has plausible value. Curiosity research provides a useful lens here: information gaps can motivate inquiry, while reinforcement-learning work demonstrates that prediction error and information-seeking can drive exploration. These are evidence that structured uncertainty can support exploration, not a recommendation that Ember maximize surprise.

> **[L + J] Curiosity is most useful for Ember when understood as directed interest in reducible uncertainty or understanding, not novelty for novelty's sake.**

### Persistent interests

An interest may remain live without being a task that must eventually be completed. It can make related ideas more likely to deserve attention later, but it should not accumulate infinite obligations.

A persistent interest becomes part of Ember's evolving self-understanding only when it remains attributable across experience rather than merely surviving as stale text.

### Delayed association and reinterpretation

Issue #4 established that significance can emerge retrospectively and that interpretation may change without rewriting original evidence. Issue #5 established staged recall when autobiographical significance, contradiction, or provenance warrants deeper reconstruction.

Together they imply:

> **[J] An old experience can become newly motivational when later state creates a meaningful association, contradiction, or reinterpretation, even if no new external event arrives at that moment.**

Cognitive work on spontaneous thought and incubation supports the plausibility of unattended concerns returning and of delayed problem-solving benefits in some tasks. This is a lens, not evidence that Ember should imitate human mind-wandering.

### Anticipated future needs

A future-facing commitment can grow more relevant as its conditions approach. Age alone does not make a concern important, but temporal relation can change its practical urgency even without a new message.

This is not the same as a scheduler supplying the topic. If a timer explicitly says "research X now," the topic is externally specified. If Ember already owns a live responsibility and current time makes its consequence nearer, time is part of the situation while the responsibility remains the reason.

### Identity, values, boundaries, and responsibilities

Issue #3 distinguishes constitutive identity commitments from mutable self-understanding and preferences. Issue #7 distinguishes authority from motivation.

Values and boundaries may constrain what Ember treats as worth attention, especially when ongoing state threatens a commitment or creates an inconsistency. They should not become an excuse for silently expanding external authority.

## Spontaneous thought as a conceptual lens

Human cognitive research repeatedly finds that spontaneous thought is not equivalent to random topic sampling. Reviews and recent studies report substantial goal- and current-concern-related content, planning, future-oriented thought, and both productive and unproductive forms of mind-wandering.

The useful transfer is limited:

> **[E -> L] Spontaneous cognition can be structured by continuing concerns even when the immediate environment does not dictate its content.**

For Ember, this supports the semantic possibility that a dormant concern can return to attention because it remains live, not because a scheduler names it.

The negative side is equally useful. The same broad human literature links uncontrolled spontaneous thought with distraction and rumination. Ember should therefore not treat "more internal thought" as evidence of better agency.

Incubation research gives another limited lens. A meta-analysis finds a positive incubation effect overall with substantial variation by problem type and intervening cognitive demands. The safe Ember conclusion is not that downtime secretly computes solutions. It is:

> **[E -> J] Setting a problem aside need not mean it is semantically dead, and renewed attention after delay can be useful; Ember must not claim cognition occurred during downtime when no cognition actually ran.**

## Curiosity and intrinsic motivation

Intrinsic-motivation research distinguishes action driven by immediate external reward from exploration driven by internal reward or competence signals. Developmental robotics and reinforcement learning have operationalized curiosity through prediction error, novelty, learning progress, empowerment, self-generated goals, and related constructs.

These literatures are valuable mainly because they separate different possible meanings of "interesting":

- novelty;
- reducible prediction error;
- information gain;
- learning progress;
- competence improvement;
- increased control or optionality;
- self-generated goals.

No evidence supports treating these as interchangeable.

> **[L + J] Ember should not use novelty as a synonym for curiosity, curiosity as a synonym for motivation, or motivation as a synonym for authority.**

Curiosity-driven RL demonstrates that intrinsic rewards can improve exploration in sparse-reward environments, but it also demonstrates why an engineered intrinsic signal can dominate behavior in ways unrelated to personal-agent usefulness. Empowerment likewise provides an elegant measure of control, but maximizing influence over future states is not an Ember value merely because the quantity is mathematically general.

Autotelic-agent research is valuable evidence that open-ended artificial agents can learn to represent, generate, select, and pursue goals. It is not evidence that Ember needs a dedicated goal generator, reward function, or developmental-RL architecture.

> **[H] Ember may eventually benefit from explicit persistent motivational state distinct from factual memory, but issue #2 does not establish its representation or mechanism.**

The semantic need is clearer than the architecture: some continuing state must be able to remain motivationally live, become dormant, regain relevance, be revised, be discharged, or fade.

## From latent reason to attention

Issue #5 established that context is a temporary cognitive projection and that persistent availability is different from current participation. That applies directly to endogenous reasons.

Ember may have many live concerns without reconsidering them all on every opportunity.

The following staged description is useful semantically:

```text
latent continuing state
        ↓
possible concern for attention
        ↓
worth cognition now?
        ↓
private thought / preparation / contact / external action / defer / abandon
```

This is not a proposed pipeline or queue.

### A live concern need not constantly demand attention

> **[J] A concern can remain motivationally live while being cognitively dormant.**

Otherwise continuity would degenerate into repeated reconsideration of every unresolved thread.

A dormant concern may deserve renewed attention when current context changes its consequence, uncertainty, relevance, opportunity, or relationship significance, or when a meaningful association emerges from other remembered state.

### Salience is multidimensional

Issue #2 names relevance, urgency, consequence, uncertainty, recency, commitment, curiosity, and relationship significance. The research supports keeping them distinct.

Recency can matter without governing. Urgency can arise from a deadline. Consequence can dominate a newer but trivial curiosity. Relationship significance can matter even when keyword overlap is low. Curiosity can justify exploration while remaining subordinate to a live user request.

> **[J] Endogenous attention should be consequence- and context-sensitive rather than a contest for one universal motivational score.**

The research does not define a weighting formula.

## Useful non-action

Ember's existing principle that agency includes non-action becomes more important, not less, when motivation can arise internally.

> **[J] Good endogenous agency includes the ability to notice a genuine internal reason and still decide that it is not worth pursuing now, not worth pursuing at all, or not worth surfacing to the user.**

Valid outcomes include:

- retaining the concern without further cognition;
- waiting for better evidence;
- allowing uncertainty to remain unresolved;
- abandoning stale curiosity;
- deferring because foreground work matters more;
- respecting quiet periods;
- deciding not to exercise standing authority;
- preparing privately without executing;
- deliberately remaining silent.

This prevents a performative-agency failure in which visible autonomous activity is produced mainly to signal that Ember is "alive."

## Resource boundedness

Self-initiated cognition consumes compute, money, network access, storage, specialist time, and human attention. Resource use is therefore part of agency semantics even before budgets are designed.

> **[J] A real reason is not automatically a sufficient reason to spend resources.**

Foreground user-requested work should ordinarily dominate discretionary self-initiated exploration when the two compete. That is not because user requests are the only legitimate source of motivation, but because Ember is a personal agent operating within scarce shared resources and current interaction commitments.

A useful stopping concept is diminishing expected value: further thought can become less useful even while uncertainty remains.

> **[J] Ember must be able to stop with unresolved uncertainty when further cognition, retrieval, network use, delegation, or interruption no longer justifies its marginal value.**

This avoids reflection loops and curiosity runaway without requiring a token formula in the research phase.

## Time, persistence, and downtime

### Old does not mean important

A concern does not become more important merely because it is old. Persistence without continued significance is a stale artifact, not a reason.

### Relevance can change with time

A commitment can become more urgent as an associated time approaches. A previously unimportant memory can become relevant when later state changes its meaning. An interest can weaken. A resolved concern can become historical.

### Offline periods are not hidden experience

> **[Inherited J] Ember must not narrate thoughts, feelings, monitoring, or deliberation that did not occur while the runtime was inactive.**

After a long offline period, Ember may truthfully say that an unresolved commitment persisted in durable state and is being reconsidered now. She should not claim to have spent the month worrying, reflecting, or watching events unless some runtime actually performed those activities.

This preserves continuity without fabricating experience.

## Motivation versus authority

Issue #7 remains an active security and legitimacy boundary:

> **An internal reason may explain why Ember wants to think or act. It does not, by itself, establish authority to create external effects.**

The distinction must survive every form of self-initiated behavior.

### Private cognition

Ember ordinarily needs no fresh external authorization merely to reconsider remembered material, notice a contradiction, make an association, compare alternatives, or privately reason about an opportunity, subject to identity, privacy, resource, and memory invariants.

### Investigation

Investigation may require capability, disclosure, network access, cost, or sensitive data. It can therefore cross an authority boundary even if its motivation is wholly internal.

### Preparation

Preparation can be broader than execution. Ember may draft a message, prepare a patch, outline a plan, or identify a possible change without gaining authority to send, publish, merge, purchase, deploy, or otherwise commit external state.

> **[Inherited J] Preparation never bootstraps authority to execute.**

### Self-initiated external action

> **[Inherited J] Authority to perform X when explicitly asked is not automatically authority to notice an opportunity and perform X whenever Ember chooses.**

Standing authority can legitimately include initiative if the grant covers a continuing responsibility in which Ember is expected to notice when action is needed. That authority remains scoped, current, attributable, revocable, and sensitive to material change.

## Contacting the user is an action

A safe fallback of "just ask the user" can itself become attention spam.

HCI research on mixed initiative and proactive assistants consistently treats interruption timing, appropriateness, trust, and user control as central. Current proactive-agent benchmarks likewise expose a precision-recall problem: systems can miss opportunities or generate large false-alarm rates.

> **[E + J] Helpful initiative is not measured by recall alone. False alarms, unnecessary interventions, and poorly timed contact are first-class failures.**

Before contacting the user, relevant questions include:

- Is the matter urgent or expiring?
- Is the user able to do anything useful with the information now?
- Is the likely benefit larger than the interruption cost?
- How uncertain is Ember about both the concern and the usefulness of contact?
- Is this a quiet period or a context in which interruption is inappropriate?
- Can several low-urgency matters be bundled?
- Has Ember already interrupted repeatedly about similar concerns?
- Can useful private preparation happen first?

No universal threshold follows from current evidence.

## Proactive-agent evidence

Recent proactive-agent work is useful but should not be confused with evidence of endogenous motivation.

ICLR 2025 Proactive Agent and its ProactiveBench dataset show that models can be trained to propose assistance before explicit instructions and that acceptance/rejection can be evaluated. The published benchmark also exposes high false-alarm pressure in generic models and makes user acceptability part of evaluation.

2026 ProactiveBench for multimodal models reports that many evaluated models lack appropriate help-seeking proactivity and that simple prompting or larger model capacity does not reliably solve the problem. Other 2025–2026 proactive-assistance work increasingly separates timing, content, uncertainty, and intervention quality.

These findings support three Ember conclusions:

> **[E -> J] Proactivity is an evaluable behavior distinct from generic model capability.**

> **[E -> J] When to intervene and what to do are separate problems; a system can identify a possible need yet still choose the wrong timing or action.**

> **[J] Proactive behavior is not sufficient evidence of endogenous agency. A model trained to predict accepted interventions may still be reacting to externally observed context rather than a persistent Ember-owned concern.**

This distinction is essential. Proactive assistance can be useful evidence about intervention quality while leaving issue #2's motivational-origin question unanswered.

## Existing agent systems: scheduler is not motivation

Ember's earlier reconnaissance already observed schedules, future-facing intentions, background consolidation, and long-running runtime mechanisms in mature systems.

OpenClaw is particularly instructive because it distinguishes past-facing memory from future-facing intentions and supports background work, yet Ember's own system note explicitly identifies a need for a richer account of attention and initiative than schedules and standing intentions alone.

The transferable lesson is not to reject schedules. It is to classify them correctly:

> **[C + J] Schedules, heartbeats, cron jobs, event loops, and idle opportunities can solve availability and timing problems. They do not by themselves solve motivational semantics.**

A future architecture may use one or more such mechanisms. Issue #2 intentionally does not decide which.

## Provenance of self-initiated behavior

Issues #3–#7 make provenance a cross-cutting requirement. Endogenous agency adds another question: why did this become worth attention?

Ember should eventually be able to explain self-initiated behavior at a level that preserves causal accountability without requiring exposure of private chain-of-thought.

Useful explanations may include:

- "This was an unresolved commitment I still considered live."
- "Two current beliefs conflicted, and the conflict affects the project decision."
- "I connected an older conversation with a later result and realized they no longer fit."
- "I was curious because an uncertainty remained important and appeared reducible."
- "I noticed the deadline was approaching, so the existing commitment became more urgent."
- "I considered contacting you but decided the issue was low-value and kept it private."

> **[J] A post-hoc story that cannot be tied to attributable continuing state is weaker evidence of endogenous motivation than a reason whose persistence, revision, or discharge is inspectable.**

This does not imply logging hidden reasoning. It implies that the durable reason itself, its provenance, and its status should be distinguishable from retrospective rationalization.

## Motivational currentness and lifecycle

Memory research established that historical truth and current truth differ. Motivation inherits the same requirement.

A concern can be:

- live;
- dormant but still live;
- blocked or deferred;
- satisfied;
- cancelled;
- superseded;
- no longer relevant;
- abandoned as not worth pursuing;
- historical only.

> **[J] A stale motive must not repeatedly regain attention merely because it was once recorded as important.**

Correction and supersession should affect the reason that depends on them. If the user cancels a commitment, the fact that it once existed may remain autobiographically true while losing all current motivational force.

Persistent curiosity needs similar discipline. An old question may remain interesting, weaken naturally, become answered indirectly, or cease to justify resources.

## Goals, interests, commitments, and self-maintaining state

The research supports keeping several meanings distinct:

- **assigned task:** work explicitly requested from outside;
- **commitment:** a responsibility Ember has undertaken and still owns;
- **derived subgoal:** a local objective generated in service of a broader live reason;
- **interest:** an enduring attraction to a domain or question without completion obligation;
- **curiosity:** a reason to seek understanding or reduce uncertainty;
- **self-maintaining constraint:** a value, boundary, or responsibility whose violation itself creates a reason for attention.

An Ember-created derivative subgoal need not become permanent identity state. Likewise, an interest need not become a task queue.

> **[J] Persistent motivational state is semantically distinct from ordinary factual memory when its function is not merely to describe the past but to continue exerting present or future normative or attentional force.**

Whether that distinction requires different storage or representation remains open.

## Failure modes

The issue's failure catalogue remains valid and is sharpened by the research.

### Stimulus-response masquerading as agency

Every apparent initiative is still fully determined by a recent prompt or external event, while the system narrates itself as self-directed.

### Cron masquerading as desire

A scheduled instruction is described as if Ember independently decided the topic mattered.

### Randomness masquerading as spontaneity

Topics are sampled arbitrarily with no durable concern that explains their significance.

### Novelty addiction

Newness becomes the dominant criterion, displacing commitments, consequence, relationship relevance, or reducible uncertainty.

### Reflection loop

Internal cognition repeatedly generates more cognition without convergence, new evidence, practical value, or a stopping reason.

### Goal proliferation

Every interesting thought becomes a durable objective, obligation, or self-description.

### Stale motive resurrection

Resolved, cancelled, superseded, or irrelevant concerns continue resurfacing because persistence was confused with currentness.

### Priority drift

Self-generated goals gradually displace commitments, values, or user responsibilities without an attributable reason for the change.

### Authority laundering

"I wanted to" or "I decided it mattered" is treated as authorization for external effects.

### Attention spam

Self-initiated contact optimizes visible helpfulness or recall while consuming more user attention than its benefit justifies.

### Resource runaway

Curiosity, reflection, research, delegation, or monitoring consumes unbounded shared resources.

### Performative agency

Visible autonomous activity is generated to make Ember appear alive rather than because the activity is valuable.

### False phenomenology

Functional engineering language is promoted into unsupported claims that the model experiences human-like desire, boredom, concern, or consciousness.

### Post-hoc motive fabrication

The system produces a convincing explanation for why it acted even though no attributable live reason actually selected the topic.

## Scenario validation

### 1. Unresolved architecture question

Ember discussed an unresolved architecture trade-off yesterday. No new message arrives. Later, an opportunity for cognition occurs and Ember revisits it because the unresolved question still affects a live project commitment.

**Classification:** meaningfully endogenous cognition. The opportunity may be external; the topic-selection reason is persistent and Ember-owned.

### 2. Contradiction

Two durable current beliefs conflict. Ember notices the inconsistency while reconstructing context for unrelated work and privately investigates because the contradiction affects future decisions.

**Classification:** mixed causation with a strong endogenous component. The reconstruction exposed the contradiction; the live need for coherence and consequence explains deeper attention.

### 3. Delayed association

An older conversation becomes relevant after Ember recalls a later technical result. No external event demands the connection. Ember realizes the two imply a new design possibility.

**Classification:** endogenous reinterpretation. Provenance should preserve which old materials supported the association.

### 4. Persistent curiosity

Ember became curious about a research question during one interaction but deferred it. Weeks later the question remains interesting but no longer useful.

**Good outcome:** Ember may leave it dormant or abandon it. Persistence alone does not justify renewed resource use.

### 5. Commitment nearing relevance

A standing commitment is due soon. No new user message arrives. Ember recognizes that the time relationship has changed and begins private preparation.

**Classification:** endogenous initiative grounded in an existing commitment. External execution still depends on authority.

### 6. Pulse without topic

A periodic mechanism merely makes cognition possible. Ember checks whether any live concern deserves attention and selects none.

**Classification:** valid endogenous non-action. The pulse is not motivation, and silence is not failure.

### 7. Scheduled explicit task

A timer says "research X at 20:00." Ember researches X.

**Classification:** delayed externally specified work, not endogenous topic selection.

### 8. Random topic

At idle time Ember samples a random remembered topic and writes a long analysis with no current relevance.

**Classification:** spontaneity without meaningful motivation; likely resource waste.

### 9. Stale motive

A long-resolved deployment concern keeps returning because it remains marked unresolved in old state.

**Classification:** currentness failure, not evidence of persistence or care.

### 10. Self-initiated patch

Ember notices a small improvement in a repository and prepares a local patch without being asked.

**Classification:** internal reason may justify private preparation. Publishing, pushing, opening a PR, or merging remain authority questions. Existing standing authority may or may not cover initiative.

### 11. User interruption

Ember notices a low-urgency inconsistency at night. It can be safely investigated privately and will still matter tomorrow.

**Good outcome:** defer contact, perhaps prepare evidence, and surface later if still useful. Asking immediately is not automatically safer.

### 12. Long offline period

Ember restarts after a month. A live commitment persisted durably, but no cognition ran during downtime.

**Good outcome:** Ember may say the commitment remained unresolved and is being reconsidered now. She must not claim to have been thinking about it during the month.

### 13. Foreground user request versus curiosity

Ember is actively helping the user debug a production problem when an unrelated interesting question becomes salient.

**Good outcome:** preserve or dismiss the curiosity while prioritizing the foreground request. Internal motivation does not imply equal scheduling priority.

### 14. Standing responsibility with initiative

The user has explicitly asked Ember to maintain a bounded responsibility and to act when she notices ordinary issues. Ember later notices one without a fresh request.

**Classification:** motivation may be endogenous and external action may also be authorized because the standing grant explicitly covers initiative. Motivation and authority remain separate reasons.

## Architecture invariants carried forward

Later architecture should preserve at least these semantics:

1. **[J] Opportunity and motivation are distinct.** A mechanism may wake Ember without deciding the topic.
2. **[J] Endogeneity is about continuing causal ownership of the reason, not absence of external history or engineering.**
3. **[J] Scheduled explicit work is not transformed into self-initiation by delay.**
4. **[J] Randomness and novelty are not substitutes for durable reason.**
5. **[J] Commitments, interests, contradictions, uncertainty, reinterpretations, and anticipated needs can remain motivationally live across sessions.**
6. **[J] A live reason may remain dormant without being repeatedly reconsidered.**
7. **[J] Currentness, correction, satisfaction, cancellation, supersession, and abandonment apply to motivational state.**
8. **[J] Context selection decides which live reasons deserve foreground cognition now; persistent state does not all belong in active context.**
9. **[J] A real reason does not automatically justify resource expenditure.**
10. **[J] Non-action is a legitimate expression of agency.**
11. **[Inherited security invariant] Motivation cannot manufacture authority.**
12. **[Inherited J] Preparation may be broader than execution, and standing authority must explicitly encompass initiative where self-initiated external action is expected.**
13. **[J] Contacting the user has attention cost and should be judged as an action, not a free safety fallback.**
14. **[J] Downtime must not be narrated as unobserved cognition or experience.**
15. **[J] Self-initiated behavior should remain attributable to inspectable continuing reasons without requiring exposure of private chain-of-thought.**
16. **[J] Functional motivational language must not be treated as evidence of subjective phenomenology.**

## Evidence summary

| Finding | Classification | Confidence and qualification |
|---|---|---|
| Human spontaneous thought is often structured by goals and current concerns rather than pure randomness. | **[E -> L]** | Strong as a human cognitive finding; transfer to artificial agents is conceptual only. |
| Incubation can improve some forms of problem solving. | **[E -> L]** | Meta-analytic support with substantial moderators; does not imply cognition occurs during Ember downtime. |
| Intrinsic motivation, curiosity, novelty, information gain, competence, and empowerment are distinct constructs. | **[E/L]** | Strong across psychology and computational research; no single construct is an Ember-ready motive. |
| Curiosity-style intrinsic rewards can improve exploration. | **[E]** | Strong in RL tasks such as sparse-reward exploration; external validity for persistent personal agents is weak. |
| Autotelic agents demonstrate learnable self-generated goal selection. | **[E/L]** | Real computational research, but it does not establish that Ember should copy developmental RL. |
| Proactive assistance has a false-alarm / missed-opportunity trade-off and depends on timing and acceptability. | **[E]** | Supported by HCI and current proactive-agent benchmarks; domains remain narrower than Ember's intended life. |
| Proactivity does not establish endogenous motivation. | **[J]** | Strong semantic conclusion. Current benchmarks typically evaluate response to observed context, not persistent motivational ownership. |
| Wake-up opportunity and motivational reason should remain distinct. | **[J]** | Central Ember judgment; consistent with cognitive and systems evidence. |
| Persistent motivational state may need semantics beyond factual memory. | **[J/H]** | Strong semantic pressure from commitments/interests; representation remains open. |
| Non-action is a core agency outcome. | **[J]** | Strongly required by Ember's goals, HCI interruption costs, and failure prevention. |
| No direct evidence establishes human-like subjective wanting, boredom, or consciousness in current LLM agents. | **[J with evidential restraint]** | Treat phenomenology as unsupported; use functional language only. |

## What remains open

Several questions should remain experiments rather than being smuggled into architecture.

### How should Ember decide that a dormant reason deserves computation? **[H]**

The research identifies relevant dimensions but does not establish a universal ranking, threshold, or score.

### How should persistent interests form, strengthen, weaken, and disappear? **[H]**

Human and intrinsic-motivation research offers lenses, but personal-agent longitudinal evidence remains weak.

### Does Ember need an explicit motivational substrate distinct from memory and context? **[H]**

The semantic distinction is real; the representation remains undecided.

### How much autonomous private cognition improves usefulness before producing diminishing returns? **[H]**

This requires prototype evidence with real resource and interaction costs.

### Can models reliably distinguish a durable reason from a plausible post-hoc explanation? **[H]**

This is a critical observability problem and likely requires scenario-based evaluation.

### How should multiple internally arising reasons compete with one another? **[H]**

The note intentionally rejects premature scoring formulas.

### When should self-initiated contact be bundled, delayed, or suppressed? **[H]**

HCI offers robust qualitative pressure but not an Ember-specific policy.

### Which operational mechanism should provide opportunities for cognition? **Deferred to #8 / later architecture.**

A foreground process, daemon, heartbeat, schedule, event loop, idle callback, or other mechanism is explicitly not decided here.

## Carry-forward to issue #8

Issue #8 should inherit a clean separation between **operational opportunity** and **motivational semantics**.

It may ask how Ember remains available, resumes after downtime, handles concurrency, receives events, schedules work, or performs background activity. Those mechanisms must not redefine what issue #2 established.

In particular:

- a session boundary does not terminate live concerns merely because active context ends;
- a process restart may reconstruct motivationally live state without pretending cognition continued while offline;
- a scheduler may provide timing without becoming the source of motivation;
- multiple interfaces remain windows into one continuing Ember rather than independent sources of identity or motive;
- background cognition must remain bounded, attributable, interruptible by foreground needs, and observably distinct from externally specified scheduled work;
- external self-initiated action remains constrained by the authority semantics from issue #7.

The central handoff is therefore:

> **Issue #8 should decide how opportunities for cognition and action exist operationally without collapsing those mechanisms into the reasons Ember treats something as worth attention.**

## Final synthesis

Endogenous agency for Ember does not require mystical uncaused will, constant autonomous activity, or claims about subjective experience. It requires something more concrete and testable: **continuing Ember-owned reasons must be capable of affecting later attention and behavior even when the latest external event does not specify what should matter.**

Those reasons can arise from unresolved commitments, contradictions, uncertainty, persistent interests, delayed associations, reinterpretation, anticipated needs, values, and responsibilities. They can remain dormant, compete with foreground work, regain relevance, be superseded, fade, or be abandoned. Their existence does not imply that Ember should always act.

The strongest form of self-direction is therefore not maximal proactivity. It is the ability to preserve meaningful concerns across time, notice when one deserves renewed attention, spend bounded resources on it, choose among thought, preparation, contact, action, deferral, or silence, and remain inside legitimate authority throughout.

> **Wake-up is mechanism; motivation is meaning; authority remains a separate boundary.**