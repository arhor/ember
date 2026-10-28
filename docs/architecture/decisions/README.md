# Ember Architecture Decisions

Ember separates representation-neutral semantic decisions from implementation and
runtime decisions.

ADRs 0001-0005 form the stable semantic boundary between the completed research
programme and later implementation architecture. They constrain what every future
representation must mean without selecting how that meaning is represented.

Later implementation ADRs are subordinate to that semantic baseline. They may
select a runtime, language, storage mechanism, protocol, or other representation
choice only where the accepted semantic decisions leave that choice open. Replacing
an implementation ADR does not weaken or supersede the semantic baseline unless a
new decision explicitly confronts and supersedes the affected semantic ADR.

## Semantic baseline

| ID                                                         | Decision                                                                                  | Status   |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| [0001](0001-continuity-belongs-to-ember.md)                | Continuity Belongs to Ember, Not an Operational Locus                                     | Accepted |
| [0002](0002-preserve-persistent-meaning.md)                | Persistent Meaning Preserves Provenance, Scope, Currentness, and Lifecycle                | Accepted |
| [0003](0003-use-least-sufficient-permitted-projections.md) | Cognition and Delegation Receive Least Sufficient Permitted Projections                   | Accepted |
| [0004](0004-separate-capability-from-authority.md)         | Capability and Authority Are Independent, and Authority Cannot Self-Amplify               | Accepted |
| [0005](0005-distinguish-operational-continuity.md)         | Operational Continuity Distinguishes Work, Occurrence, Delivery, Effects, and Currentness | Accepted |

## Implementation and representation decisions

| ID                                                               | Decision                                                                                            | Status   | Subordinate to |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------- | -------------- |
| [0006](0006-adopt-typescript-on-nodejs-26.md)                    | Adopt TypeScript on Node.js 26 as Ember's Implementation Runtime                                    | Accepted | ADRs 0001-0005 |
| [0007](0007-use-systemd-supervised-episodic-runtime.md)          | Use a systemd-Supervised Episodic Runtime Before a Resident Ember Daemon                            | Accepted | ADRs 0001-0006 |
| [0008](0008-add-systemd-supervised-telegram-transport-worker.md) | Add a systemd-Supervised Resident Telegram Transport Worker Without Making It Ember's Runtime Owner | Accepted | ADRs 0001-0007 |
| [0009](0009-adopt-pnpm-as-package-manager.md)                    | Adopt pnpm as Ember's Package Manager                                                               | Accepted | ADR 0006       |

## Current documentation governance

[Use native ADRs and retire the documentation catalogue](0014-use-native-adrs-and-retire-documentation-catalogue.md)
is accepted. Use the repository ADR skill and maintain document indexes. The
2026-10-28 convention amendment in ADR 0014 explicitly adopts the local skill defaults
for this directory and numbered filenames, superseding the earlier unchanged-skill rule.
The catalogue and old documentation skill are retired; the historical records below
preserve their rationale. Pilot ADRs 0011–0013 were accepted on 2026-10-27.

## Documentation governance history

ADR 0010 records the earlier adapted-skill policy. It is deprecated following the
maintainer's decision to use the original ADR skill and adapt the documents instead.

| ID                                               | Decision                                                              | Status     |
| ------------------------------------------------ | --------------------------------------------------------------------- | ---------- |
| [0010](0010-adopt-adr-centered-documentation.md) | Adopt an ADR-Centered Documentation Workflow with Preserved Discovery | Deprecated |

## Decision discipline

- ADRs 0001-0005 preserve semantic invariants. They do not select a storage
  schema, prompt layout, runtime topology, protocol, or implementation language.
- A later representation may change without replacing a semantic ADR when it
  preserves the decision's meaning and constraints.
- Implementation ADRs record selected representations and remain below the
  semantic baseline. Convenience, tooling, performance, or ecosystem breadth
  cannot silently redefine semantic meaning.
- A proposal that cannot preserve a semantic decision must explicitly supersede
  the affected ADR rather than violating it for implementation convenience.
- Questions labelled unresolved remain open hypotheses. An accepted ADR must not
  be read as having resolved them indirectly.

## Cross-ADR semantic validation matrix

