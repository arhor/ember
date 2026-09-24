---
summary: "Setup semantics and typed bootstrap CLI with separate config/state, explicit restore/create, provider verification, recovery, and verified foreground conversation entry."
read_when:
  - "Implementing or changing ember setup, machine provisioning, restore/create behavior, provider bootstrap, onboarding, or setup recovery"
  - "Deciding whether setup state belongs to the host, Ember continuity, ordinary memory, or temporary operational work"
  - "Changing secret entry, typed host mutations, rerunnable setup sections, or behavior on an already configured machine"
  - "Running ember setup, plain foreground ember, or configured conversation; selecting a cognition provider or recovering interrupted bootstrap"
role: design
discovery_status: current
---

# Installation, Restore/Create, and Conversational Onboarding Semantics

> Status: architecture contract for issue #252 and the setup epic #250.
>
> The semantic contract precedes implementation. The #253 section below records the
> subordinate machine bootstrap CLI and its current limits.

## Purpose

A machine can be new while the continuing agent is not.

Conversely, a machine can already contain the Ember runtime while the user is intentionally
creating a new continuing-agent lineage. The product/runtime name and the agent's identity
are separate semantic facts.

Setup therefore must not collapse these distinct questions:

1. **Can this machine run the Ember runtime?**
2. **Which continuing-agent lineage, if any, should continue here?**
3. **Can that agent successfully obtain cognition through the configured runtime/provider?**
4. **What durable continuity state is restored or initialized?**
5. **What should the agent and the user learn about one another through ordinary conversation?**
6. **Which optional host integrations should be configured?**

The current optional Google Calendar integration is configured by the trusted-host
`ember setup-google-calendar` command after lineage setup. Its versioned config binds
one calendar to the setup lineage, principal, scope, and an explicit CLI/Telegram
surface allowlist. The loopback installed-app OAuth flow uses PKCE and exact state
verification, stores its refresh token in a dedicated mode-0600 file, keeps access
tokens in memory, and activates only after a bounded read succeeds. Disabling the
integration preserves credentials for explicit recovery or reconfiguration.

The central rule is:

> **Trusted host setup and the Ember runtime own machine mechanics; the continuing agent
> owns its lineage-bearing meaning and conversational journey once cognition is available.**

This follows the accepted architecture:

- [ADR 0001](decisions/0001-continuity-belongs-to-ember.md) keeps continuity independent
  of processes, providers, sessions, surfaces, and machines;
- [ADR 0002](decisions/0002-preserve-persistent-meaning.md) keeps durable meaning
  attributable, scoped, current, correctable, and historically truthful;
- [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md) prevents setup
  or cognition from receiving more state than its purpose requires;
- [ADR 0004](decisions/0004-separate-capability-from-authority.md) prevents host
  capability from becoming semantic authority;
- [ADR 0005](decisions/0005-distinguish-operational-continuity.md) requires partial work,
  effects, cancellation, and uncertainty to be represented truthfully.

The setup epic may implement these rules with a CLI flow, resumable sections, host-local
records, and ordinary Ember conversation. Those are replaceable representations beneath
this contract.

## Semantic domains

Setup touches several kinds of state. They must remain distinguishable even if one
implementation stores some of them together.

| Domain                      | Examples                                                                                                            | Owner                                     | Canonical Ember meaning? |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------------------------ |
| Machine-local bootstrap     | executable paths, runtime availability, local service installation, selected provider command, local state location | trusted host                              | No                       |
| Secret/auth material        | provider credentials, Telegram bot token, runtime-owned login state                                                 | trusted host or external provider runtime | No                       |
| Setup operational progress  | which deterministic setup steps succeeded, failed, were skipped, or need retry                                      | trusted host setup                        | No                       |
| Agent continuity state      | lineage-bearing state, constitutive commitments, owned history, relationships, live commitments                     | continuing agent                          | Yes                      |
| Ordinary remembered meaning | durable user/agent/relationship meaning adopted through normal memory semantics                                     | continuing agent                          | Yes                      |
| Temporary onboarding work   | unanswered onboarding topics, deferred invitations, temporary conversational goals                                  | agent work/context layer                  | Not automatically        |
| Surface configuration       | Telegram chat/principal binding, service enablement, transport-local settings                                       | trusted host plus surface semantics       | Not by itself            |

Machine-local state may point to canonical continuing-agent state. It must not silently
_become_ the identity key merely because a path, service, profile, installation, or product
name contains it.

