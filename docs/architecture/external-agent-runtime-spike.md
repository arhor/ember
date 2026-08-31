---
summary: "Cloud reconnaissance and local experiment handoff for issue #44, comparing subscription-backed Codex, Claude Code, and Cursor agent runtimes for live Ember cognition."
read_when:
  - "Investigating or implementing issue #44 external agent runtime integration"
  - "Comparing Codex, Claude Code, or Cursor as a live cognition or specialist runtime for Ember"
  - "Designing a replaceable boundary between Ember cognition and an already-authenticated local agent runtime"
role: design
discovery_status: current
---

# External agent runtime spike: cloud reconnaissance and local handoff

## Status

**Issue:** [#44](https://github.com/arhor/ember/issues/44)  
**Reconnaissance date:** 2026-08-31  
**Repository baseline examined:** `master` at `a1e3f0aa21fa13722e4b2a10eed46c22d77070ea`  
**Phase:** local CLI experiments complete; production integration recommendation recorded.

This note records the cloud reconnaissance and the 2026-08-31 local experiments.
It stops before implementing a production runtime abstraction because the measured
evidence supports one narrow next task, not a general provider hierarchy.

The local experiments are the decisive evidence for #44. In particular, this
cloud phase cannot prove that a particular installed version reuses the expected
subscription, that local cached authentication is selected rather than an API key,
or that cancellation/permission/session behavior matches documentation on the
actual host.

## Question being tested

> Can Ember send one bounded cognition episode through an already-authenticated
> external agent runtime and receive a bounded result while Ember continues to own
> continuity, canonical state, context selection, authority, and result
> interpretation?

A second, deliberately subordinate question is whether the viable runtimes share a
small enough operational contract to justify one Ember-side boundary.

Do **not** answer the second question by designing the interface first. The local
experiments should earn the abstraction.

## Governing Ember constraints

The spike sits below the accepted semantic architecture.

- Ember continuity remains Ember-owned. An external runtime thread/session is an
  operational resource, not Ember identity or canonical memory.
- Each invocation receives a purpose-bounded least-sufficient permitted projection,
  not canonical state wholesale. See ADR 0003.
- Runtime tools, credentials, filesystem reach, and login state are capability,
  not semantic authority. See ADR 0004.
- Timeout, cancellation, process exit, and result arrival must not be interpreted
  more strongly than the evidence allows. In particular, cancellation does not
  prove rollback and a timeout does not prove absence of effects. See ADR 0005.
- External-runtime observations retain their provenance. A runtime result may
  become input to Ember cognition or evidence, but does not automatically become
  canonical truth.
- Provider/runtime-specific sessions can be useful for execution continuity, but
  their loss must not erase Ember continuity.

These constraints also explain why the experiment should begin in read-only or
otherwise non-side-effecting modes. The first question is whether cognition can
flow through the boundary, not whether a coding agent can mutate a repository.

## Current Ember integration seam

The current executable continuity slice already has a deliberately narrow
subprocess provider boundary in `src/ember/provider.ts`:

- Ember constructs a `ProviderRequest` containing the cognition ID, bounded
  `Projection`, and current user input;
- the child process receives exactly one JSON request on stdin;
- Ember bounds stdout/stderr and timeout behavior;
- the provider must return exactly one validated `ProviderResult` with a textual
  reply and the subset of projected meaning IDs it claims to have used;
- the subprocess is invoked directly with `shell: false`;
- ambiguous direct-child termination can remain `outcome_unknown`.

`src/ember/runtime.ts` creates and durably records the cognition episode before
calling the provider. Only after the provider returns and the canonical revision is
still current does Ember record the expression and delivery state.

This is useful prior art, but **the existing one-shot provider wire format should
not be mistaken for the final external-agent-runtime abstraction**. Codex, Claude
Code, and Cursor can own agent loops, tools, sessions, approval flows, and streaming
lifecycle events that a one-object request/result protocol intentionally does not
model.

The first local implementation should therefore prefer an experiment-local adapter
or harness over changing `ProviderInvoker` prematurely.

## Local experiment result

### Host and authentication inventory

- Host: macOS 26.5.2 (`Darwin 25.5.0`), Apple silicon (`arm64`).
- Node.js: `v26.8.1`; npm: `11.19.0`.
- Codex: `codex-cli 0.151.0`; `codex login status` reported `Logged in using
  ChatGPT`.
- Claude Code: `2.1.241`; `claude auth status` reported no active login. A live
  headless attempt reached initialization but failed because the cached OAuth
  session was expired and could not be refreshed.
- Cursor Agent and `cursor-agent`: `2026.08.11-e8db854`; `agent status` reported a
  logged-in browser account. The account identifier is intentionally omitted.
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `CURSOR_API_KEY` were absent. The
  harness also removed them from child environments.

The installed binaries were invoked through their documented CLI surfaces. No
credential cache was opened, copied, or inspected.

### Common no-tool cognition probe

The three candidates received the same trivial request in `/private/tmp`, outside
the Ember repository:

```text
Return exactly this JSON object and nothing else:
{"probe":"ember-runtime","answer":42}
```

| Candidate / surface | Result | Structured evidence | Observed duration | Subscription/login classification |
| --- | --- | --- | --- | --- |
| Codex `exec --json` | Success, exit 0, exact JSON result | `thread.started`, `turn.started`, `item.completed`, `turn.completed`; thread ID and usage exposed | 7.3 s wall clock | **Supported and observed:** ChatGPT login, with API-key variables absent |
| Cursor `agent -p --output-format stream-json --mode ask --sandbox enabled` | Success, exit 0, exact JSON result | init, user, assistant, result; session ID, selected model, login auth source, usage, and request ID exposed | 10.0 s wall clock; runtime reported 3.1 s API duration | **Supported and observed:** `apiKeySource: login`, with API-key variables absent |
| Claude Code `-p --output-format stream-json --safe-mode --permission-mode plan --tools ''` | Authentication failure, exit 1 | init and terminal result were structured; tools were empty, permission mode was `plan`, and the failure was typed `authentication_failed` | 3.4 s wall clock | **Not currently viable on this host:** cached OAuth expired; no API-key fallback attempted |

Prompt-enforced JSON was sufficient for the connectivity probe, but only Claude's
CLI exposed a first-class `--json-schema` option in the installed help. Production
code must still validate any returned payload independently.

### Session and resume observations

- Codex created a persisted exec thread and `codex exec resume` reused the same
  thread ID for a second exact JSON result. Resume required its own cwd/trust
  option when invoked from `/private/tmp`.
- Cursor `--resume <session-id>` reused the same session ID and returned a second
  exact JSON result. Its second result showed cache reuse.
- Claude session/resume was not tested because authentication failed before a
  model turn.

These are runtime-owned operational continuities. Neither identifier was written
into Ember canonical state or treated as Ember identity.

### Cancellation observations

The experiment harness sent `SIGTERM` to the direct CLI child after 750 ms during
a harmless no-tool request:

- Codex had emitted `thread.started` and `turn.started`, then the direct child
  exited with status 0. It emitted no completion or cancellation acknowledgement.
- Cursor emitted no event before the signal and the direct child exited with
  status 143.

Both observations establish only that the local direct child exited. They do not
establish remote rollback, absence of model work, descendant termination, or an
acknowledged runtime cancellation. Rich protocol-level cancellation remains a
specialist-runtime concern; automatic retry would be unjustified.

### Context and permission observations

Codex ran with a read-only sandbox and Cursor ran in Ask mode with sandboxing
enabled. Claude initialized with an empty tool list before authentication failed.
No probe attempted a tool action or repository mutation.

A real repository-cwd probe was rejected because automatic instruction discovery
could disclose repository content to the external services. A synthetic directory
containing only an `AGENTS.md` marker was used instead. Both Codex and Cursor knew
the marker without using tools, proving that cwd/project discovery can enlarge the
explicit prompt. Therefore a production one-shot cognition adapter should use a
dedicated minimal working directory by default, not the Ember repository root.

Cursor ACP is present (`agent acp`) and the installed help confirms the stdio
server entry point, but a bespoke ACP client was not added merely to duplicate the
successful one-shot CLI result. ACP remains the better candidate for a later
specialist-runtime experiment needing permission requests and protocol-level
cancellation. The Codex SDK/App Server and Claude Agent SDK were likewise not made
dependencies: the CLI evidence answered the one-shot question, while Claude's
expired OAuth made SDK subscription reuse impossible to establish in this run.

### Experiment-only code

`experiments/external-agent-runtime/probe.ts` is a dependency-free harness that:

- spawns an explicit command/argument vector with `shell: false`;
- removes the three common API-key variables;
- bounds retained stdout and stderr to 1 MiB each;
- records JSONL event types, duration, exit code/signal, and truncation;
- can request direct-child termination while labelling only what was observed.

It is intentionally outside `src/ember/`. Its tests cover structured lifecycle
summarization and truthful direct-child cancellation reporting.

## Observed candidate map

| Candidate | Supported automation surface found | Existing-login path documented | Structured lifecycle surface | Preliminary read |
| --- | --- | --- | --- | --- |
| Codex | `codex exec`, Codex SDK, App Server | **Yes, observed:** ChatGPT login powered headless CLI execution without an API-key environment variable. | JSONL from `exec`; thread resume observed; SDK/App Server not needed for the one-shot proof | Best first live cognition candidate. |
| Claude Code | `claude -p`, JSON / `stream-json`; Agent SDK is referenced for programmatic use | **Currently unavailable:** local OAuth was expired and refresh failed. CLI subscription reuse is plausible but not operational on this host; SDK reuse remains unproven. | Structured init and typed authentication failure observed | Do not substitute API billing. Re-test CLI after the user restores login. |
| Cursor | Agent CLI print mode; ACP server over stdio/JSON-RPC | **Yes, observed:** browser login powered headless CLI execution and reported `apiKeySource: login`. | `stream-json` and session resume observed; ACP executable present but not client-probed | Viable second one-shot backend; ACP belongs in a later specialist experiment. |

This table is reconnaissance, not a ranking of model quality.

## Codex findings

### Authentication

Current Codex documentation explicitly distinguishes:

- **Sign in with ChatGPT** for subscription access; and
- API-key sign-in for usage-based access.

The Codex CLI supports the ChatGPT browser flow via `codex login`, caches login
state locally, and exposes `codex login status` to inspect the active authentication
method. This makes the user's existing local Codex login a directly documented
candidate for the #44 experiment without Ember handling raw credentials.

For the spike, record the **authentication method/status**, never credential files
or token values. Do not inspect or copy `~/.codex/auth.json`.

### Automation surfaces

Three official surfaces deserve separate local probes:

1. **`codex exec`**
   - documented as stable non-interactive execution;
   - accepts a prompt directly or from stdin;
   - can stream stdout/JSONL;
   - can resume previous exec sessions.

2. **Codex SDK**
   - official TypeScript surface for programmatically controlling local Codex
     agents;
   - explicitly intended for embedding Codex into applications, internal tools,
     workflows, and other agents;
   - potentially the cleanest fit with Ember's selected TypeScript/Node.js 26
     runtime if authentication behavior is confirmed locally.

3. **Codex App Server**
   - lower-level local integration surface;
   - default transport is newline-delimited JSON over stdio;
   - exposes explicit initialize/thread/turn lifecycle and richer events;
   - useful if the SDK hides lifecycle facts Ember eventually needs or if #44
     needs to inspect thread/approval semantics directly.

### First hypothesis

Start with `codex exec` because it minimizes experimental code and proves the
subscription-backed execution path. Then probe the SDK before writing a bespoke
App Server client. Use App Server only when the experiment needs lifecycle/control
information that the SDK does not expose cleanly.

Do not equate a Codex thread with Ember continuity.

## Claude Code findings

### Automation surface

Claude Code currently provides a substantial headless CLI surface:

- `claude -p` / `--print` for non-interactive runs;
- `--output-format text|json|stream-json`;
- `--input-format text|stream-json` in print mode;
- `--json-schema` for validated final structured output;
- `--max-turns`;
- model selection;
- explicit permission modes;
- session persistence and resume controls.

The CLI reference points programmatic users toward the Claude Agent SDK, so that
SDK is worth investigating after the CLI experiment.

### Authentication uncertainty to preserve

Do **not** silently replace the user's stated goal with Anthropic API-key billing.
The direct Claude API TypeScript SDK is a different integration class and official
Claude Platform API documentation expects API/managed-platform credentials.

The specific #44 question is whether an already-authenticated **Claude Code** local
installation can be used under the user's existing Claude subscription for
Ember-driven execution. The safest first probe is therefore the installed
`claude -p` CLI itself.

The local agent should establish, without exposing credentials:

1. which account/login mode the installed CLI is actually using;
2. whether `claude -p` works without `ANTHROPIC_API_KEY` being supplied by the
   experiment;
3. whether the result is still accounted for as the user's normal Claude Code
   subscription usage;
4. whether the Agent SDK can reuse that same local authentication, or instead
   expects a separate API credential/billing path.

Until (4) is demonstrated, do not make the Agent SDK the common implementation
baseline.

## Cursor findings

### Authentication

Cursor documents browser login as the recommended CLI authentication method and
stores the resulting credentials locally. `agent status` can report authentication
status. API-key authentication is a separate automation option, but #44 should
prefer the existing browser login first because subscription/login reuse is the
question under test.

Again, record only the selected auth mechanism/account class needed for evidence,
not tokens.

### Automation surfaces

Two surfaces should be tested:

1. **Agent CLI print mode**
   - `agent -p` / `--print` for non-interactive automation;
   - structured output options suitable for scripts;
   - resumable sessions;
   - model selection and CLI permission configuration.

2. **ACP (`agent acp`)**
   - Cursor officially documents ACP as a custom-client integration surface;
   - stdio transport, newline-delimited JSON-RPC 2.0;
   - explicit `initialize`, authentication, session create/load, prompt, streamed
     session updates, permission requests, and cancellation;
   - can be pre-authenticated through existing `agent login` state.

ACP is especially interesting because it already expresses several concepts #44
would otherwise be tempted to invent. This does **not** mean Ember should adopt a
generic ACP architecture now. It means the Cursor experiment should record whether
ACP's semantics line up with Ember's needed external-runtime boundary.

### Safety note

Cursor documentation warns that non-interactive Agent mode can have write access.
The first probe should therefore use the most restrictive/read-only mode supported
by the installed version (for example Ask/Plan where suitable) and a prompt that
does not require tools or mutations. Do not use repository modification as the
initial connectivity test.

## Cross-candidate observations

### These are agent runtimes, not merely model endpoints

All three candidates can own more than model inference. Depending on the surface,
they may own:

- model selection;
- an internal agent loop;
- filesystem/shell/web tools;
- working-directory context;
- permission/sandbox decisions;
- their own session/thread state;
- streaming progress and tool events;
- compaction or other runtime-local context behavior.

Consequently, an interface called `ModelProvider` would be misleading if it
pretends these semantics do not exist.

### Authentication should remain runtime-owned in this experiment

The cleanest path for #44 is:

```text
Ember
  -> launches supported local runtime surface
       -> runtime selects its already-established login/session
  <- receives bounded events/result
```

not:

```text
Ember
  -> reads private credential cache
  -> refreshes vendor tokens
  -> becomes an OAuth broker
```

The latter creates a new security and maintenance responsibility that the spike
does not need.

### There may be more than one useful abstraction level

The evidence already suggests at least two possible levels:

- a simple **one cognition episode** boundary, suitable for Ember asking a model-
  backed runtime for a bounded answer; and
- a richer **specialist runtime** boundary with sessions, progress, approvals,
  cancellation, tools, and long-running work.

Do not force both into one interface during #44. The first live Ember cognition may
need only the first level even if later coding delegation needs the second.

## Comparison and recommendation

| Dimension | Codex CLI | Claude Code CLI | Cursor Agent CLI |
| --- | --- | --- | --- |
| Authentication reuse | ChatGPT subscription login observed | OAuth cache present but expired; refresh failed | Browser login observed |
| Official automation surface | `codex exec` | `claude -p` | `agent -p` |
| Headless invocation | Successful | Reached auth failure headlessly | Successful |
| Structured I/O | JSONL events; prompt/schema-controlled result | JSON/stream JSON and schema option; typed auth failure observed | Stream JSON with final result |
| Runtime ownership | Agent loop, model, thread, tools, cwd policy | Agent loop, model, session, tools, permissions | Agent loop, model, session, tools, cwd policy |
| Context control | Explicit cwd, but `AGENTS.md` auto-discovery observed | Safe mode/tool controls available; live context probe blocked by auth | Workspace explicit, but `AGENTS.md` auto-discovery observed |
| Tool control | Read-only sandbox used; CLI still represents an agent runtime | Empty tool set and plan mode observed at init | Ask mode and sandbox used; `-p` otherwise warns it has write/shell tools |
| Session semantics | Thread ID and resume observed | Supported by CLI, not live-tested | Session ID and resume observed |
| Cancellation/failure | Direct child exited 0 without terminal event after SIGTERM | Typed authentication failure; cancellation not tested | Direct child exited 143 without events after SIGTERM |
| Model control/discovery | CLI accepts model selection; probe did not force a model | Init exposed `claude-opus-5[1m]` before auth failure | Init exposed `GPT-5.6 Sol 272K Low` |
| Startup/latency | 7.3 s first trivial probe | 3.4 s to auth failure | 10.0 s wall; 3.1 s reported API duration |
| Portability cost | Thin CLI-specific argument/event decoder | Thin decoder possible after login repair | Thin CLI-specific argument/event decoder |
| Subscription practicality | Proven useful now | Blocked until user restores OAuth | Proven useful now |

### Smallest boundary earned by the evidence

Codex and Cursor justify a common **one-shot cognition episode** boundary, but not
a common specialist runtime protocol:

```text
Ember-owned bounded input + dedicated minimal cwd + invocation policy
  -> runtime-specific CLI adapter
  -> bounded lifecycle evidence + candidate textual/structured result
```

The shared contract should expose terminal evidence and runtime/session identifiers
as optional operational metadata while keeping each adapter's event decoder and
permission arguments explicit. It should not promise cancellation acknowledgement,
tool equivalence, model identity, resumability, or a uniform permission model.

The first implementation task should add a **Codex `exec` one-shot cognition
adapter** behind a small Ember-facing episode boundary. Codex is preferred because
its ChatGPT subscription path was directly reported by the runtime, its JSONL
lifecycle is compact, and it completed and resumed successfully with read-only and
ephemeral options. The adapter should default to an isolated minimal cwd, validate
the final response, retain only bounded operational evidence, and avoid automatic
retry after ambiguous termination.

A second, separate task may add Cursor's one-shot adapter against the same narrow
boundary. ACP and Codex App Server belong in a later specialist-runtime task only
when Ember needs protocol-level permissions, progress, or cancellation. Claude
Code should be re-probed after the user restores OAuth; no production Claude task
is justified by this run. Thus the spike graduates into one first implementation
task plus explicitly separate follow-ups, not a three-provider framework.

## Local experiment plan

The local agent should work from this branch/PR and update this note with measured
results. Code should remain under an experiment-local directory until the evidence
justifies changing Ember's production provider/runtime boundary.

### Phase 0: repository and environment inventory

Before modifying anything:

1. sync the branch with current `master` if it moved;
2. follow `AGENTS.md` and run documentation discovery;
3. read the governing ADRs and #44;
4. record OS/architecture and Node version;
5. record the executable path and version for each candidate, without dumping
   environment variables or credential files.

Suggested inventory commands, adjusted to the actually installed binary names:

```bash
node --version
command -v codex && codex --version
command -v claude && claude --version
command -v agent && agent --version
command -v cursor-agent && cursor-agent --version
```

Do not fail the whole experiment because one alias differs from current docs.
Record the actual binary and continue.

### Phase 1: authentication/status evidence

Use vendor-provided status commands where available. Record only sanitized facts
such as `chatgpt`, `browser login`, `api key`, `unknown`, or `not authenticated`.

For Codex, `codex login status` is explicitly documented.
For Cursor, use the installed CLI's status command.
For Claude Code, use supported CLI diagnostics/account UI rather than reading token
files.

**Important:** if an environment variable such as `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, or `CURSOR_API_KEY` is present, do not print its value. Record
only whether its presence could make the auth-source result ambiguous. Prefer a
controlled child environment that omits API-key variables when testing cached
subscription login, provided doing so does not disturb the user's normal config.

### Phase 2: minimal no-tool cognition

Use the same semantically trivial prompt for all candidates. It should require no
repository knowledge, shell command, network search, or file mutation.

Example:

```text
Return exactly this JSON object and nothing else:
{"probe":"ember-runtime","answer":42}
```

The exact wording may be adapted if a candidate has first-class structured-output
support. Record:

- command/surface used;
- exit code/signal;
- wall-clock duration;
- bounded stdout/stderr shape;
- whether structured output was native or prompt-enforced;
- runtime/session/thread identifier if exposed;
- selected model if exposed;
- sanitized auth source if exposed;
- whether any tool action was attempted;
- whether the run appears under the expected subscription/account usage.

Success is not exact wording alone. The key fact is that Ember-controllable input
can cross a supported local boundary and a machine-consumable result can return
without Ember taking ownership of credentials or provider-side continuity.

### Phase 3: structured streaming/lifecycle

For each viable candidate, inspect the richest supported structured surface that is
still proportionate to the spike:

- Codex: `exec` JSONL, then SDK; App Server if needed;
- Claude Code: `--output-format stream-json`, then Agent SDK only if auth reuse is
  viable;
- Cursor: stream output and ACP.

Record which lifecycle facts can be observed, for example:

- session/thread created;
- model selected;
- response delta/result;
- tool request/result;
- permission request;
- completion/failure;
- token/usage metadata when available;
- cancellation acknowledgement.

Do not persist vendor event schemas into Ember production types yet.

### Phase 4: cancellation and timeout

Use a harmless task that runs long enough to attempt cancellation. Determine:

- how the client asks the runtime to cancel;
- whether cancellation is acknowledged separately from process termination;
- what exit/status/event is observed;
- whether child-process termination is enough to know runtime work stopped;
- whether a resumable/background operation can survive the invoking process.

Preserve uncertainty. If the evidence only establishes "client disconnected" or
"direct child exited", say that rather than claiming the remote/runtime action was
cancelled.

### Phase 5: context and permission boundary

Run a small repository-aware **read-only** task from the Ember working directory.
The purpose is to observe what the external runtime receives implicitly in addition
to Ember's explicit prompt:

- Does it automatically read `AGENTS.md` or vendor-specific instruction files?
- Does cwd itself grant repository visibility?
- Can project configuration add tools/MCP servers?
- What is the narrowest practical tool/permission mode?
- Can a cognition-style invocation run with tools disabled or read-only?

This phase matters because a nominally small Ember projection may still be enlarged
by runtime-owned cwd/project discovery. Such implicit context must be understood
before calling the boundary "least sufficient".

## Evidence record template

Fill one record per tested surface, not merely one per vendor.

```markdown
### <vendor / surface>

- Runtime version:
- Executable/package version:
- OS/architecture:
- Invocation:
- Authentication source: <sanitized>
- Existing subscription/login reused: yes / no / unclear
- Evidence for billing/account path:
- Input mode:
- Output mode:
- Structured event/result contract:
- Session/thread ID exposed:
- Resume supported/tested:
- Working-directory behavior:
- Tool mode:
- Permission/sandbox mode:
- Cancellation mechanism:
- Observed cancellation semantics:
- Exit/error semantics:
- Model selection/discovery:
- Startup/wall-clock observation:
- Local resource observation (if measured):
- Sensitive data exposed by the interface: none / describe class only
- Fit for one-shot Ember cognition:
- Fit for specialist delegation:
- Provider-specific code that appears unavoidable:
- Open questions:
```

Keep raw outputs only when they are useful and sanitized. Never commit auth tokens,
credential cache contents, account secrets, or unrelated personal/project data.

## Experiment harness guidance

If code is useful, prefer something like:

```text
experiments/external-agent-runtime/
  README.md
  probe.ts
  fixtures/        # sanitized expected-shape fixtures only, if useful
```

The first harness can simply spawn a candidate with `shell: false`, provide bounded
stdin, capture bounded stdout/stderr/events, measure duration, and save a sanitized
summary. Reuse the **principles** already proven by `src/ember/provider.ts`, but do
not couple the experiment to `ProviderResult` merely to save a few lines.

Avoid new runtime dependencies until one earns itself. If testing an official SDK
requires a package, keep it experiment-local where practical and record why the SDK
is being tested.

## Decision gates after local evidence

### Gate A: can at least one subscription-backed runtime power live cognition?

If yes, recommend the smallest path that makes Ember genuinely model-backed.
If no, explain precisely whether the blocker is authentication, unsupported
programmatic use, output/control semantics, or something else.

### Gate B: is there a common one-shot cognition contract?

A common boundary is justified only if at least two viable candidates can preserve
roughly the same Ember-facing semantics without hiding important provider-specific
facts.

A plausible shape might eventually include:

```text
bounded input/projection
+ invocation policy/capabilities
-> runtime-owned episode
-> structured result + lifecycle evidence
```

That is a hypothesis, **not an interface proposal**.

### Gate C: is specialist delegation the same boundary?

Probably not automatically. If sessions, tools, approvals, progress, resume, and
cancellation become first-class requirements, record a separate specialist-runtime
follow-up rather than growing the simple cognition boundary until it means
nothing.

### Gate D: which integration should become Ember's first live backend?

Prefer the candidate/surface that best combines:

- officially supported automation;
- confirmed reuse of the user's intended subscription/login;
- bounded structured I/O;
- explicit lifecycle/error semantics;
- controllable context/tool permissions;
- small Ember-side integration cost;
- no transfer of continuity or credential ownership.

Do not choose based on model quality in this spike.

## Recommended local test order

1. **Codex `exec`**: lowest-friction proof of ChatGPT-subscription-backed local
   execution.
2. **Codex SDK**: determine whether a native TypeScript surface provides the same
   auth path with a cleaner programmatic contract.
3. **Cursor Agent print mode**: confirm existing browser-login reuse and structured
   output in a restrictive mode.
4. **Cursor ACP**: inspect the purpose-built session/event/permission/cancel
   protocol and compare it to Ember's needs.
5. **Claude Code `-p`**: confirm that the installed authenticated CLI works in
   headless mode without introducing API-key billing.
6. **Claude Agent SDK**: only after establishing whether it can preserve the same
   desired authentication/subscription path.

The order is about reducing uncertainty cheaply, not a vendor preference.

## Handoff checklist for the local agent

The local continuation is complete enough for review when it has:

- [x] run repository documentation discovery and read the selected governing docs;
- [x] recorded installed versions and sanitized authentication mode for all three
      candidates;
- [x] tested a real no-side-effect cognition request through every viable supported
      local surface;
- [x] verified or classified subscription/login reuse independently for each
      candidate;
- [x] captured structured output/lifecycle behavior without credentials;
- [x] tested session/resume behavior where relevant;
- [x] tested cancellation semantics without overclaiming what cancellation proves;
- [x] tested the narrowest practical context/tool/permission configuration;
- [x] updated the preliminary comparison table with observed evidence;
- [x] stated whether one common cognition boundary has actually been earned;
- [x] recommended the smallest implementation follow-up;
- [x] run `npm test` and `npm run check` after any repository changes;
- [x] run documentation-discovery validation for this document and any other
      participating docs changed by the spike.

## Explicitly deferred

This reconnaissance does not justify:

- a `ModelProvider` / `AuthStrategy` / `AgentRuntime` class hierarchy;
- an Ember credential store or OAuth refresh service;
- using vendor session history as Ember memory;
- a generic ACP/MCP framework;
- production specialist delegation;
- automatic retry of ambiguous external work;
- changing canonical cognition semantics to mirror vendor event schemas;
- selecting one vendor on model-quality grounds.

## Official references examined

### OpenAI Codex

- Authentication: <https://developers.openai.com/codex/auth/>
- CLI reference / non-interactive `codex exec`: <https://developers.openai.com/codex/cli/reference/>
- Codex SDK: <https://developers.openai.com/codex/sdk/>
- Codex App Server: <https://developers.openai.com/codex/app-server/>

### Anthropic Claude Code

- Claude Code getting started: <https://docs.anthropic.com/en/docs/claude-code/getting-started>
- Claude Code CLI reference: <https://docs.anthropic.com/en/docs/claude-code/cli-usage>
- Claude Platform API overview, used only to preserve the distinction between
  direct API credentials and the Claude Code subscription-backed runtime:
  <https://platform.claude.com/docs/en/api/overview>

### Cursor

- Cursor CLI authentication: <https://cursor.com/docs/cli/reference/authentication>
- Cursor CLI usage: <https://cursor.com/docs/cli/using>
- Cursor ACP integration: <https://cursor.com/docs/cli/acp>
- Cursor CLI configuration/permissions: <https://cursor.com/docs/cli/reference/configuration>

## Residual limitations

- Claude subscription-backed execution and Agent SDK authentication reuse remain
  unproven until the user restores the expired OAuth login.
- The experiment observed CLI event shapes but did not freeze complete vendor
  schemas or test every error path.
- Direct-child termination did not establish remote or descendant cancellation.
- Context discovery was tested with a harmless synthetic `AGENTS.md`, not by
  disclosing the Ember repository to the external runtimes.
- Resource usage beyond reported token/cache fields and wall-clock startup was not
  benchmarked because model quality and performance benchmarking are non-goals.
- Codex App Server, Codex SDK, Cursor ACP, and Claude Agent SDK remain richer
  specialist/programmatic follow-ups rather than dependencies of the one-shot
  experiment.
