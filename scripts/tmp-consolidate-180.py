from pathlib import Path

path = Path("docs/architecture/composable-agent-infrastructure-strategy.md")
text = path.read_text()


def replace_section(source: str, start: str, end: str, body: str) -> str:
    a = source.index(start)
    b = source.index(end, a)
    return source[:a] + body.rstrip() + "\n\n" + source[b:]


text = text.replace(
    'summary: "Issue #180 synthesis of Mastra, LangGraph.js, Vercel AI SDK, and OpenAI Agents SDK research into a staged capability-level adoption strategy that keeps Ember semantics and canonical state framework-independent."',
    'summary: "Issue #180 synthesis of Mastra, LangGraph.js, Vercel AI SDK, and OpenAI Agents SDK research into a single-primary-SDK adoption strategy that keeps Ember semantics and canonical state framework-independent."',
)
text = text.replace(
    '  - "Deciding whether Ember should adopt Mastra, LangGraph.js, Vercel AI SDK, OpenAI Agents SDK, or a mixed composition"',
    '  - "Deciding whether Ember should adopt Vercel AI SDK as a primary toolkit or earn an exception for another agent SDK"',
)

decision = """## Decision

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
> **One primary SDK by default; additional agent runtimes only by demonstrated need.**"""
text = replace_section(text, "## Decision\n", "## Basis\n", decision)

text = text.replace(
    "| bounded agent/tool loop               | H / H / H / M / M       | H / H / H / M / M     | H / M / L / L / H     | **H / M / M / M / H** | **Do not adopt yet.** AI SDK is sufficient for a simple bounded loop; Agents SDK is the stronger optional runner when approvals/retries/loop lifecycle become substantial.                  |",
    "| bounded agent/tool loop               | H / H / H / M / M       | H / H / H / M / M     | **H / M / L / L / H** | H / M / M / M / H     | **Prefer AI SDK as part of the primary stack.** Compare Agents SDK only if a concrete bounded-loop requirement proves materially awkward or fragile on AI SDK plus Ember semantics.           |",
)
text = text.replace(
    "| streaming                             | H / M / M / M / H       | H / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer AI SDK for cognition streaming.** LangGraph streams durable-operation progress; translate both into Ember events.                                                                  |",
    "| streaming                             | H / M / M / M / H       | H / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Prefer AI SDK.** Add another streaming/event vocabulary only if the second runtime itself is independently justified.                                                                      |",
)
text = text.replace(
    "| model retries/error normalization     | H / M / M / M / H       | M / M / M / M / H     | H / L / L / L / H     | **H / M / M / M / H** | AI SDK is enough for ordinary provider retry; Agents SDK has unusually useful replay-safety signals for runner retries. Effect retry safety remains Ember-owned.                            |",
    "| model retries/error normalization     | H / M / M / M / H       | M / M / M / M / H     | **H / L / L / L / H** | H / M / M / M / H     | **Use AI SDK provider retry/error mechanics by default.** Agents SDK replay-safety signals are a challenger advantage, not a reason to stack runtimes preemptively. Effect retry safety remains Ember-owned. |",
)
text = text.replace(
    "| durable execution/checkpointing       | H / M / M / M-H / H     | **H / M / M / M / H** | —                     | M / H / H / M / M     | **Prefer LangGraph Functional API if a concrete durable operation is earned.** Do not replace ADR 0007 globally.                                                                            |",
    "| durable execution/checkpointing       | H / M / M / M-H / H     | **H / M / M / M / H** | —                     | M / H / H / M / M     | **Keep Ember/systemd custom today.** If a concrete checkpointed operation exposes a real gap, LangGraph Functional API is the leading second-SDK challenger, not a planned companion.          |",
)
text = text.replace(
    "| suspend/resume and approvals          | H / M / M / M / H       | **H / M / M / M / H** | M / M / L / L / H     | H / M / M / M / M-H   | LangGraph is strongest for process-restart durability; AI SDK approval is good call-level plumbing; Agents SDK `RunState` is acceptable only as opaque bounded-run state.                   |",
    "| suspend/resume and approvals          | H / M / M / M / H       | **H / M / M / M / H** | M / M / L / L / H     | H / M / M / M / M-H   | **Use AI SDK approval plumbing for ordinary bounded work.** Escalate to LangGraph only for earned restart-durable waits; treat Agents SDK `RunState` only as a challenger implementation.      |",
)
text = text.replace(
    "| eval/testing support                  | H / M / M / M / H       | M / M / M / M / H     | **H / L / L / L / H** | **H / L / M / M / H** | Keep Ember acceptance oracles. Prefer AI SDK mocks for AI SDK adapters and Agents SDK `ScriptedModel` for runner adapters; Mastra scorers are optional if they beat existing eval plumbing. |",
    "| eval/testing support                  | H / M / M / M / H       | M / M / M / M / H     | **H / L / L / L / H** | H / L / M / M / H     | Keep Ember acceptance oracles. **Prefer AI SDK mocks with the primary stack.** Use challenger-specific test helpers only after that challenger is independently adopted.                       |",
)