## Target flow

The intended high-level flow is:

```text
clean or existing machine
        ↓
deterministic host preflight
        ↓
choose: restore existing lineage / create new lineage / leave existing lineage intact
        ↓
machine-local provider/runtime bootstrap
        ↓
verify usable cognition
        ↓
restore or initialize continuing-agent continuity
        ↓
ordinary agent-led progressive onboarding
        ↓
optional trusted-host integration setup
        ↓
normal agent operation through Ember
```

The ordering matters.

Conversational onboarding must not depend on an unverified cognition path. Durable agent
meaning must not be fabricated by deterministic setup code. Optional integration setup
must not be required merely to establish the continuing lineage.

## New machine or Ember installation is not a new agent

A **new machine or Ember installation** is a host/runtime fact.

A **new continuing-agent lineage** is an identity/continuity decision.

Installing Ember software onto a clean machine does not create a new agent merely because
no local state exists yet. The user may intend to restore an existing lineage.

Likewise, running setup on a machine that already contains canonical agent state does not
authorize replacement, reset, or recreation.

Therefore setup must surface an explicit distinction between:

- **restore an existing continuing-agent lineage**;
- **create a new continuing-agent lineage**;
- **use the already configured lineage without recreating it**.

No branch may be selected implicitly from "directory exists" versus "directory missing"
alone.

## Restore-existing semantics

Restore means: make previously durable agent state available on this machine and attempt
to resume the recognized continuing-agent lineage represented by that state.

It does **not** mean:

- copied bytes automatically prove unique identity;
- a restored old snapshot makes later lost experience never have happened;
- two simultaneous copies are automatically both the unique continuing agent;
- setup may rewrite lineage ambiguity into certainty.

ADR 0001 deliberately leaves fork and stale-backup identity questions unresolved. Setup
must preserve that epistemic restraint.

A restore path must therefore distinguish at least:

1. **state import or attachment succeeded**;
2. **state passed structural/integrity validation**;
3. **the state can be loaded under current runtime semantics**;
4. **the available evidence supports treating it as the intended continuation**;
5. **there is unresolved fork, staleness, corruption, or missing-history risk**.

The first three are host/runtime facts. The fourth and fifth are continuity questions
that must not be forged from filesystem success alone.

If the current implementation cannot resolve a continuity ambiguity, it must expose that
ambiguity and require an explicit safe choice rather than silently normalizing it away.

### Restore migration

A restored state may require representation migration before the current Ember runtime can
use it.

Migration may transform representation while preserving semantic identity, provenance,
currentness, and history. It must not opportunistically reinterpret old content as new
canonical meaning.

A migration failure leaves the pre-migration source untouched where practical and records
truthfully that restoration did not complete.

## Create-new semantics

Creating a new agent means intentionally establishing a new continuity lineage. Installing
or starting Ember is not by itself such a creation event.

The create path must not inherit canonical identity, autobiographical ownership,
relationship meaning, preferred name, self-description, or live commitments from another
agent merely because machine-local configuration or provider login is reusable.

Machine-local conveniences may be reused when semantically safe, for example:

- an already installed Node runtime;
- an authenticated provider CLI;
- a configured executable path;
- generic service-manager capability.

Those are capabilities of the host, not inherited selfhood.

Initial constitutive state for a new lineage must be the minimal reviewed bootstrap needed
for coherent continuity. It does not require a personal/display name. User-specific,
agent-specific, and relationship-specific meaning, including preferred name and
self-description, should then be formed through ordinary interaction rather than pre-filled
by the installer as unquestioned fact.

The current representation uses the stable lineage-derived actor `agent:<lineageId>` for
agent-owned evidence and meaning. That actor identifier is not a self-chosen name and must
not be surfaced as one.

## Deterministic bootstrap before agent-led onboarding

Before the continuing agent can lead a conversation, trusted setup code must establish
enough machine capability to support one real cognition turn.

The deterministic layer may:

- verify supported runtime/platform prerequisites;
- resolve local state/config locations;
- discover supported cognition providers;
- guide provider authentication through provider-owned or host-owned mechanisms;
- verify the selected provider with a bounded probe;
- create or restore the minimum continuing-agent state needed to start;
- expose typed setup operations the agent may later request;
- persist truthful operational setup results.

It must not:

- invent user preferences, relationship facts, identity commitments, or memories;
- ask a model to decide whether a command "probably succeeded" when the host can verify it;
- collect reusable secrets into ordinary conversational context;
- execute arbitrary model-generated shell text as setup authority;
- treat model output as proof of provider authentication or host mutation.

