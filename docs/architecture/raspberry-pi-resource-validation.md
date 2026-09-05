---
summary: "Issue #84 constrained-host runbook for measuring Ember's episodic runtime on Raspberry Pi-class ARM hardware with fixture and real-provider attribution."
read_when:
  - "Running Ember resource measurements on Raspberry Pi or constrained ARM Linux hardware"
  - "Comparing Raspberry Pi resource evidence with the issue #82 hosted-runner baseline"
  - "Deciding whether constrained-host runtime optimization is justified by measured pressure"
role: guide
discovery_status: current
---

# Raspberry Pi Resource Validation

## Purpose

Issue [#84](https://github.com/arhor/ember/issues/84) validates the issue #82 runtime-resource baseline on the intended constrained always-on deployment class. It does not reopen the episodic topology decision and it does not justify optimization before target-host evidence exists.

The production topology has no resident Ember Node process between episodic activations. The constrained-host measurement therefore preserves the same semantic boundary as issue #82:

1. idle means no resident Ember Node worker;
2. foreground cognition, endogenous wake, and specialist delegation are measured as bounded active episodes; and
3. external provider descendants are attributed separately from the Ember root process.

PR [#138](https://github.com/arhor/ember/pull/138) already validated the real ARM Linux path `systemd --user -> Node -> Codex -> durable Ember evidence -> clean exit` for both wake and specialist work. Issue #84 measures that deployment class rather than repeating the live-smoke design proof.

## Capture command

Run from a clean checkout of the issue #84 branch on the target Raspberry Pi-class host:

```bash
npm ci
npm run check
npm run --silent eval:runtime-resource:constrained > raspberry-pi-resource-evidence.json
node -e 'JSON.parse(require("node:fs").readFileSync("raspberry-pi-resource-evidence.json", "utf8"))'
```

`--silent` is required when redirecting stdout to the evidence file. Without it, npm writes its script banner to stdout before the JSON payload, producing a human-readable file whose first lines are not valid JSON.

The constrained-host wrapper discovers `codex` from `PATH`. If the executable is intentionally outside `PATH`, pass it explicitly without committing the machine-local path:

```bash
npm run --silent eval:runtime-resource:constrained -- \
  --provider-command "$(command -v codex)" \
  > raspberry-pi-resource-evidence.json
```

Do not commit shell history, credentials, environment dumps, hostnames, usernames, IP addresses, or machine-local provider paths. The wrapper deliberately records only the provider basename/version and resource-relevant host facts.

For a fixture-only diagnostic that performs no real provider calls:

```bash
npm run --silent eval:runtime-resource:constrained -- --fixture-only
```

Fixture-only output is useful for debugging the measurement harness but is insufficient to close issue #84 because it does not validate the real external-runtime process tree.

## Workloads and repetition

The fixture half preserves the issue #82 canonical shape:

- one discarded warm-up and five retained samples;
- 1,500 ms idle observation;
- 10 ms `/proc` sample interval;
- 1,200 ms fixture hold window; and
- the same foreground cognition, endogenous wake, and specialist delegation entrypoints.

The real-provider half uses the same three workloads and one discarded warm-up, but defaults to three retained samples rather than five. This is an explicit constrained-host deviation to bound repeated real model calls while still retaining a range and median. Use `--live-repeat 5` when a directly matched five-sample provider comparison is worth the additional runtime/model calls.

The wrapper supports `--fixture-repeat`, `--live-repeat`, `--warmup`, `--idle-ms`, `--sample-ms`, `--hold-ms`, repeated `--provider-arg`, and `--provider-command`. Any non-default value used for canonical issue #84 evidence must be retained in the emitted methodology rather than described only in prose.

## Host and pressure evidence

The combined JSON records resource-relevant host identity without recording private machine identity:

- device model from `/proc/device-tree/model` when available;
- OS release, kernel, architecture, Node version, CPU model/count, and total RAM;
- real provider basename and `--version` output;
- whether the systemd user manager is reachable;
- memory available plus swap total/free/used;
- load averages and process count;
- running user-service count without service names;
- CPU temperature when exposed through Linux thermal sysfs; and
- Raspberry Pi `vcgencmd get_throttled` flags when the utility is available.

Pressure snapshots are taken before the fixture run, after the fixture run, and after the real-provider run. They are context for interpretation, not a claim that all host memory/load changes were caused by Ember. Shared background services remain outside Ember's process-tree attribution.

The nested fixture and external evaluations retain the issue #82 `/proc` metrics:

- Ember root peak `VmRSS`;
- external-descendant peak summed `VmRSS`;
- total process-tree peak summed `VmRSS`;
- sampled root/external CPU time and average wall-window CPU percentage; and
- maximum concurrent process count.

Summed `VmRSS` is not PSS and can double-count shared physical pages. If the target host shows concrete memory or swap pressure, collect PSS or `smaps_rollup` as an additional follow-up metric rather than silently changing the issue #82 comparison metric.

## Evidence acceptance

Before committing the target-host evidence, verify:

- `environment.architecture` is ARM64/aarch64-equivalent for the intended host;
- the device model and RAM describe the target deployment class;
- both nested evaluations report the same Ember revision;
- fixture mode has zero resident Ember processes during idle;
- external mode uses the real provider rather than the bounded fixture;
- every active workload observes the expected external process boundary where applicable;
- swap, thermal, or throttling signals are reported rather than omitted from interpretation when present; and
- no private machine identifier or credential material appears in the JSON.

The final evidence note should compare target-host fixture medians with the issue #82 hosted-runner fixture baseline, then interpret the real-provider numbers separately. A resource optimization follow-up is justified only when these measurements show concrete memory, swap, CPU, thermal, or latency pressure on the intended deployment class.
