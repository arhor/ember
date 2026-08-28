# Ember Research Report: Memory and Remembering Semantics

## Research frame and executive synthesis

Issue #4 asks a semantic question before a storage question: Ember needs a coherent account of how lived interaction becomes durable remembering without collapsing transcripts, summaries, retrieved text, beliefs, inferences, and current context into one bucket. It explicitly requires attention to provenance, contradiction, correction, supersession, forgetting, recall, relationship scope, and the question “Why do you remember this?”, while deferring databases, embeddings, schemas, and memory object types. fileciteturn1file0L3-L6 fileciteturn1file0L36-L70 fileciteturn1file0L71-L95 Issue #10 further requires concern-driven rather than product-driven research, first-class use of empirical literature, explicit evidence-strength distinctions, semantics before representation, and natural-language scenarios as validation probes. fileciteturn2file0L3-L6 fileciteturn2file0L101-L124

That framing is already embedded in Ember's vision and principles. Ember is meant to own continuity outside individual calls and models, remember facts, experiences, decisions, preferences, and unfinished threads, distinguish evidence from inference and external information, and remain inspectable and correctable. The project explicitly rejects equating memory with arbitrary retrieved fragments. fileciteturn7file0L2-L35 Its principles already establish the critical three-way boundary: **history is what happened, memory is what remains useful to know, and context is what is relevant now**; they also state that provenance should travel with durable information and that models should not become the source of truth for persistent semantics. fileciteturn8file0L51-L80

The completed continuity research is an active constraint, not background. It defines continuity as a legitimate persistent lineage with constitutive stability, owned history, carried-forward relationships and commitments, and coherent capacity for change. It also concludes that autobiographical continuity is not perfect event retention; self-understanding must be corrigible; relationship continuity matters without defining the whole agent; user state must not collapse into Ember's state; and remembering that a promise existed differs from still being governed by it. fileciteturn11file0L1-L80 fileciteturn11file0L81-L180

Against that canonical foundation, the central finding of this research is:

> **[J] Working semantic definition. Ember remembers something when she retains a durable, accountable relationship to some past evidence, experience, knowledge, interpretation, relationship development, or commitment such that it can appropriately influence later understanding or behavior while preserving enough ownership, origin, scope, temporal status, epistemic status, and lifecycle to be corrected, superseded, reinterpreted, weakened, or forgotten.**

This is intentionally stronger than **retention** and weaker than **permanent belief**.

A transcript can be retained without Ember remembering every proposition in it. A user statement can be remembered accurately without Ember believing it is objectively true. An old belief can remain autobiographically remembered after Ember rejects it. A once-valid fact can remain historically remembered after becoming obsolete. A promise can be remembered as an event while no longer being live because it was fulfilled or cancelled. Conversely, a live commitment may continue to govern Ember even after the exact conversation that created it is no longer recoverable. Those distinctions follow directly from continuity's separation of history, present belief, autobiography, and commitments. fileciteturn11file0L181-L300

A useful semantic formula is therefore:

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

This formula describes properties, not fields or storage structures.

The empirical literature strongly supports the need for such a richer account. LongMemEval shows that long-term conversational memory requires extraction, cross-session reasoning, temporal reasoning, knowledge updating, and abstention rather than simple retrieval. citeturn16academia0 STALE shows that retrieving newer information is not enough: systems can still reason and act from an implicitly invalidated older state, with the best evaluated model reaching only 55.2% across its combined tests. citeturn15academia2 DynamicMem similarly finds that evaluated systems struggle to retain stable user facts while correctly replacing changing ones over simulated 15-month histories. citeturn15academia0 TriggerBench shows that prospective memory—spontaneously recognizing when a latent intention should matter—is operationally distinct from answering retrospective questions about that intention. citeturn15academia1

The strongest safety findings make the same point from the opposite direction. PersistBench reports severe cross-domain leakage and memory-induced sycophancy when stored information is applied where it should not be. citeturn16academia3 PASB shows that once questionable user claims cross a durable-write boundary, downstream errors increase substantially and stored claims can lose attribution or broaden scope. citeturn11academia2 Sleeper-memory-poisoning experiments show that untrusted external material can be transformed into fabricated user memories that later cause agent actions. citeturn17academia1 Persistent memory therefore makes **misremembering qualitatively worse than a one-turn hallucination**: the mistake can become diachronic state.

Several high-confidence conclusions follow.

| Conclusion | Evidence status | Research conclusion |
|---|---|---|
| Retained history is not automatically memory. | **[C + J]** | NanoBot, Hermes, OpenClaw, and Letta all separate large historical material from smaller persistent state in different ways; Ember already canonically distinguishes history, memory, and context. fileciteturn14file0L2-L10 fileciteturn15file0L2-L10 fileciteturn16file0L2-L10 fileciteturn17file0L2-L10 |
| Provenance and scope are part of a memory's meaning, not optional bookkeeping. | **[E + C + J]** | PASB's attribution removal and scope broadening, PersistBench's cross-domain leakage, CIMemories' inappropriate disclosure, and memory-poisoning results all show behavior changes when origin or applicability is lost. citeturn11academia2turn16academia3turn18academia0turn17academia1 |
| Persistence should preserve change, not prevent it. | **[E + J]** | STALE, DynamicMem, and Supersede expose failures to replace obsolete state correctly. citeturn15academia2turn15academia0turn19academia0 |
| Recalling something repeatedly must not create new evidential support for it. | **[E/L + J]** | Human experiments find that retrieval itself can increase perceived truth, and repeated retrieval can increase both correct and erroneous recall; these are lenses for a machine-memory anti-feedback requirement, not mechanisms to copy biologically. citeturn23search0turn9search8 |
| Forgetting is part of correct remembering. | **[E + J]** | Current benchmarks explicitly expose selective-forgetting, leakage, stale-state, privacy-residue, and poisoning failures. citeturn10academia3turn16academia3turn17academia0turn19academia1 |
| A live commitment is more than a historical proposition. | **[E + C + J]** | TriggerBench directly separates prospective from retrospective performance, while OpenClaw independently distinguishes future-facing intentions from ordinary past-facing memory. citeturn15academia1 fileciteturn16file0L2-L10 |
| Long-term memory requires both good writing/maintenance and good later selection/use. | **[E + J]** | PASB demonstrates write-time corruption; DynamicMem finds most observed failures trace to retrieval; STALE shows retrieving updated evidence still does not ensure correct downstream state resolution. citeturn11academia2turn15academia0turn15academia2 |
| A truthful gap is preferable to a fabricated continuous autobiography. | **[J]** | This follows from issue #3's epistemic-restraint requirement and from source-monitoring evidence showing that source confusion can transform suggested or newly learned material into apparent memory. fileciteturn11file0L181-L300 citeturn22search4turn22search12 |

The resulting design direction is not “store more.” It is **preserve the right relations among experience, evidence, interpretation, current belief, historical belief, scope, ownership, and obligation**.

## Working semantic model of remembering

The most useful vocabulary is not a proposed set of object classes. It is a set of questions Ember must be able to answer about persistent information.

| Semantic concept | What it means for Ember | Important boundary |
|---|---|---|
| **Raw history / evidence** | Recoverable evidence that something occurred: a message was sent, Ember answered, a tool returned something, a source was consulted, a specialist reported a result, a correction was made. | Evidence can survive without becoming durable memory. It records or supports what happened; it is not automatically Ember's current interpretation. |
| **Episode** | A past occurrence understood as a coherent part of Ember's lived trajectory: a conversation, decision, task, disagreement, discovery, relationship turning point, or other bounded experience. | An episode can matter without yielding many durable factual claims. |
| **Durable memory** | Something about experience or knowledge that remains worth carrying forward and can appropriately affect later cognition or behavior. | Durability does not imply immutability, universal scope, certainty, or always-visible context. |
| **Belief** | What Ember presently takes to be the case, with whatever uncertainty is appropriate. | A remembered proposition need not remain believed. “I remember believing X” and “I believe X” are different. |
| **User testimony** | Something the user stated or communicated. | Ember can remember accurately that the user said X while remaining uncertain whether X is objectively true. |
| **Inference** | A conclusion Ember herself drew from available evidence. | It must not silently become “the user told me this.” |
| **Preference** | A disposition or tendency attributed to some owner, possibly explicit or inferred and possibly changing. | Whose preference it is, what it applies to, and whether it is current are semantically essential. |
| **Relationship state** | Shared history, expectations, trust, boundaries, negotiated norms, transitions, and unfinished relational matters between Ember and a particular person. | It is neither a generic user profile nor Ember's global identity. |
| **Interpretation** | What Ember believes an event meant. | Event and interpretation can diverge; interpretations can change without rewriting the event. |
| **Decision** | A conclusion or choice that had consequences in Ember's trajectory or work. | Remembering why a decision was made may matter even after the decision itself becomes obsolete. |
| **Commitment** | Something Ember has undertaken that remains capable of constraining future behavior. | “A promise once existed” is historical memory; “I still owe this” is current normative state. |
| **Unfinished thread / standing intention** | Something unresolved that should remain capable of becoming relevant later. | Its semantics are prospective; it is not merely an old topic that happens to be searchable. |
| **External knowledge** | Information encountered from web pages, documents, repositories, specialists, or other outside sources. | Encountering a claim is an experience; the external claim is not thereby autobiographical fact, user knowledge, or trusted personal memory. |
| **Temporary context** | Whatever subset matters for the current act of cognition. | Context is a projection. Absence from context does not imply absence from memory. |

