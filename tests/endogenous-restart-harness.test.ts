import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { EndogenousRestartScenario } from "../eval/endogenous-restart/harness.ts";

import { runEndogenousRestartScenario } from "../eval/endogenous-restart/harness.ts";

test("endogenous restart harness should preserve concern lifecycle and truthful gaps across complete process restart", async () => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-endogenous-restart-test-"));
    const scenarios = JSON.parse(
        await readFile(resolve("eval/endogenous-restart/fixtures/restart-scenarios.json"), "utf8"),
    ) as EndogenousRestartScenario[];

    // When
    const reports = [];
    try {
        for (const scenario of scenarios)
            reports.push(
                await runEndogenousRestartScenario(scenario, {
                    statePath: join(directory, `${scenario.id}.json`),
                    workerPath: resolve("tests/fixtures/providers/endogenous-restart-worker.ts"),
                    cwd: resolve("."),
                    executionMode: "fixture",
                }),
            );
    } finally {
        await rm(directory, { recursive: true, force: true });
    }

    // Then
    assert.equal(reports.length, 4);
    assert.ok(
        reports.every((report) => report.passed),
        JSON.stringify(reports, null, 2),
    );
    assert.ok(reports.every((report) => report.sanitized));
    assert.ok(
        reports.every((report) =>
            report.assertions.some(
                (item) => item.assertion === "post-restart provider thread is actually observed" && item.passed,
            ),
        ),
    );
    const superseded = reports.find((report) => report.scenario_id === "superseded-consequence-stays-quiet");
    assert.ok(superseded);
    assert.equal(
        superseded.assertions.find((item) => item.assertion === "supersession linkage survives restart")?.passed,
        true,
    );
});

test("live-shaped restart path should require an actually observed ephemeral Codex thread", async () => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-endogenous-restart-provider-test-"));
    const scenarios = JSON.parse(
        await readFile(resolve("eval/endogenous-restart/fixtures/restart-scenarios.json"), "utf8"),
    ) as EndogenousRestartScenario[];
    const scenario = scenarios.find((item) => item.id === "live-concern-reactivates");
    assert.ok(scenario);

    // When
    let report;
    try {
        report = await runEndogenousRestartScenario(scenario, {
            statePath: join(directory, "ember.json"),
            workerPath: resolve("tests/fixtures/providers/endogenous-restart-worker.ts"),
            cwd: resolve("."),
            executionMode: "live",
            codexCommand: process.execPath,
            codexArguments: [resolve("tests/fixtures/providers/endogenous-opportunity-codex.ts")],
            timeoutSeconds: 5,
        });
    } finally {
        await rm(directory, { recursive: true, force: true });
    }

    // Then
    assert.equal(report.passed, true, JSON.stringify(report, null, 2));
    const observed = report.assertions.find(
        (item) => item.assertion === "post-restart provider thread is actually observed",
    );
    assert.deepEqual([observed?.expected, observed?.observed, observed?.passed], [true, true, true]);
    const policy = report.assertions.find((item) => item.assertion === "post-restart evaluator thread policy");
    assert.deepEqual([policy?.expected, policy?.observed, policy?.passed], ["ephemeral", "ephemeral", true]);
});
