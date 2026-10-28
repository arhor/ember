export const setupHelpText = `/setup [--config PATH] [--state PATH]
Defaults: ~/.ember/config/setup.json and ~/.ember/state/continuity.json.
Config and state path overrides are independent; an existing config retains its state binding.
Inspect first, then choose explicitly:
  --intent create-new --principal USER --provider codex|cursor|claude-code|ollama|deepseek
  --intent restore-existing --state PATH --accept-continuity-risk --provider PROVIDER
  --intent use-existing [--state PATH] [--provider PROVIDER]
Restore attaches a local store and its sidecars; fork, snapshot age, and missing-history risks remain unresolved.
Options: --model MODEL (required for Ollama and DeepSeek), --provider-base-url LOOPBACK_URL (Ollama only),
  --provider-command EXECUTABLE (Codex/Cursor only),
  --provider-timeout-seconds SECONDS (default 60, maximum 120), --confirm-provider-change, --diagnostics.
Provider credentials stay in provider-owned login stores or DEEPSEEK_API_KEY in the environment; never pass secrets as options.
--diagnostics retains a redacted setup-probe log under ~/.ember/logs/setup/ only when verification fails.
Rerun with the same intent or use-existing to reverify; existing continuity is never overwritten.
Use a separate config and state path to create another lineage. Ctrl-C requests cancellation.
`;
