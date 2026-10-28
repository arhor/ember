# Source Layout and Surface Placement

Decision owners: [ADR 0039](decisions/0039-separate-agent-contracts-engine-and-startup-composition.md)
and the preserved application guarantees in [ADR 0015](decisions/0015-centralize-application-coordination-and-inward-dependencies.md).

## Package ownership

| Package                         | Responsibility                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `@ember/agent`                  | Provider-free agent, interaction, actor, surface, session and run contracts                |
| `@ember/engine`                 | Generic lifecycle, repository ports, in-memory defaults, startup plugins, hooks and events |
| `@ember/domain`                 | Canonical state, identity, projection, memory, onboarding, objectives and authority rules  |
| `@ember/application`            | Ember coordination and consumer-owned repository/cognition interfaces                      |
| `@ember/persistence`            | Filesystem repositories, interaction ledger, materialization and engine sidecars           |
| `@ember/ai-sdk`                 | Cognition, structured controls, provider bridges and provider process protocols            |
| `@ember/mcp`                    | MCP capability source and lifecycle                                                        |
| `@ember/google-calendar`        | Calendar capabilities                                                                      |
| `@ember/host`                   | Host process and service-manager infrastructure                                            |
| `@ember/composition`            | Production assembly, configuration mapping, setup and episodic execution                   |
| `@ember/cli`, `@ember/telegram` | Sibling surfaces, executables and explicit operator commands                               |

The retired `@ember/core` package has no compatibility layer. Historical documents and
ADRs retain their original source paths as provenance; current implementation references
use the owners above.

## Execution and composition

Ordinary conversational adapters receive `EmberApplication`; they map transport input,
principal provenance, occurrence metadata and delivery observations. CLI streams and
Telegram objects stay outside agent contracts, domain rules and application policy.

Production composition registers collaborators at startup and creates an engine-backed
application. Generic runs record execution independently from canonical cognition,
occurrence identity and delivery. Engine session/run sidecars never become agent identity
or canonical memory. Mandatory authority, replay and continuity checks remain explicit
application steps. The application retains its writer lease through ordinary coordination
and releases it in an outer `finally`.

Plugins register explicit typed collaborators, hooks, observers and cleanup before startup.
Registration closes when startup begins. Setup validates dependencies and singleton
conflicts; cleanup runs in reverse order. Observers report diagnostics and do not change
execution outcomes. See the exported `EngineBuilder` and adapter plugin factories.

## Dependency direction

Agent contracts have no third-party runtime dependency. Engine depends on agent contracts.
Domain rules depend on neither engine nor adapters. Application depends on domain and
generic execution contracts; adapters implement application-owned ports. Composition
connects concrete implementations. Concrete apps do not import each other, and ordinary
surface modules do not construct providers or canonical stores.

`scripts/check-dependencies.ts` scans production package/app code and root entry points.
It enforces the package graph, SDK isolation, surface boundaries and retired-core rejection.
Narrow bootstrap/operator exceptions describe actual responsibilities rather than granting
an entire surface infrastructure access.

## Tests and evaluations

Module tests live beside their owner; cross-cutting acceptance tests live in `tests/`.
The root test command includes packages, apps and integration tests. Root checks cover
package/app source and explicit contract type tests as well as deterministic dependency enforcement.
Evaluation harnesses under `eval/` may construct controlled fixtures; they are not
production entry points. Live-provider observations remain separate from deterministic
migration verification.

See [Canonical Ember Application Flow](canonical-application-flow.md) for message ordering.
