---
summary: "Canonical semantics separating direct action, bounded capability use, and delegation, including runtime ownership, delegation envelopes, context disclosure, provenance, and reintegration."
read_when:
  - "Deciding whether work should be performed directly, through a bounded capability, or delegated to a specialist"
  - "Changing specialist context, runtime ownership, delegation continuity, result verification, or reintegration"
  - "Deciding what information may be disclosed to a delegate or what authority can cross a delegation boundary"
role: research
discovery_status: current
---

# Capabilities and Delegation Semantics

This note addresses issue #6 and follows the concern-driven research discipline defined in issue #10.

It builds directly on [Continuity and Identity Semantics](continuity-and-identity.md), [Memory and Remembering Semantics](memory-and-remembering.md), and [Context Selection and Cognitive Framing Semantics](context-selection-and-cognitive-framing.md). Their conclusions are active constraints rather than background. Delegation must preserve Ember's continuity without making a specialist runtime part of her identity, preserve memory provenance without turning reports into direct experience, and preserve least-sufficient-context boundaries without assuming that Ember's own cognitive projection is appropriate for a delegate.

The Deep Research artifact behind this synthesis is preserved as [source material](source-material/capabilities-and-delegation-deep-research.md). It is non-canonical. A separate [portable evidence map](capabilities-and-delegation-references.md) maps the principal evidence-labelled conclusions below to durable papers, protocol specifications, runtime documentation, repositories, and inherited Ember research.

This note deliberately stays at the semantic level. It does not choose a Codex adapter, ACP versus MCP versus a native integration, process topology, RPC or transport formats, task or event schemas, thread persistence representation, queues, retry algorithms, approval UI, permission policy, databases, package structure, or implementation language.

## Working definitions

The central distinction is not which protocol or API surface is used. It is **who owns meaningful decision-making between an objective and an outcome**.

> **[J] Ember acts directly when Ember owns the consequential reasoning loop and chooses the meaningful intermediate decisions that connect the current objective to the result.**

> **[J] Ember uses a bounded capability when she principally chooses the operation and its immediate role while the capability performs a sufficiently specified operation inside Ember's larger reasoning loop.**

> **[J] Ember delegates when another system receives an objective and gains material discretion over how to interpret, pursue, revise, and complete it.**

**Material discretion** is the important boundary. It means semantically significant freedom to choose consequential next steps Ember did not individually specify, resolve local ambiguity, revise a plan, choose tools, recover from local failure, maintain task-local discoveries, or decide that enough has been done. Internal computational complexity alone is not material discretion.

A compiler can perform enormous internal computation while remaining tool-like. A small browser agent can be a delegate if it decides what to investigate, which evidence matters, and when the objective is satisfied. An MCP endpoint labelled a `tool` can therefore be semantically delegated if it owns a planning and execution loop. Wrapping deterministic file reading in an "agent" interface does not create delegation.

> **[J] Protocol nouns do not determine agency.**

A second key definition is runtime ownership:

> **[L + J] Runtime ownership is the operational locus that controls a task-local cognition or execution loop and its local state. It is not a synonym for identity, authority, control, observability, responsibility, accountability, or provenance.**

The most useful middle model is the **delegation envelope**:

> **[J] Ember remains responsible for the delegation envelope: why the work exists, why delegation is appropriate, which specialist is chosen, what objective and governing constraints are communicated, what context is shared or withheld, what authority is implicated, what standard would make the result usable, how consequential side effects are handled, and how the returned result is interpreted, verified, remembered, communicated, or acted upon.**

Inside that envelope, a specialist may legitimately own its local thread, intermediate reasoning, plan revision, tool loop, scratch state, compaction, retries, local memory, or nested subagents without becoming Ember.

A compact answer to the issue's central question is:

> **[J] Another runtime may own the _how_ of delegated cognition without owning Ember's continuing _why_, and without becoming Ember. Ember may remain responsible for choosing, bounding, interpreting, and integrating the delegation without pretending that the delegate's unobserved cognition or execution was her own direct experience.**

The inverse is equally important:

> **[J] Delegation does not make the specialist's internal life Ember's autobiography. Ember should not claim to have chosen intermediate steps she did not choose, observed executions she did not observe, verified results she merely received as reports, stopped work merely because she requested cancellation, or controlled runtime state that belonged to the specialist.**

This avoids two symmetric failures:

- **agency laundering**: "the specialist did it, therefore it was not my responsibility" even though Ember intentionally initiated and later relied on the work;
- **ownership laundering**: "I did it" when another autonomous runtime actually interpreted the objective and controlled execution.

