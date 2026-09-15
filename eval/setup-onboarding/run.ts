#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { loadSetupOnboardingScenario, runSetupOnboardingScenario } from "./harness.ts";

const options = parse(process.argv.slice(2));
const paths = options.scenario
    ? [options.scenario]
    : [
          resolve("eval/setup-onboarding/fixtures/fresh-create.json"),
          resolve("eval/setup-onboarding/fixtures/restore-existing.json"),
      ];
const root = await mkdtemp(join(tmpdir(), "ember-setup-onboarding-"));
try {
    const scenarios = [];
    for (const [index, path] of paths.entries())
        scenarios.push(
            await runSetupOnboardingScenario(await loadSetupOnboardingScenario(path), join(root, String(index))),
        );
    const passed = scenarios.every((scenario) => scenario.passed);
    const report = {
        report_version: 1,
        suite_id: "issue-256-setup-onboarding",
        execution_mode: "deterministic",
        sanitized: true,
        scorecard_input: true,
        ember_assertions_passed: passed,
        host_assertions_passed: passed,
        passed,
        scenarios,
    };
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.report) await writeFile(options.report, output, { mode: 0o600, flag: "wx" });
    else process.stdout.write(output);
    if (!passed) process.exitCode = 1;
} finally {
    await rm(root, { recursive: true, force: true });
}

function parse(args: string[]) {
    let scenario: string | undefined, report: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const name = args[i],
            value = args[i + 1];
        if ((name === "--scenario" || name === "--report") && value) {
            const path = isAbsolute(value) ? value : resolve(value);
            if (name === "--scenario") scenario = path;
            else report = path;
            i++;
        } else throw new Error("usage: eval/setup-onboarding/run.ts [--scenario PATH] [--report NEW_PATH]");
    }
    return { scenario, report };
}
