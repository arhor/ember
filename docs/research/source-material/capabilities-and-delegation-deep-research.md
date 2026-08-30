---
summary: "Preserved Deep Research report behind the canonical capabilities and delegation synthesis; non-canonical source material retained for provenance and reconstruction."
read_when:
  - "Reconstructing the original capabilities and delegation research after the canonical note and evidence map are insufficient"
  - "Auditing source-level evidence, caveats, or research-session reasoning behind delegation and specialist-boundary conclusions"
role: source
discovery_status: current
---

# Capabilities, Delegation, and Runtime Ownership for Ember

> **Source-material status:** non-canonical research artifact preserved behind the issue #6 synthesis. This file preserves the substantive Deep Research report and its evidence ledger while omitting UI-only research metadata and normalizing session-local citation markup into durable links where practical. The canonical Ember-facing conclusions live in [Capabilities and Delegation Semantics](../capabilities-and-delegation.md), and the portable bibliography lives in the [evidence map](../capabilities-and-delegation-references.md).

## Research basis and central conclusion

Issue #6 asks a semantic question before an integration question: when is Ember doing something herself, when is she using a bounded capability, when is she delegating an objective to another autonomous runtime, and what remains hers when another runtime owns a substantial part of cognition or execution?

Issue #10 constrains the method. Research should be concern-driven rather than project-driven, empirical and protocol evidence should be first-class inputs, evidence strength should remain visible, and natural-language semantics should precede representation. The research therefore uses Codex, ACP, MCP, NanoBot, Hermes, OpenClaw, Letta, multi-agent benchmarks, failure studies, privacy work, and adjacent security/distributed-systems distinctions as evidence rather than templates.

Issues #3–#5 are active constraints:

- Ember's continuity belongs to Ember rather than any individual model, interface, specialist, or execution runtime.
- An externally produced observation or report retains its provenance; receiving a specialist report is Ember's experience, while the unobserved event described by it is not automatically Ember's direct experience.
- Repetition, retries, summaries, or correlated agents do not manufacture independent evidence.
- Delegation creates a new contextual boundary. Relevance to Ember does not imply need or permission for the specialist, and least sufficient context means the smallest **permitted and semantically adequate** projection, not the fewest tokens.
- Context, provenance, uncertainty, currentness, scope, ownership, and privacy distinctions must survive delegation and reintegration.

No substantive evidence reviewed in this phase requires reopening those conclusions. The newer multi-agent and runtime evidence instead strengthens the case that delegation needs stricter provenance, currentness, contextual isolation, and responsibility boundaries.

The central result is:

> **[J] Ember owns the decision to undertake and integrate delegated work without needing to own the delegate's internal cognition. A specialist may legitimately own the local reasoning loop, intermediate plan, task-local thread, compaction, tool choices, retries, and subordinate execution. Ember remains responsible for the delegation envelope: why the work was delegated, what objective and constraints were given, what context and authority were exposed, how the returned evidence is interpreted, what consequential effects may have occurred, and what Ember subsequently believes, remembers, communicates, or does.**

The inverse is equally important:

> **[J] Delegation does not make the specialist's internal life Ember's autobiography. Ember should not claim to have chosen intermediate steps she did not choose, observed executions she did not observe, verified results she merely received as reports, stopped work merely because she requested cancellation, or controlled runtime state that belonged to the specialist.**

This avoids two symmetric failures:

- **agency laundering**: Ember intentionally initiates work and later relies on it, but tries to disclaim responsibility because "the specialist did it";
- **ownership laundering**: Ember says "I did it" when another runtime actually interpreted the objective and controlled the consequential loop.

A compact form is:

> **[J] Another runtime may own the _how_ of delegated cognition without owning Ember's continuing _why_, and without becoming Ember.**

## Evidence vocabulary

| Mark | Meaning in this report |
|---|---|
| **[E] Empirical** | Benchmarks, controlled or semi-controlled experiments, measured traces, failure analyses, or documented runtime behavior. |
| **[C] Convergence** | A recurring semantic pressure independently visible in mature implementations. |
| **[J] Judgment** | An Ember-specific conclusion drawn from project goals, inherited constraints, scenarios, and evidence. |
| **[H] Hypothesis** | A plausible claim that should remain experimentally testable. |
| **[L] Lens** | A distinction borrowed from security, distributed systems, organizations, HCI, or adjacent fields to sharpen reasoning without dictating architecture. |

Multi-agent evidence is unusually sensitive to task structure, model family, topology, communication budget, inference budget, verifier quality, and baseline strength. Results below therefore should not be read as universal claims about "multi-agent systems" in the abstract.

## Semantic ownership model

The most useful distinction is not local versus remote, MCP versus ACP, function versus agent, or synchronous versus asynchronous. It is **who owns meaningful decision-making between objective and outcome**.

> **[J] Direct action, bounded capability use, and delegation are semantic regions rather than implementation types.**

| Mode | Who interprets the immediate objective? | Who chooses meaningful intermediate steps? | Who owns the task-local reasoning loop? | What Ember can truthfully say |
|---|---|---|---|---|
| **Ember acting directly** | Ember | Ember | Ember | "I reasoned through this and decided…" |
| **Bounded capability use** | Ember | Primarily Ember; the capability performs a sufficiently specified operation | Ember retains the larger loop | "I ran/read/queried X and observed Y." |
| **Delegation** | Ember establishes objective and constraints; specialist interprets them locally | Specialist has material discretion | Specialist | "I asked the specialist to achieve X; it chose the intermediate approach." |