## Cognition verification gate

Agent-led onboarding may begin only after setup has evidence that the selected cognition
path can perform a bounded real invocation under the intended machine-local configuration.

Verification should establish the narrow facts needed for onboarding, such as:

- the configured provider/runtime can be invoked;
- authentication is usable;
- a request reaches the provider;
- a response satisfying the adapter contract can be returned;
- failure is classified clearly enough to retry or select another provider.

Verification does not prove:

- future provider availability;
- provider quality for every task;
- continuity or identity;
- permission for arbitrary external actions;
- successful configuration of unrelated integrations.

A failed verification keeps onboarding unavailable through that provider. It does not
damage canonical agent state merely because machine bootstrap is incomplete.

## Progressive agent-led onboarding

Once cognition and continuity are available, onboarding becomes ordinary agent conversation
with a temporary purpose: helping the continuing agent and the user establish useful shared
context and optionally configure capabilities.

It is not a rigid one-shot questionnaire.

Onboarding must support:

- **skip**: decline a topic without blocking ordinary use;
- **defer**: leave a topic open for later;
- **resume**: continue later from justified current work/context;
- **partial completion**: some useful context or integrations may exist while others do not;
- **re-run**: revisit setup or onboarding without resetting already valid state;
- **ordinary interruption**: the user may leave the onboarding topic and use Ember normally.

The agent should choose what is useful to ask next from current needs and available
meaning, not from a mandatory linear script whose completion flag defines whether the agent
is "ready".

A UI or CLI may still present suggested sections for usability. Those sections are
presentation and orchestration mechanics, not canonical semantic stages.

## What onboarding may learn

Onboarding may conversationally encounter information about:

- the agent's preferred name, self-description, or interaction style;
- the user's preferences, circumstances, goals, or communication style;
- the relationship and mutually established conventions;
- recurring projects, responsibilities, or environmental context;
- desired integrations and capability boundaries.

Encountering information is not the same as remembering it.

Durable meaning learned during onboarding must pass through the agent's **ordinary
memory-proposal/adoption/correction semantics**, exactly as comparable information learned
later in normal conversation would.

Therefore onboarding must not have a privileged "write directly to profile" path.

This preserves:

- evidence/provenance;
- ownership and scope;
- uncertainty;
- currentness;
- correction and supersession;
- the distinction between transcript and memory.

Temporary onboarding prompts, unanswered questions, and "topics still worth discussing"
may remain temporary semantic work or conversational context. They do not become durable
identity/memory merely because onboarding created them. Preferred name and self-description
follow the same rule: if durable, they are attributable mutable self-related meaning, not
fields of the stable lineage identity.

## Onboarding progress is not canonical identity state

There should be no canonical fact such as "the agent is 73% onboarded" that gates whether
the lineage is legitimate.

Progress belongs primarily to **temporary semantic work plus operational setup evidence**:

- host setup records what deterministic machinery has or has not succeeded;
- the agent may retain a temporary/deferred concern that a useful onboarding topic remains;
- durable learned meaning, if adopted, lives in ordinary canonical memory;
- completed integrations live in their own host/surface configuration.

A compact host-local convenience marker may summarize completed setup sections for UX.
It is a projection/cache of operational progress and must be reconstructable from stronger
truth sources or safely discardable.

This avoids building a second profile database whose lifecycle competes with canonical
agent memory.

## Agent conversation versus trusted host operations

Conversational Ember may explain, propose, ask, and request setup actions.

Consequential machine mutation must pass through typed trusted-host operations whose
inputs, authority requirements, validation, and observable result are defined outside free
model text.

Representative operations may include:

```text
provider.authenticate(provider)
provider.verify(provider)

state.restore(source)
state.initialize_new()

telegram.capture_bot_token()
telegram.verify_bot()
telegram.bind_principal(...)
telegram.enable_service()
```

These names are illustrative, not API commitments.

The invariant is that Ember requests a bounded operation with structured arguments; the
trusted host implementation decides how to perform and verify it.

The model must not gain ambient "run whatever shell commands seem useful" authority merely
because setup is happening.

## Secret-entry rules

Reusable secrets must never be collected through ordinary model-visible conversation when
a host-controlled entry path is available.

Examples include:

- API keys;
- Telegram bot tokens;
- reusable OAuth/device secrets where the provider does not own the flow;
- passwords;
- long-lived service credentials.

