---
summary: "Current source-layout rules for application composition, AI execution, host boundaries, thin conversational adapters, CLI routing, and enforced inward dependencies."
read_when:
  - "Adding, moving, or reorganizing production code under src/"
  - "Adding or changing an interaction surface under src/apps/"
  - "Deciding whether code belongs to application coordination, composition, AI mechanics, runtime operations, persistence, integrations, host adapters, or transport"
  - "Changing dependency rules enforced by scripts/check-dependencies.ts"
role: design
discovery_status: current
---

# Source Layout and Surface Placement

Directory placement is an ownership statement. The current layout is designed so that
an ordinary interaction can be traced from an executable through composition into one
application boundary without finding provider construction or canonical persistence
hidden inside a transport adapter.

## Production ownership map

```text
src/
  app/           transport-neutral application contract, use-case coordination, bootstrap
  composition/   concrete production dependency assembly at executable/bootstrap boundaries
  ai/            Ember AI execution contract, AI SDK mechanics, model/provider bridges
  core/          canonical state, semantics, projections, shared domain/runtime-episode rules
  runtime/       interaction ledger, delivery reconciliation, episodic operational runtime
  persistence/   filesystem-backed repositories and materializations
  integrations/  external capability/protocol adapters such as Calendar and MCP
  host/          subprocess and service-manager mechanics such as systemd and launchd
  apps/      CLI, Telegram, and future concrete interaction transports
```

These directories are not independently versioned packages. Ember remains one npm
package, and shared abstractions are introduced only where demonstrated ownership
requires them.

## Application and composition

`src/app/contract.ts` defines the transport-neutral
`InteractionEvent`, `EmberApplication`, delivery callback, and typed trusted-host
setup handoff shapes. It must not expose Telegram objects, CLI streams, AI SDK types,
filesystem paths, or concrete store implementations.

`src/app/application.ts` is the only production coordinator for an ordinary user
interaction. It owns the writer lease and runtime episode around admission, cognition,
post-turn work, and delivery reconciliation.

`src/composition/ember.ts` is the production dependency composition root. It creates
repositories, the configured `AiExecutor`, structured control helpers, capability
selection, and the other collaborators required by the application.

Surface-specific composition is intentionally tiny:

- `src/composition/cli.ts` adapts validated CLI/bootstrap configuration into one
  composed application plus repositories needed by explicit operator commands;
- `src/composition/telegram.ts` adapts validated Telegram configuration into the same
  application dependencies.

Composition belongs to executable/bootstrap plumbing, not to ordinary conversational
surface modules.

## AI execution

`src/ai/contract.ts` owns the application-facing `AiExecutionRequest`,
`AiExecutionResult`, `AiExecutionOptions`, and `AiExecutor` contract.

`src/ai/cognition.ts` owns the shared Vercel AI SDK ordinary cognition mechanics.
Concrete Codex, Cursor, Claude Code, and process bridges also live under `src/ai/`.
Provider-specific process/protocol mechanics are implementation details beneath the
Ember-owned execution contract.

Semantic modules do not import AI SDK runtime types. AI infrastructure does not mutate
canonical persistence or semantic state directly.

## Interaction surfaces

Concrete ways for a principal to interact with Ember live under one surface namespace:

```text
src/apps/
  cli/
    index.ts
    main.ts
    model.ts
    setup.ts
    commands.ts
    surface.ts
  telegram/
    index.ts
    config.ts
    setup.ts
    surface.ts
```

Each surface directory exposes `index.ts` as its public module entrypoint. Files such
as `main.ts`, `setup.ts`, and `surface.ts` are internal implementation structure.

CLI and Telegram are sibling adapters over the same `EmberApplication`. They may
differ in input parsing, principal-provenance evidence, occurrence metadata, delivery
transport, polling, cancellation, and recovery. They do not own canonical identity,
memory, context policy, provider selection, cognition execution, or application
composition.