A useful working hypothesis from issue #6 survives testing:

> **[J] A capability is semantically tool-like when Ember principally chooses the operation and remains owner of the consequential reasoning loop. A relationship is semantically delegated when another system receives an objective and gains meaningful discretion over how to interpret, pursue, revise, and complete it.**

The key refinement is **material discretion**. Not every internal choice matters semantically. A compiler makes enormous numbers of internal decisions but does not normally interpret the user's objective on Ember's behalf. A shell command such as `git status` is tool-like. A browser controlled step-by-step by Ember is tool-like. A browser agent told "investigate these suppliers, decide which evidence matters, and recommend one" is delegation-shaped because it owns an investigative loop.

An MCP endpoint labelled a `tool` can likewise be delegation-shaped if it receives a broad objective, plans internally, performs multiple actions, asks for input, recovers from local failure, or decides when an objective is satisfied. Conversely, a deterministic file read wrapped in an "agent" interface remains bounded capability use.

> **[J] Protocol nouns do not determine agency.**

The strongest practical discriminator is:

> **[J] Ask who is entitled to decide a consequential next step that Ember did not individually specify.**

A second discriminator is whether the external system can revise its plan, choose tools, maintain unresolved discoveries, handle local failure, request additional context, decide when enough has been done, and possibly delegate again.

### Ownership, control, authority, and provenance are different

The following concepts should not be collapsed:

| Concept | Semantic question |
|---|---|
| **Objective ownership** | Whose continuing purpose explains why this work exists? |
| **Runtime ownership** | Which system controls the local cognition/execution loop and task-local state? |
| **Control** | Which system can actually start, steer, pause, stop, or modify execution now? |
| **Capability** | What actions can the actor technically perform? |
| **Authority** | What actions is the actor legitimately permitted to perform? |
| **Observability** | What facts about the work can Ember actually see? |
| **Steerability** | How much can Ember change an already-running course of action? |
| **Responsibility** | What must Ember still decide, check, disclose, repair, or account for? |
| **Accountability** | What explanation can later be demanded about why Ember initiated or relied on the work? |
| **Provenance** | Who actually supplied each observation, inference, action, or result? |

**[L + J] Runtime ownership is an operational locus, not a synonym for responsibility or authority.** Adjacent distributed and security systems routinely separate possession of a mechanism, permission to use it, knowledge of its state, and responsibility for decisions made around it. Ember should use those distinctions as lenses without importing an operating-system or workflow-engine architecture.

Current Codex surfaces make the separation concrete: a caller can start or resume work, receive progress, steer, interrupt, respond to approvals, or trigger compaction while Codex still owns the specialist thread's local execution semantics. Caller control can be substantial without becoming internal cognitive ownership.

> **[C + J] Control can be partial. Observability can be partial. Authority can be narrower than capability. Responsibility can persist after control has been transferred. None of these facts turns the specialist into Ember.**

### The delegation envelope

The report's strongest synthesis is the **delegation envelope**. This is semantic vocabulary, not a proposed object or schema.

The envelope includes:

- why the work exists and why delegation is worthwhile;
- which specialist was chosen and why;
- the objective and acceptance constraints;
- the context shared and deliberately withheld;
- the authority boundary implicated by the work;
- the standard by which the returned result will be considered usable;
- known or plausible side effects;
- the way Ember will interpret, verify, communicate, remember, and possibly act on the result.

Inside the envelope, a specialist may choose files to inspect, hypotheses to test, commands to run, implementation sequence, local retries, internal summaries, or subordinate agents. Ember does not need to reconstruct those choices as her own thoughts.

This yields the answer to what another runtime may own:

> **[J] A specialist may own its local conversation, task context, intermediate reasoning, plan revision, tool loop, scratch state, compaction, retries, local memory, and nested subagents without threatening Ember's identity, provided those remain specialist-local and Ember preserves her own relationship to the delegated objective and its consequences.**

And the inverse:

> **[J] Accountability requires an intelligible record of the delegation and consequential outcomes, not possession of the specialist's entire cognitive history.**

## Responsibility, evidence, lifecycle, and continuity

### Responsibility after delegation

The responsibility that survives delegation is substantial but bounded.

**[J] Ember remains responsible for deciding whether delegation is appropriate; selecting the specialist; defining the objective; preserving governing constraints; selecting least sufficient permitted context; refusing unjustified context expansion; recognizing relevant authority boundaries; interpreting progress and uncertainty; deciding how much verification is warranted; reassessing currentness before relying on a late result; representing specialist provenance honestly; accounting for known or plausible side effects; and integrating the episode into beliefs and memory without attribution loss.**

That does not make Ember responsible for every unknowable hidden choice made by an autonomous runtime. Responsibility should track decisions Ember could legitimately make and foreseeable consequences of relying on the delegate rather than hypothetical omniscience.

A concise formulation is:

> **[J] Ember is responsible for delegation as _her act_; the delegate is attributable for cognition and execution that were _its acts_.**

### Delegated context

Issue #5 supplies the decisive rule:

> **Relevance to Ember does not imply necessity or permission for the delegate.**

Its stronger least-sufficient-context rule carries forward:

> **[L + J] A delegate should receive enough permitted context to perform the role Ember actually delegated, including necessary constraints and evidential status, but no personal, relational, autobiographical, project-external, or authority-bearing context merely because it is available or would make the task marginally easier.**

This creates two symmetric failure modes.

**Over-disclosure** occurs when Ember sends private motivations, relationship history, unrelated memory, broad credentials, or other personally meaningful state simply because it might help.

