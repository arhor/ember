---
summary: "Issue #198 boundary for using Vercel AI SDK structured output to represent typed model-control decisions without transferring Ember decision semantics or provenance authority to the SDK."
read_when:
  - "Changing AI SDK-backed cognition opportunity evaluation or another typed model-control decision"
  - "Deciding whether a model control result belongs in ProviderResult or a narrower typed Ember contract"
  - "Replacing prompt-level exact-token or JSON control protocols with structured generation"
role: design
discovery_status: current
---

# AI SDK Structured Control Boundary

> Status: current implementation boundary for issue #198. This extends the
> [Endogenous Cognition Decision Boundary](endogenous-cognition-decision.md) without
> changing its semantic contract.

## Decision

Ember already had the typed seam needed by this task:

```text
CognitionOpportunityRequest
        |
        v
CognitionOpportunityEvaluator
        |
        v
CognitionOpportunityEvaluation
```

Issue #198 therefore does **not** introduce a generic structured-generation port and
does not turn `ProviderResult` into an arbitrary schema carrier. The existing
`CognitionOpportunityEvaluator` is the Ember-owned control boundary.

`src/agency/ai-sdk-opportunity-evaluator.ts` adds one implementation of that boundary
for in-process AI SDK `LanguageModel`s. AI SDK 7.0.93 owns the mechanical structured
output step through `generateText` + `Output.object` + `jsonSchema`.

## Structured syntax versus Ember semantics

The adapter-local output schema constrains only the mechanical representation:

```json
{
  "contractVersion": 1,
  "decision": "cognition | defer | no_cognition",
  "selectedMeaningIds": []
}
```

The schema can require the object shape, the decision enum, a unique string list, and
no unsupported fields. Those are syntax/shape mechanics.

The schema deliberately does **not** decide whether the result is semantically valid.
The ordinary Ember cognition-opportunity boundary remains authoritative for:

- whether every selected meaning belongs to the permitted projection;
- whether `cognition` or `defer` is grounded by at least one projected meaning;
- whether `no_cognition` selects no meaning;
- provenance/currentness rules represented by the validated projection; and
- whether the validated decision may become durable opportunity state.

A schema-valid object can therefore still be rejected by Ember semantic validation.
That separation is covered deterministically in the adapter tests.

## What the model sees

The AI SDK evaluator receives only the already-bounded
`CognitionOpportunityRequest.projection`. It does not receive the opportunity
mechanism, scheduler topic, wake-up explanation, external trigger payload, or a
fabricated ordinary `current_input`.

The fixed instruction explains the meaning of the three decisions and grounding IDs,
but there is no `Reply with exactly one token` protocol and no parsing of free-form
`reply` text. The decision arrives through AI SDK structured output.

The adapter uses `maxRetries: 0`. A retryable provider failure is therefore observed as
failure rather than silently causing another model invocation.

## Error boundary

AI SDK errors remain adapter-local. The evaluator translates:

- malformed/schema-invalid structured output into Ember `ValidationError`;
- timeout into `ProviderError` with `timed_out` outcome;
- caller cancellation into `ProviderError` with `cancellation_requested` outcome;
- provider/API and retry-policy failure into bounded `ProviderError` messages; and
- other AI SDK failures into a generic Ember-owned provider failure.

Provider request/response payloads and SDK error objects are not promoted into the
cognition-opportunity contract or canonical state.

## External-runtime compatibility

`src/agency/codex-opportunity-evaluator.ts` remains available for the
subscription-backed Codex CLI path. That runtime still sits behind the ordinary
`ProviderInvoker` contract and therefore retains its adapter-local exact-token
compatibility protocol.

This is intentional rather than an incomplete migration. Issue #198 requires
structured mechanics where the backend supports them, but explicitly preserves
non-AI-SDK external runtimes. Replacing the Codex compatibility protocol would require
a supported typed-output mechanism in that external runtime, not an AI SDK type leak
into the shared agency contract.

## Repository sweep

The production sweep for issue #198 found no second earned model-control parser to
convert. The only `result.reply.trim()` control parsing is the Codex opportunity
compatibility adapter. Other matches are ordinary `ProviderResult` validation or
experimental code, not another production typed control decision.

No natural-language cognition reply, eval fixture, interruption rule, or provider
contract was generalized as part of this task.

## Deterministic evidence

`src/agency/ai-sdk-opportunity-evaluator.test.ts` covers:

- `cognition`, `defer`, and `no_cognition` through AI SDK structured output;
- exclusion of mechanism/current-input control data from the model request;
- schema-invalid decisions rejected as structured-output failure;
- schema-valid but projection-invalid selected meaning IDs rejected by the Ember
  opportunity boundary; and
- retryable provider failure remaining a single invocation because retries are
  disabled.

The existing `src/agency/codex-opportunity-evaluator.test.ts` continues to prove the
external-runtime path remains available independently of AI SDK.
