---
summary: "Task-oriented evaluation of the adopted documentation discovery layer against issue #26 routing scenarios and metadata-quality expectations."
read_when:
  - "Reviewing whether documentation discovery routes realistic Ember work without semantic ranking"
  - "Auditing issue #27 implementation evidence, metadata quality, discovery depths, or known routing limitations"
role: reference
discovery_status: current
---

# Documentation Discovery Evaluation

> Initial evaluation: 2026-08-29.
>
> Completion audit: 2026-08-30 against `master` after the semantic ADRs,
> architecture acceptance catalogue, continuity design, and executable slice were
> merged through issues #20-#23.
>
> This note evaluates the repository implementation of
> [the documentation-discovery contract](documentation-discovery.md) for issues
> #27 and #35. It records deterministic structural evidence and a qualitative
> routing review. It does not claim that deterministic code can infer
> task-to-document relevance.

## Evaluation method

The contract deliberately gives the discovery utility no task query. Evaluation
therefore separates two things:

1. **structural evidence**: the deterministic catalogue exposes the expected
   document classes at the intended depths and validates the metadata contract;
2. **qualitative routing review**: a reader is given a realistic task plus the
   catalogue and judges which summaries and applicability hints make plausible
   source documents stand out, which documents can remain unopened, and when
   escalation to headings, deep evidence, or history is understandable.

No semantic matcher, keyword scorer, embedding model, ranking algorithm, or
hidden expected-result table was added to make these scenarios appear
deterministic.

## Corpus state used for the completion audit

The initial #27 evaluation was performed before the architecture baseline had
finished landing. At that time PR #29 (semantic ADRs) and PR #30 (architecture
acceptance scenarios) were still unmerged, so two routing cases could only be
reviewed against the research/design documents that existed on the base branch.

That repository-state limitation is now gone. The completion audit uses current
`master` after PRs #29, #30, #33, and #34 landed. Repository validation reports
44 participating `docs/**/*.md` documents. The newly available architecture
knowledge includes:

- five accepted semantic ADRs under `docs/architecture/decisions/`, participating
  as `role: decision` while their own ADR bodies retain lifecycle authority;
- `docs/architecture/acceptance-scenarios.md` participating as `role: scenario`;
- the current minimal continuity design and runbook participating according to
  their document responsibilities;
- the previously adopted foundations, canonical research, guides, evidence maps,
  preserved source reports, and the superseded initial architecture model.

All human-authored participating Markdown remains subject to the same metadata
validation. There are still no generated Markdown exclusions in v1.

The completion audit also confirms the intended separation between discovery and
authority: `role: decision` does not make an ADR accepted, and
`discovery_status: current` does not make a document governing. Those judgments
remain in the source document and Ember's existing documentation/research
governance.

## Structural expectations

The corpus continues to be classified by document responsibility rather than by
directory alone:

- `docs/vision.md` and `docs/principles.md` are current `foundation` documents;
- current cross-cutting and executable architecture notes are `design` documents;
- `docs/architecture/initial-model.md` remains `design` but `superseded`, pointing
  to the current synthesis;
- semantic ADRs are current `decision` documents, with acceptance status owned by
  the ADR body rather than discovery metadata;
- `docs/architecture/acceptance-scenarios.md` is the canonical current `scenario`
  catalogue;
- canonical concern notes are current `research` documents in default discovery;
- portable `*-references.md` maps are current `evidence` documents in deep
  discovery;
- preserved Deep Research exports are current `source` documents in deep
  discovery while remaining explicitly non-canonical in their source text;
- reviewed-system and OpenClaw documentation-discovery investigations are current
  `reference` documents in deep discovery;
- repository navigation and contributor instructions are `guide` documents.

This classification preserves the pre-existing research and architecture
hierarchy instead of manufacturing authority from routing metadata.

## Scenario 1: continuity and restart work

**Task:** Change how Ember resumes after a complete process restart and long
inactivity.

**Obvious current candidates from the compact catalogue:**

- `docs/architecture/decisions/0001-continuity-belongs-to-ember.md`, whose hints
  explicitly cover restart, resume, migration, provider replacement, and
  identity-continuity behavior;
- `docs/architecture/decisions/0005-distinguish-operational-continuity.md`, whose
  hints explicitly cover downtime, recovery, truthful gaps, and currentness
  reconciliation;
- `docs/architecture/acceptance-scenarios.md` when the change must be checked
  against the canonical restart/recovery fixtures;
