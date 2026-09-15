---
summary: "Issue #257 representation-neutral boundary between canonical semantic state, persistence encodings, human-readable materialized views, and cognition projections."
read_when:
  - "Adding or changing filesystem views of Ember identity, self, user, relationship, or memory state"
  - "Designing import, edit, regeneration, drift detection, or migration for a semantic-state representation"
  - "Evaluating whether Markdown, graph, or multi-resolution memory mechanics preserve stable Ember meaning"
role: design
discovery_status: current
---

# Semantic-State Representation and Projection Boundary

> Status: architecture contract for issue #257 and the representation epic #251.

## Purpose and scope

Humans and coding agents need a legible filesystem-facing account of Ember's
self-understanding, user understanding, relationship state, and memory. A useful first
representation may resemble `SELF.md`, `USER.md`, `RELATIONSHIP.md`, and `MEMORY.md`, but
those filenames, their headings, and Markdown itself must not become Ember's domain
model by convenience.

This document defines the boundary that the remaining #251 tasks must preserve. It
does not select the exact Markdown v1 paths or layout, enable filesystem edits, or
adopt a graph or vector dependency.

## Four distinct layers

```text
canonical semantic state
        ↓ encode/load
physical persistence
        ↓ select and render
human/agent materialized view

canonical semantic state + present purpose + permitted current input
        ↓ select, minimise, and label
cognition projection
```

The two projections are siblings, not stages of one pipeline. Cognition must not read a
materialized filesystem view as a shortcut around Ember's context-selection boundary.

| Layer                    | Responsibility                                                                                 | Authority and lifetime                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Canonical semantic state | Ember-owned meaning, evidence lineage, lifecycle, semantic identity, and validated transitions | Governing state; survives replacement of every representation                                  |
| Physical persistence     | Durable encoding, atomicity, revisions, integrity, backup, restore, and schema migration       | Authoritative only as the current encoding of validated canonical state; replaceable mechanics |
| Materialized view        | Purpose-labelled, human-readable rendering for inspection, review, or authoring proposals      | Derived and regenerable; never canonical merely because it is a file or is editable            |
| Cognition projection     | Least-sufficient permitted state selected for one act of cognition or delegation               | Temporary, purpose- and recipient-bounded; not durable memory or a mutation interface          |

A physical store may contain canonical state, but its bytes and schema are not the
semantic contract. Conversely, a view may faithfully render canonical information but
does not acquire write authority over it. A cognition projection may omit information
that appears in an inspection view, and omission from either projection is not
forgetting.

## Stable semantic identity

Every canonical meaning and evidence occurrence has an Ember-owned stable semantic ID.
That ID is independent of:

- a storage record address, database key chosen only for physical locality, graph node
  address, or serialization order;
- a Markdown filename, directory, section, heading, anchor, line number, or list
  position;
- rendered wording, summarization level, locale, or formatting; and
- a cognition-provider, session, thread, transcript, or token position.

Materializations must carry or deterministically associate rendered entries with their
semantic IDs whenever later comparison, editing, or migration needs identity. Visible
ID syntax is a Markdown v1 design choice; hiding IDs in comments or a sidecar does not
weaken the requirement. A renderer may combine, split, reorder, or omit entries for a
declared view purpose, but it must not imply that a rendered paragraph is itself a new
canonical identity.

Changing representation, wording, or resolution does not create a new semantic ID.
Creating a substantively new meaning does. Correction and supersession create or use
explicit semantic transitions and lineage; reusing an old ID for changed meaning is
forbidden.

## Semantic fidelity across representations

Every lossless persistence encoding, export, import, regeneration, and migration must
preserve the distinctions required by ADR 0002, including where relevant:

- meaning family, owner, semantic slot, and person/relationship/project/purpose scope;
- evidence IDs, origin, source actor, derivation lineage, and epistemic role;
- occurrence, observation, revision, and applicability time;
- current, historical, superseded, disputed, uncertain, fulfilled, cancelled,
  forgotten, deleted, or unavailable lifecycle;
- source, proposition, and interpretation uncertainty;
- reciprocal correction and supersession relationships; and
- truthful gaps where evidence or detail is unavailable.

A concise view need not display every field. It must declare itself as a lossy
projection and must not be usable as a lossless backup or canonical import. Hiding
historical or sensitive detail is omission for that view, not deletion. Repetition,
formatting prominence, backlinks, graph degree, or additional resolutions may affect
navigation and salience but cannot manufacture evidence, authority, currentness, or
corroboration.

