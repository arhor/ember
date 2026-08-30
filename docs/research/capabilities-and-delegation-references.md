---
summary: "Portable evidence map supporting canonical delegation semantics with runtime contracts, protocols, multi-agent research, failure analyses, and privacy evidence."
read_when:
  - "Checking evidence behind direct-action, capability-use, or delegation boundaries and runtime ownership"
  - "Challenging specialist-context, provenance, verification, privacy, or delegation-continuity conclusions"
role: evidence
discovery_status: current
---

# Capabilities and Delegation Evidence Map

This document is the portable evidence companion to [Capabilities and Delegation Semantics](capabilities-and-delegation.md).

The semantic note remains the canonical Ember-facing synthesis. This companion exists so that evidence labels such as **[E]**, **[C]**, **[J]**, **[H]**, and **[L]** remain inspectable outside the originating Deep Research session.

The preserved [Deep Research artifact](source-material/capabilities-and-delegation-deep-research.md) contains the broader research narrative and runtime evidence. Research-session citation markers are provenance rather than a portable bibliography; the durable sources below are intended to remain usable from the repository alone.

This map deliberately does not duplicate the full bibliographies from the preceding phases. They remain inherited inputs:

- [Continuity and Identity Evidence Map](continuity-and-identity-references.md)
- [Memory and Remembering Evidence Map](memory-and-remembering-references.md)
- [Context Selection and Cognitive Framing Evidence Map](context-selection-and-cognitive-framing-references.md)

Rapidly changing runtime and protocol claims were examined on **2026-08-28**. Codex claims below are anchored to an examined repository commit where practical; ACP and MCP claims should be revalidated before later architecture work if their specifications have evolved.

## Evidence map for validated conclusions

