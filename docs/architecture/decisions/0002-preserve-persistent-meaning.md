# ADR 0002: Persistent Meaning Preserves Provenance, Scope, Currentness, and Lifecycle

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision class:** Semantic, representation-neutral
- **Origin:** [Issue #20](https://github.com/arhor/ember/issues/20)

## Context and problem

Ember must carry meaning across time without treating every retained statement as
equally current, true, shareable, or action-guiding. History and evidence, durable
memory, current belief, prospective commitment, and temporary context answer
different questions even when a future implementation represents them together.

Without durable semantic distinctions, a user statement can become objective
fact, an inference can become testimony, an old preference can regain current
authority, a specialist report can become direct experience, or deleted
information can survive through summaries and downstream conclusions.

## Decision

Persistent state that can materially affect later cognition or action must retain
enough meaning for Ember to use it truthfully. When relevant, that meaning includes:

- origin, evidence lineage, and whether Ember directly observed, was told,
  inferred, remembered, or received a report;
- ownership of beliefs, preferences, interpretations, experiences, and
  commitments;
- person, relationship, project, task, purpose, recipient, and temporal scope;
- when something occurred, when Ember learned or revised it, and when it applies;
- current, historical, superseded, disputed, uncertain, fulfilled, cancelled,
  forgotten, or deleted status;
- source, proposition, and interpretive uncertainty when those differ;
- conflict with other surviving evidence or interpretations;
- correction and supersession without false rewriting of historically important
  evidence;
- fulfilment, cancellation, renegotiation, or expiry for future-facing state;
- truthful gaps and weakened claims when source evidence or details are lost;
- deletion or security repair through reconstructable derivatives when retention
  is no longer legitimate.

History/evidence, durable memory, current belief, prospective commitment, and
temporary context are therefore not interchangeable. Transformation,
summarisation, reflection, repeated recall, or delivery replay must not manufacture
new evidence or strengthen authority merely by multiplying representations.

## Consequences and architectural constraints

- A proposition's provenance and scope must travel far enough through remembering,
  projection, delegation, correction, and recovery to govern its legitimate use.
- Current truth and historical truth must be able to coexist. A correction usually
  removes current authority from the old state without claiming the old state
  never existed.
- A factually accurate memory can still be wrong to apply because its owner,
  scope, recipient, purpose, or applicability changed.
- Derived summaries and reflections remain descendants of their evidence rather
  than independent sources. Repetition can change salience, not epistemic weight.
- A live commitment remains capable of governing future behaviour until fulfilled,
  cancelled, superseded, renegotiated, or otherwise discharged; remembering that
  it once existed is not enough.
- Forgetting is a legitimate lifecycle outcome. Privacy deletion and security
  repair can require removing or weakening derivatives, even when that creates
  degraded continuity.
- Failed recall, unavailable evidence, and absent memory must remain distinguishable.
  The architecture must permit an explicit gap instead of a plausible invention.
- Meaning may share one physical representation later, but representation must not
  collapse these lifecycles or make "latest text wins" the semantic rule.

## Deliberately unresolved representation questions

This decision does not choose:

- storage schemas, record categories, files, databases, event logs, indexes, or
  graph structures;
- how significance or durable promotion is adjudicated;
- how much source evidence survives beneath a durable memory;
- how temporal applicability, evidence lineage, conflict, or uncertainty are
  encoded;
- the exact boundary between supersession and forgetting;
- how deletion propagates through indirect causal influence that no longer
  reconstructs the deleted content;
- retrieval, embeddings, compaction, consolidation, or model-replacement
  mechanisms.

Retrospective significance, deletion of indirectly shaped state, and semantic
fidelity across model replacement remain hypotheses to test rather than implied
decisions.

## Representative scenarios and failure modes

- **Corrected preference:** the earlier preference remains attributable history;
  the later scoped preference governs where still current.
- **Changed interpretation:** the occurrence stays stable while Ember preserves
  that her interpretation changed and why.
- **Specialist report:** Ember owns receiving the report but does not claim direct
  observation of specialist-local work.
- **Live promise:** a future condition can reactivate a still-live commitment even
  when the original conversation is old or unavailable.
- **Intentional deletion:** raw evidence and reconstructable derivatives are
  removed or weakened; a conspicuous meta-memory must not disclose what deletion
  forbids.
- **Attribution loss:** retaining the proposition while losing whether it came
  from the user, Ember, a specialist, or the web is semantic corruption.
- **Stale-state persistence:** an old but true statement governs the present after
  explicit supersession.
- **Derived-evidence inflation:** a summary, later reflection, and repeated recall
  are incorrectly counted as several independent supports.

## Traceability

| Canonical source | Decision basis |
|---|---|
| [Principles: history, memory, and context](../../principles.md#5-raw-history-is-evidence-not-memory) and [provenance](../../principles.md#6-provenance-travels-with-remembered-information) | Establish the project-level separation and accountability requirements for retained meaning. |
| [Design directions: memory](../design-directions.md#memory-preserve-accountable-meaning-not-merely-retained-text) | Synthesises accountable meaning, evidence lineage, lifecycle, and prospective state. |
| [Design directions: ADR candidate 2](../design-directions.md#adr-candidate-2-persistent-meaning-preserves-provenance-scope-currentness-and-lifecycle) | Records the synthesis-level candidate and its **[E + C + J]** basis. |
| [Memory working definition](../../research/memory-and-remembering.md#working-definition) | Defines remembering as durable availability with ownership, provenance, scope, temporal and lifecycle status, corrigibility, and forgettability. |
| [Correction, contradiction, and supersession](../../research/memory-and-remembering.md#correction-contradiction-and-supersession) | Requires historical and current truth, conflicting sources, and changed interpretation to remain distinguishable. |
| [Forgetting](../../research/memory-and-remembering.md#forgetting-is-part-of-correct-remembering) | Establishes selective forgetting, derivative deletion, and privacy-respecting continuity damage. |
| [Provenance](../../research/memory-and-remembering.md#provenance-is-part-of-remembered-meaning) and [scope](../../research/memory-and-remembering.md#scope-is-part-of-correctness) | Makes source and legitimate applicability part of remembered meaning. |
| [Commitments and prospective memory](../../research/memory-and-remembering.md#commitments-and-prospective-memory) | Separates the historical promise from its current normative force and lifecycle. |
| [Endogenous motivational currentness](../../research/endogenous-agency-and-self-initiated-behavior.md#motivational-currentness-and-lifecycle) | Applies current, dormant, satisfied, cancelled, superseded, and historical status to continuing reasons. |
| [Operational temporal distinctions](../../research/operational-model-sessions-and-surfaces.md#occurrence-time-observation-time-and-applicability-time-may-differ) | Extends occurrence, observation, and applicability time across delayed and out-of-order delivery. |
