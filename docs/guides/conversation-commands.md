# Conversation commands

[ADR 0042](../architecture/decisions/0042-share-conversation-commands-across-surfaces.md)
owns the command boundary. CLI and Telegram expose the same conversation operations
through one application catalogue and executor. Enter /help for current usage.

## Discovery and input

In an interactive CLI terminal, type / to see matching commands and descriptions.
Use arrow keys to select, Tab to insert, Escape to dismiss, and Enter to submit.
Entering /remember followed by a space suggests relationship, fact, and episode
subcommands. Long input scrolls horizontally within one editable row. Cursor movement and deletion
respect grapheme boundaries, including emoji and combining characters. Piped input
remains plain line-oriented text.

Telegram uses its native slash menu, registered for the configured private chat at
worker startup. Menu registration failure is diagnostic and polling continues.
Telegram names use underscores, such as /show_action and /new_conversation;
both surfaces also accept the existing hyphenated names. The CLI retains colon
prefixes. Nested commands use a space: /remember fact followed by its arguments.

Arguments remain explicit. Quote values containing spaces, especially the JSON
material confirmation returned by /show-action. Missing arguments and unknown
commands return diagnostics; they do not become prompts to cognition.

Examples for an active scope of private and principal alice:

    /remember fact user:alice location private 'Currently in Warsaw'
    /prefer user:alice response-length private 'Keep replies concise'
    /undertake follow-up private 'Revisit the deployment tomorrow'
    /show_action action-proposal-ID
    /new_conversation

Use the exact proposal ID, digest, and quoted material confirmation from the
presentation when approving or rejecting. A proposal presented on CLI must be
presented on Telegram before a Telegram approval. Reset starts fresh conversation
context while preserving durable identity and memory.

## Access and local operations

Telegram admission remains restricted to the configured private chat and principal.
Explicit scope arguments cannot widen that scope. Explanation questions and target
meaning IDs must also remain inside the active scope and principal, including
linked historical meanings. Commands never establish new authority by themselves.

Existing explicit local operator and diagnostic reach is preserved. Host setup,
configuration selection, file materialization/import, validation, lock recovery,
and /quit stay local. They remain usable without a working cognition provider.
The fixture withholding command is excluded from normal discovery and remote parsing.

## Durable commands and recovery

Deterministic Telegram commands use the private sidecar named by appending
.commands.json to the state path, alongside the ordinary interaction/delivery sidecars.
Include it when moving or backing up continuity. It retains input correlation,
command admission, reply text, and delivery attempts; it is operational evidence,
not model memory.

A duplicate update reuses its established result. Conflicting payloads for an update
are rejected. Ordinary messages and deterministic commands cannot reuse an admitted
update identity interchangeably. Explanation commands retain their original invocation correlation in the command
journal and use the existing cognition and delivery ledger for their execution.
Deterministic operations do not create cognition records.

Each admission also binds its record to the current lineage ID and establishment
time. Before retained replies are sent, Ember reloads canonical state under the
writer lease and verifies principal and continuity. Reconciliation selects only
the current configured principal and scope and includes eligible topic destinations
within the configured chat. Journals created without continuity bindings fail closed;
preserve them for offline reconciliation rather than inferring a binding from the
currently selected state.

Completed commands retain their reply before send. Definite retryable send failures
are retried by polling reconciliation after their retry time; non-retryable failures
are retained without automatic resend. Started or uncertain sends block blind resend.
A lost reply never justifies executing the command again.

If a record remains admitted after interruption, its effect may already have happened.
The worker rejects that replay rather than rerunning it. Stop the worker and inspect
canonical state, action proposals, conversation context, and the command journal to
establish what happened. Preserve the journal as evidence; restarting alone cannot
resolve the ambiguity. Do not delete an admission or resubmit a mutation until its
effect has been reconciled. There is no automatic administrative override in this
release. A stale command-journal writer lock is distinct from the canonical lock and
uses the same local lock-status/quarantine procedure with the sidecar as the target.
