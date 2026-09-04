import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { ProviderResult } from "../src/providers/contract.ts";

import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import { buildCodexArguments } from "../src/providers/codex.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "eval", "longitudinal", "fixtures", "restart-thread-continuity.json");
const REPLACEMENT_SCENARIO = join(ROOT, "eval", "longitudinal", "fixtures", "backend-replacement-control.json");
const CROSS_PROVIDER_SCENARIO = join(
    ROOT,
    "eval",
    "longitudinal",
    "fixtures",
    "backend-replacement-cross-provider.json",
);

test("backend replacement scenario should preserve continuity when Cursor replaces Codex", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(CROSS_PROVIDER_SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const meanings = invocation.request.projection.meanings.map((item) => item.content);
        const externalThreadId = `${invocation.cognitionBackend}-${invocation.episodeId}`;

        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply: meanings.join(" | "),
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
            operational: { external_thread_id: externalThreadId },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.deepEqual(
        report.episodes.map((item) => item.backend_metadata.backend),
        ["codex", "cursor"],
    );
    assert.equal(
        report.episodes[1].ember_assertions.find((item) => item.assertion === "replacement uses a different backend")
            ?.passed,
        true,
    );
});

test("backend replacement control should preserve fixed continuity checks when cognition loci are fresh", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(REPLACEMENT_SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const meanings = invocation.request.projection.meanings.map((item) => item.content);
        const externalThreadId = `fresh-${invocation.episodeId}`;

        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply: meanings.join(" | "),
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
            operational: { external_thread_id: externalThreadId },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.episodes[0].backend_metadata.backend, "codex");
    assert.deepEqual(report.episodes[0].backend_metadata.configuration, { deterministic: true });
    assert.notEqual(report.episodes[0].provider_thread_id, report.episodes[1].provider_thread_id);
    assert.equal(
        report.episodes[1].ember_assertions.some((item) => item.assertion === "replacement continuity vector"),
        false,
    );
    assert.equal(
        report.episodes[1].ember_assertions.find(
            (item) => item.assertion === "replacement preserves lineage and durable meaning",
        )?.passed,
        true,
    );
    assert.equal(
        report.episodes[1].ember_assertions.find(
            (item) => item.assertion === "replacement receives the same selected meanings",
        )?.passed,
        true,
    );
    assert.equal(
        report.episodes[1].ember_assertions.find(
            (item) => item.assertion === "fresh-thread control uses the same backend",
        )?.passed,
        true,
    );
});

test("harness should reject backend metadata when it contradicts scenario routing", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(REPLACEMENT_SCENARIO);

    // When
    const run = runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        return harnessOutput("cursor", {
            contract_version: 1,
            reply: "wrong backend",
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
        });
    });

    // Then
    await assert.rejects(run, /backend metadata must identify selected backend: codex/);
});

test("longitudinal harness should separate Ember projection assertions from model observations", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const meanings = invocation.request.projection.meanings.map((item) => item.content);
        const gaps = invocation.request.projection.gaps.map((item) => item.gap_kind);
        const externalThreadId =
            invocation.thread.mode === "fresh" ? `thread-${invocation.episodeId}` : invocation.thread.externalThreadId;

        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply: [...meanings, ...gaps].join(" | "),
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
            operational: { external_thread_id: externalThreadId },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.episodes.length, 3);
    assert.notEqual(report.episodes[0].runtime_id, report.episodes[1].runtime_id);
    assert.notEqual(report.episodes[1].runtime_id, report.episodes[2].runtime_id);
    assert.notEqual(report.episodes[1].provider_thread_id, report.episodes[0].provider_thread_id);
    assert.equal(report.episodes[2].provider_thread_id, report.episodes[0].provider_thread_id);
    assert.equal(report.episodes[2].external_thread.mode, "reuse");
    assert.equal(
        report.episodes[2].projection.meanings.some((item) => item.content === "Prefer terse continuity reports"),
        false,
    );
    assert.equal(
        report.episodes[2].canonical_before.historical_meanings.some(
            (item) => item.content === "Prefer terse continuity reports",
        ),
        true,
    );
    assert.equal(report.episodes[1].projection.gaps[0].gap_kind, "unavailable_detail");
    assert.equal(JSON.stringify(report.episodes[1].projection).includes("SECRET_NICKNAME_54"), false);
    assert.equal(
        report.episodes.every((item) => item.ember_assertions.every((assertion) => assertion.passed)),
        true,
    );
    assert.equal(
        report.episodes.every((item) => item.model_observations.every((assertion) => assertion.passed)),
        true,
    );
});

