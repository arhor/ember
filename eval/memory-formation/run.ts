#!/usr/bin/env node

import { claudeCode } from "ai-sdk-provider-claude-code";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { createAiSdkMemoryProposalGenerator } from "../../src/memory/memory-proposal-generation.ts";
import { loadMemoryFormationScenario, runMemoryFormationScenario } from "./harness.ts";

const options = parseArguments(process.argv.slice(2));
if (options.generator === "claude-code" && process.env.EMBER_RUN_LIVE_MEMORY_FORMATION !== "1")
    throw new Error("live execution is opt-in; set EMBER_RUN_LIVE_MEMORY_FORMATION=1");

const directory = await mkdtemp(join(tmpdir(), "ember-memory-formation-eval-"));
try {
    const scenario = await loadMemoryFormationScenario(options.scenario);
    const liveGenerator =
        options.generator === "claude-code" ? createLiveGenerator(directory, options.timeoutSeconds) : undefined;
    const report = await runMemoryFormationScenario(
        scenario,
        join(directory, "ember.json"),
        liveGenerator ? async ({ request }) => liveGenerator(request) : undefined,
    );
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.report) await writeFile(options.report, output, { encoding: "utf8", mode: 0o600, flag: "wx" });
    else process.stdout.write(output);
    if (!report.ember_assertions_passed) process.exitCode = 1;
} finally {
    await rm(directory, { recursive: true, force: true });
}

function createLiveGenerator(directory: string, timeoutSeconds: number) {
    const model = claudeCode("sonnet", {
        cwd: directory,
        maxTurns: 1,
        permissionPrompts: "none",
        tools: [],
        allowedTools: [],
        mcpServers: {},
        strictMcpConfig: true,
        settingSources: [],
        skills: [],
        plugins: [],
        agents: {},
        persistSession: false,
        streamingInput: "off",
        logger: false,
    });
    return createAiSdkMemoryProposalGenerator(model, { timeoutSeconds });
}

function parseArguments(args: string[]) {
    let scenario = resolve("eval/memory-formation/fixtures/autonomous-memory.json");
    let generator: "scripted" | "claude-code" = "scripted";
    let report: string | undefined;
    let timeoutSeconds = 120;
    for (let index = 0; index < args.length; index += 1) {
        const name = args[index];
        const value = args[index + 1];
        if (name === "--scenario" && value) {
            scenario = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (name === "--generator" && (value === "scripted" || value === "claude-code")) {
            generator = value;
            index += 1;
        } else if (name === "--report" && value) {
            report = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (name === "--timeout-seconds" && value && Number(value) > 0) {
            timeoutSeconds = Number(value);
            index += 1;
        } else
            throw new Error(
                "usage: eval/memory-formation/run.ts [--generator scripted|claude-code] [--scenario PATH] [--report NEW_PATH] [--timeout-seconds N]",
            );
    }
    return { scenario, generator, report, timeoutSeconds };
}
