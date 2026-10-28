---
status: "deprecated"
date: "2026-10-27"
decision-makers: "Repository maintainer"
---

# ADR 0010: Adopt an ADR-Centered Documentation Workflow with Preserved Discovery

Deprecated on 2026-10-27 when the repository maintainer explicitly changed the
migration direction: use the original `adr-skill` unchanged and adapt repository
metadata and documents to its format. The earlier acceptance and implementation
notes below preserve the prior policy's history. Its custom semantic template,
Ember-specific skill changes, and custom helper requirements no longer govern.
[ADR 0014](0014-use-native-adrs-and-retire-documentation-catalogue.md) records the
accepted replacement policy and catalogue retirement. The old policy below is historical.

## Context and problem

Ember's pre-migration corpus contains 119 documents: nine accepted ADRs, 38 current
design documents, seven historical or superseded designs, seven canonical research
notes, 20 guides, two foundations, one acceptance catalogue, and 35 supporting
evidence, reference, and source documents. Durable choices are distributed among
accepted ADRs, implementation descriptions, and evaluations. Several documents
combine current constraints with historical implementation plans.

The existing documentation skill supplies discovery, authority-sensitive reading,
source ownership, maintenance, and validation. The ADR skill supplies decision
authoring, review, lifecycle, and implementation traceability. Replacing the former
with the latter unchanged would lose the broader documentation responsibilities.
Its mandatory file-level implementation plans also conflict with Ember's deliberately
representation-neutral semantic ADRs.

At migration start, the helpers could not execute as shipped: their `.js` files
used CommonJS `require` under native ESM. Their directory detection missed Ember's
nested ADR directory, filename generation did not preserve numeric IDs, and the
status updater did not recognize existing bold status bullets. Templates lacked
required discovery metadata, and index generation did not maintain the existing
semantic/implementation classification.

The user approved planning an ADR-centered migration, chose a repository checklist
and phase-level reviews, and requested implementation. That authorizes preparing this
proposal and the inventory; acceptance of this concrete policy and inventory remains
the first phase gate in the [migration plan](../../research/archive/adr-migration-plan.md).

## Decision

Adopt an Ember-adapted `adr-skill` as the documentation entry point after its discovery,
authoring, maintenance, and lifecycle behavior passes the migration's cutover checks.
Retain the current deterministic documentation-discovery mechanism and metadata
grammar. Retire `ember-documentation` only after all its responsibilities have an
explicit replacement in the adapted skill or governing documentation.

ADRs own durable choices. Foundations constrain project purpose; acceptance scenarios
remain behavioral oracles; living contracts and implementation references explain
current behavior; guides own procedures; research preserves conclusions and open
questions; evidence and source artifacts preserve their original provenance. A
discovery role or current discovery status does not confer acceptance.

### Decision classes and content

Preserve ADRs 0001–0009 and their identifiers. Continue numeric filenames in
`docs/architecture/decisions/`; do not bootstrap another ADR tree.

Use two template shapes:

- **Semantic:** context, decision, invariants and non-goals, consequences, alternatives
  or explicitly missing historical rationale, scenario-based verification, and
  traceability. Concrete storage, files, providers, and runtime choices remain open
  where the semantic decision leaves them open. This template has no mandatory
  file-level implementation plan.
- **Implementation/governance:** context, decision, scope and non-goals, alternatives,
  consequences, implementation plan or completed implementation evidence,
  verification, and traceability. Name affected paths and commands where applicable.

The class is recorded separately from lifecycle status. Semantic decisions constrain
implementation decisions; an implementation record cannot silently weaken them.
Both classes may link to shared governing constraints and evidence instead of copying
them to satisfy a mechanically self-contained template.

Distinguish enduring constraints from one-time implementation instructions. A completed
plan must be labelled completed and point to implementation evidence. Current source
maps and operational instructions live in maintained reference documents. Agents
must not repeat completed migration steps or treat historical file paths as present
architecture merely because the ADR remains accepted.

### Retrospective conversion and review

The source-to-destination ledger in the migration plan is tracking data, not a new
source of architectural authority. A candidate label is not an ADR identifier or
acceptance. Allocate the next unused numeric ADR ID when creating a record; preserve
the candidate label in tracking so unrelated intervening ADRs do not break the plan.

Newly extracted records start proposed. Their `date` records the new record's creation
date. Cite any known original decision date separately as historical evidence. Preserve
known dates and accepted status when adapting an existing accepted ADR. Do not invent
original decision-makers, approval dates, rejected alternatives, or experiments.
Record missing historical rationale as unknown and submit that gap with the batch.