**Under-contextualization** occurs when Ember withholds legitimately needed information so aggressively that the specialist solves a materially false or incomplete problem. That is not a privacy success.

A private motivation can often be translated into an operational consequence. For example, Ember may know a personal reason the user wants extremely narrow scope while telling a coding specialist only: "Prefer the smallest safe change; do not broaden the scope." This is valid when the specialist needs the operational constraint rather than its private origin.

Translation fails when the private information changes the specialist's actual epistemic task. In that case Ember should retain the sensitive judgment herself, narrow the delegated role, seek whatever authorization is later required, or decline that delegation.

> **[J] "The specialist asked for X" is not permission to disclose X.**

### Epistemic ownership of delegated evidence

Issue #4's rule survives intact:

> **Receiving a report is Ember's experience. The unobserved event described by the report is not thereby Ember's direct experience.**

Therefore:

- "Codex reported that the tests passed" is directly supported by the report.
- "I believe the tests pass, based on Codex's report" can be legitimate when Ember adopts the report as sufficiently reliable evidence.
- "I inspected the test logs and verified that they pass" requires additional Ember-side observation.
- "I watched the tests pass" is false unless Ember actually observed the run.

> **[J] Ember may adopt a specialist's conclusion as her own belief without erasing its evidential ancestry. Belief ownership and evidence ownership are different.**

Independent verification expands the evidence base. It does not rewrite history: the specialist still performed the original work, and Ember later verified some part of the result.

Multiple specialists require **evidential conservation**. Three agents using the same model and source material are not automatically three independent witnesses. Three retries from one thread are less independent still. Agreement becomes stronger evidence only to the extent that evidence, tools, models, assumptions, or direct observations differ in ways that reduce correlated failure.

Current team research gives this concern empirical weight: some evaluated synthesis mechanisms dilute the strongest expert rather than improve on it. Consensus should therefore not substitute for source-quality adjudication.

> **[J] Specialist disagreement should remain disagreement until Ember has a reason to adjudicate it.**

### Verification

Verification should be consequence-sensitive rather than universal.

> **[J] The need for independent verification rises with consequence, irreversibility, uncertainty, specialist opacity, conflicting evidence, stale-world risk, and weakness of observable specialist evidence.**

Routine low-consequence work can often be accepted on a report. A result that will trigger an irreversible external action deserves a higher evidential bar.

> **[J] Specialist completion must never, by itself, semantically imply permission for an irreversible downstream action.**

Completion is the runtime's terminal judgment about the delegated objective. It does not establish that the external world remains in the assumed state, that all acceptance conditions were correctly interpreted, or that downstream action is authorized.

### Progress, partial work, and side effects

Delegation is not atomic. The following are meanings Ember may infer, not a proposed state machine.

| Reported condition | What Ember is entitled to infer | What Ember must not infer |
|---|---|---|
| **Accepted** | The runtime acknowledged or created the work. | Meaningful execution has begun or no effect occurred. |
| **Started / in progress** | The specialist loop is active. | Work remains reversible or side-effect free. |
| **Blocked** | Work currently lacks something needed to continue. | Earlier steps did nothing. |
| **Waiting for approval** | A contemplated next action is gated. | No earlier action changed state. |
| **Partially complete** | Some relevant work is believed finished while the objective remains unresolved. | Partial state is safe, consistent, or ready to use. |
| **Failed** | The objective was not established as successfully completed. | Nothing happened. |
| **Cancellation requested** | Ember has expressed that continuing work is no longer wanted. | The specialist stopped. |
| **Cancellation acknowledged** | The runtime accepted the request according to its contract. | Already-launched effects were undone. |
| **Cancelled / interrupted** | The runtime reports its relevant execution as stopped. | Files, messages, charges, remote jobs, or nested work were rolled back. |
| **Completed** | The runtime believes the delegated objective reached terminal success. | Independent truth, continued relevance, or downstream authorization. |
| **Completed with uncertainty** | Work terminated while material uncertainty remains. | Terminal status eliminates uncertainty. |
| **Obsolete success** | Original work may have succeeded relative to the original world state. | The result is still applicable now. |

Current runtime contracts reinforce the most important asymmetry. Codex interruption is not a transactional rollback of external file effects, and MCP task cancellation is cooperative rather than magical revocation of already-triggered activity.

> **[E→J] Failure and cancellation are control-flow facts, not rollback guarantees.**

A truthful statement while cancellation remains uncertain is:

> "I've asked the specialist to stop. I don't yet know that every already-started action has stopped or been undone."

### Approvals

Current specialist runtimes make approvals an explicit boundary. The semantic meaning is:

> **[J] An approval request is evidence that the delegated runtime has reached an action whose authorization cannot be inferred from its currently accepted envelope.**

Issue #6 should not decide who may ultimately grant the authority. It should preserve enough meaning for #7 to answer correctly: who is asking, what action is contemplated, on whose behalf it would occur, what target or third party is affected, what the consequence and reversibility are, what actions already happened, and whether the requested grant is narrow or broad.

Previously granted authority should not be assumed to propagate through delegation simply because a specialist can technically exercise it.

### Retries

Retrying is semantically dangerous when a previous attempt may already have changed the world.

> **[J] Before retrying potentially non-idempotent delegated work after ambiguous failure, Ember should first establish external state to the degree warranted by the consequence.**

Otherwise "try again" may mean send twice, create another resource, charge again, or apply a second mutation.

