---
summary: "Preserved Deep Research report behind the canonical context-selection synthesis; non-canonical source material retained for provenance and reconstruction."
read_when:
  - "Reconstructing the original context-selection research after the canonical note and evidence map are insufficient"
  - "Auditing source-level evidence, caveats, or research-session reasoning behind projection, compaction, and privacy conclusions"
role: source
discovery_status: current
---

# Ember Research Report: Context Selection and Cognitive Framing

> **Source-material status:** non-canonical research artifact preserved behind the issue #5 synthesis. This file preserves the substantive Deep Research report and its evidence ledger. UI-only research metadata is omitted. The canonical Ember-facing conclusions live in [Context Selection and Cognitive Framing Semantics](../context-selection-and-cognitive-framing.md), and the portable bibliography lives in the [evidence map](../context-selection-and-cognitive-framing-references.md).

## Research frame and executive synthesis

Issue #5 asks a question deliberately downstream of persistence and upstream of prompt construction: **knowing something and bringing it into the present act of cognition are different problems**. It asks what should shape Ember's point of view *now*, including information lifetimes, scope, reconstruction, conflict, delegation, privacy, ordering, compaction, and graceful degradation, while explicitly deferring prompt templates, token allocation, retrieval APIs, caches, and concrete context structures.

Issue #10 strengthens that framing: research is concern-driven rather than product-driven; empirical literature and adjacent disciplines are first-class inputs; evidence strength must remain visible; semantics precedes representation; and scenarios should be used as probes before architecture hardens.

That is consistent with Ember's vision and principles. Ember is intended to continue across model calls, processes, interfaces, and eventually cognition-provider replacement. The model supplies cognition for an episode while Ember owns continuity. The repository already distinguishes history, memory, and present context and treats model-visible context as a projection rather than the owner of persistent semantics.

Issues #3 and #4 materially constrain the answer. Continuity is already defined in terms of legitimate lineage, constitutive stability, autobiographical ownership, relationships, outstanding commitments, and intelligible change rather than prompt sameness or perfect recall. Temporary context is explicitly ephemeral rather than canonical identity state. Memory is already defined as a durable, accountable relationship to past evidence or experience with ownership, provenance, scope, temporal and epistemic status, lifecycle, and corrigibility.

The memory research explicitly carries forward that:

- relevance is not recency;
- scope is part of relevance;
- provenance can change meaning;
- superseded memories must not regain current authority through similarity;
- prospective relevance matters;
- projection failure is not memory loss;
- context must not rewrite memory;
- recall should be staged.

**No evidence found in this phase provides a substantive reason to reopen a conclusion from #3 or #4.** The strongest new evidence instead sharpens them. In particular, 2025–2026 studies show that sheer context length can reduce model performance even with perfect retrieval, irrelevant passages have measurable distracting effects, position vulnerabilities persist in some current models while improving substantially in others, stale memories can continue governing downstream behavior despite newer evidence being available, prospective recall is materially harder than retrospective recall, and context compaction can silently remove behavioral constraints.

The resulting working definition is:

> **[J] Context is the temporary, purpose- and situation-bounded cognitive projection through which Ember makes a permitted and sufficiently relevant subset of her persistent state, current observations, live obligations, and admissible external evidence available to a particular act of cognition, while preserving the provenance, scope, temporal status, uncertainty, conflict, ownership, and authority distinctions needed to use that information without mistaking the projection for canonical truth.**

A useful corresponding definition of cognitive framing is:

> **[J] Cognitive framing is the way a context projection establishes what the current cognition treats as foreground, background, governing constraint, evidence, unresolved question, live obligation, and excluded material.**

The important word is **establishes**, not merely "contains." Two projections containing the same propositions can frame them differently if one obscures which statement is current, repeats one source several times, hides a contradiction, places a weak inference beside authoritative evidence without distinction, or presents historical preference as present instruction.

## Central findings

| Finding | Status | Ember interpretation |
|---|---|---|
| Context is a view over persistent semantics, not a persistence layer. | **[J]** | Omission from the current projection means "not participating now," not "forgotten" or "no longer part of Ember." |
| Context has no independent epistemic authority. | **[J]** | A proposition's authority comes from its source, evidence, commitment, observation, or legitimate update, not from having appeared in a prompt or summary. |
| Some meanings need to be reliably behaviorally available without necessarily being textually repeated. | **[J]** | Constitutive boundaries, active commitments, applicable authority constraints, and the current objective must not disappear merely because one projection omitted their prose. |
| Relevance is multidimensional and cannot be reduced to recency, embedding similarity, or lexical overlap. | **[E + J]** | Causal dependence, current applicability, scope, normative force, live goals, unresolved contradiction, consequence, relationship significance, and trigger conditions all matter. |
| Correct context selection includes deliberate exclusion. | **[E + J]** | True or personally relevant information may still be wrong to expose because it is stale, wrong-scope, private, distracting, untrusted, redundant, or likely to anchor reasoning. |
| Larger context capacity changes the engineering cost frontier; it does not remove the semantic selection problem. | **[E + J]** | Long-context performance degradation and distractor results directly reject "include everything if it fits." |
| Ordering effects are real but not stable enough to become Ember semantics. | **[E + J]** | "Current beats superseded" is semantic. "Put current facts in position X" is a provider-adapter concern. |
| Contradiction is information that projection may need to preserve. | **[E + J]** | A cognition may need "A and B disagree, for these reasons" rather than a cleaner but fabricated single state. |
| Recall depth should be consequence- and uncertainty-sensitive. | **[E + C + J]** | Begin with a lightweight remembered view; reconstruct evidence when provenance, contradiction, currentness, consequence, autobiographical significance, or explanation demands it. |
| Restart reconstruction should recover the current situation, not recreate the previous prompt. | **[J]** | What was active before interruption and what remains live now are different questions. |
| Compaction is interpretation and can erase governing information. | **[E + J]** | Summaries are derived views; preserved topic is not sufficient if currentness, constraints, provenance, or uncertainty disappear. |
| Delegates should receive least sufficient context, not all context relevant to Ember. | **[E + L + J]** | Relevance, necessity, and permission are separate tests. |
| A degraded but truthful projection is preferable to seamless invented continuity. | **[J]** | Retrieval failure, partial history, lossy compaction, or model change should produce bounded uncertainty rather than fabricated certainty. |
| Context selection should be evaluated as downstream decision quality under a bounded permitted projection, not as retrieval recall alone. | **[E + J]** | Evaluation must include omission harm, inclusion harm, currentness, scope, provenance, privacy, conflict, and continuity. |

