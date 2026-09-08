---
summary: "Measured issue #207 operational deltas for the Telegram transport migration from the direct-fetch worker to node-telegram-bot-api 2.1.0."
read_when:
  - "Reviewing Telegram transport resource cost, shutdown latency, or the operational evidence behind issue #207"
  - "Re-measuring the Telegram worker after changing its Bot API client, polling loop, or shutdown behavior"
role: reference
discovery_status: current
---

# Telegram Transport Operational Evidence

> Measurement date: 2026-09-08. These are comparative Linux CI measurements, not
> Raspberry Pi absolute capacity claims. Re-run the same probe on the deployment host
> when target-specific RSS or latency matters.

Issue #207 replaces Ember's hand-written Telegram HTTP plumbing with
`node-telegram-bot-api@2.1.0` while retaining Ember-owned polling, acknowledgement,
replay, delivery reconciliation, writer-lease ownership, and shutdown admission.

## Measurement environment

- GitHub-hosted Ubuntu 24.04 x64 runner;
- Node.js v26.8.1;
- five isolated child-process samples per revision, median reported;
- baseline `f4bd5531ff0c49d913afda8ef860fefc291a889f` (`master` before #207);
- candidate `06ee074b521077c97556f1d468461dcb60b3d7b8` (issue #207 branch at measurement time);
- both revisions installed independently from their committed lockfiles.

## Results

| Metric                                      |                   Baseline |                  Candidate |                 Delta |
| ------------------------------------------- | -------------------------: | -------------------------: | --------------------: |
| Total installed `node_modules`              | 128,701,115 B (122.74 MiB) | 129,982,837 B (123.96 MiB) | +1,281,722 B (+1.00%) |
| `node-telegram-bot-api` installed footprint |                        0 B |     1,281,349 B (1.22 MiB) |          +1,281,349 B |
| Idle worker RSS                             | 106,090,496 B (101.18 MiB) | 106,729,472 B (101.79 MiB) |   +638,976 B (+0.60%) |
| Long-poll wait RSS                          | 106,020,864 B (101.11 MiB) | 106,729,472 B (101.79 MiB) |   +708,608 B (+0.67%) |
| Idle shutdown latency                       |                   0.273 ms |                   0.272 ms |    -0.001 ms (-0.50%) |
| Admitted-handler shutdown latency           |                   2.889 ms |                 324.825 ms |           +321.936 ms |

The dependency and install-footprint delta is deterministic for these lockfiles. RSS
and latency are micro-benchmark evidence and naturally contain host/runtime noise; use
them to detect order-of-magnitude regressions rather than as deployment SLOs.

The admitted-handler shutdown delta is expected and is primarily semantic rather than
library overhead. The baseline propagated the service shutdown signal into the already
accepted provider invocation, so most samples returned almost immediately by
cancellation. Issue #207 stops admitting new updates and aborts idle long polling, but
allows an already admitted update to finish its bounded provider/delivery durable
handoff. The higher candidate latency is therefore the cost of truthful drain behavior.
The enclosing systemd stop timeout remains the forced-termination bound.

## Reproduce

The probe lives in `scripts/telegram-transport-metrics.mjs`. Install the two revisions
independently on the same host and run:

```bash
node scripts/telegram-transport-metrics.mjs compare \
  --baseline /ABSOLUTE/PATH/TO/BASELINE \
  --candidate /ABSOLUTE/PATH/TO/CANDIDATE \
  --samples 5
```

Run that same comparison on the Raspberry Pi deployment host when absolute Pi RSS or
shutdown latency becomes a capacity decision. Keep Node version, install mode, and host
constant so the delta remains meaningful.
