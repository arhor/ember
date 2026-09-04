---
summary: "Issue #40 validation record for adopting native ESM TypeScript on Node.js 26.8.1 while preserving Ember's executable continuity semantics."
read_when:
  - "Reviewing whether the TypeScript and Node.js 26 adoption preserved the executable continuity oracle"
  - "Comparing post-migration runtime and tooling cost with the issue #38 JavaScript control"
  - "Reviewing the runtime capability boundary after the Node.js 26 adoption"
role: evidence
discovery_status: current
---

# TypeScript Runtime Adoption Validation

## Purpose and boundary

Issue [#40](https://github.com/arhor/ember/issues/40) applies the implementation choice recorded by [ADR 0006](decisions/0006-adopt-typescript-on-nodejs-26.md) to the executable continuity slice. This note records the adoption evidence; it does not create new semantic authority or reopen the language/runtime choice.

The governing migration rule remains: **representation changes, meaning does not**. The accepted semantic ADRs, architecture acceptance scenarios, and the continuity slice contract remain the behavioural authority.

## Adopted stack

The validated production path uses:

- Node.js **26.8.1**;
- TypeScript **7.0.2**;
- `@types/node` **26.4.0**;
- native ESM `.ts` source executed directly by Node.js;
- strict `noEmit` checking with the NodeNext and erasable-syntax settings selected
  by ADR 0006;
- Node's built-in `node:test` runner;
- npm with the committed lockfile and `npm ci`;
- no transpiler, loader hook, bundler, external linter, formatter, or coverage gate.

The root package has no runtime npm dependencies. The locked development graph contains the TypeScript checker, Node declarations, and their required packages.

## Static and runtime validation remain separate

Persisted JSON and provider output continue to enter the implementation as untrusted values and pass explicit runtime validation before they are treated as canonical state or provider results. Canonical writes continue to revalidate the state before replacement.

Static typing is used for internal contracts rather than as a substitute for that boundary. Branded identifiers make meaning, evidence, runtime, cognition, and lineage identifiers non-interchangeable in checked code; discriminated unions make supported semantic variants explicit; persistent state, projection, and provider contracts are distinct named types.

The strict TypeScript project intentionally covers production source and dedicated compile-time contract fixtures. The behavioural acceptance tests remain directly executed TypeScript but are not themselves included in the static project because a significant part of their job is to construct deliberately impossible or corrupted values and prove that runtime validation rejects them. Adding casts to make those adversarial fixtures statically valid would add noise without improving the production boundary.

## Semantic confidence result

On GitHub Actions Ubuntu 24.04 with Node.js 26.8.1 and TypeScript 7.0.2:

- `npm ci` completed from the committed lockfile;
- `npm run check` passed TypeScript static checking and documentation-discovery validation;
- `npm test` passed **100/100 tests** with zero failures;
- the complete restart/continuity scenario remained green;
- store corruption, durability uncertainty, locking, stale revision, provider timeout/output failure, delivery uncertainty, supersession, provenance, unavailable-detail gaps, and CLI correction/inspection scenarios remained green.

The final reviewed suite contains the **98 actual acceptance tests** preserved from the JavaScript baseline plus two narrow migration-compatibility guards added after an independent cold review found representation-induced edge cases. One guard ensures ordinary projections do not resolve otherwise-unused explanation IDs; the other ensures fixture-only detail withholding preserves unrelated valid evidence metadata while removing only the unavailable payload and digest.

Issue #38 reported 99/99 Node test-runner entries for the JavaScript control. That count included `test/support.mjs` as a zero-test discovered module; it separately recorded 98 actual tests for the same explicit corpus. The adopted command targets `*.test.ts` explicitly, so the preserved baseline is those 98 actual tests. No acceptance scenario was removed to obtain the result.

The final selected-stack confidence run is GitHub Actions run `33363449272`. The post-migration measurement run is `33362598022`; it measured the preserved 98-test baseline before the two narrow review guards were added.

## Post-migration comparison with issue #38

The table compares issue #38's recorded Node.js 26 JavaScript control with the adopted production TypeScript path. Values are medians. MiB values are derived from sampled process-tree RSS KiB. Both datasets use Ubuntu 24.04 hosted runners, but they are separate hosted machines and dates, so the comparison is directional rather than a controlled microbenchmark.

| Workload                                 | #38 Node 26 JavaScript control | #40 adopted TypeScript | Observation                                                                                                                                                                                   |
| ---------------------------------------- | -----------------------------: | ---------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold `ember check`, 7 samples            |           124.07 ms / 53.9 MiB |   177.11 ms / 95.0 MiB | Direct TypeScript source has a visible startup/RSS cost in this short process.                                                                                                                |
| Full continuity + docs corpus, 3 samples |         2394.00 ms / 301.7 MiB | 5187.48 ms / 534.5 MiB | The process-heavy feedback loop is materially slower and heavier after direct-source migration. The #40 sample used the preserved 98-test baseline before the two later compatibility guards. |
| Restart oracle, 3 samples                |          912.56 ms / 171.9 MiB | 1739.82 ms / 315.5 MiB | Fresh-process reconstruction remains correct but is costlier in this hosted-runner sample.                                                                                                    |
| Idle CLI, 5 samples                      |           334.86 ms / 57.1 MiB |   278.57 ms / 97.0 MiB | Timing contains the intentional 250 ms stdin delay; RSS is the useful comparison and is higher for TypeScript.                                                                                |
| Scripted provider cycle, 7 samples       |           173.12 ms / 57.7 MiB |  269.52 ms / 167.7 MiB | Local scripted-provider orchestration is slower/heavier; real network/model latency is expected to dominate later.                                                                            |
| Static TypeScript check, 5 samples       |         2270.46 ms / 536.8 MiB |  623.83 ms / 207.9 MiB | Not like-for-like: #38 checked the representative evaluation project; #40 checks the adopted production/type-contract graph. It demonstrates the current gate cost, not a compiler speedup.   |

The adopted root `node_modules` measured **34,276 KiB (~33.5 MiB)**. Issue #38's experiment directory measured about 61.3 MiB, but that graph also contained the MCP ecosystem probe and its transitive dependencies. The values therefore show that the adopted minimal toolchain is materially smaller than the experiment graph, not that TypeScript itself halved its footprint.

The runtime/process measurements are a real adoption cost worth retaining as a future revisit baseline. They do not contradict the semantic acceptance result or by themselves cross an ADR 0006 revisit trigger: the current executable slice is still a short-lived, process-heavy experiment rather than the intended always-on host workload. Resource use should be re-measured when Ember has a representative long-running process topology.

## Runtime capability boundary

Node.js 26 provides ambient process capability rather than a Deno-style scoped runtime permission model. The migrated slice therefore relies on host/service controls for defense in depth and preserves ADR 0004's separation between what the process can technically do and what Ember is authorized to do.

The current core needs filesystem access to its selected state directory for read, write, exclusive-create locking, temporary replacement, rename, file sync, and directory sync. It needs process/PID signalling for same-host lock liveness checks and subprocess execution for the explicit provider command. Test fixtures use `EMBER_TEST_NOW` and `EMBER_ENABLE_FIXTURE_FAULTS`; these environment hooks are not a production authority mechanism. The continuity core itself requires no network access, although a configured live provider may use network access or credentials under that provider process's ambient OS permissions.

Subprocess execution is not a sandbox boundary. A same-user provider can inherit ambient host capabilities, and terminating the direct child does not prove that arbitrary descendants are contained. Host/container/service restrictions can reduce technical capability but never establish semantic authority.

## Adoption conclusion

The selected TypeScript/Node.js representation preserves the executable continuity oracle and the schema-v1 external contract while adding useful checked boundaries. No accepted semantic requirement needed weakening, no persistence migration was introduced, and no new capability architecture was smuggled into the migration.

The adoption does expose a measurable process/startup memory and feedback-loop cost relative to the JavaScript control. That negative evidence is retained here rather than normalized away. On current evidence it is a monitoring/revisit input, not a blocker to ADR 0006: the semantic oracle is green, the minimal development toolchain is reproducible, and the runtime remains within the implementation boundary selected by #39.
