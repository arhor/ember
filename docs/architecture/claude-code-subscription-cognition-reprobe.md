---
summary: "Issue #91 evidence proving that Claude Code 2.1.263 can perform bounded subscription-backed one-shot cognition through its supported non-interactive CLI while Ember retains semantic ownership."
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

**Result:** **viable for bounded one-shot subscription-backed cognition**, with a
runtime-specific adapter required before production use.

Issue #44 reached Claude Code's supported headless surface but the then-installed OAuth
session expired before a model turn. The September 8 re-probe removed that blocker: an
operator-confirmed Claude subscription login completed a real no-tool model turn through
`claude -p`, returned structured lifecycle/result events, and exited 0 while API-key and
cloud-provider fallback variables were explicitly removed from the child environment.
The init event reported `apiKeySource: "none"`.

This evidence is deliberately narrower than "Claude is another interchangeable model
endpoint." Claude Code remains an external agent runtime with its own system prompt,
model routing, session identifiers, lifecycle envelope, and context behavior. Ember can
place it behind the existing `ProviderInvoker` seam, but those mechanics must remain
Claude-adapter-local.

## Current official surface

The probe was checked against Anthropic's current Claude Code documentation on
2026-09-08 rather than treating #44 observations as timeless.

The supported surfaces relevant to Ember are:

- `claude -p` / `--print` for non-interactive execution;
- `--output-format json|stream-json` for machine-readable results/events;
- `--json-schema` for schema-validated structured output in print mode;
- `--safe-mode` to disable user/project customizations while retaining authentication,
  model selection, built-in tools, and permissions;
- `--tools` to restrict which built-in tools are available;
- `--disallowedTools` to remove matching tools, including MCP tools;
- `--permission-mode` for explicit initial permission policy;
- `--no-session-persistence` to keep an invocation non-resumable and avoid writing a
  resumable session to disk; and
- `--resume` when runtime-owned continuation is intentionally requested.

A material current caveat is that `--bare`, although recommended by Anthropic for many
scripted calls, deliberately does **not** read subscription OAuth credentials. It is
therefore not a drop-in isolation mode for Ember's subscription-reuse path. The current
`--restricted` mode is potentially relevant to a production adapter because it constrains
machine/project access while remaining distinct from `--bare`, but it was not part of
this #91 live probe and should be evaluated separately before relying on it.

## Sanitized live probe

The probe ran from a newly-created temporary directory outside the Ember repository.
No repository state was placed in that directory.

The child environment explicitly removed API-key, explicit OAuth-token, and supported
cloud-provider selector variables before invocation:

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

The raw local transcript contained host paths and transient runtime/request identifiers.
Those values are intentionally not committed. The durable evidence below preserves only
what matters to Ember's design.

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

The init envelope also carried a runtime-owned session UUID and enumerated installed
skills/plugins/slash commands even though safe mode was active. That enumeration is not
treated as proof that those customizations were active. The direct runtime evidence for
the tested capability boundary is `tools: []`, `mcp_servers: []`, plan mode, and the
successful model turn.

### Model/result evidence

Claude Code emitted an `assistant` event followed by a terminal `result` event. The
assistant event identified `claude-sonnet-5` and the terminal envelope reported:

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

The response contained the requested JSON object, but not *only* that object. Claude
Code first explained that the request did not require a coding plan, then returned the
JSON literal. That is useful negative evidence: an isolated no-tool Claude Code call
still has Claude Code's own runtime/system framing, so prompt-enforced exact JSON is not
a production parsing contract.

A production adapter should therefore use Claude Code's supported schema-constrained
structured-output surface and independently run Ember's existing
`validateProviderResult`, rather than scraping assistant prose or assuming prompt-only
format obedience.

### Model-routing evidence

The terminal usage envelope attributed the primary assistant turn to
`claude-sonnet-5`, while its aggregate `modelUsage` also mentioned
`claude-haiku-4-5-20251001`. No subagent was spawned and the probe exposed no tools.
This is evidence that Claude Code may own internal model routing even for a bounded
invocation. Ember must not interpret the external runtime as exactly one direct model
API call merely because the assistant message names one model.

The terminal envelope also exposed a client-side `total_cost_usd` estimate. That field
is operational metadata, not evidence that the run used API-key billing; current Claude
Code documentation explicitly describes the reported cost as an estimate that can
differ from the actual bill.

## Authentication classification

The evidence supports the following classification:

**Observed subscription-login reuse through the supported Claude Code CLI.**

The operator confirmed an active Claude subscription login before the probe. The probe
explicitly removed API-key/auth-token and cloud-provider fallback variables, the init
event reported `apiKeySource: "none"`, a real model turn completed, and the process
exited successfully. No credential store, token, keychain record, or raw OAuth material
was opened, copied, or committed.

This is sufficient for Ember's intended external-runtime integration class: Claude Code
owns authentication; Ember invokes the documented CLI and does not become a credential
broker.

## Mapping onto Ember's cognition contract

The existing common contract from #92 remains sufficient.

### `ProviderRequest`

A Claude adapter can serialize the already-selected `ProviderRequest` into a bounded
prompt exactly as Codex and Cursor do. Canonical Ember state does not need to enter the
Claude runtime. An isolated cwd plus explicit customization/tool controls remain part of
the disclosure boundary.

### `ProviderResult`

Claude Code's native result envelope is provider-local transport evidence. The adapter
should extract one schema-constrained candidate with Ember's fields:

```text
contractVersion
reply
usedMeaningIds
```

and then call `validateProviderResult` against the request projection. Claude Code's
session ID, model metadata, usage, request IDs, rate-limit events, and lifecycle fields
do not belong in that semantic result object except where Ember has already earned an
explicit operational-evidence field.

