---
summary: "Issue #223 implementation boundary for model-backed, evidence-bounded memory proposal generation, deterministic adoption, and durable generation outcomes."
read_when:
  - "Changing how ordinary conversation yields memory proposals or no-proposal outcomes"
  - "Changing the AI SDK memory-proposal generator, its bounded evidence projection, or failure classification"
  - "Inspecting why a generated memory proposal was adopted, rejected, invalid, or unavailable"
role: design
discovery_status: current
---

# Conversation Memory Proposal Generation

## Boundary

Issue #223 adds a reflection operation after ordinary conversational evidence has
become durable. It does not make transcript retention equivalent to remembering and
does not give a model write access to canonical meaning:

```text
durable recent conversation projection
        -> structured candidate generation
        -> SDK-independent proposal assessment
        -> deterministic adoption policy
        -> canonical state commit
```

`buildMemoryProposalGenerationProjection` admits only turns whose evidence still
exists in the requested scope. Available user-command evidence may ground a proposal.
Ember expression turns may provide bounded dialogue context, but cannot be cited as
user testimony. The only current meanings disclosed are current user-testimony facts
and preferences in the same scope, because those are the v1 correction targets.

The projection contains no provider session, hidden transcript, unavailable payload,
out-of-scope meaning, or canonical state wholesale. Generated source evidence IDs are
checked against the disclosed grounding set before ordinary proposal assessment, so a
model cannot cite other reachable state merely by guessing its ID.

## Generation and adoption

The SDK-independent `MemoryProposalGenerator` contract returns a versioned list. An
empty list is a successful and inspectable no-proposal result. Ember supplies the
generation identity and proposal time; generated identity or timing fields are
normalized before assessment. Candidates cross the generator boundary as `unknown`
and are assessed before any field is dereferenced, so malformed candidates become
persisted `invalid_representation` outcomes. The existing `assessMemoryProposal` and
`resolveMemoryProposal` functions remain the only proposal and adoption policy
boundaries. Invalid and unsupported candidates never reach adoption. Rejected
proposals do not mutate canonical meaning. Adopted replacement state is committed
through the canonical optimistic-revision store.

The AI SDK adapter uses structured output with at most eight candidates, zero implicit
retries, the shared timeout bound, and the existing provider error categories.
Timeout, cancellation, malformed structured output, and provider failure remain
different from a valid empty candidate list. SDK and provider result types do not
cross into proposal or canonical contracts.

## Durable inspection

Each attempt is written first as `generating` to the adjacent
`*.memory-proposals.json` operational ledger. Terminal records distinguish completed,
failed, timed-out, cancelled, and outcome-unknown generation. Completed records retain
the bounded source evidence IDs and each invalid, unsupported, rejected, or adopted
proposal result. This preserves the trace from durable source evidence through the
proposal lifecycle to an adopted meaning ID without retaining another transcript
copy. A generating record left by interruption is truthful unresolved operational
evidence; readers must not interpret it as no proposal.

After generation returns, assessment and adoption remain inside the terminalization
boundary. A stale revision, commit failure, or other post-generation interruption is
recorded as `outcome_unknown` with every outcome already established. This matters
when an earlier candidate was committed before a later candidate failed. CLI
inspection includes this ledger next to cognition, interaction, and delivery evidence.

The ledger is operational evidence rather than canonical memory. Canonical meanings
and their provenance continue to live only in the Ember state store. Ledger loss does
not remove adopted meaning, while ledger presence cannot establish or modify meaning.

## Verification

Deterministic tests use the AI SDK test model and a scripted generator to cover
bounded disclosure, grounded adoption, durable provenance, empty no-proposal output,
malformed candidates, partial adoption followed by stale revision, provider failure,
redaction, and zero implicit retries. `runCognition` invokes reflection after an
ordinary exchange has been durably recorded when a generator is configured; both CLI
and Telegram surface paths can supply that generator. The opt-in
`npm run smoke:memory-proposal:live` command exercises a representative ordinary
conversation against a live subscription-backed structured-output model. The
proposal-semantic tests continue to own invalid, rejection, and supersession policy
coverage.
