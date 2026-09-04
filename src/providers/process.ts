import { spawn } from "node:child_process";
import { basename } from "node:path";
import type { Readable, Writable } from "node:stream";
import { ProviderError } from "../core/errors.ts";
import {
    MAX_PROVIDER_TIMEOUT_SECONDS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
    validateProviderResult,
    type ProviderInvocationOptions,
    type ProviderRequest,
    type ProviderResult,
} from "./contract.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });

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

type SpawnImpl = (
    command: string,
    args: string[],
    options: { shell: false; stdio: ["pipe", "pipe", "pipe"] },
) => ProviderChild;

export interface InvokeProviderOptions extends ProviderInvocationOptions {
    spawnImpl?: SpawnImpl;
    terminationGraceMs?: number;
    finalTerminationMs?: number;
}

export async function invokeProvider(
    command: string,
    arguments_: string[],
    request: ProviderRequest,
    {
        timeoutSeconds,
        signal,
        spawnImpl = spawn as unknown as SpawnImpl,
        terminationGraceMs = 100,
        finalTerminationMs = 500,
    }: InvokeProviderOptions,
): Promise<ProviderResult> {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
    if (signal?.aborted)
        throw new ProviderError("provider cancellation requested before invocation", {
            outcome: "cancellation_requested",
            termination: { reason: "explicit_cancellation", directChildExitObserved: false },
        });
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
    type TerminationReason = "timeout" | "explicit_cancellation" | "output_limit" | "provider_failure";
    let terminationReason: TerminationReason | null = null;
    let spawnError: Error | null = null;
    let closed = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let settled = false;
    let killTimer: NodeJS.Timeout | null = null;
    let finalTimer: NodeJS.Timeout | null = null;

    let resolveDone!: (value: { unconfirmed: boolean }) => void;
    const done = new Promise<{ unconfirmed: boolean }>((resolve) => {
        resolveDone = resolve;
    });
    const onStdinError = () => {};
    const closePipes = () => {
        child.stdin?.destroy();
        child.stdout?.destroy();
        child.stderr?.destroy();
    };
    const terminate = (reason: TerminationReason) => {
        if (settled || terminationReason !== null) return;
        terminationReason = reason;
        closePipes();
        try {
            child.kill("SIGTERM");
        } catch {}
        killTimer = setTimeout(() => {
            if (!closed) {
                try {
                    child.kill("SIGKILL");
                } catch {}
            }
        }, terminationGraceMs);
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
        else if (!oversized) {
            oversized = true;
            terminate("output_limit");
        }
    };
    const onStderr = (chunk: Buffer) => {
        if (stderrBytes < MAX_STDERR_BYTES) {
            const keep = chunk.subarray(0, MAX_STDERR_BYTES - stderrBytes);
            stderr.push(keep);
            stderrBytes += keep.length;
        }
    };
    const onSpawnError = (error: Error) => {
        spawnError = error;
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
        closed = true;
        exitCode = code;
        exitSignal = signal;
        if (killTimer) clearTimeout(killTimer);
        if (finalTimer) clearTimeout(finalTimer);
        if (!settled) {
            settled = true;
            resolveDone({ unconfirmed: false });
        }
    };

    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("error", onSpawnError);
    child.on("close", onClose);
    const timer = setTimeout(() => terminate("timeout"), timeoutSeconds * 1000);
    const onAbort = () => terminate("explicit_cancellation");
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    const wire = Buffer.from(JSON.stringify(request), "utf8");
    child.stdin.on("error", onStdinError);
    try {
        child.stdin.end(wire);
    } catch (error) {
        spawnError = error instanceof Error ? error : new Error(String(error));
        terminate("provider_failure");
    }

    const terminal = await done;
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
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
        const firstReason = terminationReason as TerminationReason | null;
        if (firstReason === "provider_failure")
            throw new ProviderError("provider I/O failed; direct-child termination unconfirmed", {
                outcome: "outcome_unknown",
                terminationConfirmed: false,
                cause: spawnError ?? undefined,
            });
        const reason = firstReason ?? "output_limit";
        throw new ProviderError(
            `${reason === "explicit_cancellation" ? "provider cancellation requested" : reason === "timeout" ? "provider timed out" : oversized ? "provider stdout exceeds 1 MiB" : "provider termination was not observed"}; direct-child termination unconfirmed`,
            {
                outcome: "outcome_unknown",
                terminationConfirmed: false,
                termination: { reason, directChildExitObserved: false },
            },
        );
    }
    if (spawnError) throw new ProviderError(`provider is unavailable: ${spawnError.message}`, { cause: spawnError });
    if (terminationReason === "explicit_cancellation")
        throw new ProviderError(
            "provider cancellation requested; direct child exit observed but remote work or effects remain unconfirmed",
            {
                outcome: "cancellation_requested",
                termination: { reason: "explicit_cancellation", directChildExitObserved: true },
            },
        );
    if (terminationReason === "timeout")
        throw new ProviderError(`provider timed out${diagnostic ? `: ${diagnostic}` : ""}`, {
            outcome: "timed_out",
            termination: { reason: "timeout", directChildExitObserved: true },
        });
    if (oversized || stdoutBytes > MAX_STDOUT_BYTES)
        throw new ProviderError("provider stdout exceeds 1 MiB", {
            termination: { reason: "output_limit", directChildExitObserved: true },
        });
    if (exitCode !== 0)
        throw new ProviderError(
            `provider exited with ${exitSignal ? `signal ${exitSignal}` : `status ${exitCode}`}${diagnostic ? `: ${diagnostic}` : ""}`,
        );

    let text: string;
    try {
        text = decoder.decode(Buffer.concat(stdout));
    } catch (error) {
        throw new ProviderError("provider stdout is not UTF-8", { cause: error });
    }
    let result: unknown;
    try {
        result = JSON.parse(text);
    } catch (error) {
        throw new ProviderError(`provider stdout is not exactly one JSON object: ${errorMessage(error)}`, {
            cause: error,
        });
    }
    validateProviderResult(result, new Set(request.projection.selection.meaning_ids));
    return result;
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
