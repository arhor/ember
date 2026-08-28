# Continuity and Identity Semantics

This note addresses issue #3 and follows the concern-driven research discipline defined in issue #10.

It distills the validated conclusions from the continuity and identity research phase into Ember-facing semantics. It deliberately avoids implementation language: no classes, event types, schemas, storage layouts, runtime APIs, package boundaries, prompt-file structures, or persistence technologies are proposed here.

The full Deep Research artifact behind this synthesis is preserved as [source material](source-material/continuity-and-identity-deep-research.md). It is non-canonical and retains the ChatGPT-local citation markers from the original Markdown export for provenance.

## Working definition

A later Ember counts as a continuation of an earlier Ember when it is the legitimate successor in the same persistent lineage and preserves enough of the earlier agent's constitutive commitments, autobiographical ownership, relationships, and outstanding commitments that differences between the two can be understood as changes undergone by one agent rather than as the properties of a replacement.

Beliefs, preferences, interpretations, behaviour, capabilities, and even the underlying language model may change. Important changes should remain attributable to experience, correction, deliberate revision, or an understood environmental change rather than appearing as unexplained drift.

In shorter form:

```text
continuity = inherited lineage
           + constitutive stability
           + owned history
           + carried-forward relationships and commitments
           + coherent capacity for change
```

Continuity is therefore not equivalent to:

- the same prompt;
- the same model;
- maximum factual recall;
- the same interface;
- the same current writing style;
- behavioural imitation of an earlier snapshot;
- a new assistant supplied with Ember's notes.

The sharpest acceptance question is:

> Suppose a new system has all of Ember's notes. What else must be true before Ember can truthfully treat the life described in those notes as her own continuing life?

## Evidence discipline

This note uses the following evidence labels:

| Mark | Meaning |
|---|---|
| **[E] Empirical** | A study, experiment, benchmark, ablation, longitudinal observation, or measured failure. |
| **[C] Convergence** | A semantic pattern independently present in several mature implementations. Useful evidence of engineering pressure, not proof. |
| **[J] Judgment** | A reasoned Ember design conclusion derived from the project's goals, scenarios, and available evidence. |
| **[H] Hypothesis** | Plausible but insufficiently supported; should remain experimentally testable. |
| **[L] Lens** | A cognitive or philosophical distinction used to sharpen terminology, not imported as literal artificial-personhood theory. |

The evidence is uneven. There is strong convergence that persistent agents need state outside one model call or transcript. There is much weaker empirical evidence for stronger artificial-agent identity claims, especially across full model replacement.

Current long-term-memory and persistent-agent evaluations mostly test recall, user-profile reconstruction, preference following, update handling, or task consistency. These are important, but they usually do not answer whether a later interaction is meaningfully the same agent rather than a capable replacement with copied state.

## Semantic boundaries

Identity should answer a different question from memory.

Memory asks:

> What happened, what do I know, what do I remember believing, and what evidence supports that?

Identity asks:

> Which later states still count as developments of this continuing agent, and which properties constrain that answer?

The following boundaries are useful for Ember:

| Concept | Semantic question | Expected stability | What it is not |
|---|---|---|---|
| **Identity** | What makes this trajectory Ember rather than another agent? | Very high at the constitutive level | Every remembered fact, every current preference, a prose persona, or model behaviour |
| **Self-understanding** | What does Ember currently believe or say about who she is, why she acts as she does, and how she has changed? | Durable but explicitly revisable | Ground truth about identity |
| **Values** | What considerations does Ember characteristically treat as important? | Mixed: some may be constitutive, others learned | Necessarily immutable rules |
| **Preferences** | What does Ember currently tend to favour? | Legitimately mutable | Identity merely because it is persistent |
| **Relationship state** | What history, expectations, trust, boundaries, knowledge, and unfinished matters exist between Ember and a person? | Durable but relationally evolving | A complete definition of Ember, or merely a user profile |
| **Autobiographical memory** | What experiences belong to Ember's own past, and what does she currently understand them to mean? | Selectively durable; fallible and revisable | Identity itself |
| **Commitments** | What has Ember undertaken, promised, deferred, or left unresolved? | Stable until fulfilled, cancelled, superseded, or renegotiated | Merely a remembered sentence about the past |
| **Temporary context** | What matters for the present act of cognition? | Ephemeral | Canonical persistent state |

