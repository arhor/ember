---
summary: "Issue #234 deterministic and opt-in live evaluation for Calendar capability authority, durable approval, restart, duplicate-effect prevention, and truthful uncertainty."
read_when:
  - "Running or interpreting the authority, approval, and real-world effect evaluation"
  - "Adding an end-to-end scenario for capability authority, proposal approval, stale execution, duplicate effects, or uncertain outcomes"
  - "Using authority and effect evidence as an input to a behavioral-health scorecard"
role: guide
discovery_status: current
---

# Authority, Approval, and Effects Evaluation

Issue [#234](https://github.com/arhor/ember/issues/234) composes the Calendar
capability boundaries from issues #231 through #233. It is evaluation infrastructure,
not a second capability, approval, or retry policy. The deterministic harness invokes
the production capability selectors, firewall, durable action sidecar, and Calendar
adapter contracts with an isolated deterministic external substitute.

## Multi-episode objective composition

Issue [#238](https://github.com/arhor/ember/issues/238) extends the deterministic
evidence with `../../src/core/app`. The scenario creates an
objective action proposal in one bounded episode, persists an exact approval on a
different surface, reconstructs both ledgers in a fresh process/provider episode,
revalidates objective currentness before the Google Calendar effect, and
reintegrates the confirmed attempt into objective progress. A replay assertion
proves that the same durable proposal cannot submit the external effect twice.

A companion scenario terminalizes a submitted attempt as `outcome_unknown` and
proves that objective progress remains explicitly uncertain with reconciliation
required before retry. These tests compose the existing issue #234 action/effect
evidence with the issue #237 multi-episode objective ledger; they do not replace the
opt-in live Calendar smoke test or claim that deterministic HTTP doubles establish
live provider behavior.

## Run the evaluation

Run the network-free acceptance suite with:

```sh
npm run eval:action-effects
npm run eval:action-effects -- --report /absolute/new/action-effects-report.json
```

The fixture covers a useful read-only observation; valid, absent, rejected,
payload-mismatched, and ambiguous approval; cross-surface approval followed by a
restart; stale approval; duplicate execution; uncertain post-submission recovery; and
a technically available capability without authority. The report path must be new and
is created with mode `0600`.

The representative live path is opt-in. It performs one bounded Calendar observation
and one explicitly approved event creation using the already configured local CLI
binding:

```sh
EMBER_GOOGLE_CALENDAR_CONFIG=/absolute/path/to/calendar.json \
EMBER_GOOGLE_CALENDAR_EVENT_TITLE='Ember action evaluation' \
EMBER_GOOGLE_CALENDAR_EVENT_START='2026-09-18T08:00:00Z' \
EMBER_GOOGLE_CALENDAR_EVENT_END='2026-09-18T08:15:00Z' \
EMBER_GOOGLE_CALENDAR_EXACT_APPROVAL='Ember action evaluation|2026-09-18T08:00:00Z|2026-09-18T08:15:00Z' \
npm run eval:action-effects:live
```

The environment confirmation is a safety interlock for this operator-run test; it is
not a general Ember approval UI. The event remains in the selected calendar. Do not
attempt automatic cleanup: deletion would need its own proposal and current authority.

## Interpret the report

`ember_assertions_passed` reports the semantic boundary: authority correlation,
currentness, occurrence control, provenance, and durable effect state. In live mode,
`integration_observations_passed` separately reports whether the external Calendar
observation and approved effect were confirmed. A live adapter failure is not evidence
that an approval decision was wrong, and a successful adapter call does not excuse a
semantic failure. In particular, unavailable or stale read observations affect the
integration result without being counted as authority or approval-correlation errors.

The version-1 report contains case-level expected and observed outcomes, whether a
capability execution began, the number of external submissions, durable proposal
status, restart/cross-surface evidence, and provenance completeness. Its metrics report
authority violations, approval-correlation failures, stale-effect prevention,
duplicate-effect prevention, uncertainty handling, provenance/evidence completeness,
and cross-surface/restart continuity. Each case carries a `metric_results` map, so a
provenance regression is attributed to provenance rather than counted as an unrelated
authority or approval error; the ordinary approved-effect case evaluates only its
first authorized effect, while duplicate-attempt behavior belongs to the dedicated
duplicate-effect case. `scorecard_input: true` makes the sanitized envelope available
to a future behavioral-health scorecard; it is not a single health score and does not
replace the individual evidence.

The deterministic suite proves Ember behavior against a faithful adapter substitute.
The live run is later operational evidence only: it cannot establish that a future
credential, network, Google API release, or Calendar state will behave identically.
Never commit live reports, credentials, raw event IDs, Calendar identifiers, headers,
or tokens.