The following cases are the mandatory validation set from
[issue #20](https://github.com/arhor/ember/issues/20). "Governing ADRs" identifies
the semantic decisions that jointly constrain each case; it does not prescribe a
mechanism. Implementation decisions such as ADR 0006, ADR 0007, and ADR 0008 must
preserve every required result below.

| #   | Case                                                                        | Governing ADRs                                                                                                                                                                                                                                               | Required semantic result                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Restart after long inactivity                                               | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0004](0004-separate-capability-from-authority.md), [0005](0005-distinguish-operational-continuity.md) | The recognised lineage may continue, but live commitments, authority, work, mutable premises, and the current cognitive projection are reconciled with the present. The inactive interval remains a truthful gap. |
| 2   | Model replacement with unchanged canonical state                            | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md)                                                                                                         | The model remains a cognition provider rather than the identity owner. It receives the same governing meanings through an appropriate projection; preservation quality remains an empirical question.             |
| 3   | Corrected or superseded memory                                              | [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md)                                                                                                                                                      | The correction governs where current, while the older state can remain attributable history. Selection must not revive it as current merely because it is similar or recent.                                      |
| 4   | Relationship information relevant to Ember but inappropriate for a delegate | [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0004](0004-separate-capability-from-authority.md)                                                                                                  | Ember may use permitted relationship meaning privately. The delegate receives only a sufficient permitted projection or a truthful operational consequence, not the private source by default.                    |
| 5   | Specialist result arriving after the objective changed                      | [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0005](0005-distinguish-operational-continuity.md)                                                                                                  | The specialist report remains attributable and may be a historical success for the old objective. It is checked against the current objective before reliance, action, or delivery.                               |
| 6   | Capability exists but authority is absent or stale                          | [0002](0002-preserve-persistent-meaning.md), [0004](0004-separate-capability-from-authority.md)                                                                                                                                                              | Outward action or disclosure does not occur merely because it is possible. A stale grant remains history; private preparation may continue only inside the live envelope.                                         |
| 7   | Duplicate delivery of one occurrence                                        | [0002](0002-preserve-persistent-meaning.md), [0004](0004-separate-capability-from-authority.md), [0005](0005-distinguish-operational-continuity.md)                                                                                                          | One established occurrence produces neither duplicate instruction, evidence, authority, memory, nor effect. Identical content alone still cannot prove that two real occurrences are one.                         |
| 8   | Ambiguous timeout after a possible external side effect                     | [0002](0002-preserve-persistent-meaning.md), [0004](0004-separate-capability-from-authority.md), [0005](0005-distinguish-operational-continuity.md)                                                                                                          | Effect uncertainty survives. Ember establishes present external state to the degree warranted before a consequential retry and does not treat failure or cancellation as rollback.                                |
| 9   | A session ends while work remains live                                      | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0005](0005-distinguish-operational-continuity.md)                                                     | Work continues to exist while its purpose remains live. Its objective, constraints, delegation boundary, authority provenance, effects, and uncertainty remain recoverable independently of the session.          |
| 10  | Recovery with a genuine information gap                                     | [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0005](0005-distinguish-operational-continuity.md)                                                     | Recovery constructs the strongest justified present from surviving evidence and observation, explicitly preserves the gap, and never invents a seamless bridge.                                                   |

