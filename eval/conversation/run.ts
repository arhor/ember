#!/usr/bin/env node

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import type { ConversationProvider } from "./harness.ts";

import { invokeCodexProvider } from "../../src/providers/codex.ts";
import { loadConversationScenario, runConversationScenario } from "./harness.ts";

const options = parseArguments(process.argv.slice(2));
if (options.provider === "codex" && process.env.EMBER_RUN_LIVE_CONVERSATION !== "1")
    throw new Error("live execution is opt-in; set EMBER_RUN_LIVE_CONVERSATION=1");

const directory = await mkdtemp(join(tmpdir(), "ember-conversation-eval-"));
try {
    const scenario = await loadConversationScenario(options.scenario);
    const provider: ConversationProvider =
        options.provider === "scripted"
            ? async ({ episode, request }) => ({
                  contractVersion: 1,
                  reply: episode.scripted_reply ?? "No scripted reply required.",
                  usedMeaningIds: request.projection.selection.meaning_ids,
                  operational: { externalThreadId: `fresh-${episode.id}` },
              })
            : async ({ request }) =>
                  invokeCodexProvider("codex", options.codexArguments, request, {
                      timeoutSeconds: options.timeoutSeconds,
                      thread: { mode: "fresh_persistent" },
                  });
    const report = await runConversationScenario(scenario, join(directory, "ember.json"), provider, {
        invocation_mode: "fresh",
        external_thread_identity: options.provider === "codex" ? "required" : "optional",
    });
    const output = `${JSON.stringify(report, null, 2)}\n`;
    if (options.report) await writeFile(options.report, output, { encoding: "utf8", mode: 0o600, flag: "wx" });
    else process.stdout.write(output);
    if (!report.ember_assertions_passed) process.exitCode = 1;
    else if (!report.provider_observations_passed || !report.model_observations_passed) process.exitCode = 2;
} finally {
    await rm(directory, { recursive: true, force: true });
}

function parseArguments(args: string[]) {
    let scenario = resolve("eval/conversation/fixtures/conversational-coherence.json");
    let provider: "scripted" | "codex" = "scripted";
    let report: string | undefined;
    let timeoutSeconds = 180;
    const codexArguments: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
        const name = args[index];
        const value = args[index + 1];
        if (name === "--scenario" && value) {
            scenario = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (name === "--provider" && (value === "scripted" || value === "codex")) {
            provider = value;
            index += 1;
        } else if (name === "--report" && value) {
            report = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (name === "--timeout-seconds" && value && Number(value) > 0) {
            timeoutSeconds = Number(value);
            index += 1;
        } else if (name === "--codex-arg" && value) {
            codexArguments.push(value);
            index += 1;
        } else
            throw new Error(
                "usage: eval/conversation/run.ts [--provider scripted|codex] [--scenario PATH] [--report NEW_PATH] [--timeout-seconds N] [--codex-arg VALUE]",
            );
    }
    return { scenario, provider, report, timeoutSeconds, codexArguments };
}
