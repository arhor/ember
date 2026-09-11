import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { loadMemoryFormationScenario, runMemoryFormationScenario } from "../eval/memory-formation/harness.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "eval", "memory-formation", "fixtures", "autonomous-memory.json");

test("memory formation evaluation reports selective adoption, correction, context, and provenance", async () => {
    // Given
    const scenario = await loadMemoryFormationScenario(SCENARIO);
    const directory = await tempDir();

    // When
    const report = await runMemoryFormationScenario(scenario, join(directory, "ember.json"));

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.scorecard_input, true);
    assert.equal(report.metrics.all_zero, true);
    assert.equal(report.metrics.false_adoption.count, 0);
    assert.equal(report.metrics.missed_adoption.count, 0);
    assert.equal(report.metrics.duplicate_adoption.count, 0);
    assert.equal(report.metrics.correction_supersession.errors, 0);
    assert.equal(report.metrics.correction_supersession.accuracy, 1);
    assert.equal(report.metrics.stale_memory_revival.count, 0);
    assert.equal(report.metrics.scope_provenance_violations.count, 0);
    assert.equal(report.context_persistence.adopted_source_still_projected, false);
    assert.equal(report.context_persistence.adopted_meaning_still_available, true);
    assert.ok(report.context_size.max_bytes >= report.context_size.min_bytes);
    const correction = report.episodes.find((episode) => episode.id === "explicit-correction");
    assert.equal(correction?.restart, true);
    assert.equal(correction?.provider_invocation_fresh, true);
    assert.equal(correction?.observed_decision, "adopted");
    assert.equal(correction?.provenance?.source_roles[0], "user_command");
    assert.ok(correction?.adoption_decisions.length);
});

test("memory formation evaluation detects a live generator decision mismatch independently", async () => {
    // Given
    const scenario = await loadMemoryFormationScenario(SCENARIO);
    const directory = await tempDir();

    // When
    const report = await runMemoryFormationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, scriptedResult }) => {
            if (episode.id !== "incidental-detail") return scriptedResult;
            return {
                contractVersion: 1,
                candidates: [
                    {
                        ...scenario.episodes[0]!.candidate,
                        proposal_version: 1,
                        owner: `user:${scenario.ember.principal}`,
                        scope: scenario.ember.scope,
                        source_evidence_ids: [],
                    },
                ],
            };
        },
    );

    // Then
    assert.equal(report.ember_assertions_passed, false);
    assert.equal(report.episodes.find((episode) => episode.id === "incidental-detail")?.observed_decision, "invalid");
});

test("memory formation scenario rejects duplicate episode identities", async () => {
    // Given
    const scenario = await loadMemoryFormationScenario(SCENARIO);
    scenario.episodes[1]!.id = scenario.episodes[0]!.id;

    // When / Then
    await assert.rejects(
        runMemoryFormationScenario(scenario, join(await tempDir(), "ember.json")),
        /invalid or duplicated/,
    );
});
