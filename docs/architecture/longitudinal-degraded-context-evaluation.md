---
summary: "Issue #69 evaluation evidence for unavailable recall, intentionally withheld context, irrelevant permitted material, restart-stable gaps, and the unresolved deleted/forgotten representation boundary."
read_when:
  - "Reviewing unavailable recall, degraded context, intentional non-disclosure, forgetting, or deletion behavior"
  - "Interpreting issue #69 evidence before omission/inclusion harm synthesis in #70 or failure inventory work in #71"
  - "Deciding whether missing material is unavailable, deliberately excluded from a projection, merely irrelevant, forgotten, or deleted"
role: evidence
discovery_status: current
---

# Longitudinal Degraded Context Evaluation

## Purpose and authority

Issue [#69](https://github.com/arhor/ember/issues/69) pressure-tests the current
memory/context slice when previously relevant material is recoverable, later
unavailable, deliberately outside a permitted projection, or merely irrelevant.
It also asks whether the current model can truthfully represent deletion and
forgetting without overloading an existing status.

This note records evaluation evidence and an explicit representation finding. It
does not create new semantic authority. The governing sources remain ADR 0002,
ADR 0003, `docs/research/memory-and-remembering.md`,
`docs/research/context-selection-and-cognitive-framing.md`, and acceptance scenarios
AS-CONT-04, AS-MEM-04, and AS-MEM-05.

The executable fixture is
`test-fixtures/longitudinal/degraded-context-pressure.json`. Its deterministic
coverage is `tests/longitudinal-degraded-context.test.ts` and it can be reproduced
with:

```sh
npm run eval:degraded-context
node --test tests/longitudinal-degraded-context.test.ts
```

The same fixture can be layered onto the opt-in live longitudinal provider runner:

```sh
EMBER_RUN_LIVE_LONGITUDINAL=1 \
  node scripts/run-longitudinal-scenario.ts \
  --scenario test-fixtures/longitudinal/degraded-context-pressure.json \
  --provider codex \
  --timeout-seconds 180
```

Deterministic projection assertions remain separate from empirical reply
observations. A fluent model answer cannot repair a missing gap or an improper
disclosure, and a model wording failure cannot rewrite canonical evidence.

## Scenario map

The fixture establishes four deliberately different conditions before and across
restart:

| Condition                              | Repository representation                                                                                                 | Expected behavior                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Recoverable optional detail            | `episode_meta` plus available attached detail evidence                                                                    | Explicit explain projection may include the requested detail payload.                                             |
| Unavailable recall                     | Attached detail converted by the fixture-only `withhold_detail` fault                                                     | Episode meaning survives, detail payload is absent, and explicit explanation carries an `unavailable_detail` gap. |
| Intentionally withheld private context | Current meaning remains canonical in another scope and is declared forbidden for this projection                          | Canonical inspection can still see the meaning, but the cognition projection must not receive it.                 |
| Merely irrelevant permitted context    | Current same-scope fact remains eligible for the present broad v1 projection but is classified irrelevant by the scenario | The evaluator reports it separately as `irrelevant_selected`; it is neither unavailable nor private.              |

Three cognition episodes then expose the transitions:

| Episode                         | Pressure                                                                                       | Deterministic oracle                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `available-detail-baseline`     | The optional detail is still recoverable.                                                      | Explain projection contains the requested detail payload, no gap, and no private marker.                                                              |
| `unavailable-after-restart`     | The detail becomes unavailable immediately before Ember restarts.                              | Canonical inspection and explain projection preserve the gap; the old payload is absent; private context remains canonical but undisclosed.           |
| `ordinary-after-second-restart` | Ember restarts again and answers an ordinary question that does not need the degraded episode. | Canonical gap still exists, but the ordinary projection omits the episode and its gap. The omission means only that the gap is not participating now. |

The fixture also leaves one same-scope irrelevant fact selected throughout. This is
intentional evidence of the present v1 selector's broad behavior, not a claim that
irrelevant inclusion is harmless. Issue #70 owns that harm judgment.

## Findings

### Unavailable recall already has a truthful representation

The current optional-detail fault does not delete an episode. `withholdDetail`
removes the attached payload and digest, records the detail evidence as unavailable,
and leaves independently supported episode meaning intact. When that episode is
explicitly requested for explanation, `buildProjection` emits an
`unavailable_detail` gap whose claim says the episode is supported but the detail
cannot be recovered from the store.

This matches AS-MEM-04: failed retrieval is neither absence, forgetting, deletion,
nor evidence that the episode did not occur. The deterministic test additionally
asserts that the former payload string is absent from the degraded projection, so
the gap is not accompanied by a hidden reconstruction channel.

### The degraded state survives restart without becoming seamless continuity

After the fault, the fixture restarts Ember twice. Canonical inspection continues
to expose the same unavailable-detail condition after each persistence boundary.
The first restarted explain projection carries the gap because the episode is
relevant. The later ordinary projection omits both the episode and the gap because
they are not needed for that cognition.

Those outcomes are complementary rather than contradictory. The gap survives in
canonical state while participation remains purpose-bounded. Restart therefore
does not manufacture recovered detail, erase the degradation, or require every
future cognition to repeat the gap.

### Intentional withholding is distinct from unavailable recall

The private marker never becomes unavailable. It remains a current canonical
meaning throughout the scenario. It is withheld because its scope is outside the
current cognition projection, and the scenario declares it forbidden for that
recipient/purpose boundary.

The deterministic test checks both sides of the distinction after restart:
canonical inspection still contains the private meaning, while the projection does
not. This is deliberate exclusion under ADR 0003, not forgetting and not a recall
failure. Current v1 state does not need a separate memory lifecycle status called
`withheld` for this case because withholding is a property of a particular
projection boundary, not necessarily of the meaning itself.

### Merely irrelevant material remains a separate evaluator classification

The same-scope lab-note fact is classified `irrelevant` by the scenario but remains
selected by the present minimal projection algorithm. `context_evaluation` reports
it as `irrelevant_selected`, while the private marker remains absent and the
degraded episode is separately classified `unavailable`.

This is useful pressure for #70 and #71. It demonstrates that omission because
content is not permitted, omission because a meaning is not selected for an
ordinary purpose, unavailable evidence, and inclusion of irrelevant permitted
material are observable as different conditions. The evaluator should not collapse
them into one generic "missing context" signal.

### Design finding for #71: deleted and forgotten are not representable yet

The current canonical model does not contain a deleted or forgotten lifecycle for
meaning or evidence. Its relevant executable distinctions are currently:

- meaning currentness such as `current` and `superseded`;
- optional detail evidence availability as `available` or `unavailable`;
- projection inclusion/exclusion based on purpose, currentness, and scope.

That is insufficient to encode AS-MEM-05 privacy deletion or the broader forgetting
forms described by the memory research. The absence is deliberate enough to be
testable: `withholdDetail` rejects a reason containing deletion, and the #69 test
asserts that this rejection leaves state unchanged. Therefore the evaluator does
not rename an unavailable-detail fault to deletion merely to produce a green
scenario.

This representation gap must be carried into #71 before implementation-specific
retrieval work begins. A future deletion/forgetting transition needs an explicit
semantic decision about at least the deletion scope, whether event existence may
survive, which evidence/meaning derivatives can reconstruct forbidden content, and
how surviving consequences are weakened when their provenance is removed. ADR 0002
and AS-MEM-05 intentionally leave some propagation thresholds unresolved, so #69
does not invent them.

## Real-model probe and interpretation

The degraded episode asks a live model not to guess the missing content, not to
claim seamless exact recall, and to acknowledge the projected gap with the literal
`unavailable_detail` token. Reply exclusions also include the known synthetic
payload, the private marker, and two direct overconfidence phrases.

This is a useful regression probe, but it has a deliberately bounded claim. Exact
substring checks can catch resurrection of the known secret and some explicit
continuity overclaims; they cannot prove that a model never fabricates a novel
paraphrase or a different plausible detail. Live results therefore remain empirical
model observations rather than semantic proof.

## Evidence carried forward to #70 and #71

Issue #69 leaves four reusable evidence classes: restart-stable unavailable recall
with an explicit gap, canonical-but-undisclosed private context, irrelevant
same-scope inclusion, and a proven absence of deleted/forgotten lifecycle
representation. #70 can assign omission/inclusion harm without changing these raw
observations. #71 should classify the first three as executable behavior and the
last as a semantic/modeling gap, not as a retrieval failure.

No SQLite, embeddings, reranking, vector search, or retrieval implementation is
introduced by this evaluation. The result stays at meaning, projection, persistence,
and cognition behavior first.
