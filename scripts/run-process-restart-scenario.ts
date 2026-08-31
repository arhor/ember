#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { loadLongitudinalScenario } from "../src/ember/longitudinal-harness.ts";
import { runProcessRestartScenario } from "../src/ember/process-restart-harness.ts";

if (process.env.EMBER_RUN_LIVE_PROCESS_RESTART !== "1") {
  throw new Error("live process-restart execution is opt-in; set EMBER_RUN_LIVE_PROCESS_RESTART=1");
}

const options = parseArguments(process.argv.slice(2));
const directory = await mkdtemp(join(tmpdir(), "ember-process-restart-"));
try {
  const scenario = await loadLongitudinalScenario(options.scenario);
  const report = await runProcessRestartScenario(scenario, {
    statePath: join(directory, "ember.json"),
    cliPath: resolve("bin/ember.ts"),
    cwd: resolve("."),
    codexCommand: "codex",
    codexArguments: options.codexArguments,
    timeoutSeconds: options.timeoutSeconds,
    executionMode: "live",
  });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.report) await writeFile(options.report, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
  else process.stdout.write(serialized);
  if (!report.ember_assertions_passed) process.exitCode = 1;
  else if (!report.model_observations_passed) process.exitCode = 2;
} finally {
  await rm(directory, { recursive: true, force: true });
}

function parseArguments(arguments_: string[]) {
  let scenario = resolve("test-fixtures/longitudinal/process-restart-fresh-codex.json");
  let report: string | undefined;
  let timeoutSeconds = 180;
  const codexArguments: string[] = [];
  for (let index = 0; index < arguments_.length; index += 1) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === "--scenario" && value) { scenario = isAbsolute(value) ? value : resolve(value); index += 1; }
    else if (name === "--report" && value) { report = isAbsolute(value) ? value : resolve(value); index += 1; }
    else if (name === "--timeout-seconds" && value && Number.isFinite(Number(value)) && Number(value) > 0) { timeoutSeconds = Number(value); index += 1; }
    else if (name === "--codex-arg" && value) { codexArguments.push(value); index += 1; }
    else throw new Error("usage: run-process-restart-scenario.ts [--scenario PATH] [--report NEW_PATH] [--timeout-seconds N] [--codex-arg VALUE]");
  }
  return { scenario, report, timeoutSeconds, codexArguments };
}
