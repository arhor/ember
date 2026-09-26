import type { PipedProcessSpawn } from "../../../host/process-lifecycle.ts";
import type { AiExecutionOptions, AiExecutor, AiExecutionRequest, AiExecutionResult } from "../contract.ts";

import { isTimeoutAbort, NodePipedProcessSpawn, runProcess } from "../../../host/process-lifecycle.ts";
import { ProviderError } from "../../errors.ts";
import { MAX_AI_TIMEOUT_SECONDS, MAX_STDERR_BYTES, MAX_STDOUT_BYTES, validateAiExecutionResult } from "../contract.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });

type SpawnImpl = PipedProcessSpawn;

export interface InvokeProviderOptions extends AiExecutionOptions {
    spawnImpl?: SpawnImpl;
    terminationGraceMs?: number;
    finalTerminationMs?: number;
}

export interface ProcessProviderConfig {
    command: string;
    arguments_?: string[];
    spawnImpl?: SpawnImpl;
    terminationGraceMs?: number;
    finalTerminationMs?: number;
}

export function createProcessProvider({
    command,
    arguments_: args = [],
    spawnImpl,
    terminationGraceMs,
    finalTerminationMs,
}: ProcessProviderConfig): AiExecutor {
    return (request, options) =>
        invokeProvider(command, args, request, {
            ...options,
            ...(spawnImpl === undefined ? {} : { spawnImpl }),
            ...(terminationGraceMs === undefined ? {} : { terminationGraceMs }),
            ...(finalTerminationMs === undefined ? {} : { finalTerminationMs }),
        });
}

export async function invokeProvider(
    command: string,
    arguments_: string[],
    request: AiExecutionRequest,
    {
        timeoutSeconds,
        signal,
        spawnImpl = NodePipedProcessSpawn,
        terminationGraceMs = 100,
        finalTerminationMs = 500,
    }: InvokeProviderOptions,
): Promise<AiExecutionResult> {
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0)
        throw new ProviderError("provider timeout must be a positive finite number");
    if (timeoutSeconds > MAX_AI_TIMEOUT_SECONDS)
        throw new ProviderError(`provider timeout must not exceed ${MAX_AI_TIMEOUT_SECONDS} seconds`);
    if (signal?.aborted) {
        const timedOut = isTimeoutAbort(signal.reason);
        throw new ProviderError(
            timedOut ? "provider timed out before invocation" : "provider cancellation requested before invocation",
            {
                outcome: timedOut ? "timed_out" : "cancellation_requested",
                termination: {
                    reason: timedOut ? "timeout" : "explicit_cancellation",
                    directChildExitObserved: false,
                },
            },
        );
    }

    const processResult = await runProcess({
        command,
        arguments_,
        spawnImpl,
        spawnOptions: {},
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
        if (terminationReason === "process_failure")
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
    validateAiExecutionResult(result, new Set(request.projection.selection.meaning_ids));
    return result;
}

function decodeDiagnostic(bytes: Uint8Array) {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
