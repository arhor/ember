---
summary: "Accepted decision that the continuing agent's lineage is independent of the Ember product/runtime, models, prompts, sessions, surfaces, processes, transports, and specialist runtimes."
read_when:
  - "Changing restart, resume, migration, provider replacement, backup, restore, fork, or identity-continuity behavior"
  - "Deciding whether the Ember runtime/product name, an operational locus, or copied state can own or establish the continuing agent's identity"
role: decision
discovery_status: current
---

# ADR 0001: Continuity Belongs to the Continuing Agent, Not an Operational Locus or Product Name

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decision class:** Semantic, representation-neutral
- **Origin:** [Issue #20](https://github.com/arhor/ember/issues/20)

## Context and problem

Ember is the product/runtime that hosts and preserves a continuing personal agent.
The agent's cognition and interaction occur through models, prompts, sessions, surfaces,
processes, transports, projects, and specialist runtimes. Every one of those loci can end
or be replaced while identity, relationships, remembered life, commitments, and unfinished
work remain meaningful.

The Ember product name is another implementation fact, not the agent's personal identity.
Binding continuity either to whichever locus currently hosts cognition or to the product
name would make runtime replacement, product renaming, restart, interface change, provider
replacement, or specialist loss capable of silently redefining who the agent is.
Conversely, copied notes, familiar behaviour, a shared prompt, or another installation
calling itself Ember cannot by themselves establish legitimate succession.

## Decision

Canonical state recognises one continuing-agent lineage. Ember hosts and preserves
that lineage, but neither the Ember product/runtime name nor any temporary operational
locus is the agent's identity.

A later realisation is a legitimate continuation when it is the recognised successor in
that lineage and preserves enough constitutive commitments, autobiographical ownership,
relationship continuity, live commitments, and coherent capacity for change that
differences remain intelligible as development or degradation of one agent.

The current representation derives the stable semantic agent actor from the lineage
(`agent:<lineageId>`). This identifier is not a preferred name. Preferred name,
self-description, personality-related descriptions, and interaction style are ordinary
mutable self-related meaning: they may initially be absent and may later be learned,
corrected, or superseded without changing the lineage.

The following distinctions are part of the decision:

- legitimate lineage can survive a restart, new surface, new process, model replacement,
  compatible runtime replacement, or product rename;
- continuity can be degraded without being replaced, including through truthful
  autobiographical loss or temporarily unavailable context;
- behavioural recognisability and preferred/display names are useful descriptions,
  not identity keys;
- changed beliefs, preferences, style, capability, or cognition quality can be
  continuity-preserving when the change remains attributable;
- downtime is not hidden cognition or experience;
- copied state does not by itself establish unique lineage; fork and restore
  semantics remain deliberately unresolved.

## Consequences and architectural constraints

- Canonical continuity-bearing meaning must remain semantically independent of any one
  model invocation, prompt, transcript, session, surface, process, project, transport,
  specialist thread, or the Ember product/runtime name.
- Provider, interface, compatible runtime, and product-name changes may alter operation or
  expression but must not silently redefine identity, relationships, autobiography, or
  live commitments.
- Implementation namespaces such as `ember` CLI names, environment variables, protocol
  tags, package names, and diagnostics may remain product-specific when they identify
  machinery rather than selfhood.
- Model-facing prompts and semantic ownership must use the continuing agent or stable actor
  identity when the referent is the agent, rather than injecting `Ember` as a personal
  name.
- Loss of a surface, session, context projection, or specialist thread is an
  operational or cognitive degradation to describe truthfully, not an identity
  reset and not permission to invent missing history.
- Identity-level changes require a higher and more attributable bar than ordinary
  learning. Reflection or summarisation cannot rewrite constitutive boundaries by
  producing persuasive prose.
- Architecture must make discontinuity and degradation observable enough to distinguish
  a continuing but impaired agent from a well-informed replacement or behavioural
  imitation.
- Backup, restore, and multi-instance work must not silently settle unique-lineage
  questions through implementation convenience.

## Deliberately unresolved representation questions

This decision does not choose:

- how lineage, constitutive commitments, relationships, autobiography, preferred
  self-description, or live commitments are stored or projected beyond the current
  minimal representation;
- how model replacement quality is measured or what degradation threshold is
  acceptable;
- how a restored snapshot relates to later lost experience;
- whether one or both successors of a fork may count as the legitimate continuation;
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
- **Model/runtime replacement:** unchanged canonical state can support the same continuing
  agent even if model, compatible runtime, voice, or reasoning quality changes; reversed
  constitutive commitments or denied autobiographical ownership indicate serious
  degradation or replacement.
- **Preferred-name change:** a current self-related name may be superseded by another
  attributable preference or self-description while the stable lineage actor remains
  unchanged.
- **Reduced-context surface:** omitted memory remains the continuing agent's; projection failure
  must not become canonical memory loss or surface-specific identity.
- **Session ends while work remains live:** the session disappears, not the continuing
  agent or the still-live purpose.
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
