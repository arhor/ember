import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { loadLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import { runProcessRestartScenario } from "../eval/process-restart/harness.ts";
import { CLI, ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "test-fixtures", "longitudinal", "process-restart-fresh-codex.json");
const CODEX_FIXTURE = join(ROOT, "test-fixtures", "providers", "codex-jsonl-fixture.ts");

test("process-restart harness should preserve Ember continuity while Codex threads stay fresh", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runProcessRestartScenario(scenario, {
        statePath: join(directory, "ember.json"),
        cliPath: CLI,
        cwd: ROOT,
        codexCommand: process.execPath,
        codexArguments: [CODEX_FIXTURE],
        timeoutSeconds: 2,
        executionMode: "fixture",
    });

    // Then
    assert.equal(report.execution_mode, "fixture");
    assert.equal(report.sanitized, true);
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.passed, true);
    assert.equal(
        report.ember_assertions.find((item) => item.assertion === "complete Ember process restarted")?.passed,
        true,
    );
    assert.equal(
        report.ember_assertions.find((item) => item.assertion === "lineage preserved across process restart")?.passed,
        true,
    );
    assert.equal(
        report.ember_assertions.find(
            (item) => item.assertion === "restart recovery records no supported cognition during downtime",
        )?.passed,
        true,
    );
    assert.equal(
        report.ember_assertions.find(
            (item) => item.assertion === "fresh provider thread changed across process restart",
        )?.passed,
        true,
    );
    assert.equal(JSON.stringify(report).includes("fixture-"), false);
    assert.equal(JSON.stringify(report).includes("meaning-"), false);
    assert.equal(JSON.stringify(report).includes("runtime-"), false);
    assert.equal(JSON.stringify(report).includes("lineage-"), false);
});

test("process-restart harness should reject accidental Codex thread reuse across processes", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runProcessRestartScenario(scenario, {
        statePath: join(directory, "ember.json"),
        cliPath: CLI,
        cwd: ROOT,
        codexCommand: process.execPath,
        codexArguments: [CODEX_FIXTURE, "--thread-id", "reused-thread-55"],
        timeoutSeconds: 2,
        executionMode: "fixture",
    });

    // Then
    assert.equal(report.ember_assertions_passed, false);
    assert.equal(
        report.ember_assertions.find(
            (item) => item.assertion === "fresh provider thread changed across process restart",
        )?.passed,
        false,
    );
    assert.equal(JSON.stringify(report).includes("reused-thread-55"), false);
});