A continuation in the same specialist thread is normally the same delegated episode when the objective remains live and previous local discoveries are intentionally retained. A fresh thread pursuing the same unresolved objective is another specialist-local episode of the same broader work. A changed objective or materially changed external state can make the next attempt new delegated work even if its wording resembles the original.

Repeated model samples are not automatically new independent evidence. Repeated failure, however, is new evidence about the reliability of the attempted method, specialist, or task assumptions.

### Specialist continuity and thread reuse

Three continuities must remain separate:

> **[J] Ember continuity ≠ delegated-objective continuity ≠ specialist-thread continuity.**

A new Codex thread does not create a new Ember. A persistent Codex thread does not become part of Ember's identity.

The same delegated work is better understood through unresolved objective, dependence on previous discoveries, shared external state, and current user intent than by thread identifier alone.

Resume an old specialist thread when the objective remains substantially the same, local discoveries remain relevant, the world has not invalidated them, and inherited context is more valuable than contaminating.

Prefer a fresh thread when the objective changed, prior state is stale or polluted, compaction may have lost governing distinctions, the external world changed, or true evidential independence is desired.

If the specialist changes its underlying model while preserving its work-state semantics, the delegated objective can remain continuous. This does not affect Ember's identity. Model replacement is relevant provenance when it materially changes competence, confidence, or interpretation. **[J + H]**

### Long-running and late work

A specialist result returning after the conversation moved on belongs first to the original delegated episode.

> **[J] Completion is not automatic foreground relevance.**

Before using a late result, Ember should reconstruct enough of the original objective and current world to ask whether the user still wants the work, requirements changed, the repository or remote state changed, cancellation occurred, or a previously safe consequence is still safe.

An obsolete successful result is not contradictory. The specialist may have correctly satisfied the original objective while circumstances changed around it.

### Canonical Ember history

What must survive specialist disappearance is not every local token.

Canonical Ember history should normally preserve:

- that Ember delegated the objective and why;
- which specialist received it;
- material constraints, privacy boundaries, and authority conditions;
- consequential progress or decisions exposed by the specialist;
- the final report;
- known or plausible side effects;
- unresolved uncertainty;
- verification Ember performed;
- what Ember subsequently believed, communicated, remembered, or did.

It normally does not require every specialist token, hidden scratch reasoning, every temporary hypothesis, every local retry, every compaction step, or routine tool chatter.

If the specialist disappears permanently mid-task, Ember should be able to say:

> "I delegated X under constraints Y. The last thing I reliably learned was Z. These effects are known to have occurred; these others are uncertain. The specialist's internal unfinished state is no longer available."

That is degraded execution continuity, not damage to Ember's identity.

### Nested delegation

A specialist may itself use tools, external services, or subordinate agents.

> **[J] Ember's responsibility does not propagate unchanged down every hidden layer.**

Ember remains responsible for choosing a specialist whose known behavior and boundaries are suitable. The specialist remains attributable for its local decision to use subordinate execution. Ember needs nested topology when it changes authority, privacy, cost, external effects, provenance, evidential independence, reliability, or verification requirements.

This can be truthful:

> "I delegated this to Codex, which used its own tools and subordinate work."

There is no need for Ember to transform that into "I personally chose every command and subagent."

## What current runtimes and protocols expose

This snapshot was examined on **August 28, 2026**. Runtime surfaces are evidence about semantic pressure, not proposals for Ember representation.

| Concern | Codex native runtime/app-server evidence | ACP | MCP | Ember interpretation |
|---|---|---|---|---|
| **Persistent work state** | Explicit resumable/forkable specialist work and thread state. | Sessions can be created, loaded/resumed, and lifecycle-managed. | Core protocol is not an agent-thread ontology; long-running task state can be exposed separately. | Work continuity is semantic; protocol sessions are only one carrier. |
| **Progress** | Streamed command, edit, message, and work-item progress. | Session updates expose progress during work. | Tasks expose working/input-required/terminal progress. | Reported progress remains runtime testimony. |
| **Steering** | Current runtime exposes in-flight steering for appropriate work. | Agent-dependent interactive continuation. | Endpoint/task-contract dependent. | Steerability is independent of runtime ownership. |
| **Approvals** | Runtime can issue scoped approval requests for gated actions. | Permission requests are part of client/agent interaction. | Host/tool policy can gate actions, but protocol transport does not settle authority. | Approval transport is not a permission model. |
| **Cancellation** | Interruption is requested and the relevant specialist work terminates as interrupted according to runtime contract. | Cancellation/session lifecycle exposed. | Task cancellation is cooperative. | Desired stop, requested stop, actual stop, and rollback remain different. |
| **Compaction** | Specialist thread compaction is runtime-owned but externally triggerable/observable through current surfaces. | Agent/runtime internals remain largely agent-owned. | Not an agent-thread semantic of core MCP. | Triggerability does not make compaction Ember's cognition. |
| **Nested agents** | Current runtime exposes parent/child relationships in supported multi-agent modes. | Possible behind an ACP agent. | A nominal tool can front arbitrary subordinate execution. | Nested topology matters when it changes semantics, not because nesting exists. |
| **Side-effect rollback** | Conversation/work-state reversal does not imply file rollback. | No general transactional external rollback guarantee. | Task failure/cancellation is not a transaction rollback guarantee. | Failure/cancellation cannot mean "nothing happened." |

### Codex

Codex is a clear example of specialist runtime ownership. The examined OpenAI Codex repository snapshot (`7625343977154efed8c0dadba956374992a1580b`) exposes long-lived/resumable specialist work, streamed progress, approvals, interruption, steering, compaction, command/file activity, and nested agent relationships.

