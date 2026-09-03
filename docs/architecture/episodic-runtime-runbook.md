---
summary: "Installation, operation, status, shutdown, restart, and systemd smoke procedure for Ember's first episodic unattended runtime implementation under ADR 0007."
read_when:
  - "Installing or operating Ember's systemd-supervised episodic runtime on Linux"
  - "Running issue #82 resource measurements or issue #83 restart/recovery validation"
  - "Diagnosing an unattended wake, specialist worker, user-manager restart, or runtime lock failure"
role: guide
discovery_status: current
---

# Episodic Runtime Runbook

> Status: current implementation runbook for issue #94 and ADR 0007.
>
> This runbook describes the first unattended Linux deployment. It does not make a
> systemd process, unit, timer, or user manager part of Ember identity. Canonical
> continuity and operational work truth remain durable Ember-owned evidence.

## What this runtime is

The first unattended topology keeps **no permanently resident Ember Node process**.
A lingered `systemd --user` manager supplies host supervision while Ember executes as
bounded foreground workers:

```text
systemd --user
├── ember-reconcile.service               short-lived startup/recovery worker
├── ember-wake-<wake-id>.timer             one-shot activation
│   └── ember-wake-<wake-id>.service       one topic-free opportunity worker
└── ember-specialist-<episode-id>.service  one specialist episode worker
    └── Codex child
```

The repository-supported runtime entry point is `ember-runtime` (`bin/ember-runtime.ts`).
The existing `ember` CLI remains the interactive continuity surface. The two commands
share Ember core semantics and storage boundaries; neither command owns Ember identity.

## Supported deployment boundary

The first unattended deployment assumes:

- Linux with a functioning systemd user manager;
- Node.js in ADR 0006's supported Node 26 line;
- a single local OS user/principal;
- a local filesystem for canonical and runtime records;
- an existing Codex installation/login when live unattended opportunity or specialist
  work actually invokes Codex; and
- absolute executable/state/config paths supplied explicitly by the operator.

macOS, Windows, non-systemd Linux, containers without a user manager, multi-user
coordination, and multi-host execution remain outside this contract.

Normal repository tests do **not** require systemd, lingering, root privileges, or a
live Codex login. They use an injected supervisor boundary and deterministic evaluator
where appropriate.

## Runtime records

The implementation keeps operational runtime records separately from canonical Ember
state. Given `records_directory`, the shape is:

```text
runtime-records/
├── wakes/
│   └── <wake-id>/
│       ├── intent.json
│       ├── dispatching.json       when the Ember occurrence has actually begun
│       ├── completed.json         terminal success/evaluator outcome
│       └── failed.json            terminal worker failure after dispatch began
└── specialists/
    └── <episode-id>/
        ├── spec.json
        ├── launch_attempted.json
        ├── launch_accepted.json   or launch_failed.json
        ├── worker_started.json
        ├── episode.json           existing specialist lifecycle/effect record
        └── worker_completed.json  or worker_failed.json
```

These files are append-only facts for one runtime occurrence. They are written with
exclusive creation and mode `0600`. An intent/specification is persisted **before**
the supervisor is asked to launch work. Later observations do not rewrite the earlier
fact.

This deliberately leaves crash gaps visible. For example:

- an intent with no `dispatching.json` may be safely re-armed after its timer unit is
  lost because no Ember opportunity has been established;
- `dispatching.json` without a terminal observation is ambiguous and is not replayed
  automatically; and
- a specialist `episode.json` that says work was nonterminal while its unit has
  disappeared is reconciled through the existing specialist process-loss semantics,
  preserving possible effects and prohibiting blind retry.

Runtime records are operational evidence. A systemd unit state and these records must
still be interpreted together with canonical Ember state where currentness matters.

## Configuration

Keep runtime configuration outside the repository, owned by the local Ember user and
readable only as narrowly as practical. The configuration contains no provider token;
it only points workers at the already authenticated runtime.

Example shape:

```json
{
  "config_version": 1,
  "state_path": "/ABSOLUTE/PATH/ember.json",
  "records_directory": "/ABSOLUTE/PATH/runtime-records",
  "principal": "local-user",
  "active_scope": "project:ember",
  "node_path": "/ABSOLUTE/PATH/node",
  "runtime_entrypoint": "/ABSOLUTE/PATH/ember/bin/ember-runtime.ts",
  "codex_command": "/ABSOLUTE/PATH/codex",
  "codex_arguments": [],
  "opportunity_timeout_seconds": 60,
  "systemd_run_command": "/usr/bin/systemd-run",
  "systemctl_command": "/usr/bin/systemctl",
  "stop_timeout_seconds": 30
}
```

Resolve executable paths deliberately rather than relying on an interactive shell's
aliases or initialization. On a representative host, commands such as these are useful
for constructing the file:

```bash
command -v node
command -v codex
command -v systemd-run
command -v systemctl
realpath bin/ember-runtime.ts
```

