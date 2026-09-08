---
summary: "Issues #186, #188, and #189 implementation boundary for Vercel AI SDK model invocation, structured output, and bounded tool mechanics beneath Ember-owned cognition and capability semantics."
read_when:
  - "Changing the Vercel AI SDK cognition adapter or adding a direct in-process model provider"
  - "Changing AI SDK tool-loop mechanics, capability selection, retries, timeout behavior, or types allowed across the adapter boundary"
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
one bounded AI SDK tool loop while keeping capability semantics outside the SDK.

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
condition. No AI SDK `Agent`, persistent session, SDK memory, workflow runtime, MCP
client, or SDK-owned identity is adopted.

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
`ProviderInvoker`. `createAiSdkProvider` accepts an adapter-local capability selector
that receives the already-bounded request. This preserves the provider contract for
Codex, Cursor, deterministic process providers, and any later model toolkit while
keeping tool mechanics optional.

## Metadata and continuation evidence

AI SDK can expose provider/model identity, response IDs, finish reasons, warnings,
usage, tool-call IDs, messages, steps, and provider-specific metadata. None of those
values is copied into `ProviderResult` or canonical state.

The only current shared provider operational result field remains
`operational.externalThreadId`, whose meaning is an opaque provider-owned continuation
handle. A one-shot AI SDK response ID, model ID, or tool-call ID is not evidence of a
resumable thread and is not stored as one.

Capability execution results have the same restraint. Episode-local
`CapabilityExecutionEvidence` can be inspected by the caller and returns to the model
as a bounded tool result, but the SDK representation and tool transcript do not become
canonical state. A future consequential capability that needs durable attempt evidence
must add the narrow Ember-owned persistence its semantics require rather than storing
foreign SDK step objects.

## Failure, cancellation, timeout, and retries

Provider-level behavior remains:

- an already-aborted signal is `cancellation_requested` before invocation;
- an abort during generation is `cancellation_requested`;
- an AI SDK timeout is `timed_out`;
- structured-output or model-call failure is `failed`;
- `ProviderError` raised by Ember final-result validation remains authoritative.

There is no direct child process for this adapter. Explicit cancellation may therefore
record `directChildExitObserved: false`, preserving the existing meaning that a
cancellation request was observed without inventing process-exit evidence. A direct AI
SDK timeout records `timed_out` while leaving process-shaped termination evidence
absent.

Tool execution adds a more specific boundary. Before an executor is entered,
cancellation is evidence that execution did not start. After an executor is entered,
an abort cannot prove that an external effect did not occur. The Ember firewall
therefore classifies an aborted in-flight capability as `outcome_unknown` and marks
retry unsafe unless later reconciliation earns a stronger conclusion.

AI SDK `maxRetries` remains explicitly `0`. The capability firewall also enforces
`at_most_once_per_cognition`; a repeated model request for a capability whose execution
was already attempted is returned as `occurrence_blocked` rather than silently
executed again. The four-step tool-loop bound is operational only and never establishes
semantic completion or currentness.

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
4. return an Ember `ProviderResult` rather than foreign SDK result/session types; and
5. pass `validateProviderResult` before the result reaches canonical cognition state.

Capability transports are independently replaceable. A future MCP source can sit
behind the Ember capability execution firewall without transferring authority,
currentness, retry, or canonical-state ownership to MCP or AI SDK.

No migration of Ember memory, identity, lineage, projection, delegation, authority, or
persistence is required because AI SDK owns none of those concepts here.

## Deterministic evidence

`tests/ai-sdk-provider.test.ts` continues to exercise direct structured cognition
through production `runCognition`: projection disclosure, final semantic validation,
malformed output, timeout, cancellation, no implicit model retry, and SDK metadata
isolation.

`tests/ai-sdk-capabilities.test.ts` extends that oracle through the real AI SDK tool
loop. It covers selected versus unselected capability visibility, permitted execution,
authority denial, schema-invalid input, Ember semantic input rejection, executor
failure, repeated-call occurrence blocking, bounded result reintegration, final
`usedMeaningIds` validation, and canonical-state isolation.

`src/capabilities/execution.test.ts` separately pins cancellation truthfulness before
and after an execution attempt begins.
