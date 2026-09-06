import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { HarnessProvider } from "../eval/longitudinal/harness.ts";
import type { ProjectedMeaning } from "../src/core/projection.ts";

import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import { ROOT, tempDir } from "./support.ts";

const SUPERSESSION_SCENARIO = join(ROOT, "eval", "longitudinal", "fixtures", "semantic-supersession-gap.json");
const PROVENANCE_SCENARIO = join(ROOT, "eval", "longitudinal", "fixtures", "semantic-provenance-restraint.json");

const semanticAuditProvider: HarnessProvider = async (invocation) => {
    const projection = invocation.request.projection;
    const currentPreference = projection.meanings.find(
        (item) => item.kind === "preference" && item.currentness === "current",
    );
    const historicalPreference = projection.meanings.find(
        (item) => item.kind === "preference" && item.currentness === "superseded",
    );
    const fact = projection.meanings.find((item) => item.kind === "fact");
    const commitment = projection.meanings.find((item) => item.kind === "commitment");
    const gap = projection.gaps[0];
    const externalThreadId =
        invocation.thread.mode === "fresh"
            ? `thread-${invocation.scenarioId}-${invocation.episodeId}`
            : invocation.thread.externalThreadId;
    const lines = [
        `CURRENT_PREFERENCE=${currentPreference?.content ?? "NONE"}`,
        `HISTORICAL_PREFERENCE=${historicalPreference?.content ?? "NONE"}`,
        `LIVE_COMMITMENT=${commitment?.content ?? "NONE"}`,
        `COMMITMENT_LIFECYCLE=${commitment?.prospectiveLifecycle ?? "none"}`,
        `COMMITMENT_APPLICABILITY=${commitment?.applicability ?? "none"}`,
        `NICKNAME_STATUS=${gap?.gapKind ?? "none"}`,
        `NICKNAME_VALUE=${gap ? "UNAVAILABLE" : "NONE"}`,
        `FACT_EPISTEMIC_ROLE=${fact?.epistemicRole ?? "none"}`,
        `FACT_SOURCE_ROLE=${firstSourceRole(fact)}`,
        `FACT_OWNER=${fact?.owner ?? "none"}`,
        `FACT_DIRECTLY_OBSERVED_BY_EMBER=${fact?.epistemicRole === "user_testimony" ? "no" : "unknown"}`,
        `COMMITMENT_EPISTEMIC_ROLE=${commitment?.epistemicRole ?? "none"}`,
        `COMMITMENT_SOURCE_ROLE=${firstSourceRole(commitment)}`,
        `COMMITMENT_OWNER=${commitment?.owner ?? "none"}`,
        `COMMITMENT_IS_EMBER_OWNED=${commitment?.owner === "ember" && commitment.epistemicRole === "ember_commitment" ? "yes" : "no"}`,
        `DOWNTIME_COGNITION=${projection.recoveryAccount.emberCognitionDuringInterval}`,
    ];
    return {
        result: {
            contractVersion: 1,
            reply: lines.join("\n"),
            usedMeaningIds: projection.selection.meaning_ids,
            operational: { externalThreadId: externalThreadId },
        },
        backend_metadata: {
            backend: invocation.cognitionBackend,
            adapter: "semantic-audit-fixture",
            version: "1",
            configuration: { deterministic: true },
        },
    };
};

test("issue 56 supersession scenario should preserve currentness, commitment, gap, and epistemic restraint", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SUPERSESSION_SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), semanticAuditProvider);

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.episodes.length, 3);

    const explained = report.episodes[1];
    assert.equal(
        explained.projection.meanings.some(
            (item) =>
                item.kind === "preference" &&
                item.currentness === "current" &&
                item.content === "Prefer detailed semantic reports",
        ),
        true,
    );
    assert.equal(
        explained.projection.meanings.some(
            (item) =>
                item.kind === "preference" &&
                item.currentness === "superseded" &&
                item.content === "Prefer terse semantic reports",
        ),
        true,
    );
    assert.equal(
        explained.projection.meanings.some(
            (item) =>
                item.kind === "commitment" &&
                item.prospectiveLifecycle === "live" &&
                item.applicability === "last_known_live_needs_currentness_check",
        ),
        true,
    );
    assert.equal(
        explained.projection.gaps.some((item) => item.gapKind === "unavailable_detail"),
        true,
    );
    assert.equal(JSON.stringify(explained.projection).includes("HIDDEN_NICKNAME_56"), false);

    const ordinary = report.episodes[2];
    assert.equal(
        ordinary.projection.meanings.some((item) => item.content === "Prefer terse semantic reports"),
        false,
    );
    assert.equal(
        ordinary.projection.meanings.some((item) => item.content === "Prefer detailed semantic reports"),
        true,
    );
    assert.equal(
        ordinary.projection.meanings.some((item) => item.kind === "commitment" && item.prospectiveLifecycle === "live"),
        true,
    );
});

test("issue 56 provenance scenario should keep user testimony distinct from Ember-owned commitment across restart", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(PROVENANCE_SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), semanticAuditProvider);

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.episodes.length, 2);
    assert.notEqual(report.episodes[0].runtimeId, report.episodes[1].runtimeId);
    assert.notEqual(report.episodes[0].provider_thread_id, report.episodes[1].provider_thread_id);

    for (const episode of report.episodes) {
        const fact = requireMeaning(episode.projection.meanings, "fact");
        const commitment = requireMeaning(episode.projection.meanings, "commitment");
        assert.equal(fact.epistemicRole, "user_testimony");
        assert.equal(fact.source_evidence[0]?.sourceRole, "user_command");
        assert.equal(commitment.epistemicRole, "ember_commitment");
        assert.deepEqual(
            commitment.source_evidence.map((item) => item.sourceRole),
            ["ember_adoption", "user_command"],
        );
        assert.equal(commitment.owner, "ember");
    }

    assert.equal(
        report.episodes[1].projection.meanings.some(
            (item) => item.kind === "commitment" && item.applicability === "last_known_live_needs_currentness_check",
        ),
        true,
    );
    assert.equal(
        report.episodes.every((episode) => episode.model_observations.every((item) => item.passed)),
        true,
    );
});

function firstSourceRole(meaning: ProjectedMeaning | undefined) {
    return meaning?.source_evidence[0]?.sourceRole ?? "none";
}

function requireMeaning(meanings: ProjectedMeaning[], kind: ProjectedMeaning["kind"]) {
    const meaning = meanings.find((item) => item.kind === kind);
    assert.ok(meaning, `expected projected ${kind} meaning`);
    return meaning;
}
