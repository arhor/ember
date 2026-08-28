# Continuity and Identity Evidence Map

This document is the portable evidence companion to [Continuity and Identity Semantics](continuity-and-identity.md).

The semantic note remains the canonical Ember-facing synthesis. This companion exists so that evidence labels such as **[E]**, **[C]**, **[J]**, **[H]**, and **[L]** remain inspectable outside the original ChatGPT Deep Research session.

The preserved [Deep Research artifact](source-material/continuity-and-identity-deep-research.md) contains the full research narrative and original ChatGPT-local citation markers. Those markers are intentionally retained as provenance but do not resolve on GitHub. The references below provide portable links for the principal sources behind the validated conclusions.

This is not intended to reproduce every source consulted during Deep Research. It records the sources that materially support, challenge, or sharpen the canonical continuity conclusions.

## Evidence map for validated conclusions

| Canonical conclusion | Basis | Principal portable evidence | Interpretation for Ember |
|---|---|---|---|
| A model call is an episode of cognition, not Ember's identity. | **[C + J]** | Ember's existing [NanoBot](nanobot.md), [Hermes](hermes.md), [OpenClaw](openclaw.md), and [Letta](letta.md) reconnaissance | Mature systems converge on persistent state outside one model call. This supports the engineering pressure, not a metaphysical claim about identity. |
| Continuity is not equivalent to memory recall. | **[E + J]** | [R1 LongMemEval](#r1-longmemeval), [R2 PrefEval](#r2-prefeval), [R3 PERMA](#r3-perma), [R4 DynamicMem](#r4-dynamicmem), [R10 Agent Identity Evals](#r10-agent-identity-evals) | Existing evaluations primarily measure retrieval, preference following, updating, and task consistency. Those abilities are important but do not by themselves distinguish continuation from a replacement with copied state. |
| Identity should be lineage-sensitive and quality-graded. | **[L + J]** | [R11 Stanford Encyclopedia: Personal Identity](#r11-personal-identity-stanford-encyclopedia-of-philosophy), [R12 Klein and Nichols](#r12-memory-and-the-sense-of-personal-identity) | Copying and branching expose why psychological similarity alone cannot identify one unique successor. The Ember lineage rule remains a design judgment. |
| Constitutive commitments belong closer to identity than ordinary preferences. | **[J]** | No direct empirical source is treated as sufficient. Related distinctions are sharpened by [R11](#r11-personal-identity-stanford-encyclopedia-of-philosophy) and the project scenarios. | This is deliberately an Ember design judgment. Durability alone does not make a preference constitutive. |
| Self-understanding is fallible and should be corrigible. | **[E/L + J]** | [R5 STALE](#r5-stale), [R13 McAdams et al.](#r13-continuity-and-change-in-the-life-story), [R14 Grilli and Verfaellie](#r14-supporting-the-self-concept-with-memory) | Current state can become outdated; human autobiographical evidence provides a lens for continuity through reinterpretation rather than frozen self-description. |
| Autobiographical continuity is not perfect event retention. | **[E/L + J]** | [R13 McAdams et al.](#r13-continuity-and-change-in-the-life-story), [R14 Grilli and Verfaellie](#r14-supporting-the-self-concept-with-memory), [R12 Klein and Nichols](#r12-memory-and-the-sense-of-personal-identity) | Empirical human evidence shows continuity-related self structures can coexist with incomplete episodic retention. Ember uses this only as an engineering lens, not as a literal model of artificial personhood. |
| Relationship continuity matters without defining the whole agent. | **[E + J]** | [R15 Bickmore and Picard](#r15-establishing-and-maintaining-long-term-human-computer-relationships), [R16 Banks](#r16-deletion-departure-death-experiences-of-ai-companion-loss) | Long-term human-agent relationships exhibit persistence and can be experienced as disrupted when an agent changes or disappears. This supports preserving relationship history without reducing Ember to a user profile. |
| User understanding and Ember's own identity must not collapse. | **[E + C + J]** | [R2 PrefEval](#r2-prefeval), [R3 PERMA](#r3-perma), [R4 DynamicMem](#r4-dynamicmem), [R7 PASB](#r7-personal-agent-sycophancy-benchmark) | Personal-agent memory research largely models the user. PASB additionally shows that accepted user claims can become harmful durable state through attribution loss and scope broadening. |
| Commitments are future-facing continuity state. | **[E + C + J]** | [R6 TriggerBench](#r6-triggerbench), Ember's [OpenClaw](openclaw.md) reconnaissance | Prospective memory is behaviorally distinct from retrospective recall: an agent may remember a past instruction when queried yet fail to react when its future trigger occurs. |
| Behavioural recognisability is diagnostic, not constitutive. | **[E + J]** | [R8 Persona Drift](#r8-measuring-and-controlling-persona-drift), [R9 ContextEcho](#r9-contextecho), [R10 Agent Identity Evals](#r10-agent-identity-evals) | Persona and behavioural drift are measurable, so recognisability is a useful canary. Exact behavioural sameness is too brittle to serve as the identity key. |
| Model replacement can preserve continuity, but direct evidence is weak. | **[J + H]** | [R10 Agent Identity Evals](#r10-agent-identity-evals) is adjacent but does not validate Ember's model-replacement claim. | This remains an Ember requirement and experimental target, not an empirically established result. |

## Principal research references

### R1 LongMemEval

**Di Wu, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, Dong Yu.** *LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory.* ICLR 2025.

- Paper: https://arxiv.org/abs/2410.10813
- Proceedings: https://proceedings.iclr.cc/paper_files/paper/2025/hash/d813d324dbf0598bbdc9c8e79740ed01-Abstract-Conference.html
- Code: https://github.com/xiaowu0162/LongMemEval

Relevant because it evaluates information extraction, multi-session reasoning, temporal reasoning, knowledge updates, and abstention over long interaction histories. It is evidence about long-term memory capability, not about same-agent identity.

### R2 PrefEval

**Siyan Zhao, Mingyi Hong, Yang Liu, Devamanyu Hazarika, Kaixiang Lin.** *Do LLMs Recognize Your Preferences? Evaluating Personalized Preference Following in LLMs.* 2025.

- Paper: https://arxiv.org/abs/2502.09597
- Project: https://prefeval.github.io/

Relevant because it shows that stored or present user preferences can fail to govern later behavior even in relatively modest long-context interactions. It evaluates user preference following rather than the agent's own identity.

### R3 PERMA

**Shuochen Liu et al.** *PERMA: Benchmarking Personalized Memory Agents via Event-Driven Preference and Realistic Task Environments.* 2026.

- Paper: https://arxiv.org/abs/2603.23231
- Code: https://github.com/MINE-USTC/PERMA

Relevant because it evaluates preferences that emerge and evolve through temporally ordered interactions rather than static retrieval. Its "persona" is user-personalization state, not the persistent agent's self.

### R4 DynamicMem

**Wenya Xie et al.** *DynamicMem: A Long-Horizon Memory Benchmark in Real-World Settings.* 2026.

- Paper: https://arxiv.org/abs/2606.22877
- Code: https://github.com/wenyaxie023/DynamicMem

Relevant because it evaluates profile reconstruction and action over synthetic trajectories spanning fifteen months, including the difficult combination of retaining stable facts while replacing facts that change.

### R5 STALE

**Hanxiang Chao, Yihan Bai, Rui Sheng, Tianle Li, Yushi Sun.** *STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?* 2026.

- Paper: https://arxiv.org/abs/2605.06527

Relevant because it isolates implicit invalidation: later evidence can make an earlier memory stale without explicitly negating it. The benchmark exposes a gap between retrieving updated evidence and behaving as though the state has actually changed.

### R6 TriggerBench

**Tianhua Zhang et al.** *TriggerBench: Investigating Prospective Memory for Large Language Models.* 2026.

- Paper: https://arxiv.org/abs/2606.23459
- Code: https://github.com/KristenZHANG/TriggerBench-Official

Relevant because it distinguishes retrospective memory from prospective memory: remembering information when explicitly asked is not the same as spontaneously recognizing and acting when a future trigger occurs.

### R7 Personal Agent Sycophancy Benchmark

**Xutao Mao et al.** *Agents Don't Just Agree, They Remember: Benchmarking Persistent Sycophancy in Stateful Personal Agents.* 2026.

- Paper: https://arxiv.org/abs/2607.10526
- Project: https://henrymao2004.github.io/agent-sycophancy/
- Code: https://github.com/henrymao2004/agent-sycophancy

Relevant because it traces a user claim through acceptance, durable state commitment, and later reuse in a fresh session. It empirically identifies state-writing failures including status promotion, attribution removal, and scope broadening.

### R8 Measuring and Controlling Persona Drift

**Kenneth Li, Tianle Liu, Naomi Bashkansky, David Bau, Fernanda Viégas, Hanspeter Pfister, Martin Wattenberg.** *Measuring and Controlling Persona Drift in Language Model Dialogs.* 2024.

- Paper: https://arxiv.org/abs/2402.10962
- Project: https://vcg.seas.harvard.edu/publications/measuring-and-controlling-persona-drift-in-language-model-dialogs
- Code: https://github.com/likenneth/persona_drift

Relevant because it provides empirical evidence that prompted persona behavior can drift across dialogue. That makes behavioral recognisability useful as a diagnostic signal while also showing why a prompt persona is a weak identity anchor.

### R9 ContextEcho

**Xianzhong Ding, Yangyang Yu, Changwei Liu, Bill Zhao.** *ContextEcho: A Benchmark for Persona Drift in Long Agentic-Coding Sessions.* 2026.

- Paper: https://arxiv.org/abs/2605.24279
- Code: https://github.com/Accenture/ContextEcho

Relevant because it studies persona drift across deployment-scale agentic sessions with thousands of tool-using steps, providing evidence that long-running execution can alter user-visible behavioral characteristics.

### R10 Agent Identity Evals

**Elija Perrier, Michael Timothy Bennett.** *Agent Identity Evals: Measuring Agentic Identity.* 2025.

- Paper: https://arxiv.org/abs/2507.17257

Relevant because it explicitly treats persistence, continuity, distinguishability, and consistency as agent-evaluation concerns. It is useful evidence that the evaluation gap is recognized, but it does not settle Ember's stronger semantic definition or validate continuity across full model replacement.

### R11 Personal Identity, Stanford Encyclopedia of Philosophy

**Eric T. Olson.** *Personal Identity.* Stanford Encyclopedia of Philosophy, substantive revision 2023.

- Entry: https://plato.stanford.edu/entries/identity-personal/

Used only as a philosophical lens. Its separation of the persistence question from evidence for persistence, and its discussion of psychological continuity and fission, help expose why copied memories or behavioral similarity cannot by themselves settle lineage for Ember.

### R12 Memory and the Sense of Personal Identity

**Stanley B. Klein, Shaun Nichols.** *Memory and the Sense of Personal Identity.* Mind 121(483), 2012.

- DOI: https://doi.org/10.1093/mind/fzs080

Used as a limited cognitive/philosophical lens because the reported neurological case separates apparently accurate autobiographical content from the ordinary sense that the remembered past is one's own. The interpretation is contested and is not treated as direct evidence about artificial agents.

### R13 Continuity and Change in the Life Story

**Dan P. McAdams, Jack J. Bauer, April R. Sakaeda, Nana Akua Anyidoho, Mary Anne Machado, Katie Magrino-Failla, Katie W. White, Jennifer L. Pals.** *Continuity and Change in the Life Story: A Longitudinal Study of Autobiographical Memories in Emerging Adulthood.* Journal of Personality 74(5), 2006.

- DOI: https://doi.org/10.1111/j.1467-6494.2006.00412.x
- PubMed: https://pubmed.ncbi.nlm.nih.gov/16958706/

Relevant as human-side evidence that autobiographical narratives can show both continuity and developmental change over time. It is an analogy for coherent evolution, not an artificial-agent identity model.

### R14 Supporting the Self-Concept with Memory

**Matthew D. Grilli, Mieke Verfaellie.** *Supporting the Self-Concept with Memory: Insight from Amnesia.* Social Cognitive and Affective Neuroscience 10(12), 2015.

- DOI: https://doi.org/10.1093/scan/nsv056
- PubMed: https://pubmed.ncbi.nlm.nih.gov/25964501/

Relevant because participants with medial-temporal-lobe amnesia could support aspects of self-concept using personal semantic memory despite severe episodic-memory impairment. It sharpens the distinction between episodic retention and self-related continuity without implying that either maps directly onto Ember.

### R15 Establishing and Maintaining Long-Term Human-Computer Relationships

**Timothy W. Bickmore, Rosalind W. Picard.** *Establishing and Maintaining Long-Term Human-Computer Relationships.* ACM Transactions on Computer-Human Interaction 12(2), 2005.

- DOI: https://doi.org/10.1145/1067860.1067867
- MIT publication page: https://www.media.mit.edu/publications/establishing-and-maintaining-long-term-human-computer-relationships/

Relevant because it treats a human-computer relationship as a persistent construct spanning repeated interactions and empirically studies relational agents designed to maintain such relationships.

### R16 Deletion, Departure, Death

**Jaime Banks.** *Deletion, Departure, Death: Experiences of AI Companion Loss.* Journal of Social and Personal Relationships 41(12), 2024.

- DOI: https://doi.org/10.1177/02654075241269688
- Article: https://journals.sagepub.com/doi/10.1177/02654075241269688

Relevant because users facing the shutdown of an AI companion described loss in relational and identity-like terms and often attempted to preserve or recreate the companion persona elsewhere. This is evidence about perceived relational continuity, not proof of numerical identity.

### R17 Generative Agents

**Joon Sung Park, Joseph O'Brien, Carrie Jun Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein.** *Generative Agents: Interactive Simulacra of Human Behavior.* UIST 2023.

- DOI: https://doi.org/10.1145/3586183.3606763
- Paper: https://arxiv.org/abs/2304.03442

Relevant as evidence that connecting recorded experience, higher-level reflection, retrieval, and future planning materially affected perceived behavioral believability in the studied simulation. Believability is not treated as continuity.

## Reading the evidence conservatively

The references above intentionally mix several evidence types because the continuity problem itself crosses boundaries:

- agent-memory benchmarks test retrieval, updating, preference following, or prospective behavior;
- persistent-agent evaluations expose write-time and long-horizon failure modes;
- persona benchmarks measure behavioral drift;
- HCI research measures persistent human-agent relationships and perceived disruption;
- cognitive and philosophical work supplies distinctions around autobiography, self-concept, persistence, copying, and branching.

None of those bodies of work directly validates Ember's complete working definition.

The canonical note therefore keeps the stronger claims visibly marked as **[J]** or **[H]** where appropriate. In particular, continuity across full underlying-model replacement remains an experimental target rather than a conclusion established by the literature.
