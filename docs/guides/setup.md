# Interactive shell and setup

Decision owner: [ADR 0040](../architecture/decisions/0040-open-an-empty-shell-and-configure-explicitly.md).

Launch Ember to open an empty shell. Chat begins on the first message, with fresh recent
context and retained durable identity and memory. /new-conversation starts another fresh
conversation on the next message. /quit exits; /help lists commands. Existing session
commands also accept their legacy colon prefix.

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

Process commands remain available for scripting and recovery:

    ember setup --intent create-new --principal user-1 --provider codex
    ember setup --intent restore-existing --state /absolute/state.json --provider codex --accept-continuity-risk
    ember run --config /absolute/setup.json --scope relationship:user-1

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
