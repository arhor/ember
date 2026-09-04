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

Canonical resource workflow run: [#33906121531](https://github.com/arhor/ember/actions/runs/33906121531).

The run measured the PR merge checkout `0971dfc92b83fb7e3e33dd60519f1f8cc2c8d5fb`, built from master `86eb5501e0c01a5708737cc9ac76f5cb22f4a855` plus issue #82 head `9127b3e4f6fc8f393a8a6354bfef7154f3db2b51`.

Raw JSON evidence was parsed successfully in the workflow before upload and stored as artifact `runtime-resource-evidence`, artifact ID `9949539081`. The uploaded artifact zip SHA-256 reported by GitHub Actions is `e4ffa6eb72e56eeb3844752097388de0bc41f952c8029b9969731b60a07f238c`.

Canonical host:

- Ubuntu 24.04.4, hosted runner image `ubuntu24` version `20260831.293.1`;
- Linux kernel `6.17.0-1022-azure`, x86_64;
- Node.js `v26.8.1`;
- AMD EPYC 9V74;
- 4 logical CPUs, 2 physical cores with SMT;
- about 15,990 MiB host memory; and
- no provider network/model call in the canonical fixture run.

GitHub-hosted CPU models are not pinned. A future comparison must retain the recorded host identity rather than treating two hosted-runner measurements as a controlled hardware experiment.

## Workload definition

`npm run eval:runtime-resource` performs one discarded warm-up and five retained samples per active workload. It uses a 10 ms `/proc` sampling interval and holds the external fixture process for 1,200 ms so the Ember root and child are observable concurrently. Idle is observed separately for 1,500 ms.

The three active workloads are:

1. **Foreground cognition**: `bin/ember.ts run` through the production Codex provider adapter.
2. **Endogenous wake**: `bin/ember-runtime.ts run-wake` through the production episodic wake path and Codex opportunity evaluator. The fixture returns `no_cognition`, representing the ordinary quiet wake/evaluation path rather than manufacturing follow-on cognition.
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

- Ember root peak RSS: **99.79 MiB** median, 98.95 to 100.50 MiB (`102180 KiB`).
- External fixture peak RSS: **71.20 MiB** median, 69.92 to 71.84 MiB (`72904 KiB`).
- Total process-tree peak RSS: **170.43 MiB** median, 168.64 to 171.71 MiB (`174516 KiB`).
- Ember root CPU: **270 ms** median over a 1,506.61 ms median wall window, or **17.74%** average CPU.
- External fixture CPU: **70 ms** median, or **4.79%** average CPU.
- Maximum simultaneous measured processes: **2** in every retained sample.

**Endogenous wake**

- Ember root peak RSS: **99.12 MiB** median, 98.48 to 100.27 MiB (`101504 KiB`).
- External fixture peak RSS: **70.23 MiB** median, 69.93 to 71.77 MiB (`71916 KiB`).
- Total process-tree peak RSS: **170.08 MiB** median, 169.02 to 170.67 MiB (`174164 KiB`).
- Ember root CPU: **270 ms** median over a 1,471.87 ms median wall window, or **18.34%** average CPU.
- External fixture CPU: **80 ms** median, or **5.44%** average CPU.
- Maximum simultaneous measured processes: **2** in every retained sample.

**Specialist delegation**

- Ember root peak RSS: **99.50 MiB** median, 98.29 to 99.84 MiB (`101884 KiB`).
- External fixture peak RSS: **69.90 MiB** median, 69.89 to 71.45 MiB (`71580 KiB`).
- Total process-tree peak RSS: **169.39 MiB** median, 168.90 to 169.74 MiB (`173452 KiB`).
- Ember root CPU: **260 ms** median over a 1,461.60 ms median wall window, or **17.95%** average CPU.
- External fixture CPU: **70 ms** median, or **4.83%** average CPU.
- Maximum simultaneous measured processes: **2** in every retained sample.

The three Ember root RSS medians cluster within 1 MiB. On this host there is no evidence that the episodic wake or specialist wrapper introduces a materially different Node memory class from ordinary foreground cognition. The dominant architectural distinction is instead between zero-cost idle residency and a roughly 99 to 100 MiB short-lived Ember process while work is active.

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

Summed `VmRSS` is not proportional-set-size accounting and can count shared physical pages once per process. The tree total is therefore a process-RSS attribution metric, not a claim about unique physical RAM. If #84 encounters real memory pressure, PSS or `/proc/*/smaps_rollup` may be recorded alongside this baseline rather than silently replacing it.

Because processes can exit between 10 ms samples, sampled CPU can slightly undercount the final few ticks. RSS is likewise a sampled peak rather than an allocator/heap high-water mark. The evaluation harness itself runs outside the measured Ember process tree and can perturb the host slightly while scanning `/proc`; repeated samples and medians reduce but do not eliminate hosted-runner noise.

## Separation from earlier cold-process evidence

The TypeScript adoption work recorded cold CLI/test/static-check process costs. Those numbers remain useful for developer feedback-loop comparison but are not this topology's steady-state baseline.

In particular, the earlier approximately 97 MiB idle-CLI RSS measured a deliberately held foreground CLI process. It does not contradict the issue #82 idle result: the production episodic topology does not keep that CLI or another Ember Node process resident when no work is active.

Likewise, the current active root figures include Node startup and direct TypeScript execution. They should be compared with future active episodic workers, not interpreted as memory continuously reserved by Ember. Each active sample starts a fresh process, while one warm-up sample is discarded before retained observations; these process-start measurements remain explicitly separate from the zero-process idle conclusion.

## Reproduction

On Linux with Node 26.8.1 and the locked repository toolchain:

```bash
npm ci
npm run eval:runtime-resource
```

The dedicated `Runtime resource evaluation` workflow records host identity, validates that the evidence file parses as JSON, and uploads the raw JSON output. The harness is evaluation-only under `eval/runtime-resource/`; it is not imported by production runtime code and introduces no production dependency.

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

The implemented episodic topology meets the key constrained-host objective more strongly than a low-memory daemon would: **Ember itself has no resident Node process while idle**. On the canonical x86_64 hosted runner, a short-lived active Ember root peaks around 99 to 100 MiB RSS, while the fixture-backed two-process tree peaks around 169 to 170 MiB. The latter is not a Codex estimate and can double-count shared physical pages because it sums process RSS.

Issue #84 should run the same harness on Raspberry Pi-class ARM hardware, preserving the idle observation, active workload definitions, sampling interval, warm-up/repeat policy, and root-versus-descendant attribution wherever practical. Hardware/model-specific deviations should be recorded rather than silently changing the workload.

No optimization issue is justified by the hosted-runner figures alone. Any constrained-host optimization should be tied to #84 measurements that demonstrate actual memory, CPU, swap, thermal, or latency pressure on the intended deployment class.
