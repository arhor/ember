---
summary: "Issue #179 evaluation of OpenAI Agents SDK JS/TS as a replaceable bounded agent-loop, tool, approval, session, MCP, tracing, and testing toolkit beneath Ember-owned semantics."
read_when:
  - "Considering OpenAI Agents SDK JS/TS for bounded cognition loops, tools, approvals, sessions, MCP, tracing, retries, or testing in Ember"
  - "Comparing lightweight agent runtimes beneath Ember-owned identity, continuity, memory, authority, and delegation semantics"
  - "Reviewing OpenAI Agents SDK type leakage, persisted RunState/session lock-in, provider neutrality, or replaceability"
role: design
discovery_status: current
---

# OpenAI Agents SDK JS/TS Execution Toolkit Evaluation

## Decision

**OpenAI Agents SDK JS/TS is a credible candidate for a bounded cognition-and-tool
execution engine beneath Ember-owned semantics, but it should not become Ember's
identity, continuity, memory, delegation, authority, or durable-runtime model. Prefer
its `Runner` only as an operational loop, its `Model`/`ModelProvider` boundary as an
adapter-local execution detail, function-tool execution and retry mechanics as
implementation machinery, custom tracing processors as observability plumbing, and
its scripted model as a deterministic test substrate. Treat `Agent`, `Session`,
`RunState`, handoffs, and approval records as SDK-local operational types.**

The SDK is more modular than a conventional agent framework. The public package is
split into `@openai/agents-core`, `@openai/agents-openai`,
`@openai/agents-realtime`, and optional extensions; the docs explicitly support
lower-level composition. A custom `ModelProvider` can replace OpenAI model resolution,
and an official extension adapts Vercel AI SDK models into the Agents runtime.
Tracing processors can replace the default OpenAI exporter. Session persistence can
be supplied by a custom `Session` implementation.

That modularity is useful, but the semantic center of gravity is still an SDK
`Agent` executed by a `Runner` over SDK conversation items. Handoffs change the
active SDK agent. Sessions persist SDK conversation history. Human approval resumes
serialized `RunState`. Those are valuable mechanics, but they overlap directly with
concepts for which Ember already has stricter meanings.

The recommended posture is:

1. **Keep Ember's current semantic contracts canonical.** `ProviderRequest`,
   `ProviderResult`, projection/provenance, currentness, authority, specialist
   responsibility, effect uncertainty, canonical memory, and continuity remain
   Ember-owned.
2. **Use `Runner` only for bounded operational episodes.** An SDK agent may implement
   one cognition/tool episode without becoming the identity-bearing Ember agent.
3. **Prefer agents-as-tools over handoffs if testing specialist mechanics.** A manager
   retains control in that pattern, which maps more naturally to Ember responsibility,
   but the nested result still requires an Ember-owned specialist report and
   reintegration gate.
4. **Keep sessions operational and disposable.** A `Session` stores conversation
   history. It is not durable Ember memory, identity, or continuity. Any persisted
   session must be rebuildable from Ember-owned state or safely discarded.
5. **Treat approval and guardrail features as execution checks, not authority.** They
   can enforce or pause a local tool call, but they do not define whether Ember is
   permitted to act.
6. **Preserve raw provider evidence before normalization.** `providerData`, request and
   response IDs, raw usage, retry advice, and raw run items are useful evidence and
   should be translated deliberately into Ember-owned observations where needed.
7. **Do not adopt the SDK merely for direct model invocation.** Vercel AI SDK is a
   lower-pressure fit for generic direct-provider calls. OpenAI Agents SDK becomes
   interesting when Ember actually needs a bounded multi-step loop, resumable
   approvals, tool orchestration, or its retry/test machinery.
8. **Do not persist SDK types as canonical records.** Serialized `RunState` and
   `AgentInputItem[]` may be kept only as versioned opaque operational checkpoints
   with explicit migration/discard rules.

In short: **the SDK is a good temporary brainstem for a bounded run, not Ember's
self-model.**

## Evaluation baseline

This evaluation was performed on **2026-09-07** against:

- Ember's [Design Principles](../principles.md), accepted ADRs, and
  [Architecture Acceptance Scenarios](acceptance-scenarios.md);
- the current cognition seam in `src/providers/contract.ts` and the
  [Cognition Adapter Contract Decision](cognition-adapter-contract-decision.md);
- the current specialist contract in `src/delegation/codex-specialist.ts`, the
  [Minimal Codex Specialist-Delegation Boundary](minimal-codex-specialist-delegation.md),
  and [Specialist Result Reintegration](specialist-result-reintegration.md);
- the issue #176 Mastra, #177 LangGraph.js, and #178 Vercel AI SDK evaluations;
- OpenAI Agents SDK repository `main`, where `@openai/agents`,
  `@openai/agents-core`, and `@openai/agents-openai` identify as **0.17.0**;