Review migration conventions and the complete inventory first, then the three-source
pilot, then each domain batch, and finally cutover. The approved migration plan serves
as the intent summary for this governance proposal. Subsequent faithful conversions
use the approved source map and conventions as their intent; they do not require a
fresh interview for each mechanical re-expression. Acceptance still requires the
agreed phase review. A substantive new choice or contradiction requires a separately
confirmed intent summary and decision review.

Implemented behavior supports reconstruction but is not proof of formal acceptance.
Where a source mixes obsolete instructions with current constraints, retain the
historical attribution and reconcile the current claim against governing decisions
and implementation before accepting the extracted record.

### Lifecycle and supersession

Use plain decision statuses `proposed`, `accepted`, `rejected`, `deprecated`, and
`superseded`. Keep decision status distinct from `discovery_status`:

| Decision status | Discovery status | Treatment                                                 |
| --------------- | ---------------- | --------------------------------------------------------- |
| proposed        | current          | Discoverable for review; does not govern implementation   |
| accepted        | current          | Governs within its stated scope                           |
| rejected        | historical       | Preserves an explicitly unadopted choice                  |
| deprecated      | historical       | No longer governs; explain why and the remaining guidance |
| superseded      | superseded       | Entire record replaced; valid `superseded_by` required    |

`superseded_by` is one repository-relative path, as the existing contract requires.
Do not extend the parser to accept a replacement array. Fully superseded records link
to their replacement, and replacements link back. Replacement acceptance and the old
record's lifecycle update occur together; a proposed replacement does not retire an
accepted source.

When only part of an ADR is replaced, keep it accepted/current and identify the exact
amended scope and governing replacement in both records. ADR 0009's package-manager
replacement of part of ADR 0006 is the existing example. Do not mark the whole of ADR
0006 superseded or duplicate the already accepted Telegram-client amendment in ADR
0008 as a new independent decision.

For a design split among multiple decisions, keep the original path as a concise
current overview after every responsibility has a destination. Link the new ADRs and
retained supporting content, remove duplicate governing prose, and identify the old
revision in Git when original context is needed. Preserve dated empirical reports as
reports rather than rewriting them to describe experiments never performed.

Helpers must support existing bold status bullets during migration. New records use
frontmatter `status`; on explicit normalization, preserve the prior date and meaning
and remove or synchronize any redundant status field. Ambiguous or contradictory
status declarations fail without modification. Record actual status-transition dates
in dated lifecycle notes; do not overwrite the original record date.

### Discovery, maintenance, and validation

Transfer the existing skill's discover-before-deciding, source-authority, conflict,
ownership, progressive-disclosure, maintenance, and validation obligations. Preserve
the fallback to the discovery contract and guide in the root agent instructions.
Do not make every local bug fix or routine implementation choice trigger an ADR.

Retain `summary`, `read_when`, `role`, `discovery_status`, and conditional
`superseded_by`, with existing default/deep/history behavior. New ADR-specific checks
validate structure, lifecycle consistency, numeric ID uniqueness, index references,
and supersession without pretending to prove prose correctness or acceptance evidence.
Status updates must keep affected metadata, reciprocal replacement links, and the
classified index consistent. Validate proposed changes before writing; reject invalid
input without partially modifying records.

## Alternatives considered

- **Keep the present workflow:** smallest immediate cost and preserves mature
  discovery, but leaves durable choices distributed through designs and evaluations
  and does not deliver the requested ADR-centered authoring workflow.
- **Adopt the ADR skill unchanged and convert nearly everything:** fewer initial
  customization choices, but its helpers are incompatible with Ember and its
  templates would conflate procedures, research, hypotheses, and semantic invariants
  with implementation decisions.
- **Adapt ADR authoring while retaining distinct document responsibilities:** requires
  local maintenance of the skill and conversion review, but preserves source authority
  and evidence while making architectural choices easier to locate. This is the
  selected proposal.

## Consequences

- Decisions become explicit and traceable, while current source maps and operating
  procedures remain maintainable without rewriting decision history.
- The migration must reconcile overlaps and stale implementation prose. Batch review
  and the source ledger make omissions and unintended semantic changes visible.
- Ember owns the adapted skill and helper tests. Upstream updates require checking
  compatibility with local classes, metadata, lifecycle, and review conventions.
- The corpus will still contain non-ADR documents. Fewer files is not a success
  criterion; unique decision ownership and reliable discovery are.
- Historical uncertainty remains visible. A missing rationale cannot be repaired by
  fabricating a plausible alternative or retrospective approval.

## Implementation plan

