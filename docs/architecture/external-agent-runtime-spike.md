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
**Phase:** cloud reconnaissance complete; authenticated local experiments pending.

This note deliberately stops before selecting or implementing a production runtime
abstraction. It records what can be established from Ember's current architecture
and current official runtime documentation, then defines a reproducible local
experiment plan for a machine where Codex, Claude Code, and Cursor are installed
and already authenticated.

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

## Preliminary candidate map

| Candidate | Supported automation surface found | Existing-login path documented | Structured lifecycle surface | Preliminary read |
| --- | --- | --- | --- | --- |
| Codex | `codex exec`, Codex SDK, App Server | **Yes.** Codex documents ChatGPT sign-in for subscription access and cached CLI login reuse. | JSONL from `exec`; richer local App Server; SDK threads | Strongest first candidate. Multiple officially supported integration depths. |
| Claude Code | `claude -p`, JSON / `stream-json`; Agent SDK is referenced for programmatic use | Claude Code itself is locally authenticated, but this reconnaissance did **not** establish from official docs that the Agent SDK necessarily reuses a Claude.ai subscription login. | CLI `stream-json`, sessions/resume, permission modes | Strong CLI experiment candidate. Treat SDK/subscription reuse as an explicit local question rather than an assumption. |
| Cursor | Agent CLI print mode; **ACP server over stdio/JSON-RPC** | **Yes for the CLI/ACP path.** Cursor documents browser login stored locally and ACP pre-authentication via existing CLI auth. | `stream-json`; ACP session/update, permission requests, cancel | Strong candidate. ACP is especially relevant because it exposes a purpose-built client integration protocol. |

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

- [ ] run repository documentation discovery and read the selected governing docs;
- [ ] recorded installed versions and sanitized authentication mode for all three
      candidates;
- [ ] tested a real no-side-effect cognition request through every viable supported
      local surface;
- [ ] verified or classified subscription/login reuse independently for each
      candidate;
- [ ] captured structured output/lifecycle behavior without credentials;
- [ ] tested session/resume behavior where relevant;
- [ ] tested cancellation semantics without overclaiming what cancellation proves;
- [ ] tested the narrowest practical context/tool/permission configuration;
- [ ] updated the preliminary comparison table with observed evidence;
- [ ] stated whether one common cognition boundary has actually been earned;
- [ ] recommended the smallest implementation follow-up;
- [ ] run `npm test` and `npm run check` after any repository changes;
- [ ] run documentation-discovery validation for this document and any other
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

## Cloud-phase limitations

This reconnaissance was prepared without access to the user's authenticated local
agent installations. It therefore intentionally leaves the following claims open
until the local continuation:

- exact installed runtime versions and executable names;
- whether environment configuration overrides cached login state;
- actual subscription/account attribution for each probe;
- Claude Agent SDK subscription-login reuse;
- exact event schemas emitted by the installed versions;
- observed cancellation and process-tree behavior;
- effective cwd/project instruction loading and tool permissions;
- startup/resource measurements on the target host.

Those are not paperwork gaps. They are the experiment.