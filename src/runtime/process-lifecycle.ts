import type { Readable, Writable } from "node:stream";

import { spawn } from "node:child_process";

export type ProcessTerminationReason = "timeout" | "explicit_cancellation" | "output_limit" | "process_failure";

export interface ProcessChild {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    kill(signal?: NodeJS.Signals | number): boolean;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    off(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

export type ProcessSpawn<TOptions> = (command: string, arguments_: string[], options: TOptions) => ProcessChild;

export interface CliProcessSpawnOptions {
    cwd: string;
    env: NodeJS.ProcessEnv;
}

export type CliProcessSpawn = ProcessSpawn<CliProcessSpawnOptions>;
export type PipedProcessSpawn = ProcessSpawn<Record<string, never>>;

export const NodeCliProcessSpawn: CliProcessSpawn = (command, arguments_, options) =>
    spawn(command, arguments_, {
        ...options,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
    });

export const NodePipedProcessSpawn: PipedProcessSpawn = (command, arguments_) =>
    spawn(command, arguments_, {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
    });

export interface RunProcessOptions<TOptions> {
    command: string;
    arguments_: string[];
    spawnImpl: ProcessSpawn<TOptions>;
    spawnOptions: TOptions;
    stdin: string | Buffer;
    timeoutSeconds: number;
    signal?: AbortSignal;
    maxStdoutBytes: number;
    maxStderrBytes: number;
    terminationGraceMs: number;
    finalTerminationMs: number;
    destroyOutputOnTerminate?: boolean;
    terminateOnStdinError?: boolean;
    onStdoutChunk?: (chunk: Buffer) => void;
    onStdinError?: (error: Error) => void;
    onSpawned?: () => void | Promise<void>;
    beforeTerminate?: (reason: ProcessTerminationReason) => void | Promise<void>;
}

export type ProcessResult =
    | { spawned: false; spawnError: Error }
    | {
          spawned: true;
          stdout: Buffer;
          stderr: Buffer;
          stdoutBytes: number;
          outputLimited: boolean;
          spawnError: Error | null;
          exitCode: number | null;
          exitSignal: NodeJS.Signals | null;
          terminationReason: ProcessTerminationReason | null;
          terminationConfirmed: boolean;
      };

export interface ProcessExecution {
    run(): Promise<ProcessResult>;
}

export function createProcessExecution<TOptions>(options: RunProcessOptions<TOptions>): ProcessExecution {
    return new ProcessExecutionImpl(options);
}

export function runProcess<TOptions>(options: RunProcessOptions<TOptions>): Promise<ProcessResult> {
    return createProcessExecution(options).run();
}

class ProcessExecutionImpl<TOptions> implements ProcessExecution {
    private readonly options: RunProcessOptions<TOptions>;
    private child: ProcessChild | null = null;
    private readonly stdout: Buffer[] = [];
    private readonly stderr: Buffer[] = [];
    private stdoutBytes = 0;
    private stderrBytes = 0;
    private outputLimited = false;
    private terminationReason: ProcessTerminationReason | null = null;
    private spawnError: Error | null = null;
    private closed = false;
    private exitCode: number | null = null;
    private exitSignal: NodeJS.Signals | null = null;
    private settled = false;
    private timeoutTimer: NodeJS.Timeout | null = null;
    private killTimer: NodeJS.Timeout | null = null;
    private finalTimer: NodeJS.Timeout | null = null;
    private terminationPreparation: Promise<void> | null = null;
    private resolveDone: ((terminationConfirmed: boolean) => void) | null = null;
    private execution: Promise<ProcessResult> | null = null;

    constructor(options: RunProcessOptions<TOptions>) {
        this.options = options;
    }

    run(): Promise<ProcessResult> {
        this.execution ??= this.execute();
        return this.execution;
    }

    private async execute(): Promise<ProcessResult> {
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

        if (this.options.onSpawned) await this.options.onSpawned();
        this.attachListeners();
        this.timeoutTimer = setTimeout(() => this.terminate("timeout"), this.options.timeoutSeconds * 1000);
        this.options.signal?.addEventListener("abort", this.onAbort, { once: true });
        if (this.options.signal?.aborted) this.onAbort();
        if (this.terminationReason === null) {
            try {
                this.child.stdin.end(this.options.stdin);
            } catch (error) {
                this.spawnError = asError(error);
                this.terminate("process_failure");
            }
        }

        const terminationConfirmed = await done;
        await this.terminationPreparation;
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
        if (child === null) return;
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
        if (!terminationConfirmed) this.closePipes();
    }

    private closePipes(): void {
        const child = this.child;
        if (child === null) return;
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
    }

    private terminate(reason: ProcessTerminationReason): void {
        if (this.child === null || this.settled || this.terminationReason !== null) return;
        this.terminationReason = reason;
        this.terminationPreparation = this.prepareTermination(reason);
    }

    private async prepareTermination(reason: ProcessTerminationReason): Promise<void> {
        try {
            if (this.options.beforeTerminate) await this.options.beforeTerminate(reason);
        } catch (error) {
            this.spawnError ??= asError(error);
        }
        this.signalTermination();
    }

    private signalTermination(): void {
        const child = this.child;
        if (child === null || this.closed || this.settled) return;
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
        if (this.stderrBytes >= this.options.maxStderrBytes) return;
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

    private readonly onStdinError = (error: Error): void => {
        this.options.onStdinError?.(error);
        if (this.options.terminateOnStdinError) {
            this.spawnError ??= error;
            this.terminate("process_failure");
        }
    };

    private readonly onAbort = (): void => {
        this.terminate("explicit_cancellation");
    };
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
