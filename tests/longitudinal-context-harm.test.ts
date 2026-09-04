import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { evaluateContextHarm, type ContextEvaluationInput } from "../eval/longitudinal/context-harm.ts";
import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import type { ProviderResult } from "../src/providers/contract.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIOS = [
    "memory-context-pressure.json",
    "currentness-pressure.json",
    "provenance-pressure.json",
    "degraded-context-pressure.json",
];

test("context harm rubric should distinguish omission, distraction, stale context, privacy boundaries, and truthful degradation", () => {
    // Given / When
    const omission = evaluateContextHarm(
        context({
            relevant: ["needed"],
            relevantNotSelected: ["needed"],
        }),
    );
    const forbidden = evaluateContextHarm(
        context({
            forbidden: ["private"],
            forbiddenSelected: ["private"],
        }),
    );
    const stale = evaluateContextHarm(
        context({
            superseded: ["old"],
            supersededSelected: ["old"],
        }),
    );
    const historical = evaluateContextHarm(
        context({
            relevant: ["old"],
            superseded: ["old"],
            supersededSelected: ["old"],
        }),
    );
    const degraded = evaluateContextHarm(
        context({
            relevant: ["episode"],
            unavailable: ["episode"],
            unavailableSelected: ["episode"],
            unavailableWithGap: ["episode"],
        }),
    );
    const distraction = evaluateContextHarm(
        context({
            irrelevant: ["noise"],
            irrelevantSelected: ["noise"],
        }),
    );
    const rebalance = evaluateContextHarm(
        context({
            relevant: ["needed"],
            irrelevant: ["noise"],
            relevantNotSelected: ["needed"],
            irrelevantSelected: ["noise"],
        }),
    );

    // Then
    assert.equal(omission.omission.judgment, "material");
    assert.equal(omission.selection_pressure, "expand");
    assert.equal(forbidden.inclusion.judgment, "boundary_violation");
    assert.equal(stale.inclusion.judgment, "material");
    assert.equal(historical.inclusion.judgment, "none_observed");
    assert.equal(historical.inclusion.findings[0]?.kind, "purposeful_historical_inclusion");
    assert.equal(degraded.inclusion.judgment, "none_observed");
    assert.equal(degraded.inclusion.findings[0]?.kind, "truthful_degraded_inclusion");
    assert.equal(distraction.inclusion.judgment, "potential");
    assert.equal(distraction.selection_pressure, "reduce");
    assert.equal(distraction.empirical_cognition_impact, "not_measured");
    assert.equal(rebalance.selection_pressure, "rebalance");
});