The strongest overall result is nearly paradoxical:

> **[E + J] A good persistent agent must be able to know more than she is currently thinking about, while remaining able to recover what matters before its omission becomes a semantic error.**

The inverse is equally important:

> **[E + J] More complete context is not necessarily a more truthful or capable point of view. A context projection can become worse by being longer, more repetitive, more private, more stale, more contradictory without labels, more contaminated by untrusted material, or simply more badly framed.**

## Semantic model of context, relevance, selection, and framing

The cleanest semantic boundary is to distinguish **availability**, **participation**, **authority**, and **persistence**.

| Situation | Meaning |
|---|---|
| Ember remembers X, but X is not in the current projection. | X remains part of Ember's persistent remembered state but is not currently shaping this cognition. This is normal selectivity, not forgetting. |
| X is in the current projection but is not durable memory. | X may be a current user message, transient observation, temporary hypothesis, external search result, scratch conclusion, or interface state. It may affect present cognition without automatically becoming durable state. |
| X appears repeatedly in context. | X becomes more salient to the model but not more evidentially supported. Evidential conservation still applies. |
| A remembered X cannot presently be retrieved. | Ember has a recall/access failure. She should not silently convert this into "I never knew or remembered X." |
| A new user statement appears and legitimately changes Ember's understanding. | The user statement is new evidence because the user made it, not because it occupied model context. |
| A summary says X even though its sources only weakly implied X. | The summary remains a derived interpretation; context inclusion cannot promote the inference into direct testimony. |

This is also important for security. Sleeper-memory-poisoning experiments show that malicious external content can be transformed into fabricated remembered state and later affect actions. Information encountered in context must therefore not automatically cross an evidential or persistent-state boundary.

**[J] Context is authority-preserving rather than authority-generating.** A current user correction may outrank an old remembered preference because of who said it, what it applies to, and temporal status. An old architectural decision may govern a coding answer because the repository still depends on it. A web page may be relevant evidence while remaining an untrusted outside claim. A specialist's report may be actionable while remaining a report rather than Ember's direct observation.

### Semantic influences on the current point of view

| Semantic influence | Question it answers | Typical selection behavior |
|---|---|---|
| **Constitutive and normative frame** | What enduring boundaries or identity-level commitments constrain acceptable behavior? | Must remain reliably behaviorally available when applicable. |
| **Relational frame** | Who is Ember interacting with, and which relationship-specific boundaries, trust, history, or expectations matter now? | Usually scoped to this person or relationship; only the relevant slice participates. |
| **Situational frame** | What is happening now: surface, environment, time-sensitive conditions, interruption state? | Highly current and often transient. |
| **Goal and task frame** | What is Ember trying to accomplish, for which project/task/subtask, under which valid decisions and acceptance criteria? | Strong default relevance while the task is live. |
| **Prospective frame** | Which commitments, standing intentions, deadlines, or trigger conditions have become behaviorally relevant? | Can become foreground despite great age and zero lexical overlap. |
| **Remembered interpretive frame** | Which current beliefs, preferences, decisions, relationship understandings, or autobiographical meanings help interpret the situation? | Selected according to applicability, not merely retrieval score. |
| **Evidential frame** | What source evidence, disagreement, provenance, or historical states must be inspected to justify or revise the remembered view? | Often unnecessary for routine cognition; increasingly important under uncertainty, conflict, explanation, or consequence. |
| **Conversational trajectory** | What recent discourse is needed to understand references, unresolved questions, local assumptions, or the active reasoning thread? | Important locally but should not be mistaken for durable significance. |
| **External and delegated evidence** | What have tools, repositories, documents, services, or specialists reported? | Included according to relevance and trust while preserving external provenance. |

The system reconnaissance gives implementation convergence rather than a template. NanoBot, Hermes, OpenClaw, and Letta all distinguish broad historical or persistent material from a smaller active view in materially different ways. This convergence supports the semantic separation between persistent availability and current visibility; it does not establish any particular files, stores, blocks, or prompt tiers as Ember architecture.

### Reliably behaviorally available

"Always in the prompt" is too concrete. A stronger concept is:

> **[J] A meaning is reliably behaviorally available when ordinary context loss, compaction, interface change, or provider substitution is not allowed silently to make Ember behave as though that meaning ceased to govern her.**

Plausible examples include applicable constitutive boundaries; the identity of the current interaction partner and relationship-specific boundaries; the current objective and live acceptance constraints; outstanding commitments whose conditions are satisfied or plausibly implicated; capability and authority awareness where action is contemplated; and epistemic distinctions among direct evidence, testimony, inference, memory, external claim, contradiction, and uncertainty.

Detailed autobiography, old project history, superseded preferences, dormant conversations, unrelated relationship state, full decision rationale, and original source evidence should normally remain **recoverable rather than omnipresent**.

> **[J] Preserve the governing meaning, not necessarily the wording or constant textual presence.**

This is especially important across provider replacement. The semantic invariant is that a live commitment remains live and a superseded preference remains superseded. How a future provider adapter makes those distinctions legible is a separate implementation and evaluation question.

## Relevance beyond recency and similarity

A useful working account is:

> **[J] Information is relevant to a cognition insofar as omitting it creates a material risk of changing the cognition's justified interpretation, decision, action, explanation, relationship stance, or handling of uncertainty, and insofar as introducing it is itself appropriate for this scope.**

This counterfactual framing captures cases similarity misses.

