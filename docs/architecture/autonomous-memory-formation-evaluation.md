---
summary: "Issue #224 deterministic and opt-in live longitudinal evaluation for selective autonomous memory formation, correction, deduplication, currentness, bounded context, and provenance."
read_when:
  - "Running or interpreting the autonomous memory-formation evaluation"
  - "Adding longitudinal scenarios for conversation-derived memory adoption, rejection, correction, deduplication, restart, or provenance"
  - "Using memory-formation evidence as an input to a behavioral-health scorecard"
role: guide
discovery_status: current
---

# Autonomous Memory Formation Evaluation

Issue [#224](https://github.com/arhor/ember/issues/224) adds a repository-owned
longitudinal evaluation of the proposal, adoption, and persistence boundaries from
issues #221 through #223. The harness drives production `runCognition`, conversation
projection, canonical state persistence, restart, deterministic adoption policy, and
the durable proposal-generation ledger. It is evaluation infrastructure, not a second
memory policy.

## Run it

Run the deterministic fixture without external credentials:

```bash
npm run eval:memory-formation
```

Write a new report file with:

```bash
npm run eval:memory-formation -- --report ./memory-formation-report.json
```

The report path must not already exist. A nonzero exit means an Ember-owned fixture
assertion or requested metric failed.

The representative live mode is deliberately opt-in and constructs an isolated Claude
Code provider for each proposal-generation episode, with tools, MCP, settings, skills,
plugins, and session persistence disabled:

```bash
EMBER_RUN_LIVE_MEMORY_FORMATION=1 npm run eval:memory-formation:live
```

Live output is model evidence, not a replacement for deterministic policy proof. Live
expectations allow semantically equivalent non-adoption decisions such as a valid
`no_proposal` instead of a generated candidate that the policy rejects. The report
separates `ember_assertions_passed` from `model_observations_passed`. Deterministic
mode keeps exact fixture decisions, reasons, current-state expectations, and all-zero
requested metrics on the Ember assertion / exit-code-1 path. Live mode uses semantic
decision allowances and reserves exit code 2 for model-observation misses;
duplicate-state or scope/provenance regressions remain Ember failures. The provider
configuration establishes fresh invocation intent,
but the evaluation does not claim an observed external session identity that the
proposal-generator contract does not expose.

## Coverage and interpretation

The default fixture covers stable preference, fact, and relationship adoption, transient
incidental detail, ambiguous low-confidence meaning, explicit correction across a
runtime restart and fresh provider invocation, repeated evidence without duplicate
proliferation, conflicting stale-revival pressure, missing and cross-scope provenance,
bounded recent dialogue, and canonical availability after the source dialogue leaves
that bound.

Every episode reports the expected and observed decision, rejection or invalidity
reason, allowed live decisions, complete proposal outcome, bounded source evidence,
projection size, current meaning count, and adopted-meaning provenance back to the
expected principal, actor, scope, and user-command evidence. The
top-level scorecard-ready metrics are:

- `false_adoption`: adoption where the fixture expected no adoption;
- `missed_adoption`: failure to adopt supported durable meaning;
- `duplicate_adoption`: multiple current meanings occupying one semantic slot;
- `correction_supersession`: cases, errors, and accuracy for correction scenarios;
- `stale_memory_revival`: adoption under named stale-revival pressure; and
- `scope_provenance_violations`: an adopted meaning whose source does not resolve to
  durable user-command evidence.

`context_size` reports projection bytes by episode and its observed range.
`context_persistence` separately reports whether the first adopted source is still in
recent dialogue and whether its adopted meaning remains canonical. That distinction
prevents transcript retention from being mistaken for memory. All deterministic
error counts should be zero, while the full episode evidence remains available for a
future unified behavioral-health scorecard.

Keep added fixtures synthetic and deterministic. Expectations should name semantic
decisions and stable policy reasons rather than generated IDs or timestamps. Live
allowances may broaden only the pipeline decision, not whether adoption is acceptable.
Provider threads or hidden transcripts may not establish continuity or provenance.
