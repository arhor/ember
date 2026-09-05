---
summary: "Issue #92 decision that Ember's existing ProviderRequest/ProviderResult/ProviderInvoker seam is the earned common cognition-backend contract, while Codex and Cursor retain separate runtime adapters and lifecycle mechanics."
read_when:
  - "Changing the shared cognition provider contract or adding another production cognition backend"
  - "Considering deduplication or a common process runner across Codex and Cursor adapters"
  - "Reviewing which cognition-backend semantics are genuinely shared versus runtime-specific"
role: design
discovery_status: current
---

# Cognition Adapter Contract Decision

## Decision

**Keep the existing `ProviderRequest` / `ProviderResult` / `ProviderInvoker` cognition seam as Ember's shared backend contract. Do not introduce a new adapter hierarchy or shared Codex/Cursor process runner for issue #92.**

The production Codex and Cursor integrations now provide enough evidence to revisit the abstraction question that issue #44 deliberately deferred. They converge at the Ember-owned cognition boundary, but their runtime preparation, context isolation, invocation grammar, structured output, continuation handles, diagnostics, and observable termination evidence remain materially different.

The existing seam is therefore the smallest common contract currently justified by evidence. The duplicated-looking process mechanics inside `src/providers/codex.ts` and `src/providers/cursor.ts` remain adapter-local because extracting them today would require a hook-heavy lifecycle framework that obscures the differences Ember must preserve.

This is a valid negative abstraction decision, not a statement that the implementations can never share lower-level mechanics. A future third production backend or a concrete maintenance failure may provide enough evidence to revisit the boundary.

## Evidence base

This decision is based on current repository-owned production and evaluation evidence rather than the broader possibilities explored in the original runtime spike:

- issue #46 and `src/providers/codex.ts`, which established the first production one-shot cognition adapter;
- issue #90 and `src/providers/cursor.ts`, which deliberately added Cursor as a separate thin adapter without pre-committing #92;
- `src/providers/contract.ts`, the already-shared Ember-owned request/result/invocation seam;
- `src/runtime/runtime.ts`, which consumes a `ProviderInvoker` without transferring continuity or canonical-state ownership to the backend;
- `docs/architecture/cognition-backend-replacement-evaluation.md`, including the September 1, 2026 Codex-to-Cursor live replacement evidence; and
- ADR 0001, ADR 0003, ADR 0004, and ADR 0005, which constrain continuity, projection, authority, and failure semantics independently of backend implementation.

The issue #57 cross-provider evaluation is especially useful because it proves that the two adapters can replace one another for a bounded cognition episode while preserving Ember lineage, projection, and durable state, without claiming that their runtime semantics are equivalent.

## The common contract that has been earned

`src/providers/contract.ts` already contains the useful common vocabulary.

### `ProviderRequest`

Every supported cognition backend receives:

- one contract version;
- one Ember cognition identifier;
- one already-selected, least-sufficient `Projection`; and
- the current input text for this cognition episode.

The adapter does not receive canonical Ember state wholesale. Context selection remains Ember-owned before invocation.

### `ProviderResult`

Every successful backend must return:

- the supported contract version;
- one non-empty reply;
- only meaning IDs that were present in the supplied projection; and
- optionally one runtime-owned continuation identifier as operational evidence.

`validateProviderResult` enforces that shared semantic result boundary independently of Codex or Cursor's native output envelope.

The current field name `operational.external_thread_id` is intentionally interpreted as an opaque runtime-owned continuation handle. Codex currently supplies a thread identifier and Cursor supplies a session identifier. Sharing this storage slot does **not** claim that their lifecycle, resumption, retention, or cancellation semantics are equivalent. No current Ember semantic decision depends on the vendor-specific meaning of that identifier.

A rename to a more generic term would create repository-wide churn without changing current behavior or eliminating a demonstrated semantic ambiguity. Revisit the name only if another backend or consumer needs materially different continuation evidence.

### `ProviderInvoker`

At the Ember runtime boundary, the common operation is intentionally small:

