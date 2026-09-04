import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import type { ProviderResult } from "../src/providers/contract.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "test-fixtures", "longitudinal", "currentness-pressure.json");

test("longitudinal currentness pressure should preserve corrections as history and keep unresolved reports distinct", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const reply = invocation.request.projection.meanings.map((item) => item.content).join(" | ");
        const externalThreadId =
            invocation.thread.mode === "fresh" ? `thread-${invocation.episodeId}` : invocation.thread.externalThreadId;
        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply,
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
            operational: { external_thread_id: externalThreadId },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.history.generated_action_count, 24);

    const baseline = report.episodes[0]!;
    const conflictMeanings = baseline.projection.meanings.filter((item) => item.content.startsWith("CONFLICT_REPORT_"));
    assert.equal(conflictMeanings.length, 2);
    assert.equal(
        conflictMeanings.every((item) => item.currentness === "current"),
        true,
    );
    assert.equal(
        conflictMeanings.every((item) => item.supersedes === null && item.superseded_by === null),
        true,
    );
    assert.notEqual(
        conflictMeanings[0]!.source_evidence[0]!.evidence_id,
        conflictMeanings[1]!.source_evidence[0]!.evidence_id,
    );
    assert.equal(
        conflictMeanings.every((item) => item.source_evidence[0]!.source_actor === "user:user-1"),
        true,
    );
    assert.deepEqual(baseline.context_evaluation.omission_candidates.relevant_not_selected, []);
    assert.equal(baseline.context_evaluation.inclusion_candidates.irrelevant_selected.length, 24);

    const changedPreference = report.episodes[1]!;
    assert.equal(changedPreference.external_thread.mode, "reuse");
    assert.equal(changedPreference.provider_thread_id, baseline.provider_thread_id);
    assert.equal(
        changedPreference.projection.meanings.some((item) => item.content.includes("CURRENTNESS_PREF_OLD")),
        false,
    );
    assert.equal(
        changedPreference.projection.meanings.some((item) => item.content.includes("CURRENTNESS_PREF_NEW")),
        true,
    );
    assert.equal(
        changedPreference.canonical_before.historical_meanings.some(
            (item) => item.content.includes("CURRENTNESS_PREF_OLD") && item.currentness === "superseded",
        ),
        true,
    );
    assert.deepEqual(changedPreference.context_evaluation.inclusion_candidates.superseded_selected, []);

    const correctedFact = report.episodes[2]!;
    assert.equal(correctedFact.external_thread.mode, "reuse");
    assert.equal(correctedFact.provider_thread_id, baseline.provider_thread_id);
    assert.equal(
        correctedFact.projection.meanings.some((item) => item.content.includes("CURRENTNESS_FACT_OLD")),
        false,
    );
    assert.equal(
        correctedFact.projection.meanings.some((item) => item.content.includes("CURRENTNESS_FACT_NEW")),
        true,
    );
    assert.equal(
        correctedFact.canonical_before.historical_meanings.some(
            (item) => item.content.includes("CURRENTNESS_FACT_OLD") && item.currentness === "superseded",
        ),
        true,
    );
    assert.deepEqual(correctedFact.context_evaluation.inclusion_candidates.superseded_selected, []);
    assert.deepEqual(correctedFact.context_evaluation.inclusion_candidates.forbidden_selected, []);

    const history = report.episodes[3]!;
    assert.equal(history.external_thread.mode, "fresh");
    assert.notEqual(history.provider_thread_id, baseline.provider_thread_id);
    assert.deepEqual(history.context_evaluation.inclusion_candidates.superseded_selected, [
        "preference_old",
        "fact_old",
    ]);
    assert.equal(
        history.projection.meanings.some((item) => item.content.includes("CURRENTNESS_PREF_OLD")),
        true,
    );
    assert.equal(
        history.projection.meanings.some((item) => item.content.includes("CURRENTNESS_PREF_NEW")),
        true,
    );
    assert.equal(
        history.projection.meanings.some((item) => item.content.includes("CURRENTNESS_FACT_OLD")),
        true,
    );
    assert.equal(
        history.projection.meanings.some((item) => item.content.includes("CURRENTNESS_FACT_NEW")),
        true,
    );
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
