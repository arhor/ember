---
summary: "Issue #83 recovery evidence for Ember's systemd-supervised episodic runtime across restart, stale locks, in-flight cognition, pending delivery, and specialist process loss."
read_when:
  - "Reviewing restart, crash, stale-lock, wake, delivery, or specialist recovery behavior in the episodic runtime"
  - "Changing reconciliation, runtime status, worker restart policy, or long-lived operational recovery semantics"
  - "Revisiting ADR 0007 or deciding whether the episodic topology needs a resident runtime owner"
role: evidence
discovery_status: current
---

# Episodic Runtime Recovery Validation

## Purpose and authority

Issue [#83](https://github.com/arhor/ember/issues/83) validates the runtime topology selected by [ADR 0007](decisions/0007-use-systemd-supervised-episodic-runtime.md) and implemented by #94 against the operational-continuity semantics of [ADR 0005](decisions/0005-distinguish-operational-continuity.md).

This document is validation evidence, not a new semantic source of authority. The governing rule remains: **recovery reconstructs the strongest justified present from durable evidence and current observation; it does not replay old process state or promote missing evidence into success, cancellation, rollback, or non-occurrence.**

The deterministic scenario suite lives in `tests/episodic-runtime-recovery.test.ts`. Real systemd/host procedures that cannot be made hermetic in CI are recorded in the [episodic runtime runbook](episodic-runtime-runbook.md#recovery-and-restart-validation).

## Recovery boundary model

The selected topology has three evidence layers with intentionally different strength:

1. **Canonical Ember state** establishes durable semantic occurrences, runtime/cognition history, currentness, and explicit recovery gaps.
2. **Runtime operational records** establish wake intent/dispatch/terminal observations and specialist launch/worker observations independently of transient unit lifetime.
3. **systemd observation** establishes whether the expected local timer/service is currently observable as active, inactive, failed, missing, or indeterminate.

No one layer substitutes for another. A missing service cannot erase a durable cognition occurrence. A durable `running` observation cannot prove a process still exists. A completed provider call with `delivery_status=pending` cannot prove whether presentation happened. A specialist process loss cannot prove that external effects were absent or rolled back.

## Deterministic scenario matrix

| Scenario | Durable boundary before recovery | Ephemeral observation after loss | Recovery result that is justified | Claims deliberately not made |
| --- | --- | --- | --- | --- |
| Clean wake completion followed by duplicate invocation | one wake identity, `dispatching`, one decided cognition opportunity, terminal `completed`, clean runtime stop | prior transient worker is gone | repeated invocation returns `already_dispatched`; occurrence count remains one | no second opportunity is manufactured |
| User-manager/transient-timer loss before a future wake fires | wake `intent.json`; no `dispatching` and no canonical opportunity | timer is missing after manager loss | reconciliation re-arms the same wake identity; a second reconciliation observes the restored timer and does nothing | restart is not cognition and does not create a new wake occurrence |
| Apparently stale writer lock before wake dispatch | wake intent exists; no `dispatching`; canonical occurrence count is zero | lock file survives while recorded same-host PID is absent | acquisition fails closed; explicit token-matched, quiescence-confirmed quarantine removes only the stale lock artifact; the original wake may then dispatch once | lock age alone is not authority to delete it; quarantine does not itself create cognition |
| Process loss with cognition `started` and opportunity `evaluating` | both in-flight occurrences are durable under an unclean runtime | original process is gone | fresh runtime start marks both `outcome_unknown` and records an `uncertain_interruption_boundary`; occurrence counts remain unchanged | neither completion nor abortion is inferred; neither occurrence is replayed |
| Process loss after expression commit and output attempt but before delivery-status commit | cognition is `completed`, expression occurrence is durable, `delivery_status=pending` | the process that attempted presentation is gone | restart preserves the completed cognition and pending delivery exactly as recorded | delivery is not upgraded to `displayed`, and cognition is not repeated to “make sure” |
| Specialist worker/unit disappears after a durable child launch | specialist episode says `running` and contains `launch_attempted`/`child_started` | expected systemd service is missing/inactive/failed | reconciliation records specialist `lost`, report `ambiguous`, possible effects, continued-work `unknown`, and `prohibited_pending_reconciliation`; repeated reconciliation is idempotent | child exit, rollback, effect absence, objective failure, and retry safety are not invented |
| Supervisor accepted a specialist worker but no specialist episode record was established | outer launch/worker observations exist, but `episode.json` is absent | service is missing | inspection exposes the mismatch directly: worker/launch observation plus missing unit and null episode/report/retry state; reconciliation does not fabricate a specialist process-loss record whose own launch boundary never existed | no claim that the delegated child launched, completed, failed, or produced/avoided effects |

The last row is an intentionally retained information gap. `runSpecialistWorker` records `worker_started` before entering `runCodexSpecialist`; `runCodexSpecialist` creates the episode record before attempting the direct specialist child. Therefore a missing `episode.json` means Ember lacks the specialist-local durable boundary required by `recordSpecialistProcessLoss`. Recovery surfaces that absence rather than synthesizing a child history from the supervisor's acceptance alone.

## What the scenarios establish

### Clean stop and duplicate suppression

The normal wake path persists the wake intent before supervisor activation, crosses `dispatching` before evaluating the endogenous opportunity, records exactly one opportunity, and then commits a clean runtime stop plus terminal wake observation. A later invocation of the same wake identity is rejected by durable wake observations before it can create another runtime or opportunity.

This validates that process disappearance after a known clean terminal boundary is operational cleanup, not semantic loss.

### Host/user-manager restart before dispatch

Transient timers are projections of durable wake intent. When a future timer disappears, reconciliation may reconstruct only that activation projection. It does not write a cognition opportunity and does not allocate a replacement wake identity.

A second reconciliation after the timer is observable as active is a no-op. This is the idempotence property required by ADR 0007: startup frequency does not become attention frequency.

### Stale-lock recovery stays explicit

`StateStore` continues to fail closed when a lock artifact exists, even when liveness diagnosis says the recorded same-host PID is apparently absent. The runtime does not silently break the lock to make a background wake succeed.

Recovery requires the pre-existing quarantine protocol: establish the exact owner token, explicitly confirm quiescence, re-check PID absence, and atomically rename the lock artifact. Only after that separate recovery decision can the still-pending wake acquire the normal writer lease. The deterministic scenario verifies that no opportunity exists before quarantine and exactly one exists after successful dispatch.

### In-flight cognition remains epistemically incomplete

A generic abrupt-loss fault after the cognition/opportunity start commit leaves durable `started`/`evaluating` records. A new runtime does not reinterpret those as failure or success. `startRuntime` converts them to `outcome_unknown` and records an uncertain interruption boundary.

This preserves both facts that matter: Ember knows the occurrences began, and Ember does not know the missing outcome after the last durable observation.

### Pending delivery is not replay permission

The cognition path commits provider completion and a payload-free expression occurrence before transient presentation, with `delivery_status=pending`. If the process dies after presentation may have happened but before the final `displayed` commit, recovery preserves `pending`.

That state is intentionally ambiguous: the user may have seen the output, or the output may have been lost. Repeating cognition would create a second semantic occurrence and still would not resolve whether the first delivery happened. Any future redelivery policy must therefore operate on delivery semantics, not by rerunning cognition.

### Specialist process loss preserves possible effects

Once a specialist episode has durably crossed its own launch boundary, disappearance of its expected service is evidence of local process loss, not evidence of external-effect absence. Reconciliation routes the record through `recordSpecialistProcessLoss`, which establishes:

- `runtime_state=lost`;
- `report_state=ambiguous`;
- `effect_state=effects_possible`;
- `continued_work_state=unknown`; and
- `retry_state=prohibited_pending_reconciliation`.

A second reconciliation does not relaunch or mutate the already-lost episode. Consequential retry remains blocked until current external/descendant state is observed sufficiently to establish safety.

## Environment-dependent systemd validation

The deterministic suite substitutes command runners and simulated process boundaries so normal CI requires neither systemd nor provider credentials. The selected topology still has host properties that must be checked on a representative Linux/systemd user session:

- transient wake timer disappearance and reconstruction after a user-manager restart;
- `Restart=no` after a worker exits non-zero or is killed;
- `KillMode=mixed` delivery of initial termination to the specialist worker before final cgroup cleanup;
- reconciliation after a forced `SIGKILL` where no final worker observation can be written; and
- operation after logout/boot when user lingering is part of the deployment.

The runbook gives a bounded procedure and the evidence to record. These checks validate the supervisor boundary only. They must not weaken the deterministic semantic assertions or require committing host-specific journal data.

## Result

The #94 implementation satisfies the #83 deterministic recovery requirements without introducing automatic work replay or a second recovery model. Durable state and operational records survive independently of workers; missing ephemeral state is either reconstructed only where replay is safe (pending activation) or retained as explicit uncertainty (in-flight cognition, delivery, and specialist effects).

The validation also identifies one deliberately visible pre-episode specialist gap: systemd may have accepted or started the outer worker while no specialist episode record exists. Current reconciliation leaves this gap raw rather than manufacturing a specialist-local loss record. The inspection surface retains enough evidence (`status`, unit state, and null episode fields) for diagnosis, and the runbook treats blind same-episode replay as unsafe. If this state becomes operationally common, a future change may introduce a dedicated durable outer-worker terminal classification, but #83 does not invent one without evidence that it is needed.
