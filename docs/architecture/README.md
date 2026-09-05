---
summary: "Navigation for Ember's current semantic architecture, accepted implementation decisions, acceptance scenarios, design evidence, and superseded architecture history."
read_when:
  - "Finding the current architecture sources that govern or evaluate an Ember implementation change"
  - "Tracing how project foundations, semantic decisions, runtime decisions, acceptance scenarios, and research relate"
role: guide
discovery_status: current
---

# Ember Architecture

Ember's canonical architecture is defined first by representation-neutral semantic
constraints. Implementation decisions may select concrete representations only
beneath that baseline.

The first continuity slice is implemented as native ESM TypeScript on Node.js 26.
ADR 0006 governs that representation, while the accepted semantic ADRs and
acceptance scenarios continue to govern its meaning.

Project foundations:

- [Vision](../vision.md) defines the purpose and continuity goal.
- [Design Principles](../principles.md) constrain how architecture may pursue it.

Current architecture material:

- [Cross-Cutting Research Synthesis and Ember Design Directions](design-directions.md)
  is the canonical synthesis of the completed concern-driven research programme.
- [Ember Architecture Decisions](decisions/README.md) records the accepted
  representation-neutral semantic baseline and subordinate implementation
  decisions.
- [ADR 0006: Adopt TypeScript on Node.js 26 as Ember's Implementation Runtime](decisions/0006-adopt-typescript-on-nodejs-26.md)
  records the selected language, runtime line, source/type-checking model, minimal
  toolchain, dependency policy, rejected alternatives, and revisit triggers.
- [ADR 0007: Use a systemd-Supervised Episodic Runtime Before a Resident Ember Daemon](decisions/0007-use-systemd-supervised-episodic-runtime.md)
  selects the first unattended Linux topology: a lingered user-level systemd manager
  supervises short-lived Ember wake/recovery workers and per-episode specialist jobs,
  with no permanently resident Ember Node daemon until later evidence earns one.
- [ADR 0008: Add a systemd-Supervised Resident Telegram Transport Worker Without Making It Ember's Runtime Owner](decisions/0008-add-systemd-supervised-telegram-transport-worker.md)
  records issue #86's evidence-derived topology extension: one resident long-poll
  transport process while canonical Ember work remains short-lived and writer-lease
  bounded.
- [Episodic Runtime Runbook](episodic-runtime-runbook.md) records issue #94's runnable
  `ember-runtime` configuration, systemd user-manager installation, one-shot wake and
  specialist operations, status, shutdown/recovery behavior, deterministic tests, and
  separate Linux/systemd smoke procedure used by issues #82 and #83.
- [Interaction Surface Boundary](interaction-surface-boundary.md) defines issue #85's
  transport-independent principal provenance, stable occurrence correlation, and
  delivery intent/attempt lifecycle without making surface metadata canonical memory.
- [Telegram Surface Runbook](telegram-surface-runbook.md) records issue #86's concrete
  Bot API 10.3 long-polling adapter, private-chat mapping, secret-safe configuration,
  systemd user service, delivery evidence mapping, and manual end-to-end smoke path.
- [Cross-Surface Continuity Validation](cross-surface-continuity-validation.md) records
  issue #89's CLI-to-Telegram-to-CLI restart proof, selected-meaning and provenance
  assertions, delivery-uncertainty isolation, and opt-in real Telegram reproduction
  procedure.
- [Ember Architecture Acceptance Scenarios](acceptance-scenarios.md) turn the
  cross-cutting scenarios into a representation-neutral architecture oracle that
  implementation choices must preserve.
- [Long-Lived Runtime Requirements](long-lived-runtime-requirements.md) derives
  issue #80's implementation-neutral unattended wake-up, specialist work ownership,
  recovery, locking, status, configuration, and resource requirements plus negative
  evidence against premature service complexity for issue #81.
- [Bounded Cognition-Opportunity Boundary](cognition-opportunity.md) defines issue
  #73's topic-free wake-up occurrence, bounded state projection, allowed endogenous
  outcomes, and implementation handoff for the decision boundary in issue #74.
- [Endogenous Cognition Decision Boundary](endogenous-cognition-decision.md) records
  issue #74's executable topic-free decision seam, deterministic controls, bounded
  outcome evidence, and opt-in Codex evaluation path.
- [First-Class Endogenous Silence Lifecycle](endogenous-silence-lifecycle.md) defines
  issue #75's durable opportunity ledger, successful `no_cognition`, failure/timeout
  separation, repeated quiet scenarios, restart semantics, and silence metrics.
- [Endogenous Concern Activation](endogenous-concern-activation.md) defines issue
  #76's live-but-dormant commitment semantics, topic-free reactivation controls,
  minimal attributable discharge transitions, and projection/inspection behavior.
- [Minimal Continuity Vertical Slice](minimal-continuity-slice.md) specifies the
  deliberately narrow first executable design derived from the accepted ADRs and
  minimal acceptance subset.
- [Minimal Codex Specialist-Delegation Boundary](minimal-codex-specialist-delegation.md)
  specifies the first Codex repository-work episode boundary: Ember-owned purpose,
  disclosure, authority, evidence, lifecycle, and reintegration around a
  runtime-owned specialist loop.
- [Specialist Authority and Context Flow](specialist-authority-context-flow.md)
  hardens that Codex boundary with scoped least-sufficient disclosure, an explicit
  capability-versus-authority distinction, structured expansion requests, and
  specialist-report provenance for issue #61.
- [Specialist Result Reintegration](specialist-result-reintegration.md) defines
  issue #65's final Ember-owned decision path for currentness, partial and
  ambiguous-effect results, correlated evidence, durable inspection, and the gate
  before any canonical mutation may rely on specialist output.
- [Codex Specialist Integration Evaluation](codex-specialist-integration-evaluation.md)
  evaluates the implemented specialist requirements against `codex exec`, App
  Server, and the TypeScript SDK, and records why issue #64 retains the CLI boundary.
- [Cognition Adapter Contract Decision](cognition-adapter-contract-decision.md)
  records issue #92's evidence-based decision to retain the existing shared
  `ProviderInvoker` cognition seam while keeping Codex and Cursor runtime lifecycle
  mechanics in separate thin adapters.
- [Minimal Continuity Slice Runbook](minimal-continuity-runbook.md) records the
  validation, foreground CLI, restart probe, lock recovery, and optional
  live-provider smoke procedure for that executable experiment.
- [Longitudinal Continuity Harness](longitudinal-continuity-harness.md) explains
  the repository-owned multi-episode scenario format, deterministic and opt-in
  live runners, external-thread controls, and evidence-layer interpretation.
- [Context Selection Failure Inventory](context-selection-failure-inventory.md)
  synthesizes issues #66-#70 into current selection failures, memory-modeling gaps,
  negative evidence, and implementation-neutral requirements for issue #72.
- [Longitudinal Provenance Evaluation](longitudinal-provenance-evaluation.md)
  records issue #68 evidence for testimony, inference, external claims, direct
  observation, delegated reports, derivation roots, correction, and history.
- [Process-Restart Continuity Evaluation](process-restart-continuity-evaluation.md)
  records issue #55's true CLI-process restart probe, fresh-Codex-thread oracle,
  sanitized report contract, and live evidence procedure.
- [TypeScript Runtime Evaluation](typescript-runtime-evaluation.md) records issue
  #38's evidence comparing the Node.js 24 JavaScript control with TypeScript on
  Node.js 26 and Deno 2.9. It remains evidence for ADR 0006 rather than a source of
  semantic authority.
- [TypeScript Runtime Adoption Validation](typescript-adoption-validation.md)
  records issue #40's selected-stack confidence result, post-migration comparison,
  and runtime capability boundary.
- [Architecture Research](../research/README.md) contains the canonical concern
  notes and their evidence maps.

Historical material:

- [Initial Architecture Model](initial-model.md) is the pre-synthesis hypothesis.
  It remains useful as research history but does not override the synthesis or
  accepted decisions.

Implementation architecture must preserve the semantic baseline. ADR 0006 settles
the current implementation language/runtime baseline, ADR 0007 settles the episodic
unattended-work topology, and ADR 0008 narrowly adds the first resident transport
worker without transferring canonical ownership to it. These decisions still do not
settle memory retrieval architecture, a generic multi-surface framework, generic
delegation protocols, or package boundaries beyond the concrete requirements they
explicitly address.