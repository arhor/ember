---
summary: "Issue #256 deterministic end-to-end evidence and opt-in clean-host smoke procedure for setup, restore/create, onboarding, provider replacement, and Telegram setup."
read_when:
  - "Running or interpreting the setup/onboarding end-to-end evaluation"
  - "Validating fresh creation, restoration, onboarding recovery, provider replacement, or guided Telegram setup"
  - "Using setup/onboarding evidence as an input to a behavioral-health scorecard"
role: guide
discovery_status: current
---

# Setup and Onboarding End-to-End Validation

This document records the current evidence for issue #256 and the setup/onboarding epic
#250. The deterministic suite is the repeatable acceptance gate; the clean-host procedure
below is optional operational evidence.

## Deterministic oracle

Run:

```sh
npm run eval:setup-onboarding
npm run eval:setup-onboarding -- --scenario eval/setup-onboarding/fixtures/fresh-create.json
npm run eval:setup-onboarding -- --report /absolute/new/report.json
```

The version-1 fixtures cover `fresh-create` and `restore-existing`. The harness invokes
the production setup, canonical state, ordinary cognition, memory-proposal, onboarding,
projection, and Telegram setup boundaries with deterministic provider, Bot API, and
systemd substitutes. Each run uses isolated application paths. A report path must not
already exist and is created with mode `0600`.

The top-level `ember_assertions_passed` and `host_assertions_passed` distinguish the two
responsibilities without introducing a common evaluation vocabulary that issue #245 has
not decided. `passed` requires both. `sanitized: true` means the emitted report contains
only named expectations and bounded observations: raw prompts, provider responses,
temporary paths, configuration content, and secrets are excluded. `scorecard_input: true`
marks the report as suitable input to a future aggregate; it is not itself a health score.

The structural oracle, rather than conversational familiarity, proves continuity. It
compares lineage and establishment identity, canonical bytes at the attachment boundary,
meaning identifiers, selected evidence, and provenance. Negative tests demonstrate that
lineage replacement, newborn onboarding on restore, non-provenanced memory, and token
leakage fail named assertions.

The suite is deterministic and network-, credential-, and systemd-independent. It proves
Ember's boundary behavior against faithful substitutes; it cannot prove that a particular
host login, provider release, network, BotFather token, Telegram account, or user manager
works at a later time.

## Opt-in clean-host smoke

Use a disposable OS account or host and preserve any evidence only after removing names,
paths, provider session IDs, chat IDs, message bodies, and tokens.

1. Install the pinned Node.js version and dependencies, then authenticate a supported
   provider using its own login flow.
2. With no `~/.ember`, run `ember setup --intent create-new --principal USER --provider
codex`. Confirm failed authentication creates no lineage, then authenticate and retry.
3. Run the printed configured conversation command. Defer onboarding, exit, restart, do
   unrelated work, resume onboarding, and verify a stated preference is present through
   `ember inspect` with user-command provenance.
4. Re-run setup with Cursor and `--confirm-provider-change`; restart conversation and
   compare lineage, establishment time, meaning ID, and provenance before and after.
5. On a second clean account, place a complete backup with sidecars, authenticate a new
   machine-local provider, and attach it with `--intent restore-existing
--accept-continuity-risk`. Verify setup does not change bundle bytes and no new
   onboarding record appears. After conversation, compare structural identities and
   provenance; do not use a familiar-sounding reply as proof.
6. Optionally create a fresh bot with BotFather and enter `:setup telegram`. Confirm the
   private mapping code, install the user service, send one message, receive one reply,
   and inspect correlated delivery evidence. Verify the token occurs only in
   `~/.ember/secrets/telegram.token`, whose mode is `0600`, and redact it immediately from
   terminal capture if it was exposed accidentally.
7. Stop the test services and remove the disposable account or host according to local
   policy. Never commit the smoke report or credentials.
