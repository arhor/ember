#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createCodexOpportunityEvaluator } from "../src/agency/codex-opportunity-evaluator.ts";
import {
  parseSelectivityWorkload,
  runEndogenousSelectivityEvaluation,
  scriptedSelectivityEvaluator,
  type EvaluationBackend,
} from "../src/agency/endogenous-selectivity-evaluation.ts";

const provider = providerArgument(process.argv.slice(2));
const raw = await readFile(new URL("../test-fixtures/endogenous/selectivity-workload.json", import.meta.url), "utf8");
const workload = parseSelectivityWorkload(JSON.parse(raw));

let evaluator = scriptedSelectivityEvaluator;
let backend: EvaluationBackend = {
  label: "scripted-structural-control",
  external_model: false,
  model_version: null,
};

if (provider === "codex") {
  if (process.env.EMBER_RUN_LIVE_ENDOGENOUS_EVAL !== "1") {
    process.stderr.write("Set EMBER_RUN_LIVE_ENDOGENOUS_EVAL=1 to run the subscription-backed Codex selectivity evaluation.\n");
    process.exit(2);
  }
  const command = process.env.EMBER_CODEX_COMMAND ?? "codex";
  const version = runtimeVersion(command);
  evaluator = createCodexOpportunityEvaluator({ command, timeoutSeconds: 120 });
  backend = {
    label: `codex exec (${version})`,
    external_model: true,
    model_version: process.env.EMBER_CODEX_MODEL_LABEL ?? null,
  };
}

const result = await runEndogenousSelectivityEvaluation(workload, evaluator, backend);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (provider === "codex" && result.counts.evaluator_failures > 0) {
  process.stderr.write(`Live selectivity evaluation recorded ${result.counts.evaluator_failures} evaluator failures.\n`);
  process.exitCode = 1;
}

function providerArgument(args: string[]): "scripted" | "codex" {
  let value = "scripted";
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--provider") value = args[++index] ?? "";
    else if (argument.startsWith("--provider=")) value = argument.slice("--provider=".length);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (value !== "scripted" && value !== "codex") throw new Error(`Unsupported provider: ${value}`);
  return value;
}

function runtimeVersion(command: string): string {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (result.error) return `version-unavailable:${result.error.code ?? result.error.name}`;
  if (result.status !== 0) return `version-command-exit-${result.status ?? "unknown"}`;
  return result.stdout.trim() || result.stderr.trim() || "version-unreported";
}
