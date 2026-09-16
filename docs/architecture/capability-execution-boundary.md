---
summary: "Issue #189 design for Ember-owned model-facing capability selection, authority checks, bounded execution evidence, occurrence control, and AI SDK tool-loop mechanics."
read_when:
  - "Adding or changing a model-visible capability, tool source, or capability executor"
  - "Changing authority, approval, argument constraints, retries, cancellation, timeout, or effect evidence around model tool calls"
  - "Replacing AI SDK tool mechanics or adding MCP behind Ember capability semantics"
  - "Changing the approved Google Calendar event creation capability or its durable effect evidence"
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

## Read-only Google Calendar capability

Issue #231 adds the first external read capability behind this boundary. Ember calls
Google Calendar REST directly. Setup now requests `calendar.events` so the same
credential can reach the separately approval-gated issue #233 write capability; this
technical scope does not authorize writes. The
model supplies only a positive RFC 3339 UTC interval of at most 31 days; Ember injects
the configured calendar and timezone, requests at most 20 ordered expanded events,
and permits one request per cognition.

The adapter returns only observation time, a hashed source/event correlation ID,
configured source label, interval, collection freshness evidence, truncation, and
title/status/start/end/source-update evidence. Descriptions, attendees, locations,
links, conference data, calendar addresses, credentials, and Google errors do not
cross the capability boundary. `source_unavailable` and `source_stale` are explicit
failure outcomes and never carry events. Observations remain episode-local tool
evidence and are neither cached nor promoted into canonical state automatically.

## Approved Google Calendar event creation

Issue [#233](https://github.com/arhor/ember/issues/233) adds the first consequential
capability. `googleCalendarCreateEvent` creates one bounded event with an exact title,
start, end, and configured timezone. It deliberately excludes attendees, descriptions,
conference links, recurrence, reminders, and update notifications. Google credentials,
calendar IDs, access tokens, and the deterministic external event ID remain inside the
adapter.

Ordinary configured Claude Code cognition can first call
`googleCalendarProposeEvent`. That non-effectful capability persists a 15-minute
proposal grounded in the current cognition and returns its exact proposal ID, payload
digest, parameters, purpose, consequence, and expiry for presentation. It grants no
authority. The proposal digest also binds an adapter-local fingerprint of the Calendar
resource and credential/config generation while exposing only the configured target
label. Reconfiguration therefore blocks a not-yet-started old proposal instead of
redirecting it. Once an attempt is prepared, the attempt durably retains its
adapter-local recovery binding so later reconfiguration cannot strand accounting for
a possibly submitted effect.

On the trusted local CLI, `:show-action PROPOSAL_ID` renders and durably correlates the
exact target label, event, purpose, consequence, digest, and expiry in the active scope.
Only after that presentation can the principal use `:approve-action PROPOSAL_ID
PAYLOAD_DIGEST QUOTED_MATERIAL_CONFIRMATION` or the corresponding `:reject-action` on
the same surface and scope. The final argument must exactly restate the human-readable
target, action, purpose, consequence, and expiry emitted by `:show-action`; presentation
or transport evidence alone does not establish awareness.
`:withdraw-action PROPOSAL_ID REASON` and `:supersede-action PROPOSAL_ID REASON`
durably revoke a not-yet-started approval. A later cognition may execute only the
exact approved payload. This makes propose, decide, and execute reachable through the
ordinary runtime without treating model interpretation as the human decision.

`ActionProposalStore` persists the proposal, integrity-bound payload, provenance,
principal/scope boundary, expiry, exact decision, and one execution attempt in the
canonical state sidecar `<state>.actions.json`. Capability authorization reloads that
ledger, requires a matching current approval, and rejects absent, rejected, expired,
mismatched, withdrawn, superseded, executed, failed, or uncertain proposals. Sidecar
mutations use a dedicated cooperating writer lease, and nested decision, invalidation,
and attempt evidence is validated exactly against the proposal lifecycle. A restart
therefore does not turn approval into a provider-session flag or make it reusable.

Immediately before insertion, the adapter checks the proposal-derived Google event ID,
then durably records prepared and submitted attempt phases around request submission.
Restart reconciliation first correlates principal, scope, capability, and payload
against the persisted proposal, then uses the persisted payload rather than untrusted
new tool input. It reconciles prepared attempts as not submitted and submitted attempts against
the deterministic event ID. An exact event including timezone is confirmed success; a
conflicting event is confirmed failure. Absence after submission cannot prove the event
never existed, so it remains `outcome_unknown`. Non-2xx and lost responses use the same
reconciliation instead of being assumed failures, and no ambiguous effect is retried
under the old approval. Authentication and currentness transport failures before the
attempt are safely retryable `not_started` failures. Malformed 2xx responses after
submission produce `outcome_unknown` in both the durable action ledger and capability
evidence.

Deterministic coverage lives in `src/capabilities/google-calendar-create.test.ts`.
The opt-in real smoke requires a refresh token granted the
`https://www.googleapis.com/auth/calendar.events` scope and runs with:

```bash
EMBER_GOOGLE_CALENDAR_CONFIG=/absolute/path/to/calendar.json \
EMBER_GOOGLE_CALENDAR_EVENT_TITLE='Ember live smoke' \
EMBER_GOOGLE_CALENDAR_EVENT_START='2026-09-18T08:00:00Z' \
EMBER_GOOGLE_CALENDAR_EVENT_END='2026-09-18T08:15:00Z' \
EMBER_GOOGLE_CALENDAR_EXACT_APPROVAL='Ember live smoke|2026-09-18T08:00:00Z|2026-09-18T08:15:00Z' \
npm run smoke:google-calendar-create:live
```

The repeated exact approval value is an explicit smoke-test safety interlock, not a
general approval UI or evidence that environment variables constitute human authority.
