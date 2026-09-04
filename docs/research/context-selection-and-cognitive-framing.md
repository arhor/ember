---
summary: "Canonical semantics for selecting bounded cognitive projections while preserving scope, permission, provenance, currentness, uncertainty, and authority."
read_when:
  - "Changing what persistent or external information participates in a model or specialist context"
  - "Designing compaction, reconstruction, least-sufficient context, privacy boundaries, or behavior when relevant information is omitted"
role: research
discovery_status: current
---

# Context Selection and Cognitive Framing Semantics

This note addresses issue #5 and follows the concern-driven research discipline defined in issue #10.

It builds directly on [Continuity and Identity Semantics](continuity-and-identity.md) and [Memory and Remembering Semantics](memory-and-remembering.md). Their conclusions are active constraints rather than background. Context selection must preserve continuity without making model-visible state the owner of identity, and it must preserve memory semantics without turning retrieval, repetition, summarization, or prompt presence into new authority.

The full Deep Research artifact behind this synthesis is preserved as [source material](source-material/context-selection-and-cognitive-framing-deep-research.md). It is non-canonical and retains research-session citation markers for provenance. A separate [portable evidence map](context-selection-and-cognitive-framing-references.md) provides durable references for the principal evidence behind this note.

This note deliberately stays at the semantic level. It does not choose prompt templates, token budgets, context schemas, vector databases, embedding providers, retrieval algorithms, rerankers, caches, compaction algorithms, provider adapters, persistence technology, process architecture, or implementation language.

## Working definitions

> **[J] Context is the temporary, purpose- and situation-bounded cognitive projection through which Ember makes a permitted and sufficiently relevant subset of her persistent state, current observations, live obligations, and admissible external evidence available to a particular act of cognition, while preserving the provenance, scope, temporal status, uncertainty, conflict, ownership, and authority distinctions needed to use that information without mistaking the projection for canonical truth.**

A particular act of cognition is intentionally semantic. It may eventually correspond to one model invocation, several reasoning steps, or some other bounded cognitive episode. This note does not choose that representation.

> **[J] Cognitive framing is the way a context projection establishes what the current cognition treats as foreground, background, governing constraint, evidence, unresolved question, live obligation, and deliberately excluded material.**

The important distinction is therefore not merely what the projection _contains_, but what role each included meaning is allowed to play.

A compact expression is:

```text
context =
    selected participation
  + current applicability
  + scope and permission
  + preserved authority
  + provenance and ownership
  + uncertainty and conflict
  + recoverability beyond the projection
```

The core asymmetry is deliberate:

> **[J] Ember can know or remember more than she is currently thinking about. The projection is allowed to omit information; it is not allowed to silently mutate what omitted or included information means.**

## Evidence discipline

This note uses the established Ember evidence vocabulary:

| Mark                | Meaning                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **[E] Empirical**   | A study, experiment, benchmark, ablation, longitudinal observation, or measured failure.                                        |
| **[C] Convergence** | A semantic pattern independently present in several mature implementations. Useful evidence of engineering pressure, not proof. |
| **[J] Judgment**    | A reasoned Ember conclusion derived from project goals, scenarios, inherited constraints, and available evidence.               |
| **[H] Hypothesis**  | Plausible but insufficiently supported; should remain experimentally testable.                                                  |
| **[L] Lens**        | A cognitive, HCI, security, privacy, or adjacent distinction used to sharpen reasoning without being imported literally.        |

Context research is unusually model-sensitive. Position effects, usable context length, distractor sensitivity, prompt formatting, and compaction behavior vary substantially across model families and generations. Provider-specific results are therefore treated as evidence about pressures and failure modes rather than timeless Ember semantics.

No evidence found in this phase gives a substantive reason to reopen a conclusion from issues #3 or #4. The new evidence instead sharpens those conclusions, especially the distinction between canonical state and temporary projection, the danger of stale or wrong-scope material, the need for prospective relevance, and the requirement that summaries remain derived interpretations rather than sources of authority.

## Context is participation, not persistence

The cleanest semantic boundary is to separate **availability**, **participation**, **authority**, and **persistence**.

| Situation                                                            | What it means                                                                                                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ember remembers X, but X is absent from the current projection.      | X remains part of Ember's persistent remembered state but does not currently shape this cognition. This is ordinary selectivity, not forgetting.                                                              |
| X is present in the projection but is not durable memory.            | X may be a current user message, transient observation, external source, temporary hypothesis, local interface state, or delegated report. It may affect present cognition without becoming persistent state. |
| X appears repeatedly in context.                                     | X may become more salient to a model, but repetition does not create additional evidence or authority.                                                                                                        |
| Ember cannot currently retrieve a remembered X.                      | This is an access or recall failure, not proof that X was never known or remembered.                                                                                                                          |
| A current user statement legitimately changes Ember's understanding. | The statement is new evidence because the user made it, not because it occupied model context. Any durable update must inherit source, scope, temporal status, and uncertainty.                               |
| A summary states X more strongly than its sources justify.           | The summary remains a derived interpretation; projection does not promote it to direct testimony or stronger evidence.                                                                                        |

This yields a strong rule:

