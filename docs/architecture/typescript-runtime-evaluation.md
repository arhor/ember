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

The experiment compares three deliberately separated questions:

1. the current JavaScript + Node.js 24 continuity slice as the control;
2. whether TypeScript adds useful correctness and refactoring boundaries to
   Ember's representative semantic/runtime code;
3. whether Node.js 26 or Deno 2.9 is the better runtime/tooling environment for
   that TypeScript source.

Neither candidate failed Ember's representative workload. Nothing in this note
selects a runtime by implementation accident, and none of the runtime findings
changes Ember's accepted semantic architecture. In particular, TypeScript types
do not make persisted or external data trustworthy, and Deno runtime
permissions are capability restrictions rather than Ember semantic authority.

## Canonical evidence

The canonical run is GitHub Actions runtime-evaluation run
[#33331526419](https://github.com/arhor/ember/actions/runs/33331526419) against
experiment commit `dfae37583c15e5f0adba81101d8a6bceea3f0be6`.

The run completed successfully after all 37 declared positive and
expected-negative outcomes matched the experiment contract. Its uploaded raw
evidence is artifact `runtime-evaluation-evidence`, artifact ID `9737795957`.
The workflow intentionally collected all probe outcomes before asserting the
contract so an expected negative result could be retained as evidence without
allowing an unexpected failure to hide behind a green collection step.

Environment:

| Item | Canonical value |
| --- | --- |
| Runner image | Ubuntu 24.04.4 LTS, `ubuntu-24.04` image `20260823.283.1` |
| Kernel | Linux `6.17.0-1022-azure` |
| CPU | Intel Xeon Platinum 8370C, 4 vCPUs / 2 cores / 2 threads per core |
| Memory | 15 GiB |
| Node control | Node.js 24.20.0, npm 11.19.0 |
| Node candidate | Node.js 26.8.1, npm 11.19.0 |
| Node TypeScript checker/LSP | TypeScript 7.0.2 |
| Node ambient types | `@types/node` 26.4.0 |
| Deno candidate | Deno 2.9.5, V8 15.0.245.2-rusty, embedded TypeScript 6.0.3 |
| Ecosystem probe | `@modelcontextprotocol/sdk` 1.30.0 |

The source, package lock, workflow, probes, and measurement harness are under
`experiments/runtime-evaluation/` and `.github/workflows/runtime-evaluation.yml`.
The experiment is isolated from the adopted JavaScript implementation under
`src/ember/` and `bin/ember.mjs`.

## Experimental procedure

The workflow uses one Linux runner for all candidates so host differences do not
become runtime differences. It performs these stages in order:

1. install and record the pinned Node 24, Node 26, and Deno executables;
2. validate repository documentation discovery;
3. run the unchanged JavaScript acceptance/test corpus on Node 24;
4. run that same unchanged corpus on Node 26;
5. install the locked TypeScript/MCP npm graph with `npm ci`;
6. type-check and test the representative TypeScript port on Node 26;
7. exercise intentional TypeScript errors and the TypeScript 7 native LSP;
8. exercise the MCP npm-package boundary on Node;
9. check, test, cover, lint, format, navigate, and run the same TypeScript port
   with Deno;
10. run the unchanged current JavaScript corpus and current CLI directly under
    Deno;
11. verify Deno deny/allow behavior for environment, read, write, subprocess,
    and network capabilities;
12. collect repeated same-host timing and process-tree RSS measurements;
13. record executable, dependency, cache, and continuity-store footprints;
14. assert every declared positive and expected-negative outcome.

Mutable continuity state is copied from one deterministic template before each
timed CLI sample. Measurements are medians over the recorded repeat count, with
all raw samples retained by the workflow artifact. Process memory is the sampled
Linux `/proc` RSS of the root process plus discovered descendants, not a language
runtime heap metric.

These measurements are directional. GitHub-hosted runner scheduling, process
sampling, filesystem cache state, short subprocess lifetimes, and tiny corpus
size prevent benchmark-grade claims. The experiment is intended to expose
operationally meaningful differences for Ember, not rank general-purpose
JavaScript runtimes.

## The representative TypeScript port

The port covers the boundaries that matter to the runtime decision without
creating a second production implementation:

- `model.ts`: discriminated semantic variants and branded identifiers;
- `semantics.ts`: typed mutation including preference supersession with fresh,
  attributable evidence;
- `projection.ts`: a purpose- and scope-bounded provider projection distinct
  from canonical persistent state;
- `validation.ts`: parsing from `unknown` plus representative semantic graph
  invariants;
- `store.ts`: exclusive-create locking and
  `fsync(temp) -> rename -> fsync(directory)` replacement;
- `provider.ts`: one-shot subprocess JSON protocol, bounded output, timeout and
  termination behavior;
- `runtime.ts`: reconstruction of provider input from reloaded canonical state.

The typed tests exercise correction A -> B, preservation of A as history,
fresh evidence for B, canonical commit, a new store instance, a new scoped
projection, exclusion of wrong-scope and historical meanings, and a fresh
provider process. They also verify that a value forcibly cast to
`PersistentState` is rejected again at the store write boundary when its
semantic invariants are invalid.

The existing JavaScript acceptance suite remains the stronger semantic oracle.
The TypeScript port intentionally does not duplicate every production field,
lifecycle type, stale-lock recovery branch, or validator merely to increase the
amount of TypeScript in the comparison.

## TypeScript language findings

### Useful static boundaries

TypeScript caught two deliberately representative mistakes before execution:

- assigning an `EvidenceId` to a `MeaningId` produced `TS2322`, including the
  incompatible brand in the diagnostic;
- assigning canonical `PersistentState` where a bounded `Projection` is
  required produced `TS2739`, naming the projection properties that are absent.

Those are useful classes of Ember error. The identifier distinction protects
provenance-bearing references from accidental cross-use, while the state versus
projection distinction makes it harder for canonical state to leak across a
provider/delegation boundary by ordinary programming error.

Discriminated unions also make semantic variant handling exhaustively checkable,
and the port demonstrated compile-time separation among persistent state,
projection, CLI input, provider request/result, and branded IDs. The resulting
module boundaries remained readable rather than requiring a runtime schema
framework or generated type layer.

Both TypeScript 7.0.2 and Deno's embedded TypeScript 6.0.3 rejected the same two
intentional boundary violations with materially useful diagnostics. The shared
source type-checked under both candidates.

### What TypeScript does not protect

Static types did **not** replace any trust or semantic boundary.

Persisted JSON starts as `unknown` and is runtime-validated. The experiment had
to validate facts that the structural type system cannot establish from an
object's TypeScript annotation, including:

- uniqueness of current semantic slots;
- existence and identity of evidence references;
- consistency and reciprocity of supersession links;
- compatible kind, owner, slot, and scope across a supersession edge;
- absence of semantic corruption introduced through untrusted JSON or an unsafe
  assertion.

The store validates a candidate immediately before canonical replacement even
when the caller already has a `PersistentState` type. A test intentionally uses
a type assertion to smuggle invalid state past the compiler and confirms that
the write is refused.

This is not ceremony that TypeScript made unnecessary. It is evidence that the
intended role of static types is developer/agent feedback and refactoring
safety, while canonical state, provider output, package input, and other external
boundaries remain runtime-validated.

### Language-cost observations

The useful types add explicit constructors, variant declarations, and boundary
interfaces. Some of that is duplicated knowledge relative to runtime validators.
For simple scalar values the type layer is mostly descriptive rather than
protective. The strongest value appeared at cross-module semantic boundaries,
not in typing every local value.

The experiment therefore supports evaluating TypeScript as a targeted correctness
layer, but does not establish that every persistent invariant should be encoded
again in elaborate type-level machinery.

## Node.js 26 + TypeScript 7 findings

### Source execution and type checking

Node.js 26.8.1 directly executed the experiment's `.ts` source, including
`node --test test/*.test.ts`, without a transpiler or runtime loader. The port
stays inside erasable TypeScript syntax.

Node's runtime type stripping is intentionally not a type checker and does not
apply `tsconfig.json`. Static checking is therefore a separate toolchain action:
`typescript@7.0.2` runs `tsc -p tsconfig.json` with `noEmit`. No build artifact or
transpile stage was necessary for this experiment.

This separation is important operationally: a `.ts` file that Node can execute
is not evidence that the program type-checks.

### TypeScript 7 tooling shape

TypeScript 7.0 is a native implementation and its tooling boundary differs
materially from TypeScript 6 and earlier. Version 7.0.2 does not ship the old
programmatic JavaScript Compiler/Language Service API. The experiment originally
tried to navigate through that historical API; the failed probe was corrected
rather than reclassifying it as editor failure.

The canonical probe starts the installed TypeScript 7 `tsc` binary with its
native LSP over stdio, initializes a workspace, opens `src/runtime.ts`, resolves
the real `buildProjection` call to `src/projection.ts`, requests hover data, and
cleanly shuts the server down. The server identified itself as
`typescript-go` 7.0.2. Navigation and hover therefore worked through the actual
TypeScript 7 editor architecture.

The missing 7.0 programmatic API is still a real ecosystem consideration for
tools that embed TypeScript rather than communicate over LSP or invoke the CLI.
It is not a limitation of Node's `.ts` execution. TypeScript's own 7.0 release
notes describe a new API as future work for 7.1.

### Test and ecosystem compatibility

The representative typed suite passed 10/10 tests under Node 26. The unchanged
current JavaScript corpus also passed 99/99 Node test-runner entries on Node 26.
The extra Node entry is the repository's `test/support.mjs` support file being
reported by `node --test`; Deno reports 98 actual tests for the same explicit
corpus.

The MCP probe imported `@modelcontextprotocol/sdk` 1.30.0 through ordinary npm
bare ESM imports and completed an in-memory client/server tool round trip.
No package-specific workaround was required on Node.

### Formatter, linter, and coverage surface

Node itself does not provide the integrated lint/format/coverage workflow tested
for Deno. The experiment deliberately did not add ESLint, Prettier, a coverage
package, or a transpiler merely because those tools are conventional in Node
TypeScript repositories. Issue #39 should decide whether Ember actually needs
such additions and, if so, which smallest set earns its dependency/configuration
cost.

Node's native test runner and TypeScript 7's checker/LSP were sufficient to
exercise the core TypeScript port. This is a smaller Node setup than a typical
bundled application toolchain, but it is correspondingly less integrated than
Deno's built-in developer surface.

## Deno 2.9 findings

### Compatibility with current Ember behavior

Deno 2.9.5 ran the representative TypeScript port successfully, including the
same Node-style filesystem and subprocess APIs used by the port. The typed suite
passed 10/10 tests, including:

- exclusive-create locking;
- temporary-file sync, atomic rename, and directory sync;
- write-boundary validation;
- bounded one-shot provider subprocess I/O;
- provider timeout and direct-child termination;
- restart/reload reconstruction and scoped projection.

More significantly for migration risk, Deno ran the **unchanged current
JavaScript implementation and acceptance corpus** with 98/98 actual tests
passing. The current `bin/ember.mjs` also completed an `init -> check -> run`
smoke with the scripted provider executed through Deno and produced a real
`CONTINUITY_RESPONSE`.

This is strong compatibility evidence for the APIs and behavior Ember uses
today. It is not proof that every future Node package, native addon, process
behavior, or platform-specific API will be compatible.

### Built-in tooling

The same checkout successfully exercised:

- `deno check` on the core typed port;
- `deno test` on the typed tests;
- `deno lint`;
- `deno fmt --check`;
- `deno test --coverage` and `deno coverage`;
- Deno LSP go-to-definition from `runtime.ts` to `projection.ts`.

Coverage of the representative port was 75.3% branches, 95.1% functions, and
85.3% lines. These numbers are evidence that the built-in coverage path works,
not a proposed coverage threshold for Ember.

The Deno candidate needed one `deno.json` for project configuration and did not
need separate installed packages for checker, test runner, lint, formatter,
coverage, or language server.

Deno 2.9.5 embeds TypeScript 6.0.3, whereas the Node candidate deliberately used
the separately installable TypeScript 7.0.2. Runtime choice therefore also
affects who controls the TypeScript checker version: the Node workflow can pin
it independently, while Deno couples its built-in checker to the Deno release.
The shared experiment source passed both, but the version difference is a real
future compatibility/release-policy consideration.

### Permissions

With `--no-prompt` and no relevant allow flag, the experiment verified denial of:

- the sentinel environment variable;
- a specific input file read;
- a specific output file write;
- launching the Node 26 executable;
- opening a TCP connection to `127.0.0.1:9`.

Each operation then succeeded, or in the network case reached the expected
transport-level `ConnectionRefused`, when granted the corresponding scoped
`--allow-env`, `--allow-read`, `--allow-write`, `--allow-run`, or `--allow-net`
capability.

The network probe deliberately performs an actual connection attempt rather
than treating a permission-query result as proof of enforcement.

This demonstrates a useful runtime capability boundary. It does **not** establish
that Ember is authorized to perform an action. A Deno process that can read a
credential or reach a host has technical capability only; Ember's live,
attributable authority and disclosure rules remain governed by the semantic
architecture.

## npm ecosystem probe

`@modelcontextprotocol/sdk` 1.30.0 was chosen as a plausible near-term
capability/delegation dependency rather than as a synthetic compatibility
package.

| Probe | Node 26 | Deno 2.9 |
| --- | --- | --- |
| Install mechanism | locked `npm ci` | same package graph present in `node_modules` |
| Bare ESM imports | pass | runtime pass |
| In-memory MCP round trip | pass | pass |
| Package-specific static check | pass through Node TS project | `deno check ecosystem/mcp-deno.ts` reports `TS2307` for SDK deep subpaths |

Deno therefore demonstrated runtime npm compatibility for this package but not a
frictionless checker experience with the exact bare deep imports used by the
probe. The checker failed to resolve
`@modelcontextprotocol/sdk/client/index.js`, `server/index.js`, `inMemory.js`,
and `types.js`, while executing the same imports succeeded.

That result must not be generalized to either "Deno cannot use npm packages" or
"npm compatibility is complete". It is one concrete package boundary and one
concrete configuration shape. If Ember later depends heavily on packages with
similar export layouts, issue #39 should treat this friction as a practical
risk; if not, it may be immaterial.

## Operational measurements

All values below are medians from canonical run #33331526419. `RSS` means sampled
maximum process-tree resident memory. MiB values are KiB divided by 1024 and are
rounded for readability.

### Current JavaScript runtime comparison

| Workload | Node 24 | Node 26 | Deno 2.9 running current JS |
| --- | ---: | ---: | ---: |
| Cold `ember check`, 7 samples | 98.58 ms / 52.8 MiB | 95.82 ms / 51.8 MiB | 108.13 ms / 43.6 MiB |
| Full current test corpus, 3 samples | 2010.71 ms / 340.5 MiB | 2079.29 ms / 341.4 MiB | not measured as one repeated full-corpus row |
| Restart oracle, 3 samples | 794.10 ms / 173.3 MiB | 804.37 ms / 222.1 MiB | 975.96 ms / 233.1 MiB |
| Idle CLI, 5 samples | 298.29 ms / 56.3 MiB | 299.61 ms / 57.1 MiB | 304.52 ms / 51.4 MiB |
| Scripted provider cycle, 7 samples | 133.75 ms / 56.9 MiB | 164.61 ms / 57.7 MiB | 181.91 ms / 55.1 MiB |

The idle timing includes an intentional 250 ms delay before stdin is closed, so
its useful signal is resident memory rather than apparent startup latency.

Cold-check results are the cleanest startup comparison in the canonical run:
Node 24 and Node 26 were effectively alike at about 0.10 s, while Deno was about
0.01 s slower. Idle RSS favored Deno by roughly 5 MiB on this host. Neither gap
is large compared with model/network latency expected in normal cognition.

Provider-cycle timing varied materially across repeated workflow runs while the
semantic outcome stayed stable. The canonical run has Node 24 at 134 ms, Node 26
at 165 ms, and Deno at 182 ms, but earlier harness runs produced different Node
ordering and narrower/wider gaps. Process-tree RSS also occasionally doubles
when the 5 ms sampler catches both parent and short-lived provider child at their
peaks. The median is still useful for rough operational scale, but these rows do
not justify a claim that one runtime is intrinsically faster for subprocess
work.

The restart oracle was directionally slower under Deno in the canonical run,
about 0.98 s versus 0.79-0.80 s for Node. The absolute difference is about 0.17
s and the workload deliberately creates fresh processes; it is not evidence
about a future long-running daemon.

### TypeScript feedback-loop comparison

| Workload | Node 26 + TypeScript 7 | Deno 2.9 |
| --- | ---: | ---: |
| Representative typed tests, 5 samples | 428.67 ms / 227.0 MiB | 1301.96 ms / 310.4 MiB |
| Static check, 5 samples | 1926.15 ms / 544.9 MiB | 726.51 ms / 208.8 MiB |

These rows are deliberately reported rather than combined into a score. They do
not measure identical tool architectures: Node executes tests directly with
`node --test` and invokes the separate TypeScript 7 native checker, while
`deno test` and `deno check` use Deno's integrated runtime/toolchain and embedded
checker. On this **small** Ember port, startup/tool orchestration is a large
fraction of total cost.

The result is nevertheless relevant to the day-to-day feedback loop:
Node's direct typed test run was substantially faster in this experiment, while
Deno's standalone check was substantially faster and used much less sampled
process-tree RSS than the installed TypeScript 7 `tsc` invocation. This small
corpus cannot be extrapolated to large TypeScript projects, where compiler
parallelism and incremental/watch behavior may dominate.

### Footprint

Canonical run footprint observations:

| Item | Size |
| --- | ---: |
| Node 24 executable | 126,458,664 bytes (~120.6 MiB) |
| Node 26 executable | 150,425,704 bytes (~143.5 MiB) |
| Deno executable | 95,582,008 bytes (~91.2 MiB) |
| Experiment `node_modules` | 62,728 KiB (~61.3 MiB) |
| Deno cache after experiment | 10,836 KiB (~10.6 MiB) |
| Deterministic continuity-state template | 669 bytes |

The `node_modules` number is **not** the cost of adopting TypeScript alone. It
contains TypeScript 7's platform packaging, `@types/node`, and the complete
transitive graph of the MCP ecosystem probe. `npm ci` reported 98 installed
packages. The current production baseline itself has no runtime or development
dependencies in `package.json`.

Likewise, the recorded Deno cache is only the cache produced by this workflow,
not a stable installed-size guarantee. Executable sizes are useful deployment
context but do not describe runtime memory.

## Developer and coding-agent ergonomics

The concrete feedback loop produced several observations relevant to both human
and agent contributors:

### Shared TypeScript advantages

- branded IDs make semantically different string identifiers visible to the
  checker;
- state/projection/provider/CLI boundaries are navigable named types rather than
  conventions inferred from object shape;
- discriminated variants support exhaustive edits across semantic cases;
- both checkers gave direct, local diagnostics for the two representative
  boundary mistakes;
- runtime validators remain explicit code, so an agent cannot safely infer that
  a TypeScript annotation has validated external data.

### Node 26 + TypeScript 7

- direct `.ts` execution keeps the runtime path small: no transpiler and no
  generated JS tree;
- `node --test` runs typed tests directly;
- static confidence requires a distinct `tsc` invocation and `tsconfig.json`;
- TypeScript 7's native LSP successfully provided definition navigation and
  hover;
- TypeScript 7.0's absent programmatic API is a current limitation for tooling
  that embeds compiler/language-service APIs;
- linting, formatting, and coverage policy are not supplied as one Node core
  toolchain and remain choices for issue #39 rather than dependencies silently
  adopted by the experiment.

### Deno 2.9

- check, test, lint, format, coverage, and LSP all worked through the runtime's
  built-in tools;
- fewer separate tool decisions make a fresh checkout easier to explain;
- the existing `node:test` corpus can run without immediate test-framework
  migration;
- the MCP package showed that npm runtime compatibility can be better than Deno
  checker compatibility for a specific package/import shape;
- the TypeScript checker version moves with Deno rather than being independently
  pinned;
- scoped runtime permissions provide a concrete least-capability deployment
  mechanism below, but separate from, Ember's authority model.

No coding-agent benchmark was run. The ergonomics evidence is therefore based on
concrete diagnostics, navigation, configuration surface, and cross-module
changes in this repository, not a claim that agents generate more correct code
on either runtime.

## Compatibility and evidence table for issue #39

| Concern | Node 24 JS control | Node 26 + TypeScript 7 | Deno 2.9 + TypeScript | Evidence strength |
| --- | --- | --- | --- | --- |
| Current continuity oracle | 99/99 Node entries pass | unchanged JS: 99/99 pass | unchanged JS: 98/98 actual tests pass | strong for current corpus |
| Representative typed semantics | n/a | 10/10 pass | 10/10 pass | strong for experiment port |
| Runtime validation boundary | production validator | explicit `unknown` parse + write revalidation | same typed port | strong for tested invariants |
| Lock/fsync/rename/dir-sync | current baseline | typed port passes | typed port passes | strong on Linux runner |
| Provider timeout/subprocess | current baseline | typed port passes | typed port passes | strong for direct child protocol |
| Complete restart/scoped correction | current baseline passes | typed port passes | typed port passes | strong for representative scenario |
| Direct `.ts` execution | n/a | yes, erasable syntax | yes | observed |
| Type checking | none in control | TypeScript 7.0.2 `tsc`, separate from Node runtime | built-in, embedded TS 6.0.3 | observed |
| LSP navigation | not evaluated | native TypeScript 7 LSP definition + hover pass | Deno LSP definition pass | observed |
| Lint/format/coverage | not part of baseline | not selected by experiment | built-in probes pass | observed, policy undecided |
| MCP npm runtime | n/a | pass | pass | one-package evidence |
| MCP static-check friction | n/a | no observed issue | `deno check` deep-import `TS2307` | concrete package-specific negative |
| Runtime I/O permissions | Node process ambient OS capability | Node process ambient OS capability | scoped deny/allow probes pass | strong for tested Deno capabilities |
| Idle RSS | ~56 MiB | ~57 MiB | ~51 MiB | directional same-host evidence |
| Cold current-JS check | ~99 ms | ~96 ms | ~108 ms | directional same-host evidence |
| Restart oracle | ~794 ms | ~804 ms | ~976 ms | directional same-host evidence |
| Toolchain integration | minimal JS baseline | Node + npm + TS7; other quality tools undecided | runtime integrates checker/test/lint/fmt/coverage/LSP | observed |
| Programmatic TS API | n/a | TS7.0 does not ship one | Deno tooling API not evaluated as replacement | current tooling constraint |

## Strengths and weaknesses observed

### Node 26 + TypeScript 7

Strengths:

- smallest migration distance from the current executable slice;
- unchanged JavaScript oracle passes;
- direct erasable `.ts` execution avoids a mandatory build/transpile stage;
- npm/MCP probe is straightforward;
- typed tests execute quickly in this small corpus;
- TypeScript 7 diagnostics and native LSP are useful and concrete.

Weaknesses or costs:

- static checking remains a separate installed tool despite native `.ts`
  execution;
- TypeScript 7.0 currently has no programmatic compiler/language-service API;
- lint/format/coverage choices remain external policy/tool decisions if Ember
  wants them;
- the experiment's installed npm graph is materially larger than today's
  dependency-free baseline, though much of that graph belongs to the MCP probe
  rather than TypeScript itself;
- Node offers no Deno-style runtime permission boundary by default.

### Deno 2.9

Strengths:

- unexpectedly high compatibility with the current Node-oriented Ember slice:
  the full unchanged JS corpus and current CLI/provider path run successfully;
- one built-in toolchain covers check, test, lint, format, coverage, and LSP;
- idle process RSS was modestly lower in the canonical same-host run;
- scoped runtime I/O permissions were directly demonstrated;
- the standalone executable was smaller than either pinned Node executable in
  this runner installation.

Weaknesses or costs:

- the current JS restart/provider workloads were directionally slower by tens to
  hundreds of milliseconds in this small process-heavy experiment;
- Deno's embedded checker version is coupled to the runtime release;
- the MCP package runtime works, but Deno's checker did not resolve the package's
  tested deep bare imports in the current configuration;
- adopting Deno would introduce runtime-specific command/permission/deployment
  policy even though the current Node APIs mostly work unchanged;
- successful current compatibility does not guarantee future npm/native-addon
  compatibility.

## Migration and adoption cost

The experiment deliberately does not migrate production code, but it exposes the
shape of either migration.

A TypeScript migration on Node can remain close to the current architecture:
`.mjs` modules can move incrementally to erasable `.ts`, Node core filesystem,
process, and test APIs remain available, and no runtime abstraction layer is
needed merely for portability. The principal new mandatory confidence tool is a
TypeScript checker plus its project configuration. Formatter/linter/coverage
choices remain separate decisions.

A Deno migration can also preserve much of the current source shape because the
existing JS corpus, `node:` APIs, `node:test`, store behavior, and subprocess
protocol already work. The larger change is operational/tooling policy: Deno
becomes both runtime and development toolchain, permission flags become part of
execution/deployment design, npm boundaries should be checked as dependencies
are introduced, and Deno releases control the embedded TypeScript version.

Neither experiment result justifies a generic `Runtime` abstraction or dual
runtime support. Maintaining two implementations would add complexity without
an Ember semantic requirement demonstrated by #38.

## Unresolved questions

Issue #39 should explicitly decide, rather than letting this experiment answer by
inertia:

- whether TypeScript's demonstrated boundary/refactoring value is worth adopting
  independently of the runtime choice;
- whether Node's lower migration/ecosystem friction outweighs Deno's integrated
  tooling and permission model for Ember's expected deployment shape;
- whether TypeScript 7.0's temporary lack of a programmatic API matters to Ember
  before 7.1 or later tooling is available;
- whether Deno's MCP checker friction matters for the actual package set Ember
  will use;
- whether the checker version should be independently pinned or intentionally
  coupled to the runtime release;
- which lint/format/coverage policy, if any, a Node selection would actually
  justify;
- whether permission-scoped Deno execution materially improves the planned
  always-on deployment once concrete capabilities and credentials exist;
- whether future native addons, daemon/concurrency requirements, packaging, or
  single-binary deployment change the compatibility picture.

## What this experiment does not establish

This evaluation does **not** establish that:

- TypeScript should be adopted; that decision belongs to #39;
- Node or Deno is the selected Ember runtime;
- Deno is generally faster, slower, lighter, or safer than Node;
- a 5-10 MiB idle RSS difference matters on Ember's eventual target host;
- subprocess timings measured with a scripted local provider predict real model
  latency;
- TypeScript eliminates the need for semantic/runtime validation;
- Deno permissions grant, represent, or prove Ember's semantic authority;
- all npm packages work under Deno because one MCP runtime probe worked;
- Deno's checker is generally incompatible with npm packages because one MCP
  deep-import probe failed;
- TypeScript 7's missing 7.0 API is permanent;
- the representative TypeScript port is a full replacement for the production
  continuity slice;
- either candidate's Linux result proves identical filesystem or process
  behavior on every supported operating system;
- the current process-tree RSS sampler is a precise heap profiler;
- a runtime abstraction or dual-runtime support is warranted;
- the amount of work invested in this branch is evidence for selecting its
  runtime.

## Reproduction

The authoritative command sequence is
`.github/workflows/runtime-evaluation.yml`. For a local checkout, the experiment
README contains the shorter candidate-specific commands.

At minimum, preserve these rules when reproducing or extending the evaluation:

- use the committed `package-lock.json` and `npm ci` for the Node/npm graph;
- record exact runtime/checker versions;
- run the unchanged production oracle separately from the representative typed
  port;
- keep intentional diagnostics and package-specific expected negatives distinct
  from regressions;
- keep Node and Deno on the same host when comparing measurements;
- reset mutable state before each timed CLI sample;
- retain raw samples rather than only medians;
- do not weaken semantic tests or validators to make a candidate pass;
- do not reinterpret runtime capability restriction as semantic authority.

External behavior referenced while interpreting the experiment is documented by
the runtime/tool authors:

- Node.js TypeScript support: https://nodejs.org/api/typescript.html
- TypeScript 7.0 release and its native LSP/API transition:
  https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Deno permissions: https://docs.deno.com/runtime/reference/permissions/
- Deno testing and `node:test` compatibility: https://docs.deno.com/runtime/test/
- Deno lint/format: https://docs.deno.com/runtime/lint_and_format/
- Deno coverage: https://docs.deno.com/runtime/test/coverage/

The repository's accepted ADRs and acceptance scenarios remain authoritative for
Ember semantics; these external runtime documents only describe implementation
mechanisms.