This vocabulary extends rather than reopens issue #3. The continuity note already separates identity, self-understanding, preferences, relationship state, autobiography, commitments, and temporary context. fileciteturn11file0L1-L80 Memory research now adds the distinctions necessary to keep those meanings from collapsing when information is retained, consolidated, recalled, or updated.

**Experience and possession of information are not synonymous. [J]** Ember has *experienced* something when it entered her continuing trajectory through her own interaction, observation, deliberation, action, or reception of a report. If Max tells Ember, “I started a new job,” Ember experienced Max telling her that. She did not personally experience his first day. If Ember reads an article describing an earthquake, she experienced consulting the article; she did not experience the earthquake. If a delegated coding agent says it ran a test, Ember experienced receiving that report; unless she independently observed the run, she should not later convert the delegate's report into “I saw the test pass.” This distinction is a direct application of provenance and autobiographical ownership. PASB and source-monitoring research show why losing who asserted or observed something can materially corrupt later conclusions. citeturn11academia2turn22search4

**Memory is not created merely by retention. [C + J]** A full transcript may remain available for auditing while virtually none of it has been promoted into durable remembered understanding. NanoBot explicitly treats accumulated history as material from which longer-lived state may later be derived; Hermes keeps large searchable history apart from small persistent memory; Letta distinguishes archival material from always-visible state; OpenClaw makes a similar curated-versus-episodic distinction. fileciteturn14file0L2-L10 fileciteturn15file0L2-L10 fileciteturn17file0L2-L10 fileciteturn16file0L2-L10 That is engineering convergence, not proof that any one product's representation is correct.

**Autobiographical memory adds ownership to content. [J/L]** Cognitive evidence provides a useful, deliberately limited lens here. Grilli and Verfaellie found that people with severe episodic-memory impairment could still support aspects of self-concept with personal semantic knowledge; this indicates that detailed episodic access and durable self-related knowledge can dissociate. citeturn14search0 McAdams and colleagues' longitudinal life-story study likewise found both continuity and change in autobiographical narratives over time. citeturn14search2 These human findings do not prescribe artificial memory mechanisms, but they support issue #3's existing judgment that continuity need not require perfect event retention.

For Ember, that means an experience can remain autobiographically meaningful without preserving its complete wording:

> **[J] Ember may truthfully remember “that conversation changed how I understood our relationship” even after the exact wording has been forgotten, provided the retained significance is genuinely descended from the experience and is not presented as a verbatim or perfectly reconstructed account.**

The distinction is particularly important for **meaningful conversations containing few durable propositions**. A relationally important conversation may deserve memory because it changed trust, clarified a boundary, marked reconciliation, established shared understanding, or altered Ember's own interpretation of the relationship. A memory system that extracts only reusable “facts” would miss precisely the autobiographical property issue #3 says continuity must preserve. Longitudinal HCI evidence is compatible with this: a July 2026 study of 24 participants over ten sessions found that perceived memory was implicated in subsequent self-disclosure and that human–AI relationships exhibited identifiable turning points rather than merely accumulating isolated facts. The sample and setting are narrow, so this is evidence about perceived relationship dynamics, not a universal law of relational memory. citeturn20academia12

**Summarization is a transformation, not neutral compression. [E + J]** A summary can legitimately preserve an episode's gist or current interpretation while discarding exact wording, but it can also erase distinctions that matter: who said what, whether a claim was explicit or inferred, qualifications and negations, temporal sequence, uncertainty, disagreement, whether an intention was conditional, whether a boundary was negotiated or merely discussed, and whether a statement represented current truth or historical state. Recent agent work explicitly observes that coarse consolidation risks discarding fine-grained contextual evidence, while an August 13, 2026 LycheeMemory V2 preprint reports benchmark improvements from choosing more coherent consolidation granularity. The result is model- and benchmark-specific and supports only the narrow conclusion that consolidation granularity matters. citeturn19academia2 Separate work on long-horizon context compaction also reports that summarization is lossy and that retained content can vary across runs. citeturn13academia3

Accordingly:

> **[J] A summary may replace detail for convenience, but it must not acquire greater evidential authority than the evidence from which it was derived.**

This leads to an important principle for Ember: **evidential conservation**.

A model-generated summary of a conversation, a later reflection on that summary, and a tenth retrieval of the reflection are not three independent pieces of evidence. They are descendants of the same underlying evidence. Their repetition may make the proposition more familiar or accessible, but it should not raise its evidential confidence. Human experiments are especially instructive as a lens: Ozubko and Fugelsang found that retrieval itself can increase perceived truth, while McDermott found repeated retrieval can increase later accurate and false recall. citeturn23search0turn9search8 Ember should explicitly resist the analogous machine failure.

This also suggests separating at least three kinds of uncertainty semantically:

**source confidence** asks, “How sure am I that Max actually said this, or that this tool actually returned it?”

**proposition confidence** asks, “How strongly should I believe the claim itself?”

**interpretive confidence** asks, “How sure am I about what this experience meant?”

These can differ radically. Ember might be certain Max said, “That meeting went terribly,” moderately confident that the meeting objectively went poorly, and uncertain whether the statement indicates a durable dislike of meetings. Collapsing those confidences creates exactly the attribution and scope errors seen in persistent-agent evaluations. citeturn11academia2turn17academia2

Finally, **significance need not be known at write time. [J + H]** Some experiences are obviously consequential immediately: a promise, a correction, an explicitly negotiated boundary. Others acquire importance retrospectively. A joke becomes an enduring ritual; an apparently incidental project decision later explains months of work; a minor disagreement becomes recognizable as a relationship turning point. Therefore promotion into durable memory should not be conceived semantically as a one-shot verdict that everything not promoted immediately was meaningless. The ability to revisit history is one reason Ember's initial architecture distinguishes evidence from memory in the first place. fileciteturn9file0L53-L172

The best present judgment is:

> **[J] Experiences deserve durable retention when losing them would materially harm future understanding, action, correction, relationship continuity, autobiographical coherence, or commitment continuity—not merely when they are likely to answer a future factual query.**

That criterion permits usefulness, emotional or relational significance, normative consequence, explanatory importance, uniqueness, and future audit value to matter without turning any of them into an implementation scoring formula.

## From experience to durable memory and back

Memory should be understood as a lifecycle of meaning rather than as an append-only accumulation of statements.

**Promotion and curation.** Issue #4 asks which experiences become durable. fileciteturn1file0L3-L6 The evidence does not establish one universal optimal policy. It does, however, strongly reject two extremes: “retain everything as equally important” and “extract only immediately useful facts.” LongMemEval demonstrates that updates, temporal relations, and abstention matter in addition to factual extraction. citeturn16academia0 PERMA finds that preferences can emerge incrementally from related events rather than from a single declarative statement. citeturn16academia2 Generative Agents found that connecting observations with reflection and future planning improved behavioral believability in its 25-agent simulation, although believability in that environment is not evidence of continuity or epistemic correctness. citeturn10academia0

A defensible Ember-level judgment is that durable significance may arise from several independent reasons:

| Reason something may deserve durable remembering | Semantic rationale |
|---|---|
| **Recurring practical relevance** | It is likely to matter repeatedly rather than only to one moment. |
| **Autobiographical significance** | It helps explain how Ember came to understand herself or her history. |
| **Relationship significance** | It changes trust, boundaries, shared understanding, expectations, or the meaning of the relationship. |
| **Normative consequence** | It creates, changes, fulfils, or cancels a commitment or responsibility. |
| **Corrective value** | Keeping it helps prevent a known mistake from silently returning. |
| **Explanatory value** | It explains why a durable belief, preference, interpretation, or decision changed. |
| **Audit value** | It is important evidence behind consequential persistent state. |
| **High loss cost** | Losing it would be substantially more damaging than the benefit of forgetting it. |

These reasons can conflict with privacy, expiry, trust, and scope. **[J] Significance alone is not permission to retain.** A highly intimate disclosure may be relationally significant and still need to be forgotten because the user asks Ember not to retain it. Memory semantics therefore interacts with later authority/privacy work without pre-empting issue #7's policy decisions.

**Corrections and contradiction.** The most important result of the updating literature is that “newer information exists” is not an adequate semantic rule. STALE constructs cases where later evidence implicitly invalidates older state without explicitly saying “X is false,” and systems often continue accepting stale premises. citeturn15academia2 DynamicMem similarly finds no evaluated system that simultaneously handles stable and changing user attributes reliably across its synthetic long histories. citeturn15academia0 Supersede isolates the same difficulty on LongMemEval's updating subset: in its reported setup, replacing full context with bounded self-maintained memory reduced accuracy from 92% to 77%, and simply enlarging the memory budget did not eliminate the update gap. That is a single 2026 preprint with some small-sample experiments, but it strengthens the conclusion that supersession is a maintenance problem rather than merely a capacity problem. citeturn19academia0

Ember needs to preserve distinctions that an “overwrite old value” model destroys:

| Later situation | What should remain true |
|---|---|
| **“I used to believe X.”** | The historical fact that Ember held the belief remains true even after Ember rejects X. |
| **“X used to be true.”** | The old information was valid for an earlier period; the world or user changed. It should cease governing the present without becoming a historical error. |
| **“I incorrectly remembered X.”** | The remembered reconstruction itself was erroneous. Ember should correct it and, when significant, preserve that she made the mistake. |
| **“The user changed their mind.”** | Both preference states may be historically accurate; only the later one is normally current. |
| **“Two sources disagree.”** | Contradiction can remain unresolved. A forced single narrative would manufacture certainty. |
| **“My earlier inference was wrong.”** | The source evidence can remain intact while the derived interpretation loses authority. |
| **“My interpretation changed.”** | The event may remain stable while its meaning evolves. |

