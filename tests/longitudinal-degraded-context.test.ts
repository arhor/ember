import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import { initialState } from "../src/core/model.ts";
import { attachDetail, rememberEpisode, withholdDetail } from "../src/core/semantics.ts";
import type { ProjectedMeaning } from "../src/core/projection.ts";
import type { ProviderResult } from "../src/providers/contract.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "test-fixtures", "longitudinal", "degraded-context-pressure.json");
const DETAIL = "UNAVAILABLE_DETAIL_MARKER_69: copper-fern-17";
const PRIVATE = "WITHHELD_PRIVATE_MARKER_69";

test("degraded-context pressure should preserve truthful gaps and keep withheld context distinct from irrelevant context", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(
        scenario,
        join(directory, "ember.json"),
        async invocation => {
            const reply = [
                ...invocation.request.projection.meanings.map(item => item.content),
                ...invocation.request.projection.gaps.map(item => item.gap_kind),
            ].join(" | ");
            const externalThreadId = invocation.thread.mode === "fresh"
                ? `thread-${invocation.episodeId}`
                : invocation.thread.externalThreadId;
            return harnessOutput(invocation.cognitionBackend, {
                contract_version: 1,
                reply,
                used_meaning_ids: invocation.request.projection.selection.meaning_ids,
                operational: { external_thread_id: externalThreadId },
            });
        },
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);

    const baseline = report.episodes[0]!;
    const baselineEpisode = meaningWith(baseline.projection.meanings, "optional exact detail");
    assert.deepEqual(baseline.projection.gaps, []);
    assert.equal(baselineEpisode.requested_detail_evidence?.[0]?.payload, DETAIL);
    assert.deepEqual(baseline.context_evaluation.declared.irrelevant, ["irrelevant_permitted"]);
    assert.deepEqual(baseline.context_evaluation.declared.unavailable, []);
    assert.deepEqual(baseline.context_evaluation.declared.forbidden, ["intentionally_withheld_private"]);
    assert.deepEqual(baseline.context_evaluation.inclusion_candidates.irrelevant_selected, ["irrelevant_permitted"]);
    assert.deepEqual(baseline.context_evaluation.inclusion_candidates.forbidden_selected, []);
    assert.equal(baseline.canonical_before.current_meanings.some(item => item.content.includes(PRIVATE)), true);
    assert.equal(baseline.projection.meanings.some(item => item.content.includes(PRIVATE)), false);

    const unavailable = report.episodes[1]!;
    assert.notEqual(unavailable.runtime_id, baseline.runtime_id);
    assert.equal(unavailable.canonical_before.gaps.length, 1);
    assert.equal(unavailable.projection.gaps.length, 1);
    assert.equal(unavailable.projection.gaps[0]!.gap_kind, "unavailable_detail");
    assert.match(unavailable.projection.gaps[0]!.claim, /cannot be recovered/);
    const unavailableEpisode = meaningWith(unavailable.projection.meanings, "optional exact detail");
    assert.equal(unavailableEpisode.requested_detail_evidence, undefined);
    assert.deepEqual(unavailable.context_evaluation.declared.unavailable, ["degraded_episode"]);
    assert.deepEqual(unavailable.context_evaluation.declared.forbidden, ["intentionally_withheld_private"]);
    assert.deepEqual(unavailable.context_evaluation.degradation_signals.unavailable_selected, ["degraded_episode"]);
    assert.deepEqual(unavailable.context_evaluation.degradation_signals.unavailable_with_projection_gap, ["degraded_episode"]);
    assert.deepEqual(unavailable.context_evaluation.inclusion_candidates.irrelevant_selected, ["irrelevant_permitted"]);
    assert.deepEqual(unavailable.context_evaluation.inclusion_candidates.forbidden_selected, []);
    assert.equal(unavailable.canonical_before.current_meanings.some(item => item.content.includes(PRIVATE)), true);
    assert.equal(unavailable.projection.meanings.some(item => item.content.includes(PRIVATE)), false);
    assert.equal(JSON.stringify(unavailable.projection).includes(DETAIL), false);
    assert.equal(JSON.stringify(unavailable.projection).includes("copper-fern-17"), false);

    const ordinary = report.episodes[2]!;
    assert.notEqual(ordinary.runtime_id, unavailable.runtime_id);
    assert.equal(ordinary.canonical_before.gaps.length, 1);
    assert.deepEqual(ordinary.projection.gaps, []);
    assert.equal(ordinary.projection.meanings.some(item => item.content.includes("optional exact detail")), false);
    assert.deepEqual(ordinary.context_evaluation.declared.irrelevant, ["irrelevant_permitted", "degraded_episode"]);
    assert.deepEqual(ordinary.context_evaluation.declared.unavailable, ["degraded_episode"]);
    assert.deepEqual(ordinary.context_evaluation.degradation_signals.unavailable_selected, []);
    assert.deepEqual(ordinary.context_evaluation.inclusion_candidates.irrelevant_selected, ["irrelevant_permitted"]);
    assert.deepEqual(ordinary.context_evaluation.inclusion_candidates.forbidden_selected, []);
    assert.equal(ordinary.canonical_before.current_meanings.some(item => item.content.includes(PRIVATE)), true);
    assert.equal(ordinary.projection.meanings.some(item => item.content.includes(PRIVATE)), false);
    assert.equal(JSON.stringify(ordinary.projection).includes(DETAIL), false);
});

test("privacy deletion should not be modeled as unavailable detail", () => {
    // Given
    const state = initialState("Ember", "user-1", "2026-09-02T08:00:00Z");
    const episode = rememberEpisode(
        state,
        "user-1",
        "deletion-boundary",
        "relationship:user-1",
        "project:ember/degraded-context",
        "A synthetic episode with deletable detail",
    );
    const detail = attachDetail(state, "user-1", episode, "DELETE_ME_69");
    const before = structuredClone(state);

    // When / Then
    assert.throws(
        () => withholdDetail(state, "user-1", detail, { reason: "privacy deletion requested" }),
        /privacy deletion semantics are unsupported by fixture fault/,
    );
    assert.deepEqual(state, before);
});

function meaningWith(meanings: ProjectedMeaning[], marker: string): ProjectedMeaning {
    const meaning = meanings.find(item => item.content.includes(marker));
    assert.ok(meaning, `missing projected meaning with marker ${marker}`);
    return meaning;
}

function harnessOutput(backend: string, result: ProviderResult) {
    return {
        result,
        backend_metadata: {
            backend,
            adapter: "test-provider",
            version: "1",
            configuration: { deterministic: true },
        },
    };
}
