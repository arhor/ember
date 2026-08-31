---
summary: "Repository-owned longitudinal cognition evaluation harness for controlled Ember state, process restarts, external-thread variation, bounded-projection assertions, and separately reported live-model observations."
read_when:
  - "Running or adding a multi-episode continuity evaluation against scripted or live cognition"
  - "Interpreting whether a longitudinal failure belongs to Ember state/projection behavior or empirical model behavior"
  - "Evaluating restart, missing context, superseded meanings, live commitments, provenance, provider replacement, or external-thread reuse over repeated cognition episodes"
role: guide
discovery_status: current
---

# Longitudinal Continuity Harness

The issue [#54](https://github.com/arhor/ember/issues/54) harness executes a
repository-owned JSON scenario against one durable Ember store over multiple
cognition episodes. It varies Ember runtime restart, cognition-backend label, and
fresh versus reused external thread independently. The harness is evaluation
infrastructure, not a second continuity implementation: state changes use the
minimal slice's semantic operations, projections use `buildProjection`, cognition
uses `runCognition`, and restarts use the existing runtime/store boundary.

The representative scenario is
`test-fixtures/longitudinal/restart-thread-continuity.json`. It establishes a
relationship, sourced fact, preference, live Ember commitment, deliberately
out-of-scope marker, and an episode with optional detail. Across three episodes it
supersedes the preference, makes the detail unavailable, restarts Ember twice,
starts a fresh provider thread, and finally reuses the first provider thread.

The runner is an orchestration process, not the continuity-bearing Ember runtime.
For `restart_ember`, it cleanly stops the current runtime episode, commits that
boundary, reloads the canonical store, and starts a new runtime episode with a new
runtime ID and recovery account before cognition. The orchestration process stays
alive so it can retain scenario aliases and provider-thread controls; neither of
those is projected or added to canonical Ember state. The existing CLI
longitudinal acceptance test remains the physical-PID restart probe. This harness
asserts the representation-neutral restart boundary that #54 varies independently
from external-thread lifetime.

## Run it

The deterministic runner needs no login, subscription, or network:

```sh
npm run eval:continuity
node --test test/longitudinal-harness.test.ts
```

Live Codex execution is deliberately opt-in and uses the installed runtime's
existing authentication without handling credentials:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node scripts/run-longitudinal-scenario.ts \
  --provider codex \
  --timeout-seconds 180
```

Use `--scenario PATH` for another fixture and `--report NEW_PATH` to create a
mode-0600 JSON report instead of writing it to stdout. The report path must not
already exist. `--codex-arg VALUE` may be repeated for explicit runtime-owned auth
or model configuration, as in the minimal continuity runbook. Do not commit raw
live reports: provider replies and external thread identifiers are operational
evidence and may contain model-generated or account-local information.

Fresh live harness episodes use persistent Codex threads only because a later
episode may name one for explicit reuse. Reused episodes call `codex exec resume`
with that exact observed thread identifier. The ordinary production Codex adapter
still defaults to a fresh ephemeral thread on every invocation; the harness does
not change that default.

## Scenario vocabulary

A version-1 scenario contains:

- stable scenario and Ember identity metadata;
- ordered setup actions and at least two ordered episodes;
- explicit UTC time on every state change and episode;
- an episode `cognition_backend` label, which lets a provider implementation route
  different episodes to different backends without making a backend canonical;
- `restart_ember`, independent of `external_thread` (`fresh` or reuse of a named
  earlier episode);
- ordinary or explain projection purpose, with meaning/evidence aliases instead
  of generated repository IDs;
- exact expected selected-meaning aliases and forbidden-meaning aliases;
- optional reply substrings expected present or absent.

Supported setup/change actions mirror the existing fixture semantics:
`remember_relationship`, `remember_fact`, `remember_preference`, `undertake`,
`remember_episode`, `attach_detail`, `supersede`, and `withhold_detail`. The
fixture-only withholding action represents unavailable retrieval detail, not
privacy deletion.

To add a scenario, copy the representative JSON, use unique aliases, keep all
content synthetic, add the relevant semantic vector, then run the deterministic
runner and tests. A backend-switch scenario can assign different
`cognition_backend` values; its provider callback must route each label explicitly
and preserve the same bounded `ProviderRequest`/validated `ProviderResult` seam.

## Interpret the report

Every episode records four evidence layers:

1. `canonical_before` is Ember's inspectable durable state before cognition.
2. `projection` is the exact purpose-bounded request content selected by Ember.
3. `provider_result`, external-thread control, and observed thread ID are empirical
   provider evidence.
4. `canonical_after` shows descriptor-only reintegration and operational episode
   evidence after cognition.

`ember_assertions` check exact selection, forbidden-ID exclusion, lineage,
transcript exclusion, runtime restart, and requested thread identity. These are
deterministic architecture checks. `model_observations` check reply substrings.
They are empirical observations, even when a scripted provider makes them stable
in CI. The top-level `ember_assertions_passed` and
`model_observations_passed` therefore remain separate.

The command exits 1 for an Ember assertion failure and 2 when Ember assertions
pass but model observations fail. A polished live reply cannot repair a projection
failure. Conversely, a live model failure does not prove that canonical state was
lost when the state and projection layers are correct.

The harness preserves the governing ADR boundaries: the lineage and durable
meaning remain Ember-owned; historical superseded meaning survives without
governing ordinary projection; unavailable detail becomes an explicit gap;
selection includes deliberate exclusion; provider/thread IDs remain operational
evidence rather than memory or identity; and restart recovery records downtime
rather than inventing experience.
