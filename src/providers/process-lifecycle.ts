import type { Readable, Writable } from "node:stream";

import { spawn } from "node:child_process";

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

export interface ProviderCliSpawnOptions {
    cwd: string;
    env: NodeJS.ProcessEnv;
}

export type ProviderCliSpawn = ProviderProcessSpawn<ProviderCliSpawnOptions>;

export const NodeProviderCliSpawn: ProviderCliSpawn = (command, arguments_, options) =>
    spawn(command, arguments_, {
        ...options,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
    });

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

export interface ProviderProcessExecution {
    run(): Promise<ProviderProcessResult>;
}

export function createProviderProcessExecution<TOptions>(
    options: RunProviderProcessOptions<TOptions>,
): ProviderProcessExecution {
    return new ProviderProcessExecutionImpl(options);
}

export function runProviderProcess<TOptions>(
    options: RunProviderProcessOptions<TOptions>,
): Promise<ProviderProcessResult> {
    return createProviderProcessExecution(options).run();
}

class ProviderProcessExecutionImpl<TOptions> implements ProviderProcessExecution {
    private readonly options: RunProviderProcessOptions<TOptions>;
    private child: ProviderProcessChild | null = null;
    private readonly stdout: Buffer[] = [];
    private readonly stderr: Buffer[] = [];

    private stdoutBytes = 0;
    private stderrBytes = 0;
    private outputLimited = false;
    private terminationReason: ProviderProcessTerminationReason | null = null;
    private spawnError: Error | null = null;
    private closed = false;
    private exitCode: number | null = null;
    private exitSignal: NodeJS.Signals | null = null;
    private settled = false;

    private timeoutTimer: NodeJS.Timeout | null = null;
    private killTimer: NodeJS.Timeout | null = null;
    private finalTimer: NodeJS.Timeout | null = null;

    private resolveDone: ((terminationConfirmed: boolean) => void) | null = null;
    private execution: Promise<ProviderProcessResult> | null = null;

    constructor(options: RunProviderProcessOptions<TOptions>) {
        this.options = options;
    }

    run(): Promise<ProviderProcessResult> {
        this.execution ??= this.execute();
        return this.execution;
    }

    private async execute(): Promise<ProviderProcessResult> {
        try {
            this.child = this.options.spawnImpl(
                this.options.command,
                [...this.options.arguments_],
                this.options.spawnOptions,
            );
        } catch (error) {
            return { spawned: false, spawnError: asError(error) };
        }

        const done = new Promise<boolean>((resolve) => {
            this.resolveDone = resolve;
        });

        this.attachListeners();
        this.timeoutTimer = setTimeout(() => this.terminate("timeout"), this.options.timeoutSeconds * 1000);
        this.options.signal?.addEventListener("abort", this.onAbort, { once: true });
        if (this.options.signal?.aborted) {
            this.onAbort();
        }
        if (this.terminationReason === null) {
            try {
                this.child.stdin.end(this.options.stdin);
            } catch (error) {
                this.spawnError = asError(error);
                this.terminate("provider_failure");
            }
        }

        const terminationConfirmed = await done;
        this.cleanup(terminationConfirmed);

        return {
            spawned: true,
            stdout: Buffer.concat(this.stdout),
            stderr: Buffer.concat(this.stderr),
            stdoutBytes: this.stdoutBytes,
            outputLimited: this.outputLimited,
            spawnError: this.spawnError,
            exitCode: this.exitCode,
            exitSignal: this.exitSignal,
            terminationReason: this.terminationReason,
            terminationConfirmed,
        };
    }

    private attachListeners(): void {
        const child = this.child;
        if (child === null) {
            return;
        }
        child.stdout.on("data", this.onStdout);
        child.stderr.on("data", this.onStderr);
        child.on("error", this.onSpawnError);
        child.on("close", this.onClose);
        child.stdin.on("error", this.onStdinError);
    }

    private cleanup(terminationConfirmed: boolean): void {
        const child = this.child;
        if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
        if (this.killTimer) clearTimeout(this.killTimer);
        if (this.finalTimer) clearTimeout(this.finalTimer);
        this.options.signal?.removeEventListener("abort", this.onAbort);
        if (child !== null) {
            child.stdin.off("error", this.onStdinError);
            child.stdout.off("data", this.onStdout);
            child.stderr.off("data", this.onStderr);
            child.off("error", this.onSpawnError);
            child.off("close", this.onClose);
        }
        if (!terminationConfirmed) {
            this.closePipes();
        }
    }

    private closePipes(): void {
        const child = this.child;
        if (child === null) {
            return;
        }
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
    }

    private terminate(reason: ProviderProcessTerminationReason): void {
        const child = this.child;
        if (child === null || this.settled || this.terminationReason !== null) {
            return;
        }
        this.terminationReason = reason;
        child.stdin.destroy();
        if (this.options.destroyOutputOnTerminate) {
            child.stdout.destroy();
            child.stderr.destroy();
        }
        try {
            child.kill("SIGTERM");
        } catch {}
        this.killTimer = setTimeout(() => {
            if (!this.closed) {
                try {
                    child.kill("SIGKILL");
                } catch {}
            }
        }, this.options.terminationGraceMs);
        this.finalTimer = setTimeout(() => {
            if (!this.closed && !this.settled) {
                this.settled = true;
                this.closePipes();
                this.resolveDone?.(false);
            }
        }, this.options.finalTerminationMs);
    }

    private readonly onStdout = (chunk: Buffer): void => {
        this.stdoutBytes += chunk.length;
        if (this.stdoutBytes <= this.options.maxStdoutBytes) {
            this.stdout.push(chunk);
            this.options.onStdoutChunk?.(chunk);
        } else if (!this.outputLimited) {
            this.outputLimited = true;
            this.terminate("output_limit");
        }
    };

    private readonly onStderr = (chunk: Buffer): void => {
        if (this.stderrBytes >= this.options.maxStderrBytes) {
            return;
        }
        const keep = chunk.subarray(0, this.options.maxStderrBytes - this.stderrBytes);
        this.stderr.push(keep);
        this.stderrBytes += keep.length;
    };

    private readonly onSpawnError = (error: Error): void => {
        this.spawnError = error;
    };

    private readonly onClose = (code: number | null, signal: NodeJS.Signals | null): void => {
        this.closed = true;
        this.exitCode = code;
        this.exitSignal = signal;
        if (this.killTimer) clearTimeout(this.killTimer);
        if (this.finalTimer) clearTimeout(this.finalTimer);
        if (!this.settled) {
            this.settled = true;
            this.resolveDone?.(true);
        }
    };

    private readonly onStdinError = (): void => {};

    private readonly onAbort = (): void => {
        this.terminate("explicit_cancellation");
    };
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
