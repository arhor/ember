---
summary: "Accepted decision that cognition and delegation receive purpose-bounded, least-sufficient permitted projections rather than canonical state wholesale."
read_when:
  - "Changing context selection, prompt construction, disclosure, compaction, reconstruction, or delegated specialist context"
  - "Reviewing whether context inclusion, omission, or transformation preserves provenance, scope, privacy, and authority"
role: decision
discovery_status: current
---

# ADR 0003: Cognition and Delegation Receive Least Sufficient Permitted Projections

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision class:** Semantic, representation-neutral
- **Origin:** [Issue #20](https://github.com/arhor/ember/issues/20)

## Context and problem

Canonical Ember state is larger than what should participate in one act of
cognition. Even technically available and relevant information can be stale,
wrong-scope, distracting, private, untrusted, or inappropriate for a particular
recipient. Larger context capacity does not remove these harms.

Delegation creates a second boundary. A specialist can need meaningful technical
context while having neither need nor authority to receive Ember's personal,
relational, autobiographical, project-external, or complete current projection.

## Decision

Every act of cognition receives a temporary, purpose-bounded projection that is
sufficient rather than maximal. Selection includes deliberate exclusion.

A projection must preserve whichever distinctions materially affect justified
cognition in that scope, including current versus historical applicability,
provenance, ownership, uncertainty, conflict, conditionality, live commitments,
and authority or privacy constraints.

Delegation creates a new projection boundary:

- permission is established before disclosure;
- sufficiency is established before minimisation;
- Ember's own current projection is not presumed appropriate for a specialist;
- the specialist receives enough permitted context, constraints, and evidential
  status to perform the role actually delegated;
- a private reason may be translated into a truthful operational constraint only
  when withholding the source does not change the specialist's epistemic task;
- a specialist request for more context is evidence of perceived need, not
  permission to disclose it;
- the specialist may own local planning, tools, state, observations, recovery, and
  completion judgment without acquiring Ember's identity, autobiography, full
  context, or evidential ownership.

Ember owns the delegation envelope: why the work exists, the objective and
governing constraints, specialist choice, disclosure boundary, implicated
authority, acceptance and verification needs, and reintegration of the result.

## Consequences and architectural constraints

- Context presence, repetition, position, or summarisation cannot create truth,
  authority, currentness, ownership, or persistent state.
- Absence from one projection means "not participating now", not forgotten,
  unknown, or no longer part of Ember.
- Relevance cannot be reduced to recency or similarity. Selection must account for
  causal dependence, currentness, scope, consequence, normative force, privacy,
  uncertainty, and recipient.
- Recall may deepen when uncertainty, contradiction, provenance, consequence, or
  autobiographical significance makes the lightweight view insufficient. Failure
  to reconstruct remains an explicit gap.
- Withholding necessary permitted context is also a failure: it causes the
  specialist to solve a materially different task. Ember must instead translate,
  narrow, retain the sensitive judgment, seek legitimate authorization, or
  decline the delegation.
- Specialist observations and reports retain specialist provenance through
  reintegration. Ember may adopt a conclusion as belief without claiming direct
  observation.
- Specialist completion does not establish current applicability, downstream
  authority, or the need to foreground or deliver the result.
- Provider-specific ordering and formatting may adapt to preserve semantics but
  cannot become identity or canonical-state rules.

## Deliberately unresolved representation questions

This decision does not choose:

- prompt or context layout, context windows, token budgets, retrieval algorithms,
  ranking formulas, embeddings, rerankers, caches, or compaction algorithms;
- how sufficiency is estimated before cognition occurs;
- which meanings remain reliably behaviorally available by default;
- provider-specific ordering or adapter behaviour;
- the threshold for deeper recall or historical reconstruction;
- the utility/privacy frontier or how private reasons are abstracted safely;
- Codex, MCP, ACP, or other specialist integration APIs;
- how specialist-local and canonical Ember history are physically represented.

## Representative scenarios and failure modes

- **Private relationship context:** the memory can shape Ember's private
  interpretation while the coding specialist receives only the necessary
  technical objective and a permitted operational constraint.
- **Specialist asks for more:** Ember re-evaluates necessity and disclosure
  authority rather than forwarding whatever is available.
- **Late specialist result:** the report retains its original objective and source;
  Ember compares it with the present objective before reliance.
- **Reduced-context interface:** the surface receives enough governing meaning for
  the interaction without becoming a separate Ember or deleting omitted memory.
- **Relevant contradiction:** both claims, their provenance, temporal status, and
  uncertainty participate when resolution matters; a cleaner prompt does not
  fabricate consensus.
- **Over-disclosure:** true personal information is sent because it might improve
  a specialist's answer marginally.
- **Under-contextualisation:** privacy minimisation removes a governing project
  constraint and the specialist succeeds at the wrong task.
- **Agency laundering:** Ember reports unobserved specialist work as her own direct
  experience.

## Traceability

| Canonical source                                                                                                                                                                                        | Decision basis                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Vision: central design hypothesis](../../vision.md#central-design-hypothesis) and [principles: delegation](../../principles.md#9-delegation-is-capability-not-hierarchy)                               | Establish composition with specialists without absorbing their identity or runtime ownership.      |
| [Design directions: context](../design-directions.md#context-project-meaning-into-cognition-without-promoting-it)                                                                                       | Establishes sufficient, selective, currentness-aware, provenance-preserving projection.            |
| [Design directions: ADR candidate 3](../design-directions.md#adr-candidate-3-context-and-delegation-use-least-sufficient-permitted-projections)                                                         | Records the synthesis-level candidate and its **[E + C + J]** basis.                               |
| [Context working definitions](../../research/context-selection-and-cognitive-framing.md#working-definitions)                                                                                            | Defines context and cognitive framing as temporary purpose- and situation-bounded projection.      |
| [Selection includes exclusion](../../research/context-selection-and-cognitive-framing.md#selection-includes-deliberate-exclusion)                                                                       | Establishes that true, remembered information may be wrong to expose.                              |
| [Delegated cognition and least sufficient context](../../research/context-selection-and-cognitive-framing.md#delegated-cognition-and-least-sufficient-context)                                          | Defines permission-before-compression and sufficiency-before-minimality.                           |
| [Context invariants](../../research/context-selection-and-cognitive-framing.md#invariants-for-future-context-architecture)                                                                              | Preserves projection, provenance, conflict, currentness, staged recall, and model portability.     |
| [Delegation working definitions](../../research/capabilities-and-delegation.md#working-definitions)                                                                                                     | Defines material discretion, runtime ownership, and Ember's delegation envelope.                   |
| [Delegated context](../../research/capabilities-and-delegation.md#delegated-context) and [delegated evidence](../../research/capabilities-and-delegation.md#delegated-evidence-and-epistemic-ownership) | Preserves least sufficient disclosure and specialist provenance without autobiographical transfer. |
| [Authority: access is not disclosure](../../research/action-authority-and-permission.md#access-is-not-disclosure-authority)                                                                             | Makes disclosure recipient- and purpose-sensitive rather than a consequence of access.             |