A new concrete interaction surface should normally become another
`../../src/apps` sibling. Do not add a generic surface registry, plugin
framework, or event bus merely because multiple surfaces exist.

## CLI placement

`bin/ember.ts` is the general CLI executable and imports the public CLI module.

The CLI-specific split is:

- `main.ts` owns argument parsing and command dispatch;
- `setup.ts` owns first-run prompts, configured-run preparation, and trusted local
  setup handoff;
- `commands.ts` owns explicit in-session operator/admin commands;
- `surface.ts` owns ordinary readline interaction, SIGINT cancellation, local
  occurrence provenance, and stdout delivery over an injected `EmberApplication`.

Explicit operator commands may depend on repositories or application/host operations
when that is the command's actual responsibility. Their co-location under
`apps/cli/` does not make those operations part of the ordinary conversational
adapter.

The ordinary conversational path is stricter: it receives the composed application
and calls `EmberApplication.interact`.

## Telegram placement

Telegram-specific Bot API integration lives under `../../src/apps`.

- `config.ts` parses and validates machine transport configuration;
- `setup.ts` owns the existing trusted-host Telegram setup workflow;
- `surface.ts` owns private-chat admission, long polling, transport occurrence
  evidence, Bot API delivery, and Telegram reconciliation.

`bin/ember-telegram.ts` loads machine configuration and secrets, calls
`composition/telegram.ts`, and injects the resulting application/repositories into
the polling adapter.

Resident installation is selected through host infrastructure. Linux/systemd and
macOS/launchd remain `src/host/` concerns and do not create alternate Telegram
application architectures.

## Runtime and host placement

`src/runtime/` contains operational mechanisms that are shared by application flows
without owning transport or provider construction. In particular,
`runtime/interaction-boundary.ts` owns occurrence/delivery ledger mechanics and
delivery reconciliation.

Portable semantic runtime-episode state lives in `src/core/runtime-episode.ts`.
Platform-specific process and service-manager behavior belongs in `src/host/`.

A systemd unit, launchd job, resident Telegram worker, or foreground process is an
operational host shape around Ember. None is a canonical identity or a separate
ordinary interaction coordinator.

## Intended dependency direction

```text
bin/*, CLI bootstrap, resident worker
              |
              v
       src/composition/*
        /      |       \
       v       v        v
   src/app   src/ai   infrastructure
      |                /   |    \
      v               v    v     v
 core/runtime   persistence integrations host
      ^
      |
surfaces receive EmberApplication and map transport only
```

The exact graph is intentionally not a framework-wide DI system. The important rule is
that construction points are explicit and ordinary transports do not rediscover
dependencies privately.

## Enforced boundaries

`scripts/check-dependencies.ts` is part of `pnpm check`. It inspects production
TypeScript imports, including static dynamic imports, and enforces the highest-value
ownership rules.

Among other checks:

- `core/` cannot import concrete surfaces;
- application orchestration cannot import concrete surfaces;
- ordinary CLI/Telegram conversational modules cannot import the application factory
  or `composition/`;
- ordinary conversational modules cannot construct providers, AI infrastructure, or
  canonical persistence;
- semantic owners cannot import AI SDK mechanics;
- AI infrastructure cannot own canonical persistence or semantic mutation;
- application and semantic modules cannot own systemd or launchd adapters.

Exceptions are narrow and explicit for real bootstrap, setup, recovery, or operator
responsibilities. Adding a new file under a surface does not inherit an exception.

## Tests and evaluations

Tests that primarily exercise one module should live beside that module. Cross-cutting
acceptance and integration tests belong under `tests/`.

The canonical cross-surface regression lives in
`tests/cross-surface-semantics.test.ts`. It is intentionally allowed to assemble
fixtures directly because tests and evaluations are not production conversational
surfaces.

Evaluation harnesses live under `eval/` and may construct application dependencies
for controlled experiments. They must not be mistaken for production entry points.

For the executable message path, see
[Canonical Ember Application Flow](canonical-application-flow.md).
