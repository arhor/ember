import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";

import { ProviderError, type ProviderErrorOptions, type ProviderOutcome } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, ASCII_CONTROL_CHARACTERS_PATTERN } from "../core/model.ts";
import {
    MAX_PROVIDER_TIMEOUT_SECONDS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
    validateProviderResult,
    type ProviderInvocationOptions,
    type ProviderRequest,
    type ProviderResult,
} from "./contract.ts";

const MAX_PROMPT_BYTES = 1024 * 1024;
const RESULT_SCHEMA_NAME = "provider-result.schema.json";
const decoder = new TextDecoder("utf-8", { fatal: true });
const ENVIRONMENT_ALLOWLIST = [
    "PATH",
    "HOME",
    "CODEX_HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "LANG",
    "LC_ALL",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "NODE_EXTRA_CA_CERTS",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_CACHE_HOME",
] as const;

const RESULT_SCHEMA = `${JSON.stringify(
    {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: false,
        required: ["contract_version", "reply", "used_meaning_ids"],
        properties: {
            contract_version: { type: "integer", const: 1 },
            reply: { type: "string", minLength: 1 },
            used_meaning_ids: { type: "array", items: { type: "string" } },
        },
    },
    null,
    2,
)}\n`;

interface CodexChild {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    kill(signal?: NodeJS.Signals | number): boolean;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    off(event: "close", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

type CodexSpawn = (
    command: string,
    arguments_: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; shell: false; stdio: ["pipe", "pipe", "pipe"] },
) => CodexChild;

export interface InvokeCodexOptions extends ProviderInvocationOptions {
    cwd?: string;
    environment?: NodeJS.ProcessEnv;
    spawnImpl?: CodexSpawn;
    terminationGraceMs?: number;
    finalTerminationMs?: number;
    thread?: { mode: "ephemeral" } | { mode: "fresh_persistent" } | { mode: "resume"; externalThreadId: string };
}

export function buildCodexPrompt(request: ProviderRequest): string {
    return [
        "Act only as a bounded cognition provider for Ember.",
        "The JSON below contains the complete permitted projection and current input for this episode.",
        "Do not use tools, files, prior threads, or outside context.",
        "Return one ProviderResult matching the supplied output schema.",
        "Set used_meaning_ids to only projected meaning IDs materially used in the reply.",
        "The external runtime does not own Ember continuity, memory, canonical state, or authority.",
        "<ember_provider_request>",
        JSON.stringify(request),
        "</ember_provider_request>",
    ].join("\n");
}

export function codexEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const name of ENVIRONMENT_ALLOWLIST) if (source[name] !== undefined) environment[name] = source[name];
    return environment;
}

export function buildCodexArguments(
    argumentPrefix: string[],
    runtimeCwd: string,
    schemaPath: string,
    thread: NonNullable<InvokeCodexOptions["thread"]>,
): string[] {
    const common = [
        "--ignore-user-config",
        "--ignore-rules",
        "--disable",
        "plugins",
        "--disable",
        "apps",
        "-c",
        "skills.include_instructions=false",
        "--skip-git-repo-check",
        "--json",
        "--output-schema",
        schemaPath,
    ];
    if (thread.mode === "resume") {
        if (!validExternalId(thread.externalThreadId))
            throw new ProviderError("Codex resume thread identifier is invalid");
        return [
            ...argumentPrefix,
            "exec",
            "resume",
            ...common,
            "-c",
            'sandbox_mode="read-only"',
            thread.externalThreadId,
            "-",
        ];
    }
    return [
        ...argumentPrefix,
        "exec",
        ...(thread.mode === "ephemeral" ? ["--ephemeral"] : []),
        ...common,
        "--sandbox",
        "read-only",
        "-C",
        runtimeCwd,
        "-",
    ];
}