```text
(command, explicit arguments, bounded request, timeout/cancellation options)
    -> validated ProviderResult or typed ProviderError
```

This is enough for CLI, Telegram, longitudinal evaluation, and the runtime cognition path to select Codex, Cursor, or the deterministic process provider without making those consumers understand vendor-specific sessions or output protocols.

### Shared failure vocabulary

The adapters also converge on Ember-facing failure distinctions:

- `failed`;
- `timed_out`;
- `cancellation_requested`; and
- `outcome_unknown` when direct-child termination cannot be confirmed.

They share bounded stdout/stderr limits and preserve direct-child termination observation separately from the stronger claim that no remote work or effects remain.

Those are Ember semantics. The evidence used to establish them remains adapter-specific.

## Where Codex and Cursor remain materially different

| Concern                  | Codex production adapter                                                                                                | Cursor production adapter                                                                                | Abstraction consequence                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Authentication ownership | Runtime-owned Codex login; allowlisted environment includes `CODEX_HOME`                                                | Runtime-owned Cursor login; separate environment allowlist                                               | Keep environment policy adapter-local                                    |
| Working directory        | Isolated temporary cwd; output schema file written there                                                                | Isolated temporary trusted workspace; adapter writes `.cursor/cli.json` deny policy                      | Workspace preparation is not one generic setup step                      |
| Context isolation        | Explicitly ignores user config and rules, disables plugins/apps/skill instructions, uses read-only sandbox              | Ask mode, sandbox enabled, trusted isolated workspace, explicit deny policy for shell/file/web/MCP tools | Do not normalize to a single `isolated=true` claim                       |
| Explicit arguments       | Codex adapter composes Codex `exec` grammar and thread mode                                                             | Cursor validates the prefix and currently permits only explicit model selection                          | Argument capability remains runtime-specific                             |
| Structured output        | JSONL event stream plus strict output schema                                                                            | One terminal JSON envelope whose `result` string contains the ProviderResult JSON                        | Parsing cannot share a truthful terminal contract below `ProviderResult` |
| Continuation evidence    | `thread.started` can expose a thread ID before final completion; supports ephemeral, fresh-persistent, and resume modes | Session ID is obtained from the terminal result; supports fresh and resume modes                         | Failure-time continuation evidence differs                               |
| Diagnostics              | Bounded stderr plus Codex structured error inspection from stdout                                                       | Bounded stderr and Cursor terminal envelope validation                                                   | Error extraction remains adapter-specific                                |
| Cancellation/timeout     | Kill escalation plus possible previously observed Codex thread ID                                                       | Kill escalation without a session ID unless a terminal result was obtained                               | Same Ember outcome can rest on different evidence                        |
| Temporary-state cleanup  | Temporary cwd is retained when direct-child termination is unconfirmed                                                  | Temporary workspace is retained under the same broad uncertainty condition                               | Similar policy, but tied to different runtime-local files                |

The September 1 live cross-provider evaluation adds another important negative fact: Cursor's tested CLI configuration did not prove exclusion of all runtime-owned account/team rules or MCP metadata, while the Codex adapter makes stronger explicit user-config/rule suppression claims. A shared abstraction must not erase that difference merely because both adapters are suitable for the same bounded Ember cognition seam.

## Why not extract the shared-looking child-process loop now?

`codex.ts`, `cursor.ts`, and the deterministic `process.ts` provider visibly repeat mechanics such as:

- spawn;
- bounded stdout/stderr collection;
- timeout and abort handling;
- `SIGTERM` then `SIGKILL` escalation;
- direct-child exit observation; and
- cleanup of listeners and timers.

That repetition is real. It is not yet sufficient evidence for a useful shared runtime primitive.

A helper capable of preserving current behavior would need configuration or hooks for at least:

- spawn options and environment construction;
- runtime workspace preparation and cleanup;
- stdin payload construction;
- whether stdout must stay readable during termination;
- streaming event inspection before terminal completion;
- extraction of continuation evidence during failure;
- stdout size-limit wording and classification;
- provider-specific structured diagnostics;
- terminal output parsing;
- resume-handle verification; and
- uncertainty-sensitive retention of runtime-local files.

