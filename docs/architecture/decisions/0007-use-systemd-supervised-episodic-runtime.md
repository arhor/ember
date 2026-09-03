---
summary: "Accepted implementation decision using a systemd user manager to supervise episodic Ember workers and one-shot wake activation on Linux, without a permanently resident Ember daemon."
read_when:
  - "Implementing or reviewing Ember's long-lived runtime topology, unattended wake-up, specialist process ownership, startup, shutdown, or recovery"
  - "Deciding whether Ember needs a resident daemon, systemd units, transient workers, timers, or a runtime IPC/control plane"
  - "Deploying Ember as an always-available local agent on a Linux systemd host"
role: decision
discovery_status: current
---

# ADR 0007: Use a systemd-Supervised Episodic Runtime Before a Resident Ember Daemon

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision class:** Implementation/runtime topology
- **Origin:** [Issue #81](https://github.com/arhor/ember/issues/81)
- **Parent epic:** [Issue #51](https://github.com/arhor/ember/issues/51)
- **Requirements:** [Long-Lived Runtime Requirements](../long-lived-runtime-requirements.md)
- **Semantic baseline:** ADRs [0001](0001-continuity-belongs-to-ember.md) through [0005](0005-distinguish-operational-continuity.md)
- **Implementation baseline:** [ADR 0006](0006-adopt-typescript-on-nodejs-26.md)

## Context

Issue #80 establishes that Ember now needs two capabilities that a purely interactive
foreground CLI cannot cleanly provide:

1. topic-free cognition opportunities must be possible while no CLI is attached; and
2. specialist work must retain an operational owner after the initiating interaction
   disappears.

The same evidence also argues against making a permanent Ember process the answer by
default. Continuity, durable meaning, completed specialist history, inspection,
correction, and silence already survive complete process absence. Issues #79/#95 did
not earn a fixed cognition cadence, a polling loop, or a resident scheduler. The
current secondary-surface roadmap has not yet earned a permanently open transport.

The topology decision therefore needs to add **supervision and wake capability**
without turning process uptime into Ember continuity or paying for a permanent Node
process when no Ember work exists.

## Decision

For Ember's first long-lived deployment, use a **systemd user manager as the
long-lived host supervisor and run Ember itself as supervised episodic foreground
workers**.

The first supported long-lived deployment target is a single-user Linux host with
systemd and Node.js 26. Ember does not daemonize or double-fork. It does not keep a
Node process resident merely to represent continuity or idleness.

The topology is:

```text
Linux host
└── systemd --user manager, started at boot and kept after logout by lingering
    ├── startup/recovery reconciliation (short-lived Ember worker)
    ├── one-shot wake timer -> topic-free opportunity worker
    └── specialist episode service -> bounded Ember specialist worker -> Codex child

Ember canonical state + operational records remain on durable storage independently
of every process and unit above.
```

A systemd unit or manager is an operational locus. Its unit name, PID, cgroup, active
state, restart history, or manager lifetime is never Ember identity, canonical memory,
authority, durable work truth, or proof of external effects.

### Why this is the smallest selected topology

The systemd user manager already supplies the host-level capabilities Ember has now
earned: detached supervised process ownership, process grouping, activation,
one-shot timers, lifecycle signalling, status, and operation after logout. Ember can
therefore add long-lived behavior without implementing its own daemon supervisor,
job manager, IPC server, or generic scheduler.

The cost is a Linux/systemd deployment dependency for unattended operation. The core
Node implementation and explicit foreground commands remain usable independently of
systemd when unattended runtime guarantees are not required.

## Candidate comparison

The comparison uses requirements R1-R12 from issue #80. `Yes` means the option can
satisfy the requirement without introducing a second mechanism that is effectively a
different topology.

| Requirement | Foreground CLI only | Resident Ember service | systemd-supervised episodic workers | Cron/detached jobs |
| --- | --- | --- | --- | --- |
| R1 unattended topic-free opportunity | No | Yes | **Yes** | Partial |
| R2 time may reopen attention without restart policy | No | Yes | **Yes, with explicit one-shot wake intent** | Poor fit; cadence tends to become policy |
| R3 specialist ownership after interaction ends | No | Yes | **Yes, one supervised unit per episode** | Partial; detached process truth is weak |
| R4 persist before consequential transitions | Yes while attached | Yes | **Yes** | Possible but ad hoc |
| R5 reconcile rather than blindly replay | Manual only | Yes | **Yes** | Weak unless another recovery layer is added |
| R6 truthful clean shutdown | Interactive only | Yes | **Yes, per worker/unit** | Weak |
| R7 single-writer/concurrency safety | Yes | Requires coordination with CLI | **Preserves cooperative lease/revision model** | Overlap needs extra locking policy |
| R8 semantic-operational status | Manual state only | Yes | **Yes, durable state plus unit state** | Fragmented |
| R9 explicit config/runtime-owned auth | Yes | Yes | **Yes** | Often inherits shell environment accidentally |
| R10 attributable idle/active resource cost | No long-lived runtime | Permanent Node baseline | **No resident Ember process; workers attributable per unit** | Low idle cost but weak ownership |
| R11 interruption handoff survives process boundaries | No unattended producer | Yes | **Yes, durable handoff before worker exit** | Possible but ad hoc |
| R12 explicit first platform/supervisor scope | Portable but insufficient | Requires a supervisor choice anyway | **Linux/systemd explicitly selected** | Tool/distribution dependent |

### Foreground-only process

Retaining only the existing foreground process is rejected for the long-lived runtime.
It remains a valid explicit-operation and fallback mode, but it cannot own a specialist
child after the interaction exits and cannot create unattended opportunities.

### Permanently resident Ember service

A single resident Node service supervised by systemd would satisfy the requirements
and is the main future alternative. It is not selected yet because it adds permanent
Ember RSS, a long-lived event loop, service readiness/liveness semantics, and pressure
for a control/IPC boundary while current evidence does not require continuous inbound
transport or a resident scheduler.

A resident service may become the smaller design later when continuous surfaces,
high opportunity frequency, live specialist steering, or worker-spawn overhead make
per-episode execution more complex than one process.

### Cron, detached children, `nohup`, or equivalent shell supervision

These are rejected as the production long-lived topology. They can cause a process to
run later, but they do not jointly provide the supervision, process grouping,
structured lifecycle, user-session independence, and status needed by the specialist
and recovery semantics. A detached PID also tempts the implementation to infer too
much from process existence or loss.

## systemd deployment boundary

### Per-user manager and lingering

The first deployment uses `systemd --user`, not a root-owned Ember daemon. The Ember
worker therefore runs as the same local OS user that owns the state and existing
subscription-backed runtime login.

The deployment runbook enables user lingering for the Ember account. Upstream
`loginctl` documents that lingering causes the user's service manager to be spawned at
boot and kept after logouts, specifically allowing long-running user services without
an active login session.

This preserves the existing authentication ownership rule: Codex authentication stays
with Codex under the user's runtime-owned credential store. Ember does not copy tokens
or API keys into canonical state or checked-in unit files.

### Transient foreground workers

Long-running work is executed as a transient **service** unit, not a transient scope.
Upstream `systemd-run` documents that transient services are parented and managed by
the service manager and may run asynchronously after the launching command returns.
That property is the operational ownership Ember needs when the initiating CLI goes
away.

Workers use `Type=exec` where supported by the installed systemd. Upstream systemd
recommends `exec` over `simple` when the caller needs service start to fail if the
configured executable itself cannot be invoked. Ember still records its own startup
and work evidence because successful `execve()` is not proof that Ember initialization
or the delegated objective succeeded.

Worker unit names contain only an opaque Ember work/wake identifier. Objective text,
user content, repository secrets, prompts, or authority rationale must not appear in
unit names or command-line metadata merely for operator convenience.

### No automatic replay through `Restart=`

Work-bearing Ember units use `Restart=no`.

Automatic process restart is not semantic work recovery. A specialist worker may have
changed a repository or produced remote effects before crashing; an opportunity worker
may have completed model cognition before losing its final durable transition. Blindly
executing either command again would collapse process recovery into occurrence retry.

After worker loss, a later reconciliation worker examines durable evidence and current
state. It may classify the prior work as lost/uncertain, re-arm a still-pending wake,
or create a **new** justified occurrence. It does not rerun the old command because
systemd observed failure.

A future idempotent control-only helper may use a restart policy if its contract proves
that restart cannot duplicate cognition, delegation, authority, delivery, or external
effects. That exception does not apply to work workers.

### Termination and process groups

Specialist worker units use `KillMode=mixed` rather than the default
`control-group` termination sequence.

The main Ember worker must receive `SIGTERM` first so it can durably record
cancellation/shutdown intent before it asks its direct Codex child to stop. With
`KillMode=mixed`, systemd sends the initial termination signal to the main process and
uses the later final kill for remaining processes in the unit cgroup. `TimeoutStopSec`
must leave more time than Ember's own bounded child-termination/reconciliation grace.
The exact duration is an implementation/runbook choice for #94.

Even when systemd later establishes that the local unit cgroup is empty, Ember does
not infer rollback or absence of remote effects. Local process termination,
specialist stop, external effects, and current applicability remain separate under
ADR 0005.

An abrupt host failure or `SIGKILL` may prevent the worker from persisting its final
observation. Recovery must preserve that gap rather than inventing a clean stop.

## Wake-up model

### Durable one-shot wake intent, not a periodic prompt

The topology represents a future wake need as a small durable **operational wake
intent** that can be mapped to a one-shot systemd timer. It is not canonical meaning
and it is not the reason for cognition.

The implementation may choose the exact record schema, but the durable intent must be
able to establish at least:

- an opaque wake identity;
- principal and active scope needed by the ordinary opportunity boundary;
- the topic-free opportunity mechanism;
- one due/not-before time when time materially matters;
- creation/currentness evidence sufficient to suppress a superseded intent; and
- whether the intent is pending, dispatched/consumed, or superseded.

It must not contain a scheduler-written topic, conclusion, fabricated motive, or raw
model reasoning. When the timer fires, the opportunity worker reconstructs the normal
bounded projection from current Ember state.

No default fixed interval is selected. A concern that earns a future reconsideration
may create a one-shot wake intent. A future surface/runtime event may create an
immediate opportunity without a timer. Silence creates no obligation to schedule the
next thought.

### Timers are activation machinery, not memory

The systemd timer is a projection of the durable Ember wake intent, not the source of
truth for why or whether the opportunity remains live.

Use one-shot activation rather than a repetitive `OnUnitActiveSec=` or cron-like
cadence. Do not use systemd `Persistent=true` as Ember's missed-opportunity semantics.
Upstream systemd defines `Persistent=true` to trigger a timer immediately after it
becomes active when it would have fired while inactive. Ember instead owns the
currentness decision: after downtime it re-evaluates one durable intent and either
re-arms it, dispatches one current opportunity, or supersedes it. It does not count
and replay every elapsed timer tick.

Transient timer units may disappear when the user manager or host restarts. That is
acceptable because the durable wake intent survives independently and startup
reconciliation reconstructs the required activation.

## Startup and recovery

The deployment includes a short-lived **runtime reconciliation** entry point that is
invoked when the lingered user manager starts and may also be run manually.

Reconciliation does not itself create a cognition opportunity merely because the host
restarted. Restart frequency must not become the issue #95 attention policy.

It performs bounded operational work:

1. load and validate Ember durable state and runtime operational records;
2. inspect nonterminal specialist episodes and their expected systemd unit identity;
3. if an expected worker no longer exists, record/retain process loss and effect
   uncertainty rather than relaunching it;
4. inspect pending wake intents;
5. re-create the corresponding one-shot timer when the intent is still future and
   current;
6. for a due intent, dispatch at most that one current opportunity rather than replay
   historical timer ticks; and
7. expose lock/config/provider degradation without claiming semantic failure.

The reconciliation path must be idempotent with respect to durable wake/work identity.
Repeated startup reconciliation may restore missing activation metadata; it must not
multiply Ember occurrences.

## Writer ownership and concurrency

The selected topology preserves the existing cooperative `StateStore` lease and
revision-validation boundary. It does **not** assume the current interactive lease
lifetime is already appropriate for background workers: today's interactive
`ember run` deliberately owns its lease across the foreground session.

The new non-interactive workers introduced by #94 should acquire the writer lease only
around the canonical transitions that need it, reload current revision, commit with
revision validation, and release the lease before long external waits when possible.
Specialist execution continues to keep its own episode record independently of the
canonical store until reintegration requires a current canonical checkpoint.

Consequences:

- two overlapping workers fail closed or retry only a locally safe lock acquisition;
- a background worker does not bypass the lock because systemd started it;
- `inspect`, `check`, and lock diagnosis remain short-lived read paths;
- the existing interactive CLI remains usable when it can acquire the same lease;
- the current long interactive CLI lease can temporarily prevent background mutation,
  which is surfaced as contention rather than solved with hidden concurrent writes.

No local IPC server, actor mailbox, database writer process, or lock-service protocol
is introduced by this decision.

If interactive/background lock contention becomes normal rather than exceptional, or
a future resident surface requires continuous writes, that is a revisit trigger for a
single resident owner plus explicit IPC or a different reviewed concurrency design.

## Shutdown semantics

Stopping a worker or the user manager is an operational event, not an instruction to
rewrite every live purpose as cancelled.

For an orderly worker stop:

1. stop accepting new local work inside that worker;
2. persist shutdown/cancellation intent where the work contract requires it;
3. signal/await the direct specialist child through the existing bounded termination
   path;
4. preserve possible effects and unresolved continued-work status when they cannot be
   established; and
5. release any owned canonical writer lease.

If systemd reaches its final kill before those steps finish, recovery sees incomplete
records and classifies the gap. A unit becoming `inactive` does not by itself prove
that the objective was cancelled, external effects were rolled back, or a user-facing
handoff was delivered.

## Status and inspection

Operational status is a join of two evidence classes:

1. **Ember durable state/records:** objectives, opportunity/wake intent, runtime and
   specialist observations, interruption handoffs, currentness, recovery requirements,
   and gaps; and
2. **systemd observation:** whether the expected user manager/unit currently exists,
   its process/cgroup state, and its last manager-reported termination result when
   available.

`systemctl --user`/journal state is useful operational evidence but never the complete
Ember status. Likewise, a durable `running` observation from before a crash does not
prove the process is still running now.

Issue #94 should expose one repository-supported status/inspection command or runbook
flow that presents both layers without requiring the operator to infer semantic truth
from systemd prose.

## Configuration and local security boundary

Long-lived workers run from a service-manager environment rather than an interactive
shell. #94 therefore must make these inputs explicit:

- absolute Node/Ember entry point;
- canonical state and operational-record paths;
- local principal and active scope/policy inputs;
- absolute Codex/provider executable path or another deliberately resolved command;
- workspace path selected by the specialist episode;
- bounded provider/specialist arguments and timeouts; and
- the user-manager/systemd feature assumptions used by the runbook.

Do not depend on an interactive shell's current working directory, aliases, shell
initialization, or broad environment inheritance to locate Node, Ember, Codex, state,
or credentials.

The service-manager user is technical capability, not semantic authority. A worker
being able to read the user's home, repository, socket, or credential store does not
authorize Ember or Codex to use that capability outside the live authority envelope.

Subscription-backed authentication stays runtime-owned. The deployment may make the
existing runtime-owned credential store reachable to the same user process, but it
must not copy credentials into Ember state, repository files, unit names, command-line
arguments, or committed environment files.

Logs should prefer opaque work IDs and bounded diagnostics. Raw prompts, private
context projections, provider credentials, and user content must not be emitted to the
journal merely because systemd captures stdout/stderr.

## Platform scope

The first unattended-production topology is **Linux with systemd user services**.
The exact minimum systemd version is not fixed by this ADR. The #94 installation
runbook must probe the target host for the features actually used: user managers,
lingering, transient service/timer units, `Type=exec`, and the selected kill mode.

Ember's semantic core remains Node.js 26 code under ADR 0006. Foreground operation,
deterministic tests, state validation, and semantic continuity do not become systemd
concepts.

Non-systemd Linux, macOS, Windows, containers without a user manager, and multi-host
execution are outside the first unattended deployment contract. Do not emulate this
ADR on those platforms with `nohup`, PID files, or an unreviewed background-process
wrapper. A future platform should map the same requirements to its own supervisor in a
separate implementation decision.

## Current external-system evidence

The following deployment facts were checked against upstream sources on 2026-09-03:

- systemd `loginctl enable-linger` keeps a user's manager around after logout and can
  start it at boot for long-running user services;
- `systemd-run` can create transient service and timer units, with a transient service
  parented/managed by the service manager and detached from the launching command;
- `Type=exec` delays successful service start until the service binary has actually
  been executed, unlike `simple` which can report start before `execve()` succeeds;
- systemd timers activate a service when their time elapses and support one-shot
  calendar/monotonic activation;
- `Persistent=true` has catch-up semantics after timer inactivity, which is why Ember
  does not delegate missed-opportunity currentness to that setting;
- `Restart=` is process restart policy and therefore remains disabled for Ember work
  units whose replay may duplicate cognition or effects;
- `KillMode=mixed` sends the initial termination signal to the main process and the
  later final kill to remaining cgroup processes, which lets the Ember wrapper record
  intent before systemd forcibly cleans the process group; and
- Node.js 26.8.1 `child_process` signal/kill APIs report process-level observations but
  do not establish rollback or remote-effect absence, matching Ember's existing
  uncertainty model.

Sources:

- https://github.com/systemd/systemd/blob/main/man/loginctl.xml
- https://github.com/systemd/systemd/blob/main/man/systemd-run.xml
- https://github.com/systemd/systemd/blob/main/man/systemd.service.xml
- https://github.com/systemd/systemd/blob/main/man/systemd.timer.xml
- https://github.com/systemd/systemd/blob/main/man/systemd.kill.xml
- https://nodejs.org/docs/latest-v26.x/api/child_process.html

These sources establish host/runtime mechanics only. They do not define Ember
continuity, authority, retry safety, or work semantics.

## Failure modes to validate before calling the topology complete

Issue #94 implements the topology; issue #83 validates recovery. The implementation
must make the following failures reproducible rather than merely documenting the
happy path:

| Failure | Required interpretation |
| --- | --- |
| User manager unavailable or lingering disabled | Unattended capability is unavailable; Ember continuity remains intact and foreground operation remains possible. |
| Transient worker fails before `exec` | Launch failure, no claim that Ember work began. |
| Worker crashes after durable spec but before child launch | Work remains unresolved; recovery may start a new justified attempt only from explicit state. |
| Worker/host dies while specialist is running | Prior attempt becomes lost/uncertain; possible effects survive; no automatic rerun. |
| `SIGTERM` arrives during specialist work | Cancellation/shutdown intent is persisted first when possible; direct-child/cgroup/remote outcomes remain separate. |
| Final kill occurs before clean shutdown finishes | Recovery records an unclean gap; no invented clean stop. |
| Timer unit disappears before firing | Durable wake intent survives and reconciliation may re-arm it. |
| Wake time passes during downtime | Reconciliation dispatches at most one current opportunity for that intent; it does not replay elapsed periodic ticks. |
| Wake intent becomes superseded before firing | Worker rechecks currentness and produces no obsolete cognition occurrence. |
| Two workers race for canonical state | Existing writer lease/revision validation prevents concurrent commit; contention is visible. |
| Interactive CLI holds writer lease | Background work defers/fails safely rather than bypassing the lock. |
| systemd says unit exited successfully but specialist report is ambiguous | Ember preserves report/effect uncertainty; process status does not upgrade semantic confidence. |
| Codex auth unavailable in user-manager environment | Capability is degraded/blocked; no credential copying or authority inference. |

## Implementation handoff for issue #94

Issue #94 can implement this decision without reopening topology selection. The
minimum slice is:

1. **Runtime records**
   - introduce the smallest durable operational wake-intent representation needed for
     one-shot future opportunities;
   - keep specialist episode records and interruption handoffs durable across worker
     exit;
   - use opaque IDs that can map deterministically to safe systemd unit names.
2. **Worker entry points**
   - add non-interactive foreground commands for runtime reconciliation, one
     topic-free opportunity, and one already-specified specialist episode;
   - commands must be independently deterministic/testable without systemd.
3. **systemd adapter/deployment layer**
   - create transient user service units for work using `Type=exec`, `Restart=no`, and
     the reviewed termination policy;
   - create one-shot timer activation from a durable wake intent without a default
     periodic cadence or `Persistent=true` catch-up policy;
   - enable/document user lingering and a user-manager-start reconciliation hook;
   - keep executable/state/config paths explicit and secrets out of committed units.
4. **Recovery**
   - reconcile nonterminal specialist records with current unit existence;
   - re-arm/supersede due wake intents idempotently;
   - never automatically replay a work unit because its process failed.
5. **Shutdown/control**
   - handle `SIGTERM` in the main worker and preserve cancellation/shutdown evidence
     before child termination when possible;
   - make forced termination produce truthful gaps.
6. **Status**
   - expose a combined Ember/systemd operational view sufficient for #82/#83 without
     treating unit liveness as semantic truth.
7. **Tests/runbook**
   - deterministic tests use a fake supervisor adapter and fake clock;
   - systemd-dependent smoke validation is opt-in and documents required host
     features;
   - normal repository tests do not require systemd, lingering, Codex login, or root.

No generic job queue, IPC protocol, daemon framework, cross-platform service adapter,
message transport, or continuous scheduler belongs in #94 unless implementation
evidence demonstrates that this selected topology cannot satisfy its own contract.

## Consequences

### Positive

- no permanently resident Ember Node process is required while idle;
- unattended wake-up and specialist ownership use one existing host supervisor rather
  than a new Ember daemon framework;
- each specialist/wake occurrence has a narrow process lifetime and attributable unit;
- process failure cannot silently become automatic work retry;
- the existing cooperative lease/revision model remains viable without a resident
  single-writer process;
- future resource measurement can attribute transient worker and provider process
  trees cleanly; and
- a future resident surface can justify a topology change with concrete evidence.

### Costs and limitations

- unattended production initially depends on Linux/systemd and user lingering;
- startup reconciliation must reconstruct transient timers/worker observations from
  durable Ember records;
- systemd and Ember status have to be reconciled rather than read as one truth source;
- the current long interactive CLI lease can temporarily block background mutations;
- user-manager environment/configuration is less implicit than an interactive shell;
- transient process startup cost may become material if opportunity frequency grows;
  and
- Telegram or another continuously receiving surface may later make a resident Ember
  process simpler than episodic workers.

## Revisit triggers

Re-evaluate this ADR when one or more of the following becomes concrete:

- the first secondary surface requires a continuously open receive loop or other
  persistent transport that cannot be represented cleanly as episodic activation;
- frequent wake opportunities make repeated Node/provider startup a measured resource
  or latency problem;
- specialist work needs reliable live steering, interactive approvals, or shared
  long-lived runtime sessions that benefit from one resident coordinator;
- ordinary CLI/background lock contention becomes a normal operating condition;
- a resident single-writer owner plus IPC is demonstrably simpler than repeated lease
  acquisition;
- #82/#84 measurements show the chosen supervisor/worker pattern creates unacceptable
  overhead on representative hardware;
- another required deployment platform lacks equivalent systemd user-manager
  facilities;
- multiple local principals or multi-host execution require a different ownership and
  isolation model; or
- systemd-specific behavior materially prevents provider authentication, sandboxing,
  recovery, or observability required by the semantic ADRs.

A revisit may select a resident Ember service, another supervisor, or a different
local topology. It must preserve ADRs 0001-0005 and must not reinterpret process
continuity as Ember continuity.
