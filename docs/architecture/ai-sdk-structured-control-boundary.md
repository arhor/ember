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

`src/ai/opportunity.ts` adds one implementation of that boundary
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

The schema requires the object shape, the decision enum, a string list, and no
unsupported fields. Because AI SDK's `jsonSchema` accepts JSON Schema as provider
metadata unless local validation is supplied, the adapter also provides its supported
`validate` callback. This means provider-native structured generation and adapter-local
runtime validation enforce the same representation shape even when a provider does not
enforce the schema itself.

That local validator deliberately stops at representation. The ordinary Ember
cognition-opportunity boundary remains authoritative for:

- whether every selected meaning belongs to the permitted projection;
- whether selected IDs are unique;
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

## Subscription-runtime bridges

Issue #315 added bounded AI SDK `LanguageModelV4` bridges for the subscription-backed
Codex and Cursor CLIs. Their ordinary cognition and control calls now share the same
SDK structured-output mechanics. Codex supplies the requested JSON Schema through its
native output-schema argument; Cursor receives the schema inside its isolated,
tool-denied prompt and Ember validates the returned object through the SDK output
contract.

`src/ai/codex-opportunity.ts` is now a thin composition adapter over the
shared typed opportunity evaluator. It no longer parses exact decision tokens or
embeds decisions inside an ordinary cognition reply.

## Repository sweep

The issue #315 follow-up sweep also migrated production memory proposal generation,
onboarding progress, opportunity evaluation, and setup verification. Those paths no
longer parse typed decisions from `ProviderResult.reply`. The explicit generic process
backend retains its compatibility wrappers because its external protocol cannot
represent arbitrary output schemas.

No natural-language cognition reply, eval fixture, interruption rule, or provider
contract was generalized as part of this task.

## Deterministic evidence

`src/ai/opportunity.test.ts` covers:

- `cognition`, `defer`, and `no_cognition` through AI SDK structured output;
- exclusion of mechanism/current-input control data from the model request;
- schema-invalid decisions rejected by AI SDK local structured validation before
  Ember semantic validation;
- schema-valid but projection-invalid selected meaning IDs rejected by the Ember
  opportunity boundary; and
- retryable provider failure remaining a single invocation because retries are
  disabled.

The Codex and Cursor provider suites additionally prove that a non-ordinary onboarding
schema crosses each bridge without action tools or an ordinary reply envelope.