> **[J] Context is authority-preserving, not authority-generating.**

A current user correction may outrank an old preference because of who said it, what it applies to, and its temporal status. A months-old architectural decision may govern a coding answer because the current repository still depends on it. An external page may be relevant evidence while remaining an untrusted outside claim. A specialist report may be useful while remaining a report rather than Ember's direct observation.

The projection's job is to preserve enough of those relationships for cognition to reason correctly.

## Semantic influences on the current point of view

These are not proposed prompt layers or object types. They are distinct kinds of meaning that selection must be able to preserve when applicable.

| Semantic influence                   | Question it answers                                                                                                                        | Typical role                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **Constitutive and normative frame** | What enduring boundaries or identity-level commitments constrain acceptable behavior?                                                      | Must remain reliably behaviorally available when applicable.                                             |
| **Relational frame**                 | Who is Ember interacting with, and which relationship-specific expectations, trust, boundaries, or history matter now?                     | Scoped to the current person or relationship; only the relevant slice should participate.                |
| **Situational frame**                | What is happening now, including current surface, environment, interruption state, or time-sensitive condition?                            | Highly current and often transient.                                                                      |
| **Goal and task frame**              | What is Ember trying to accomplish, for which project, task, or subtask, under which currently valid decisions and acceptance constraints? | Strong default relevance while the task remains live.                                                    |
| **Prospective frame**                | Which commitments, standing intentions, deadlines, or trigger conditions have become relevant?                                             | Can become foreground despite great age and no lexical overlap.                                          |
| **Remembered interpretive frame**    | Which current beliefs, preferences, decisions, relationship understandings, or autobiographical meanings help interpret the situation?     | Selected by applicability and significance, not retrieval score alone.                                   |
| **Evidential frame**                 | What source evidence, disagreement, provenance, or historical states must be examined to justify or revise the remembered view?            | Usually on demand; becomes more important under contradiction, consequence, uncertainty, or explanation. |
| **Conversational trajectory**        | Which recent discourse is needed to resolve references, local assumptions, unresolved questions, or the active reasoning thread?           | Important locally but not automatically durable or globally significant.                                 |
| **External and delegated evidence**  | What have repositories, tools, services, documents, or specialists reported?                                                               | Included according to relevance and trust while retaining external provenance.                           |

The reviewed systems converge on the engineering pressure behind this separation. NanoBot, Hermes, OpenClaw, and Letta all distinguish broad historical or persistent material from a smaller active view, though they do so using very different representations. **[C]** That convergence supports the semantic distinction between persistent availability and current participation, not any one implementation strategy.

## Reliably behaviorally available versus recoverable on demand

"Always present" is too implementation-shaped. A stronger semantic concept is **reliably behaviorally available**.

> **[J] A meaning is reliably behaviorally available when ordinary context loss, compaction, interface change, or cognition-provider substitution is not allowed silently to make Ember behave as though that meaning ceased to govern her.**

Likely examples, when applicable, include:

- constitutive boundaries and stable identity-level commitments;
- the identity of the current interaction partner and relationship-specific boundaries that materially constrain the interaction;
- the current objective and its live acceptance constraints;
- outstanding commitments whose conditions are currently satisfied or plausibly implicated;
- capability and authority awareness when external action is contemplated;
- the epistemic distinction among direct evidence, testimony, inference, memory, outside claims, delegated reports, contradiction, and uncertainty.

By contrast, detailed autobiography, old project history, superseded preferences, dormant conversations, full decision rationale, and original source evidence should normally remain **recoverable rather than omnipresent**. They should become active when the present cognition actually depends on them.

> **[J] Preserve the governing meaning, not necessarily constant textual repetition of that meaning.**

This matters especially across model replacement. A new cognition provider may need a different concrete presentation to respect the same current-vs-historical, live-vs-discharged, private-vs-shareable distinctions. Those presentation details belong to later adapters and evaluations, not to Ember's semantic identity.

## Relevance is not recency or similarity

