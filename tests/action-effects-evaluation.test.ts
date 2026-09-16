import assert from "node:assert/strict";
import { readFile, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

import {
    loadActionEffectsScenario,
    runActionEffectsScenario,
    validateActionEffectsScenario,
} from "../eval/action-effects/harness.ts";
import { tempDir } from "./support.ts";

const SCENARIO = resolve("eval/action-effects/fixtures/authority-approval-effects.json");

test("action-effects evaluation should report durable authority and effect behavior for every required scenario", async (t) => {
    // Given
    const scenario = await loadActionEffectsScenario(SCENARIO);
    const directory = await tempDir();
    t.after(() => rm(directory, { recursive: true, force: true }));

    // When
    const report = await runActionEffectsScenario(scenario, directory);

    // Then
    assert.equal(report.passed, true);
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.integration_observations_passed, true);
    assert.equal(report.scorecard_input, true);
    assert.ok(Object.values(report.metrics).every((metric) => metric.errors === 0));
    assert.equal(report.cases.find((item) => item.id === "cross-surface-restart")?.restart_outcome, "continued");
    assert.equal(report.cases.find((item) => item.id === "uncertain-effect")?.proposal_status, "outcome_unknown");
    assert.equal(report.cases.find((item) => item.id === "duplicate-effect")?.external_submission_count, 1);
    assert.doesNotMatch(JSON.stringify(report), /calendar-redacted|secret|external-event-redacted/);
});

test("action-effects scenario should reject a missing required case", async () => {
    // Given
    const scenario = await loadActionEffectsScenario(SCENARIO);
    scenario.cases = scenario.cases.filter((item) => item !== "uncertain-effect");

    // When
    const validation = () => validateActionEffectsScenario(scenario);

    // Then
    assert.throws(validation, /case contract/);
});

test("action-effects scenario should reject unsupported fields and duplicate cases when fixture input is invalid", async () => {
    // Given
    const scenario = await loadActionEffectsScenario(SCENARIO);
    const invalid = [
        { ...scenario, unsupported: true },
        { ...scenario, id: "" },
        { ...scenario, cases: [...scenario.cases.slice(0, -1), scenario.cases[0]!] },
    ];

    // When
    const validations = invalid.map((value) => () => validateActionEffectsScenario(value));

    // Then
    for (const validate of validations) assert.throws(validate, /missing|case contract/);
});

test("action-effects runner should write a protected scorecard-ready report when requested", async (t) => {
    // Given
    const directory = await tempDir();
    t.after(() => rm(directory, { recursive: true, force: true }));
    const reportPath = join(directory, "report.json");
    const { spawn } = await import("node:child_process");

    // When
    const code = await new Promise<number | null>((resolveExit, reject) => {
        const child = spawn(process.execPath, ["eval/action-effects/run.ts", "--report", reportPath], {
            cwd: resolve("."),
            stdio: "ignore",
        });
        child.once("error", reject);
        child.once("exit", resolveExit);
    });
    const report = JSON.parse(await readFile(reportPath, "utf8"));

    // Then
    assert.equal(code, 0);
    assert.deepEqual(
        [
            report.report_version,
            report.suite_id,
            report.execution_mode,
            report.sanitized,
            report.scorecard_input,
            report.passed,
        ],
        [1, "issue-234-authority-approval-effects", "deterministic", true, true, true],
    );
    assert.equal((await stat(reportPath)).mode & 0o777, 0o600);
});