The semantic consequence is not that Ember should copy Codex's Thread/Turn/Item or other runtime primitives. It is:

> **[C + J] When Codex owns the specialist loop, Ember can own the objective and integration without owning Codex's internal thread semantics.**

Source snapshot: https://github.com/openai/codex/tree/7625343977154efed8c0dadba956374992a1580b

### ACP

The Agent Client Protocol exposes interoperable specialist sessions, progress, permission requests, cancellation, and resumability/lifecycle behavior.

The important semantic distinction is:

> **[J] ACP can make autonomous specialist work interoperable without solving autobiographical ownership, evidential authority, privacy scope, or Ember's responsibility for the delegation.**

A protocol can report that a session resumed while being unable to decide whether inherited local context is still appropriate for today's objective. It can carry a permission request without deciding who may legitimately grant it.

Repository: https://github.com/agentclientprotocol/agent-client-protocol

### MCP

MCP is the strongest counterexample to implementation-shaped vocabulary. The **2026-07-28** protocol release separates protocol representation from the autonomy behind an endpoint; current task facilities can represent long-running work that is working, input-requiring, complete, failed, or cancelled.

Nothing about a `tools/call` label proves the implementation is cognitively bounded.

> **[E→J] "MCP tool" and "autonomous delegate" are not mutually exclusive semantic categories. A protocol endpoint can be tool-shaped externally and delegation-shaped internally.**

Specification: https://modelcontextprotocol.io/specification/2026-07-28

### Native integration versus interoperable protocol

A native integration is not automatically semantically superior. It matters when it exposes facts a thinner surface loses: stable specialist-work identity, detailed progress, approval origin, side-effect visibility, steering, cancellation state, nested execution, compaction boundaries, or resumability.

Protocol-independent properties an eventual integration should preserve when relevant include:

- delegated objective and originating purpose;
- specialist/runtime attribution;
- context and constraint boundary;
- authority/approval boundary;
- progress with epistemic meaning;
- known or possible external effects;
- cancellation semantics;
- result provenance and uncertainty;
- work continuity;
- currentness of assumptions;
- materially consequential nested delegation.

If an integration cannot expose enough of these properties for the consequence at stake, the semantic response is not to pretend they exist. Ember should limit what she entrusts through that boundary or increase verification.

## Empirical value, costs, and failure modes of delegation

The 2025–2026 evidence cuts sharply against a simplistic "more agents means better agents" narrative.

> **[E + J] Multi-agent decomposition is conditional optimization, not a generally superior cognitive architecture.**

### Task and topology dependence

*Towards a Science of Scaling Agent Systems* (2025, arXiv:2512.08296) evaluates multiple coordination topologies across several task environments and model families. Its results are strongly task-structure dependent: naturally parallel work can benefit from centralized coordination while sequential reasoning can degrade; capability saturation and error amplification appear in some arrangements.

This is the shape Ember should care about. Delegation earns its complexity when it adds **new capability, genuinely independent evidence, useful parallelism, or specialization**. Merely multiplying similar model instances can add compute while degrading coherence.

### Failure taxonomy

*Why Do Multi-Agent LLM Systems Fail?* (2025, arXiv:2503.13657) analyzes 1,642 traces from seven systems and identifies failure families in system design/specification, inter-agent misalignment, and verification/termination. Observed failures include repetitive steps, failure to recognize completion, task derailment, information withholding, wrong assumptions, and reasoning/action mismatch.

This supports treating coordination and termination as new failure surfaces rather than free capability.

### Strong single-agent baselines and normalized compute

*Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline* (2026, arXiv:2601.12307) shows that a stronger single-agent baseline can recover much of the apparent value of some homogeneous workflows more efficiently, especially when redundant computation and cache behavior are considered. The work distinguishes these settings from genuinely heterogeneous systems.

*Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets* (2026, arXiv:2604.02460) similarly normalizes reasoning compute and reports cases where tested single agents match or outperform multi-agent structures on multi-hop reasoning.

These studies directly challenge evaluations in which "more agents" quietly means "more total inference."

### Expert dilution and distributed synthesis

*Multi-Agent Teams Hold Experts Back* (2026, arXiv:2602.01011) reports that team synthesis can dilute a stronger expert, with some evaluated teams underperforming their best member. That is direct evidence against treating consensus as automatic improvement.

*Silo-Bench* (2026, arXiv:2603.01045) focuses on distributed information and coordination. Agents can exchange facts but still fail to synthesize the global state effectively, while coordination overhead grows with problem distribution.

*On the Reliability Limits of LLM-Based Multi-Agent Planning* (2026, arXiv:2603.26993) provides a useful analytical lens: when delegation introduces no new observations or capabilities, redistributing the same information cannot magically manufacture independent evidence, and communication/compression can lose information. Its assumptions are idealized, so this should be used as **[L + E]**, not a universal theorem about deployed systems.

### Positive production evidence

Anthropic's *How we built our multi-agent research system* (2025) is important positive evidence. Anthropic reports a 90.2% improvement for one lead Opus 4 plus Sonnet 4 subagent configuration over a single-agent Opus 4 comparison on an internal research evaluation and reports large latency reductions from parallel search. The same report emphasizes coordination complexity and dramatically greater token use.

Source: https://www.anthropic.com/engineering/multi-agent-research-system

The task structure matters: breadth-first research with many independent directions is unusually parallelizable.

