---
summary:
  "Issue #199 boundary for provisional cognition streaming through an Ember-owned provider observer backed by Vercel AI
  SDK streamText, while final ProviderResult validation remains the only semantic completion boundary."
read_when:
  - "Adding or changing provisional model output streaming"
  - "Using AI SDK streamText in an Ember cognition provider"
  - "Deciding whether streamed output may be persisted, replayed, or treated as completed cognition"
role: design
discovery_status: current
---

# AI SDK Streaming Cognition Boundary

## Decision

Issue [#199](https://github.com/arhor/ember/issues/199) adds streaming as an optional capability beside the existing
buffered provider path. It does not replace `generateText` for callers that do not need provisional output.

The shared seam remains SDK-independent:

```text
ProviderRequest
        |
        v
ProviderInvoker
        |
        +-> optional ProviderStreamObserver
        |      |
        |      +-> provisional_text_snapshot
        |
        v
ProviderResult
        |
        v
validateProviderResult
        |
        v
canonical cognition completion
```

`ProviderInvocationOptions.stream` accepts an optional `ProviderStreamObserver`. The observer receives only Ember-owned
plain data:

```ts
{
  kind: "provisional_text_snapshot";
  text: string;
}
```

No AI SDK stream part, message, model, provider metadata, step object, tool-call object, or result type crosses this
seam.

## Snapshot semantics

A stream observation is explicitly **provisional**. Its `text` is the latest reply snapshot, not an append-only token
delta and not a completed expression. Consumers may replace previously displayed provisional text with a newer snapshot.

This choice makes replay semantics deliberately conservative. Ember does not persist these snapshots in canonical state,
does not reconstruct them after restart, and does not silently replay them during reconciliation. A surface that chooses
to show a snapshot must treat it as ephemeral operational presentation whose outcome remains unknown until the provider
invocation completes.

A provisional observation is therefore not evidence that:

- Ember adopted the text as meaning;
- an expression completed;
- `usedMeaningIds` are valid;
- a tool or external side effect completed;
- the same text is safe to replay; or
- the provider invocation will eventually succeed.

Observer failures are ignored by the AI SDK adapter. Failure to display provisional presentation cannot convert
otherwise valid cognition into a semantic provider failure. The ordinary final delivery path remains independently
responsible for reporting its own failures.

## AI SDK implementation

`createAiSdkProvider` keeps its existing buffered behavior when no stream observer is supplied. That path still uses
`generateText`.

When a caller supplies `ProviderInvocationOptions.stream`, the same adapter uses AI SDK `streamText` with the same
bounded prompt, structured `Output.object`, selected tools, step limit, retry policy, timeout, abort signal, capability
firewall, and lifecycle evidence callbacks as the buffered path.

The adapter consumes AI SDK `partialOutputStream` only to derive reply snapshots from the partially generated structured
output. It does not forward raw SDK chunks. A snapshot is emitted only when a non-empty partial `reply` changes.

After streaming finishes, the adapter awaits the final structured output and runs the unchanged Ember
`validateProviderResult` check against the selected projection meaning IDs. Only that validated final `ProviderResult`
can reach `runCognition` completion and canonical expression evidence.

This preserves the governing boundary:

> **AI SDK owns stream mechanics; Ember owns what partial output means and when cognition is complete.**

## Failure and cancellation truthfulness

AI SDK `onError` and `onAbort` participate in the streaming lifecycle rather than Ember inventing a parallel token-loop
lifecycle. Existing `onStart`, `onStepEnd`, tool execution, and `onEnd` evidence callbacks remain in place.

If the model stream fails after one or more snapshots were observed, those snapshots remain provisional and the provider
invocation fails. `runCognition` therefore records the ordinary failed provider outcome without creating completed
expression evidence. The visible partial output and the final failed outcome are intentionally distinct facts.

Caller aborts continue to use the existing `AbortSignal` and Ember `cancellation_requested` semantics. An abort after
provisional output does not promote that output to completed state. Timeout/error translation remains the same
Ember-owned provider error boundary used by buffered generation.

## Capability execution

Streaming does not create a second tool path. `streamText` receives the same AI SDK tool definitions backed by
`createCapabilityExecutionFirewall` as `generateText`.

The firewall remains authoritative for authority, semantic input constraints, occurrence limits, cancellation
uncertainty, retry safety, and execution evidence. Provider stream observations never contain tool inputs, tool outputs,
call IDs, or provider lifecycle metadata and cannot be interpreted as effect-completion evidence.

## First consumer

The first consumer is deliberately a deterministic test/event sink rather than a UI transport. Tests wrap the production
`ProviderInvoker` and add a `ProviderStreamObserver` for that invocation, then execute through the ordinary
`runCognition` path.

This proves the seam end to end while keeping interaction surfaces unchanged. Telegram edit-in-place behavior remains
outside this task until the Telegram transport/framework boundary is established.

## Deterministic evidence

`tests/ai-sdk-streaming.test.ts` uses AI SDK's mock language model and simulated streams to cover:

- ordered provisional reply snapshots followed by successful final completion;
- final `usedMeaningIds` validation remaining authoritative after visible partial text;
- failure after visible partial output without completed expression evidence;
- cancellation after provisional output;
- streamed tool calls continuing through the Ember capability firewall; and
- exclusion of provisional text, SDK call IDs, and stream mechanics from canonical state.

Existing non-streaming AI SDK tests continue to use `generateText`, and Codex/Cursor or other non-streaming providers
require no changes.
