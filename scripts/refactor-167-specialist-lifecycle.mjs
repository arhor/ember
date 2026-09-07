import { readFile, writeFile } from "node:fs/promises";

async function transform(path, callback) {
    const source = await readFile(path, "utf8");
    await writeFile(path, callback(source));
}

await (async () => {
    const lifecyclePath = "src/providers/process-lifecycle.ts";
    const lifecycleTestPath = "src/providers/process-lifecycle.test.ts";
    const runtimeLifecyclePath = "src/runtime/process-lifecycle.ts";
    const runtimeLifecycleTestPath = "src/runtime/process-lifecycle.test.ts";

    await writeFile(
        runtimeLifecyclePath,
        `import type { Readable, Writable } from "node:stream";

import { spawn } from "node:child_process";

export type ProcessTerminationReason =
    | "timeout"
    | "explicit_cancellation"
    | "output_limit"
    | "process_failure";

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

export type ProcessSpawn<TOptions> = (
    command: string,
    arguments_: string[],
    options: TOptions,
) => ProcessChild;

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
`,
    );

    let tests = await readFile(lifecycleTestPath, "utf8");
    const replacements = [
        ["ProviderProcessChild", "ProcessChild"],
        ["ProviderProcessExecution", "ProcessExecution"],
        ["createProviderProcessExecution", "createProcessExecution"],
        ["runProviderProcess", "runProcess"],
    ];
    for (const [before, after] of replacements) tests = tests.split(before).join(after);
    tests = tests.replace('from "./process-lifecycle.ts"', 'from "./process-lifecycle.ts"');
    tests = tests.replace("one provider process run", "one process run");
    tests += `\n\ntest("shared lifecycle waits for pre-termination work before signalling", async () => {\n    const child = new TestChild();\n    let release!: () => void;\n    const gate = new Promise<void>((resolve) => { release = resolve; });\n    const completed = runProcess({\n        command: "provider",\n        arguments_: [],\n        spawnImpl: () => child,\n        spawnOptions: {},\n        stdin: "request",\n        timeoutSeconds: 0.001,\n        maxStdoutBytes: 1024,\n        maxStderrBytes: 1024,\n        terminationGraceMs: 50,\n        finalTerminationMs: 100,\n        beforeTerminate: async () => gate,\n    });\n    await new Promise((resolve) => setTimeout(resolve, 10));\n    assert.deepEqual(child.signals, []);\n    release();\n    await new Promise((resolve) => setImmediate(resolve));\n    assert.equal(child.signals[0], "SIGTERM");\n    child.close(0, "SIGTERM");\n    const result = await completed;\n    assert.equal(result.spawned, true);\n    if (!result.spawned) return;\n    assert.equal(result.terminationReason, "timeout");\n    assert.equal(result.terminationConfirmed, true);\n});\n`;
    await writeFile(runtimeLifecycleTestPath, tests);

    for (const path of ["src/providers/codex.ts", "src/providers/cursor.ts"]) {
        await transform(path, (source) =>
            source
                .replaceAll("ProviderCliSpawn", "CliProcessSpawn")
                .replaceAll("NodeProviderCliSpawn", "NodeCliProcessSpawn")
                .replaceAll("runProviderProcess", "runProcess")
                .replaceAll('"./process-lifecycle.ts"', '"../runtime/process-lifecycle.ts"')
                .replaceAll('"provider_failure"', '"process_failure"'),
        );
    }

    await transform("src/providers/process.ts", (source) =>
        source
            .replace('import { spawn } from "node:child_process";\n', "")
            .replace(
                'import type { ProviderProcessSpawn } from "./process-lifecycle.ts";',
                'import type { PipedProcessSpawn } from "../runtime/process-lifecycle.ts";',
            )
            .replace(
                'import { runProviderProcess } from "./process-lifecycle.ts";',
                'import { NodePipedProcessSpawn, runProcess } from "../runtime/process-lifecycle.ts";',
            )
            .replace(
                'type GenericSpawnOptions = { shell: false; stdio: ["pipe", "pipe", "pipe"] };\ntype SpawnImpl = ProviderProcessSpawn<GenericSpawnOptions>;',
                "type SpawnImpl = PipedProcessSpawn;",
            )
            .replace("spawnImpl = spawn as unknown as SpawnImpl,", "spawnImpl = NodePipedProcessSpawn,")
            .replace(
                'spawnOptions: { shell: false, stdio: ["pipe", "pipe", "pipe"] },',
                "spawnOptions: {},",
            )
            .replaceAll("runProviderProcess", "runProcess")
            .replaceAll('"provider_failure"', '"process_failure"'),
    );

    await transform("src/delegation/codex-specialist.ts", (source) => {
        source = source.replace('import type { Readable, Writable } from "node:stream";\n\n', "");
        source = source.replace('import { spawn } from "node:child_process";\n', "");
        source = source.replace(
            'import { exactKeys, isObject } from "../util.ts";',
            'import type { CliProcessSpawn } from "../runtime/process-lifecycle.ts";\n\nimport { NodeCliProcessSpawn, runProcess } from "../runtime/process-lifecycle.ts";\nimport { exactKeys, isObject } from "../util.ts";',
        );
        const typeStart = source.indexOf("interface SpecialistChild {");
        const typeEnd = source.indexOf("export interface RunCodexSpecialistOptions {");
        if (typeStart < 0 || typeEnd < 0) throw new Error("specialist child type block not found");
        source = source.slice(0, typeStart) + source.slice(typeEnd);
        source = source.replace("spawnImpl?: SpecialistSpawn;", "spawnImpl?: CliProcessSpawn;");

        const start = source.indexOf("    let child: SpecialistChild;");
        const end = source.indexOf('    record.runtime_state = exitObserved ? "exited" : "lost";');
        if (start < 0 || end < 0) throw new Error("specialist lifecycle block not found");
        const replacement = `    let stdinErrorMessage: string | null = null;\n    let terminationPersistenceError: string | null = null;\n\n    const processResult = await runProcess({\n        command: spec.runtime_policy.command,\n        arguments_: args,\n        spawnImpl: options.spawnImpl ?? NodeCliProcessSpawn,\n        spawnOptions: {\n            cwd: workspace,\n            env: codexEnvironment(options.environment),\n        },\n        stdin: prompt,\n        timeoutSeconds,\n        signal: options.signal,\n        maxStdoutBytes: MAX_OUTPUT_BYTES,\n        maxStderrBytes: 64 * 1024,\n        terminationGraceMs: options.terminationGraceMs ?? 500,\n        finalTerminationMs: options.finalTerminationMs ?? 1000,\n        terminateOnStdinError: true,\n        onStdinError: (error) => {\n            stdinErrorMessage = error.message;\n        },\n        onSpawned: async () => {\n            record.runtime_state = "running";\n            record.observations.push({ observedAt: now(), kind: "child_started" });\n            await persistRecord(options.recordPath, record);\n        },\n        beforeTerminate: async (reason) => {\n            record.termination = {\n                reason: reason === "process_failure" ? "boundary_failure" : reason,\n                directChildExitObserved: false,\n                all_specialist_work_stopped: "unknown",\n            };\n            if (reason === "explicit_cancellation") {\n                record.runtime_state = "cancellation_requested";\n                record.observations.push({ observedAt: now(), kind: "cancellation_requested", detail: "cancel" });\n            } else if (reason === "timeout") {\n                record.runtime_state = "timed_out";\n                record.observations.push({ observedAt: now(), kind: "timeout_observed", detail: "timeout" });\n            } else if (reason === "output_limit") {\n                record.observations.push({ observedAt: now(), kind: "output_limit_observed", detail: "output_limit" });\n            }\n            try {\n                await persistRecord(options.recordPath, record);\n            } catch (error) {\n                terminationPersistenceError = errorMessage(error);\n                record.observations.push({\n                    observedAt: now(),\n                    kind: "boundary_failure",\n                    detail: \`Cancellation intent could not be persisted before signalling: \${terminationPersistenceError}\`,\n                });\n            }\n        },\n    });\n\n    if (!processResult.spawned) {\n        record.runtime_state = "lost";\n        record.report_state = "ambiguous";\n        record.observations.push({\n            observedAt: now(),\n            kind: "boundary_failure",\n            detail: processResult.spawnError.message,\n        });\n        await persistRecord(options.recordPath, record);\n        await rm(runtimeDir, { recursive: true, force: true });\n        return record;\n    }\n\n    const {\n        stdout,\n        stderr,\n        spawnError,\n        exitCode,\n        exitSignal,\n        terminationReason,\n        terminationConfirmed: exitObserved,\n    } = processResult;\n`;
        source = source.slice(0, start) + replacement + source.slice(end);
        source = source.replace(
            "if (termination || !exitObserved || spawnErrorMessage || stdinErrorMessage || exitCode !== 0) {",
            "if (terminationReason || !exitObserved || spawnError || stdinErrorMessage || exitCode !== 0) {",
        );
        source = source.replace(
            'diagnosticDecoder.decode(Buffer.concat(stderr)).slice(0, 4096) ||\n            codexErrorDiagnostic(Buffer.concat(stdout));',
            "diagnosticDecoder.decode(stderr).slice(0, 4096) || codexErrorDiagnostic(stdout);",
        );
        source = source.replace(
            'detail: stdinErrorMessage ?? termination ?? spawnErrorMessage ?? (diagnostic || `exit ${exitCode}`),',
            'detail:\n                    stdinErrorMessage ??\n                    (terminationReason === "explicit_cancellation"\n                        ? "cancel"\n                        : terminationReason === "process_failure"\n                          ? "stdin_error"\n                          : terminationReason) ??\n                    spawnError?.message ??\n                    (diagnostic || `exit ${exitCode}`),',
        );
        source = source.replace(
            "parseJsonl(contractDecoder.decode(Buffer.concat(stdout)))",
            "parseJsonl(contractDecoder.decode(stdout))",
        );
        return source;
    });

    await import("node:fs/promises").then(({ rm }) => Promise.all([rm(lifecyclePath), rm(lifecycleTestPath)]));
})();
