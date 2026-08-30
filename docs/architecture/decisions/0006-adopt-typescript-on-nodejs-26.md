---
summary: "Accepted implementation decision adopting TypeScript on Node.js 26 with native ESM, direct erasable TypeScript execution, explicit runtime validation, and a deliberately minimal npm toolchain."
read_when:
  - "Changing Ember's implementation language, Node.js release line, TypeScript execution model, package manager, or core development toolchain"
  - "Reviewing whether a runtime-specific API, dependency, build stage, lint/format tool, or capability restriction belongs in Ember"
role: decision
discovery_status: current
---

# ADR 0006: Adopt TypeScript on Node.js 26 as Ember's Implementation Runtime

- **Status:** Accepted
- **Date:** 2026-08-30
- **Decision class:** Implementation/runtime, representation-level
- **Origin:** [Issue #39](https://github.com/arhor/ember/issues/39)
- **Parent milestone:** [Issue #37](https://github.com/arhor/ember/issues/37)
- **Evidence:** [Issue #38](https://github.com/arhor/ember/issues/38) and the [TypeScript runtime evaluation](../typescript-runtime-evaluation.md)
- **Semantic baseline:** ADRs [0001](0001-continuity-belongs-to-ember.md), [0002](0002-preserve-persistent-meaning.md), [0003](0003-use-least-sufficient-permitted-projections.md), [0004](0004-separate-capability-from-authority.md), and [0005](0005-distinguish-operational-continuity.md)

## Context and decision boundary

Ember's first executable continuity slice intentionally used zero-dependency
JavaScript on Node.js 24 as a provisional representation. Issue #38 then exercised
that real continuity workload against a representative TypeScript port on Node.js
26 and Deno 2.9 rather than selecting a stack from ecosystem preference alone.

Both runtime candidates preserved the representative continuity behaviour. The
choice is therefore a project-fit decision among viable implementations, not a
case where one runtime failed Ember's semantics.

This ADR is subordinate to the accepted semantic architecture. It selects how
Ember is implemented; it does not redefine what continuity, persistent meaning,
projection, authority, occurrence, delivery, lifecycle, or recovery mean. A later
runtime or toolchain change may replace this ADR without superseding ADRs 0001-0005
when their semantics remain preserved.

## Evidence synthesis

The canonical experiment was run on one Ubuntu 24.04 GitHub Actions host with
Node.js 24.20.0 as the JavaScript control, Node.js 26.8.1 with TypeScript 7.0.2,
and Deno 2.9.5 with its embedded TypeScript 6.0.3. Measurements are directional,
not general runtime benchmarks.

| Concern | Evidence and decision relevance |
|---|---|
| TypeScript correctness and refactoring value | Branded identifiers rejected cross-use of `EvidenceId` and `MeaningId`; distinct persistent-state and projection types rejected accidental canonical-state substitution; discriminated unions made variant handling exhaustively checkable. This is meaningful protection at Ember's semantic module boundaries. |
| Runtime validation boundary | Persisted JSON still enters as `unknown`; uniqueness, provenance links, reciprocal supersession, scope compatibility, and corrupted external state still require runtime validation. Static types complement rather than replace semantic validation. |
| Complete continuity compatibility | The unchanged current JavaScript corpus passed on Node.js 26 and Deno. The representative typed continuity slice passed on both candidates, including locking, fsync/rename durability operations, provider timeout/subprocess behaviour, restart, and scoped projection. |
| Filesystem, locking, durability, subprocess, signals, restart | Neither candidate exposed a blocker in the tested Linux workload. Node.js keeps the current implementation closest to its already-proven operational APIs. |
| Development-tool complexity | Node requires a separately pinned TypeScript checker and Node ambient types; Deno integrates check, test, lint, format, coverage, and LSP. The Node path nevertheless needs no transpiler or generated JavaScript tree. |
| Diagnostics and coding-agent/editor experience | Both candidates produced useful boundary diagnostics and working definition navigation. TypeScript 7's native LSP worked for the Node candidate; its 7.0 release lacks the historical programmatic compiler/language-service API, which remains a current tooling constraint rather than a semantic concern. |
| Startup and resident memory | Cold current-JS CLI timing was similar across candidates. Deno's measured idle RSS was roughly 5-6 MiB below Node on the canonical host. That difference is not currently large enough to drive the runtime choice. |
| Test/check feedback loop | The Node-oriented full corpus and representative typed tests were faster under Node in the canonical run; Deno's standalone static check was faster and substantially lighter than the separate TypeScript 7 checker. These measurements are workload-specific and do not form a general performance ranking. |
| npm ecosystem interoperability | The representative `@modelcontextprotocol/sdk` runtime round trip worked on both candidates. Node also type-checked the tested imports directly; Deno executed them but its checker reported package-specific `TS2307` failures for the tested deep bare imports. Near-term capability/delegation work makes avoiding this extra uncertainty valuable. |
| Runtime permissions | Deno demonstrated useful scoped read/write/env/run/net denial and allow rules. Node has ambient OS-level process capability by default. The permission advantage is real defense in depth, but it does not establish Ember authority and is not presently valuable enough to outweigh the other project-fit factors. |
| CI and deployment | Node is the smaller operational change from the existing slice and uses the already-familiar npm/Node CI shape. Deno would consolidate tooling but would make the runtime itself responsible for more development and permission policy. |
| Portability and future migration | The evaluated source can remain mostly standards-oriented ESM while using stable `node:` APIs where they provide required filesystem/process semantics. No dual-runtime layer is justified. Deno's successful compatibility run suggests a later migration remains plausible if project needs change. |

The deciding evidence is not a small benchmark lead. Node.js is selected because
it combines the lowest migration distance, the cleanest tested npm/MCP boundary,
strong compatibility with Ember's existing process-heavy oracle, independently
pinnable TypeScript tooling, and no need for a build layer. Deno's integrated
toolchain and permission model remain genuine strengths, but their current value
does not outweigh those factors for Ember's near-term roadmap.

## Decision

### Language: TypeScript

Ember adopts TypeScript as its implementation language.

The intended value of TypeScript is to make important implementation boundaries
explicit and mechanically checkable, especially:

- semantic variants through discriminated unions and exhaustive handling;
- provenance-bearing and otherwise non-interchangeable identifiers through
  branded or opaque types where they earn their ceremony;
- separation of canonical persistent state, derived projections, provider
  protocol values, CLI inputs, and other cross-module contracts;
- safer refactoring and navigation across model, semantics, projection, runtime,
  store, provider, and future capability/delegation boundaries.

TypeScript is **not** an authority, trust, persistence, or semantic-validation
mechanism. Data read from disk, providers, tools, network/package boundaries, CLI
input, or any other external source remains untrusted until the appropriate
runtime validator establishes the invariants required at that boundary. Canonical
writes continue to validate even when the caller holds a statically typed value.

The project should prefer ordinary, readable types over elaborate type-level
encodings of invariants that are necessarily validated at runtime anyway.

### Runtime: Node.js 26

Ember selects the Node.js 26 release line.

The initial adoption baseline is **Node.js 26.8.1**, the exact version exercised by
#38. The minimum supported version is therefore 26.8.1 until a reviewed runtime
update changes that floor.

Version policy:

- CI should pin an exact Node.js version so the semantic oracle is reproducible;
- the supported production/development range should remain within Node.js 26 and
  should reject versions older than the reviewed minimum;
- patch or minor movement within the 26.x line requires an explicit reviewed
  update with the full confidence suite, not an automatic "latest" float;
- a Node.js major-line upgrade requires explicit architecture/toolchain review and
  should update this ADR when it changes any material assumption;
- a lifecycle label change for the already-selected 26.x line does not by itself
  change the architecture decision;
- Ember does not automatically chase each new Node Current or LTS line.

Node compatibility is the selected implementation contract, not a general
cross-runtime portability requirement. Ember should keep portable boundaries
where doing so is cheap, but it may depend directly on stable Node core APIs when
they materially support required behaviour.

### Source and module format

Production source is native ESM TypeScript:

- `.ts` source files;
- `package.json` with `"type": "module"`;
- NodeNext-compatible module resolution;
- explicit relative TypeScript module specifiers where required by direct source
  execution;
- TypeScript restricted to syntax Node can erase directly at runtime;
- no generated JavaScript source tree as a normal development or CI artifact.

The evaluated compiler settings are the starting point for adoption:
`strict`, `noEmit`, `module`/`moduleResolution: NodeNext`,
`allowImportingTsExtensions`, `erasableSyntaxOnly`, and
`verbatimModuleSyntax`. Issue #40 may make only the mechanical adjustments needed
to apply that policy to the production tree.

No transpiler, bundler, loader hook, or mandatory build step is selected.
Packaging or distribution requirements may justify one later, but such a stage
must solve a concrete deployment problem rather than become default TypeScript
ceremony.

### Runtime-specific APIs

Ember may use stable `node:` APIs directly where #38 already demonstrated their
fit or where a later requirement justifies them. In particular, direct use of
Node filesystem, file-handle synchronization, exclusive-create locking, process,
signal, child-process, path, and native test-runner APIs is acceptable.

A generic runtime adapter is not required merely to preserve hypothetical Deno
compatibility. Replaceable boundaries should still remain semantically clean, but
indirection must earn itself through a real alternate implementation or testing
need.

## Minimal toolchain policy

The selected toolchain is intentionally smaller than a conventional TypeScript
wishlist.

| Concern | Policy |
|---|---|
| Runtime | Node.js 26, initially pinned to 26.8.1 in CI. |
| Package manager | npm. Commit the lockfile and use `npm ci` in CI. Do not add another package manager without a concrete benefit. |
| Type checking | Pin TypeScript 7 as a development dependency and run `tsc` with `noEmit` and strict settings. Type checking is a required confidence gate because #38 demonstrated useful failures before execution. |
| Node ambient types | Pin the matching `@types/node` release family as a development dependency. |
| Tests | Keep Node's built-in `node:test` runner. Execute `.ts` tests directly with Node. Existing semantic acceptance tests remain the stronger behavioural oracle. |
| Linting | No external linter is mandatory at initial adoption. #38 did not evaluate or justify one. Add a linter only when concrete recurring defects or policy needs cannot be covered clearly by TypeScript, tests, or small repository checks. |
| Formatting | No mandatory formatter is selected at initial adoption. Preserve the repository's existing style in review. Adopt a formatter only through a deliberate toolchain change justified by measurable formatting churn or contributor cost. |
| Coverage | No coverage threshold or mandatory coverage package is selected. Coverage may be used diagnostically, but the architecture confidence gate remains semantic scenarios and tests rather than an unevidenced percentage target. |
| Source execution | Execute TypeScript source directly with Node. |
| Transpilation/build | None for normal development, tests, CI, or source-based deployment. |
| Editor/LSP | TypeScript's standard CLI/LSP diagnostics are the supported tooling boundary. No editor-specific integration is required. |
| Runtime dependencies | Prefer Node core/platform facilities when sufficient. Add runtime npm dependencies only for concrete capabilities that justify their maintenance, security, and portability cost. |

After issue #40 adopts this decision, the top-level confidence loop should expose
small repository-native commands equivalent to:

```text
npm ci
npm run check
npm test
```

`check` must include TypeScript static checking and existing deterministic
repository checks such as documentation-discovery validation. `test` must retain
the pre-existing semantic acceptance oracle. The exact script decomposition is an
adoption detail, not a reason to add another build system.

## Dependency policy

The Node ecosystem is a practical advantage, not permission to grow Ember's core
indiscriminately.

- Production dependencies must solve a concrete requirement and should be judged
  against a Node-core or small local implementation where that comparison is
  sensible.
- Development dependencies are also part of the maintenance surface. The initial
  TypeScript migration earns the checker and Node type declarations; it does not
  automatically earn ESLint, Prettier, a test framework, a bundler, a loader, or a
  coverage stack.
- Versions used by CI must be lockfile-reproducible.
- Native addons or packages with platform-sensitive behaviour require explicit
  compatibility evidence before becoming essential to the continuity core.
- npm package availability does not expand Ember's semantic capabilities or
  authority. It only expands what the process may technically be able to do.

## Capability and permission boundary

Node.js 26 does not provide the Deno permission boundary exercised by #38. Ember
therefore assumes ambient process capability constrained by the host operating
system, service/container configuration, credentials, and any later capability
adapter.

This is an implementation-level limitation, not a weakening of ADR 0004.
Technical capability and live attributable authority remain independent. A Node
process being able to read a file, open a socket, spawn a subprocess, or use a
credential never establishes that Ember is authorized to do so.

Likewise, future OS/container sandboxing or a runtime permission mechanism would
provide defense in depth only. It would not become the source of Ember semantic
authority.

## Rejected alternatives

### JavaScript on Node.js 24

**What it did well:** the current slice is dependency-free, native ESM, small to
understand, operationally proven by the existing acceptance suite, and requires
almost no toolchain bootstrap.

**Why it is not selected:** the TypeScript experiment caught meaningful
cross-boundary mistakes before execution and made semantic contracts more explicit
for refactoring, navigation, and coding-agent work. Those benefits matter more as
the project grows beyond the first vertical slice.

**Nature of rejection:** current project fit and maintainability, not a claim that
JavaScript is incapable of implementing Ember.

**Revisit evidence:** TypeScript checker/tooling cost would need to become
materially harmful while the demonstrated boundary protections cease to provide
commensurate value. A small local regression in check time alone is insufficient.

### TypeScript on Deno 2.9

**What it did well:** Deno ran the representative typed slice and the unchanged
current JavaScript corpus; its built-in check/test/lint/format/coverage/LSP surface
was cohesive; its idle RSS was modestly lower in the canonical run; and its scoped
runtime permissions provided directly demonstrated least-capability enforcement.

**Why it is not selected now:** Ember's current Node-oriented test/restart/provider
workload was directionally faster on Node; the tested MCP package had a clean Node
runtime and checker path but exposed Deno checker friction around deep npm imports;
Deno couples the checker version to the runtime; and adopting its operational and
permission model adds change where the current Node APIs already satisfy the
required semantics. The measured idle-memory advantage is too small on present
evidence to dominate these factors.

**Nature of rejection:** ecosystem, tooling-policy, operational, and current-project
fit. It is not an architectural judgment that Deno is generally inferior.

**Revisit evidence:** Deno should be reconsidered if its permission model becomes
materially valuable for Ember's concrete always-on capability envelope, if Node
runtime/tooling memory becomes significant on the intended host, if Node's npm and
toolchain surface grows substantially, if Deno's package-checker interoperability
matches Ember's actual dependency graph, or if deployment/distribution goals make
Deno's integrated runtime materially simpler.

## Consequences

- Issue #40 may migrate the executable slice to TypeScript on Node.js 26 without
  reopening the language/runtime question unless adoption exposes contradictory
  evidence.
- Existing runtime validators and the semantic acceptance suite must survive the
  migration. Replacing them with type assertions would violate this decision.
- The initial production toolchain gains TypeScript and Node ambient types but does
  not gain a general-purpose linter, formatter, bundler, transpiler, test framework,
  or coverage gate.
- Node-specific code is acceptable where it buys real behaviour. Cross-runtime
  abstraction is not a goal by itself.
- Deno remains a credible future alternative because #38 demonstrated substantial
  compatibility; keeping representation boundaries semantically clean lowers that
  future migration cost without requiring dual support today.
- The implementation stack now becomes a reviewed architecture choice rather than
  a provisional property of the first executable experiment.

## Revisit triggers

Revisit this ADR when evidence shows one or more of the following materially
changes Ember's project fit:

- Node or the TypeScript toolchain consumes enough resident memory, install space,
  or check time to matter on the intended always-on host rather than only in a
  synthetic or hosted-CI measurement;
- a required npm or native dependency is unsupported, unreliable, or operationally
  awkward on the selected Node line;
- required filesystem, subprocess, signal, restart, or future daemon/concurrency
  behaviour cannot satisfy an accepted architecture scenario on Node;
- Ember develops a concrete least-capability deployment model for which Deno-style
  runtime permissions provide substantial defense-in-depth value that is costly to
  reproduce at the OS/service boundary;
- TypeScript's direct-execution restrictions or checker/tooling complexity force a
  significant build pipeline or reduce development/coding-agent effectiveness;
- deployment shifts toward a single-binary, embedded, mobile, edge, or otherwise
  non-Node environment;
- the dependency/tooling surface grows enough that Deno's integrated tooling or a
  different runtime has a demonstrable maintenance advantage;
- measured coding-agent navigation, diagnostics, or cross-module refactoring safety
  materially contradicts the benefits observed in #38;
- a future Node major changes native TypeScript execution, module resolution,
  process/filesystem semantics, or another assumption this ADR relies on.

A revisit is evidence-driven. The existence of a newer runtime release, a popular
alternative, or a microbenchmark win is not by itself sufficient.

## Explicit non-decisions

This ADR does not select or redesign:

- persistence technology or schema beyond preserving current semantic validation
  requirements;
- daemon/service topology, scheduling, background cognition, or concurrency model;
- provider/delegation protocol, MCP/ACP architecture, or capability framework;
- memory retrieval, embeddings, ranking, or context-selection algorithms;
- semantic permission or authority representation;
- packaging into a standalone executable;
- a generic runtime abstraction or dual-runtime support.

Those questions remain governed by their own evidence and by ADRs 0001-0005.

## Traceability

| Canonical source | Decision basis |
|---|---|
| [Issue #37](https://github.com/arhor/ember/issues/37) | Defines the experiment -> decision -> adoption sequence and requires the runtime choice to remain subordinate to Ember semantics. |
| [Issue #38](https://github.com/arhor/ember/issues/38) and [TypeScript runtime evaluation](../typescript-runtime-evaluation.md) | Provide the comparative language, compatibility, tooling, diagnostics, resource, npm, permission, CI, and migration evidence used here. |
| [Minimal Continuity Vertical Slice](../minimal-continuity-slice.md) | Supplies the executable control workload whose semantics the selected stack must preserve. |
| [Architecture Acceptance Scenarios](../acceptance-scenarios.md) | Remain the representation-neutral oracle for implementation changes, including issue #40 adoption. |
| [ADR 0001](0001-continuity-belongs-to-ember.md) | Keeps Ember continuity independent of runtime, process, model, or other operational locus. |
| [ADR 0002](0002-preserve-persistent-meaning.md) | Requires runtime validation and durable provenance/currentness semantics that static typing cannot replace. |
| [ADR 0003](0003-use-least-sufficient-permitted-projections.md) | Makes typed state/projection separation useful while keeping projection meaning representation-neutral. |
| [ADR 0004](0004-separate-capability-from-authority.md) | Places Node ambient capability and any future sandbox below live semantic authority. |
| [ADR 0005](0005-distinguish-operational-continuity.md) | Requires process, timeout, restart, delivery, effect, and recovery behaviour to preserve operational distinctions independently of runtime implementation. |
| [Documentation discovery contract](../../documentation-discovery.md) | Requires this ADR to be discoverable as a current decision without allowing metadata or file order to create semantic authority. |
