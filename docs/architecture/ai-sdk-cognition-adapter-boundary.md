---
summary: "Issue #186 implementation boundary for Vercel AI SDK model invocation and structured output beneath Ember-owned cognition, projection, validation, and failure semantics."
read_when:
  - "Changing the Vercel AI SDK cognition adapter or adding a direct in-process model provider"
  - "Deciding which AI SDK metadata, retries, timeout behavior, or types may cross into Ember cognition contracts"
  - "Replacing Vercel AI SDK with another model toolkit while preserving Ember cognition semantics"
role: design
discovery_status: current
---

# AI SDK Cognition Adapter Boundary

## Proven implementation

Issue [#186](https://github.com/arhor/ember/issues/186) is Ember's first production-code
adoption of Vercel AI SDK. The integration is intentionally one brick wide:

```text
Ember builds least-sufficient Projection
        |
        v
ProviderRequest
        |
        v
createAiSdkProvider(LanguageModel)
        |
        +-> generateText
        +-> Output.object + JSON Schema
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
`LanguageModel`, so this task does not choose a paid API provider, authentication
scheme, gateway, or vendor. The only direct production dependency added by Ember is
pinned `ai@7.0.93`; deterministic tests use `MockLanguageModelV3` from the same
package's `ai/test` export and require no network access.

The implementation uses `generateText` for one non-streaming model call and
`Output.object` with `jsonSchema` for structured generation. No AI SDK `Agent`, tool
loop, MCP client, session, memory, workflow, or persistence surface is introduced.

## Ember still owns the meaning on both sides

The SDK call is deliberately enclosed by two Ember-owned boundaries.

Before invocation, `runCognition` builds the projection. The adapter receives only the
already-bounded `ProviderRequest` and sends the model only:

- that selected `Projection`; and
- the current input object.

It does not receive or disclose canonical `EmberState` wholesale. AI SDK therefore
cannot become the context selector merely because it owns prompt/model plumbing.

After generation, AI SDK schema validation is only structural validation. The adapter
immediately calls Ember's existing `validateProviderResult` against the meaning IDs in
the supplied projection. A schema-valid model result that claims a `usedMeaningId`
outside the projection is still rejected by Ember.

This proves the rule from #178 and #180 in executable code:

> **Ember owns meaning; dependencies may own mechanics.**

## Metadata and continuation evidence

AI SDK can expose provider/model identity, response IDs, finish reasons, warnings,
usage, and provider-specific metadata. None of those values is currently copied into
`ProviderResult` or canonical state.

That omission is deliberate. The only current shared operational result field is
`operational.externalThreadId`, whose meaning is an opaque provider-owned continuation
handle. A one-shot AI SDK response ID or model ID is not evidence of a resumable
thread, so storing either value there would strengthen its meaning incorrectly.

If Ember later earns a need for model-call telemetry, finish evidence, or a direct API
continuation handle, add the narrow Ember-owned evidence shape required by that use
case. Do not widen the contract merely to mirror `GenerateTextResult`.

## Failure, cancellation, timeout, and retries

The adapter maps AI SDK execution back into the existing Ember-facing provider failure
vocabulary:

- an already-aborted signal is `cancellation_requested` before invocation;
- an abort during generation is `cancellation_requested`;
- an AI SDK timeout is `timed_out`;
- structured-output or model-call failure is `failed`;
- `ProviderError` raised by Ember result validation remains authoritative.

There is no direct child process for this adapter, so timeout/cancellation termination
evidence records `directChildExitObserved: false`. That field remains useful evidence
about what was actually observed; it must not be read as a claim that remote provider
work or effects are impossible.

`maxRetries` is explicitly set to `0`. AI SDK retry plumbing remains available for a
future earned use case, but the first adapter does not silently repeat an invocation
beneath Ember's failure semantics. Retry safety, especially around any future external
effects, remains an Ember decision rather than an SDK default.

The adapter applies the same positive finite timeout and maximum timeout bound as the
existing provider contract.

## What #186 confirms and what it pressures

The implementation confirms the main #178/#180 assumptions:

- AI SDK model invocation and structured-output mechanics fit below the existing
  request/result semantics;
- an injected model keeps vendor selection outside the cognition contract;
- deterministic SDK mocks are sufficient for offline end-to-end cognition tests;
- no SDK session, message, result, provider, or agent type needs to enter canonical
  Ember state;
- Codex and Cursor process adapters can remain behaviorally unchanged.

It also turns one research prediction into concrete evidence: the current
`ProviderInvoker` function still carries `command` and `arguments_` because all
previous production backends were external processes. The in-process AI SDK adapter
has no truthful use for those parameters and ignores them.

That is now an earned pressure to revisit the invocation function shape, but not a
reason to combine the change with #186. Request/result semantics remain sound, and
leaving the small mechanical awkwardness visible keeps this task focused and avoids a
provider hierarchy invented merely to hide two unused parameters.

A later cleanup may move command/argument configuration into process-adapter closures
and reduce the invocation operation conceptually to:

```text
(ProviderRequest, ProviderInvocationOptions) -> ProviderResult
```

Such a change should preserve the same Ember-owned DTOs and failure tests.

## Replacement path

Vercel AI SDK is replaceable at this boundary. A different toolkit or custom direct
provider implementation can replace `createAiSdkProvider` if it can:

1. accept the already-selected `ProviderRequest` without reaching into canonical
   state;
2. honor Ember timeout/cancellation options and map failures to `ProviderError`;
3. return an Ember `ProviderResult` rather than foreign SDK result/session types; and
4. pass `validateProviderResult` before the result reaches canonical cognition state.

No migration of Ember memory, identity, lineage, projection, delegation, authority, or
persistence would be required because AI SDK owns none of those concepts here.

## Deterministic evidence

`tests/ai-sdk-provider.test.ts` exercises the adapter through production `runCognition`
with AI SDK's deterministic mock language model. The tests establish that:

- only the selected projection plus current input reaches the model call;
- a structured result becomes an ordinary completed Ember cognition;
- a schema-valid out-of-projection meaning claim is rejected by Ember validation;
- malformed structured model output becomes an Ember provider failure;
- timeout, explicit cancellation, and model failure map to the existing cognition
  failure vocabulary;
- the failed call is not retried implicitly; and
- mock provider/model/response identifiers do not enter canonical Ember state.

Those tests are the replacement oracle for this integration boundary. Future AI SDK
features should extend them only when a concrete new mechanic is adopted.
