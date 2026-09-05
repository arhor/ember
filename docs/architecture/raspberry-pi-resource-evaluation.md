---
summary: "Issue #84 Raspberry Pi 5 resource evidence for Ember's episodic runtime, comparing fixture-backed ARM measurements with issue #82 and separating real Codex process-tree cost."
read_when:
  - "Reviewing Ember resource use on Raspberry Pi-class constrained hardware"
  - "Comparing issue #84 ARM measurements with the issue #82 hosted-runner baseline"
  - "Deciding whether Node, Codex, or episodic runtime resource pressure justifies optimization"
role: evidence
discovery_status: current
---

# Raspberry Pi Resource Evaluation

## Purpose and evidence boundary

Issue [#84](https://github.com/arhor/ember/issues/84) validates the runtime-resource methodology from issue #82 on representative constrained always-on hardware. The measurement keeps idle Ember residency separate from bounded active workers and keeps Ember root-process cost separate from external Codex descendants.

The target-host capture was produced from Ember revision `07f0b5e3b464d9915b432e6fc25dc2e573417433`. The supplied capture contained the ordinary two-line `npm run` script banner before the JSON payload; removing only that known npm prefix yields valid JSON. The capture command is corrected in [raspberry-pi-resource-validation.md](raspberry-pi-resource-validation.md) to use `npm run --silent` when redirecting stdout.

SHA-256 of the cleaned JSON payload: `36809208e82b15390215a04e98f21e463d206667544bfcd8af3d8b9b6f65a036`.

No hostname, username, IP address, environment dump, credential path, or other private host identifier appeared in the retained payload.

## Target host

- Raspberry Pi 5 Model B Rev 1.1;
- Debian GNU/Linux 13 (trixie);
- Linux `6.18.34+rpt-rpi-2712`;
- ARM64;
- Cortex-A76, 4 logical CPUs;
- 4,049.13 MiB RAM;
- Node.js `v26.8.1`;
- Codex CLI `0.153.2`;
- systemd user manager available.

PR [#138](https://github.com/arhor/ember/pull/138) had already validated the real `systemd --user -> Node -> Codex -> durable Ember evidence -> clean exit` runtime path on this deployment class. The measurements below therefore add constrained-host resource evidence rather than substituting a synthetic process tree for operational validation.

## Methodology

The fixture-backed half preserves issue #82's canonical comparison shape:

- one discarded warm-up;
- five retained samples per workload;
- 1,500 ms idle observation;
- 10 ms `/proc` sampling interval;
- 1,200 ms fixture hold window; and
- foreground cognition, endogenous wake, and specialist delegation through the same production entrypoints.

The real-provider half uses one discarded warm-up plus three retained Codex samples per workload. Three retained provider samples are an explicit constrained-host deviation from the five-sample fixture comparison, chosen to retain median/range evidence without multiplying live model calls. Real-provider wall time includes network/model latency.

RSS remains Linux `VmRSS`. Tree RSS is the sampled sum of root plus descendants and can double-count shared physical pages; it is not PSS or unique physical memory.

## Idle steady state

Both fixture-backed and real-Codex evaluation phases observed:

- maximum resident Ember runtime process count: **0**;
- maximum Ember runtime RSS while idle: **0 KiB**; and
- attributable Ember runtime CPU while idle: **0 ms**.

This confirms the intended steady-state property on the target hardware: Ember does not keep a resident Node process between episodic activations. The constrained-host result therefore agrees with issue #82's architectural conclusion rather than revealing a hidden always-on Node heap.

## Fixture-backed ARM comparison

Medians below are compared with issue #82's x86_64 GitHub-hosted canonical fixture run. The external fixture is a bounded Node protocol child and is not Codex cost.

| Workload | Pi Ember root RSS | #82 root RSS | Pi total tree RSS | #82 total tree RSS | Pi wall median | #82 wall median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Foreground cognition | 96.72 MiB | 99.79 MiB | 154.11 MiB | 170.43 MiB | 1,527.48 ms | 1,506.61 ms |
| Endogenous wake | 99.78 MiB | 99.12 MiB | 156.64 MiB | 170.08 MiB | 1,541.48 ms | 1,471.87 ms |
| Specialist delegation | 96.73 MiB | 99.50 MiB | 161.03 MiB | 169.39 MiB | 1,534.04 ms | 1,461.60 ms |

The Ember root RSS class is effectively unchanged across platforms: the three Pi medians remain roughly **96.7 to 99.8 MiB**, within about -3.1% to +0.7% of the #82 root medians. The Pi fixture tree is lower mainly because the ARM Node fixture child is smaller, at roughly **64.4 to 64.5 MiB** median rather than roughly 70 MiB on the hosted x86_64 runner.

Fixture wall time is only about 1.4% to 5.0% above the hosted-runner medians despite the different CPU/platform. Root CPU time is higher on the Pi, roughly 420 to 480 ms versus 260 to 270 ms on the hosted runner, but this does not create a steady-state CPU concern because the workers remain bounded and non-resident.

Fixture ranges on the Pi:

- foreground root RSS: 95.45 to 97.78 MiB; total tree: 153.48 to 161.70 MiB;
- endogenous wake root RSS: 96.23 to 100.58 MiB; total tree: 154.53 to 164.70 MiB;
- specialist root RSS: 96.48 to 96.98 MiB; total tree: 154.02 to 161.39 MiB; and
- maximum simultaneous processes: exactly 2 in every retained fixture sample.

## Real Codex measurements

The real provider changes the external process tree materially while leaving the Ember root in the same memory class.

| Workload | Ember root RSS median | External descendants RSS median | Total tree RSS median | Wall median | Total CPU median | Max process count median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Foreground cognition | 95.44 MiB | 107.16 MiB | 197.27 MiB | 7.87 s | 750 ms | 5 |
| Endogenous wake | 97.89 MiB | 105.19 MiB | 202.62 MiB | 6.95 s | 780 ms | 6 |
| Specialist delegation | 96.81 MiB | 149.77 MiB | 240.88 MiB | 23.98 s | 940 ms | 7 |

Real-provider ranges:

- foreground total tree RSS: 192.19 to 201.94 MiB; wall time: 7.42 to 8.22 s;
- endogenous wake total tree RSS: 195.06 to 203.69 MiB; wall time: 5.75 to 8.37 s; and
- specialist total tree RSS: 234.23 to 246.78 MiB; wall time: 19.95 to 25.64 s.

Every retained real-provider sample observed external descendants. Foreground cognition consistently observed 5 simultaneous processes. Endogenous wake observed 5 to 8, with median 6. Specialist delegation consistently observed 7.

The heaviest measured case is specialist delegation, where Codex descendants raise summed tree `VmRSS` to about **240.9 MiB median** while the Ember root remains about **96.8 MiB**. This is evidence that the live external runtime, not Ember's own episodic wrapper, is the dominant memory addition in that workload.

The long specialist wall window is not CPU saturation: its median sampled process-tree CPU is only 940 ms over about 23.98 s. Network/model latency is intentionally part of this live-provider wall time and must not be interpreted as local CPU demand.

## Host pressure and thermals

Pressure snapshots were taken before measurement, after the fixture phase, and after the live-provider phase.

| Snapshot | Available memory | Swap used | 1-minute load | CPU temperature | Pi throttled flags |
| --- | ---: | ---: | ---: | ---: | --- |
| Before | 2,987.14 MiB | 0 MiB | 0.16 | 49.05 °C | `0x0` |
| After fixture | 2,891.53 MiB | 0 MiB | 1.00 | 52.90 °C | `0x0` |
| After real Codex | 2,941.94 MiB | 0 MiB | 0.86 | 53.45 °C | `0x0` |

The host retained roughly **2.94 GiB available memory** after the full capture. Swap remained unused throughout. `vcgencmd get_throttled` reported `0x0` at every snapshot, so the run recorded no current or historical under-voltage/frequency/thermal throttling flags. Temperature rose about 4.4 °C from the pre-run snapshot to the final snapshot, remaining modest for this host.

The small difference in available memory before versus after the run is host-level context, not attributable Ember retained memory: no Ember worker remained resident, Linux cache/background activity can change `MemAvailable`, and the process-count snapshot also moved slightly during the run.

## Conclusion

Issue #84 finds **no concrete constrained-host resource pressure requiring an optimization follow-up** on this Raspberry Pi 5 deployment class:

- steady-state Ember Node residency is zero;
- active Ember root RSS remains roughly 95 to 100 MiB, matching the issue #82 memory class;
- the heaviest observed real Codex tree is about 241 MiB median summed `VmRSS`, small relative to the 4 GiB host and explicitly not unique-physical-memory accounting;
- approximately 2.94 GiB remained available after the full measurement;
- swap usage stayed at zero;
- no Raspberry Pi throttling flags were observed; and
- measured thermal behavior did not reveal pressure.

The live Codex process tree is materially larger and more variable than the deterministic fixture, particularly for specialist delegation, but that cost is episodic and external-runtime dominated. On current evidence there is no reason to reopen ADR 0006, replace Node.js, or optimize the selected episodic topology for memory/CPU before a future workload or deployment change demonstrates actual pressure.