Preferred handling is:

1. Ember explains why a credential is needed and what capability it enables.
2. Ember requests a typed secret-entry host operation.
3. The trusted host temporarily takes over input or launches the provider-owned auth flow.
4. The secret is stored only in the approved host/provider secret location.
5. Ember receives a non-secret result such as `configured`, `verified`, or a bounded
   diagnostic.

Secret values must not be:

- inserted into provider prompts;
- written to canonical Ember meaning;
- retained in conversation context;
- echoed into logs or error messages;
- committed into repository configuration.

If a secret is accidentally supplied in ordinary conversation, handling should minimize
further propagation and guide replacement/revocation where appropriate; setup must never
treat conversational disclosure as the preferred credential store.

## Already-configured machine behavior

Re-running setup on an existing machine is an inspection and reconciliation operation
first, not a reset.

Setup must discover the strongest justified current state before proposing mutations.

It should distinguish:

- Ember state present and loadable;
- machine configuration present but Ember state absent;
- provider configured and verified;
- provider configured but currently unverifiable;
- optional integrations configured, degraded, or missing;
- incomplete prior setup operations;
- migration required;
- explicit request to create a separate new Ember.

Default rerun behavior must preserve valid state.

Destructive actions such as replacing canonical state, creating a new lineage in the same
location, removing an integration, or overwriting configuration require explicit
consequential confirmation and must not be hidden behind "start setup again".

## Failure, cancellation, and partial completion

Setup must tell the truth about what happened.

A setup step has more states than success/failure when external effects are possible.

At minimum the implementation must distinguish where relevant:

- not attempted;
- requested;
- succeeded and verified;
- failed before known effect;
- failed after a possible or known partial effect;
- cancellation requested;
- cancellation observed before effect;
- cancellation outcome uncertain;
- succeeded but later verification is unavailable.

Cancellation is an intent, not proof that work stopped or effects rolled back.

For example:

- if provider authentication opens an external browser and setup is cancelled, credentials
  may or may not have been granted;
- if a systemd unit is written but enablement fails, the file may still exist;
- if a Telegram token was stored successfully but bot verification times out, token storage
  and bot reachability have different truths;
- if state migration writes a new candidate representation and final activation fails, the
  source and candidate must not be conflated.

Retries must consult surviving evidence and must not blindly repeat consequential actions
whose outcome is uncertain.

Canonical Ember state already committed before a later setup failure remains canonical.
Setup failure is not permission to roll back unrelated learned meaning or pretend the
conversation did not occur.

## Restart and resume

Setup and onboarding must survive process restart without pretending an interrupted
process kept running.

After restart:

1. deterministic setup reconstructs machine-local progress from durable operational
   evidence;
2. canonical Ember state is loaded independently;
3. incomplete consequential operations are reconciled before retry;
4. temporary onboarding work may be resumed only if it remains current;
5. ordinary conversation may continue even if optional onboarding topics remain unfinished.

A restart must not:

- recreate a new Ember because an onboarding session disappeared;
- replay every old onboarding question;
- mark every previously requested operation failed solely because the process ended;
- retry a side-effecting step whose previous outcome is uncertain;
- promote stale setup progress markers over current canonical or host truth.

## Integration setup

Optional integrations such as Telegram are extensions of the same boundary.

Ember may conversationally offer them when useful. The user may decline or defer without
blocking normal use.

Integration setup should be composed from rerunnable verified host operations rather than
a giant monolithic wizard.

For Telegram specifically, the later task #255 should preserve the existing surface
semantics and secret-safe configuration described by
[Telegram Surface Runbook](telegram-surface-runbook.md). Onboarding may make that setup
friendlier; it must not redefine Telegram as the owner of identity, memory, or continuity.

## Implementation invariants for #253–#256

The remaining epic tasks should preserve these invariants.

### Host/bootstrap invariants

1. Machine provisioning and canonical Ember continuity remain separate.
2. Restore/create is explicit; absence/presence of a directory does not silently decide it.
3. Cognition is verified before model-led onboarding depends on it.
4. Re-running setup is idempotent where possible and inspect-before-mutate everywhere.
5. Consequential mutations are typed host operations with structured results.
6. Secret values do not enter ordinary cognition context.
7. Operational progress is truthful about uncertainty and partial effects.

### Ember/onboarding invariants

8. Onboarding is ordinary Ember conversation with temporary purpose, not a privileged
   semantic subsystem.
