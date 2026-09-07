import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ProviderErrorOptions, ProviderOutcome } from "../core/errors.ts";
import type { ProviderInvocationOptions, ProviderRequest, ProviderResult } from "./contract.ts";
import type { ProviderCliSpawn } from "./process-lifecycle.ts";

import { ProviderError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, ASCII_CONTROL_CHARACTERS_PATTERN } from "../core/model.ts";
import { isObject } from "../util.ts";
import {
    MAX_PROVIDER_TIMEOUT_SECONDS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
    validateProviderResult,
} from "./contract.ts";
import { nodeProviderCliSpawn, runProviderProcess } from "./process-lifecycle.ts";

const MAX_PROMPT_BYTES = 1024 * 1024;
const CURSOR_CONFIG_DIRECTORY = ".cursor";
const CURSOR_CONFIG_NAME = "cli.json";
const decoder = new TextDecoder("utf-8", { fatal: true });
const ENVIRONMENT_ALLOWLIST = [
    "PATH",
    "HOME",
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
const TOOL_DENY_CONFIG = `${JSON.stringify({ permissions: { allow: [], deny: ["Shell(*)", "Read(*)", "Read(**)", "Write(*)", "Write(**)", "WebFetch(*)", "Mcp(*:*)"] } }, null, 2)}\n`;

export interface InvokeCursorOptions extends ProviderInvocationOptions {
    cwd?: string;
    environment?: NodeJS.ProcessEnv;
    spawnImpl?: ProviderCliSpawn;
    session?: { mode: "fresh" } | { mode: "resume"; externalSessionId: string };
    terminationGraceMs?: number;
    finalTerminationMs?: number;
}

export function buildCursorPrompt(request: ProviderRequest): string {
    return [
        "Act only as a bounded cognition provider for Ember.",
        "The JSON below contains the complete permitted projection and current input for this episode.",
        "Do not use tools, files, prior sessions, or outside context.",
        "Return exactly one JSON object with only contractVersion, reply, and usedMeaningIds.",
        "contractVersion must be 1; reply must be a non-empty string; usedMeaningIds must contain only projected meaning IDs materially used in the reply.",
        "The external runtime does not own Ember continuity, memory, canonical state, or authority.",
        "<ember_provider_request>",
        JSON.stringify(request),
        "</ember_provider_request>",
    ].join("\n");
}

export function cursorEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const name of ENVIRONMENT_ALLOWLIST) if (source[name] !== undefined) environment[name] = source[name];
    return environment;
}

export function buildCursorArguments(
    prefix: string[],
    runtimeCwd: string,
    session: NonNullable<InvokeCursorOptions["session"]>,
): string[] {
    validateCursorArguments(prefix);
    const common = [
        "-p",
        "--output-format",
        "json",
        "--mode",
        "ask",
        "--sandbox",
        "enabled",
        "--trust",
        "--workspace",
        runtimeCwd,
    ];
    if (session.mode === "resume") {
        if (!validExternalId(session.externalSessionId))
            throw new ProviderError("Cursor resume session identifier is invalid");
        return [...prefix, ...common, "--resume", session.externalSessionId];
    }
    return [...prefix, ...common];
}

export function validateCursorArguments(arguments_: string[]): void {
    let modelSeen = false;
    for (let index = 0; index < arguments_.length; index += 1) {
        const argument = arguments_[index]!;
        if (argument.startsWith("--model=") || argument.startsWith("-m=")) {
            if (modelSeen || !argument.slice(argument.indexOf("=") + 1).trim())
                throw new ProviderError("Cursor model selection must be supplied once with a non-empty value");
            modelSeen = true;
            continue;
        }
        if (argument === "--model" || argument === "-m") {
            if (modelSeen || index + 1 >= arguments_.length || !arguments_[index + 1]!.trim())
                throw new ProviderError("Cursor model selection must be supplied once with a non-empty value");
            modelSeen = true;
            index += 1;
            continue;
        }
        throw new ProviderError(`unsupported Cursor adapter argument: ${argument}`);
    }
}

