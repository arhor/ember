---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0024: Enforce capability authority and effect evidence in an Ember firewall

Migration record from [source 1](../capability-execution-boundary.md). This accepted ADR now owns the architectural decision; sources retain supporting
implementation details and dated evidence. Creation does not invent original approval attribution or decision dates.
The implementation plan describes existing behavior and ongoing constraints.

## Context and Problem Statement

Issue [#189](https://github.com/arhor/ember/issues/189) introduced model-facing tools
without making SDK tool availability authority. Issues #231/#233 later added read-only
Calendar observations and consequential event creation. This C13 migration records the
cross-cutting execution boundary while keeping Calendar-specific configuration and
reconciliation procedures in the source. It extends neither authority nor tool reach.

## Decision

Keep Ember-owned `CapabilityBinding` and execution evidence beneath the application-
selected per-cognition binding set. The SDK exposes only that set; it cannot discover
additional capabilities. Selection is technical reachability, not authorization.
Every call passes independently through `authorized`, `approval_required`, or `denied`;
only current attributable instruction, standing authority, or fresh approval can ground
authorization. SDK approval flags are mechanics, not an authority oracle or policy DSL.

Mechanically validate input shape in the model adapter, then check Ember semantic
arguments and authority before entering the executor. Structurally valid input can
still refer to an unselected resource and must fail closed. Preserve cancellation
before execution as `cancelled_before_execution`, with safe retry evidence when no
executor ran. Once execution begins, abort/failure cannot prove non-effect: aborted
in-flight work is `outcome_unknown` and unsafe to retry unless the adapter establishes
a narrower pre-effect `not_started` fact. `failed` after an attempt is not rollback.

Return bounded `CapabilityExecutionEvidence`: success, authority denial, approval
required, input rejection, occurrence blocked, pre-execution cancellation, failed
attempt, or unknown outcome; retain whether execution was attempted and an explicit
retry disposition. Current bindings allow at most one attempt per capability name per
cognition, including after a safe-retry classification; a repeated call is blocked.
Model retries stay zero and the ordinary tool loop is bounded to four steps. Neither
bound establishes semantic completion or currentness.

Successful output must be JSON and at most 8 KiB before model reintegration. Tool
observations are operational cognition inputs, not adopted meaning, authority, or
proof of external truth. Final `validateAiExecutionResult` still checks selected
meaning IDs. SDK calls/messages/IDs/step objects and capability evidence do not become
canonical state just because a tool ran successfully. Tool-dispatch events are not
external-effect evidence.

Episode-local evidence suffices for the initial deterministic local lookup only.
Consequential/crash-sensitive effects require durable pre-effect attempt and recovery
state behind the same firewall. Keep the implemented Calendar specialization:

- Read-only lookup uses configured source/timezone, a positive UTC interval of at most
  31 days, at most 20 ordered expanded events, one attempt per cognition, redacted
  event/freshness/truncation evidence, and explicit unavailable/stale failures. No
  descriptions, attendees, locations, links, calendar addresses, credentials, or raw
  Google errors cross the boundary; observations are not automatic canonical memory.
- Event proposal is non-effectful and grants no authority. Current creation uses an
  exact title/start/end/timezone payload, a 15-minute proposal, target/config-generation
  binding, exact CLI presentation/confirmation, durable proposal/decision/attempt state,
  and revalidation. It excludes attendee/description/conference/recurrence/reminder/
  notification features. Credential scope is capability, not write authorization.
- Persist recovery binding before a possible effect so reconfiguration cannot strand
  accounting. Check deterministic external event identity before insertion; record
  prepared/submitted phases durably. Reconcile persisted payload/current proposal
  correlation, not untrusted new input. Prepared-not-submitted remains not started;
  submitted exact match (including timezone) confirms success, conflict confirms
  failure, and absence/lost/non-2xx/malformed-success responses cannot prove non-effect.
  Unknown effects are never retried under the old approval. Currentness/auth transport
  failures before effect remain distinct safe `not_started` failures.

Calendar's narrow implementation is evidence for [the proposal semantics in ADR 0026](0026-bind-approval-to-one-attributable-and-still-current-action-proposal.md),
not a universal approval UI, expiry, persistence engine, or resource policy.
Non-goals: generic plugins, SDK-owned agents/memory, new durable ledgers for harmless
lookup, new capabilities, broader Calendar actions, or changed runtime policy.

## Consequences

- Model/toolkit and capability-source adapters can evolve independently while Ember
  retains authority, currentness, and effect truth.
- Per-cognition occurrence policy deliberately blocks convenient repetition; later
  retries need appropriate context, authority, and recovery rather than SDK retry flags.
- Consequential adapters carry persistence/reconciliation obligations beyond local
  lookup. Retain their exact operational documentation and deterministic evidence.

## Implementation Plan

- **Affected paths:** [firewall](../../../packages/core/src/capabilities/execution.ts),
  [proposal sidecar](../../../packages/core/src/capabilities/action-proposal.ts),
  [local lookup](../../../packages/core/src/capabilities/local-lookup.ts),
  [Calendar read](../../../packages/core/src/integrations/google-calendar/read.ts),
  [Calendar create](../../../packages/core/src/integrations/google-calendar/create.ts),
  and the maintained source reference. No runtime edits are needed for migration.
- **Dependencies/configuration:** none added/upgraded; preserve installed SDK/provider
  manifests, Calendar configuration/credentials, and existing operator interfaces.
- **Patterns to follow:** selected bindings, independent authority/semantic gates,
  explicit attempt evidence, bounded JSON, durable consequential recovery.
- **Patterns to avoid:** availability as permission, schema validity as authorization,
  abort as non-effect, unsafe retry, or tool output as canonical meaning.
- **Migration:** decision ownership is transferred here; keep all Calendar
  fields, redaction rules, CLI commands, attempt-state details and opt-in probes at
  the original source path. Sources remain supporting references.

### Verification

- [x] `node --test packages/core/src/capabilities/execution.test.ts tests/ai-sdk-capabilities.test.ts`
      passes selection/authority/input/occurrence/cancellation/evidence boundaries.
- [x] Calendar read/create and action-effects tests pass for bounded reads, exact
      approval/payload binding, expiry/reconfiguration, durable attempts and uncertainty.
- [x] Source review preserves the distinction between local episode evidence and
      consequential durability, including exact response/recovery classifications.

## Alternatives Considered

- Let SDK approval or tool discovery govern execution: reduces adapter checks but
  confuses technical reach with current semantic authority.
- Automatically retry tool failures/cancellation: improves apparent availability but
  may duplicate an effect after unknown outcome. Keep explicit recovery and occurrence rules.
- Adopt tool output directly as meaning: avoids a second semantic gate but discards
  provenance/currentness and the independent final-result validation boundary.

## More Information

Constrained by ADRs [0004](0004-separate-capability-from-authority.md),
[0005](0005-distinguish-operational-continuity.md), and
[0016](0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md).
Revisit when a concrete capability needs different occurrence/output/recovery policy;
new reach does not itself earn authority. Source references describe selected traces,
not universal guarantees about external services or hostile same-user processes.

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
