---
summary: "Issue #57 evaluation path for replacing cognition loci across episodes, including the fresh-Codex control and the Codex-to-Cursor cross-provider scenario."
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
`eval/longitudinal/fixtures/backend-replacement-control.json` implements the first
phase: the same bounded continuity vector is evaluated through two deliberately
fresh Codex loci while canonical Ember state is unchanged.

The repository also contains
`eval/longitudinal/fixtures/backend-replacement-cross-provider.json`, which routes
the same vector through Codex and then the production Cursor backend. Its
deterministic form proves routing, projection, state, lineage, and evidence
invariants without requiring either login; live model behavior remains an
explicit opt-in observation.

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
node eval/longitudinal/run.ts \
  --scenario eval/longitudinal/fixtures/backend-replacement-control.json
```

Against live Codex, opt in explicitly:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node eval/longitudinal/run.ts \
  --provider codex \
  --scenario eval/longitudinal/fixtures/backend-replacement-control.json \
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

## Cross-provider phase

Run deterministic cross-provider evaluation with:

```sh
node eval/longitudinal/run.ts \
  --scenario eval/longitudinal/fixtures/backend-replacement-cross-provider.json
```

Run both real adapters only with explicit opt-in and working runtime-owned logins:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node eval/longitudinal/run.ts \
  --provider codex-cursor \
  --scenario eval/longitudinal/fixtures/backend-replacement-cross-provider.json \
  --timeout-seconds 180
```

The report preserves distinct adapter names, versions, session modes, sandbox
claims, and configuration evidence rather than normalizing them into false
equivalence. Cursor uses Ask mode with sandboxing and JSON terminal output; Codex
uses read-only execution with an output schema and ignored user configuration.

Do not commit raw live reports. Record only a sanitized summary distinguishing
deterministic Ember assertions from empirical provider observations.

## Recorded live cross-provider evidence

On **September 1, 2026**, the live cross-provider command completed against
`codex-cli 0.152.0` and Cursor Agent `2026.08.31-4057e58`, with no model override.
The Codex control used the production `codex-exec` adapter with a fresh persistent
thread, read-only sandbox, isolated cwd, and ignored user configuration. The
Cursor replacement used the production `cursor-agent-print` adapter with a fresh
session, Ask mode, sandboxing enabled, an isolated trusted workspace, and an
adapter-owned policy denying shell, file, web, and MCP tool execution. Cursor's
current CLI does not prove exclusion of runtime-owned account/team rules or MCP
metadata, so this result makes no such context-isolation claim.

All deterministic Ember assertions and empirical reply observations passed. Both
episodes received the same four permitted meanings and excluded the private
marker. Lineage and durable state were unchanged across replacement, backend
routing and metadata matched the adapters actually invoked, and each runtime
reported a fresh non-null operational identifier whose value is intentionally not
preserved here. The mode-0600 raw report was deleted after this sanitized summary
was recorded.

This observation supports the replaceable-cognition-locus claim for this bounded
vector. It does not claim equivalent model quality, configuration, tools,
cancellation guarantees, or general specialist-runtime interchangeability.
