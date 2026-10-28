---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0018: Isolate Claude Code cognition behind its AI SDK provider

## Context and Problem Statement

Issue [#204](https://github.com/arhor/ember/issues/204) found a maintained community
provider that removes Claude-specific launch, protocol, structured-output transport,
and abort plumbing while retaining Ember's semantic seam. This C07 record extracts
the [Claude reference](../claude-code-ai-sdk-provider.md). The provider is neither
an Anthropic nor a Vercel package; that maintenance boundary remains explicit.

The source records `ai@7.0.93`, provider 4.3.1, and its then-observed Agent SDK
0.3.263 dependency. The current manifests pin AI SDK 7.0.153 and provider 4.3.1.
These observations do not request a downgrade, freeze a historical transitive version,
or claim a fresh live authentication/isolation experiment.

## Decision

Compose Claude Code through `ai-sdk-provider-claude-code` and the shared AI SDK
cognition executor. Ember does not implement a Claude-specific process runner,
JSONL parser, retry loop, or structured-output transport. SDK validation proves
shape; `validateAiExecutionResult` independently proves selected meaning provenance.
Only optional model ID and the normalized inference-evidence sink are exposed to
ordinary callers. Reject provider settings, SDK options, extra args, resume handles,
and arbitrary tools as caller escape hatches.

Leave authentication with the installed Claude runtime and local subscription login.
Do not read, copy, persist, or broker credentials. Preserve host installation/login
discovery (including HOME, PATH, CLAUDE_CONFIG_DIR), but explicitly remove every
`ANTHROPIC_*`, `AWS_*`, and `GOOGLE_*` environment variable, plus
`CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`,
`CLAUDE_CODE_USE_FOUNDRY`, `GCLOUD_PROJECT`, and `CLOUD_ML_REGION` from the provider
subprocess environment. Missing login yields bounded operator guidance to
`claude auth login`; raw authentication cause remains in memory rather than
canonical state or normalized inference evidence.

For every invocation create a fresh temporary working directory and model/provider
configuration with the following fixed settings: `settingSources: []`, `tools: []`,
`allowedTools: []`, `permissionPrompts: "none"`, `mcpServers: {}`,
`strictMcpConfig: true`, `skills: []`, `plugins: []`, `agents: {}`, `maxTurns: 1`,
`persistSession: false`, and `streamingInput: "off"`. Do not opt into presets,
filesystem settings, hooks, extra directories, or SDK escape hatches. Only Ember's
bounded projection/current input enters ordinary cognition context.

Fresh one-shot invocation is the default: do not pass resume/continue/session IDs
or record a Claude session as `operational.externalThreadId`. Future resumption
needs a separate decision and evidence; a session cannot become Ember continuity.

Propagate cancellation/timeout through AI SDK to the external runtime. Record
`cancellation_requested` or `timed_out`, never direct-child termination confirmation
from an adapter that does not supervise that child. Awaited rejection and workspace
cleanup prove neither rollback nor absence of remote work/effects. Cleanup is hygiene.

The isolation claim is limited to what Ember requests through the provider API.
It does not prove absence of all host/organization-managed policy or provider framing.
Non-goals: a new authentication broker, sandbox guarantee, persistent Claude memory,
or converting all CLI providers for aesthetic consistency. Exceptions to shared SDK
mechanics remain evidence-driven.

## Consequences

- Shared structured-output/abort mechanics replace custom Claude protocol code;
  retain deterministic provider-setting and provenance tests as upgrade evidence.
- The external runtime/provider remains a trust and maintenance boundary; do not
  describe these settings as proof that every ambient host policy is absent.
- Fresh workspaces and one-shot sessions add setup/cleanup overhead. Subscription
  login remains an operator prerequisite; failures must preserve bounded diagnostics.

## Implementation Plan

- **Affected paths:** [Claude adapter](../../../packages/core/src/ai/claude-code.ts),
  [shared cognition adapter](../../../packages/core/src/ai/cognition.ts),
  [deterministic tests](../../../tests/claude-code-provider.test.ts), and
  [opt-in live probe](../../../tests/live/claude-code-smoke.ts).
- **Dependencies/configuration:** no package updates; preserve manifest-pinned
  provider 4.3.1 and AI SDK 7.0.153 as observed, without creating a new transitive pin.
  Keep the optional model/evidence interface and existing subscription login discovery.
- **Patterns to follow:** fixed isolation policy, explicit environment removals,
  independent semantic validation, and conservative cancellation evidence.
- **Patterns to avoid:** provider-specific caller escape hatches, session reuse,
  credential capture, or cleanup/abort treated as proof of process termination.
- **Migration:** under this accepted record make this ADR the decision owner while preserving
  exact settings, probe procedure, and dated dependency/evaluation evidence at the
  source path. No runtime edits, live probe, or paid inference is needed for migration.

### Verification

- [x] `node --test tests/claude-code-provider.test.ts` passes for fixed settings,
      environment removals, semantic validation, login failure, abort/timeout, and
      rejection of caller escape hatches.
- [x] Source review preserves all fixed settings, credential ownership, unknown host
      policy, session non-ownership, and lack of direct-child/effect-absence proof.
- [x] No live-provider result is invented; historical dependency versions remain dated
      evidence and no package files or original skill files change.

## Alternatives Considered

- Hand-written Claude CLI adapter: gives direct protocol ownership but recreates
  launch, parsing, structured transport, and abort plumbing already removed by the
  adopted provider. The source found that duplication unnecessary for this path.
- Expose the provider's general options/session controls: enables richer workflows
  but permits context/tool/session escape from the bounded cognition contract.
- Force every CLI onto the same community-provider pattern: uniformity alone does
  not demonstrate lower maintenance cost or preserve other runtimes' semantics.

## More Information

Constrained by accepted ADRs 0002–0005 and
[conversation ownership ADR 0013](0013-keep-conversation-identity-and-context-ember-owned.md).
The [shared SDK decision](0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md)
records the in-memory error-cause boundary that supports authentication mapping.
Revisit when provider/runtime changes invalidate fixed isolation, subscription discovery,
structured output, or honest cancellation semantics; first reproduce with deterministic
fixtures, then run a separately authorized live probe when external evidence is needed.

### Migration verification — 2026-10-27

The combined targeted run passed all 91 tests across eleven files; the production
dependency check also passed. Source comparison preserves this record's constraints,
non-goals, and evidence limitations. No live-provider observation, runtime change, or
acceptance is implied by these deterministic results. The maintainer accepted this batch on 2026-10-27. This ADR now owns its decision;
source documents retain operational detail and dated evidence.

### Phase acceptance — 2026-10-27

The maintainer authorized completion of M05 following the concrete phase review.
Source ownership is transferred to this accepted ADR. Implementation paths and
ongoing verification constraints describe the existing system; no runtime work,
dependency change, or package reorganization is introduced by acceptance. Historical
approval attribution not recorded in the original sources remains unknown.