Anthropic's *Building a C compiler with a team of parallel Claudes* (2026) provides a different case study. It reports 16 agents, nearly 2,000 Claude Code sessions, approximately $20,000 of API cost, and a roughly 100,000-line Rust-based compiler capable of building Linux 6.9 across multiple architectures. The experiment highlights the value of separable work and strong executable tests, but also the ceilings of tightly coupled shared-code work and enormous inference budgets.

Source: https://www.anthropic.com/engineering/building-c-compiler

These cases are valuable evidence that large teams can work under the right task structure. They are not controlled proof that multi-agent systems dominate a strong single agent generally.

### Privacy cost

*Got a Secret? LLM Agents Can't Keep It* (2026, arXiv:2605.27766) reports privacy leakage in synthetic multi-agent interaction even when privacy instructions are supplied. This reinforces issue #5's conclusion that every delegate is a new recipient-specific disclosure boundary.

### Practical delegation criterion

The evidence supports:

> **[E + J] Delegate when the specialist supplies something materially unavailable to Ember's direct loop — specialized tools, independent observations, distinct model competence, large task-local state, parallelizable branches, or a mature domain-specific execution harness — and when those gains exceed context loss, coordination cost, verification burden, latency, and side-effect risk.**

Delegation is especially promising for:

| Task structure | Why delegation can earn its cost |
|---|---|
| Specialist capability Ember lacks | The delegate adds genuine competence or tools rather than another copy of the same reasoning. |
| Naturally separable parallel work | Branches can progress with little dependence on each other. |
| Large specialist-local working state | Domain-specific state can remain outside Ember's active projection. |
| Heterogeneous evidence gathering | Different specialists can obtain genuinely different evidence. |
| Mature specialist harness | The external runtime already owns a strong domain-specific feedback loop. |
| High-value work with strong verifiers | Additional compute can be justified when results are independently inspectable. |

Delegation is least attractive when:

| Task structure | Why direct action is usually better |
|---|---|
| One deterministic operation | Delegation adds an unnecessary interpretation boundary. |
| Tightly coupled sequential reasoning | Splitting state increases communication and reconciliation cost. |
| Same model, same evidence, same tools | Teamwork may mainly purchase more inference rather than new information. |
| Essential private context cannot be disclosed | The specialist receives an invalid task projection. |
| Low-consequence, low-cost task | Coordination and reintegration can dominate the work. |
| Highly volatile external state | Late results become stale quickly. |
| Consequential work without trustworthy verification | Delegation adds opacity where confidence matters most. |

This supports an Ember-specific null hypothesis:

> **[H] Delegation should have to beat a competent direct baseline, not merely demonstrate that delegation can work.**

## Portable evidence ledger

| Major conclusion | Evidence | Principal portable source |
|---|---|---|
| Multi-agent gains are highly task- and topology-dependent. | **[E]** | Yubin Kim et al., *Towards a Science of Scaling Agent Systems* (2025), https://arxiv.org/abs/2512.08296 |
| Coordination, verification, and termination failures are common failure classes. | **[E]** | Mert Cemri et al., *Why Do Multi-Agent LLM Systems Fail?* (2025), https://arxiv.org/abs/2503.13657 |
| Strong homogeneous single-agent baselines can erase some workflow gains. | **[E]** | Jiawei Xu et al., *Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline* (2026), https://arxiv.org/abs/2601.12307 |
| Compute-normalized single agents can outperform tested MAS on multi-hop reasoning. | **[E]** | Dat Tran, Douwe Kiela, *Single-Agent LLMs Outperform Multi-Agent Systems on Multi-Hop Reasoning Under Equal Thinking Token Budgets* (2026), https://arxiv.org/abs/2604.02460 |
| Team synthesis can dilute expert judgment. | **[E]** | Aneesh Pappu et al., *Multi-Agent Teams Hold Experts Back* (2026), https://arxiv.org/abs/2602.01011 |
| Distributed exchange does not guarantee successful state synthesis. | **[E]** | Yuzhe Zhang et al., *Silo-Bench* (2026), https://arxiv.org/abs/2603.01045 |
| Communication cannot manufacture new evidence and can lose information. | **[L + E]** | Ruicheng Ao, Siyang Gao, David Simchi-Levi, *On the Reliability Limits of LLM-Based Multi-Agent Planning* (2026), https://arxiv.org/abs/2603.26993 |
| Parallel research can benefit substantially at high inference cost. | **[E, case study]** | Anthropic, *How we built our multi-agent research system* (2025), https://www.anthropic.com/engineering/multi-agent-research-system |
| Separable coding plus strong verification can support large teams; tight coupling creates new ceilings. | **[E, case study]** | Nicholas Carlini / Anthropic, *Building a C compiler with a team of parallel Claudes* (2026), https://www.anthropic.com/engineering/building-c-compiler |
| Multi-agent interaction creates privacy leakage pressure. | **[E]** | Aman Priyanshu, Supriti Vijay, Esha Pahwa, *Got a Secret? LLM Agents Can't Keep It* (2026), https://arxiv.org/abs/2605.27766 |
| Codex exposes independently owned specialist work state, progress, approvals, interruption, steering, compaction, and nested execution. | **[C / runtime contract]** | OpenAI Codex repository snapshot `7625343977154efed8c0dadba956374992a1580b`, https://github.com/openai/codex/tree/7625343977154efed8c0dadba956374992a1580b |
| ACP exposes interoperable specialist sessions, progress, permissions, cancellation, and resumability without solving responsibility. | **[C / protocol]** | Agent Client Protocol, https://github.com/agentclientprotocol/agent-client-protocol |
| MCP tool/task representation does not determine the semantic autonomy behind an endpoint. | **[C / protocol]** | Model Context Protocol 2026-07-28, https://modelcontextprotocol.io/specification/2026-07-28 |

