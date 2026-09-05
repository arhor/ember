---
summary: "Current Telegram surface runbook: Bot API 10.3 long polling, issue #87 principal/scope privacy mapping, systemd user supervision, secret-safe configuration, and manual end-to-end validation."
read_when:
  - "Setting up, running, debugging, or reviewing Ember's Telegram interaction surface"
  - "Changing Telegram Bot API polling, bot-token handling, principal/chat mapping, disclosure scope, delivery behavior, or Telegram systemd startup"
role: guide
discovery_status: current
---

# Telegram Surface Runbook

> Status: current implementation/runbook from issue #86, with principal/privacy policy
> hardened across CLI and Telegram by issue #87. The semantic boundary remains
> [Interaction Surface Boundary](interaction-surface-boundary.md); this document owns
> Telegram-specific transport and deployment details only.

## Supported integration

Ember's first messaging surface uses the official HTTP-based Telegram Bot API directly
from Node.js 26. No Telegram npm runtime dependency is added.

Implementation assumptions verified against the official Telegram documentation on
2026-09-05:

- Telegram Bot API version **10.3** is the current Bot API release (2026-08-24).
- bots authenticate with the token issued through BotFather;
- `getUpdates` long polling and outgoing webhooks are mutually exclusive;
- successful update acknowledgement is driven by the next `getUpdates` request using
  `offset = highest_processed_update_id + 1`;
- `getMe` validates bot authentication;
- `getWebhookInfo` reports whether a webhook currently owns update delivery;
- `deleteWebhook` removes that webhook without requiring pending updates to be dropped;
- `sendMessage` returns the sent Telegram `Message`, whose `message_id` is retained only
  as operational delivery evidence.

Canonical upstream references:

- <https://core.telegram.org/bots/api>
- <https://core.telegram.org/bots/faq>

The production worker uses `allowed_updates: ["message"]` and a positive long-poll
timeout. It does not use short polling as an always-on mechanism.

## Why long polling

The first deployment target is the existing single-user Linux/systemd host from ADR 0007. Long polling needs no public HTTPS endpoint, certificate, reverse proxy, inbound
firewall rule, or webhook secret. A systemd user service can therefore own the network
wait while Ember itself still acquires canonical writer ownership only around an
accepted update.

This is the first concrete evidence that a continuously open transport is useful. It
does **not** convert the transport worker into Ember identity or canonical continuity.
The worker may disappear and restart; durable state and the interaction ledger remain
the truth sources. [ADR 0008](decisions/0008-add-systemd-supervised-telegram-transport-worker.md)
records that narrow topology extension explicitly.

`Restart=on-failure` is safe for this transport worker because restarting the poller is
not itself a cognition retry. Telegram may replay an unacknowledged `update_id`, and
the issue #85 correlation boundary suppresses duplicate cognition and duplicate
response delivery for that established occurrence.

## Current principal/privacy envelope

The current implementation deliberately supports one narrow deployment mapping:

```text
one configured Telegram private chat id
    -> configured_surface_mapping
    -> one existing Ember local principal
    -> one configured Ember active scope
```

Only ordinary text messages are accepted. The message must come from the configured
**private** chat, the sender must be the same Telegram user as that chat, and the
sender must not be a bot. Group chats, channels, arbitrary users, username-based
identity, forwarded identity, media/captions, edits, callbacks, and multiple principal
mappings are outside the current surface.

Issue #87 makes the mapping policy explicit:

- `chat_id` is transport evidence selecting this configured mapping. It is not an
  Ember principal, identity record, permission grant, or canonical meaning;
- `principal` names the already-initialized Ember local principal. A matching Telegram
  chat cannot manufacture a different principal; a configured mismatch is rejected
  before the message becomes an accepted interaction occurrence;
- `active_scope` is the ordinary cognition selection scope for this surface. Telegram
  update/chat/message history does not broaden it;
