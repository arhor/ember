---
summary: "Issue #189 design for Ember-owned model-facing capability selection, authority checks, bounded execution evidence, occurrence control, and AI SDK tool-loop mechanics."
read_when:
  - "Adding or changing a model-visible capability, tool source, or capability executor"
  - "Changing authority, approval, argument constraints, retries, cancellation, timeout, or effect evidence around model tool calls"
  - "Replacing AI SDK tool mechanics or adding MCP behind Ember capability semantics"
role: design
discovery_status: current
---

# Capability Execution Boundary

## Proven boundary

Issue [#189](https://github.com/arhor/ember/issues/189) introduces Ember's first
model-facing capability execution seam. The implementation deliberately keeps the
semantic contract smaller than a plugin system or agent framework:

```text
ProviderRequest
    |
    v
Ember selects CapabilityBinding values for this cognition
    |
    v
AI SDK adapter maps only those bindings to tools
    |
    v
model requests a tool call
    |
    v
Ember capability execution firewall
    +-> authority decision
    +-> semantic argument constraints
    +-> explicit occurrence policy
    +-> execution attempt
    +-> success / denial / rejection / failure / uncertainty evidence
    |
    v
bounded operational evidence returned as the AI SDK tool result
    |
    v
model produces final ProviderResult
    |
    v
Ember validateProviderResult
```

`src/capabilities/execution.ts` owns the capability contract and firewall.
`src/providers/ai-sdk.ts` is only an adapter from that contract to AI SDK `tool` and
`generateText` mechanics. AI SDK `Tool`, tool-call, message, step, approval, and
result types are not domain contracts and are not stored in canonical Ember state.

This preserves the governing rule:

> **AI SDK may own tool-call mechanics; Ember owns whether an action is available,
> permitted, attempted, completed, denied, uncertain, or safe to repeat.**

## Capability selection is not authority

A `CapabilityBinding` is technical reachability plus the model-visible description
and input schema required to call it. The adapter exposes only bindings returned by
`selectCapabilities(request)` for the current cognition.

Selection does not authorize execution. Every requested call still enters the Ember
firewall and receives an independent `CapabilityAuthorityDecision`:

- `authorized` carries an attributable current authority basis;
- `approval_required` records that a new legitimate decision is needed and does not
  execute;
- `denied` records that the requested action is outside the current authority
  envelope and does not execute.

The first representation intentionally supports only authority concepts already
earned by ADR 0004: current instruction, standing authority, and fresh approval.
There is no generic policy DSL. A caller must not return an `authorized` grant for a
stale, revoked, superseded, or materially changed authority source.

AI SDK approval plumbing is not used as the authority oracle. A future UI or runtime
approval mechanism may help obtain a fresh decision, but Ember must interpret that
decision into its own authority semantics before execution proceeds.

## Mechanical schema validation and Ember semantic constraints

Each binding supplies a JSON input schema. The AI SDK adapter maps that schema to the
SDK tool definition, so malformed model tool input is rejected mechanically before
execution.

A binding may additionally provide `validateInput`. That check belongs to Ember and
handles semantic constraints that a generic schema cannot establish. The deterministic
`localLookup` capability demonstrates this distinction: `{ "key": "hidden" }` is
structurally valid, but is rejected when `hidden` is outside the keys selected for the
current capability instance.

The firewall always runs authority and semantic argument checks before marking an
execution attempt.

## Attempt, outcome, and retry evidence

A capability result returned to the model is `CapabilityExecutionEvidence`, not the
raw executor result. It identifies whether execution was attempted and classifies the
observed outcome as one of:

- `succeeded`;
- `authority_denied`;
- `approval_required`;
- `input_rejected`;
- `occurrence_blocked`;
- `cancelled_before_execution`;
- `failed` after an attempt began; or
- `outcome_unknown` when cancellation or timeout is observed after execution began.

The evidence also carries an explicit retry disposition. The first production seam
uses `at_most_once_per_cognition` for every capability binding. Once an execution
attempt begins, a second model request for the same capability in the same cognition
is blocked instead of silently repeating the operation. This is deliberately more
conservative than assuming an executor is idempotent.

AI SDK model retries remain disabled with `maxRetries: 0`. Tool-loop continuation is
bounded separately by a four-step stop condition. That stop condition is an
operational guard only; it does not establish semantic completion or currentness.

## Cancellation and timeout truthfulness

Cancellation before the execution attempt is classified as
`cancelled_before_execution`; the evidence may say retry is safe because Ember has
not called the executor.

Once the executor has been entered, abort changes the claim. If execution rejects
while the signal is aborted, the firewall returns `outcome_unknown` with retry marked
unsafe. It does not infer that the requested effect did not occur merely because the
caller stopped waiting or the executor observed an abort signal.

This first local capability is low risk and does not require a new canonical durable
attempt ledger. `createCapabilityExecutionLedger` provides inspectable episode-local
evidence for tests and callers that need it. A future consequential or crash-sensitive
capability must persist whatever pre-effect attempt evidence and reconciliation state
its semantics require behind this same firewall before starting the external effect.
The absence of a durable record in this local proof must not be generalized into a
rule that effectful capabilities can rely on in-memory evidence.

## Bounded tool evidence is not canonical meaning

Successful executor output is restricted to JSON values and bounded to 8 KiB before
it returns to the model. Denial, failure, and uncertainty are represented as explicit
operational evidence rather than thrown away or converted into success-shaped data.

That evidence is input to the remaining cognition loop only. It is not automatically
adopted as Ember meaning, authority, or observed external truth. The final model
response must still satisfy the existing `ProviderResult` contract, including
`usedMeaningIds` being a subset of the projection selected before invocation.

Canonical cognition state therefore continues to contain Ember-owned cognition and
expression evidence, not AI SDK tool calls, messages, response IDs, step objects, or
`CapabilityExecutionEvidence` objects.

## Deterministic local proof

`src/capabilities/local-lookup.ts` is the first real capability behind the seam. It
looks up one explicitly allowed key from local deterministic data. It is intentionally
small: the purpose is to exercise the real execution firewall without adding shell,
filesystem, network, MCP, or product behavior.

`tests/ai-sdk-capabilities.test.ts` uses AI SDK's `MockLanguageModelV3` through the
production `createAiSdkProvider` and `runCognition` path. It proves that:

- only Ember-selected capabilities are model-visible;
- a selected capability can still be denied by Ember authority without executing;
- schema-invalid input is rejected by SDK mechanics before execution;
- structurally valid but out-of-policy input is rejected by Ember before execution;
- permitted execution returns bounded evidence to a later model step;
- executor failure remains failure-shaped evidence;
- a repeated model request does not cause a second execution attempt;
- capability success cannot bypass final `usedMeaningIds` validation; and
- provider, tool-call, and capability execution metadata do not enter canonical state.

`src/capabilities/execution.test.ts` directly exercises the cancellation boundary,
including safe cancellation before execution and truthful uncertainty after execution
has begun.

## Replacement and extension path

The seam has two independent replacement points.

The model toolkit can be replaced by another adapter that maps selected Ember
`CapabilityBinding` values to its own tool-call mechanics and returns bounded Ember
provider results. No canonical capability or authority model needs to become an AI SDK
type.

Capability sources can also change without changing the firewall. A future MCP
integration may discover or invoke remote capabilities, but it must translate them
into Ember-selected bindings and route execution through the same authority, argument,
occurrence, cancellation, and evidence checks. MCP reachability must not become Ember
authority.

Persistent SDK agents, sessions, memory, delegation, generic plugin discovery, and a
generalized permission language remain outside this boundary.
