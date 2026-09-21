#!/usr/bin/env node

import { generateText } from "ai";
import { claudeCode } from "ai-sdk-provider-claude-code";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { loadProactiveContactScenario, runProactiveContactScenario } from "./harness.ts";

const options = parse(process.argv.slice(2));
if (options.mode === "live" && process.env.EMBER_RUN_LIVE_PROACTIVE_CONTACT !== "1")
    throw new Error("live execution is opt-in; set EMBER_RUN_LIVE_PROACTIVE_CONTACT=1");
const directory = await mkdtemp(join(tmpdir(), "ember-proactive-contact-eval-"));
try {
    const scenario = await loadProactiveContactScenario(options.scenario);
    const model =
        options.mode === "live"
            ? claudeCode("sonnet", {
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
              })
            : null;
    const report = await runProactiveContactScenario(
        scenario,
        directory,
        model
            ? async ({ concern }) => {
                  const result = await generateText({
                      model,
                      prompt: `Decide whether a personal agent should proactively contact its user about this concern now. Reply with exactly CONTACT or SILENT. Concern: ${concern}`,
                      temperature: 0,
                  });
                  const answer = result.text.trim().toUpperCase();
                  if (answer === "CONTACT") return "contact";
                  if (answer === "SILENT") return "silent";
                  throw new Error("live provider returned an invalid proactive-contact decision");
              }
            : undefined,
    );
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.report) await writeFile(options.report, output, { mode: 0o600, flag: "wx" });
    else process.stdout.write(output);
    if (!report.ember_assertions_passed) process.exitCode = 1;
    else if (!report.model_observations_passed) process.exitCode = 2;
} finally {
    await rm(directory, { recursive: true, force: true });
}

function parse(args: string[]) {
    let scenario = resolve("eval/proactive-contact/fixtures/proactive-contact.json");
    let report: string | undefined;
    let mode: "deterministic" | "live" = "deterministic";
    for (let index = 0; index < args.length; index++) {
        const name = args[index],
            value = args[index + 1];
        if ((name === "--scenario" || name === "--report") && value) {
            const path = isAbsolute(value) ? value : resolve(value);
            if (name === "--scenario") scenario = path;
            else report = path;
            index++;
        } else if (name === "--mode" && (value === "deterministic" || value === "live")) {
            mode = value;
            index++;
        } else
            throw new Error(
                "usage: eval/proactive-contact/run.ts [--mode deterministic|live] [--scenario PATH] [--report NEW_PATH]",
            );
    }
    return { scenario, report, mode };
}
