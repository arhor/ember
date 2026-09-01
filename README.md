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

Run the continuity CLI directly from source, for example:

```sh
node bin/ember.ts init \
  --state /tmp/ember-continuity.json \
  --name Ember \
  --principal user-1
```

See the [Minimal Continuity Slice Runbook](docs/architecture/minimal-continuity-runbook.md) for complete `run`, inspection, recovery, and provider examples.

## Repository layout

The adopted runtime is organized around explicit module boundaries rather than one flat source directory:

- `src/core/` owns canonical state types, semantic operations, projections, and shared domain errors;
- `src/runtime/` owns runtime lifecycle and cognition orchestration;
- `src/providers/` owns the provider contract, generic process transport, concrete provider adapters, and bounded specialist execution;
- `src/persistence/` owns durable state storage;
- `src/cli/` owns the command-line interface;
- `eval/` contains longitudinal and process-restart evaluation harnesses rather than production runtime code;
- narrow module tests live beside the module they exercise, while cross-cutting acceptance and integration tests live under `tests/`.

Older research and evaluation records may preserve source paths that were accurate when those artifacts were produced; the layout above describes the current implementation.

## Design and architecture

- [Vision](docs/vision.md)
- [Design principles](docs/principles.md)
- [Architecture index](docs/architecture/README.md)
- [Cross-cutting design directions](docs/architecture/design-directions.md)
- [Architecture acceptance scenarios](docs/architecture/acceptance-scenarios.md)
- [Minimal continuity vertical slice](docs/architecture/minimal-continuity-slice.md)
- [Minimal continuity runbook](docs/architecture/minimal-continuity-runbook.md)
- [TypeScript runtime decision](docs/architecture/decisions/0006-adopt-typescript-on-nodejs-26.md)
- [Architecture research](docs/research/README.md)