- `docs/architecture/minimal-continuity-slice.md` when the task changes or reviews
  the concrete first executable continuity experiment;
- `docs/architecture/design-directions.md` for the cross-cutting synthesis;
- `docs/research/continuity-and-identity.md` and
  `docs/research/operational-model-sessions-and-surfaces.md` when the task needs
  the canonical research reasoning behind those decisions.

**Material that need not be opened eagerly:** unrelated authority/delegation or
endogenous-agency research, all evidence maps, all preserved source reports, and
reviewed-system references.

**Finding:** the post-#29/#30 corpus now supplies the previously missing governing
`decision` and `scenario` layers. A human/model can start from the compact
catalogue, identify the current decisions and fixtures, and deepen into design or
research only when the task requires explanation or implementation detail. The
mechanism still performs no semantic ranking; relevance remains reader judgment.

## Scenario 2: memory and currentness work

**Task:** Change how a corrected preference supersedes older remembered state
while preserving history.

**Obvious default candidates:**

- `docs/research/memory-and-remembering.md` for correction, supersession,
  historical evidence, ownership, scope, and currentness;
- `docs/research/context-selection-and-cognitive-framing.md` when old and current
  state must be projected without losing temporal or authority distinctions;
- the relevant semantic ADRs and `docs/architecture/design-directions.md` when
  the change crosses an accepted architecture invariant.

**Not eager:** unrelated authority/endogenous-agency research, reviewed-system
references, evidence maps, and preserved source reports.

**Finding:** the memory and context hints remain complementary rather than
duplicated. One describes durable remembered meaning; the other describes what
may participate in a bounded act of cognition.

## Scenario 3: delegation and privacy

**Task:** Decide whether relationship information relevant to Ember may be
included in a coding specialist's delegated context.

**Obvious default candidates:**

- `docs/research/context-selection-and-cognitive-framing.md` for purpose-bounded,
  least-sufficient, permission-preserving projection;
- `docs/research/capabilities-and-delegation.md` for the delegation envelope,
  specialist context, runtime ownership, and disclosure across delegation
  boundaries;
- `docs/research/action-authority-and-permission.md` for access-versus-disclosure
  authority and the rule that delegation cannot amplify authority;
- the corresponding semantic decisions and
  `docs/architecture/design-directions.md` where the task changes architecture.

**Not eager:** continuity source research, reviewed-system notes, every evidence
map, or all canonical concerns.

**Finding:** this remains a useful overlap stress case. Several canonical sources
surface for distinct semantic reasons, and their summaries/hints explain those
reasons rather than collapsing them into a generic `privacy` tag.

## Scenario 4: authority after circumstances change

**Task:** Allow Ember to perform an external action under a standing grant after
circumstances have changed.

**Obvious default candidates:**

- `docs/research/action-authority-and-permission.md` for standing authority,
  revocation, changed circumstances, external action, and fresh approval;
- `docs/research/memory-and-remembering.md` where a formerly valid grant must
  remain historical evidence without acting as current mandate;
- `docs/research/operational-model-sessions-and-surfaces.md` when delayed work,
  retries, recovery, or stale observations are involved;
- the relevant accepted semantic decisions and cross-cutting design directions.

**Not eager:** reviewed-system references or source artifacts.

**Finding:** the catalogue does not mistake technical capability for authority
and does not need a rule engine to make the relevant distinction visible.

## Scenario 5: architecture acceptance work

**Task:** Add or review a fixture for a new concurrency/currentness failure case.

**Primary current candidate:**

- `docs/architecture/acceptance-scenarios.md`, whose metadata explicitly says to
  read it when designing, implementing, or reviewing behavior that must preserve
  Ember's cross-cutting semantic contracts and when selecting executable fixtures.

**Governing decision candidates:** the accepted ADRs implicated by the fixture.
For concurrency/currentness work, the operational-continuity decision is an
obvious candidate; memory/context/authority decisions should be opened only when
the scenario actually crosses those axes.

**Supporting material when needed:** `docs/architecture/design-directions.md` and
specific canonical research notes provide rationale, but the task does not require
loading the whole research corpus merely because the scenario catalogue traces
back to completed research.

**Finding:** the previously missing repository-state proof now succeeds. The
catalogue exposes the canonical `scenario` source and the accepted `decision`
sources as distinct document responsibilities. Discovery metadata does not turn
scenario order into authority and does not flatten ADR lifecycle into routing
status.

## Scenario 6: ordinary local implementation/debugging

**Task:** Fix a local parser bug whose expected behavior is already established by
nearby tests and does not alter Ember semantics.

