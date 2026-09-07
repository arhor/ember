---
summary: "Issue #180 synthesis of Mastra, LangGraph.js, Vercel AI SDK, and OpenAI Agents SDK research into a single-primary-SDK adoption strategy that keeps Ember semantics and canonical state framework-independent."
read_when:
  - "Choosing reusable JS/TS model, tool, MCP, durable-execution, retrieval, tracing, persistence, or evaluation infrastructure for Ember"
  - "Deciding whether Ember should adopt Vercel AI SDK as a primary toolkit or earn an exception for another agent SDK"
  - "Designing framework replacement boundaries, operational persistence, or migration escape hatches"
role: design
discovery_status: current
---

# Composable Agent Infrastructure Adoption Strategy

## Decision

**Do not adopt an agent framework as Ember's architecture, and do not compose several
overlapping agent SDKs by default. Keep Ember's current runtime and semantic
boundaries, then choose one primary infrastructure SDK whose mechanics are used as far
as they remain adequate. The preferred primary candidate is Vercel AI SDK. LangGraph.js,
OpenAI Agents SDK, and Mastra remain challengers or capability-specific escape hatches
that require a concrete, material gap before they are added beside it.**

This changes the optimization target from "best library for every capability" to
**coherent stack first, exceptions by evidence**. Replaceability still matters, but it
is achieved through Ember-owned semantic boundaries rather than by eagerly installing
multiple interchangeable runtimes.

Today Ember already has working and semantically precise boundaries for:

- canonical state, revisions, writer ownership, and durability uncertainty;
- least-sufficient cognition projections and provider-result provenance;
- subscription-backed Codex/Cursor process execution and lifecycle evidence;
- systemd-supervised episodic work;
- specialist purpose, authority, disclosure, cancellation uncertainty, report
  evidence, currentness, and reintegration;
- deterministic semantic acceptance scenarios.

None of the four candidates justifies replacing those boundaries merely because it
has an API named `Agent`, `Memory`, `Session`, `Workflow`, `Thread`, `Handoff`, or
`ToolApproval`.

The synthesis therefore selects two answers for two time horizons:

1. **Immediate posture: defer production adoption until an earned feature needs the
   mechanics.** Research alone adds no production dependency.
2. **Likely first adoption: use Vercel AI SDK as Ember's primary reusable agent
   infrastructure toolkit.** Prefer its provider, structured-output, streaming, tool,
   bounded-loop, MCP, testing, and telemetry mechanics before considering a second
   overlapping agent SDK.

A second agent SDK is justified only after a concrete spike demonstrates that the
primary stack plus Ember's existing custom runtime would otherwise require substantial,
fragile, or semantically risky machinery. LangGraph is the strongest researched
challenger for durable checkpointed execution; OpenAI Agents SDK is the strongest
challenger for a richer bounded runner; Mastra remains a broad toolbox whose individual
primitives may win a later focused comparison.

The governing rules are:

> **Ember owns meaning; dependencies may own mechanics.**
>
> **One primary SDK by default; additional agent runtimes only by demonstrated need.**

## Basis

