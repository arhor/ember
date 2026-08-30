---
summary: "Task-oriented evaluation of the adopted documentation discovery layer against issue #26 routing scenarios and metadata-quality expectations."
read_when:
  - "Reviewing whether documentation discovery routes realistic Ember work without semantic ranking"
  - "Auditing issue #27 implementation evidence, metadata quality, discovery depths, or known routing limitations"
role: reference
discovery_status: current
---

# Documentation Discovery Evaluation

> Evaluation date: 2026-08-29.
>
> This note evaluates the repository implementation of [the documentation-discovery contract](documentation-discovery.md) for issue #27. It records deterministic structural evidence and a qualitative routing review. It does not claim that deterministic code can infer task-to-document relevance.

## Evaluation method

The contract deliberately gives the discovery utility no task query. Evaluation therefore separates two things:

1. **structural evidence**: the deterministic catalogue exposes the expected document classes at the intended depths and validates the metadata contract;
2. **qualitative routing review**: a reader is given a realistic task plus the catalogue and judges which summaries and applicability hints make plausible source documents stand out, which documents can remain unopened, and when escalation to headings, deep evidence, or history is understandable.

No semantic matcher, keyword scorer, embedding model, ranking algorithm, or hidden expected-result table was added to make these scenarios appear deterministic.

## Corpus state used for evaluation

Issue #26 was merged at master commit `c512df45362354d72ba65cd86603e8e551b4eabc`. At the start of #27, that merged corpus contained 32 human-authored `docs/**/*.md` files and no adopted implementation runtime or dependency ecosystem.

Two architecture changes existed as open pull requests rather than merged repository knowledge:

- [PR #29](https://github.com/arhor/ember/pull/29) proposes the first five semantic ADRs and architecture indexes;
- [PR #30](https://github.com/arhor/ember/pull/30) proposes the architecture acceptance-scenario catalogue and depends on #29.

Because neither PR had landed, #27 does not copy their unmerged content into the current corpus or pretend that their decision/scenario artifacts already govern Ember. The discovery tooling supports `decision` and `scenario` roles, and any newly merged `docs/**/*.md` file is required to carry valid metadata once #27's validation is present.

After the #27 adoption files are included, the evaluated corpus has 34 participating documents:

- **13 default entries**: current foundations, design, canonical research, and guides;
- **33 deep entries**: the default set plus current references, evidence maps, preserved source reports, and this evaluation;
- **34 all/history entries**: the deep set plus the superseded initial architecture model.

There are no generated Markdown exclusions in v1.

## Structural expectations

The migration was reviewed against document responsibility rather than directory alone:

- `docs/vision.md` and `docs/principles.md` are current `foundation` documents;
- `docs/architecture/design-directions.md` and the discovery contract are current `design` documents;
- `docs/architecture/initial-model.md` is `design` but `superseded`, pointing to the current synthesis;
- canonical concern notes are current `research` documents in default discovery;
- portable `*-references.md` maps are current `evidence` documents in deep discovery;
- preserved Deep Research exports are current `source` documents in deep discovery while remaining explicitly non-canonical in their source text;
- NanoBot, Hermes, OpenClaw, Letta, and the OpenClaw documentation-discovery investigation are current `reference` documents in deep discovery;
- research navigation and the contributor discovery guide are current `guide` documents.

This classification preserves the pre-existing research hierarchy instead of manufacturing authority from metadata.

## Scenario 1: continuity and restart work

**Task:** Change how Ember resumes after a complete process restart and long inactivity.

**Obvious default candidates from the catalogue:**

- `docs/architecture/design-directions.md`, whose hints cover cross-cutting continuity/currentness and architecture boundaries;
- `docs/research/continuity-and-identity.md`, whose hints explicitly cover restart, resume, migration, model replacement, and identity continuity;
- `docs/research/operational-model-sessions-and-surfaces.md`, whose hints cover restart/recovery, downtime gaps, resumption, and currentness reconciliation;
- `docs/principles.md` when the change risks making process/session lifetime define Ember lifetime.

**Material that need not be opened eagerly:** memory, delegation, authority, and endogenous-agency bodies; all evidence maps; all source reports; reviewed-system references.

**Current-corpus limitation:** the continuity and operational ADRs and restart/recovery acceptance fixtures expected by #26 are not yet merged. PRs #29/#30 contain those future classes, so this evaluation can confirm routing of the currently adopted design/research layer but not pretend the absent decision/scenario sources were discovered.

**Finding:** the available routing hints discriminate restart/continuity work cleanly without deep discovery.

## Scenario 2: memory and currentness work

**Task:** Change how a corrected preference supersedes older remembered state while preserving history.

**Obvious default candidates:**

- `docs/research/memory-and-remembering.md` for correction, supersession, historical evidence, ownership, scope, and currentness;
- `docs/research/context-selection-and-cognitive-framing.md` when the old and current states must be projected without losing temporal or authority distinctions;
- `docs/architecture/design-directions.md` for the cross-cutting currentness invariant.

**Not eager:** authority and endogenous-agency research, reviewed-system references, evidence maps, and preserved source reports.

**Finding:** the memory and context hints are complementary rather than duplicated. One describes durable remembered meaning; the other describes what may participate in a bounded act of cognition.

## Scenario 3: delegation and privacy

**Task:** Decide whether relationship information relevant to Ember may be included in a coding specialist's delegated context.

**Obvious default candidates:**

- `docs/research/context-selection-and-cognitive-framing.md` for purpose-bounded, least-sufficient, permission-preserving projection;
- `docs/research/capabilities-and-delegation.md` for the delegation envelope, specialist context, runtime ownership, and disclosure across delegation boundaries;
- `docs/research/action-authority-and-permission.md` for access-versus-disclosure authority and the rule that delegation cannot amplify authority;
- `docs/architecture/design-directions.md` where scope, recipient, provenance, and authority cross subsystem boundaries.

**Not eager:** continuity source research, all reviewed-system notes, every evidence map, or all canonical concerns.

**Finding:** this is a useful stress case for overlap. Three canonical notes surface for different reasons, and their summaries/hints explain those reasons rather than collapsing them into a generic `privacy` tag.

## Scenario 4: authority after circumstances change

**Task:** Allow Ember to perform an external action under a standing grant after circumstances have changed.

**Obvious default candidates:**

- `docs/research/action-authority-and-permission.md` for standing authority, revocation, changed circumstances, external action, and fresh approval;
- `docs/research/memory-and-remembering.md` where a formerly valid grant must remain historical evidence without acting as current mandate;
- `docs/research/operational-model-sessions-and-surfaces.md` only when delayed work, retries, recovery, or stale observations are part of the changed circumstances;
- `docs/architecture/design-directions.md` for the cross-cutting currentness/authority constraint.

**Not eager:** reviewed-system references or source artifacts.

**Finding:** the catalogue does not mistake technical capability for authority and does not need a rule engine to make the relevant distinction visible.

## Scenario 5: architecture acceptance work

**Task:** Add a fixture for a new concurrency/currentness failure case.

**Current merged candidates:** `docs/architecture/design-directions.md` plus the canonical concern notes implicated by the fixture, especially memory/currentness and operational concurrency when applicable.

**Expected future primary candidate:** `docs/architecture/acceptance-scenarios.md` with `role: scenario` once PR #30 is merged. The governing ADRs from #29 should likewise participate as `decision` documents while retaining their independent ADR lifecycle.

**Not eager:** all canonical research merely because a scenario traces to several concerns, and never the whole deep/source tier.

**Finding:** this scenario cannot be fully exercised against a scenario catalogue that is not on the base branch. That is a repository-state limitation, not evidence for semantic search or a broader discovery contract. Once the scenario document lands, missing metadata will be a deterministic validation failure rather than a silent omission.

## Scenario 6: ordinary local implementation/debugging

**Task:** Fix a local parser bug whose expected behavior is already established by nearby tests and does not alter Ember semantics.

`AGENTS.md` explicitly permits discovery to be skipped for such a task. If the bug is in the documentation-discovery utility itself, `docs/documentation-discovery-guide.md` and the governing contract are sufficient procedural/design sources without loading the semantic research corpus.

**Finding:** success includes staying out of the way. The policy does not turn every code edit into an excuse to inject all canonical semantic research.

## Scenario 7: investigate why a memory conclusion exists

**Task:** Determine why memory research concluded that current belief must remain distinct from historical evidence, deeply enough to challenge the conclusion or verify its basis.

The intended progression is visible directly in metadata:

1. default discovery surfaces `docs/research/memory-and-remembering.md` as the canonical `research` synthesis;
2. deep discovery adds `docs/research/memory-and-remembering-references.md` as the `evidence` map for checking durable sources;
3. deep discovery also makes `docs/research/source-material/memory-and-remembering-deep-research.md` reachable as preserved `source` material when reconstruction of the original investigation is actually necessary.

The evidence/source roles do not become canonical merely because this task asks a strong "why" question.

**Finding:** the default/deep split provides the intended evidence escape hatch without putting the entire research trail into ordinary coding context.

## Metadata quality review

A manual pass after migration checked the interface quality of the metadata, not only parser validity.

### Summaries

Summaries were written to distinguish neighboring responsibilities. Examples of deliberate separation include:

- memory research describes durable remembered meaning and lifecycle;
- context research describes bounded cognitive projection;
- delegation research describes material discretion, runtime ownership, and the delegation envelope;
- authority research describes legitimate decision-space and disclosure/approval boundaries;
- operational research describes sessions, surfaces, recovery, delivery, and long-running work.

Evidence maps and preserved source reports say explicitly that they support or reconstruct the corresponding canonical note rather than restating its authority.

### Applicability hints

Hints are phrased as tasks and decisions, not topic keywords. Directory-wide copy/paste was avoided. Deep evidence/source hints explain when provenance, challenge, audit, or reconstruction justifies escalation.

Overlap is intentional only where a real task crosses concerns. The specialist-context scenario, for example, should reasonably surface context, delegation, and authority documents for different semantic reasons.

### Role/currentness/lifecycle

The initial architecture model is the only current-corpus superseded document and points to the current cross-cutting synthesis. Preserved research exports remain `discovery_status: current` because they are still the retained source artifacts for current research, while `role: source` and their own prose preserve their non-canonical evidentiary function.

No metadata field attempts to encode whether a future `decision` is accepted. That remains the ADR's own lifecycle.

### Routing contradictions

No contradictory routing claim was found during the migration review. The main intentional overlaps correspond to cross-cutting tasks rather than generic "read this for everything" hints.

## Contract findings

Implementation did **not** expose a concrete flaw requiring a semantic change to #26.

The narrow parser choice validates one contract provision: with no adopted Ember runtime, a self-contained standard-library implementation is sufficient as long as the accepted frontmatter subset is explicit and unsupported YAML is rejected rather than silently misparsed.

The absence of merged ADR/scenario artifacts is not a contract flaw. It is useful evidence for why participation is defined over all human-authored `docs/**/*.md`: when those documents do land, they cannot silently remain outside discovery merely because their authors forgot to opt in.

## Overall result

The adopted layer remains deliberately boring machinery around meaningful source documents:

```text
agent policy
  -> deterministic role/currentness catalogue
      -> model or human relevance judgment
          -> selected headings
              -> selected source documents
                  -> deep evidence/source or history only when needed
```

The implementation improves repository knowledge visibility without becoming a second authority system or a miniature retrieval platform.
