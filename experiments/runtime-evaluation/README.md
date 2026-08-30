# Ember TypeScript runtime evaluation port

This directory is an isolated experiment for issue #38. It is not an adopted Ember runtime and it deliberately does not replace `src/ember/`, `bin/ember.mjs`, or the existing acceptance oracle.

The port keeps the parts of the continuity slice that discriminate among language/runtime choices: semantic variants and identifiers, untrusted persisted JSON validation, purpose- and scope-bounded projection, exclusive-create locking, `fsync -> rename -> directory fsync` replacement, one-shot subprocess cognition with bounded output and timeout termination, restart reconstruction, and an npm ecosystem boundary.

## Pinned candidates

- control: Node.js 24.20.0 executing the current JavaScript implementation;
- Node TypeScript: Node.js 26.8.1 direct type stripping plus TypeScript 7.0.2 for static checking and `@types/node` 26.4.0;
- Deno TypeScript: Deno 2.9.5 using its built-in TypeScript checker/test/lint/format/coverage/LSP surface;
- ecosystem probe: `@modelcontextprotocol/sdk` 1.30.0.

The Node candidate intentionally has no transpiler or runtime loader. Source stays within erasable TypeScript syntax so Node can execute `.ts` directly; `tsc --noEmit` is a separate confidence gate because Node does not type-check while executing.

The npm graph is committed in `package-lock.json`. Node-side reproduction uses `npm ci`, so the transitive dependency tree and integrity hashes are fixed rather than reconstructed from top-level ranges on each run.

## What the port demonstrates

`src/model.ts` uses discriminated unions and branded identifiers. `src/semantics.ts` exercises preference supersession with fresh attributable evidence for the replacement value. `src/projection.ts` makes canonical persistent state and provider projection different static types while preserving the representative production scope boundary. `src/validation.ts` begins from `unknown` and enforces the semantic invariants exercised by the port. `src/store.ts` validates again before canonical replacement, demonstrating that a TypeScript type is not a trust boundary for persisted state. `src/provider.ts` exercises the subprocess boundary.

The port is intentionally representative rather than a shadow production implementation. The existing JavaScript tests remain the semantic oracle. In particular, the experiment does not duplicate every field-level production validator, operational lifecycle type, or stale-lock recovery branch merely to accumulate TypeScript lines. Those omissions are evidence limitations to preserve in the durable evaluation note rather than implicit claims of equivalence.

`diagnostics/type-errors.ts` intentionally does not type-check. It supplies two concrete diagnostic probes: crossing the branded evidence/meaning ID boundary, and passing canonical persistent state where a bounded projection is required. It is excluded from the normal project type-check and exercised separately as an expected failure. `scripts/typescript-language-service.mjs` and `scripts/deno-lsp-probe.mjs` exercise symbol-definition navigation against the real `buildProjection` call in `src/runtime.ts`.

## Local commands

Node candidate, using the committed dependency graph:

```sh
cd experiments/runtime-evaluation
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:node
npm run ecosystem:node
node scripts/typescript-language-service.mjs
```

Deno candidate core workflow:

```sh
cd experiments/runtime-evaluation
deno check src/*.ts test/*.test.ts
deno test -A test/*.test.ts
deno lint
deno fmt --check
deno test -A --coverage=.coverage test/*.test.ts
deno coverage .coverage
node scripts/deno-lsp-probe.mjs "$(command -v deno)"
```

The experiment source is normalized to the checked-in Deno formatter configuration, so `deno fmt --check` is a positive tooling gate. Any production migration-formatting delta belongs to a migration experiment, not to this isolated new source tree.

The MCP ecosystem boundary is probed separately:

```sh
deno run ecosystem/mcp-deno.ts
deno check ecosystem/mcp-deno.ts
```

With Deno 2.9.5 and the locked `@modelcontextprotocol/sdk` 1.30.0 graph, the runtime import and in-memory MCP round trip succeed, while `deno check` reports unresolved deep package subpaths. That split is intentional package-specific evidence: it must not be collapsed into either "Deno cannot use npm packages" or "this package is frictionless on Deno".

For Deno tests set `EMBER_EVAL_PROVIDER_COMMAND` to the Deno executable and `EMBER_EVAL_PROVIDER_PREFIX_ARGS='["run","-A"]'` so the same provider fixture is started through Deno rather than accidentally through Node.

The repository workflow `.github/workflows/runtime-evaluation.yml` performs all candidates on one GitHub-hosted Linux runner, records exact executable versions, runs the unchanged current acceptance suite where possible, exercises Deno permission denial/allow cases, resets mutable continuity state before every timed sample, and emits repeat measurements. The final status assertion distinguishes declared expected-negative evidence from regressions, so a green workflow means the observed evidence contract still holds rather than merely that collection reached the end. This same-host shape is deliberate: the numbers are directional, not a cloud-runner leaderboard.
