#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import type { HarnessProvider } from "../eval/longitudinal/harness.ts";

import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import { invokeCodexProvider } from "../src/providers/codex.ts";
import { invokeCursorProvider } from "../src/providers/cursor.ts";
import { codexArgumentEvidence } from "../src/providers/evidence.ts";

const options = parseArguments(process.argv.slice(2));
if (options.provider !== "scripted" && process.env.EMBER_RUN_LIVE_LONGITUDINAL !== "1") {
    throw new Error("live execution is opt-in; set EMBER_RUN_LIVE_LONGITUDINAL=1");
}
const directory = await mkdtemp(join(tmpdir(), "ember-longitudinal-"));
try {
    const scenario = await loadLongitudinalScenario(options.scenario);
    const codexVersion =
        options.provider === "codex" || options.provider === "codex-cursor"
            ? readVersion("codex", ["--version"])
            : null;
    const cursorVersion =
        options.provider === "cursor" || options.provider === "codex-cursor"
            ? readVersion("cursor-agent", ["--version"])
            : null;
    const codexArguments = codexArgumentEvidence(options.codexArguments);
    const provider: HarnessProvider =
        options.provider !== "scripted"
            ? async (invocation) => {
                  if (options.provider !== "codex-cursor" && invocation.cognitionBackend !== options.provider)
                      throw new Error(
                          `no configured live adapter for cognition backend: ${invocation.cognitionBackend}`,
                      );
                  if (invocation.cognitionBackend === "cursor") {
                      const session =
                          invocation.thread.mode === "fresh"
                              ? { mode: "fresh" as const }
                              : { mode: "resume" as const, externalSessionId: invocation.thread.externalThreadId };
                      const result = await invokeCursorProvider(
                          "cursor-agent",
                          options.cursorArguments,
                          invocation.request,
                          { timeoutSeconds: options.timeoutSeconds, session },
                      );
                      const configuration: Record<string, string | number | boolean | null> = {
                          session_mode: session.mode,
                          execution_mode: "ask",
                          sandbox: "enabled",
                          project_context: "isolated",
                      };
                      return {
                          result,
                          backend_metadata: {
                              backend: "cursor",
                              adapter: "cursor-agent-print",
                              version: cursorVersion!,
                              configuration,
                          },
                      };
                  }
                  if (invocation.cognitionBackend !== "codex")
                      throw new Error(
                          `no configured live adapter for cognition backend: ${invocation.cognitionBackend}`,
                      );
                  const thread =
                      invocation.thread.mode === "fresh"
                          ? { mode: "fresh_persistent" as const }
                          : { mode: "resume" as const, externalThreadId: invocation.thread.externalThreadId };
                  const result = await invokeCodexProvider("codex", options.codexArguments, invocation.request, {
                      timeoutSeconds: options.timeoutSeconds,
                      thread,
                  });
                  const configuration: Record<string, string | number | boolean | null> = {
                      thread_mode: thread.mode,
                      sandbox: "read-only",
                      project_context: "isolated",
                      user_configuration: "ignored",
                      ...codexArguments,
                  };
                  return {
                      result,
                      backend_metadata: {
                          backend: "codex",
                          adapter: "codex-exec",
                          version: codexVersion!,
                          configuration,
                      },
                  };
              }
            : async (invocation) => {
                  const externalThreadId =
                      invocation.thread.mode === "fresh"
                          ? `scripted-${invocation.episodeId}`
                          : invocation.thread.externalThreadId;
                  return {
                      result: {
                          contract_version: 1,
                          reply: [
                              ...invocation.request.projection.meanings.map((item) => item.content),
                              ...invocation.request.projection.gaps.map((item) => item.gap_kind),
                          ].join(" | "),
                          used_meaning_ids: invocation.request.projection.selection.meaning_ids,
                          operational: { external_thread_id: externalThreadId },
                      },
                      backend_metadata: {
                          backend: invocation.cognitionBackend,
                          adapter: "deterministic-scripted",
                          version: "1",
                          configuration: { mode: "fixture" },
                      },
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

function readVersion(command: string, arguments_: string[]) {
    const result = spawnSync(command, arguments_, { encoding: "utf8", shell: false });
    if (result.error) throw new Error(`cannot inspect ${command} version: ${result.error.message}`);
    if (result.status !== 0)
        throw new Error(`cannot inspect ${command} version: ${result.stderr.trim() || `exit ${result.status}`}`);
    const version = result.stdout.trim();
    if (!version) throw new Error(`${command} reported an empty version`);
    return version.slice(0, 512);
}

function parseArguments(arguments_: string[]) {
    let scenario = resolve("test-fixtures/longitudinal/restart-thread-continuity.json");
    let provider: "scripted" | "codex" | "cursor" | "codex-cursor" = "scripted";
    let report: string | undefined;
    let timeoutSeconds = 180;
    const codexArguments: string[] = [];
    const cursorArguments: string[] = [];
    for (let index = 0; index < arguments_.length; index += 1) {
        const name = arguments_[index];
        const value = arguments_[index + 1];
        if (name === "--scenario" && value) {
            scenario = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (
            name === "--provider" &&
            (value === "scripted" || value === "codex" || value === "cursor" || value === "codex-cursor")
        ) {
            provider = value;
            index += 1;
        } else if (name === "--report" && value) {
            report = isAbsolute(value) ? value : resolve(value);
            index += 1;
        } else if (name === "--timeout-seconds" && value && Number.isFinite(Number(value)) && Number(value) > 0) {
            timeoutSeconds = Number(value);
            index += 1;
        } else if (name === "--codex-arg" && value) {
            codexArguments.push(value);
            index += 1;
        } else if (name === "--cursor-arg" && value) {
            cursorArguments.push(value);
            index += 1;
        } else
            throw new Error(
                "usage: run-longitudinal-scenario.ts [--scenario PATH] [--provider scripted|codex|cursor|codex-cursor] [--report NEW_PATH] [--timeout-seconds N] [--codex-arg VALUE] [--cursor-arg VALUE]",
            );
    }
    return { scenario, provider, report, timeoutSeconds, codexArguments, cursorArguments };
}