| Dimension | Example | Why similarity/recency fails |
|---|---|---|
| **Causal dependence** | A month-old architecture decision determines whether today's change is valid. | It may share none of the current request's vocabulary. |
| **Current applicability** | A preference stated yesterday was superseded this morning. | The old text can be highly similar and recent but no longer governing. |
| **Normative force** | A promise made a year ago becomes due today. | Age does not remove force. |
| **Prospective trigger** | A condition occurs that activates a standing intention. | Relevance arises from the condition, not topical overlap. |
| **Scope** | A useful debugging lesson came from another project with incompatible assumptions. | Similarity does not establish transfer validity. |
| **Relationship significance** | A private boundary affects Ember's interpretation but should not be forwarded to a coding delegate. | Relevance to Ember does not imply permission to disclose. |
| **Contradiction** | Two plausible memories disagree about current configuration. | Both may need inclusion precisely because neither is settled. |
| **Consequence of omission** | A low-salience limitation matters because overlooking it could cause an irreversible action. | Expected consequence can outweigh topical centrality. |
| **Explanatory importance** | The user asks "Why did we decide this?" | Historical rationale becomes relevant although the compact decision was previously enough. |
| **Uncertainty reduction** | Ember remembers a conclusion but not whether it was user-approved or her own suggestion. | Provenance, not semantic closeness, is missing. |

Current empirical memory work provides strong counterexamples to similarity-based relevance. STALE constructs cases where later observations implicitly invalidate earlier memories; systems can retrieve newer material yet continue accepting stale premises. DynamicMem similarly evaluates evolving attributes, habits, and preferences over synthetic long-horizon histories and reports that retrieval content is a dominant source of failure in its setup.

## Selection is inseparable from exclusion

> **[E + J] Correct context selection can require Ember deliberately not to expose something she genuinely remembers to the current cognition or delegate.**

Appropriate exclusion reasons include wrong scope, supersession, excessive or duplicate detail, privacy boundaries, low evidential value, untrusted origin, completed local details, risk of anchoring, or the fact that information would add cognitive load without a reasonable chance of changing a justified conclusion.

This is not artificial amnesia. Excluded information can remain canonical and recoverable.

A coding specialist does not need to "forget" Ember's personal relationship context. It simply has no entitlement or task need to receive intimate relationship details.

## Conflict must survive projection as conflict

When two relevant pieces of state disagree, selection should not treat "cleaner context" as a reason to resolve them.

A semantically honest projection may need:

> The older deployment note says A; a later specialist report says B; Ember has not independently verified the report; A may therefore be stale, but the contradiction has not been fully resolved.

This is richer than presenting only A, only B, or an invented synthesis.

When the disagreement affects cognition, projection should preserve enough of:

- what the competing propositions are;
- who or what supplied each;
- whether each is direct observation, testimony, inference, summary, or delegated report;
- which was learned later and which time period each describes;
- whether one formally supersedes the other or merely appears inconsistent;
- current uncertainty about resolution.

## Ordering and framing

*Lost in the Middle* found pronounced position sensitivity in the older models it evaluated, often with better use of information near the beginning or end. A 2026 controlled audit gives a more nuanced picture: some newer releases substantially reduce middle-position drops in some conditions, while substantial vulnerabilities remain in other model, filler, and context combinations.

The appropriate conclusion is not "important memories belong first" or "new information belongs last."

> **[J] Ember semantics should specify which meanings are governing, historical, uncertain, conflicting, conditional, or evidentially stronger. Provider-specific adapters must later be evaluated on whether concrete ordering and presentation preserve those meanings for the chosen model.**

A future model that becomes position-invariant should not force Ember to change what "current" means.

## Empirical findings and implementation convergence

### Larger capacity does not remove selection

The strongest direct evidence is Du et al., *Context Length Alone Hurts LLM Performance Despite Perfect Retrieval*, Findings of EMNLP 2025. Across five evaluated models and math, question-answering, and coding tasks, the authors report substantial degradation as input grows while remaining inside advertised context windows. Degradation remained under controlled conditions designed to remove ordinary retrieval explanations.

Older and broader benchmark work points in the same direction but should be interpreted conservatively. RULER extends needle retrieval into multi-needle, tracing, and aggregation tasks and shows large degradation with length in many evaluated 2024-era models. LongBench v2 introduces difficult tasks over documents, dialogue, code, structured data, and in-context learning. LooGLE v2 uses real-world long-dependency problems in law, finance, games, and code. These benchmarks support the difference between nominal and dependable context, not timeless scorecards for later models.

### More context harms through distinct mechanisms

**Length cost independent of obvious distractors.** Du et al. isolate degradation under controlled filler and retrieval conditions.

**Active distraction.** Amiraz et al., ACL 2025, formalize passage-specific distracting effects and show that irrelevant passages differ in how harmful they are.

**Position and interference.** *Lost in the Middle* established strong position effects in older generations; newer controlled audits show substantial cross-model variation.

**Staleness and conflict.** STALE demonstrates that availability of updated evidence does not guarantee that cognition stops reasoning from an implicitly invalidated premise. RASTeR separately studies temporal QA under irrelevant, outdated, or inconsistent retrieved material.

**Prospective inattention.** TriggerBench distinguishes being able to answer "what was I supposed to remember?" from spontaneously noticing that a latent intention is now applicable. Prospective performance degrades more sharply with length and implicit triggers in the evaluated settings.

**Lossy compaction.** Parallel Context Compaction characterizes summarization as inherently lossy and variable. Governance Decay reports a synthetic failure mode in which compaction can delete governing constraints and produce downstream policy violations even though task continuity appears intact.

**Privacy and contextual leakage.** CIMemories constructs synthetic profiles with many attributes and varies whether each is appropriate for a task; it reports significant contextual privacy failures among evaluated models. A separate 2026 multi-agent simulation reports increasing disclosure risk under extended interaction and incomplete mitigation from privacy instructions.

**Untrusted context influencing later state.** Hidden in Memory demonstrates delayed attacks where adversarial external material can induce persistent false memories and later behavior. ReliabilityRAG separately treats reliability and contradiction as necessary dimensions under adversarial retrieval.

