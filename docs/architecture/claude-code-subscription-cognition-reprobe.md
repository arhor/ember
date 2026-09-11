---
summary:
  "Issue #91 evidence proving that Claude Code 2.1.263 can perform bounded subscription-backed one-shot cognition
  through its supported non-interactive CLI while Ember retains semantic ownership."
read_when:
  - "Evaluating or implementing a Claude Code cognition adapter"
  - "Comparing subscription-backed Codex, Cursor, and Claude Code cognition runtimes"
  - "Reviewing Claude Code authentication, context isolation, structured output, session, or lifecycle evidence"
role: evidence
discovery_status: current
---

# Claude Code subscription cognition re-probe

## Status and conclusion

**Issue:** [#91](https://github.com/arhor/ember/issues/91)

**Investigation date:** 2026-09-08

**Installed Claude Code:** `2.1.263`

**Result:** **viable for bounded one-shot subscription-backed cognition**. Issue #204 now implements the production path
through Vercel AI SDK and `ai-sdk-provider-claude-code`, rather than a hand-written Claude process adapter.

Issue #44 reached Claude Code's supported headless surface but the then-installed OAuth session expired before a model
turn. The September 8 re-probe removed that blocker. An operator-confirmed Claude subscription login completed a real
no-tool model turn through `claude -p`, returned structured lifecycle/result events, and exited 0 while API-key,
auth-token, and cloud-provider fallback variables were explicitly removed from the child environment. The init event
reported `apiKeySource: "none"`.

This proves the integration class Ember cares about: Claude Code can own subscription authentication while Ember sends a
bounded cognition episode through its documented CLI. It does not make Claude Code an interchangeable direct model
endpoint. Claude Code keeps its own system framing, model routing, session identifiers, lifecycle envelope, and context
behavior.

## Current official surface

The result was checked against Anthropic's current Claude Code documentation on 2026-09-08 rather than treating #44
observations as timeless.

Relevant documented surfaces are:

- `claude -p` / `--print` for non-interactive execution;
- `--output-format json|stream-json` for machine-readable results/events;
- `--json-schema` for schema-validated structured output in print mode;
- `--safe-mode` to disable user/project customizations while retaining authentication, model selection, built-in tools,
  and permissions;
- `--tools` and `--disallowedTools` for tool availability control;
- `--permission-mode` for explicit initial permission policy;
- `--no-session-persistence` for non-resumable print-mode sessions; and
- `--resume` when runtime-owned continuation is intentionally requested.

A material caveat is that `--bare`, although recommended by Anthropic for many scripted calls, deliberately does not
read subscription OAuth credentials. It is therefore not a drop-in isolation mode for Ember's subscription-reuse path.
Current Claude Code also exposes `--restricted`; its suitability with the subscription path was not tested in #91 and
belongs in the production adapter task.

## Sanitized live probe

The probe ran from a newly-created temporary directory outside the Ember repository. No repository state was placed in
that directory.

```bash
probe_cwd="$(mktemp -d)"
cd "$probe_cwd"

env \
  -u ANTHROPIC_API_KEY \
  -u ANTHROPIC_AUTH_TOKEN \
  -u CLAUDE_CODE_OAUTH_TOKEN \
  -u CLAUDE_CODE_USE_BEDROCK \
  -u CLAUDE_CODE_USE_VERTEX \
  -u CLAUDE_CODE_USE_FOUNDRY \
  claude -p \
    --output-format stream-json \
    --verbose \
    --safe-mode \
    --permission-mode plan \
    --tools "" \
    --disallowedTools "mcp__*" \
    --no-session-persistence \
    'Return exactly this JSON object and nothing else: {"probe":"ember-runtime","answer":42}'
```

The raw local transcript contained host paths and transient runtime/request identifiers. Those values are intentionally
not committed.

### Init evidence

The first structured event established:

```json
{
  "type": "system",
  "subtype": "init",
  "tools": [],
  "mcp_servers": [],
  "model": "claude-sonnet-5",
  "permissionMode": "plan",
  "apiKeySource": "none",
  "claude_code_version": "2.1.263"
}
```

The init envelope also carried a runtime-owned session UUID and enumerated installed skills/plugins/slash commands even
though safe mode was active. That enumeration is not treated as proof that those customizations were active. The direct
capability evidence is the empty tool/MCP sets, plan mode, successful model turn, and successful terminal result.

### Result evidence

Claude Code emitted an `assistant` event followed by a terminal `result` event:

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "num_turns": 1,
  "terminal_reason": "completed"
}
```

The process exited with status `0`.

The response contained the requested JSON object, but not only that object. Claude Code first explained that the request
did not require a coding plan, then returned the JSON literal. This is useful negative evidence: an isolated no-tool
Claude Code call still has Claude Code's own runtime/system framing, so prompt-enforced exact JSON is not a production
parsing contract.

A production adapter must therefore use Claude Code's documented schema-constrained structured-output surface and then
run Ember's existing `validateProviderResult`, rather than scraping assistant prose or assuming prompt-only format
obedience.

### Model-routing evidence

The primary assistant event identified `claude-sonnet-5`, while aggregate `modelUsage` also mentioned
`claude-haiku-4-5-20251001`. No subagent was spawned and the probe exposed no tools.

This is evidence that Claude Code may own internal model routing even for a bounded invocation. Ember must not interpret
the external runtime as exactly one direct model API call merely because the assistant event names one model.

The terminal envelope also exposed a client-side `total_cost_usd` estimate. Current Claude Code documentation describes
that value as an estimate that may differ from the actual bill, so it is operational metadata rather than evidence of
API-key billing.

## Authentication classification

**Observed subscription-login reuse through the supported Claude Code CLI.**

The operator confirmed an active Claude subscription login before the probe. The child environment removed
API-key/auth-token and cloud-provider fallback variables, the init event reported `apiKeySource: "none"`, a real model
turn completed, and the process exited successfully.

No credential store, token, keychain record, or raw OAuth material was opened, copied, or committed. Authentication
remains owned by Claude Code; Ember does not need a credential broker for this integration class.

## Mapping onto Ember's cognition contract

The existing contract from #92 remains sufficient.

### `ProviderRequest`

A Claude adapter can serialize the already-selected `ProviderRequest` into a bounded prompt exactly as Codex and Cursor
do. Canonical Ember state does not need to enter the Claude runtime. An isolated cwd and explicit customization/tool
controls remain part of the disclosure boundary.

### `ProviderResult`

Claude Code's native result envelope is provider-local transport evidence. The adapter should extract one
schema-constrained candidate containing only Ember's semantic result fields:

```text
contractVersion
reply
usedMeaningIds
```

The candidate must then pass `validateProviderResult` against the supplied projection. Claude session IDs, model
metadata, usage, request IDs, rate-limit events, and lifecycle fields do not enter the semantic result except where
Ember has already earned an explicit operational-evidence field.

### `ProviderInvoker`

The shared semantic operation remains:

```text
(bounded ProviderRequest, timeout/cancellation options)
    -> validated ProviderResult or typed ProviderError