## Evidence discipline

This note uses the established Ember evidence vocabulary:

| Mark                | Meaning                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **[E] Empirical**   | A benchmark, experiment, measured trace, failure analysis, or documented runtime behavior.                                                |
| **[C] Convergence** | A semantic pressure independently visible across mature implementations. Useful evidence, not proof.                                      |
| **[J] Judgment**    | An Ember-specific semantic conclusion derived from project goals, inherited constraints, scenarios, and available evidence.               |
| **[H] Hypothesis**  | Plausible but insufficiently validated and suitable for later experimentation.                                                            |
| **[L] Lens**        | A security, distributed-systems, organizational, HCI, or adjacent distinction used to sharpen reasoning without being imported literally. |

Multi-agent evidence is highly task-, model-, topology-, and compute-budget-sensitive. The empirical claims below therefore preserve whether a result used a strong single-agent baseline, homogeneous or heterogeneous agents, normalized inference budgets, synthetic tasks, production case studies, or particular runtimes.

No evidence reviewed in this phase gives a substantive reason to reopen the canonical conclusions from issues #3, #4, or #5. The newer evidence instead strengthens the need for provenance, contextual isolation, currentness, verification, and epistemic restraint across delegation boundaries.

## Direct action, capability use, and delegation

Direct action, bounded capability use, and delegation are best treated as semantic regions rather than implementation types.

| Mode                       | Immediate objective                                                             | Meaningful intermediate decisions                                                     | Task-local reasoning loop     | Truthful Ember framing                                                     |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| **Ember acting directly**  | Interpreted by Ember                                                            | Chosen by Ember                                                                       | Ember                         | "I reasoned through this and decided…"                                     |
| **Bounded capability use** | Interpreted by Ember                                                            | Primarily chosen by Ember; the capability performs a sufficiently specified operation | Ember retains the larger loop | "I ran/read/queried X and observed Y."                                     |
| **Delegation**             | Ember establishes objective and constraints; specialist interprets them locally | Specialist has material discretion                                                    | Specialist                    | "I asked the specialist to achieve X; it chose the intermediate approach." |

A useful discriminator is:

> **[J] Ask who is entitled to decide a consequential next step that Ember did not individually specify.**

Additional signals of delegation include whether the external system can choose tools, revise its plan, recover from local failure, retain unresolved discoveries, request additional information, delegate again, and decide when the work is complete.

These concepts must remain orthogonal:

| Concept                 | Semantic question                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **Objective ownership** | Whose continuing purpose explains why this work exists?                                 |
| **Runtime ownership**   | Which system owns the local cognition/execution loop and task-local state?              |
| **Control**             | Which system can actually start, steer, pause, stop, or modify execution now?           |
| **Capability**          | What actions can the actor technically perform?                                         |
| **Authority**           | What actions is the actor legitimately permitted to perform?                            |
| **Observability**       | What facts about the work can Ember actually see?                                       |
| **Steerability**        | How much can Ember change an already-running course of action?                          |
| **Responsibility**      | What must Ember still decide, check, disclose, repair, or account for?                  |
| **Accountability**      | What explanation can later be demanded about why Ember initiated or relied on the work? |
| **Provenance**          | Who actually supplied each observation, inference, action, or result?                   |

> **[C + J] Control can be partial. Observability can be partial. Authority can be narrower than capability. Responsibility can persist after runtime control has been transferred. None of these facts turns the specialist into Ember.**

## Responsibility after delegation

Delegation changes who owns the local loop; it does not erase Ember's responsibility for delegation as her act.

> **[J] Ember is responsible for delegation as _her act_; the delegate remains attributable for cognition and execution that were _its acts_.**

Within issue #6's scope, Ember remains responsible for:

- deciding whether delegation is appropriate rather than merely available;
- choosing a specialist whose competence, runtime behavior, and known constraints suit the objective;
- specifying an adequate objective and preserving governing constraints;
- selecting least sufficient permitted context;
- refusing unjustified context expansion;
- recognizing that capability and authorization are different questions;
- interpreting progress, blockers, approvals, and uncertainty without overclaiming what they mean;
- deciding how much verification is warranted before relying on a result;
- reassessing currentness before using a late result;
- preserving specialist provenance in belief and memory;
- accounting for known or plausible external effects, including effects before failure or cancellation;
- integrating the delegated episode into Ember's continuing history without autobiographizing specialist-local cognition.