export async function invokeCodexProvider(
    command: string,
    argumentPrefix: string[],
    request: ProviderRequest,
    {
        timeoutSeconds,
        signal,
        cwd,
        environment = process.env,
        spawnImpl = spawn as unknown as CodexSpawn,
        terminationGraceMs = 500,
        finalTerminationMs = 1_000,
        thread = { mode: "ephemeral" },
    }: InvokeCodexOptions,
): Promise<ProviderResult> {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
    if (signal?.aborted)
        throw new ProviderError("Codex cancellation requested before invocation", {
            outcome: "cancellation_requested",
            termination: { reason: "explicit_cancellation", directChildExitObserved: false },
        });
    const prompt = buildCodexPrompt(request);
    if (Buffer.byteLength(prompt, "utf8") > MAX_PROMPT_BYTES) throw new ProviderError("Codex prompt exceeds 1 MiB");

    const ownsCwd = cwd === undefined;
    const runtimeCwd = cwd ?? (await mkdtemp(join(tmpdir(), "ember-codex-")));
    const schemaPath = join(runtimeCwd, RESULT_SCHEMA_NAME);
    let terminationUnconfirmed = false;
    try {
        await writeFile(schemaPath, RESULT_SCHEMA, { encoding: "utf8", mode: 0o600, flag: "wx" });
        let child: CodexChild;
        try {
            child = spawnImpl(command, buildCodexArguments(argumentPrefix, runtimeCwd, schemaPath, thread), {
                cwd: runtimeCwd,
                env: codexEnvironment(environment),
                shell: false,
                stdio: ["pipe", "pipe", "pipe"],
            });
        } catch (error) {
            throw new ProviderError(`Codex is unavailable: ${errorMessage(error)}`, { cause: error });
        }

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let oversized = false;
        let terminationReason: "timeout" | "explicit_cancellation" | "oversized_stdout" | "provider_failure" | null =
            null;
        let spawnError: Error | null = null;
        let closed = false;
        let exitCode: number | null = null;
        let exitSignal: NodeJS.Signals | null = null;
        let settled = false;
        let killTimer: NodeJS.Timeout | null = null;
        let finalTimer: NodeJS.Timeout | null = null;
        let observedThreadId: string | undefined;
        let lineRemainder = "";

        let resolveDone!: (unconfirmed: boolean) => void;
        const done = new Promise<boolean>((resolve) => {
            resolveDone = resolve;
        });
        const closePipes = () => {
            child.stdin.destroy();
            child.stdout.destroy();
            child.stderr.destroy();
        };
        const terminate = (reason: Exclude<typeof terminationReason, null>) => {
            if (settled || terminationReason !== null) return;
            terminationReason = reason;
            child.stdin.destroy();
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
                    resolveDone(true);
                }
            }, finalTerminationMs);
        };
        const inspectLines = (chunk: Buffer) => {
            lineRemainder += chunk.toString("utf8");
            const lines = lineRemainder.split("\n");
            lineRemainder = lines.pop() ?? "";
            for (const line of lines) {
                try {
                    const event: unknown = JSON.parse(line);
                    if (isRecord(event) && event.type === "thread.started" && validExternalId(event.thread_id))
                        observedThreadId = event.thread_id;
                } catch {}
            }
        };
        const onStdout = (chunk: Buffer) => {
            stdoutBytes += chunk.length;
            if (stdoutBytes <= MAX_STDOUT_BYTES) {
                stdout.push(chunk);
                inspectLines(chunk);
            } else if (!oversized) {
                oversized = true;
                terminate("oversized_stdout");
            }
        };
        const onStderr = (chunk: Buffer) => {
            if (stderrBytes >= MAX_STDERR_BYTES) return;
            const keep = chunk.subarray(0, MAX_STDERR_BYTES - stderrBytes);
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
            if (killTimer) clearTimeout(killTimer);
            if (finalTimer) clearTimeout(finalTimer);
            if (!settled) {
                settled = true;
                resolveDone(false);
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
        if (signal?.aborted) onAbort();
        if (terminationReason === null) {
            try {
                child.stdin.end(prompt);
            } catch (error) {
                spawnError = error instanceof Error ? error : new Error(String(error));
                terminate("provider_failure");
            }
        }

        const unconfirmed = await done;
        clearTimeout(timeoutTimer);
        signal?.removeEventListener("abort", onAbort);
        if (killTimer) clearTimeout(killTimer);
        if (finalTimer) clearTimeout(finalTimer);
        child.stdin.off("error", onStdinError);
        child.stdout.off("data", onStdout);
        child.stderr.off("data", onStderr);
        child.off("error", onSpawnError);
        child.off("close", onClose);
        if (unconfirmed) closePipes();

        const termination =
            terminationReason === null || terminationReason === "provider_failure"
                ? undefined
                : {
                      reason:
                          terminationReason === "explicit_cancellation"
                              ? ("explicit_cancellation" as const)
                              : terminationReason === "timeout"
                                ? ("timeout" as const)
                                : ("output_limit" as const),
                      directChildExitObserved: !unconfirmed,
                  };
        const errorOptions = (outcome: ProviderOutcome, terminationConfirmed = true): ProviderErrorOptions => ({
            outcome,
            terminationConfirmed,
            externalThreadId: observedThreadId,
            termination,
        });
        const diagnostic = decodeDiagnostic(Buffer.concat(stderr));
        const structuredDiagnostic = codexErrorDiagnostic(Buffer.concat(stdout));
        if (unconfirmed) {
            terminationUnconfirmed = true;
            const event =
                terminationReason === "explicit_cancellation"
                    ? "Codex cancellation requested"
                    : terminationReason === "timeout"
                      ? "Codex timed out"
                      : terminationReason === "oversized_stdout"
                        ? "Codex output limit exceeded"
                        : "Codex provider I/O failed";
            throw new ProviderError(
                `${event}; direct-child termination unconfirmed and remote work or effects remain unknown`,
                errorOptions("outcome_unknown", false),
            );
        }
        if (spawnError)
            throw new ProviderError(`Codex is unavailable: ${spawnError.message}`, {
                ...errorOptions("failed"),
                cause: spawnError,
            });
        if (terminationReason === "explicit_cancellation")
            throw new ProviderError(
                "Codex cancellation requested; direct child exit observed but remote work or effects remain unconfirmed",
                errorOptions("cancellation_requested"),
            );
        if (terminationReason === "timeout")
            throw new ProviderError(
                `Codex timed out; direct child exit observed but remote work or effects remain unconfirmed${diagnostic ? `: ${diagnostic}` : ""}`,
                errorOptions("timed_out"),
            );
        if (terminationReason === "oversized_stdout" || oversized || stdoutBytes > MAX_STDOUT_BYTES)
            throw new ProviderError("Codex JSONL output exceeds 1 MiB", errorOptions("failed"));
        if (exitCode !== 0) {
            const detail = diagnostic || structuredDiagnostic;
            throw new ProviderError(
                `Codex exited with ${exitSignal ? `signal ${exitSignal}` : `status ${exitCode}`}${detail ? `: ${detail}` : ""}`,
                errorOptions("failed"),
            );
        }

        let stdoutText: string;
        try {
            stdoutText = decoder.decode(Buffer.concat(stdout));
        } catch (error) {
            throw new ProviderError("Codex JSONL output is not UTF-8", { ...errorOptions("failed"), cause: error });
        }
        const parsed = parseCodexJsonl(stdoutText);
        if (observedThreadId !== undefined && parsed.externalThreadId !== observedThreadId)
            throw new ProviderError("Codex JSONL contains inconsistent thread identifiers", errorOptions("failed"));
        if (
            thread.mode === "resume" &&
            parsed.externalThreadId !== undefined &&
            parsed.externalThreadId !== thread.externalThreadId
        )
            throw new ProviderError("Codex resumed a different thread than requested", errorOptions("failed"));
        validateProviderResult(parsed.result, new Set(request.projection.selection.meaning_ids));
        return parsed.externalThreadId === undefined
            ? parsed.result
            : { ...parsed.result, operational: { external_thread_id: parsed.externalThreadId } };
    } finally {
        if (ownsCwd && !terminationUnconfirmed) await rm(runtimeCwd, { recursive: true, force: true }).catch(() => {});
    }
}

