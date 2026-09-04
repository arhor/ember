#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import type {
    EvaluationBackend,
    SelectivityAttentionControl,
} from "../../src/agency/endogenous-selectivity-evaluation.ts";

import { createCodexOpportunityEvaluator } from "../../src/agency/codex-opportunity-evaluator.ts";
import {
    parseSelectivityWorkload,
    runEndogenousSelectivityEvaluation,
    scriptedSelectivityEvaluator,
} from "../../src/agency/endogenous-selectivity-evaluation.ts";

const cli = parseArguments(process.argv.slice(2));
const raw = await readFile(new URL("./fixtures/selectivity-workload.json", import.meta.url), "utf8");
const workload = parseSelectivityWorkload(JSON.parse(raw));

let evaluator = scriptedSelectivityEvaluator;
let backend: EvaluationBackend = {
    label: "scripted-structural-control",
    external_model: false,
    runtime_version: null,
    model_version: null,
};

if (cli.provider === "codex") {
    if (process.env.EMBER_RUN_LIVE_ENDOGENOUS_EVAL !== "1") {
        process.stderr.write(
            "Set EMBER_RUN_LIVE_ENDOGENOUS_EVAL=1 to run the subscription-backed Codex selectivity evaluation.\n",
        );
        process.exit(2);
    }
    const command = process.env.EMBER_CODEX_COMMAND ?? "codex";
    const version = runtimeVersion(command);
    evaluator = createCodexOpportunityEvaluator({ command, timeoutSeconds: 120 });
    backend = {
        label: "codex exec",
        external_model: true,
        runtime_version: version,
        model_version: process.env.EMBER_CODEX_MODEL_LABEL ?? null,
    };
}

const result = await runEndogenousSelectivityEvaluation(workload, evaluator, backend, {
    attentionControl: cli.attentionControl,
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (cli.provider === "codex" && result.counts.evaluator_failures > 0) {
    process.stderr.write(
        `Live selectivity evaluation recorded ${result.counts.evaluator_failures} evaluator failures.\n`,
    );
    process.exitCode = 1;
}

function parseArguments(args: string[]): {
    provider: "scripted" | "codex";
    attentionControl: SelectivityAttentionControl;
} {
    let provider = "scripted";
    let attentionControl = "repeated_projection";
    for (let index = 0; index < args.length; index++) {
        const argument = args[index];
        if (argument === "--provider") provider = args[++index] ?? "";
        else if (argument.startsWith("--provider=")) provider = argument.slice("--provider=".length);
        else if (argument === "--attention-control") attentionControl = args[++index] ?? "";
        else if (argument.startsWith("--attention-control="))
            attentionControl = argument.slice("--attention-control=".length);
        else throw new Error(`Unknown argument: ${argument}`);
    }
    if (provider !== "scripted" && provider !== "codex") throw new Error(`Unsupported provider: ${provider}`);
    if (attentionControl !== "repeated_projection" && attentionControl !== "disabled") {
        throw new Error(`Unsupported attention control: ${attentionControl}`);
    }
    return { provider, attentionControl };
}

function runtimeVersion(command: string): string {
    const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10_000 });
    if (result.error) {
        const error = result.error as NodeJS.ErrnoException;
        return `version-unavailable:${error.code ?? error.name}`;
    }
    if (result.status !== 0) return `version-command-exit-${result.status ?? "unknown"}`;
    return result.stdout.trim() || result.stderr.trim() || "version-unreported";
}
