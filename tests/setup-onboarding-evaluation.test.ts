import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
    loadSetupOnboardingScenario,
    runSetupOnboardingScenario,
    validateSetupOnboardingScenario,
} from "../eval/setup-onboarding/harness.ts";

const freshPath = resolve("eval/setup-onboarding/fixtures/fresh-create.json");
const restorePath = resolve("eval/setup-onboarding/fixtures/restore-existing.json");

test("setup/onboarding deterministic fixtures pass with attributable records", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "ember-setup-eval-test-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    for (const [index, path] of [freshPath, restorePath].entries()) {
        const report = await runSetupOnboardingScenario(
            await loadSetupOnboardingScenario(path),
            join(root, String(index)),
        );
        assert.equal(report.passed, true);
        assert.ok(report.assertions.length > 0);
        assert.ok(report.assertions.every((item) => item.assertion && item.expected && item.observed && item.passed));
        assert.doesNotMatch(JSON.stringify(report), /SecretSentinel|\/ember-setup-eval-test-/);
    }
});

test("setup/onboarding fixtures reject unsupported fields, invalid flows, and duplicate IDs", async () => {
    const base = await loadSetupOnboardingScenario(freshPath);
    for (const invalid of [
        { ...base, unsupported: true },
        { ...base, flow: "copy-installation" },
        { ...base, episodes: [] },
        { ...base, episodes: base.episodes.slice(0, 1) },
        { ...base, assertions: base.assertions.slice(0, 1) },
        { ...base, episodes: [...base.episodes, base.episodes[0]] },
        { ...base, assertions: [...base.assertions, base.assertions[0]] },
    ])
        assert.throws(() => validateSetupOnboardingScenario(invalid), /invalid|unsupported|duplicated|contract/);
    await assert.rejects(loadSetupOnboardingScenario("relative.json"), /absolute/);
});

test("fresh flow resolves episodes by identity rather than fixture order", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "ember-setup-reordered-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const scenario = await loadSetupOnboardingScenario(freshPath);
    scenario.episodes = [scenario.episodes[1]!, scenario.episodes[2]!, scenario.episodes[0]!];
    validateSetupOnboardingScenario(scenario);
    const report = await runSetupOnboardingScenario(scenario, root);
    assert.equal(report.passed, true);
    assert.match(
        report.assertions.find((item) => item.assertion === "provider_failure_retry_preserves_candidate")!.observed,
        /state_absent=true; onboarding_absent=true/,
    );
});

for (const [flow, fault, assertion] of [
    ["fresh", "lineage_replacement", "provider_replacement_preserves_continuity"],
    ["fresh", "direct_memory", "ordinary_memory_adoption"],
    ["fresh", "secret_leakage", "secret_containment"],
    ["restore", "newborn_onboarding", "no_newborn_onboarding"],
] as const) {
    test(`negative oracle names ${fault}`, async (t) => {
        const root = await mkdtemp(join(tmpdir(), "ember-setup-negative-"));
        t.after(() => rm(root, { recursive: true, force: true }));
        const scenario = await loadSetupOnboardingScenario(flow === "fresh" ? freshPath : restorePath);
        const report = await runSetupOnboardingScenario(scenario, root, fault);
        assert.equal(report.passed, false);
        assert.equal(report.assertions.find((item) => item.assertion === assertion)?.passed, false);
        if (fault === "direct_memory") {
            assert.equal(report.ember_assertions_passed, false);
            assert.equal(report.host_assertions_passed, true);
        }
        if (fault === "secret_leakage") {
            assert.equal(report.ember_assertions_passed, true);
            assert.equal(report.host_assertions_passed, false);
        }
    });
}

test("runner writes a new protected scorecard-ready sanitized report", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "ember-setup-report-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const reportPath = join(root, "report.json");
    const { spawn } = await import("node:child_process");
    const result = await new Promise<number | null>((resolveExit, reject) => {
        const child = spawn(
            process.execPath,
            ["eval/setup-onboarding/run.ts", "--scenario", freshPath, "--report", reportPath],
            { stdio: "ignore" },
        );
        child.once("error", reject);
        child.once("exit", resolveExit);
    });
    assert.equal(result, 0);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.deepEqual(
        [
            report.report_version,
            report.suite_id,
            report.execution_mode,
            report.sanitized,
            report.scorecard_input,
            report.passed,
        ],
        [1, "issue-256-setup-onboarding", "deterministic", true, true, true],
    );
    assert.equal((await stat(reportPath)).mode & 0o777, 0o600);
    await writeFile(join(root, "occupied.json"), "keep");
    const occupied = join(root, "occupied.json");
    await assert.rejects(writeFile(occupied, "replace", { flag: "wx" }), /EEXIST/);
});