- ordinary Telegram text remains ordinary input even when it names a canonical meaning
  ID or asks for information outside that scope. The request itself is visible, but it
  does not opt into Ember's explicit local explanation-selection path or silently add
  the named meaning to the projection;
- changing the Telegram account/chat mapping does not rewrite Ember relationship or
  continuity identity. It changes only which transport evidence is accepted for this
  deployment mapping.

The same continuing Ember can therefore have richer canonical relationship/memory
state than one Telegram interaction is permitted to project. Surface reachability and
recognized transport identity never imply unrestricted disclosure.

Telegram `update_id`, `message_id`, `message_thread_id`, chat id, and delivery message
id remain in the operational interaction boundary. They are not canonical meanings
and are not automatically projected into cognition.

## Bot setup

1. Create a bot with Telegram's official `@BotFather` flow and retain the bot token
   locally.
2. Send a message to the bot from the private Telegram account that will map to the
   Ember principal.
3. Determine that private chat's numeric id from the official Bot API. Do not paste
   the bot token into a committed file, issue, shell script, or command-line URL.
4. Create the local token/config files below.

A token-file-safe one-off way to inspect pending updates is to run Node with the token
read at runtime rather than embedding it in the command line:

```bash
EMBER_TELEGRAM_TOKEN_FILE="$HOME/.config/ember/telegram.token" node --input-type=module -e '
  import { readFile } from "node:fs/promises";
  const token = (await readFile(process.env.EMBER_TELEGRAM_TOKEN_FILE, "utf8")).trim();
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=1&allowed_updates=%5B%22message%22%5D`);
  const body = await response.json();
  for (const update of body.result ?? []) {
    if (update.message?.chat?.type === "private") {
      console.log({ update_id: update.update_id, chat_id: update.message.chat.id, username: update.message.from?.username ?? null });
    }
  }
'
```

The numeric chat id is operational deployment data. Do not commit a real user's chat
id to this repository.

## Token file

Create a local directory and token file readable only by the Ember OS user:

```bash
mkdir -p "$HOME/.config/ember"
install -m 600 /dev/null "$HOME/.config/ember/telegram.token"
read -rsp "Telegram bot token: " TOKEN; printf '\n'; printf '%s\n' "$TOKEN" > "$HOME/.config/ember/telegram.token"; unset TOKEN
chmod 600 "$HOME/.config/ember/telegram.token"
```

The token is read from `token_file` at process startup. It is not placed in the
systemd unit, command-line arguments, canonical Ember state, interaction ledger, or
repository configuration.

## Surface configuration

Create an uncommitted local JSON file, for example
`$HOME/.config/ember/telegram.json`:

```json
{
  "config_version": 1,
  "state_path": "/home/USER/.local/share/ember/ember.json",
  "principal": "YOUR_EMBER_PRINCIPAL",
  "active_scope": "private",
  "chat_id": 123456789,
  "token_file": "/home/USER/.config/ember/telegram.token",
  "poll_timeout_seconds": 30,
  "provider_kind": "codex",
  "provider_command": "/ABSOLUTE/PATH/TO/codex",
  "provider_arguments": [],
  "provider_timeout_seconds": 120,
  "working_directory": "/ABSOLUTE/PATH/TO/ember",
  "node_path": "/ABSOLUTE/PATH/TO/node",
  "surface_entrypoint": "/ABSOLUTE/PATH/TO/ember/bin/ember-telegram.ts",
  "stop_timeout_seconds": 150
}
```

All filesystem/executable paths are absolute because the systemd user manager must
not depend on an interactive shell's current directory, aliases, or PATH resolution.
`principal` must already match the principal in the initialized Ember state.
`active_scope` is not a Telegram label: it is Ember's existing ordinary projection
scope used for cognition accepted through this configured surface. Choose it
deliberately for the information appropriate to this remote private-chat setting
rather than copying a broader CLI/project scope automatically.

`chat_id`, `principal`, and `active_scope` together are local deployment policy. They
remain in the uncommitted configuration file rather than code, test fixtures tied to a
real person, or canonical state. A repository checkout can therefore describe the
mapping mechanism without embedding a personal Telegram identifier.

Supported `provider_kind` values are `codex`, `cursor`, and `process`; this mirrors the
existing cognition boundary rather than defining a Telegram-specific cognition
backend.

## Preflight

From the repository root:

```bash
npm run surface:telegram -- check \
  --config "$HOME/.config/ember/telegram.json"