vercel = """### Vercel AI SDK is the preferred primary toolkit

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
uncertainty mechanics."""
text = replace_section(
    text,
    "### Vercel AI SDK wins the generic cognition layer\n",
    "### LangGraph wins durable execution, but only when Ember earns durable execution\n",
    vercel,
)

langgraph = """### LangGraph is the durable-execution challenger, not a planned companion

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
wait for approval or survive process restart across multiple durable steps."""
text = replace_section(
    text,
    "### LangGraph wins durable execution, but only when Ember earns durable execution\n",
    "### OpenAI Agents SDK is the optional bounded-runner layer\n",
    langgraph,
)

agents = """### OpenAI Agents SDK is an alternative runner, not an extra default layer

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
adapter-local. Handoffs are specifically **not** Ember delegation."""
text = replace_section(
    text,
    "### OpenAI Agents SDK is the optional bounded-runner layer\n",
    "### Mastra is a useful toolbox, but not the baseline composition\n",
    agents,
)

text = text.replace(
    "| `src/providers/contract.ts`                              | cognition invocation seam, request/result shapes, abort option                                          | AI SDK or Agents SDK may implement a future direct backend                   |",
    "| `src/providers/contract.ts`                              | cognition invocation seam, request/result shapes, abort option                                          | AI SDK is the preferred future direct backend; alternatives are challengers  |",
)
text = text.replace(
    "| future local tool layer                                  | model-facing schemas, loop execution, timeout, approval plumbing                                        | AI SDK first; Agents SDK when a richer runner is earned                      |",
    "| future local tool layer                                  | model-facing schemas, loop execution, timeout, approval plumbing                                        | AI SDK first; another agent SDK only after a demonstrated gap                |",
)

strategies = """## Composition strategies

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
this research. Let the next earned feature trigger the first AI SDK adapter."""
text = replace_section(text, "## Composition strategies\n", "## Recommended staged adoption\n", strategies)

staged = """## Recommended staged adoption

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
code, but they should not pull in a second agent runtime by gravity."""
text = replace_section(text, "## Recommended staged adoption\n", "## Persisted-state and migration escape hatches\n", staged)

text = text.replace(
    "### P2 when a bounded loop becomes complex: AI SDK loop versus Agents SDK runner spike",
    "### P2 only if the AI SDK bounded loop proves insufficient: Agents SDK challenger spike",
)
text = text.replace(
    "**Candidate issue:** `Compare bounded cognition loop implementations behind one Ember contract`",
    "**Candidate issue:** `Validate an Agents SDK runner only after an AI SDK capability gap`",
)
text = text.replace(
    "Compare code removed, approval/resume behavior, replay-safety evidence, deterministic\ntests, provider coupling, package footprint, and type/state leakage.",
    "First document the concrete AI SDK deficiency. Then compare code removed,\napproval/resume behavior, replay-safety evidence, deterministic tests, provider\ncoupling, package footprint, type/state leakage, and the cost of running two overlapping\nSDKs.",
)
text = text.replace(
    "### P2 when a durable workflow is actually needed: LangGraph restart/replacement spike",
    "### P2 only if restart-durable execution exposes a primary-stack gap: LangGraph challenger spike",
)
text = text.replace(
    "**Candidate issue:** `Validate LangGraph durable execution behind Ember-owned port`",
    "**Candidate issue:** `Validate LangGraph only after an earned durable-execution gap`",
)
text = text.replace(
    "Use Functional API plus persistent SQLite and actual systemd supervision to prove:",
    "First prove that the operation cannot be served cleanly by the current systemd runtime\nplus the primary AI SDK without substantial custom checkpoint machinery. If that gate\npasses, use Functional API plus persistent SQLite and actual systemd supervision to\nprove:",
)

final_shape = """## Final architecture shape

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
agent SDK only when evidence shows that the primary stack has reached a real boundary."""
text = replace_section(text, "## Final architecture shape\n", "## Issue #180 acceptance mapping\n", final_shape)

text = text.replace(
    "| mixed-library strategy evaluated                          | strategy 2 and staged AI SDK + LangGraph composition                               |",
    "| single-SDK versus mixed-library strategy evaluated         | strategy 1 primary AI SDK plus strategy 2 evidence-gated exception path             |",
)

if "There is no winner because there should not be one owner." in text:
    raise SystemExit("stale final recommendation survived section replacement")

path.write_text(text)
