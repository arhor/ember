import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import type { ProviderResult } from "../src/providers/contract.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "test-fixtures", "longitudinal", "memory-context-pressure.json");

test("longitudinal memory/context harness should generate stable history groups and classify projection signals", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const reply = [
            ...invocation.request.projection.meanings.map((item) => item.content),
            ...invocation.request.projection.gaps.map((item) => item.gap_kind),
        ].join(" | ");

        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply,
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
            operational: { external_thread_id: `thread-${invocation.episodeId}` },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.history.generated_action_count, 64);
    assert.equal(report.history.groups.ambient_project_history?.length, 64);
    assert.deepEqual(report.history.groups.ambient_project_history?.slice(0, 2), [
        "ambient_project_history.0001",
        "ambient_project_history.0002",
    ]);
    assert.equal(report.history.groups.ambient_project_history?.at(-1), "ambient_project_history.0064");

    const baseline = report.episodes[0]!;
    assert.deepEqual(baseline.context_evaluation.omission_candidates.relevant_not_selected, []);
    assert.equal(baseline.context_evaluation.inclusion_candidates.irrelevant_selected.length, 64);
    assert.deepEqual(baseline.context_evaluation.inclusion_candidates.forbidden_selected, []);
    assert.equal(baseline.context_evaluation.selected_meanings.includes("ambient_project_history.0001"), true);

    const changed = report.episodes[1]!;
    assert.deepEqual(changed.context_evaluation.omission_candidates.relevant_not_selected, []);
    assert.equal(changed.context_evaluation.inclusion_candidates.irrelevant_selected.length, 64);
    assert.deepEqual(changed.context_evaluation.inclusion_candidates.superseded_selected, ["preference_a"]);
    assert.deepEqual(changed.context_evaluation.degradation_signals.unavailable_selected, ["degraded_episode"]);
    assert.deepEqual(changed.context_evaluation.degradation_signals.unavailable_with_projection_gap, [
        "degraded_episode",
    ]);
    assert.equal(
        changed.ember_assertions.find((item) => item.assertion === "declared superseded meanings are superseded")
            ?.passed,
        true,
    );
    assert.equal(
        changed.ember_assertions.find(
            (item) => item.assertion === "declared unavailable meanings have unavailable evidence",
        )?.passed,
        true,
    );

    const ordinary = report.episodes[2]!;
    assert.deepEqual(ordinary.context_evaluation.inclusion_candidates.superseded_selected, []);
    assert.deepEqual(ordinary.context_evaluation.degradation_signals.unavailable_selected, []);
    assert.deepEqual(ordinary.context_evaluation.degradation_signals.unavailable_with_projection_gap, []);
    assert.deepEqual(ordinary.context_evaluation.inclusion_candidates.forbidden_selected, []);
});

test("memory/context projection evidence should remain independent from empirical model observations", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) =>
        harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply: "MODEL_DID_NOT_FOLLOW_THE_PROJECTED_CONTEXT",
            used_meaning_ids: [],
            operational: { external_thread_id: `thread-${invocation.episodeId}` },
        }),
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, false);
    assert.equal(report.episodes[0]!.context_evaluation.inclusion_candidates.irrelevant_selected.length, 64);
    assert.deepEqual(report.episodes[1]!.context_evaluation.inclusion_candidates.superseded_selected, ["preference_a"]);
    assert.deepEqual(report.episodes[1]!.context_evaluation.degradation_signals.unavailable_with_projection_gap, [
        "degraded_episode",
    ]);
});

function harnessOutput(backend: string, result: ProviderResult) {
    return {
        result,
        backend_metadata: {
            backend,
            adapter: "test-provider",
            version: "1",
            configuration: {
                deterministic: true,
            },
        },
    };
}
