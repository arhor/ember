import type { Readable, Writable } from "node:stream";

export type ProviderProcessTerminationReason =
    | "timeout"
    | "explicit_cancellation"
    | "output_limit"
    | "provider_failure";

export interface ProviderProcessChild {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    kill(signal?: NodeJS.Signals | number): boolean;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    off(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

export type ProviderProcessSpawn<TOptions> = (
    command: string,
    arguments_: string[],
    options: TOptions,
) => ProviderProcessChild;

export interface RunProviderProcessOptions<TOptions> {
    command: string;
    arguments_: string[];
    spawnImpl: ProviderProcessSpawn<TOptions>;
    spawnOptions: TOptions;
    stdin: string | Buffer;
    timeoutSeconds: number;
    signal?: AbortSignal;
    maxStdoutBytes: number;
    maxStderrBytes: number;
    terminationGraceMs: number;
    finalTerminationMs: number;
    destroyOutputOnTerminate?: boolean;
    onStdoutChunk?: (chunk: Buffer) => void;
}

export type ProviderProcessResult =
    | {
          spawned: false;
          spawnError: Error;
      }
    | {
          spawned: true;
          stdout: Buffer;
          stderr: Buffer;
          stdoutBytes: number;
          outputLimited: boolean;
          spawnError: Error | null;
          exitCode: number | null;
          exitSignal: NodeJS.Signals | null;
          terminationReason: ProviderProcessTerminationReason | null;
          terminationConfirmed: boolean;
      };

export async function runProviderProcess<TOptions>({
    command,
    arguments_,
    spawnImpl,
    spawnOptions,
    stdin,
    timeoutSeconds,
    signal,
    maxStdoutBytes,
    maxStderrBytes,
    terminationGraceMs,
    finalTerminationMs,
    destroyOutputOnTerminate = false,
    onStdoutChunk,
}: RunProviderProcessOptions<TOptions>): Promise<ProviderProcessResult> {
    let child: ProviderProcessChild;
    try {
        child = spawnImpl(command, [...arguments_], spawnOptions);
    } catch (error) {
        return { spawned: false, spawnError: asError(error) };
    }

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputLimited = false;
    let terminationReason: ProviderProcessTerminationReason | null = null;
    let spawnError: Error | null = null;
    let closed = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let settled = false;
    let killTimer: NodeJS.Timeout | null = null;
    let finalTimer: NodeJS.Timeout | null = null;

    let resolveDone!: (terminationConfirmed: boolean) => void;
    const done = new Promise<boolean>((resolve) => {
        resolveDone = resolve;
    });

    const closePipes = () => {
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
    };
    const terminate = (reason: ProviderProcessTerminationReason) => {
        if (settled || terminationReason !== null) {
            return;
        }
        terminationReason = reason;
        child.stdin.destroy();
        if (destroyOutputOnTerminate) {
            child.stdout.destroy();
            child.stderr.destroy();
        }
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
                resolveDone(false);
            }
        }, finalTerminationMs);
    };
    const onStdout = (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes <= maxStdoutBytes) {
            stdout.push(chunk);
            onStdoutChunk?.(chunk);
        } else if (!outputLimited) {
            outputLimited = true;
            terminate("output_limit");
        }
    };
    const onStderr = (chunk: Buffer) => {
        if (stderrBytes >= maxStderrBytes) {
            return;
        }
        const keep = chunk.subarray(0, maxStderrBytes - stderrBytes);
        stderr.push(keep);
        stderrBytes += keep.length;
    };
    const onSpawnError = (error: Error) => {
        spawnError = error;
    };
    const onClose = (code: number | null, signal_: NodeJS.Signals | null) => {
        closed = true;
        exitCode = code;
        exitSignal = signal_;
        if (killTimer) {
            clearTimeout(killTimer);
        }
        if (finalTimer) {
            clearTimeout(finalTimer);
        }
        if (!settled) {
            settled = true;
            resolveDone(true);
        }
    };
    const onStdinError = () => {};
    const onAbort = () => terminate("explicit_cancellation");

    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("error", onSpawnError);
    child.on("close", onClose);
    child.stdin.on("error", onStdinError);
    const timeoutTimer = setTimeout(() => terminate("timeout"), timeoutSeconds * 1000);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
        onAbort();
    }
    if (terminationReason === null) {
        try {
            child.stdin.end(stdin);
        } catch (error) {
            spawnError = asError(error);
            terminate("provider_failure");
        }
    }

    const terminationConfirmed = await done;
    clearTimeout(timeoutTimer);
    signal?.removeEventListener("abort", onAbort);
    if (killTimer) {
        clearTimeout(killTimer);
    }
    if (finalTimer) {
        clearTimeout(finalTimer);
    }
    child.stdin.off("error", onStdinError);
    child.stdout.off("data", onStdout);
    child.stderr.off("data", onStderr);
    child.off("error", onSpawnError);
    child.off("close", onClose);
    if (!terminationConfirmed) {
        closePipes();
    }

    return {
        spawned: true,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        stdoutBytes,
        outputLimited,
        spawnError,
        exitCode,
        exitSignal,
        terminationReason,
        terminationConfirmed,
    };
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
