# Context Selection and Cognitive Framing Evidence Map

This document is the portable evidence companion to [Context Selection and Cognitive Framing Semantics](context-selection-and-cognitive-framing.md).

The semantic note remains the canonical Ember-facing synthesis. This companion exists so that evidence labels such as **[E]**, **[C]**, **[J]**, **[H]**, and **[L]** remain inspectable outside the originating Deep Research session.

The preserved [Deep Research artifact](source-material/context-selection-and-cognitive-framing-deep-research.md) contains the full research narrative and research-session citation markers. Those markers are provenance, not a portable bibliography. The references below provide durable links for the principal sources behind the validated conclusions.

This map deliberately does not duplicate the full continuity and memory bibliographies. Their evidence maps remain inherited inputs:

- [Continuity and Identity Evidence Map](continuity-and-identity-references.md)
- [Memory and Remembering Evidence Map](memory-and-remembering-references.md)

## Evidence map for validated conclusions

| Canonical conclusion | Basis | Principal portable evidence | Interpretation for Ember |
|---|---|---|---|
| Context is a temporary cognitive projection rather than canonical persistent state. | **[C + J]** | Ember system notes for [NanoBot](nanobot.md), [Hermes](hermes.md), [OpenClaw](openclaw.md), and [Letta](letta.md); inherited continuity and memory research | Mature systems converge on separating broad persistent/history state from a smaller active view. The stronger semantic boundary is an Ember judgment inherited from #3 and #4. |
| Context has no independent epistemic authority. | **[J]** | Inherited memory evidence on provenance, attribution, repeated recall, and derived summaries; [R16 Hidden in Memory](#r16-hidden-in-memory) | Presence in a model context is not evidence about truth or ownership. External or derived content can become dangerous if projection is allowed to promote it. |
| More context is not monotonically better, even when relevant information is present. | **[E + J]** | [R2 Du et al.](#r2-context-length-alone-hurts-llm-performance-despite-perfect-retrieval), [R3 Distracting Effect](#r3-the-distracting-effect), [R1 Lost in the Middle](#r1-lost-in-the-middle) | Larger windows change capacity and cost, not the semantic need for selection. |
| Nominal context-window size is not equivalent to dependable usable context. | **[E]** | [R4 RULER](#r4-ruler), [R5 LongBench v2](#r5-longbench-v2), [R6 LooGLE v2](#r6-loogle-v2) | Benchmark results vary by generation and task, but they consistently show that capacity claims and robust use of long input are different properties. |
| Position and ordering can materially alter reasoning, but the magnitude is model-dependent. | **[E + J]** | [R1 Lost in the Middle](#r1-lost-in-the-middle), [R7 Positional Failures](#r7-positional-failures-in-long-context-llms) | Ember should preserve semantic precedence and currentness independently of provider-specific placement tactics. |
| Relevance cannot be reduced to recency or semantic similarity. | **[E + J]** | [R8 STALE](#r8-stale), [R9 DynamicMem](#r9-dynamicmem), [R10 TriggerBench](#r10-triggerbench), [R3 Distracting Effect](#r3-the-distracting-effect) | Current applicability, causal dependence, scope, prospective triggers, contradiction, and consequence can matter more than textual closeness. |
| A semantically excellent retrieval result can still be wrong to introduce because it is stale. | **[E + J]** | [R8 STALE](#r8-stale), [R9 DynamicMem](#r9-dynamicmem) | Retrieval quality and context quality are distinct. Currentness is part of correctness. |
| Prospective relevance is behaviorally distinct from retrospective recall. | **[E + J]** | [R10 TriggerBench](#r10-triggerbench) | A commitment can become contextually relevant because its condition occurs, without recency or lexical overlap. |
| Correct context selection includes deliberate exclusion. | **[E + J]** | [R3 Distracting Effect](#r3-the-distracting-effect), [R14 CIMemories](#r14-cimemories) | Irrelevant, private, wrong-scope, stale, duplicate, or untrusted material can make cognition worse despite being true or retrievable. |
| Conflict should survive projection when it affects current reasoning. | **[E + J]** | [R8 STALE](#r8-stale), [R11 RHELM](#r11-rhelm) | Heterogeneous and evolving evidence creates failures when systems prematurely treat one state as settled. Ember should preserve disagreement, provenance, and uncertainty until legitimately resolved. |
| Recall depth should increase under contradiction, provenance sensitivity, uncertainty, autobiographical significance, or consequence. | **[E + J]** | [R8 STALE](#r8-stale), [R11 RHELM](#r11-rhelm), [R19 ECoRAG](#r19-ecorag) as an implementation-specific analogue | The exact retrieval strategy remains open, but evidence supports deeper inspection when lightweight context is insufficient to justify the cognition. |
| Reconstruction after restart should recover the current situation rather than recreate an old prompt. | **[J]** | Inherited continuity and memory semantics | Prompt order and transient retrieved material are episode-local. Continuity belongs to persistent lineage, relationships, commitments, beliefs, and owned history. |
| Compaction is lossy interpretation and can delete behaviorally governing information. | **[E + J]** | [R12 Parallel Context Compaction](#r12-parallel-context-compaction), [R13 Governance Decay](#r13-governance-decay) | A summary can retain topic continuity while losing constraints, provenance, conflict, or uncertainty that determine legitimate behavior. |
| Repeated compaction can plausibly create semantic drift. | **[E + H]** | [R12 Parallel Context Compaction](#r12-parallel-context-compaction), [R13 Governance Decay](#r13-governance-decay) | Lossiness is empirically supported; long-run mutation of relationship meaning, provenance, or uncertainty remains an Ember-specific experiment. |
| Privacy correctness is contextual and recipient-dependent. | **[E + L + J]** | [R14 CIMemories](#r14-cimemories), [R15 Multi-Agent Privacy](#r15-got-a-secret), [R21 Nissenbaum](#r21-privacy-as-contextual-integrity) | A fact can be true and useful to Ember yet inappropriate to expose to a delegate. |
| Delegation creates a distinct context boundary. | **[C + J]** | [Hermes](hermes.md), Ember principles, [R14 CIMemories](#r14-cimemories) | A delegate's appropriate context should be selected for its role rather than copied from Ember's own projection. |
| Least sufficient context is a useful delegation principle. | **[L + J]** | [R21 Nissenbaum](#r21-privacy-as-contextual-integrity), [R22 Saltzer and Schroeder](#r22-the-protection-of-information-in-computer-systems), [R14 CIMemories](#r14-cimemories) | Permission precedes compression and sufficiency precedes minimality. This is not a token-budget rule. |
| Retrieved external material must retain trust and provenance boundaries. | **[E + J]** | [R16 Hidden in Memory](#r16-hidden-in-memory), [R17 ReliabilityRAG](#r17-reliabilityrag) | Topical relevance must not silently confer instruction, trust, or durable-memory authority. |
| Retrieval ranking metrics do not fully capture downstream context quality. | **[E + J]** | [R18 CRUX](#r18-crux), [R3 Distracting Effect](#r3-the-distracting-effect), [R20 RASTeR](#r20-raster) | Ember should evaluate cognition quality, omission harm, inclusion harm, currentness, scope, provenance, privacy, and contradiction rather than retrieval recall alone. |
| Prompt/context caching changes economics and feasible lifetimes, not semantic relevance. | **[E + J]** | [R24 Provider caching documentation](#r24-provider-prompt-and-context-caching) plus [R2 Du et al.](#r2-context-length-alone-hurts-llm-performance-despite-perfect-retrieval) | Cheap reuse of a long prefix is not evidence that the prefix should influence every cognition. |
| A small active focus versus broad available information is a useful conceptual distinction, but human working-memory limits should not be imported literally. | **[L]** | [R23 Cowan](#r23-the-magical-number-4-in-short-term-memory) | Cognitive science supports the role distinction, not an Ember item-count limit. |
| A degraded but truthful projection is preferable to seamless invented continuity. | **[J]** | Inherited continuity/memory evidence on epistemic restraint and source monitoring; adjacent retrieval-failure benchmarks | Missing context should create bounded uncertainty, not fabricated memory or false claims of absence. |

## Principal research references

### R1 Lost in the Middle

**Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang.** *Lost in the Middle: How Language Models Use Long Contexts.* Transactions of the Association for Computational Linguistics 12, 2024, 157–173.

- DOI: https://doi.org/10.1162/tacl_a_00638
- Paper: https://arxiv.org/abs/2307.03172
- Proceedings: https://aclanthology.org/2024.tacl-1.9/

Relevant because it establishes strong position sensitivity in the evaluated generation of long-context models. It is foundational evidence, not a claim that all 2026 models have the same positional failure profile.

### R2 Context Length Alone Hurts LLM Performance Despite Perfect Retrieval

**Yufeng Du et al.** *Context Length Alone Hurts LLM Performance Despite Perfect Retrieval.* Findings of EMNLP 2025, pp. 23281–23298.

- DOI: https://doi.org/10.18653/v1/2025.findings-emnlp.1264
- Proceedings: https://aclanthology.org/2025.findings-emnlp.1264/

Relevant because the study reports performance degradation as input length increases even under controlled conditions designed to remove ordinary retrieval failures. The exact percentages are model- and task-specific; the durable conclusion is that unused context is not necessarily harmless.

### R3 The Distracting Effect

**Chen Amiraz, Florin Cuconasu, Simone Filice, Zohar Karnin.** *The Distracting Effect: Understanding Irrelevant Passages in RAG.* ACL 2025.

- DOI: https://doi.org/10.18653/v1/2025.acl-long.892
- Proceedings: https://aclanthology.org/2025.acl-long.892/

Relevant because it shows that irrelevant passages are heterogeneous: some distractors are materially more harmful than generic irrelevant content. This supports deliberate exclusion as a correctness concern rather than only a cost optimization.

### R4 RULER

**Cheng-Ping Hsieh et al.** *RULER: What's the Real Context Size of Your Long-Context Language Models?* 2024.

- Paper: https://arxiv.org/abs/2404.06654

Relevant because it expands simple needle retrieval into multi-needle, tracing, and aggregation tasks and demonstrates that advertised context length and robust usable context can diverge.

### R5 LongBench v2

**Yushi Bai et al.** *LongBench v2: Towards Deeper Understanding and Reasoning on Realistic Long-context Multitasks.* 2024.

- Paper: https://arxiv.org/abs/2412.15204

Relevant because it evaluates difficult long-context reasoning across document, dialogue, code, structured-data, and in-context-learning tasks over very long inputs. Results should be read as generation-specific rather than timeless rankings.

### R6 LooGLE v2

**Ziyuan He, Yuxuan Wang, Jiaqi Li, Kexin Liang, Muhan Zhang.** *LooGLE v2: Are LLMs Ready for Real World Long Dependency Challenges?* 2025.

- Paper: https://arxiv.org/abs/2510.22548

Relevant because it focuses on long-dependency tasks in real-world-like domains and reinforces that large nominal windows do not imply uniformly reliable use of long context.

### R7 Positional Failures in Long-Context LLMs

**Chuyifei Zhang, Hongyu Cui, Xiaowen Huang, Jitao Sang.** *Positional Failures in Long-Context LLMs: A Blind Spot in Reasoning Benchmarks.* 2026.

- Paper: https://arxiv.org/abs/2605.23170

Relevant because it re-examines position effects in newer model generations. It reports substantial variation across models and conditions, supporting the separation between durable Ember semantics and provider-specific presentation tactics.

### R8 STALE

**Hanxiang Chao, Yihan Bai, Rui Sheng, Tianle Li, Yushi Sun.** *STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?* 2026.

- Paper: https://arxiv.org/abs/2605.06527

Relevant because it isolates implicit invalidation: newer observations can make an old memory obsolete without directly negating it, and systems may continue reasoning from stale state despite updated evidence being available.

### R9 DynamicMem

**Wenya Xie et al.** *DynamicMem: A Long-Horizon Memory Benchmark in Real-World Settings.* 2026.

- Paper: https://arxiv.org/abs/2606.22877

Relevant because it evaluates changing and stable user attributes over synthetic long-horizon histories and reports substantial failure attributable to what memory retrieval supplies to cognition.

### R10 TriggerBench

**Tianhua Zhang et al.** *TriggerBench: Investigating Prospective Memory for Large Language Models.* 2026.

- Paper: https://arxiv.org/abs/2606.23459
- Code: https://github.com/KristenZHANG/TriggerBench-Official

Relevant because it separates retrospective memory from prospective activation. A model may be able to state an intention when asked yet fail to notice that the current situation should activate it.

### R11 RHELM

**Han Zhang et al.** *Beyond Static Dialogues: Benchmarking Realistic, Heterogeneous, and Evolving Long-Term Memory.* 2026.

- Paper: https://arxiv.org/abs/2605.31086

Relevant because it evaluates long-term memory under heterogeneous sources and changing state, making it useful evidence for conflict preservation, provenance, and currentness-sensitive reconstruction.

### R12 Parallel Context Compaction

**Musa Cim, Burak Topcu, Chita Das, Mahmut Taylan Kandemir.** *Parallel Context Compaction for Long-Horizon LLM Agent Serving.* 2026.

- Paper: https://arxiv.org/abs/2605.23296

Relevant because it treats summarization/compaction as inherently lossy and evaluates retained information as long histories grow. Its concrete compaction method is not an Ember recommendation.

### R13 Governance Decay

**Shiyang Chen.** *Governance Decay: How Context Compaction Silently Erases Safety Constraints in Long-Horizon LLM Agents.* 2026.

- Paper: https://arxiv.org/abs/2606.22528

Relevant because the synthetic evaluation reports that compaction can remove policy constraints while leaving enough task context for the agent to continue, producing downstream violations. Numerical results are benchmark-specific; the semantic warning is that topical continuity can survive while governing meaning disappears.

### R14 CIMemories

**Niloofar Mireshghallah, Neal Mangaokar, Narine Kokhlikyan, Arman Zharmagambetov, Manzil Zaheer, Saeed Mahloujifar, Kamalika Chaudhuri.** *CIMemories: A Compositional Benchmark for Contextual Integrity of Persistent Memory in LLMs.* 2025.

- Paper: https://arxiv.org/abs/2511.14937

Relevant because it explicitly varies whether persistent user attributes are appropriate for a given task. It supports the distinction between truth, usefulness, relevance, and legitimate disclosure.

### R15 Got a Secret?

**Aman Priyanshu, Supriti Vijay, Esha Pahwa.** *Got a Secret? LLM Agents Can't Keep It: Evaluating Privacy in Multi-Agent Systems.* 2026.

- Paper: https://arxiv.org/abs/2605.27766

Relevant because it evaluates privacy leakage in synthetic multi-agent interaction and reports that privacy instructions reduce but do not eliminate disclosure. It is direct pressure for context isolation between agents, though its environment is not a persistent personal assistant.

### R16 Hidden in Memory

**Sidharth Pulipaka et al.** *Hidden in Memory: Sleeper Memory Poisoning in LLM Agents.* 2026.

- Paper: https://arxiv.org/abs/2605.15338

Relevant because it demonstrates delayed attacks in which adversarial external content can influence persistent memory and later behavior. It supports preserving the provenance and trust status of retrieved material across context and memory boundaries.

### R17 ReliabilityRAG

**Zeyu Shen, Basileal Imana, Tong Wu, Chong Xiang, Prateek Mittal, Aleksandra Korolova.** *ReliabilityRAG: Effective and Provably Robust Defense for RAG-based Web-Search.* 2025.

- Paper: https://arxiv.org/abs/2509.23519

Relevant as adversarial-retrieval evidence that relevance alone is insufficient when retrieved content may be contradictory or malicious. Its defense is not an Ember architecture proposal.

### R18 CRUX

**Jia-Huei Ju, Suzan Verberne, Maarten de Rijke, Andrew Yates.** *Controlled Retrieval-augmented Context Evaluation for Long-form RAG.* Findings of EMNLP 2025.

- DOI: https://doi.org/10.18653/v1/2025.findings-emnlp.1151
- Proceedings: https://aclanthology.org/2025.findings-emnlp.1151/

Relevant because it argues that conventional retrieval ranking metrics do not fully characterize the context actually useful to downstream long-form generation. Ember needs an even broader evaluation including inclusion harm, currentness, scope, provenance, privacy, and continuity.

### R19 ECoRAG

**Yeonseok Jeong, Jinsu Kim, Dohyeon Lee, Seung-won Hwang.** *ECoRAG: Evidentiality-guided Compression for Long Context RAG.* Findings of ACL 2025.

- DOI: https://doi.org/10.18653/v1/2025.findings-acl.1365
- Proceedings: https://aclanthology.org/2025.findings-acl.1365/

Relevant as an implementation-specific example of adapting context depth and compression to evidential need. Ember borrows only the pressure toward evidence-sensitive depth, not the concrete method.

### R20 RASTeR

*RASTeR* evaluates temporal question answering under irrelevant, outdated, and inconsistent retrieved content.

- Proceedings: https://aclanthology.org/2025.ijcnlp-long.166/

Relevant because it treats context evaluation as a distinct problem under stale, conflicting, and distractor material. The exact architecture is not an Ember recommendation.

### R21 Privacy as Contextual Integrity

**Helen Nissenbaum.** *Privacy as Contextual Integrity.* Washington Law Review 79, 2004.

- Article: https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10/

Used as a **[L] lens**: privacy depends on whether information flow is appropriate to the context, actors, purpose, and norms, not only on whether information is secret. Ember does not import the framework literally, but it strongly sharpens delegated-context reasoning.

### R22 The Protection of Information in Computer Systems

**Jerome H. Saltzer, Michael D. Schroeder.** *The Protection of Information in Computer Systems.* Proceedings of the IEEE 63(9), 1975, 1278–1308.

- DOI: https://doi.org/10.1109/PROC.1975.9939

Used as a **[L] lens** through the principle of least privilege. Context is not privilege, so the principle is not imported directly. The useful analogy is that unnecessary information exposure increases channels for misuse and error.

### R23 The Magical Number 4 in Short-Term Memory

**Nelson Cowan.** *The Magical Number 4 in Short-Term Memory: A Reconsideration of Mental Storage Capacity.* Behavioral and Brain Sciences 24(1), 2001, 87–114.

- DOI: https://doi.org/10.1017/S0140525X01003922

Used only as a **[L] lens** for the distinction between broadly available knowledge and a smaller focus actively maintained for a task. Ember should not imitate a biological item-count limit.

### R24 Provider prompt and context caching

Current provider documentation shows that repeated prompt prefixes or context can be cached for cost and latency benefits:

- OpenAI Prompt Caching: https://platform.openai.com/docs/guides/prompt-caching
- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Google Gemini Context Caching: https://ai.google.dev/gemini-api/docs/caching

Relevant because caching can make stable or large repeated context cheaper, changing implementation economics and feasible lifetimes. It does not make cached material semantically relevant to every cognition.

## Existing-system evidence

The existing Ember reconnaissance should be read by concern rather than as product templates.

### Persistent state versus active projection

- [NanoBot](nanobot.md) separates broad interaction history, reflection, agent-level material, and project-level material.
- [Hermes](hermes.md) distinguishes stable prompt material, current context, searchable history, and narrower delegation context.
- [OpenClaw](openclaw.md) separates curated, episodic, prospective, and provenance-sensitive material and tolerates degraded memory lookup.
- [Letta](letta.md) separates always-attached active state from larger archival information with an independent lifecycle.

**[C]** The convergence supports selective current participation. It does not establish any one storage or prompt representation as canonical for Ember.

### Delegation and isolation

Hermes demonstrates an implementation in which delegated work receives a narrower fresh context rather than a copy of the entire parent context. Ember's own principles independently require responsibility for what context is passed while respecting specialist-owned state.

**[C + J]** Delegation creates a real contextual boundary. The semantic rules governing ownership, authority, cancellation, and long-running work remain for issue #6.

### Graceful recall degradation

OpenClaw's design allows memory lookup to degrade without making all ordinary cognition impossible.

**[C + J]** This supports the distinction between missing enrichment and canonical memory loss, while leaving Ember's exact degradation policy open.

## Model- and benchmark-specific cautions

The following findings should not be promoted into timeless Ember rules without qualification:

- the exact shape and magnitude of "lost in the middle" effects;
- the exact context length at which any provider degrades;
- percentage drops reported by long-context benchmarks;
- exact privacy violation rates in CIMemories or multi-agent simulations;
- exact policy-violation rates in compaction studies;
- any one prompt order, grouping method, or retrieval implementation;
- synthetic benchmark scores as direct estimates of persistent-personal-agent behavior.

The durable lessons are the *existence* of the failure modes and the semantic distinctions needed to avoid confusing them with Ember's identity or truth model.

## Evidence inherited from issues #3 and #4

The following context conclusions depend materially on already-validated continuity and memory results and should remain linked rather than re-proved here:

- identity does not collapse into one model context;
- autobiographical, relationship, and commitment continuity can survive partial context loss;
- model-visible context is not the canonical owner of continuity;
- history, durable memory, current belief, and temporary context are distinct;
- provenance and scope change the meaning and legitimate use of remembered information;
- superseded information must not regain current authority merely because it is retrievable;
- failed recall is not absence of memory;
- repeated recall is not new evidence;
- prospective commitments can become relevant independently of conversational recency;
- context projection must not rewrite or strengthen its source memory;
- staged recall should deepen when uncertainty, contradiction, provenance, consequence, or autobiographical significance requires it.

See the [continuity evidence map](continuity-and-identity-references.md) and [memory evidence map](memory-and-remembering-references.md) for the principal supporting sources and caveats.