The [migration tracker](../../research/archive/adr-migration-plan.md#tracking) owns task
status. This ADR owns policy; task completion in the tracker does not alter it.

- **M01–M02:** approve the baseline source ledger and this governance proposal.
- **M03:** update `.agents/skills/adr-skill/SKILL.md`, its templates, references, and
  three helpers; use native ESM and Node built-ins without new dependencies. Add
  focused fixture tests and ADR validation under the existing scripts/tests layout.
  Keep the old entry point active.
- **M04:** convert streaming, Codex integration, and conversation-context sources and
  review the pilot before bulk work.
- **M05–M09:** execute assigned domain dispositions, retain non-decision content, and
  repair authority, navigation, and evidence links in each reviewed batch.
- **M10:** update root agent instructions and governing guides, verify discovery and
  maintenance tasks, then remove the old skill. Restore the old routing if those
  checks fail while retaining valid document conversions.
- **M11:** audit every baseline source, final lifecycle and links, acceptance-scenario
  traceability, and completion evidence.

No production runtime API, dependency, persistence format, or agent behavior changes
are authorized by this documentation decision.

### Verification

- [x] First-phase review accepts this decision and the complete baseline mapping.
- [x] Existing semantic ADRs retain their meaning and do not acquire mandatory
      implementation choices.
- [x] All three helpers execute under `.nvmrc` and preserve existing IDs, content,
      classified indexes, and status history in focused tests.
- [x] Both template classes pass documentation discovery and ADR-specific validation.
- [x] Rejected/deprecated/superseded records cannot masquerade as accepted/current;
      scoped amendments do not incorrectly supersede whole records.
- [x] Creation, acceptance, and supersession walkthroughs preserve reciprocal links
      and reject invalid or contradictory input without modification.
- [ ] The seven existing discovery scenarios reach the correct source classes without
      eagerly loading deep evidence or prompting unnecessary local-change ADRs.
- [ ] All 119 baseline documents have completed, reviewed dispositions and the 40
      existing acceptance-scenario identifiers are preserved.
- [ ] Documentation tests, discovery validation, strict lint, applicable helper tests,
      final repository checks, and link/anchor review pass.

## Traceability and revisit conditions

- [Migration plan, inventory, and review log](../../research/archive/adr-migration-plan.md)
- `documentation-discovery.md` (removed; see [cleanup record](0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28)) and
  `documentation-discovery-guide.md` (removed; see [cleanup record](0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28))
- [Accepted semantic and implementation decisions](README.md)
- [Research governance](../../research/README.md) and
  [acceptance catalogue](../acceptance-scenarios.md)
- Former discovery guide: `documentation-discovery-guide.md` (removed; see [cleanup record](0014-use-native-adrs-and-retire-documentation-catalogue.md#legacy-document-removal--2026-10-28))
  and [ADR skill](../../../.agents/skills/adr-skill/SKILL.md)

Revisit the workflow if pilot or cutover evaluation cannot reliably discover governing
decisions and supporting sources, if implementation plans repeatedly become misleading
despite separation, or if phase review fails to surface semantic changes. Enrich
retrieval only in response to observed routing failures; the migration alone does not
justify a new search service, database, or metadata grammar.

## Lifecycle notes

- 2026-10-27: Status changed from proposed to accepted after the maintainer approved
  ADR 0010 and the 119-document inventory in the migration phase review.

- 2026-10-27: M03 implements the compatible helpers, class-aware templates, and ADR
  checks. Pilot records 0011–0013 remain proposed pending the next phase review.

- 2026-10-27: Deprecated at the maintainer's explicit direction in favor of using
  adr-skill as-is. The original skill was restored and custom helpers removed.

## Replacement policy — 2026-10-27

The maintainer approved [native ADRs and catalogue retirement](0014-use-native-adrs-and-retire-documentation-catalogue.md). The old workflow above is historical.

## Context and Problem Statement

This deprecated record preserves the originally accepted adapted-skill policy and its
withdrawal. The maintainer later chose the unchanged skill and catalogue retirement;
ADR 0014 governs. Historical plan/verification statements above do not authorize
reinstating the old custom templates, helpers or routing metadata.

## Implementation Plan

- **Affected paths:** this historical record, ADR 0014, documentation indexes and the migration tracker.
- **Dependencies/configuration:** none; do not execute the withdrawn plan or recreate old tooling.
- **Patterns to follow:** retain dated acceptance/deprecation history and explicit replacement links.
- **Patterns to avoid:** treating the original implementation checklist as current work.
- **Verification:** retain the historical checkbox evidence above; current checks confirm
  native deprecated metadata, replacement navigation and absence of the withdrawn skill/tooling.
