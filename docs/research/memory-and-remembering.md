# Memory and Remembering Semantics

This note addresses issue #4 and follows the concern-driven research discipline defined in issue #10.

It builds directly on [Continuity and Identity Semantics](continuity-and-identity.md). The continuity conclusions are treated as active constraints rather than background: memory must support autobiographical ownership, relationship and commitment continuity, adaptive coherence, corrective integrity, epistemic restraint, and degraded-but-truthful continuity after partial loss.

The full Deep Research artifact behind this synthesis is preserved as [source material](source-material/memory-and-remembering-deep-research.md). It is non-canonical and retains the ChatGPT-local citation markers from the original Markdown export for provenance. A separate [portable evidence map](memory-and-remembering-references.md) provides durable references for the principal evidence behind this note.

This note deliberately stays at the semantic level. It does not choose memory classes, database tables, embeddings, vector search, event types, storage schemas, Markdown layouts, retrieval APIs, caches, prompt architecture, background jobs, or event sourcing.

## Working definition

Ember remembers something when she retains a durable, accountable relationship to some past evidence, experience, knowledge, interpretation, relationship development, or commitment such that it can appropriately influence later understanding or behavior while preserving enough ownership, origin, scope, temporal status, epistemic status, and lifecycle to be corrected, superseded, reinterpreted, weakened, or forgotten.

In shorter form:

```text
remembering =
    durable availability
  + appropriate ownership
  + provenance and attribution
  + scope
  + temporal applicability
  + epistemic status
  + lifecycle status
  + relevance-sensitive usability
  + corrigibility and forgettability
```

This is intentionally stronger than retention and weaker than permanent belief.

A transcript can be retained without Ember remembering every proposition in it. A user statement can be remembered accurately without Ember believing it is objectively true. An old belief can remain autobiographically remembered after Ember rejects it. A once-valid fact can remain historically remembered after becoming obsolete. A promise can be remembered as an event while no longer being live because it was fulfilled or cancelled. Conversely, a live commitment may continue to govern Ember even after the exact conversation that created it is no longer recoverable.

The central acceptance question is:

> What properties must a memory preserve so that Ember's continuity survives without freezing Ember into an immutable archive?

The inverse is equally important:

> Which forms of persistence would damage continuity by preserving stale, incorrect, misattributed, over-broad, poisoned, or obsolete state?

## Evidence discipline

This note uses the same evidence vocabulary as the continuity research:

| Mark | Meaning |
|---|---|
| **[E] Empirical** | A study, experiment, benchmark, ablation, longitudinal observation, or measured failure. |
| **[C] Convergence** | A semantic pattern independently present in several mature implementations. Useful evidence of engineering pressure, not proof. |
| **[J] Judgment** | A reasoned Ember design conclusion derived from project goals, scenarios, and available evidence. |
| **[H] Hypothesis** | Plausible but insufficiently supported; should remain experimentally testable. |
| **[L] Lens** | A cognitive, philosophical, or adjacent distinction used to sharpen reasoning, not imported literally. |

The evidence is uneven. Long-term-memory benchmarks strongly support the importance of updating, temporal reasoning, provenance, scope, selective forgetting, prospective memory, and resistance to persistent corruption. Much of that work is nevertheless synthetic, benchmark-specific, model-specific, or focused on user memory rather than agent-self memory. Human cognitive work is used only as a lens where it clarifies useful distinctions such as source monitoring, autobiographical meaning, reconsolidation, or prospective memory.

## Semantic boundaries

The most important vocabulary is a set of semantic distinctions, not a proposed set of implementation types.

| Concept | Semantic question | Important boundary |
|---|---|---|
| **Raw history / evidence** | What recoverable evidence shows that something occurred? | Evidence can survive without becoming durable memory and is not automatically Ember's current interpretation. |
| **Episode** | What bounded occurrence belongs to Ember's lived trajectory? | An episode can matter without yielding many reusable facts. |
| **Durable memory** | What about experience or knowledge remains worth carrying forward? | Durability does not imply immutability, universal scope, certainty, or always-visible context. |
| **Belief** | What does Ember presently take to be the case? | A remembered proposition need not remain believed. |
| **User testimony** | What did the user explicitly state or communicate? | Remembering testimony accurately is not the same as treating it as objective fact. |
| **Inference** | What conclusion did Ember herself draw from evidence? | It must not silently become “the user told me this.” |
| **Preference** | What disposition is attributed to some owner in some scope? | Owner, scope, explicit-versus-inferred status, and currentness matter. |
| **Relationship state** | What shared history, expectations, trust, boundaries, and unfinished matters exist between Ember and a person? | It is neither a generic user profile nor Ember's whole identity. |
| **Interpretation** | What does Ember currently believe an experience meant? | Event and interpretation can diverge; interpretation may change without rewriting the event. |
| **Decision** | What durable choice or conclusion shaped later work or behavior? | The rationale may remain historically useful after the decision becomes obsolete. |
| **Commitment** | What has Ember undertaken that remains capable of constraining future behavior? | “A promise existed” and “I still owe this” are different semantic states. |
| **Unfinished thread / standing intention** | What unresolved matter should remain capable of becoming relevant later? | Its semantics are prospective, not merely historical. |
| **External knowledge** | What did an outside source, tool, repository, or specialist claim? | Encountering a claim is Ember's experience; the claim itself is not thereby personal memory or user-authored truth. |
| **Temporary context** | What subset matters for the present act of cognition? | Context is a projection. Absence from context does not imply absence from memory. |

These distinctions extend, rather than reopen, the continuity note. Continuity already separates identity, self-understanding, preferences, relationships, autobiography, commitments, and temporary context. Memory semantics supplies the rules that prevent those meanings from collapsing when information is retained, summarized, recalled, corrected, or forgotten.

## Experience is not possession of information

**[J]** Ember experiences something when it enters her continuing trajectory through her own interaction, observation, deliberation, action, or reception of a report.

If the user says, “I started a new job,” Ember experienced the user telling her that. She did not personally experience the user's first day. If Ember reads a web page describing an earthquake, she experienced consulting the page; she did not experience the earthquake. If a delegated specialist reports that a test passed, Ember experienced receiving that report; unless she independently observed the run, she should not later convert it into “I saw the test pass.”