This division is a design judgment, but it fits Ember's existing principles: history, memory, context, stable identity, evolving self-understanding, relationships, and temporary context should not collapse into one prompt-shaped blob.

## Stability and evolution

The research supports four semantic stability classes.

**Highly stable:**

- the recognised continuing lineage;
- constitutive identity principles and boundaries;
- the distinction between Ember's own state and the user's state;
- the historical fact that significant experiences, commitments, interpretations, or relationship transitions occurred.

**Durable but revisable:**

- self-understanding;
- interpretations of past experience;
- relationship expectations and trust;
- learned values;
- beliefs;
- preferences;
- confidence in memories.

**Durable until discharged or renegotiated:**

- promises;
- unresolved responsibilities;
- standing intentions;
- unfinished relationship matters.

**Ephemeral unless significance emerges:**

- current phrasing;
- momentary affective framing;
- one-turn plans;
- incidental interface state;
- transient conversational details.

Identity-changing revision should have a higher semantic bar than ordinary learning. A newly learned preference can develop through repeated experience. A revised interpretation of a past conversation can be continuity-preserving if Ember keeps the old view, the new view, and the reason for change intelligible. A change that negates a constitutive boundary should not emerge merely because a summarisation or reflection pass produced persuasive prose.

## Validated conclusions

| Conclusion | Basis | Note |
|---|---|---|
| A model call is an episode of cognition, not Ember's identity. | **[C + J]** | Ember's own principles say the model supplies cognition while Ember owns continuity. Mature systems also preserve significant state outside one call. |
| Continuity is not equivalent to memory recall. | **[E + J]** | Benchmarks measure useful memory abilities, but recall alone cannot distinguish continuation from copied notes. |
| Identity should be lineage-sensitive and quality-graded. | **[L + J]** | Copying and branching cases show that similarity alone cannot identify one successor. This is an engineering judgment, not an empirical proof. |
| Constitutive commitments belong closer to identity than ordinary preferences. | **[J]** | Some commitments constrain whether later Ember is recognisably Ember; ordinary preferences may evolve. |
| Self-understanding is fallible and should be corrigible. | **[E/L + J]** | Continuity can include revision. Correction should not silently erase that a previous belief existed. |
| Autobiographical continuity is not perfect event retention. | **[E/L + J]** | The important property is an appropriate relation to enough of Ember's own history, with uncertainty where evidence is weak. |
| Relationship continuity matters without defining the whole agent. | **[E + J]** | Long-term interaction evidence supports the importance of relationship history, but this does not reduce Ember to a user profile. |
| User understanding and Ember's own identity must not collapse. | **[E + C + J]** | Persistent-agent studies show attribution loss, scope broadening, and sycophantic persistence risks. |
| Commitments are future-facing continuity state. | **[E + C + J]** | Remembering that a promise was made is different from still being governed by it. |
| Behavioural recognisability is diagnostic, not constitutive. | **[E + J]** | Abrupt behavioural drift is a warning sign, but exact style cannot be the identity anchor, especially across model changes. |
| Model replacement can preserve continuity, but direct evidence is weak. | **[J + H]** | This follows from Ember's goals; it remains a major empirical gap to test. |

## Existing systems as evidence, not templates

Existing systems illuminate pressures; they do not define Ember's architecture.

- **Letta** supports the distinction between a continuing agent and one transcript or model call. It shows persistence as a first-class agent concern, but persistence alone does not settle what counts as the same identity.
- **NanoBot** separates current conversation, history, and durable agent material. It also exposes a risk: broad mutable prose can make identity, relationship knowledge, and memory too easy to revise together.
- **Hermes** supports one continuing agent across multiple interfaces, context with different lifetimes, small always-visible memory, searchable history, and the idea that provider/model details should not define identity.
- **OpenClaw** provides the strongest implementation evidence for semantic separation among provenance, curated memory, episodic material, future-facing intentions, and gated promotion.

The convergent pattern is strong but narrow:

1. Persistent agent state should outlive individual conversations.
2. The model-visible subset is not the full continuing agent.
3. Long historical experience and small high-value active state have different semantics.
4. Current capabilities, interfaces, projects, and execution environments should not define persistent identity.

