---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0011: Keep Streamed Cognition Provisional Until Final Validation

This accepted C01 migration record reconstructs the choice in issue #199.
The maintainer approved this record on 2026-10-27. It supersedes the decision
in the original streaming boundary (consolidated into this ADR; original source in Git history),
which remains a historical implementation reference. Acceptance does not introduce
a streaming feature or change runtime behavior. The original source records no
separate decision date or decision-maker; those historical details remain unknown.

## Context and Problem Statement

Consumers may need to show output before cognition finishes. Partial structured
output may later fail validation, be cancelled, contain unselected meaning IDs, or
accompany uncertain capability effects. The semantic boundary must preserve the
accepted distinctions among evidence, meaning, occurrence, and delivery in ADRs
0002–0005 while allowing AI SDK to supply stream mechanics.

## Decision

Keep streaming optional beside buffered cognition. When a caller supplies an
`AiStreamObserver`, the adapter may publish an Ember-owned
`provisional_text_snapshot` containing the latest non-empty changed reply text.
Snapshots replace prior presentation; they are not an append-only token-delta log.
No SDK stream object, provider metadata, tool-call object, or runtime result type
crosses this observer boundary.

A snapshot is ephemeral presentation. It is not adopted meaning, a completed
expression, valid `usedMeaningIds`, confirmed effect evidence, delivery, or proof
that cognition will succeed. Do not persist snapshots in canonical state,
reconstruct them after restart, or replay them during reconciliation. A displaying
surface retains the uncertainty until the invocation completes.

Only the final structured output, validated against the selected projection's
meaning IDs by `validateAiExecutionResult`, reaches canonical cognition completion.
An observer failure is ignored so presentation cannot turn otherwise valid cognition
into provider failure. Ordinary final delivery retains its own failure semantics.

Buffered calls use `generateText`. Streaming calls use `streamText` with the same
bounded prompt, structured output, selected tools, step limit, retry policy,
timeout, abort signal, capability firewall, and lifecycle evidence. Consume partial
structured reply snapshots rather than forwarding raw SDK chunks. Await and validate
the final output after the stream ends.

Failure after visible snapshots remains provider failure without completed expression
evidence. Caller aborts retain `cancellation_requested`; partial output does not
become completed state. The same capability firewall owns authority, semantic inputs,
occurrence limits, cancellation uncertainty, retry safety, and effect evidence.
Streaming creates no second tool execution path.

## Scope and non-goals

This choice governs provisional cognition presentation and final validation. It does
not choose a transport UI, Telegram edit-in-place behavior, token persistence format,
provider-specific stream protocol, or a new authority/delivery model. A consumer may
ignore provisional output. Provider adapters without streaming remain compatible.

## Alternatives Considered

The source explicitly distinguishes snapshots from token-delta history, raw SDK
stream forwarding, and treating partial output as completed expression. Those
boundaries are excluded because they would leak infrastructure or imply completion
before final validation. Buffered invocation remains available when provisional
presentation is unnecessary. A formal benchmark or historical option-selection
meeting is not recorded; this ADR does not invent one.

## Consequences

- Surfaces can offer provisional presentation without making it canonical truth.
- Snapshot loss on restart is intentional; a visible partial reply may end in failure.
- Consumers must retain the distinction between display, semantic completion,
  capability effects, delivery, and awareness.
- Streaming and buffered behavior share the existing capability and error boundary,
  avoiding divergent execution policy.

## Implementation Plan

The following plan records the existing implementation and ongoing boundary
constraints. The original feature work is completed; no new dependency or
configuration change is required by this migration.

This is an already implemented boundary, not instructions to repeat issue #199.

- [AI execution contract](../../../packages/core/src/ai/contract.ts) defines the
  observer and plain observation data.
- [AI SDK cognition adapter](../../../packages/core/src/ai/cognition.ts) selects
  streaming, derives changed reply snapshots, ignores observer errors, and validates
  final output.
- [Streaming tests](../../../tests/ai-sdk-streaming.test.ts) exercise the application
  cognition path using simulated model streams and capability execution.
- [Current application flow](../canonical-application-flow.md) owns maintained
  composition and execution-path guidance.

### Observer representation

The plain-data observer shape, retained from the consolidated implementation source,
is `{ kind: "provisional_text_snapshot", text: string }`. Text is the latest reply
snapshot; it replaces prior provisional presentation rather than an append-only delta.
SDK stream/tool objects never cross this interface. This is documentation of the
existing contract, not a runtime or transport change.

### Verification

- [x] Streaming tests establish ordered snapshots before authoritative completion.
- [x] Final meaning-ID validation remains authoritative after visible partial text.
- [x] Failure or abort after snapshots creates no completed expression evidence.
- [x] Streamed tool calls still pass through the existing capability firewall.
- [x] Source review preserves ephemeral snapshots, observer-failure isolation, final
      delivery independence, and all original non-goals without changing runtime code.

## More Information

- Issue #199 and its preserved design (consolidated into this ADR; original source in Git history)
- [Persistent meaning](0002-preserve-persistent-meaning.md),
  [bounded projections](0003-use-least-sufficient-permitted-projections.md),
  [authority](0004-separate-capability-from-authority.md), and
  [operational continuity](0005-distinguish-operational-continuity.md)
- [Capability firewall reference](../capability-execution-boundary.md)

Revisit when a concrete surface needs a different provisional-presentation contract.
Any durable replay or transport interaction must preserve final validation,
non-amplification, and truthful failure rather than treating displayed text as a
new completion boundary.

### Pilot acceptance — 2026-10-27

The maintainer approved this pilot batch. Review against the original ADR skill's
agent-readiness checklist found the source constraints, implementation references,
verification criteria, non-goals, and revisit conditions preserved. This is a
documentation migration; existing implementation evidence does not imply all future
representations are verified. No runtime or package changes were made.