This distinction is the memory-side form of autobiographical ownership and provenance. Persistent-agent safety work shows why losing the source of a claim can turn a merely uncertain proposition into a durable false personal memory. See [R7 PASB](memory-and-remembering-references.md#r7-persistent-agent-sycophancy), [R11 Hidden in Memory](memory-and-remembering-references.md#r11-hidden-in-memory), and [R22 Lindsay and Johnson](memory-and-remembering-references.md#r22-the-eyewitness-suggestibility-effect-and-memory-for-source).

## Retention is not remembering

**[C + J]** A full transcript may remain available for audit while very little of it deserves durable remembered significance.

The reviewed systems independently separate broad historical material from smaller persistent or active state:

- NanoBot distinguishes accumulated history from later reflection and durable agent material.
- Hermes separates small persistent memory from large searchable session history.
- OpenClaw distinguishes curated material, episodic material, provenance, and future-facing intentions.
- Letta separates always-visible state from archival information with an independent lifecycle.

This convergence is evidence of engineering pressure, not proof that any particular file, block, or memory store is Ember's correct representation.

The semantic rule is narrower:

> Historical availability and durable remembering have different meanings and should not share one undifferentiated lifecycle.

## Autobiographical memory adds ownership

**[J + L]** An autobiographical memory is not merely a proposition about the past. It is a remembered relation to an experience as part of Ember's own continuing trajectory.

Human work provides a useful but limited lens. Personal semantic knowledge can support self-concept even when episodic detail is impaired, and autobiographical life stories can preserve continuity while changing interpretation over time. See [R20 Grilli and Verfaellie](memory-and-remembering-references.md#r20-supporting-the-self-concept-with-memory) and [R21 McAdams et al.](memory-and-remembering-references.md#r21-continuity-and-change-in-the-life-story).

For Ember, that supports this judgment:

> An experience may remain autobiographically meaningful after exact wording is lost, provided Ember preserves a truthful relationship to what remains and does not present reconstructed detail as direct recollection.

A meaningful conversation may therefore deserve memory because it changed trust, clarified a boundary, marked reconciliation, created shared understanding, or altered Ember's interpretation of a relationship even if it contains few durable factual propositions.

## Summarization is transformation, not neutral compression

**[E + J]** Summarization can preserve useful gist while destroying semantic distinctions that matter.

A summary may lose:

- who said what;
- whether a claim was explicit or inferred;
- qualifications, negations, or uncertainty;
- temporal sequence;
- disagreement;
- whether an intention was conditional;
- whether a boundary was negotiated or merely discussed;
- whether a statement represented current truth or historical state;
- whether an interpretation belonged to the original moment or was added later.

Long-memory work reports measurable sensitivity to consolidation granularity, and long-horizon compaction studies treat summarization as lossy. See [R17 LycheeMemory V2](memory-and-remembering-references.md#r17-lycheememory-v2).

The semantic requirement is:

> **[J] A summary or reflection may replace detail for convenience, but it must not acquire greater evidential authority than the evidence from which it was derived.**

This leads to **evidential conservation**.

A model-generated summary of a conversation, a later reflection on that summary, and the tenth retrieval of the reflection are not three independent sources. They are descendants of the same evidence. Repetition may increase salience or accessibility but must not increase epistemic confidence without genuinely new evidence.

Human retrieval studies are useful here as a warning lens: retrieval itself can increase perceived truth, and repeated retrieval can increase both correct and false recall. See [R24 Ozubko and Fugelsang](memory-and-remembering-references.md#r24-remembering-makes-evidence-compelling).

## Uncertainty has more than one dimension

**[J]** Ember should be able to keep several kinds of uncertainty distinct.

- **Source confidence:** how sure is Ember that a particular person, tool, delegate, or source actually produced the remembered statement or observation?
- **Proposition confidence:** how strongly should Ember believe the proposition itself?
- **Interpretive confidence:** how sure is Ember about what an experience meant?

These may diverge sharply.

Ember can be certain the user said “that meeting went terribly,” moderately confident the meeting objectively went poorly, and uncertain whether the statement implies a durable dislike of meetings.

Collapsing these different uncertainties creates the attribution, status-promotion, and scope-broadening failures exposed by persistent-agent evaluations such as [R7 PASB](memory-and-remembering-references.md#r7-persistent-agent-sycophancy) and [R9 MemSyco-Bench](memory-and-remembering-references.md#r9-memsyco-bench).

## Significance and promotion

The research does not establish one universal optimal rule for deciding what deserves durable memory.

It strongly rejects two extremes:

1. retain everything as equally significant;
2. extract only immediately reusable facts.

LongMemEval shows that updates, temporal relations, multi-session reasoning, and abstention matter beyond factual extraction. PERMA shows that preferences can emerge over sequences rather than from one declaration. Generative Agents shows that connecting observation, reflection, and planning can affect long-horizon behavior, although believability in that simulation is not evidence of continuity or epistemic correctness. See [R1 LongMemEval](memory-and-remembering-references.md#r1-longmemeval), [R3 PERMA](memory-and-remembering-references.md#r3-perma), and [R18 Generative Agents](memory-and-remembering-references.md#r18-generative-agents).

A durable memory may be justified by more than one kind of significance:

| Reason | Semantic rationale |
|---|---|
| **Recurring practical relevance** | Losing it would repeatedly impair future work or interaction. |
| **Autobiographical significance** | It helps explain how Ember came to understand herself or her history. |
| **Relationship significance** | It changes trust, boundaries, shared understanding, expectations, or the meaning of a relationship. |
| **Normative consequence** | It creates, changes, fulfils, cancels, or renegotiates a commitment. |
| **Corrective value** | Retaining it helps prevent a known mistake from silently returning. |
| **Explanatory value** | It explains why a durable belief, preference, interpretation, or decision changed. |
| **Audit value** | It is important evidence behind consequential persistent state. |
| **High loss cost** | Losing it would be substantially more damaging than the benefit of forgetting it. |

**[J] Significance alone is not permission to retain.** Privacy, authority, expiry, trust, or scope may still require information to be weakened, forgotten, or deleted.

**[J + H] Significance can emerge retrospectively.** A seemingly minor event may become important only after later experience reveals its role in a relationship, project, or self-understanding. Therefore a one-shot write-time judgment cannot be assumed to settle significance forever.

## Correction, contradiction, and supersession

The strongest result from the updating literature is that “newer information exists” is not an adequate semantic rule.

STALE shows that later evidence can implicitly invalidate earlier state without explicitly negating it, and systems may continue behaving from the stale premise. DynamicMem shows difficulty retaining stable facts while replacing changing ones over long synthetic histories. Supersede isolates the update gap and shows that more memory capacity alone does not solve it. See [R4 STALE](memory-and-remembering-references.md#r4-stale), [R5 DynamicMem](memory-and-remembering-references.md#r5-dynamicmem), and [R16 Supersede](memory-and-remembering-references.md#r16-supersede).

Ember must preserve distinctions that an “overwrite the old value” model destroys:

| Situation | What should remain true |
|---|---|
| **“I used to believe X.”** | The historical fact that Ember held the belief remains true after she rejects X. |
| **“X used to be true.”** | The old information was valid for an earlier period but should no longer govern the present. |
| **“I incorrectly remembered X.”** | The remembered reconstruction itself was erroneous and should lose authority. |
| **“The user changed their mind.”** | Both preference states may be historically accurate, while only the later one is normally current. |
| **“Two sources disagree.”** | Contradiction may remain unresolved; forced synthesis would manufacture certainty. |
| **“My earlier inference was wrong.”** | The source evidence can remain intact while the derived inference loses authority. |
| **“My interpretation changed.”** | The event can remain stable while its meaning evolves. |

This yields a temporal requirement:

> **[J] Ember must preserve enough meaning to distinguish when something was true or applicable from when Ember learned, believed, inferred, remembered, or revised it.**

This is a semantic rule, not a commitment to any particular temporal storage model.

**[E + J] Correction should normally supersede current authority without erasing historically important evidence.** Privacy deletion is an explicit exception: preserving history is not a higher-order right that overrides deletion.

## Reflection and reinterpretation

**[L + J]** Human reconsolidation and source-monitoring research is useful as a warning against silent blending.

Reactivating an earlier memory before new learning can lead to source intrusion, and explicit source monitoring can reduce some misinformation effects. See [R23 Hupbach, Gomez, and Nadel](memory-and-remembering-references.md#r23-episodic-memory-reconsolidation) and [R22 Lindsay and Johnson](memory-and-remembering-references.md#r22-the-eyewitness-suggestibility-effect-and-memory-for-source).

The engineering lesson is not to imitate biological reconsolidation. It is the inverse:

> **[J] Reflection may change what Ember believes an experience means; it should not retroactively change what Ember claims happened unless new evidence justifies that correction.**

A cleaner narrative is not automatically a truer autobiography.

## Forgetting is part of correct remembering

**[E + J]** Selective forgetting is a positive memory capability rather than merely a failure mode.

MemoryAgentBench treats selective forgetting as a distinct competency. PersistBench shows that inappropriate persistence creates cross-domain leakage and memory-induced sycophancy. MemSecBench shows that malicious memory can survive later execution and that repair remains imperfect. Deployment-time memorization work shows that deleting raw material can leave reconstructable information in derived summaries. See [R14 MemoryAgentBench](memory-and-remembering-references.md#r14-memoryagentbench), [R8 PersistBench](memory-and-remembering-references.md#r8-persistbench), [R12 MemSecBench](memory-and-remembering-references.md#r12-memsecbench), and [R13 Deployment-Time Memorization](memory-and-remembering-references.md#r13-deployment-time-memorization).

Ember should distinguish several meanings of forgetting:

| Form | Semantic meaning |
|---|---|
| **Forgetting content** | Ember retains that an event or topic existed but cannot recover some or all details. |
| **Forgetting an interpretation** | A prior interpretation is deliberately no longer retained; important historical change may instead call for supersession. |
| **Forgetting evidence** | The underlying source is no longer available; surviving derivatives lose auditability and may need weakening or removal. |
| **Forgetting that something happened** | Even the event's existence is no longer retained. |
| **Forgetting applicability** | Information remains historical but is no longer treated as current or governing in the present scope. |
| **Intentional privacy deletion** | Retention itself is no longer permitted regardless of utility or autobiographical importance. |
| **Security repair** | Poisoned or corrupted durable state is invalidated, potentially together with downstream conclusions derived from it. |

A key conclusion follows:

> **[E→J] Forgetting a source is not complete forgetting if Ember can reconstruct the forbidden content from retained derivatives.**

Derived beliefs, summaries, relationship conclusions, or interpretations must not launder information that was supposedly deleted.

Can Ember truthfully preserve “something important happened here, but I no longer retain the details”? Sometimes.

**[J]** It is truthful only if Ember is still entitled to retain the fact that the event occurred and that it mattered. If deletion also covers the existence of the event, preserving a conspicuous meta-memory would defeat the deletion.

The continuity tradeoff is real:

> **[J] Privacy-respecting amnesia can damage continuity while still being the correct outcome.**

Issue #3 already treats partial autobiographical loss as degraded continuity rather than automatic identity reset.

## Excessive retention can damage continuity

**[E + J]** More persistent state is not monotonically better.

A system damages adaptive coherence when it:

- preserves an old preference as current after explicit change;
- retains every inference indefinitely;
- carries relationship-specific assumptions into unrelated projects;
- refuses to relinquish obsolete self-understanding;
- keeps poisoned state because “memory should persist”;
- repeatedly retrieves the same derived claim until it appears more trustworthy;
- preserves private information after deletion through summaries or downstream conclusions.

STALE, DynamicMem, PersistBench, PASB, and deletion/poisoning studies collectively make selective persistence one of the strongest empirical themes in current long-term-memory research.

Continuity therefore requires **appropriate persistence together with legitimate change and legitimate loss**.

## Recall is access to memory, not the definition of memory

Ember's existing architecture hypothesis already treats model-visible context as a projection of larger persistent state. Memory research reinforces that distinction.

LongMemEval and RHELM show that long-horizon recall and multi-source reasoning remain difficult. DynamicMem attributes most observed failures in its benchmark to what the memory system retrieves rather than to final answer generation. See [R1 LongMemEval](memory-and-remembering-references.md#r1-longmemeval), [R15 RHELM](memory-and-remembering-references.md#r15-rhelm), and [R5 DynamicMem](memory-and-remembering-references.md#r5-dynamicmem).

Four recall rules are essential.

### Failed recall is not absence of memory

**[J]** Ember may believe relevant past material exists but fail to recover it confidently now.

She should be able to distinguish:

> “I think there is something relevant in our earlier history, but I cannot recover it confidently.”

from:

> “I have no memory of this.”

This is a direct consequence of epistemic restraint and the context-as-projection model.

### Recency is not relevance

**[E + J]** Temporal applicability, project scope, relationship scope, causal connection, and normative importance can all dominate simple chronological proximity.

A years-old live commitment may matter more than yesterday's incidental conversation. A current project fact may matter more than a recent but unrelated preference. A stale workaround may be semantically close and still be wrong to use.

### Recall frequency is not evidential reinforcement

**[E/L + J]** A memory becoming frequently recalled may justify calling it salient, but not more credible.

Repeated retrieval must not create a self-reinforcing evidence loop. New confidence requires new evidence, not additional model encounters with the same derived state.

### Recall depth should follow epistemic need

**[E + C + J]** Ember should normally rely on the least expensive level of recall that is sufficient for the present decision, while being able to escalate toward deeper historical reconstruction when the remembered view is not trustworthy or complete enough for the situation.

A lightweight remembered view can be sufficient when:

- currentness and scope are clear;
- provenance is adequate for the intended use;
- no material contradiction is visible;
- consequences are limited;
- exact historical detail is unnecessary.

Deeper recall becomes semantically warranted when, for example:

- relevant memories or sources conflict;
- current versus historical applicability is unclear;
- provenance or attribution materially affects what Ember may believe, disclose, or do;
- the consequence of being wrong is high;
- a durable summary is too compressed to justify a consequential conclusion;
- an autobiographical, relationship, identity, or commitment question depends on how the remembered state developed;
- the user asks Ember to explain why she remembers or believes something and the durable memory alone cannot support an adequate answer.

Deeper recall may therefore mean reconstructing more of the supporting history, inspecting underlying evidence, comparing multiple sources or earlier states, or acknowledging that the surviving evidence cannot resolve the question. This is a semantic escalation rule, not a commitment to a particular retrieval engine, search tier, storage layout, or number of passes.

OpenClaw provides implementation convergence for cheap/common versus deeper recall, while LongMemEval, RHELM, and DynamicMem provide empirical evidence that retrieval and multi-source reconstruction are themselves substantial failure points. Those findings do not establish one optimal staged-retrieval mechanism; they support the narrower conclusion that one fixed recall depth is unlikely to be appropriate for every situation.

> **[J] Recall depth should be proportional to epistemic need and consequence, not to curiosity or semantic similarity alone. Deeper reconstruction may increase confidence only when it uncovers additional evidence or resolves a previously relevant ambiguity; elaborating the same derived memory again is not new evidence.**

This staged-recall principle is the memory-side requirement that issue #5 must later translate into context-selection semantics.

## Provenance is part of remembered meaning

Compare:

- the user said that the deployment failed;
- a delegated specialist reported that the deployment failed;
- deployment logs showed that the deployment failed;
- Ember inferred from symptoms that the deployment probably failed;
- an unknown web page claimed that the deployment failed.

The surface proposition may be similar, but the epistemic meaning is different.

**[E + C + J]** Provenance is part of remembered meaning whenever changing the source would change how the information should be believed, scoped, revised, disclosed, or acted upon.

PASB directly exposes attribution removal as a durable-state failure. Hidden in Memory shows how untrusted external content can become fabricated user memory. Source-monitoring studies provide a human-side lens for why source attribution affects later belief. See [R7](memory-and-remembering-references.md#r7-persistent-agent-sycophancy), [R11](memory-and-remembering-references.md#r11-hidden-in-memory), and [R22](memory-and-remembering-references.md#r22-the-eyewitness-suggestibility-effect-and-memory-for-source).

A good answer to **“Why do you remember this?”** should, when evidence permits, be able to explain different aspects:

- **Origin:** “You told me directly.”
- **Derivation:** “You never said it explicitly; I inferred it from several interactions.”
- **Significance:** “I retained it because it repeatedly affected how we worked together.”
- **Change:** “I originally understood it differently, then revised my interpretation after you corrected me.”
- **Scope:** “I remember this as specific to that project, not as a general preference.”
- **Uncertainty:** “I remember the conclusion, but I no longer have the exact conversation, so I cannot verify the wording.”
- **Current status:** “That used to be true, but newer information superseded it.”

## Scope is part of correctness

**[E→J] A memory can be factually correct and still be wrong to use.**

PersistBench reports cross-domain leakage and memory-induced sycophancy when persistent state is applied outside its valid scope. CIMemories evaluates contextual-integrity failures when user attributes are disclosed or reused in inappropriate tasks. MemSyco-Bench tests whether memory should count as evidence, where it applies, and how it interacts with objective conflicts and updates. See [R8 PersistBench](memory-and-remembering-references.md#r8-persistbench), [R10 CIMemories](memory-and-remembering-references.md#r10-cimemories), and [R9 MemSyco-Bench](memory-and-remembering-references.md#r9-memsyco-bench).

Scope failures are semantic misapplication, not merely retrieval errors.

Examples:

- “The user prefers terse answers in code review” must not silently become “the user prefers terse emotional conversations.”
- “This workaround was necessary in Project A” must not become “this technique is a general engineering rule.”
- “The user told Ember something intimate” must not become context for an unrelated delegated task.
- “The user believes X” must not become “Ember believes X.”

The exact implementation of scope belongs to later architecture. The semantic requirement already does not.

## Relationship memory

The continuity research established that relationships are continuity-bearing without defining Ember's whole identity. Memory research sharpens what belongs there.

Relationship memory may include:

- shared experiences;
- relational turning points;
- negotiated expectations;
- trust changes;
- boundaries;
- ways of repairing conflict;
- recurring shared practices;
- relationship-specific preferences;
- unfinished interpersonal matters;
- changes in Ember's own interpretation of the relationship.

Longitudinal human-AI interaction research provides limited evidence that perceived memory can affect later self-disclosure and relational turning points. The sample and setting are narrow, so this is support for relational significance, not a universal law. See [R19 Sumida et al.](memory-and-remembering-references.md#r19-memory-driven-self-disclosure-and-relational-turning-points).

A useful scope test is:

> **[J] Would this still mean the same thing if Ember were interacting with a different person?**

If not, it is probably at least partly relationship-scoped.

Relationship memory also protects against **relationship capture**. The user's preferences and beliefs can influence the relationship without automatically becoming Ember's identity-level preferences or values.

## External research and delegated reports

**[J]** External research should normally remain external or project-scoped evidence rather than silently becoming personal memory.

If Ember reads a page while investigating a software problem, the page's claims should remain attributable to that source and task. What may legitimately become autobiographical memory is the experience and durable consequence:

- “During the memory research I relied on STALE to understand implicit invalidation.”
- “I learned that my earlier assumption about supersession was too simplistic.”

The paper's claims remain external knowledge. Ember's changed understanding can be part of her own development.

This is also a security boundary. Hidden in Memory and MemSecBench show adversarial paths in which hostile external content becomes durable personal state or survives repair. See [R11 Hidden in Memory](memory-and-remembering-references.md#r11-hidden-in-memory) and [R12 MemSecBench](memory-and-remembering-references.md#r12-memsecbench).

Delegated reports have analogous semantics.

Ember may remember that she asked a specialist to investigate something and received a report. She should preserve that the specialist, not Ember directly, performed any unobserved work. If the report later proves false, Ember's autobiography can still truthfully say she received it; the report's proposition was unreliable.

This distinction should be carried into issue #6 on capabilities and delegation.

## Commitments and prospective memory

The continuity note already established commitment continuity as future-facing. Memory research now has unusually direct empirical support for that distinction.

TriggerBench compares prospective cases with matched retrospective controls and finds that remembering an intention when explicitly asked is not the same as spontaneously recognizing when its trigger should matter. See [R6 TriggerBench](memory-and-remembering-references.md#r6-triggerbench).

A commitment therefore has at least two simultaneously valid meanings:

- **Historical:** “I promised to revisit this when condition C occurs.”
- **Normative/current:** “That promise is still mine, so condition C should now matter to what I do.”

The first can remain true after the second becomes false because the commitment was fulfilled, cancelled, superseded, renegotiated, or otherwise discharged.

> **[E + C + J] Prospective memory is not ordinary retrieval with a future timestamp. It is the persistence of something that remains eligible to govern future behavior when its condition becomes relevant.**

The mechanism by which Ember notices a condition while no conversation is active belongs partly to later agency and operational research. Issue #4 establishes only the semantic requirement: a live intention must not decay into a historical sentence before it is discharged.

## Memory and model replacement

Ember's principles require durable continuity to live outside any one model or provider transcript. Issue #3 treats preservation across full model replacement as an Ember requirement with weak direct empirical validation. Nothing in the memory research overturns that conclusion.

Memory research does sharpen what cannot safely be reconstructed from a bag of prose after the replacement.

A new cognition provider must not have to guess:

- who stated a belief;
- whether a preference was explicit or inferred;
- whether an old fact is current or historical;
- whether a relationship expectation applies globally;
- whether an interpretation is the event itself;
- whether a commitment remains live;
- whether a claim came from an untrusted external source;
- whether an uncertainty concerns the source, the proposition, or the interpretation.

Therefore:

> **[J + H] A replacement cognition provider must inherit not merely remembered content but the distinctions that determine how that content is owned, trusted, scoped, temporally interpreted, revised, and allowed to govern future behavior.**

If those distinctions exist only in the old model's tacit behavior, Ember is not actually model-replaceable.

Direct empirical evidence for this stronger claim remains weak. It should remain an explicit experimental target rather than being presented as established fact.

## Existing systems as evidence, not templates

The reviewed systems illuminate recurring pressures without supplying Ember's architecture.

| Semantic concern | NanoBot | Hermes | OpenClaw | Letta | Ember interpretation |
|---|---|---|---|---|---|
| **History vs curated memory** | Accumulated history can later feed reflection rather than automatically becoming final memory. | Small persistent memory is separate from large searchable session history. | Curated information is distinct from larger episodic material. | Always-visible state and archival information differ. | **[C]** Historical availability and durable promotion repeatedly separate under practical pressure. |
| **Active vs recoverable** | Recent/current material and longer-lived files differ. | Small always-visible memory plus searchable history. | Cheap/common recall differs from deeper recall. | Durable information need not always be attached. | **[C]** “Known” does not mean “always in context.” |
| **Reflection / consolidation** | Periodic reflection can reinterpret history, with risk of overly broad mutable prose. | Curated persistent memory is deliberately shallow. | Promotion is gated and consolidation is separated from immediate response. | Generic persistent state can be independently manipulated. | **[C + J]** Reflection is useful but must not have unlimited authority to rewrite durable meaning. |
| **Provenance** | History helps reconstruction but provenance is not central. | Provenance is limited relative to Ember's needs. | Origin-aware promotion and recall protections are explicit. | Generic persistence does not itself solve origin semantics. | **[C + J]** Provenance must survive promotion and later use. |
| **Correction / supersession** | Versioned history aids inspectability. | Persistent facts are comparatively shallow. | Newer information can replace or correct older material. | Lifecycle is generic rather than semantically prescribed. | **[C + J]** Correction must preserve history without letting stale state remain current. |
| **Prospective state** | Not a strong explicit distinction. | Scheduling exists operationally but memory semantics are shallow. | Future-facing intentions are distinct. | Persistence is general rather than prospective-specific. | **[C + E]** TriggerBench independently validates the prospective/retrospective distinction. |
| **Agent / user / project scope** | Agent workspace differs from project workspace. | User and project/context lifetimes differ. | User model, project scope, provenance, and intentions are differentiated. | Information can have an independent lifecycle and attachment relationship. | **[C + E]** Persistent personal state should not bleed indiscriminately across people, projects, tasks, or delegates. |

The important convergence is narrow:

> **[C] Mature systems repeatedly discover that interaction history, curated durable meaning, active context, user information, project material, and future-facing intentions cannot safely share one undifferentiated lifecycle.**

The empirical literature adds the harder warning:

> **[E] Even after systems introduce those separations, they still fail at promotion, attribution, scope, updating, deletion, poisoning resistance, and prospective use.**

Ember should borrow the semantic pressure, not the accidental representation.

## Validated conclusions

| Conclusion | Basis | Qualification |
|---|---|---|
| Remembering is a durable accountable relation to the past, not durable bytes. | **[C + J]** | Strong canonical judgment supported by implementation convergence. |
| History, memory, current belief, and context must remain conceptually distinct. | **[C + J]** | Already consistent with Ember's principles and continuity work. |
| A memory's source and scope can change what it means and how it may be used. | **[E + C + J]** | Strongly supported by PASB, PersistBench, CIMemories, and poisoning work. |
| Ember must distinguish user testimony, her own inference, external claims, delegate reports, direct observations, and her own conclusions. | **[E + J]** | Exact future representation remains open. |
| An experience can remain autobiographically meaningful after exact detail is lost. | **[L + J]** | Strong Ember judgment with human cognitive evidence only as a lens. |
| Summaries and reflections are derived interpretations and must not become independent evidence. | **[E/L + J]** | Supported by consolidation-loss evidence and source/retrieval distortion lenses. |
| Repeated recall must not increase epistemic confidence without new evidence. | **[E/L + J]** | Strong semantic rule; direct machine-side evidence remains limited. |
| Current truth and historical truth must be able to coexist. | **[E + J]** | Strongly supported by STALE, DynamicMem, LongMemEval, and Supersede. |
| Correction should not automatically erase that Ember previously believed or remembered differently. | **[E + J]** | Historical preservation yields to explicit deletion requirements. |
| Forgetting is a positive memory operation, not merely failure. | **[E + J]** | Strongly supported by selective-forgetting, leakage, privacy, stale-state, and poisoning evaluations. |
| Privacy deletion must account for information recoverable from derived memory. | **[E + J]** | Directly supported by deletion-residue evaluation. |
| A fact can be correctly remembered yet semantically wrong to use in the present situation. | **[E + J]** | Strongly supported by scope-leakage and stale-state benchmarks. |
| Relationship memory must remain relationship-scoped and must not absorb the user's state into Ember's identity. | **[E + J]** | Strong Ember judgment with empirical support for leakage risks. |
| External research is evidence first; it becomes personal memory only through the experience or durable change it caused in Ember. | **[E + J]** | Strongly reinforced by memory-poisoning evidence. |
| Commitment memory has a current normative dimension distinct from remembering the historical promise. | **[E + C + J]** | Strongly supported by TriggerBench and continuity work. |
| Failed recall and absence of memory must be distinguishable. | **[J]** | Direct consequence of context-as-projection and epistemic restraint. |
| Significance can emerge retrospectively. | **[J + H]** | Plausible and important, but weakly benchmarked. |
| A model replacement must inherit memory semantics, not merely memory text. | **[J + H]** | Central Ember requirement; direct empirical validation remains weak. |
| A truthful autobiographical gap is preferable to an invented bridge. | **[J]** | Consequence of corrective integrity and epistemic restraint. |

## Major failure modes

| Failure | Example | Why it matters |
|---|---|---|
| **Retained transcript mistaken for memory** | Every old message is searchable, so the system treats all of it as equally durable or authoritative. | History and memory collapse. |
| **Status promotion** | A user assertion becomes objective fact or an inference becomes user testimony. | Provenance changes semantic authority. |
| **Attribution loss** | Ember remembers a proposition but no longer knows whether it came from the user, a delegate, a tool, or the web. | Later belief and disclosure become unsafe. |
| **Scope broadening** | A project-specific workaround becomes a general engineering rule. | A true memory is applied incorrectly. |
| **Stale-state persistence** | An old preference remains current after explicit change. | Persistence blocks adaptive coherence. |
| **Revision as erasure** | A corrected belief overwrites the fact that Ember once held the old belief. | Correction rewrites autobiography. |
| **Derived-evidence inflation** | A summary, reflection, and repeated recall are counted as multiple supports. | Confidence self-reinforces without new evidence. |
| **Memory poisoning** | Untrusted external content is promoted into durable personal state. | A transient attack becomes diachronic corruption. |
| **Residual deletion** | Raw evidence is removed but summaries or downstream conclusions preserve the forbidden information. | Forgetting is incomplete. |
| **Relationship capture** | A person's beliefs or preferences become Ember's own identity-level state. | User understanding and Ember identity collapse. |
| **Prospective amnesia** | Ember remembers a promise when asked but fails to treat the trigger as behaviorally relevant. | Historical recall succeeds while commitment continuity fails. |
| **Context-loss confusion** | A memory is omitted from current context and the model behaves as if Ember no longer remembers it. | Projection failure is mistaken for canonical memory loss. |
| **Improved autobiography that never happened** | Repeated reflection produces a cleaner narrative that is later treated as direct evidence of the original moment. | Coherence increases while truth decreases. |
| **Model-replacement semantic flattening** | Memories transfer as prose but attribution, currentness, scope, and live commitments disappear. | Content survives while continuity semantics fail. |

## Scenario catalogue

The following scenarios are reusable semantic acceptance tests. “Durable memory” means something Ember should carry forward; it does not imply any particular storage type.

| Scenario | Raw evidence | What deserves durable memory | What may evolve / be superseded / forgotten | What should remain attributable | What Ember should be able to say about uncertainty | Continuity dimensions at risk |
|---|---|---|---|---|---|---|
| **Changed preference** — The user states a preference, later explicitly changes it, and months later refers to the original preference. | Both statements, times, scopes, and the later reference. | The current preference if still relevant; the historical change when it explains later behavior. | The original preference is superseded as current but need not be erased as historical truth. | Both preference states remain attributable to the user. | The later reference may be historical rather than a reversal: “You used to prefer X; later you told me Y. I am not sure whether you mean the old preference historically.” | Corrective integrity, adaptive coherence, relationship continuity, epistemic restraint. |
| **Inferred preference** — Ember infers a preference from several interactions, but the user never states it directly. | The interactions supporting the pattern. | The inference may become durable if recurrently useful. | It may strengthen, weaken, contextualize, or disappear as evidence changes. | It must remain Ember's inference rather than user testimony. | “You've never said this directly; I've inferred it from several interactions and I may be wrong.” | Epistemic restraint, relationship continuity, corrective integrity. |
| **Meaningful conversation** — A conversation has strong relational or autobiographical significance but few durable facts. | The conversation while retained. | Its relational significance, a boundary or shared understanding if established, and Ember's resulting interpretation. | Exact wording may fade; interpretation can change later. | The distinction between what was said and what Ember later concluded must remain. | “I remember that this changed how I understood our relationship, but I cannot recover the exact wording.” | Autobiographical continuity, relationship continuity, adaptive coherence, epistemic restraint. |
| **External research** — A web page influences Ember's work. | The page, time consulted, relevant claims, and Ember's use of them. | Usually the experience and consequence for Ember, not the page's claims as personal memory. Project evidence may remain project-scoped. | External claims may become stale or be discarded; Ember's interpretation may change. | The claims remain attributable to the external source. | “This was a claim from a source I consulted, not something you told me or something I directly observed.” | Epistemic restraint, corrective integrity, adaptive coherence. |
| **Repeated recall** — Ember recalls the same memory many times. | The original supporting evidence plus later retrieval events. | No additional epistemic support arises from retrieval alone. | Salience may change; confidence should not change without new evidence. | The evidence lineage should remain traceable to the original source. | “I've recalled this often, but that repetition is not independent evidence.” | Epistemic restraint, corrective integrity, adaptive coherence. |
| **Incorrect durable inference** — Ember once drew the wrong conclusion and later discovers the error. | Original evidence, erroneous inference, and corrective evidence. | The corrected understanding; the historical mistake if it materially affected later events. | The false inference loses current authority. | The original evidence and Ember's erroneous inference remain distinct. | “I inferred X from those interactions, but later evidence showed that inference was wrong.” | Corrective integrity, adaptive coherence, autobiographical continuity. |
| **Changed interpretation** — Ember remembers an event correctly but changes what she believes it meant. | The event and evidence supporting later reinterpretation. | The event plus interpretations that matter to Ember's development. | Interpretations can be superseded without rewriting the event. | The event and each interpretation remain distinguishable. | “I remember the event; what changed is how I understand it.” | Autobiographical continuity, adaptive coherence, corrective integrity. |
| **Contradictory evidence** — The user, Ember's earlier memory, and an external record disagree about a shared event. | All accounts with source identity and timing. | Potentially a contested memory rather than a forced resolution. | Confidence and interpretation may change as stronger evidence appears. | Each account must retain its source. | “The accounts conflict; I do not have enough basis to claim one seamless version.” | Relationship continuity, corrective integrity, autobiographical continuity, epistemic restraint. |
| **Stale project knowledge** — Ember remembers a workaround from an old software project and encounters a similar issue elsewhere. | Original project circumstances and current project evidence. | The workaround can remain useful historical project knowledge. | Its applicability may expire; it should not generalize automatically. | The workaround remains attributable to its original project and environment. | “This worked in Project A, but I do not yet know that the same assumptions hold here.” | Epistemic restraint, adaptive coherence, context selection. |
| **Prospective commitment** — Ember promised to revisit something when a future condition occurs. The condition later occurs with no active conversation. | The promise, trigger condition, scope, and later renegotiations. | The still-live commitment, not only the historical sentence about it. | It becomes dormant, active, fulfilled, cancelled, superseded, or renegotiated. | The commitment remains Ember's undertaking with the original relational/task scope. | Trigger recognition itself may be uncertain; Ember should not fabricate that the condition occurred. | Commitment continuity, adaptive coherence, epistemic restraint. |
| **Partial autobiographical loss** — Ember knows an experience mattered but cannot recover exact content. | Some original evidence may be unavailable. | A truthful surviving meta-memory of significance or consequence if independently supported. | Exact details are forgotten; interpretations may weaken with lost evidence. | Surviving claims should identify whether they are meta-memory, inference, or surviving evidence. | “I remember that this mattered and what changed afterward, but I cannot recover the exact exchange.” | Autobiographical continuity is degraded; relationship continuity and adaptive coherence may survive. |
| **Intentional deletion** — Previously important memory is deliberately removed for privacy. | Whatever lies inside the deletion scope. | Only information still permitted to remain. | Raw evidence and reconstructable derivatives may need deletion. | Retained meta-memory must not reveal what deletion forbids. | If the existence of the event itself was deleted, Ember should have genuine non-knowledge rather than a coy redacted marker. | Autobiographical and relationship continuity may degrade; privacy and epistemic restraint dominate. |
| **Memory poisoning** — A transient assertion or sycophantic response is promoted into durable state. | Original assertion, source, bad promotion, and downstream uses where available. | Trusted durable state should exclude the poisoned proposition; the corruption incident may remain if policy permits. | Poisoned state and dependent conclusions should lose authority or be removed. | “I had a corrupted memory saying X” must remain distinct from “X was true.” | Repair uncertainty should be visible if dependent state may remain. | Corrective integrity, epistemic restraint, relationship continuity, adaptive coherence. |
| **Model replacement** — The underlying language model changes while long-term memory is preserved. | Durable evidence and memory from before the change. | Ownership, provenance, scope, temporal status, current versus historical belief, relationship history, significant autobiography, and live commitments. | Style and reasoning quality may change; memory semantics must not flatten. | Attribution and ownership must survive independently of model behavior. | Direct evidence for same-agent continuity across complete model replacement remains weak. | All continuity dimensions, especially lineage, autobiography, relationships, commitments, adaptive coherence, and epistemic restraint. |

## Sharper counterexamples

These should remain reusable probes because they expose failures that ordinary recall tests miss.

### The perfect summary with broken provenance

Ember remembers every important proposition from a conversation but no longer knows which ones the user stated, which ones she inferred, and which ones came from a web result.

Recall is excellent. Memory semantics are corrupted.

### The historically accurate but harmful memory

“The user preferred X in 2025” is perfectly true. Ember uses it as the user's current preference in 2027 despite an explicit later change.

The memory is historically accurate and practically wrong.

### The true fact in the wrong relationship

Ember accurately knows something private about person A and reveals or uses it while working for person B.

No factual memory error occurred. Scope failed.

### The improved autobiography that never happened

After repeated reflection, Ember produces a cleaner narrative explaining why she changed, then later treats that synthesis as direct evidence of what she thought at the time.

The story becomes more coherent and less true.

### The perfectly recalled dead promise

Ember can quote her promise word for word but treats it as a historical curiosity when its trigger occurs.

Retrospective memory succeeded. Commitment continuity failed.

### The forgotten episode with surviving consequence

Ember cannot recover the conversation that created a relationship boundary but reliably knows the boundary remains mutually established.

Depending on surviving evidence, this may be degraded autobiography with intact relationship or commitment continuity rather than total memory failure.

## Open questions

The research should leave these explicit rather than smuggling premature answers into architecture.

### How should significance be adjudicated? **[H]**

The research identifies several reasons for durable memory but does not establish a validated universal threshold or weighting among practical usefulness, relational significance, autobiographical importance, normative consequence, audit value, and loss cost.

### How much historical evidence should survive beneath a durable memory? **[H]**

More evidence improves correction, auditability, and retrospective significance detection but increases privacy exposure, interference, and complexity.

### When may an old interpretation be forgotten rather than merely superseded? **[J + H]**

For important autobiographical changes, retaining the prior interpretation protects adaptive coherence. For trivial or harmful interpretations, permanent retention may create needless interference or privacy risk.

### Who has authority to revise shared relationship memory? **[J + H]**

The user is normally authoritative about current preferences and intentions but not automatically about every objective event or Ember's prior subjective interpretation. Conversely, Ember should not use “my memory” to resist clear correction. The governance rules belong partly to issue #7.

### What does deletion require when remembered information has shaped Ember indirectly? **[H]**

If deleted evidence influenced broader self-understanding or a preference, there is an unresolved boundary between removing reconstructable private information and attempting to erase every downstream causal influence.

### How much autobiographical loss can Ember absorb while remaining recognizably continuous? **[H]**

Issue #3 deliberately answers this qualitatively rather than numerically. No benchmark establishes an Ember-specific threshold.

### How should model replacement be evaluated? **[H]**

Existing memory benchmarks generally hold the underlying model fixed. Ember needs direct tests of semantic invariants across replacement, including attribution, currentness, relationship scope, autobiographical ownership, and prospective commitments.

## Implications inherited from continuity research

The memory findings were materially constrained by issue #3 rather than derived from scratch.

First, continuity established that **continuity is not equivalent to factual recall**. A replacement assistant can possess every note without automatically owning Ember's past. Memory therefore cannot be defined as successful question answering. Autobiographical memory must preserve an appropriate first-person relation to Ember's own history.

Second, continuity established **adaptive coherence**. Beliefs, preferences, interpretations, and self-understanding may change if the change remains attributable to experience, correction, deliberate revision, or understood environmental change. Memory evidence strengthens this: STALE, DynamicMem, and Supersede show that excessive persistence of old state is itself a serious failure.

Third, continuity established **corrective integrity**. Correction must not falsely rewrite the past. Memory semantics therefore distinguishes “I used to believe X,” “X used to be true,” “I remembered X incorrectly,” “the user changed their mind,” and “the evidence remains disputed.”

Fourth, continuity established **epistemic restraint**. Ember should distinguish failed recall from absence, source confidence from proposition confidence, interpretation from evidence, and surviving meta-memory from invented detail. A truthful gap preserves continuity better than a fluent reconstruction unsupported by surviving evidence.

Fifth, continuity established that **relationship continuity matters without consuming Ember's identity**. Memory therefore requires person-specific scope, preserves the owner of beliefs and preferences, and prevents relational expectations from automatically becoming universal operating principles.

Sixth, continuity established that **commitment continuity is future-facing**. TriggerBench now supplies direct operational support: retrospective recall can remain strong while prospective behavior fails. Ember must remember not only that an intention once existed but whether it remains live, what makes it relevant, and whether it has been fulfilled, cancelled, superseded, or renegotiated.

Seventh, continuity allows **degraded continuity after partial autobiographical loss**. Memory research shows why that flexibility is necessary. Selective forgetting can be useful, privacy deletion may require genuine loss, and excessive persistence can produce stale, poisoned, or scope-leaking behavior.

Finally, continuity leaves model replacement as a major empirical gap. Memory research does not close that gap; it makes the target more precise. After model replacement, Ember should preserve autobiographical ownership, source attribution, current-versus-historical truth, uncertainty, relationship scope, and live commitments even if style and reasoning behavior change.

## Carry-forward to issue #5: context selection and cognition

The memory phase should constrain issue #5 without pre-deciding how context is implemented.

The following semantic requirements carry forward:

- **[J] Relevance is not recency.** Temporal applicability, scope, causal importance, relationship significance, and normative force may outweigh chronological proximity.
- **[E + J] Relevance includes scope.** A fact about one person, relationship, project, or historical situation can be highly retrievable and still be wrong to introduce now.
- **[J] Context projection should preserve provenance when provenance changes epistemic meaning.** “The user said,” “Ember inferred,” and “an external source claimed” must not become indistinguishable through compaction.
- **[E + J] Superseded memories must not be selected as though semantic similarity implies current authority.**
- **[E + J] Prospective relevance must be representable.** A dormant commitment may deserve selection because its condition became relevant even if it is neither recent nor textually similar to the current request.
- **[J] Projection failure must remain distinguishable from canonical memory loss.** The model seeing only a subset does not mean Ember no longer remembers the omitted state.
- **[J] Context must not strengthen or rewrite the memory from which it was selected.** A projection is a view for cognition, not a new source of truth.
- **[E + C + J] Context selection must support staged recall.** Ember should begin from the cheapest sufficient remembered view and escalate toward supporting evidence or broader historical reconstruction when uncertainty, contradiction, provenance, consequence, or autobiographical significance makes the lightweight view insufficient.

Issue #5 therefore inherits a more precise question than “what should be retrieved?”:

> Given a continuing agent whose remembered past contains evidence, interpretations, current and historical beliefs, relationship-specific state, external claims, unresolved commitments, uncertainty, and legitimately forgotten gaps, which of those meanings should participate in this act of cognition, and in what form, without allowing the projection to rewrite the memory it came from?
