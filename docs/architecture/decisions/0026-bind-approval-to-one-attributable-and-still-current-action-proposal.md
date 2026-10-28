---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0026: Bind approval to one attributable and still-current action proposal

Migration record from [source 1](../durable-action-proposal-approval.md). This accepted ADR now owns the architectural decision; sources retain supporting
implementation details and dated evidence. Creation does not invent original approval attribution or decision dates.
The implementation plan describes existing behavior and ongoing constraints.

## Context and Problem Statement

Issue [#232](https://github.com/arhor/ember/issues/232) separates contemplating an
effect, presenting a proposal, obtaining legitimate human input, and executing. C15
records representation-neutral approval/currentness semantics under ADRs 0004/0005.
Calendar issue #233 supplies one narrow implementation; it is not a universal UI,
authentication rule, persistence format, expiry, or policy language.

## Decision

Approval authorizes one identified still-current proposal whose material meaning the
deciding principal knew and was entitled to decide. It does not authorize a tool call,
provider invocation, conversation, similar future actions, or all reachable resources.

An Ember-owned durable proposal retains stable occurrence identity; exact action/
target/recipient/resource/quantity/content/disclosure parameters; purpose and material
consequences (cost/recoverability/publicity/security/third-party effects); principal/
scope and every independently required authority boundary; source provenance;
currentness facts/versions/expiry; and lifecycle presentation/delivery/awareness,
decision, withdrawal, supersession, execution and effect evidence with named times.
Machine payload and human explanation complement rather than substitute for each other.
Creating/displaying a proposal grants no authority/effect. Equal text/parameters do not
prove duplicate occurrence; material revision creates a new identity and supersedes
the predecessor rather than keeping its approval.

Record approval/rejection as immutable attributable events bound to exact proposal
identity and presented parameters or integrity-bound snapshot, deciding principal and
identity evidence, scope/surface/interaction correlation, authority provenance and the
specific boundaries satisfied, times and conditions. Conditional assent counts only
if it precisely fits a narrower proposal; otherwise create/re-present the revised one.
Runtime approval flags or specialist requests are operational evidence, not authority.

Identify every required boundary. Each must currently be satisfied by its legitimate
source: current instruction, standing responsibility, governing role/policy, ordinary
means encompassed by an authorized objective, or fresh proposal-specific decision as
required. Only the boundaries requiring fresh human decisions need those approvals;
fresh approval is not universal authority. Each such boundary needs a valid current
decision from a principal entitled to decide it. No majority/first/last-response rule
or permissive source can resolve conflict absent governing authority. One rejection
blocks an inseparable proposal; restrictive non-approval policy cannot be waived by an
unentitled approver. A separable permitted subset is a new proposal, never hidden execution.

Meaningful correlation requires one unambiguous pending proposal, authenticated
principal appropriate to consequence, entitlement/scope, evidence of exact-version
awareness, unambiguous decision meaning, and no material currentness/disclosure/expiry/
withdrawal/supersession conflict. Presentation, confirmed transport delivery, and
awareness differ. Strong shared-ground evidence or explicit material knowledge in the
response can establish awareness; bare assent plus send/delivery cannot manufacture it.
Recency, conversation/session/thread, emoji, or identical text cannot select among
ambiguous proposals. Clarify and fail closed. A new surface is allowed only with valid
principal/disclosure/correlation; reconstruct from Ember-owned durable state after
restart without relying on provider history. Replay of one approval is one event;
separately authored identical approvals remain distinct occurrences.

Withdrawal/counter-decision preserves the old approval plus a new targeted attributable
event. The approving principal may withdraw their still-relevant decision; another
principal requires legitimate current authority over that boundary. Immediately remove
the live mandate and recompute eligibility; do not silently route around withdrawal
with an unevaluated alternate source. Ambiguous stop blocks execution pending
clarification. Withdrawal after execution began is not rollback; it blocks not-yet-
started/repeated effects while the in-flight outcome is reconciled.

Keep proposal lifecycle, individual decisions, authority-source evaluation and aggregate
eligibility separate. Immediately before effect, revalidate exact identity/payload,
all current legitimate boundaries and fresh decisions, no withdrawal/rejection/
expiry/supersession/execution/uncertain prior attempt, material effects/affected parties,
current objective/meaning, and sufficiently fresh external facts. Staleness, expiry,
and supersession are distinct historical states with no live mandate. Material change
requires new identity and required fresh decisions; a permitted nonmaterial recheck
cannot broaden scope. Approval is consumed per declared occurrence semantics, not
restored by timeout/cancellation/restart. Persist attempt correlation and reconcile
external state before consequential retry; a new proposal/approval may be necessary.

The capability executor verifies exact integrity-bound material parameters and current
proposal authority before effect. Capability/schema/credential/runtime permission never
substitutes for semantic authority. Universal authentication thresholds, hashes,
locks/storage, buttons/notifications, risk taxonomy/DSL, batching, and per-capability
retry/compensation mechanisms remain unselected.

## Consequences

- Authority can survive surfaces/restart without becoming a session-wide boolean.
- Ambiguous response, uncertain awareness, conflicting affected-party interests or
  stale facts can block action; explicit clarification/re-proposal is required.
- Concrete capabilities must supply consequence-appropriate identity, durable correlation,
  revalidation and recovery evidence; the narrow Calendar implementation proves selected
  traces rather than every multi-principal semantic scenario.

## Implementation Plan

- **Affected paths:** [proposal sidecar](../../../packages/core/src/capabilities/action-proposal.ts),
  [Calendar creation](../../../packages/core/src/integrations/google-calendar/create.ts),
  [CLI operator actions](../../../apps/cli/src/commands.ts), application coordination,
  and source scenarios/traceability. These are current references, not universal schemas.
- **Dependencies/configuration:** none; do not introduce a new UI, authentication
  mechanism, fixed expiry or generalized authority policy in this semantic migration.
- **Patterns to follow:** stable proposal identity, exact material binding, independent
  boundary evaluation, awareness/correlation evidence, fail-closed execution revalidation.
- **Patterns to avoid:** approval as an SDK/session flag, bare assent as awareness,
  most-recent proposal selection, majority bypass, or rejection/withdrawal as rollback.
- **Migration:** architectural ownership is transferred here and retain the original
  representative scenarios, authority aggregation discussion and unresolved choices.
  No code/package changes are required; the source remains a supporting reference.

### Verification

- [x] Calendar creation and action-effects evaluation tests pass exact presentation/
      confirmation, scope/currentness, withdrawal/supersession, attempt and recovery cases.
- [x] Source review preserves all five correlation conditions, all immediate pre-effect
      checks, affected-principal aggregation, withdrawal semantics and open representation choices.
- [x] No claim is made that the single-principal Calendar tests prove generic multi-
      principal aggregation or all cross-surface approval scenarios.

## Alternatives Considered

- Session/tool-call approval bit: compact but cannot preserve exact proposal occurrence,
  parameters, authority provenance, material change or consumed effect semantics.
- Bare conversational assent/recency correlation: low interaction cost but ambiguous
  and can mistake delivery for meaningful awareness of exact consequences.
- Fresh human approval for everything or majority decisions: superficially uniform
  but ignores legitimate standing/policy sources and independent affected interests.

## More Information

Constrained by ADRs [0002](0002-preserve-persistent-meaning.md),
[0004](0004-separate-capability-from-authority.md),
[0005](0005-distinguish-operational-continuity.md), and
[0013](0013-keep-conversation-identity-and-context-ember-owned.md).
Revisit only when observed action/authority failures expose inadequate semantics;
more convenient UI/runtime flags cannot silently weaken the boundary.

### Migration verification — 2026-10-27

The combined targeted run passed all 98 deterministic tests across eight files:
capability execution, AI SDK capabilities, Calendar read/create, action-effects
evaluation, MCP, Codex specialist and reintegration. No live provider or real Calendar
service was invoked. A second source/code review checked the intended constraint
mapping, native template/metadata, numeric identities, source/index links and anchors.
These tests establish selected implementation traces, not universal semantic approval,
remote-effect, hostile-runtime or concurrency guarantees. The maintainer accepted this record on 2026-10-27; source ownership is now transferred.

### Phase acceptance — 2026-10-27

The maintainer approved M07, including qualification of the historical no-subordinate-
ADR wording in the specialist sources. This record owns its architectural decision;
existing source paths, headings, procedures, scenarios and evidence remain as supporting
references. Acceptance introduces no runtime, dependency, package or original-skill
change. Unrecorded historical approval dates and attribution remain unasserted.