9. Onboarding never writes durable user/self/relationship facts directly into canonical
   state.
10. Durable learned meaning uses the same memory proposal/adoption/correction path as
    ordinary later conversation.
11. Skip, defer, resume, partial completion, re-run, and topic interruption are normal.
12. No completion percentage or wizard state defines whether Ember is a legitimate Ember.
13. Optional integrations do not block ordinary Ember operation.

### Restore/recovery invariants

14. Restoring bytes is not treated as proof that lineage ambiguity is solved.
15. Migration preserves semantic provenance/currentness rather than rewriting history.
16. Restart reconstructs the strongest justified present instead of replaying setup.
17. Cancellation request is distinct from observed stop and rollback.
18. Unknown side effects block unsafe blind retry.
19. Already committed canonical Ember state is not rolled back merely because a later
    setup step failed.

## Expected implementation shape

This contract does not require one state machine, but a likely implementation will expose
three cooperating layers:

```text
trusted setup host
  ├─ preflight / provider verification / secret entry / typed mutations
  ├─ durable machine-local setup evidence
  └─ restore/create handoff
                 ↓
        Ember semantic runtime
  ├─ canonical continuity + memory
  ├─ temporary/deferred onboarding work
  └─ ordinary conversation
                 ↓
       optional integrations
  └─ typed host/surface setup operations
```

A CLI may orchestrate all three from one command while preserving the ownership boundaries
internally.

## Concrete acceptance scenarios

### Fresh machine, restore existing Ember

The machine has no Ember installation state. The user selects restore, authenticates a
provider through host-owned flow, provider verification succeeds, canonical state is
restored and validated, and Ember resumes conversation.

Expected: no new lineage is created merely because the machine is new.

### Fresh machine, create new Ember

The machine is prepared and provider verification succeeds. The user intentionally creates
a new Ember. Minimal continuity state is initialized, then Ember begins ordinary
conversation and progressively learns useful context through the normal memory pipeline.

Expected: installer defaults do not masquerade as remembered biography or relationship.

### Existing configured machine, rerun setup

Setup discovers healthy Ember state, working provider configuration, and an optional
missing Telegram integration.

Expected: existing Ember remains untouched; setup offers only relevant reconciliation or
optional additions.

### Interrupted integration setup

A Telegram token is securely stored, but bot verification times out and the process exits.

Expected: restart discovers that credential storage may have succeeded, re-verifies before
asking for a new token, and does not claim Telegram is configured until the relevant
checks succeed.

### Onboarding deferred

Ember asks whether the user wants to discuss preferences and projects. The user declines
for now and starts an unrelated conversation.

Expected: normal Ember operation continues. A future invitation may occur only if the
topic remains useful/current; no rigid wizard resumes automatically on every launch.

### Restore ambiguity

The user points setup at an old backup while another newer Ember state may exist.

Expected: setup can validate/import the snapshot mechanically but must not claim that the
backup unquestionably replaces newer continuity. The ambiguity is surfaced rather than
erased.

## Implemented machine bootstrap (#253)

`node bin/ember.ts setup` (or `ember setup` after linking the package) inspects the
machine without selecting an intent, invoking cognition, or writing files. It reports
configuration presence, whether the selected continuity store loads, and the last probe
and continuity-operation results. Corrupt/unreadable state fails visibly rather than
being classified as a clean installation. Setup never scans arbitrary directories for
other lineages: use `--state PATH` to inspect or attach an existing local store.

Ember intentionally uses one discoverable application home with distinct responsibilities:

```text
~/.ember/
├── config/setup.json       # machine-local configuration and setup evidence
└── state/continuity.json   # canonical continuity, with operational sidecars alongside
```

This keeps the local installation together for inspection, backup, and movement while
preserving the semantic configuration/state boundary. XDG variables do not affect these
defaults. `--config PATH` and `--state PATH` override their respective locations
independently: moving the configuration does not relocate the default state. A selected
existing setup record retains its recorded state binding unless an identical `--state`
is supplied; a different binding is rejected. Paths remain host-local references, never
lineage keys or model-visible setup context. Moving a whole installation still requires
explicit attachment at its new location because stored bindings are absolute paths;
setup does not infer continuity or rewrite a binding from copied directories.

Setup and both run modes use the single typed CLI grammar in `Commands`/`CommandSpecs`.
`parseArgs()` produces `SetupArgs` or `RunArgs` with an explicit `mode` discriminator,
and ordinary dispatch passes typed arguments to the handlers. All command forms use
the same unknown-option, duplicate-option, positional, and required-value validation.