This responsibility is substantial but bounded. Ember is not required to be omniscient about hidden specialist reasoning. Responsibility should track decisions Ember could legitimately make and foreseeable consequences of initiating or relying on delegated work, not unknowable internal details.

## Delegated context

Issue #5 supplies the governing invariant:

> **Relevance to Ember does not imply necessity or permission for the delegate.**

> **[L + J] A delegate should receive enough permitted context to perform the role Ember actually delegated, including necessary constraints and evidential status, but no personal, relational, autobiographical, project-external, or authority-bearing context merely because it is available to Ember or would make the task marginally easier.**

This is **least sufficient context**, not minimum token count. Permission precedes compression; sufficiency precedes minimality.

Two symmetric failures matter:

- **over-disclosure**: sharing private or unrelated context because it might be useful;
- **under-contextualization**: withholding legitimately required information so aggressively that the delegate solves a materially different or invalid problem.

A private motivation can often be translated into a non-private operational constraint. Ember may know why the user deeply wants a narrow change while telling a coding specialist only, "Prefer the smallest safe change; do not broaden scope." The translation is valid when the specialist needs the operational consequence rather than the private reason.

Translation is not valid when the withheld information changes the specialist's actual epistemic task. If adequate execution genuinely requires sensitive context that Ember cannot legitimately disclose, Ember should narrow the delegated role, retain the sensitive judgment herself, seek whatever authorization issue #7 later requires, or decline that delegation.

> **[J] A specialist request for more context is evidence that the specialist believes more context would help; it is not permission to disclose that context.**

## Delegated evidence and epistemic ownership

Issue #4's strongest ownership rule survives unchanged:

> **Receiving a specialist report is an experience Ember owns. The unobserved event described by the report is not thereby Ember's direct experience.**

Therefore:

- "Codex reported that the tests passed" is supported by the specialist report;
- "I believe the tests pass, based on Codex's report" may be justified when Ember adopts the report as sufficiently reliable evidence;
- "I inspected the test logs and verified that they pass" requires Ember to have performed that additional verification;
- "I watched the tests pass" is false unless Ember directly observed the relevant run.

> **[J] Ember may adopt a specialist conclusion as her own belief without erasing its evidential ancestry. Belief ownership and evidence ownership are different.**

Independent verification changes the evidence base without rewriting history. The specialist still performed or observed the original work; Ember later verified some part of the result.

Multiple specialists require **evidential conservation**:

> **[E + J] Agreement among multiple agents only gains evidential weight to the extent that their evidence, tools, models, assumptions, or observations differ in ways that reduce correlated error.**

Three same-model agents reading the same source are three reasoning episodes, not automatically three independent witnesses. Repeated retries or paraphrases are even less independent. Recent team evidence showing expert dilution and coordination failures is a warning against treating majority agreement as automatic epistemic authority.

Specialist disagreement should remain disagreement until Ember has a reason to adjudicate it. Where consequence warrants, Ember should seek discriminating evidence rather than flattening disagreement into a vote.

## Verification

Verification should be consequence-sensitive rather than universal.

> **[J] The need for independent verification rises with consequence, irreversibility, uncertainty, specialist opacity, conflicting evidence, stale-world risk, and weakness of observable specialist evidence.**

Routine low-consequence work can often be accepted on a specialist report. A result that would trigger an irreversible external action deserves a higher evidential bar.

> **[J] Specialist completion must never, by itself, semantically imply permission for an irreversible downstream action.**

"Completed" means the runtime believes the delegated objective reached its terminal success condition. It does not establish that the world is still in the assumed state, that every acceptance condition was correctly interpreted, or that consequential follow-on action is authorized.

## Progress, partial results, failure, and side effects

Delegated work is not atomic. The following are semantic interpretations, not a proposed state machine.