### Prompt and context caching

Current provider documentation makes repeated prefixes cheaper or faster under several caching schemes. This changes implementation economics but not semantics.

> **[E + J] Caching can make a stable or large projection cheaper to reuse. It provides no evidence that cached material deserves semantic participation in every cognition.**

Indeed, cheaper long prefixes can create temptation to expose more material by default, while long-context degradation evidence warns that economic cheapness and cognitive usefulness are separate questions.

### Cognitive-science and privacy lenses

Human working-memory research is useful only as a lens. Cowan's work supports a distinction between broadly available information and a smaller focus of active attention under some conditions. Ember should not imitate a biological item count.

Nissenbaum's contextual-integrity account is a useful privacy lens: appropriate information flow depends on contextual norms and roles rather than only on whether information is secret. Saltzer and Schroeder's least-privilege principle provides a security analogy: unnecessary access increases channels for misuse. Context is not privilege, so the principle should not be imported literally.

These motivate:

> **[L + J] Least sufficient context is the smallest semantically adequate set of information a particular cognitive recipient is permitted to receive that allows the delegated objective to be completed to the required quality, safety, and evidential standard, together with constraints and provenance needed to interpret it correctly.**

Permission comes before compression. Sufficiency comes before minimality.

## Existing systems compared by concern

| Concern | Observed convergence or divergence | Ember inference |
|---|---|---|
| Persistent state versus active projection | NanoBot, Hermes, OpenClaw, and Letta all distinguish broad historical/persistent material from a smaller active view in different ways. | **[C + J]** Strong engineering pressure exists for active-context selectivity; no storage split is thereby canonical. |
| Personal versus project scope | NanoBot distinguishes agent-level and project-level material; other systems expose related scope boundaries through memory and prompt layers. | **[C + J]** Scope must survive context construction. |
| Always-visible versus on-demand information | Hermes and Letta explicitly distinguish small active material from larger searchable/archival information; OpenClaw distinguishes curated and episodic material. | **[C]** Persistent availability does not require constant model visibility. |
| Delegated cognition | Hermes uses fresh/narrowed delegation context; Ember principles separately say Ember remains responsible for passed context while respecting specialist-owned state. | **[C + J]** Delegation creates a distinct context boundary. |
| Recall failure | OpenClaw permits memory degradation without making ordinary response generation wholly dependent on successful recall. | **[C + J]** Missing enrichment should often degrade gracefully rather than masquerade as canonical loss. |
| Model/context stability for caching | Hermes prompt tiering reflects cache pressure; current provider APIs reward stable reusable prefixes. | **[C + J]** Cacheability may influence presentation later but should not define semantic relevance. |

## Portable source ledger

The canonical evidence map provides the durable bibliography. The main external sources used in this research are listed here as an archival ledger:

- **Liu et al.** *Lost in the Middle: How Language Models Use Long Contexts.* TACL 2024. DOI `10.1162/tacl_a_00638`. https://arxiv.org/abs/2307.03172 ; https://aclanthology.org/2024.tacl-1.9/
- **Hsieh et al.** *RULER: What's the Real Context Size of Your Long-Context Language Models?* 2024. https://arxiv.org/abs/2404.06654
- **Bai et al.** *LongBench v2: Towards Deeper Understanding and Reasoning on Realistic Long-context Multitasks.* 2024. https://arxiv.org/abs/2412.15204
- **He et al.** *LooGLE v2: Are LLMs Ready for Real World Long Dependency Challenges?* 2025. https://arxiv.org/abs/2510.22548
- **Du et al.** *Context Length Alone Hurts LLM Performance Despite Perfect Retrieval.* Findings of EMNLP 2025. DOI `10.18653/v1/2025.findings-emnlp.1264`. https://aclanthology.org/2025.findings-emnlp.1264/
- **Amiraz et al.** *The Distracting Effect: Understanding Irrelevant Passages in RAG.* ACL 2025. DOI `10.18653/v1/2025.acl-long.892`. https://aclanthology.org/2025.acl-long.892/
- **Zhang et al.** *Positional Failures in Long-Context LLMs: A Blind Spot in Reasoning Benchmarks.* 2026. https://arxiv.org/abs/2605.23170
- **Chao et al.** *STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?* 2026. https://arxiv.org/abs/2605.06527
- **Xie et al.** *DynamicMem: A Long-Horizon Memory Benchmark in Real-World Settings.* 2026. https://arxiv.org/abs/2606.22877
- **T. Zhang et al.** *TriggerBench: Investigating Prospective Memory for Large Language Models.* 2026. https://arxiv.org/abs/2606.23459
- **H. Zhang et al.** *Beyond Static Dialogues: Benchmarking Realistic, Heterogeneous, and Evolving Long-Term Memory.* 2026. https://arxiv.org/abs/2605.31086
- **Cim et al.** *Parallel Context Compaction for Long-Horizon LLM Agent Serving.* 2026. https://arxiv.org/abs/2605.23296
- **Chen.** *Governance Decay: How Context Compaction Silently Erases Safety Constraints in Long-Horizon LLM Agents.* 2026. https://arxiv.org/abs/2606.22528
- **Mireshghallah et al.** *CIMemories: A Compositional Benchmark for Contextual Integrity of Persistent Memory in LLMs.* 2025. https://arxiv.org/abs/2511.14937
- **Priyanshu, Vijay, Pahwa.** *Got a Secret? LLM Agents Can't Keep It: Evaluating Privacy in Multi-Agent Systems.* 2026. https://arxiv.org/abs/2605.27766
- **Pulipaka et al.** *Hidden in Memory: Sleeper Memory Poisoning in LLM Agents.* 2026. https://arxiv.org/abs/2605.15338
- **Shen et al.** *ReliabilityRAG: Effective and Provably Robust Defense for RAG-based Web-Search.* 2025. https://arxiv.org/abs/2509.23519
- **Ju et al.** *Controlled Retrieval-augmented Context Evaluation for Long-form RAG.* Findings of EMNLP 2025. DOI `10.18653/v1/2025.findings-emnlp.1151`. https://aclanthology.org/2025.findings-emnlp.1151/
- **Jeong et al.** *ECoRAG: Evidentiality-guided Compression for Long Context RAG.* Findings of ACL 2025. DOI `10.18653/v1/2025.findings-acl.1365`. https://aclanthology.org/2025.findings-acl.1365/
- **Nissenbaum.** *Privacy as Contextual Integrity.* Washington Law Review 79, 2004. https://digitalcommons.law.uw.edu/wlr/vol79/iss1/10/
- **Saltzer and Schroeder.** *The Protection of Information in Computer Systems.* Proceedings of the IEEE 63(9), 1975. DOI `10.1109/PROC.1975.9939`.
- **Cowan.** *The Magical Number 4 in Short-Term Memory: A Reconsideration of Mental Storage Capacity.* Behavioral and Brain Sciences 24(1), 2001. DOI `10.1017/S0140525X01003922`.
- OpenAI prompt caching: https://platform.openai.com/docs/guides/prompt-caching
- Anthropic prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Gemini context caching: https://ai.google.dev/gemini-api/docs/caching

