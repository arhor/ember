---
summary: "Completed issue #44 spike evaluating subscription-backed Codex, Claude Code, and Cursor runtimes and proving a bounded Ember-to-Codex cognition round-trip."
read_when:
  - "Investigating or implementing issue #44 external agent runtime integration"
  - "Reviewing the evidence behind issue #46's production Codex cognition backend"
  - "Comparing Codex, Claude Code, or Cursor as a live cognition or specialist runtime for Ember"
  - "Designing a replaceable boundary between Ember cognition and an already-authenticated local agent runtime"
role: design
discovery_status: current
---

# External agent runtime spike result

## Status and conclusion

**Issue:** [#44](https://github.com/arhor/ember/issues/44)

**Investigation date:** 2026-08-31

**Repository baseline:** `master` at `a1e3f0aa21fa13722e4b2a10eed46c22d77070ea`

**Result:** complete local spike; production implementation deferred to a focused follow-up.

**Graduation:** issue [#46](https://github.com/arhor/ember/issues/46) promoted the
recommended Codex one-shot path into production, and issue
[#90](https://github.com/arhor/ember/issues/90) later added a separate Cursor
one-shot adapter after that boundary stabilized. The experiments remain historical
design evidence; supported operation is documented in the
[minimal continuity runbook](minimal-continuity-runbook.md#supported-live-codex-cognition).

Ember can perform real subscription-backed cognition through an already-authorized
external agent runtime without transferring continuity or canonical-state ownership
to that runtime. The decisive proof used Ember's real `ProviderRequest`, a real
bounded `Projection`, an experiment-local Codex `exec` adapter, the existing
`runCognition` reintegration path, and the existing `ProviderResult` validator.

Codex and Cursor both completed smaller headless subscription-backed probes. Claude
Code could initialize headlessly but its local OAuth session was expired and could
not refresh, so no Claude model turn was claimed and no API-key billing path was
substituted.

The evidence justifies one narrow **one-shot cognition episode** boundary. It does
not justify a general provider hierarchy, a shared specialist-runtime protocol, a
credential broker, or production ACP/App Server integration.

## Question and governing constraints

The spike tested:

> Can Ember send one purpose-bounded projection through an already-authenticated
> external agent runtime and receive a validated result while Ember retains
> continuity, canonical state, context selection, authority, and interpretation?

The experiment follows the accepted architecture:

- continuity and lineage remain Ember-owned, not thread/session-owned
  ([ADR 0001](decisions/0001-continuity-belongs-to-ember.md));
- each invocation receives a least-sufficient permitted projection rather than
  canonical state wholesale ([ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md));
- runtime tools, login state, filesystem reach, and model capability do not create
  Ember authority ([ADR 0004](decisions/0004-separate-capability-from-authority.md));
- explicit cancellation, timeout, child-process exit, completion, delivery, and
  unconfirmed termination remain distinct operational facts
  ([ADR 0005](decisions/0005-distinguish-operational-continuity.md)); and
- runtime output is candidate expression/evidence, not automatic canonical truth.

The existing subprocess seam in `src/ember/provider.ts` already creates a cognition,
sends one bounded request, validates one result, and records a descriptor-only
expression occurrence. The spike reused that seam instead of replacing it with an
unearned abstraction.

## Host and installed runtime evidence

- Host: macOS 26.5.2 (`Darwin 25.5.0`), Apple silicon (`arm64`).
- Node.js: `v26.8.1`; npm: `11.19.0`.
- Codex: `codex-cli 0.151.0`; `codex login status` reported ChatGPT login.
- Claude Code: exact resolved binary
  `/Users/maksimburyshynets/.local/share/claude/versions/2.1.241`; both
  `claude --version` and the resolved binary reported `2.1.241`. That binary's
  `--help` listed and accepted `--safe-mode`, `--permission-mode`, `--tools`,
  `--output-format`, and `--no-session-persistence`.
- Cursor Agent and `cursor-agent`: `2026.08.11-e8db854`; `agent status` reported
  an authenticated browser-login account. The account identifier is omitted.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `CURSOR_API_KEY` were absent. Probe
  children also removed the relevant API-key variables.

No credential file, keychain item, token, or account secret was opened or copied.

## Candidate experiments

### Common no-tool connectivity probe

Each CLI received the same trivial request from `/private/tmp`, outside the Ember
repository:

```text
Return exactly this JSON object and nothing else:
{"probe":"ember-runtime","answer":42}
```

| Surface | Observed result | Structured evidence | Login classification |
| --- | --- | --- | --- |
| Codex `exec --json` | Exact result, exit 0, 7.3 s wall clock | `thread.started`, `turn.started`, `item.completed`, `turn.completed`; thread ID and usage | **Observed subscription reuse:** ChatGPT login, API-key variable absent |
| Cursor `agent -p --output-format stream-json --mode ask --sandbox enabled` | Exact result, exit 0, 10.0 s wall clock; runtime reported 3.1 s API duration | init, user, assistant, result; session ID, model, login auth source, request ID, usage | **Observed subscription reuse:** `apiKeySource: login`, API-key variable absent |
| Claude Code `-p --output-format stream-json --safe-mode --permission-mode plan --tools ''` | Exit 1 before a model turn | Structured init showed empty tools and plan mode; terminal result reported `authentication_failed` because OAuth was expired and refresh failed | **Not viable on this host at test time**; no API-key fallback attempted |

Codex and Cursor used prompt-enforced JSON for this initial connectivity check.
The later Codex projection proof used `--output-schema` plus Ember's independent
runtime validator.

### Runtime-owned session resume

- `codex exec resume` reused the same Codex thread ID and returned a second exact
  JSON result.
- Cursor `--resume <session-id>` reused the same Cursor session ID and returned a
  second exact JSON result with cache reuse visible in usage metadata.
- Claude resume was not tested because authentication failed before a model turn.

These IDs demonstrate external-runtime operational continuity only. They were not
used as Ember lineage, memory, or canonical identifiers.

### Explicit cancellation observations

The experiment sent `SIGTERM` to the direct CLI child 750 ms into harmless no-tool
requests:

- Codex had emitted `thread.started` and `turn.started`; its direct child then
  exited 0 without a completion or cancellation acknowledgement.
- Cursor emitted no event before its direct child exited 143.

These observations establish only direct-child exit. They do not establish remote
rollback, absence of model work, descendant termination, or acknowledged runtime
cancellation. Neither result permits an automatic retry.

The revised experiment harness records `termination_reason` as
`explicit_cancel`, `timeout`, or `null`. It sends `SIGTERM`, optionally escalates
to `SIGKILL`, and uses a separate final deadline. If no `close` event arrives by
that deadline it reports `direct_child_exit_observed: false` rather than waiting
forever or inventing confirmation. Deterministic tests cover successful completion,
explicit cancellation, timeout, forced kill, and unconfirmed termination.

### Implicit cwd context and permissions

Codex used a read-only sandbox; Cursor used Ask mode with sandboxing enabled; Claude
initialized with no tools before authentication failed. No candidate was asked to
mutate files or perform an external effect.

A repository-root context probe was not run because automatic project discovery
could disclose repository contents beyond the explicit projection. Instead, a
synthetic directory contained only this harmless marker in `AGENTS.md`:

```text
EMBER_SPIKE_CONTEXT_44
```

Codex and Cursor both knew the marker without invoking a tool. Therefore cwd is
part of the effective disclosure boundary. A production cognition adapter should
default to a dedicated minimal directory rather than the Ember repository root.

## Real Ember-owned projection round-trip

The final proof is implemented entirely under
`experiments/external-agent-runtime/`:

- `codex-provider.ts` is a provider-process adapter;
- `provider-result.schema.json` constrains Codex's final response;
- `live-codex-round-trip.ts` builds synthetic canonical state, runs one real
  cognition, and reports sanitized assertions;
- `probe.ts` records bounded lifecycle and termination observations.

The round-trip used the actual Ember path:

```text
Ember StateStore + canonical meanings
  -> buildProjection in runCognition
  -> real ProviderRequest over stdin
  -> experiment-local codex-provider.ts
  -> codex exec in an empty isolated cwd
  -> schema-constrained ProviderResult
  -> validateProviderResult
  -> runCognition reintegration and delivery
  -> descriptor-only canonical expression evidence
```

The synthetic state contained:

- one in-scope relationship meaning;
- one in-scope fact: the synthetic fixture server uses `EmberBoard 42` hardware;
- one out-of-scope preference containing `OUT_OF_SCOPE_MARKER_44`.

The live result was:

```json
{
  "provider": "codex exec",
  "lineage_preserved": true,
  "selected_meaning_count": 2,
  "used_meaning_count": 1,
  "out_of_scope_marker_disclosed": false,
  "raw_transcript_included": false,
  "cognition_status": "completed",
  "delivery_status": "displayed",
  "expression_evidence_role": "ember_expression_via_provider",
  "reply_retained_in_canonical_state": false,
  "reply": "The synthetic fixture server uses EmberBoard 42 hardware."
}
```

The generated IDs are intentionally omitted because they differ on each run. The
observed selected IDs exactly matched the two expected in-scope meanings; Codex
claimed use of only the fact ID. The existing validator confirmed that the claimed
ID was a subset of the projection. The external runtime never received the
out-of-scope marker, canonical store path, prior transcript, or mutation authority.

`runCognition` retained Ember's lineage, committed a completed cognition episode,
recorded descriptor-only Ember expression evidence, delivered the transient reply,
and did not persist the reply payload as canonical state. This satisfies #44's
required Ember-owned bounded projection round-trip.

## Comparison

| Dimension | Codex CLI | Claude Code CLI | Cursor Agent CLI |
| --- | --- | --- | --- |
| Authentication reuse | ChatGPT subscription login observed | OAuth cache expired; refresh failed | Browser login observed |
| Official automation | `codex exec` | `claude -p` | `agent -p` |
| Headless invocation | Successful | Structured auth failure before turn | Successful |
| Structured I/O | JSONL; output schema; Ember validator | JSON/stream JSON and schema option | Stream JSON with final result |
| Context control | Explicit cwd; automatic `AGENTS.md` discovery | Safe mode and tool controls accepted; live context probe blocked by auth | Explicit workspace; automatic `AGENTS.md` discovery |
| Tool control tested | Read-only sandbox; no tool use requested | Empty tool list and plan mode at init | Ask mode plus sandbox; no tool use requested |
| Session semantics | Thread ID and resume observed | Supported but not live-tested | Session ID and resume observed |
| Cancellation truth | Child exit 0, no acknowledgement | Not tested | Child exit 143, no acknowledgement |
| Model control | CLI supports selection; proof did not force a model | CLI supports selection; model artifact intentionally not treated as reliable evidence after auth failure | Init exposed selected model |
| One-shot portability cost | Thin argument/event adapter proven | Likely thin adapter after login repair | Thin argument/event adapter appears feasible |
| Subscription practicality | Proven now | Blocked until OAuth is restored | Proven now |

The products remain external agent runtimes: they own model selection, some agent
loop behavior, session state, working-directory interpretation, and potentially
tools and approval flows. Calling them interchangeable model endpoints would hide
material semantics.

## Boundary and recommendation

Codex and Cursor earn this common one-shot shape:

```text
Ember-owned bounded input + dedicated minimal cwd + invocation policy
  -> runtime-specific CLI adapter
  -> bounded lifecycle evidence + validated candidate result
```

The common boundary may expose optional runtime/session identifiers as operational
metadata. It must not promise equivalent tools, permissions, models, resume,
cancellation acknowledgement, or specialist behavior.

The first production follow-up should implement a **Codex `exec` one-shot cognition
adapter** behind the existing narrow Ember cognition seam. It should:

- use an isolated minimal cwd;
- pass only the selected projection and current input;
- retain external authentication ownership;
- bound JSONL/stdout/stderr and validate the final result;
- preserve provider/session IDs only as optional operational evidence;
- distinguish timeout from explicit cancellation; and
- avoid automatic retry after ambiguous termination.

Cursor can be a separate second adapter against that earned one-shot boundary.
Codex App Server and Cursor ACP belong in a later specialist-runtime experiment if
Ember needs protocol-level permission requests, progress, session load, or
cancellation. Claude should be re-probed after the user restores OAuth; the current
evidence does not justify a production Claude task or an Agent SDK dependency.

No production provider/runtime abstraction changed in this spike.

## Reproduction

Inventory and sanitized authentication status:

```bash
node --version
codex --version
codex login status
claude --version
claude auth status
agent --version
agent status
```

Run the deterministic experiment tests:

```bash
node --test test/external-runtime-probe.test.ts
```

Run the live synthetic Ember projection proof from an authenticated host:

```bash
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u CURSOR_API_KEY \
  node experiments/external-agent-runtime/live-codex-round-trip.ts
```

Run a generic lifecycle probe:

```bash
node experiments/external-agent-runtime/probe.ts \
  --cwd /tmp --timeout-ms 30000 -- \
  codex exec --ephemeral --skip-git-repo-check --sandbox read-only --json \
  'Return exactly {"probe":"ember-runtime","answer":42}'
```

Add `--cancel-after-ms N` before `--` to request explicit cancellation. Omitting it
leaves the ordinary deadline classified as `timeout` if reached.

## Residual limitations

- Claude subscription-backed execution and Agent SDK authentication reuse remain
  unproven until OAuth is restored.
- Direct-child exit did not prove remote or descendant cancellation.
- Complete vendor event schemas and every failure path were not frozen into Ember
  types; doing so would be premature.
- The synthetic context probe proves implicit cwd disclosure but does not inventory
  every vendor-specific project configuration source.
- Codex SDK/App Server, Cursor ACP, and Claude Agent SDK were not added because the
  one-shot CLI evidence answered the spike question without new dependencies.
- This was not a model-quality, cost, or performance benchmark.

## Official references

### OpenAI Codex

- Authentication: <https://developers.openai.com/codex/auth/>
- CLI reference: <https://developers.openai.com/codex/cli/reference/>
- Codex SDK: <https://developers.openai.com/codex/sdk/>
- Codex App Server: <https://developers.openai.com/codex/app-server/>

### Anthropic Claude Code

- Getting started: <https://docs.anthropic.com/en/docs/claude-code/getting-started>
- CLI reference: <https://docs.anthropic.com/en/docs/claude-code/cli-usage>
- API overview, used only to preserve the distinction from Claude Code subscription
  execution: <https://platform.claude.com/docs/en/api/overview>

### Cursor

- Authentication: <https://cursor.com/docs/cli/reference/authentication>
- CLI usage: <https://cursor.com/docs/cli/using>
- ACP integration: <https://cursor.com/docs/cli/acp>
- Configuration and permissions: <https://cursor.com/docs/cli/reference/configuration>
