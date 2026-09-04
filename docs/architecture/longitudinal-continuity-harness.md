---
summary: "Repository-owned longitudinal cognition evaluation harness for controlled Ember state, generated memory/context pressure, process restarts, bounded-projection evidence, and separately reported model observations."
read_when:
  - "Running or adding a multi-episode continuity, memory, or context-selection evaluation against scripted or live cognition"
  - "Interpreting whether a longitudinal failure belongs to Ember state/projection behavior or empirical model behavior"
  - "Evaluating relevant, irrelevant, superseded, unavailable, or forbidden meaning under long controlled histories"
  - "Evaluating restart, missing context, live commitments, provenance, provider replacement, or external-thread reuse over repeated cognition episodes"
role: guide
discovery_status: current
---

# Longitudinal Continuity Harness

The issue [#54](https://github.com/arhor/ember/issues/54) harness executes a
repository-owned JSON scenario against one durable Ember store over multiple
cognition episodes. Issue [#66](https://github.com/arhor/ember/issues/66) extends
that same scenario format with deterministic long-history generation and explicit
memory/context classifications instead of creating a competing evaluator. It can
therefore vary Ember runtime restart, cognition-backend selection, external-thread
lifetime, history pressure, semantic changes, and projection expectations while
keeping one evidence format.

The harness is evaluation infrastructure, not a second continuity or retrieval
implementation: state changes use the minimal slice's semantic operations,
projections use `buildProjection`, cognition uses `runCognition`, and restarts use
the existing runtime/store boundary. Generated history is expanded into those same
semantic operations before the scenario's explicit setup. It does not bypass
canonical validation or introduce a search/index representation.

Two representative scenarios show the main uses:

- `eval/longitudinal/fixtures/restart-thread-continuity.json` establishes a
  relationship, sourced fact, preference, live Ember commitment, deliberately
  out-of-scope marker, and an episode with optional detail. Across three episodes
  it supersedes the preference, makes the detail unavailable, restarts Ember,
  and varies external provider threads.
- `eval/longitudinal/fixtures/memory-context-pressure.json` deterministically
  generates a long same-scope fact history, then declares relevant, irrelevant,
  superseded, unavailable, and forbidden meanings while preference currentness and
  detail availability change. Its purpose is to prove that selection evidence can
  be captured under pressure, not to pre-decide the harm rubric that #70 owns.
- `eval/longitudinal/fixtures/provenance-pressure.json` mixes user testimony,
  external claims, direct Ember observation, delegated reports, and Ember inference.
  Delegated/inferred branches deliberately share evidence roots so repeated reports
  cannot masquerade as independent corroboration.

The runner is an orchestration process, not the continuity-bearing Ember runtime.
For `restart_ember`, it cleanly stops the current runtime episode, commits that
boundary, reloads the canonical store, and starts a new runtime episode with a new
runtime ID and recovery account before cognition. The orchestration process stays
alive so it can retain scenario aliases, generated alias groups, and provider-thread
controls; none of those evaluator conveniences is projected or added as canonical
meaning. The existing CLI longitudinal acceptance test remains the physical-PID
restart probe.

## Run it

The deterministic runners need no login, subscription, or network:

```sh
npm run eval:continuity
npm run eval:memory-context
npm run eval:provenance
node --test tests/longitudinal-harness.test.ts tests/longitudinal-memory-context.test.ts tests/longitudinal-provenance.test.ts
```

The memory/context fixture can use the same opt-in live provider layer:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node eval/longitudinal/run.ts \
  --scenario eval/longitudinal/fixtures/memory-context-pressure.json \
  --provider codex \
  --timeout-seconds 180
```

Use `--scenario PATH` for another fixture and `--report NEW_PATH` to create a
mode-0600 JSON report instead of writing it to stdout. The report path must not
already exist. `--codex-arg VALUE` and `--cursor-arg VALUE` may be repeated for
explicit runtime-owned provider configuration. Do not commit raw live reports:
provider replies and external thread identifiers are operational evidence and may
contain model-generated or account-local information.

Fresh live harness episodes use persistent external threads only because a later
episode may name one for explicit reuse. When a scenario reuses a Codex thread,
the runner resumes the exact observed thread ID. The ordinary production Codex
adapter still defaults to a fresh ephemeral thread on every invocation; the
harness does not make external session lifetime part of Ember continuity.

The runner rejects a scenario backend for which the selected live runner has no
adapter. A `cognition_backend` value is therefore routing input, not an unchecked
report label. Every provider invocation also returns bounded backend evidence:
backend name, adapter name, version, and scalar non-secret configuration. The
harness verifies that the reported backend matches the selected backend and
rejects thread/session/conversation identifiers in configuration. External thread
IDs remain in their dedicated operational report field.

The live Codex runner records a bounded JSON rendering of explicit arguments and
a separate model-selection summary. Model, profile, model-provider, reasoning,
verbosity, and service-tier values remain visible so materially different runs can
be distinguished. Credential-like configuration, unknown option values, and
positional values are redacted; user configuration remains ignored by the adapter.

## Scenario vocabulary

A version-1 scenario contains:

- stable scenario and Ember identity metadata;
- optional deterministic `history` generators;
- ordered explicit setup actions and at least two ordered cognition episodes;
- explicit UTC time on every state change and episode;
- an episode `cognition_backend` label;
- `restart_ember`, independent of `external_thread` (`fresh` or reuse of a named
  earlier episode);
- ordinary or explain projection purpose, with meaning/evidence aliases instead
  of generated repository IDs;
- exact expected selected/forbidden meaning aliases, plus optional
  generated-history groups for either set;
- optional relevant, irrelevant, superseded, and unavailable classifications;
- optional reply substrings expected present or absent;
- optionally, a `backend_replacement` comparison naming an earlier control and a
  later replacement episode.

### Deterministic long-history generation

`history` currently supports `remember_fact_series`. A generator such as:

```json
{
  "generate": "remember_fact_series",
  "as": "ambient_project_history",
  "count": 64,
  "slot_prefix": "ambient-history",
  "scope": "project:ember/memory-context",
  "text_prefix": "Synthetic ambient project history item",
  "start_at": "2026-09-02T08:01:00Z",
  "interval_seconds": 30
}
```

expands deterministically to aliases
`ambient_project_history.0001` through `ambient_project_history.0064`, unique slots,
stable text, and stable timestamps. The generated actions are ordinary
`remember_fact` mutations and therefore pass through the same state validation as
hand-authored setup. The report records `history.generated_action_count` and the
expanded alias groups so two runs can compare stable scenario identities even
though repository IDs are intentionally generated afresh.

Context-classification lists can reference an entire generated group with:

```json
{ "group": "ambient_project_history" }
```

The exact `selected_meanings` and `forbidden_meanings` fields deliberately remain
plain alias arrays because specialized consumers such as the process-restart
harness share the scenario contract. Add generated groups to those exact sets with
`selected_meaning_groups` or `forbidden_meaning_groups` instead. This keeps long
pressure fixtures readable without making production code or specialized harnesses
understand evaluator-only group-reference objects.

Explicit setup/change actions continue to mirror supported semantic operations.
Alongside `remember_relationship`, `remember_fact`, `remember_preference`,
`undertake`, `remember_episode`, `attach_detail`, `supersede`, and
`withhold_detail`, issue #68 adds provenance-aware fact actions:
`remember_external_claim`, `remember_direct_observation`,
`remember_delegated_report`, and `remember_inference`. Derived actions name earlier
scenario aliases in `derived_from`; the harness resolves those aliases to immediate
source evidence while the canonical projection carries the complete transitive
lineage. The fixture-only withholding action still represents unavailable detail,
not privacy deletion.

The richer provenance promotion path is intentionally narrow: it applies to fact
propositions in the minimal slice. Relationship, preference, episode, and commitment
semantics retain their existing ownership rules. Issue #69 still owns
deleted/forgotten versus unavailable/withheld distinctions. Do not encode an
unsupported lifecycle as provenance metadata, and do not rename `withhold_detail`
to deletion merely to make a fixture pass.

### Context classification

An episode can annotate its expected context with additive classifications
alongside the existing exact selection and exclusion contract:

```json
{
  "selected_meanings": ["current_preference"],
  "selected_meaning_groups": ["ambient_project_history"],
  "relevant_meanings": ["current_preference"],
  "irrelevant_meanings": [{ "group": "ambient_project_history" }],
  "superseded_meanings": ["old_preference"],
  "unavailable_meanings": ["degraded_episode"],
  "forbidden_meanings": ["private_marker"]
}
```

`relevant` and `irrelevant` are scenario judgments for the current cognition
purpose. `superseded` and `unavailable` describe semantic state and may overlap
with relevance. For example, an explicitly requested historical preference is
both superseded and relevant during an `explain` episode. `forbidden` continues to
mean that the meaning must not participate in that projection.

The harness verifies that aliases declared `superseded` are actually superseded in
canonical state and that aliases declared `unavailable` have an unavailable-detail
gap in canonical inspection. Relevance itself is not promoted into canonical
state and the harness does not pretend it can prove an author's task judgment.

## Interpret the report

Every episode records five evidence layers:

1. `canonical_before` is Ember's inspectable durable state before cognition.
2. `projection` is the exact purpose-bounded request content selected by Ember.
3. `context_evaluation` resolves scenario classifications against that projection
   without consulting the provider reply.
4. `provider_result`, bounded backend/version/configuration metadata,
   external-thread control, and observed thread ID are empirical provider evidence.
5. `canonical_after` shows descriptor-only reintegration and operational episode
   evidence after cognition.

`ember_assertions` continue to check exact selection, forbidden-ID exclusion,
lineage, transcript exclusion, runtime restart, backend truth, thread semantics,
and now the canonical truth of declared superseded/unavailable classifications.
`model_observations` still check only empirical reply substrings. The top-level
`ember_assertions_passed` and `model_observations_passed` remain separate, so a
provider-only failure cannot rewrite the deterministic projection evidence.

`context_evaluation` is intentionally evidence rather than a final score. It
records stable aliases in:

- `omission_candidates.relevant_not_selected`;
- `inclusion_candidates.irrelevant_selected`;
- `inclusion_candidates.superseded_selected`;
- `inclusion_candidates.forbidden_selected`;
- `degradation_signals.unavailable_selected`;
- `degradation_signals.unavailable_with_projection_gap`.

These are **candidate signals**, not a claim that every listed item caused equal
harm. A superseded meaning selected for an explicit historical explanation can be
correct; an irrelevant selected item may be merely noisy or may materially distort
cognition. Issue #70 owns the reusable harm rubric and any ordinal judgment. The
#66 harness preserves the raw selection evidence needed for that later comparison
without inventing scalar precision early.

The command exits 1 for an Ember assertion failure and 2 when Ember assertions
pass but model observations fail. A polished live reply cannot repair a projection
failure. Conversely, a live model failure does not prove that canonical state was
lost or that context selection failed when the state/projection layers are correct.

For provenance-aware facts, `projection.meanings[*].epistemic_role` preserves the
claim class and `source_evidence` contains the immediate source occurrence plus its
transitive ancestors. Independent support is therefore counted at derivation roots,
not by the number of summaries, delegates, or inferences that repeat a root. See
[Longitudinal Provenance Evaluation](longitudinal-provenance-evaluation.md) for the
#68 fixture and its deterministic/empirical interpretation.

The harness preserves the governing ADR boundaries: lineage and durable meaning
remain Ember-owned; historical superseded meaning survives without automatically
governing ordinary projection; unavailable detail becomes an explicit gap;
selection includes deliberate exclusion; generated history is only evaluator
input expressed through canonical semantics; provenance derivation does not create
new evidence roots; and provider/thread IDs remain operational evidence rather than
memory or identity.