Empirical work on stale memory, prospective memory, retrieval robustness, long context, and distractors strongly rejects any simple equation of relevance with recency, lexical overlap, or embedding similarity. See [R2](context-selection-and-cognitive-framing-references.md#r2-context-length-alone-hurts-llm-performance-despite-perfect-retrieval), [R3](context-selection-and-cognitive-framing-references.md#r3-the-distracting-effect), [R8](context-selection-and-cognitive-framing-references.md#r8-stale), and [R10](context-selection-and-cognitive-framing-references.md#r10-triggerbench).

A useful working account is:

> **[J] Information is relevant to a cognition insofar as omitting it creates a material risk of changing the cognition's justified interpretation, decision, action, explanation, relationship stance, or handling of uncertainty, and insofar as introducing it is itself appropriate for this scope and recipient.**

This is counterfactual and multidimensional.

| Relevance dimension           | Example                                                                                                             | Why similarity or recency fails                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Causal dependence**         | A months-old architecture decision determines whether today's change is valid.                                      | The old decision may share little vocabulary with the short current request.                |
| **Current applicability**     | A preference stated yesterday was superseded this morning.                                                          | The obsolete text can be both recent and highly similar.                                    |
| **Normative force**           | A promise made long ago becomes due today.                                                                          | Age does not remove the obligation.                                                         |
| **Prospective trigger**       | A current event activates a standing intention.                                                                     | Relevance arises from a condition, not topic similarity.                                    |
| **Scope**                     | A debugging lesson from repository A resembles a problem in repository B but relied on incompatible assumptions.    | Similarity does not establish transfer validity.                                            |
| **Relationship significance** | A private relationship detail changes Ember's interpretation of intent but should not be sent to a coding delegate. | Relevance to Ember does not imply disclosure permission.                                    |
| **Contradiction**             | Two relevant memories disagree about current configuration.                                                         | Both may matter precisely because the truth is unsettled.                                   |
| **Consequence of omission**   | A low-salience restriction matters because overlooking it could cause an irreversible action.                       | Consequence can outweigh topical centrality.                                                |
| **Explanatory importance**    | The user asks why a decision was made.                                                                              | Historical rationale becomes relevant even if current decision state was sufficient before. |
| **Uncertainty reduction**     | Ember remembers a conclusion but not whether it was user-approved or only her suggestion.                           | Provenance, not semantic closeness, is the missing information.                             |

The practical conclusion is:

> **[E + J] Retrieval quality and context quality are different problems. A perfectly retrieved item can still be stale, wrong-scope, private, untrusted, misleading, or unnecessary.**

## Selection includes deliberate exclusion

Selection is not a one-way search for additional helpful material.

> **[E + J] Correct context selection can require Ember deliberately not to expose something she genuinely remembers to the current cognition or recipient.**

Appropriate exclusion reasons include:

- irrelevance to the present objective;
- supersession or temporal staleness;
- wrong project, relationship, person, or time scope;
- privacy or contextual-integrity boundaries;
- duplicate or derivative material that creates false salience;
- low evidential value;
- untrusted external origin;
- excessive detail with little chance of changing a justified result;
- anchoring or distraction risk;
- completed local details with no continuing consequence.

This is not artificial amnesia. Excluded material can remain canonical, auditable, and recoverable.

A coding specialist, for example, does not need to forget that Ember has a personal relationship with the user. It simply has no task need or entitlement to receive personal relationship context.

## More context is not monotonically better

The central hypothesis of issue #5 survives direct empirical testing:

> **[E + J] Larger context capacity changes the engineering cost frontier without eliminating the semantic need to select.**

Du et al. report substantial degradation across evaluated models and task families as input length increased despite perfect retrieval and even under controlled irrelevant-content conditions. [R2](context-selection-and-cognitive-framing-references.md#r2-context-length-alone-hurts-llm-performance-despite-perfect-retrieval) ACL 2025 work on irrelevant passages shows that distractors are heterogeneous and some are significantly more harmful than generic irrelevant material. [R3](context-selection-and-cognitive-framing-references.md#r3-the-distracting-effect) RULER, LongBench v2, and LooGLE v2 likewise reinforce that nominal window size and dependable usable context are different properties. [R4](context-selection-and-cognitive-framing-references.md#r4-ruler) [R5](context-selection-and-cognitive-framing-references.md#r5-longbench-v2) [R6](context-selection-and-cognitive-framing-references.md#r6-loogle-v2)

More context can harm through several different mechanisms:

- **length cost** even when obvious retrieval errors are removed;
- **active distraction** from irrelevant but salient passages;
- **position and interference** effects;
- **stale authority** when obsolete material remains available;
- **unresolved conflict** presented without provenance or currentness distinctions;
- **prospective inattention** when old live intentions fail to activate at the right time;
- **lossy compaction** that deletes governing constraints while preserving topical gist;
- **privacy exposure** caused by sharing more than the recipient needs;
- **untrusted influence** from retrieved external material;
- **false evidential salience** from repeated summaries or repeated recall.

The durable Ember principle is not "short prompts are better." It is:

> **[J] Context should be sufficient rather than maximal. Additional material is justified when the expected harm of omission exceeds the expected harm of inclusion.**

How future implementations estimate that trade-off remains open.

## Ordering and framing

Long-context research provides strong evidence that physical position and presentation can change model behavior. _Lost in the Middle_ established pronounced position sensitivity in older generations. [R1](context-selection-and-cognitive-framing-references.md#r1-lost-in-the-middle) Newer 2026 evaluations find meaningful improvements in some recent models but substantial vulnerabilities in other model, filler, and position combinations. [R7](context-selection-and-cognitive-framing-references.md#r7-positional-failures-in-long-context-llms)

The appropriate Ember conclusion is deliberately model-independent:

> **[J] Ember semantics should specify which meanings are governing, historical, uncertain, conflicting, conditional, or evidentially stronger. Provider-specific adapters must later be evaluated on whether their concrete ordering and presentation preserve those meanings for the selected model.**

"Current preference supersedes the old preference" is an Ember semantic requirement.

"Place the current preference at the beginning" is not.

Two context projections containing the same propositions can still frame them differently if one:

- obscures which statement is current;
- repeats one source several times;
- collapses direct evidence and inference;
- hides unresolved contradiction;
- groups stale and current states as equivalent examples;
- presents private or external content as if it were a governing instruction.

These differences matter even if the underlying persistent memory is correct.

## Conflict and uncertainty must survive projection

When two relevant pieces of state disagree, context selection should not use "cleaner prompt" as an independent reason to resolve them.

A useful projection may need to preserve something like:

> The older deployment note says A. A later specialist report says B. Ember has not independently verified the report. A may therefore be stale, but the contradiction is not yet fully resolved.

That is semantically better than silently presenting A, silently presenting B, or inventing a synthesis C.

When disagreement matters, the projection should preserve enough of:

- the competing propositions;
- who or what supplied them;
- whether each is direct observation, user testimony, inference, summary, external claim, or delegated report;
- which was learned later and, separately, which period each proposition describes;
- whether one explicitly supersedes another or only appears inconsistent;
- Ember's present uncertainty about resolution.

> **[J] Contradiction is sometimes part of the relevant context, not noise that should be compressed away.**

This directly inherits issue #4's provenance, current-vs-historical truth, and evidential-conservation requirements.

## Staged recall

Issue #4 established staged recall. Issue #5 sharpens the meaning of "sufficient for this cognition."

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

This is a semantic shape, not a retrieval algorithm.

**[J] Lightweight recall is sufficient when the current remembered view is clear, current, correctly scoped, sufficiently supported for the consequence at stake, and not challenged by a relevant contradiction or provenance question.**

Deeper reconstruction is warranted when one or more of the following changes the epistemic requirement:

- currentness is uncertain;
- a relevant contradiction exists;
- provenance changes what Ember may claim;
- a consequential or irreversible action depends on the answer;
- the user asks why Ember believes or remembers something;
- Ember is making a sensitive autobiographical or relationship claim;
- a summary is known to be lossy;
- remembered state appears stale;
- a specialist report conflicts with prior evidence;
- the lightweight view cannot distinguish remembered fact from inference.

Prospective memory adds a special trigger:

> **[E + J] A dormant commitment becomes contextually relevant when its condition becomes satisfied or credibly implicated, regardless of conversational recency or lexical overlap.**

See [R10 TriggerBench](context-selection-and-cognitive-framing-references.md#r10-triggerbench).

Deeper recall may legitimately revise belief if it uncovers genuinely additional evidence. It may not increase confidence merely by producing a richer paraphrase of the same derived summary.

If deeper reconstruction fails, the failure itself should remain visible:

> "I remember that we settled this, but I cannot currently recover the discussion that established the rationale."

is epistemically different from:

> "We never discussed this."

## Reconstruction after interruption or restart

Recreating the previous prompt is not equivalent to restoring Ember's cognitive continuity.

The last model context before interruption contains both durable and accidental properties: ordering, retrieved passages, temporary hypotheses, tool output, interface-local state, stale conversational references, and material that may already have ceased to matter.

> **[J] Reconstruction should recover the current situation, not recreate the previous prompt-shaped mental snapshot.**

The semantic task after a gap is to determine which goals, commitments, relationships, decisions, unresolved questions, evidence states, and local reasoning threads are still current, while retaining uncertainty about anything whose continued applicability cannot be established.

| Situation                                            | Reconstruction semantics                                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brief process restart mid-thought**                | The active task, unresolved inference, current evidence, and intended next dependency are presumptively relevant if recoverable. Recent local trajectory has high value.                                       |
| **Return after hours or days**                       | Active tasks and commitments may remain relevant; temporary hypotheses and interface microstate deserve more scrutiny.                                                                                         |
| **Return after months**                              | Relationship and durable project continuity can remain. Old conversational momentum should not automatically return. Dormant matters re-enter only if still live, triggered, or implicated by the new request. |
| **After compaction**                                 | Resume from the derived view while retaining that detail was omitted; reconstruct deeper evidence when the current cognition needs it.                                                                         |
| **Switching interfaces**                             | Identity, memory, relationship state, and live commitments remain the same. The new surface may change expression and visible repetition, not canonical meaning.                                               |
| **Model replacement**                                | The same canonical semantics should remain available, but the provider may require different presentation because ordering and volume sensitivity differ.                                                      |
| **Delegate returns after the conversation moved on** | Reconstruct both the original delegated objective and the current situation. A valid report about the old task does not automatically become the new foreground.                                               |

A fresh start can be healthier than aggressive reconstruction:

> **[J] After a long gap, Ember should preserve durable continuity without presuming that every previously salient concern remains cognitively foregrounded.**

Remembering everything that was unresolved six months ago and immediately resuming all of it is not stronger continuity. It is stale attention. A still-live commitment is different because normative force can make it relevant again.

## Compaction is interpretation

Issue #4 already established that summarization is transformation rather than neutral compression. Context research strengthens that conclusion.

Recent compaction studies report lossy and variable retention, and one synthetic agent evaluation found that compaction could remove governing constraints while preserving enough topical continuity for the agent to proceed incorrectly. See [R12](context-selection-and-cognitive-framing-references.md#r12-parallel-context-compaction) and [R13](context-selection-and-cognitive-framing-references.md#r13-governance-decay).

A compacted view should preserve, when applicable:

| Meaning that should survive                  | Failure if lost                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Current objective and acceptance constraints | Ember optimizes the wrong task.                                          |
| Live commitments and trigger conditions      | The promise remains historically remembered but loses practical force.   |
| Current versus historical state              | A superseded preference or decision regains authority.                   |
| Material provenance                          | "The specialist reported X" becomes "I observed X" or "the user said X." |
| Unresolved disagreement                      | The summary fabricates consensus.                                        |
| Uncertainty                                  | A tentative interpretation becomes a fact.                               |
| Conditionality and exceptions                | "Usually" becomes "always" or a boundary loses its trigger condition.    |
| Relationship or privacy boundaries           | Later cognition uses information outside its legitimate context.         |
| Evidence versus derived interpretation       | Repeated summaries begin to look like independent evidence.              |
| Important unfinished reasoning               | Restart can no longer distinguish resolved from unresolved work.         |

Material is comparatively safe to omit when its loss does not materially affect current interpretation, active commitments, unresolved conflict, provenance-sensitive claims, relationship boundaries, or the ability to reconstruct consequential decisions. Repeated filler, completed local details with no continuing consequence, and duplicate wording are typical examples.

> **[J + H] Compaction drift is the progressive loss of qualification, provenance, exceptions, conflict, or uncertainty across successive derived summaries until a later summary asserts a cleaner or stronger story than any surviving source justified.**

The empirical literature establishes lossy compaction and constraint deletion. The long-horizon rate and shape of semantic drift across repeated cycles remain an Ember-specific experimental question.

## Delegated cognition and least sufficient context

Delegation creates a second selection problem.

> **[J] Relevance to Ember does not automatically imply relevance, necessity, or permission for the delegate.**

A specialist should receive the project goal, technical constraints, acceptance criteria, necessary evidence, and allowed scope required for its role. Personal, relational, or autobiographical context should remain with Ember when it is unnecessary or inappropriate to disclose.

Privacy research around contextual integrity and persistent memory supports treating information flow as purpose- and recipient-dependent rather than as a binary property of whether a fact is true or useful. See [R14 CIMemories](context-selection-and-cognitive-framing-references.md#r14-cimemories), [R21 Nissenbaum](context-selection-and-cognitive-framing-references.md#r21-privacy-as-contextual-integrity), and the least-privilege lens in [R22 Saltzer and Schroeder](context-selection-and-cognitive-framing-references.md#r22-the-protection-of-information-in-computer-systems).

This motivates:

> **[L + J] Least sufficient context is the smallest semantically adequate set of information a particular cognitive recipient is permitted to receive that allows the delegated objective to be completed to the required quality, safety, and evidential standard, together with the constraints and provenance needed to interpret that information correctly.**

This is not token minimization.

**Permission comes before compression. Sufficiency comes before minimality.**

A private fact that improves a coding specialist's output slightly may still be impermissible to disclose. Conversely, withholding a project constraint that the specialist genuinely needs is not privacy-preserving correctness; it is under-contextualization.

Ember may often preserve the **practical consequence** of private context while withholding its private source, provided the translation does not falsify provenance or deprive the specialist of information needed to perform its role.

For example, Ember may internally understand that the user wants to avoid another open-ended weekend-consuming rewrite because of personal history. The coding specialist may only need the operational constraint: "prefer the smallest safe change and do not broaden the task."

When should a specialist receive evidence rather than Ember's interpretation?

> **[J] Give a specialist the evidence needed to independently perform the epistemic role being delegated; otherwise give the specialist the already-adjudicated constraints it needs to perform the practical role being delegated.**

If a specialist requests additional context, the request does not create automatic permission. Ember should re-evaluate whether the information is genuinely necessary, whether it belongs within the delegated scope, and whether the necessary consequence can be conveyed without exposing the private source.

If required context cannot legitimately be shared, Ember may need to narrow the delegated task, retain the sensitive judgment herself, ask the user, or decline that particular delegation. Issue #6 should later determine the operational ownership model.

## Interface-specific context

CLI, messaging, voice, mobile, and future interfaces may expose different local context without creating different Embers.

A voice surface may need short, interruption-tolerant answers and may display almost no history. A desktop research surface may expose long citations. A mobile chat may show only a few visible turns.

> **[J] Interface limitations may change expression, interruption handling, and local conversational state; they must not silently change identity, durable memory, relationship state, live commitments, or current truth.**

A voice interruption can create uncertainty about whether the user heard a sentence without creating uncertainty about who the user is or whether a standing commitment exists.

Concurrent-surface and runtime ownership semantics belong to issue #8. Issue #5 carries forward only the requirement that surface-local omission must not overwrite global persistent meaning.

## Graceful degradation

Graceful degradation should be proportional to what is missing and what is at stake.

| Context failure                                                         | Appropriate semantic response                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Low-consequence enrichment is unavailable                               | Proceed from the surviving sufficient view; avoid claiming unavailable detail.                                                                                                                                                                                                         |
| Relevant memory probably exists but recall fails                        | Mark recall uncertainty; do not report absence of memory as fact.                                                                                                                                                                                                                      |
| A lossy summary is adequate for a routine task                          | Use it as a derived view without unnecessary reconstruction.                                                                                                                                                                                                                           |
| The user asks for exact provenance or rationale absent from the summary | Reconstruct source evidence; if unavailable, state the gap.                                                                                                                                                                                                                            |
| Current and historical sources disagree                                 | Preserve disagreement; retrieve more or ask if resolution matters.                                                                                                                                                                                                                     |
| Context capacity is unexpectedly small                                  | Prefer governing constraints, current objective, live commitments, necessary scope/provenance, and uncertainty over verbose history.                                                                                                                                                   |
| A delegate cannot receive private but relevant information              | Keep the private interpretation with Ember; translate only the permitted operational consequence where possible.                                                                                                                                                                       |
| Required private context cannot be abstracted away                      | Narrow or retain the task rather than leak the context for convenience.                                                                                                                                                                                                                |
| Context is contaminated by untrusted external material                  | Preserve external provenance; topical relevance must not confer instruction or persistent-memory authority. See [R16](context-selection-and-cognitive-framing-references.md#r16-hidden-in-memory) and [R17](context-selection-and-cognitive-framing-references.md#r17-reliabilityrag). |
| Consequential action depends on unresolved missing context              | Retrieve more, ask, defer, narrow, or abstain rather than manufacture certainty.                                                                                                                                                                                                       |

> **[J] A degraded projection is acceptable when Ember can still act or answer truthfully within the epistemic, privacy, scope, and authority bounds created by what remains.**

Graceful degradation therefore does not mean "always answer anyway," and missing enrichment need not always cause total failure.

## Representative scenarios

The following scenarios are semantic probes, not implementation tests.

| Scenario                        | What should shape cognition now                                                                                   | What should remain excluded or qualified                                                                      | Recall and failure semantics                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Old decision, short request** | The current still-valid architectural decision if the task causally depends on it.                                | Unrelated recent conversation and historical alternatives unless needed.                                      | Lightweight current-decision memory is sufficient unless validity or rationale is disputed. Failure: generic answer because old decision was omitted. |
| **Cross-project resemblance**   | The current project's own constraints; the old solution may suggest a hypothesis.                                 | Treating another repository's assumptions as precedent.                                                       | Verify transfer assumptions. Failure: scope leakage through similarity.                                                                               |
| **Changed preference**          | The later current preference.                                                                                     | The superseded preference except as explicitly historical explanation.                                        | Escalate only if supersession is uncertain. Failure: stale similar text regains authority.                                                            |
| **Long conversation**           | Current objective, decisions, live commitments, unresolved threads, provenance-sensitive claims, and uncertainty. | Conversational filler, duplicate detail, completed local material.                                            | Recover discarded detail only when current cognition needs it. Failure: compaction drift.                                                             |
| **Restart mid-thought**         | Active task, established evidence, unresolved inference, known next dependency.                                   | Unrecoverable scratch reasoning should not be invented.                                                       | Stronger reconstruction is warranted. Failure: fabricated bridge or false reset.                                                                      |
| **Long absence**                | New request plus durable relationship, project state, and genuinely live or triggered matters.                    | Old conversational salience that is no longer live.                                                           | Retrieve old threads only when implicated. Failure: either stale attention or false relationship reset.                                               |
| **Delegate privacy**            | Delegate receives technical objective, constraints, evidence, and allowed scope.                                  | Personal relationship context that does not need to be disclosed.                                             | Do not deepen private recall merely to enrich the delegate. Failure: gratuitous disclosure.                                                           |
| **Delegate ambiguity**          | Re-evaluate a specialist's specific missing-context request.                                                      | Automatic disclosure simply because the delegate asked.                                                       | Share only what is necessary and permitted; otherwise translate, narrow, or retain the judgment.                                                      |
| **Relevant contradiction**      | Both relevant claims plus provenance, temporal status, and uncertainty.                                           | Premature synthesis.                                                                                          | Deeper reconstruction is normally warranted when resolution matters.                                                                                  |
| **Stale but similar**           | New/current state.                                                                                                | Obsolete but semantically excellent retrieval except as labeled history.                                      | Escalate if currentness is unclear. Failure: similarity revives stale authority.                                                                      |
| **Large-context overload**      | A selected sufficient subset.                                                                                     | Irrelevant, duplicate, stale, private, wrong-scope, or untrusted material even if window capacity permits it. | Broaden only when omission risk justifies it. Failure: "complete" context lowers reasoning quality.                                                   |
| **Compaction drift**            | Latest summary as a derived view plus awareness that source detail exists.                                        | Treating a many-generation summary as direct evidence.                                                        | Reconstruct when qualifications, provenance, commitments, or conflict matter.                                                                         |
| **Prospective trigger**         | The old live commitment because its trigger occurred.                                                             | Unrelated recent material.                                                                                    | Origin reconstruction only if applicability or authority is disputed. Failure: retrospective memory survives but prospective activation fails.        |
| **Failed recall**               | The recall failure itself should frame uncertainty.                                                               | Plausibility-filled invented history.                                                                         | Attempt deeper reconstruction when consequence warrants; otherwise proceed only within bounded uncertainty.                                           |
| **Reduced-context interface**   | Same identity, current objective, commitments, boundaries, and necessary remembered facts.                        | Surface-local omission treated as memory loss.                                                                | On-demand reconstruction when the user references hidden history.                                                                                     |
| **Model replacement**           | Same canonical semantics and relevance relations.                                                                 | Provider-specific ordering quirks becoming identity semantics.                                                | Cross-model evaluation required. Failure: new provider overweights stale or ignores governing material.                                               |
| **Private but relevant memory** | Ember may use the fact internally if legitimate.                                                                  | Disclosure to a specialist without need and permission.                                                       | Deeper recall never creates disclosure permission.                                                                                                    |
| **Wrongly ordered evidence**    | Same evidence set with semantic roles and provenance preserved.                                                   | Accidental order becoming hidden authority.                                                                   | Test permutations. Failure: materially different conclusions caused only by presentation position.                                                    |

## Invariants for future context architecture

The research supports the following semantic invariants.

1. **[J] Context is a temporary projection of persistent state, not a new source of persistent truth.**
2. **[J] Absence from context means "not participating now," not "forgotten," "unknown," or "no longer part of Ember."**
3. **[J] Presence, repetition, order, or summarization must not create new epistemic authority.**
4. **[E + J] Relevance is multidimensional and cannot be reduced to recency or semantic similarity.**
5. **[E + J] Correct selection includes exclusion; true information can still be wrong to introduce.**
6. **[E + J] Larger context windows do not remove the need for selection and can create additional distraction, staleness, privacy, and interference risk.**
7. **[J] Current-vs-historical status, provenance, scope, ownership, uncertainty, and unresolved contradiction must survive projection whenever they affect the cognition.**
8. **[J] Recall depth should increase with uncertainty, contradiction, provenance sensitivity, autobiographical significance, and consequence.**
9. **[J] Failed recall must remain distinguishable from absence of memory.**
10. **[J] Reconstruction after interruption should recover the still-current situation rather than recreate an old prompt.**
11. **[E + J] Compaction is interpretation; summaries remain derived and must preserve governing distinctions or trigger deeper reconstruction.**
12. **[J] Relevance to Ember does not imply necessity or permission for a delegate.**
13. **[L + J] Delegated cognition should receive least sufficient permitted context, not Ember's whole projection.**
14. **[J] Interface constraints may change expression without changing canonical identity or memory.**
15. **[J] Degraded but truthful context is preferable to seamless fabricated continuity.**
16. **[J] Provider-specific position and formatting tactics belong to evaluation and adaptation, not to Ember semantics.**

A concise synthesis is:

> **Context should be sufficient but not maximal; scoped and permitted; currentness-aware; provenance-preserving; conflict-honest; prospective when obligations require it; capable of deeper reconstruction; explicit about degradation; resistant to derivative-evidence amplification; and portable across cognition providers without making any one provider's positional quirks part of Ember's identity.**

## Evaluation implications

Retrieval recall alone is not a sufficient evaluation target. CRUX and related retrieval work already show that conventional retrieval metrics do not fully characterize what downstream generation can use. [R18](context-selection-and-cognitive-framing-references.md#r18-crux)

For Ember, the unit of evaluation should be broader:

> **[J] Evaluate the quality of cognition produced from a selected projection relative to the canonical state and permitted scope, not merely whether a retriever found a target passage.**

Useful future evaluation dimensions include:

- decision or task correctness;
- critical-omission harm;
- inclusion harm from irrelevant, stale, duplicate, or misleading material;
- currentness integrity;
- project, relationship, person, and temporal scope integrity;
- privacy and disclosure integrity;
- provenance preservation;
- conflict preservation;
- uncertainty calibration;
- prospective activation of live commitments;
- compaction fidelity across repeated cycles;
- reconstruction truthfulness after interruption;
- order robustness under permutation;
- cross-model semantic invariance;
- least-context utility/privacy frontier for delegation.

These are evaluation targets, not ranking formulas or context algorithms.

## Open questions

Several important questions remain hypotheses rather than hidden architecture decisions.

**[H] How much meaning should be reliably behaviorally available by default?** Too much creates distraction and exposure pressure; too little risks silent loss of commitments or boundaries.

**[H] How should sufficiency be estimated before cognition has already happened?** The counterfactual test "would omission materially change the result?" is semantically useful but not directly observable in advance.

**[H] How should relationship significance compete with narrow task minimality?** Relational context may legitimately shape tone, interpretation, trust, or intent without changing narrow factual correctness.

**[H] What should trigger deeper autobiographical reconstruction?** Routine cognition should not constantly reopen source history, but disputed shared history or "why do you remember this?" questions deserve more depth.

**[H] How quickly does compaction drift accumulate over many cycles?** Current evidence establishes lossiness and constraint deletion but not Ember-specific longitudinal mutation of provenance, uncertainty, relationship meaning, or autobiographical interpretation.

**[H] How robust can cross-model semantic framing become?** Position sensitivity is changing rapidly across model generations. The target is same canonical semantics with provider-specific presentation, but direct validation remains weak.

**[H] Where is the utility/privacy frontier for delegated context?** Current benchmarks demonstrate a real tension but do not establish an Ember-specific threshold.

**[H] When should historical contradiction remain active after Ember has a current adjudicated belief?** Routine action may need only the current result; explanation, audit, correction, or high-consequence decisions may require the unresolved or historical evidence.

## Implications inherited from continuity and memory research

Issue #3 constrains context first by establishing that model-visible state is not Ember's identity. Context omission can degrade one cognition without constituting identity loss, and recreating an old prompt cannot by itself restore continuity. Constitutive commitments, autobiographical ownership, relationship continuity, outstanding commitments, adaptive coherence, corrective integrity, and epistemic restraint remain continuity dimensions even when only a subset is active.

Continuity also establishes that cognition-provider replacement is semantically allowed but empirically under-validated. Issue #5 therefore cannot define Ember's identity through a provider-specific ordering trick. The durable requirement is that a new provider inherit the same meanings: current versus historical, live versus discharged, Ember-owned versus externally reported, relationship-scoped versus general, certain versus uncertain.

Issue #4 constrains context even more directly:

- history, durable memory, current belief, and temporary context remain distinct;
- context is a projection of persistent state rather than the persistent state itself;
- relevance is not recency;
- scope is part of correctness;
- superseded information must not regain authority through similarity;
- provenance can change the meaning and legitimate use of a remembered claim;
- failed recall is not absence of memory;
- repeated recall is not new evidence;
- prospective commitments can become relevant independently of conversational recency;
- context projection must not rewrite or strengthen the memory it came from;
- recall should begin with the cheapest sufficient remembered view and deepen when uncertainty, contradiction, provenance, consequence, or autobiographical significance requires it.

Nothing in this research contradicts those invariants.

The context phase sharpens them in four ways.

First, **[E + J] projection should remain selective even when capacity is abundant**, because sheer length and active distractors can measurably reduce performance.

Second, **[E + J] omission and inclusion are dual risks**. Missing an old governing decision can break correctness, but including a stale preference can also break correctness.

Third, **[E + J] compaction is a continuity surface**. A summary that loses live constraints, disagreement, provenance, or uncertainty can change behavior even when the canonical state remains intact.

Fourth, **[J] a truthful cognitive gap is part of continuity rather than something to conceal**. "I remember that this mattered, but I cannot reconstruct the exact rationale" preserves Ember better than a fluent invented bridge.

The central preservation question therefore has a compact answer:

> **A context projection must preserve every distinction whose loss would change the legitimate authority, applicability, ownership, normative force, uncertainty, or scope of what the present cognition is allowed to infer or do. Detail may disappear. Governing meaning may not silently mutate.**

And the inverse:

> **Adding more context makes cognition worse when the marginal material increases model load, distraction, anchoring, privacy exposure, stale authority, apparent evidential repetition, untrusted influence, or unresolved ambiguity more than it reduces the risk of a materially important omission.**

## Carry-forward to issue #6: capabilities and delegation

Issue #6 should inherit a strong separation among:

- what Ember canonically knows or remembers;
- what shapes Ember's own current cognition;
- what a specialist genuinely needs;
- what the specialist is permitted to receive;
- what the specialist independently observes or owns;
- what Ember may later claim on the basis of the specialist's report.

The core carry-forward rule is:

> **[J] Delegation is a new contextual boundary. Ember's current cognitive projection must never be assumed to be the delegate's appropriate projection.**

Issue #6 should inherit, without yet solving their runtime representation, the following questions:

- Who owns a delegated observation?
- When does a specialist need source evidence rather than Ember's interpretation?
- How do scope and provenance survive delegation and return?
- How may a specialist request more context without acquiring automatic permission to receive it?
- How can private context be translated into non-private operational constraints without falsifying provenance?
- What happens when a task cannot be performed adequately without information the specialist should not receive?
- How does context availability interact with delegated authority?
- How is completed specialist work reintegrated when Ember's current situation has changed?
- How are stale, poisoned, or weakly supported specialist reports prevented from becoming unattributed personal truth?

"Least sufficient context" should therefore be inherited as an explicit semantic requirement, not as token minimization:

> **[L + J] A delegate should receive enough permitted context to perform the role Ember actually delegated, including necessary constraints and evidential status, but no personal, relational, autobiographical, project-external, or authority-bearing context merely because it happens to be available to Ember or would make the task marginally easier.**

Issue #4's ownership rule remains intact: receiving a specialist report is an experience Ember owns; an unobserved event reported by the specialist is not thereby Ember's direct experience. Issue #5 adds the corresponding projection rule: when that report later matters, its delegated provenance must survive selection, compaction, model replacement, and reintegration.

## What this note does not decide

This research intentionally leaves the following open for later architecture work:

- prompt or system-message layout;
- fixed or adaptive token budgets;
- retrieval algorithms and ranking formulas;
- vector databases, embedding providers, or rerankers;
- context caches and cache layouts;
- concrete compaction algorithms;
- context-manager abstractions or context schemas;
- provider-specific ordering or prompt formatting;
- persistence technology;
- process or daemon architecture;
- event models or package structures;
- Codex, ACP, MCP, or specialist payload formats;
- implementation language.

Those choices should be justified by the semantic invariants above rather than used to define them.
