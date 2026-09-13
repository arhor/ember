# Ember

Ember is an experimental persistent personal agent runtime focused on continuity, memory, agency, and composable capabilities.

The initial research programme and representation-neutral semantic architecture are established. The repository now also contains a deliberately narrow executable continuity slice implemented as native ESM TypeScript on Node.js 26, following [ADR 0006](docs/architecture/decisions/0006-adopt-typescript-on-nodejs-26.md).

## Quick start

The supported development/runtime baseline is Node.js **26.8.1 or newer within 26.x** and npm. TypeScript is executed directly by Node; there is no transpilation or generated JavaScript tree.

```sh
npm ci
npm run check
npm test
```

Inspect machine setup directly from source, then explicitly create a new lineage or
attach existing continuity. Authenticate with your chosen provider's own login flow first:

```sh
node bin/ember.ts setup
node bin/ember.ts setup --intent create-new --principal user-1 --provider codex
node bin/ember.ts run --config "$HOME/.ember/config/setup.json" --scope relationship:user-1
```

The application home separates machine configuration (`~/.ember/config/`) from continuity
state (`~/.ember/state/`). Setup prints the configuration path; `--config` and `--state`
provide independent overrides.
See [Setup and Onboarding](docs/architecture/setup-and-onboarding-semantics.md#implemented-machine-bootstrap-253)
for restore, provider selection, and recovery. The low-level `init` command remains available;
see the [Minimal Continuity Slice Runbook](docs/architecture/minimal-continuity-runbook.md)
for explicit `run`, inspection, recovery, and provider examples.

## Repository layout

The adopted runtime is organized around explicit module boundaries rather than one flat source directory:

- `src/core/` owns canonical state types, semantic operations, projections, and shared domain errors;
- `src/runtime/` owns runtime lifecycle and cognition orchestration;
- `src/providers/` owns the one-shot cognition provider contract, generic process transport, concrete provider adapters, and provider evidence helpers;
- `src/delegation/` owns bounded specialist-delegation boundaries, kept conceptually separate from one-shot cognition providers;
- `src/persistence/` owns durable state storage;
- `src/surfaces/` owns concrete interaction modules, with each surface grouped under `src/surfaces/<surface>/`; the local CLI and Telegram are sibling modules over the shared interaction boundary. CLI-specific command parsing and operator/application dispatch remain local to `src/surfaces/cli/`, while conversational mechanics are isolated in its `surface.ts`;
- `eval/` contains longitudinal and process-restart evaluation harnesses rather than production runtime code;
- narrow module tests live beside the module they exercise, while cross-cutting acceptance and integration tests live under `tests/`.

See [Source Layout and Surface Placement](docs/architecture/source-layout.md) for the current placement rules and intended dependency direction.

Older research/evaluation records and explicitly historical sections of current design records may preserve source paths that were accurate when those artifacts were produced. Current implementation references should use the layout above.

## Design and architecture

- [Vision](docs/vision.md)
- [Design principles](docs/principles.md)
- [Architecture index](docs/architecture/README.md)
- [Source layout and surface placement](docs/architecture/source-layout.md)
- [Cross-cutting design directions](docs/architecture/design-directions.md)
- [Architecture acceptance scenarios](docs/architecture/acceptance-scenarios.md)
- [Minimal continuity vertical slice](docs/architecture/minimal-continuity-slice.md)
- [Minimal continuity runbook](docs/architecture/minimal-continuity-runbook.md)
- [TypeScript runtime decision](docs/architecture/decisions/0006-adopt-typescript-on-nodejs-26.md)
- [Architecture research](docs/research/README.md)
