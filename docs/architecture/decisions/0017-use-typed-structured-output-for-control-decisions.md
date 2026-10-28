---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0017: Use typed structured output for Ember-owned control decisions

## Context and Problem Statement

Issue [#198](https://github.com/arhor/ember/issues/198) needed model-backed opportunity
evaluation without encoding typed control decisions in ordinary cognition replies.
The existing `CognitionOpportunityEvaluator` already provided an Ember-owned typed
boundary. Issue [#315](https://github.com/arhor/ember/issues/315) later brought
subscription-backed Codex/Cursor calls and other structured controls onto the same
SDK mechanics. This C06 record extracts the [structured-control source](../ai-sdk-structured-control-boundary.md).
Its AI SDK 7.0.93 references describe adoption-era evidence; the current manifest
pins 7.0.153. No package update is proposed.

## Decision

Keep `CognitionOpportunityRequest -> CognitionOpportunityEvaluator ->
CognitionOpportunityEvaluation` as the control boundary. Use AI SDK
`generateText` with `Output.object` and `jsonSchema` beneath it. Do not introduce
a generic structured-generation port or turn `AiExecutionResult` into an arbitrary
schema carrier. Do not parse exact tokens or embed control decisions in `reply`.

The representation is exactly `contractVersion: 1`, decision
`cognition | defer | no_cognition`, and string-list `selectedMeaningIds`, with
no extra fields. Supply a local runtime validator alongside the JSON Schema so
shape is enforced even if the provider does not enforce schema metadata.

Ember then independently validates permitted projection membership, unique IDs,
nonempty grounding for cognition/defer, no selected meaning for no_cognition,
provenance/currentness, and eligibility for durable opportunity state. A schema-valid
object can fail this semantic gate; the adapter must not persist it itself.

Disclose only the bounded request projection and fixed decision instruction. Do not
supply scheduler mechanism, wake-up reason, external trigger payload, or fabricated
ordinary `current_input` as motive. Set `maxRetries: 0` so a retryable provider failure
remains one observed invocation.

Translate malformed/schema-invalid output to Ember `ValidationError`, timeout to
`ProviderError` with `timed_out`, caller cancellation to `cancellation_requested`,
and API/retry/other SDK failures to bounded Ember-owned provider failures. SDK error
objects and request/response payloads do not become opportunity state or its contract.

Codex supplies JSON Schema through the native output-schema option; Cursor receives
it in an isolated tool-denied prompt, with returned objects validated through the SDK
contract. Memory proposal generation, onboarding progress, opportunity evaluation,
and setup verification use their own typed schemas, not ordinary reply parsing.
The explicit generic process backend retains compatibility wrappers where its
external protocol cannot represent arbitrary schemas.

Non-goals: changing opportunity semantics, interruption rules, natural-language
cognition, provider contracts, or making fixtures/ordinary replies generic controls.

## Consequences

- Control syntax is checkable independently of domain semantics; retain both test gates.
- Each control keeps its own domain contract rather than hiding behind one arbitrary
  schema API. Provider bridges must support non-ordinary schemas without action tools.
- Process compatibility remains an explicit exception rather than proof that all
  provider protocols have identical capabilities.

## Implementation Plan

- **Affected paths:** [opportunity adapter](../../../packages/core/src/ai/opportunity.ts),
  [semantic opportunity boundary](../../../packages/core/src/agency/cognition-opportunity.ts),
  and shared provider/control adapters under `packages/core/src/ai/`.
- **Dependencies/configuration:** no additions, upgrades, schema version change, or
  environment keys. Keep current model/timeouts and abort support.
- **Patterns to follow:** schema plus local shape validator, then domain validation;
  bounded projection only; typed control outputs independent of cognition reply.
- **Patterns to avoid:** control motives derived from scheduler payload, implicit
  retries, schema validity treated as semantic authorization, or generic reply parsing.
- **Migration:** transfer decision ownership under this accepted record; retain the source's
  bridge history, mechanics, sweep scope, and compatibility caveats as a reference.
  This ADR now owns the decision; no package code changes are required.

### Verification

- [x] `node --test packages/core/src/ai/opportunity.test.ts` passes for all three
      decisions, local schema rejection, projection/duplicate rejection, and no retry.
- [x] Codex/Cursor tests preserve non-ordinary structured onboarding output without
      action tools: `node --test tests/codex-provider.test.ts tests/cursor-provider.test.ts`.
- [x] Source review confirms the generic process exception, projection-only disclosure,
      independent durable semantic gate, and scope of the #315 sweep remain explicit.

## Alternatives Considered

- Exact decision tokens or reply-envelope parsing: cheap for a single decision but
  mixes natural-language cognition with typed controls and weakens structural validation.
- A generic structured-generation port: reusable in principle, but the source already
  has the required domain seam; a new abstraction adds indirection without a requirement.

## More Information

See [endogenous cognition](../endogenous-cognition-decision.md) for the semantic
control contract and [AI SDK boundary](0016-use-ai-sdk-beneath-an-ember-owned-cognition-seam.md)
for shared mechanics. Revisit if a new control cannot fit a clear typed domain boundary
or provider bridge; do not infer new semantic permissions from richer output syntax.

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