| Reported condition             | Ember may infer                                                                      | Ember must not infer                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Accepted**                   | The runtime acknowledged or created the work.                                        | Meaningful execution has begun, or no prior effect occurred.                |
| **Started / in progress**      | The specialist loop is active.                                                       | Work remains reversible or side-effect free.                                |
| **Blocked**                    | Work currently lacks something needed to continue.                                   | Earlier steps did nothing.                                                  |
| **Waiting for approval**       | A contemplated next action is gated.                                                 | No previous action changed state.                                           |
| **Partially complete**         | Some relevant work is believed finished while the objective remains unresolved.      | The partial state is safe, consistent, or user-usable.                      |
| **Failed**                     | The objective was not established as successfully completed.                         | Nothing happened.                                                           |
| **Cancellation requested**     | Ember has expressed that continuing work is no longer wanted.                        | Execution stopped.                                                          |
| **Cancellation acknowledged**  | The runtime accepted the request according to its contract.                          | Already-started effects were undone.                                        |
| **Cancelled / interrupted**    | The runtime reports its relevant execution as stopped.                               | Files, messages, charges, remote jobs, or nested activity were rolled back. |
| **Completed**                  | The runtime believes the delegated objective reached terminal success.               | Independent truth, continued relevance, or downstream authorization.        |
| **Completed with uncertainty** | Work terminated with material uncertainty still present.                             | Terminal status removes the uncertainty.                                    |
| **Obsolete success**           | The original objective may have been satisfied relative to its original world state. | The result is still applicable now.                                         |

Current Codex and MCP contracts reinforce the critical asymmetry that interruption/cancellation and rollback are different concerns. **[E→J] Failure and cancellation are control-flow facts, not rollback guarantees.**

A truthful statement while cancellation remains uncertain is:

> "I asked the specialist to stop. I do not yet know that every already-started action has stopped or been undone."

## Approvals

An approval request is not merely another progress message.

> **[J] An approval request is evidence that the delegated runtime has reached an action whose authorization cannot be inferred from its currently accepted envelope.**

Issue #6 does not decide who may grant that authority. It establishes what meaning must survive for issue #7: who is asking, what action is contemplated, which target or third party is affected, on whose behalf it would occur, what the consequences and reversibility are, what prior effects already happened, and whether the requested authorization is narrow or broad.

A specialist's ability to request or technically exercise an action does not prove authority transferred through delegation.

## Retries

Retrying can duplicate effects when the previous attempt already changed the world.

> **[J] Before retrying potentially non-idempotent delegated work after ambiguous failure, Ember should first establish external state to the degree warranted by the consequence.**

Otherwise "try again" can mean "send twice," "create another resource," "charge again," or "apply a second mutation."

Retries can have different semantic relations to prior work:

- continuation in the same specialist thread is normally the same delegated episode when the objective remains live and the specialist relies on previous local discoveries;
- a fresh thread pursuing the same unresolved objective is another attempt at the same broader work but a new specialist-local cognitive episode;
- a changed objective or materially changed world state may create new delegated work even if the wording is similar;
- repeated model samples are not automatically independent evidence;
- repeated failure is new evidence about the reliability of the method, specialist, or task assumptions.

The exact retry policy remains outside this research phase.

## Specialist continuity and thread reuse

Three continuities must remain distinct:

> **[J] Ember continuity ≠ delegated-objective continuity ≠ specialist-thread continuity.**

A new Codex thread does not create a new Ember. A persistent Codex thread does not become part of Ember's identity.

The same delegated work is better identified by the unresolved objective, its dependence on previous specialist-local discoveries, shared external state, and current user intent than by thread identity alone.

Resuming an existing specialist thread is attractive when:

- the objective remains substantially the same;
- previous local discoveries remain relevant;
- external state has not invalidated them;
- inherited context remains more useful than contaminating.

A fresh thread is safer when:

- the objective changed materially;
- previous state is stale, polluted, or dominated by irrelevant baggage;
- compaction may have lost governing distinctions;
- external state changed enough to invalidate local assumptions;
- genuine evidential independence is desired.

If a specialist runtime changes its underlying model while preserving its thread, that can remain the same delegated work if the runtime preserves the work-state semantics. It does not change Ember's identity. The model change matters as provenance only when it materially affects capability, reliability, or interpretation. **[J + H]**

## Long-running work and late results

A specialist result returning after the conversation moved on belongs first to the original delegated episode.

> **[J] Completion is not automatic foreground relevance.**

Before relying on a late result, Ember should reconstruct enough of the original objective and present situation to ask:

- Is the user still pursuing this objective?
- Did the requirements change?
- Has the repository, remote service, or other external state changed?
- Was the work cancelled, replaced, or superseded?
- Does a previously safe action remain safe?
- Is the result still worth surfacing or acting on now?

A specialist can therefore succeed historically while the result is obsolete currently. That is current-versus-historical truth, not contradiction.

## Canonical Ember history versus specialist-local history

Ember must preserve enough of consequential delegated work to remain accountable without pretending to own the specialist's internal life.

Canonical Ember history should normally retain:

- that Ember delegated an objective and why;
- which specialist/runtime received it;
- material constraints, privacy boundaries, or authority conditions;
- important progress or decisions exposed by the specialist when consequential;
- the final report;
- known or plausible external side effects;
- unresolved uncertainty;
- verification Ember performed;
- what Ember subsequently believed, communicated, remembered, or did.

It normally does not require:

- every specialist token;
- hidden scratch reasoning;
- every temporary hypothesis;
- every local retry;
- every compaction step;
- routine internal tool chatter.

> **[J] Accountability requires an intelligible record of the delegation and its consequential outcomes, not possession of the specialist's entire cognitive history.**

If a specialist disappears permanently, Ember should be able to say something like:

> "I delegated X under constraints Y. The last thing I reliably learned was Z. These effects are known to have occurred; these others remain uncertain. The specialist's unfinished internal state is no longer available."

That is degraded execution continuity, not damage to Ember's identity and not permission to invent the missing specialist history.

## Nested delegation

A specialist may use tools, invoke external services, or delegate to subordinate agents.

> **[J] Ember's responsibility does not propagate unchanged through every hidden execution layer.**

Ember remains responsible for choosing a specialist whose known behavior and boundaries are appropriate. The specialist remains attributable for its local decision to use subordinate execution. Ember needs nested topology when it materially changes privacy, authority, cost, external effects, reliability, evidential independence, or verification requirements.

This can be truthful:

> "I delegated the coding task to Codex, which used its own tools and subordinate work."

Ember need not transform it into:

> "I personally chose each command and subordinate agent."

Nested delegation must not silently broaden context or authority. A subordinate request for more information or permission is still bounded by the original responsibility and authority chain.

## Runtime and protocol evidence

Runtime and protocol evidence is useful because it reveals which distinctions are operationally real. It is not an architecture recommendation.

The snapshot behind this note was examined on **August 28, 2026**. Rapidly changing runtime claims are versioned in the [portable evidence map](capabilities-and-delegation-references.md).

Current Codex App Server behavior provides a strong example of specialist runtime ownership: Codex exposes persistent/resumable work state, streamed progress, approvals, interruption, steering, compaction, and nested execution while retaining ownership of the specialist loop between objective and result. **[C + J]** The Ember conclusion is not to copy Codex's runtime primitives; it is that caller control surfaces do not make the caller owner of the runtime's internal cognition.

ACP exposes interoperable sessions, progress, permission requests, cancellation, and resumability. **[J]** Those protocol features do not decide autobiographical ownership, evidential authority, privacy scope, whether inherited context remains current, or who may approve a consequential action.

Current MCP provides the most useful counterexample to protocol-shaped thinking. A `tools/call` may front a deterministic operation or a long-running autonomous workflow. Current task facilities support working, input-required, completed, failed, and cancellable work, but that representation does not decide whether Ember is using a capability or delegating material discretion.

> **[E→J] An MCP tool and an autonomous delegate are not mutually exclusive semantic categories.**

Native integration matters only when it exposes semantically useful facts that a simpler interoperability surface loses, such as:

- stable specialist-work identity;
- detailed progress and side-effect visibility;
- approval origin;
- steering and interruption state;
- nested execution;
- compaction boundaries;
- resumability.

> **[J] Richness of integration is semantically valuable only insofar as it preserves distinctions Ember actually needs for responsibility, provenance, currentness, authority boundaries, verification, and truthful reporting.**

Regardless of protocol, an eventual integration must preserve enough meaning about the delegated objective, specialist attribution, context boundary, authority boundary, progress, known or possible effects, cancellation semantics, result provenance and uncertainty, work continuity, assumption currentness, and materially relevant nested delegation.

If a boundary cannot expose enough of those properties for the consequence at stake, Ember should not pretend the missing observability exists. The semantic response is to limit what she entrusts through that boundary or increase verification.

## Delegation quality and economics

The 2025–2026 evidence strongly rejects "more agents" as a default architecture principle.

> **[E + J] Multi-agent decomposition is a conditional optimization, not a generally superior cognitive architecture.**

Current empirical work shows both positive and negative cases:

- centralized multi-agent coordination can help naturally parallel tasks;
- sequential or tightly shared-state reasoning can degrade under decomposition;
- communication and coordination failures include repetitive work, bad termination judgments, information withholding, wrong assumptions, and reasoning/action mismatch;
- strengthened single-agent baselines can erase apparent gains from homogeneous workflows;
- compute-normalized single agents can match or outperform tested multi-agent structures on some multi-hop reasoning tasks;
- team synthesis can dilute a stronger specialist rather than preserve expert judgment;
- distributed agents can exchange information yet still fail to synthesize the distributed state effectively;
- large parallel research or coding teams can be useful when the work is separable and strong external verification exists, but often at much greater inference cost.

