---
summary: "Current production path from CLI or Telegram input through the Ember application boundary, AI execution, durable state, delivery, bootstrap, and trusted-host setup."
read_when:
  - "Tracing an ordinary user message through Ember from a concrete surface to durable state and delivery"
  - "Changing application composition, cognition execution, delivery reconciliation, first-run bootstrap, or trusted-host setup"
  - "Checking whether a surface, host adapter, provider bridge, or setup flow is bypassing the canonical application boundary"
role: design
discovery_status: current
---

# Canonical Ember Application Flow

This document describes the implemented production architecture after epic
[#303](https://github.com/arhor/ember/issues/303). The migration proposal that led to
this shape is preserved in Git history and the closed child issues; it is not a second
supported architecture.

The ordinary interaction path is intentionally narrow:

```text
CLI / Telegram transport
        |
        v
surface adapter maps transport input
        |
        v
EmberApplication.interact(InteractionEvent, TransportSend)
        |
        v
application-owned interaction, cognition, post-turn, and delivery coordination
        |
        v
Ember-owned durable state + sidecars
```

Concrete surfaces do not construct cognition providers, canonical stores, memory or
onboarding helpers, or the application coordinator. Executable/bootstrap composition
does that before the adapter starts.

## Production entry points and composition

### Foreground CLI

The executable entry point is [`bin/ember.ts`](../../bin/ember.ts), which delegates to
the CLI module under [`../../src/apps`](../../src/apps/cli/).

For an already configured continuity, the path is:

```text
bin/ember.ts
  -> apps/cli/main.ts
  -> apps/cli/setup.ts::setupRunMain
  -> app/bootstrap.ts::prepareConfiguredRun
  -> composition/cli.ts::composeCliSurface
  -> composition/ember.ts::composeEmberApplication
  -> app/application.ts::createEmberApplication
  -> apps/cli/surface.ts::runCliSurface
  -> EmberApplication.interact(...)
```

`composition/cli.ts` returns the already composed `EmberApplication` together with
the repositories needed by explicit CLI operator commands. The conversational adapter
receives those collaborators. It does not choose or construct them.

### Telegram

The resident or foreground Telegram worker starts at
[`bin/ember-telegram.ts`](../../bin/ember-telegram.ts):

```text
bin/ember-telegram.ts
  -> load Telegram transport config + token
  -> composition/telegram.ts::composeTelegramSurface
  -> composition/ember.ts::composeEmberApplication
  -> app/application.ts::createEmberApplication
  -> apps/telegram/surface.ts::runTelegramPolling
  -> processTelegramUpdate
  -> EmberApplication.interact(...)
```

The Telegram adapter owns Bot API polling, configured private-chat admission,
transport occurrence metadata, concrete `sendMessage` delivery, and transport-level
reconciliation. It receives the application and recovery repositories from the
executable composition boundary.

### Shared composition root

[`../../src/core/composition`](../../src/core/composition/ember.ts) is the production
composition root for one Ember application instance. It creates the repositories,
selects the configured cognition executor and control helpers, supplies capability
selection, and returns `EmberApplicationDependencies`.

[`../../src/core/app`](../../src/core/app/application.ts) then turns those dependencies
into the transport-neutral `EmberApplication`. That factory is the only production
entry point for an ordinary user interaction.

## Follow one ordinary message

The same sequence applies to an admitted CLI line and an admitted Telegram message.

1. **The surface maps transport input.**
   The adapter creates an
   [`InteractionEvent`](../../src/core/app/contract.ts) with principal, scope, logical
   surface, text, provenance, and optional transport occurrence/destination metadata.
   CLI uses `local_cli` with `explicit_local_argument`; Telegram uses
   `telegram_bot` with `configured_surface_mapping`.

2. **The application admits the interaction.**
   `EmberApplication.interact` validates the event, acquires the canonical writer
   lease, verifies the expected continuity binding when configured, starts one runtime
   episode, and commits that start before cognition.

3. **The interaction ledger establishes occurrence identity.**
   The application calls
   [`InteractionLedgerStore.acceptInbound`](../../src/core/runtime/interaction-boundary.ts).
   A new occurrence receives one planned cognition ID. A replay reuses the established
   record and must not create another cognition.

4. **Ember prepares cognition.**
   [`prepareCognition`](../../src/core/app/cognition-preparation.ts) resolves Ember-owned
   conversation membership, recent dialogue, onboarding work, and the
   least-sufficient semantic projection. Transport message IDs and provider sessions do
   not become conversation identity or canonical memory.

5. **The application executes the prepared cognition.**
   [`executePreparedCognition`](../../src/core/app/cognition-execution.ts) records accepted
   user evidence and cognition lifecycle state, then calls the Ember-owned
   [`AiExecutor`](../../src/core/ai/contract.ts).

6. **AI mechanics stay below the Ember contract.**
   Production Codex, Cursor, process, and Claude Code execution are composed under
   [`../../src/core/ai`](../../src/core/ai/). The ordinary production stack uses Vercel AI SDK
   mechanics behind `AiExecutor`. Selected capabilities are passed per call and are
   still authorized by Ember before execution.

7. **Cognition becomes durable before transport delivery.**
   A successful execution is validated against the supplied projection, then Ember
   commits the agent expression, cognition evidence, and conversation reply. The
   interaction boundary creates a durable delivery intent retaining the representation
   before any transport send.

8. **Post-turn work is application-owned and fallible.**
   [`runPostTurnFollowUps`](../../src/core/app/post-turn.ts) may evaluate onboarding
   progress and generate memory proposals. Failures are diagnostics; they do not erase
   an already completed cognition or pretend that delivery succeeded.

9. **The surface performs delivery through the application contract.**
   The application reconciles the durable delivery intent through the supplied
   `TransportSend`. CLI writes to stdout. Telegram calls the Bot API. Outcomes are
   recorded as confirmed, failed, retryable, or uncertain without conflating transport
   truth with cognition truth.

10. **The application closes the runtime episode and releases the lease.**
    The runtime is stopped with a reason that reflects success or failure. Lease release
    remains in the outer `finally`, so transport or follow-up failure cannot silently
    leak writer ownership.

The end-to-end regression in
[`tests/cross-surface-semantics.test.ts`](../../tests/cross-surface-semantics.test.ts)
exercises the real CLI/Telegram adapter and composition shape, including restart/replay
behavior. [`scripts/check-dependencies.ts`](../../scripts/check-dependencies.ts)
additionally fails when a conversational adapter starts privately composing the
production application, provider, AI SDK infrastructure, or canonical persistence.

## Durable truth is deliberately split

One ordinary interaction crosses several durable representations with different
meanings:

| Concern                                    | Owner                           | What it proves                                                                    |
| ------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------- |
| Canonical continuity and semantic evidence | `StateStore` and core semantics | Ember-owned meaning and lifecycle                                                 |
| Conversation trajectory                    | `ConversationContextStore`      | Short-lived dialogue membership and retained turns                                |
| Transport occurrence and delivery          | `InteractionLedgerStore`        | Admission, replay identity, retained delivery intent, attempts, and outcomes      |
| Onboarding work                            | `OnboardingWorkStore`           | Progressive onboarding work bound to continuity/principal/scope                   |
| Memory proposal generation                 | `MemoryProposalGenerationStore` | Proposal-generation evidence, not automatic canonical memory                      |
| Provider/runtime observations              | AI/runtime evidence             | Operational facts that do not become identity or semantic authority by themselves |

No provider thread, Telegram chat, systemd unit, launchd job, process ID, or SDK session
is a substitute for Ember continuity.

## Default `ember`: bootstrap around the same conversation path

Machine bootstrap is not a second cognition architecture.

When plain `ember` runs with no default setup record,
[`firstRun`](../../src/apps/cli/setup.ts) asks only for the choices required to
create or restore continuity and select a cognition provider. It then calls
[`bootstrapContinuity`](../../src/core/app/bootstrap.ts), which verifies cognition and
activates the continuity. After successful activation, the same process continues into
`runConfigured`, composes the ordinary CLI application, and consumes the first real
user message through `runCliSurface -> EmberApplication.interact`.

When the default setup record already exists, plain `ember` skips first-run prompts,
calls `prepareConfiguredRun`, composes the same CLI application, and resumes the
configured relationship scope.

Explicit `ember setup` and `ember run --config ... --scope ...` remain operator
interfaces for scripted setup, recovery, nondefault configuration, and explicit scope
selection. They do not define alternate ordinary cognition paths.

## Optional Telegram setup uses a typed trusted-host handoff

Ordinary cognition may return the bounded `setupIntent: "telegram"` field defined by
[`AiExecutionResult`](../../src/core/ai/contract.ts). This is a proposal only.

For a local CLI conversation whose configuration exposes a trusted-host setup callback:

1. the application returns the typed setup intent beside the ordinary interaction
   result;
2. the CLI asks the user for a separate explicit local `yes`;
3. the adapter builds a
   [`TrustedHostSetupRequest`](../../src/core/app/contract.ts) containing the principal,
   scope, proposal occurrence, and attributable confirmation;
4. `../../src/apps` validates that request, selects the host-specific
   resident adapter, and calls the existing Telegram setup workflow;
5. bot-token entry and machine mutation stay on the trusted local host.

A remote Telegram conversation does not receive trusted-host mutation authority and
does not ask the user to send a reusable token in chat. The conversation can explain
how to continue setup locally, but model text alone never authorizes host mutation.

Linux/systemd and macOS/launchd are host adapters around this setup and resident
operation. They are not variants of Ember's application or cognition architecture.

## Ownership boundaries

The current dependency direction is:

```text
bin/* and bootstrap/operator plumbing
        |
        v
src/composition/*
        |
        +--> src/app/*
        |       |
        |       +--> src/core/*
        |       +--> src/runtime/*
        |       +--> injected repositories / AI contract / capabilities
        |
        +--> src/ai/*
        +--> src/persistence/*
        +--> src/integrations/*
        +--> src/host/*
        |
        v
src/apps/* receive the composed application and perform transport work
```

The important negative rules are enforced in
[`scripts/check-dependencies.ts`](../../scripts/check-dependencies.ts):

- conversational surfaces cannot import the production application factory or
  composition root;
- conversational surfaces cannot construct cognition providers, AI SDK
  infrastructure, or canonical persistence;
- application orchestration cannot import concrete surfaces;
- semantic modules cannot depend on AI SDK mechanics;
- application/semantic modules cannot own systemd or launchd details;
- AI infrastructure cannot own canonical persistence or semantic mutation.

See [Source Layout and Surface Placement](source-layout.md) for file-placement rules,
[Interaction Surface Boundary](interaction-surface-boundary.md) for transport
occurrence/delivery semantics,
[AI SDK Cognition Adapter Boundary](ai-sdk-cognition-adapter-boundary.md) for execution
mechanics, and
[Installation, Restore/Create, and Conversational Onboarding Semantics](setup-and-onboarding-semantics.md)
for bootstrap and trusted-host setup semantics.
