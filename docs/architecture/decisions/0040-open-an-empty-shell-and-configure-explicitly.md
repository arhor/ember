---
status: "superseded"
date: "2026-10-28"
decision-makers: "Repository maintainer"
---

# ADR 0040: Open an empty shell and configure explicitly

> Superseded by [ADR 0041](0041-use-the-shell-as-the-only-cli-command-interface.md), which retains the shell and continuity safeguards and replaces process commands.

## Context

The maintainer requested removal of first-run and conversational onboarding, approved
the implementation plan, and confirmed that unconfigured messages should suggest setup
and every CLI launch should create a fresh conversation on the first message.

[ADR 0038](0038-separate-machine-setup-lineage-selection-and-conversational-onboarding.md)
combined host safeguards with automatic setup and persistent conversational topic work.

## Decision

Supersede ADR 0038. Preserve its host and continuity safeguards below and remove onboarding.

Every bare CLI launch opens the same empty shell. Opening or closing it must not invoke
a provider, fabricate evidence, or create a conversation. The first submitted message
starts a fresh conversation; subsequent messages continue it. Durable identity and
adopted memory persist independently. Telegram conversation selection remains unchanged.

The shell handles slash commands locally before runtime initialization. /setup configures
an unconfigured installation through trusted host prompts; on configured installations
it inspects readiness. Flags expose existing explicit bootstrap operations.
/setup google-calendar exposes trusted Calendar configuration with existing flags.
Existing process commands and colon-prefixed session aliases remain available.

An unconfigured message receives local instructions to run /setup and resend. Do not
queue or replay it. Failed or cancelled setup returns to the shell. Models never receive
setup commands, credentials, or setup answers as chat turns.

Remove onboarding work, topics, model guidance, progress evaluators, repositories and
diagnostics across all surfaces. Ignore legacy sidecars without deleting them or
changing adopted memory. Preserve ordinary memory generation, adoption and correction.

### Retained safeguards

- Explicit create/restore/use-existing intent selects continuity. Missing state never
  authorizes replacing a committed or possibly-created lineage.
- Verify the selected provider through a bounded disposable probe containing no
  canonical meaning, host paths or reusable secrets. Discard its reply and session.
- Validate principal, lineage and establishment-time binding under canonical lease.
  Preserve healthy bindings and reconcile interrupted effects before retry.
- Keep authentication external and secret entry in trusted host code. Calendar retains
  PKCE, exact-state verification, restricted refresh-token files, memory-only access
  tokens, lineage binding and bounded activation reads.
- Preserve verification, activation and cancellation outcomes independently. Failed setup
  cannot roll back committed continuity. Optional integrations do not gate chat.
- Preserve semantic IDs, provenance, uncertainty and scope on restore. Stale/forked-history
  risks remain explicit; setup completion supplies no new action authority.

## Consequences and alternatives

The shell works without a runtime; chat requires verified configuration. Explicit setup
and resubmission were chosen over automatically opening setup on the first message.
Fresh recent context was chosen over continuing previous dialogue behind an empty screen.

Public application contracts lose onboarding dependencies, projection fields and
diagnostics. Canonical state and setup config need no schema migration. Old onboarding
files remain inert for recovery.

## Implementation plan

- Separate shell input ownership from runtime composition; share input with explicit
  setup and close services before reconfiguration.
- Use fresh conversation membership for the first message and after /new-conversation;
  defer persistence until submission.
- Remove onboarding from domain, application, persistence, provider adapters and composition.
- Replace topic evaluations with shell/setup regressions; retain binding, verification,
  recovery, secret-isolation, cross-surface and ordinary-memory coverage.
- Publish current setup guidance and label original onboarding procedures historical.

Affected areas are apps/cli/src, packages/application/src/app and provider/persistence
packages. Follow the existing conversation membership and bootstrap lease contracts.
No dependencies or configuration schemas change; remove the obsolete topic evaluation
script. Never replace canonical meanings with setup answers.

## Verification

- [x] Empty launch and local help/reset/quit create no conversation or provider invocation.
- [x] Unconfigured input suggests setup without automatic replay.
- [x] Cancelled/failed setup leaves the shell usable; successful setup accepts later input.
- [x] Fresh CLI context preserves durable identity/memory; subsequent messages share context.
- [x] Malformed/pending legacy onboarding sidecars cannot block or influence interaction.
- [x] Type checks, dependency checks, tests, formatting and warning-free lint pass.

## Implementation evidence

On 2026-10-28, all 692 deterministic tests passed. Production and agent-contract
TypeScript checks, dependency-boundary checks, formatting and warning-free lint passed.
No live provider or remote-account validation was performed. The ADR review confirmed
explicit shell behavior, retained safety boundaries, legacy-file compatibility and
checkable implementation criteria.
