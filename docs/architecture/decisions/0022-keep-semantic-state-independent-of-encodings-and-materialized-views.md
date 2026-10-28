---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0022: Keep semantic state independent of encodings and materialized views

Accepted migration record from [the original source](../semantic-state-representation-boundary.md). This ADR owns the architectural decision; the source retains
detailed implementation references and dated evidence. The record documents existing choices and
constraints; no unrecorded historical approval date or alternatives meeting is claimed.

## Context and Problem Statement

Issues [#257](https://github.com/arhor/ember/issues/257)–#260 under epic #251 need
legible filesystem views without making Markdown paths a domain model or privileged
mutation channel. This C11 record extracts the architecture and preserves its later
Markdown-v1 refinements. No graph/vector production adoption is selected.

## Decision

Keep four distinct layers: canonical semantic state; replaceable physical persistence;
purpose-labelled materialized inspection/authoring views; and temporary least-sufficient
cognition projections. Views and cognition projections are siblings; cognition must
select canonical state for the present purpose, not scrape generated files. Omission
from either view is not forgetting/deletion.

Stable Ember-owned meaning/evidence IDs are independent of storage keys, graph address,
serialization order, filenames/headings/positions, wording/resolution, locale, and
provider/thread context. Materializations preserve association with those IDs; changing
representation does not mint identity or allow old IDs to be reused for changed meaning.
Corrections use explicit semantic transitions and reciprocal lineage.

Lossless persistence/export/import/migration preserves meaning family, owner/slot/scope,
evidence/source actor/derivation/epistemic role, named times, currentness/lifecycle,
uncertainty, reciprocal supersession, and truthful gaps. Lossy views label their loss
and cannot be advertised as lossless backups/imports. Formatting prominence, repetition,
backlinks, graph degree, or additional detail cannot create evidence or corroboration.

Generate materializations from a validated canonical revision with representation/
renderer version, lineage/revision, purpose, disclosure policy, and interaction mode.
Exclude volatile attempt time, PID, temporary path, and attempt IDs; source semantic
times remain legitimate input. Identical state/version/configuration yields identical
Markdown-v1 bytes. Regeneration does not read previous rendered prose as hidden state.
Byte equality across renderer versions is not a semantic equality test.

Keep the v1 exact-principal/scope selector independent of Markdown. `SELF.md`, `USER.md`,
`RELATIONSHIP.md`, and `MEMORY.md` are groupings, not canonical families or ownership.
Entries preserve IDs/lifecycle/supersession and descriptor-only evidence; exclude
payloads/digests and out-of-scope meaning. Escape canonical strings contextually so
they cannot manufacture headings/metadata/structure. SELF/RELATIONSHIP/MEMORY declare
`generated_only`; USER declares `selective_proposal_authoring`.

File editing alone never mutates canonical state. Current v1 import supports only
content edits to current user-testimony facts/preferences in USER. Require already-
canonical available user-command approval evidence from the asserted principal and
exact scope, payload exactly matching the edited value, occurring strictly after the
target was learned and became applicable. Each edit has distinct matching evidence
in deterministic order. The evidence flag identifies testimony; it does not create
consent, authorship, or authority. New entries, deletion, ID/metadata/owner/scope/history
changes, and other families fail closed. Preserve evidence and explicit supersession
through ordinary proposal assessment/adoption under the writer lease.

Validate all four input artifacts at the current canonical revision. Stale bases,
ambiguous identity, missing evidence, unsupported transitions, and malformed/unknown
fields fail closed; v1 does not claim semantic merge of non-overlapping stale edits.
Any rejected edit aborts the set without canonical commit. Render/publish the candidate
views before one canonical commit; publication failure preserves the old canonical
revision and reports the failed artifact plus ordered already-published files.
If canonical commit fails after publication, ahead-of-canonical views can remain;
revision labels expose the mismatch and regeneration repairs them. There is no
transaction across canonical JSON and four views.

Publication preflights canonical/target filesystem aliases, including symlinks, before
any view replacement. Use private files and per-file atomic replacement, not a claimed
atomic four-file snapshot. Explicit regeneration overwrites existing bytes without
classifying drift or backing up; edit import instead validates/classifies unsupported
changes before mutation. Missing/malformed/partial/unknown-version views are unavailable
projections, never proof of empty memory or permission for deletion.

Versioned representation migration validates the source/version, preserves IDs and
all governing metadata, reports loss/unsupported fields, validates output before
activation, preserves recoverable prior sources where practical, and records transformation
provenance. Multi-resolution views retain semantic identity/evidence lineage and label
derivation/loss. Graph queries/storage may replace adapters only behind the same
Ember-owned projection/mutation contracts; an edge cannot invent a semantic relationship.
The graph spike is feasibility evidence, not adoption: production graph/vector/retrieval
infrastructure remains gated by measured scaling/retrieval pressure under #240.

Non-goals: a new graph engine/schema, broader edit grammar, automatic drift backup,
semantic stale-edit merge, filesystem authority, or a new cognition representation.

## Consequences

- Representations can evolve while semantic identity/provenance and cognition contracts
  remain stable; adapters and migration tests carry the fidelity obligation.
- Conservative edit/import policy rejects convenient bulk or stale edits; this is an
  explicit limit, not filesystem writes silently establishing canonical truth.
- Multi-file publication can expose partial/ahead views; retain revision labels and
  truthful inspection rather than claim cross-file transactionality.

## Implementation Plan

- **Affected paths:** [semantic materialization](../../../packages/core/src/state-materialization.ts),
  [Markdown renderer/importer](../../../packages/core/src/persistence/markdown-state-materializer.ts),
  [proposal policy](../../../packages/core/src/memory-proposal.ts), canonical store,
  and maintained representation reference. Existing code is evidence, not new work.
- **Dependencies/configuration:** none; no graph/vector package, new persistence format,
  edit grammar, or disclosure policy. Keep explicit materialize/apply command inputs.
- **Patterns to follow:** representation-neutral semantic selection, stable IDs,
  deterministic rendering, explicit proposals/revision checks, alias preflight.
- **Patterns to avoid:** scraping views for cognition, file timestamps as conflict
  policy, implicit deletion, raw edit authority, or more resolutions as corroboration.
- **Migration:** architectural ownership is transferred to this ADR while retaining the
  source's twelve invariants, six migration requirements, exact edit grammar, commands,
  publication/recovery procedures, and deferred choices at existing anchors.

### Verification

- [x] `node --test tests/markdown-state-materialization.test.ts` passes deterministic
      rendering, scoped redaction, escaping, edit evidence/currentness, stale/drift
      rejection, alias preflight, and partial publication/canonical preservation.
- [x] `node --test tests/graph-memory-spike.test.ts` passes identity/provenance and
      representation-neutral query comparisons without production graph adoption.
- [x] Source review maps all twelve invariants and six migration requirements here;
      lossless versus lossy and ordinary versus selective edit modes remain explicit.

## Alternatives Considered

- Treat Markdown as the canonical domain model or scrape it for cognition: legible and
  convenient but ties identity/disclosure to layout and bypasses semantic selection.
- Let latest files/edits win: easy authoring but discards attribution, evidence,
  revision conflicts, and deliberate lifecycle transitions.
- Adopt a graph now: plausible navigation benefits, but the spike does not establish
  production scaling/retrieval need. Preserve replacement seams and defer adoption.

## More Information

Constrained by ADRs [0002](0002-preserve-persistent-meaning.md) and
[0003](0003-use-least-sufficient-permitted-projections.md).
The [source reference](../semantic-state-representation-boundary.md) retains operational detail; Markdown-specific choices can evolve while preserving its semantic
invariants. Revisit on observed representation loss, meaningful import demand, or
measured scaling pressure rather than a preference for one encoding.

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
