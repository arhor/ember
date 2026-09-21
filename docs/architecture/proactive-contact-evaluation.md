---
summary: "Issue #229 deterministic and opt-in live evaluation for useful proactive contact, deliberate silence, currentness, duplicate suppression, restart, and delivery uncertainty."
read_when:
  - "Running or interpreting the proactive-contact and deliberate-silence evaluation"
  - "Adding scenarios for contact precision, interruption, currentness, duplicate suppression, restart, or delivery uncertainty"
  - "Using proactive-contact evidence as an input to a behavioral-health scorecard"
role: guide
discovery_status: current
---

# Proactive-Contact and Deliberate-Silence Evaluation

Issue [#229](https://github.com/arhor/ember/issues/229) evaluates the contact path
defined by the durable [contact intent](proactive-contact-intent.md) and
[attention policy](proactive-contact-attention-policy.md). It does not treat a
message string as proof of a good decision: every case declares and reports the
exact expected policy outcome and basis, canonical source-evidence IDs separately
from grounding-meaning IDs, policy-observation evidence, delivery observation, and
independent Ember/model assertions.

## Run it

Run the deterministic suite with:

```bash
npm run eval:proactive-contact
```

Write a new private report (the path must not already exist) with:

```bash
npm run eval:proactive-contact -- --report /absolute/path/report.json
```

The representative live path asks a freshly isolated Claude Code invocation to
classify the clearly useful and low-value concerns, then runs those observations
through the same Ember policy suite. It is deliberately opt-in and uses no tools,
session persistence, project settings, skills, plugins, or MCP servers:

```bash
npm run eval:proactive-contact:live
```

Live classification never chooses the deterministic policy path. Exit code `1`
means an Ember-owned policy or persistence assertion failed; exit code `2` means
only the model observations missed their fixture expectations.
The live path does not send a real message.

## Coverage and interpretation

The version-1 fixture covers useful contact, low-value silence, quiet-period
deferral, duplicate and superseded intents, staleness before delivery, restart
between decision and delivery with fresh revalidation and one durable handoff,
uncertain then confirmed delivery, repeated opportunities, and suppression of an
old grounding followed by contact from its current remembered successor.

`contact_precision` penalizes unwanted contact and `contact_recall` penalizes missed
useful contact. The report also exposes unwanted interruption, deliberate silence,
stale-contact suppression, duplicate suppression, uncertainty handling, and restart
outcomes. `scorecard_input: true` marks the stable report envelope for future unified
behavioral-health aggregation; it is not a single health score. An uncertain send
(`blocked_uncertain`) remaining handed off until stronger confirmation is success, while blind retry or
premature satisfaction is failure. Deferral and suppression are successful silence
when the fixture expects no immediate interruption.
