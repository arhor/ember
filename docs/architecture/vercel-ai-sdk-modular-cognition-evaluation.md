---
summary:
  "Issue #178 evaluation of Vercel AI SDK as a replaceable TypeScript model, structured-output, streaming, tool-loop,
  approval, MCP, and observability substrate beneath Ember-owned cognition and authority semantics."
read_when:
  - "Considering Vercel AI SDK for model invocation, structured output, streaming, tools, approvals, MCP, or provider
    normalization in Ember"
  - "Comparing low-level agent SDKs as replaceable mechanics beneath Ember-owned ProviderRequest and ProviderResult
    semantics"
  - "Reviewing provider-specific continuation/evidence leakage, AI SDK type containment, or direct-API provider adoption"
role: design
discovery_status: current
---

# Vercel AI SDK Modular Cognition Evaluation

## Decision

**Vercel AI SDK Core is a strong candidate for generic cognition mechanics beneath Ember-owned provider and capability
boundaries. Prefer the low-level `generateText`, `streamText`, `Output`, tool, provider, middleware, MCP, testing, and
telemetry surfaces. Do not make `ToolLoopAgent`, AI SDK messages, provider sessions, memory integrations, or tool
approval the semantic architecture of Ember.**

Compared with the larger frameworks in issue [#175](https://github.com/arhor/ember/issues/175), AI SDK's main advantage
is what it does **not** insist on owning. Core model calls are ordinary TypeScript functions. Persistence is
caller-owned. Provider packages are separable. Tool execution can be local, deferred, or omitted. Structured output and
streaming are call-level mechanics. A tool loop can remain one bounded cognition episode instead of becoming Ember's
identity or runtime topology.

The recommended posture is:

1. **Keep `ProviderRequest` and `ProviderResult` meaning Ember-owned.** Projection, provenance, currentness, continuity,
   cancellation truth, and canonical state stay outside AI SDK.
2. **Use AI SDK below an adapter boundary when a provider removes real model/runtime plumbing.** This includes direct
   model APIs and, as #204 now proves for Claude Code, an agent-runtime provider that maps a subscription-backed Agent
   SDK into AI SDK. It can remove provider transport/protocol parsing, structured-output plumbing, usage/finish
   normalization, retries, mocks, telemetry hooks, and provider-specific glue without owning Ember semantics.
3. **Preserve provider-specific evidence before normalizing.** `providerOptions`, per-step `providerMetadata`, raw
   finish reasons, warnings, model identity, and response metadata provide an escape hatch from least-common-denominator
   loss.
4. **Treat local tool execution and approval as mechanics, not authority.** In particular, provider-executed tools do
   not pass through AI SDK's local `toolApproval` gate.
5. **Contain AI SDK types inside adapters.** Do not let `ModelMessage`, `Tool`, `GenerateTextResult`, `ToolLoopAgent`,
   provider metadata types, or MCP tool types spread through `src/core/`, canonical persistence, delegation contracts,
   or interaction surfaces.
6. **Do not replace the current Codex/Cursor CLI adapters merely to adopt AI SDK.** Their subscription authentication,
   isolated process lifecycle, continuation evidence, and termination uncertainty are runtime-specific mechanics AI SDK
   does not remove.

In short: **AI SDK is a good universal socket for model mechanics, not a new nervous system for Ember.**

## Evaluation baseline

This evaluation was performed on **2026-09-07** against:

- Ember's [Design Principles](../principles.md), accepted ADRs, and
  [Architecture Acceptance Scenarios](acceptance-scenarios.md);
- `src/providers/contract.ts` and the [Cognition Adapter Contract Decision](cognition-adapter-contract-decision.md);
- the current Codex/Cursor one-shot cognition adapters and their replacement, cancellation, and provider-specific
  lifecycle evidence;
- Ember's capability-versus-authority and specialist reintegration boundaries;
- current Vercel AI SDK repository `main`, where `ai` identifies as **7.0.93** and uses the Language Model V4 provider
  specification;
- current `@ai-sdk/mcp@2.0.45` and first-party AI SDK 7 documentation/source linked in [Sources](#sources).

The `ai` package currently declares Node `>=22`, three direct runtime dependencies (`@ai-sdk/gateway`,
`@ai-sdk/provider`, and `@ai-sdk/provider-utils`), and a Zod peer dependency. Ember's Node 26 baseline is therefore
within the declared engine range. The AI SDK repository currently type-checks its package with TypeScript 5.8.3, while
Ember uses TypeScript 7.0.2, so an actual Ember compile spike remains appropriate before production adoption.

No install-size, cold-start, or Raspberry Pi RSS benchmark is claimed here. The core packages do not introduce an
obvious native runtime dependency in the reviewed package metadata, but target-host measurement remains the correct
adoption gate.

## Classification scale

| Class              | Meaning                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **1 - direct**     | The primitive can sit below an Ember-owned interface with little semantic translation.                                               |
| **2 - firewall**   | The primitive is useful, but an adapter must prevent AI SDK concepts, provider state, or control flow from becoming Ember semantics. |
| **3 - coupled**    | The primitive strongly overlaps an Ember-owned semantic concept or would pull Ember toward SDK-owned agent/session/memory meaning.   |
| **4 - irrelevant** | The primitive does not currently solve an earned Ember requirement.                                                                  |

## Primitive inventory

| AI SDK primitive                     | Current surface                                                                                           |                                                    Class | Ember fit                                                                                                                   | Recommendation                                      |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Model invocation                     | `generateText`                                                                                            |                                                    **2** | Excellent direct-API execution substrate; Ember still owns projection, validation, provenance, and cancellation meaning     | **Wrap / strong candidate**                         |
| Streaming model invocation           | `streamText`                                                                                              |                                                    **2** | Mature token/content/tool streaming without dictating application persistence                                               | **Wrap when a surface needs streaming**             |
| Structured generation                | `Output.object`, `Output.array`, `Output.choice`, `Output.json`, schemas on `generateText` / `streamText` |                                                  **1/2** | Can replace ad-hoc structured-output parsing beneath `ProviderResult` validation                                            | **Strong candidate**                                |
| Provider specification               | Language Model V4, provider packages, custom providers                                                    |                                                    **2** | Broad model portability while keeping provider-specific escape hatches                                                      | **Strong candidate**                                |
| Provider registry/routing            | provider objects, `customProvider`, model aliases, optional AI Gateway                                    |                                                    **2** | Useful mechanical selection, but routing policy and evidence stay Ember-owned                                               | **Wrap / optional**                                 |
| Provider-specific options            | `providerOptions`                                                                                         |                                                    **2** | Necessary escape hatch for provider-native features                                                                         | **Use only inside provider adapters**               |
| Provider-specific results            | `providerMetadata`, raw finish reason, request/response metadata, warnings                                |                                                    **2** | Prevents forced least-common-denominator loss if translated deliberately                                                    | **Preserve at adapter boundary**                    |
| Model middleware                     | `wrapLanguageModel`, `LanguageModelV4Middleware`                                                          |                                                    **2** | Useful for logging, caching, defaults, or mechanical transforms; dangerous if it hides semantic context/authority decisions | **Use selectively**                                 |
| Tool definitions                     | `tool`, Zod/JSON schemas, optional local `execute`                                                        |                                                    **2** | Excellent model-facing schema and local execution plumbing                                                                  | **Wrap behind Ember capability/tool seams**         |
| Tool loop                            | `generateText` / `streamText` with `stopWhen`; `ToolLoopAgent`                                            | **2** for a bounded episode; **3** as Ember architecture | Useful temporary cognition loop, not continuity/runtime/delegation                                                          | **Use boundedly; avoid as identity owner**          |
| Tool approval                        | `toolApproval`, approval request/response content                                                         |                                                    **2** | Good pause/request mechanics for locally executed tools; not authority and not universal                                    | **Wrap behind Ember approval semantics**            |
| Provider-executed tools              | provider-defined/hosted tools                                                                             |          **3** if treated as ordinary Ember capabilities | Execution may occur provider-side and bypass local approval/executor evidence                                               | **Use only with explicit provider-specific policy** |
| MCP client/tool conversion           | `@ai-sdk/mcp`, `createMCPClient`, HTTP/SSE/stdio/custom transports                                        |                                                    **2** | Strong generic transport and schema conversion; authority and session truth remain outside                                  | **Wrap / strong candidate**                         |
| MCP resources/prompts                | MCP client support                                                                                        |                                                    **2** | Potential capability/context transport, but must not bypass Ember context selection or provenance                           | **Revisit per concrete need**                       |
| Telemetry                            | stable telemetry API, `registerTelemetry`, optional `@ai-sdk/otel`                                        |                                                    **2** | Strong observability mechanics if Ember IDs/privacy policy remain primary                                                   | **Candidate**                                       |
| Deterministic mocks                  | `ai/test`, `MockLanguageModelV4`, stream helpers                                                          |                                                    **1** | Excellent contract-test substrate                                                                                           | **Adopt with any AI SDK adapter**                   |
| AI SDK memory guidance/providers     | provider-defined tools, Letta/Mem0/etc., custom tools                                                     |                                    **3** as Ember memory | AI SDK composes memory rather than owning one canonical model, but integrations still carry foreign memory semantics        | **Do not adopt as Ember memory**                    |
| AI SDK UI/RSC/TUI                    | UI-specific packages/protocols                                                                            |                                                **4** now | Ember surfaces already have independent transport semantics                                                                 | **Ignore for core architecture**                    |
| `@ai-sdk/workflow` / workflow agents | separate optional workflow package                                                                        |                    **4** for #178; possible future **2** | Durable execution is a separate architectural concern already evaluated under #177                                          | **Do not conflate with cognition evaluation**       |

## Why AI SDK fits Ember unusually well

### The core call is smaller than an agent framework

The important low-level unit is conceptually:

```text
model + bounded prompt/messages + optional tools/output
  -> generateText / streamText
  -> normalized step/result metadata
```

There is no requirement that this call own:

- Ember lineage;
- a persistent thread/session;
- canonical state;
- long-term memory;
- message-history persistence;
- delegation responsibility;
- a resident server process;
- a graph/workflow topology.

That is exactly the direction issue #175 asks for: mechanics that can live beneath Ember instead of a framework asking
Ember to live inside it.

### `ToolLoopAgent` is optional sugar, not the only execution model

AI SDK 7 exposes `ToolLoopAgent`, but its implementation is essentially a configured wrapper around `generateText` /
`streamText`. The loop calls the model, executes available local tools, feeds results back, and stops on a non-tool
finish, missing executor, approval request, or stop condition. Its default stop condition is twenty steps.

Ember therefore does not need to instantiate an SDK `Agent` to obtain model calls, tool definitions, approvals, or
multi-step behavior.

**Recommendation: begin from functions, not `ToolLoopAgent`.** Introduce `ToolLoopAgent` only if a bounded cognition
executor benefits materially from its configuration/lifecycle callbacks.

## Mapping onto the current cognition boundary

### Keep `ProviderRequest` and `ProviderResult`

The existing Ember request/result DTOs already express the important semantic firewall:

```text
ProviderRequest
  cognitionId
  selected Projection
  current input
        |
        v
provider implementation
        |
        v
ProviderResult
  reply
  usedMeaningIds
  optional operational continuation evidence
```

An AI SDK-backed implementation should consume and produce those Ember-owned shapes. It must not make callers operate on
`ModelMessage`, `GenerateTextResult`, or provider metadata structures.

A plausible internal adapter flow is:

```text
ProviderRequest
  -> convert bounded Projection to model instructions/messages
  -> select AI SDK LanguageModelV4
  -> generateText({
       output: Output.object(ProviderResult-shaped schema),
       ...
     })
  -> inspect normalized + provider-specific evidence
  -> construct Ember ProviderResult
  -> validateProviderResult
```

`usedMeaningIds` remain an Ember requirement. AI SDK does not infer provenance or know which canonical meanings actually
contributed to an answer. The adapter should continue to ask the model for those IDs in a constrained structured result
and apply Ember validation afterward.

### The first direct-API backend would create an earned `ProviderInvoker` pressure

Issue #92 correctly retained today's function shape:

```text
(command, arguments, request, options) -> ProviderResult
```

because every proven production cognition backend was an external CLI process.

An AI SDK direct-API backend is different: `command` and process arguments have no natural meaning. That does **not**
justify changing the contract during research, but it would be concrete evidence for an issue #92 revisit trigger if
such a backend is adopted.

The likely future cleanup would be to keep request/result semantics unchanged while moving process launch configuration
into Codex/Cursor adapter construction:

```text
Cognition invocation seam
  (ProviderRequest, ProviderInvocationOptions) -> ProviderResult

Codex adapter closure
  owns command/arguments/auth/workspace/process lifecycle

Cursor adapter closure
  owns command/arguments/auth/workspace/process lifecycle

AI SDK adapter closure
  owns LanguageModel/provider configuration
```

That is an **earned adaptation to a new backend shape**, not a generic framework abstraction invented in advance.

## What generic plumbing AI SDK could remove

For a future **direct HTTP/API model provider**, AI SDK can plausibly remove or centralize:

- provider HTTP client construction;
- request serialization and provider wire-format differences;
- streaming protocol parsing;
- common retry/backoff mechanics for model calls;
- text/content/tool-call normalization;
- tool JSON-schema conversion and model-call validation;
- structured output request/validation mechanics;
- finish-reason normalization while preserving the raw provider reason;
- token-usage normalization;
- model/provider identification per step;
- provider warnings for unsupported settings;
- multi-step tool-loop repetition;
- deterministic language-model mocks;
- model-call lifecycle callbacks and performance observations;
- standard telemetry emission;
- much MCP-to-model-tool conversion plumbing.

That is a meaningful amount of generic code Ember should prefer not to reinvent.

### What it does not remove from current Codex/Cursor adapters

Issue #204 adds an important qualification: subscription-backed execution by itself is not evidence that Ember must own
a custom process adapter. `ai-sdk-provider-claude-code` now removes Claude's process/protocol and structured-output
plumbing through the official Agent SDK while preserving Ember's `ProviderInvoker` boundary.

That does not make the current Codex/Cursor subscription-backed external runtimes disappear. The current production
adapters still uniquely own:

- reuse of Codex/Cursor local subscription authentication;
- process spawning and environment allowlists;
- temporary isolated workspaces/configuration;
- CLI-specific argument grammar;
- bounded stdout/stderr handling;
- runtime-specific structured output/event parsing;
- direct-child termination observation and kill escalation;
- failure-time continuation evidence differences;
- uncertainty when process death does not prove remote work stopped;
- runtime-specific session/thread resumption rules.

One could write a custom AI SDK `LanguageModelV4` implementation around those CLIs, but that would mostly wrap Ember's
existing adapter mechanics in another interface. It would not by itself reduce complexity.

**Recommendation: use AI SDK first where it replaces real direct-provider plumbing, not as an aesthetic wrapper around
working CLI adapters.**

## Structured output

AI SDK 7's current structured-output direction is `generateText` / `streamText` with an `Output` specification.
`generateObject` and `streamObject` were deprecated in the AI SDK 6 line in favor of this unified surface.

Useful outputs include schema-validated object/array forms as well as JSON/text/choice forms. For Ember this is
attractive because the same call can provide:

- typed structured model output;
- validation against a Zod or JSON schema;
- tool calling in the same generation lifecycle;
- streaming where needed;
- normalized step/provider evidence.

The important boundary remains unchanged: **schema validity is not semantic validity**. A model may produce a
schema-valid `usedMeaningIds` list that references a meaning outside the supplied projection. `validateProviderResult`
must still reject that claim.

**Recommendation: strong direct primitive beneath the adapter. Do not expose AI SDK `Output` types in Ember domain
contracts.**

## Provider abstraction and neutrality

### What is genuinely portable

AI SDK's provider abstraction gives Ember a common language-model interface for major provider families, including
first-party packages for providers such as OpenAI, Anthropic, Google, Azure/OpenAI, Amazon Bedrock, xAI, Groq, DeepSeek,
and others, plus community and OpenAI-compatible providers.

The abstraction is useful because `generateText` and `streamText` can consume a model object without the caller becoming
provider-specific.

### The abstraction deliberately has escape hatches

Provider neutrality is not achieved by pretending providers are identical. AI SDK surfaces:

- provider/model identity per generation step;
- a normalized finish reason **and** raw provider finish reason;
- provider warnings;
- request and response metadata;
- provider-specific input through `providerOptions`;
- provider-specific output through `providerMetadata`;
- provider metadata on richer content/tool parts where applicable.

This is a major positive for Ember. It lets a provider adapter normalize only what Ember actually considers common while
retaining evidence needed for provider-specific behavior.

### Continuation example: OpenAI Responses

The current OpenAI provider exposes a response identifier in `finalStep.providerMetadata`. A later call can pass that
opaque value back as `providerOptions.openai.previousResponseId`.

For Ember:

```text
OpenAI responseId
  -> adapter-owned provider metadata
  -> optional Ember operational continuation evidence
  != Ember lineage
  != canonical memory
  != conversation identity
```

Other providers may expose different continuation/session/context capabilities. AI SDK does not make those semantics
equivalent merely because they are accessed through one model interface.

### Least-common-denominator risk still exists at Ember's boundary

AI SDK itself can preserve rich provider evidence, but Ember can still throw it away when mapping into `ProviderResult`.

The current `operational.externalThreadId` field is sufficient for the current Codex thread / Cursor session evidence
established by issue #92. Do **not** widen the contract speculatively. If an AI SDK provider later demonstrates
semantically necessary additional evidence, extend Ember's operational result deliberately with provider-neutral meaning
derived from that evidence.

Examples of potential future pressures include:

- distinct response versus conversation identifiers;
- provider warnings that change confidence in a normalized feature;
- server-side tool execution receipts;
- encrypted/provider-specific continuation context;
- provider-side caching or state handles.

The rule is: **retain provider-specific evidence at the adapter until Ember has explicitly decided what, if anything, it
means.**

## Provider routing and AI Gateway

AI SDK can use direct provider packages or Vercel AI Gateway/model identifiers. Gateway is convenient for centralized
access and routing, but it is a cloud service and therefore should not become an accidental requirement for Ember.

The core `ai` package currently includes `@ai-sdk/gateway` as a runtime dependency, but using AI SDK Core does not
require routing model calls through Vercel's hosted gateway. Direct provider packages remain available.

For Ember's local/self-hosted posture:

- prefer direct provider packages or a custom/OpenAI-compatible local endpoint where they meet requirements;
- treat Gateway as an optional deployment/provider choice;
- keep provider-selection and fallback policy visible to Ember when it changes evidence, cost, capability, or privacy
  expectations;
- never let a gateway request/session identifier become continuity.

## Tools: useful mechanics, dangerous semantics if collapsed

### AI SDK tool definition is a good model-facing representation

A tool can provide:

- a description;
- Zod or JSON input schema;
- optional strict calling where a provider supports it;
- optional local `execute` function;
- tool/runtime context;
- model-facing result conversion.

The `execute` function is optional. This matters because an Ember adapter can let the model propose a call without
granting the SDK direct effect ownership.

A future safe shape remains:

```text
Ember capability/authority selection
  -> model-visible AI SDK tool definitions
  -> model proposes tool call
  -> Ember-owned executor / approval / effect-attempt boundary
  -> evidence-bearing result
  -> translated AI SDK tool result for the next model step
```

### Capability is not authority

AI SDK answers mechanical questions:

- can the model see a tool schema?
- did its proposed input validate?
- should the local SDK executor run now?
- what result should be sent back to the model?

Ember still answers:

- may this episode request this capability?
- is the authority current?
- what context may cross the boundary?
- what effect attempt was recorded before execution?
- is retry safe after timeout/cancellation?
- what observation is strong enough to claim the effect happened or did not happen?

**Recommendation: never construct model tool availability directly from a global capability registry without an
Ember-owned permitted subset.**

## Tool approval and human-in-the-loop

AI SDK 7 provides `toolApproval` for local tools. Manual approval is intentionally a call boundary rather than hidden
process suspension:

1. the model proposes a tool call;
2. the generation returns a `tool-approval-request` content part;
3. the application persists/presents the request and obtains a decision;
4. the decision is added as a tool approval response;
5. the model call is invoked again;
6. approved local execution proceeds or denial is reported to the model.

That is mechanically compatible with Ember because Ember can persist its own pending approval occurrence instead of
trusting an in-memory suspended stack.

The semantic firewall is still mandatory:

```text
AI SDK approval request
  -> Ember approval request + authority/currentness checks
  -> Ember-owned durable decision/evidence
  -> translated AI SDK approval response
```

### Critical limit: provider-executed tools bypass local approval

Current AI SDK documentation explicitly notes that provider-executed tools run on the provider side without considering
`toolApproval`. The setting only governs tools the AI SDK executes locally.

This prevents a dangerous simplification:

```text
WRONG: toolApproval configured == all model-triggered effects require Ember approval
```

Provider-native web search, code execution, MCP, or other hosted tools may have provider-specific execution semantics.
Before exposing any consequential provider-executed tool, Ember must decide separately how authority, disclosure, effect
evidence, cancellation, and approval are enforced.

**Recommendation: local tool approval is a useful adapter primitive; never promote it to Ember's authority model.**

## Multi-step/tool-loop behavior

Both `generateText` and `streamText` can continue through multiple model/tool steps under explicit stop conditions.
`ToolLoopAgent` packages the same behavior with configuration, hooks, tools, output, runtime context, and a default
twenty-step cap.

This is a good fit for a **bounded cognition episode**:

```text
one Ember cognitionId
  -> one selected Projection
  -> bounded model/tool loop
  -> one validated ProviderResult + operational evidence
```

It is a poor fit for defining Ember herself:

```text
ToolLoopAgent instance
  != Ember identity
  != continuity
  != long-term runtime
  != canonical memory
  != specialist responsibility
```

### Cancellation remains semantically stronger than an abort signal

AI SDK accepts abort/timeout controls and passes abort signals into local execution paths. This helps stop cooperating
local work and model requests.

It cannot prove that a provider or external tool produced no side effect before the abort was observed. Ember's current
`timed_out`, `cancellation_requested`, and `outcome_unknown` distinctions remain necessary around consequential effects.

**Recommendation: map abort/timeout observations into existing Ember failure meaning; do not expose a single SDK
`AbortError` as proof of non-effect.**

## Streaming

`streamText` exposes incremental content including text, reasoning/provider content, tool calls/results, and lifecycle
completion. It is attractive for Telegram typing, future richer surfaces, long tool runs, and debugging.

The current Ember one-shot provider contract does not require token streaming. Therefore production integration should
not widen the contract merely because the SDK offers it.

If an earned surface requirement appears, add an Ember-owned progress/event seam:

```text
CognitionProgress
  started
  text_delta
  tool_proposed
  awaiting_approval
  tool_completed
  completed
  failed
  outcome_unknown
```

The adapter translates AI SDK stream parts into those events. UI/surface code should not consume AI SDK stream-part
unions directly.

## MCP

`@ai-sdk/mcp` is one of the strongest standalone primitives in the evaluation. Current AI SDK 7 support includes tools,
resources, and prompts; HTTP, SSE, stdio, and custom transports; OAuth hooks; legacy initialized sessions; and current
stateless MCP protocol operation.

### Good mechanical fit

The MCP client can:

- establish transport/authentication;
- discover tools;
- convert MCP tool schemas to AI SDK tools;
- expose MCP tool annotations/metadata;
- call tools;
- support resources/prompts where needed;
- retry selected transient transport failures when configured.

Ember still owns the semantic shell:

```text
McpCapabilitySource
  discover(...) -> Ember capability descriptors
  invoke(...) -> transport/effect evidence
```

### The client is intentionally lightweight

Current first-party documentation explicitly says the AI SDK MCP client does not supply all full-client behavior,
including automatic session persistence, resumable streams, and notifications.

That is not a defect for Ember. It reinforces the correct ownership boundary: if a legacy MCP session identifier must
survive a process restart, Ember/runtime code must persist and interpret it as operational transport state rather than
continuity.

Current stateless MCP `2026-07-28` operation further reduces pressure to treat an MCP session as identity.

### MCP annotations are hints, not authority

The client exposes annotations such as `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint`, but the
documentation correctly treats them as untrusted server-provided hints rather than approval policy.

That matches Ember's architecture closely. An adapter may use annotations as evidence for a conservative default, but
explicit capability policy, scoped credentials, and authority remain Ember-owned.

### Retry semantics match Ember's caution

MCP transient retries are opt-in and disabled by default. First-party guidance warns against retrying non-idempotent
tools because effects may duplicate.

Ember should go further: even an apparently idempotent tool may need an effect-attempt identifier or reconciliation when
a timeout leaves completion uncertain.

**Recommendation: strong candidate behind an Ember MCP/capability transport seam.**

## Middleware

`wrapLanguageModel` and `LanguageModelV4Middleware` can transform call parameters and wrap generation/stream behavior.
This is attractive for genuinely mechanical cross-cutting concerns such as:

- logging and metrics;
- caching;
- provider compatibility transforms;
- default model settings;
- request tagging;
- test instrumentation.

Do not hide semantic ownership in middleware. In particular, avoid making middleware the only place that decides:

- least-sufficient context selection;
- authority/tool exposure;
- currentness;
- provenance requirements;
- canonical memory retrieval;
- provider fallback when the fallback itself matters to evidence.

Those decisions should remain explicit at Ember boundaries where tests and reviewers can see them.

**Recommendation: useful implementation mechanism inside provider adapters, not an Ember architecture layer.**

## Memory and persistence: absence is a feature here

AI SDK's core model/tool APIs do not impose one persistence store or canonical memory model. The current agent-memory
documentation instead presents memory as composition: provider-defined tools, external memory providers, or custom
tools/storage.

For Ember this is positive because AI SDK does not require:

```text
AI SDK messages == Ember memory
AI SDK agent == Ember continuity
memory provider user/session == Ember identity
```

It also means AI SDK Core is **not** a durable execution system. Message history, approval requests, continuation
handles, and process-restart recovery remain caller responsibilities unless another storage/workflow layer is added.

Memory integrations such as provider-defined memory tools, Letta, Mem0, or other third-party memory providers may be
interesting retrieval infrastructure later, but they must be evaluated against Ember
provenance/currentness/context-selection semantics independently. They are not made semantically safe merely by being AI
SDK providers/tools.

`@ai-sdk/workflow` exists as a separate package in the current ecosystem. It should not be imported into this decision
by gravity. Durable execution is already a separate capability seam explored in issue #177, where LangGraph's mechanics
can be compared directly with any future AI SDK workflow requirement.

## Telemetry and observability

AI SDK 7 has a stable telemetry integration surface. `registerTelemetry` can install OpenTelemetry-backed or other
integrations globally, and per-call telemetry can add function identity or control recording.

This is attractive for Ember because tracing can remain optional and non-canonical.

### Privacy caveat

Once a telemetry integration is registered, current defaults emit telemetry for AI SDK calls and record inputs/outputs
unless configured otherwise. `runtimeContext` and tool context have explicit inclusion controls, but prompt/result
recording deserves an Ember-specific privacy posture.

For Ember the safe baseline is:

- telemetry optional;
- canonical cognition/delegation/effect IDs attached as trace attributes;
- disable or carefully scope prompt/output recording by default for sensitive data;
- never require hosted Vercel observability;
- never treat trace storage as canonical evidence;
- keep provider/runtime secrets out of telemetry contexts.

**Recommendation: strong optional observability candidate, with explicit privacy configuration rather than defaults
inherited blindly.**

## Testing and debugging

AI SDK Core includes deterministic V4 model mocks under `ai/test` and a stream simulation helper. This is one of the
least controversial primitives in the research.

A future AI SDK adapter can be tested without network calls:

```text
MockLanguageModelV4
  -> deterministic model content/tool calls/finish/usage
  -> AI SDK adapter
  -> exact Ember ProviderResult / failure expectations
```

This allows Ember to test:

- structured `ProviderResult` generation;
- invalid/out-of-projection `usedMeaningIds` rejection;
- provider warnings and finish mapping;
- tool-call proposals;
- approval boundaries;
- multiple steps;
- streaming translation;
- abort behavior;
- provider-metadata extraction through controlled custom models where necessary.

Keep repository-owned acceptance scenarios above those mocks. AI SDK mocks validate adapter mechanics; they do not
replace Ember's semantic oracle.

Operational debugging is also strong because `GenerateTextResult` / step results keep content, tool calls/results,
model/provider identity, usage, performance, warnings, request/response metadata, raw and normalized finish reasons, and
provider metadata. Translate and retain only the subset Ember needs as durable operational evidence.

## Replaceability and type containment

AI SDK is replaceable only if its very convenient types do not escape.

### Types that should stay adapter-local

Do not expose these across Ember-owned domain seams:

- `LanguageModelV4` and provider objects;
- `ModelMessage` / AI SDK response messages;
- `GenerateTextResult`, `StreamTextResult`, `StepResult`;
- `Tool`, `ToolSet`, AI SDK tool calls/results;
- `ToolLoopAgent`;
- `Output`;
- provider option/metadata types;
- MCP client/tool types;
- telemetry integration types.

### Ember-owned seams worth preserving

The narrow seams are capability-shaped:

```text
ProviderRequest / ProviderResult
  semantic cognition input/output

Provider invocation implementation
  AI SDK OR Codex CLI OR Cursor CLI OR future direct/custom backend

EmberToolCatalog
  permitted model-visible capabilities

EmberToolExecutor
  authority/effect-aware execution and evidence

McpCapabilitySource
  optional transport implementation

CognitionProgressSink
  only if streaming becomes an earned caller requirement
```

Structured output, middleware, provider registry, mocks, and telemetry generally do **not** need their own Ember
interfaces. They can remain implementation details below those seams.

### Replacement scenario

If AI SDK is later removed:

- `src/core/` types do not change;
- canonical Ember state requires no migration;
- `ProviderRequest` / `ProviderResult` semantics do not change;
- direct-provider adapters are reimplemented with another SDK/direct API;
- tool execution/authority contracts remain unchanged;
- MCP transport can move to the official MCP SDK or another client;
- telemetry can move to direct OpenTelemetry;
- no persisted AI SDK message/thread state must be decoded to reconstruct Ember.

That is a much cleaner replacement story than a framework whose thread, agent, or workflow state becomes canonical
application meaning.

## Lock-in surfaces

| Surface                            | Risk                              | Containment                                                                     |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| AI SDK result/message types        | **medium/high** if propagated     | Convert at adapter boundary                                                     |
| Tool definitions/calls/results     | **medium**                        | Generate from Ember capability descriptors; execute through Ember-owned wrapper |
| `ToolLoopAgent` lifecycle          | **medium**                        | Keep bounded and adapter-local; prefer core functions first                     |
| Provider options/metadata          | **medium** but necessary          | Provider-specific adapter code maps evidence to Ember meaning                   |
| Model/provider spec major versions | **medium**                        | Exact version pinning, adapter contract tests                                   |
| AI Gateway model strings/service   | **medium/high** if made mandatory | Keep gateway optional; support direct providers                                 |
| MCP client/session IDs             | **low/medium**                    | Treat as operational transport state only                                       |
| Telemetry event schema             | **low**                           | Optional translation/exporter boundary                                          |
| AI SDK memory providers            | **high** if canonicalized         | Do not make them Ember memory                                                   |
| Persisted AI SDK state             | **low for Core**                  | Core does not require canonical SDK persistence                                 |

## API maturity and versioning

AI SDK is mature, widely integrated, TypeScript-first, and has a large provider surface. Its low-level model/tool APIs
are production-oriented and the repository has substantial tests, migration guides, mocks, and provider conformance
machinery.

The counterweight is velocity. The current ecosystem is already on AI SDK 7, using Language Model V4, after major
provider-spec changes in earlier lines. The repository publishes frequent independent provider/package releases.

For Ember:

- pin exact `ai` and provider package versions;
- keep all AI SDK imports inside adapter/runtime modules;
- compile against Ember's actual TypeScript 7 config;
- add contract tests around provider-result translation;
- upgrade intentionally with migration-guide review rather than floating broad major ranges.

The fast cadence is manageable precisely because the proposed seam is narrow.

## Operational fit

### Node 26 / TypeScript

`ai@7.0.93` declares Node `>=22`, so Node 26 is supported by the package engine range. The package ships ESM and
TypeScript declarations.

AI SDK currently develops against TypeScript 5.8.3. Ember's TypeScript 7 baseline is newer, so compile the real adapter
and provider package under Ember's config before adoption. Do not infer compatibility solely from declarations.

### Dependency footprint

The core `ai` package currently has three direct runtime dependencies and a Zod peer. Provider support is split into
separate packages. That lets Ember install only the provider families it actually uses, although `@ai-sdk/gateway`
remains a direct core dependency even when not used as the network route.

`@ai-sdk/mcp` is also separate and currently adds provider/provider-utils plus `cross-spawn`, `pkce-challenge`, and a
Zod peer.

No measured transitive install size or RSS is claimed. Record actual `npm` install size and process measurements before
production adoption.

### Raspberry Pi / self-hosting

For Raspberry Pi-class use the core shape is favorable:

- ordinary local Node library;
- no required daemon/control plane;
- no required database;
- no required Vercel deployment;
- direct HTTP provider packages are available;
- MCP stdio can launch local servers where useful;
- no reviewed core package metadata requires a native addon.

The dominant steady-state cost is likely the Ember Node process and network/provider work rather than an additional
framework service, but that remains a hypothesis until measured on the Pi.

A practical spike should record:

- `npm` install/disk delta for `ai` + one provider + optional MCP;
- cold import/start latency;
- idle RSS after import;
- RSS during one `generateText` and one streamed call using a mock/local endpoint;
- TypeScript 7 compile result;
- Node 26 execution;
- shutdown behavior with an in-flight model call/MCP client.

### Cloud coupling

Vercel AI Gateway and hosted observability integrations are optional operational choices. Direct provider packages and
custom providers allow self-hosted/local Node execution without making Vercel Cloud the runtime owner.

That optionality should remain an explicit Ember requirement if AI SDK is adopted.

## Focused adoption spike

Documentation is sufficient for the architectural recommendation. A small spike is still worthwhile before any
production dependency is added.

### A. Existing provider semantics through AI SDK

Implement a throwaway in-memory adapter using `MockLanguageModelV4`:

1. accept the current `ProviderRequest`;
2. serialize only its selected projection and current input;
3. call `generateText` with an `Output.object` schema for reply + `usedMeaningIds`;
4. convert the result back to `ProviderResult`;
5. run `validateProviderResult`;
6. prove an out-of-projection meaning is still rejected;
7. prove no AI SDK type appears in the adapter's public contract.

### B. Provider-specific evidence

Use one direct provider package or a controlled custom provider:

1. capture normalized provider/model/finish information;
2. capture raw finish reason/warnings/provider metadata;
3. map only semantically relevant continuation evidence to Ember-owned operational data;
4. prove provider metadata remains adapter-local;
5. verify fallback/provider changes are observable when they matter.

### C. Tool firewall

Use a deterministic mock model that proposes one effectful tool:

1. model sees an Ember-permitted tool definition;
2. tool call does **not** execute directly against an external effect;
3. Ember authority/approval wrapper records an attempt;
4. approved execution returns evidence;
5. denial returns a model-visible denial without claiming an effect;
6. abort after effect start preserves uncertainty.

Also include a provider-executed-tool test or explicit negative fixture proving that `toolApproval` cannot be treated as
a universal gate.

### D. Compiler/Pi gate

On the real deployment target:

- install exact pinned packages;
- compile under TypeScript 7.0.2;
- execute on Node 26;
- record install size, cold start, and RSS;
- exercise local MCP stdio/HTTP if MCP is part of the candidate adoption.

## Recommendations for #175 synthesis

- **AI SDK as Ember architecture:** avoid.
- **`generateText`:** strong candidate, wrap beneath Ember cognition.
- **`streamText`:** strong candidate when streaming is earned; translate events.
- **`Output.object` / structured output:** strong direct primitive beneath adapters.
- **Provider V4 abstraction and first-party provider packages:** strong candidate.
- **`providerOptions` / `providerMetadata`:** essential escape hatches; contain in provider-specific adapter code.
- **AI Gateway:** optional provider/routing choice, never required runtime ownership.
- **Language-model middleware:** useful selectively; avoid hiding semantic policy.
- **Tool definitions:** strong candidate beneath Ember capability/authority wrappers.
- **`ToolLoopAgent`:** useful for bounded cognition, avoid as Ember identity/runtime.
- **`toolApproval`:** useful local execution mechanic, not Ember authority.
- **Provider-executed tools:** provider-specific risk; require explicit policy/evidence.
- **MCP client/tool conversion:** strong candidate behind an Ember transport seam.
- **Telemetry:** strong optional candidate with privacy-safe defaults.
- **`ai/test` mocks:** adopt alongside any AI SDK integration.
- **AI SDK memory providers/tools as Ember memory:** avoid.
- **AI SDK Core for durable execution:** not its job; keep separate capability seam.
- **Current Codex/Cursor CLI adapters:** keep until a direct API/runtime alternative demonstrably preserves their
  authentication and lifecycle requirements.

## Answer to the key question

**Yes. Vercel AI SDK can replace a substantial amount of generic model/provider, structured-output, streaming,
tool-loop, MCP, testing, and observability plumbing while leaving Ember's cognition semantics independently owned. Among
the candidates reviewed so far, its low-level Core API applies relatively little architectural pressure.**

The safe boundary is:

```text
Ember semantics
  ProviderRequest / selected Projection
  authority / provenance / currentness / effect truth
          |
          v
AI SDK adapter
  generateText / streamText
  Output / tools / provider packages / MCP / middleware
          |
          v
provider or local capability transport
          |
          v
AI SDK normalized + provider-specific evidence
          |
          v
Ember adapter validation
  ProviderResult / operational evidence
```

If replacing AI SDK later changes only provider/tool/MCP adapter implementations, the boundary is healthy.

If Ember core begins storing AI SDK messages, treating `ToolLoopAgent` as identity, using provider response IDs as
continuity, trusting `toolApproval` as authority, or requiring AI SDK metadata to reconstruct canonical truth, the
boundary has failed.

## Sources

First-party/current material used for this evaluation:

- [Vercel AI SDK repository](https://github.com/vercel/ai) and
  [`ai` package metadata](https://github.com/vercel/ai/blob/main/packages/ai/package.json) for version, Node engine,
  dependencies, TypeScript toolchain, and package shape.
- [AI SDK Core overview](https://ai-sdk.dev/docs/ai-sdk-core/overview) for the `generateText` / `streamText` low-level
  model-call surface.
- [Structured data generation](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) and
  [`Output`](https://ai-sdk.dev/docs/reference/ai-sdk-core/output) for current structured-output APIs.
- [AI SDK 6 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) for `generateObject` /
  `streamObject` deprecation in favor of `Output` on text APIs.
- [Tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) for tool schemas, local execution, stop
  conditions, strict calling, approval, and provider-executed-tool caveats.
- [`ToolLoopAgent` source](https://github.com/vercel/ai/blob/main/packages/ai/src/agent/tool-loop-agent.ts) for current
  loop/stop behavior and its implementation over core generation calls.
- [`GenerateTextResult`](https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/generate-text-result.ts)
  and [`StepResult`](https://github.com/vercel/ai/blob/main/packages/ai/src/generate-text/step-result.ts) for normalized
  results, raw finish reason, warnings, model identity, request/response data, steps, and provider metadata.
- [OpenAI previous response ID example](https://github.com/vercel/ai/blob/main/examples/ai-functions/src/generate-text/openai/responses-previous-response-id.ts)
  for provider-specific continuation through metadata/options.
- [Language model middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware) for `wrapLanguageModel` and
  provider-independent call wrapping.
- [AI SDK MCP](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) and
  [`@ai-sdk/mcp` metadata](https://github.com/vercel/ai/blob/main/packages/mcp/package.json) for transport, tool
  conversion, sessions, retry, annotation, dependency, and Node requirements.
- [Testing](https://ai-sdk.dev/docs/ai-sdk-core/testing) for `MockLanguageModelV4`, mock helpers, and deterministic
  stream simulation.
- [Telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry) for the stable telemetry integration surface, OpenTelemetry
  adapter, recording defaults, and context filtering.
- [Agent memory](https://ai-sdk.dev/docs/agents/memory) for the current composition model of provider-defined tools,
  memory providers, and custom tools rather than a required core persistence model.
- [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0) for the current
  provider-spec/API generation and upgrade surface.

AI SDK changes quickly. Production integration should pin exact versions and rerun adapter contract/compatibility tests
rather than treating this 2026-09-07 snapshot as a permanent API guarantee.

## Issue #178 definition-of-done mapping

- **Primitive inventory:** provider/model calls, structured output, streaming, tools, loops, approval, middleware, MCP,
  telemetry, testing, memory/persistence boundaries, and optional workflow overlap are classified above.
- **Generic plumbing removal:** direct-provider HTTP/stream/schema/tool/retry/result, MCP, testing, and telemetry
  mechanics are identified explicitly, alongside current CLI mechanics AI SDK does not remove.
- **Provider-specific evidence:** `providerOptions`, `providerMetadata`, raw finish reason, warnings, model identity,
  and OpenAI continuation demonstrate a non-least-common-denominator escape hatch; provider-executed tools are called
  out as a separate risk.
- **SDK type containment:** AI SDK types are explicitly adapter-local and Ember-owned request/result/tool/MCP/progress
  seams are identified.
- **Replaceability:** removal scenario and lock-in table show how AI SDK can be replaced without canonical-state
  migration or unrelated-layer rewrites.
- **Operational fit:** Node 26, TypeScript 7 gate, dependencies, optional cloud coupling, MCP package cost, Pi
  hypotheses, and measurement gates are recorded.
- **Suitable for #175:** recommendations use the common adopt/wrap/avoid/revisit framing and distinguish low-level
  mechanics from top-level agent semantics.
