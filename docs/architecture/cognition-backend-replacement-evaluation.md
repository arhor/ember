---
summary: "Issue #57 evaluation path for replacing cognition loci across episodes, including the fresh-Codex control, bounded backend evidence, and the explicitly pending cross-provider result."
read_when:
  - "Running or reviewing issue #57 cognition-backend replacement evaluation"
  - "Adding a second supported cognition adapter to the longitudinal continuity harness"
  - "Interpreting backend version, configuration, thread, lineage, or durable-state evidence across cognition episodes"
role: guide
discovery_status: current
---

# Cognition-Backend Replacement Evaluation

Issue [#57](https://github.com/arhor/ember/issues/57) tests the hypothesis that a
cognition provider is a replaceable operational locus rather than Ember's
identity or memory owner. The deterministic repository scenario
`test-fixtures/longitudinal/backend-replacement-control.json` implements the first
phase: the same bounded continuity vector is evaluated through two deliberately
fresh Codex loci while canonical Ember state is unchanged.

This is a same-backend fresh-thread control, not full cross-provider proof. Issue
[#90](https://github.com/arhor/ember/issues/90), the planned Cursor production
adapter, remains open as of this evidence. Consequently the repository does not
claim that provider-specific cognition differences have been validated yet.

## What the control establishes

The fixture evaluates the harness's fixed backend-replacement checks before and
after locus replacement. The harness deterministically checks that:

- both episodes receive the same selected meaning IDs and exclude the same private
  meaning;
- lineage, current and historical meanings, live commitments, and explicit gaps
  are unchanged before the replacement episode;
- both external threads are fresh and distinct;
- the selected backend is the backend the provider reports actually running; and
- provider and thread evidence remains in the evaluation report rather than
  canonical Ember state.

The reply checks remain model observations. They cannot repair a failed canonical
state, projection, routing, or freshness assertion.

## Run the control

Deterministically, without login or network:

```sh
node scripts/run-longitudinal-scenario.ts \
  --scenario test-fixtures/longitudinal/backend-replacement-control.json
```

Against live Codex, opt in explicitly:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node scripts/run-longitudinal-scenario.ts \
  --provider codex \
  --scenario test-fixtures/longitudinal/backend-replacement-control.json \
  --timeout-seconds 180
```

Live reports include the installed Codex version and bounded effective adapter
configuration, including sanitized explicit arguments and model-selection-relevant
options. Credential-like and unknown values are redacted. Do not commit raw
reports; replies and operational thread IDs may contain account-local or
model-generated material.

## Recorded live control evidence

On **September 1, 2026**, the live command above completed against
`codex-cli 0.152.0` with no model override. Both episodes used the production
`codex-exec` adapter with fresh persistent threads, read-only sandboxing, an
isolated working directory, ignored user configuration, and no explicit Codex
arguments.

All deterministic Ember assertions and all empirical reply observations passed.
The run observed two distinct non-null thread identifiers without preserving
their values here. Lineage was consistent, durable meaning was unchanged, both
episodes received the same selected meaning IDs, and neither projection nor reply
contained the forbidden out-of-scope marker. The raw mode-0600 report remained a
temporary local artifact and is not repository evidence.

This result establishes only the same-backend control. It does not change the
cross-provider phase from pending to proven.

## Completing the cross-provider phase

Once a second supported production adapter exists, add a fixture (or promote this
one) with `backend_replacement.status` set to `cross_provider` and different
`cognition_backend` values for the named control and replacement episodes. Route
each label to its real adapter. Preserve adapter-specific version and
configuration metadata rather than normalizing it into false equivalence.

Run the identical continuity vector and bounded projection expectations. Record a
sanitized repository evidence summary that distinguishes deterministic Ember
assertions from empirical provider observations and describes provider-specific
differences or failures without weakening the accepted continuity semantics.
