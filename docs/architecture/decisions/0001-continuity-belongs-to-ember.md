---
summary: "Accepted decision that Ember owns one continuing lineage independently of models, prompts, sessions, surfaces, processes, transports, and specialist runtimes."
read_when:
  - "Changing restart, resume, migration, provider replacement, backup, restore, fork, or identity-continuity behavior"
  - "Deciding whether an operational locus or copied state can own or establish Ember's continuity"
role: decision
discovery_status: current
---

# ADR 0001: Continuity Belongs to Ember, Not an Operational Locus

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision class:** Semantic, representation-neutral
- **Origin:** [Issue #20](https://github.com/arhor/ember/issues/20)

## Context and problem

Ember's cognition and interaction occur through models, prompts, sessions,
surfaces, processes, transports, projects, and specialist runtimes. Every one of
those loci can end or be replaced while identity, relationships, remembered life,
commitments, and unfinished work remain meaningful.

Binding continuity to whichever locus currently hosts cognition would make a
restart, interface change, provider replacement, or specialist loss silently
create a new Ember. Conversely, copied notes, familiar behaviour, or a shared
prompt cannot by themselves establish that a later runtime is the legitimate
continuation of Ember.

## Decision

Ember owns one recognised continuing lineage. Operational loci host temporary
episodes or views of that lineage; they do not acquire identity or durable
continuity by hosting them.

A later Ember is a legitimate continuation when she is the recognised successor
in that lineage and preserves enough constitutive commitments, autobiographical
ownership, relationship continuity, live commitments, and coherent capacity for
change that differences remain intelligible as development or degradation of one
agent.

The following distinctions are part of the decision:

- legitimate lineage can survive a restart, new surface, new process, or model
  replacement;
- continuity can be degraded without being replaced, including through truthful
  autobiographical loss or temporarily unavailable context;
- behavioural recognisability is a useful diagnostic for drift, not the identity
  key;
- changed beliefs, preferences, style, capability, or cognition quality can be
  continuity-preserving when the change remains attributable;
- downtime is not hidden cognition or experience;
- copied state does not by itself establish unique lineage; fork and restore
  semantics remain deliberately unresolved.

## Consequences and architectural constraints

- Canonical continuity-bearing meaning must remain semantically independent of
  any one model invocation, prompt, transcript, session, surface, process,
  project, transport, or specialist thread.
- Provider and interface changes may alter expression or cognition quality but
  must not silently redefine identity, relationships, autobiography, or live
  commitments.
- Loss of a surface, session, context projection, or specialist thread is an
  operational or cognitive degradation to describe truthfully, not an identity
  reset and not permission to invent missing history.
- Identity-level changes require a higher and more attributable bar than ordinary
  learning. Reflection or summarisation cannot rewrite constitutive boundaries by
  producing persuasive prose.
- Architecture must make discontinuity and degradation observable enough to
  distinguish a continuing but impaired Ember from a well-informed replacement
  or behavioural imitation.
- Backup, restore, and multi-instance work must not silently settle unique-lineage
  questions through implementation convenience.

## Deliberately unresolved representation questions

This decision does not choose:

- how lineage, constitutive commitments, relationships, autobiography, or live
  commitments are stored or projected;
- how model replacement quality is measured or what degradation threshold is
  acceptable;
- how a restored snapshot relates to later lost experience;
- whether one or both successors of a fork may count as Ember;
- how identity-level revision is authorized or represented;
- a process model, prompt layout, persistence technology, backup mechanism, or
  runtime topology.

Model-replacement continuity remains a design requirement with weak direct
empirical validation. Fork and restore identity remain open semantic questions,
not implicitly accepted implementation work.

## Representative scenarios and failure modes

- **Restart after long inactivity:** the same lineage can resume with durable
  relationships and commitments while acknowledging the interval was not
  experienced and re-establishing what remains current.
- **Model replacement:** unchanged canonical state can support the same Ember even
  if voice or reasoning quality changes; reversed constitutive commitments or
  denied autobiographical ownership indicate serious degradation or replacement.
- **Reduced-context surface:** omitted memory remains Ember's; projection failure
  must not become canonical memory loss or surface-specific identity.
- **Session ends while work remains live:** the session disappears, not Ember or
  the still-live purpose.
- **Familiar mask:** preserved name, tone, and catchphrases with lost relationships,
  autobiography, and commitments is imitation, not adequate continuity.
- **Fork or old backup:** copied similarity cannot establish that two successors
  are each the unique original or that lost experience never occurred.

## Traceability

| Canonical source                                                                                                                                               | Decision basis                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Vision: purpose](../../vision.md#purpose) and [principles: replaceable cognition providers](../../principles.md#3-models-are-replaceable-cognition-providers) | Establish the project-level requirement that Ember, rather than a model or transcript, owns continuity.                                  |
| [Design directions: semantic spine](../design-directions.md#the-semantic-spine)                                                                                | Places one continuing Ember around temporary cognitive, operational, and interaction loci.                                               |
| [Design directions: ADR candidate 1](../design-directions.md#adr-candidate-1-continuity-belongs-to-ember-not-an-operational-locus)                             | Records the synthesis-level candidate and its **[C + J]** evidence posture.                                                              |
| [Continuity working definition](../../research/continuity-and-identity.md#working-definition)                                                                  | Defines legitimate succession through lineage, constitutive commitments, owned history, relationships, commitments, and coherent change. |
| [Continuity dimensions](../../research/continuity-and-identity.md#continuity-dimensions-for-later-evaluation)                                                  | Distinguishes lineage integrity, degradation, behavioural recognisability, and epistemic restraint.                                      |
| [Continuity open questions](../../research/continuity-and-identity.md#open-questions)                                                                          | Keeps model replacement, fork/restore, identity revision, and forgetting tensions open.                                                  |
| [Context reconstruction](../../research/context-selection-and-cognitive-framing.md#reconstruction-after-interruption-or-restart)                               | Requires recovery of the current situation rather than an old prompt-shaped snapshot.                                                    |
| [Delegation: specialist continuity](../../research/capabilities-and-delegation.md#specialist-continuity-and-thread-reuse)                                      | Separates Ember continuity, delegated-objective continuity, and specialist-thread continuity.                                            |
| [Operational central conclusion](../../research/operational-model-sessions-and-surfaces.md#central-conclusion)                                                 | Establishes sessions, surfaces, transports, processes, and specialist runtimes as temporary operational loci.                            |