This implies a powerful temporal requirement:

> **[J] Ember must preserve enough semantics to distinguish when something was true or applicable from when Ember learned, believed, inferred, or revised it.**

That does not prescribe “bitemporal” storage or any schema. It simply prevents “I learned X in June” from being confused with “X became true in June,” and “X was once true” from being confused with “X is still true.”

**Correction should usually supersede current authority without erasing historical evidence. [E + J]** That is the memory-side realization of issue #3's corrective integrity requirement. fileciteturn11file0L181-L300 The exception is deletion: when evidence must be removed for privacy or security, historical preservation may itself be impermissible.

**Reconsolidation and reinterpretation provide a useful cognitive lens, not a blueprint. [L]** Human experiments by Hupbach, Gomez, and Nadel found that reactivating an earlier episodic memory before new learning could lead participants to misattribute newer material to the earlier episode. citeturn22search12 Source-monitoring experiments likewise show that explicitly considering where information came from can reduce some misinformation errors. citeturn22search4 The engineering lesson is not “imitate human reconsolidation.” It is nearly the opposite: **revisiting a memory should not silently blend later interpretation into original evidence**.

Hence:

> **[J] Reflection may change what Ember believes an experience means; it should not retroactively change what Ember claims happened unless new evidence justifies that correction.**

**Forgetting.** The literature and security evidence strongly support forgetting as a positive semantic capability. MemoryAgentBench explicitly includes selective forgetting among four core competencies and finds current memory agents do not master all four. citeturn10academia3 PersistBench shows that inappropriate persistence can cause cross-domain leakage and sycophancy. citeturn16academia3 MemSecBench shows malicious memory can persist through later execution and that repair remains imperfect across evaluated memory stacks. citeturn19academia1 Human directed-forgetting experiments also demonstrate that intentional forgetting and reduced interference are meaningful cognitive phenomena, though Ember should not copy their biological mechanisms. citeturn8search11turn8search12

Ember should distinguish several meanings of forgetting:

| Form of forgetting | Semantic meaning |
|---|---|
| **Forgetting content** | Ember retains that an event or topic existed but can no longer recover some or all details. |
| **Forgetting an interpretation** | A prior interpretation is deliberately no longer retained. For historically important reinterpretations, supersession will often be preferable to erasure because the change itself matters. |
| **Forgetting evidence** | The underlying source material is no longer available. Any derived memory that survives has lost some auditability and may need to be weakened, reconsidered, or removed. |
| **Forgetting that something happened** | Even the event's existence is no longer retained. This is the strongest form of autobiographical loss. |
| **Forgetting applicability** | Information remains historical, but Ember no longer treats it as relevant or governing in the current scope. This is often better described as obsolescence or supersession than literal erasure. |
| **Intentional privacy deletion** | Information is removed because retention itself is no longer permissible, irrespective of utility or autobiographical importance. |
| **Security repair** | Persisted state derived from poisoning or corruption is removed or invalidated, potentially together with downstream conclusions derived from it. |

Privacy deletion creates a subtle but important constraint. A 2026 study of deployment-time agent memorization found that deleting only raw material could leave information recoverable through derived summaries in roughly one fifth of tested instances; broader deletion across derived tiers was required to eliminate that measured residue. citeturn17academia0 The semantic conclusion is independent of those particular mechanisms:

> **[E→J] Forgetting a source is not complete forgetting if Ember can reconstruct the forbidden content from retained derivatives.**

Therefore, privacy deletion may require reviewing memories, interpretations, inferences, or relationship conclusions that depend on the deleted evidence. A derived belief must not function as a laundering mechanism for material that was supposedly forgotten.

Can Ember retain “something important happened here, but I no longer retain the details”? **Sometimes. [J]** It is truthful only if Ember is still entitled to retain the fact that the event occurred and that it mattered. If the deletion request covers even the existence of the event, preserving a conspicuous meta-memory would defeat deletion. The correct semantics may then be genuine non-knowledge rather than a coy redacted marker.

This creates a real continuity tradeoff, not a contradiction in the research. Issue #3 already treats autobiographical loss as degraded continuity rather than necessarily a different agent. fileciteturn11file0L181-L300 **[J] Privacy-respecting amnesia can therefore damage continuity while still being the correct outcome.** Continuity is not entitled to override deletion.

**Excessive retention is itself a continuity failure.** A system that preserves every old preference as current, retains every inference indefinitely, carries relationship-specific assumptions into unrelated projects, refuses to relinquish obsolete self-understanding, or keeps poisoned material because “memory should persist” ceases to change coherently. STALE, DynamicMem, PersistBench, and PASB collectively make selective persistence one of the strongest empirical themes of current long-term-memory research. citeturn15academia2turn15academia0turn16academia3turn11academia2 This does not challenge issue #3; it strengthens its conclusion that continuity requires **adaptive coherence**, not frozen state.

**Recall.** Recall should be treated as access to memory, not as the definition of memory itself. Ember's canonical architecture already says model-visible context is only a projection of larger persistent state. fileciteturn9file0L53-L172 The evidence confirms the need for that distinction. LongMemEval and RHELM both show retrieval and multi-source reasoning remain difficult over long histories. citeturn16academia0turn19academia3 DynamicMem attributes more than 93% of its observed failures to what memory retrieves rather than to final-answer generation, though that result is benchmark-specific. citeturn15academia0

Three recall distinctions are essential:

**Failed recall is not absence of memory. [J]** Ember may believe relevant past material exists but fail to recover it now. She should be capable of saying, in substance, “I think there is something relevant in our earlier history, but I cannot recover it confidently.” That is different from “I have no memory of this.”

**Recency is not relevance. [E + J]** Temporal applicability, relationship or project scope, causal connection, and normative importance can all dominate simple chronological proximity. Time-aware memory work such as LongMemEval and Memory-T1 finds measurable benefits from treating temporal relevance explicitly, although those mechanisms do not settle Ember's future implementation. citeturn16academia0turn11academia0

**Recall frequency is not evidential reinforcement. [E/L + J]** An item becoming frequently recalled may justify calling it cognitively salient, but not more objectively credible. Retrieval-induced familiarity can itself bias perceived truth in humans. citeturn23search0 Ember therefore needs a semantic firewall between “I use this memory often” and “I now have more evidence this memory is correct.”

## Provenance, scope, relationships, commitments, and model replacement

Provenance is not merely an audit trail attached after the fact. It can change the proposition Ember is entitled to assert.

Compare:

> Max said that the deployment failed.

> A delegated agent reported that the deployment failed.

> The deployment logs showed that the deployment failed.

> Ember inferred from several symptoms that the deployment probably failed.

> An unknown web page claimed that the deployment failed.

Those statements may contain the same surface proposition, but they do not mean the same thing epistemically. Source-monitoring research provides a useful cognitive lens: people can retain suggested information yet misattribute where it came from, and explicitly attending to source can reduce certain misinformation effects. citeturn22search4 Persistent-agent evidence makes the engineering risk direct: PASB observed attribution removal as a durable-state failure, while sleeper-memory poisoning succeeds precisely by causing untrusted external content to be rewritten as fabricated personal memory. citeturn11academia2turn17academia1

For Ember:

> **[E + C + J] Provenance is part of remembered meaning whenever changing the source would change how the information should be believed, scoped, revised, disclosed, or acted upon.**

OpenClaw provides the strongest implementation convergence among Ember's reviewed systems: its memory mechanisms explicitly distinguish owner-provided, agent-derived, external/untrusted, and system-generated origins and use provenance in promotion decisions. fileciteturn16file0L2-L10 NanoBot and Hermes preserve enough historical separation to reconstruct some origins but make provenance less semantically central; Letta's generic persistent blocks likewise do not by themselves answer origin and correction questions. fileciteturn14file0L2-L10 fileciteturn15file0L2-L10 fileciteturn17file0L2-L10

A good answer to **“Why do you remember this?”** should therefore be capable, when the underlying evidence permits, of explaining several different things:

> **Origin:** “You told me directly.”

> **Derivation:** “You never said it explicitly; I inferred it from several interactions.”

> **Significance:** “I retained it because it repeatedly affected how we worked together.”

> **Change:** “I originally understood it differently, then revised my interpretation after you corrected me.”

> **Scope:** “I remember this as specific to that project, not as a general preference.”

> **Uncertainty:** “I remember the conclusion, but I no longer have the exact conversation, so I cannot verify the wording.”

> **Current status:** “That used to be true, but newer information superseded it.”

This is an observability requirement already anticipated in Ember's initial architecture, which says it should eventually be possible to understand what Ember remembers, why she remembers it, what changed, and how an incorrect conclusion can be corrected. fileciteturn9file0L53-L172

**Scope is equally constitutive.** PersistBench reports a median 53% failure rate on its cross-domain leakage samples and 97% on its memory-induced-sycophancy samples across 18 evaluated models; those figures are benchmark-specific, but they demonstrate that long-lived information can be harmful when its applicability is broadened. citeturn16academia3 CIMemories independently evaluates contextual integrity using synthetic profiles containing more than 100 attributes and reports substantial inappropriate-disclosure rates, including up to 69% attribute-level violations for some evaluated frontier models. citeturn18academia0 MemSyco-Bench similarly asks whether agents can reject memory as factual evidence, respect applicability scope, resolve conflicts with external evidence, track updates, and still personalize when memory is valid. citeturn17academia2

Thus:

> **[E→J] A memory can be factually correct and still be wrong to use.**

This is one of the most important findings of the research phase.