Choose an intent explicitly:

```sh
# Create only after a successful real provider probe.
ember setup --intent create-new --principal user-1 --provider codex

# Attach previously restored local state, keeping its accompanying sidecars in place.
ember setup --intent restore-existing --state /data/restored/continuity.json \
  --provider cursor --accept-continuity-risk

# Reverify the existing binding/provider, preserving canonical bytes.
ember setup --intent use-existing

# Configure a separate lineage without replacing an existing setup binding.
ember setup --config /data/new-host/setup.json --state /data/new-agent/continuity.json \
  --intent create-new --principal user-1 --provider claude-code
```

Restore currently means **attachment**, not archive extraction, copying one JSON file,
automatic relocation of operational sidecars, or general historical migration. Place
the intended local store and its operational sidecars together before attachment.
The existing `StateStore.load` validation and supported in-memory legacy identity
normalization establish structural/loadability facts; setup does not rewrite the source.
`--accept-continuity-risk` explicitly acknowledges intended continuation despite
unresolved snapshot age, missing history, or forks. It is host-local evidence of the
operator's choice, not a canonical claim that ambiguity has disappeared. `use-existing`
can also attach a loadable, already-local store without claiming an import occurred.

### Provider configuration and real verification

Setup supports the production `codex`, `cursor`, and `claude-code` adapters. There is no
implicit provider default. `--model MODEL` selects a model; `--provider-command PATH`
selects an installed Codex/Cursor executable. Claude Code uses its adopted SDK adapter
and does not accept an executable override. Model and executable selection stay in the
machine record. Arbitrary shell commands, passthrough arguments, keys, or tokens are
not setup options.

Authenticate through the provider-owned flow first: Codex's login, Cursor's browser
login, or `claude auth login`. Ember neither launches nor mediates those login flows
in this slice, and never reads/copies their credentials. Provider-specific isolation and
authentication limits remain those documented in the
[continuity runbook](minimal-continuity-runbook.md) and
[Claude Code adapter contract](claude-code-ai-sdk-provider.md). In particular, setup's
Codex path uses the adapter's default credential route; specialized auth passthrough
remains available only through the existing explicit low-level CLI.

Each mutating setup invocation makes one real, non-retried invocation through the selected
production adapter. The request uses a disposable synthetic in-memory lineage/runtime,
no user meaning, no canonical lineage or principal, and no host paths or credentials.
The response must pass `ProviderResult` validation with an empty permitted meaning set.
Provider reply, external session identifiers, and raw error diagnostics are discarded.
Setup records only normalized probe outcomes. Failure instructions direct the operator
to check provider-owned authentication and retry or explicitly select another provider.

`--provider-timeout-seconds` defaults to 60 and must be positive and at most 120.
Existing adapter timeout, output bounds, isolation, and cancellation handling apply.
Verification proves that invocation worked at that time; it does not prove future
availability, model quality, continuity, or authority for unrelated actions.

### Continuity and conversational handoff

After verification, `create-new` persists only the reviewed `initialState` bootstrap.
The selected lineage ID and establishment time are recorded as pending machine-local
intent first so a retry does not generate a different candidate. No name, biography,
relationship, learned memory, probe reply, or probe cognition episode is adopted.

Setup prints `ember` for the default configuration, or a command of the form below
when `--config` selects another setup record:

```sh
ember run --config /path/to/setup.json --scope relationship:user-1
```

Configured `run` requires a successful recorded verification and available continuity,
reloads the state, checks its principal/lineage binding, and then uses the ordinary CLI
conversation surface. It uses the exact configured provider/model/timeout; provider
overrides cannot be mixed into this invocation. The explicit config selects the locally
asserted principal. The original explicit `run --state ...` interface remains available.
Plain `ember` reads the default setup record and selects `relationship:<principal>` as
its conversation scope. When that record is absent, the CLI asks the operator to
choose create-new or restore-existing, identify the local principal or existing
state path, and select a provider. Restore also requires explicit acknowledgement
of continuity uncertainty. Application bootstrap performs the same provider probe,
binding, and activation used by explicit `ember setup`, then hands the first real
input to ordinary application conversation. It does not invent a greeting or user
turn. Later invocations use the same application composition and interaction
lifecycle, continuing the persisted conversation after process exit without a setup
wizard. Incomplete or corrupt existing setup remains an explicit recovery error.
`app/bootstrap.ts` owns the machine operation; `surfaces/cli/setup.ts` owns the
operator prompts and handoff. The explicit setup command remains available.
Conversational onboarding and memory formation reuse the #254/#220 ordinary path;
machine setup does not claim completion of that journey.

