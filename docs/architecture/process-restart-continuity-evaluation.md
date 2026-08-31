---
summary: "Issue #55 evaluation path for validating Ember-owned continuity across a complete CLI process restart while both cognition episodes use deliberately fresh Codex threads."
read_when:
  - "Running or reviewing the complete-process live Codex continuity probe from issue #55"
  - "Checking whether a restart result depends on Ember durable state rather than a prior Codex conversation"
  - "Recording sanitized evidence from the process-restart continuity evaluation"
role: guide
discovery_status: current
---

# Process-Restart Continuity Evaluation

Issue [#55](https://github.com/arhor/ember/issues/55) narrows the longitudinal
continuity programme to one empirical claim: after the complete foreground Ember
process exits, a newly started Ember process should reconstruct the same recognised
lineage and governing durable meaning while cognition runs in a new Codex thread.
The Codex thread is operational evidence only; it is neither the continuity owner
nor a memory source.

This probe complements, rather than replaces, the repository's two existing
oracles:

- `test/longitudinal-acceptance.test.ts` already proves the semantic restart vector
  across real OS process boundaries with a deterministic provider; and
- the [Longitudinal Continuity Harness](longitudinal-continuity-harness.md) varies
  state, runtime episodes, and external-thread controls while separating
  deterministic Ember assertions from model observations.

The #55 probe deliberately combines those properties through the ordinary
production CLI and Codex adapter.

## Scenario

The repository-owned scenario is
`test-fixtures/longitudinal/process-restart-fresh-codex.json`. It uses the existing
version-1 longitudinal scenario vocabulary and contains only the subset needed by
this process-level runner:

- one continuing relationship;
- one scoped user-stated fixture fact;
- one scoped current preference;
- one live Ember commitment;
- one deliberately out-of-scope private marker;
- a baseline ordinary cognition episode; and
- a second ordinary cognition episode after a complete process restart.

Both episodes request `external_thread: fresh`. No provider thread is named for
reuse. The post-restart prompt asks for the literal recovery value describing
Ember cognition during downtime so the empirical observation can expose an
invented seamless bridge rather than silently rewarding fluent continuity prose.
All scenario content is synthetic.

## What the runner actually restarts

`scripts/run-process-restart-scenario.ts` does not model a restart inside one
long-lived Ember runtime. It creates a temporary canonical store and then:

1. starts one `bin/ember.ts run` child process;
2. establishes the controlled durable meanings and performs one cognition;
3. sends `:quit` and waits for that complete process to exit cleanly;
4. inspects the durable store after the process is gone;
5. starts a second `bin/ember.ts run` child process against the same store;
6. performs the post-restart cognition using the production Codex adapter's
   ordinary ephemeral-thread default; and
7. inspects the resulting canonical state and emits a sanitized evaluation report.

The runner asserts that the two Ember child processes and runtime IDs are distinct,
the lineage remains the same, the expected meaning aliases are selected after
restart, the private marker remains excluded, restart recovery reports a known
clean-stop interval with `none_in_supported_runtime`, both cognition episodes
complete, and both Codex thread identifiers are present but different.

The raw thread identifiers are used only for the equality check. They are never
copied into the report. The same is true for generated lineage, runtime, cognition,
and meaning IDs.

## Deterministic repository oracle

`test/process-restart-harness.test.ts` executes the exact process orchestration
against `test-fixtures/providers/codex-jsonl-fixture.ts`, a local JSONL fixture that
exercises the production Codex adapter without login or network access. The test
also forces the same fake thread ID into both process episodes and verifies that
the freshness assertion fails. This keeps CI deterministic while testing the
process boundary, adapter path, report sanitizer, and freshness oracle used by the
live command.

Run it with the ordinary suite:

```sh
npm test
npm run check
```

## Live Codex execution

Live execution is intentionally explicit because the synthetic projection is sent
to the external Codex service through the installed runtime:

```sh
npm run eval:continuity:process-restart:live -- \
  --timeout-seconds 180 \
  --report /tmp/ember-55-process-restart.json
```

`--codex-arg VALUE` may be repeated for explicit runtime-owned model or
authentication configuration. The command uses the installed `codex` executable;
Ember does not copy credentials or make a previous thread available to the second
cognition episode.

The report file is created with mode `0600` and must not already exist. Unlike the
raw longitudinal live report, this process-restart report is designed to be
sanitized: it contains assertion names, expected synthetic aliases/fragments,
boolean outcomes, recovery enum values, and completion states, but no model reply,
provider thread ID, generated Ember ID, state path, stderr, or credential/account
material. Review the report before committing it anyway; a custom scenario can
change what appears in assertion labels.

Exit status `1` means a deterministic Ember/process/thread assertion failed. Exit
status `2` means those assertions passed but at least one empirical model reply
observation failed.

## Evidence status

### Authenticated live result — 2026-08-31

The process-restart scenario completed successfully through installed
`codex-cli 0.151.0`, using its existing ChatGPT login, default model selection,
and no explicit Codex runtime arguments:

- `execution_mode`: `live`;
- `ember_assertions_passed`: `true` (15 of 15);
- `model_observations_passed`: `true` (8 of 8);
- both cognition episodes completed and were displayed;
- the foreground Ember PID and runtime ID changed across the clean stop;
- the recognised lineage and all current durable meaning aliases survived;
- the restarted projection selected the exact expected meanings and excluded the
  private out-of-scope alias;
- recovery recorded `known_clean_stop_interval` and
  `none_in_supported_runtime`;
- both fresh Codex thread observations were present and distinct; and
- the model included the required current meanings and downtime value without
  disclosing the forbidden marker.

The successful report was created with mode `0600`. Inspection confirmed that it
contained only the sanitized observation contract: no raw model reply, external
thread ID, generated meaning/runtime/lineage/cognition ID, credential location,
token-like value, state path, or provider diagnostic was present. The report
remains local and is not committed.

Two authenticated runs before the successful result are relevant evidence. Both
passed all 15 Ember/process/thread assertions and every post-restart model
observation, but the baseline reply did not reproduce the current preference's
complete content verbatim. The original baseline instruction said to “state” the
exact meanings, while the machine observation required a literal substring. The
scenario was corrected to ask the model to copy the selected content fields
verbatim without placing the expected content in the input. No selected/forbidden,
restart, lineage, recovery, freshness, or reply assertion was removed or weakened.
The deterministic positive and forced-thread-reuse negative controls remained
green after this correction.

This sequence is not evidence of continuity degradation: canonical state,
projection selection, fresh-thread identity, and the entire post-restart live
continuity observation passed on all three executions. It is evidence that exact
machine-checkable reply observations need an equally explicit presentation
instruction when paraphrase would otherwise be semantically reasonable.

Do not paste raw model replies or external thread identifiers into this document.
A future failing live run remains evidence, not permission to weaken ADR 0001,
the restart acceptance scenario, or the bounded projection contract.

## Interpretation

A passing result supports a narrow claim only: the current production path can
carry the accepted restart semantics through two real Codex cognition episodes
without relying on Codex conversation continuity. It does not prove general model
replacement, richer memory quality, provider equivalence, or identity from
behavioural resemblance. Those remain separate empirical questions in the parent
continuity epic.