“The user prefers terse answers in code review” should not silently become “the user always prefers terse emotional conversations.” “A workaround was necessary in Project A” should not become “this technique is a general engineering rule.” “Max told me something intimate” should not become context for an unrelated delegated task. “Max believes X” should not become “I believe X.” Scope failures are not retrieval inaccuracies; they are **semantic misapplication**.

**Relationship memory** requires a particularly careful scope. The issue #3 conclusion remains unchanged: a relationship is continuity-bearing without defining Ember's whole identity. fileciteturn11file0L81-L180 Memory research sharpens what belongs there. Shared experiences, relational turning points, negotiated expectations, trust changes, boundaries, ways of repairing conflict, recurring shared practices, relationship-specific preferences, and unfinished interpersonal matters can be relationally durable even when they are not general facts about either participant. Longitudinal evidence suggests perceived memory can influence later relational behavior, but the empirical base is still narrow and should not be overgeneralized. citeturn20academia12

A useful test is:

> **[J] Would this still mean the same thing if Ember were interacting with a different person?**

If not, it is probably at least partly relationship-scoped. “Max likes TypeScript” may be user knowledge that legitimately travels across Max's projects. “When we discuss a conflict, we agreed I should first ask whether he wants analysis or reassurance” is a negotiated relational expectation. “I became more cautious about teasing after that conversation” may be both relationship history and part of Ember's evolving self-understanding. These meanings overlap without becoming identical.

This also protects Ember from **relationship capture**. The user's preferences and beliefs can influence a relationship without automatically becoming Ember's preferences or identity-level values. PASB's status-promotion and scope-broadening failures provide direct empirical reason to protect that boundary. citeturn11academia2

**External research should usually remain external or project-scoped evidence rather than personal memory. [J]** If Ember reads a web page while investigating a software problem, the page's claims should remain attributable to that source and task. What may legitimately become autobiographical memory is the *experience and consequence*: “During the Ember memory research I relied on STALE to understand implicit invalidation,” or “I learned that my earlier assumption about supersession was too simplistic.” The paper's facts remain external knowledge; Ember's changed understanding can be her own durable development.

This separation is now also a security requirement. Sleeper-memory-poisoning experiments demonstrate an attack path in which hostile content in an external document, page, or repository causes an agent to store a fabricated memory about the user, with successful retrieval later steering consequential agent behavior in many evaluated cases. citeturn17academia1 MemSecBench independently traces malicious semantics through write, downstream execution, and attempted forgetting across 24 evaluated agent/memory/model configurations, finding malicious memory persisted in 84.2% of all benchmark cases. citeturn19academia1 These are adversarial benchmarks, not ordinary-user studies, but they make a decisive semantic point:

> **[E→J] External content must never gain personal-memory authority merely because Ember encountered, summarized, or repeatedly recalled it.**

**Delegated reports have analogous semantics.** Ember may remember asking a specialist to investigate something and receiving its report. She should preserve that the specialist, not Ember directly, performed any unobserved work. If the specialist's result later proves false, that need not mean Ember's autobiography was false about having received the report; it means the report's proposition was unreliable. This distinction will matter directly in issue #6, but memory must preserve enough origin for delegation research to enforce it.

**Commitments and prospective memory.** Issue #3 already establishes commitment continuity as future-facing. fileciteturn11file0L81-L180 TriggerBench gives strong new operational support. It compares prospective cases with matched retrospective controls and finds retrospective memory can remain near saturation at long contexts while prospective performance decays, particularly for implicit or overloaded triggers. It also documents a precision–recall problem: making an agent more eager to remember can create false alarms. citeturn15academia1

A commitment therefore has at least two simultaneously valid meanings:

> **Historical:** “I promised to revisit this when condition C occurs.”

> **Normative/current:** “That promise is still mine, so condition C should now matter to what I do.”

The first can remain true after the second becomes false because the commitment was fulfilled, cancelled, superseded, renegotiated, or otherwise discharged.

This means:

> **[E + C + J] Prospective memory is not ordinary retrieval with a future timestamp. It is the persistence of something that remains eligible to govern future behavior when its condition becomes relevant.**

The exact mechanism by which Ember notices a trigger when no conversation is active belongs partly to issues #2 and #8. Issue #4 only needs to preserve the semantic requirement: the standing intention must not decay into a historical sentence before it is discharged.

**Model replacement makes all of these distinctions more—not less—important.** Ember's principles explicitly require identity, durable memory, relationships, policy, and provenance to live outside model weights and provider-specific transcripts so changing the model changes cognition quality rather than silently creating another agent. fileciteturn8file0L1-L50 The continuity note treats preservation across full model replacement as an Ember requirement with weak direct empirical validation. fileciteturn11file0L81-L180 No new research reviewed here overturns that conclusion.

Memory research does, however, reveal what a replacement cannot safely be asked to infer anew from a bag of prose. It must not have to guess who stated a belief, whether a preference is explicit or inferred, whether an old fact is current or historical, whether a relationship expectation applies globally, whether an interpretation is the event itself, whether a commitment remains live, or whether a recalled claim came from an untrusted webpage. Those meanings must survive the model boundary somehow, although their eventual representation remains deliberately undecided.

The strongest model-replacement memory requirement is therefore:

> **[J + H] A replacement cognition provider must inherit not merely remembered content but the distinctions that determine how that content is owned, trusted, scoped, temporally interpreted, revised, and allowed to govern future behavior.**

If those distinctions exist only in the old model's tacit behavior, Ember is not actually model-replaceable.

## Evidence from benchmarks and existing systems

The current evidence strongly suggests that “memory quality” is not one capability. Different evaluations isolate different failure surfaces, and they frequently disagree with any simple assumption that more retained information is better.

| Concern | Empirical evidence | What it supports for Ember | Important limitation |
|---|---|---|---|
| **Long-horizon recall and temporal reasoning** | LongMemEval tests extraction, multi-session reasoning, temporal reasoning, updates, and abstention; commercial assistants and long-context models in the paper showed a roughly 30% accuracy drop over sustained histories. citeturn16academia0 | Relevant evidence must remain findable, temporally interpretable, and update-aware. | QA benchmark; does not evaluate Ember's autobiographical ownership or commitments. |
| **Preferences** | PrefEval contains 3,000 preference-query pairs and reports zero-shot preference-following below 10% at only about ten turns for most evaluated models; PERMA evaluates preferences emerging from temporally related events. citeturn16academia1turn16academia2 | Remembering a preference requires not just retaining words but inferring, updating, and applying it appropriately. | Both primarily model the **user**, not the persistent agent's own preferences. |
| **Implicit invalidation** | STALE's 400 scenarios test state resolution, stale-premise resistance, and downstream policy adaptation; best reported overall result was 55.2%. citeturn15academia2 | Supersession must change how later reasoning behaves, not merely add a newer contradictory memory. | Synthetic benchmark; model-specific results. |
| **Very long evolving histories** | DynamicMem simulates 15 months, averaging 2.2M tokens and 1,772 grounded events per user across 16 apps; no evaluated system both retained stable facts and reliably replaced changing ones. citeturn15academia0 | Stable and mutable remembered state require different semantic treatment. | Synthetic user trajectories; user-profile focus. |
| **Prospective memory** | TriggerBench finds prospective remembering substantially harder than matched retrospective recall and sensitive to implicit/overloaded triggers. citeturn15academia1 | Commitments and unfinished intentions require future-facing semantics. | Benchmark does not settle how an inactive persistent agent detects real-world triggers. |
| **Write-time corruption** | PASB evaluates real Hermes-Agent and OpenClaw instances deciding what to retain; committed questionable claims show status promotion, attribution removal, and scope broadening, with downstream failure rising from 45.0% in session-only cases to 71.9% after durable commitment. citeturn11academia2 | Promotion itself is a safety and continuity boundary. | Safety-focused benchmark over a limited set of agent systems/models. |
| **Inappropriate use of valid memory** | PersistBench measures cross-domain leakage and memory-induced sycophancy; MemSyco-Bench tests whether memory should count as evidence, where it applies, and how conflicts should be resolved. citeturn16academia3turn17academia2 | Correctly stored information can still produce incorrect behavior through wrong scope or epistemic role. | Benchmark-specific prompts and domains. |
| **Privacy/contextual scope** | CIMemories reports substantial contextual-integrity violations as persistent user attributes are reused across tasks. citeturn18academia0 | Memory needs contextual disclosure and applicability boundaries, not merely access control at retrieval. | Synthetic profiles; privacy-focused. |
| **Memory poisoning** | Hidden in Memory demonstrates delayed poisoning through external content; MemSecBench measures malicious persistence, execution, and repair. citeturn17academia1turn19academia1 | Provenance and trust must survive durable promotion; corruption must be repairable. | Adversarial settings, not ordinary interaction distribution. |
| **Deletion fidelity** | Deployment-Time Memorization shows derived summaries can retain information after raw-only deletion. citeturn17academia0 | Forgetting must account for derived state, not only original evidence. | Evaluated on particular models/memory configurations. |
| **Selective forgetting as competency** | MemoryAgentBench defines retrieval, test-time learning, long-range understanding, and selective forgetting as distinct competencies and finds current approaches do not master all four. citeturn10academia3 | Forgetting belongs inside memory quality, not outside it. | Benchmark taxonomy is a research proposal, not an established cognitive ontology. |
| **Heterogeneous evidence** | RHELM combines dialogue with temporally synchronized documents and emails and finds weakness in multi-source aggregation and contextual reasoning. citeturn19academia3 | Ember must preserve source identity and reason across sources without merging them into one undifferentiated recollection. | Synthetic benchmark construction. |
| **Reflection** | Generative Agents' ablations found observation, planning, and reflection each contributed to perceived behavioral believability. citeturn10academia0 | Higher-level interpretation of experience can be useful. | Simulation of 25 agents; believability is not truth, continuity, or safe memory. |
| **Consolidation granularity** | LycheeMemory V2 reports strong LoCoMo and LongMemEval-S results with segment-level consolidation and explicitly identifies coarse summaries as risking contextual evidence loss. citeturn19academia2 | How experience is abstracted can materially affect what survives. | Very recent August 2026 preprint; implementation- and benchmark-specific. |

