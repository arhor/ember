---
summary: "Issue #67 evaluation evidence for changed preferences, corrected facts, unresolved contradictory reports, and explicit reconstruction of superseded meaning under longitudinal pressure."
read_when:
  - "Reviewing currentness behavior for preference changes, fact corrections, contradictions, or superseded meaning"
  - "Interpreting issue #67 evidence before omission/inclusion harm synthesis in #70 or failure inventory work in #71"
  - "Deciding whether a stale-memory failure belongs to canonical semantics, projection selection, or empirical model cognition"
role: evidence
discovery_status: current
---

# Longitudinal Currentness Evaluation

## Purpose and authority

Issue [#67](https://github.com/arhor/ember/issues/67) pressure-tests the current
memory/currentness slice using the shared longitudinal harness from #54 and #66.
This note records evaluation evidence and known representation boundaries. It does
not create new semantic authority. The governing sources remain ADR 0002, ADR 0003,
`docs/research/memory-and-remembering.md`, and the memory/currentness acceptance
scenarios in `docs/architecture/acceptance-scenarios.md`.

The executable fixture is
`test-fixtures/longitudinal/currentness-pressure.json`. Its deterministic regression
coverage is `tests/longitudinal-currentness.test.ts` and it can be reproduced with:

```sh
npm run eval:currentness
node --test tests/longitudinal-currentness.test.ts
```

The same fixture can be layered onto the opt-in live longitudinal provider runner.
Deterministic projection assertions and empirical model observations remain separate,
so a model wording failure cannot rewrite canonical currentness evidence.

The baseline, changed-preference, and corrected-fact episodes deliberately share one
external provider thread. A live provider therefore encounters preference A and fact
A before Ember later projects preference B and corrected fact B into that same
provider history. The `reply_excludes` stale markers consequently test empirical
stale-state resurrection rather than merely confirming that a fresh model invocation
received a clean projection. The explicit historical reconstruction episode uses a
fresh provider thread so intentional historical inclusion remains a separate probe.

## Scenario map

The fixture grows 24 irrelevant same-scope history items before establishing the
meanings under evaluation. That pressure is intentional: stale values must not
reappear merely because history is long or similar.

| Episode | Currentness pressure | Deterministic oracle |
| --- | --- | --- |
| `baseline-with-unresolved-conflict` | Preference A, fact A, and two contradictory migration reports coexist. | Both reports remain distinct current meanings with distinct source occurrences; neither is silently declared the correction of the other. |
| `changed-preference` | Preference A is explicitly superseded by preference B while the provider thread still contains A. | Ordinary projection selects B, preserves A as historical, forbids A from governing current cognition, and reuses the baseline provider thread. |
| `corrected-fact` | Fact A is explicitly corrected by fact B while the same provider thread still contains A. | Ordinary projection selects B, preserves A as historical, does not resurrect A, and continues the reused provider thread. |
| `explicit-history-reconstruction` | Cognition explicitly asks why preference and fact changed. | Explain projection includes both historical and current linked meanings on a fresh provider thread, while the ordinary currentness rule remains unchanged. |

The scripted provider simply renders selected meaning content and truthfully mirrors
fresh-versus-reused thread IDs. Therefore marker presence or absence is a direct
diagnostic of the projection it received while thread assertions verify the intended
stale-history pressure topology. Optional real-model runs add a second empirical
question: even with the correct projection, does cognition accidentally revive a
stale preference or fact retained in its external thread history?

## Findings

### Explicit supersession behaves correctly for the supported fact and preference slice

The existing `supersede` transition preserves the predecessor as attributable
history and creates a current successor in the same semantic slot. Ordinary
projection selects only the current successor. When historical explanation is
explicitly requested, the explain projection includes both sides of the reciprocal
supersession link.

This is the desired distinction between **historically true** and **currently
governing**. The fixture treats selection of a superseded meaning during ordinary
cognition as a failure, but treats the same selection during explicit historical
reconstruction as relevant evidence rather than automatic inclusion harm.

### Contradiction is not treated as supersession by recency

The fixture deliberately models the unresolved migration conflict as two separate
report meanings:

- `CONFLICT_REPORT_A: The migration completed successfully`;
- `CONFLICT_REPORT_B: The migration did not complete successfully`.

Both retain their own user-command evidence occurrence, scope, timestamp, and
currentness. Neither carries a `supersedes` or `superseded_by` link. This avoids the
failure mode where Ember invents a correction merely because one contradictory
statement arrived later.

The current executable slice does **not** yet represent the richer AS-MEM-03 case
where user testimony, Ember inference, and an external record disagree. Issue #68
owns those provenance classes. #67 therefore keeps the contradiction inside the
already-supported user-testimony boundary rather than laundering future provenance
semantics through today's types.

### Exact-slot unresolved conflict remains a known representation boundary

The current v1 semantics permit only one current meaning for an exact
`kind + owner + slot + scope` tuple. `rememberFact` therefore cannot preserve two
simultaneously current candidate values in one exact fact slot. The #67 fixture uses
separate report slots to preserve contradictory accounts without pretending that a
single resolved fact exists.

This is a localized semantic/model limitation, not a retrieval failure and not a
reason to expand context indiscriminately. Later work should decide whether richer
provenance from #68 is sufficient, whether a first-class contested/currentness
representation is required, or whether the existing account-level representation
is adequate for observed failures. #71 should retain this boundary in the shared
failure inventory rather than letting it disappear behind a green model reply.

### Relationship supersession remains unsupported in v1

Relationship meaning is fixed-current in the present minimal slice and does not
participate in the fact/preference supersession chain. #67 therefore exercises
superseded **meaning** through preferences and facts rather than inventing an
unsupported relationship transition merely to satisfy a fixture shape.

If later longitudinal evidence requires relationship-state replacement or
reinterpretation, that needs a named semantic transition and validation rule. It
should not be simulated by deleting relationship history or by encoding relationship
state as an unrelated fact.

## Evidence carried forward to #70 and #71

The fixture leaves four reusable evidence classes:

1. stale preference exclusion after explicit change despite provider-thread history;
2. stale fact exclusion after correction despite provider-thread history;
3. coexistence of contradictory reports without implicit supersession;
4. deliberate inclusion of superseded history only for explicit reconstruction.

The shared harness additionally records the 24 generated same-scope meanings as
irrelevant inclusion candidates. #70 can therefore compare stale-value omission /
inclusion harm against ordinary long-history noise without changing this fixture.
#71 can distinguish a semantic representation boundary from a projection defect or
a model-only resurrection of stale content.

No SQLite, embeddings, reranking, vector search, or retrieval ranking change is
introduced by this evaluation. The result remains evidence about meaning and
projection behavior first.