test("Codex harness thread selection should keep production ephemeral default distinct from explicit persistence and resume", () => {
    // Given
    const cwd = "/isolated/cwd";
    const schema = "/isolated/cwd/schema.json";

    // When
    const ephemeral = buildCodexArguments([], cwd, schema, { mode: "ephemeral" });
    const persistent = buildCodexArguments([], cwd, schema, { mode: "fresh_persistent" });
    const resumed = buildCodexArguments([], cwd, schema, { mode: "resume", externalThreadId: "thread-54" });

    // Then
    assert.equal(ephemeral.includes("--ephemeral"), true);
    assert.equal(persistent.includes("--ephemeral"), false);
    assert.deepEqual(persistent.slice(-3), ["-C", cwd, "-"]);
    assert.deepEqual(resumed.slice(0, 3), ["exec", "resume", "--ignore-user-config"]);
    assert.deepEqual(resumed.slice(-2), ["thread-54", "-"]);
    assert.equal(resumed.includes("-C"), false);
    assert.equal(resumed.includes('sandbox_mode="read-only"'), true);
});

test("longitudinal harness should preserve passing Ember evidence when empirical reply observations fail", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const externalThreadId =
            invocation.thread.mode === "fresh" ? `thread-${invocation.episodeId}` : invocation.thread.externalThreadId;

        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply: "MODEL_DID_NOT_FOLLOW_THE_PROJECTED_MEANINGS",
            used_meaning_ids: [],
            operational: { external_thread_id: externalThreadId },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, false);
    assert.equal(
        report.episodes.every((episode) => episode.ember_assertions.every((item) => item.passed)),
        true,
    );
    assert.equal(
        report.episodes.some((episode) => episode.model_observations.some((item) => !item.passed)),
        true,
    );
});

test("longitudinal harness should fail Ember freshness assertions when two fresh episodes return the same thread", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const meanings = invocation.request.projection.meanings.map((item) => item.content);
        const gaps = invocation.request.projection.gaps.map((item) => item.gap_kind);
        const externalThreadId =
            invocation.thread.mode === "reuse" ? invocation.thread.externalThreadId : "duplicate-fresh-thread";

        return harnessOutput(invocation.cognitionBackend, {
            contract_version: 1,
            reply: [...meanings, ...gaps].join(" | "),
            used_meaning_ids: invocation.request.projection.selection.meaning_ids,
            operational: { external_thread_id: externalThreadId },
        });
    });

    // Then
    assert.equal(report.ember_assertions_passed, false);
    assert.equal(
        report.episodes[0].ember_assertions.find((item) => item.assertion === "fresh provider thread is new")?.passed,
        true,
    );
    assert.equal(
        report.episodes[1].ember_assertions.find((item) => item.assertion === "fresh provider thread is new")?.passed,
        false,
    );
});

test("longitudinal harness should fail Ember freshness assertions when a fresh episode omits its thread", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async (invocation) => {
        const meanings = invocation.request.projection.meanings.map((item) => item.content);
        const gaps = invocation.request.projection.gaps.map((item) => item.gap_kind);
        const externalThreadId =
            invocation.thread.mode === "reuse" ? invocation.thread.externalThreadId : "baseline-thread";
        const result =
            invocation.episodeId === "fresh-after-restart"
                ? {
                      contract_version: 1 as const,
                      reply: [...meanings, ...gaps].join(" | "),
                      used_meaning_ids: invocation.request.projection.selection.meaning_ids,
                  }
                : {
                      contract_version: 1 as const,
                      reply: [...meanings, ...gaps].join(" | "),
                      used_meaning_ids: invocation.request.projection.selection.meaning_ids,
                      operational: { external_thread_id: externalThreadId },
                  };

        return harnessOutput(invocation.cognitionBackend, result);
    });

    // Then
    assert.equal(report.ember_assertions_passed, false);
    assert.equal(report.episodes[1].provider_thread_id, null);
    assert.equal(
        report.episodes[1].ember_assertions.find((item) => item.assertion === "fresh provider thread observed")?.passed,
        false,
    );
    assert.equal(
        report.episodes[1].ember_assertions.find((item) => item.assertion === "fresh provider thread is new")?.passed,
        false,
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
