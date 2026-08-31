#!/usr/bin/env node

import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const MAX_OUTPUT_BYTES = 1024 * 1024;
const API_KEY_NAMES = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CURSOR_API_KEY"] as const;

export interface ProbeOptions {
  command: string;
  arguments_: string[];
  cwd: string;
  timeoutMs: number;
  cancelAfterMs?: number;
}

export interface ProbeSummary {
  command: string;
  duration_ms: number;
  exit_code: number | null;
  exit_signal: NodeJS.Signals | null;
  cancellation_requested: boolean;
  direct_child_exit_observed: boolean;
  stdout_bytes: number;
  stderr_bytes: number;
  stdout_truncated: boolean;
  stderr_truncated: boolean;
  jsonl_event_types: string[];
  stdout: string;
  stderr: string;
}

export async function runProbe(options: ProbeOptions): Promise<ProbeSummary> {
  const environment = { ...process.env };
  for (const name of API_KEY_NAMES) delete environment[name];

  const child = spawn(options.command, options.arguments_, {
    cwd: options.cwd,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const started = performance.now();
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let cancellationRequested = false;
  let forceKillTimer: NodeJS.Timeout | undefined;

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBytes += chunk.length;
    retainBounded(stdout, chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBytes += chunk.length;
    retainBounded(stderr, chunk);
  });

  const cancelTimer = options.cancelAfterMs === undefined ? undefined : setTimeout(() => {
    cancellationRequested = true;
    child.kill("SIGTERM");
    forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 500);
  }, options.cancelAfterMs);
  const timeoutTimer = setTimeout(() => {
    cancellationRequested = true;
    child.kill("SIGTERM");
    forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 500);
  }, options.timeoutMs);

  const terminal = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).finally(() => {
    if (cancelTimer !== undefined) clearTimeout(cancelTimer);
    if (forceKillTimer !== undefined) clearTimeout(forceKillTimer);
    clearTimeout(timeoutTimer);
  });

  const stdoutText = Buffer.concat(stdout).toString("utf8");
  const stderrText = Buffer.concat(stderr).toString("utf8");
  return {
    command: options.command,
    duration_ms: Math.round(performance.now() - started),
    exit_code: terminal.code,
    exit_signal: terminal.signal,
    cancellation_requested: cancellationRequested,
    direct_child_exit_observed: true,
    stdout_bytes: stdoutBytes,
    stderr_bytes: stderrBytes,
    stdout_truncated: stdoutBytes > MAX_OUTPUT_BYTES,
    stderr_truncated: stderrBytes > MAX_OUTPUT_BYTES,
    jsonl_event_types: eventTypes(stdoutText),
    stdout: stdoutText,
    stderr: stderrText,
  };
}

function retainBounded(target: Buffer[], chunk: Buffer) {
  const retained = target.reduce((total, item) => total + item.length, 0);
  if (retained >= MAX_OUTPUT_BYTES) return;
  target.push(chunk.subarray(0, MAX_OUTPUT_BYTES - retained));
}

function eventTypes(output: string) {
  const types = new Set<string>();
  for (const line of output.split("\n")) {
    try {
      const event: unknown = JSON.parse(line);
      if (event && typeof event === "object" && "type" in event && typeof event.type === "string") types.add(event.type);
    } catch {}
  }
  return [...types];
}

function usage(): never {
  throw new Error("usage: probe.ts --cwd DIR --timeout-ms N [--cancel-after-ms N] -- COMMAND [ARG ...]");
}

function parseArguments(arguments_: string[]) {
  const separator = arguments_.indexOf("--");
  if (separator < 0 || separator === arguments_.length - 1) usage();
  let cwd: string | undefined;
  let timeoutMs: number | undefined;
  let cancelAfterMs: number | undefined;
  for (let index = 0; index < separator; index += 2) {
    const name = arguments_[index];
    const value = arguments_[index + 1];
    if (value === undefined) usage();
    if (name === "--cwd") cwd = value;
    else if (name === "--timeout-ms") timeoutMs = Number(value);
    else if (name === "--cancel-after-ms") cancelAfterMs = Number(value);
    else usage();
  }
  if (!cwd || !Number.isFinite(timeoutMs) || timeoutMs! <= 0) usage();
  if (cancelAfterMs !== undefined && (!Number.isFinite(cancelAfterMs) || cancelAfterMs <= 0 || cancelAfterMs >= timeoutMs!)) usage();
  return { command: arguments_[separator + 1], arguments_: arguments_.slice(separator + 2), cwd, timeoutMs: timeoutMs!, cancelAfterMs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProbe(parseArguments(process.argv.slice(2))).then(summary => {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  }).catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