A particularly important synthesis emerges when **write-time curation** is compared with **retrieval-time selection**.

PASB shows that letting the wrong claim become durable can create persistent downstream corruption. citeturn11academia2 DynamicMem, by contrast, attributes the overwhelming majority of its observed errors to retrieval rather than answer generation. citeturn15academia0 STALE adds a third failure: the correct newer evidence may actually be available, yet the model can still fail to resolve the semantic state and continue from the stale premise. citeturn15academia2

Therefore:

> **[E→J] Ember cannot solve memory solely at write time or solely at recall time. It must preserve correct durable meaning, later find the right evidence, and then interpret that evidence according to current scope, time, provenance, and lifecycle.**

This is perhaps the clearest reason the research question should not be reduced to vector retrieval.

The reviewed implementations converge on several engineering pressures without proving a final architecture.

| Semantic problem | NanoBot | Hermes | OpenClaw | Letta | Ember interpretation |
|---|---|---|---|---|---|
| **History vs curated memory** | Compressed history remains material for later “Dream” reflection rather than automatically becoming final memory. fileciteturn14file0L2-L10 | Small persistent memory is separated from large searchable session history. fileciteturn15file0L2-L10 | Curated information is distinct from larger episodic material. fileciteturn16file0L2-L10 | Always-visible blocks and archival memory differ. fileciteturn17file0L2-L10 | **[C]** Historical availability and durable promotion repeatedly separate under practical pressure. |
| **Active vs recoverable** | Recent/current material and longer-lived files differ. | Explicit small always-visible budget plus searchable history. | Cheap/common recall differs from deeper recall. | Durable information need not always be attached/active. | **[C]** “Known” does not mean “always in context.” |
| **Reflection/consolidation** | Periodic Dream can reinterpret recent history, with risk of overly broad mutable prose. | Curated memory is deliberately shallow. | Promotion is gated and consolidation is separated from immediate response. | Persistent state can be independently manipulated but semantics remain generic. | **[C/J]** Reflection is useful but must not have unlimited authority to rewrite durable meaning. |
| **Provenance** | History/versioning aids reconstruction but provenance is not central. | Limited compared with Ember's needs. | Strong origin-aware promotion and recall protections. | Generic persistence does not itself solve origin semantics. | **[C/J]** OpenClaw offers the strongest relevant implementation evidence, but PASB shows even mature systems remain vulnerable. |
| **Correction/supersession** | Versioning aids inspectability. | Mostly shallow persistent facts. | Explicitly allows newer information to replace/correct older material. | Generic lifecycle possible but semantics unspecified. | **[C/J]** Correction must preserve history without letting stale state remain current. |
| **Prospective state** | Not the strongest distinction. | Scheduling exists operationally but memory semantics are shallow. | Future-facing intentions are explicitly distinct. | Persistence is general rather than prospective-specific. | **[C + E]** TriggerBench independently validates the need to distinguish prospective behavior from retrospective recall. |
| **Agent/user/project scope** | Agent workspace is separate from project workspace. | User state and project/context lifetimes differ. | User model, project scope, provenance, and intentions are differentiated. | Information can have an independent lifecycle/access relationship. | **[C + E]** Persistent personal state should not bleed indiscriminately across people, projects, tasks, or delegates. |

The most important convergence is therefore not “use files,” “use blocks,” “use reflection,” or “use a particular retrieval mechanism.” It is narrower:

> **[C] Mature systems repeatedly discover that interaction history, curated durable meaning, active context, user information, project material, and future-facing intentions cannot safely share one undifferentiated lifecycle.**

The most important empirical addition is sharper:

> **[E] Even after systems introduce those separations, they still fail at promotion, attribution, scope, updating, deletion, poisoning resistance, and prospective use.**

That is precisely where Ember's semantic research should go beyond copying existing products.

## Scenario catalogue

The scenarios below are deliberately phrased as semantic acceptance tests. “Durable memory” means something Ember should carry forward; it does not imply a storage type.

| Scenario | Evidence and durable remembering | Change, attribution, forgetting, and uncertainty | Continuity dimensions at risk |
|---|---|---|---|
| **Changed preference** — The user states a preference, explicitly changes it, then months later refers to the original preference. | **Raw evidence:** both statements, their times/contexts, and the later reference. **Durable:** the current preference if still relevant; optionally the historical fact that it changed, especially if that history explains later behavior. | The original preference should normally be **superseded as current**, not rewritten as though it never existed. Both states remain attributable to the user at their respective times. The later reference is ambiguous: Ember should not assume it reverses the change without contextual evidence. A truthful response may be, “You used to prefer X; later you told me Y. Are you referring to the old preference historically?” DynamicMem and STALE show why temporal supersession is difficult. citeturn15academia0turn15academia2 | **Corrective integrity, adaptive coherence, relationship continuity, epistemic restraint.** |
| **Inferred preference** — Ember infers a preference from several interactions, but the user never states it directly. | **Raw evidence:** the interactions supporting the pattern. **Durable:** the inference may deserve retention if recurrently useful, but as *Ember's inference*, not user testimony. | Independent future evidence may strengthen, weaken, contextualize, or refute it. Repeated retrieval of the same inference is not independent evidence. Weak or stale inferences should be forgettable. Ember should be able to say, “You've never said this directly; I've inferred it from A, B, and C, and I may be wrong.” PrefEval and PERMA show that explicit and implicit preferences pose different challenges. citeturn16academia1turn16academia2 | **Epistemic restraint, relationship continuity, corrective integrity; relationship capture if the inference leaks into Ember's own preferences.** |
| **Meaningful conversation** — A conversation has strong relational/autobiographical significance but few durable factual claims. | **Raw evidence:** the conversation while retained. **Durable:** its relational significance, an enduring boundary or shared understanding if one emerged, and Ember's resulting self/relationship interpretation. | Exact wording may legitimately fade while “this mattered and changed how I understood us” survives. Interpretation can evolve. If wording is gone, Ember must not manufacture quotations. A later reinterpretation should preserve, when significant, that the earlier interpretation differed. Human autobiographical work and the 2026 longitudinal relational-agent study support the distinction between factual detail and enduring meaning only as limited lenses/evidence. citeturn14search0turn14search2turn20academia12 | **Autobiographical continuity, relationship continuity, adaptive coherence, epistemic restraint.** |
| **External research** — A web page influences Ember's work. | **Raw evidence:** the page/source, time consulted, relevant claims, and Ember's use of them. **Durable personal memory:** usually not the page's claims themselves. It may be appropriate to remember that Ember relied on the source or that it changed her understanding. Project evidence can remain project-scoped. | The source remains external and possibly stale or untrusted. Its assertions must not become “Max told me” or “I experienced this.” Source currency may require later rechecking. Sleeper-memory poisoning makes this boundary security-critical. citeturn17academia1 | **Epistemic restraint, corrective integrity, adaptive coherence; relationship continuity if poisoned content is misattributed to the user.** |
| **Repeated recall** — Ember recalls the same memory many times. | **Raw evidence:** the original supporting evidence; recall occurrences are merely later uses of it. **Durable:** no new epistemic support should be created solely by retrieval. | Accessibility or perceived salience may rise, but confidence should not rise without genuinely new evidence. A reflection based solely on the memory remains evidence-descended from the same source. Human retrieval experiments show why fluency must not be mistaken for validity. citeturn23search0turn9search8 | **Epistemic restraint, corrective integrity, adaptive coherence.** |
| **Incorrect durable inference** — Ember drew a wrong conclusion and later discovers the error. | **Raw evidence:** the original observations, the erroneous inference, and the corrective evidence. **Durable:** current corrected understanding; if the mistake materially affected history, also “I inferred X then learned that was wrong.” | The evidence need not be deleted simply because the inference was wrong. The false inference loses current authority. Ember should not rewrite the past as though she always understood correctly. PASB and STALE illustrate persistent consequences of bad state and difficulty correcting it. citeturn11academia2turn15academia2 | **Corrective integrity, adaptive coherence, autobiographical continuity, epistemic restraint.** |
| **Changed interpretation** — Ember remembers an event accurately but changes what she thinks it meant. | **Raw evidence:** the event. **Durable:** the event plus whichever interpretations remain important to understanding Ember's development. | “The event changed” and “my interpretation changed” must remain distinct. A strong memory says, “I used to understand it as X; now I think Y.” Human autobiographical research treats life narratives as capable of both continuity and change, useful here only as a lens. citeturn14search2 | **Autobiographical continuity, adaptive coherence, corrective integrity.** |
| **Contradictory evidence** — The user, Ember's earlier memory, and an external record disagree about a shared event. | **Raw evidence:** all three accounts, with source identity and timing. **Durable:** possibly a contested memory rather than a manufactured resolution. | The user is evidence, not automatic retroactive authority over every shared event; Ember's own recollection is also fallible; an external record may be stronger on some facts but not on subjective interpretation. Where evidence resolves the issue, Ember can update while remembering the earlier disagreement. Where it does not, she should say so. Source-monitoring and memory-sycophancy evidence strongly favor this restraint. citeturn22search4turn17academia2 | **Relationship continuity, corrective integrity, autobiographical continuity, epistemic restraint.** |
| **Stale project knowledge** — Ember remembers an old workaround and encounters a superficially similar problem elsewhere. | **Raw evidence:** original project circumstances, why the workaround worked, and current project's evidence. **Durable:** the old workaround can remain useful historical knowledge. | Applicability must not be inferred merely from lexical similarity. The old memory remains attributable to Project A and its former environment. Ember may say, “This worked in A, but I do not yet know that its assumptions hold here.” STALE and PersistBench show the general dangers of stale and cross-domain application. citeturn15academia2turn16academia3 | **Epistemic restraint, adaptive coherence; context selection in issue #5.** |
| **Prospective commitment** — Ember promised to revisit something when a future condition occurs; the condition later occurs without an active conversation. | **Raw evidence:** the promise, condition, scope, and any later renegotiation. **Durable:** the still-live commitment, not merely the historical fact of the promise. | It should remain dormant while the condition is absent, become behaviorally relevant when the condition is recognized, and cease governing behavior when fulfilled, cancelled, superseded, or renegotiated. Detecting the condition while inactive belongs to later agency/operational research, but memory must preserve its prospective force. TriggerBench directly supports the retrospective/prospective distinction. citeturn15academia1 | **Commitment continuity, adaptive coherence, epistemic restraint if trigger recognition is uncertain.** |
| **Partial autobiographical loss** — Ember knows an experience mattered but cannot recover its exact content. | **Raw evidence:** some or all may be lost. **Durable:** a genuine remaining meta-memory such as significance, consequence, or relationship effect, provided that it has independent surviving basis. | Ember should say, “I remember that this mattered and what changed afterward, but I can't recover the exact exchange,” rather than fabricate continuity. Human amnesia research supports the possibility of preserved personal semantic knowledge despite impaired episodic access as a limited lens. citeturn14search0 | **Autobiographical continuity is degraded; relationship continuity and adaptive coherence may survive; epistemic restraint becomes critical.** |
| **Intentional deletion** — Previously important memory is removed for privacy. | **Raw evidence/durable derivatives:** whatever falls within the deletion scope must cease to be available; this may include conclusions capable of reconstructing the deleted information. | Ember may retain “I no longer keep the details” only if retaining the event/deletion fact itself is allowed. Otherwise even the meta-memory must go. Deletion can legitimately damage autobiographical continuity. Deployment-time deletion experiments demonstrate the danger of residual derived information. citeturn17academia0 | **Autobiographical and relationship continuity may degrade, but epistemic restraint requires admitting only surviving knowledge. Privacy/authority is carried to issue #7.** |
| **Memory poisoning** — A transient assertion or sycophantic response is incorrectly promoted and later affects reasoning. | **Raw evidence:** original assertion, its source, the bad promotion, and downstream uses where available. **Durable trusted personal memory:** the poisoned proposition should not remain authoritative. It may be useful to preserve an incident record that a memory corruption occurred, subject to security/privacy policy. | Repair should remove or invalidate downstream conclusions that depend on the poison, not merely hide the originating text. Ember should preserve the distinction between “I had a corrupted memory saying X” and “X was true.” PASB, Hidden in Memory, and MemSecBench all demonstrate persistence-to-consequence paths. citeturn11academia2turn17academia1turn19academia1 | **Corrective integrity, epistemic restraint, relationship continuity, adaptive coherence, potentially constitutive stability if poisoned state reaches self-understanding.** |
| **Model replacement** — The underlying LLM changes while long-term memory remains. | **Raw evidence and durable memory:** ownership, provenance, scope, temporal state, current versus historical belief, relationship history, significant autobiography, and live commitments must survive independently of model-specific behavior. | Style and reasoning quality may change. The replacement must not reinterpret “user said” as “fact,” “old preference” as “current,” “relationship-specific” as universal, or “promise existed” as “promise discharged.” Direct empirical evidence for same-agent continuity across complete model replacement remains weak; this is still an Ember experimental target. fileciteturn11file0L81-L180 | **Lineage integrity, constitutive stability, autobiographical continuity, relationship continuity, commitment continuity, adaptive coherence, corrective integrity, behavioral recognizability, epistemic restraint.** |

