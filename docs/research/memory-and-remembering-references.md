# Memory and Remembering Evidence Map

This document is the portable evidence companion to [Memory and Remembering Semantics](memory-and-remembering.md).

The semantic note remains the canonical Ember-facing synthesis. This companion exists so that evidence labels such as **[E]**, **[C]**, **[J]**, **[H]**, and **[L]** remain inspectable outside the original ChatGPT Deep Research session.

The preserved [Deep Research artifact](source-material/memory-and-remembering-deep-research.md) contains the full research narrative and original ChatGPT-local citation markers. Those markers are intentionally retained as provenance but do not resolve on GitHub. The references below provide portable links for the principal sources behind the validated conclusions.

This is not intended to reproduce every source consulted during Deep Research. It records the sources that materially support, challenge, or sharpen the canonical memory conclusions.

## Evidence map for validated conclusions

| Canonical conclusion | Basis | Principal portable evidence | Interpretation for Ember |
|---|---|---|---|
| Remembering is a durable accountable relation to the past, not durable bytes. | **[C + J]** | Ember's [NanoBot](nanobot.md), [Hermes](hermes.md), [OpenClaw](openclaw.md), and [Letta](letta.md) reconnaissance; [R1 LongMemEval](#r1-longmemeval) | Mature systems converge on separating broad history from smaller persistent state, while benchmarks show useful long-term memory requires more than raw retrieval. The stronger semantic definition remains an Ember judgment. |
| History, memory, current belief, and context must remain conceptually distinct. | **[C + J]** | Existing system notes; [R4 STALE](#r4-stale), [R5 DynamicMem](#r5-dynamicmem) | Persistence pressure repeatedly separates historical availability, current authority, and active context. |
| A memory's source and scope can change what it means and how it may be used. | **[E + C + J]** | [R7 PASB](#r7-persistent-agent-sycophancy), [R8 PersistBench](#r8-persistbench), [R10 CIMemories](#r10-cimemories), [R11 Hidden in Memory](#r11-hidden-in-memory), [R12 MemSecBench](#r12-memsecbench) | Attribution loss, scope broadening, contextual leakage, and poisoning all produce measured downstream failures. |
| Ember must distinguish user testimony, her own inference, external claims, delegate reports, direct observations, and her own conclusions. | **[E + J]** | [R7 PASB](#r7-persistent-agent-sycophancy), [R11 Hidden in Memory](#r11-hidden-in-memory), [R22 Lindsay and Johnson](#r22-the-eyewitness-suggestibility-effect-and-memory-for-source) | The source of a proposition changes what Ember is entitled to claim and how strongly she should trust or disclose it. |
| An experience can remain autobiographically meaningful after exact detail is lost. | **[L + J]** | [R20 Grilli and Verfaellie](#r20-supporting-the-self-concept-with-memory), [R21 McAdams et al.](#r21-continuity-and-change-in-the-life-story), continuity research | Human evidence shows dissociation between detailed episodic access and more durable self-related knowledge. Ember uses this only as a lens. |
| Summaries and reflections are derived interpretations and must not become independent evidence. | **[E/L + J]** | [R17 LycheeMemory V2](#r17-lycheememory-v2), [R23 Hupbach et al.](#r23-episodic-memory-reconsolidation), [R24 Ozubko and Fugelsang](#r24-remembering-makes-evidence-compelling) | Consolidation granularity affects retained evidence; cognitive work warns that later retrieval and reinterpretation can distort source or perceived truth. |
| Repeated recall must not increase epistemic confidence without new evidence. | **[E/L + J]** | [R24 Ozubko and Fugelsang](#r24-remembering-makes-evidence-compelling) | Direct agent-side evidence is limited, but the semantic anti-feedback rule follows from evidential conservation. |
| Current truth and historical truth must coexist. | **[E + J]** | [R1 LongMemEval](#r1-longmemeval), [R4 STALE](#r4-stale), [R5 DynamicMem](#r5-dynamicmem), [R16 Supersede](#r16-supersede) | Updating is not simply appending newer text. Systems must stop old state from governing the present without rewriting history. |
| Correction should not automatically erase that Ember previously believed or remembered differently. | **[E + J]** | [R4 STALE](#r4-stale), [R5 DynamicMem](#r5-dynamicmem), [R16 Supersede](#r16-supersede), continuity research | Corrective integrity requires supersession without false autobiographical rewriting. Privacy deletion is an explicit exception. |
| Forgetting is a positive memory operation, not merely failure. | **[E + J]** | [R8 PersistBench](#r8-persistbench), [R12 MemSecBench](#r12-memsecbench), [R13 Deployment-Time Memorization](#r13-deployment-time-memorization), [R14 MemoryAgentBench](#r14-memoryagentbench) | Selective forgetting, privacy deletion, repair, and preventing stale or cross-domain reuse are part of memory quality. |
| Privacy deletion must account for information recoverable from derived memory. | **[E + J]** | [R13 Deployment-Time Memorization](#r13-deployment-time-memorization) | Deleting raw material alone can leave reconstructable information in derived state. |
| A fact can be correctly remembered yet semantically wrong to use in the present situation. | **[E + J]** | [R4 STALE](#r4-stale), [R8 PersistBench](#r8-persistbench), [R9 MemSyco-Bench](#r9-memsyco-bench), [R10 CIMemories](#r10-cimemories) | Scope and current applicability are part of correctness, not optional retrieval metadata. |
| Relationship memory must remain relationship-scoped and must not absorb the user's state into Ember's identity. | **[E + J]** | [R7 PASB](#r7-persistent-agent-sycophancy), [R10 CIMemories](#r10-cimemories), [R19 Sumida et al.](#r19-memory-driven-self-disclosure-and-relational-turning-points), continuity research | Leakage and sycophancy evidence support scope boundaries; longitudinal HCI evidence offers narrower support for relationship significance. |
| External research is evidence first; it becomes personal memory only through the experience or durable change it caused in Ember. | **[E + J]** | [R11 Hidden in Memory](#r11-hidden-in-memory), [R12 MemSecBench](#r12-memsecbench) | External content must not acquire personal-memory authority merely because it was read, summarized, or recalled. |
| Commitment memory has a current normative dimension distinct from remembering the historical promise. | **[E + C + J]** | [R6 TriggerBench](#r6-triggerbench), Ember's [OpenClaw](openclaw.md) reconnaissance, continuity research | Prospective remembering is behaviorally distinct from retrospective recall. |
| Failed recall and absence of memory must be distinguishable. | **[J]** | Ember's context-as-projection model; [R1 LongMemEval](#r1-longmemeval), [R15 RHELM](#r15-rhelm) as adjacent retrieval evidence | Benchmarks show retrieval can fail despite relevant history existing. The self-report distinction is an Ember semantic judgment. |
| Significance can emerge retrospectively. | **[J + H]** | [R3 PERMA](#r3-perma), [R19 Sumida et al.](#r19-memory-driven-self-disclosure-and-relational-turning-points) | Sequences can reveal patterns or turning points later, but no benchmark establishes an Ember-ready significance rule. |
| A model replacement must inherit memory semantics, not merely memory text. | **[J + H]** | Ember principles and continuity research | This remains a central Ember requirement and experimental target. Direct empirical validation across full model replacement is weak. |
| A truthful autobiographical gap is preferable to an invented bridge. | **[J]** | Continuity research; [R22 Lindsay and Johnson](#r22-the-eyewitness-suggestibility-effect-and-memory-for-source), [R23 Hupbach et al.](#r23-episodic-memory-reconsolidation) as warning lenses | Epistemic restraint should prefer explicit uncertainty over fluent reconstruction unsupported by surviving evidence. |

## Principal research references

### R1 LongMemEval

**Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu.** *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory.* ICLR 2025.

- Paper: https://arxiv.org/abs/2410.10813
- Proceedings: https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html
- Code: https://github.com/xiaowu0162/LongMemEval

Relevant because it evaluates information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention over long interaction histories. It demonstrates that long-term memory is broader than nearest-fragment retrieval.

### R2 PrefEval

**Siyan Zhao, Mingyi Hong, Yang Liu, Devamanyu Hazarika, Kaixiang Lin.** *Do LLMs Recognize Your Preferences? Evaluating Personalized Preference Following in LLMs.* 2025.

- Paper: https://arxiv.org/abs/2502.09597
- Project: https://prefeval.github.io/

Relevant because it evaluates explicit and implicit preference following and shows that making preference information available does not guarantee that later behavior will use it appropriately. It focuses on user personalization rather than agent-self memory.

### R3 PERMA

**Shuochen Liu et al.** *PERMA: Benchmarking Personalized Memory Agents via Event-Driven Preference and Realistic Task Environments.* 2026.

- Paper: https://arxiv.org/abs/2603.23231
- Code: https://github.com/PolarisLiu1/PERMA

Relevant because it models preferences emerging from temporally linked events rather than only from explicit declarations. It supports the idea that significance or durable understanding can emerge across sequences.

### R4 STALE

**Hanxiang Chao, Yihan Bai, Rui Sheng, Tianle Li, Yushi Sun.** *STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?* 2026.

- Paper: https://arxiv.org/abs/2605.06527

Relevant because it isolates implicit invalidation: later evidence can make an earlier memory stale without directly saying the earlier proposition is false. Retrieving newer evidence is not sufficient if the system still reasons from obsolete state.

### R5 DynamicMem

**Wenya Xie et al.** *DynamicMem: A Long-Horizon Memory Benchmark in Real-World Settings.* 2026.

- Paper: https://arxiv.org/abs/2606.22877

Relevant because it evaluates synthetic user histories spanning fifteen months and tests the difficult combination of retaining stable attributes while replacing changing ones. The paper reports that retrieval is a dominant source of observed failures in its setup.

### R6 TriggerBench

**Tianhua Zhang et al.** *TriggerBench: Investigating Prospective Memory for Large Language Models.* 2026.

- Paper: https://arxiv.org/abs/2606.23459
- Code: https://github.com/KristenZHANG/TriggerBench-Official

Relevant because it explicitly separates prospective memory from retrospective recall. A system may remember an intention when asked yet fail to notice when the future condition should make that intention behaviorally relevant.

### R7 Persistent Agent Sycophancy

**Xutao Mao et al.** *Agents Don't Just Agree, They Remember: Benchmarking Persistent Sycophancy in Stateful Personal Agents.* 2026.

- Paper: https://arxiv.org/abs/2607.10526
- Project: https://henrymao2004.github.io/agent-sycophancy/
- Code: https://github.com/henrymao2004/agent-sycophancy

Relevant because it traces questionable user claims through acceptance, durable state writing, and later reuse. It identifies persistent-state failures including status promotion, attribution removal, and scope broadening.

### R8 PersistBench

**Sidharth Pulipaka, Oliver Chen, Manas Sharma, Taaha S. Bajwa, Vyas Raina, Ivaxi Sheth.** *PersistBench: When Should Long-Term Memories Be Forgotten by LLMs?* 2026.

- Paper: https://arxiv.org/abs/2602.01146

Relevant because it measures cross-domain leakage and memory-induced sycophancy. It directly supports the conclusion that a remembered fact can be true yet wrong to apply in the current situation.

### R9 MemSyco-Bench

**Zhishang Xiang et al.** *MemSyco-Bench: Benchmarking Sycophancy in Agent Memory.* 2026.

- Paper: https://arxiv.org/abs/2607.01071

Relevant because it asks whether persistent memory should count as factual evidence, where it applies, how it should behave under objective conflict, and whether it can update without losing useful personalization.

### R10 CIMemories

**Niloofar Mireshghallah, Neal Mangaokar, Narine Kokhlikyan, Arman Zharmagambetov, Manzil Zaheer, Saeed Mahloujifar, Kamalika Chaudhuri.** *CIMemories: A Compositional Benchmark for Contextual Integrity of Persistent Memory in LLMs.* 2025.

- Paper: https://arxiv.org/abs/2511.14937

Relevant because it measures inappropriate disclosure and reuse of persistent user attributes across contexts. It supports treating contextual applicability and disclosure scope as part of memory correctness.

### R11 Hidden in Memory

**Sidharth Pulipaka et al.** *Hidden in Memory: Sleeper Memory Poisoning in LLM Agents.* 2026.

- Paper: https://arxiv.org/abs/2605.15338

Relevant because it demonstrates an adversarial path in which untrusted external content is transformed into fabricated durable user memory and later affects agent behavior.

### R12 MemSecBench

**Xuanze Chen, Xukang Xie, Wentao Fu, Jiajun Zhou, Shanqing Yu, Qi Xuan.** *MemSecBench: Tracking Agent Memory Poisoning from Persistence to Consequence and Repair.* 2026.

- Paper: https://arxiv.org/abs/2607.27080

Relevant because it evaluates memory poisoning across write, downstream execution, and attempted repair. It supports provenance-aware promotion and the need to invalidate dependent durable state during security repair.

### R13 Deployment-Time Memorization

**Chen Lei et al.** *Deployment-Time Memorization in Foundation-Model Agents.* 2026.

- Paper: https://arxiv.org/abs/2606.10062

Relevant because it studies privacy-utility tradeoffs and shows that deleting raw material can leave information recoverable through derived memory. It directly supports dependency-aware forgetting semantics.

### R14 MemoryAgentBench

**Yuanzhe Hu, Yu Wang, Julian McAuley.** *Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions.* 2025.

- Paper: https://arxiv.org/abs/2507.05257

Relevant because it treats retrieval, test-time learning, long-range understanding, and selective forgetting as distinct competencies. The taxonomy is a research proposal, not an Ember ontology.

### R15 RHELM

**Han Zhang et al.** *Beyond Static Dialogues: Benchmarking Realistic, Heterogeneous, and Evolving Long-Term Memory.* 2026.

- Paper: https://arxiv.org/abs/2605.31086

Relevant because it combines dialogue with temporally synchronized documents and emails, exposing weaknesses in multi-source aggregation and contextual reasoning. It supports preserving source identity rather than collapsing heterogeneous evidence into one recollection.

### R16 Supersede

**Vedant Patel.** *Supersede: Diagnosing and Training the Memory-Update Gap in LLM Agents.* 2026.

- Paper: https://arxiv.org/abs/2606.27472

Relevant because it isolates supersession as a distinct state-maintenance problem and reports that simply increasing memory capacity does not remove the update gap.

### R17 LycheeMemory V2

**Dongfang Li, Zixuan Liu, Junmai Wang, Jiahe Huang, Fuhao Li, Bonian Jia, Baotian Hu, Min Zhang.** *LycheeMemory V2: Efficient Long-Term Memory for LLM Agents via Semantic Segment-Level Consolidation.* 2026.

- Paper: https://arxiv.org/abs/2608.12990

Relevant because it reports improvements from more coherent consolidation granularity and explicitly warns that coarse summaries can discard contextual evidence. It is a very recent preprint and should be read conservatively.

### R18 Generative Agents

**Joon Sung Park, Joseph O'Brien, Carrie Jun Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein.** *Generative Agents: Interactive Simulacra of Human Behavior.* UIST 2023.

- DOI: https://doi.org/10.1145/3586183.3606763
- Paper: https://arxiv.org/abs/2304.03442

Relevant because ablations in the simulated-agent environment found that observation, planning, and reflection each contributed to perceived behavioral believability. Believability is not treated as truth, continuity, or safe memory.

### R19 Memory-Driven Self-Disclosure and Relational Turning Points

**Ryuichi Sumida, Mao Saeki, Masaki Eguchi, Sadahiro Yoshikawa, Koji Inoue, Tatsuya Kawahara, Yoichi Matsuyama.** *Memory-Driven Self-Disclosure and Relational Turning Points: A Longitudinal Multimodal Study of Human-AI Interaction.* ICMI 2026 preprint.

- Paper: https://arxiv.org/abs/2607.14593

Relevant because it offers narrow longitudinal evidence connecting perceived memory, later self-disclosure, and relational turning points. The sample and setting are limited, so it should not be generalized into a universal theory of relationship memory.

### R20 Supporting the Self-Concept with Memory

**Matthew D. Grilli, Mieke Verfaellie.** *Supporting the Self-Concept with Memory: Insight from Amnesia.* Social Cognitive and Affective Neuroscience 10(12), 2015.

- DOI: https://doi.org/10.1093/scan/nsv056
- PubMed: https://pubmed.ncbi.nlm.nih.gov/25964501/

Used as a limited cognitive lens because personal semantic knowledge can support aspects of self-concept despite impaired episodic access. It does not prescribe an artificial memory mechanism.

### R21 Continuity and Change in the Life Story

**Dan P. McAdams et al.** *Continuity and Change in the Life Story: A Longitudinal Study of Autobiographical Memories in Emerging Adulthood.* Journal of Personality 74(5), 2006.

- DOI: https://doi.org/10.1111/j.1467-6494.2006.00412.x
- PubMed: https://pubmed.ncbi.nlm.nih.gov/16958706/

Used as a human-side lens because autobiographical narratives can preserve continuity while changing interpretation over time. It supports adaptive coherence, not literal biological imitation.

### R22 The Eyewitness Suggestibility Effect and Memory for Source

**D. Stephen Lindsay, Marcia K. Johnson.** *The Eyewitness Suggestibility Effect and Memory for Source.* Memory & Cognition 17(3), 1989.

- DOI: https://doi.org/10.3758/BF03198473
- PubMed: https://pubmed.ncbi.nlm.nih.gov/2725271/

Used as a source-monitoring lens. It supports the general warning that remembering content while losing where it came from can materially distort later judgment.

### R23 Episodic Memory Reconsolidation

**Almut Hupbach, Rebecca Gomez, Lynn Nadel.** *Episodic Memory Reconsolidation: Updating or Source Confusion?* Memory 17(5), 2009.

- DOI: https://doi.org/10.1080/09658210902882399
- PubMed: https://pubmed.ncbi.nlm.nih.gov/19468955/

Used as a limited warning lens because reactivated memories can incorporate newer material through source confusion. Ember's conclusion is deliberately anti-literal: reinterpretation should not silently rewrite original evidence.

### R24 Remembering Makes Evidence Compelling

**Jason D. Ozubko, Jonathan Fugelsang.** *Remembering Makes Evidence Compelling: Retrieval From Memory Can Give Rise to the Illusion of Truth.* Journal of Experimental Psychology: Learning, Memory, and Cognition 37(1), 2011.

- DOI: https://doi.org/10.1037/a0021323
- PubMed: https://pubmed.ncbi.nlm.nih.gov/21058878/

Used as a cognitive warning lens because retrieval itself can increase perceived truth. It motivates Ember's evidential-conservation rule: repeated recall is not new evidence.

### R25 Cue Familiarity and Cue Distinctiveness in Prospective Memory

**Mark A. McDaniel, Gilles O. Einstein.** *The Importance of Cue Familiarity and Cue Distinctiveness in Prospective Memory.* Memory 1(1), 1993.

- DOI: https://doi.org/10.1080/09658219308258223
- PubMed: https://pubmed.ncbi.nlm.nih.gov/7584257/

Used as a classical cognitive lens for the retrospective/prospective distinction. TriggerBench supplies the direct LLM-side evidence relevant to Ember.

## Reading the evidence conservatively

The references intentionally mix several evidence types because memory semantics crosses several boundaries:

- long-term-memory benchmarks test extraction, temporal reasoning, updating, retrieval, and selective forgetting;
- personalization benchmarks test explicit and inferred user preferences;
- persistent-agent evaluations expose write-time corruption, sycophancy, scope leakage, and attribution loss;
- security work tests poisoning persistence, downstream consequences, repair, and deletion residue;
- HCI work provides limited evidence about remembered relationship history and relational turning points;
- cognitive research supplies lenses for autobiographical meaning, source monitoring, reconsolidation, retrieval-induced truth effects, and prospective memory;
- existing systems show engineering convergence around separating history, curated memory, active context, project/user state, and future-facing intentions.

None of these bodies of work directly validates Ember's complete working definition.

The canonical note therefore keeps stronger Ember-specific claims visibly marked as **[J]** or **[H]**. In particular:

- a universal significance rule remains unvalidated;
- the exact semantics of authority over shared relationship memory remain unresolved;
- the boundary of downstream deletion after private evidence shaped Ember indirectly remains unresolved;
- no benchmark establishes how much autobiographical loss Ember can absorb;
- continuity across full underlying-model replacement remains an experimental target rather than an empirical conclusion.