This synthesis completes issue [#180](https://github.com/arhor/ember/issues/180) and
compares the four completed candidate evaluations:

- [Mastra Composable Infrastructure Evaluation](mastra-composable-infrastructure-evaluation.md)
  from #176;
- [LangGraph.js Durable Execution Evaluation](langgraph-durable-execution-evaluation.md)
  from #177;
- [Vercel AI SDK Modular Cognition Evaluation](vercel-ai-sdk-modular-cognition-evaluation.md)
  from #178;
- [OpenAI Agents SDK JS/TS Execution Toolkit Evaluation](openai-agents-sdk-execution-toolkit-evaluation.md)
  from #179.

The comparison is against Ember's current architecture on **2026-09-07**, especially:

- [Design Principles](../principles.md) and
  [Architecture Acceptance Scenarios](acceptance-scenarios.md);
- [Cognition Adapter Contract Decision](cognition-adapter-contract-decision.md);
- [Long-Lived Runtime Requirements](long-lived-runtime-requirements.md) and ADR 0007;
- [Specialist Authority and Context Flow](specialist-authority-context-flow.md) and
  [Specialist Result Reintegration](specialist-result-reintegration.md);
- `src/providers/contract.ts`, `src/runtime/process-lifecycle.ts`,
  `src/runtime/episodic-runtime.ts`, `src/persistence/state-store.ts`, and
  `src/delegation/codex-specialist.ts`.

Package versions, upstream Node/TypeScript claims, API details, and operational
caveats come from the dated child evaluations. They should be revalidated before a
production dependency is pinned.

No child study measured all four libraries side by side on Ember's Raspberry Pi 5.
Runtime-cost ratings below are therefore **qualitative package/topology pressure**, not
measured RSS, cold-start, or disk results. Every production adoption still requires a
target-host spike.

## Semantic red lines

These are not adapter conveniences. They are architectural constraints that every
candidate loses against if it tries to own them.

| Framework-shaped temptation               | Ember meaning that remains authoritative                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| framework `Agent` object                  | Ember identity, lineage, and constitutive continuity                                           |
| framework thread/session/conversation     | operational continuation only, never Ember continuity                                          |
| message history                           | history evidence, not automatically memory or current context                                  |
| memory/vector/working-memory store        | retrieval or derived context only, never canonical retained meaning by default                 |
| framework workflow/graph/checkpoint state | operational execution position, never canonical Ember truth                                    |
| framework tool availability/approval      | execution mechanics, never capability-plus-authority policy                                    |
| handoff/supervisor/subgraph               | execution routing, never delegation responsibility or reintegration semantics                  |
| cancellation/abort flag                   | evidence of a request/local stop, never proof that external effects did not occur              |
| retry policy                              | mechanical retry decision, never proof that repeating an uncertain effect is semantically safe |
| provider/model response IDs               | opaque continuation evidence, never identity or continuity                                     |
| trace/span IDs                            | diagnostics correlation, never canonical evidence identity                                     |
| framework storage schema                  | operational implementation state, never the only copy of meaning, authority, or effect truth   |
| framework structured-output validation    | syntactic/schema validity, never semantic validity/currentness/provenance                      |

The practical replacement test is severe on purpose:

> Deleting a framework database may lose resumability, caches, traces, derived
> indexes, or unfinished operational work. It must not make Ember forget who she is,
> what she knows, what she was allowed to do, whether an effect is uncertain, or why
> a delegated result was accepted or rejected.

## Capability matrix

### Reading the cells

Each candidate cell uses:

`Maturity / semantic pressure / coupling / runtime cost / replaceability`

with `H`, `M`, and `L` meaning high, medium, and low. For runtime cost, **low is
better**. For replaceability, **high is better**. `—` means the capability is not a
meaningful first-class reason to select that candidate.

The ratings describe use of that capability in Ember, not a general quality score for
the project.

| Capability                            | Mastra                  | LangGraph.js          | Vercel AI SDK         | OpenAI Agents SDK     | Ember decision                                                                                                                                                                                               |
| ------------------------------------- | ----------------------- | --------------------- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| model/provider invocation and routing | H / M / M / M / H       | L / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer AI SDK for a future direct-provider backend.** Keep CLI adapters for current subscription-backed runtimes.                                                                                          |
| structured output                     | H / M / M / M / H       | M / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer AI SDK `Output` mechanics inside a cognition adapter.** Ember still validates provenance/currentness.                                                                                               |
| tool definitions and local execution  | H / M / M / M / H       | H / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer AI SDK for simple model-facing tool plumbing.** Agents SDK becomes interesting when the runner itself is needed.                                                                                    |
| bounded agent/tool loop               | H / H / H / M / M       | H / H / H / M / M     | **H / M / L / L / H** | H / M / M / M / H     | **Prefer AI SDK as part of the primary stack.** Compare Agents SDK only if a concrete bounded-loop requirement proves materially awkward or fragile on AI SDK plus Ember semantics.                          |
| MCP integration                       | H / M / M / M / H       | L / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer a narrow MCP seam.** AI SDK is the best in-scope low-pressure conversion/client candidate; direct MCP SDK remains an escape hatch.                                                                  |
| streaming                             | H / M / M / M / H       | H / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer AI SDK.** Add another streaming/event vocabulary only if the second runtime itself is independently justified.                                                                                      |
| model retries/error normalization     | H / M / M / M / H       | M / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Use AI SDK provider retry/error mechanics by default.** Agents SDK replay-safety signals are a challenger advantage, not a reason to stack runtimes preemptively. Effect retry safety remains Ember-owned. |
| durable execution/checkpointing       | H / M / M / M-H / H     | **H / M / M / M / H** | —                     | M / H / H / M / M     | **Keep Ember/systemd custom today.** If a concrete checkpointed operation exposes a real gap, LangGraph Functional API is the leading second-SDK challenger, not a planned companion.                        |
| suspend/resume and approvals          | H / M / M / M / H       | **H / M / M / M / H** | M / M / L / L / H     | H / M / M / M / M-H   | **Use AI SDK approval plumbing for ordinary bounded work.** Escalate to LangGraph only for earned restart-durable waits; treat Agents SDK `RunState` only as a challenger implementation.                    |
| memory/retrieval infrastructure       | H / **H** / H / M-H / M | H / **H** / H / M / M | L / M / L / L / H     | M / **H** / H / M / M | **Adopt none as Ember memory.** Revisit only rebuildable retrieval/context-compression mechanics after evaluation evidence.                                                                                  |
| delegation/sub-agent mechanics        | H / H / H / M / L-M     | H / H / H / M / L-M   | L / M / M / L / H     | H / **H** / H / M / M | **Keep Ember delegation custom.** Agents-as-tools may be spiked as executor mechanics; handoffs/supervisors/subgraphs do not define responsibility.                                                          |
| tracing/observability                 | H / L / M / M / H       | H / L / M / M / H     | H / L / L / L / H     | H / M / M / M / H     | **Do not adopt a framework only for tracing.** Prefer an Ember trace sink and direct OpenTelemetry where practical; use framework hooks when that framework is already present.                              |
| storage/persistence                   | H / H / H / M-H / M     | H / H / M / M / M     | —                     | M / H / H / M / M     | **No framework store may replace canonical `StateStore`.** Operational persistence belongs to the primitive that owns it and stays disposable/versioned.                                                     |
| eval/testing support                  | H / M / M / M / H       | M / M / M / M / H     | **H / L / L / L / H** | H / L / M / M / H     | Keep Ember acceptance oracles. **Prefer AI SDK mocks with the primary stack.** Use challenger-specific test helpers only after that challenger is independently adopted.                                     |

## What the comparison actually says

### Vercel AI SDK is the preferred primary toolkit

AI SDK has the strongest overall fit for the mechanics Ember is most likely to want
without transferring architecture ownership:

- ordinary function-level model invocation;
- broad provider packages and custom-provider support;
- structured generation;
- streaming;
- model-facing tool schemas and local execution;
- bounded multi-step calls without requiring a persistent agent identity;
- provider-specific options/metadata escape hatches;
- MCP client/tool conversion;
- deterministic model mocks;
- telemetry hooks.

Its most important architectural feature is an absence: Core does not insist on
owning a durable agent object, session store, long-term memory, workflow database, or
server topology. It also has the broadest established TypeScript usage among the
researched candidates, which lowers ecosystem and maintenance risk without deciding
architecture by popularity alone.

The integration advantage is cumulative. Once AI SDK is present for direct cognition,
using the same model/tool/streaming/MCP vocabulary for adjacent mechanics is cheaper
than selecting a locally stronger SDK for every cell in the capability matrix. Ember
should therefore first ask whether AI SDK plus existing Ember mechanics is sufficient,
not which alternative SDK wins an isolated feature comparison.

The adoption trigger remains concrete. AI SDK should first be used when Ember actually
adds a **direct model API backend** or an in-process tool loop. Wrapping the existing
Codex/Cursor CLI adapters in AI SDK would add an interface without removing their
process, authentication, workspace, session, output-bound, cancellation, and
uncertainty mechanics.

### LangGraph is the durable-execution challenger, not a planned companion

LangGraph's Functional API is the strongest evaluated implementation for:

- checkpointed task execution;
- process restart and resume;
- interrupts and later approval/resume;
- replay of completed task results;
- durability modes;
- retries/timeouts;
- state inspection;
- cooperative drain under systemd;
- versioned bounded operational workflows.

Those capabilities are real advantages, but they overlap enough with the rest of an
agent runtime that adding LangGraph is not free merely because Ember isolates it behind
`DurableExecutionPort`. A second lifecycle vocabulary, event model, package surface,
operational store, test matrix, and upgrade path are still integration cost.

The current systemd-supervised episodic runtime remains simpler and already meets the
requirements Ember has earned. If a future operation genuinely needs checkpointed
multi-step restart/resume, first establish the concrete gap in the primary AI SDK plus
Ember runtime. Only if custom filling of that gap would be substantial or fragile
should LangGraph be introduced as a second SDK.

The first legitimate exception case is a naturally long-lived operation that needs to
wait for approval or survive process restart across multiple durable steps.

### OpenAI Agents SDK is an alternative runner, not an extra default layer

OpenAI Agents SDK overlaps directly with the primary AI SDK choice across model
invocation, tools, bounded loops, streaming, approvals, MCP, testing, and tracing.
That makes it more useful as a challenger than as a routine companion dependency.

Its `Runner` becomes worth a focused comparison when one bounded cognition episode
needs enough loop machinery that the AI SDK implementation becomes materially awkward:

- repeated model/tool turns;
- resumable approval interruptions;
- explicit max-turn lifecycle;
- replay-aware model retry decisions;
- function-tool timeouts and cancellation signals;
- rich run evidence;
- deterministic `ScriptedModel` lifecycle tests.

The existence of an official bridge to Vercel AI SDK proves interoperability, not that
Ember benefits from stacking both. The bar is higher: a spike must show that Agents SDK
removes enough complex mechanical code to pay for a second overlapping runtime,
additional types, lifecycle concepts, tests, upgrades, and operational state.

If that bar is met, `Agent`, `Session`, `RunState`, handoffs, and trace types remain
adapter-local. Handoffs are specifically **not** Ember delegation.

### Mastra is a useful toolbox, but not the baseline composition

Mastra's research result was positive on modularity: model routing, tools, MCP,
workflows, storage domains, observability, scorers, and selected memory-processing
surfaces can be used independently enough to sit below Ember seams.

The cross-framework comparison nevertheless removes most reasons to make Mastra a
baseline dependency:

- AI SDK is thinner for generic cognition and tool mechanics;
- LangGraph is a more focused durable-execution candidate;
- direct OpenTelemetry is thinner for generic tracing;
- Ember's own eval harness already owns semantic oracles;
- Mastra memory/supervisor concepts exert strong pressure exactly where Ember has the
  most distinctive semantics.

Mastra remains worth revisiting when an individual primitive wins on its own merits:

- Observational Memory as a rebuildable `ContextCompressor` experiment;
- workflow execution if a concrete case fits Mastra better than LangGraph;
- MCP or eval ergonomics if Ember is already using Mastra elsewhere;
- observability if Mastra automatic instrumentation becomes valuable because another
  Mastra primitive is in the path.

Do not import Mastra merely to gain access to abstractions available more directly
elsewhere.

## Current Ember overlap map

The useful result is not just what Ember could add. It is what current code should
**not** be rewritten.

| Current Ember area                                       | Generic mechanics in that area                                                                          | Candidate reuse                                                              | Decision                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/providers/contract.ts`                              | cognition invocation seam, request/result shapes, abort option                                          | AI SDK is the preferred future direct backend; alternatives are challengers  | **Preserve request/result semantics.** A direct API backend may later justify removing process-shaped `command`/arguments from the invocation call. |
| `src/providers/codex.ts` and `src/providers/cursor.ts`   | subscription-backed CLI invocation, provider/session parsing and evidence                               | none of the four removes the hard parts                                      | **Keep.** Do not wrap working CLI adapters for aesthetic uniformity.                                                                                |
| `src/runtime/process-lifecycle.ts`                       | spawn, bounded streams, timeout/abort, termination escalation and observation                           | generic agent SDKs do not replace it                                         | **Keep custom.** It is already the correct commodity seam for external runtimes.                                                                    |
| `src/core/projection.ts` plus provider-result validation | least-sufficient selected context and provenance claims                                                 | structured output can reduce parsing only                                    | **Keep semantics custom.** AI SDK `Output` may implement syntax inside one adapter.                                                                 |
| `src/persistence/state-store.ts`                         | canonical revision, writer lease, atomic replacement, durability uncertainty                            | framework stores/checkpointers                                               | **Never replace with framework operational storage.** Coexist only below a narrow adapter.                                                          |
| `src/runtime/episodic-runtime.ts` and ADR 0007           | work ownership, systemd supervision, recovery, specialist episodes                                      | LangGraph/Mastra durable execution                                           | **Keep today.** Insert a durable executor inside a worker only after a specific operation earns it.                                                 |
| `src/delegation/codex-specialist.ts` and reintegration   | specialist purpose, disclosure, authority, lifecycle/effect evidence, currentness, report/reintegration | Agents SDK agents-as-tools, LangGraph subgraphs, Mastra subagents            | **Keep semantics custom.** Alternative runtimes may implement the inside of the specialist executor only.                                           |
| future local tool layer                                  | model-facing schemas, loop execution, timeout, approval plumbing                                        | AI SDK first; another agent SDK only after a demonstrated gap                | **Do not invent provider/tool protocol plumbing from scratch.** Add Ember capability/effect wrappers first.                                         |
| future MCP capabilities                                  | protocol transport, discovery, schema conversion                                                        | AI SDK MCP is leading in-scope candidate; direct MCP SDK is replacement path | **Add a transport seam, not framework-owned authority.**                                                                                            |
| context retrieval/compression                            | indexing, candidate retrieval, derived compression                                                      | Mastra semantic recall/Observational Memory; LangGraph Store                 | **No adoption without longitudinal evidence.** Derived artifacts must be rebuildable and provenance-linked.                                         |
| tracing/diagnostics                                      | spans, export, provider/tool timing                                                                     | framework telemetry or direct OTel                                           | **Additive only.** Keep Ember IDs/privacy/retention policy outside the framework.                                                                   |
| tests/evals                                              | model fakes, scorer runners, deterministic lifecycle scripts                                            | AI SDK mocks, Agents SDK `ScriptedModel`, optional Mastra scorers            | **Reuse adapter test mechanics; keep semantic scenarios and expected outcomes repository-owned.**                                                   |

## Ember-owned capability seams

Do not create `AgentFramework`, `AgentRuntime`, or another single interface with a
method for every feature above. That would merely reproduce a framework boundary in
Ember vocabulary and make unrelated capabilities migrate together.

The following small seams are sufficient for the plausible adoption path.

### 1. Cognition invocation

The existing `ProviderRequest` / `ProviderResult` meaning is already the semantic
firewall.

A future direct-provider implementation should converge conceptually on:

```text
CognitionInvoker
  invoke(request, options) -> ProviderResult
```

Issue #186 and the merged in-process AI SDK adapter supplied the direct-provider
evidence anticipated by #92. Issue #188 therefore narrows `ProviderInvoker` to the
Ember-owned `(request, options) -> result` operation; Codex, Cursor, and deterministic
process launch configuration is now closed over by adapter construction instead of
flowing through `runCognition`.

**Ember owns**

- the selected `Projection` and least-sufficient disclosure;
- cognition identity and current input;
- allowed `usedMeaningIds` and semantic result validation;
- canonical currentness and later disposition;
- provider/runtime continuation as opaque evidence rather than continuity;
- cancellation and effect-uncertainty vocabulary.

**Implementation owns**

- provider/model client calls;
- structured-output request/parse mechanics;
- provider wire formats;
- token/content streaming;
- model-call retry/backoff;
- provider warnings/usage/raw metadata collection;
- optional bounded local tool loop.

**Types crossing the boundary:** Ember DTOs only.

**Persisted implementation state:** none required for AI SDK Core. Provider response
or conversation IDs may be copied into Ember-owned operational evidence when useful,
but remain opaque and optional.

**Replacement path:** AI SDK -> direct provider SDK/API, OpenAI Agents runner, Mastra
router, or another implementation. Existing Codex/Cursor closures remain valid
implementations of the same semantic request/result idea.

### 2. Capability catalog and tool execution

Treat model-visible tool description and effectful execution as separate concerns even
if one SDK object can contain both.

```text
CapabilityCatalog
  describe(permittedCapabilityRefs) -> model-facing capability descriptors

ToolExecutor
  execute(capabilityRef, input, authorityRef, attemptRef, signal)
    -> ToolExecutionEvidence
```

**Ember owns**

- stable capability identity;
- which capabilities this episode may even reveal;
- capability versus authority;
- argument/resource authorization after model generation;
- approval policy;
- effect-attempt recording, idempotency/reconciliation policy, and uncertainty;
- provenance of returned observations.

**Implementation owns**

- schema conversion/validation;
- model tool-call encoding;
- local function dispatch;
- timeout/abort plumbing;
- loop result encoding back to the model.

**Types crossing the boundary:** Ember capability descriptors, inputs, and evidence
only. AI SDK `Tool`, Agents SDK `FunctionTool`, or Mastra tool types stay inside
adapters.

**Persisted implementation state:** normally none. Pending approval is persisted as an
Ember occurrence/evidence record; SDK approval tokens are translated or wrapped as
opaque operational data.

**Replacement path:** AI SDK tool -> Agents SDK function tool -> MCP-backed executor ->
custom function executor without changing authority/effect semantics.

### 3. MCP capability source

MCP is a protocol boundary, not a policy boundary.

```text
McpCapabilitySource
  discover(connectionRef) -> capability descriptors
  invoke(capabilityRef, input, transportContext) -> transport observation
```

**Ember owns** server trust, principal scoping, tool visibility, disclosure, resource
and argument authorization, and interpretation/provenance of results.

**Implementation owns** connection/auth transport mechanics, protocol negotiation,
discovery, schema conversion, call framing, transport errors, and optional session
lifecycle.

**Types crossing the boundary:** no AI SDK/Agents/Mastra MCP objects.

**Persisted implementation state:** optional MCP session/transport identifiers only;
never principal identity, continuity, or authority.

**Replacement path:** AI SDK MCP -> official MCP SDK/direct client -> Agents SDK/Mastra
transport -> custom client.

### 4. Durable execution

Do not make all Ember work durable by framework decoration. Introduce this port only
for a bounded operation that genuinely needs restart/suspend/resume.

```text
DurableExecutionPort
  start(kind, input, canonicalFence) -> RunObservation
  resume(runRef, resumeInput, canonicalFence) -> RunObservation
  inspect(runRef) -> RunObservation
  requestCancel(runRef) -> CancellationObservation
```

`OperationalRunRef` contains only engine, execution-definition version, and an opaque
run ID. `CanonicalFence` contains Ember revision/objective/authority references needed
to revalidate continuation.

**Ember owns**

- whether the objective is still current;
- writer lease/canonical revision rules;
- authority at continuation time;
- effect-attempt truth and whether retry is safe;
- approval meaning;
- cancellation uncertainty;
- final canonical mutation or deliberate abandonment.

**Implementation owns**

- checkpoint serialization;
- task/node replay;
- suspend/resume mechanics;
- checkpoint persistence;
- timer/retry/drain plumbing;
- run inspection and operational progress.

**Types crossing the boundary:** no LangGraph `thread_id`, `Command`, snapshots,
node names, Mastra workflow objects, or Agents SDK `RunState`.

**Persisted implementation state:** explicitly operational and versioned. Canonical
truth is referenced, not copied as its sole authoritative representation.

**Replacement path:** LangGraph -> Mastra workflow -> custom state machine/queue.
In-flight runs may need to finish on the old engine, be reconciled and abandoned, or
restart from an Ember-owned safe point. Completed canonical state needs no migration.

### 5. Retrieval and derived context

Retrieval is the place where a generic library can quietly become a theory of memory.
Keep the boundary evidence-shaped:

```text
RetrievalPort
  query(purpose, permittedCorpusRefs, query, limits)
    -> EvidenceCandidate[]
```

**Ember owns** purpose, permitted corpus, source provenance, supersession/currentness,
least-sufficient selection, confidence/uncertainty interpretation, and whether any
candidate enters model context.

**Implementation owns** indexes, embeddings, vector/lexical search, ranking mechanics,
and rebuildable compression/index artifacts.

**Types crossing the boundary:** Ember evidence references plus score/diagnostic
metadata, not framework message/memory objects.

**Persisted implementation state:** derived and rebuildable. Source evidence remains
canonical elsewhere.

**Replacement path:** custom retrieval -> Mastra semantic recall/Observational Memory
adapter -> LangGraph Store/index -> another vector/search implementation.

No candidate is recommended here today. Adoption must be earned by context-selection
or longitudinal evaluation evidence.

### 6. Operational telemetry

```text
ExecutionTelemetry
  startSpan(kind, emberRefs, attributes)
  event(spanRef, kind, attributes)
  end(spanRef, outcome)
```

**Ember owns** correlation IDs, privacy/redaction policy, which model/tool payloads may
be recorded, retention expectations, and interpretation.

**Implementation owns** spans/events, batching, export, and backend-specific data.

**Types crossing the boundary:** simple Ember telemetry DTOs only.

**Persisted implementation state:** disposable diagnostics.

**Replacement path:** direct OpenTelemetry -> AI SDK telemetry -> Mastra observability
-> Agents SDK custom processor -> logs/custom backend.

Prefer direct OpenTelemetry unless a framework already in the execution path provides
meaningfully better automatic spans.

## Deliberately not separate seams

Some attractive-looking interfaces would be premature abstraction.

- **Structured generation** stays an implementation detail of cognition until a second
  independent caller proves it deserves a port.
- **Approval** is an Ember semantic decision represented by Ember DTOs and consumed by
  tool/durable adapters; framework approval APIs implement mechanics only.
- **Operational storage** belongs behind the primitive that owns it. A universal
  `FrameworkStorage` would encourage schema leakage and accidental canonicalization.
- **Agent/session abstraction** is explicitly rejected. There is no generic Ember
  concept that should correspond to these SDK objects.
- **Delegation framework** is rejected. Current specialist contracts are already the
  appropriate semantic boundary; alternative execution engines belong underneath.

## Composition strategies

### Strategy 1: one primary infrastructure SDK behind strict Ember seams

**Preferred candidate:** Vercel AI SDK.

Use one toolkit for the overlapping commodity mechanics it handles adequately, while
keeping Ember-owned DTOs and semantic rules at the boundary:

```text
Ember semantic core
  |
  +-- cognition ---------- Vercel AI SDK
  +-- capability/tools --- Vercel AI SDK wrappers
  +-- MCP ---------------- AI SDK MCP or direct protocol escape hatch
  +-- bounded loops ------ Vercel AI SDK
  +-- streaming ---------- Vercel AI SDK
  +-- testing ------------ Vercel AI SDK mocks
  +-- telemetry ---------- AI SDK hooks / direct OTel
  |
  +-- current systemd runtime, canonical persistence, delegation semantics
      remain Ember-owned
```

**Benefits**

- one dominant model/tool/stream/event vocabulary instead of several overlapping ones;
- one main dependency upgrade and compatibility surface;
- fewer adapters whose only purpose is translating between agent SDK concepts;
- lower package and operational complexity on Raspberry Pi-class deployments;
- easier debugging because a bounded episode does not cross multiple agent runtimes;
- replaceability remains possible because SDK types stop at Ember boundaries.

**Cost:** AI SDK will not be the strongest implementation of every specialized
capability. Ember may retain some custom mechanics that another framework could remove.
That is acceptable until the custom cost becomes concrete and material.

**Disposition:** **preferred strategic destination.** Optimize for stack coherence,
not a collection of per-capability winners.

### Strategy 2: compose lower-level agent libraries by capability

Example of an exception path:

```text
Ember semantic core
  |
  +-- primary mechanics -- Vercel AI SDK
  +-- earned gap --------- LangGraph OR OpenAI Agents SDK OR focused Mastra primitive
```

The previous synthesis treated this as the preferred destination because each library
could independently win one capability. That underestimated integration tax. Even
behind narrow adapters, each additional agent SDK brings its own runtime vocabulary,
state model, events, retries, approvals, tracing, tests, dependency graph, and upgrade
cadence.

**Benefits**

- a genuinely specialized capability can use a mature implementation instead of
  accumulating fragile custom infrastructure;
- a second engine can still be contained below Ember semantic boundaries;
- unrelated canonical state does not migrate when the implementation changes.

**Cost:** duplicate concepts and lifecycle machinery across SDKs, more translation and
failure boundaries, larger dependency/runtime footprint, and a wider compatibility
matrix.

**Disposition:** **exception strategy only.** Add a second overlapping agent SDK after
a focused spike demonstrates a material capability gap in the primary stack and shows
that filling the gap locally would cost more than the extra integration surface.

### Strategy 3: mostly custom runtime with selective commodity libraries

This is effectively Ember today.

Keep:

- systemd runtime supervision;
- canonical `StateStore`;
- process lifecycle;
- Codex/Cursor provider adapters;
- specialist delegation/reintegration;
- projection/provenance/currentness;
- evaluation oracles.

Add low-level helpers when they remove generic code. The first substantial reusable
agent dependency should preferentially be AI SDK rather than several parallel SDKs.

**Disposition:** **preferred current production posture.** It has the smallest runtime
and migration surface while current needs remain narrow.

### Strategy 4: defer adoption but preserve semantic firewalls

The current code is already close to the right shape. The main future pressure is the
process-shaped `ProviderInvoker` signature. Do not change it until a direct provider
spike proves the need. Tool, MCP, durable execution, retrieval, and telemetry seams
should likewise be introduced together with their first real implementation, not as
empty architecture scaffolding.

The purpose of those seams is **replacement freedom**, not permission to compose many
SDKs immediately.

**Disposition:** **recommended immediately.** No new dependency is justified solely by
this research. Let the next earned feature trigger the first AI SDK adapter.

## Recommended staged adoption

### Stage 0: now

- add no framework production dependency merely because #176-#180 completed;
- keep the current runtime, provider, persistence, delegation, and semantic contracts;
- record Vercel AI SDK as the preferred primary infrastructure SDK when the first
  suitable feature arrives;
- require third-party types and IDs to remain below Ember semantic boundaries.

### Stage 1: first direct model/API backend or substantial in-process cognition need

**Preferred implementation:** Vercel AI SDK as the primary reusable toolkit.

Adopt only the packages required by the first real use case plus deterministic mocks.
Prove the current `ProviderRequest`/`ProviderResult` semantics first. If that succeeds,
simplify the process-shaped invocation signature so process configuration moves inside
the Codex/Cursor adapter closures rather than remaining part of the generic call.

This is the highest-value likely adoption because it can remove genuine provider HTTP,
structured-output, streaming, retry, metadata, tool-loop, and testing plumbing that
Ember should not reinvent.

### Stage 2: expand within the primary SDK before adding another agent runtime

When Ember adds model-facing local tools, bounded multi-step cognition, streaming, MCP,
or adjacent telemetry, first implement them with AI SDK mechanics underneath
Ember-owned capability, authority, effect, evidence, and telemetry rules.

Do not use an SDK handoff to introduce specialist delegation. The existing specialist
boundary remains the contract.

A locally imperfect AI SDK implementation is not by itself a reason to add another
framework. The question is whether the missing capability creates enough substantial,
fragile, or duplicated custom machinery to justify a second runtime.

### Stage 3: first demonstrated primary-SDK gap

Only after a focused requirement demonstrates such a gap, compare one challenger
against the primary-stack implementation:

- **restart-durable checkpointed multi-step execution:** LangGraph Functional API is
  the leading researched challenger;
- **richer bounded runner lifecycle:** OpenAI Agents SDK `Runner` is the leading
  researched challenger;
- **a specific workflow, observability, eval, MCP, or context-compression primitive:**
  Mastra may be compared on that primitive alone.

The spike must measure not just code removed by the challenger but also integration
cost: duplicate concepts, package footprint, operational state, event translation,
tests, upgrades, and Pi behavior.

### Stage 4: evidence-driven retrieval/compression and broader tooling

Only after context-selection evaluation shows a concrete retrieval/compression gap,
compare rebuildable backends such as Mastra Observational Memory/semantic recall or a
custom index.

Observability/eval helpers may be adopted earlier if they independently save enough
code, but they should not pull in a second agent runtime by gravity.

## Persisted-state and migration escape hatches

| Foreign state                      | Risk if adopted                           | Required containment                                                | Replacement behavior                                                                 |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| AI SDK model/result/tool types     | medium if leaked through public contracts | translate immediately to Ember DTOs                                 | replace adapter; no canonical migration                                              |
| provider response/conversation IDs | medium if treated as continuity           | opaque optional operational evidence only                           | lose/resume provider context as an operational choice; Ember continuity unchanged    |
| LangGraph thread/checkpoint IDs    | low if opaque                             | `OperationalRunRef` only                                            | new runs use new executor; old runs finish/reconcile/abandon                         |
| LangGraph checkpoint/task state    | medium-high for in-flight runs            | small versioned execution definitions; canonical truth by reference | drain compatible runs or restart from Ember-owned safe point                         |
| Mastra workflow snapshots/run IDs  | medium-high for suspended runs            | same durable-execution containment rules                            | finish on old engine or reconcile/restart                                            |
| Agents SDK serialized `RunState`   | medium-high for interrupted runs          | versioned opaque checkpoint plus Ember currentness fence            | resume with old adapter or abandon/replan; never decode to recover canonical meaning |
| framework sessions/messages        | **high** if sole history/memory copy      | disposable/reconstructable operational cache only                   | discard/rebuild; canonical evidence remains Ember-owned                              |
| memory/vector/observation indexes  | **high** if sole retained meaning         | store source evidence refs; derived artifact must rebuild           | rebuild with replacement retrieval/compressor                                        |
| framework tool schemas/IDs         | medium                                    | generate from Ember capability descriptors                          | regenerate wrappers for replacement SDK                                              |
| framework trace/scorer rows        | low                                       | diagnostics/evaluation evidence only                                | drop/export/migrate without canonical impact                                         |
| hosted service configuration       | medium-high if made mandatory             | local/direct implementation remains possible                        | switch backend without changing core semantics                                       |

### Versioning rules

Every dependency-backed adapter that persists operational state must record an
execution/schema version owned by Ember. Do not use framework package version alone as
the semantic version of an in-flight operation.

Before an incompatible deployment:

1. know which operational runs are in flight;
2. either drain them under the compatible adapter;
3. keep the old execution definition available;
4. or reconcile/abandon them and restart from a canonical safe point.

A framework upgrade must never require migration of Ember identity, canonical meaning,
authority, specialist records, or effect truth.

## Operational recommendation

### Node 26 and TypeScript 7

All candidates are plausible on Ember's Node 26 baseline, but none should be trusted by
inference alone:

- Mastra's reviewed scaffolding requires Node 22.13+ and is TypeScript-first;
- LangGraph's reviewed package declares Node 18+ but its upstream compiler metadata is
  older than Ember's TypeScript 7 baseline;
- `ai` declares Node 22+ and develops against TypeScript 5.8.x;
- OpenAI Agents SDK was tested upstream on Node 22/24 and built with TypeScript 5.9.x,
  with no reviewed package engine declaration.

Every first adoption must compile under Ember's exact TypeScript config and execute on
Node 26 before merge.

### Raspberry Pi-class footprint

The correct optimization target is Ember's deployment topology, not abstract npm
package count.

- Keep large agent libraries out of the resident Telegram transport process unless
  that process actually needs them.
- Episodic workers may pay cold-import/start cost on every wake, so measure it.
- AI SDK Core is the most favorable reviewed shape for a Pi: ordinary Node library,
  no required database/control plane, separable provider packages, and no obvious
  mandatory native addon in the reviewed core metadata.
- OpenAI Agents SDK is plausible but broader and still OpenAI-flavored even at lower
  levels; measure the exact core subset.
- LangGraph core is library-scale, but the first local persistent checkpointer uses
  `better-sqlite3`; Node 26/ARM64 install/build behavior and checkpoint latency are a
  mandatory Pi gate.
- Mastra's broad surface makes exact-package/subpath measurement essential. Do not
  benchmark or deploy a server/Studio/Temporal/memory stack when only one primitive is
  under consideration.

For every production dependency record:

- clean install/disk delta;
- cold import/start latency;
- idle RSS after import;
- active RSS for the intended workload;
- ARM/native-module behavior;
- shutdown/restart behavior under systemd;
- persistent-store growth when applicable.

### Self-hosting and cloud coupling

No candidate requires its vendor cloud for the core recommended path, but defaults
matter:

- Vercel AI Gateway/hosted telemetry remain optional; use direct providers/custom
  providers when desired;
- LangSmith/Agent Server remain optional; LangGraph core/checkpointing can be local;
- Mastra Platform/Studio and Temporal are not required for the low-level candidates;
- OpenAI Agents SDK is provider-extensible but OpenAI-first, and default server tracing
  must be explicitly disabled or replaced for Ember's local/self-hosted default.

A direct model API backend may still introduce provider API keys, usage billing, and
network dependency that current subscription-authenticated Codex/Cursor CLIs avoid.
That operational trade is part of the provider decision and is not hidden by AI SDK.

None of these libraries supplies local inference by itself. Offline operation depends
on the selected local/custom model provider and capability transports.

### Observability and debugging

Prefer operational transparency over framework convenience:

- retain provider/runtime raw evidence long enough to explain failures where needed;
- attach Ember cognition/delegation/effect/run IDs to traces rather than replacing
  them with framework IDs;
- keep prompt/tool payload recording opt-in or privacy-scoped;
- flush asynchronous trace exporters at short-lived worker boundaries;
- make trace storage optional so losing it cannot alter semantic truth.

### Deterministic testing

Every adopted adapter must have a deterministic implementation-level fake:

- AI SDK adapter -> `MockLanguageModelV4` or equivalent controlled model;
- Agents SDK runner -> `ScriptedModel`;
- LangGraph durable executor -> deterministic tasks plus in-memory and real persistent
  checkpointer contract/restart tests;
- Mastra primitive -> fake or deterministic contract test around only the adopted
  seam.

These tests supplement, never replace, Ember acceptance scenarios and longitudinal
semantic evaluations.

### Dependency/API discipline

- pin exact framework/provider package versions;
- import framework types only inside adapter/runtime integration modules;
- do not store framework DTOs in canonical records;
- upgrade one capability adapter at a time;
- review migration guidance before upgrades that may affect in-flight operational
  state;
- keep optional provider/cloud packages out of deployments that do not use them.

## Prioritized follow-up work

Production adoption itself remains outside #180. The following are deliberately
triggered spikes rather than a mandate to add dependencies immediately.

### P0 when a direct API backend is desired: AI SDK cognition adapter spike

**Candidate issue:** `Spike Vercel AI SDK behind Ember cognition semantics`

Prove:

- current `ProviderRequest` enters unchanged;
- only the selected `Projection` reaches the model;
- `Output.object` produces a `ProviderResult`-shaped result;
- out-of-projection `usedMeaningIds` still fail Ember validation;
- provider-specific response/finish/warning metadata can be captured without leaking
  AI SDK types;
- timeout/abort maps to existing Ember failure semantics;
- Node 26/TypeScript 7 and Pi resource gates pass;
- a replacement fake implementing the same Ember contract requires no core changes.

**Exit decision:** adopt AI SDK for the direct backend, reject it, or compare one
specific alternative. Do not refactor the generic invocation signature before this
proof.

### P1 after P0 succeeds: simplify the process-shaped cognition invoker

**Candidate issue:** `Generalize cognition invocation after direct-provider proof`

Move `command`/process arguments into Codex/Cursor adapter construction while
preserving `ProviderRequest`/`ProviderResult` semantics. Keep CLI-specific process
lifecycle and evidence in those adapters.

This is an earned refactor caused by a second backend shape, not a framework-driven
abstraction exercise.

### P1 when Ember adds the first local/MCP tool: capability execution firewall spike

**Candidate issue:** `Define Ember capability/tool execution seam and validate AI SDK MCP`

Prove model-visible tool selection, argument-level authority, effect-attempt evidence,
approval/denial, abort uncertainty, and MCP transport conversion with no SDK tool type
crossing into core.

Include a negative test showing that provider-executed tools cannot be treated as
covered by local AI SDK approval.

### P2 only if the AI SDK bounded loop proves insufficient: Agents SDK challenger spike

**Candidate issue:** `Validate an Agents SDK runner only after an AI SDK capability gap`

Use the same capability/result contract with:

- AI SDK `generateText`/`streamText` multi-step behavior;
- OpenAI Agents SDK `Runner`, preferably lower-level packages and AI SDK model bridge
  where useful.

First document the concrete AI SDK deficiency. Then compare code removed,
approval/resume behavior, replay-safety evidence, deterministic tests, provider
coupling, package footprint, type/state leakage, and the cost of running two overlapping
SDKs.

**Do not** evaluate SDK handoffs as Ember delegation. Agents-as-tools may be included
only as nested execution mechanics returning an Ember-owned specialist report.

### P2 only if restart-durable execution exposes a primary-stack gap: LangGraph challenger spike

**Candidate issue:** `Validate LangGraph only after an earned durable-execution gap`

First prove that the operation cannot be served cleanly by the current systemd runtime
plus the primary AI SDK without substantial custom checkpoint machinery. If that gate
passes, use Functional API plus persistent SQLite and actual systemd supervision to
prove:

- suspend -> process exit -> restart -> resume;
- completed tasks are not repeated unnecessarily;
- unfinished effectful work does not retry without Ember idempotency/reconciliation;
- changed canonical revision/objective/authority blocks continuation;
- `RunControl` drain behaves cleanly under shutdown;
- TypeScript 7/Node 26/ARM64 `better-sqlite3` works on the Pi;
- the same `DurableExecutionPort` can classify/abandon an old run and start new work
  through a fake/custom replacement without canonical migration.

### P3 when retrieval quality becomes a measured bottleneck: context-compression spike

**Candidate issue:** `Evaluate rebuildable retrieval/context compression backend`

Compare a simple custom baseline with Mastra Observational Memory/semantic recall or
another focused backend. Require source-evidence references, full rebuildability,
currentness outside the backend, least-sufficient projection, and measurable gain in
the longitudinal/context-selection harness.

### P3 when tracing becomes operationally valuable: direct OTel versus framework hooks

**Candidate issue:** `Define Ember operational telemetry sink and compare exporters`

Start with direct OpenTelemetry as the control. Compare AI SDK/Mastra/Agents automatic
instrumentation only if the corresponding library is already adopted elsewhere.

## Explicit non-adoptions

Unless a new evidence-backed issue revisits them, this synthesis rejects:

- a monolithic `AgentFramework` abstraction;
- Mastra `Agent` as Ember architecture;
- Mastra Memory, LangGraph Store/checkpoint memory, AI SDK memory integrations, or
  Agents SDK `Session` as Ember memory;
- LangGraph graph/thread/state as Ember identity or canonical domain architecture;
- OpenAI Agents SDK handoffs as Ember delegation semantics;
- Mastra supervisor/network as Ember delegation semantics;
- framework workflow/checkpoint/session/run state as canonical persistence;
- provider response/session/thread IDs as continuity;
- framework approval as the authority model;
- framework retry as proof that an uncertain external effect is safe to repeat;
- hosted Mastra/Vercel/LangSmith/OpenAI control planes as mandatory runtime owners;
- Temporal, LangGraph Agent Server, Mastra Server/Studio, or hosted multi-agent
  machinery for the current Raspberry Pi topology;
- rewriting current Codex/Cursor adapters merely to make all providers pass through
  the same third-party SDK.

## Final architecture shape

The synthesis converges on a **single-primary-SDK architecture with explicit challenger
escape hatches**:

```text
                         Ember semantic core
   identity / continuity / memory / provenance / authority / currentness
           delegation responsibility / effect truth / non-action
                                 |
                    Ember semantic firewalls
                                 |
                  +--------------+--------------+
                  |                             |
                  v                             v
        current custom mechanics       Vercel AI SDK (primary)
        systemd / StateStore /          models / structured output
        CLI process lifecycle /         tools / bounded loops / MCP
        specialist contracts            streaming / tests / telemetry
                  |                             |
                  +--------------+--------------+
                                 |
                  only after demonstrated gaps
                                 |
                    +------------+------------+
                    |            |            |
                 LangGraph   OpenAI Agents   Mastra
                 durable       richer        focused
                 execution     runner        primitive
                    |            |            |
                    +------ adapter-local ----+

  Framework IDs, sessions, checkpoints, run state, handoffs, and storage never
  become Ember identity, memory, authority, delegation, or canonical truth.
```

There **is** a preferred toolkit, but there should still be no third-party semantic
owner.

The strongest conclusion from #176-#180 is that Ember can become **less custom without
becoming less Ember**. Prefer one coherent commodity toolkit where it is adequate,
keep the distinctive semantics and proven runtime machinery custom, and add another
agent SDK only when evidence shows that the primary stack has reached a real boundary.

## Issue #180 acceptance mapping

| Requirement                                               | Result                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| common primitive-level comparison of #176-#179            | capability matrix and per-candidate synthesis above                                |
| framework mechanics separated from Ember semantics        | semantic red lines and explicit non-adoptions                                      |
| concrete current-code overlap                             | current Ember overlap map                                                          |
| small set of capability-level Ember-owned seams           | cognition, capability/tool, MCP, durable execution, retrieval, and telemetry seams |
| credible replacement/custom path per dependency           | per-seam replacement paths plus persisted-state migration table                    |
| framework type/state leakage addressed                    | type-crossing rules, migration escape hatches, and versioning rules                |
| single-SDK versus mixed-library strategy evaluated        | strategy 1 primary AI SDK plus strategy 2 evidence-gated exception path            |
| local/self-hosted/Pi constraints influence recommendation | operational recommendation and target-host gates                                   |
| follow-up work prioritized without production adoption    | P0-P3 triggered spike list                                                         |