```

Preflight calls `getMe` and `getWebhookInfo`. It fails closed when a webhook is active,
because Telegram does not permit `getUpdates` while a webhook owns delivery.

The Bot API preflight proves bot authentication and long-poll availability. It is not
a substitute for Ember principal policy: when an accepted update is processed, the
configured principal is resolved against the initialized continuity state before
`runSurfaceInteraction`; a mismatch fails before provider invocation, interaction
acceptance, or delivery.

If this bot was previously configured for webhook delivery and switching it to Ember
is intentional:

```bash
npm run surface:telegram -- delete-webhook \
  --config "$HOME/.config/ember/telegram.json"
```

This command calls `deleteWebhook` with `drop_pending_updates=false`. Ember never
discards pending Telegram updates implicitly.

## Foreground run

The exact transport can be exercised without systemd first:

```bash
npm run surface:telegram -- serve \
  --config "$HOME/.config/ember/telegram.json"
```

`SIGINT`/`SIGTERM` aborts the current long poll. If cognition is active, the same
AbortSignal is passed into the provider boundary so shutdown remains explicit rather
than abandoning a hidden model process.

The worker does **not** hold the canonical writer lease while waiting for Telegram.
For each accepted update it:

1. filters to the configured private-chat mapping;
2. acquires the existing `StateStore` writer lease;
3. resolves the configured principal against the initialized local principal while
   starting one short Ember runtime episode;
4. calls `runSurfaceInteraction` with surface `telegram_bot`, principal provenance
   `configured_surface_mapping`, the configured active scope, and stable `update_id`
   correlation;
5. builds cognition context through the ordinary Ember projection boundary, without
   injecting Telegram IDs/history;
6. sends the committed expression through `sendMessage`;
7. records Telegram's returned outbound `message_id` as operational delivery evidence;
8. cleanly stops the short runtime episode; and
9. releases the writer lease before the next network wait.

An ignored or unmapped update creates no Ember runtime/cognition occurrence. A mapped
chat paired with a wrong Ember principal fails before accepted interaction/cognition.

## Delivery truth

The Telegram adapter maps transport evidence onto the issue #85 delivery lifecycle:

- a successful `sendMessage` response records `confirmed` and the returned Telegram
  message id;
- an explicit Bot API rejection such as HTTP/API 4xx records `failed`;
- network loss, malformed/unreadable response, or server-side ambiguity records
  `uncertain`.

`confirmed` means Telegram accepted the send operation. It does not mean the user read
or understood the message. The adapter does not automatically retry uncertain sends;
that belongs to #88.

Telegram currently limits ordinary `sendMessage` text. The current surface does not
split one Ember expression into multiple Telegram messages because that would require
multi-message delivery semantics not present in the current boundary. An oversized
Telegram send therefore fails explicitly instead of being silently chunked.

## systemd user service

Generate the unit from the validated local configuration:

```bash
mkdir -p "$HOME/.config/systemd/user"
npm run surface:telegram -- render-unit \
  --config "$HOME/.config/ember/telegram.json" \
  > "$HOME/.config/systemd/user/ember-telegram.service"
