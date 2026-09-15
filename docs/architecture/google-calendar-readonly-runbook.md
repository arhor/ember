---
summary: "Issue #231 runbook for Ember's bounded read-only Google Calendar capability, OAuth recovery, surface activation, inspection, and live smoke."
read_when:
  - "Configuring, disabling, recovering, or inspecting the Google Calendar integration"
  - "Reproducing calendar lookup through CLI or Telegram or diagnosing why it is inactive"
  - "Changing Google Calendar OAuth, credentials, observation evidence, or live verification"
role: guide
discovery_status: current
---

# Google Calendar Read-only Runbook

Google Calendar is optional standing authority, not canonical Ember memory. It is
active only for the configured lineage principal, scope, and `local_cli` and/or
`telegram_bot` surfaces, and only while Claude Code is the cognition provider.
Codex and Cursor conversations continue normally but cannot see the tool.

## Configure

Create a Google OAuth installed-application client, enable Calendar API access, and
store the client secret in a mode-0600 local file. Then run:

```sh
ember setup-google-calendar \
  --setup-config /absolute/path/setup.json \
  --config /absolute/path/google-calendar.json \
  --client-id CLIENT_ID \
  --client-secret-file /absolute/path/client-secret \
  --refresh-token-file /absolute/path/calendar-refresh-token \
  --calendar-id CALENDAR_ID --calendar-label Personal \
  --timezone Europe/Warsaw --scope private \
  --surface local_cli --surface telegram_bot
```

Open the printed Google URL. Ember listens only on `127.0.0.1`, verifies OAuth state
and PKCE, requests exactly
`https://www.googleapis.com/auth/calendar.events.readonly`, stores
the refresh token with mode 0600, verifies one one-minute calendar read, and then
activates configuration. The calendar ID and credential paths are host configuration;
they never enter canonical continuity state.

Rerun configuration deliberately with `--reconfigure` to replace the grant. A
reconfiguration writes and verifies a new versioned token file; a failed verification
removes that staged credential, while the active config and prior token remain untouched.
After successful replacement, the prior mode-0600 token is deliberately retained at its
known old config path for explicit rollback or revocation rather than silently deleted.
Disable the integration with the same
`--setup-config` and `--config` plus `--disable`; this marks the integration inactive
without deleting credentials. For revoked or expired authorization, revoke the old
grant in the Google account, preserve the config for diagnosis, and repeat setup to
obtain a fresh refresh token.

Disable and reconfigure operations require the existing Calendar config to match the
setup lineage and principal. A v2 setup also accepts only its already-bound config path.
If first activation published the Calendar config but failed before upgrading setup to
v2, rerunning the command with the same paths verifies the owned config and completes
that binding without issuing another grant. If config replacement reports uncertain
durability after publication began, preserve the new token: the possibly-visible config
may already reference it, so deleting it would make recovery destructive.

## Reproduce and inspect

Start configured CLI conversation with the bound scope, or regenerate Telegram setup
after calendar configuration so its v3 config references the calendar config. Ask for
events in an explicit interval no longer than 31 days. A successful empty interval is
an `observed` result with an empty event list. Pagination is reported as truncation.

Inspect only the non-secret config, file modes, and sanitized capability ledger in a
test harness. Never print token files, authorization headers, raw event IDs, calendar
addresses, or raw Google errors. Canonical `ember inspect` output must contain none of
the Google configuration, event observations, or capability evidence. A calendar
configuration whose setup lineage does not match the current projection is inactive,
even if its principal, scope, and surface happen to match.

## Live smoke

The setup verification is the opt-in live smoke: it performs one caller-authorized,
one-minute lookup and reports only activation status. For a wider smoke, use an
ordinary configured conversation and a caller-specified interval; report only outcome,
event count, observation time, hashed source ID, collection update time, and truncation.