- the current official JavaScript/TypeScript documentation linked in
  [Sources](#sources).

The published convenience package currently depends on `@openai/agents-core`,
`@openai/agents-openai`, `@openai/agents-realtime`, `debug`, and `openai`, with Zod 4
as a peer dependency. `@openai/agents-core` itself depends on `openai`, `debug`, and
`@standard-schema/spec`, with MCP client support optional. Therefore lower-level
composition reduces feature surface, but it does **not** currently make the dependency
graph completely OpenAI-free.

The repository currently builds with TypeScript 5.9.3 and tests Node 22 and 24.3.x.
No `engines` field is declared in the reviewed `@openai/agents` package metadata.
Ember's Node 26 / TypeScript 7 baseline is therefore plausible but not explicitly
certified by upstream package metadata. A compile-and-smoke spike on Ember's actual
baseline remains an adoption gate.

No install-size, cold-start, or Raspberry Pi RSS benchmark is claimed here. The
reviewed core package metadata does not introduce an obvious mandatory native
runtime dependency. Target-host measurement remains the correct gate before adding
the SDK to the unattended Pi deployment.

## Classification scale

| Class              | Meaning                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **1 - direct**     | The primitive can sit below an Ember-owned interface with little semantic translation.                         |
| **2 - firewall**   | The primitive is useful, but an adapter must prevent SDK concepts or state from becoming Ember semantics.      |
| **3 - coupled**    | The primitive strongly overlaps an Ember-owned semantic concept or pulls control/state into the SDK worldview. |
| **4 - irrelevant** | The primitive does not currently solve an earned Ember requirement.                                            |

## Primitive inventory

| OpenAI Agents SDK primitive         | Current surface                                                             |                  Class | Ember fit                                                                                                     | Recommendation                                        |
| ----------------------------------- | --------------------------------------------------------------------------- | ---------------------: | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Agent loop                          | `Runner.run()`, `run()`, `maxTurns`, run hooks                              |                  **2** | Strong bounded cognition/tool mechanics if `Agent` remains ephemeral and operational                          | **Wrap / revisit when a bounded loop is needed**      |
| Model abstraction                   | `Model`, `ModelProvider`, `ModelSettings`                                   |                  **2** | Lightweight model seam with custom providers and provider-specific escape hatches                             | **Use only inside an execution adapter**              |
| AI SDK model bridge                 | `@openai/agents-extensions/ai-sdk`                                          |                **1/2** | Lets the Agents loop reuse Vercel AI SDK's broader provider ecosystem                                         | **Strong composability signal**                       |
| Function tools                      | `tool()`, `invokeFunctionTool`, Standard Schema/Zod/JSON Schema             |                  **2** | Good schema validation, timeouts, cancellation signal, execution plumbing                                     | **Wrap behind Ember capability/authority checks**     |
| Tool-loop behavior                  | automatic execute/result/model repetition                                   |                  **2** | Useful inside one bounded cognition episode                                                                   | **Use boundedly**                                     |
| Agents as tools                     | `agent.asTool()`                                                            |                **2/3** | Manager retains control, closer to specialist mechanics than handoff                                          | **Spike only behind specialist-report firewall**      |
| Handoffs                            | `handoff()`, active-agent switch, input filters                             |   **3** for delegation | Transfers active SDK control and conversation context; too easy to collapse Ember responsibility into routing | **Avoid as Ember delegation semantics**               |
| Sessions                            | `Session`, `MemorySession`, `OpenAIConversationsSession`, custom stores     |                **2/3** | Useful operational history cache, but stores SDK `AgentInputItem[]`                                           | **Keep disposable and non-canonical**                 |
| Server-managed continuation         | `conversationId`, `previousResponseId`                                      |    **3** as continuity | OpenAI-specific continuation handles, useful only as provider/runtime evidence                                | **Adapter-local only**                                |
| Resumable state                     | `RunState`, serialization, interruptions                                    |                **2/3** | Useful approval checkpoint mechanics, but serialized SDK runtime state creates migration pressure             | **Opaque operational checkpoint only**                |
| Human approval                      | `needsApproval`, `interruptions`, approve/reject, hosted MCP approval       |                  **2** | Good execution pause/resume mechanism                                                                         | **Wrap behind Ember authority/currentness checks**    |
| Input/output guardrails             | agent guardrails                                                            |                **2/3** | Useful validation, but not a universal authorization boundary                                                 | **Use selectively**                                   |
| Function-tool guardrails            | input/output tool guardrails                                                |                  **2** | Useful local execution checks                                                                                 | **Wrap, never equate with authority**                 |
| MCP                                 | local/remote MCP servers, hosted MCP tool, filters, approvals               |                  **2** | Mature tool acquisition/transport mechanics                                                                   | **Strong candidate behind Ember MCP/capability seam** |
| Structured output                   | `outputType` with Zod, Standard Schema, or JSON Schema                      |                  **2** | Useful final-output validation inside the agent loop                                                          | **Use inside adapter, revalidate semantically**       |
| Streaming                           | streamed run result, event stream, cancellation/resume                      |                  **2** | Useful interaction mechanics with explicit completion/cancellation state                                      | **Wrap when a surface needs streaming**               |
| Model retries                       | `modelSettings.retry`, retry policies, replay safety                        |                **1/2** | Strong explicit failure/replay mechanics aligned with Ember effect truth                                      | **Strong candidate within an SDK-backed runner**      |
| Tool timeout/cancellation           | `timeoutMs`, `details.signal`, run `AbortSignal`                            |                  **2** | Useful cancellation mechanics, but cannot prove external effects stopped                                      | **Use with Ember effect-uncertainty tracking**        |
| Results/evidence                    | `newItems`, `rawResponses`, `providerData`, request/response IDs, raw usage |                  **2** | Rich evidence surface avoids least-common-denominator normalization                                           | **Translate deliberately into Ember observations**    |
| Tracing                             | traces/spans, custom processors/exporters                                   |                  **2** | Good observability if Ember IDs/privacy policy remain primary                                                 | **Wrap / optional**                                   |
| Default OpenAI trace export         | server-runtime default exporter                                             | **3** for self-hosting | Creates implicit OpenAI service coupling and data-flow concerns                                               | **Disable or replace for self-hosted default**        |
| Deterministic testing               | `ScriptedModel`, model response/error/stream helpers                        |                  **1** | Excellent deterministic loop, retry, error, and streaming tests                                               | **Adopt with any Agents SDK adapter**                 |
| Sandbox/realtime/hosted multi-agent | separate optional surfaces                                                  |              **4** now | Powerful but outside #179's earned Ember need; hosted multi-agent adds stronger service ownership             | **Ignore / revisit separately**                       |

## The runner can be an execution mechanism without becoming Ember

The current runner lifecycle is conceptually small:

```text
starting SDK Agent + bounded input
  -> model call
  -> final output: stop
  -> function tool calls: execute, append results, repeat
  -> handoff: change active SDK Agent, repeat
  -> maxTurns / failure / approval interruption / cancellation
```

Nothing in that loop requires the SDK `Agent` object to represent the durable person
that Ember is. Ember can construct or configure an SDK agent for one execution
opportunity, supply only the current projection and capabilities, consume the result,
and discard the SDK object afterward.

A plausible future shape is:

```text
Ember ProviderRequest / bounded cognition opportunity
  -> Ember projection + authority decisions
  -> adapter constructs ephemeral SDK Agent
  -> Runner executes bounded model/tool loop
  -> adapter extracts final output + provider/run evidence
  -> Ember ProviderResult / observations
  -> Ember validation and canonical decisions
```

This is semantically acceptable if the SDK agent is treated like a process-local
execution plan, comparable to a provider client or workflow instance. It becomes
unsafe if code starts using `Agent.name`, `lastAgent`, session ownership, or handoff
state as evidence of Ember identity or responsibility.

### Do not replace the current cognition contract merely to fit the SDK

`ProviderRequest` and `ProviderResult` already express the important semantic
boundary: Ember chooses a bounded projection and later validates claimed provenance.
An Agents SDK-backed implementation should consume and produce Ember-owned shapes.
Callers should not receive `RunResult`, `AgentInputItem`, `ModelResponse`, or
`RunState`.

The direct-provider pressure identified in the Vercel AI SDK evaluation was
resolved by #186/#188: `ProviderInvoker` is now semantic-only, while Codex, Cursor,
and deterministic process launch configuration is closed over by concrete adapters.
An Agents SDK-backed direct API implementation should therefore implement the same
`(request, options) -> result` shape without changing request/result semantics.

## Models and provider neutrality

### The abstraction is genuinely extensible

The SDK exposes two deliberately small interfaces:

- `Model` performs one model request and one streamed model request, with optional
  retry advice;
- `ModelProvider` resolves a model name into a `Model` instance.

A `Runner` accepts a custom `modelProvider`, and applications can also replace the
global default provider. This means the agent loop itself does not require an OpenAI
model implementation.

The official AI SDK extension is especially relevant to issue #175. It adapts Vercel
AI SDK language models into the Agents runtime, so Ember could theoretically compose:

```text
Vercel AI SDK provider ecosystem
  -> official Agents SDK AI SDK adapter
  -> OpenAI Agents SDK bounded Runner/tool loop
  -> Ember-owned cognition/delegation/authority semantics
```

This is stronger evidence for composability than merely documenting a custom-provider
interface.

### Provider neutrality is not service neutrality by default

There are still important OpenAI defaults and dependencies:

- `@openai/agents` includes the OpenAI provider package and Realtime package;
- `@openai/agents-core` currently still depends on the `openai` package;
- default model resolution is OpenAI-oriented;
- `conversationId` and `previousResponseId` are OpenAI Responses-specific;
- hosted OpenAI tools and hosted multi-agent are explicitly service-specific;
- tracing exports to OpenAI by default in supported server runtimes unless disabled
  or processors are replaced.

Therefore Ember should describe the SDK as **provider-extensible with OpenAI-first
defaults**, not as provider-neutral in the stronger dependency/service sense.

### Preserve provider-specific evidence

`ModelResponse` carries normalized output and usage plus:

- `providerData` with raw provider response data;
- `requestId`;
- `responseId` when supported;
- optional preserved `rawUsage` when requested.

Model settings also expose provider-specific passthrough data. The protocol includes
an `unknown` item form specifically so providers can preserve unrecognized payloads
without breaking the normalized protocol.

This is a positive fit for Ember's provenance and uncertainty requirements. An
adapter should normalize only facts Ember genuinely needs while retaining enough raw
evidence to explain provider-specific failures, continuation, or effects.

**Important caveat:** `rawUsage` is runtime-only and intentionally omitted from
serialized `RunState`. If Ember needs provider-specific usage or other runtime-only
fields as durable evidence, copy them into an Ember-owned observation before
persisting/resuming the SDK state.

## Function tools: useful mechanics, not authority

Function tools are one of the most reusable surfaces in the SDK. A tool can provide:

- Zod, Standard Schema, or raw JSON Schema parameters;
- local argument validation;
- strict or non-strict model schemas;
- a local `execute` function;
- per-call timeout;
- timeout behavior and formatting;
- run-aware enablement;
- approval requirements;
- input/output guardrails;
- application-only `customData` on tool output;
- an `AbortSignal` through execution details;
- direct invocation through `invokeFunctionTool` with the same timeout behavior.

This can remove repetitive model-facing tool plumbing.

The semantic boundary must be:

```text
Ember capability visibility decision
  -> SDK-visible FunctionTool schema
  -> model proposes arguments
  -> Ember resource/argument authority check
  -> optional Ember approval decision
  -> SDK executes tool with timeout/signal
  -> Ember records effect evidence
  -> model receives bounded result
```

`isEnabled` is not authorization. The SDK documentation explicitly notes that it runs
before model-generated arguments exist, so argument/resource-level authorization must
happen inside execution or a guardrail/approval path.

Likewise, cancellation of a tool is not proof that its side effects were undone or
that remote work stopped. Tool execution may observe an abort signal, but Ember must
continue to represent `effects_possible` when the boundary cannot establish what
already happened.

### Hosted tools need a stronger firewall

OpenAI-hosted tools execute outside Ember's local tool executor. Their provider-side
lifecycle and evidence differ from a local function tool. They should not be exposed
under a generic Ember capability merely because the SDK presents them in one tools
array.

If a hosted tool is ever adopted, its adapter must state:

- where execution occurs;
- which approval path actually applies;
- what provider evidence is available;
- whether cancellation confirms termination;
- what retry/replay behavior can duplicate effects.

## Agents as tools versus handoffs

### Agents as tools are the better experimental fit

`agent.asTool()` lets one SDK agent call another while the manager retains control of
the overall conversation and final answer. The nested agent executes through its own
runner and can itself raise approval interruptions that surface on the outer run.

That shape resembles Ember delegation more closely than handoff because the caller
remains responsible for integration.

It is still **not** sufficient as Ember delegation semantics. A nested agent result
does not automatically carry Ember's required:

- purpose and acceptance contract;
- least-sufficient context disclosure;
- authority envelope and provenance;
- currentness basis;
- known versus possible effects;
- cancellation truth;
- expansion requests;
- specialist report provenance;
- reintegration disposition.

A safe spike would make the nested agent return an Ember-owned specialist report
shape and pass it through the existing reintegration boundary rather than interpreting
`RunResult.finalOutput` as accepted delegated truth.

### Handoffs are semantically more dangerous

A handoff changes the active SDK agent and, by default, passes the accumulated
conversation history to the new agent. The SDK describes this as delegation of the
conversation to a specialist.

That is useful product-level orchestration, but it conflicts with Ember's distinction
between:

- Ember retaining responsibility for a delegated objective;
- a specialist receiving only a scoped projection;
- delegated output returning as evidence rather than becoming canonical truth;
- currentness and authority being rechecked on reintegration.

An `inputFilter` can reduce handoff context, but it does not create Ember's disclosure,
authority, or responsibility semantics.

**Recommendation: do not use SDK handoffs to implement Ember's canonical specialist
delegation.** They remain acceptable for purely internal routing inside one bounded,
non-authoritative cognition episode where no durable specialist semantics are claimed.

## Sessions are history, not Ember memory

The `Session` interface is pleasantly small. A basic implementation reads, appends,
pops, and clears SDK `AgentInputItem[]` history; optional session interfaces add
history rewrites or idempotent transactions. The runner can use a custom storage
backend, and `MemorySession` demonstrates an in-process implementation.

This is useful operational infrastructure, but its semantic object is conversation
history. Ember memory is not equivalent to replaying prior model items.

The boundary should be explicit:

```text
canonical Ember state / memory / provenance
        |
        | projection for one bounded episode
        v
SDK Session or result.history
  disposable operational conversation cache
        |
        v
Runner
```

A session may help resume a bounded user conversation or an interrupted run. It must
not become the only place where Ember remembers:

- durable meanings;
- corrections;
- provenance;
- commitments;
- currentness;
- unresolved delegated work;
- canonical continuity across provider/runtime replacement.

### Persisted session lock-in

Persisting a custom `Session` stores SDK `AgentInputItem` protocol shapes. Persisting
`OpenAIConversationsSession` additionally couples state to the OpenAI Conversations
API and its remote conversation identifier.

Migration cost therefore differs by implementation:

| Session strategy                                      | Migration/lock-in cost                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `MemorySession`                                       | **Low**: process-local and disposable by design                                   |
| custom local store of `AgentInputItem[]`              | **Medium**: provider-independent storage, but SDK protocol/type migration remains |
| OpenAI Conversations API                              | **High**: SDK item semantics plus service-owned remote state/identifier           |
| Ember reconstruction of per-run input without Session | **Lowest semantic lock-in**: more caller plumbing, maximum canonical control      |

For Ember, a future production session store should be reconstructable or safely
discardable. Do not require a one-to-one migration of old SDK sessions to preserve
Ember identity.

## Human-in-the-loop and resumable `RunState`

The SDK's approval flow is technically attractive:

1. a tool reaches an approval point;
2. the runner does not execute it;
3. an interruption is returned;
4. application code approves or rejects it;
5. the run resumes from `RunState`;
6. serialized state can survive a long wait without keeping the process alive.

Nested `agent.asTool()` approvals bubble to the outer run, which is useful for a
single application-level approval surface.

For Ember this should be treated as **checkpoint mechanics beneath authority**, not
as the authority model itself.

Before approving or resuming an old interruption Ember must still establish:

- which principal and authority grant apply now;
- whether the objective is still current;
- whether the requested arguments/resource remain allowed;
- whether context changed while approval was pending;
- whether another execution already produced the effect;
- whether replay is safe after failure.

### Serialized `RunState` is operational state with migration cost

`RunState` serializes substantial runner state, generated items, run context, approval
metadata, agent identities, model responses, turn counts, and continuation details.
Some runtime-only evidence is intentionally not serialized. The docs also describe
resume cases that fail closed when serialized state lacks enough provenance for a
safe output-guardrail continuation.

That is exactly the profile of a versioned execution checkpoint, not a canonical
domain record.

If Ember ever persists it, store something conceptually like:

```text
OperationalCheckpoint {
  engine: "openai-agents-js"
  engineVersion: "0.17.x"
  purposeId: Ember-owned ID
  createdAt: Ember timestamp
  opaqueState: serialized RunState
}
```

The real schema should remain adapter-local. Ember must be free to discard an
incompatible checkpoint and restart/reconcile from canonical state rather than
migrating the SDK state at any semantic cost.

Do not store secrets in `RunContext.context` if the run may be serialized. The SDK
documentation explicitly notes that public run-context runtime data is serialized
with `RunState`.

## Guardrails are validation, not authority

The SDK has three guardrail families:

- input guardrails on the initial user input;
- output guardrails on final agent output;
- input/output guardrails around custom function tools.

These are useful validation hooks, but several lifecycle facts prevent them from
serving as Ember's authority layer:

1. Input guardrails run **in parallel by default**. The model may already consume
   tokens or execute tools before a later tripwire fires. Blocking mode exists and
   must be chosen explicitly when pre-effect gating matters.
2. Agent-level input guardrails apply only to the first agent in a chain, and output
   guardrails only to the final-output agent.
3. Function-tool guardrails do not automatically wrap handoff calls.
4. Hosted tools and built-in execution tools do not all use the same function-tool
   guardrail pipeline.
5. A guardrail tripwire cannot undo external side effects already produced.

Therefore:

```text
Ember authority / currentness / risk decision
  -> whether execution is permitted at all
  -> SDK guardrail
  -> validation of the permitted execution path
```

Guardrails can strengthen an already-authorized path. They do not define the grant.

## MCP integration

The SDK supports MCP servers alongside function tools, including local/remote server
integration, filtering, and approval flows. Hosted MCP tools can require approval and
participate in the same interruption model.

The useful reusable part is transport, discovery, schema conversion, and execution
plumbing. Ember still owns:

- which MCP server is reachable for the current principal;
- which tools are visible;
- whether a generated resource/argument is authorized;
- what provenance to attach to returned observations;
- what effect uncertainty remains after failure/cancellation.

The SDK documentation contains one particularly important warning for context-aware
filtering: caching a filtered tool list can accidentally reuse a list across request
contexts if the cache key is not context-specific. Ember should therefore keep its
capability/authority decision outside MCP list caching and treat SDK filtering only as
an implementation optimization.

**Recommendation: MCP is one of the stronger reusable surfaces, but only behind an
Ember-owned capability adapter and server-side authorization.**

## Retries and failure behavior

The model retry surface is unusually well aligned with Ember's concern about replay
and uncertain effects.

Retries are opt-in. Policies can inspect:

- attempt count;
- normalized HTTP/network/abort facts;
- provider retry advice;
- `replaySafety`;
- whether a response started;
- whether the request is stateful.

The SDK does not automatically retry:

- abort errors;
- streamed runs after visible/raw model events were emitted;
- provider failures marked unsafe to replay.

Stateful `previousResponseId` / `conversationId` follow-ups require stronger provider
replay-safety evidence. Applications may explicitly approve some unsafe non-streaming
replays, acknowledging duplication risk.

This is a good mechanical substrate for Ember because it exposes uncertainty instead
of erasing it. The adapter must still translate retry outcomes into Ember-owned
observations and must never infer that a failed or cancelled tool had no effect merely
because the runner stopped.

### Tool failures

Function tools add per-call timeout and tool-specific error behavior. The SDK can
return a timeout as model-visible output or raise a `ToolTimeoutError`; the tool's
execution details receive a signal that is aborted on timeout.

That is useful, but the same rule applies as with Ember's current process lifecycle:
**requesting termination and observing local cancellation are not equivalent to
establishing that all external work stopped.**

## Streaming and cancellation

`Runner.run(..., { stream: true })` returns a streamed result with raw events,
text-only helpers, completion state, active agent, turn count, interruption state,
error, and cancellation status.

A streamed run can be cancelled by aborting the run signal or cancelling the reader.
The docs require callers to await `completed` before treating the run as settled,
because input/session persistence and cleanup may continue after event consumption
stops. An unfinished cancelled turn can later resume from `RunState`.

This is a good operational model for Ember surfaces because it distinguishes:

```text
consumer stopped reading
!= runner fully settled
!= remote/provider work definitely stopped
```

An Ember adapter should translate streamed events into surface-specific progress while
keeping canonical state mutation outside the stream. Progress must remain explicitly
non-canonical until the containing cognition/delegation result passes Ember validation.

## Structured output

An SDK `Agent` can define `outputType` using Zod, Standard Schema, or raw JSON Schema.
The runner parses and validates the final model output before returning it.

This is useful for adapter-local protocol enforcement, including a future
`ProviderResult`-shaped response or a specialist-report-shaped nested result.

As in the Vercel AI SDK evaluation, **schema validity is not semantic validity**.
Ember must still validate:

- `usedMeaningIds` are inside the selected projection;
- authority/currentness are still applicable;
- specialist claims are reintegrated as evidence;
- external effects are represented truthfully.

Do not expose the SDK's output schema/result generic types in `src/core/` or canonical
persistence merely because TypeScript inference is convenient.

## Tracing and observability

The tracing system captures run, agent, turn, model, tool, guardrail, and handoff
spans. It also exposes custom spans and custom processors.

This is attractive if Ember can use:

- Ember-owned cognition/delegation IDs as trace metadata;
- a custom processor that emits to a local or chosen backend;
- privacy settings that omit sensitive model/tool payloads;
- trace data as operational diagnostics, not canonical semantic evidence.

The default behavior needs deliberate configuration. In supported server runtimes,
tracing is enabled and exported to OpenAI by default unless disabled. Ember's local,
self-hosted posture should therefore explicitly disable the default exporter or
replace its processors before treating the SDK as local-only infrastructure.

Trace shutdown also matters for Ember's short-lived episodic workers. The exporter is
batched/asynchronous, so an adapter using tracing should flush on the worker lifecycle
boundary rather than assuming process exit will preserve every queued span.

## Deterministic testing and debugging

The SDK's testing surface is one of its strongest low-risk features.
`@openai/agents/testing` / `@openai/agents-core/testing` provide a scripted model with
helpers for:

- fixed normalized model responses;
- responses derived from the recorded model request;
- exact normalized streams;
- injected model failures;
- provider retry advice;
- cancellation checkpoints;
- recorded calls for assertions.

This lets Ember test the loop without network calls or an OpenAI model. It is
particularly useful for deterministic acceptance cases such as:

- one model turn then final output;
- tool call then final output;
- max-turn failure;
- approval pause/resume;
- retry only when replay-safe;
- no retry after streamed output becomes visible;
- provider-specific metadata preservation;
- handoff/agent-tool behavior in a throwaway spike.

The testing helpers are deliberately kept out of the main runtime entry point.

**Recommendation: if Ember adopts any Agents SDK-backed execution adapter, use the
scripted model immediately and require deterministic tests for every lifecycle edge.**

## Type leakage firewall

The following SDK types should remain inside an adapter or optional integration
package:

- `Agent` / `AgentConfiguration`;
- `Runner`, `RunResult`, `StreamedRunResult`;
- `RunState`, `RunContext`, interruption items;
- `AgentInputItem`, `RunItem`, model protocol items;
- `Tool`, `FunctionTool`, hosted tool types;
- `Handoff` and handoff input/output item types;
- `Session` and session extension interfaces;
- `Model`, `ModelProvider`, `ModelResponse`, SDK usage types;
- tracing `Trace`, `Span`, processor/exporter types.

They may be referenced inside implementation tests for that adapter. They should not
become DTOs consumed by `src/core/`, persisted canonical state, interaction surfaces,
or the current specialist reintegration layer.

A strict replacement test is:

> If `@openai/agents*` disappeared tomorrow, could Ember preserve its canonical state,
> identity, continuity, memory, authority, provenance, and specialist records while
> replacing only one bounded implementation layer?

If the answer becomes no, the SDK has leaked above its proper boundary.

## Proposed Ember-owned seams

Do **not** introduce one giant `AgentFramework` abstraction. Preserve or add only
capability-level seams that multiple implementations can truthfully satisfy.

### 1. Existing cognition request/result boundary

Keep:

```text
ProviderRequest
  -> provider/cognition implementation
  -> ProviderResult
```

An Agents SDK runner may live entirely inside one implementation. Issue #188 already
removed CLI process configuration from the shared invocation call; any Agents SDK
adapter should implement that semantic request/result seam without reintroducing
transport-shaped parameters.

### 2. Capability execution boundary

If Ember generalizes local tools, expose an Ember-owned tool/capability contract that
contains:

- stable capability identity;
- model-visible schema/description;
- principal/authority evaluation;
- effect classification;
- cancellation/timeout contract;
- provenance/evidence extraction.

The adapter may convert that to a `FunctionTool` internally. Another deployment could
convert the same Ember capability to Vercel AI SDK `tool()`, MCP, or a custom executor.

### 3. Operational conversation boundary

Only if a real use case earns persistent bounded conversation history, define an
Ember-owned operational-history port whose records are explicitly non-canonical and
reconstructable. An Agents SDK `Session` can implement the adapter side. Do not expose
`AgentInputItem[]` from the port.

### 4. Opaque execution checkpoint boundary

If long approval waits require durable `RunState`, persist a versioned opaque
checkpoint with Ember-owned purpose/currentness metadata around it. LangGraph or a
custom implementation should be able to replace the checkpoint engine without
changing canonical Ember state.

### 5. Trace sink boundary

Map SDK trace/span events to an Ember-owned observability sink with Ember IDs and
privacy policy. The sink may target local logs, OpenTelemetry, an OpenAI exporter, or
another backend without affecting cognition semantics.

### 6. MCP capability boundary

Keep server configuration, principal policy, capability visibility, and provenance
Ember-owned. The SDK may own client transport/tool conversion underneath it.

### 7. Specialist executor boundary, only if earned

If an agents-as-tools spike proves useful, adapt a nested SDK agent to the existing
specialist episode/report/reintegration semantics. The SDK nested result is runtime
evidence; the Ember specialist report remains the contract.

## Mapping to current Ember code

| Current Ember area                   | Potential SDK role                                                                     | What must remain Ember-owned                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/providers/contract.ts`          | An SDK-backed direct-provider implementation could run beneath the request/result seam | request/result semantics, selected projection, `usedMeaningIds` validation, operational continuation meaning |
| Codex/Cursor provider adapters       | Little immediate benefit; they already own subscription-backed CLI lifecycle           | CLI auth/session/process evidence and uncertainty                                                            |
| `src/runtime/process-lifecycle.ts`   | No replacement for existing CLI process lifecycle                                      | child termination evidence, output bounds, process cleanup                                                   |
| future generic local tool layer      | FunctionTool schema/timeout/execution plumbing                                         | capability identity, authority, effects, provenance                                                          |
| MCP integration                      | transport, discovery, schema conversion, approval pause mechanics                      | server trust, principal policy, resource authorization, returned evidence                                    |
| `src/delegation/codex-specialist.ts` | Possible throwaway agents-as-tools execution spike                                     | episode spec, disclosure, authority, currentness, effects, report provenance, reintegration                  |
| episodic runtime                     | Serialized `RunState` could be one opaque work checkpoint                              | work ownership, recovery, liveness, writer leases, canonical state                                           |
| observability                        | trace/span generation and processors                                                   | Ember correlation IDs, retention/privacy policy, interpretation                                              |
| tests                                | `ScriptedModel` and helpers                                                            | Ember acceptance assertions and semantic oracles                                                             |

### What current Ember code should not be replaced

The SDK does not replace the reasons Ember currently has custom code for:

- canonical meaning/provenance storage;
- context projection and `usedMeaningIds` validation;
- specialist purpose and authority envelopes;
- currentness re-evaluation;
- known-versus-possible external effects;
- durable specialist episode records;
- reintegration and semantic disposition;
- systemd-supervised work ownership/recovery;
- Codex/Cursor local subscription authentication and process boundaries.

Using the SDK to erase those distinctions would reduce code while making the system
less truthful.

## Operational fit

### Node 26 and TypeScript

- Upstream currently tests Node 22 and 24.3.x.
- The reviewed package has no declared `engines` field.
- The repository currently builds with TypeScript 5.9.3.
- Ember uses Node 26 and TypeScript 7.

**Assessment:** likely compatible, not yet proven. Require an Ember-local install,
compile, deterministic runner test, and cancellation smoke before adoption.

### Dependency footprint

The convenience `@openai/agents` package intentionally includes more than Ember would
need for a text-only bounded execution layer, including OpenAI and Realtime packages.
Lower-level `@openai/agents-core` is available and is the better architectural starting
point for an experiment, but it still currently depends on the OpenAI Node package.

**Assessment:** moderate TypeScript dependency footprint, no obvious mandatory native
component in the reviewed metadata. Prefer lower-level packages and measure install
size/RSS/cold start on the Pi rather than reasoning from package names.

### Local/self-hosted use

The core runner, custom models, custom sessions, function tools, local MCP, scripted
testing, and custom tracing processors can operate without making OpenAI-hosted agent
state canonical. However:

- default model resolution is OpenAI-oriented;
- default server tracing exports to OpenAI unless disabled/replaced;
- hosted tools, Conversations, Responses continuation, and hosted multi-agent are
  OpenAI services.

**Assessment:** self-hostable with deliberate configuration; not local-only by default.

### Raspberry Pi-class suitability

No reviewed mandatory native dependency suggests an obvious architectural blocker for
Pi 5. The workload remains network/model dominated for remote inference. The real
questions are package install size, startup time, idle/peak RSS, and whether optional
MCP/sandbox dependencies introduce native pressure in the chosen configuration.

**Assessment:** plausible, measure before production adoption.

### API maturity/stability

The main packages are still **0.x** and the changelog shows frequent additions to
session transaction semantics, resumable input, testing, retry, and tool/handoff
behavior across recent minor/patch releases.

That activity is positive for capability, but it means persisted `RunState` and broad
SDK type leakage would magnify upgrade cost.

**Assessment:** active and increasingly mature, but pin deliberately and keep the
adapter boundary narrow until a stable 1.x compatibility story exists.

### Debuggability

The SDK exposes rich normalized run items, raw model responses, provider data, usage,
turn counts, active agent, explicit error classes, tracing, and deterministic model
scripting.

**Assessment:** strong. The main debugging risk is semantic ambiguity if application
code starts interpreting SDK lifecycle labels as Ember meaning.

## Replaceability matrix

| SDK feature                | Ember seam                         | Later replacement                                      | Canonical migration required?                                               |
| -------------------------- | ---------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Runner` loop              | cognition execution implementation | Vercel AI SDK loop, direct provider calls, custom loop | **No**, if result types stay contained                                      |
| `Model`/`ModelProvider`    | adapter-local model selection      | AI SDK provider, direct SDK, custom provider           | **No**                                                                      |
| FunctionTool execution     | Ember capability executor          | AI SDK tool, MCP, custom executor                      | **No**                                                                      |
| `Session`                  | operational conversation store     | custom history store, provider state, none             | **No**, if history is disposable/reconstructable                            |
| serialized `RunState`      | opaque execution checkpoint        | LangGraph checkpoint, custom state machine, restart    | **No canonical migration**, but pending work may require reconciliation     |
| agent-as-tool specialist   | specialist executor implementation | Codex CLI, another framework, custom specialist        | **No**, if Ember specialist report remains canonical                        |
| MCP integration            | MCP transport/tool adapter         | direct MCP client, AI SDK MCP, custom client           | **No**                                                                      |
| tracing                    | trace sink adapter                 | OpenTelemetry, logs, AI SDK telemetry, custom          | **No**                                                                      |
| scripted model             | test-only model implementation     | custom fake, AI SDK mock                               | **No**                                                                      |
| OpenAI Conversations state | provider operational continuation  | another provider/session strategy                      | **Potentially yes** for conversation history; avoid as canonical dependency |

## Concrete recommendations

### Adopt now

**Nothing as a production dependency solely because this research exists.** Ember does
not yet have an earned need to replace the working Codex/Cursor cognition path with a
multi-step in-process agent loop.

### Strong candidates when the matching need appears

1. **`Runner` as a bounded execution loop** behind the existing/future cognition
   adapter boundary.
2. **Function-tool execution** for schema validation, timeout, cancellation signal,
   and model/tool repetition beneath Ember capability semantics.
3. **Model retry policies** with replay-safety evidence.
4. **ScriptedModel/testing helpers** for deterministic lifecycle tests.
5. **MCP transport/tool conversion** behind Ember server/capability policy.
6. **Custom tracing processors** when an SDK-backed runner exists anyway.
7. **AI SDK integration** if Ember wants OpenAI Agents loop mechanics plus the broader
   Vercel provider ecosystem.

### Wrap behind a semantic firewall

- `Agent` configuration;
- `RunResult` and run items;
- `RunState` and approval interruptions;
- sessions and conversation history;
- function-tool schemas/results;
- MCP tool objects;
- trace/span types;
- provider `ModelResponse` and provider data.

### Avoid as Ember semantics

- SDK `Agent` as Ember identity;
- SDK `Session` as Ember memory;
- `lastAgent` / active agent as responsibility ownership;
- handoff as canonical Ember delegation;
- approval record as authority grant;
- guardrail pass as permission;
- `conversationId` / `previousResponseId` as continuity;
- serialized `RunState` as canonical durable state;
- trace completion as proof of real-world effect completion.

### Revisit with focused spikes

Before production adoption, run small deterministic/optional-live spikes that answer:

1. Can an ephemeral SDK `Agent` consume a `ProviderRequest`, execute one bounded tool
   loop, and return a valid `ProviderResult` without any SDK type escaping the adapter?
2. Can the same adapter run against an AI SDK model through the official extension and
   preserve provider-specific `providerData`, request/response IDs, and retry advice?
3. Can a local function tool enforce an Ember-owned authority decision, time out, and
   preserve `effects_possible` when cancellation does not establish side-effect truth?
4. Can an `agent.asTool()` specialist return the current Ember `SpecialistReport` shape
   while all currentness/authority/reintegration decisions remain outside the nested
   runner?
5. Can a serialized approval `RunState` survive process restart while Ember rechecks
   currentness and authority before resuming?
6. What are install size, cold-start latency, and peak/idle RSS on the Pi using only the
   chosen lower-level packages?
7. Does the current release compile and pass deterministic tests on Node 26 /
   TypeScript 7 without shims or type escapes?

## Suitability for issue #180 synthesis

Relative to the other issue #175 candidates:

- **Vercel AI SDK remains the cleaner candidate for generic direct model/provider
  mechanics** because it owns less application lifecycle meaning.
- **OpenAI Agents SDK is more attractive when Ember needs a ready-made bounded
  multi-turn agent/tool loop, approval checkpoint, retry policy, or scripted runner
  tests.**
- **LangGraph.js remains the stronger candidate for explicit durable execution and
  restartable workflow orchestration** where checkpoint/replay is the primary need.
- **Mastra offers a broader integrated toolkit**, but with greater pressure toward its
  own agent/memory/workflow application model.
- The official **Agents SDK <-> Vercel AI SDK bridge is evidence that these choices do
  not need to be exclusive**. Ember can select mechanics per seam instead of selecting
  one framework as its architecture.

The likely synthesis direction is therefore compositional:

```text
Ember semantics
  identity / continuity / memory / provenance / currentness / authority / delegation
        |
        +-> cognition model/provider seam -> Vercel AI SDK or direct provider
        |
        +-> bounded agent/tool execution -> OpenAI Agents SDK Runner when earned
        |
        +-> durable workflow execution -> LangGraph.js when earned
        |
        +-> MCP / tracing / testing -> whichever narrow implementation fits best
```

This preserves the issue #175 governing principle: **Ember owns meaning; dependencies
may own mechanics.**

## Sources

Primary sources reviewed on 2026-09-07:

- OpenAI Agents SDK JS/TS overview and package boundaries:
  https://openai.github.io/openai-agents-js/
- Running agents, runner lifecycle, cancellation, state, and errors:
  https://openai.github.io/openai-agents-js/guides/running-agents/
- Models, custom providers, retries, raw usage, and provider-specific settings:
  https://openai.github.io/openai-agents-js/guides/models/
- Vercel AI SDK model integration:
  https://openai.github.io/openai-agents-js/extensions/ai-sdk/
- Tools and agents-as-tools:
  https://openai.github.io/openai-agents-js/guides/tools/
- Handoffs:
  https://openai.github.io/openai-agents-js/guides/handoffs/
- Agent orchestration:
  https://openai.github.io/openai-agents-js/guides/multi-agent/
- Sessions:
  https://openai.github.io/openai-agents-js/guides/sessions/
- Human-in-the-loop approvals and resumable state:
  https://openai.github.io/openai-agents-js/guides/human-in-the-loop/
- Guardrails:
  https://openai.github.io/openai-agents-js/guides/guardrails/
- MCP:
  https://openai.github.io/openai-agents-js/guides/mcp/
- Streaming:
  https://openai.github.io/openai-agents-js/guides/streaming/
- Results and provider/run evidence:
  https://openai.github.io/openai-agents-js/guides/results/
- Context management:
  https://openai.github.io/openai-agents-js/guides/context/
- Tracing and custom processors:
  https://openai.github.io/openai-agents-js/guides/tracing/
- Testing and scripted models:
  https://openai.github.io/openai-agents-js/guides/testing/
- `@openai/agents` package metadata:
  https://github.com/openai/openai-agents-js/blob/main/packages/agents/package.json
- `@openai/agents-core` package metadata:
  https://github.com/openai/openai-agents-js/blob/main/packages/agents-core/package.json
- upstream changelog:
  https://github.com/openai/openai-agents-js/blob/main/packages/agents/CHANGELOG.md
- upstream Node CI matrix:
  https://github.com/openai/openai-agents-js/blob/main/.github/workflows/test.yml
