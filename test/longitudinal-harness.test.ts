import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { buildCodexArguments } from "../src/ember/codex-provider.ts";
import { loadLongitudinalScenario, runLongitudinalScenario } from "../src/ember/longitudinal-harness.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "test-fixtures", "longitudinal", "restart-thread-continuity.json");

test("longitudinal harness should separate Ember projection assertions from model observations", async () => {
  // Given
  const directory = await tempDir();
  const scenario = await loadLongitudinalScenario(SCENARIO);

  // When
  const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async invocation => {
    const meanings = invocation.request.projection.meanings.map(item => item.content);
    const gaps = invocation.request.projection.gaps.map(item => item.gap_kind);
    const externalThreadId = invocation.thread.mode === "fresh"
      ? `thread-${invocation.episodeId}`
      : invocation.thread.externalThreadId;
    return {
      contract_version: 1,
      reply: [...meanings, ...gaps].join(" | "),
      used_meaning_ids: invocation.request.projection.selection.meaning_ids,
      operational: { external_thread_id: externalThreadId },
    };
  });

  // Then
  assert.equal(report.ember_assertions_passed, true);
  assert.equal(report.model_observations_passed, true);
  assert.equal(report.episodes.length, 3);
  assert.notEqual(report.episodes[0].runtime_id, report.episodes[1].runtime_id);
  assert.notEqual(report.episodes[1].runtime_id, report.episodes[2].runtime_id);
  assert.equal(report.episodes[2].provider_thread_id, report.episodes[0].provider_thread_id);
  assert.equal(report.episodes[2].external_thread.mode, "reuse");
  assert.equal(report.episodes[2].projection.meanings.some(item => item.content === "Prefer terse continuity reports"), false);
  assert.equal(report.episodes[2].canonical_before.historical_meanings.some(item => item.content === "Prefer terse continuity reports"), true);
  assert.equal(report.episodes[1].projection.gaps[0].gap_kind, "unavailable_detail");
  assert.equal(JSON.stringify(report.episodes[1].projection).includes("SECRET_NICKNAME_54"), false);
  assert.equal(report.episodes.every(item => item.ember_assertions.every(assertion => assertion.passed)), true);
  assert.equal(report.episodes.every(item => item.model_observations.every(assertion => assertion.passed)), true);
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
  const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), async invocation => ({
    contract_version: 1,
    reply: "MODEL_DID_NOT_FOLLOW_THE_PROJECTED_MEANINGS",
    used_meaning_ids: [],
    operational: {
      external_thread_id: invocation.thread.mode === "fresh" ? `thread-${invocation.episodeId}` : invocation.thread.externalThreadId,
    },
  }));

  // Then
  assert.equal(report.ember_assertions_passed, true);
  assert.equal(report.model_observations_passed, false);
  assert.equal(report.episodes.every(episode => episode.ember_assertions.every(item => item.passed)), true);
  assert.equal(report.episodes.some(episode => episode.model_observations.some(item => !item.passed)), true);
});
