---
status: "accepted"
date: "2026-10-28"
decision-makers: "Repository maintainer"
---

# ADR 0039: Separate agent contracts, engine, and startup composition

## Context

The existing `@ember/core` combines semantic policy, application orchestration,
provider infrastructure, persistence, capabilities, and host management. The maintainer
started `@ember/agent` contracts and `@ember/engine` execution scaffolding and requested
an incremental complete migration to a modular, implementation-independent foundation.
The maintainer selected a reusable engine and startup composition, approved the task
plan, and explicitly requested implementation on 2026-10-28. This records that approval;
it does not claim that migration verification has already completed.

## Decision

Separate the following owners. Dependencies point toward contracts and domain rules;
construction belongs to composition.

| Package                  | Owns                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `@ember/agent`           | Agent, interaction, actor, surface, session, and run contracts                               |
| `@ember/engine`          | Execution lifecycle, repository ports, in-memory defaults, hooks, events, startup extensions |
| `@ember/domain`          | Identity, state, projection, memory, objectives, onboarding, authority, agency rules         |
| `@ember/application`     | Ember use-case coordination and consumer-owned collaborator interfaces                       |
| `@ember/persistence`     | File-backed repositories, ledgers, materialization, recovery                                 |
| `@ember/ai-sdk`          | Cognition adapters, provider bridges, structured controls                                    |
| `@ember/mcp`             | MCP capability adapter                                                                       |
| `@ember/google-calendar` | Calendar capability adapter                                                                  |
| `@ember/host`            | Process and service-manager infrastructure                                                   |
| `@ember/composition`     | Production dependency assembly and configuration mapping                                     |
| CLI and Telegram apps    | Transport adaptation, executables, explicit operator commands                                |

Agent contracts have no third-party runtime dependencies. Engine depends on agent
contracts, never Ember policy or concrete adapters. Domain rules do not depend on
engine, SDK, transports, or persistence implementations. Application consumes injected
ports; adapters implement them. New packages never import legacy core. Temporary
compatibility exports point from legacy core to extracted implementations.

Retain `Agent.handle`, `Agent.getRun`, and the interaction envelope. Propagate payload
and output generics with `unknown` defaults. Use queued, running, completed, failed,
and cancelled run states. Session, durable agent, occurrence, cognition, and delivery
identities remain distinct. Run completion does not establish delivery success.
Session/run repositories are engine-owned ports; in-memory implementations are defaults.
Persist production bookkeeping separately from canonical semantic state. Interrupted
runs remain inspectable and must not cause automatic cognition replay.

Extensions register explicitly before startup, with unique IDs, declared dependencies,
setup and cleanup. Reject duplicates, missing dependencies, cycles, and conflicting
singleton registrations before accepting interactions. Freeze registration after startup.
Hooks execute deterministically in registration order and participate in execution;
await them and fail the operation on hook failure. Events report observations; observer
failures produce diagnostics without changing run outcomes. Cleanup runs in reverse
initialization order, including partial startup failure. Extensions are trusted code,
not a security sandbox or a grant of user authority.

Mandatory Ember authority, continuity, replay and effect checks remain explicit
application steps, not replaceable observer callbacks. Preserve current storage formats,
configuration, commands, runtime topology and behavior. No live loading, automatic
plugin discovery, provider upgrades, new storage technology, or LangGraph adoption.

### Relationship to accepted decisions

This amends ADR 0015's implementation placement and ordinary interaction interface:
a reusable agent/engine boundary now wraps Ember-specific execution. One Ember
application still owns admission, writer lease, continuity, cognition, post-turn work,
and delivery reconciliation. ADR 0015's inward dependencies and semantic guarantees
remain binding. Its former non-goals concerning new package boundaries and extensibility
are superseded only for this approved migration.

ADRs 0001–0005 remain the semantic baseline. ADR 0037's transport-neutral occurrence,
replay and delivery truth remain mandatory. ADR 0036's bounded operational-engine
boundary and LangGraph deferral remain unchanged. A generic run never replaces
canonical purpose, authority, effect evidence, or durable agent identity.

## Alternatives and consequences

Keeping an Ember-specific engine would reduce initial adapter work but embed personal-agent
policy in the reusable lifecycle. Folder-only decomposition would preserve existing
cross-layer coupling. Live loading would add unloading, compatibility and active-run
ownership requirements without a current need. Startup composition provides the chosen
extension boundary with explicit initialization and failure behavior.

The migration adds package and port maintenance. Limit packages to the owners above,
keep domain concepts as focused modules, and enforce imports rather than relying on
conventions. Temporary compatibility exports reduce migration disruption but must be
removed after consumers move. Do not confuse successful file moves with decoupling.

## Implementation plan

Follow the [migration inventory](../modular-package-migration.md). Preserve the maintainer's
existing agent/engine changes. Each numbered task is implemented by a fresh subagent;
the main agent sequences work, reviews interfaces and evidence, and integrates changes.

1. Record architecture, source ownership and baseline checks.
2. Stabilize generic agent contracts and package dependency enforcement.
3. Implement engine lifecycle, cancellation and injected repositories.
4. Implement startup extensions, hooks, events and cleanup.
5. Extract domain rules and decompose the model by existing concepts.
6. Extract application coordination and persistence through consumer-owned ports.
7. Extract provider and capability adapters and startup registration factories.
8. Compose and migrate CLI, then Telegram, through the common execution path.
9. Extract host infrastructure and migrate all remaining consumers and harnesses.
10. Remove core compatibility exports and dependencies; update owning documentation.

Tasks 3 and 5 may run concurrently after task 2; task 4 follows task 3. Task 6 requires
3 and 5; task 7 requires 4–6. Later tasks are sequential. Serialize shared contracts,
manifest and lockfile integration. No new dependency versions or configuration keys are
required; transfer existing dependencies to their actual owners.

## Verification

- [x] Dependency checks cover all production packages and reject cycles and legacy imports.
- [x] Agent contracts and engine work with provider-free fixture implementations.
- [x] Lifecycle, cancellation, repository failures and session ownership have behavioral coverage.
- [x] Plugin validation, ordering, rollback, observer failures and shutdown are tested.
- [x] Existing semantic, replay, continuity, authority and delivery recovery regressions pass.
- [x] Existing persisted formats load without migration and uncertain effects are not retried blindly.
- [x] Both surfaces use the same composed application and construct no providers or canonical stores.
- [x] Host, setup, deterministic evaluations, package-local and root tests pass.
- [x] No active source, tests, configuration or executable imports `@ember/core`.
- [x] An independent fixture capability registers without changing agent or engine sources.

Run `nvm use` before tooling, then the repository's required formatting, linting,
typechecking, dependency and deterministic test checks. Live-provider observations are
not required for structural migration acceptance and must not be inferred from fixtures.

### Migration verification — 2026-10-28

The incremental migration retired `@ember/core` and its compatibility exports. A combined
deterministic run passed 708 tests across packages, apps and integration suites. Package
source typechecks and explicit agent contract type tests are checked separately from
runtime fixture tests; historical runtime tests are executed without adding broad casts
or suppressions merely to typecheck their partial mocks. Dependency checks include all
production packages, app executables and root `bin/` and `scripts/` entry points.
Provider/live-service observations are not implied by deterministic test results.