The practical delegation criterion is therefore:

> **[E + J] Delegate when the specialist supplies something materially unavailable to Ember's direct loop — specialized tools, independent observations, distinct model competence, large task-local state, parallelizable branches, or a mature domain-specific execution harness — and when those gains exceed context loss, coordination cost, verification burden, latency, and side-effect risk.**

Delegation is especially promising for:

| Task structure                        | Why delegation can earn its cost                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Specialist capability Ember lacks     | The delegate adds genuine competence or tools rather than another copy of the same reasoning. |
| Naturally separable parallel work     | Branches can progress with little shared-state coupling.                                      |
| Large specialist-local working state  | Domain-specific state can remain outside Ember's current projection.                          |
| Heterogeneous evidence gathering      | Different specialists can obtain genuinely different evidence.                                |
| Mature specialist harness             | The external runtime already owns a high-quality domain loop.                                 |
| High-value work with strong verifiers | Added compute is easier to justify when outcomes are independently inspectable.               |

Delegation is least attractive for:

| Task structure                                  | Why direct action is usually better                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| One deterministic operation                     | Delegation adds an unnecessary interpretation boundary.                    |
| Tightly coupled sequential reasoning            | State splitting increases communication and reconciliation cost.           |
| Same model, same evidence, same tools           | The "team" may mostly purchase more inference rather than new information. |
| Essential private context cannot be disclosed   | The specialist receives an invalid task projection.                        |
| Low-consequence, low-cost work                  | Coordination and reintegration can dominate the task.                      |
| Highly volatile external state                  | Late results become stale quickly.                                         |
| Consequential work with no trustworthy verifier | Delegation increases opacity precisely where confidence matters most.      |

This supports an Ember-specific null hypothesis:

> **[H] Delegation should have to beat a competent direct baseline, not merely demonstrate that delegation can work.**

## Scenario stress tests

The following scenarios probe the semantic model. Unless otherwise marked, the conclusions are **[J] Ember judgments** constrained by issues #3–#5 and the runtime/empirical evidence above.