`node_path`, `runtime_entrypoint`, `codex_command`, `systemd_run_command`,
`systemctl_command`, `state_path`, `records_directory`, and the config path itself must
be absolute. This is intentional: a service-manager environment must not silently
depend on the current shell's `PATH` or working directory.

Do not place API keys, bearer tokens, raw prompts, chat identifiers, private context,
or machine-specific credentials in committed configuration. Subscription-backed Codex
credentials remain owned by Codex and are merely reachable by the same OS user when
that host capability is deliberately configured.

## Initialize canonical state

The unattended runtime uses the same canonical continuity state as the foreground CLI.
Initialize it once with the ordinary command if it does not already exist:

```bash
ember init \
  --state /ABSOLUTE/PATH/ember.json \
  --name Ember \
  --principal local-user
```

The runtime config principal must match the state's `runtime_contract.local_principal`.

## Enable the user manager across logout

ADR 0007 selects a user-level supervisor. On hosts where the user manager would
otherwise disappear after logout, enable lingering for the Ember OS account using the
host's normal administrative procedure. A common systemd command is:

```bash
loginctl enable-linger "$USER"
```

This is a host operation, not an Ember authority grant. Verify local distribution
policy before enabling it on a shared machine.

## Install startup reconciliation

Choose the user's systemd unit directory and install the repository-generated
reconciliation unit:

```bash
ember-runtime install \
  --config /ABSOLUTE/PATH/ember-runtime.json \
  --unit-directory "$HOME/.config/systemd/user"
```

The command writes `ember-reconcile.service`, runs `systemctl --user daemon-reload`,
and enables/starts the unit. The installed unit is `Type=oneshot` with `Restart=no`.
It runs one bounded reconciliation pass whenever the user manager starts.

Reconciliation does **not** create cognition merely because a process or host restarted.
Its job is operational repair and classification:

- restore missing activation for still-pending wake intents;
- leave a wake that already crossed its durable dispatch boundary ambiguous rather than
  replaying it;
- observe vanished nonterminal specialist units as process loss;
- preserve possible effects and retry prohibition through the specialist record; and
- report degradation instead of converting supervisor state into semantic truth.

## Schedule one unattended opportunity

Create a durable one-shot wake intent and corresponding timer:

```bash
ember-runtime schedule-wake \
  --config /ABSOLUTE/PATH/ember-runtime.json \
  --at 2026-09-04T18:00:00Z
```

The command prints the generated wake record, including its opaque `wake_id`.

The timer uses `external_timing` as the opportunity mechanism. The configured time is
activation machinery only. When the worker actually begins, it builds a fresh bounded
projection from current canonical Ember state. The timer contributes no topic,
prompt, conclusion, or new authority.

There is no default repeating cadence and the runtime does not use systemd
`Persistent=true` as missed-thought semantics.

## Start one specialist episode

The runtime accepts an already authored `SpecialistEpisodeSpec` contract and persists
it before asking systemd to start the worker:

```bash
ember-runtime start-specialist \
  --config /ABSOLUTE/PATH/ember-runtime.json \
  --spec /ABSOLUTE/PATH/specialist-spec.json
```

The supervisor starts one transient user service per episode with:

- `Type=exec`;
- `Restart=no`;
- `KillMode=mixed`; and
- `TimeoutStopSec` from runtime configuration.

The service runs `ember-runtime run-specialist --episode-id <id>`. The latter is an
internal worker command but remains directly runnable for deterministic diagnosis.

`Restart=no` is a semantic safety boundary: process restart is not work retry. If a
specialist crashes after possible repository or remote effects, systemd does not replay
the objective. Reconciliation records loss/uncertainty and the existing specialist
recovery model decides what observation is required before any consequential retry.

## Status

Inspect the combined runtime view with:

```bash
ember-runtime status --config /ABSOLUTE/PATH/ember-runtime.json
```

The result deliberately presents both evidence layers:

- durable wake/specialist lifecycle state; and
- current systemd timer/service state.

An `active` unit does not prove a specialist objective is valid or effects are safe.
A durable `running` observation does not prove the corresponding process still exists.
The joined view exists to prevent either layer from being mistaken for the whole truth.

Continue to use the ordinary commands for canonical inspection and lock diagnosis:

```bash
ember inspect --state /ABSOLUTE/PATH/ember.json --principal local-user
ember check --state /ABSOLUTE/PATH/ember.json
ember lock-status --state /ABSOLUTE/PATH/ember.json
```

## Clean stop and cancellation

To request stop of one specialist worker:

```bash
systemctl --user stop ember-specialist-<episode-id>.service
```

`KillMode=mixed` delivers the initial termination signal to the main Ember worker.
The Node entry point converts `SIGTERM`/`SIGINT` into the abort signal used by the
specialist boundary, which can persist cancellation intent before bounded child
termination when execution reaches that path. After `TimeoutStopSec`, systemd may
forcibly clean remaining unit processes.