### `ProviderInvoker`

The current semantic seam remains the right shape:

```text
(bounded ProviderRequest, timeout/cancellation options)
    -> validated ProviderResult or typed ProviderError
```

Claude-specific command construction, environment policy, cwd preparation, JSON/JSONL
parsing, model metadata, diagnostics, and termination evidence belong inside a concrete
adapter. #91 therefore adds no reason to reopen the #92 abstraction decision.

## Session and continuity semantics

The live stream exposed a Claude `session_id`, but the probe deliberately used
`--no-session-persistence`. Current Claude Code documentation states that sessions
created this way are not saved and cannot be resumed.

Therefore:

- the observed session UUID is runtime-local operational correlation only;
- it is not Ember lineage, identity, memory, or canonical state;
- a one-shot adapter does not need to return it as `operational.externalThreadId` when
  session persistence is disabled; and
- if a future Claude resume mode is added, it must be tested as a separate runtime
  capability and still remain operational continuation only.

This matches the current Codex/Cursor contract decision: the shared field can hold an
opaque external continuation handle when one is useful, but Ember continuity never
moves into that handle.

## Lifecycle and cancellation evidence

The live #91 probe established successful lifecycle evidence only: init, rate-limit,
assistant, and terminal result events followed by direct-child exit 0. It did not send a
cancellation signal.

Current Claude Code documentation separately specifies that a non-interactive run sent
`SIGTERM` exits 143, leaves the turn unfinished, records no result for that turn, and
terminates the process tree of running Bash commands before exit. That is useful
Claude-specific lifecycle evidence, but Ember should preserve its stronger uncertainty
semantics: direct-child/process-tree behavior does not prove remote rollback, absence of
already-issued inference work, or absence of every external effect in richer tool-enabled
modes.

A production adapter should therefore reuse Ember's neutral child-process lifecycle
mechanics while translating Claude's observed output/exit semantics into the existing
`failed`, `timed_out`, `cancellation_requested`, and `outcome_unknown` vocabulary without
claiming more than the evidence establishes.

## Comparison with current Codex and Cursor evidence

| Concern | Codex | Cursor | Claude Code #91 |
| --- | --- | --- | --- |
| Subscription-backed headless turn | Proven | Proven | **Proven** |
| Runtime auth ownership | ChatGPT login | Cursor browser login | Claude subscription login |
| API-key fallback excluded in proof | Yes | Yes | **Yes; child vars removed and init reported `apiKeySource: "none"`** |
| Context isolation | isolated cwd plus explicit config/rule/plugin suppression | isolated trusted workspace plus deny policy | isolated cwd, safe mode, empty tool/MCP sets; default Claude Code system framing remains |
| Structured transport | JSONL events plus output schema | terminal JSON envelope containing result text | stream-JSON lifecycle/result envelope; official `--json-schema` available but not exercised in #91 |
| Prompt-only exact JSON | not relied on in production | prompt plus terminal parsing | **shown insufficient by probe preamble; schema path required for production** |
| Runtime continuation | Codex thread modes proven | Cursor session resume proven | session ID observed; persistence deliberately disabled; resume not tested in #91 |
| Model ownership | Codex-owned selection/runtime behavior | Cursor-owned selection/runtime behavior | Claude-owned; primary Sonnet event plus additional model usage metadata observed |
| Cancellation evidence | live child-exit evidence plus Ember uncertainty semantics | live child-exit evidence plus Ember uncertainty semantics | successful live lifecycle only; current vendor SIGTERM semantics documented, production behavior still needs adapter tests |

The three runtimes therefore converge exactly where #92 says they should: at Ember's
bounded request/result semantics. They do not converge enough to justify a richer shared
external-agent runtime abstraction.

## Production follow-up

The evidence warrants a separate issue to implement a **Claude Code one-shot cognition
adapter** behind `ProviderInvoker`.

That task should prove, not assume:

- schema-constrained `ProviderResult` extraction with `--json-schema`;
- the narrowest environment allowlist compatible with subscription login;
- isolated cwd behavior and whether `--safe-mode`, `--restricted`, or a tested
  combination provides the best truthful disclosure boundary without disabling OAuth;
- complete tool/MCP suppression, including unattended permission behavior;
- bounded stdout/stderr and lifecycle parsing;
- timeout, explicit cancellation, kill escalation, and unconfirmed termination mapping;
- whether ephemeral no-session operation should omit continuation evidence entirely;
- deterministic tests for malformed envelopes, schema/result validation, output bounds,
  process failures, and lifecycle uncertainty; and
- one opt-in authenticated smoke proving a real Ember `ProviderRequest` round-trip.

The adapter remains optional external-runtime infrastructure. It does not replace the
Vercel AI SDK direction selected in #180 for Ember's preferred future in-process model
and tool infrastructure.

## What #91 does not prove

- It is not a quality, latency, or cost benchmark.
- It does not prove Claude Code session resume semantics.
- It does not prove `--restricted` behavior under the operator's subscription login.
- It does not prove production `--json-schema` parsing; that belongs in the adapter task.
- It does not prove cancellation behavior live on this host.
- It does not imply that Claude Code's runtime-owned system prompt, skills/plugins
  inventory, model routing, or session state should enter Ember's semantic contract.
- It does not justify replacing the Vercel AI SDK strategy with Claude Code or the
  Claude Agent SDK.

## Official references checked on 2026-09-08

- Claude Code CLI reference: <https://code.claude.com/docs/en/cli-reference>
- Claude Code authentication: <https://code.claude.com/docs/en/authentication>
- Programmatic / non-interactive usage: <https://code.claude.com/docs/en/headless>