At that point the helper would own most of the lifecycle while receiving most of its meaning back through callbacks. It would reduce line duplication but increase semantic indirection and make review of provider-specific failure behavior harder.

The generic `src/providers/process.ts` implementation is also not evidence that it should become a superclass for Codex and Cursor. It implements Ember's simple direct JSON process contract and has different cwd, environment, output, and continuation requirements. Treating it as the base runtime would confuse a transport mechanism with a shared external-agent semantic model.

## Rejected alternatives

### Generic `CognitionBackend` class hierarchy

Rejected. The existing structural `ProviderInvoker` function type already supplies backend substitution where Ember needs it. Classes would add lifecycle vocabulary without an unmet requirement.

### One shared external-agent process runner with provider hooks

Rejected for now. The required hook surface would be broad enough to hide rather than clarify output, session, context, and failure differences.

### Normalize Codex threads and Cursor sessions into a richer common session API

Rejected. Current ordinary cognition does not require provider-owned conversational continuity. Ember may record an opaque operational continuation handle, but continuity remains Ember-owned and fresh backend loci remain a supported default.

### Move authentication into the common contract

Rejected. Subscription authentication remains owned by each external runtime. Ember's common cognition seam has no reason to become a credential broker.

### Capability-discovery framework

Rejected. There is no current caller that needs to ask a generic backend whether it supports resume, tool policy, model selection, streaming, or richer runtime control. Those capabilities are configured and tested at the concrete adapter boundary. Introduce discovery only when a consumer has a real decision to make from it.

## Consequences

### Keep

- `ProviderRequest`, `ProviderResult`, `ProviderInvocationOptions`, and `ProviderInvoker` in `src/providers/contract.ts`;
- shared `validateProviderResult` and common output/timeout bounds there;
- direct provider selection at application boundaries;
- separate `invokeCodexProvider` and `invokeCursorProvider` implementations; and
- explicit provider-specific tests and live evidence.

### Do not add in #92

- a provider base class;
- a generic external-agent-runtime interface;
- a shared session/thread lifecycle API;
- a credential/authentication abstraction;
- a capability registry; or
- a hook-heavy child-process framework solely to remove duplicated lines.

### Preserve during later maintenance

When changing one adapter, reviewers should compare the analogous behavior in the other adapter, but similarity alone must not imply that both should change. In particular, termination evidence, continuation-ID availability, context isolation, and output parsing should remain grounded in the runtime that actually provides them.

## Revisit triggers

Re-open the abstraction decision when at least one of the following becomes true:

1. a third production cognition backend implements the same lower-level lifecycle behavior and repeats the same mechanics independently;
2. a demonstrated bug is fixed inconsistently in multiple adapters because the duplicated lifecycle code has become a maintenance hazard;
3. a caller needs generic capability discovery to choose behavior at runtime;
4. Ember needs a provider-independent continuation/resumption API beyond opaque operational evidence;
5. multiple adapters can share a small process primitive whose parameters are mechanical rather than semantic; or
6. a richer protocol integration introduces a genuinely common lifecycle concept that is absent from today's CLI adapters.

Any future extraction should begin from those concrete pressures and preserve regression tests for each adapter's differences before moving code.

## Definition-of-done mapping

| Issue #92 requirement                                              | Decision evidence                                                                       |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| comparison is based on proven production adapters                  | `codex.ts`, `cursor.ts`, contract/runtime code, and issue #57 live replacement evidence |
| common concepts are separated from provider-specific capabilities  | common-contract and differences sections above                                          |
| auth/model/session/cancellation/implicit context are not flattened | differences table and rejected alternatives                                             |
| common contract exists only where it reduces semantic duplication  | retain the already-used `ProviderInvoker` seam; reject a lower lifecycle framework      |
| separate adapters remain a valid outcome                           | explicit decision and consequences                                                      |
| abstraction stays narrower than a plugin/runtime framework         | no new production abstraction introduced                                                |
| repository artifacts explain the result                            | this document plus existing adapter/evaluation sources                                  |