test("representative longitudinal corpus should show inclusion pressure without observed relevant omission", async () => {
    // Given
    const reports = new Map<string, Awaited<ReturnType<typeof runLongitudinalScenario>>>();

    // When
    for (const filename of SCENARIOS) {
        const scenario = await loadLongitudinalScenario(join(ROOT, "test-fixtures", "longitudinal", filename));
        const directory = await tempDir();
        const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
            const externalThreadId =
                invocation.thread.mode === "fresh"
                    ? `thread-${invocation.scenarioId}-${invocation.episodeId}`
                    : invocation.thread.externalThreadId;
            return harnessOutput(invocation.cognitionBackend, {
                contract_version: 1,
                reply: "deterministic context-harm evaluation",
                used_meaning_ids: invocation.request.projection.selection.meaning_ids,
                operational: { external_thread_id: externalThreadId },
            });
        });
        assert.equal(report.ember_assertions_passed, true);
        reports.set(filename, report);
    }

    // Then
    for (const report of reports.values()) {
        for (const episode of report.episodes) {
            const harm = evaluateContextHarm(episode.context_evaluation);
            assert.equal(harm.omission.judgment, "none_observed", `${report.scenario_id}/${episode.episode_id}`);
            assert.equal(harm.inclusion.judgment, "potential", `${report.scenario_id}/${episode.episode_id}`);
            assert.equal(harm.selection_pressure, "reduce", `${report.scenario_id}/${episode.episode_id}`);
            assert.equal(
                harm.inclusion.findings.some((item) => item.kind === "forbidden_inclusion"),
                false,
            );
        }
    }

    const memoryChanged = episode(reports, "memory-context-pressure.json", "changed-and-degraded");
    const memoryHarm = evaluateContextHarm(memoryChanged.context_evaluation);
    assert.equal(
        memoryHarm.inclusion.findings.some((item) => item.kind === "purposeful_historical_inclusion"),
        true,
    );
    assert.equal(
        memoryHarm.inclusion.findings.some((item) => item.kind === "truthful_degraded_inclusion"),
        true,
    );
    assert.equal(
        memoryHarm.inclusion.findings.find((item) => item.kind === "irrelevant_inclusion")?.meanings.length,
        64,
    );

    const currentnessHistory = episode(reports, "currentness-pressure.json", "explicit-history-reconstruction");
    const currentnessHarm = evaluateContextHarm(currentnessHistory.context_evaluation);
    assert.deepEqual(
        currentnessHarm.inclusion.findings.find((item) => item.kind === "purposeful_historical_inclusion")?.meanings,
        ["preference_old", "fact_old"],
    );

    const provenanceHistory = episode(reports, "provenance-pressure.json", "historical-provenance-reconstruction");
    const provenanceHarm = evaluateContextHarm(provenanceHistory.context_evaluation);
    assert.deepEqual(
        provenanceHarm.inclusion.findings.find((item) => item.kind === "purposeful_historical_inclusion")?.meanings,
        ["user_report_old"],
    );

    const degradedAfterRestart = episode(reports, "degraded-context-pressure.json", "unavailable-after-restart");
    const degradedHarm = evaluateContextHarm(degradedAfterRestart.context_evaluation);
    assert.deepEqual(
        degradedHarm.inclusion.findings.find((item) => item.kind === "truthful_degraded_inclusion")?.meanings,
        ["degraded_episode"],
    );
});

function context({
    relevant = [],
    irrelevant = [],
    superseded = [],
    unavailable = [],
    forbidden = [],
    relevantNotSelected = [],
    irrelevantSelected = [],
    supersededSelected = [],
    forbiddenSelected = [],
    unavailableSelected = [],
    unavailableWithGap = [],
}: {
    relevant?: string[];
    irrelevant?: string[];
    superseded?: string[];
    unavailable?: string[];
    forbidden?: string[];
    relevantNotSelected?: string[];
    irrelevantSelected?: string[];
    supersededSelected?: string[];
    forbiddenSelected?: string[];
    unavailableSelected?: string[];
    unavailableWithGap?: string[];
}): ContextEvaluationInput {
    return {
        declared: { relevant, irrelevant, superseded, unavailable, forbidden },
        selected_meanings: [],
        omission_candidates: { relevant_not_selected: relevantNotSelected },
        inclusion_candidates: {
            irrelevant_selected: irrelevantSelected,
            superseded_selected: supersededSelected,
            forbidden_selected: forbiddenSelected,
        },
        degradation_signals: {
            unavailable_selected: unavailableSelected,
            unavailable_with_projection_gap: unavailableWithGap,
        },
    };
}

function episode(
    reports: Map<string, Awaited<ReturnType<typeof runLongitudinalScenario>>>,
    filename: string,
    episodeId: string,
) {
    const report = reports.get(filename);
    assert.ok(report, `missing report for ${filename}`);
    const value = report.episodes.find((item) => item.episode_id === episodeId);
    assert.ok(value, `missing episode ${episodeId}`);
    return value;
}

function harnessOutput(backend: string, result: ProviderResult) {
    return {
        result,
        backend_metadata: {
            backend,
            adapter: "context-harm-test-provider",
            version: "1",
            configuration: {
                deterministic: true,
            },
        },
    };
}
