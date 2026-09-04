---
summary: "Issue #82 reproducible Linux resource baseline for Ember's episodic runtime, separating idle residency, active Ember workers, and external provider processes."
read_when:
  - "Reviewing Ember runtime RSS, CPU, process count, or steady-state resource cost"
  - "Comparing future runtime changes with the issue #82 Linux baseline"
  - "Running issue #84 resource measurements on Raspberry Pi-class hardware"
role: evidence
discovery_status: current
---

# Episodic Runtime Resource Evaluation

## Purpose and interpretation boundary

Issue [#82](https://github.com/arhor/ember/issues/82) measures the implemented runtime topology from ADR 0007 rather than extrapolating from acceptance-test process trees or repeatedly cold-started development commands.

The selected topology has no permanently resident Ember Node process. Its true idle steady state is therefore **absence of an Ember worker**, not a sleeping daemon. Active resource figures below are bounded episodic-process measurements and must not be relabeled as idle or resident cost.

The canonical run uses the production Ember CLI/runtime entrypoints with a protocol-compatible bounded Node child in place of Codex. That makes Ember core cost deterministic while preserving a separately measurable external-process boundary. The fixture child's RSS and CPU are **not Codex resource measurements**.

## Canonical evidence

Canonical resource workflow run: [#33905279629](https://github.com/arhor/ember/actions/runs/33905279629).

The run measured the PR merge checkout `0f157f2afce876e263f046d5bdfe1702c139c9c2`, built from master `86eb5501e0c01a5708737cc9ac76f5cb22f4a855` plus issue #82 head `0b9c0fa8d5bdd668094f4bd4f07a730dbca26f8c`.

Raw JSON evidence was uploaded as artifact `runtime-resource-evidence`, artifact ID `9949219562`. The uploaded artifact zip SHA-256 reported by GitHub Actions is `b38cb0c83ea8e8563d118d57e5bd2522a1feafdb3d1a1b9f4f2370b904dc414a`.

Canonical host:

- Ubuntu 24.04.4, hosted runner image `ubuntu24` version `20260831.293.1`;
- Linux kernel `6.17.0-1022-azure`, x86_64;
- Node.js `v26.8.1`;
- Intel Xeon Platinum 8573C;
- 4 logical CPUs, 2 physical cores with SMT;
- about 15,989 MiB host memory; and
- no provider network/model call in the canonical fixture run.

## Workload definition

`npm run eval:runtime-resource` performs one discarded warm-up and five retained samples per active workload. It uses a 10 ms `/proc` sampling interval and holds the external fixture process for 1,200 ms so the Ember root and child are observable concurrently. Idle is observed separately for 1,500 ms.

The three active workloads are:

1. **Foreground cognition**: `bin/ember.ts run` through the production Codex provider adapter.
2. **Endogenous wake**: `bin/ember-runtime.ts run-wake` through the production episodic wake path and Codex opportunity evaluator.
3. **Specialist delegation**: `bin/ember-runtime.ts run-specialist` through the production specialist boundary.

Each sample receives fresh disposable state/workspace/runtime records. Fixed Ember fixture time is used where semantic persistence requires deterministic timestamps. The external fixture consumes the actual bounded prompt and emits the same JSONL message shape expected from Codex.

## Idle steady state

Across the 1,500 ms canonical idle observation:

- maximum resident `ember-runtime` process count: **0**;
- maximum Ember runtime RSS: **0 KiB**; and
- attributable Ember runtime CPU: **0 ms**.

This is the most important steady-state result. systemd owns future activation while Ember continuity remains durable on disk, so there is no resident Node heap to optimize between episodes. A future architecture change that introduces a resident Ember process must compare against this zero-residency baseline rather than against the active-process figures below.

## Active-process measurements

RSS values below are Linux `VmRSS`. Ranges are min to max across five retained samples; values in parentheses are the corresponding KiB medians retained in raw evidence.

**Foreground cognition**

- Ember root peak RSS: **99.60 MiB** median, 98.89 to 100.38 MiB (`101988 KiB`).
- External fixture peak RSS: **69.93 MiB** median, 69.77 to 71.32 MiB (`71604 KiB`).
- Total process-tree peak RSS: **169.80 MiB** median, 168.98 to 170.75 MiB (`173880 KiB`).
- Ember root CPU: **280 ms** median over a 1,490.87 ms median wall window, or **18.78%** average CPU.
- External fixture CPU: **80 ms** median, or **5.37%** average CPU.
- Maximum simultaneous measured processes: **2** in every retained sample.

**Endogenous wake**

- Ember root peak RSS: **98.88 MiB** median, 98.54 to 100.21 MiB (`101248 KiB`).
- External fixture peak RSS: **71.45 MiB** median, 69.89 to 71.84 MiB (`73164 KiB`).
- Total process-tree peak RSS: **170.03 MiB** median, 169.80 to 170.82 MiB (`174108 KiB`).
- Ember root CPU: **280 ms** median over a 1,467.34 ms median wall window, or **18.82%** average CPU.
- External fixture CPU: **80 ms** median, or **5.38%** average CPU.
- Maximum simultaneous measured processes: **2** in every retained sample.

**Specialist delegation**

- Ember root peak RSS: **98.66 MiB** median, 97.62 to 100.05 MiB (`101024 KiB`).
- External fixture peak RSS: **69.90 MiB** median, 69.88 to 71.37 MiB (`71580 KiB`).
- Total process-tree peak RSS: **169.73 MiB** median, 167.52 to 170.09 MiB (`173808 KiB`).
- Ember root CPU: **280 ms** median over a 1,469.86 ms median wall window, or **18.69%** average CPU.
- External fixture CPU: **80 ms** median, or **5.25%** average CPU.
- Maximum simultaneous measured processes: **2** in every retained sample.

The three Ember root RSS medians cluster within about 1 MiB. On this host there is no evidence that the episodic wake or specialist wrapper introduces a materially different Node memory class from ordinary foreground cognition. The dominant architectural distinction is instead between zero-cost idle residency and a roughly 99 MiB short-lived Ember process while work is active.

## What the external numbers do and do not mean

The canonical child is another Node process whose only purpose is to remain observable while satisfying Ember's bounded Codex protocol. Its roughly 70 MiB RSS is useful for verifying process-tree attribution but says nothing reliable about real Codex memory, its descendants, model/network latency, or authentication/runtime overhead.

A real external runtime can be measured with the same harness without changing Ember code:

```bash
npm run eval:runtime-resource -- \
  --provider-command /ABSOLUTE/PATH/codex \
  --repeat 3 \
  --warmup 1
```

`--provider-arg VALUE` may be repeated for explicit runtime-owned Codex arguments. Real-provider measurements should be recorded separately from the canonical fixture baseline because they can vary with Codex version, authentication state, model selection, network conditions, and remote service latency.

## Measurement mechanics

For each observed PID the harness reads Linux `/proc/<pid>/stat`, `/proc/<pid>/status`, and `/proc/<pid>/cmdline`.

- Root RSS is the measured Ember process only.
- External RSS is the sum of observed descendants of the Ember root.
- Total tree RSS is root plus descendants at each sample, with the maximum retained for the process episode.
- CPU uses sampled cumulative user+system ticks, converted through `getconf CLK_TCK`.
- Average CPU percentage is sampled CPU milliseconds divided by the measured wall window. It is not a scheduler or per-core utilization trace.
- Process count is the maximum concurrently observed root+descendant count.

Because processes can exit between 10 ms samples, sampled CPU can slightly undercount the final few ticks. RSS is likewise a sampled peak rather than an allocator/heap high-water mark. These measurements intentionally describe OS-visible process cost rather than V8 heap internals.

## Separation from earlier cold-process evidence

The TypeScript adoption work recorded cold CLI/test/static-check process costs. Those numbers remain useful for developer feedback-loop comparison but are not this topology's steady-state baseline.

In particular, the earlier approximately 97 MiB idle-CLI RSS measured a deliberately held foreground CLI process. It does not contradict the issue #82 idle result: the production episodic topology does not keep that CLI or another Ember Node process resident when no work is active.

Likewise, the current active root figures include Node startup and direct TypeScript execution. They should be compared with future active episodic workers, not interpreted as memory continuously reserved by Ember.

## Reproduction

On Linux with Node 26.8.1 and the locked repository toolchain:

```bash
npm ci
npm run eval:runtime-resource
```

The dedicated `Runtime resource evaluation` workflow records host identity and uploads the raw JSON output. The harness is evaluation-only under `eval/runtime-resource/`; it is not imported by production runtime code and introduces no production dependency.

For a narrower local probe:

```bash
npm run eval:runtime-resource -- \
  --repeat 3 \
  --warmup 1 \
  --idle-ms 5000 \
  --sample-ms 10 \
  --hold-ms 1200
```

## Baseline conclusion and handoff to #84

The implemented episodic topology meets the key constrained-host objective more strongly than a low-memory daemon would: **Ember itself has no resident Node process while idle**. On the canonical x86_64 hosted runner, a short-lived active Ember root peaks around 99 MiB RSS, while the fixture-backed two-process tree peaks around 170 MiB. The latter is not a Codex estimate.

Issue #84 should run the same harness on Raspberry Pi-class ARM hardware, preserving the idle observation, active workload definitions, sampling interval, warm-up/repeat policy, and root-versus-descendant attribution wherever practical. Hardware/model-specific deviations should be recorded rather than silently changing the workload.

No optimization issue is justified by the hosted-runner figures alone. Any constrained-host optimization should be tied to #84 measurements that demonstrate actual memory, CPU, swap, thermal, or latency pressure on the intended deployment class.
