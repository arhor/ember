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
> systemd processes, units, timers, and the user manager are operational loci only.
> Canonical continuity and work truth remain Ember-owned durable evidence.

## Runtime shape

The first unattended topology keeps **no permanently resident Ember Node process**:

```text
systemd --user
├── ember-reconcile.service               short-lived startup/recovery worker
├── ember-wake-<wake-id>.timer             one-shot activation
│   └── ember-wake-<wake-id>.service       one topic-free opportunity worker
└── ember-specialist-<episode-id>.service  one specialist episode worker
    └── Codex child
```

The repository command is:

```bash
npm run runtime:episodic -- <command> ...
```

It dispatches to `bin/ember-runtime.ts`. The generated systemd units call that Node
entry point directly using the absolute paths from runtime configuration. The ordinary
`ember` command remains the interactive continuity surface.

## Supported boundary

The first unattended deployment assumes:

- Linux with a functioning systemd user manager;
- Node.js in ADR 0006's supported Node 26 line;
- one local OS user/principal;
- local canonical/runtime storage;
- an existing Codex installation/login when a worker actually needs Codex; and
- explicit absolute executable, state, record, and config paths.

Normal repository tests require neither systemd nor a live Codex login. Non-systemd
Linux, macOS, Windows, multi-host operation, and distributed coordination remain out
of scope for this implementation.

## Operational records

`records_directory` holds append-only facts independently of canonical Ember state:

```text
runtime-records/
├── wakes/<wake-id>/
│   ├── intent.json
│   ├── dispatching.json
│   ├── completed.json
│   └── failed.json
└── specialists/<episode-id>/
    ├── spec.json
    ├── launch_attempted.json
    ├── launch_accepted.json | launch_failed.json
    ├── worker_started.json
    ├── episode.json
    └── worker_completed.json | worker_failed.json
```

Intent/specification is persisted **before** the supervisor is asked to launch work.
Later observations use exclusive creation rather than rewriting earlier facts. Runtime
records are mode `0600` and are validated again when read.

The crash boundaries are intentionally visible:

- a wake with no `dispatching.json` has not established its opportunity and may be
  safely re-armed;
- `dispatching.json` without a terminal observation is ambiguous and is never replayed
  automatically;
- a nonterminal specialist record whose service disappeared is classified through the
  specialist process-loss path, preserving possible effects and prohibiting blind
  retry; and
- process/service state never upgrades semantic confidence by itself.

## Configuration

Keep runtime configuration outside the repository, owned by the local Ember user.
It contains no provider token and points at the already authenticated runtime.

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

Useful discovery commands on the target host:

```bash
command -v node
command -v codex
command -v systemd-run
command -v systemctl
realpath bin/ember-runtime.ts
```

All configured paths and the config path itself must be safe absolute paths. Service
execution must not depend on an interactive shell's `PATH`, aliases, working directory,
or initialization files.

Do not commit API keys, bearer tokens, private prompts/context, chat identifiers, or
machine-specific credentials. Subscription-backed Codex authentication remains owned
by Codex and is merely reachable to the same configured OS user.

## Initialize canonical state

Use the ordinary CLI once if the configured state does not yet exist:

```bash
ember init \
  --state /ABSOLUTE/PATH/ember.json \
  --name Ember \
  --principal local-user
```

The runtime config principal must match the state's local principal.

## Keep the user manager available

ADR 0007 selects a user-level supervisor. Where the distribution would otherwise stop
the user manager after logout, enable lingering through the host's normal
administrative procedure. A common systemd command is:

```bash
loginctl enable-linger "$USER"
```

This grants host capability only. It is not Ember authority.

## Install startup reconciliation

```bash
npm run runtime:episodic -- install \
  --config /ABSOLUTE/PATH/ember-runtime.json \
  --unit-directory "$HOME/.config/systemd/user"
```

This writes/enables `ember-reconcile.service`. It is `Type=oneshot` with `Restart=no`
and runs one bounded reconciliation pass when the user manager starts.

Reconciliation repairs activation only where durable evidence says work has not begun.
It does not create cognition merely because a host restarted and does not replay a
failed work-bearing process.

## Schedule one unattended opportunity

```bash
npm run runtime:episodic -- schedule-wake \
  --config /ABSOLUTE/PATH/ember-runtime.json \
  --at 2026-09-04T18:00:00Z
```

A future timestamp creates a one-shot systemd timer. A timestamp already due is
started as one immediate one-shot worker rather than creating a timer in the past.
Startup reconciliation applies the same rule after downtime.

The wake uses `external_timing` only as an opportunity mechanism. When the worker
starts, it builds the normal fresh bounded projection from canonical state. The timer
supplies no topic, motive, conclusion, or authority.

There is no default repeating cadence and no `Persistent=true` catch-up policy.

## Start one specialist episode

Given an already authored `SpecialistEpisodeSpec` JSON file:

```bash
npm run runtime:episodic -- start-specialist \
  --config /ABSOLUTE/PATH/ember-runtime.json \
  --spec /ABSOLUTE/PATH/specialist-spec.json
```

One transient user service is created with:

- `Type=exec`;
- `Restart=no`;
- `KillMode=mixed`; and
- configured `TimeoutStopSec`.

The spec is persisted before service launch. `Restart=no` is a semantic safety
boundary: process restart is not specialist retry. A crash after possible effects is
reconciled from durable specialist evidence rather than replayed by systemd.

