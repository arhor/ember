---
summary: "Issue #84 target-host evidence record for Ember resource usage on Raspberry Pi-class ARM hardware."
read_when:
  - "Reviewing measured Raspberry Pi resource pressure or comparing it with issue #82"
  - "Deciding whether Ember needs constrained-host memory, CPU, swap, or thermal optimization"
role: evidence
discovery_status: current
---

# Raspberry Pi Resource Evidence

## Status

Target-host resource capture is pending on this branch. The measurement procedure is defined in [raspberry-pi-resource-validation.md](raspberry-pi-resource-validation.md).

The same deployment class has already passed the real systemd/Node/Codex lifecycle smoke recorded by PR [#138](https://github.com/arhor/ember/pull/138). This document must not substitute that lifecycle result for issue #84 resource measurements.

## Acceptance boundary

Issue #84 is complete only after this document records a real Raspberry Pi-class ARM capture containing:

- hardware model/RAM, OS/kernel/architecture, Node and Codex versions;
- idle zero-residency evidence;
- fixture-backed foreground cognition, endogenous wake, and specialist measurements comparable with issue #82;
- real-Codex foreground cognition, endogenous wake, and specialist measurements;
- root versus external-descendant process attribution;
- memory/swap/load/temperature/throttling context; and
- a conclusion tied to measured target-host pressure.

Until those measurements are attached to this document, no constrained-host optimization conclusion is recorded.