The semantic set is internally consistent across all ten cases. The decisions
deliberately leave representation, policy thresholds, and failure-recovery
mechanisms open. [Issue #21](https://github.com/arhor/ember/issues/21) tracks the
broader reusable acceptance catalogue for evaluating those later choices.

## Accepted migration pilot decisions

| ID                                                                         | Decision                                                   | Status   | Class          |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- | -------- | -------------- |
| [0011](0011-keep-streamed-cognition-provisional-until-final-validation.md) | Keep streamed cognition provisional until final validation | Accepted | implementation |
| [0012](0012-keep-codex-exec-for-bounded-specialist-work.md)                | Keep Codex exec for bounded specialist work                | Accepted | implementation |
| [0013](0013-keep-conversation-identity-and-context-ember-owned.md)         | Keep conversation identity and context Ember-owned         | Accepted | semantic       |

## Directory navigation

- [ADR 0001: Continuity Belongs to the Continuing Agent, Not an Operational Locus or Product Name](0001-continuity-belongs-to-ember.md) — accepted
- [ADR 0002: Persistent Meaning Preserves Provenance, Scope, Currentness, and Lifecycle](0002-preserve-persistent-meaning.md) — accepted
- [ADR 0003: Cognition and Delegation Receive Least Sufficient Permitted Projections](0003-use-least-sufficient-permitted-projections.md) — accepted
- [ADR 0004: Capability and Authority Are Independent, and Authority Cannot Self-Amplify](0004-separate-capability-from-authority.md) — accepted
- [ADR 0005: Operational Continuity Distinguishes Work, Occurrence, Delivery, Effects, and Currentness](0005-distinguish-operational-continuity.md) — accepted
- [ADR 0006: Adopt TypeScript on Node.js 26 as Ember's Implementation Runtime](0006-adopt-typescript-on-nodejs-26.md) — accepted
- [ADR 0007: Use a systemd-Supervised Episodic Runtime Before a Resident Ember Daemon](0007-use-systemd-supervised-episodic-runtime.md) — accepted
- [ADR 0008: Add a systemd-Supervised Resident Telegram Transport Worker Without Making It Ember's Runtime Owner](0008-add-systemd-supervised-telegram-transport-worker.md) — accepted
- [ADR 0009: Adopt pnpm as Ember's Package Manager](0009-adopt-pnpm-as-package-manager.md) — accepted
- [ADR 0010: Adopt an ADR-Centered Documentation Workflow with Preserved Discovery](0010-adopt-adr-centered-documentation.md) — deprecated
- [ADR 0011: Keep Streamed Cognition Provisional Until Final Validation](0011-keep-streamed-cognition-provisional-until-final-validation.md) — accepted
- [ADR 0012: Keep Codex Exec for Bounded Specialist Work](0012-keep-codex-exec-for-bounded-specialist-work.md) — accepted
- [ADR 0013: Keep Conversation Identity and Context Ember-Owned](0013-keep-conversation-identity-and-context-ember-owned.md) — accepted
- [ADR 0014: Use native ADRs and retire the documentation catalogue](0014-use-native-adrs-and-retire-documentation-catalogue.md) — accepted
- [ADR 0015: Centralize application coordination and inward dependencies](0015-centralize-application-coordination-and-inward-dependencies.md) — accepted
- [ADR 0016: Use AI SDK beneath an Ember-owned cognition seam](0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md) — accepted
- [ADR 0017: Use typed structured output for Ember-owned control decisions](0017-use-typed-structured-output-for-control-decisions.md) — accepted
- [ADR 0018: Isolate Claude Code cognition behind its AI SDK provider](0018-isolate-claude-code-cognition-behind-its-ai-sdk-provider.md) — accepted
- [ADR 0019: Require evidence-backed proposals and deterministic memory adoption](0019-require-evidence-backed-proposals-and-deterministic-memory-adoption.md) — accepted
- [ADR 0020: Generate memory candidates from bounded durable conversation evidence](0020-generate-memory-candidates-from-bounded-durable-conversation-evidence.md) — accepted
- [ADR 0021: Persist conversation trajectories independently of surfaces](0021-persist-conversation-trajectories-independently-of-surfaces.md) — accepted
- [ADR 0022: Keep semantic state independent of encodings and materialized views](0022-keep-semantic-state-independent-of-encodings-and-materialized-views.md) — accepted
- [ADR 0023: Persist validated canonical snapshots under a single-writer lease](0023-persist-validated-canonical-snapshots-under-a-single-writer-lease.md) — accepted
- [ADR 0024: Enforce capability authority and effect evidence in an Ember firewall](0024-enforce-capability-authority-and-effect-evidence-in-an-ember-firewall.md) — accepted
- [ADR 0025: Map MCP tools explicitly into bounded Ember capabilities](0025-map-mcp-tools-explicitly-into-bounded-ember-capabilities.md) — accepted
- [ADR 0026: Bind approval to one attributable and still-current action proposal](0026-bind-approval-to-one-attributable-and-still-current-action-proposal.md) — accepted
- [ADR 0027: Delegate bounded specialist episodes with explicit context and authority](0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md) — accepted
- [ADR 0028: Reintegrate specialist results through a currentness and provenance gate](0028-reintegrate-specialist-results-through-a-currentness-and-provenance-gate.md) — accepted
- [ADR 0029: Persist topic-free cognition decisions and explicit silence](0029-persist-topic-free-cognition-decisions-and-explicit-silence.md) — accepted
- [ADR 0030: Represent dormant concerns with existing live commitments](0030-represent-dormant-concerns-with-existing-live-commitments.md) — accepted
- [ADR 0031: Defer repeated cognition over unchanged projected grounding](0031-defer-repeated-cognition-over-unchanged-projected-grounding.md) — accepted
- [ADR 0032: Separate completed cognition from permission to interrupt](0032-separate-completed-cognition-from-permission-to-interrupt.md) — accepted
- [ADR 0033: Represent proactive contact as durable intent distinct from delivery](0033-represent-proactive-contact-as-durable-intent-distinct-from-delivery.md) — accepted
- [ADR 0034: Revalidate authority and attention before proactive handoff](0034-revalidate-authority-and-attention-before-proactive-handoff.md) — accepted
- [ADR 0035: Keep durable objectives independent of execution episodes](0035-keep-durable-objectives-independent-of-execution-episodes.md) — accepted
- [ADR 0036: Defer LangGraph until a measured bounded execution gap earns it](0036-defer-langgraph-until-a-measured-bounded-execution-gap-earns-it.md) — accepted
- [ADR 0037: Keep interaction occurrences and delivery truth transport-neutral](0037-keep-interaction-occurrences-and-delivery-truth-transport-neutral.md) — accepted
- [ADR 0038: Separate machine setup, lineage selection, and conversational onboarding](0038-separate-machine-setup-lineage-selection-and-conversational-onboarding.md) — accepted

## Accepted application and cognition decisions (M05)

- [Centralize application coordination and inward dependencies](0015-centralize-application-coordination-and-inward-dependencies.md) — accepted
- [Use AI SDK beneath an Ember-owned cognition seam](0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md) — accepted
- [Use typed structured output for Ember-owned control decisions](0017-use-typed-structured-output-for-control-decisions.md) — accepted
- [Isolate Claude Code cognition behind its AI SDK provider](0018-isolate-claude-code-cognition-behind-its-ai-sdk-provider.md) — accepted

## Accepted memory, conversation, and representation decisions (M06)

- [ADR 0019: Require evidence-backed proposals and deterministic memory adoption](0019-require-evidence-backed-proposals-and-deterministic-memory-adoption.md) — accepted
- [ADR 0020: Generate memory candidates from bounded durable conversation evidence](0020-generate-memory-candidates-from-bounded-durable-conversation-evidence.md) — accepted
- [ADR 0021: Persist conversation trajectories independently of surfaces](0021-persist-conversation-trajectories-independently-of-surfaces.md) — accepted
- [ADR 0022: Keep semantic state independent of encodings and materialized views](0022-keep-semantic-state-independent-of-encodings-and-materialized-views.md) — accepted
- [ADR 0023: Persist validated canonical snapshots under a single-writer lease](0023-persist-validated-canonical-snapshots-under-a-single-writer-lease.md) — accepted

## Accepted capability, authority, and delegation decisions (M07)

- [ADR 0024: Enforce capability authority and effect evidence in an Ember firewall](0024-enforce-capability-authority-and-effect-evidence-in-an-ember-firewall.md) — accepted
- [ADR 0025: Map MCP tools explicitly into bounded Ember capabilities](0025-map-mcp-tools-explicitly-into-bounded-ember-capabilities.md) — accepted
- [ADR 0026: Bind approval to one attributable and still-current action proposal](0026-bind-approval-to-one-attributable-and-still-current-action-proposal.md) — accepted
- [ADR 0027: Delegate bounded specialist episodes with explicit context and authority](0027-delegate-bounded-specialist-episodes-with-explicit-context-and-authority.md) — accepted
- [ADR 0028: Reintegrate specialist results through a currentness and provenance gate](0028-reintegrate-specialist-results-through-a-currentness-and-provenance-gate.md) — accepted

## Accepted agency, objective, runtime, and surface decisions (M08)

- [ADR 0029: Persist topic-free cognition decisions and explicit silence](0029-persist-topic-free-cognition-decisions-and-explicit-silence.md) — accepted
- [ADR 0030: Represent dormant concerns with existing live commitments](0030-represent-dormant-concerns-with-existing-live-commitments.md) — accepted
- [ADR 0031: Defer repeated cognition over unchanged projected grounding](0031-defer-repeated-cognition-over-unchanged-projected-grounding.md) — accepted
- [ADR 0032: Separate completed cognition from permission to interrupt](0032-separate-completed-cognition-from-permission-to-interrupt.md) — accepted
- [ADR 0033: Represent proactive contact as durable intent distinct from delivery](0033-represent-proactive-contact-as-durable-intent-distinct-from-delivery.md) — accepted
- [ADR 0034: Revalidate authority and attention before proactive handoff](0034-revalidate-authority-and-attention-before-proactive-handoff.md) — accepted
- [ADR 0035: Keep durable objectives independent of execution episodes](0035-keep-durable-objectives-independent-of-execution-episodes.md) — accepted
- [ADR 0036: Defer LangGraph until a measured bounded execution gap earns it](0036-defer-langgraph-until-a-measured-bounded-execution-gap-earns-it.md) — accepted
- [ADR 0037: Keep interaction occurrences and delivery truth transport-neutral](0037-keep-interaction-occurrences-and-delivery-truth-transport-neutral.md) — accepted
- [ADR 0038: Separate machine setup, lineage selection, and conversational onboarding](0038-separate-machine-setup-lineage-selection-and-conversational-onboarding.md) — accepted

ADR 0033 retains an acknowledged open implementation obligation for durable contact-decision/no_contact history; see M08-F02 in the [migration plan](../../research/archive/adr-migration-plan.md). Accepted semantics do not imply that missing ledger already exists.

## Record location and filenames

ADRs live in `docs/architecture/decisions/`. The repository skill explicitly uses
that folder and `NNNN-title-with-dashes.md` names, such as
`0039-choose-example.md`. Allocate the next number above the maximum existing prefix
across all statuses, with at least four zero-padded digits. Never reuse a retired
number or renumber existing records. Titles use `# ADR NNNN: Title` and dates remain
native frontmatter metadata, not filename prefixes. Keep this index in numeric order.

- [ADR 0039: Separate agent contracts, engine, and startup composition](0039-separate-agent-contracts-engine-and-startup-composition.md) — accepted
