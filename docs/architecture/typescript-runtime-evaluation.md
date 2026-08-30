---
summary: "Evidence-backed evaluation of TypeScript on Node.js 26 and Deno 2.9 against Ember's Node.js 24 JavaScript continuity baseline."
read_when:
  - "Choosing or reviewing Ember's implementation language and runtime after issue #38"
  - "Comparing Node.js 26 and Deno for TypeScript tooling, compatibility, resource footprint, permissions, and migration cost"
role: design
discovery_status: current
---

# TypeScript runtime evaluation

## Status and decision boundary

This document records the experiment from issue #38. It is evidence for the
implementation-stack decision in issue #39; it is **not** that decision.

The experiment separates three questions that are easy to conflate:

1. what the current JavaScript + Node.js 24 continuity slice costs and proves;
2. whether TypeScript adds useful correctness and refactoring boundaries to
   representative Ember code;
3. whether Node.js 26 or Deno 2.9 is the better runtime/tooling environment for
   that TypeScript source.

Neither runtime candidate failed Ember's representative workload. Nothing in
this note selects a runtime by implementation accident, and none of the runtime
findings changes Ember's accepted semantic architecture. In particular,
TypeScript types do not make persisted or external data trustworthy, and Deno
runtime permissions restrict technical capability rather than confer Ember
semantic authority.

## Canonical evidence

