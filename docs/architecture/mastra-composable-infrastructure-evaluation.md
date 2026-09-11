---
summary:
  "Issue #176 evaluation of Mastra as a set of replaceable TypeScript infrastructure primitives beneath Ember-owned
  cognition, capability, memory, delegation, persistence, and runtime semantics."
read_when:
  - "Considering Mastra for model routing, tools, MCP, workflows, memory, observability, evals, or storage in Ember"
  - "Comparing agent frameworks as replaceable infrastructure beneath Ember-owned semantics"
  - "Reviewing which Mastra state may remain operational and disposable versus which state must stay canonical in Ember"
role: design
discovery_status: current
---

# Mastra Composable Infrastructure Evaluation

## Decision

**Do not adopt Mastra as Ember's application architecture or identity-bearing agent runtime. Treat Mastra as a toolbox
whose primitives may be adopted independently behind Ember-owned capability seams.**

The useful question for issue [#176](https://github.com/arhor/ember/issues/176) is not whether Ember can be represented
as a Mastra `Agent`. She can, mechanically. Doing so would collapse distinctions that Ember deliberately owns:
continuity versus provider sessions, history versus memory versus current context, capability versus authority,
operational workflow progress versus canonical meaning, and specialist execution versus responsibility for
reintegration.

Mastra is nevertheless substantially more modular than its top-level `Agent` API suggests. Current packages expose
lower-level model routing, tools, workflows, MCP, observability, storage domains, memory operations, and evaluation
machinery separately. Several of those pieces are plausible infrastructure beneath narrow Ember contracts.

The recommended posture is therefore:

1. **Preserve Ember's current semantic boundaries.** In particular, keep `ProviderRequest` / `ProviderResult` /
   `ProviderInvoker`, canonical `StateStore` semantics, projection/currentness rules, specialist delegation contracts,
   and acceptance scenarios independent of Mastra.
2. **Adopt mechanics only at capability-sized seams.** Model routing, MCP transport, tracing, scoring, or future durable
   workflow execution can each have a separate adapter. Do not add one generic `AgentFramework` abstraction.
3. **Treat Mastra-owned persisted state as operational and replaceable.** Workflow snapshots, trace rows, scorer
   results, MCP client configuration, message stores, observations, and vectors must not silently become canonical Ember
   state.
4. **Avoid Mastra `Memory` and supervisor/network abstractions as semantic owners.** They are useful implementations of
   common agent patterns, but their conceptual models overlap too strongly with meanings Ember already distinguishes
   more carefully.
5. **Revisit durable workflows when an earned requirement appears.** Mastra's suspend/resume and retry mechanics are
   attractive, especially because the same workflow definition can later run on Temporal, but replacing Ember's
   deliberately narrow systemd episodic topology today would add more runtime machinery than a current failure requires.

In short: **Ember owns meaning; Mastra may own selected mechanics.**

## Evaluation baseline

This evaluation was performed on **2026-09-07** against:

- Ember's current [Design Principles](../principles.md), accepted architecture decisions, and
  [Architecture Acceptance Scenarios](acceptance-scenarios.md);
- the current one-shot cognition contract in `src/providers/contract.ts` and the
  [Cognition Adapter Contract Decision](cognition-adapter-contract-decision.md);
- the current specialist boundary and [Specialist Result Reintegration](specialist-result-reintegration.md);
- the current [Long-Lived Runtime Requirements](long-lived-runtime-requirements.md), ADR 0007 episodic runtime decision,
  and `src/runtime/episodic-runtime.ts`;
- Mastra's stable `@mastra/core@1.64.0` release published on 2026-09-04, while repository `main` already identified
  itself as `1.65.0-alpha.7` during this review;
- Mastra's public Apache-2.0 repository and first-party documentation/blog material linked in [Sources](#sources).

Mastra changes quickly. The release/main mismatch above is useful evidence by itself: APIs should be pinned and isolated
even when a primitive is attractive. Findings below describe the observed 2026-09-07 surface, not a promise about future
releases.

This evaluation does **not** claim a measured install size, idle RSS, or Raspberry Pi benchmark. Those require an
installation/runtime spike on the actual target. Where operational suitability is discussed below, unmeasured properties
are kept explicit rather than inferred from package names.

## Classification scale

| Class              | Meaning                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **1 - direct**     | The primitive can sit below an Ember-owned interface with little semantic translation.                            |
| **2 - firewall**   | The primitive is useful, but an adapter must prevent Mastra concepts or state from becoming Ember semantics.      |
| **3 - coupled**    | The primitive pulls strongly toward Mastra's application model or would duplicate/distort an Ember-owned concept. |
| **4 - irrelevant** | The primitive does not currently solve an Ember requirement.                                                      |

## Primitive inventory

| Mastra primitive                                             | Current surface                                                                                       |                                                         Class | Ember fit                                                                                                                                                        | Recommendation                                    |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Model Router / language-model abstraction                    | `ModelRouterLanguageModel`, provider/model routing, fallback selection                                |                                                         **2** | Useful implementation beneath cognition, but Ember must still own projection, result validation, provenance, cancellation outcome, and provider selection policy | **Wrap / candidate**                              |
| Tool definitions                                             | standalone `createTool`, schemas, execution hooks, suspension/approval plumbing                       |                                                         **2** | Good schema/execution mechanics; tool availability is not authority and tool success is not effect certainty                                                     | **Wrap / candidate**                              |
| Agent/tool loop                                              | `Agent`, processors, tool loop, streaming lifecycle                                                   |                                       **3** for current Ember | Convenient but wants to own message loop, tool lifecycle, memory, and run semantics together                                                                     | **Avoid as core; revisit for bounded executor**   |
| MCP                                                          | client/server packages and tool conversion                                                            |                                                         **2** | Strong fit with Ember's preference for MCP as a capability transport; authority must remain outside MCP/Mastra                                                   | **Wrap / strong candidate**                       |
| Core workflows                                               | `createWorkflow`, `createStep`, branching, parallelism, retries, suspend/resume, snapshots            |                                                         **2** | Useful operational execution state if canonical meaning remains in Ember                                                                                         | **Revisit behind durable-execution port**         |
| Temporal workflow engine                                     | `@mastra/temporal`, same workflow definitions on Temporal                                             |                                                         **2** | Strong durability, but operationally far heavier than current Pi/systemd topology                                                                                | **Revisit only when earned**                      |
| Message history                                              | Mastra Memory thread messages                                                                         |                                         **3** as Ember memory | Useful chat storage, but Ember history is evidence and continuity is not a Mastra thread                                                                         | **Avoid as canonical memory**                     |
| Working memory                                               | thread/resource document injected into model context                                                  |                                                         **3** | Collides with curated durable memory, provenance/currentness, and least-sufficient context selection                                                             | **Avoid as canonical state**                      |
| Semantic recall                                              | vector retrieval over stored messages                                                                 |                             **2** only as candidate retrieval | Could propose evidence candidates, but must not bypass Ember selection/currentness rules                                                                         | **Possible retrieval backend, not memory**        |
| Observational Memory                                         | observer/reflector compression and standalone memory processing                                       |                                                         **2** | Interesting derived context-compression mechanism if outputs remain rebuildable and provenance-linked                                                            | **Spike later as context compressor**             |
| Storage domains/adapters                                     | memory, workflow, observability, scores, schedules, MCP and other domains across LibSQL/Postgres/etc. | **3** for canonical Ember; **2** for Mastra operational state | Good persistence machinery for Mastra-owned artifacts; schema and lifecycle remain Mastra-specific                                                               | **Use only behind owning primitive**              |
| Supervisor / subagents / `agent.network()`                   | routing and delegation among Mastra agents                                                            |                                                         **3** | Conflicts with Ember-owned responsibility, authority, currentness, cancellation uncertainty, and reintegration                                                   | **Avoid for Ember delegation**                    |
| ACP/A2A/coding-agent transports                              | protocol and harness integrations                                                                     |                                                         **2** | Potential transport beneath `src/delegation/`; does not supply Ember delegation meaning                                                                          | **Revisit when current adapter lacks capability** |
| Observability                                                | tracing, exporters, OpenTelemetry-compatible integrations                                             |                                                         **2** | Execution telemetry is non-canonical and naturally replaceable if Ember IDs remain attributes                                                                    | **Strong candidate**                              |
| Scorers/evals                                                | rule/model/statistical scorers, datasets/experiments, Vitest integration                              |                                                         **2** | Useful evaluation mechanics; acceptance scenarios and semantic oracles remain repository-owned                                                                   | **Candidate**                                     |
| Mastra Server / Studio / hosted platform                     | HTTP runtime, Studio, hosted deploy/storage/observability                                             |                                                     **4** now | Ember already has explicit CLI/surface/runtime ownership; hosted control plane is not needed for the first topology                                              | **Do not adopt now**                              |
| Channels, sandbox/workspace, goals, schedules, inbox/signals | broader application framework                                                                         |                          **4** or **3** depending future need | Significant overlap with existing or future Ember concerns, but no current failure requires moving ownership                                                     | **Evaluate separately only when earned**          |

## Model and provider mechanics

### What Mastra provides

Mastra's model routing is not inseparable from `Agent`. The core package exposes `ModelRouterLanguageModel` from its LLM
subpath, and the implementation is a language-model object rather than an identity-bearing agent. Mastra also accepts AI
SDK-compatible model objects and has invested heavily in normalizing provider/model differences.

The Model Router is operationally appealing because it centralizes provider discovery, credentials, model IDs,
fallbacks, and compatible routing. Major providers can be called directly; using the router does not require Mastra
Cloud as the semantic or network owner.

### Ember boundary

The current Ember contract is already the right firewall:

```text
ProviderRequest
  { cognitionId, selected Projection, current input }
        |
        v
ProviderInvoker implementation
        |
        v
validated ProviderResult
  { reply, usedMeaningIds, optional operational handle }
```

A Mastra-backed cognition adapter should implement this existing contract rather than introduce `Agent` into
`src/runtime/runtime.ts`.

That preserves several current invariants:

- Ember selects the least-sufficient `Projection` before invocation;
- the model does not receive canonical state wholesale;
- `usedMeaningIds` remain constrained to selected meanings;
- an external provider/thread/run identifier remains opaque operational evidence;
- model/provider replacement does not redefine continuity;
- timeout and cancellation remain Ember-facing outcomes, with uncertainty preserved where the implementation cannot
  prove effect absence.

### What Mastra does not remove

Model routing cannot infer Ember provenance. If a structured model result must still identify `usedMeaningIds`, the
Mastra adapter has to request and validate that data exactly as current providers do. Likewise, provider fallback is a
mechanical capability, not an automatic semantic policy: changing models mid-attempt may affect evidence,
reproducibility, costs, or capability expectations and should be visible to Ember when those distinctions matter.

### Recommendation

**Candidate, behind `ProviderInvoker`; do not replace the contract.**

There is one important comparison question for parent issue #175: Mastra itself builds on AI SDK model interfaces. If
Ember only needs model invocation, structured output, streaming, and tools, using the lower-level Vercel AI SDK directly
may be thinner than importing Mastra's router layer. Mastra becomes more compelling if its router/fallback registry
itself saves meaningful integration work.

## Tools and tool-loop mechanics

Mastra exposes standalone typed tool definitions with input/output schemas and execution hooks. This is a good
mechanical building block, but the semantics around a tool call need an Ember-owned shell.

For Ember, at least four distinct questions exist:

1. **Capability:** can this operation technically be performed?
2. **Authority:** is this cognition/delegation episode permitted to request it now?
3. **Execution:** what actually happened at the tool boundary?
4. **Effect certainty:** after timeout/cancellation/boundary loss, what can Ember truthfully say about resulting
   effects?

Mastra approval or authorization features can help implement part of the execution gate, but they must not become the
definition of Ember authority. A tool that returned successfully also does not prove that all external effects are
exactly what Ember intended, and a cancelled call does not prove absence of effects.

A useful future seam would therefore be capability-shaped rather than framework-shaped:

```text
EmberToolCatalog
  describe(permittedCapabilityIds) -> model-facing tool descriptions

EmberToolExecutor
  execute(capabilityId, input, authorityRef, attemptRef, signal)
    -> ToolExecutionEvidence
```

A Mastra tool can be generated from the first surface and execute through the second. The model sees Mastra-compatible
tools; all policy and evidence passes through Ember.

**Recommendation: wrap when Ember earns an in-process tool loop.** Do not add a Mastra `Agent` merely to obtain
`createTool` today.

## MCP

Mastra has first-class MCP client and server packages and converts MCP-exposed capabilities into tools usable by its
runtime. That aligns with Ember's existing principle that MCP is a preferred transport for external capabilities.

The semantic firewall should remain simple:

```text
McpCapabilitySource
  list() -> capability descriptors
  invoke(name, arguments, transportContext) -> transport result/evidence
```

Mastra may implement discovery, connection lifecycle, protocol validation, and tool conversion. Ember still decides:

- which MCP server is trusted enough to expose which capabilities;
- which episode is authorized to invoke which capability;
- what context may cross the boundary;
- how a result is attributed and validated;
- what timeout/cancellation means;
- whether an observed result may change canonical meaning.

Mastra also supports persistence for MCP client configuration. That persistence should remain operational configuration,
not the canonical source of Ember authority or capability policy.

**Recommendation: strong candidate behind an Ember-owned MCP/capability transport seam.**

## Workflows and durable execution

### Useful mechanics

Mastra workflows provide substantially more than a fluent DAG builder. Current workflow machinery supports:

- typed steps and workflow inputs/outputs;
- sequential, branching, parallel, looping, and nested execution;
- step/workflow retry policy;
- suspend/resume and human-in-the-loop data;
- shared workflow state;
- persisted workflow snapshots/run identifiers;
- cancellation;
- operational inspection;
- alternative durable engines, including Temporal, while retaining workflow definitions.

Mastra's own documentation describes ordinary workflow snapshots as pause/resume resilience. The Temporal integration
extends this to execution designed to survive worker restarts and offers richer retry/scheduling behavior.

### The required semantic firewall

A Mastra workflow snapshot must be interpreted as **a resumable execution artifact, not a truth-bearing Ember state
snapshot**.

A safe integration looks like:

```text
canonical Ember state
  objective / authority / evidence / current revision
             |
             | project identifiers + bounded operational input
             v
DurableExecutionPort
             |
             v
Mastra workflow snapshot
  step statuses / retries / suspend payload / transient outputs
```

On every resume that can cause an externally visible effect, the workflow must return to an Ember-owned checkpoint that
revalidates current canonical state. For example:

```text
resume run
  -> load current Ember revision
  -> check objective is still live/current
  -> check authority remains valid
  -> reconcile any earlier ambiguous effects
  -> only then continue effectful work
```

This is especially important because workflow retry semantics solve _execution retry_, not Ember's stronger question of
whether retrying an operation is semantically safe after an ambiguous external effect.

Likewise, `cancel()` records and propagates cancellation mechanics. It does not turn "cancellation requested" into "all
work definitely stopped with no effects". Ember's existing cancellation/effect-uncertainty vocabulary must remain
outside the workflow engine.

### Proposed port

Do not expose Mastra workflow objects through unrelated Ember modules. If a durable executor is eventually earned, use a
narrow operational port such as:

```text
DurableExecutionPort
  start(kind, input, canonicalRefs) -> OperationalRunRef
  resume(runRef, resumeData, expectedRevision) -> RunObservation
  cancel(runRef) -> CancellationObservation
  inspect(runRef) -> RunObservation
```

`OperationalRunRef` is disposable. `canonicalRefs` point back into Ember rather than copying canonical meaning into the
workflow database.

### Migration behavior

If Mastra is later removed, completed workflow snapshots should be disposable. Suspended/in-flight runs are the
expensive case. The migration policy should therefore be designed before adoption:

- either finish/expire existing runs on the old engine;
- or abandon them and restart from an Ember-owned safe checkpoint;
- never require decoding a Mastra snapshot to reconstruct lost canonical Ember meaning.

### Current Ember fit

ADR 0007 intentionally chose systemd-supervised episodic workers before a resident Ember daemon. The current runtime has
simple recovery ownership and single-writer semantics. Mastra workflows should **not** replace that topology merely
because workflows are feature-rich.

A future long-running approval-mediated or multi-step external operation may earn this machinery. At that point a small
restart/suspend spike should test the port above against Ember's currentness and ambiguous-effect acceptance scenarios.

**Recommendation: wrap/revisit, not production adoption today.**

## Memory, retrieval, and context compression

This is the area with the strongest semantic pressure.

### Mastra's model

Mastra currently distinguishes multiple useful memory layers:

- message history;
- working memory associated with a thread or resource;
- semantic recall over stored messages;
- Observational Memory, which compresses older history into dense observations while retaining underlying records.

Those distinctions are more thoughtful than a single transcript-as-memory abstraction. The 2026 Mastra memory guidance
even recommends keeping permissions and similarly authoritative application data in the application system that owns
them.

However, the vocabulary still does not line up with Ember's established model:

```text
Ember history     = evidence of what happened
Ember memory      = curated durable interpretation with provenance/currentness
Ember context     = least-sufficient selection for this cognition
Mastra thread     = conversation-oriented storage/lifecycle key
Mastra resource   = cross-thread resource/user-oriented key
Mastra working memory / observations / semantic recall
                  = mechanisms for constructing useful model context
```

Mapping `thread == continuity`, `resource == user memory`, or `workingMemory == Ember memory` would erase distinctions
Ember needs.

### Message history

Mastra message storage can record conversations efficiently, but Ember raw history is evidence and may include
occurrences from multiple surfaces or non-conversational background activity. A Mastra thread cannot become the identity
or continuity boundary.

**Classification: 3 as canonical memory.**

### Working memory

Working memory is intentionally model-facing and frequently injected. That is almost the inverse of Ember's requirement
that current context be selected from durable meaning under explicit relevance/currentness rules. A mutable summary
document also lacks Ember's native provenance and supersession semantics unless those are reimplemented around it.

**Classification: 3. Avoid as canonical Ember memory or policy.**

### Semantic recall

Semantic recall is more plausibly reusable if it is demoted from "memory" to **candidate retrieval**:

```text
RetrievalCandidateSource
  query(queryEmbedding/text, scope, limit)
    -> [{ evidenceId, score }]
```

The backend may use Mastra/vector machinery, but Ember owns filtering, currentness, trust, participation policy, and
final context construction. Returned text should point to Ember evidence rather than become a parallel source of truth.

This should only be adopted if the existing context-selection evaluations show that such retrieval improves recall
without unacceptable over-inclusion or provenance loss.

**Classification: 2 as retrieval mechanics, not memory semantics.**

### Observational Memory

Observational Memory is the most interesting Mastra memory primitive for Ember because it can be reframed as **derived
context compression** rather than durable truth. Mastra's own research reports strong LongMemEval results and a stable
context window, while retaining original messages in storage.

A future Ember adapter could look like:

```text
ContextCompressor
  compress([
    { evidenceId, timestamp, content, provenanceClass }
  ])
    -> {
      observations: [...],
      coveredEvidenceIds: [...],
      backendEvidence: {...}
    }
```

Requirements for that adapter:

- every observation remains explicitly derived and non-canonical;
- source evidence IDs remain available so claims can be checked;
- rebuilding with another compressor is allowed;
- an observation cannot promote itself into durable Ember memory;
- contradictions/currentness remain Ember-owned;
- the compressor receives only an allowed projection rather than unrestricted history.

Mastra's standalone memory processing APIs make this more plausible than wrapping a whole agent, but the value should be
tested against Ember's own longitudinal/context-selection evaluations before production use.

**Classification: 2. Revisit as a context-compression backend.**

## Storage and persistence

Mastra's composite storage architecture is a genuine modularity strength. Its framework data can be split into domains
and backed by different stores such as LibSQL, Postgres, MongoDB, and other adapters.

That does **not** make Mastra storage a good replacement for `src/persistence/state-store.ts`.

Ember's `StateStore` participates in canonical revision, writer-lease, recovery, currentness, and reintegration
behavior. A generic Mastra memory/workflow store does not know those semantics and should not be taught them merely to
reduce persistence code.

Mastra storage is appropriate for data whose owner is already a Mastra primitive:

- workflow snapshots and run state;
- traces/observability records;
- scorer/experiment results;
- optional MCP runtime configuration;
- Mastra memory artifacts if an explicitly non-canonical compression/retrieval spike uses them.

It is **not** appropriate as the authoritative store for:

- Ember identity/continuity;
- canonical meanings and supersession;
- authority grants;
- delegation responsibility/currentness;
- effect/reconciliation evidence whose loss would make Ember tell an untruth about what happened.

### Lock-in inventory

| Persisted Mastra state                     | Removal cost if used                             | Mitigation                                                                                        |
| ------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Model route names/config                   | Low                                              | Map logical Ember model/provider policy to Mastra config at adapter boundary                      |
| Tool schemas                               | Low to medium                                    | Define canonical capability metadata in Ember; generate Mastra tool wrappers                      |
| Workflow snapshots and run IDs             | Medium to high for suspended runs                | Keep snapshots operational; resume through canonical checkpoints; allow abandon/restart migration |
| Thread/resource messages                   | High if treated as Ember history source of truth | Do not make them canonical; retain canonical evidence in Ember                                    |
| Working-memory documents                   | High if relied on for durable truth              | Do not use as canonical memory                                                                    |
| Observations/vector indexes                | Low if rebuildable, high if only copy            | Store source evidence references; treat indexes/compressions as derived artifacts                 |
| Trace rows                                 | Low                                              | Keep Ember IDs as trace attributes; permit retention loss/rebuild where appropriate               |
| Scorer/experiment rows                     | Low to medium                                    | Keep acceptance fixtures and expected semantics in repo; scores are evidence, not authority       |
| MCP/schedule/dynamic-runtime configuration | Medium                                           | Keep policy and desired configuration in Ember-owned config; Mastra copy is operational           |

A useful test is simple: **if deleting the Mastra database would force Ember to invent what she remembers, what she was
authorized to do, or whether an external effect happened, the boundary is wrong.**

## Delegation, supervisor patterns, ACP, and A2A

Mastra now offers rich multi-agent mechanics: agents can expose subagents, a supervisor can delegate and iterate,
`agent.network()` can route among agents/tools/workflows, and protocol integrations exist for ACP/A2A and coding-agent
runtimes.

Those features are technically capable but semantically too high-level for Ember's delegation model.

Ember already distinguishes:

- decision to delegate;
- specialist capability versus authority actually granted;
- least-sufficient disclosed context;
- immutable objective/currentness basis;
- specialist report versus independently observed evidence;
- cancellation request versus observed stop;
- partial/failed/ambiguous-effect result shapes;
- reintegration as a separate Ember-owned decision.

A Mastra supervisor's successful handoff or child completion does not answer those questions. Adopting it as the
delegation owner would turn a convenient orchestration pattern into Ember's semantic hierarchy.

Protocol/client mechanics are different. If Ember later needs richer live specialist control than current `codex exec`
provides, a Mastra ACP/A2A client could sit _inside_ a specialist adapter, just as a future Codex App Server client
could. The existing [Codex Specialist Integration Evaluation](codex-specialist-integration-evaluation.md) still applies:
richer protocol capability should be adopted only when a concrete unmet requirement such as live approval mediation,
steering, or richer progress is present.

**Recommendation: avoid Mastra supervisor/network semantics; revisit protocol transport adapters separately.**

## Observability

Observability is one of the cleanest reuse candidates because telemetry is naturally downstream from semantics. Mastra
instruments agent/tool/workflow/memory operations and supports OpenTelemetry-compatible backends as well as Mastra's own
storage/Studio path.

A safe seam is deliberately boring:

```text
ExecutionTelemetry
  startSpan(kind, emberRefs, attributes)
  event(span, kind, attributes)
  end(span, outcome)
```

Important Ember identifiers should be trace attributes, not replaced by trace IDs:

- cognition ID;
- runtime episode ID;
- objective/delegation attempt ID;
- evidence IDs where safe to expose;
- surface occurrence/delivery IDs;
- canonical revision at start/end.

Traces can then be dropped, exported to another OTel backend, or migrated without affecting canonical state.

One comparison caveat for #175: plain OpenTelemetry may be an even thinner dependency if Ember does not need Mastra's
automatic instrumentation. Mastra observability is most valuable if another Mastra primitive is already in the execution
path and can emit useful spans automatically.

**Recommendation: strong candidate, but compare against direct OTel before adoption.**

## Evals and deterministic testing

Mastra has mature scoring and experiment machinery, including deterministic/rule-based scorers, model-graded scorers,
datasets/experiments, and a recent Vitest integration.

This can complement Ember's existing evaluation harnesses, but it should not replace their semantic ownership.

Ember acceptance scenarios answer questions such as "did continuity survive provider replacement?", "was a delegated
result still current?", or "did cancellation uncertainty remain truthful?" Those are not generic quality scores. The
source fixtures, invariants, and pass/fail oracle must remain in Ember.

A useful optional seam would be:

```text
EvaluationScorer<Input, Output>
  score(input, output, evidence) -> ScoreObservation
```

Mastra scorers may implement particular metrics or runner ergonomics. Model-as-judge scorers should remain optional and
separated from deterministic regression gates where a hard invariant exists.

**Recommendation: candidate for scorer/runner mechanics; keep acceptance semantics repository-owned.**

## Packaging, runtime, and self-hosting fit

### Node and TypeScript

Mastra's current scaffolding requires Node.js **22.13.0 or later**, so Ember's Node.js 26.8.1+ baseline is within the
supported range. The project is TypeScript-first and packages are published for ordinary Node consumption.

No runtime-version conflict was identified in this research.

### Self-hosting and cloud coupling

The open-source core can run in a Node-compatible environment and does not require Mastra's hosted platform. Mastra
documents standalone/server-adapter deployments and explicitly supports self-hosting; a 2026 Helm chart is an additional
deployment option, not a requirement. Temporal can likewise be self-hosted if that engine is selected.

Provider routing does not inherently require Mastra Cloud. Hosted Platform/Studio/managed memory are optional products
and should remain optional for Ember.

### Dependency and Raspberry Pi cost

`@mastra/core` exposes a very broad feature surface even though imports are organized into subpaths and many
integrations live in separate packages. That is qualitatively more dependency/runtime surface than Ember's current
deliberately small implementation.

No measured Raspberry Pi 5 install/RSS/startup result is available from this evaluation. Therefore:

- do not claim Pi suitability from Node compatibility alone;
- avoid server/Studio, Temporal, local embedding models, sandboxes, and broad framework startup on the Pi until
  measured;
- prefer importing only the package needed for the chosen primitive;
- run an actual cold-start, idle RSS, steady-state RSS, disk/install-size, and native-module/ARM compatibility spike
  before making a Pi-resident Mastra dependency mandatory.

For a lightweight model/MCP/telemetry adapter, the threshold may be reasonable. For a resident Mastra server plus
workflow engine plus memory/vector stack, the burden is much harder to justify against ADR 0007's resource-conscious
topology.

### API stability and debugging

Mastra reached v1, but development remains fast. The stable core release observed for this evaluation was `1.64.0`,
while repository main was already on `1.65.0-alpha.7`. First-party changelogs regularly describe new surfaces,
migrations, and breaking changes.

That is not a reason to reject the project. It is a reason to:

- pin exact package versions;
- keep Mastra types out of canonical `src/core/` contracts;
- translate errors/results at adapters;
- maintain deterministic contract tests around every adopted seam;
- avoid persisting opaque framework state unless it is explicitly disposable operational state.

Debugging is strongest where an isolated primitive is used. It becomes harder when `Agent` simultaneously owns prompt
construction, memory, processors, routing, tool loops, persistence, and tracing, because failures cross several
framework-managed lifecycle layers.

## Concrete Ember mapping

### Keep unchanged

**`src/core/`**

No Mastra concept belongs in canonical models or semantics. `Agent`, thread/resource IDs, workflow run state, tool
approval state, and Mastra storage records must not appear in canonical Ember types merely because an adapter uses them.

**`src/persistence/state-store.ts`**

Keep canonical persistence and writer semantics Ember-owned. Mastra stores may coexist for Mastra operational artifacts
but should not replace this boundary.

**`src/delegation/` semantic contracts**

Keep responsibility, authority, currentness, cancellation uncertainty, specialist evidence, and reintegration unchanged.
Protocol implementation may evolve beneath them later.

### Plausible places to become thinner

**`src/providers/`**

A new direct-model adapter could use Mastra Model Router beneath the existing `ProviderInvoker` seam. This could remove
provider-package/routing glue for remote model APIs. It should not rewrite `codex.ts`/`cursor.ts` merely to deduplicate
process mechanics: issue #92 already concluded that those external runtimes have meaningfully different lifecycle
evidence.

**Future tool-capability execution**

When Ember introduces an in-process model tool loop, use Mastra/AI SDK tool machinery rather than inventing schema
conversion and loop protocol from scratch. Keep capability policy and execution evidence in Ember-owned wrappers.

**Future MCP integration**

Mastra MCP client/server mechanics could reduce transport/discovery boilerplate while `src/core` and capability policy
remain independent.

**Future long-running operational coordination**

A `DurableExecutionPort` could eventually replace custom suspend/retry/checkpoint plumbing for a specific multi-step
operation. It should not replace the accepted runtime topology globally. `src/runtime/episodic-runtime.ts` remains
simpler for current one-shot wakes and systemd-supervised specialist episodes.

**Evaluation tooling**

Selected Mastra scorers or Vitest helpers could reduce bespoke metric-runner code in `eval/`, while scenario definitions
and semantic assertions remain Ember-owned.

**Observability**

Mastra/OTel instrumentation could add traces without growing canonical models. This is additive rather than a reason to
restructure runtime ownership.

## Replaceability rules for any adoption

Any future Mastra integration should satisfy these rules before production merge:

1. **No Mastra types in canonical core contracts.** Translate at adapters.
2. **No framework identifier substitutes for an Ember identifier.** Store it as opaque operational evidence only.
3. **No Mastra persisted row is the sole source of canonical meaning.** If it matters to truth, continuity, authority,
   or reconciliation, it belongs in Ember-owned durable state/evidence.
4. **Every adapter has a deterministic fake/contract test.** Core semantics must be runnable without Mastra or a live
   model.
5. **Cancellation and retries preserve uncertainty.** Framework lifecycle events are evidence, not stronger claims than
   they support.
6. **Context remains a projection.** Memory/retrieval/compression never gains implicit access to all canonical state.
7. **Migration behavior is written down before durable framework state is introduced.** Especially for suspended
   workflow runs.
8. **Package/runtime cost is measured on the deployment that will actually use it.** A laptop-friendly package is not
   automatically Pi-friendly.

These rules allow implementations to vary by deployment. For example, a development/server deployment could use Mastra
workflows while a constrained Pi deployment keeps a custom/simple executor, provided both implement the same Ember-owned
operational port and preserve the same canonical semantics.

## Recommended adoption order

If parent issue #175 ultimately selects any Mastra pieces, the lowest-risk order is:

1. **Observability or eval helpers** if they provide value over direct OTel/current test machinery. They are downstream
   and easy to remove.
2. **MCP transport** when Ember adds its next MCP-backed capability. This is a protocol/mechanics boundary with
   already-established semantic ownership.
3. **Model Router behind `ProviderInvoker`** if a direct API model backend/fallback requirement emerges and comparison
   with direct AI SDK favors Mastra.
4. **Observational Memory as a `ContextCompressor` spike**, never as canonical memory.
5. **Durable workflow execution** only for a concrete operation whose suspend/resume/restart/retry complexity exceeds
   the current episodic mechanisms.

Do **not** start with Mastra `Agent`, `Memory` as Ember memory, or supervisor/network delegation. Those are the easiest
APIs to demo and the most expensive places to surrender semantic ownership.

## Focused revisit spikes

Documentation/source inspection is sufficient to answer issue #176's architecture question. Before actual adoption,
these small spikes would answer the remaining operational questions without committing production architecture:

### A. Model adapter spike

Implement a throwaway `ProviderInvoker` backed by `ModelRouterLanguageModel` and prove:

- only the supplied `Projection` reaches the model;
- `usedMeaningIds` still pass Ember validation;
- timeout/abort maps to existing failure vocabulary;
- model fallback/provider identity can be captured as optional operational evidence without changing the core contract.

Compare the same spike with direct Vercel AI SDK in issue #178 before choosing a layer.

### B. Durable workflow restart spike

Create one workflow that:

- starts from an Ember canonical revision;
- performs a side-effect-free step;
- suspends;
- survives process restart;
- refuses to continue when canonical revision/objective currentness changes;
- resumes when still current;
- records cancellation as observation rather than proof of no effects.

Run once with ordinary Mastra snapshot storage. Temporal is unnecessary unless that simpler engine fails an earned
durability requirement.

### C. Observational-memory compression spike

Feed a bounded set of Ember evidence records into a standalone compression path and verify:

- observations retain source-evidence references externally;
- canonical state can rebuild the compression from scratch;
- a contradiction/newer meaning is handled by Ember selection/currentness rather than trusted because it appears in an
  observation;
- the longitudinal/context-selection harness shows measurable value.

### D. Raspberry Pi resource spike

On the actual Pi deployment, measure the exact package subset under consideration:

- clean install/disk delta;
- cold-start latency;
- idle and active RSS;
- ARM/native dependency behavior;
- shutdown/restart cleanliness under systemd;
- optional storage footprint growth.

Do not benchmark "Mastra" as one monolith if Ember only plans to use one package.

## Final recommendation matrix

| Area                               | Recommendation now                      | Why                                                                                                                   |
| ---------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Mastra as the Ember framework      | **Avoid**                               | Too much semantic ownership transfers to `Agent`/thread/memory/workflow concepts                                      |
| Model Router                       | **Wrap / compare**                      | Useful provider mechanics; current `ProviderInvoker` already gives the correct firewall; direct AI SDK may be thinner |
| Tool definitions                   | **Wrap later**                          | Good mechanics, but authority/effect semantics must remain Ember-owned                                                |
| MCP                                | **Adopt candidate**                     | Standard-compatible transport mechanics line up with Ember principles                                                 |
| Workflow engine                    | **Revisit**                             | Strong suspend/resume/retry mechanics, but current systemd episodic runtime is simpler and already accepted           |
| Temporal integration               | **Revisit much later**                  | Excellent durability at substantially higher operational cost                                                         |
| Mastra Memory wholesale            | **Avoid**                               | Thread/resource/working-memory semantics conflict with Ember history/memory/context/provenance model                  |
| Semantic recall                    | **Revisit as retrieval**                | Plausible candidate source only if context-selection evaluations earn it                                              |
| Observational Memory               | **Spike as context compression**        | Strong derived-context mechanism if rebuildable and provenance-linked                                                 |
| Mastra storage for canonical state | **Avoid**                               | Framework schemas must not own Ember truth/revision/authority/reconciliation                                          |
| Supervisor / agent network         | **Avoid**                               | Delegation meaning belongs to Ember; transport can be reused separately                                               |
| ACP/A2A integration                | **Revisit as transport**                | Useful mechanics when a richer specialist protocol is actually needed                                                 |
| Observability                      | **Adopt candidate / compare with OTel** | Downstream, non-canonical, replaceable                                                                                |
| Scorers/evals                      | **Adopt candidate**                     | Can reduce generic evaluation plumbing without replacing semantic acceptance oracles                                  |
| Server/Studio/Platform             | **Avoid now**                           | No current requirement; unnecessary resident/control-plane weight for current topology                                |

## Answer to the key question

**Yes, Mastra can be used as a source of replaceable building blocks without implementing Ember "as a Mastra agent", but
only if we resist its most convenient top-level composition model.**

The framework is modular enough that model routing, tools, MCP, workflow execution, observability, evals, and selected
memory processing can be isolated. The sharp boundary is persistence and lifecycle meaning: once Mastra threads, working
memory, workflow snapshots, supervisor state, or stored agents become the only durable representation of something Ember
cares about, replacement stops being cheap.

The most promising strategy for the #175 synthesis is therefore not "choose Mastra". It is:

```text
Ember semantics
    |
    +-- cognition port -------- Mastra router OR AI SDK OR custom
    +-- MCP transport --------- Mastra MCP OR another MCP client
    +-- tool execution -------- Mastra/AI SDK mechanics OR custom
    +-- durable execution ----- Mastra workflow OR LangGraph OR custom
    +-- context compression --- Mastra OM OR custom
    +-- telemetry ------------- Mastra observability OR plain OTel
    +-- evaluation ------------ Mastra scorers OR current/custom
```

Each right-hand choice should be replaceable without migrating canonical Ember state or rewriting unrelated modules.
That is the level at which Mastra fits Ember well.

## Sources

First-party Mastra material used for this evaluation:

- [Mastra repository](https://github.com/mastra-ai/mastra) and
  [`@mastra/core@1.64.0` release](https://github.com/mastra-ai/mastra/releases/tag/%40mastra/core%401.64.0).
- [`ModelRouterLanguageModel` source](https://github.com/mastra-ai/mastra/blob/2de367c9399c5fe51ea1db2d5821107591f7a7b4/packages/core/src/llm/model/router.ts)
  and [Model Router announcement](https://mastra.ai/blog/model-router).
- [`createTool` source](https://github.com/mastra-ai/mastra/blob/2de367c9399c5fe51ea1db2d5821107591f7a7b4/packages/core/src/tools/tool.ts).
- [Mastra Workflows, Enhanced](https://mastra.ai/blog/mastra-workflows-enhanced) and
  [Temporal workflow integration](https://mastra.ai/blog/introducing-temporal-workflows).
- [Suspend/resume workflow overview](https://mastra.ai/blog/resumeworkflows).
- [Agent Memory: Persistence, Layers, and Tradeoffs](https://mastra.ai/blog/agent-memory-layers),
  [Observational Memory announcement](https://mastra.ai/blog/observational-memory), and
  [Observational Memory research](https://mastra.ai/research/observational-memory).
- [`MemoryStorage` source](https://github.com/mastra-ai/mastra/blob/2de367c9399c5fe51ea1db2d5821107591f7a7b4/packages/core/src/storage/domains/memory/base.ts).
- [Mastra 2026-01-20 changelog](https://mastra.ai/blog/changelog-2026-01-20) for composite storage and agent/network
  lifecycle changes.
- [Mastra 2026-02-26 changelog](https://mastra.ai/blog/changelog-2026-02-26) for supervisor-pattern support.
- [Mastra 2026-03-04 changelog](https://mastra.ai/blog/changelog-2026-03-04) for concurrent-safe workflow snapshot
  updates.
- [Mastra MCP overview/first-party product description](https://mastra.ai/) and
  [2026 feature catalogue](https://mastra.ai/blog/category/features) for current ACP/A2A/MCP-related integration
  surface.
- [Mastra observability](https://mastra.ai/ai-agent-observability).
- [Mastra experiments](https://mastra.ai/blog/mastra-experiments) and current evaluation guidance in
  [AI Agent Evaluation](https://mastra.ai/articles/ai-agent-evaluation).
- [Mastra homepage](https://mastra.ai/) for current deployment/self-hosting statements and Node-compatible deployment
  model.

Source-level links intentionally pin the repository commit observed during this evaluation where useful. Product/blog
pages are dated observations and should be rechecked before a production integration because Mastra's release cadence is
high.

## Issue #176 definition-of-done mapping

| Requirement                                    | Result                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Relevant primitives inventoried and mapped     | Primitive inventory plus per-area analysis above                                                                 |
| Mastra concepts separated from Ember semantics | Decision, memory/delegation/workflow firewalls, replaceability rules                                             |
| Attractive primitives have Ember-owned seams   | `ProviderInvoker`, capability/MCP ports, `DurableExecutionPort`, `ContextCompressor`, telemetry and scorer seams |
| Replaceability and lock-in evaluated           | Persisted-state lock-in inventory and migration rules                                                            |
| Runtime/dependency/self-hosting costs recorded | Node/self-hosting compatibility plus explicit unmeasured Pi/dependency gate                                      |
| Candidate Ember code areas identified          | Concrete Ember mapping section                                                                                   |
| Suitable for #175 comparison                   | Final recommendation matrix uses the common adopt/wrap/avoid/revisit framing                                     |
