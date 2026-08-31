#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { invokeCodexProvider } from "../src/ember/codex-provider.ts";
import { loadLongitudinalScenario, runLongitudinalScenario, type HarnessProvider } from "../src/ember/longitudinal-harness.ts";

const options = parseArguments(process.argv.slice(2));
if (options.provider === "codex" && process.env.EMBER_RUN_LIVE_LONGITUDINAL !== "1") {
  throw new Error("live execution is opt-in; set EMBER_RUN_LIVE_LONGITUDINAL=1");
}
const directory = await mkdtemp(join(tmpdir(), "ember-longitudinal-"));
try {
  const scenario = await loadLongitudinalScenario(options.scenario);
  const provider: HarnessProvider = options.provider === "codex"
    ? invocation => invokeCodexProvider("codex", options.codexArguments, invocation.request, {
        timeoutSeconds: options.timeoutSeconds,
        thread: invocation.thread.mode === "fresh"
          ? { mode: "fresh_persistent" }
          : { mode: "resume", externalThreadId: invocation.thread.externalThreadId },
      })
    : async invocation => {
        const externalThreadId = invocation.thread.mode === "fresh" ? `scripted-${invocation.episodeId}` : invocation.thread.externalThreadId;
        return {
          contract_version: 1,
          reply: [...invocation.request.projection.meanings.map(item => item.content), ...invocation.request.projection.gaps.map(item => item.gap_kind)].join(" | "),
          used_meaning_ids: invocation.request.projection.selection.meaning_ids,
          operational: { external_thread_id: externalThreadId },
        };
      };
  const report = await runLongitudinalScenario(scenario, join(directory, "ember.json"), provider);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (options.report) await writeFile(options.report, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
  else process.stdout.write(serialized);
  if (!report.ember_assertions_passed) process.exitCode = 1;
  else if (!report.model_observations_passed) process.exitCode = 2;
} finally {
  await rm(directory, { recursive: true, force: true });
}

function parseArguments(arguments_: string[]) {
  let scenario = resolve("test-fixtures/longitudinal/restart-thread-continuity.json");
  let provider: "scripted" | "codex" = "scripted";
  let report: string | undefined;
  let timeoutSeconds = 180;
  const codexArguments: string[] = [];
  for (let index = 0; index < arguments_.length; index += 1) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (name === "--scenario" && value) { scenario = isAbsolute(value) ? value : resolve(value); index += 1; }
    else if (name === "--provider" && (value === "scripted" || value === "codex")) { provider = value; index += 1; }
    else if (name === "--report" && value) { report = isAbsolute(value) ? value : resolve(value); index += 1; }
    else if (name === "--timeout-seconds" && value && Number.isFinite(Number(value)) && Number(value) > 0) { timeoutSeconds = Number(value); index += 1; }
    else if (name === "--codex-arg" && value) { codexArguments.push(value); index += 1; }
    else throw new Error("usage: run-longitudinal-scenario.ts [--scenario PATH] [--provider scripted|codex] [--report NEW_PATH] [--timeout-seconds N] [--codex-arg VALUE]");
  }
  return { scenario, provider, report, timeoutSeconds, codexArguments };
}