## Materialized view contract

A materialization is produced from a validated canonical revision and records enough
metadata to establish at least:

- representation and renderer version;
- source lineage and canonical revision or equivalent snapshot identity;
- view purpose and disclosure/scope policy;
- generation time; and
- whether the artifact is generated-only, proposal-authoring, or another explicitly
  supported interaction mode.

Candidate views named `SELF`, `USER`, `RELATIONSHIP`, and `MEMORY` are useful human
groupings, not canonical kinds. One meaning may legitimately participate in multiple
views; placement does not change ownership. `SELF.md` cannot make a user statement
Ember-owned, and moving text between files cannot change its semantic scope.

Markdown v1 should prefer deterministic output for identical canonical state,
renderer version, and view configuration. Determinism makes review and drift detection
tractable, but byte equality is not semantic equality across renderer versions.
Generated output must identify its interaction mode clearly enough that ordinary
editing cannot be mistaken for successful canonical mutation.

## Edit and round-trip semantics

Issue #258 may ship generated-only Markdown views. Generated-only is the default until
issue #259 defines and implements an explicit accepted edit surface.

If an editable or selectively round-trippable view is introduced, saving a file is
only an authoring event. It must be parsed into explicit semantic proposals or typed
operations, then pass the same Ember-owned validation, evidence, ownership, scope,
currentness, authority, and lifecycle rules as any other mutation source:

```text
edited view
    ↓ parse against declared representation version and base revision
candidate semantic proposals / typed operations
    ↓ validate, explain, and resolve against current canonical state
accepted transitions or inspectable rejection/conflict
    ↓ commit through the canonical writer boundary
new canonical revision
    ↓ regenerate
materialized view
```

The import boundary must fail closed for ambiguous identity, unknown fields that could
change meaning, missing required evidence, unsupported lifecycle transitions, or stale
bases. Text equality is never implicit identity, and "latest file wins" is never a
semantic conflict rule. Deleting text from a view cannot silently forget or privacy-
delete canonical state. Moving a paragraph cannot change its owner or scope. Editing a
historical entry cannot make it current. Changing a generated summary cannot silently
rewrite its underlying evidence.

Accepted changes must produce inspectable outcomes that answer what was proposed, what
base revision was read, which semantic IDs were affected, which rules accepted or
rejected the change, and what canonical revision resulted. Existing memory-proposal and
explicit lifecycle-operation boundaries should be reused where their semantics match;
the filesystem does not receive a privileged mutation path.

## Drift and conflict behavior

Canonical state is the authority when it and a materialized view diverge.

- For a generated-only view, unexpected modification is drift. Regeneration may
  replace it only through an explicit materialization operation that reports the drift
  and follows the view's backup/recovery policy; the modified bytes do not mutate
  canonical state.
- For an editable view, the recorded base revision is compared with current canonical
  state. Non-overlapping, semantically unambiguous proposals may be evaluated normally.
  Concurrent changes affecting the same semantic IDs, slots, lifecycle edges, evidence,
  or scope are conflicts and require explicit resolution or re-authoring from a fresh
  view.
- Missing, malformed, partially written, unknown-version, or unverifiable views are
  unavailable or invalid projections. They do not imply empty memory and must not cause
  canonical deletion.
- A failed render or import leaves the last committed canonical revision unchanged and
  reports partial artifacts truthfully.

Conflict detection compares semantic identity and canonical revisions rather than
filenames, modification times, section order, or prose diff alone.

## Regeneration and migration guarantees

Regeneration is canonical-state-to-view projection. It must not depend on previous
generated prose as hidden state. Given supported canonical state and declared renderer
configuration, Ember can discard and rebuild every generated-only view without losing
canonical meaning, evidence, lineage, lifecycle, or stable IDs.

Representation migration is a versioned transformation at the persistence or view
boundary. A migration must:

1. validate the source representation and record its version;
2. preserve semantic IDs and all representable governing metadata;
3. report unsupported or lossy fields explicitly instead of guessing;
4. validate the produced canonical state or export before activation;
5. leave the prior source recoverable where practical; and
6. record enough migration provenance to inspect which transformation ran.

An export advertised as lossless must round-trip all canonical semantics, not merely
the currently rendered prose. A view-only export must be labelled lossy and cannot be
the sole migration source.