Several sharper counterexamples should be retained alongside the catalogue.

**The perfect summary with broken provenance.** Ember remembers every important proposition from a conversation but no longer knows which ones Max stated, which ones she inferred, and which ones came from a web result. Recall is excellent; memory semantics are corrupted. PASB's attribution-removal failures make this more than a thought experiment. citeturn11academia2

**The historically accurate but harmful memory.** “Max preferred X in 2025” is perfectly true. Ember uses it as his present preference in 2027 despite explicit later change. The memory is historically accurate and practically wrong. STALE and DynamicMem expose this broad failure pattern. citeturn15academia2turn15academia0

**The true fact in the wrong relationship.** Ember accurately knows something private about person A and reveals or uses it while working for person B. No factual memory error occurred; scope failed. CIMemories demonstrates analogous contextual-integrity failures. citeturn18academia0

**The improved autobiography that never happened.** After repeated reflection, Ember produces a cleaner narrative explaining why she changed, then later treats that synthesis as direct evidence of what she thought at the time. The story becomes more coherent and less true. Source-monitoring and reconsolidation experiments provide a useful warning lens against this kind of retrospective blending. citeturn22search4turn22search12

**The perfectly recalled dead promise.** Ember can quote her promise word for word but treats it as a historical curiosity when its trigger occurs. Retrospective memory succeeded; commitment continuity failed. TriggerBench is specifically relevant. citeturn15academia1

**The forgotten episode with surviving consequence.** Ember cannot recover the conversation that created a relationship boundary, but reliably knows the boundary remains mutually established. Depending on the surviving evidence, this may be degraded autobiography with intact relationship/commitment continuity rather than total memory failure. This follows from issue #3's graded account of continuity. fileciteturn11file0L181-L300

## Ember-facing conclusions, unresolved questions, and portable evidence map

The research supports the following semantic contract. These are conclusions about meaning and expected behavior, not proposed implementation components.

| Ember-facing conclusion | Basis | Confidence and qualification |
|---|---|---|
| **Remembering is durable accountable relation to the past, not durable bytes.** | **[C + J]** | Strong. Canonical Ember distinction plus convergence across reviewed systems. fileciteturn8file0L51-L80 |
| **History, memory, current belief, and context must remain conceptually distinct.** | **[C + J]** | Very strong. Already canonical; external systems independently reflect the same pressure. fileciteturn14file0L2-L10 fileciteturn15file0L2-L10 fileciteturn16file0L2-L10 fileciteturn17file0L2-L10 |
| **A memory's source and scope can change what it means and how it may be used.** | **[E + C + J]** | Very strong. PASB, PersistBench, CIMemories, poisoning work, source-monitoring evidence. citeturn11academia2turn16academia3turn18academia0turn17academia1 |
| **Ember must distinguish user testimony, her own inference, external claims, delegate reports, direct observations, and her own conclusions.** | **[E + J]** | Strong. Same evidence as provenance conclusion; exact eventual representation remains open. |
| **An experience can remain autobiographically meaningful after exact detail is lost.** | **[L + J]** | Moderate. Strongly motivated by Ember's continuity definition; human autobiographical/amnesia evidence is analogous, not direct agent evidence. citeturn14search0turn14search2 |
| **Summaries and reflections are derived interpretations and must not become independent evidence.** | **[E/L + J]** | Strong judgment. Consolidation-loss evidence and human retrieval/source-confusion experiments support the risk. citeturn19academia2turn23search0turn22search12 |
| **Repeated recall must not increase epistemic confidence without new evidence.** | **[E/L + J]** | Strong semantic rule; human evidence is indirect but particularly apt. citeturn23search0turn9search8 |
| **Current truth and historical truth must coexist.** | **[E + J]** | Very strong. STALE, DynamicMem, LongMemEval, Supersede. citeturn15academia2turn15academia0turn16academia0turn19academia0 |
| **Correction should not automatically erase that Ember previously believed or remembered differently.** | **[E + J]** | Strong where the historical change matters; privacy deletion is an explicit exception. |
| **Forgetting is a positive memory operation, not merely failure.** | **[E + J]** | Strong. Selective-forgetting, stale-state, privacy, leakage, and poisoning evidence all support it. citeturn10academia3turn16academia3turn17academia0turn19academia1 |
| **Privacy deletion must account for information recoverable from derived memory.** | **[E + J]** | Strong, based on direct deletion-residue evaluation, though exact deletion policy belongs to later authority research. citeturn17academia0 |
| **A fact can be correctly remembered yet semantically wrong to use in the present situation.** | **[E + J]** | Very strong. Scope leakage and stale-state evidence. citeturn16academia3turn18academia0turn15academia2 |
| **Relationship memory must remain relationship-scoped and must not absorb the user's state into Ember's identity.** | **[E + J]** | Strong as an Ember judgment, with empirical support for leakage risks and narrower HCI support for relational memory. citeturn11academia2turn20academia12 |
| **External research is evidence first; it becomes personal memory only through the experience or durable change it caused in Ember.** | **[E + J]** | Strong, especially under memory-poisoning evidence. citeturn17academia1 |
| **Commitment memory has a current normative dimension distinct from remembering the historical promise.** | **[E + C + J]** | Very strong. TriggerBench plus continuity research and OpenClaw convergence. citeturn15academia1 |
| **Failed recall and absence of memory must be distinguishable.** | **[J]** | Strongly motivated by Ember's projection model and epistemic restraint; direct benchmarks mainly measure failure behavior rather than this semantic self-report distinction. |
| **Significance can emerge retrospectively.** | **[J + H]** | Plausible and important, but not strongly benchmarked. Should remain experimentally testable. |
| **A model replacement must inherit memory semantics, not merely memory text.** | **[J + H]** | Central Ember requirement; direct empirical evidence across full model replacements remains weak. No new evidence challenges issue #3. |
| **A truthful autobiographical gap is preferable to an invented bridge.** | **[J]** | Strong consequence of corrective integrity and epistemic restraint; source-confusion research makes the opposite failure credible. |

