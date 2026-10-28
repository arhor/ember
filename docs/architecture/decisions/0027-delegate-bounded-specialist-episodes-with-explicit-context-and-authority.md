---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0027: Delegate bounded specialist episodes with explicit context and authority

Migration record from [source 1](../minimal-codex-specialist-delegation.md), source 2 (consolidated into this ADR; original source in Git history). This accepted ADR now owns the architectural decision; sources retain supporting
implementation details and dated evidence. Creation does not invent original approval attribution or decision dates.
The implementation plan describes existing behavior and ongoing constraints.

## Context and Problem Statement

Issues [#59](https://github.com/arhor/ember/issues/59)–#63 established bounded Codex
work, context/authority separation, currentness and interruption recovery beneath
ADRs 0003–0005. C16 consolidates the design and companion context-flow note, not two
new decisions. [Accepted ADR 0012](0012-keep-codex-exec-for-bounded-specialist-work.md)
already owns exec versus App Server/SDK selection and its adoption triggers.

The original sources said no separate subordinate ADR was warranted for their local
representation. This migration records durable ownership/authority/recovery constraints
at the maintainer's direction, not a new semantic model, immutable Codex schema,
generic specialist framework or renewed runtime-selection decision. The maintainer approved preserving that historical rationale while recording the
cross-cutting constraints here; the local schema remains revisable.

## Decision

Delegate one live Ember-owned objective through one explicit bounded specialist
episode. Codex owns its task-local planning/tool loop and attributed report; Ember
owns purpose, least-sufficient permitted disclosure, current authority, workspace/
runtime selection, boundary observations, currentness, effect reconciliation and
acceptance. Delegation is distinct from one-shot cognition even when both use exec.

Persist an immutable specification before launch: Ember episode identity; objective
and acceptance/prohibited outcomes; selected context with scope/provenance/currentness;
attributable principal/grant/authority provenance/currentness plus permitted/prohibited
actions and escalation conditions; explicit canonical workspace/baseline and user-change
preservation; runtime policy/version/isolation/env/tool/network/resource controls;
and machine-comparable objective/context revisions. Keep objective, context, authority,
and technical capability independent even if serialized together.

Workspace selection is both disclosure and capability: never inherit it accidentally.
Environment/credentials/extra directories/configuration are separately selected; use
an environment allowlist. Repository files/instructions, credentials, useful objective,
model statements and coarse sandbox reach cannot self-amplify authority. Read/write
capability can coexist with read-only semantic authority; `network_reach:
not_established` does not prove technical network impossibility. The sandbox is
defense in depth, not exact mechanical enforcement of every semantic restriction.

Only intentionally selected context crosses the prompt boundary; omitted private
meaning remains recoverable and need not be disclosed. Translate a private reason
into an operational constraint when sufficient. Each disclosed item preserves scope,
provenance and currentness. Least-sufficiency remains Ember's selection responsibility,
not proof from a token count or automatic adapter scan of canonical state.

Launch one ephemeral exec attempt in the selected workspace with bounded JSONL/output,
timeout, filtered environment and explicit runtime policy. Keep emitted thread ID
operational, not identity/continuation. Initial implementation disables ambient user
config/plugins/apps/skills and uses workspace-write as recorded capability. Validate
and retain the last schema-valid final agent report after observed child exit; do not
promote unstable intermediate progress/approval events into durable semantic claims.
The report contains summary/disposition, artifacts, checks, known/possible effects,
blockers and expansion requests, attributed to Codex rather than Ember verification.

Expansion requests separately identify context, authority or capability needs with
request/purpose/consequence/legitimate decision boundary. They grant nothing: no auto-
disclosure, envelope expansion, replacement or transitive delegation. When exec cannot
mediate a live decision safely, end blocked. Material objective/envelope change makes
work stale, requests cancellation, or starts a new episode; no invented steering,
suspension/resumption, session reuse or process reattachment.

Keep runtime, report, Ember disposition and known/possible effects independent.
Reported success is not accepted/current completion. Preserve report provenance on
summary/artifact/check/effect/expansion claims; report effects stay under that provenance,
not copied into Ember-owned top-level effect conclusions. No automatic canonical mutation.

Persist cancellation intent before signalling; separately record reason, observed
direct-child exit, specialist-wide stop and effects. Timeout/output limit/invalid
report/process loss never prove absence of work/effects. If intent persistence fails,
perform bounded best-effort direct-child termination, return ambiguous evidence and
preserve the durable-record gap. A lost supervisor after launch intent (even before
child-start persistence) becomes `lost`/`ambiguous`; pre-abort with no launch attempt
remains safely not launched. The foreground record is not detached execution/scheduling.

Interrupted attempts retain effects-possible and retry-prohibited pending reconciliation.
Retry needs both current evidence of relevant effect absence and continued work stopped
or made harmless, plus live authority. Made-harmless does not mean all work stopped;
only independent stop proof establishes specialist-wide stop. Existing effects remain
accounted for; no automatic consequential retry. Replacement is a new Ember episode,
not fabricated continuation of lost provider state.

Reuse one currentness gate: matching objective/context revisions with current objective
permits an explicit disposition; superseded objective/revision is stale; changed context
requires reasoned re-evaluation at the same checkpoint; cancelled objective is rejected.
Retain historical report/provenance. Currentness and disposition commit together after
final attributed report/exit; direct acceptance without current reconciliation is forbidden.
Reintegration's wider authority/provenance gate belongs to ADR 0028.

Non-goals: generic AgentRuntime/policy DSL, nested delegation, job queue, live steering,
perfect hostile-runtime containment, stable intermediate event semantics, or new episode
schema commitments. All AS-DEL-00–08 responsibilities remain in the source map.

## Consequences

- Durable boundary history survives provider loss without manufacturing direct Ember
  experience, completion or safe retry.
- Explicit selection/envelopes impose work on the delegator; coarse runtime controls
  leave residual effect uncertainty requiring independent reconciliation.
- Foreground supervision cannot claim detached continuation or reattachment; richer
  runtime controls remain gated by the requirements in ADR 0012.

## Implementation Plan

- **Affected paths:** [specialist boundary](../../../packages/core/src/delegation/codex-specialist.ts),
  [deterministic tests](../../../packages/core/src/delegation/codex-specialist.test.ts),
  [controlled process fixture](../../../tests/fixtures/providers/scripted-codex-specialist.ts),
  and both retained source references. Existing spec-v2/record-v3 are implementation
  evidence, not newly selected public protocols.
- **Dependencies/configuration:** no additions/upgrades; preserve exec policy and
  existing runtime settings. Do not touch active package work or run live specialists.
- **Patterns to follow:** persisted immutable envelope, selected context, explicit
  authority/capability distinction, attributable reports, currentness and truthful recovery.
- **Patterns to avoid:** implicit workspace, authority from sandbox reach, specialist
  effects relabeled direct observation, automatic expansion/retry, or provider-owned continuity.
- **Migration:** architectural ownership is transferred here, qualify the old no-ADR wording,
  retain source schema/lifecycle/recovery/acceptance tables and issue history. The
  context-flow companion is consolidated here, with no independent extra record.

### Verification

- [x] `node --test packages/core/src/delegation/codex-specialist.test.ts` passes
      bounded invocation, disclosure/authority, currentness, cancellation, loss and safe-retry recovery.
- [x] Source review preserves AS-DEL-00–08, four separate input meanings, expansion
      request fields, report attribution and the implementation's explicit narrowings.
- [x] No live invocation, package change, new runtime-selection decision or claim of
      complete sandbox enforcement/descendant termination is introduced.

## Alternatives Considered

- Delegate as an ordinary cognition call: reuses a small request but obscures a runtime
  that exercises planning/tools and produces effects under separate entrusted authority.
- Delegate canonical state or broad authority: reduces selection work but violates
  least-sufficient disclosure and non-amplifying authority.
- Reuse threads/automatically retry lost work: convenient recovery but can revive stale
  premises or repeat effects; keep new episodes and explicit current-state reconciliation.

## More Information

[ADR 0012](0012-keep-codex-exec-for-bounded-specialist-work.md) owns integration
surface selection. The source's representation remains revisable under accepted ADRs
0003–0005. Revisit when a real episode cannot fit this bounded contract; preserve
objective ownership, disclosure, attribution, authority and effect uncertainty.

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
