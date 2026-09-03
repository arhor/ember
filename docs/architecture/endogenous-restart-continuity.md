---
summary: "Issue #77 deterministic and live evaluation proving that endogenous concerns, their lifecycle, and truthful operational gaps survive complete Ember process restart without provider-thread continuity."
read_when:
  - "Implementing or reviewing restart continuity for endogenous cognition reasons or concerns"
  - "Running the deterministic or live issue #77 endogenous restart scenarios"
  - "Inspecting concern reactivation, resolved or superseded controls, intentional silence, or fresh provider behavior after restart"
role: guide
discovery_status: current
---

# Endogenous Restart Continuity

Issue #77 tests one narrow claim: a topic-free cognition opportunity after a complete
Ember process restart is grounded by current Ember-owned durable state, not by an
external model conversation or an inferred account of cognition during downtime.

## Reproducible scenarios

`test-fixtures/endogenous/restart-scenarios.json` defines four deterministic controls:

- a live commitment plus its current consequence reactivates after restart;
- a fulfilled commitment remains historical and produces `no_cognition`;
- a superseded concern-driving consequence preserves its replacement linkage, remains
  historical, and cannot reactivate the still-live commitment; and
- empty relevant state produces a successful, intentional `no_cognition` outcome.

The superseded control is deliberately precise about the current model. Commitments
are discharged as fulfilled or cancelled; current v1 supersession is defined for
user-testimony facts and preferences. The fixture therefore proves that the durable
reason making a still-live concern relevant can be superseded before restart, that
both `superseded_by` and `supersedes` survive the process boundary, and that only the
replacement reason remains current afterwards. It does not invent an unsupported
"superseded commitment" lifecycle.

The harness starts a preparation worker, durably records and cleanly stops its
runtime, waits for that OS process to exit, and starts a different worker against
the same store. The second process creates a new runtime and evaluates the ordinary
topic-free `runtime_start` opportunity. The deterministic evaluator has no network,
subscription, transcript, or hidden session dependency.

Run the proof through the normal suite:

```sh
npm test
npm run check
```

## Durable inspection evidence

The proof relies on existing canonical fields rather than a second concern store:

- current and historical meanings preserve commitment lifecycle and the exact
  supersession links of concern-driving state;
- `runtime_episodes[].recovery_account` records a `known_clean_stop_interval`,
  `none_in_supported_runtime` for Ember cognition during that interval, and unknown
  external changes;
- `cognition_opportunities[]` records projected and selected meaning IDs, status,
  decision, and interruption status without raw reasoning; and
- distinct process and runtime IDs establish a complete restart while the lineage ID
  remains stable.

Missing operational detail is therefore represented as a bounded recovery account,
not filled with a model-written bridge. Historical meanings remain available for
inspection but are excluded from the ordinary post-restart projection.

## Opt-in live Codex scenario

The live command runs only the positive synthetic scenario. Its post-restart worker
uses the production Codex opportunity evaluator with an explicitly ephemeral thread
policy and forbids prior threads and outside context:

```sh
EMBER_RUN_LIVE_ENDOGENOUS_RESTART=1 npm run eval:endogenous:restart:live -- \
  --timeout-seconds 180 \
  --report /tmp/ember-77-endogenous-restart.json
```

The report is sanitized, contains aliases and assertions rather than generated IDs
or model text, is created with mode `0600`, and must not already exist. The fresh
provider is invoked only after the preparation process has terminated; the first
process performs no model call and exposes no thread to resume.

The live assertion does not infer freshness merely from the selected execution mode.
The worker wraps the production provider invocation, observes the provider's actual
`thread.started` evidence through `ProviderResult.operational.external_thread_id`,
and retains only a boolean `provider_thread_observed` signal in the sanitized report.
The live proof fails if no external thread ID is actually observed after restart.

This proves restart grounding and intentional silence, not continuous background
thought, a scheduler, authority to interrupt the user, or a durable model-generated
motive. Those remain outside issue #77.
