import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProviderErrorOptions, ProviderOutcome } from "../core/errors.ts";
import type { CliProcessSpawn } from "../runtime/process-lifecycle.ts";
import type { ProviderInvocationOptions, ProviderInvoker, ProviderRequest, ProviderResult } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, ASCII_CONTROL_CHARACTERS_PATTERN } from "../core/model.ts";
import { NodeCliProcessSpawn, runProcess } from "../runtime/process-lifecycle.ts";
import { isObject } from "../util.ts";
import {
    MAX_PROVIDER_TIMEOUT_SECONDS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
    validateProviderResult,
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
        required: ["contractVersion", "reply", "usedMeaningIds"],
        properties: {
            contractVersion: { type: "integer", const: 1 },
            reply: { type: "string", minLength: 1 },
            usedMeaningIds: { type: "array", items: { type: "string" } },
        },
    },
    null,
    2,
)}\n`;

export interface InvokeCodexOptions extends ProviderInvocationOptions {
    cwd?: string;
    environment?: NodeJS.ProcessEnv;
    spawnImpl?: CliProcessSpawn;
    terminationGraceMs?: number;
    finalTerminationMs?: number;
    thread?:
        | { mode: "ephemeral" }
        | { mode: "fresh_persistent" }
        | { mode: "resume"; externalThreadId: string }
        | undefined;
}

export interface CodexProviderConfig {
    command?: string;
    arguments_?: string[];
    cwd?: string;
    environment?: NodeJS.ProcessEnv;
    spawnImpl?: CliProcessSpawn;
    terminationGraceMs?: number;
    finalTerminationMs?: number;
    thread?: InvokeCodexOptions["thread"];
}

export function createCodexProvider({
    command = "codex",
    arguments_: args = [],
    ...adapterOptions
}: CodexProviderConfig = {}): ProviderInvoker {
    return (request, options) => invokeCodexProvider(command, args, request, { ...adapterOptions, ...options });
}

export function buildCodexPrompt(request: ProviderRequest): string {
    return [
        "Act only as a bounded cognition provider for Ember.",
        "The JSON below contains the complete permitted projection and current input for this episode.",
        "Do not use tools, files, prior threads, or outside context.",
        "Return one ProviderResult matching the supplied output schema.",
        "Set usedMeaningIds to only projected meaning IDs materially used in the reply.",
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
        spawnImpl = NodeCliProcessSpawn,
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
        let observedThreadId: string | undefined;
        let lineRemainder = "";
        const inspectLines = (chunk: Buffer) => {
            lineRemainder += chunk.toString("utf8");
            const lines = lineRemainder.split("\n");
            lineRemainder = lines.pop() ?? "";
            for (const line of lines) {
                try {
                    const event: unknown = JSON.parse(line);
                    if (isObject(event) && event.type === "thread.started" && validExternalId(event.thread_id))
                        observedThreadId = event.thread_id;
                } catch {}
            }
        };
        const processResult = await runProcess({
            command,
            arguments_: buildCodexArguments(argumentPrefix, runtimeCwd, schemaPath, thread),
            spawnImpl,
            spawnOptions: {
                cwd: runtimeCwd,
                env: codexEnvironment(environment),
            },
            stdin: prompt,
            timeoutSeconds,
            signal,
            maxStdoutBytes: MAX_STDOUT_BYTES,
            maxStderrBytes: MAX_STDERR_BYTES,
            terminationGraceMs,
            finalTerminationMs,
            onStdoutChunk: inspectLines,
        });
        if (!processResult.spawned)
            throw new ProviderError(`Codex is unavailable: ${processResult.spawnError.message}`, {
                cause: processResult.spawnError,
            });

        const {
            stdout,
            stderr,
            stdoutBytes,
            outputLimited,
            spawnError,
            exitCode,
            exitSignal,
            terminationReason,
            terminationConfirmed: directChildExitObserved,
        } = processResult;
        const unconfirmed = !directChildExitObserved;
        const termination =
            terminationReason === null || terminationReason === "process_failure"
                ? undefined
                : { reason: terminationReason, directChildExitObserved };
        const errorOptions = (outcome: ProviderOutcome, terminationConfirmed = true): ProviderErrorOptions => ({
            outcome,
            terminationConfirmed,
            externalThreadId: observedThreadId,
            termination,
        });
        const diagnostic = decodeDiagnostic(stderr);
        const structuredDiagnostic = codexErrorDiagnostic(stdout);
        if (unconfirmed) {
            terminationUnconfirmed = true;
            const event =
                terminationReason === "explicit_cancellation"
                    ? "Codex cancellation requested"
                    : terminationReason === "timeout"
                      ? "Codex timed out"
                      : terminationReason === "output_limit"
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
        if (terminationReason === "output_limit" || outputLimited || stdoutBytes > MAX_STDOUT_BYTES)
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
            stdoutText = decoder.decode(stdout);
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
            : { ...parsed.result, operational: { externalThreadId: parsed.externalThreadId } };
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
        if (!isObject(event) || typeof event.type !== "string" || !event.type.trim())
            throw new ProviderError(`Codex JSONL line ${index + 1} is not a typed event object`);
        if (event.type === "thread.started") {
            if (!validExternalId(event.thread_id))
                throw new ProviderError("Codex thread.started event has an invalid thread identifier");
            if (externalThreadId !== undefined && externalThreadId !== event.thread_id)
                throw new ProviderError("Codex JSONL contains inconsistent thread identifiers");
            externalThreadId = event.thread_id;
        }
        if (event.type === "item.completed" && isObject(event.item) && event.item.type === "agent_message") {
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
    return externalThreadId === undefined
        ? { result: candidate as ProviderResult }
        : { result: candidate as ProviderResult, externalThreadId };
}

function validExternalId(value: unknown): value is string {
    return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= 512 &&
        !ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    );
}

function decodeDiagnostic(bytes: Uint8Array): string {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}

function codexErrorDiagnostic(bytes: Uint8Array): string {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    for (const line of text.split("\n")) {
        try {
            const event: unknown = JSON.parse(line);
            if (!isObject(event)) continue;
            const message =
                event.type === "error" && typeof event.message === "string"
                    ? event.message
                    : event.type === "turn.failed" && isObject(event.error) && typeof event.error.message === "string"
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