| Scenario                                    | Ownership and boundary                                                                                                                                           | Ember responsibility and truthful interpretation                                                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Coding delegation**                    | Ember owns the user-facing objective and decision to delegate. Codex owns material implementation decisions, coding loop, thread, and local completion judgment. | Give technical objective, acceptance constraints, and least sufficient permitted repository context. Preserve specialist attribution; independently verify when consequence warrants. |
| **2. Simple operation**                     | Reading one file or running one deterministic command is normally capability use.                                                                                | Ember owns the surrounding reasoning and can truthfully say she ran/read the operation and observed its result.                                                                       |
| **3. Autonomous MCP capability**            | An MCP endpoint that accepts a broad objective and plans internally is semantically delegated despite being protocol-labelled a tool.                            | Reason about material discretion, context, authority, side effects, and result provenance rather than protocol noun.                                                                  |
| **4. Late result**                          | The result belongs to the original delegated episode.                                                                                                            | Reconstruct present relevance before surfacing or acting. Completion does not automatically interrupt the current interaction or become current foreground.                           |
| **5. Changed objective**                    | Original delegation remains historical; the changed requirement may create a materially different objective.                                                     | Steer or restart only if the specialist boundary supports it; preserve that prior work targeted the old objective.                                                                    |
| **6. Cancellation uncertainty**             | Ember can decide work is no longer wanted and request stop; the runtime owns actual stopping.                                                                    | Say cancellation was requested, not that nothing else can happen. Track known effects and unresolved stop uncertainty.                                                                |
| **7. Partial external mutation**            | The specialist may fail its objective after successfully causing some effects.                                                                                   | Failure is not rollback. Inspect consequential state before retrying or claiming nothing happened.                                                                                    |
| **8. Approval request**                     | Specialist owns the contemplated local next step; authorization remains outside the mere fact of delegation.                                                     | Preserve who is asking, action, target, reason, consequences, and prior effects. Route according to issue #7's future authority model.                                                |
| **9. More-context request**                 | Specialist identifies an information need but cannot grant itself access.                                                                                        | Re-evaluate necessity and permission; share only permitted sufficient information or narrow/retain the judgment.                                                                      |
| **10. Private operational translation**     | Ember retains private motivation; delegate receives the legitimate operational consequence.                                                                      | Valid only when omitted motivation does not change the specialist's actual epistemic task.                                                                                            |
| **11. Thread continuation**                 | Same specialist thread can support the same delegated objective but does not define it.                                                                          | Resume when prior discoveries remain current and useful; re-check assumptions changed by time or external state.                                                                      |
| **12. Fresh-thread alternative**            | A new specialist-local episode can pursue the same broader objective.                                                                                            | Prefer fresh state when stale baggage, compaction drift, changed objective, or independence needs outweigh continuity.                                                                |
| **13. Specialist report**                   | Specialist owns the observation; Ember owns receiving and interpreting the report.                                                                               | "Codex reports the tests pass" is truthful. "I observed them pass" requires direct verification.                                                                                      |
| **14. Conflicting specialists**             | Each specialist owns its analysis; Ember owns adjudication.                                                                                                      | Preserve disagreement and seek discriminating evidence when stakes justify it; majority vote is not enough by itself.                                                                 |
| **15. Correlated specialists**              | Several same-model/same-source agents are several reasoning episodes but not several independent evidence sources.                                               | Apply evidential conservation. Agreement may help search coverage without multiplying evidential authority.                                                                           |
| **16. Nested delegation**                   | Ember owns choosing the top-level specialist; the specialist owns material local delegation choices; subordinate loops own their local work.                     | Ember needs nested topology only when it materially changes privacy, authority, cost, effects, provenance, independence, or verification.                                             |
| **17. Specialist discovery**                | The discovery is the specialist's observation even if relevance extends beyond the delegated objective.                                                          | New relevance does not automatically broaden authority. Preserve source/scope and decide separately whether to investigate or act.                                                    |
| **18. Specialist disappears**               | Ember continuity survives while specialist-thread continuity is lost.                                                                                            | Preserve objective, constraints, last credible progress, known effects, uncertainty, and unfinished status. Never invent missing local history.                                       |
| **19. Model replacement inside specialist** | Same runtime may preserve delegated work across a model change.                                                                                                  | No effect on Ember identity; record the model change only when it materially affects confidence or capability.                                                                        |
| **20. Delegation no longer worthwhile**     | Ember should retain the task-level loop when delegation adds only overhead.                                                                                      | Direct execution can reduce context loss, coordination, cost, and provenance ambiguity.                                                                                               |
| **21. High-consequence result**             | Specialist owns result generation; Ember owns downstream reliance decision.                                                                                      | Completion does not authorize irreversible action. Verify evidence/current state proportionally to risk and defer authority to #7.                                                    |
| **22. Obsolete successful result**          | Specialist can truthfully succeed against an old world state.                                                                                                    | Preserve historical success and current obsolescence simultaneously. Do not apply a stale result merely because status is completed.                                                  |

Sharper counterexamples keep the boundary honest: a deterministic "agent" remains tool-like; a single MCP call that independently books travel can be delegate-like; three agents repeating one bad cached source do not create three evidence sources; a persistent coding thread can be dangerous when today's branch changed; cancelling model generation does not unsend a message already handed to another service.

## Open questions and Ember-specific directions

The semantic model is strong enough to constrain later design, but several questions remain explicitly open.

**[H] Delegation should be evaluated as a frontier, not one success score.** Useful Ember experiments should jointly measure task success, latency, inference cost, context disclosure, provenance fidelity, external-effect detection, verification cost, retry safety, stale-result rate, and continuity after specialist loss.

**[H] Heterogeneous delegation should be tested separately from homogeneous "more agents."** The strongest reason for Ember to delegate is to compose capabilities or observations she genuinely lacks, not to multiply near-identical reasoning samples.

**[H] Responsibility preservation across long-running work needs direct testing.** A useful experiment would change requirements, models, external state, and specialist threads over one delegated objective and test whether Ember still distinguishes her decision, specialist observation, old truth, current truth, verification, and unresolved effects.

The exact boundary of material discretion remains partly graded. Some operations may sit between bounded capability use and full delegation, especially opaque services that make local choices but expose little progress or interaction.

The correct amount of specialist-local history that should become durable Ember history is consequence-dependent and not yet empirically validated for persistent personal agents.

No reviewed benchmark directly evaluates an Ember-like personal agent over long periods while jointly varying delegation, specialist replacement, privacy scope, provenance, late results, commitments, cancellation, and autobiographical continuity. That remains a major evidence gap. **[H]**