export async function invokeCursorProvider(
    command: string,
    argumentPrefix: string[],
    request: ProviderRequest,
    {
        timeoutSeconds,
        signal,
        cwd,
        environment = process.env,
        spawnImpl = nodeProviderCliSpawn,
        terminationGraceMs = 500,
        finalTerminationMs = 1_000,
        session = { mode: "fresh" },
    }: InvokeCursorOptions,
): Promise<ProviderResult> {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_PROVIDER_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS} seconds`);
    if (signal?.aborted)
        throw new ProviderError("Cursor cancellation requested before invocation", {
            outcome: "cancellation_requested",
            termination: { reason: "explicit_cancellation", directChildExitObserved: false },
        });
    const prompt = buildCursorPrompt(request);
    if (Buffer.byteLength(prompt, "utf8") > MAX_PROMPT_BYTES) throw new ProviderError("Cursor prompt exceeds 1 MiB");

    const ownsCwd = cwd === undefined;
    const runtimeCwd = cwd ?? (await mkdtemp(join(tmpdir(), "ember-cursor-")));
    let terminationUnconfirmed = false;
    try {
        const configDirectory = join(runtimeCwd, CURSOR_CONFIG_DIRECTORY);
        await mkdir(configDirectory, { mode: 0o700 });
        await writeFile(join(configDirectory, CURSOR_CONFIG_NAME), TOOL_DENY_CONFIG, {
            encoding: "utf8",
            mode: 0o600,
            flag: "wx",
        });
        const processResult = await runProviderProcess({
            command,
            arguments_: buildCursorArguments(argumentPrefix, runtimeCwd, session),
            spawnImpl,
            spawnOptions: {
                cwd: runtimeCwd,
                env: cursorEnvironment(environment),
                shell: false,
                stdio: ["pipe", "pipe", "pipe"],
            },
            stdin: prompt,
            timeoutSeconds,
            signal,
            maxStdoutBytes: MAX_STDOUT_BYTES,
            maxStderrBytes: MAX_STDERR_BYTES,
            terminationGraceMs,
            finalTerminationMs,
        });
        if (!processResult.spawned)
            throw new ProviderError(`Cursor is unavailable: ${processResult.spawnError.message}`, {
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
            terminationReason === null || terminationReason === "provider_failure"
                ? undefined
                : { reason: terminationReason, directChildExitObserved };
        const errorOptions = (
            outcome: ProviderOutcome,
            terminationConfirmed = true,
            externalThreadId?: string,
        ): ProviderErrorOptions => ({ outcome, terminationConfirmed, externalThreadId, termination });
        const diagnostic = decodeDiagnostic(stderr);
        if (unconfirmed) {
            terminationUnconfirmed = true;
            const event =
                terminationReason === "explicit_cancellation"
                    ? "Cursor cancellation requested"
                    : terminationReason === "timeout"
                      ? "Cursor timed out"
                      : terminationReason === "output_limit"
                        ? "Cursor output limit exceeded"
                        : "Cursor provider I/O failed";
            throw new ProviderError(
                `${event}; direct-child termination unconfirmed and remote work or effects remain unknown`,
                errorOptions("outcome_unknown", false),
            );
        }
        if (spawnError)
            throw new ProviderError(`Cursor is unavailable: ${spawnError.message}`, {
                ...errorOptions("failed"),
                cause: spawnError,
            });
        if (terminationReason === "explicit_cancellation")
            throw new ProviderError(
                "Cursor cancellation requested; direct child exit observed but remote work or effects remain unconfirmed",
                errorOptions("cancellation_requested"),
            );
        if (terminationReason === "timeout")
            throw new ProviderError(
                `Cursor timed out; direct child exit observed but remote work or effects remain unconfirmed${diagnostic ? `: ${diagnostic}` : ""}`,
                errorOptions("timed_out"),
            );
        if (terminationReason === "output_limit" || outputLimited || stdoutBytes > MAX_STDOUT_BYTES)
            throw new ProviderError("Cursor JSON output exceeds 1 MiB", errorOptions("failed"));
        if (exitCode !== 0)
            throw new ProviderError(
                `Cursor exited with ${exitSignal ? `signal ${exitSignal}` : `status ${exitCode}`}${diagnostic ? `: ${diagnostic}` : ""}`,
                errorOptions("failed"),
            );

        let text: string;
        try {
            text = decoder.decode(stdout);
        } catch (error) {
            throw new ProviderError("Cursor JSON output is not UTF-8", { ...errorOptions("failed"), cause: error });
        }
        const parsed = parseCursorResult(text);
        if (session.mode === "resume" && parsed.externalSessionId !== session.externalSessionId)
            throw new ProviderError(
                "Cursor resumed a different session than requested",
                errorOptions("failed", true, parsed.externalSessionId),
            );
        validateProviderResult(parsed.result, new Set(request.projection.selection.meaning_ids));
        return { ...parsed.result, operational: { externalThreadId: parsed.externalSessionId } };
    } finally {
        if (ownsCwd && !terminationUnconfirmed) await rm(runtimeCwd, { recursive: true, force: true }).catch(() => {});
    }
}

function parseCursorResult(output: string): { result: ProviderResult; externalSessionId: string } {
    let envelope: unknown;
    try {
        envelope = JSON.parse(output);
    } catch (error) {
        throw new ProviderError(`Cursor stdout is not exactly one JSON object: ${errorMessage(error)}`, {
            cause: error,
        });
    }
    if (
        !isObject(envelope) ||
        envelope.type !== "result" ||
        envelope.subtype !== "success" ||
        envelope.is_error !== false
    )
        throw new ProviderError("Cursor JSON result envelope is not a successful terminal result");
    if (!validExternalId(envelope.session_id))
        throw new ProviderError("Cursor result has an invalid session identifier");
    if (typeof envelope.result !== "string") throw new ProviderError("Cursor result payload is not a string");
    let result: unknown;
    try {
        result = JSON.parse(envelope.result);
    } catch (error) {
        throw new ProviderError(`Cursor final result is not JSON: ${errorMessage(error)}`, { cause: error });
    }
    return { result: result as ProviderResult, externalSessionId: envelope.session_id };
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
    return new TextDecoder("utf-8", { fatal: false })
        .decode(bytes)
        .replace(ASCII_CONTROL_CHARACTERS_PATTERN, " ")
        .trim()
        .slice(0, 4096);
}
function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
