import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import type { MeaningId, ProviderRequest, ProviderResult } from "./model.ts";

export const MAX_STDOUT_BYTES = 1024 * 1024;
export const MAX_STDERR_BYTES = 64 * 1024;

export async function invokeProvider(
  command: string,
  args: readonly string[],
  request: ProviderRequest,
  options: { timeoutMs?: number; terminationGraceMs?: number } = {},
): Promise<ProviderResult> {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const terminationGraceMs = options.terminationGraceMs ?? 100;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("provider timeout must be positive");
  }

  const child = spawn(command, [...args], { shell: false, stdio: ["pipe", "pipe", "pipe"] });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let timedOut = false;
  let oversized = false;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;

  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes <= MAX_STDOUT_BYTES) stdout.push(chunk);
    else if (!oversized) {
      oversized = true;
      child.kill("SIGTERM");
      forceTimer = setTimeout(() => child.kill("SIGKILL"), terminationGraceMs);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (stderrBytes >= MAX_STDERR_BYTES) return;
    const kept = chunk.subarray(0, MAX_STDERR_BYTES - stderrBytes);
    stderr.push(kept);
    stderrBytes += kept.length;
  });

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    forceTimer = setTimeout(() => child.kill("SIGKILL"), terminationGraceMs);
  }, timeoutMs);
  child.stdin.end(Buffer.from(JSON.stringify(request), "utf8"));

  const terminal = await new Promise<{ code: number | null; signal: string | null }>(
    (resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) => resolve({ code, signal }));
    },
  );
  clearTimeout(timer);
  if (forceTimer) clearTimeout(forceTimer);
  const diagnostic = Buffer.concat(stderr).toString("utf8").trim();
  if (timedOut) throw new Error(`provider timed out${diagnostic ? `: ${diagnostic}` : ""}`);
  if (oversized) throw new Error("provider stdout exceeds 1 MiB");
  if (terminal.code !== 0) {
    throw new Error(`provider exited with ${terminal.signal ?? `status ${terminal.code}`}`);
  }

  const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(stdout));
  const value: unknown = JSON.parse(text);
  return validateProviderResult(value, new Set(request.projection.selection.meaning_ids));
}

function validateProviderResult(value: unknown, selected: ReadonlySet<MeaningId>): ProviderResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("provider result must be an object");
  }
  const result = value as Record<string, unknown>;
  if (
    result.contract_version !== 1 || typeof result.reply !== "string" || !result.reply.trim() ||
    !Array.isArray(result.used_meaning_ids)
  ) {
    throw new Error("provider result is invalid");
  }
  const used = result.used_meaning_ids;
  if (
    !used.every((id): id is MeaningId => typeof id === "string" && selected.has(id as MeaningId))
  ) throw new Error("provider claimed a meaning outside its projection");
  return { contract_version: 1, reply: result.reply, used_meaning_ids: used };
}