## Status

```bash
npm run runtime:episodic -- status \
  --config /ABSOLUTE/PATH/ember-runtime.json
```

Status joins two evidence classes instead of conflating them:

1. durable wake/specialist lifecycle records, including wake decision/evaluator failure
   where established; and
2. current systemd timer/service observation.

An active service does not prove an objective is current or effects are safe. A durable
`running` observation does not prove a process still exists.

Canonical and lock inspection remain ordinary CLI operations:

```bash
ember inspect --state /ABSOLUTE/PATH/ember.json --principal local-user
ember check --state /ABSOLUTE/PATH/ember.json
ember lock-status --state /ABSOLUTE/PATH/ember.json
```

## Clean stop and cancellation

Request stop of one specialist worker through its supervisor:

```bash
systemctl --user stop ember-specialist-<episode-id>.service
```

`KillMode=mixed` sends the initial termination signal to the main Ember worker. The
Node entry point converts `SIGTERM`/`SIGINT` into the abort signal used by the existing
specialist boundary, allowing cancellation intent to be persisted before bounded child
termination when execution reaches that path. After `TimeoutStopSec`, systemd may
forcibly clean remaining local unit processes.

An empty cgroup still does not prove remote effects were absent or rolled back. If
forced termination wins the race, recovery preserves the resulting gap.

## Writer locking

The runtime preserves the existing `StateStore` cooperative writer boundary. systemd
launch does not bypass the lock.

In this first implementation a wake owns the writer lease across its bounded
opportunity evaluator call because the current `runCognitionOpportunity` lifecycle
requires the cooperating lease for its before/after commits. A foreground `ember run`
session can therefore contend with a background wake. Contention fails closed.

Do not delete a lock merely because it is old. Use the existing lock-status and
explicit quiescence recovery procedure.

Shorter wake lease windows remain a possible future refinement only if currentness can
be preserved correctly across the external wait.

## Manual reconciliation

```bash
npm run runtime:episodic -- reconcile \
  --config /ABSOLUTE/PATH/ember-runtime.json
```

A pending future wake whose transient timer disappeared is re-armed. A pending wake
whose due time passed is dispatched at most once from the same durable identity when
no worker is observed. A wake that already crossed `dispatching` is preserved as
ambiguous rather than replayed. A vanished nonterminal specialist is recorded lost
through the existing specialist recovery semantics.

## Logs

systemd captures worker stdout/stderr in the user journal:

```bash
journalctl --user -u ember-reconcile.service
journalctl --user -u ember-wake-<wake-id>.service
journalctl --user -u ember-specialist-<episode-id>.service
```

Keep worker output bounded and diagnostic. Do not add raw private projections,
credentials, unrestricted prompts, or user secrets merely because journald is
available.

## Deterministic repository validation

```bash
npm run check
npm test
npm run test:docs
node scripts/docs-discovery.mjs check
```

Runtime tests inject a fake supervisor and deterministic evaluator. They verify
persist-before-launch ordering, one-shot and already-due wake activation, duplicate
work protection, `Restart=no`, specialist kill policy, startup repair, record-path
validation, clean wake lifecycle, and joined status. No normal test requires systemd,
lingering, root, or live provider authentication.

## Reproducible Linux/systemd smoke

Run OS validation separately on a disposable or representative Linux user session.
It tests the real host boundary rather than weakening deterministic tests with ambient
systemd assumptions.

1. Verify the host:

   ```bash
   systemctl --user --version
   systemctl --user status >/dev/null
   node --version
   ```

2. Initialize disposable canonical state and create a private config with absolute
   paths.

3. Install reconciliation and inspect it:

   ```bash
   npm run runtime:episodic -- install \
     --config /ABSOLUTE/PATH/ember-runtime.json \
     --unit-directory "$HOME/.config/systemd/user"
   systemctl --user status ember-reconcile.service
   ```

4. Schedule a wake several minutes ahead, then inspect both layers:

   ```bash
   npm run runtime:episodic -- schedule-wake \
     --config /ABSOLUTE/PATH/ember-runtime.json \
     --at <RFC3339-UTC-TIME>
   systemctl --user list-timers 'ember-wake-*'
   npm run runtime:episodic -- status \
     --config /ABSOLUTE/PATH/ember-runtime.json
   ```

5. For a **live Codex smoke only**, confirm the same OS user can run its existing Codex
   subscription login. After activation, verify exactly one durable opportunity and
   one terminal wake observation. The model's discretionary decision is not itself a
   deterministic assertion.

6. For restart/crash semantics, follow issue #83 scenarios. At minimum verify that
   removing a pending transient timer or restarting the user manager, followed by
   reconciliation, preserves one durable wake identity rather than multiplying
   occurrences.

Record Node/systemd versions, commands, unit states, and opaque runtime IDs. Do not
commit host paths, credentials, or journal excerpts containing private content.

## Handoff to #82 and #83

Issue #82 can measure three distinct resource classes:

1. no resident Ember Node process while idle;
2. one bounded wake/reconciliation Node worker; and
3. one specialist Ember worker plus its Codex process tree.

Issue #83 can validate recovery at the explicit durable boundaries: before wake
dispatch, after dispatch before terminal observation, before specialist launch, during
specialist work, during bounded shutdown, after forced process/host loss, and under
writer contention.

Those tasks should use the runtime records plus `status`/`reconcile` rather than
building a second semantic recovery model around systemd state.
