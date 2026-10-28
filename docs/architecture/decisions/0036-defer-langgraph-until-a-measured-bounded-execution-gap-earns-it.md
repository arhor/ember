---
status: "accepted"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0036: Defer LangGraph until a measured bounded execution gap earns it

Migration record from [durable-objective-langgraph-evaluation](../../research/durable-objective-langgraph-evaluation.md), [langgraph-durable-execution-evaluation](../../research/langgraph-durable-execution-evaluation.md). This accepted ADR owns the architectural decision; source documents retain supporting references.
The migration records existing architectural contracts without inventing their original
approval attribution/dates or silently implementing incomplete requirements.

## Context and Problem Statement

The 2026-09-07 LangGraph evaluation proposed a possible narrow operational port;
the later 2026-09-17 evaluation at 510b18c examined implemented objective/approval flows
and deferred adoption. C25 records that later deferral, retaining both dated reports
and their limits. No new external SDK research, benchmark or dependency is performed.

## Decision

Defer LangGraph. Current Ember objective/action stores already own durable purpose,
currentness, episode/checkpoint evidence, later exact approval, effect-attempt truth,
duplicate prevention and reintegration. Episodes end at explicit boundaries; a fresh
currentness assessment starts the next. No measured private multi-step execution gap
currently earns another checkpoint store, replay vocabulary or native deployment burden.
This is deferral, not permanent rejection or a finding that durable execution is useless.

A future engine can own only bounded episode-private execution mechanics behind a
narrow Ember adapter. Objective/lineage/lifecycle/memory/authority/progress/completion,
proposal approval, effect truth and reintegration remain canonical Ember responsibilities.
Opaque thread/checkpoint/run references and definition versions are operational; deleting
the engine store may lose resumability, never the only record of meaning/authority/effects.
Current accepted episodic/systemd topology remains; no resident core is selected here.

Retain the evidence accurately: early stable LangGraph 1.4.14 had no measured install/
Pi footprint. Later disposable 1.4.15 plus SQLite checkpointer 1.0.4 worked on Darwin
ARM64/Node26, installing 60 transitive packages, about 73.3 MiB and native better-sqlite3
12.11.1 after explicit build. The one-task/interrupt/cross-process-resume marker stayed
single. Roughly 198 MB RSS and single-run timings are representative feasibility
observations, not actual Linux/Pi production benchmarks or universal performance costs.
Operational feasibility does not prove less total maintenance or eliminate semantic code.

If earned, prefer a small versioned Functional API episode executor. Revalidate current
canonical objective/action/authority/effects before every resume/consequential step.
Completed tasks can restore results; unfinished tasks and ordinary entrypoint code may
rerun, and interrupt/task ordering is a versioned compatibility obligation. Framework
retry/replay never establishes exactly-once effects; keep attempt-before-effect,
idempotency/correlation and reconciliation. Optional Graph time travel is separate,
not an assumed cost/feature of the narrow Functional seam; effectful replay needs its
own evaluation. Hide graph/checkpoint/Command/interrupt types behind adapter contracts.

Reopen only on measured/immediately required loss of expensive nondeterministic steps,
correctness defects in suspend/resume correlation, enough durable branches/joins to
replace material code, or unmet cancellation/drain/inspection requirements. Any adoption
also needs actual Linux/Pi cold-start/RSS/disk/write/native-update/recovery budgets and
fixture-backed evidence of fewer total production/test lines without duplicate canonical
state, unsafe replay or weaker semantics. Exercise clean restart, uncertain interruption,
stale currentness, later approval, confirmed/unknown effects, duplicates, cancellation,
checkpoint loss and definition upgrade. Proposed ports stay conceptual until earned.

## Consequences

- Avoids duplicate state without dismissing a future bounded private-execution benefit.
- Ember still maintains semantic persistence/currentness/effect gates even if an engine
  is later adopted; old code line counts are not automatically removable boilerplate.
- A later adoption must pay an explicit compatibility/native operations test burden.

## Implementation Plan

- **Affected paths:** [packages/core/src/objectives/durable-objective.ts](../../../packages/core/src/objectives/durable-objective.ts); [packages/core/src/app/objective-action.ts](../../../packages/core/src/app/objective-action.ts); [docs/research/durable-objective-langgraph-evaluation.md](../../research/durable-objective-langgraph-evaluation.md); [docs/research/langgraph-durable-execution-evaluation.md](../../research/langgraph-durable-execution-evaluation.md). These are references to existing behavior; package implementation is outside this documentation phase.
- **Dependencies/configuration:** no packages, schemas, host services, runtime topology,
  provider configuration or secrets are added/changed. Existing implementation-specific
  settings remain in their owning source procedures.
- **Patterns to follow:** preserve source provenance, currentness and lifecycle boundaries,
  existing accepted ADR constraints, and checkable independent operational evidence.
- **Patterns to avoid:** inventing historical approval, upgrading a proposal/requirement
  into an implemented claim, or changing packages to make documentation appear verified.
- **Migration:** decision ownership is transferred here, retaining source
  paths/headings, detailed procedures/scenarios and dated evidence. Retain both dated comparison/measurement reports, six revisit criteria and all spike acceptance cases. Earlier proposed ports are possibilities, not adopted APIs; no new LangGraph install or experiment.

### Verification

- [x] Targeted deterministic tests pass: `packages/core/src/objectives/durable-objective.test.ts`; `packages/core/src/app/objective-action.test.ts`.
- [x] Source/code comparison preserves the decision's stated constraints, non-goals,
      open questions and evidence limits without introducing runtime/package changes.
- [x] Required native template sections, sequential identity, source/index links,
      local targets/anchors and original skill/protected package integrity pass audit.

## Alternatives Considered

- Adopt LangGraph now: supplies working resume primitives but current episodes have
  no substantial private execution position to recover and still need the semantic stores.
- Reject durable frameworks forever: avoids dependencies but ignores future measured
  multi-step recovery needs. Preserve a conceptual replaceable seam instead.
- Make objective store a graph/thread: reduces apparent state plumbing by transferring
  semantic ownership, contrary to the accepted continuity/authority decisions.

## More Information

See the [ADR index](README.md) for governing accepted decisions and the
[migration plan](../../research/archive/adr-migration-plan.md) for source mapping and phase-review tasks.
The source references retain detailed evidence and unresolved representation choices.
Revisit when concrete behavior or measured operational pressure invalidates a constraint;
implementation changes must preserve accepted semantic authority/currentness/provenance
rather than treating richer runtime mechanics as permission.

### Migration verification — 2026-10-27

The combined run passed 210 deterministic tests across 24 files for the unchanged
implementation. A second review checked source invariants, evidence limits, original
headings/anchors, native metadata/template sections, sequential numeric identities,
source/index traceability, local links and protected-file integrity. No live model,
remote account or LangGraph install/benchmark was used. Tests verify selected existing
traces, not every semantic requirement: in particular they do not establish the missing
durable contact-decision/no_contact lifecycle recorded in ADR 0033. The maintainer accepted this record on 2026-10-27; source ownership is now transferred.

### Phase acceptance — 2026-10-27

The maintainer accepted M08, including historical qualification of the obsolete Codex
exact-token guidance and acknowledgement of the missing durable contact-decision/
no_contact ledger. That ledger remains open implementation work under M08-F02 in the
migration plan; this acceptance does not implement or verify it. Source paths, headings,
procedures and dated evidence remain available. No runtime, dependency, package or
original-skill changes are introduced by this documentation acceptance.