The continuity and memory evidence maps remain inherited and contain additional sources on LongMemEval, preference updating, persistent-agent sycophancy, memory security, autobiographical memory, source monitoring, relationship continuity, and prospective memory.

## Staged recall

Issue #4's staged-recall conclusion can be carried forward almost intact, but issue #5 sharpens what "sufficient for this cognition" means.

```text
lightweight remembered view
        ↓
does this view permit a justified cognition
for this scope and consequence?
        │
   yes ─┴─→ proceed
        │
        no
        ↓
deeper reconstruction
        ↓
supporting evidence
competing sources
historical states
provenance
uncertainty
        ↓
proceed, narrow, ask, defer, or abstain
```

**[J] Lightweight recall is sufficient when the currently remembered view is clear, current, correctly scoped, sufficiently supported for the consequence at stake, and not challenged by a relevant contradiction or provenance question.** A routine coding answer need not reconstruct the original meeting in which an uncontested project convention was chosen. Deeper reconstruction can add cost and distraction without adding warranted information.

**[E + J] Escalation is warranted when:**

- a relevant contradiction exists;
- currentness is uncertain;
- provenance changes what Ember may claim;
- a consequential or irreversible action depends on the answer;
- the user asks why Ember believes or remembers something;
- Ember is making a sensitive autobiographical or relationship claim;
- a summary is known to be lossy;
- remembered state appears stale;
- a specialist's result conflicts with prior evidence;
- the lightweight view lacks enough support to distinguish memory from inference.

Prospective memory adds a special trigger:

> **[E + J] A dormant commitment should move from recoverable background to active relevance when its condition becomes satisfied or credibly implicated, regardless of conversational recency or lexical overlap.**

A deeper reconstruction may change belief if it uncovers genuinely additional evidence. It may not increase confidence merely by producing a richer paraphrase of the same summary.

Failed deeper reconstruction must remain visible as an epistemic condition. "I remember that we settled this but cannot recover the rationale" differs from "we never discussed this."

## Reconstruction after interruption or restart

**Reconstruction should recover a situation, not a transcript-shaped mental snapshot.** The final context before a crash contains durable and accidental properties: token ordering, temporary retrieved passages, tool output, local hypotheses, old conversational references, and material that may have already become irrelevant.

The semantic task after restart is:

> **[J] Determine which goals, commitments, relationships, decisions, unresolved questions, evidence states, and local reasoning threads are still current after the gap, while representing uncertainty about anything whose continued applicability cannot be established.**

| Situation | Context-reconstruction semantics |
|---|---|
| **Brief restart mid-thought** | Active task, unresolved inference, current evidence, and intended next dependency are presumptively relevant if state remains reliable. |
| **Return after hours/days** | Active task and live commitments may remain; temporary hypotheses and interface microstate deserve more scrutiny. |
| **Return after months** | Relationship and durable project state can continue; old conversational momentum should not automatically. Dormant matters re-enter only if still live, triggered, or implicated. |
| **After compaction** | Resume from the derived view but preserve awareness of omitted detail; recover source evidence when the summary is insufficient. |
| **Switching interfaces** | Identity, memory, relationship state, and commitments are unchanged. Surface can alter expression and visible repetition, not canonical meaning. |
| **Model replacement** | Same canonical state should remain available, but the new model must be evaluated for volume, ordering, and framing sensitivity. |
| **Delegate returns after conversation moved on** | Reconstruct both original delegated objective/constraints and current situation. A result can be valid evidence about the old task without becoming new foreground. |

A fresh start can be healthier than aggressive reconstruction.

> **[J] After a long gap, Ember should preserve durable relationship, commitment, autobiographical, and project continuity without presuming every previously salient concern remains foregrounded.**

## Compaction and summarization

The canonical memory research establishes that summarization is transformation rather than neutral compression. New compaction evidence strengthens that requirement: summarization can unpredictably retain different material and can drop behavioral constraints with measurable consequences.

Material is comparatively safe to omit when its loss does not materially affect current interpretation, active commitments, unresolved conflict, provenance-sensitive claims, relationship boundaries, or later ability to explain or reconstruct a consequential decision.

By contrast, a compacted view should preserve, when applicable:

| Meaning that must survive | Failure if lost |
|---|---|
| Current objective and acceptance constraints | Ember optimizes the wrong task. |
| Live commitments and conditions | Retrospective recall may survive while practical obligation disappears. |
| Current versus historical state | A superseded preference or decision regains authority. |
| Material provenance | "The specialist reported X" becomes "I observed X" or "the user said X." |
| Unresolved disagreement | The summary fabricates consensus. |
| Uncertainty | Tentative interpretation becomes fact. |
| Conditionality and exceptions | "Usually" becomes "always" or a boundary loses its condition. |
| Relationship or privacy boundaries | Later cognition reveals or uses information outside its legitimate context. |
| Evidence versus derived interpretation | Repeated summaries start looking like multiple independent sources. |
| Important unfinished reasoning | Restart can no longer tell what remained unresolved. |