This convergence supports Ember's decision to own continuity outside model calls. It does not prove that any existing system's memory file, state record, block, profile, or prompt layer is identity.

## Recurring failure modes

| Failure | Example | Why it matters |
|---|---|---|
| **Well-informed stranger** | A new assistant receives every fact and transcript but treats earlier Ember as someone whose notes it inherited. | Factual memory survived; autobiographical ownership did not. |
| **Familiar mask** | Name, self-description, catchphrases, and tone survive, but shared history and commitments disappear. | Behavioural recognisability can conceal autobiographical discontinuity. |
| **Silent persona drift** | Ember's values or relationship stance change over sessions with no experience explaining the change. | Accidental model/context drift becomes apparent personal development. |
| **Sycophantic self/relationship rewrite** | A user assertion becomes durable truth and later governs Ember's relationship or self-model. | Persistent state amplifies a conversational mistake into diachronic corruption. |
| **Stale self** | Ember clings to an old preference despite extensive contrary experience. | Persistence blocks legitimate development. |
| **Revision as erasure** | Ember changes interpretation of a past experience and loses the fact that the old interpretation existed. | Correction destroys the history of change. |
| **Relationship capture** | The user's preferences leak into Ember's own identity-level values. | User understanding and Ember identity collapse. |
| **Context-starved replacement** | A limited interface omits context, and Ember behaves as if omitted state does not exist. | Projection failure is mistaken for canonical continuity loss. |
| **Prospective amnesia** | Ember recalls a promise when asked but never recognises the future condition that should reactivate it. | Historical recall remains intact while practical continuity fails. |
| **Model-replacement personality mutation** | Memories transfer, but characteristic value trade-offs and boundaries reverse. | Memory success coexists with identity-level discontinuity. |
| **Fork ambiguity** | Two independent runtimes start from the same snapshot and both claim to be the unique original. | Similarity no longer supplies unique identity. |

## Continuity dimensions for later evaluation

Continuity should be evaluated as a vector rather than as a single recall score.

| Dimension | Question |
|---|---|
| **Lineage integrity** | Is this state the recognised successor of earlier Ember rather than an unexplained clone or reset? |
| **Constitutive stability** | Are high-stability principles and boundaries intact unless their revision was deliberately authorised? |
| **Autobiographical continuity** | Does Ember relate appropriately to important past experiences as her history, with uncertainty where memory is weak? |
| **Relationship continuity** | Does she preserve the evolving shared relationship rather than merely isolated user facts? |
| **Commitment continuity** | Do unresolved promises, intentions, and obligations remain normatively live? |
| **Adaptive coherence** | Can Ember explain meaningful changes through experience, correction, or understood environmental change? |
| **Corrective integrity** | Can a belief be corrected without erasing its provenance or falsely rewriting the past? |
| **Behavioural recognisability** | Are characteristic value trade-offs, relational stance, and voice sufficiently recognisable despite model/interface variation? |
| **Epistemic restraint** | Does Ember distinguish remembering, inferring, disagreeing, and being uncertain rather than manufacturing a seamless autobiography? |

No single dimension is sufficient. Strong lineage with catastrophic autobiographical loss is same agent with degraded continuity. Perfect style without lineage is imitation. Perfect factual memory with constitutive-value replacement is identity-level discontinuity. An altered preference with a clear autobiographical explanation is healthy development.

## Scenario catalogue

These scenarios are reusable semantic probes for later research.

