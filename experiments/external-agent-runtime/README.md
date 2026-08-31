# External agent runtime probe

This experiment-only harness records bounded subprocess output, JSONL event types,
duration, exit status, and direct-child cancellation evidence while removing common
API-key environment variables. It deliberately does not implement Ember's
production provider contract or claim that terminating a CLI child cancels remote
work.

Example:

```bash
node experiments/external-agent-runtime/probe.ts \
  --cwd /tmp --timeout-ms 30000 -- \
  codex exec --ephemeral --skip-git-repo-check --sandbox read-only --json \
  'Return exactly {"probe":"ember-runtime","answer":42}'
```

To observe direct-child cancellation, add `--cancel-after-ms N` before `--`.
Run probes only in a directory whose implicit project instructions and files are
permitted to reach the selected runtime.