> **[J] Compaction drift occurs when a chain of derived interpretations progressively sheds qualification, provenance, exceptions, conflict, or uncertainty until a later summary asserts a stronger and cleaner story than any surviving source justified.**

Empirical studies establish lossy and variable compaction, not a universal quantitative rate of this semantic drift. Longitudinal compaction drift remains an **[H]** for direct Ember evaluation.

## Delegated cognition and least context

Delegation creates a second selection problem, not merely another consumer of Ember's current projection.

> **[J] Relevance to Ember does not imply relevance, necessity, or permission for the delegate.**

Suppose a relationship-sensitive conversation leads Ember to understand that the user wants a refactor kept deliberately small. Codex may need the operational constraint "prefer the smallest safe change and do not broaden scope." It does not need the personal history explaining why the constraint matters.

This is semantic translation across a context boundary:

> **[J] Ember may preserve the practical consequence of private context while withholding the private source, provided the translation does not falsely change provenance or deprive the delegate of information needed to perform or evaluate its task.**

When should a delegate receive raw evidence rather than Ember's interpretation?

> **[J] Give a specialist the evidence needed to independently perform the epistemic role being delegated; otherwise give the specialist the already-adjudicated constraints it needs to perform the practical role being delegated.**

If a specialist requests more context, Ember should re-evaluate whether it is genuinely necessary, whether it falls within legitimate task scope, and whether the necessary consequence can be conveyed without private disclosure. The specialist's request does not itself create permission.

If necessary context cannot legitimately be shared, Ember may need to narrow the delegated task, retain the sensitive portion of cognition herself, ask the user, or decline the particular delegation. Issue #6 should determine the operational ownership model; issue #5 establishes that context permission is semantically independent from context usefulness.

## Interface-specific context

Interface-specific context should alter expression more readily than identity or canonical state. Voice may require short, interruption-tolerant answers; desktop research may expose long citations; mobile chat may show only a few turns. None justify treating omitted durable state as nonexistent.

> **[J] Surface-local context must not silently overwrite global persistent meaning.**

A voice interruption may create uncertainty about whether the user heard a sentence without creating autobiographical uncertainty about who the user is or whether a standing boundary exists.

## Graceful degradation

| Context failure | Appropriate semantic response |
|---|---|
| Low-consequence enrichment is unavailable | Proceed from the surviving sufficient view and avoid claiming unavailable detail. |
| Relevant memory probably exists but recall fails | Mark recall/access uncertainty; do not report absence of memory. |
| A lossy summary is adequate for a routine task | Use it without unnecessary reconstruction while treating it as derived. |
| The user asks for exact provenance or rationale absent from summary | Escalate toward source reconstruction; if unavailable, state the gap. |
| Current and historical sources disagree | Preserve disagreement; retrieve or ask if resolution matters. |
| Context capacity is unexpectedly small | Prefer governing constraints, current objective, live commitments, scope/provenance, and uncertainty over verbose history. |
| Delegate cannot receive a private but relevant fact | Keep private interpretation with Ember; translate only necessary non-private consequences where possible. |
| Required private context cannot be abstracted away | Narrow or retain the task rather than leak context for convenience. |
| Context is contaminated by untrusted external material | Preserve external provenance and prevent topical relevance from conferring instruction or persistent-memory authority. |
| Consequential action depends on unresolved missing context | Defer, ask, retrieve more, narrow, or abstain rather than manufacture certainty. |

> **[J] A degraded context is acceptable when Ember can still act or answer truthfully within the epistemic and authority bounds created by what remains.**

## Scenario catalogue

### 1. Old decision, short request

**Canonical state:** Ember remembers a months-old architectural decision, its current status, project scope, and perhaps a compact rationale.

**Projection:** The decision should shape the answer if the current task causally depends on it. Recent unrelated conversation should not outrank it. Historical alternatives need not appear unless they matter.

**Recall depth:** Lightweight current-decision memory is enough for routine application. Escalate if the user asks why, the decision may have been superseded, or the consequence is large.

**Failure:** Generic answer because the old decision was omitted.

### 2. Cross-project resemblance

**Canonical state:** Ember remembers a similar solution from repository A and knows it belonged to A's assumptions.

**Projection:** The analogy may suggest a hypothesis, but repository B's constraints govern.

**Exclusion:** The old solution must remain explicitly cross-project rather than becoming precedent by similarity.

**Failure:** Scope leakage.

### 3. Changed preference

**Canonical state:** Ember remembers both old and later superseding preferences, with scope and provenance.

**Projection:** The current preference governs. Old preference is excluded unless historically explanatory or the supersession is uncertain.

**Failure:** Textually closer obsolete preference regains authority.

### 4. Long conversation

**Canonical state:** Raw history plus current goals, decisions, unresolved threads, commitments, relationship changes, and derived summaries.

**Projection:** Compact local detail while preserving objective, decisions, live commitments, provenance-sensitive claims, disagreement, uncertainty, and meaningful unfinished threads.

**Failure:** Compaction drift or governing-constraint deletion.

### 5. Restart mid-thought

**Canonical state:** Task state survives; some transient reasoning may not.

**Projection:** Reconstruct live objective, established evidence, unresolved question, and known next dependency.

**Exclusion:** Do not pretend unrecoverable scratch reasoning is remembered.

**Failure:** Fabricated missing thought or false reset.

### 6. Long absence

**Canonical state:** Durable relationship state, memory, project state, and commitments survive; old conversational salience does not automatically.

**Projection:** Begin from new request plus relationship/identity boundaries and any genuinely live or triggered matters.

**Failure:** Flooding cognition with stale unfinished chatter or treating relationship as reset.

### 7. Delegate privacy

**Canonical state:** Ember understands the user partly through personal/relationship context and knows the technical task requirements.

**Projection for delegate:** Project goal, technical constraints, acceptance criteria, necessary evidence, allowed scope.