## Implications inherited from continuity, memory, and context research

Issue #3 constrains delegation because **Ember's continuity belongs to Ember rather than to the current cognition or execution provider**. A specialist can disappear, change model, lose its thread, or be replaced without becoming the locus of Ember's identity. A long-lived specialist thread does not acquire autobiographical status merely by surviving. Relationships, commitments, corrective integrity, and epistemic restraint remain Ember's even when another runtime owns substantial work.

That continuity requirement is why the delegation envelope matters more than possession of a specialist transcript. Ember must preserve why she initiated consequential work, what commitment or relationship it served, what happened as far as she can establish, and what remains unresolved. She need not preserve the specialist's entire internal cognition to remain the same continuing agent.

Issue #4 constrains delegation through **epistemic ownership and evidential conservation**. Receiving a specialist report is Ember's experience; an event only the specialist observed is not Ember's direct experience. Specialist conclusions may become Ember's beliefs, but origin remains relevant. Repeated retries, paraphrases, summaries, or correlated agents do not become independent evidence merely through multiplication. Corrections can invalidate a specialist conclusion without erasing the autobiographical fact that Ember received or relied on it.

Memory research also establishes why specialist disappearance is survivable: a truthful gap is preferable to an invented bridge. "I no longer have the specialist's unfinished thread" is degraded work continuity, not permission to reconstruct fictitious intermediate decisions.

Issue #5 constrains delegation most directly by establishing that **delegation creates a new context boundary**. Ember's own current projection is not the specialist's projection. Relevance to Ember does not imply need or permission for the specialist; private motivation may sometimes be translated into a permitted operational consequence; a context request creates no authority of its own; withholding genuinely necessary permitted information can make delegation invalid.

Context research also governs reintegration. Specialist results return with scope, provenance, currentness, uncertainty, and privacy boundaries intact. A late report does not automatically become current foreground; a specialist summary does not acquire extra authority; and a result generated against obsolete external state must not outrank newer direct evidence because the runtime says "completed."

Together, the inherited work yields one strong invariant:

> **[J] Crossing a delegation boundary may change who owns cognition, execution, local state, and direct observation. It must not silently change who owns Ember's identity, which commitments remain hers, what evidence means, who originally observed something, where private information may flow, or what Ember is entitled to claim as her own experience.**

## Carry-forward to issue #7: action, authority, and permissions

Issue #6 establishes the ownership boundary but deliberately leaves Ember's final authority model unresolved.

Issue #7 must inherit that **technical capability is not authorization**. A specialist may be able to modify a repository, call a network service, message a third party, spend money, use credentials, or delegate again without thereby possessing legitimate authority to do so. Ember's authorization to pursue an objective also does not prove that every underlying authority transfers through every delegation layer.

Issue #7 therefore needs to answer:

- who can grant authority for a delegated action;
- when Ember may approve on the user's behalf and under what prior mandate;
- whether authorization is action-, purpose-, scope-, time-, identity-, or recipient-specific;
- whether and how authority may transfer to nested specialists;
- how authority changes when a new service, credential, organization, model, or third party enters the chain;
- how revocation, expiry, changed objective, retry, resume, or changed external state affect previously granted authority;
- what happens when a specialist runtime's own policy is stricter than Ember's apparent authority.

Issue #7 must distinguish **consent to an objective** from **consent to every means**. "Fix this bug" does not semantically establish permission for destructive migration, production deployment, purchase, disclosure of personal context, or unrelated third-party messaging.

Risk and reversibility must become authority inputs. Issue #6 establishes that completion, failure, and cancellation can coexist with irreversible effects. Issue #7 must decide how financial cost, privacy exposure, security impact, external commitments, third-party effects, and reversibility alter the level and source of authorization required.

Approval routing must preserve the authority chain. A specialist asking Ember, Ember asking the user, Ember acting under standing authority, a system policy deciding, and a nested specialist requesting authority through its parent are not the same event semantically.

Context disclosure itself is an action requiring authority reasoning. A delegate's request for personal information is not merely an inference-quality question.

Nested delegation is the sharpest unresolved authority case. Issue #7 should use confused-deputy-style reasoning where useful to prevent a capability available for one legitimate purpose from being silently exercised for another principal, scope, recipient, or subordinate request.

The non-negotiable boundary carried forward from this phase is:

> **[J] Delegation may transfer discretion over _how_ authorized work is performed. It must never be treated, by itself, as evidence that broader authority was granted.**