`AGENTS.md` explicitly permits discovery to be skipped for such a task. If the bug
is in the documentation-discovery utility itself,
`docs/documentation-discovery-guide.md` and the governing contract are sufficient
procedural/design sources without loading the semantic research corpus.

**Finding:** this previously successful case still holds after the architecture
baseline expanded the catalogue. Success includes staying out of the way; adding
ADRs and scenarios did not turn every local edit into an excuse to inject all
canonical semantics.

## Scenario 7: investigate why a memory conclusion exists

**Task:** Determine why memory research concluded that current belief must remain
distinct from historical evidence, deeply enough to challenge the conclusion or
verify its basis.

The intended progression remains visible directly in metadata:

1. default discovery surfaces `docs/research/memory-and-remembering.md` as the
   canonical `research` synthesis;
2. deep discovery adds `docs/research/memory-and-remembering-references.md` as the
   `evidence` map for checking durable sources;
3. deep discovery also makes
   `docs/research/source-material/memory-and-remembering-deep-research.md`
   reachable as preserved `source` material when reconstruction of the original
   investigation is actually necessary.

The evidence/source roles do not become canonical merely because this task asks a
strong "why" question.

**Finding:** the default/deep split continues to provide the intended evidence
escape hatch without putting the entire research trail into ordinary coding
context.

## Metadata quality review

A completion pass after the architecture baseline landed checked the interface
quality of the expanded metadata set, not only parser validity.

### Summaries and applicability hints

Summaries continue to distinguish neighboring responsibilities. ADR metadata
states the accepted semantic decision it routes toward without replacing the ADR
status field. Scenario metadata describes the catalogue as an architecture oracle
rather than as another decision source. Design documents say when their concrete
representation matters and explicitly avoid claiming long-term runtime authority.

Applicability hints remain task/decision oriented rather than directory-wide topic
tags. The new continuity ADRs distinguish identity/restart concerns from
operational recovery/delivery/currentness concerns, while the acceptance catalogue
advertises fixture-selection and semantic-review work.

### Role, discovery status, and lifecycle

`role`, `discovery_status`, and role-specific lifecycle remain independent:

- an ADR is accepted because its source body says `Status: Accepted`, not because
  discovery labels it `decision` or `current`;
- the scenario catalogue is canonical because its source document and architecture
  governance say so, not because it is frequently retrieved;
- preserved research exports remain `source` material even though they are still
  discoverable as current evidence artifacts;
- the superseded initial architecture model remains historical even though it can
  still be reached through history discovery.

### Routing contradictions

No contradictory routing claim was found in the completion pass. Overlap continues
to correspond to genuinely cross-cutting tasks rather than universal "read this
for everything" hints.

## Structural validation and CI

The repository-local workflow is the deterministic hard gate for this audit. On a
documentation-discovery change it:

1. runs the focused and repository-level Node.js discovery tests;
2. runs `node scripts/docs-discovery.mjs check` over the participating corpus;
3. exercises default, deep, and all/history projections;
4. exercises selected-document heading projection.

The completion-audit change for issue #35 is required to pass that workflow against
the post-#29/#30 corpus. A green run demonstrates parser/metadata/inclusion and
projection integrity. It does **not** prove task relevance, which is why the
qualitative scenarios above remain a separate part of the evidence.

## Contract findings

The post-architecture re-evaluation did **not** expose a concrete flaw requiring a
semantic or tooling change to #26.

The architecture additions instead validate two contract boundaries:

- participation over human-authored `docs/**/*.md` prevents new ADR/scenario
  knowledge from silently escaping discovery;
- keeping `role`, `discovery_status`, and source-owned lifecycle separate allows
  the catalogue to route to accepted decisions and canonical scenarios without
  becoming a competing authority system.

No task query, semantic matching, ranking, embeddings, external retrieval service,
or runtime Ember context machinery is needed to close this completion gap.

## Overall result

The adopted layer remains deliberately boring machinery around meaningful source
documents:

```text
agent policy
  -> deterministic role/currentness catalogue
      -> model or human relevance judgment
          -> selected headings
              -> selected source documents
                  -> deep evidence/source or history only when needed
```

The post-#29/#30 audit closes the repository-state limitation recorded by the
initial #27 evaluation. Continuity/restart work can now route through actual
accepted decisions, canonical scenarios, design, and research, while architecture
acceptance work has an explicit primary scenario source and governing decisions.
The mechanism improves repository knowledge visibility without becoming a second
authority system or a miniature retrieval platform.