function parseCodexJsonl(output: string): { result: ProviderResult; externalThreadId?: string } {
    let externalThreadId: string | undefined;
    let candidate: unknown;
    let agentMessages = 0;
    for (const [index, line] of output.split("\n").entries()) {
        if (!line.trim()) continue;
        let event: unknown;
        try {
            event = JSON.parse(line);
        } catch (error) {
            throw new ProviderError(`Codex JSONL line ${index + 1} is invalid JSON: ${errorMessage(error)}`, {
                cause: error,
            });
        }
        if (!isRecord(event) || typeof event.type !== "string" || !event.type.trim())
            throw new ProviderError(`Codex JSONL line ${index + 1} is not a typed event object`);
        if (event.type === "thread.started") {
            if (!validExternalId(event.thread_id))
                throw new ProviderError("Codex thread.started event has an invalid thread identifier");
            if (externalThreadId !== undefined && externalThreadId !== event.thread_id)
                throw new ProviderError("Codex JSONL contains inconsistent thread identifiers");
            externalThreadId = event.thread_id;
        }
        if (event.type === "item.completed" && isRecord(event.item) && event.item.type === "agent_message") {
            if (typeof event.item.text !== "string") throw new ProviderError("Codex agent message is invalid");
            agentMessages += 1;
            try {
                candidate = JSON.parse(event.item.text);
            } catch (error) {
                throw new ProviderError(`Codex final agent message is not JSON: ${errorMessage(error)}`, {
                    cause: error,
                });
            }
        }
    }
    if (agentMessages !== 1) throw new ProviderError("Codex JSONL must contain exactly one completed agent message");
    return { result: candidate as ProviderResult, externalThreadId };
}

function validExternalId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 512 &&
        !ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function decodeDiagnostic(bytes: Uint8Array): string {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}

function codexErrorDiagnostic(bytes: Uint8Array): string {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    for (const line of text.split("\n")) {
        try {
            const event: unknown = JSON.parse(line);
            if (!isRecord(event)) continue;
            const message =
                event.type === "error" && typeof event.message === "string"
                    ? event.message
                    : event.type === "turn.failed" && isRecord(event.error) && typeof event.error.message === "string"
                      ? event.error.message
                      : null;
            if (message !== null) return message.replace(ASCII_CONTROL_CHARACTERS_PATTERN, " ").trim().slice(0, 4096);
        } catch {}
    }
    return "";
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
