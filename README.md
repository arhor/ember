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
node apps/cli/bin/ember.ts
```

Every launch opens an empty chat shell. The first message starts a fresh conversation while
preserving durable identity and memory. If configuration is needed, enter /setup explicitly,
then resend your message. /help lists commands and /quit exits.

Provider authentication remains owned by the selected provider runtime. Authenticate there first when required.

Explicit setup and nondefault runs remain available for scripting, recovery, or alternate configuration:

```sh
node apps/cli/bin/ember.ts setup --intent create-new --principal user-1 --provider codex
node apps/cli/bin/ember.ts run --config PATH --scope SCOPE
```

The application home separates machine configuration (`~/.ember/config/`) from continuity state (`~/.ember/state/`).
A resident service is optional. Foreground CLI conversation does not require systemd, launchd, or another daemon.

See [Canonical Ember Application Flow](docs/architecture/canonical-application-flow.md) for the complete ordinary message
path and [Interactive shell and setup](docs/guides/setup.md) for create/restore, provider
verification, and recovery. Telegram configuration is a manual operator procedure documented in the
[Telegram surface runbook](docs/guides/telegram-surface-runbook.md).

## Repository layout

The workspace separates reusable agent contracts (`agent`), execution (`engine`), Ember
semantics (`domain`), use-case coordination (`application`), filesystem adapters
(`persistence`), providers (`ai-sdk`), capabilities (`mcp`, `google-calendar`), host
infrastructure (`host`), and startup assembly (`composition`). CLI and Telegram are
sibling applications over the same engine-backed Ember application.

Extensions register at startup through typed factories, hooks, events and cleanup.
`scripts/check-dependencies.ts` enforces inward package dependencies. Root tests include
package-local suites and cross-cutting tests; deterministic fixtures remain separate
from live-provider evaluations.

See [Source Layout and Surface Placement](docs/architecture/source-layout.md) for the
ownership map and [ADR 0039](docs/architecture/decisions/0039-separate-agent-contracts-engine-and-startup-composition.md)
for the migration decision.

## Design and architecture

- [Canonical application flow](docs/architecture/canonical-application-flow.md)
- [Vision](docs/vision.md)
- [Design principles](docs/principles.md)
- [Architecture index](docs/architecture/README.md)
- [Source layout and surface placement](docs/architecture/source-layout.md)
- [Interaction surface boundary](docs/architecture/interaction-surface-boundary.md)
- [AI SDK cognition adapter boundary](docs/architecture/ai-sdk-cognition-adapter-boundary.md)
- [Interactive shell and setup](docs/guides/setup.md)
- [Architecture acceptance scenarios](docs/architecture/acceptance-scenarios.md)
- [Cross-cutting design directions](docs/research/design-directions.md)
- [TypeScript runtime decision](docs/architecture/decisions/0006-adopt-typescript-on-nodejs-26.md)
- [Architecture research](docs/research/README.md)

Older research, evaluations, and explicitly historical documents may preserve source paths or architecture names that were
accurate when those artifacts were produced. Current implementation work should begin with the canonical flow and current
[documentation navigation](docs/README.md) and the
[accepted ADR index](docs/architecture/decisions/README.md).
