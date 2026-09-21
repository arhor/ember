---
summary: "Current source-layout rules for interaction surfaces, unified typed CLI routing, machine-local setup, and inward dependency boundaries."
read_when:
  - "Adding or reorganizing an interaction surface under src/surfaces/"
  - "Deciding whether CLI code belongs to conversational surface mechanics or CLI-local command plumbing"
  - "Changing source organization or dependency direction around surfaces, runtime, core, providers, or persistence"
role: design
discovery_status: current
---

# Source Layout and Surface Placement

Ember's filesystem layout is implementation architecture beneath the representation-neutral semantic baseline. Directory placement should make ownership and dependency direction visible without inventing abstractions that the semantics do not require.

## Interaction surfaces

Concrete ways for a principal to interact with Ember live under one surface namespace:

```text
src/surfaces/
├── cli/
│   ├── index.ts
│   ├── main.ts
│   ├── setup.ts
│   └── surface.ts
└── telegram/
    ├── index.ts
    ├── setup.ts
    ├── surface.ts
    └── surface.test.ts
```

Each surface directory exposes `index.ts` as its public module entrypoint. Code outside that surface imports through the index; files such as `main.ts` and `surface.ts` are implementation details that may change without forcing consumers to follow the internal layout.

The local conversational CLI and Telegram are sibling interaction surfaces over the shared boundary in `src/runtime/interaction-boundary.ts`. They may differ in transport mechanics, principal-provenance evidence, occurrence correlation, delivery mechanics, and lifecycle plumbing, but neither owns canonical identity, memory, authority, context-selection policy, or delivery truth.

A new concrete interaction surface should normally become another `src/surfaces/<surface>/` sibling with an explicit `index.ts` entrypoint. Do not introduce a generic `Surface` interface, registry, framework, or plugin layer merely because two concrete surfaces exist. Shared abstractions should follow demonstrated duplicated mechanics or a separately justified requirement.

Surface-local tests belong beside their implementation when they primarily exercise one adapter. Cross-surface continuity, privacy, provenance, and integration scenarios remain under top-level `tests/` because their subject is the relationship between modules rather than one local adapter.

## CLI module and conversational surface

`bin/ember.ts` remains the executable entry point for the general Ember CLI and imports the public CLI module from `src/surfaces/cli/index.ts`.

Everything that is specifically CLI-facing stays inside `src/surfaces/cli/`. The current internal split is deliberately small:

- `index.ts` defines the public module API;
- `main.ts` owns CLI argument parsing and command dispatch;
- `setup.ts` owns machine-local bootstrap, provider verification, setup recovery, and the configured `run` handoff; and
- `surface.ts` owns the conversational `run` mechanics.

Every command passes through `parseArgs()` once and the same dispatch switch.
`model.ts` defines `Commands`, `CommandSpecs`, and the typed command arguments, including
`SetupArgs` and `RunArgs` with `mode: "explicit" | "configured"`. Setup and configured
run handlers receive those typed arguments; they do not parse their own option grammar
or bypass dispatch based on the presence of a flag.

The CLI dispatch includes commands such as:

- `init`;
- `setup`;
- `inspect` and `explain`;
- `correct`;
- `check` and `lock-status`; and
- `quarantine-stale-lock`.

Co-location does not make these commands conversational interaction-surface semantics. They administer, inspect, or mutate Ember state through the CLI. Their orchestration may depend directly on existing core, persistence, or runtime APIs while there is no demonstrated second consumer that justifies extracting a generic application/use-case layer.

The `run` command is different. Its readline loop, interactive semantic commands, provider selection for user conversation, SIGINT cancellation, local output delivery, `local_cli` surface identity, and `explicit_local_argument` principal provenance are concrete local-surface mechanics. `main.ts` delegates those mechanics to `surface.ts`.

This keeps the semantic distinction required by the interaction architecture without preserving a separate top-level `src/cli/` namespace merely for composition plumbing.

## Telegram surface

Telegram-specific Bot API integration lives under `src/surfaces/telegram/`, with `index.ts` as its public entrypoint, `surface.ts` as the transport implementation, and `setup.ts` as its trusted-host setup boundary. This includes configuration validation, masked token entry, private-chat mapping, long polling, transport occurrence evidence, concrete `sendMessage` delivery, reconciliation, and systemd unit rendering and installation.

These mechanics remain subordinate to the shared interaction boundary. Telegram update/chat/message identifiers stay operational evidence and do not become canonical memory or semantic authority merely because their adapter is grouped as a surface module.

## Intended dependency direction

Concrete surfaces and CLI-local composition depend inward on shared Ember modules:

```text
        executable plumbing
               |
               v
     surface public entrypoint
               |
          +----+----+
          |         |
          v         v
   CLI dispatch   conversational surface
          |         |
          |         v
          |   runtime interaction boundary
          |      /      |       \
          +---->v       v        v
              core  persistence  provider contract/adapters
```

The public `index.ts` files make module boundaries explicit without introducing repository-wide barrel layers. The important rule is ownership: `core` and the shared runtime boundary must not depend on concrete CLI or Telegram implementations. Concrete surfaces and CLI-specific composition may depend inward on shared runtime, persistence, provider, and core APIs, but they must not redefine shared semantic policy locally.

## Evolution from the earlier source reorganization

Issue #105 correctly separated the then-flat implementation into core, runtime, providers, persistence, and a CLI application boundary. At that point the repository did not yet contain the later explicit interaction-surface boundary and concrete Telegram surface.

The current layout is the next architectural step rather than a reversal of that decision. The shared interaction semantics added later revealed CLI conversation and Telegram as sibling concrete surfaces. The general CLI remains a real executable interface, but its CLI-specific parsing and administrative composition now live beside its conversational adapter under `src/surfaces/cli/` instead of requiring a second top-level CLI namespace.

Ember remains one npm package. This source organization does not create independently versioned packages or a generic channel framework.

## Application contract layer (#303/#304/#305)

The [accepted canonical application flow proposal](canonical-application-flow.md) amends the
preceding statement that no application/use-case layer would be introduced: `src/app/`
now exists as that layer, starting from `src/app/contract.ts`, the transport-neutral
request/result contract a coordinator will expose to surfaces. It contains no Telegram,
CLI, provider, AI SDK, filesystem, or concrete store types; those stay in `surfaces/`,
`providers/`, `persistence/`, and `runtime/`. `core/interaction-contract.ts` holds the
handful of pure Ember types the contract reuses (`PrincipalAssertionProvenance`,
`ExternalOccurrenceMetadata`, `ConversationMembershipIntent`,
`DeliveryReconciliationResult`) so `src/app/` and `src/runtime/` share one definition
instead of each declaring their own. The import restrictions proposed for the wider
`src/app/`, `src/ai/`, `src/persistence/`, `src/integrations/`, and `src/host/` split take
effect incrementally with #319, not retroactively; this module does not yet change the
dependency direction described above for surfaces, runtime, persistence, or providers.