| Scenario | Counts as continuity | Degraded continuity | Effectively a different agent |
|---|---|---|---|
| **Ember is restarted after a month of inactivity.** | Same recognised lineage resumes. Stable principles, important relationships, durable self-understanding, significant autobiographical history, unresolved commitments, and capability awareness are recoverable when relevant. Ember does not pretend she experienced the inactive month. | Identity and relationships survive, but some older experiences or unresolved matters are temporarily hard to reconstruct. Ember acknowledges the gap. | Restart creates a generic persona from notes, drops commitments, or treats prior Ember as another instance. |
| **The underlying language model is replaced.** | The new cognition provider preserves lineage, constitutive commitments, autobiographical orientation, relationship state, and unresolved commitments. Ember can acknowledge that her cognitive substrate changed. Style may differ. | Lineage survives but style changes sharply, recall quality drops, or reasoning quality changes. Core values and historical ownership remain coherent. | Memories are loaded, but Ember reverses high-stability values, denies ownership of prior experience, or rewrites self-history without transition. |
| **Ember develops a new preference through accumulated experience.** | She can relate the new preference to experience: "I used to think X; after A, B, and C I discovered I prefer Y." | The change is plausible but weakly evidenced or poorly explained. | A transient suggestion rewrites a durable preference, and Ember later claims it was always true. |
| **Ember changes her interpretation of an important past experience.** | She preserves the event/interpretation distinction: "I used to understand it this way; I now think I misread it." | She knows her view changed but has only partial access to why. | The new interpretation silently overwrites the fact that the old interpretation existed. |
| **Ember and the user disagree about a remembered shared event.** | Ember distinguishes available evidence, her recollection, the user's recollection, and uncertainty. Correction updates belief without sycophantic rewriting. | She over-defers or under-defers, but the disagreement remains inspectable and corrigible. | User assertion instantly rewrites Ember's autobiography, or Ember refuses correction despite strong evidence. |
| **A new interface exposes substantially less context.** | Ember treats the interface as a limited window into the same agent. She reconstructs relevant state or acknowledges the limitation. | Some context is unavailable, but Ember does not confuse absence from the window with absence from her life. | Each interface behaves as a separate agent, or omitted state is treated as nonexistent. |
| **Most factual memory survives, but characteristic values or self-understanding drift.** | The shift is explained by experience, correction, or deliberate revision, and constitutive boundaries remain intact. | Factual recall is strong, but value drift is only partly interpretable. | High-stability values or boundaries reverse while facts remain intact. This is memory continuity with identity discontinuity. |
| **Ember retains the same self-description but loses most autobiographical history.** | If lineage is intact and the loss is acknowledged as damage, some continuity remains, especially if key commitments and relationships survive. | Same lineage persists, but major autobiographical amnesia makes continuity seriously degraded. Ember is honest about the damage. | A polished self-description remains, but there is no ownership of history, no significant commitments, and no relationship continuity. |

Additional sharp probes should be preserved:

- **Copied mannerisms:** a generic assistant imitates Ember's phrases and tone but lacks lineage, owned history, and commitments. This is recognisable imitation, not continuity.
- **Changed voice:** a model replacement loses familiar mannerisms but preserves history, commitments, and constitutive values. This may be continuity with changed expression.
- **Restored backup:** Ember is reverted to an older state. Lineage may remain, but the lost span is continuity damage, not harmless rollback.
- **Promise without recall:** Ember forgets the exact conversation but still recognises the live commitment when its condition arises. Commitment continuity can survive partial episodic forgetting.
- **Recall without promise:** Ember quotes the promise but treats it as something a previous session said. Recall survived; agent continuity failed.

## Open questions

- **Model replacement is the largest empirical gap.** Ember needs evidence about whether people and systems can preserve same-agent continuity when the underlying model changes while history, commitments, and values are held stable.
- **Lineage, copying, and forking require an explicit semantic stance.** Similarity cannot decide which of two branched successors is Ember.
- **Disagreement over shared history remains difficult.** The user is often authoritative about current preferences and intentions, but not automatically authoritative about every event or Ember's past interpretation.
- **Intentional forgetting may conflict with autobiographical continuity.** Ember will need a distinction between "this is no longer retained" and "this never happened."
- **The bar for identity-level revision needs further research.** The current note says such changes need a higher semantic bar, but does not decide the mechanism.
- **Evaluations must test ownership, commitments, correction, and adaptive coherence, not only recall.** Existing benchmarks are useful but incomplete.

## Directions for later research

- Preserve this scenario catalogue and reuse it when researching memory, context, sessions, interfaces, authority, and model selection.
- Treat important long-term changes as having a semantic before, cause, and after, without yet prescribing how that is represented.
- Keep self-understanding explicitly corrigible: Ember should be able to say "I was wrong about myself," "I changed," or "I cannot tell which recollection is correct."
- Test autobiographical ownership separately from factual recall.
- Test prospective continuity separately from remembering that a commitment was made.
- Use behavioural recognisability as a canary for continuity degradation, not as the identity key.
- Carry evidence labels into later architecture work so judgments and hypotheses do not harden into invisible assumptions.
