---
summary:
  "Issue #204 production design for subscription-backed Claude Code cognition through Vercel AI SDK and
  ai-sdk-provider-claude-code while Ember keeps semantic ownership."
read_when:
  - "Changing the Claude Code cognition provider or its isolation/authentication policy"
  - "Reviewing how subscription-backed agent runtimes can fit behind Ember's Vercel AI SDK boundary"
  - "Investigating Claude Code cancellation, session, tool, MCP, skill, or customization leakage"
role: design
discovery_status: current
---

# Claude Code cognition through Vercel AI SDK

## Decision

Issue [#204](https://github.com/arhor/ember/issues/204) implements Claude Code as a production `ProviderInvoker` through
**Vercel AI SDK 7** and the community `ai-sdk-provider-claude-code` package. Ember does not own a Claude-specific
process runner, CLI parser, JSONL protocol, retry loop, or structured-output transport.

The dependency versions pinned by the implementation are:

- `ai@7.0.93`;
- `ai-sdk-provider-claude-code@4.3.1`; and
- the provider's exact `@anthropic-ai/claude-agent-sdk@0.3.263` dependency.

The community provider is not an Anthropic or Vercel package. Its value here is narrow: it maps the official Claude
Agent SDK/Claude Code runtime onto AI SDK's language-model interface, including native structured output and AbortSignal
propagation, while leaving Ember's request/result semantics outside the provider.

## Semantic boundary

Claude cognition consumes the existing Ember-owned `ProviderRequest` and returns the existing `ProviderResult`:

```text
ProviderRequest
  -> Claude-specific isolation/model construction
  -> createAiSdkProvider(LanguageModel)
  -> AI SDK Output.object structured generation
  -> validateProviderResult
  -> ProviderResult
```

`usedMeaningIds` therefore still has two gates. AI SDK/provider schema validation proves shape; `validateProviderResult`
proves every claimed meaning was actually selected in the supplied projection. Claude model/session metadata is not
canonical meaning.

The adapter deliberately does not expose `sdkOptions`, `settings`, `extraArgs`, resume handles, arbitrary tools, or
other provider-specific escape hatches to ordinary callers. The only production configuration currently accepted is an
optional model ID plus the existing normalized inference-evidence sink.

## Authentication ownership

Authentication remains owned by the locally installed Claude runtime. Ember does not read, copy, persist, or broker
Claude credentials.

The adapter preserves the host environment needed for the provider to find the local Claude installation and credential
store, but explicitly removes API/cloud fallback material from the provider subprocess environment:

- every `ANTHROPIC_*` variable;
- `CLAUDE_CODE_OAUTH_TOKEN`;
- `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, and `CLAUDE_CODE_USE_FOUNDRY`;
- `AWS_*` and `GOOGLE_*` variables; and
- `GCLOUD_PROJECT` / `CLOUD_ML_REGION`.

Provider 4.3.1 constructs the actual Agent SDK subprocess environment from its own allowlist, then merges these explicit
removals. Variables such as `HOME`, `PATH`, and `CLAUDE_CONFIG_DIR` are not replaced by Ember, so a normal local Claude
subscription login can still be discovered.

An unavailable login is surfaced as a bounded `ProviderError` instructing the operator to run `claude auth login`. Raw
provider authentication diagnostics remain only as the in-memory error cause and are not copied into canonical state or
normalized inference evidence.

## Context and capability isolation

Every cognition gets a fresh temporary working directory created by Ember. The Claude provider is constructed with this
fixed policy:

| Surface                                    | Policy                                       |
| ------------------------------------------ | -------------------------------------------- |
| filesystem settings / `CLAUDE.md`          | `settingSources: []`                         |
| Claude built-in tools                      | `tools: []` and `allowedTools: []`           |
| unattended permission prompts              | `permissionPrompts: "none"`                  |
| MCP                                        | `mcpServers: {}` and `strictMcpConfig: true` |
| skills                                     | `skills: []`                                 |
| plugins                                    | `plugins: []`                                |
| programmatic subagents                     | `agents: {}`                                 |
| turns                                      | `maxTurns: 1`                                |
| session persistence                        | `persistSession: false`                      |
| streaming input / interactive continuation | `streamingInput: "off"`                      |

The adapter does not opt into a Claude Code preset system prompt, filesystem settings, provider hooks, extra
directories, or SDK escape hatches. Ember's bounded projection and current input are still supplied by
`createAiSdkProvider` as the request context.

This is the strongest isolation claim the implementation currently earns. It proves that Ember does not request
user/project/local filesystem settings, tools, MCP servers, skills, plugins, or persistent sessions through the provider
API. It does **not** prove that every host- or organization-managed Claude policy is absent inside the external runtime,
nor does it claim that an external service has no provider-owned framing.

## Structured output

`createAiSdkProvider` uses AI SDK `generateText` / `streamText` with `Output.object` and Ember's strict JSON schema for:

- `contractVersion`;
- `reply`; and
- `usedMeaningIds`.

Provider 4.3.1 maps this AI SDK response format onto Claude Agent SDK structured output. The result then passes
`validateProviderResult`; prompt-only JSON obedience is never a parsing contract. This directly replaces the custom
structured-output parsing that a hand-written Claude CLI adapter would otherwise need.

## Session and continuation semantics

The production default is fresh one-shot cognition. A new model/provider configuration and isolated cwd are created for
each invocation, `maxTurns` is one, and `persistSession` is false. Ember does not pass `resume`, `continue`, or a
session ID and does not record a Claude session as `operational.externalThreadId`.

A future resumption feature would require a separate semantic decision and new evidence. It must not quietly turn a
Claude session into Ember continuity or memory.

## Cancellation and timeout truth

AI SDK passes Ember's `AbortSignal` and timeout through the provider to the Claude Agent SDK. Ember intentionally keeps
the shared conservative outcome vocabulary:

- caller cancellation -> `cancellation_requested`;
- timeout -> `timed_out`.

Unlike the custom Codex/Cursor process adapters, this integration does not directly observe or supervise the Claude
child process. Therefore Ember records no direct-child termination confirmation for this provider. An awaited
abort/rejection is evidence that cancellation was requested through the SDK boundary, not proof of remote rollback,
absence of already-issued inference work, or absence of every external effect.

Temporary-workspace cleanup is operational hygiene and is not used as termination evidence.

## Tests and live evidence

Deterministic tests use AI SDK's mock language model rather than a fake Claude wire protocol. They cover:

- the fixed isolation/session/environment settings;
- structured result mapping and Ember provenance validation;
- explicit authentication failure mapping;
- cancellation and timeout semantics; and
- rejection of provider-specific configuration escape hatches.

The opt-in authenticated probe is:

```sh
npm run smoke:claude
```

It uses a real Ember `ProviderRequest`, places a project `CLAUDE.md`/settings marker outside the adapter's isolated cwd,
injects intentionally invalid API/token environment values that the adapter must remove, and requires an already
authenticated local Claude subscription. The probe checks least-sufficient projection disclosure, absence of the
project-customization marker, no provider session evidence, and no canonical retention of the reply.

## Consequence for the AI SDK strategy

Issue #178 originally framed AI SDK primarily as a direct HTTP/API provider substrate, and issue #180 treated current
subscription-backed runtimes as a reason to retain custom CLI adapters. #204 narrows that conclusion.

The useful distinction is not **HTTP provider versus subscription runtime**. It is whether a maintained AI SDK provider
removes real integration mechanics without taking semantic ownership. For Claude Code, the community provider now
removes process launch, Agent SDK protocol handling, structured-output transport, and abort plumbing while Ember keeps
projection, provenance, authority, continuity, failure truth, and canonical state. Codex and Cursor remain custom
adapters because no equivalent adopted provider has yet demonstrated the same simplification for their current
subscription paths.

This is evidence for the existing "one primary SDK, exceptions by evidence" strategy, not a reason to wrap every
external CLI in AI SDK for aesthetic consistency.
