import { readFile, writeFile } from "node:fs/promises";

await refactorCodex();
await refactorCursor();

async function refactorCodex() {
    const path = "src/providers/codex.ts";
    let source = await readFile(path, "utf8");

    source = source.replace('import type { Readable, Writable } from "node:stream";\n\n', "");
    source = source.replace(
        'import type { ProviderInvocationOptions, ProviderRequest, ProviderResult } from "./contract.ts";\n',
        'import type { ProviderInvocationOptions, ProviderRequest, ProviderResult } from "./contract.ts";\nimport type { ProviderProcessSpawn } from "./process-lifecycle.ts";\n',
    );
    source = source.replace(
        '} from "./contract.ts";\n\nconst MAX_PROMPT_BYTES',
        '} from "./contract.ts";\nimport { runProviderProcess } from "./process-lifecycle.ts";\n\nconst MAX_PROMPT_BYTES',
    );

    source = replaceBetween(
        source,
        "interface CodexChild {",
        "export interface InvokeCodexOptions",
        `type CodexSpawnOptions = {
    cwd: string;
    env: NodeJS.ProcessEnv;
    shell: false;
    stdio: ["pipe", "pipe", "pipe"];
};
type CodexSpawn = ProviderProcessSpawn<CodexSpawnOptions>;

`,
    );

    source = replaceBetween(
        source,
        "        let child: CodexChild;",
        "        if (unconfirmed) {",
        `        let observedThreadId: string | undefined;
        let lineRemainder = "";
        const inspectLines = (chunk: Buffer) => {
            lineRemainder += chunk.toString("utf8");
            const lines = lineRemainder.split("\\n");
            lineRemainder = lines.pop() ?? "";
            for (const line of lines) {
                try {
                    const event: unknown = JSON.parse(line);
                    if (isObject(event) && event.type === "thread.started" && validExternalId(event.thread_id))
                        observedThreadId = event.thread_id;
                } catch {}
            }
        };
        const processResult = await runProviderProcess({
            command,
            arguments_: buildCodexArguments(argumentPrefix, runtimeCwd, schemaPath, thread),
            spawnImpl,
            spawnOptions: {
                cwd: runtimeCwd,
                env: codexEnvironment(environment),
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
            onStdoutChunk: inspectLines,
        });
        if (!processResult.spawned)
            throw new ProviderError(\`Codex is unavailable: \${processResult.spawnError.message}\`, {
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
        const errorOptions = (outcome: ProviderOutcome, terminationConfirmed = true): ProviderErrorOptions => ({
            outcome,
            terminationConfirmed,
            externalThreadId: observedThreadId,
            termination,
        });
        const diagnostic = decodeDiagnostic(stderr);
        const structuredDiagnostic = codexErrorDiagnostic(stdout);
`,
    );

    source = source.replaceAll('terminationReason === "oversized_stdout"', 'terminationReason === "output_limit"');
    source = source.replaceAll("oversized || stdoutBytes > MAX_STDOUT_BYTES", "outputLimited || stdoutBytes > MAX_STDOUT_BYTES");
    source = source.replaceAll("Buffer.concat(stdout)", "stdout");

    await writeFile(path, source);
}

async function refactorCursor() {
    const path = "src/providers/cursor.ts";
    let source = await readFile(path, "utf8");

    source = source.replace('import type { Readable, Writable } from "node:stream";\n\n', "");
    source = source.replace(
        'import type { ProviderInvocationOptions, ProviderRequest, ProviderResult } from "./contract.ts";\n',
        'import type { ProviderInvocationOptions, ProviderRequest, ProviderResult } from "./contract.ts";\nimport type { ProviderProcessSpawn } from "./process-lifecycle.ts";\n',
    );
    source = source.replace(
        '} from "./contract.ts";\n\nconst MAX_PROMPT_BYTES',
        '} from "./contract.ts";\nimport { runProviderProcess } from "./process-lifecycle.ts";\n\nconst MAX_PROMPT_BYTES',
    );

    source = replaceBetween(
        source,
        "interface CursorChild {",
        "export interface InvokeCursorOptions",
        `type CursorSpawnOptions = {
    cwd: string;
    env: NodeJS.ProcessEnv;
    shell: false;
    stdio: ["pipe", "pipe", "pipe"];
};
type CursorSpawn = ProviderProcessSpawn<CursorSpawnOptions>;

`,
    );

    source = replaceBetween(
        source,
        "        let child: CursorChild;",
        "        if (unconfirmed) {",
        `        const processResult = await runProviderProcess({
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
            throw new ProviderError(\`Cursor is unavailable: \${processResult.spawnError.message}\`, {
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
`,
    );

    source = source.replaceAll('terminationReason === "oversized_stdout"', 'terminationReason === "output_limit"');
    source = source.replaceAll("oversized || stdoutBytes > MAX_STDOUT_BYTES", "outputLimited || stdoutBytes > MAX_STDOUT_BYTES");
    source = source.replaceAll("Buffer.concat(stdout)", "stdout");

    await writeFile(path, source);
}

function replaceBetween(source, startMarker, endMarker, replacement) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    if (start < 0 || end < 0) {
        throw new Error(`refactor marker not found: ${startMarker} -> ${endMarker}`);
    }
    return source.slice(0, start) + replacement + source.slice(end);
}