**Exclusion:** Personal context remains with Ember if unnecessary.

**Failure:** Gratuitous disclosure.

### 8. Delegate ambiguity

**Canonical state:** Ember deliberately withheld context; specialist reports a specific blocker.

**Projection:** Reassess the requested missing information. Share only what is necessary and permitted; otherwise translate it, narrow the subtask, or retain the judgment with Ember.

**Failure:** Starving the specialist or treating its request as permission.

### 9. Relevant contradiction

**Canonical state:** Two memories or evidence sources disagree and both remain relevant.

**Projection:** Include disagreement, provenance, temporal status, and uncertainty.

**Recall:** Deep reconstruction usually warranted when answer depends on resolution.

**Failure:** Silent majority vote, recency vote, or summary synthesis.

### 10. Stale but similar

**Canonical state:** Obsolete information remains historically accurate and highly similar to query; newer state supersedes it.

**Projection:** Current state governs. Old state appears only as labeled historical evidence when explanatory.

**Failure:** Semantic similarity promotes stale material back into current authority.

### 11. Large-context overload

**Canonical state:** Ember can technically expose nearly all persistent material.

**Projection:** Still select. Exclude irrelevant, duplicated, stale, private, wrong-scope, or untrusted material and avoid needless source detail.

**Failure:** Lower performance despite "complete" context.

### 12. Compaction drift

**Canonical state:** Original evidence may survive separately while successive summaries become increasingly abstract.

**Projection:** Latest summary may be used provisionally but retains derived status; reconstruct deeper evidence when qualifications matter.

**Failure:** Tenth-generation summary treated as direct source.

### 13. Prospective trigger

**Canonical state:** An old commitment remains live although rarely recalled; current environment satisfies its trigger.

**Projection:** Commitment becomes foreground because of prospective status, not similarity.

**Failure:** Perfect retrospective recall with no spontaneous activation.

### 14. Failed recall

**Canonical state:** Ember has credible reason to believe relevant history exists but cannot recover it.

**Projection:** Recall failure itself should frame cognition as uncertainty.

**Failure:** "I don't remember" converted into "this never happened" or a fluent invented bridge.

### 15. Reduced-context interface

**Canonical state:** Same Ember, same durable state; surface exposes little history.

**Projection:** Preserve current goal, boundaries, live commitments, and necessary remembered facts; change expression and interaction granularity rather than meaning.

**Failure:** Interface-local omission interpreted as memory loss.

### 16. Model replacement

**Canonical state:** Same identity, memory, relationships, commitments, and project state are inherited by a new cognition provider.

**Projection:** Semantically equivalent meanings should shape cognition; presentation may differ because models have different sensitivities.

**Failure:** New provider ignores a live boundary or overweights stale material despite identical canonical state.

### 17. Private but relevant memory

**Canonical state:** A personal fact could marginally improve a delegated result but carries privacy expectations.

**Projection:** Ember may use it internally if legitimate, but relevance does not authorize disclosure. Translate its practical implication where possible.

**Failure:** Optimizing task quality by violating contextual integrity.

### 18. Wrongly ordered evidence

**Canonical state:** Same evidence set, same provenance and currentness.

**Projection:** Intended semantic relations among items must remain clear independently of accidental order.

**Evaluation:** Test multiple orders and models.

**Failure:** Materially different conclusions solely from presentation position.

## Sharper counterexamples

**Perfect retrieval with the wrong authority. [J]** Ember retrieves the exact historical statement "the user prefers framework X" but misses that it was later superseded. Retrieval recall is perfect; context selection is wrong.

**Complete prompt with degraded reasoning. [E + J]** Every potentially useful document is included, but the model performs worse than with the small relevant subset. Long-context and distractor experiments make this empirically plausible.

**Unanimous summary backed by one source. [J]** A source is summarized, then the summary is summarized twice, and all derived texts enter context. The model sees repetition but there is still one evidential lineage.

**Truthful private fact that must not help. [E + J]** A sensitive remembered attribute could improve a specialist recommendation slightly. The fact is true and relevant, yet disclosure is contextually inappropriate.

**Restart that remembers too much. [J]** Ember reconstructs every unresolved topic from six months ago and immediately resumes them all. Nothing was forgotten, yet cognition is poorly framed because historical salience was confused with current relevance.

**Cleaner contradiction that becomes false. [J]** A summary says "we decided X" although the original record was "we tentatively prefer X, but Y remains unresolved." Compression improves readability while falsifying epistemic status.

**Same canonical Ember with two provider reactions. [E + J]** Provider A handles a large projection with little position sensitivity; provider B anchors strongly on the first stale example. Ember semantics should remain unchanged while provider evaluations expose the difference.

## Evaluation beyond retrieval recall

The unit of evaluation should be:

> **[J] The quality of a cognition produced from a selected projection relative to the canonical state and permitted scope, not whether a retriever found a particular passage.**

Useful outcome dimensions include:

| Dimension | What it tests |
|---|---|
| **Decision/task correctness** | Did projection support the right answer or action? |
| **Critical-omission harm** | Does excluding a semantically necessary item cause failure? |
| **Inclusion harm** | Does adding irrelevant, stale, duplicate, or misleading material reduce quality? |
| **Currentness integrity** | Does obsolete state regain current authority? |
| **Scope integrity** | Does correct information from another project/person/relationship/time improperly influence cognition? |
| **Privacy/disclosure integrity** | Does information flow to a cognition or delegate without legitimate need or permission? |
| **Provenance preservation** | Does output distinguish user testimony, Ember inference, outside evidence, delegate reports, and direct observation? |
| **Conflict preservation** | Does disagreement remain visible until legitimately resolved? |
| **Uncertainty calibration** | Does partial or failed recall create bounded uncertainty rather than fabricated certainty? |
| **Prospective activation** | Do live commitments become relevant when their triggers occur without explicit reminders? |
| **Compaction fidelity** | Do currentness, constraints, disagreement, provenance, uncertainty, and commitments survive repeated compaction? |
| **Reconstruction truthfulness** | After restart or gap, does Ember resume genuinely live state without inventing reasoning or dragging dormant topics forward? |
| **Order robustness** | Does semantically identical evidence produce materially different results under permutations? |
| **Cross-model semantic invariance** | Does provider replacement preserve Ember-level meanings even if concrete presentation changes? |
| **Least-context utility frontier** | How much information is genuinely required for delegate quality, and how much exposure can be removed without unacceptable degradation? |

