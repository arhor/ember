---
status: "accepted"
date: "2026-10-28"
decision-makers: "Repository maintainer"
---

# ADR 0041: Use the shell as the only CLI command interface

## Context

The maintainer approved retiring CLI process subcommands immediately, retaining piped
input, and selecting verified machine setup records inside the shell. A separate
process parser duplicated the shell interface and exposed raw initialization and
explicit provider launches that are no longer part of the intended user interface.

## Decision

Supersede [ADR 0040](0040-open-an-empty-shell-and-configure-explicitly.md). Retain its
empty-shell, fresh-conversation, explicit-setup, no-onboarding and continuity safeguards;
replace its requirement to preserve process commands with the following interface.

`ember` accepts only `--diagnostics` and standalone `--help`/`-h`. Removed subcommands
and launch overrides fail with status 2 and migration guidance. There are no aliases
or deprecation period. Piped line-oriented stdin and EOF termination remain supported.

Local slash commands, also accepted with a colon prefix, own setup, inspection,
Markdown export/import, deterministic explanation, correction with a reason, validation
and lock recovery. Their existing explicit path, principal, scope, approval evidence
and output contracts remain intact. Raw `init` and explicit state/provider `run` are
retired. Continuity creation and provider changes go through explicit trusted setup.

`/use --config PATH [--scope SCOPE]` selects a verified setup record for this process.
Omitted scope is `relationship:<principal>`. Validate continuity binding under lease
before selection; failure preserves the prior selection. Selection is not persisted
and does not invoke cognition. Success makes the next message start fresh context.
`/setup` targets the selected record unless explicitly overridden; an override never
implicitly changes selection.

Help, setup, selection, diagnostics and recovery execute before runtime composition.
They do not create conversations, runtime episodes or interaction evidence. Recovery
must remain usable when selected configuration, canonical state or a stale lock prevents
normal runtime startup. Preserve each operation's existing lease requirements; never
acquire the stale lock in order to diagnose or quarantine it.

Retain ordinary memory and action commands, confirmation semantics, conversational
identity, cancellation and short writer leases. Never send local commands, setup answers
or credentials through cognition. Unconfigured messages suggest setup without replay.
Handled command errors leave the shell open and do not change its final status from 0.

## Consequences and alternatives

One command interface replaces compatibility aliases and separate scripting commands.
Automation sends shell lines on stdin and must inspect command diagnostics: exit status
0 alone does not certify that every submitted command succeeded. No schema migration,
new dependency, Telegram change or background-runtime interface change is required.
Provider integration fixtures may compose explicit services through internal APIs;
they do not reintroduce raw provider launches in the shipped executable.

## Implementation plan

- Make `apps/cli/src/setup.ts` own input, local routing, selection and service cleanup.
- Extract local operation handlers and registration; remove the process dispatcher and
  raw launch argument contracts. Preserve deterministic output and approval checks.
- Migrate executable evaluations to configured shell sessions. Keep low-level provider
  fixtures separate from executable-interface tests.
- Update current guidance and preserve historical examples with explicit labels.

## Verification

- [x] Bare launch/help/reset/quit perform no cognition or conversation creation.
- [x] Removed process commands return status 2; shell command errors allow later input.
- [x] Selection validates readiness/binding, preserves the old selection on failure, and
      creates fresh context on the next message after success.
- [x] Diagnostic reads and lock recovery remain independent of provider readiness.
- [x] Correction reasons, Markdown approval rules, action confirmations and memory survive.
- [x] Piped sessions and complete-process restart evaluation remain supported.
- [x] Type checks, dependency checks, deterministic tests, formatting and warning-free lint pass.

## Implementation evidence

On 2026-10-28, the full deterministic suite passed all 711 tests. After adding a live
writer-lock diagnostic regression, the complete 18-test shell suite also passed.
Production and agent-contract TypeScript checks, dependency-boundary checks, formatting,
and warning-free lint passed. Real executable tests cover configured Codex and Cursor
fixtures and fresh conversation membership after selection; the restart evaluation
uses separate configured shell processes. No live provider or remote-account calls
were used for validation.

ADR review confirmed explicit interface and failure semantics, retained continuity and
approval constraints, implementation boundaries, migration guidance and verifiable
acceptance criteria. The accepted plan supplies the maintainer's approval for this
replacement; no additional architecture or dependency decisions are introduced.
