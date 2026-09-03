#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import {
  SystemdUserSupervisor,
  inspectEpisodicRuntime,
  loadEpisodicRuntimeConfig,
  reconcileEpisodicRuntime,
  runSpecialistWorker,
  runWakeWorker,
  scheduleWake,
  startSpecialistEpisode,
  type EpisodicRuntimeConfig,
} from "../src/runtime/episodic-runtime.ts";
import type { SpecialistEpisodeSpec } from "../src/delegation/codex-specialist.ts";

const controller = new AbortController();
const cancel = () => controller.abort();
process.on("SIGTERM", cancel);
process.on("SIGINT", cancel);

try {
  process.exitCode = await main(process.argv.slice(2), controller.signal);
} catch (error) {
  process.stderr.write(`ember-runtime: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
} finally {
  process.off("SIGTERM", cancel);
  process.off("SIGINT", cancel);
}

async function main(argv: string[], signal: AbortSignal) {
  const parsed = parseArgs(argv);
  const config = await loadEpisodicRuntimeConfig(parsed.config);

  switch (parsed.command) {
    case "install": {
      const supervisor = new SystemdUserSupervisor(config, parsed.config);
      const path = await supervisor.installReconciliationUnit(parsed.unitDirectory);
      process.stdout.write(`${path}\n`);
      return 0;
    }
    case "schedule-wake": {
      const intent = await scheduleWake(config, parsed.config, parsed.at);
      process.stdout.write(`${JSON.stringify(intent, null, 2)}\n`);
      return 0;
    }
    case "run-wake": {
      const result = await runWakeWorker(config, parsed.wakeId, { signal });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    case "start-specialist": {
      const spec = JSON.parse(await readFile(parsed.spec, "utf8")) as SpecialistEpisodeSpec;
      const episodeId = await startSpecialistEpisode(config, parsed.config, spec);
      process.stdout.write(`${episodeId}\n`);
      return 0;
    }
    case "run-specialist": {
      const record = await runSpecialistWorker(config, parsed.episodeId, { signal });
      process.stdout.write(`${JSON.stringify({
        episode_id: record.specification.episode_id,
        runtime_state: record.runtime_state,
        report_state: record.report_state,
        ember_disposition: record.ember_disposition,
        retry_state: record.recovery.retry_state,
      }, null, 2)}\n`);
      return 0;
    }
    case "reconcile": {
      const result = await reconcileEpisodicRuntime(config, parsed.config);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    case "status": {
      process.stdout.write(`${JSON.stringify(await inspectEpisodicRuntime(config, parsed.config), null, 2)}\n`);
      return 0;
    }
  }
}

type Parsed =
  | { command: "install"; config: string; unitDirectory: string }
  | { command: "schedule-wake"; config: string; at: string }
  | { command: "run-wake"; config: string; wakeId: string }
  | { command: "start-specialist"; config: string; spec: string }
  | { command: "run-specialist"; config: string; episodeId: string }
  | { command: "reconcile"; config: string }
  | { command: "status"; config: string };

function parseArgs(argv: string[]): Parsed {
  const command = argv[0];
  if (!command) throw new Error("a command is required");
  const values = new Map<string, string>();
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`malformed option near ${flag ?? "end of command"}`);
    if (values.has(flag)) throw new Error(`${flag} must not be repeated`);
    values.set(flag, value);
  }
  const required = (flag: string) => {
    const value = values.get(flag);
    if (!value) throw new Error(`${flag} is required`);
    return value;
  };
  const config = required("--config");
  const allowOnly = (...flags: string[]) => {
    const allowed = new Set(["--config", ...flags]);
    for (const flag of values.keys()) if (!allowed.has(flag)) throw new Error(`unsupported option for ${command}: ${flag}`);
  };

  if (command === "install") {
    allowOnly("--unit-directory");
    return { command, config, unitDirectory: required("--unit-directory") };
  }
  if (command === "schedule-wake") {
    allowOnly("--at");
    return { command, config, at: required("--at") };
  }
  if (command === "run-wake") {
    allowOnly("--wake-id");
    return { command, config, wakeId: required("--wake-id") };
  }
  if (command === "start-specialist") {
    allowOnly("--spec");
    return { command, config, spec: required("--spec") };
  }
  if (command === "run-specialist") {
    allowOnly("--episode-id");
    return { command, config, episodeId: required("--episode-id") };
  }
  if (command === "reconcile" || command === "status") {
    allowOnly();
    return { command, config };
  }
  throw new Error(`unsupported command: ${command}`);
}

export { main, parseArgs };
export type { EpisodicRuntimeConfig };