```

Claude-specific command construction, environment policy, cwd preparation, structured output parsing, model metadata,
diagnostics, and termination evidence belong inside the concrete adapter. #91 adds no reason to reopen the #92
abstraction decision.

## Session and continuity semantics

The live stream exposed a Claude `session_id`, but the probe deliberately used `--no-session-persistence`. Current
Claude Code documentation states that such sessions are not saved and cannot be resumed.

Therefore the observed session UUID is runtime-local operational correlation only. It is not Ember lineage, identity,
memory, or canonical state, and the one-shot adapter does not need to return it as `operational.externalThreadId` when
persistence is disabled.

If a future Claude resume mode is added, it must be tested separately and its handle must remain operational
continuation only.

## Lifecycle and cancellation evidence

The live #91 probe established successful lifecycle evidence: init, rate-limit, assistant, and terminal result events
followed by direct-child exit 0. It did not send a cancellation signal.

Current Claude Code documentation separately states that a non-interactive run sent `SIGTERM` exits 143, leaves the turn
unfinished, records no result for that turn, and terminates the process tree of running Bash commands before exit.

A production adapter should reuse Ember's neutral child-process lifecycle mechanics while preserving Ember's stronger
uncertainty semantics. Direct-child/process-tree behavior does not prove remote rollback, absence of already-issued
inference work, or absence of every external effect in richer tool-enabled modes.

## Comparison with current Codex and Cursor evidence

The new evidence puts Claude Code in the same useful integration class as Codex and Cursor without flattening their
runtime semantics:

- all three have now proven subscription-backed headless cognition;
- all three keep authentication outside Ember;
- all three converge on the existing `ProviderRequest` / `ProviderResult` boundary;
- Codex uses JSONL plus an output schema;
- Cursor uses a terminal JSON envelope containing result text;
- Claude exposes structured lifecycle/result envelopes and a documented schema surface, while #91 proves prompt-only
  exact JSON is insufficient;
- Codex thread and Cursor session continuation have live resume evidence;
- Claude emitted a session ID, but #91 intentionally disabled persistence and did not test resume;
- Claude's primary model event plus additional aggregate model usage reinforces that runtime/model routing remains
  provider-owned; and
- cancellation evidence remains provider-specific even though Ember's external failure vocabulary is shared.

The three runtimes therefore converge where #92 says they should: at Ember's bounded request/result semantics, not at a
richer external-agent runtime abstraction.

## Production follow-up

Issue [#204](https://github.com/arhor/ember/issues/204) implements the production path through Vercel AI SDK and
`ai-sdk-provider-claude-code`. The implementation uses the provider's Agent SDK integration for process/protocol
ownership, AI SDK structured output for the `ProviderResult` candidate, and Ember's existing semantic validation
afterward.

The fixed production policy is documented in
[Claude Code cognition through Vercel AI SDK](claude-code-ai-sdk-provider.md), including subscription-only environment
handling, filesystem/tool/MCP/skill/plugin isolation, no-session one-shot defaults, deterministic tests, and the opt-in
authenticated smoke.

This follow-up changes one architectural conclusion from the original re-probe: a subscription-backed external runtime
does not necessarily require Ember to own a custom process adapter. A maintained AI SDK provider can be the thinner
mechanical boundary when it removes real lifecycle/protocol plumbing without taking Ember semantics.

## What #91 does not prove

- It is not a quality, latency, or cost benchmark.
- It does not prove Claude Code session resume semantics.
- It does not prove `--restricted` behavior under the operator's subscription login.
- It does not prove production `--json-schema` parsing; that belongs in #204.
- It does not prove cancellation behavior live on this host.
- It does not move Claude runtime-owned system framing, model routing, or session state into Ember's shared semantic
  contract.
- It does not justify replacing the Vercel AI SDK strategy with Claude Code or the Claude Agent SDK.

## Official references checked on 2026-09-08

- Claude Code CLI reference: <https://code.claude.com/docs/en/cli-reference>
- Claude Code authentication: <https://code.claude.com/docs/en/authentication>
- Programmatic / non-interactive usage: <https://code.claude.com/docs/en/headless>
