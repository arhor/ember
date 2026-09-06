import { spawn } from "node:child_process";
import { basename } from "node:path";

import type { ProviderInvocationOptions, ProviderRequest, ProviderResult } from "./contract.ts";
import type { ProviderProcessSpawn } from "./process-lifecycle.ts";

import { ProviderError } from "../core/errors.ts";
import {
    MAX_PROVIDER_TIMEOUT_SECONDS,
    MAX_STDERR_BYTES,
    MAX_STDOUT_BYTES,
    validateProviderResult,
} from "./contract.ts";
import { runProviderProcess } from "./process-lifecycle.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });

type GenericSpawnOptions = { shell: false; stdio: ["pipe", "pipe", "pipe"] };
type SpawnImpl = ProviderProcessSpawn<GenericSpawnOptions>;

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

    const processResult = await runProviderProcess({
        command,
        arguments_,
        spawnImpl,
        spawnOptions: { shell: false, stdio: ["pipe", "pipe", "pipe"] },
        stdin: Buffer.from(JSON.stringify(request), "utf8"),
        timeoutSeconds,
        signal,
        maxStdoutBytes: MAX_STDOUT_BYTES,
        maxStderrBytes: MAX_STDERR_BYTES,
        terminationGraceMs,
        finalTerminationMs,
        destroyOutputOnTerminate: true,
    });

    if (!processResult.spawned)
        throw new ProviderError(`provider is unavailable: ${processResult.spawnError.message}`, {
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
        terminationConfirmed,
    } = processResult;
    const diagnostic = decodeDiagnostic(stderr);

    if (!terminationConfirmed) {
        if (terminationReason === "provider_failure")
            throw new ProviderError("provider I/O failed; direct-child termination unconfirmed", {
                outcome: "outcome_unknown",
                terminationConfirmed: false,
                cause: spawnError ?? undefined,
            });
        const reason = terminationReason ?? "output_limit";
        throw new ProviderError(
            `${reason === "explicit_cancellation" ? "provider cancellation requested" : reason === "timeout" ? "provider timed out" : outputLimited ? "provider stdout exceeds 1 MiB" : "provider termination was not observed"}; direct-child termination unconfirmed`,
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
    if (terminationReason === "output_limit" || outputLimited || stdoutBytes > MAX_STDOUT_BYTES)
        throw new ProviderError("provider stdout exceeds 1 MiB", {
            termination: { reason: "output_limit", directChildExitObserved: true },
        });
    if (exitCode !== 0)
        throw new ProviderError(
            `provider exited with ${exitSignal ? `signal ${exitSignal}` : `status ${exitCode}`}${diagnostic ? `: ${diagnostic}` : ""}`,
        );

    let text: string;
    try {
        text = decoder.decode(stdout);
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
