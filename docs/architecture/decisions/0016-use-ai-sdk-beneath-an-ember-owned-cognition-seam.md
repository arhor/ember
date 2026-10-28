---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0016: Use AI SDK beneath an Ember-owned cognition seam

## Context and Problem Statement

Issues [#186](https://github.com/arhor/ember/issues/186),
[#188](https://github.com/arhor/ember/issues/188),
[#189](https://github.com/arhor/ember/issues/189), and
[#197](https://github.com/arhor/ember/issues/197) adopted shared generation, tool-loop,
structured-output, and lifecycle mechanics without transferring Ember semantics to
Vercel AI SDK. This C05 record extracts the decision from the
[adapter reference](../ai-sdk-cognition-adapter-boundary.md).

That source cites adoption-era `ai@7.0.93`; the manifest inspected for migration pins
`ai@7.0.153`. Historical versions are evidence, not a new dependency constraint.
No current external SDK documentation or live provider behavior was re-evaluated.

## Decision

Use AI SDK for model invocation, structured syntax, tool-loop mechanics, streaming,
and supported lifecycle/error translation beneath the Ember-owned operation
`(AiExecutionRequest, AiExecutionOptions) -> AiExecutionResult`.
Executable commands, environments, workspaces, continuation, SDK model/result/event
types, and provider configuration stay in concrete adapters.

The application builds the least-sufficient projection and selects capability bindings
before SDK tool definitions are constructed. Supply those bindings per call in options,
not in the semantic request or through a provider-owned selector. Disclose only the
selected projection, current input, and selected capability definitions. Neither the
model nor SDK discovers broader authority from ambient capability reachability.

Structured output proves shape. `validateAiExecutionResult` independently rejects
meaning IDs outside the supplied projection before canonical completion. The same
Ember capability firewall checks authority, semantic inputs, occurrence limits,
execution outcomes, cancellation uncertainty, and retry safety inside the tool loop.
A tool result is bounded operational evidence, not automatically canonical meaning.

Keep automatic SDK model retries disabled (`maxRetries: 0`), the current four-step
ordinary tool-loop bound, and the shared positive finite timeout/maximum-timeout
contract. Bounds are operational, not proof of semantic completion. Repeated
`at_most_once_per_cognition` attempts remain `occurrence_blocked`.

Translate failure into Ember outcomes: selector rejection precedes model/tool work;
selection cancellation/timeout likewise prevents invocation; caller abort means
`cancellation_requested`; SDK timeout means `timed_out` and is classified before later
caller cancellation. Use the standard timeout code rather than error-name matching.
Schema, API, retry, and tool-shape failures remain distinguishable from final Ember
provenance validation failures. No SDK cancellation creates direct-child-exit proof.
Once a capability executor is entered, abort may mean `outcome_unknown` and unsafe
retry; inference events cannot weaken that effect uncertainty.

Normalize inference evidence through the optional Ember-owned sink: provider/model
identity, effective retry limit, normalized step/finish/usage/warning shapes, tool
**dispatch** observations, aggregate completion, and bounded failure category/phase,
status, and retry reason. Omit prompts/messages, tool arguments/results/IDs, response
IDs/headers/bodies, raw usage, warning free text, and provider-defined metadata.
Sink failures cannot change cognition success. SDK observation ordering is not
canonical event ordering. Do not promote response/model/tool IDs into
`operational.externalThreadId`; that field denotes an actual opaque continuation handle.

Keep provider trust/configuration differences explicit. Ollama uses an already-running,
credential-free machine-local service: require a model and constrain configured HTTP
base URLs to loopback (default `http://127.0.0.1:11434`); do not start it or pull models.
DeepSeek is a hosted API-key provider: resolve `DEEPSEEK_API_KEY` from the process
environment, never a CLI flag, persisted setup/Telegram config, or setup diagnostic.
Its provider setup carries kind/model/timeout rather than command/base URL. Development
scripts may load ignored `.env.local`; installed binaries and CI rely on their supplied
environment. These differences do not change the semantic execution seam.

Non-goals: SDK-owned memory, identity, projection, authority, workflow runtime,
telemetry backend, canonical persistence, or sessions as continuity. Streaming follows
[ADR 0011](0011-keep-streamed-cognition-provisional-until-final-validation.md).

## Consequences

- Provider mechanics are replaceable without migrating Ember meaning or persistence;
  any replacement must retain all six replacement conditions in the source reference.
- A narrow translator and deterministic fixtures need maintenance when SDK interfaces
  change. Provider availability is not evidence that a new provider should be adopted.
- Dispatch and inference diagnostics cannot establish effect completion or safe retry.
- Some API/retry/unknown failures retain SDK errors as in-memory
  `ProviderError.cause`, including inputs to Claude authentication classification.
  Those causes are not semantic results or normalized inference evidence. Redaction
  at those output boundaries does not imply complete in-memory cause isolation.
  Changing cause handling requires an implementation assessment; this migration
  corrects the older source claim without changing runtime behavior.

## Implementation Plan

- **Affected paths:** [execution contract](../../../packages/core/src/ai/contract.ts),
  [cognition adapter](../../../packages/core/src/ai/cognition.ts),
  [Ollama bridge](../../../packages/core/src/ai/ollama.ts),
  [DeepSeek bridge](../../../packages/core/src/ai/deepseek.ts), application preparation/
  execution under `packages/core/src/app/`, and the source reference.
- **Dependencies/configuration:** preserve installed manifests; add/update none.
  Existing AI SDK and provider packages remain operational choices recorded by the
  manifests, not adoption-era patch pins. Preserve existing provider configuration.
- **Patterns to follow:** injected model, selected per-call capabilities, structured
  output plus independent semantic validation, bounded plain-data evidence.
- **Patterns to avoid:** canonical-state reads inside SDK mechanics, ambient tool
  discovery, unsafe retries, or dispatch callbacks treated as effect evidence.
- **Migration:** transfer decision ownership; retain provider setup,
  evidence fields, failure matrix, exact dated observations, and replacement criteria
  in the existing reference. Do not edit runtime code or active packages in this phase.

### Verification

- [x] Direct cognition, capability, and failure-classification tests pass:
      `node --test tests/ai-sdk-provider.test.ts tests/ai-sdk-capabilities.test.ts tests/ai-sdk-failure-classification.test.ts`.
- [x] `node --test packages/core/src/ai/ollama.test.ts packages/core/src/ai/deepseek.test.ts`
      passes for provider configuration; no live endpoint or credential is required.
- [x] Source review preserves provider trust differences, evidence exclusions, timeout/
      abort precedence, unsafe-effect uncertainty, and all six replacement conditions.
- [x] The source/code disagreement is resolved in documentation: some causes remain
      in memory, while semantic results and normalized evidence exclude raw SDK causes.

## Alternatives Considered

- Custom direct-provider mechanics: retain maximal control but duplicate structured
  output, lifecycle, errors, and tool-loop plumbing. Remain a possible replacement
  where evidence justifies it and the same Ember contract can be met.
- Adopt an SDK-owned agent/session/workflow: offers higher-level orchestration but
  would transfer ownership not earned by this integration. Keep mechanics beneath
  the Ember seam instead. Provider exceptions remain evidence-driven.

## More Information

Constrained by accepted ADRs 0002–0005 and the [capability execution reference](../capability-execution-boundary.md).
Revisit when an SDK change cannot preserve the seam, selected disclosure, safe execution,
or bounded evidence. Current tests are selected deterministic evidence, not a universal
proof about every external model, runtime policy, or host environment.

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
