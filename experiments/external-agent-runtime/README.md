# External agent runtime probe

This experiment-only harness records bounded subprocess output, JSONL event types,
duration, exit status, and direct-child termination evidence while removing common
API-key environment variables. It distinguishes explicit cancellation from timeout
and can report that direct-child termination was not observed. It never claims that
terminating a CLI child cancels remote work.

`codex-provider.ts` is an experiment-local implementation of Ember's existing
provider process contract. `live-codex-round-trip.ts` uses it to pass a synthetic,
real Ember projection through `codex exec`, validate the result, and reintegrate it
through `runCognition`. None of these files define a production runtime framework.

Example:

```bash
node experiments/external-agent-runtime/probe.ts \
  --cwd /tmp --timeout-ms 30000 -- \
  codex exec --ephemeral --skip-git-repo-check --sandbox read-only --json \
  'Return exactly {"probe":"ember-runtime","answer":42}'
```

To observe direct-child cancellation, add `--cancel-after-ms N` before `--`.
Without that option, reaching `--timeout-ms` is reported as a timeout rather than a
cancellation request.
Run probes only in a directory whose implicit project instructions and files are
permitted to reach the selected runtime.
