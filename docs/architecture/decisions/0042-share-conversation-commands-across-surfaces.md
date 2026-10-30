---
status: "accepted"
date: "2026-10-29"
decision-makers: "Repository maintainer"
---

# ADR 0042: Share conversation commands across surfaces

## Context and Problem Statement

The CLI defines conversation commands through Commander and executes their behavior
inside the CLI app. Telegram currently passes accepted text directly to cognition.
The maintainer approved a shared command catalogue and executor, CLI suggestions,
and Telegram's native command menu on 2026-10-29 by requesting implementation of
the reviewed plan. Conversation operations should have consistent behavior across
surfaces without turning remote conversation access into host administration.

## Decision

Application code owns typed conversation-command invocations, descriptors, results,
and execution. Descriptors define names, aliases, descriptions, arguments, options,
and usage. Parsing registrations, help, and discovery derive from this catalogue.
Composition supplies a Commander parsing adapter; Commander types and terminal or
Telegram objects do not enter application or domain contracts. Retain Commander
rather than replacing its existing quoting, argument, option, and error behavior.

Share help, remembering relationships/facts/episodes, preferences, supersession,
commitments, episode details, action presentation/decision/invalidation, explanation
questions, and conversation reset. Keep setup, configuration selection, filesystem
operations, lock recovery, and process exit local. Exclude fixture fault commands
from production discovery. Preserve existing CLI names, colon aliases, output
contracts, and piped input. Accept underscore aliases on both surfaces; Telegram's
menu uses underscores where existing CLI names contain hyphens.

Commands carry authenticated principal, active scope, surface provenance, destination,
and optional external occurrence identity. Command arguments and explanation IDs
cannot widen remote access beyond the active principal and scope. Existing explicit
local operator and diagnostic reach remains unchanged. This amends ADR 0037's
CLI-only explanation restriction: Telegram may request an explanation within its
active scope, without inheriting local diagnostic reach. Host diagnostics remain
local. Validate target meanings before mutation or disclosure.

Action presentations and decisions bind to the actual surface and scope. Preserve
payload digest, material confirmation, expiry, and existing authority checks.
Presenting on CLI does not establish a Telegram presentation. Commands never grant
authority merely because their names are discoverable.

Deterministic commands bypass cognition. Explanation questions use the existing
application interaction boundary. Reset establishes fresh context for subsequent
messages without resetting continuity. Ordinary messages retain existing behavior.
Unknown or malformed slash commands receive deterministic diagnostics.

After Telegram private-chat admission, correlate command occurrences by surface
and update ID and reject conflicting replay. Persist admission before execution
and retain completed results. Replay never repeats a mutation. An admitted command
without durable completion after interruption is uncertain and blocks automatic
re-execution until reconciled; it is not evidence that the operation failed.
Retain reply bytes and record delivery attempts before send, preserving confirmed,
failed, and uncertain outcomes. Deterministic command records must not fabricate
cognition IDs or canonical conversation evidence.

CLI suggestions appear for slash-prefixed interactive input, including nested
remember commands. Support arrow selection, Tab insertion, Escape dismissal, and
Enter submission. Piped input remains line oriented. Telegram registers commands
for the configured private chat; registration failure is diagnostic and does not
prevent polling. Missing arguments return usage; argument-value completion and
multi-message command wizards are outside this decision.

This amends ADR 0041's CLI-local conversation-command ownership while preserving
its local host recovery, setup, empty-shell, and explicit selection guarantees.
ADRs 0015 and 0037 continue governing dependency direction, admission, leases,
occurrence identity, and delivery truth outside the explicit amendments above.

## Consequences

- New surfaces reuse the same command contract and execution policy.
- Host commands remain available before provider or runtime startup.
- Remote deterministic mutations require durable admission and recovery handling;
  parsing and a Telegram menu alone do not complete this migration.
- Existing packages suffice; no new runtime dependency or plugin framework is needed.

## Implementation Plan

1. Add the command catalogue and typed execution boundary under
   `packages/application/src/commands/`; use existing repository ports and semantic
   functions, short writer leases, explicit context validation, and structured results.
2. Assemble parsing and execution collaborators in composition. Migrate CLI session
   handlers without changing local host operations or ordinary interaction behavior.
3. Add durable command admission/completion and delivery records with replay and
   uncertainty handling. Extend Telegram outcomes to represent commands without
   cognition and route admitted commands through the injected command service.
4. Generate help, CLI suggestions, underscore aliases, and the private-chat Telegram
   menu from descriptors. Use one CLI input reader across setup and conversation.
5. Update architecture references, user guidance, and acceptance scenarios as each
   behavior lands. Keep implementation evidence separate from decision acceptance.

### Verification

- [x] Both surfaces expose and execute the same production conversation catalogue.
- [x] Quoting, nested commands, aliases, missing arguments, and unknown commands agree.
- [x] Deterministic commands never invoke cognition; explanation questions use interact.
- [x] Scope violations, unauthorized chats, and invalid action confirmations fail closed.
- [x] Duplicate/conflicting updates and interruption windows cannot repeat mutations.
- [x] Delivery failure and uncertainty preserve retained results without blind resend.
- [x] Reset, completion controls, piped input, EOF, and unconfigured local recovery work.
- [x] Types, dependency checks, deterministic tests, formatting, and warning-free lint pass.

## Alternatives Considered

- Copy CLI handlers into Telegram: duplicates authority, mutation, and recovery policy.
- Replace Commander: adds parser migration work without creating shared execution.
- Expose host administration remotely: exceeds the approved conversation-command scope.
- Treat commands as prompts: prevents deterministic validation and reliable replay.

## Implementation Status

Implemented on 2026-10-29. The deterministic repository suite passed all 728 tests.
Production and agent-contract type checks, dependency checks, formatting, and
warning-free lint passed. Focused tests cover scope rejection, cross-surface action
presentation, command replay, interrupted completion, retained-byte delivery retry,
menu registration failure, and terminal completion controls. A real PTY smoke test
exercised filtering, selection, insertion, and exit. No live Telegram or provider
requests were used. Operational recovery remains deliberately manual for ambiguous
command effects; see the [command guide](../../guides/conversation-commands.md).

### Review corrections — 2026-10-30

The review found missing current-authority/continuity checks for retained command
replies, topic destinations omitted from reconciliation, UTF-16 deletion corruption,
and redraw assumptions for wrapped terminal input. Command records now bind their
admitting continuity; delivery revalidates current state under the writer lease.
Reconciliation takes the current principal/scope and a transport-owned destination
predicate, including private topics. Terminal editing uses grapheme boundaries and
a horizontal viewport to keep the editable buffer on one physical row. Older
unbound command records fail closed and require offline reconciliation.