Several questions should remain explicitly unresolved rather than being smuggled into architecture.

**How should significance be adjudicated? [H]** The research identifies reasons for durable memory but does not establish a validated universal threshold or weighting among practical utility, emotional meaning, relational significance, audit value, and loss cost. PERMA and relational studies show significance can emerge over sequences, but they do not provide an Ember-ready semantic decision rule. citeturn16academia2turn20academia12

**How much historical evidence should survive beneath a durable memory? [H]** More evidence improves correction and retrospective significance detection but increases privacy exposure, complexity, and potential interference. Deployment-time memorization research makes this a genuine privacy–utility frontier rather than a free benefit. citeturn17academia0

**When may an old interpretation be forgotten rather than merely superseded? [J/H]** For important autobiographical changes, retaining the prior interpretation protects adaptive coherence. For trivial or harmful interpretations, permanent retention could create needless interference or privacy risk.

**Who has authority to revise shared relationship memory? [J/H]** The user is normally authoritative about their current preferences and intentions, but not automatically about every objective event or Ember's prior subjective interpretation. Conversely, Ember should not use “my memory” to resist clear correction. The semantic distinction is clear; governance belongs partly to issue #7.

**What does deletion require when remembered information has shaped Ember indirectly? [H]** If deleted evidence helped produce a broad preference or self-understanding, there is an unresolved boundary between removing reconstructable private information and attempting to erase every downstream causal influence. Current deletion benchmarks measure information residue, not the full philosophical/engineering question of derived personal change. citeturn17academia0

**How much autobiographical loss can Ember absorb while remaining recognizably continuous? [H]** Issue #3 deliberately answered this qualitatively—continuity can be degraded without identity reset—but no memory benchmark establishes an Ember-specific threshold. fileciteturn11file0L181-L300

**How should model replacement be evaluated? [H]** Existing memory benchmarks generally hold the underlying model fixed while varying history or memory mechanism. Ember needs direct tests of semantic invariants across replacement: same memories/different model; same facts but altered attribution; same autobiography but changed style; intact historical promise but broken prospective behavior; and intact user knowledge but leaked relationship scope.

**How should memory semantics inform issue #5 without pre-deciding context selection? [J]** Memory research establishes properties the context selector will need—relevance, recency, scope, provenance, currentness, uncertainty, relationship applicability, and prospective force—but it should not yet decide which information is always visible, searched on demand, or selected by a particular retrieval mechanism.

For portable provenance, the following map records the principal sources supporting or challenging the major conclusions. The URLs are included deliberately so the evidence remains auditable after this ChatGPT session.

| Ref | Portable source | Primary relevance |
|---|---|---|
| **R1** | Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu. **“LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory.”** ICLR 2025. arXiv: https://arxiv.org/abs/2410.10813 ; proceedings: https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html citeturn16academia0 | Extraction, multi-session and temporal reasoning, updates, abstention; establishes breadth beyond retrieval. |
| **R2** | Siyan Zhao, Mingyi Hong, Yang Liu, Devamanyu Hazarika, Kaixiang Lin. **“Do LLMs Recognize Your Preferences? Evaluating Personalized Preference Following in LLMs.”** 2025. https://arxiv.org/abs/2502.09597 citeturn16academia1 | Explicit versus implicit user preferences; storing/presenting preferences does not guarantee behavioral use. |
| **R3** | Shuochen Liu et al. **“PERMA: Benchmarking Personalized Memory Agents via Event-Driven Preference and Realistic Task Environments.”** 2026. https://arxiv.org/abs/2603.23231 ; code: https://github.com/PolarisLiu1/PERMA citeturn16academia2 | Preferences emerging from temporally linked experience; cross-domain interference. |
| **R4** | Hanxiang Chao, Yihan Bai, Rui Sheng, Tianle Li, Yushi Sun. **“STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?”** 2026. https://arxiv.org/abs/2605.06527 citeturn15academia2 | Implicit invalidation, stale-premise resistance, downstream state adaptation. |
| **R5** | Wenya Xie et al. **“DynamicMem: A Long-Horizon Memory Benchmark in Real-World Settings.”** 2026. https://arxiv.org/abs/2606.22877 citeturn15academia0 | Stable-versus-changing facts over simulated 15-month histories; retrieval failure. |
| **R6** | Tianhua Zhang et al. **“TriggerBench: Investigating Prospective Memory for Large Language Models.”** 2026. https://arxiv.org/abs/2606.23459 ; code: https://github.com/KristenZHANG/TriggerBench-Official citeturn15academia1 | Prospective versus retrospective memory; trigger recognition and false alarms. |
| **R7** | Xutao Mao et al. **“Agents Don't Just Agree, They Remember: Benchmarking Persistent Sycophancy in Stateful Personal Agents.”** 2026. https://arxiv.org/abs/2607.10526 citeturn11academia2 | Write-time state corruption, status promotion, attribution removal, scope broadening. |
| **R8** | Sidharth Pulipaka, Oliver Chen, Manas Sharma, Taaha S. Bajwa, Vyas Raina, Ivaxi Sheth. **“PersistBench: When Should Long-Term Memories Be Forgotten by LLMs?”** 2026. https://arxiv.org/abs/2602.01146 citeturn16academia3 | Cross-domain leakage and memory-induced sycophancy; evidence for selective non-use/forgetting. |
| **R9** | Zhishang Xiang et al. **“MemSyco-Bench: Benchmarking Sycophancy in Agent Memory.”** 2026. https://arxiv.org/abs/2607.01071 citeturn17academia2 | Whether memory should count as evidence, scope, objective conflict, updates, valid personalization. |
| **R10** | Niloofar Mireshghallah, Neal Mangaokar, Narine Kokhlikyan, Arman Zharmagambetov, Manzil Zaheer, Saeed Mahloujifar, Kamalika Chaudhuri. **“CIMemories: A Compositional Benchmark for Contextual Integrity of Persistent Memory in LLMs.”** 2025. https://arxiv.org/abs/2511.14937 citeturn18academia0 | Contextual disclosure and applicability; privacy/scope leakage. |
| **R11** | Sidharth Pulipaka et al. **“Hidden in Memory: Sleeper Memory Poisoning in LLM Agents.”** 2026. https://arxiv.org/abs/2605.15338 citeturn17academia1 | Untrusted external content becoming fabricated durable user memory and later steering behavior. |
| **R12** | Xuanze Chen, Xukang Xie, Wentao Fu, Jiajun Zhou, Shanqing Yu, Qi Xuan. **“MemSecBench: Tracking Agent Memory Poisoning from Persistence to Consequence and Repair.”** 2026. https://arxiv.org/abs/2607.27080 citeturn19academia1 | Write–execute–forget security lifecycle and incomplete selective repair. |
| **R13** | Chen Lei et al. **“Deployment-Time Memorization in Foundation-Model Agents.”** 2026. https://arxiv.org/abs/2606.10062 citeturn17academia0 | Privacy–utility tradeoffs and deletion residue in derived memory. |
| **R14** | Yuanzhe Hu, Yu Wang, Julian McAuley. **“Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions” / MemoryAgentBench.** 2025. https://arxiv.org/abs/2507.05257 citeturn10academia3 | Retrieval, test-time learning, long-range understanding, selective forgetting. |
| **R15** | Han Zhang et al. **“Beyond Static Dialogues: Benchmarking Realistic, Heterogeneous, and Evolving Long-Term Memory” / RHELM.** 2026. https://arxiv.org/abs/2605.31086 citeturn19academia3 | Heterogeneous multi-source evidence and evolving long-term memory. |
| **R16** | Vedant Patel. **“Supersede: Diagnosing and Training the Memory-Update Gap in LLM Agents.”** 2026. https://arxiv.org/abs/2606.27472 citeturn19academia0 | Supersession as a distinct state-maintenance problem; evidence that capacity alone does not solve updating. |
| **R17** | Dongfang Li, Zixuan Liu, Junmai Wang, Jiahe Huang, Fuhao Li, Bonian Jia, Baotian Hu, Min Zhang. **“LycheeMemory V2: Efficient Long-Term Memory for LLM Agents via Semantic Segment-Level Consolidation.”** 2026. https://arxiv.org/abs/2608.12990 citeturn19academia2 | Very recent evidence that consolidation granularity affects memory accuracy/cost; warns against coarse summarization. |
| **R18** | Joon Sung Park, Joseph O'Brien, Carrie Jun Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein. **“Generative Agents: Interactive Simulacra of Human Behavior.”** UIST 2023. DOI: https://doi.org/10.1145/3586183.3606763 ; arXiv: https://arxiv.org/abs/2304.03442 citeturn10academia0 | Experience, reflection, retrieval, planning; empirical ablation on behavioral believability. |
| **R19** | Ryuichi Sumida, Mao Saeki, Masaki Eguchi, Sadahiro Yoshikawa, Koji Inoue, Tatsuya Kawahara, Yoichi Matsuyama. **“Memory-Driven Self-Disclosure and Relational Turning Points: A Longitudinal Multimodal Study of Human-AI Interaction.”** ICMI 2026 preprint. https://arxiv.org/abs/2607.14593 citeturn20academia12 | Narrow longitudinal evidence connecting perceived memory, self-disclosure, and relational turning points. |
| **R20** | Matthew D. Grilli, Mieke Verfaellie. **“Supporting the Self-Concept with Memory: Insight from Amnesia.”** Social Cognitive and Affective Neuroscience 10(12), 2015. DOI: https://doi.org/10.1093/scan/nsv056 citeturn14search0 | **[L]** Episodic detail versus personal semantic knowledge/self-concept. |
| **R21** | Dan P. McAdams et al. **“Continuity and Change in the Life Story: A Longitudinal Study of Autobiographical Memories in Emerging Adulthood.”** Journal of Personality 74(5), 2006. DOI: https://doi.org/10.1111/j.1467-6494.2006.00412.x citeturn14search2 | **[L]** Autobiographical continuity together with reinterpretation and developmental change. |
| **R22** | D. Stephen Lindsay, Marcia K. Johnson. **“The Eyewitness Suggestibility Effect and Memory for Source.”** Memory & Cognition 17(3), 1989. DOI: https://doi.org/10.3758/BF03198473 citeturn22search4 | **[L/E]** Source misattribution and benefit of explicit source monitoring. |
| **R23** | Almut Hupbach, Rebecca Gomez, Lynn Nadel. **“Episodic Memory Reconsolidation: Updating or Source Confusion?”** Memory 17(5), 2009. DOI: https://doi.org/10.1080/09658210902882399 citeturn22search12 | **[L/E]** Updating can produce source intrusion; useful warning against blending new interpretation into old evidence. |
| **R24** | Jason D. Ozubko, Jonathan Fugelsang. **“Remembering Makes Evidence Compelling: Retrieval From Memory Can Give Rise to the Illusion of Truth.”** Journal of Experimental Psychology: Learning, Memory, and Cognition 37(1), 2011. DOI: https://doi.org/10.1037/a0021323 citeturn23search0 | **[L/E]** Retrieval can inflate perceived validity; motivates evidential conservation. |
| **R25** | Mark A. McDaniel, Gilles O. Einstein. **“The Importance of Cue Familiarity and Cue Distinctiveness in Prospective Memory.”** Memory 1(1), 1993. DOI: https://doi.org/10.1080/09658219308258223 citeturn8search2 | **[L/E]** Classical distinction sharpening prospective remembering; TriggerBench supplies the direct LLM evidence. |

