# Modular package migration

Decision owner: [ADR 0039](decisions/0039-separate-agent-contracts-engine-and-startup-composition.md).
This is the implementation inventory, not a claim that migration is complete.

## Source ownership inventory

| Existing core area                                                                                        | Destination and required decomposition                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`, `semantics.ts`, `projection.ts`, `runtime-episode.ts`, pure conversation and memory contracts | `@ember/domain`; split model by existing domain concepts while retaining compatibility exports during migration                        |
| `agency/`, `objectives/`, `onboarding/`, `memory/`, `capabilities/`, `delegation/`                        | Pure rules to domain; use-case coordination and collaborator ports to application; concrete storage and provider execution to adapters |
| `app/`                                                                                                    | `@ember/application`; admission/replay, preparation, cognition, post-turn and delivery coordination remain distinct                    |
| `runtime/interaction-boundary.ts`                                                                         | Ledger implementation to persistence; delivery coordination to application; transport stream mechanics to surfaces                     |
| `runtime/episodic-runtime.ts`                                                                             | Application runtime coordination; process ownership to host                                                                            |
| `persistence/` and stores embedded in feature directories                                                 | `@ember/persistence`; retain formats, locking and atomic replacement behavior                                                          |
| `ai/`                                                                                                     | `@ember/ai-sdk`; application-facing execution contracts move inward to application                                                     |
| `integrations/mcp/`                                                                                       | `@ember/mcp`                                                                                                                           |
| `integrations/google-calendar/`                                                                           | `@ember/google-calendar`                                                                                                               |
| `host/`                                                                                                   | `@ember/host`; preserve existing process/service behavior                                                                              |
| `composition/`                                                                                            | `@ember/composition`; configuration selects startup adapters without embedding selection in engine                                     |
| `interaction-contract.ts`, errors and utilities                                                           | Domain or application according to meaning; do not create a miscellaneous shared package                                               |

## Couplings that must be removed

`app/application.ts` currently imports `EmberApplicationDependencies` from composition.
Move this interface inward to application before moving composition. Application must
not depend on its construction root, including through type-only imports.

`runtime/interaction-boundary.ts` combines filesystem ledger implementation with delivery
orchestration and imports application cognition helpers. Separate application-owned ports
and reconciliation from concrete ledger storage before assigning package dependencies.
Persistence may implement application ports; application must not import persistence.
Apply the same rule to feature stores and provider-backed policy implementations.

## Consumers and compatibility

Migrate CLI/Telegram surfaces, their bootstrap/operator commands, root `bin/` executables,
`scripts/`, tests, and `eval/` harnesses. Root package dependencies and lockfile must follow
actual consumers. The dependency checker currently enumerates legacy production roots;
expand it before extraction and retain narrow operator exceptions only where justified.

Legacy core may re-export extracted modules temporarily. New packages must never import
legacy core. Remove compatibility exports only after source, fixtures, scripts and
configuration no longer consume them. Preserve canonical storage and existing sidecar
formats; generic run records are separate operational evidence.

## Verification inventory

Use package-local unit tests as well as root tests: the current root `test` script selects
apps and `tests/*.test.ts`, not package-local suites. Existing regression families include
cross-surface semantics and continuity, delivery-before-send recovery, uncertain delivery,
process restart, semantics/projection, currentness/provenance, provider timeout/control,
MCP capabilities, action effects, specialist reintegration, episodic runtime, host setup,
and onboarding. Run deterministic fixtures; do not infer live-provider success.

Each fresh task subagent reports its interface changes, relevant test commands and results,
and remaining issues. Main-agent review gates dependent tasks and owns shared integration.

### Baseline observation — 2026-10-28

`nvm use` was unavailable directly; sourcing `$NVM_DIR/nvm.sh` selected the repository's
Node 26.8.1 successfully. Both `pnpm check` and `pnpm test` were attempted before code
migration. Neither reached its underlying checks: pnpm reported
`ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE` while attempting registry signature
verification for pnpm 12.15.0 under restricted network access. This is an environment
block, not evidence of passing or failing repository tests. No signature verification
bypass or package-manager version substitution was performed.

### Completed migration — 2026-10-28

All ten implementation tasks have corresponding extracted owners. `@ember/core` and
its compatibility exports are removed; module tests moved with their owners. The root
test command covers package, app and integration tests (708 passing). Root source
typechecks cover packages, apps, entry points, evaluation harnesses and live fixture
source; explicit agent contract type tests run separately. Historical runtime test
fixtures continue to execute under Node rather than receiving unrelated typing changes.
Network-enabled package-manager verification subsequently succeeded, and workspace
links/lockfile were refreshed from cached dependencies. The earlier baseline limitation
remains a dated observation, not the final verification outcome.

See [current ownership](source-layout.md) and [application flow](canonical-application-flow.md).