| Canonical conclusion | Basis | Principal portable evidence | Interpretation for Ember |
|---|---|---|---|
| Direct action, bounded capability use, and delegation are semantic regions distinguished by ownership of material intermediate discretion, not by API or protocol labels. | **[C + J]** | [R11 Codex](#r11-openai-codex-runtime), [R12 ACP](#r12-agent-client-protocol), [R13 MCP](#r13-model-context-protocol), inherited system notes for [Hermes](hermes.md), [OpenClaw](openclaw.md), [NanoBot](nanobot.md), and [Letta](letta.md) | A deterministic service may remain tool-like despite complexity; a nominal `tool` may be delegation-shaped if it interprets an objective and owns a meaningful loop. |
| Runtime ownership is distinct from responsibility, authority, control, observability, steerability, and provenance. | **[C + L + J]** | [R11 Codex](#r11-openai-codex-runtime), [R12 ACP](#r12-agent-client-protocol), [R13 MCP](#r13-model-context-protocol); inherited Ember principles | Current runtimes expose partial control and observability without making the caller owner of the specialist's internal cognition. The stronger separation is an Ember semantic judgment. |
| Ember remains responsible for the delegation envelope without owning specialist-local cognition. | **[J]** | Inherited continuity, memory, and context semantics; implementation convergence in [Hermes](hermes.md), [OpenClaw](openclaw.md), and [R11 Codex](#r11-openai-codex-runtime) | Delegation must not become either agency laundering or ownership laundering. Ember owns why she delegated, the governing bounds, and how she later relies on the result. |
| Delegation creates a new context and privacy boundary. | **[E + L + J]** | [R10 Multi-Agent Privacy](#r10-got-a-secret), inherited context evidence including CIMemories, Nissenbaum contextual integrity, and least-privilege lenses | Relevance to Ember does not imply need or permission for the specialist. Least sufficient context is semantic sufficiency under legitimate disclosure, not token minimization. |
| Specialist reports may support Ember's beliefs without becoming Ember's direct observations. | **[E + J]** | Inherited memory evidence on source attribution, persistent-agent attribution loss, and evidential conservation; [R2 failure taxonomy](#r2-why-do-multi-agent-llm-systems-fail) | Belief ownership and evidence ownership are distinct. Verification can strengthen evidence without rewriting who originally observed or acted. |
| Multiple agents do not automatically provide independent evidence. | **[E + L + J]** | [R5 expert dilution](#r5-multi-agent-teams-hold-experts-back), [R6 Silo-Bench](#r6-silo-bench), [R7 reliability limits](#r7-reliability-limits-of-multi-agent-planning), inherited evidential-conservation rule | Same-model, same-source, or tightly coupled agents can share failure modes. Agreement should be weighted by independence of evidence and capability, not agent count. |
| Verification should become stronger as consequence, irreversibility, uncertainty, opacity, conflict, and stale-world risk rise. | **[E + J]** | [R2 failure taxonomy](#r2-why-do-multi-agent-llm-systems-fail), [R9 compiler case study](#r9-building-a-c-compiler-with-parallel-claudes), inherited staged-recall and provenance semantics | Specialist completion is evidence about runtime judgment, not automatic truth or authorization for a consequential downstream action. |
| Failure and cancellation do not imply that nothing happened or that external effects were rolled back. | **[C + J]** | [R11 Codex](#r11-openai-codex-runtime), [R13 MCP](#r13-model-context-protocol) | Interruption/cancellation are control-flow facts. External file, message, financial, remote-job, or nested effects can survive a failed or cancelled episode. |
| Cancellation request, acknowledgement, actual stop, and rollback are distinct meanings. | **[C + J]** | [R11 Codex](#r11-openai-codex-runtime), [R13 MCP](#r13-model-context-protocol) | Ember should report uncertain stop state truthfully rather than treating a cancellation API as proof that all activity or effects ceased. |
| Retrying ambiguous non-idempotent work can duplicate side effects. | **[L + J]** | Runtime side-effect semantics in [R11](#r11-openai-codex-runtime) and [R13](#r13-model-context-protocol); distributed-systems idempotency lens | Before consequential retry, external state may need checking. Exact retry policy remains deferred. |
| Ember continuity, delegated-objective continuity, and specialist-thread continuity are distinct. | **[C + J]** | Inherited continuity research; [R11 Codex](#r11-openai-codex-runtime), [R12 ACP](#r12-agent-client-protocol) | A new specialist thread is not a new Ember; a persistent specialist thread is not part of Ember's identity. Thread reuse is useful only while its inherited state remains relevant and current. |
| Completion of long-running work does not imply current relevance. | **[J]** | Inherited context currentness/reconstruction semantics; runtime support for long-lived work in [R11](#r11-openai-codex-runtime), [R12](#r12-agent-client-protocol), [R13](#r13-model-context-protocol) | A historically correct result can become obsolete before return. Ember must re-establish current applicability before relying on it. |
| Canonical Ember history need not absorb the specialist's full local transcript or scratch state. | **[C + J]** | Inherited history/memory/context separation; [Hermes](hermes.md), [OpenClaw](openclaw.md), [R11 Codex](#r11-openai-codex-runtime) | Accountability requires durable meaning about why work was delegated, material bounds, result, effects, uncertainty, and later reliance, not possession of every specialist token. |
| Nested delegation does not make every subordinate decision Ember's own action. | **[C + J]** | [R11 Codex](#r11-openai-codex-runtime), [R8 Anthropic research system](#r8-anthropic-multi-agent-research-system), [R9 compiler case study](#r9-building-a-c-compiler-with-parallel-claudes) | Ember needs nested topology when it changes authority, privacy, side effects, cost, provenance, independence, or verification requirements; otherwise high-level attribution can be sufficient. |
| Interoperable protocol support for progress, sessions, approvals, or cancellation does not solve semantic ownership and responsibility. | **[C + J]** | [R12 ACP](#r12-agent-client-protocol), [R13 MCP](#r13-model-context-protocol), [R11 Codex](#r11-openai-codex-runtime) | Protocol representations expose useful facts but cannot decide whether context is legitimate, whether evidence is trustworthy, whether work remains current, or who may grant authority. |
| Rich native integration can be semantically useful when it exposes facts a thinner surface loses. | **[C + J]** | [R11 Codex](#r11-openai-codex-runtime), contrasted with [R12](#r12-agent-client-protocol) and [R13](#r13-model-context-protocol) | Stable work identity, progress, side effects, approval origin, steering, cancellation state, compaction, nested execution, and resumability can matter. This does not choose a protocol. |
| Multi-agent decomposition is task- and topology-dependent rather than generally superior. | **[E + J]** | [R1 scaling agent systems](#r1-towards-a-science-of-scaling-agent-systems), [R3 strong single-agent baseline](#r3-rethinking-the-value-of-multi-agent-workflow), [R4 equal-thinking-budget comparison](#r4-single-agent-versus-multi-agent-under-equal-thinking-budgets), [R8](#r8-anthropic-multi-agent-research-system), [R9](#r9-building-a-c-compiler-with-parallel-claudes) | Delegation is conditional optimization. Task separability, capability diversity, verifier strength, and coordination cost matter more than architectural fashion. |
| Coordination, verification, and termination failures are first-class multi-agent failure modes. | **[E]** | [R2 Why Do Multi-Agent LLM Systems Fail?](#r2-why-do-multi-agent-llm-systems-fail), [R6 Silo-Bench](#r6-silo-bench) | Decomposition can introduce repetitive work, bad termination, information withholding, wrong assumptions, and synthesis failures even when individual agents are capable. |
| A stronger single-agent baseline can erase some apparent homogeneous multi-agent gains. | **[E]** | [R3](#r3-rethinking-the-value-of-multi-agent-workflow), [R4](#r4-single-agent-versus-multi-agent-under-equal-thinking-budgets) | "More agents" can quietly mean "more inference." Ember should compare delegation against a competent direct baseline and account for compute. |
| Team synthesis can dilute rather than preserve expert judgment. | **[E]** | [R5 Multi-Agent Teams Hold Experts Back](#r5-multi-agent-teams-hold-experts-back) | Consensus is not automatically evidence of quality. Specialist competence and evidence quality may need to outrank majority aggregation. |
| Multi-agent systems can deliver large gains for naturally parallel breadth-first search, at substantial compute cost. | **[E, case study]** | [R8 Anthropic research system](#r8-anthropic-multi-agent-research-system) | This is strong positive evidence for separable parallel work, not proof that teams dominate direct execution generally. |
| Large coding teams can work when subtasks are separable and strong executable verification exists; tight coupling creates duplication and conflict. | **[E, case study]** | [R9 Anthropic compiler case study](#r9-building-a-c-compiler-with-parallel-claudes) | Coding delegation can earn its cost through parallelism and strong tests, but shared-code coupling and large inference budgets are material constraints. |
| Delegation should have to beat a competent direct baseline. | **[H]** | Synthesis of [R1](#r1-towards-a-science-of-scaling-agent-systems), [R3](#r3-rethinking-the-value-of-multi-agent-workflow), [R4](#r4-single-agent-versus-multi-agent-under-equal-thinking-budgets), [R8](#r8-anthropic-multi-agent-research-system), and [R9](#r9-building-a-c-compiler-with-parallel-claudes) | This is an Ember experimental null hypothesis, not a universal theorem. Delegation must justify its added context, coordination, latency, cost, authority, and verification boundaries. |

## Principal research references

### R1 Towards a Science of Scaling Agent Systems

**Yubin Kim et al.** *Towards a Science of Scaling Agent Systems.* 2025.

- Paper: https://arxiv.org/abs/2512.08296

Relevant because it evaluates multiple coordination topologies across different task environments and model families. The reported value of multi-agent coordination is strongly task-structure dependent, with parallelizable tasks benefiting more than sequential reasoning tasks. Treat individual percentages and topology rankings as benchmark-specific.

### R2 Why Do Multi-Agent LLM Systems Fail?

**Mert Cemri et al.** *Why Do Multi-Agent LLM Systems Fail?* 2025.

- Paper: https://arxiv.org/abs/2503.13657

Relevant because the study analyzes 1,642 failure traces from seven multi-agent systems and develops a taxonomy spanning system design/specification, inter-agent misalignment, and verification/termination. Reported failures include repetitive steps, inability to recognize completion, task derailment, information withholding, wrong assumptions, and reasoning/action mismatch.

### R3 Rethinking the Value of Multi-Agent Workflow

**Jiawei Xu et al.** *Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline.* 2026.

- Paper: https://arxiv.org/abs/2601.12307

Relevant because it strengthens the single-agent baseline and shows that some gains attributed to homogeneous multi-agent workflows can be reproduced more efficiently by one agent, particularly when redundant computation and cache reuse are accounted for. The authors explicitly distinguish this from heterogeneous systems with genuinely different capabilities.

### R4 Single-Agent versus Multi-Agent under Equal Thinking Budgets

**Dat Tran, Douwe Kiela.** *Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets.* 2026.

- Paper: https://arxiv.org/abs/2604.02460

Relevant because it normalizes reasoning compute in evaluated multi-hop reasoning tasks and finds that tested single-agent configurations can match or exceed multi-agent alternatives. It is direct evidence against comparisons where more agents implicitly receive more inference budget.

### R5 Multi-Agent Teams Hold Experts Back

**Aneesh Pappu et al.** *Multi-Agent Teams Hold Experts Back.* 2026.

- Paper: https://arxiv.org/abs/2602.01011

Relevant because the evaluated team synthesis can underperform the strongest member, showing that aggregation and consensus may dilute expert judgment rather than preserve it. The exact result is task- and setup-specific, but the evidential warning is portable.

### R6 Silo-Bench

**Yuzhe Zhang et al.** *Silo-Bench.* 2026.

- Paper: https://arxiv.org/abs/2603.01045

Relevant because it evaluates coordination where information is distributed across agents. Agents can communicate yet still fail to synthesize distributed state effectively, and coordination overhead grows with the distributed problem.

### R7 Reliability Limits of Multi-Agent Planning

**Ruicheng Ao, Siyang Gao, David Simchi-Levi.** *On the Reliability Limits of LLM-Based Multi-Agent Planning.* 2026.

- Paper: https://arxiv.org/abs/2603.26993

Relevant as an empirical/theoretical lens on information distribution and correlated error. Under its assumptions, communication does not manufacture new evidence and can discard information. The assumptions are idealized, so this should not be treated as a universal theorem about deployed agent systems.

### R8 Anthropic Multi-Agent Research System

**Anthropic.** *How we built our multi-agent research system.* Published 2025-06-13.

- Engineering article: https://www.anthropic.com/engineering/multi-agent-research-system

Relevant as a positive production case study. Anthropic reports that a lead Claude Opus 4 plus parallel Sonnet 4 subagents outperformed single-agent Opus 4 by 90.2% on its internal research evaluation and reports large latency improvements from parallel search. The same article emphasizes coordination complexity and much higher token use. This is strong evidence for breadth-first, naturally parallel research, not a controlled universal superiority claim.

### R9 Building a C Compiler with Parallel Claudes

**Nicholas Carlini / Anthropic.** *Building a C compiler with a team of parallel Claudes.* Published 2026-02-05.

- Engineering article: https://www.anthropic.com/engineering/building-c-compiler

Relevant as a large engineering case study of parallel autonomous coding. Anthropic reports 16 agents, nearly 2,000 Claude Code sessions, roughly $20,000 in API cost, and a 100,000-line Rust-based C compiler capable of building Linux 6.9 on several architectures. The report also documents coordination ceilings and motivates strong executable verification. It is an impressive case study rather than a controlled proof that multi-agent coding dominates a strong single-agent baseline.

### R10 Got a Secret?

**Aman Priyanshu, Supriti Vijay, Esha Pahwa.** *Got a Secret? LLM Agents Can't Keep It: Evaluating Privacy in Multi-Agent Systems.* 2026.

- Paper: https://arxiv.org/abs/2605.27766

Relevant because it measures privacy leakage across synthetic multi-agent interaction and finds that privacy instructions reduce but do not eliminate disclosure. It supports treating every delegate as a new recipient-specific information-flow boundary.

### R11 OpenAI Codex Runtime

**OpenAI Codex repository**, examined on **2026-08-28** at commit `7625343977154efed8c0dadba956374992a1580b`.

- Repository snapshot: https://github.com/openai/codex/tree/7625343977154efed8c0dadba956374992a1580b

Relevant runtime evidence includes persistent/resumable specialist work, streamed progress, approvals, interruption, steering, compaction, command/file activity, and nested-agent relationships exposed by the current runtime/app-server surfaces. The important semantic observation is that caller-visible control and progress do not make the caller owner of Codex's specialist cognition.

The examined runtime also makes the side-effect boundary concrete: reverting or interrupting specialist conversation/work state is not equivalent to transactionally reverting external file effects. These claims are rapidly changing implementation evidence and should be revalidated against the then-current Codex version before implementation decisions.

### R12 Agent Client Protocol

**Agent Client Protocol (ACP)**, official specification/repository, examined **2026-08-28**.

- Repository: https://github.com/agentclientprotocol/agent-client-protocol

Relevant because ACP exposes interoperable session/work continuity, progress, permission requests, cancellation, and resume/load semantics. These facilities demonstrate that autonomous specialist runtimes need richer lifecycle interaction than atomic function calls, while leaving Ember's questions of responsibility, autobiographical ownership, privacy scope, and authority unresolved.

### R13 Model Context Protocol

**Model Context Protocol (MCP)** specification release **2026-07-28**, examined **2026-08-28**.

- Specification: https://modelcontextprotocol.io/specification/2026-07-28

Relevant because current MCP separates protocol representation from the semantic autonomy behind an endpoint. Tool calls can front arbitrarily sophisticated implementations, and current task facilities expose long-running work, input requirements, terminal states, and cooperative cancellation. This supports the conclusion that `tool` is not a sufficient semantic category for Ember.

## Inherited evidence used by this phase

The following evidence is intentionally not duplicated in full because its portable bibliography already lives in the preceding research maps:

- **Continuity and identity:** lineage-sensitive continuity, autobiographical ownership, commitment continuity, model/runtime replacement, and epistemic restraint. See [Continuity and Identity Evidence Map](continuity-and-identity-references.md).
- **Memory and remembering:** specialist-report provenance, source attribution, evidential conservation, corrections, current-versus-historical truth, and truthful gaps. See [Memory and Remembering Evidence Map](memory-and-remembering-references.md).
- **Context selection:** least sufficient permitted context, recipient-sensitive privacy, contextual integrity, currentness, stale-state risk, contradiction preservation, and delegation as a new context boundary. See [Context Selection and Cognitive Framing Evidence Map](context-selection-and-cognitive-framing-references.md).

Especially relevant inherited sources include CIMemories (`arXiv:2511.14937`), Helen Nissenbaum's *Privacy as Contextual Integrity*, Saltzer and Schroeder's least-privilege/security principles, and the persistent-agent provenance/security literature already mapped by issues #4 and #5.

## Evidence limitations and open empirical gaps

No benchmark reviewed in this phase directly evaluates an Ember-like persistent personal agent over long periods while jointly varying delegation, specialist replacement, privacy scope, provenance, late results, commitments, approval, cancellation, partial external effects, and autobiographical continuity. **[H]** The canonical ownership model is therefore a disciplined Ember judgment constrained by several evidence streams rather than a benchmark-proven ontology.

The empirical delegation literature is also unusually sensitive to inference budget. Several positive multi-agent results use substantially more tokens, model calls, wall-clock resources, or tool activity than their single-agent comparator, while several negative studies deliberately normalize compute. Any future Ember evaluation should therefore record task success together with inference cost, latency, parallelism, verifier use, context disclosure, and whether the baseline was genuinely competitive.

Many multi-agent benchmarks use homogeneous agents. Ember's most compelling future delegation case is often heterogeneous: a specialist may possess tools, environment access, long-lived domain state, or model competence unavailable to Ember's direct loop. Results about homogeneous debate or agent multiplication should not be generalized to that setting without new experiments.

Current runtime contracts are moving targets. Codex, ACP, and MCP evidence in this map is a dated snapshot used to reveal semantic pressures, not a promise that exact surfaces or guarantees will remain stable.
