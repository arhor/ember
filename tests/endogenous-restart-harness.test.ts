import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runEndogenousRestartScenario, type EndogenousRestartScenario } from "../eval/endogenous-restart/harness.ts";

test("endogenous restart harness should preserve concern lifecycle and truthful gaps across complete process restart", async () => {
  // Given
  const directory = await mkdtemp(join(tmpdir(), "ember-endogenous-restart-test-"));
  const scenarios = JSON.parse(await readFile(resolve("test-fixtures/endogenous/restart-scenarios.json"), "utf8")) as EndogenousRestartScenario[];

  // When
  const reports = [];
  try {
    for (const scenario of scenarios) reports.push(await runEndogenousRestartScenario(scenario, {
      statePath: join(directory, `${scenario.id}.json`),
      workerPath: resolve("test-fixtures/providers/endogenous-restart-worker.ts"),
      cwd: resolve("."),
      executionMode: "fixture",
    }));
  } finally { await rm(directory, { recursive: true, force: true }); }

  // Then
  assert.equal(reports.length, 4);
  assert.ok(reports.every(report => report.passed), JSON.stringify(reports, null, 2));
  assert.ok(reports.every(report => report.sanitized));
});
