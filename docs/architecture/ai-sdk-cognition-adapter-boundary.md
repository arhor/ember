---
summary: "Issues #186, #188, #189, and #197 implementation boundary for Vercel AI SDK model invocation, structured output, bounded tool mechanics, lifecycle evidence, and error translation beneath Ember-owned cognition and capability semantics."
read_when:
  - "Changing the Vercel AI SDK cognition adapter or adding a direct in-process model provider"
  - "Changing AI SDK tool-loop mechanics, capability selection, retries, timeout behavior, lifecycle evidence, or types allowed across the adapter boundary"
  - "Replacing Vercel AI SDK with another model toolkit while preserving Ember cognition and capability semantics"
role: design
discovery_status: current
---

# AI SDK Cognition Adapter Boundary

## Proven implementation

Issue [#186](https://github.com/arhor/ember/issues/186) introduced Ember's first
production-code adoption of Vercel AI SDK. Issue
[#188](https://github.com/arhor/ember/issues/188) then removed process-shaped
arguments from the shared provider invocation seam. Issue
[#189](https://github.com/arhor/ember/issues/189) extends the same direct adapter with
one bounded AI SDK tool loop while keeping capability semantics outside the SDK. Issue
[#197](https://github.com/arhor/ember/issues/197) adopts AI SDK lifecycle callbacks and
supported error classes at that boundary while exposing selected inference diagnostics
only through a narrow Ember-owned evidence sink.

The current path is:

```text
Ember builds least-sufficient Projection
        |
        v
ProviderRequest
        |
        v
createAiSdkProvider(LanguageModel)
        |
        +-> Ember selects capability bindings for this cognition
        +-> adapter maps selected bindings to AI SDK tools
        +-> generateText runs a bounded tool loop
        +-> Ember capability firewall decides whether each call may execute
        +-> AI SDK lifecycle callbacks emit bounded inference evidence
        +-> Output.object + JSON Schema shapes the final model result
        |
        v
Ember validateProviderResult
        |
        v
ProviderResult
        |
        v
canonical cognition episode / expression evidence
```

The adapter lives in `src/providers/ai-sdk.ts`. It accepts an injected AI SDK
`LanguageModel`, so Ember still does not choose a paid API provider, authentication
scheme, gateway, or vendor at this boundary. The production dependency remains pinned
to `ai@7.0.93`; deterministic tests use `MockLanguageModelV3` from `ai/test` and
require no network access.

The model call uses `generateText`, structured `Output.object`, and `jsonSchema`.
Issue #189 additionally uses AI SDK `tool` definitions plus a bounded step stop
condition. Issue #197 uses the AI SDK 7 lifecycle callbacks `onStart`, `onStepEnd`,
`onToolExecutionStart`, `onToolExecutionEnd`, and `onEnd` rather than reconstructing
those mechanics from model results. No AI SDK `Agent`, persistent session, SDK memory,
workflow runtime, MCP client, SDK-owned identity, or SDK-owned telemetry backend is
adopted.

For capability semantics, see
[Capability Execution Boundary](capability-execution-boundary.md).

## Ember still owns meaning on both sides

The SDK call remains enclosed by Ember-owned boundaries.

Before invocation, `runCognition` builds the projection. The adapter receives only the
already-bounded `ProviderRequest` and sends the model only:

- that selected `Projection`;
- the current input object; and
- capability definitions explicitly selected by Ember for that cognition.

It does not receive or disclose canonical `EmberState` wholesale. Capability
selection likewise happens before tool definitions are created; SDK tool availability
cannot broaden the current capability set by discovery or ambient reachability.

After the tool loop, AI SDK structured-output validation is still only structural
validation. The adapter immediately calls Ember's existing `validateProviderResult`
against the meaning IDs in the supplied projection. A schema-valid model result that
claims a `usedMeaningId` outside the projection remains rejected even if every tool
call succeeded.

The same principle applies inside the tool loop. AI SDK validates tool input schemas
and owns message/step plumbing, but an Ember capability firewall independently checks
authority, semantic argument constraints, occurrence policy, and execution outcome.
A tool result is bounded operational evidence supplied to cognition, not automatically
canonical Ember meaning.

This is the executable form of the rule from #178 and #180:

> **Ember owns meaning and authority; dependencies may own mechanics.**

## Provider invocation seam

Issue #188 established the shared cognition operation as:

```text
(ProviderRequest, ProviderInvocationOptions) -> ProviderResult
```

Executable commands, argument prefixes, workspaces, environments, and provider-specific
continuation mechanics stay inside concrete provider adapters. The AI SDK adapter uses
the same semantic seam without fake command placeholders.

Capability bindings are deliberately not added to `ProviderRequest` or
`ProviderInvoker`. `createAiSdkProvider` accepts adapter-local capability and evidence
options that receive or describe only the already-bounded cognition attempt. This
preserves the provider contract for Codex, Cursor, deterministic process providers,
and any later model toolkit while keeping tool and diagnostic mechanics optional.

## Inference evidence and continuation evidence

AI SDK exposes considerably more operational data than belongs in a `ProviderResult`:
provider/model identity, response IDs, finish reasons, warnings, usage, steps,
request/response metadata, tool-call details, and arbitrary provider metadata. Issue
#197 keeps useful diagnostics without promoting that foreign result shape into Ember's
semantic contract.

`createAiSdkProvider` therefore accepts an optional `InferenceEvidenceSink`. The sink
receives only Ember-owned plain-data observations:

- inference start with provider/model identity and the effective retry limit;
- completed model steps with provider/model identity, response model ID, normalized
  finish and raw finish reasons, normalized token counts, and redacted warning shapes;
- tool **dispatch** start/end observations containing only the selected capability name,
  SDK result/error classification, and bounded duration;
- aggregate inference completion with step count, finish reasons, normalized usage,
  and warnings; and
- translated failure category, phase, optional HTTP status, and retry reason.

The word `dispatch` is deliberate. An AI SDK tool callback is not evidence that an
external side effect started, completed, or did not happen. Effect truth remains in
`CapabilityExecutionEvidence`, where Ember knows the authority decision, whether the
executor was entered, interruption state, and retry safety.

The evidence sink never receives the prompt, messages, tool inputs or outputs, tool-call
IDs, response IDs, response headers/bodies, raw usage objects, warning free-text, or raw
SDK event objects. AI SDK's request/response-body retention remains disabled by its
default `generateText` `include` settings. Provider metadata is intentionally omitted
because its shape and sensitivity are provider-defined; a future field may be admitted
only by an explicit narrow translator with a demonstrated operational use.

Evidence-sink failures are swallowed at the adapter boundary. Diagnostics cannot turn a
successful cognition into failure or change the provider outcome.

None of this evidence is copied into `ProviderResult` or canonical state. The only
current shared provider operational result field remains
`operational.externalThreadId`, whose meaning is an opaque provider-owned continuation
handle. A one-shot AI SDK response ID, model ID, call ID, or tool-call ID is not evidence
of a resumable thread and is not stored as one. Likewise, lifecycle callback ordering is
observational SDK behavior, not canonical Ember event ordering.

## Failure, cancellation, timeout, and retries

The adapter translates supported AI SDK failures immediately into Ember-owned
`ProviderError` semantics. AI SDK classes do not escape through `ProviderResult`, the
evidence sink, or `ProviderError.cause`.

The current translation uses AI SDK's supported `.isInstance()` guards for API-call,
retry, no-output/object, type/JSON/response validation, and invalid-tool-call failures.
`APICallError` contributes only a safe HTTP status to evidence; request bodies, URLs,
response bodies, and provider error text are not retained. Structured-output failures
such as `NoObjectGeneratedError` become Ember `failed` outcomes with
`invalid_output` evidence, while the independent `validateProviderResult` check remains
the final semantic provenance authority.

AI SDK 7.0.93 does not export a separate timeout error class. Its timeout machinery uses
the web-standard `DOMException` timeout code, so the adapter recognizes
`DOMException.TIMEOUT_ERR` rather than matching `error.name === "TimeoutError"`.
Timeout classification happens before caller-abort classification so a model timeout
remains `timed_out` even if an external cancellation follows it.

Provider-level behavior remains:

- an already-aborted caller signal is `cancellation_requested` before model work;
- an abort during generation is `cancellation_requested`;
- an AI SDK timeout is `timed_out`;
- API/network, retry-policy, structured-output, and tool-shape failures are `failed`
  with distinct inference-evidence categories; and
- `ProviderError` raised by Ember final-result validation remains authoritative and is
  not reinterpreted as an SDK error.

There is no direct child process for this adapter. Explicit cancellation may therefore
record `directChildExitObserved: false`, preserving the existing meaning that a
cancellation request was observed without inventing process-exit evidence. A direct AI
SDK timeout records `timed_out` while leaving process-shaped termination evidence
absent.

Tool execution adds a more specific boundary. Before an executor is entered,
cancellation is evidence that execution did not start. After an executor is entered,
an abort cannot prove that an external effect did not occur. The Ember firewall
therefore classifies an aborted in-flight capability as `outcome_unknown` and marks
retry unsafe unless later reconciliation earns a stronger conclusion. Inference
lifecycle evidence does not weaken or overwrite that effect uncertainty.

AI SDK `maxRetries` remains explicitly `0`, and the effective retry limit is visible in
inference-start evidence. Observing SDK retry metadata does not authorize retrying
Ember actions. The capability firewall also enforces `at_most_once_per_cognition`; a
repeated model request for a capability whose execution was already attempted is
returned as `occurrence_blocked` rather than silently executing again. The four-step
tool-loop bound is operational only and never establishes semantic completion or
currentness.

The adapter applies the same positive finite timeout and maximum timeout bound as the
existing provider contract.

## Replacement path

Vercel AI SDK is replaceable at this boundary. A different toolkit or custom direct
provider implementation can replace `createAiSdkProvider` if it can:

1. accept the already-selected `ProviderRequest` without reaching into canonical
   state;
2. map explicitly selected Ember capabilities to its tool-call mechanics without
   becoming the authority oracle;
3. honor Ember timeout/cancellation semantics and avoid unsafe implicit retries;
4. translate useful inference diagnostics into bounded Ember-owned evidence rather
   than exporting foreign result/error/event types;
5. return an Ember `ProviderResult` rather than foreign SDK result/session types; and
6. pass `validateProviderResult` before the result reaches canonical cognition state.

Capability transports are independently replaceable. A future MCP source can sit
behind the Ember capability execution firewall without transferring authority,
currentness, retry, or canonical-state ownership to MCP or AI SDK.

No migration of Ember memory, identity, lineage, projection, delegation, authority, or
persistence is required because AI SDK owns none of those concepts here.

## Deterministic evidence

`tests/ai-sdk-provider.test.ts` exercises direct structured cognition through
production `runCognition`: projection disclosure, final semantic validation, malformed
structured output, standard-code timeout classification, cancellation before and during
model work, API-error redaction/classification, no implicit model retry, lifecycle
provider/model/finish/warning/usage evidence, and exclusion of prompts, raw provider
payloads, and SDK metadata from both evidence and canonical state.

`tests/ai-sdk-capabilities.test.ts` extends that oracle through the real AI SDK tool
loop. It covers selected versus unselected capability visibility, permitted execution,
authority denial, schema-invalid input, Ember semantic input rejection, executor
failure, repeated-call occurrence blocking, bounded result reintegration, final
`usedMeaningIds` validation, canonical-state isolation, and tool lifecycle observations
that deliberately omit tool inputs, outputs, and SDK call IDs.

`src/capabilities/execution.test.ts` separately pins cancellation truthfulness before
and after an execution attempt begins. That ledger remains the authority for effect
uncertainty even when inference lifecycle observations are also collected.