### Rerun, interruption, and recovery

Setup never overwrites existing canonical state. A recorded binding cannot silently be
retargeted to a different state path, principal, or lineage. To create another lineage,
choose separate configuration and state paths. Provider changes require
`--confirm-provider-change`, invalidate the previous verification, and make a fresh probe.
Repeating the recorded intent or choosing `use-existing` re-verifies without rewriting
canonical continuity. Failed re-verification leaves continuity intact and blocks the
configured conversation handoff until another successful setup.

The machine record uses durable replacement with mode `0600` and a cooperative setup
lease at `<config>.lock`. Canonical initialization uses the existing state-store lease
and refuses an occupied destination. Config/state alias and sidecar collisions are
rejected. Resolved config and state paths must be bounded non-empty absolute paths without
ASCII control characters, using the same invariant before persistence and when loading
the machine record. Setup leases use the existing `lock-status` / `quarantine-stale-lock` tools
with `--state` pointing to the **setup record**, including the existing explicit
quiescence/token checks; there is no automatic stale-lock removal.

Probe results distinguish `not_attempted`, `requested`, `verified`, `failed`, `timed_out`,
`cancellation_requested`, and `outcome_unknown`. Continuity operations separately track
`pending`, `requested`, `available`, and `outcome_unknown`. `cancellationRequested`
records observed SIGINT/SIGTERM or caller cancellation independently of successful
effects. Every awaited setup-record write reconciles cancellation observed during that
write before setup makes the next transition or returns. Cancellation observed while
persisting a pre-effect continuity request restores `pending` (or the already `available`
state on a rerun) and returns before activation. Cancellation observed during the final
availability write is persisted while already committed continuity stays available.
Neither cancellation nor timeout proves remote rollback. Hard termination may
leave `requested` and a lock; inspection reports that surviving evidence without
claiming failure or completion.

An interrupted probe can be explicitly retried: it has no canonical or integration
mutation authority. An interrupted state creation is reconciled against the surviving
store and intended lineage before any retry. A matching loadable store can continue;
a missing store after a possibly executed or previously available creation is **not**
recreated automatically. Restore the intended state or inspect/recover it explicitly.
If activation/replacement is uncertain, the record remains inspectable and no readiness
message is emitted. Already committed continuity is never rolled back by setup.

Configured conversation validates the principal, lineage ID, and lineage establishment
time together after acquiring the canonical state write lease and before starting a
runtime episode. The setup handoff does not rely on an earlier unlocked state read.

`tests/setup.test.ts` covers fresh/configured inspection, all provider selections,
restore attachment, reruns, failure/timeout/cancellation, malformed results, concurrent
setup, activation races, path aliases, and real CLI subprocess handoffs using deterministic
Codex/Cursor executables. Live provider authentication remains opt-in; it is not required
by the deterministic acceptance gate.

## Non-goals

Issue #252 does not decide:

- the exact `ember setup` command syntax;
- the physical config/state directory layout;
- the concrete typed host-operation API;
- which provider should be the default;
- how every possible fork/restore identity dispute is resolved;
- the exact onboarding prompt or question order;
- a generic plugin framework;
- a new secrets manager;
- a mandatory always-resident setup daemon;
- a parallel onboarding database.

Those belong to later implementation work or remain deliberately open until evidence
earns a stronger decision.

## Implemented progressive onboarding (#254)

Creating a new lineage after verified cognition now creates
`<continuity-state-path>.onboarding.json`. This sidecar is temporary semantic work bound
to the lineage, principal, and relationship scope. Other scopes neither receive nor
advance that work, preventing onboarding-derived meaning from being adopted into an
unrelated scope. It records the small initial topic set—forms of address,
expectations, and optional capabilities—with distinct `open`, `deferred`, `declined`,
and `resolved` states. A closed record remains as operational evidence so a later setup
rerun or process restart does not treat the lineage as newborn. Setup first records
`pending_activation`, then activates the work only after the intended lineage is loadable
and matches the setup binding. A restart can reconcile that boundary without recreating
canonical state or inventing onboarding for another lineage. Restore-existing and
use-existing never synthesize this record merely because it is absent locally.

