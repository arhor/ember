import { spawn } from "node:child_process";
import { basename } from "node:path";
import type { Readable, Writable } from "node:stream";
import { ProviderError } from "./errors.ts";
import type { CognitionId, MeaningId } from "./model.ts";
import type { Projection } from "./projection.ts";

export const CONTRACT_VERSION = 1;
export const MAX_STDOUT_BYTES = 1024 * 1024;
export const MAX_STDERR_BYTES = 64 * 1024;
export const MAX_PROVIDER_TIMEOUT_SECONDS = 2_147_483_647 / 1000;
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface ProviderRequest {
  contract_version: 1;
  cognition_id: CognitionId;
  projection: Projection;
  input: { text: string };
}

export interface ProviderResult {
  contract_version: 1;
  reply: string;
  used_meaning_ids: MeaningId[];
}

interface ProviderChild {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  off(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

type SpawnImpl = (command: string, args: string[], options: { shell: false; stdio: ["pipe", "pipe", "pipe"] }) => ProviderChild;

export interface InvokeProviderOptions {
  timeoutSeconds: number;
  spawnImpl?: SpawnImpl;
  terminationGraceMs?: number;
  finalTerminationMs?: number;
}

export type ProviderInvoker = (
  command: string,
  arguments_: string[],
  request: ProviderRequest,
  options: InvokeProviderOptions,
) => Promise<ProviderResult>;

export async function invokeProvider(
  command: string,
  arguments_: string[],
  request: ProviderRequest,
  { timeoutSeconds, spawnImpl = spawn as unknown as SpawnImpl, terminationGraceMs = 100, finalTerminationMs = 500 }: InvokeProviderOptions,
): Promise<ProviderResult> {
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new ProviderError("provider timeout must be a positive finite number");
  if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS) throw new ProviderError(`provider timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
  let child: ProviderChild;
  try {
    child = spawnImpl(command, [...arguments_], { shell: false, stdio: ["pipe", "pipe", "pipe"] });
  } catch (error) {
    throw new ProviderError(`provider is unavailable: ${errorMessage(error)}`, { cause: error });
  }

  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let oversized = false;
  let timedOut = false;
  let spawnError: Error | null = null;
  let closed = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  let settled = false;
  let terminationStarted = false;
  let killTimer: NodeJS.Timeout | null = null;
  let finalTimer: NodeJS.Timeout | null = null;

  let resolveDone!: (value: { unconfirmed: boolean }) => void;
  const done = new Promise<{ unconfirmed: boolean }>(resolve => { resolveDone = resolve; });
  const onStdinError = () => {};
  const closePipes = () => { child.stdin?.destroy(); child.stdout?.destroy(); child.stderr?.destroy(); };
  const terminate = () => {
    if (settled || terminationStarted) return;
    terminationStarted = true;
    closePipes();
    try { child.kill("SIGTERM"); } catch {}
    killTimer = setTimeout(() => { if (!closed) { try { child.kill("SIGKILL"); } catch {} } }, terminationGraceMs);
    finalTimer = setTimeout(() => {
      if (!closed && !settled) {
        settled = true;
        closePipes();
        resolveDone({ unconfirmed: true });
      }
    }, finalTerminationMs);
  };
  const onStdout = (chunk: Buffer) => {
    stdoutBytes += chunk.length;
    if (stdoutBytes <= MAX_STDOUT_BYTES) stdout.push(chunk);
    else if (!oversized) { oversized = true; terminate(); }
  };
  const onStderr = (chunk: Buffer) => {
    if (stderrBytes < MAX_STDERR_BYTES) {
      const keep = chunk.subarray(0, MAX_STDERR_BYTES - stderrBytes);
      stderr.push(keep);
      stderrBytes += keep.length;
    }
  };
  const onSpawnError = (error: Error) => { spawnError = error; };
  const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
    closed = true;
    exitCode = code;
    exitSignal = signal;
    if (killTimer) clearTimeout(killTimer);
    if (finalTimer) clearTimeout(finalTimer);
    if (!settled) { settled = true; resolveDone({ unconfirmed: false }); }
  };

  child.stdout.on("data", onStdout);
  child.stderr.on("data", onStderr);
  child.on("error", onSpawnError);
  child.on("close", onClose);
  const timer = setTimeout(() => { timedOut = true; terminate(); }, timeoutSeconds * 1000);
  const wire = Buffer.from(JSON.stringify(request), "utf8");
  child.stdin.on("error", onStdinError);
  try { child.stdin.end(wire); } catch (error) { spawnError = error instanceof Error ? error : new Error(String(error)); terminate(); }

  const terminal = await done;
  clearTimeout(timer);
  if (killTimer) clearTimeout(killTimer);
  if (finalTimer) clearTimeout(finalTimer);
  child.stdin.off("error", onStdinError);
  child.stdout.off("data", onStdout);
  child.stderr.off("data", onStderr);
  child.off("error", onSpawnError);
  child.off("close", onClose);
  if (terminal.unconfirmed) closePipes();

  const diagnostic = decodeDiagnostic(Buffer.concat(stderr));
  if (terminal.unconfirmed) {
    throw new ProviderError(`${timedOut ? "provider timed out" : oversized ? "provider stdout exceeds 1 MiB" : "provider termination was not observed"}; direct-child termination unconfirmed`, { outcome: "outcome_unknown", terminationConfirmed: false });
  }
  if (spawnError) throw new ProviderError(`provider is unavailable: ${spawnError.message}`, { cause: spawnError });
  if (timedOut) throw new ProviderError(`provider timed out${diagnostic ? `: ${diagnostic}` : ""}`, { outcome: "timed_out" });
  if (oversized || stdoutBytes > MAX_STDOUT_BYTES) throw new ProviderError("provider stdout exceeds 1 MiB");
  if (exitCode !== 0) throw new ProviderError(`provider exited with ${exitSignal ? `signal ${exitSignal}` : `status ${exitCode}`}${diagnostic ? `: ${diagnostic}` : ""}`);

  let text: string;
  try { text = decoder.decode(Buffer.concat(stdout)); } catch (error) { throw new ProviderError("provider stdout is not UTF-8", { cause: error }); }
  let result: unknown;
  try { result = JSON.parse(text); } catch (error) { throw new ProviderError(`provider stdout is not exactly one JSON object: ${errorMessage(error)}`, { cause: error }); }
  validateProviderResult(result, new Set(request.projection.selection.meaning_ids));
  return result;
}

export function validateProviderResult(result: unknown, selected: ReadonlySet<MeaningId | string>): asserts result is ProviderResult {
  if (result === null || typeof result !== "object" || Array.isArray(result)) throw new ProviderError("provider result must be an object");
  const object = result as Record<string, unknown>;
  const fields = Object.keys(object).sort();
  if (JSON.stringify(fields) !== JSON.stringify(["contract_version", "reply", "used_meaning_ids"].sort())) throw new ProviderError("provider result contains missing or unsupported fields");
  if (!Number.isSafeInteger(object.contract_version) || object.contract_version !== 1) throw new ProviderError("provider result contract_version is unsupported");
  if (typeof object.reply !== "string" || !object.reply.trim()) throw new ProviderError("provider reply must be non-empty");
  if (!Array.isArray(object.used_meaning_ids) || !object.used_meaning_ids.every(v => typeof v === "string")) throw new ProviderError("used_meaning_ids must be a string list");
  if (new Set(object.used_meaning_ids).size !== object.used_meaning_ids.length) throw new ProviderError("used_meaning_ids must not contain duplicates");
  if (!object.used_meaning_ids.every(id => selected.has(id as string))) throw new ProviderError("provider claimed a meaning outside its projection");
}

export function providerLabel(command: string) {
  return basename(command) || command;
}

function decodeDiagnostic(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