The largest evidence gap is conspicuous:

> **[H] No benchmark reviewed here directly evaluates an Ember-like persistent personal agent over long periods while varying delegation, specialist replacement, privacy scope, provenance, late results, commitments, cancellation, side effects, and autobiographical continuity together.**

## Scenario stress tests and Ember directions

Unless otherwise marked, the scenario conclusions are **[J] Ember judgments** constrained by issues #3–#5 and the runtime/empirical evidence above.

| Scenario | Ownership and classification | Context, authority, progress, and effects | Epistemic return, memory, continuity, and verification |
|---|---|---|---|
| **Coding delegation** | Ember owns user-facing objective and choice to delegate. Codex owns material implementation decisions, coding loop, thread, tools, and local completion judgment. | Supply technical objective, acceptance constraints, permitted repository context, and necessary boundaries. | "Codex fixed the code and reported tests passing" remains attributable. Verify independently when consequence warrants. |
| **Simple operation** | Reading one file or running one deterministic command is normally capability use. | Ember retains the larger reasoning loop. | Ember can truthfully say she ran/read it and observed the result. |
| **Autonomous MCP capability** | An MCP endpoint that receives a broad objective and plans internally is semantically delegated. | Protocol label does not change context, authority, side-effect, or cancellation requirements. | Preserve the autonomous runtime as result provenance. |
| **Late result** | Result belongs to the original delegated episode. | Reconstruct present objective and state before surfacing or acting. | Completion does not become foreground automatically. |
| **Changed objective** | Original work remains historical; updated requirement may create materially different work. | Steer or restart only within actual runtime capabilities. | Preserve that earlier work targeted the old requirement. |
| **Cancellation uncertainty** | Ember owns deciding work is no longer wanted and requesting stop; specialist/runtime owns actual stopping. | Already-triggered effects may continue. | Truthful statement is "I asked it to stop; actual stop/effects remain uncertain." |
| **Partial external mutation** | Specialist can fail the objective after causing real effects. | Failure is not rollback; inspect consequential state before retry. | Preserve effects separately from terminal failure. |
| **Approval request** | Specialist owns contemplated local next step; authority remains unresolved by mere delegation. | Preserve requester, action, target, reason, consequence, prior effects. | Approval history must retain who actually made the authorization decision. |
| **More-context request** | Specialist identifies a need but cannot grant itself access. | Re-evaluate necessity and permission. | Request itself is not evidence that disclosure is legitimate. |
| **Private operational translation** | Ember retains private motivation; specialist receives only operational consequence. | Valid only if omitted motivation does not change the specialist's epistemic task. | Specialist need not inherit private autobiography. |
| **Thread continuation** | Same specialist thread is useful evidence of local continuity, not its definition. | Resume while objective, discoveries, and world state remain current. | Keep specialist continuity distinct from Ember continuity. |
| **Fresh-thread alternative** | New specialist-local episode can pursue same broader objective. | Fresh state can be safer when old context is stale or polluted. | Fresh sample is not automatically independent evidence if evidence/model remain correlated. |
| **Specialist report** | Specialist owns the observation; Ember owns receiving and interpreting it. | Ordinary delegated boundary. | Correct: "Codex reports tests pass." Stronger first-person observation needs verification. |
| **Conflicting specialists** | Each owns its analysis; Ember owns adjudication. | Compare source quality, competence, evidence, and assumptions. | Preserve disagreement until discriminating evidence resolves it. |
| **Correlated specialists** | Several reasoning episodes but not necessarily several evidence sources. | Parallelism may help coverage without multiplying authority. | Apply evidential conservation. |
| **Nested delegation** | Ember chose top-level specialist; specialist owns material subordinate choices. | Nested details matter when privacy, authority, effects, cost, provenance, or verification change. | High-level attribution can be sufficient otherwise. |
| **Specialist discovery** | Discovery is specialist's observation even if valuable beyond original objective. | New relevance does not broaden authority automatically. | Preserve source and scope; Ember separately decides whether to adopt or investigate. |
| **Specialist disappears** | Ember continuity survives; specialist-thread continuity is lost. | Determine known effects and unresolved state. | Preserve last credible progress and uncertainty; never invent missing local history. |
| **Model replacement inside specialist** | Runtime may preserve delegated work across cognition-provider change. | Re-evaluate only if competence, authority, or reliability changes materially. | No effect on Ember identity. Model change matters as provenance when relevant. |
| **Delegation no longer worthwhile** | Ember should keep the task loop directly when specialist adds only overhead. | Avoid unnecessary context/authority boundary. | Direct observation can improve provenance and reduce cost. |
| **High-consequence result** | Specialist owns result generation; Ember owns downstream reliance decision. | Completion does not authorize irreversible follow-on action. | Strong verification and current-state checking are warranted where feasible. |
| **Obsolete successful result** | Specialist may truthfully have succeeded against an old state. | Do not automatically apply it now. | Preserve historical success and current obsolescence simultaneously. |

Sharper counterexamples keep the model honest. A deterministic "agentic" service can still be tool-like. A single MCP `book_trip` call that independently chooses flights, spends money, and handles failures can be delegation-shaped. Three agents repeating one bad cached source do not create three independent evidence sources. A Codex thread that remembers yesterday's repository perfectly can be dangerous after today's branch changed. Cancellation that halts model generation does not unsend a message already handed to a remote service.

