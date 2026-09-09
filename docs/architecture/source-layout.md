---
summary: "Current source-layout rules for interaction surfaces, application CLI plumbing, and inward dependency boundaries."
read_when:
  - "Adding or reorganizing an interaction surface under src/surfaces/"
  - "Deciding whether CLI code belongs to the conversational surface or operator/application command plumbing"
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
│   └── surface.ts
└── telegram/
    ├── index.ts
    ├── surface.ts
    └── surface.test.ts
```

Each surface directory exposes `index.ts` as its public module entrypoint. Code outside that surface imports through the index; files such as `surface.ts` are implementation details that may change without forcing consumers to follow the internal layout.

The local conversational CLI and Telegram are sibling interaction surfaces over the shared boundary in `src/runtime/interaction-boundary.ts`. They may differ in transport mechanics, principal-provenance evidence, occurrence correlation, delivery mechanics, and lifecycle plumbing, but neither owns canonical identity, memory, authority, context-selection policy, or delivery truth.

A new concrete interaction surface should normally become another `src/surfaces/<surface>/` sibling with an explicit `index.ts` entrypoint. Do not introduce a generic `Surface` interface, registry, framework, or plugin layer merely because two concrete surfaces exist. Shared abstractions should follow demonstrated duplicated mechanics or a separately justified requirement.

Surface-local tests belong beside their implementation when they primarily exercise one adapter. Cross-surface continuity, privacy, provenance, and integration scenarios remain under top-level `tests/` because their subject is the relationship between modules rather than one local adapter.

## CLI conversation versus operator commands

`bin/ember.ts` remains the executable entry point for the general Ember CLI. `src/cli/index.ts` owns command parsing and application/operator dispatch for commands such as:

- `init`;
- `inspect` and `explain`;
- `correct`;
- `check` and `lock-status`; and
- `quarantine-stale-lock`.

Those commands administer, inspect, or mutate Ember state through an application CLI. They are not themselves a conversational interaction surface.

The `run` command is different. Its readline loop, interactive semantic commands, provider selection for user conversation, SIGINT cancellation, local output delivery, `local_cli` surface identity, and `explicit_local_argument` principal provenance are concrete local-surface mechanics. `src/cli/index.ts` therefore parses the `run` invocation and delegates the conversation through the public CLI-surface entrypoint at `src/surfaces/cli/index.ts`.

This distinction prevents the filesystem from implying that operator administration and user conversation are one architectural concern while preserving the existing `ember` command and observable CLI behavior.

## Telegram surface

Telegram-specific Bot API integration lives under `src/surfaces/telegram/`, with `index.ts` as the public entrypoint and `surface.ts` as the concrete implementation. This includes configuration validation, token-file loading, private-chat filtering, long polling, transport occurrence evidence, concrete `sendMessage` delivery, reconciliation, and the systemd unit rendering used by `bin/ember-telegram.ts`.

These mechanics remain subordinate to the shared interaction boundary. Telegram update/chat/message identifiers stay operational evidence and do not become canonical memory or semantic authority merely because their adapter is grouped as a surface module.

## Intended dependency direction

Concrete surfaces depend inward on shared Ember modules:

```text
application / executable plumbing
            |
            v
  surface public entrypoints
            |
            v
      concrete surfaces
            |
            v
 runtime interaction boundary
      /      |       \
     v       v        v
   core  persistence  provider contract/adapters
```

The public `index.ts` files make module boundaries explicit without hiding internal dependencies behind repository-wide barrel layers. The important rule is ownership: `core` and the shared runtime boundary must not depend on concrete CLI or Telegram surface implementations. Concrete surfaces may compose runtime, persistence, and provider mechanics to adapt their transport, but they must not redefine shared semantic policy locally.

## Evolution from the earlier source reorganization

Issue #105 correctly separated the then-flat implementation into core, runtime, providers, persistence, and a CLI application boundary. At that point the repository did not yet contain the later explicit interaction-surface boundary and concrete Telegram surface.

The current layout is the next architectural step rather than a reversal of that decision. The shared interaction semantics added later revealed a distinct category that was previously represented only by the conversational portion of the application CLI. Grouping CLI conversation and Telegram beneath `src/surfaces/` makes that newer architecture visible while retaining `src/cli/index.ts` for the operator/application command role that still exists.

Ember remains one npm package. This source organization does not create independently versioned packages, a generic channel framework, or a new semantic ownership layer.
