---
summary: "Issue #219 deterministic and opt-in live evaluation for bounded conversational coherence, reference resolution, context pressure, restart, cross-surface continuation, uncertain outcomes, and independent canonical selection."
read_when:
  - "Running or interpreting the conversational coherence and context-pressure evaluation"
  - "Adding a dialogue scenario for reference resolution, topic changes, restart, surface changes, or uncertain cognition and delivery"
  - "Using conversation-selection evidence as an input to a behavioral-health scorecard"
role: guide
discovery_status: current
---

# Conversational Coherence Evaluation

Issue [#219](https://github.com/arhor/ember/issues/219) adds a repository-owned
evaluation of the implementation boundaries established by issues #216 through
#218. The evaluator uses production `runCognition`, canonical state persistence,
runtime restart, and the durable conversation sidecar. It is evaluation
infrastructure, not a second dialogue selector.

The default fixture covers:

- pronoun and ellipsis resolution against participant-attributed recent turns;
- topic continuation over several exchanges and an explicit fresh-topic boundary;
- an older deployment conversation competing with a newer, superficially similar
  blue-notebook conversation inside one trajectory before the older dialogue falls
  beyond the configured recent-exchange window;
- deterministic trimming at `RECENT_DIALOGUE_MAX_EXCHANGES`;
- a clean restart with a fresh provider invocation;
- CLI to Telegram to CLI continuation with source-surface provenance;
- failed cognition, which contributes an accepted user turn but no invented Ember
  expression;
- uncertain delivery, whose committed expression remains `pending` with user
  awareness `unknown`; and
- canonical meaning selection alongside, but independently from, dialogue context.

## Run the evaluation

The deterministic path is network-free:

```sh
npm run eval:conversation
node --test tests/conversation-evaluation.test.ts
```

The opt-in live path invokes Codex freshly for every episode. It does not rely on a
provider conversation or thread for continuity:

```sh
EMBER_RUN_LIVE_CONVERSATION=1 npm run eval:conversation:live
```

Use `--scenario PATH` to select another version-1 fixture, `--timeout-seconds N` to
change the live provider timeout, repeated `--codex-arg VALUE` for explicit provider
configuration, and `--report NEW_PATH` to create a mode-0600 JSON report. The report
path must not already exist. Do not commit raw live reports because natural provider
replies and operational identifiers may contain local information.

The fixture's `scripted_reply` is the deterministic model oracle. Generic
`reply_includes` expectations produce reply-quality observations. Only the explicit
`reference_resolution.reply_includes` expectation contributes to
`successful_reference_resolution`, so the future scorecard cannot mislabel an
ordinary content check as reference resolution. A live run can therefore fail model
observations while Ember-owned selection assertions still pass.

## Interpret the report

The top-level `ember_assertions_passed` covers inspectable repository behavior:
required turns were selected, declared stale/irrelevant turns were absent, and
expected canonical meanings were selected. `model_observations_passed` separately
reports whether replies contained the fixture's expected resolution signals.

Every episode reports:

- `successful_reference_resolution`, a nullable model observation;
- `reply_observations_passed`, the separate generic reply-content observation;
- `irrelevant_context_inclusion`, listing forbidden selected turn fragments;
- `selected_conversation_evidence_ids` and `selected_conversation_turns`, including
  source surface, response linkage, delivery status, and awareness uncertainty;
- `selected_canonical_meaning_ids` from the independently built canonical
  projection;
- `restart_outcome` and `cross_surface_outcome` where applicable;
- `provider_invocation_mode`, the harness-controlled fact that each episode uses a
  fresh provider invocation;
- optional `provider_thread_id` and its separate
  `external_thread_identity_observation`; the generic harness accepts absent thread
  metadata, while the live Codex runner requires fresh identity as provider evidence;
- `provider_failure` and `delivery_outcome`, which keep failed cognition distinct
  from an uncertain delivery after successful cognition and expression commit;
- `bounded_projection_size_bytes`; and
- `context_bound`, including the configured exchange/turn bounds and actual older
  exchange exclusions or turn truncations.

`scorecard_input: true` identifies the stable report envelope as suitable input to a
future behavioral-health scorecard. It does not collapse the evidence into a single
quality score: selection correctness and empirical model behavior remain distinct,
so a consumer can attribute a regression to Ember context selection or provider
response behavior.

## Scenario guidance

A scenario declares Ember identity/scope, controlled canonical facts, and ordered
episodes. Each episode can change surface, request a clean runtime restart, start an
explicit fresh conversation, simulate a failed/unknown provider outcome, or simulate
uncertain output delivery. Expectations name selected or excluded turn substrings,
canonical meaning aliases, and reply substrings.

The loader rejects missing or unsupported fields, malformed UTC timestamps, empty or
duplicate strings, duplicate episode IDs or meaning aliases, unknown meaning aliases,
and invalid outcome values before it creates evaluation state. Setup meanings are
created under `ember.initial_at`, so fixture state never acquires wall-clock evidence
that appears to come from the future relative to its episode projections.

Keep fixtures synthetic and deterministic. Expectations should inspect semantic
behavior rather than generated IDs or timestamps. A dialogue selection expectation
belongs under `selected_turns` or `excluded_turns`; provider response quality belongs
under `reply_includes`, and true local-reference checks belong under
`reference_resolution`. This separation is required for truthful diagnosis and for
future scorecard aggregation.
