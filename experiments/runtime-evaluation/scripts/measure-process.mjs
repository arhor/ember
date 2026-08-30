#!/usr/bin/env node
import { copyFile, readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const parsed = parseArgs(process.argv.slice(2));
const samples = [];
for (let index = 0; index < parsed.warmup + parsed.repeat; index++) {
  const sample = await runOnce(parsed);
  if (index >= parsed.warmup) samples.push(sample);
}
const result = {
  label: parsed.label,
  command: parsed.command,
  repeat: parsed.repeat,
  reset_file: parsed.resetFile,
  elapsed_ms: summarize(samples.map((sample) => sample.elapsed_ms)),
  max_tree_rss_kib: summarize(samples.map((sample) => sample.max_tree_rss_kib)),
  exit_codes: samples.map((sample) => sample.exit_code),
};
console.log(JSON.stringify(result));
if (samples.some((sample) => sample.exit_code !== 0)) process.exitCode = 1;

async function runOnce(options) {
  if (options.resetFile !== null) {
    await copyFile(options.resetFile.source, options.resetFile.destination);
  }
  const start = performance.now();
  const child = spawn(options.command[0], options.command.slice(1), {
    cwd: options.cwd,
    stdio: [options.stdinText === null ? "ignore" : "pipe", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  const closed = new Promise((resolve) =>
    child.once("close", (code, signal) =>
      resolve({ code: code ?? (signal ? 128 : 1), signal })
    )
  );
  if (options.stdinText !== null) {
    setTimeout(() => child.stdin.end(options.stdinText), options.stdinDelayMs);
  }
  let maxTreeRss = 0;
  while (child.exitCode === null && child.signalCode === null) {
    maxTreeRss = Math.max(maxTreeRss, await treeRss(child.pid));
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  const terminal = await closed;
  maxTreeRss = Math.max(maxTreeRss, await treeRss(child.pid));
  return {
    elapsed_ms: performance.now() - start,
    max_tree_rss_kib: maxTreeRss,
    exit_code: terminal.code,
  };
}

async function treeRss(rootPid) {
  if (!rootPid) return 0;
  const processes = new Map();
  let entries;
  try {
    entries = await readdir("/proc", { withFileTypes: true });
  } catch {
    return await rss(rootPid);
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const pid = Number(entry.name);
    try {
      const stat = await readFile(`/proc/${pid}/stat`, "utf8");
      const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      processes.set(pid, Number(rest[1]));
    } catch {}
  }
  const wanted = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, ppid] of processes) {
      if (wanted.has(ppid) && !wanted.has(pid)) {
        wanted.add(pid);
        changed = true;
      }
    }
  }
  let total = 0;
  for (const pid of wanted) total += await rss(pid);
  return total;
}

async function rss(pid) {
  try {
    const status = await readFile(`/proc/${pid}/status`, "utf8");
    return Number(/^VmRSS:\s+(\d+)\s+kB$/m.exec(status)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    median: round(median),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
    samples: values.map(round),
  };
}
function round(value) {
  return Math.round(value * 100) / 100;
}

function parseArgs(args) {
  const options = {
    label: "measurement",
    repeat: 5,
    warmup: 1,
    cwd: process.cwd(),
    stdinText: null,
    stdinDelayMs: 0,
    resetFile: null,
    command: [],
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") {
      options.command = args.slice(index + 1);
      break;
    }
    if (arg === "--label") options.label = args[++index];
    else if (arg === "--repeat") options.repeat = Number(args[++index]);
    else if (arg === "--warmup") options.warmup = Number(args[++index]);
    else if (arg === "--cwd") options.cwd = args[++index];
    else if (arg === "--stdin-text") options.stdinText = args[++index].replaceAll("\\n", "\n");
    else if (arg === "--stdin-delay-ms") options.stdinDelayMs = Number(args[++index]);
    else if (arg === "--reset-file") {
      const source = args[++index];
      const destination = args[++index];
      if (!source || !destination) throw new Error("--reset-file requires SOURCE DEST");
      options.resetFile = { source, destination };
    } else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.command.length) throw new Error("command required after --");
  if (!Number.isSafeInteger(options.repeat) || options.repeat <= 0) {
    throw new Error("--repeat must be a positive integer");
  }
  if (!Number.isSafeInteger(options.warmup) || options.warmup < 0) {
    throw new Error("--warmup must be a non-negative integer");
  }
  return options;
}