## Graph-backed and multi-resolution replacement path

Markdown v1 is permitted as a persistence encoding, a view representation, or both,
provided the implementation keeps those roles explicit. A later graph-backed v2 can
replace physical storage and view mechanics behind the same Ember-owned semantic
query/projection and mutation boundaries:

```text
Markdown v1 persistence or lossless semantic export
        ↓ versioned semantic migration
graph-backed v2 persistence
        ↓ same Ember-owned selection and projection contracts
materialized views and cognition consumers
```

A semantic item may later expose multiple resolutions—for example concise meaning,
expanded interpretation, and source episode/evidence—without changing identity merely
because a consumer requests more detail. Each resolution must retain its relationship
to the same semantic ID and evidence lineage, label derivation and loss, and preserve
scope/currentness rules. A graph edge is a representation of a semantic relationship,
not authority to invent one.

Issue #260 should demonstrate this replacement path using real #258 fixtures through a
semantic export/import or adapter boundary. It must not require production graph,
vector, or retrieval infrastructure. Adoption remains gated by measured scaling or
retrieval pressure under issue #240.

## Implementation invariants for #258–#260

1. Domain and cognition consumers depend on Ember-owned semantic query/projection
   interfaces, never fixed Markdown paths, headings, or graph APIs.
2. Canonical transitions occur only through the validated writer boundary; renderers
   are read-only and importers produce proposals or typed operations.
3. Stable semantic IDs survive rendering, regeneration, export/import, and storage
   migration; formatting changes do not mint or reuse identities.
4. Any representation that claims losslessness preserves provenance, ownership, scope,
   uncertainty, currentness, lifecycle, evidence lineage, and supersession.
5. Materializations identify their source revision, representation version, purpose,
   disclosure boundary, and interaction mode.
6. Cognition projections are built from canonical state for the present purpose, not
   scraped from filesystem views.
7. Stale, malformed, missing, partially written, or edited views cannot silently
   mutate, empty, strengthen, or roll back canonical state.
8. Edits remain non-canonical until explicit semantic resolution and commit; conflict
   behavior uses semantic IDs and revisions rather than file timestamps or prose order.
9. Regeneration is repeatable and does not consume prior generated prose as semantic
   input.
10. Markdown-specific types and graph-specific types remain contained within adapters;
    replacement does not require cognition consumers to change.
11. More detailed resolutions remain descendants or views of identified meaning and
    evidence; they do not become independent corroboration.
12. Graph/vector production dependencies require evidence beyond representational
    plausibility.

## Deferred choices

The child tasks may choose, with evidence:

- exact filenames, directory layout, headings, frontmatter, sidecars, and visible ID
  syntax for Markdown v1;
- whether Markdown v1 is only a view or also the first canonical persistence encoding;
- renderer APIs, semantic query shapes, atomic publication mechanics, and drift backup
  policy;
- the safe editable subset, proposal grammar, conflict user experience, and whether
  some views remain generated-only permanently;
- graph engine, schema, indexes, embeddings, retrieval, caching, and resolution storage;
  and
- presentation wording, ordering, grouping, redaction, and localization.

Those choices may change without weakening the invariants above.

## Traceability

- [Design principles](../principles.md) require semantics before representation,
  identity outside prompts, evidence/memory/context separation, provenance, and
  inspectable correction.
- [ADR 0002](decisions/0002-preserve-persistent-meaning.md) governs semantic fidelity,
  provenance, scope, currentness, lifecycle, correction, and truthful gaps.
- [ADR 0003](decisions/0003-use-least-sufficient-permitted-projections.md) governs the
  separate cognition projection and prevents filesystem convenience from bypassing
  purpose- and recipient-bounded selection.
- [Memory proposal semantics](memory-proposal-semantics.md) provides the existing
  non-canonical proposal and deterministic adoption model for compatible edits.
- [Minimal continuity slice](minimal-continuity-slice.md) demonstrates the current
  validated writer, durable-state, stable-ID, explicit-operation, and read-only
  projection boundaries that representations must preserve.
- [Issue #251](https://github.com/arhor/ember/issues/251) defines the representation
  epic; [issue #257](https://github.com/arhor/ember/issues/257) defines this design;
  issues [#258](https://github.com/arhor/ember/issues/258),
  [#259](https://github.com/arhor/ember/issues/259), and
  [#260](https://github.com/arhor/ember/issues/260) consume its invariants.
