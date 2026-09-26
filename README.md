# Ember

Ember is an experimental persistent personal agent runtime focused on continuity, memory, agency, and composable capabilities.

The repository contains a native ESM TypeScript implementation on Node.js 26. The current production architecture routes
CLI and Telegram interaction through one transport-neutral Ember application boundary while keeping continuity, semantic
state, authority, conversation membership, and delivery truth Ember-owned.

## Quick start

The supported development/runtime baseline is Node.js **26.8.1 or newer within 26.x** and pnpm. TypeScript is executed
directly by Node; there is no transpilation or generated JavaScript tree.

```sh
pnpm install
pnpm check
pnpm test
```

Run Ember from source:

```sh
node bin/ember.ts
```

With no default setup record, plain `ember` asks whether to create a new continuity or restore an existing one, verifies the
selected cognition provider, activates the continuity, and then continues directly into ordinary conversation. On later
runs, plain `ember` loads the same configured continuity and relationship scope.

Provider authentication remains owned by the selected provider runtime. Authenticate there first when required.

Explicit setup and nondefault runs remain available for scripting, recovery, or alternate configuration:

```sh
node bin/ember.ts setup --intent create-new --principal user-1 --provider codex
node bin/ember.ts run --config PATH --scope SCOPE
```

The application home separates machine configuration (`~/.ember/config/`) from continuity state (`~/.ember/state/`).
A resident service is optional. Foreground CLI conversation does not require systemd, launchd, or another daemon.

See [Canonical Ember Application Flow](docs/architecture/canonical-application-flow.md) for the complete ordinary message
path and [Setup and Onboarding](docs/architecture/setup-and-onboarding-semantics.md) for create/restore, provider
verification, recovery, and trusted-host setup.

## Repository layout

The production tree is organized by ownership:

- `src/core/app` owns the transport-neutral application contract, ordinary interaction coordination, cognition preparation
  and execution coordination, post-turn work, bootstrap decisions, and application-level use cases;
- `src/core/composition` is the executable/bootstrap composition layer that assembles repositories, cognition execution,
  capability selection, and concrete surface services;
- `src/core/ai` owns the Ember AI execution contract, Vercel AI SDK execution mechanics, bounded provider/model bridges,
  structured control generation, and generic process compatibility mechanics;
- `src/core/` owns canonical state types, semantic operations, projections, runtime-episode semantics, and shared domain
  errors;
- `src/runtime/` owns focused operational runtime mechanics such as the interaction ledger, delivery reconciliation, and
  episodic unattended execution;
- `src/core/persistence` owns durable filesystem-backed repositories and materializations;
- `src/core/integrations` owns concrete external capability and protocol adapters such as Google Calendar and MCP;
- `src/core/host` owns host/process/service-manager mechanics such as subprocess lifecycle, systemd, and launchd;
- `src/apps` owns concrete interaction transports. CLI and Telegram receive an already composed
  `EmberApplication` for ordinary conversation and keep transport-specific admission and delivery behavior;
- `eval/` contains evaluation harnesses rather than production runtime code;
- narrow module tests live beside the module they exercise, while cross-cutting acceptance and integration tests live under
  `tests/`.

Conversational surfaces must not privately compose the production application, providers, AI SDK infrastructure, or
canonical persistence. `scripts/check-dependencies.ts` enforces the high-value dependency rules in `pnpm check`.

See [Source Layout and Surface Placement](docs/architecture/source-layout.md) for placement rules and dependency direction.

## Design and architecture

- [Canonical application flow](docs/architecture/canonical-application-flow.md)
- [Vision](docs/vision.md)
- [Design principles](docs/principles.md)
- [Architecture index](docs/architecture/README.md)
- [Source layout and surface placement](docs/architecture/source-layout.md)
- [Interaction surface boundary](docs/architecture/interaction-surface-boundary.md)
- [AI SDK cognition adapter boundary](docs/architecture/ai-sdk-cognition-adapter-boundary.md)
- [Setup and onboarding semantics](docs/architecture/setup-and-onboarding-semantics.md)
- [Architecture acceptance scenarios](docs/architecture/acceptance-scenarios.md)
- [Cross-cutting design directions](docs/architecture/design-directions.md)
- [TypeScript runtime decision](docs/architecture/decisions/0006-adopt-typescript-on-nodejs-26.md)
- [Architecture research](docs/research/README.md)

Older research, evaluations, and explicitly historical documents may preserve source paths or architecture names that were
accurate when those artifacts were produced. Current implementation work should begin with the canonical flow and current
discovery metadata above.