The final canonical experiment run is GitHub Actions runtime-evaluation run
[#33331965679](https://github.com/arhor/ember/actions/runs/33331965679) against
experiment commit `0129684d5ba53ad2a604a3085599a9c8048ee2e6`.

The run completed successfully after all **38** declared positive and
expected-negative outcomes matched the experiment contract. Its raw evidence is
artifact `runtime-evaluation-evidence`, artifact ID `9737923393`; the uploaded
zip's recorded SHA-256 is
`849cc64a5cd3fa77be639f203a40f59dae4c0d4fc98251c400a7d1f26fde093d`.

The workflow intentionally collects probe outcomes before asserting the
contract. Expected negative results can therefore remain visible evidence
without allowing an unexpected failure to hide behind a green collection step.
For the three expected-negative probes, the status contract checks non-zero exit
rather than diagnostic text. The canonical artifact was additionally inspected
manually to verify that the failures were the intended `TS2322`/`TS2739`
TypeScript boundary errors and the package-specific Deno `TS2307` import errors,
not unrelated process failures.

Environment:

| Item | Canonical value |
| --- | --- |
| Runner image | Ubuntu 24.04.4 LTS, `ubuntu-24.04` image `20260823.283.1` |
| Kernel | Linux `6.17.0-1022-azure` |
| CPU | AMD EPYC 7763, 4 vCPUs / 2 cores / 2 threads per core |
| Memory | 15 GiB |
| Node control | Node.js 24.20.0, npm 11.19.0 |
| Node candidate | Node.js 26.8.1, npm 11.19.0 |
| Node TypeScript checker/LSP | TypeScript 7.0.2 |
| Node ambient types | `@types/node` 26.4.0 |
| Deno candidate | Deno 2.9.5, V8 15.0.245.2-rusty, embedded TypeScript 6.0.3 |
| Ecosystem probe | `@modelcontextprotocol/sdk` 1.30.0 |

The source, package lock, probes, and measurement harness are under
`experiments/runtime-evaluation/`; orchestration lives in
`.github/workflows/runtime-evaluation.yml`. The experiment is isolated from the
adopted JavaScript implementation under `src/ember/` and `bin/ember.mjs`.

## Experimental procedure

One Linux runner hosts all candidates so host differences do not become runtime
differences. The workflow:

1. installs and records pinned Node 24, Node 26, and Deno executables;
2. validates repository documentation discovery;
3. runs the unchanged JavaScript corpus on Node 24;
4. runs the same unchanged corpus on Node 26;
5. installs the locked TypeScript/MCP npm graph with `npm ci`;
6. type-checks, tests, diagnoses, and navigates the representative TypeScript
   port on Node 26;
7. exercises the MCP npm boundary on Node;
8. checks, tests, covers, lints, formats, navigates, and runs the same port with
   Deno;
9. runs the unchanged current JavaScript corpus and current CLI directly under
   Deno;
10. verifies Deno deny/allow behavior for environment, read, write, subprocess,
    and network capabilities;
11. measures cold check, the complete current test corpus, restart behavior,
    idle CLI state, provider cycles, typed tests, and static checks on the same
    host;
12. records executable, dependency, cache, and continuity-store footprint;
13. asserts every declared positive and expected-negative outcome.

Mutable continuity state is copied from one deterministic template before each
timed CLI sample. Reported measurements are medians over the recorded repeat
count, with raw samples retained in the artifact. Process memory is sampled
Linux `/proc` RSS for the root process plus discovered descendants, not a
language-runtime heap metric.

These measurements are directional. GitHub-hosted scheduling, filesystem cache
state, short subprocess lifetimes, a 5 ms process sampler, and the small corpus
prevent benchmark-grade claims. The purpose is to expose differences that could
matter to Ember, not rank general-purpose JavaScript runtimes.

## Node.js 24 JavaScript control baseline

The control is the unchanged dependency-free native-ESM continuity slice on the
PR base.

`package.json` declares Node `>=24` and contains no `dependencies` or
`devDependencies`. The current repository confidence loop is deliberately small:

- `node --test` runs the repository suite;
- the explicit corpus used for symmetric measurements is
  `node --test test/*.mjs tests/*.test.mjs`;
- documentation tests are
  `node --test tests/docs-discovery.test.mjs tests/docs-discovery-repository.test.mjs`;
- `npm run check` syntax-checks the CLI, `src/ember`, tests, and provider
  fixtures, then validates documentation-discovery metadata.

The master branch currently has two CI workflows. `continuity-vertical-slice.yml`
uses Node 24 and runs the complete Node test suite, explicit documentation tests,
and `npm run check` on relevant pull requests and pushes. `docs-discovery.yml`
independently validates the repository documentation contract.

The control has no selected static type checker, formatter, linter, or coverage
package. Its pre-execution code diagnostics are JavaScript syntax and repository
metadata validation; semantic invalid states are rejected at runtime by the
production validator and acceptance tests. The unchanged control corpus includes
checks for duplicate current slots, missing evidence, malformed timestamps,
invalid UTF-8, store/lock failures, provider protocol violations, timeout
behavior, correction/supersession, projection semantics, and complete restart.

In the canonical experiment run Node 24 reported 99 Node test-runner entries
passing. The deterministic empty continuity-state template used by the timing
harness was 669 bytes.

## Representative TypeScript port

The port covers the boundaries that matter to stack selection without creating
a second production implementation:

- `model.ts`: discriminated semantic variants and branded identifiers;
- `semantics.ts`: typed mutation including preference supersession with fresh,
  attributable evidence;
- `projection.ts`: purpose- and scope-bounded provider projection distinct from
  canonical persistent state;
- `validation.ts`: parsing from `unknown` plus representative semantic graph
  invariants;
- `store.ts`: exclusive-create locking and
  `fsync(temp) -> rename -> fsync(directory)` replacement;
- `provider.ts`: one-shot subprocess JSON, bounded output, timeout and
  termination behavior;
- `runtime.ts`: reconstruction of provider input from reloaded canonical state.

The typed tests exercise correction A -> B, preservation of A as history, fresh
evidence for B, canonical commit, a new store instance, a new scoped projection,
exclusion of wrong-scope and historical meanings, and a fresh provider process.
They also forcibly cast corrupted data to `PersistentState` and verify that the
store rejects it again at the canonical write boundary.

The existing JavaScript acceptance suite remains the stronger semantic oracle.
The TypeScript port intentionally does not duplicate every production field,
lifecycle type, stale-lock recovery branch, or validator merely to increase the
amount of TypeScript in the comparison. Some fixture operations, including the
supersession timestamp, are deterministic experiment fixtures rather than a
production-ready clock API.

## TypeScript language findings

### Useful static boundaries

TypeScript caught two deliberately representative mistakes before execution:

- assigning an `EvidenceId` to a `MeaningId` produced `TS2322`, including the
  incompatible brand in the diagnostic;
- assigning canonical `PersistentState` where a bounded `Projection` is
  required produced `TS2739`, naming the projection fields that are absent.

Those are useful classes of Ember error. Branded identifiers protect
provenance-bearing references from ordinary cross-use, while the state versus
projection distinction makes accidental canonical-state disclosure across a
provider/delegation boundary harder.

Discriminated unions also make semantic variant handling exhaustively checkable,
and the port demonstrated compile-time separation among persistent state,
projection, CLI input, provider request/result, and branded IDs. Both
TypeScript 7.0.2 and Deno's embedded TypeScript 6.0.3 rejected the same two
intentional boundary violations with useful diagnostics, and the shared source
successfully type-checked under both candidates.

### What TypeScript does not protect

Static types did **not** replace a trust or semantic boundary.

Persisted JSON starts as `unknown` and remains runtime-validated. The port must
still establish invariants that a TypeScript annotation cannot prove, including:

- uniqueness of current semantic slots;
- existence and identity of evidence references;
- reciprocal supersession links;
- compatible kind, owner, slot, and scope across a supersession edge;
- absence of corruption introduced through untrusted JSON or an unsafe
  assertion.

The store validates immediately before canonical replacement even when its
caller already holds a `PersistentState`. This is evidence for TypeScript as a
developer/agent feedback and refactoring layer, not as a replacement for runtime
validation of canonical state, provider output, package input, or other external
boundaries.

### Language cost

Useful types add explicit constructors, variant declarations, and boundary
interfaces. Some of that knowledge necessarily overlaps with runtime validators.
For simple scalar values the type layer is mostly descriptive; its strongest
value appeared at cross-module semantic boundaries. The experiment does not
support encoding every persistent invariant as elaborate type-level machinery.

## Node.js 26 + TypeScript 7

### Direct source execution and checking

Node.js 26.8.1 directly executed the port's `.ts` source, including
`node --test test/*.test.ts`, without a transpiler or runtime loader. The source
stays inside erasable TypeScript syntax.

Node's runtime TypeScript support does not type-check code and does not apply
`tsconfig.json`; static checking remains a separate toolchain action. The
experiment pins `typescript@7.0.2` and runs `tsc -p tsconfig.json` with `noEmit`.
No generated JavaScript tree or mandatory build/transpile stage was required.

### TypeScript 7 tooling shape

TypeScript 7.0 is a native implementation whose editor/tooling boundary differs
from TypeScript 6 and earlier. Version 7.0.2 does not ship the historical
programmatic JavaScript Compiler/Language Service API. An early experiment probe
incorrectly attempted that old interface; the probe was fixed rather than
reclassifying the failure as poor editor support.

The final probe launches the installed TypeScript 7 `tsc` with its native LSP
over stdio, initializes a workspace, opens `src/runtime.ts`, resolves the real
`buildProjection` call to `src/projection.ts`, requests hover data, and shuts the
server down cleanly. The server identified itself as `typescript-go` 7.0.2.

The absence of a programmatic API in TypeScript 7.0 remains a real consideration
for tools that embed compiler/language-service APIs rather than use CLI/LSP.
TypeScript's 7.0 release notes describe a new API as future work for 7.1; the
experiment therefore treats this as a current-version constraint, not a
permanent language property.

### Tests and npm ecosystem

The representative typed suite passed 10/10 tests under Node 26. The unchanged
current JavaScript corpus also passed 99/99 Node test-runner entries on Node 26.
Node reports the repository's `test/support.mjs` support file as a zero-test
entry, which explains why Deno reports 98 actual tests for the same explicit
corpus rather than 99.

The MCP probe imported `@modelcontextprotocol/sdk` 1.30.0 through ordinary npm
bare ESM imports and completed an in-memory client/server tool round trip with
no package-specific workaround.

### Tooling surface

Node itself does not supply the same integrated lint/format/coverage workflow
exercised for Deno. The experiment deliberately did not add ESLint, Prettier, a
coverage dependency, or a transpiler merely because those tools are conventional
in Node TypeScript repositories. Issue #39 should decide whether Ember actually
needs such additions and which minimal set earns its dependency and
configuration cost.

Node's native test runner plus TypeScript 7's checker/LSP were enough to exercise
the core port. That is a small Node setup, but correspondingly less integrated
than Deno's built-in development surface.

## Deno 2.9

### Compatibility with current Ember behavior

Deno 2.9.5 ran the representative TypeScript port successfully through the same
Node-style filesystem and subprocess APIs used by the Node candidate. The typed
suite passed 10/10 tests, covering:

- exclusive-create locking;
- temporary-file sync, atomic rename, and directory sync;
- write-boundary validation;
- bounded one-shot provider subprocess I/O;
- provider timeout and direct-child termination;
- restart/reload reconstruction and scoped projection.

More significantly for migration risk, Deno ran the **unchanged current
JavaScript implementation and acceptance corpus** with 98/98 actual tests
passing. The current `bin/ember.mjs` also completed a real
`init -> check -> run` smoke with the scripted provider executed through Deno and
produced a `CONTINUITY_RESPONSE`.

This is strong compatibility evidence for the APIs and behavior Ember uses
today. It is not proof that every future Node package, native addon, process
behavior, or platform-specific API will remain compatible.

### Built-in tooling

The same checkout successfully exercised:

- `deno check` on the core typed port;
- `deno test` on the typed tests;
- `deno lint`;
- `deno fmt --check`;
- `deno test --coverage` and `deno coverage`;
- Deno LSP go-to-definition from `runtime.ts` to `projection.ts`.

Coverage of the representative port was 75.3% branches, 95.1% functions, and
85.3% lines. Those values prove that the built-in coverage path works; they are
not a proposed Ember coverage threshold.

The Deno candidate needed one `deno.json` for project configuration and did not
need separate installed packages for checker, test runner, lint, formatter,
coverage, or language server.

Deno 2.9.5 embeds TypeScript 6.0.3 while the Node candidate independently pins
TypeScript 7.0.2. Runtime choice therefore also affects checker release policy:
Node can pin TypeScript independently, while Deno couples its built-in checker
to the Deno release. The shared source passed both versions.

### Runtime permissions

With `--no-prompt` and no relevant allow flag, the experiment verified denial of:

- the sentinel environment variable;
- a specific input-file read;
- a specific output-file write;
- launching the Node 26 executable;
- opening a TCP connection to `127.0.0.1:9`.

Each operation then succeeded, or in the network case reached the expected
transport-level `ConnectionRefused`, when granted the corresponding scoped
`--allow-env`, `--allow-read`, `--allow-write`, `--allow-run`, or `--allow-net`
capability. The network probe performs an actual connection attempt rather than
treating a permission-query result as proof of enforcement.

This demonstrates a runtime least-capability mechanism. It does **not** establish
that Ember is authorized to perform an action. Reachability, credentials, or
runtime permission are technical capabilities only; Ember's live attributable
authority and disclosure rules remain governed by the semantic architecture.

## npm ecosystem probe

`@modelcontextprotocol/sdk` 1.30.0 was chosen as a plausible near-term
capability/delegation dependency rather than a synthetic compatibility package.

| Probe | Node 26 | Deno 2.9 |
| --- | --- | --- |
| Install mechanism | locked `npm ci` | same package graph present in `node_modules` |
| Bare ESM imports | pass | runtime pass |
| In-memory MCP round trip | pass | pass |
| Package-specific static check | pass through Node TS project | `deno check ecosystem/mcp-deno.ts` reports `TS2307` for SDK deep subpaths |

Deno therefore demonstrated runtime npm compatibility for this package but not a
frictionless checker experience with the exact bare deep imports used by the
probe. Its checker failed to resolve
`@modelcontextprotocol/sdk/client/index.js`, `server/index.js`, `inMemory.js`,
and `types.js`, while executing those imports succeeded.

This result is deliberately narrow. It establishes neither that Deno cannot use
npm packages nor that npm compatibility is complete. If Ember later relies on
packages with similar export layouts, the checker friction is a practical risk
to revisit; otherwise it may be immaterial.

## Operational measurements

All values below are medians from canonical run #33331965679. `RSS` is sampled
maximum process-tree resident memory. MiB values are KiB divided by 1024 and
rounded for readability.

### Current JavaScript runtime comparison

| Workload | Node 24 | Node 26 | Deno 2.9 running current JS |
| --- | ---: | ---: | ---: |
| Cold `ember check`, 7 samples | 123.01 ms / 52.6 MiB | 124.07 ms / 53.9 MiB | 134.62 ms / 44.7 MiB |
| Full current test corpus, 3 samples | 2328.05 ms / 317.0 MiB | 2394.00 ms / 301.7 MiB | 4831.27 ms / 197.6 MiB |
| Restart oracle, 3 samples | 951.92 ms / 167.2 MiB | 912.56 ms / 171.9 MiB | 1187.46 ms / 187.5 MiB |
| Idle CLI, 5 samples | 322.92 ms / 56.2 MiB | 334.86 ms / 57.1 MiB | 312.89 ms / 51.5 MiB |
| Scripted provider cycle, 7 samples | 172.20 ms / 56.9 MiB | 173.12 ms / 57.7 MiB | 250.00 ms / 54.9 MiB |

Cold-check timing was almost identical for Node 24 and Node 26; Deno was roughly
11 ms slower in this run. The short Node cold-check processes still produced an
occasional clearly under-sampled RSS observation before exit, so the timing row
is the stronger cold-start signal. The median RSS remained in the same scale as
the stable idle samples.

The full current corpus is now measured symmetrically for all three runtimes.
Deno took about 4.83 s versus 2.33-2.39 s for Node on this small Node-oriented
corpus, while its sampled process-tree RSS was around 198 MiB versus roughly
302-317 MiB for Node. This is a useful feedback-loop observation, not a general
runtime benchmark: the corpus uses the existing Node-style tests and includes
process-heavy acceptance work.

Idle timing includes an intentional 250 ms delay before stdin closes, so the
useful signal there is resident memory. Deno's median idle RSS was roughly
5-6 MiB below the Node variants on this host.

The canonical provider cycle was about 172-173 ms on Node and 250 ms on Deno.
Earlier workflow runs produced different absolute timings and different Node
ordering while semantic results stayed stable, so the magnitude is directional.
Real model/network latency is expected to dwarf these local scripted-provider
differences.

The restart oracle was directionally slower under Deno: about 1.19 s versus
0.91-0.95 s for Node. The workload deliberately starts fresh processes and does
not model a future long-running daemon.

### TypeScript feedback-loop comparison

| Workload | Node 26 + TypeScript 7 | Deno 2.9 |
| --- | ---: | ---: |
| Representative typed tests, 5 samples | 476.91 ms / 230.2 MiB | 1452.68 ms / 290.0 MiB |
| Static check, 5 samples | 2270.46 ms / 536.8 MiB | 868.18 ms / 206.6 MiB |

These rows are not collapsed into a score because they do not measure identical
tool architectures. Node executes typed tests directly with `node --test` and
invokes the separate TypeScript 7 native checker; Deno's test/check commands use
its integrated runtime/toolchain and embedded checker. On this small port,
tool startup and orchestration are a large fraction of total cost.

The concrete feedback-loop result is nevertheless useful: Node's direct typed
test run was substantially faster here, while Deno's standalone check was
substantially faster and used much less sampled RSS than the TypeScript 7 `tsc`
invocation. These numbers cannot be extrapolated to a large project where watch,
incremental, and compiler-parallelism behavior may dominate.

### Footprint

| Item | Canonical size |
| --- | ---: |
| Node 24 executable | 126,458,664 bytes (~120.6 MiB) |
| Node 26 executable | 150,425,704 bytes (~143.5 MiB) |
| Deno executable | 95,582,008 bytes (~91.2 MiB) |
| Experiment `node_modules` | 62,728 KiB (~61.3 MiB) |
| Deno cache after experiment | 10,292 KiB (~10.1 MiB) |
| Deterministic continuity-state template | 669 bytes |

The `node_modules` value is **not** the cost of TypeScript alone. It includes
TypeScript 7 platform packaging, `@types/node`, and the full transitive graph of
the MCP ecosystem probe. `npm ci` reported 98 installed packages. The current
production baseline itself has no runtime or development dependencies.

The Deno cache is likewise only what this workflow produced, not a stable
installed-size guarantee. Executable sizes are deployment context and do not
represent runtime memory.

## Developer and coding-agent ergonomics

The experiment did not run a coding-agent benchmark. Ergonomics evidence comes
from concrete diagnostics, navigation, configuration, and cross-module changes
in this repository.

Shared TypeScript observations:

- branded IDs expose semantically different string identifiers to the checker;
- persistent state, projection, provider, and CLI boundaries become navigable
  named types rather than object-shape conventions;
- discriminated variants support exhaustive semantic edits;
- both checkers produced direct diagnostics for representative boundary errors;
- runtime validators remain explicit, so neither a human nor an agent can safely
  infer that an annotation validated external data.

Node 26 + TypeScript 7:

- direct `.ts` execution avoids a transpiler and generated JS tree;
- `node --test` runs typed tests directly;
- static confidence needs a separate `tsc` invocation and `tsconfig.json`;
- native TypeScript 7 LSP definition navigation and hover worked;
- TypeScript 7.0's absent programmatic API is a current tooling constraint;
- lint, format, and coverage policy remain separate choices rather than tools
  silently adopted by the experiment.

Deno 2.9:

- check, test, lint, format, coverage, and LSP all worked through built-ins;
- fewer separate tool decisions make a fresh checkout easier to explain;
- the existing `node:test` corpus can run without immediate framework migration;
- the MCP package showed runtime npm compatibility can be better than checker
  compatibility for a specific import shape;
- the checker version moves with Deno rather than being independently pinned;
- scoped runtime permissions provide a concrete least-capability deployment
  mechanism below, but separate from, Ember's authority model.

## Evidence table for issue #39

| Concern | Node 24 JS control | Node 26 + TypeScript 7 | Deno 2.9 + TypeScript | Evidence strength |
| --- | --- | --- | --- | --- |
| Current continuity oracle | 99/99 Node entries pass | unchanged JS: 99/99 pass | unchanged JS: 98/98 actual tests pass | strong for current corpus |
| Representative typed semantics | n/a | 10/10 pass | 10/10 pass | strong for experiment port |
| Runtime validation boundary | production validator | `unknown` parse + write revalidation | same typed port | strong for tested invariants |
| Lock/fsync/rename/dir-sync | current baseline | typed port passes | typed port passes | strong on Linux runner |
| Provider timeout/subprocess | current baseline | typed port passes | typed port passes | strong for direct-child protocol |
| Complete restart/scoped correction | current baseline passes | typed port passes | typed port passes | strong for representative scenario |
| Direct `.ts` execution | n/a | yes, erasable syntax | yes | observed |
| Type checking | none in control | TS 7.0.2 `tsc`, separate from Node | built-in, embedded TS 6.0.3 | observed |
| LSP navigation | not evaluated | TS7 native LSP definition + hover pass | Deno LSP definition pass | observed |
| Lint/format/coverage | not selected in baseline | not selected by experiment | built-in probes pass | observed; Node policy undecided |
| MCP npm runtime | n/a | pass | pass | one-package evidence |
| MCP static-check friction | n/a | no observed issue | deep-import `TS2307` | concrete package-specific negative |
| Runtime I/O permissions | ambient OS capability | ambient OS capability | scoped deny/allow probes pass | strong for tested Deno capabilities |
| Idle RSS | ~56 MiB | ~57 MiB | ~51 MiB | directional same-host evidence |
| Cold current-JS check | ~123 ms | ~124 ms | ~135 ms | directional same-host evidence |
| Full current JS corpus | ~2.33 s | ~2.39 s | ~4.83 s | directional same-host evidence |
| Restart oracle | ~0.95 s | ~0.91 s | ~1.19 s | directional same-host evidence |
| Toolchain integration | minimal JS baseline | Node + npm + TS7; other tools undecided | checker/test/lint/fmt/coverage/LSP integrated | observed |
| Programmatic TS API | n/a | TS7.0 does not ship one | Deno tooling API not evaluated as replacement | current tooling constraint |

## Strengths and weaknesses observed

### Node 26 + TypeScript 7

Strengths:

- smallest migration distance from the current executable slice;
- unchanged JavaScript oracle passes;
- direct erasable `.ts` execution avoids a mandatory build/transpile stage;
- npm/MCP probe is straightforward;
- direct typed tests are fast in this small corpus;
- TypeScript 7 diagnostics and native LSP are useful and concrete.

Weaknesses or costs:

- static checking remains a separate installed tool despite native `.ts`
  execution;
- TypeScript 7.0 currently has no programmatic compiler/language-service API;
- lint/format/coverage choices remain external policy/tool decisions if Ember
  wants them;
- the experiment's installed npm graph is materially larger than today's
  dependency-free baseline, though much of it belongs to the MCP probe;
- Node offers no Deno-style runtime permission boundary by default.

### Deno 2.9

Strengths:

- high compatibility with the current Node-oriented Ember slice: the complete
  unchanged JS corpus and current CLI/provider path run successfully;
- one built-in toolchain covers check, test, lint, format, coverage, and LSP;
- idle RSS was modestly lower in the canonical run;
- scoped runtime I/O permissions were directly demonstrated;
- the standalone executable was smaller than either pinned Node executable in
  this runner installation.

Weaknesses or costs:

- the current Node-oriented full test corpus, restart oracle, and provider cycle
  were directionally slower in the canonical run;
- Deno's embedded checker version is coupled to its runtime release;
- the MCP runtime works, but Deno's checker did not resolve the tested deep bare
  imports in the current configuration;
- adopting Deno introduces runtime-specific command, permission, and deployment
  policy even though current Node APIs largely work unchanged;
- current compatibility does not guarantee future npm/native-addon compatibility.

## Migration and adoption cost

A TypeScript migration on Node can stay close to the current architecture:
`.mjs` modules can move incrementally to erasable `.ts`, Node core filesystem,
process, and test APIs remain available, and no runtime abstraction is needed
merely for portability. The principal new mandatory confidence tool is a
TypeScript checker plus project configuration. Formatter/linter/coverage choices
remain separate decisions.

A Deno migration can also preserve much of the source shape because the existing
JS corpus, `node:` APIs, `node:test`, store behavior, and subprocess protocol
already work. The larger change is operational/tooling policy: Deno becomes both
runtime and development toolchain, permission flags become execution/deployment
configuration, npm boundaries should be checked as dependencies are introduced,
and Deno releases control the embedded TypeScript version.

Neither result justifies a generic `Runtime` abstraction or dual-runtime support.
Maintaining two implementations would add complexity without a semantic
requirement demonstrated by #38.

## Unresolved questions for #39

Issue #39 should decide explicitly rather than letting this experiment answer by
inertia:

- whether TypeScript's demonstrated boundary/refactoring value is worth adopting
  independently of runtime choice;
- whether Node's migration/ecosystem simplicity outweighs Deno's integrated
  tooling and runtime permissions for Ember's likely deployment;
- whether TypeScript 7.0's temporary lack of a programmatic API matters before
  7.1 or later tooling is available;
- whether Deno's MCP checker friction matters for Ember's actual dependency set;
- whether checker version should be independently pinned or coupled to runtime;
- which lint/format/coverage policy, if any, a Node selection justifies;
- whether Deno permission-scoped execution materially improves an eventual
  always-on deployment once concrete capabilities and credentials exist;
- whether future native addons, daemon/concurrency requirements, packaging, or
  single-binary distribution change the compatibility picture.

## What this experiment does not establish

This evaluation does **not** establish that:

- TypeScript should be adopted; that decision belongs to #39;
- Node or Deno is the selected Ember runtime;
- Deno is generally faster, slower, lighter, or safer than Node;
- a 5-10 MiB idle RSS difference matters on the eventual target host;
- a roughly 2x full-test difference on this Node-oriented corpus generalizes to
  other workloads;
- scripted local provider timings predict model/network latency;
- TypeScript eliminates semantic/runtime validation;
- Deno permissions grant, represent, or prove Ember semantic authority;
- all npm packages work under Deno because one MCP runtime probe worked;
- Deno's checker is generally incompatible with npm because one MCP deep-import
  probe failed;
- TypeScript 7's missing 7.0 API is permanent;
- the representative TypeScript port is a production replacement for the
  continuity slice;
- the experiment's deterministic fixture timestamps represent a production
  clock/lifecycle design;
- Linux results prove identical filesystem or process behavior on every target
  operating system;
- process-tree RSS sampling is a precise heap profiler;
- expected-negative exit-code gating alone proves the failure reason without
  inspecting the retained diagnostic artifact;
- a runtime abstraction or dual-runtime support is warranted;
- sunk effort in this branch is evidence for selecting either runtime.

## Reproduction

The authoritative command sequence is
`.github/workflows/runtime-evaluation.yml`. The experiment README contains
shorter candidate-specific local commands.

When reproducing or extending this evaluation:

- use the committed `package-lock.json` and `npm ci` for the Node/npm graph;
- record exact runtime/checker versions;
- run the unchanged production oracle separately from the representative typed
  port;
- keep intentional diagnostics and package-specific expected negatives distinct
  from regressions, and inspect their retained diagnostic text;
- compare Node and Deno on the same host;
- reset mutable state before each timed CLI sample;
- retain raw samples rather than only medians;
- do not weaken semantic tests or validators to make a candidate pass;
- do not reinterpret runtime capability restriction as semantic authority.

External implementation behavior referenced while interpreting the experiment
is documented by the runtime/tool authors:

- Node.js TypeScript support: https://nodejs.org/api/typescript.html
- TypeScript 7.0 native LSP/API transition:
  https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Deno permissions: https://docs.deno.com/runtime/reference/permissions/
- Deno testing and `node:test` compatibility: https://docs.deno.com/runtime/test/
- Deno lint/format: https://docs.deno.com/runtime/lint_and_format/
- Deno coverage: https://docs.deno.com/runtime/test/coverage/

The repository's accepted ADRs and acceptance scenarios remain authoritative for
Ember semantics; these external runtime documents describe implementation
mechanisms only.