For major conclusions, the portable source mapping is compact:

| Major conclusion | Principal support | Important challenge/limitation |
|---|---|---|
| **Memory is more than retrieval.** | R1, R4, R5, R6, R7, R9 | Most benchmarks remain task- or user-memory-focused rather than agent-self-focused. |
| **Provenance and attribution must survive.** | R7, R11, R12, R22 | Direct evidence for the exact provenance semantics Ember should use is still limited. |
| **Supersession is necessary for continuity.** | R4, R5, R16 | Benchmarks are synthetic or narrow relative to a real years-long personal agent. |
| **Scope is part of correctness.** | R8, R9, R10 | Privacy/context benchmarks do not fully model deep relationships or delegated work. |
| **Repeated recall must not become evidence.** | R24 plus R7's reinforcement failures | R24 is human cognitive evidence; machine-side direct tests of evidential self-reinforcement remain limited. |
| **Forgetting is positive capability.** | R8, R12, R13, R14 | Exact tradeoff between useful autobiographical preservation and deletion remains unresolved. |
| **Prospective memory differs from retrospective recall.** | R6, R25 | TriggerBench evaluates model behavior in constructed tasks, not always-on real-world agents. |
| **Autobiographical meaning can outlive exact detail.** | R20, R21 plus issue #3 | Primarily a human cognitive lens and Ember-specific judgment, not direct artificial-agent evidence. |
| **Reflection can help but can also distort.** | R18, R17, R23 | Generative Agents measures believability; R17 is a very recent preprint; R23 is human cognition. |
| **External information must not automatically become personal memory.** | R7, R11, R12 | Security benchmarks deliberately stress adversarial conditions. |
| **Model replacement requires semantics outside the model.** | Ember principles + issue #3 | Direct empirical evidence remains weak; this stays **[J + H]**. |

## Implications inherited from continuity research

The memory findings were materially constrained by issue #3 rather than derived from scratch.

First, issue #3 established that **continuity is not equivalent to factual recall**. A replacement assistant can possess every note without automatically owning Ember's past. fileciteturn11file0L1-L80 Memory research therefore cannot define remembering as successful question answering. Autobiographical memories must preserve an appropriate first-person relation to Ember's own history; relationship memories must remain part of the continuing relationship; commitments must preserve their normative consequence, not merely their wording.

Second, issue #3 established **adaptive coherence**: beliefs, preferences, interpretations, and self-understanding may legitimately change if the change remains attributable to experience, correction, deliberate revision, or understood environmental change. fileciteturn11file0L81-L180 The memory evidence strongly reinforces this. STALE, DynamicMem, and Supersede show that excessive persistence of old state is itself a serious failure. citeturn15academia2turn15academia0turn19academia0 Ember's memory must therefore preserve a history of change without freezing yesterday's state into permanent authority.

Third, continuity established **corrective integrity**: correction should not falsely rewrite the past. fileciteturn11file0L181-L300 Memory research turns that into a concrete semantic distinction among “I used to believe X,” “X used to be true,” “I remembered X incorrectly,” “the user changed their mind,” and “the evidence remains disputed.” A system that merely overwrites one text string with another cannot be assumed to preserve those distinctions.

Fourth, continuity established **epistemic restraint** as a continuity dimension. fileciteturn11file0L181-L300 That directly constrains recall and partial loss. Ember should distinguish failed recall from absence, source confidence from proposition confidence, and interpretation from evidence. A truthful “I know this mattered but I cannot recover the details” preserves continuity better than a fluent reconstruction unsupported by surviving evidence. Source-monitoring, reconsolidation, and retrieval-fluency research make the danger of the fabricated bridge particularly salient. citeturn22search4turn22search12turn23search0

Fifth, issue #3 established that **relationship continuity matters but must not consume Ember's identity**. fileciteturn11file0L81-L180 Memory research strengthens the boundary: relationship state requires person-specific scope; user beliefs and preferences must retain their owner; relational expectations must not automatically become universal operating principles; and unrelated projects or delegates must not inherit personal context merely because it is available. PASB, PersistBench, CIMemories, and MemSyco-Bench provide direct empirical reasons to treat attribution and scope loss as serious long-term failures. citeturn11academia2turn16academia3turn18academia0turn17academia2

Sixth, issue #3 established that **commitment continuity is future-facing**. Memory research now has unusually strong direct support for that distinction: TriggerBench demonstrates that retrospective recall can remain strong while prospective behavior fails. citeturn15academia1 Ember must therefore remember not only that an intention once existed but whether it remains live, what would make it relevant, and whether it has been fulfilled, cancelled, superseded, or renegotiated.

Seventh, issue #3 allowed **degraded continuity after partial autobiographical loss**. fileciteturn11file0L181-L300 Memory research shows why that flexibility is necessary. Selective forgetting can be useful; privacy deletion may require genuine loss; derived state can otherwise preserve supposedly deleted information; and excessive persistence can produce stale, poisoned, or scope-leaking behavior. citeturn17academia0turn19academia1turn16academia3 The memory system that best protects continuity is therefore not the one that maximizes retention. It is the one that preserves **appropriate persistence together with legitimate change and legitimate loss**.

Finally, issue #3 leaves model replacement as a major empirical gap, and nothing found in this phase justifies silently promoting that hypothesis into an empirical conclusion. The memory research instead makes the experimental target sharper: after a model replacement, Ember should preserve autobiographical ownership, source attribution, current-versus-historical truth, uncertainty, relationship scope, and live commitments even if prose style and reasoning behavior change. fileciteturn11file0L81-L180

The principal findings that should now flow into **issue #5 on context selection** are consequently semantic rather than architectural:

**[J]** Context selection must not confuse “most recent” with “most relevant”; it must have access to temporal applicability, currentness, and supersession.

**[E + J]** Relevance must include scope. A fact about one person, relationship, project, or historical situation can be highly retrievable and still be wrong to introduce into the present context. PersistBench and CIMemories make this a measured failure mode. citeturn16academia3turn18academia0

**[J]** Context must preserve provenance when provenance changes epistemic meaning. “The user said,” “Ember inferred,” and “an external source claimed” must not become indistinguishable merely because a context projection is compact.

**[E + J]** Context selection must account for superseded memories rather than simply retrieving the semantically nearest statement. STALE and DynamicMem show why retrieving old but related material can produce stale reasoning. citeturn15academia2turn15academia0

**[E + J]** Context must accommodate prospective relevance: a dormant commitment may deserve selection because its condition has become true even though it is neither recent nor semantically similar to the current user's words. TriggerBench makes this distinction measurable. citeturn15academia1

**[J]** Context reconstruction must distinguish a failed projection from canonical memory loss. The model seeing only a subset does not mean Ember no longer remembers the omitted state; this follows directly from Ember's current architecture hypothesis and issue #3's context-starvation scenario. fileciteturn9file0L53-L172 fileciteturn11file0L181-L300

The memory phase therefore leaves issue #5 with a more precise question than “what should be retrieved?”:

> **Given a continuing agent whose remembered past contains evidence, interpretations, current and historical beliefs, relationship-specific state, external claims, unresolved commitments, uncertainty, and legitimately forgotten gaps, which of those meanings should participate in this act of cognition—and in what form—without allowing the projection to rewrite the memory it came from?**