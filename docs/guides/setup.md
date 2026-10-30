# Interactive shell and setup

Decision owner: [ADR 0041](../architecture/decisions/0041-use-the-shell-as-the-only-cli-command-interface.md).

Launch Ember to open an empty shell. Chat begins on the first message, with fresh recent
context and retained durable identity and memory. /new-conversation starts another fresh
conversation on the next message. /quit exits; /help lists commands. Existing session
commands also accept their legacy colon prefix. See [conversation commands](conversation-commands.md)
for shared commands, interactive suggestions, and Telegram aliases.

If continuity and provider are not ready, messages suggest /setup. The message is not
queued: configure explicitly and resend it.

## Configure continuity and provider

Enter /setup. On an unconfigured installation, choose create or restore, supply the
principal for creation or an existing state path for restore, and choose a provider.
Authenticate through provider-owned tools first when required. Enter /cancel at a
setup prompt to return to the shell.

Creation requires explicit intent. Restore attaches an already-local continuity store;
copy its ordinary sidecars alongside it when moving stores. Restore requires explicit
acknowledgement of stale/forked-copy uncertainty. Setup verifies the provider before
activating continuity and never turns its probe into a conversation.

On configured installations, /setup inspects readiness and prints available operations.
Use explicit flags to reconcile or change configuration:

    /setup --intent use-existing
    /setup --intent use-existing --provider codex --confirm-provider-change

Launch `ember` first, then enter local commands:

    /setup --intent create-new --principal user-1 --provider codex
    /setup --intent restore-existing --state /absolute/state.json --provider codex --accept-continuity-risk
    /use --config /absolute/setup.json --scope relationship:user-1

`/use` selects a verified setup for this process. Omitted scope defaults to
`relationship:<principal>`. Failed selection preserves the prior setup; success starts
fresh context on the next message. `/setup` targets the selected config unless
`--config` explicitly overrides it. Configuring another path does not select it.
Raw `init`, `run`, and all process subcommands have been removed. Startup accepts
only standalone `--help`/`-h` or `--diagnostics`.

## Diagnostics, editing and recovery

Use `/inspect --state PATH --principal USER [--json]`, `/explain ID --state PATH
--principal USER`, or `/correct ID --state PATH --principal USER --text TEXT --reason
REASON`. `/supersede` and `/ask --explain` remain distinct session operations.

`/materialize --state PATH --principal USER --scope SCOPE --output DIRECTORY` exports
Markdown. `/apply-materialized-edits --state PATH --principal USER --scope SCOPE
--input DIRECTORY --approval-evidence ID` imports edits with one distinct attributable
approval evidence ID per edit. Existing evidence and currentness checks still apply.

`/check --state PATH`, `/lock-status --state PATH`, and `/quarantine-stale-lock --state
PATH --owner-token TOKEN --confirm-quiescent` work without a ready provider or selected
setup. Never quarantine a lock until its previous owner is known to be quiescent.
All local commands accept colon aliases; `/help` lists commands and command-specific
`--help` prints their options without initializing a runtime.

Piped stdin remains supported; send the same slash commands as terminal input.
A handled command error prints a diagnostic and the shell continues. Final status 0
means the shell exited normally, not that every submitted command succeeded.

Default configuration is ~/.ember/config/setup.json; default continuity is
~/.ember/state/continuity.json. Never enter reusable credentials into chat.
Use /setup google-calendar --help for trusted Calendar setup and its required flags.

## Recovery and compatibility

Failed or cancelled setup keeps the shell open. Inspect configuration before retrying
interrupted effects. Missing previously available state is never silently recreated.
Preserve it and its configuration for explicit recovery. Setup preserves healthy bindings
and validates principal, lineage and establishment time under lease.

There is no onboarding state, topic checklist or completion gate. Legacy
.onboarding.json sidecars are ignored and left untouched. Previously adopted meanings
remain canonical. Ordinary memory formation continues across supported surfaces.

## Validation

Initialize the pinned Node version, then run deterministic acceptance tests:

    nvm use
    node --test tests/setup.test.ts apps/cli/src/surface.test.ts tests/cross-surface-continuity.test.ts tests/cross-surface-semantics.test.ts

Coverage includes explicit setup, provider verification, continuity binding, interrupted
activation, fresh context, input handoff, legacy sidecar compatibility and ordinary memory.
Historical onboarding evidence remains in former guides; its retired evaluation runner
is not a current validation procedure.