A stopped/empty cgroup still does not prove remote effects were absent or rolled back.
Use the specialist episode/recovery record to decide whether reconciliation is needed.

Stopping the whole user manager or shutting down the host can interrupt workers before
they record a clean terminal observation. That creates a truthful operational gap;
startup reconciliation does not invent a clean stop.

## Writer lock behavior

The runtime preserves the existing `StateStore` cooperative writer boundary. It never
bypasses a lock merely because systemd launched the worker.

For the first implementation, an unattended wake owns the writer lease across its
bounded opportunity evaluation because the current `runCognitionOpportunity` lifecycle
uses the cooperating lease for its before/after provider commits. This is intentionally
conservative. A foreground `ember run` session already owns the same lease for its
session, so either side may encounter visible contention.

Contention must fail closed. It is not permission for concurrent mutation and it is not
recovered by deleting an old-looking lock. Use the existing lock-status/quarantine
runbook when explicit quiescence can be established.

A shorter lease around only canonical transitions remains a desirable later refinement
if the opportunity lifecycle is redesigned to preserve currentness across the external
wait. It is not achieved by releasing the lease today and hoping no other writer
changes the revision.

## Manual reconciliation

Run the same idempotent recovery pass manually at any time:

```bash
ember-runtime reconcile --config /ABSOLUTE/PATH/ember-runtime.json
```

It is safe to repeat operational repair only where durable evidence proves the work has
not begun. It never uses a process manager failure as permission to repeat cognition or
specialist effects.

## Logs

Systemd captures worker stdout/stderr in the user journal. Inspect a unit when needed:

```bash
journalctl --user -u ember-reconcile.service
journalctl --user -u ember-wake-<wake-id>.service
journalctl --user -u ember-specialist-<episode-id>.service
```

Worker output should stay bounded and diagnostic. Do not add raw private projections,
provider credentials, unrestricted prompts, or user secrets to logs merely because the
journal is convenient.

## Deterministic repository validation

The normal test suite validates the orchestration without requiring systemd or Codex:

```bash
npm test
npm run check
npm run test:docs
node scripts/docs-discovery.mjs check
```

The runtime tests inject a fake supervisor command runner and deterministic opportunity
evaluator. They cover persist-before-launch ordering, one-shot activation properties,
`Restart=no`, specialist kill policy, duplicate-dispatch protection, recovery repair,
clean wake lifecycle, and joined status.

## Reproducible Linux/systemd smoke

Run this separately from normal CI on a disposable or representative Linux user
session. It intentionally tests the OS boundary rather than pretending systemd exists
inside unit tests.

1. Verify the manager and tools:

   ```bash
   systemctl --user --version
   systemctl --user status >/dev/null
   node --version
   ```

2. Initialize a disposable Ember state and create a private runtime config using
   absolute paths.

3. Install reconciliation:

   ```bash
   ember-runtime install \
     --config /ABSOLUTE/PATH/ember-runtime.json \
     --unit-directory "$HOME/.config/systemd/user"
   systemctl --user status ember-reconcile.service
   ```

4. Schedule a wake several minutes in the future and capture its `wake_id`:

   ```bash
   ember-runtime schedule-wake \
     --config /ABSOLUTE/PATH/ember-runtime.json \
     --at <RFC3339-UTC-TIME>
   systemctl --user list-timers 'ember-wake-*'
   ember-runtime status --config /ABSOLUTE/PATH/ember-runtime.json
   ```

5. For a **live Codex smoke only**, leave the timer enabled and verify the same OS user
   can run `codex` with its existing subscription login. After activation, confirm one
   durable opportunity and one terminal wake observation. Do not interpret the model's
   discretionary decision as a deterministic test assertion.

6. For restart/recovery validation, use issue #83's scenarios rather than improvising
   semantic expectations. At minimum verify that a pending timer can be removed or the
   user manager restarted, followed by reconciliation, without multiplying the durable
   wake identity.

7. Remove the disposable state/config/records and generated unit when the smoke is
   complete.

The smoke evidence should record Node/systemd versions, commands executed, unit states,
and runtime record IDs. Do not commit host paths, credentials, or journal excerpts that
contain private content.

## Handoff to #82 and #83

Issue #82 can measure this topology as three distinct resource classes:

1. zero resident Ember Node processes while no worker is active;
2. one bounded wake/reconciliation Node worker; and
3. one specialist Ember worker plus its Codex process tree.

Issue #83 can exercise recovery at the durable boundaries exposed here:

- before wake dispatch;
- after durable wake dispatch but before terminal observation;
- before specialist service acceptance;
- after worker/spec launch with a nonterminal specialist record;
- during `SIGTERM`/bounded shutdown;
- after forced kill or host/user-manager loss; and
- during canonical writer contention.

Those tasks should use the runtime records and `ember-runtime status/reconcile` commands
rather than adding a second recovery model around systemd state.