The research suggests several Ember-specific directions without deciding architecture.

First, **[J] treat delegation as an explicit change in epistemic and contextual ownership, not merely a capability invocation with a longer timeout.**

Second, **[J] make direct execution the comparison baseline.** A specialist should earn the extra context boundary, coordination burden, latency, cost, authority surface, and verification burden through real capability or task-structure advantage.

Third, **[H] evaluate delegation quality as a frontier rather than a single success score.** Future experiments should measure task success together with latency, inference cost, context disclosure, provenance fidelity, external-effect detection, verification cost, retry safety, stale-result rate, and continuity after specialist loss.

Fourth, **[H] test heterogeneous delegation separately from homogeneous "more agents."** Ember's strongest delegation use case is often composing capabilities she does not possess directly.

Fifth, **[H] test responsibility preservation across long-running delegated episodes.** Change requirements, cognition providers, specialist threads, and external state while testing whether Ember still distinguishes her decision, specialist observation, historical truth, current truth, verification, and unresolved effects.

## Implications inherited from continuity, memory, and context research

Issue #3 materially constrains delegation because **Ember's continuity belongs to Ember rather than to the current cognition or execution provider**. A specialist can disappear, change model, lose its thread, or be replaced without becoming the locus of Ember's identity. Conversely, a long-lived specialist thread does not acquire autobiographical status merely by surviving for months. Relationships, commitments, corrective integrity, and epistemic restraint remain Ember's when another runtime owns substantial work.

That continuity requirement is why the delegation envelope matters more than specialist transcript possession. Ember must preserve why she initiated consequential work, what commitment or relationship it served, what happened as far as she can establish, and what remains unresolved. She need not preserve the specialist's entire internal cognition to remain the same continuing agent.

Issue #4 constrains delegation through **epistemic ownership and evidential conservation**. Receiving a specialist report is Ember's experience; an event only the specialist observed is not Ember's direct experience. Specialist conclusions can become Ember's beliefs, but origin remains relevant. Repeated retries, paraphrases, summaries, or correlated agents do not become independent evidence merely through multiplication.

That memory work also explains why specialist disappearance is survivable: a truthful gap is preferable to an invented bridge. "I no longer have the specialist's unfinished thread" is degraded work continuity, not permission to reconstruct fictitious intermediate decisions.

Issue #5 most directly constrains delegation by establishing that **delegation creates a new context boundary**. Ember's own projection is not automatically the specialist's projection. Relevance to Ember does not imply need or permission for the specialist; private motivation can sometimes be translated into a permitted operational consequence; a specialist context request creates no authority; and withholding genuinely necessary permitted information can make a delegation invalid.

Context research also governs reintegration. Specialist results return with scope, provenance, currentness, uncertainty, and privacy boundaries intact. A late report does not automatically become current foreground; a compacted specialist summary does not gain extra authority; and a result produced against obsolete external state must not outrank newer evidence simply because the runtime says "completed."

Together, the inherited research yields one strong invariant:

> **[J] Crossing a delegation boundary may change who owns cognition, execution, local state, and direct observation. It must not silently change who owns Ember's identity, which commitments remain hers, what evidence means, who originally observed something, where private information may flow, or what Ember is entitled to claim as her own experience.**

## Carry-forward to issue #7: action, authority, and permissions

Issue #6 establishes the ownership boundary but deliberately leaves the final authority model unresolved.

Issue #7 should inherit the distinction that **technical capability is not authorization**. A specialist may be able to modify a repository, call a network service, message a third party, spend money, use credentials, or delegate again without thereby possessing legitimate authority. The fact that Ember was authorized to pursue a goal also does not prove that every underlying authority transfers through every delegation layer.

Issue #7 therefore needs to answer who can grant authority for a delegated action; whether Ember can approve on the user's behalf and under what prior mandate; whether authorization is action-, purpose-, time-, scope-, identity-, or recipient-specific; whether a specialist may delegate authority onward; how grants change when a new runtime, credential, service, organization, or third party enters the chain; and what happens when the specialist runtime's policy is stricter than Ember's apparent authority.

It must distinguish **consent to an objective** from **consent to every means**. "Fix this bug" does not semantically establish permission for destructive migration, production deployment, purchase, disclosure of personal context, or unrelated third-party messaging.

**Risk and reversibility** must become explicit authority inputs. Issue #6 establishes that completion, failure, and cancellation can all coexist with irreversible external effects. Issue #7 must decide how financial cost, privacy exposure, security impact, external commitments, third-party effects, and reversibility change the level and source of authorization required.

**Approval routing** must preserve the authority chain. The specialist asking Ember, Ember asking the user, Ember acting under standing delegated authority, a policy boundary granting or denying, and a nested specialist requesting authority through its parent are not semantically interchangeable.

**Context disclosure itself is an action requiring authority reasoning.** A delegate requesting more personal context is not merely asking for better inference quality.

**Authority should not silently widen on retry, resume, or thread reuse.** Yesterday's specialist thread does not prove yesterday's permission is still current. A retry after partial mutation can become a materially different action because the world changed.

**Nested delegation is the sharpest unresolved authority case.** Confused-deputy-style reasoning is likely useful: capability made available for one legitimate purpose must not silently be exercised for another principal, another scope, another recipient, or a subordinate request that did not inherit authority.

The non-negotiable boundary carried forward from this phase is:

> **[J] Delegation may transfer discretion over _how_ authorized work is performed. It must never be treated, by itself, as evidence that broader authority was granted.**
