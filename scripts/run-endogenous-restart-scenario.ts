#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { runEndogenousRestartScenario, type EndogenousRestartScenario } from "../eval/endogenous-restart/harness.ts";

if (process.env.EMBER_RUN_LIVE_ENDOGENOUS_RESTART !== "1") {
    throw new Error("live endogenous-restart execution is opt-in; set EMBER_RUN_LIVE_ENDOGENOUS_RESTART=1");
}

const options = parseArguments(process.argv.slice(2));
const scenarios = JSON.parse(await readFile(options.scenarioPath, "utf8")) as EndogenousRestartScenario[];
const scenario = scenarios.find((item) => item.id === options.scenarioId);
if (!scenario) throw new Error(`unknown endogenous restart scenario: ${options.scenarioId}`);
const directory = await mkdtemp(join(tmpdir(), "ember-endogenous-restart-live-"));
try {
    const report = await runEndogenousRestartScenario(scenario, {
        statePath: join(directory, "ember.json"),
        workerPath: resolve("test-fixtures/providers/endogenous-restart-worker.ts"),
        cwd: resolve("."),
        executionMode: "live",
        codexCommand: options.codexCommand,
        timeoutSeconds: options.timeoutSeconds,
    });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (options.report) await writeFile(options.report, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    else process.stdout.write(serialized);
    if (!report.passed) process.exitCode = 1;
} finally {
    await rm(directory, { recursive: true, force: true });
}

function parseArguments(args: string[]) {
    let scenarioPath = resolve("test-fixtures/endogenous/restart-scenarios.json");
    let scenarioId = "live-concern-reactivates";
    let codexCommand = "codex";
    let timeoutSeconds = 120;
    let report: string | undefined;
    for (let index = 0; index < args.length; index += 1) {
        const name = args[index];
        const value = args[index + 1];
        if (name === "--scenario" && value) {
            scenarioPath = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (name === "--scenario-id" && value) {
            scenarioId = value;
            index += 1;
        } else if (name === "--codex-command" && value) {
            codexCommand = value;
            index += 1;
        } else if (name === "--timeout-seconds" && value && Number(value) > 0) {
            timeoutSeconds = Number(value);
            index += 1;
        } else if (name === "--report" && value) {
            report = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else
            throw new Error(
                "usage: run-endogenous-restart-scenario.ts [--scenario PATH] [--scenario-id ID] [--codex-command PATH] [--timeout-seconds N] [--report NEW_PATH]",
            );
    }
    return { scenarioPath, scenarioId, codexCommand, timeoutSeconds, report };
}