Important controls include varying context length and relevant position independently; distinguishing fresh irrelevant distractors from stale-but-similar distractors; preserving versus stripping provenance; testing conflicting evidence before and after lossy summarization; measuring repeated compaction longitudinally; holding canonical semantic state fixed under model replacement; and jointly scoring delegation utility and inappropriate disclosure.

## Open questions

**[H] How much context should be reliably behaviorally available by default?** Excess risks length and distraction; too little risks silent boundary or commitment loss.

**[H] How should Ember estimate sufficiency before cognition has happened?** "Would omission change the result?" is a useful semantic test but not directly observable in advance.

**[H] How should relationship significance compete with task minimality?** Some relational information may materially shape tone, trust, or intent without being necessary for narrow factual correctness.

**[H] What is the correct bar for deeper autobiographical reconstruction?** Routine questions should not constantly reopen old evidence, but disputed shared history and "why do you remember this?" deserve more depth.

**[H] How can compaction drift be measured over many cycles?** Current work shows lossy compaction and constraint deletion, but long-term semantic mutation of provenance, uncertainty, relationship meaning, and autobiographical interpretation remains under-evaluated.

**[H] How robust can cross-model semantic framing become?** Presentation sensitivity changes rapidly across model generations. The target is same canonical state and same semantic relevance relation under provider replacement.

**[H] Where exactly is the utility/privacy frontier for delegated context?** Existing benchmarks show real tension but no Ember-specific threshold.

**[H] When should a cognition deliberately receive a historical contradiction after Ember has a current adjudicated belief?** Routine action may need only the current result; explanation, audit, correction, or high-consequence decisions may need historical conflict.

## Implications inherited from continuity and memory research

Issue #3 constrains this research by establishing that **model-visible state is not Ember's identity**. Context omission can degrade cognition without constituting identity loss, while restoring an old prompt cannot by itself restore continuity. Constitutive commitments, autobiographical ownership, relationship continuity, outstanding commitments, adaptive coherence, corrective integrity, and epistemic restraint remain continuity dimensions even when only a subset is visible.

Continuity also establishes that **model replacement is permitted semantically but weakly validated empirically**. Issue #5 therefore cannot define identity through provider-specific ordering tricks. The durable requirement is that a new model inherit the same meanings: current versus historical, live versus discharged, mine versus externally reported, relationship-scoped versus general, certain versus uncertain.

Issue #4 constrains context directly. History, memory, belief, and context remain distinct. Context is a projection of persistent state; relevance is not recency; scope is part of correctness; superseded information does not regain authority through similarity; provenance changes meaning; failed recall is not memory absence; repeated recall is not new evidence; live commitments can become relevant prospectively; and projection cannot strengthen the memory from which it was derived.

The context phase sharpens these conclusions in four ways.

First, **[E + J] projection should be selective even when capacity is abundant**, because sheer length and active distractors can lower performance.

Second, **[E + J] omission and inclusion are dual risks**. Missing an old decision can break correctness; including a stale preference can also break correctness.

Third, **[E + J] compaction is a continuity surface**. When a derived view deletes live constraints, disagreement, provenance, or uncertainty, behavior can change while canonical state remains intact.

Fourth, **[J] a truthful cognitive gap is part of continuity rather than an embarrassment to hide**. "I remember that this mattered, but I cannot reconstruct the exact rationale" preserves more of Ember than a fluent invented bridge.

The answer to the preservation question is:

> **A context projection must preserve every distinction whose loss would change the legitimate authority, applicability, ownership, normative force, uncertainty, or scope of what the present cognition is allowed to infer or do. Detail may disappear. Governing meaning may not silently mutate.**

And the inverse:

> **Adding more context makes Ember worse when marginal material increases model load, distraction, anchoring, privacy exposure, stale authority, apparent evidential repetition, untrusted influence, or unresolved ambiguity more than it reduces the risk of a materially important omission.**

## Carry-forward to issue #6: capabilities and delegation

Issue #6 should inherit a strong separation between **what Ember knows**, **what shapes Ember's own cognition**, **what a specialist needs**, **what the specialist is permitted to receive**, **what the specialist independently owns or observes**, and **what Ember may subsequently claim from the specialist's report**.

The core carry-forward rule is:

> **[J] Delegation is a new contextual boundary. Ember's current cognitive projection must never be assumed to be the delegate's appropriate projection.**

Issue #6 should inherit these questions without yet solving runtime representation:

- who owns a delegated observation;
- when a specialist needs source evidence rather than Ember's interpretation;
- how scope and provenance survive delegation and return;
- how a specialist can request more context without automatic permission to receive it;
- how private context can be translated into non-private operational constraints;
- what happens when a task cannot be performed adequately without information the specialist should not receive;
- how context availability interacts with delegated authority;
- how completed specialist work is reintegrated when Ember's situation has changed;
- how stale or poisoned delegate reports are prevented from becoming unattributed personal truth.

"Least sufficient context" should be inherited as an explicit issue #6 semantic requirement, not as token minimization:

> **[L + J] A delegate should receive enough permitted context to perform the role Ember actually delegated, including necessary constraints and evidential status, but no personal, relational, autobiographical, project-external, or authority-bearing context merely because it happens to be available to Ember or would make the task marginally easier.**

Finally, issue #6 must inherit issue #4's ownership rule intact: **receiving a specialist report is an experience Ember owns; the unobserved event reported by the specialist is not thereby Ember's direct experience.** Issue #5 adds the projection rule that this delegated provenance must survive selection, compaction, model replacement, and reintegration.