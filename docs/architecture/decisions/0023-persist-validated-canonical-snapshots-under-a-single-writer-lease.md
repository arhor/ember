---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0023: Persist validated canonical snapshots under a single-writer lease

Accepted migration record from [the original source](../../research/archive/minimal-continuity-slice.md). This ADR owns the architectural decision; the source retains
detailed implementation references and dated evidence. The record documents existing choices and
constraints; no unrecorded historical approval date or alternatives meeting is claimed.

## Context and Problem Statement

The minimal continuity experiment in [issue #22](https://github.com/arhor/ember/issues/22)
needed inspectable durable meaning across full process stop/restart. Its still-used
storage choice is one validated UTF-8 JSON snapshot, optimistic revision, and a
cooperating local writer lease. This C12 record extracts that choice from the
minimal-slice source, not its historical Node 24, zero-dependency, process-provider,
CLI, or no-background-work implementation plan. ADRs 0006/0009 and the current
application/AI ADRs govern those evolved areas.

## Decision

Keep canonical state as one schema-versioned UTF-8 JSON document behind `StateStore`.
Validate the complete document on load and before replacement; malformed UTF-8/JSON,
unsupported schema, missing evidence, inconsistent provenance/currentness, or missing
expected canonical file fail visibly. Do not skip corrupt records, silently initialize
a new continuity, or equate valid optional-detail gaps with store corruption. Supported
legacy normalization remains explicit and validated; this is not permission to accept
unknown schema versions or invent general migration semantics.

Cooperating mutation paths acquire an exclusive same-directory `.lock` via
`open(..., "wx", 0o600)`. Persist/sync lock version, random owner token, positive safe
PID, hostname, and acquisition time before treating the lease as established. Hold the
handle and verify store-instance lease ownership and matching path owner token at
commit/release. Read-only inspection needs no writer lease. The lock is operational
coordination, not evidence of cognition or canonical identity.

Existing locks fail closed. Diagnose same-host liveness only for validated positive
safe PIDs; never pass malformed/nonpositive/unsafe values to process probing. Live,
foreign-host, permission-denied, malformed, or indeterminate lock status cannot authorize
mutation. `ESRCH` means only apparently stale. Never infer staleness from age, remove
locks automatically, or claim an advisory kernel/distributed lock.

Quarantine requires operator-established quiescence, explicit confirmation, matching
owner token, re-read same-host metadata, and a still-absent PID; rename to a unique
quarantine artifact, not deletion. PID reuse can cause safe unavailability. Malformed
locks have unverifiable ownership and require explicit manual maintenance after
independently established quiescence; the token-based command cannot verify them.
On clean release re-read the token, preserving a changed/unverifiable lock for diagnosis.
The protocol assumes no concurrent manual lock maintenance or hostile same-user writes.

Commit reloads current state, requires the expected revision, clones the candidate,
increments the canonical revision once, validates, then replaces the complete file.
Use a uniquely named same-directory private temporary file, write/sync/close it,
rename over canonical, then sync the parent directory. This keeps a reciprocal
supersession transition in one exposed snapshot rather than splitting predecessor
and successor updates. Orphan temporary bytes are not canonical. Failures before
replacement leave the prior complete document authoritative. After rename, directory-
sync failure means durability is uncertain; reload/validate the actually visible
revision before a stronger recovery claim. Do not report rollback or definite survival
of either revision solely from that failure.

This is whole-document replacement, not event sourcing or a transaction across sidecars.
The earned durability contract is cooperating writers on a supported local same-filesystem
store (originally local Linux). It does not establish Windows/network-filesystem
parity, multi-host locking, copied-store unique continuity, hostile-process containment,
or universal power-loss durability. Runtime concurrency is serialized through this
canonical writer boundary; the old experiment's single foreground surface is not a
new ban on later CLI/Telegram architecture.

## Consequences

- Whole-state validation and replacement keep invariants inspectable with low machinery.
- Full-document load/write cost and cooperative locking limit scale and availability;
  consider SQLite/another transactional store when measured load, incremental access,
  concurrency, or durability requirements exceed this boundary.
- Lock recovery is deliberately conservative and operationally explicit. No unsafe
  automatic stale-lock cleanup or cross-file atomicity is promised.

## Implementation Plan

- **Affected paths:** [state store](../../../packages/core/src/persistence/state-store.ts),
  [durable replacement](../../../packages/core/src/persistence/file-replacement.ts),
  [canonical model validation](../../../packages/core/src/model.ts), and retained slice reference.
- **Dependencies/configuration:** no package, runtime version, schema, lease API, or
  database change; current TypeScript/Node/pnpm decisions remain governing.
- **Patterns to follow:** full validation, token-checked cooperative lease, explicit
  expected revision, same-directory durable replacement, truthful uncertainty.
- **Patterns to avoid:** raw JSON edits as supported mutation, age-based lock breaking,
  partial supersession commits, automatic reinitialization, or cross-file transaction claims.
- **Migration:** storage ownership is transferred here. Retain the original
  fixture, protocol history, state examples, and failure table; label obsolete Node24/
  `.mjs`/zero-dependency/provider instructions historical and link current owners.

### Verification

- [x] `node --test tests/model-store.test.ts` passes complete load/validation, stale
      revisions, orphan temporary files, malformed store, directory-sync uncertainty,
      token/liveness/foreign-host cases, and explicit quarantine behavior.
- [x] `node --test tests/longitudinal-acceptance.test.ts` passes representative
      stop/restart/provenance/currentness/gap behavior through the current implementation.
- [x] Source/code review confirms the still-used storage protocol without elevating
      obsolete Node24/provider plans or claiming a universal filesystem guarantee.

## Alternatives Considered

- SQLite or another transactional database: can support incremental queries and stronger
  concurrency mechanisms but was unearned by the initial tiny inspectable fixture;
  remains a replacement when measured requirements justify it.
- Append-only event sourcing: retains event history but adds replay/migration machinery;
  current/historical meaning plus explicit links fit the chosen snapshot model.
- Distributed lock, daemon, or automatic stale cleanup: adds coordination or availability,
  but no selected local requirement justifies that machinery or unsafe liveness inference.

## More Information

Subordinate to accepted semantic ADRs 0001–0005 and current implementation ADRs
[0006](0006-adopt-typescript-on-nodejs-26.md), [0009](0009-adopt-pnpm-as-package-manager.md),
and [0015](0015-centralize-application-coordination-and-inward-dependencies.md).
Revisit when measured snapshot/locking limits or a new filesystem/topology require
stronger guarantees. The source's original fixture evidence does not prove all later
surface/provider or multi-process recovery behavior.

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