systemctl --user daemon-reload
systemctl --user enable --now ember-telegram.service
```

The generated unit uses `Type=exec`, `Restart=on-failure`, `KillMode=mixed`, an
explicit stop timeout, `UMask=0077`, absolute Node/entrypoint paths, and the configured
working directory. Neither the token nor chat id appears in `ExecStart`.

For operation after logout/reboot, retain the ADR 0007 user-manager setup:

```bash
loginctl enable-linger "$USER"
```

Status and logs:

```bash
systemctl --user status ember-telegram.service
journalctl --user -u ember-telegram.service
```

Do not log raw incoming message text or the bot token as part of normal adapter
operation.

## Inspection

The ordinary CLI inspection command now includes operational interaction provenance:

```bash
ember inspect \
  --state "$HOME/.local/share/ember/ember.json" \
  --principal "YOUR_EMBER_PRINCIPAL" \
  --json
```

The `interactions` section contains inbound occurrence and delivery records. For a
Telegram exchange it can show logical surface `telegram_bot`,
`configured_surface_mapping`, configured destination, stable update/message metadata,
and confirmed/failed/uncertain delivery attempts including the outbound Telegram
message ID when observed.

This operator visibility does not move those values into canonical meanings or
provider context. Inspection and cognition projection are deliberately different
views.

## Manual end-to-end smoke

This smoke is deliberately opt-in and requires a real bot/account/network. Normal
repository tests use deterministic fake HTTP/provider boundaries and require no token.

1. Run the preflight `check` command.
2. Start `serve` in the foreground or start `ember-telegram.service`.
3. Send a fresh ordinary text message from the configured private Telegram chat.
4. Confirm that exactly one Ember response arrives in that chat.
5. Run `ember inspect ... --json` and confirm the cognition episode exists while the
   Telegram update/chat/message identifiers appear only under `interactions`, not as
   canonical meanings.
6. Confirm the Telegram interaction record reports `configured_surface_mapping`, the
   expected configured principal/scope/destination, one delivery intent, and one
   attempt carrying the returned outbound Telegram message id.
7. Restart the surface after forcing the same Telegram update to remain unacknowledged
   (for example by stopping before the next `getUpdates` confirmation call). Confirm
   replay does not create a second cognition or second response.

The logical `telegram_bot` surface supplied to cognition is covered by deterministic
provider-boundary tests; it is not claimed to be a new canonical memory field merely
for observability.

The last restart/replay step exercises #85's duplicate-occurrence guarantee through a
real transport. Richer offline/reconnect and uncertain-send recovery belongs to #88.

## Deterministic confidence path

No Telegram token or network is needed for repository confidence:

```bash
npm run check
npm test
```

Focused tests cover:

- private-chat mapping and rejection of unmapped chats before Ember work;
- stable `update_id` replay producing one cognition and one send;
- exclusion of Telegram ids from the cognition projection;
- explicit `getUpdates` acknowledgement offset and message-only filter;
- Bot API rejection versus uncertain network/server delivery;
- refusal to long-poll while a webhook is active;
- generated systemd unit secrecy and restart policy;
- CLI and Telegram selecting the same ordinary meanings when given the same active
  scope despite different transport metadata;
- a mapped Telegram message naming an out-of-scope meaning ID without causing that
  meaning or its private content to enter ordinary cognition context;
- a matching Telegram chat failing to manufacture a mismatched Ember principal; and
- operator inspection exposing principal/surface/delivery provenance from the sidecar.

## Deliberate limits and next issues

The current Telegram surface does not add groups, multiple principals, media,
commands, callback queries, webhooks, automatic uncertain-send retry, device/user
attestation, remote explicit-explanation commands, or a generic
surface/plugin/authorization framework.

Issue #87 establishes the current single-user principal/privacy policy described
above. It does not claim that one private Telegram account is universally sufficient
identity proof for future multi-user, shared-device, group, or forwarded-message
surfaces.

- #88 owns offline/reconnect/retry and delivery-uncertainty reconciliation.
- #89 owns cross-surface continuity validation between CLI and Telegram.

The Telegram worker is therefore a concrete second window onto the same Ember, not a
new owner of Ember identity, memory, authority, privacy policy, or truth.
