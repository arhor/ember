---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0020: Generate memory candidates from bounded durable conversation evidence

Accepted migration record from [the original source](../conversation-memory-proposal-generation.md). This ADR owns the architectural decision; the source retains
detailed implementation references and dated evidence. The record documents existing choices and
constraints; no unrecorded historical approval date or alternatives meeting is claimed.

## Context and Problem Statement

Issue [#223](https://github.com/arhor/ember/issues/223) adds model-backed reflection
once ordinary interaction evidence is durable. The generator needs enough dialogue
to propose memories without discovering hidden state, authoring evidence, or obtaining
canonical write authority. This C09 record separates generation from the assessment
and adoption policy in [ADR 0019](0019-require-evidence-backed-proposals-and-deterministic-memory-adoption.md).

## Decision

Build a bounded generation projection from recent conversation turns whose evidence
exists in the requested scope. Available user-command evidence is the disclosed
candidate grounding set. Ember expression can supply dialogue context but cannot be
cited as user testimony. Disclose no hidden transcript/provider session, unavailable
user payload, out-of-scope meaning, or wholesale canonical state. Guessed evidence IDs
outside the disclosed grounding set fail before adoption even if otherwise reachable.

The current code additionally discloses same-scope current user-owned testimony facts/
preferences and current Ember-owned inferred facts as existing meaning context, with
explicit epistemic role and the lineage-derived agent actor. This is context, not an
expansion of allowable supersession targets or evidence. The maintainer approved correcting the older testimony-only source wording to match
`buildMemoryProposalGenerationProjection` on 2026-10-27. This documentation correction
does not change the selector or permit inferred-fact supersession.

Keep the SDK-independent generator contract versioned. Candidates enter as `unknown`
and are assessed before dereferencing fields; malformed candidates yield inspectable
invalid representation. Ember supplies generation/proposal identity and time and
normalizes generated identity/time before assessment. At most eight candidates, zero
implicit SDK retries, shared positive finite timeout/max bound, and translated provider
errors constrain the current adapter. A valid empty list is successful no-proposal,
distinct from malformed output, failure, timeout, cancellation, or unknown outcome.

Only ordinary assessment and deterministic adoption can establish meaning. Invalid/
unsupported candidates cannot reach adoption; rejected candidates do not mutate meaning.
Commit adopted replacements through the canonical store at the expected revision.
Candidates may commit sequentially: this is not an all-or-nothing generation transaction.

Persist `generating` before invoking the model in the adjacent
`*.memory-proposals.json` operational ledger. Terminal states distinguish completed,
failed, timed-out, cancelled, and outcome-unknown. Retain bounded source IDs and
per-candidate invalid/unsupported/rejected/adopted outcomes, including adopted meaning
IDs, without another transcript copy. A stranded generating record is unresolved,
not no-proposal. Assessment/adoption terminalization records `outcome_unknown` on a
later stale revision, commit failure, or interruption with all outcomes established
so far, including any earlier successful adoption.

Canonical meaning is authoritative independently of this ledger. Ledger loss does
not delete adopted meaning; ledger presence cannot manufacture it. Application post-turn
reflection occurs after ordinary exchange durability and, on surface interactions,
after durable delivery intent/retained representation but before external send. A
reflection crash therefore does not strip an already committed reply of its delivery
representation. Reflection failures remain fallible post-turn diagnostics under ADR 0015.

Non-goals: transcript-as-memory, generator-created source evidence/authority, inferred
fact correction, new significance policy, provider sessions as memory, or automatic retries.

## Consequences

- Failed/no-proposal/partially adopted outcomes remain inspectable and distinguishable.
- Canonical state and operational ledger are not a single transaction; preserve
  established partial outcomes and uncertainty instead of claiming rollback.
- Bounded candidate counts and disclosure deliberately limit recall and inference.

## Implementation Plan

- **Affected paths:** [generation coordinator](../../../packages/core/src/memory/memory-proposal-generation.ts),
  [AI SDK generator](../../../packages/core/src/ai/memory-proposals.ts),
  [ledger](../../../packages/core/src/persistence/memory-proposal-generation-store.ts),
  [post-turn coordination](../../../packages/core/src/app/post-turn.ts), and source reference.
- **Dependencies/configuration:** no new package/configuration; generator remains optional.
- **Patterns to follow:** durable source projection, unknown candidate assessment,
  per-candidate canonical commits, attempt-first ledger, truthful terminalization.
- **Patterns to avoid:** undisclosed evidence, expressions relabeled testimony,
  hidden transcript context, or partial adoption reported as a rolled-back batch.
- **Migration:** transfer the decision and correct the stale disclosure
  sentence in the source; retain schema/ledger/inspection and live-probe procedures.

### Verification

- [x] `node --test packages/core/src/memory/memory-proposal-generation.test.ts`
      passes bounded disclosure, no-proposal, malformed input, grounded adoption,
      provider failure, and partial-adoption interruption cases.
- [x] `node --test tests/delivery-before-send-recovery.test.ts` passes retained delivery
      intent before reflection/external send behavior.
- [x] Read-only inspection confirms the extra inferred-fact context filter without
      claiming deterministic test coverage that the existing suite does not establish.
- [x] The maintainer approved the source/code disclosure reconciliation, now reflected
      in the supporting reference without runtime changes.

## Alternatives Considered

- Generate directly from all canonical state or hidden provider history: increases
  context but violates bounded disclosure and grounded-evidence inspection.
- Treat an empty result as failure or retry automatically: may chase more suggestions
  but erases a legitimate no-proposal outcome and changes invocation/effect semantics.
- Assume generation-wide atomic adoption: convenient presentation but false for the
  current per-candidate commit and ledger boundaries; expose partial established outcomes.

## More Information

[ADR 0013](0013-keep-conversation-identity-and-context-ember-owned.md) keeps dialogue
separate from canonical memory; [ADR 0017](0017-use-typed-structured-output-for-control-decisions.md)
keeps syntax separate from semantics. Live-provider evidence remains opt-in, dated,
and separate from this migration. Revisit when concrete generation/disclosure failures
justify changing policy, not simply because more context is reachable.

### Migration verification — 2026-10-27

All 97 targeted deterministic tests across eleven files passed for the unchanged
implementation. A second source/contract review checked family/provenance limits,
partial adoption, conversation membership/migration, representation fidelity/editing,
and snapshot/lease uncertainty across this batch. Native metadata/template sections,
index/source traceability, and local links/anchors were audited. No live provider,
new dependency, runtime behavior change, or acceptance is inferred from these tests.
The maintainer accepted this record in the M06 phase review on 2026-10-27.

### Phase acceptance — 2026-10-27

The maintainer approved M06, including the ADR 0020 source-wording correction.
This ADR now owns its architectural decision. Source paths, headings, detailed
procedures, scenarios, and evidence remain available as supporting references.
The implementation plan describes existing behavior and ongoing constraints; no
package, runtime, dependency, or original skill change is introduced by acceptance.
Original approval attribution absent from historical sources remains unasserted.