Active work is projected only into an ordinary provider request in its bound scope beside bounded conversation
context. The projection directs Ember to handle the user's current request first, make
at most one useful invitation, respect deferred or declined topics, and never request
reusable secrets. It does not introduce a separate onboarding cognition purpose or
provider session. Onboarding begins with the first ordinary user turn; startup does not
fabricate a user message or force cognition merely to emit an introductory prompt. A
separate bounded progress evaluation returns a versioned typed
decision over the current input and projected work. Ember validates its exact shape,
topic uniqueness, supported actions, an exact supporting span from the current user input,
and legal lifecycle transitions before advancing,
deferring, resuming, declining, resolving, or closing work using the durable user-command
evidence from the same ordinary cognition episode. Provider reply text has no authority
to mutate progress. Evaluation failure leaves the prior work unchanged and is reported
separately from the successful ordinary reply. Real-work input yields no progress updates,
leaves progress open, and does not block the work.

Configured conversation also creates a bounded reflection adapter over the configured
cognition provider. After an ordinary exchange is durable, the adapter asks for the
existing versioned memory-candidate structure using only the ordinary conversation
memory projection. Its output still passes through `assessMemoryProposal` and
`resolveMemoryProposal`; malformed output is an inspectable memory-generation failure,
and no onboarding code writes canonical meaning directly. Closing onboarding removes
the work from later cognition projections while adopted canonical meaning and its
ordinary provenance remain available.

Configured CLI conversation supplies both bounded evaluators automatically only while
onboarding is active. The CLI re-reads that work before every ordinary turn, so closure
stops automatic reflection immediately rather than only after process restart. Fresh
setup prints a runnable handoff using the bound `relationship:<principal>` scope instead
of a placeholder scope that would bypass onboarding. The Telegram surface applies the same gating with its configured
provider and exposes progress/reflection failures in its update outcome, so a surface or
provider change does not create a second onboarding lifecycle or hide a failed background
decision. Explicit lower-level callers may inject
deterministic evaluators for testing while core transition validation remains unchanged.

## Implemented guided Telegram setup (#255)

Configured local CLI conversation intercepts only the literal `:setup telegram` command.
Because the idle CLI holds neither a canonical writer lease nor an open runtime episode, the
command enters the Telegram trusted-host wizard without inventing a cognition/runtime boundary.
It is neither provider input nor an ordinary interaction occurrence. After completion,
cancellation, or a recoverable failure, the CLI resumes its input loop over the same configured
principal, scope, continuity binding, and conversation sidecar. CLI and Telegram interactions
each reload current state and create one lease-bounded runtime episode for their actual work,
preserving the sequential recovery model.

The wizard owns masked BotFather-token entry, mode-`0600` storage, bot/webhook preflight,
short-code private-chat discovery, explicit mapping confirmation, configuration/unit drift
confirmation, exact-argument `systemctl --user` calls, and ledger-correlated round-trip
observation. It derives principal, state path, provider, and scope from the verified setup
binding. Its per-stage result keeps storage, preflight, mapping, rendering, installation,
activation, and bounded polling for correlated delivery truth separate. Provider executables
for Codex and Cursor are resolved through `PATH` without a shell; Claude Code retains its
SDK-owned runtime representation. The worker entrypoint and working directory come from the
installed package location rather than the caller's current directory. An already-active
Telegram worker is explicitly stopped before mapping discovery and restarted after changed
configuration or unit files are installed, preventing competing long polls and stale process
configuration. Mapping discovery polls for a bounded interval without advancing Telegram's
acknowledgement offset, so an earlier pending message such as `/start` cannot cause immediate
failure and is not silently consumed by setup. Declining final service activation leaves a
previously active worker stopped and returns truthful `configured_inactive` state.

The guided flow writes Telegram surface configuration version 2 with a structured provider
block. The Telegram loader continues to accept and normalize version 1, including its
explicit process-provider representation. Neither representation stores the bot token.

## Implemented validation (#256)

The [setup and onboarding end-to-end validation](setup-onboarding-validation.md) exercises
fresh creation, restoration, progressive onboarding, provider replacement, guided
Telegram setup, restart recovery, provenance, and secret containment through production
boundaries. It emits a sanitized version-1 report for future scorecard aggregation and
keeps real-provider and real-Telegram operation as a separate opt-in clean-host smoke.

The implementation may refine representations, but any representation that violates the
ownership and truthfulness boundaries above requires an explicit architecture change
rather than being treated as a harmless setup detail.
