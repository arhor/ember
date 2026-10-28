---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0025: Map MCP tools explicitly into bounded Ember capabilities

Migration record from [source 1](../mcp-capability-source.md). This accepted ADR now owns the architectural decision; sources retain supporting
implementation details and dated evidence. Creation does not invent original approval attribution or decision dates.
The implementation plan describes existing behavior and ongoing constraints.

## Context and Problem Statement

Issue [#190](https://github.com/arhor/ember/issues/190) introduced Model Context
Protocol (MCP) as a technical capability source, not an authority or agent framework.
C14 records the existing local stdio integration behind the execution firewall.
The source's `ai@7.0.93` is adoption-era evidence; current manifests inspected for
migration use `ai@7.0.153` and `@ai-sdk/mcp@2.0.45`. No version change or new provider
capability is proposed, and no external documentation was refreshed for migration.

## Decision

Use explicit trusted local stdio command/argv/cwd/environment configuration and the
AI SDK MCP client/transport for connection, initialization, discovery, invocation,
and close mechanics. The config owner must trust the launched executable. This is
not a hostile-server sandbox. Bound initialization, request/discovery, and close
observation; keep tool-call retries zero. The current adapter bounds paged discovery
to sixteen pages and uses bounded operational errors.

Discovery yields only source tool name/description/input schema. A discovered tool
is not model-visible until Ember explicitly maps it to a separate capability name,
trusted model-facing description, authority function, and optional semantic validator,
then selects that binding for one cognition. Server instructions/descriptions/names/
session IDs are untrusted operational evidence, not canonical facts or authority.
Do not pass advertised descriptions through as Ember's trusted descriptor by default.

Invoke only through the existing capability firewall. Connection/initialization and
discovery failures establish no remote tool attempt. Authority denial or semantic
input rejection never invokes `tools/call`. Known-closed source before submission
is attempted executor entry but no remote effect started: failed with safe-retry
evidence, still subject to the per-cognition occurrence block. MCP `isError` is an
observed failed attempt with unsafe retry; timeout/disconnect after `callTool`
submission begins is `outcome_unknown`, unsafe. A pipe closing or timeout cannot
prove that the server performed no effect. Preserve `CapabilityExecutionFailure`
with `not_started` versus `unknown` effect state rather than false failure certainty.

Normalize successful structured JSON/text to Ember JSON, then apply the existing
8 KiB capability bound. Keep raw MCP result/RPC IDs/session/server metadata, tool/
transport objects, and media payloads out of domain contracts/canonical state.
Normalized output remains operational cognition evidence and passes through independent
final-result semantic validation. Protocol transport is replaceable without changing
Ember capability authority, identity, memory, currentness, or persistence.

Close waits for observed transport closure within a finite bound, rather than claiming
cleanup because a signal was sent. Closed sources refuse discovery and bindings cannot
submit later remote requests. No remote HTTP/SSE, OAuth, registries, resources, prompts,
sampling, elicitation, durable session reuse, plugin marketplace, or provider migration
is selected by this decision.

## Consequences

- Explicit mapping keeps protocol discovery from becoming an ambient permission path.
- Conservative post-submission uncertainty can block retry when a service result is
  missing; consequential MCP effects still need their own durable recovery semantics.
- Experimental transport compatibility and bounded lifecycle need deterministic fixtures;
  the package can be replaced behind the same capability contracts.

## Implementation Plan

- **Affected paths:** [MCP adapter](../../../packages/core/src/integrations/mcp/ai-sdk.ts),
  [firewall](../../../packages/core/src/capabilities/execution.ts),
  [stdio fixture](../../../tests/fixtures/mcp-server.ts), and source reference.
- **Dependencies/configuration:** add/update none; preserve manifest-pinned MCP 2.0.45
  and existing trusted local configuration. Adoption-era AI patch pins are historical.
- **Patterns to follow:** explicit discovered-tool mapping and selection, normalized
  output, zero retry, finite lifecycle, pre-/post-submission effect distinctions.
- **Patterns to avoid:** server description as trusted instruction, discovery as
  authority, protocol objects in canonical state, or disconnect as proof of non-effect.
- **Migration:** architectural ownership is transferred here; retain source failure matrix,
  exact config/lifecycle procedure, fixture and replacement criteria. The
  source remains a supporting reference. No runtime/package edits are required.

### Verification

- [x] `node --test tests/mcp-capabilities.test.ts` passes real local fixture discovery,
      explicit binding, denial/input gating, success/error, timeout/disconnect and closure.
- [x] Source/code review preserves all five replacement requirements and the full
      pre-submission/observed-failure/post-submission-uncertainty matrix.
- [x] No network service, remote credentials, live provider, package changes, or new
      protocol/domain type leakage is introduced by this documentation migration.

## Alternatives Considered

- Expose every discovered tool directly: convenient onboarding but delegates
  description trust, capability selection and authority to the server.
- Build a new MCP framework: increases control but duplicates supported protocol
  mechanics; a narrow replaceable adapter is sufficient for the earned local path.
- Treat every transport failure as definite remote failure: simplifies retries but
  falsely converts missing terminal observation into evidence of no effect.

## More Information

[Capability ADR 0024](0024-enforce-capability-authority-and-effect-evidence-in-an-ember-firewall.md)
and accepted ADRs 0003–0005 constrain this integration. Revisit on a demonstrated
remote transport/auth/resource requirement or protocol incompatibility; local stdio
success does not imply adoption of all MCP features or general remote-effect safety.

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
