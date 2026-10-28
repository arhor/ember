import type { EmberApplication } from "@ember/application/app/contract.ts";
import type { SurfaceRepositories } from "@ember/application/app/surface-repositories.ts";
import type { Readable, Writable } from "node:stream";

import { EmberError, ValidationError } from "@ember/domain/errors.ts";
import { CommanderError } from "commander";
import { createInterface } from "node:readline";

import { executeOperatorCommand, loadConfiguredState, runLeasedOperator, splitCommand } from "./commands.ts";
import { createSessionProgram } from "./session-program.ts";

export interface CliSurfaceConfig {
    lines?: AsyncIterable<string>;
    principal: string;
    scope: string;
    expectedContinuityBinding?: { lineageId: string; establishedAt: string };
}

interface CliSurfaceIo {
    input: Readable;
    output: Writable;
    error: Writable;
}

export async function runCliSurface(
    config: CliSurfaceConfig,
    io: CliSurfaceIo,
    { application, repositories }: { application: EmberApplication; repositories: SurfaceRepositories },
): Promise<number> {
    const store = repositories.state;
    const initialLease = await store.acquireWriteLease();
    try {
        await loadConfiguredState(store, config);
    } finally {
        await store.releaseWriteLease(initialLease);
    }
    const lines = config.lines ?? createInterface({ input: io.input, crlfDelay: Infinity, terminal: false });
    const iterator = lines[Symbol.asyncIterator]();
    for await (const line of { [Symbol.asyncIterator]: () => iterator }) {
        if (!line.trim()) continue;
        if (!line.startsWith(":")) {
            try {
                await runOrdinaryCliInteraction(config, application, line, io);
            } catch (error) {
                if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
                else throw error;
            }
            continue;
        }
        if (await runSessionLine(line, config, io, application, repositories)) return 0;
    }
    return 0;
}

async function runSessionLine(
    line: string,
    config: CliSurfaceConfig,
    io: CliSurfaceIo,
    application: EmberApplication,
    repositories: SurfaceRepositories,
): Promise<boolean> {
    let argv: string[] | undefined;
    let tokenizeError: EmberError | undefined;
    try {
        argv = splitCommand(line.slice(1));
    } catch (error) {
        if (error instanceof EmberError) tokenizeError = error;
        else throw error;
    }
    if (!tokenizeError && argv?.length === 1 && argv[0] === "quit") return true;
    if (argv?.[0] === "ask" || (tokenizeError !== undefined && isAskRemainder(line.slice(1)))) {
        try {
            if (tokenizeError) throw tokenizeError;
            await runSessionAsk(argv ?? [], config, application, io);
        } catch (error) {
            if (error instanceof CommanderError) {
                if (error.exitCode !== 0) io.error.write(`command rejected: ${error.message}\n`);
            } else if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
            else throw error;
        }
        return false;
    }
    let quit = false;
    await runLeasedOperator(config, io, repositories, async (state, runtimeId) => {
        if (tokenizeError) throw tokenizeError;
        const program = createSessionProgram(io, async (command) => {
            if (command.kind === "quit") {
                quit = true;
                return;
            }
            if (command.kind === "ask") throw new ValidationError("expected :ask --explain ID[,ID...] TEXT");
            await executeOperatorCommand(command, state, runtimeId, config, io, repositories);
        });
        await program.parseAsync(argv ?? [], { from: "user" });
    });
    return quit;
}

function isAskRemainder(remainder: string): boolean {
    const head = remainder.trimStart();
    return head === "ask" || /^ask(?:\s|['"])/.test(head);
}

async function runOrdinaryCliInteraction(
    config: CliSurfaceConfig,
    application: EmberApplication,
    line: string,
    io: CliSurfaceIo,
) {
    const result = await withSigintCancellation((signal) =>
        application.interact(
            {
                kind: "message",
                principal: config.principal,
                scope: config.scope,
                text: line,
                surfaceId: "local_cli",
                principalProvenance: "explicit_local_argument",
            },
            async ({ text }) => {
                await writeCliOutput(io.output, text);
                return { outcome: "confirmed", externalMessageId: null };
            },
            { signal },
        ),
    );
    if (result.diagnostics.providerFailure) io.error.write(`provider: ${result.diagnostics.providerFailure}\n`);
    if (result.diagnostics.memoryProposalFailure)
        io.error.write(`memory proposal: ${result.diagnostics.memoryProposalFailure}\n`);
    if (result.diagnostics.onboardingProgressFailure)
        io.error.write(`onboarding progress: ${result.diagnostics.onboardingProgressFailure}\n`);
    return result;
}

async function writeCliOutput(output: Writable, text: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error | null) => {
            if (settled) return;
            settled = true;
            output.off("error", onError);
            if (error) reject(error);
            else resolve();
        };
        const onError = (error: Error) => finish(error);
        output.once("error", onError);
        try {
            output.write(text, (error) => finish(error));
        } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

async function runSessionAsk(
    argv: string[],
    config: CliSurfaceConfig,
    application: EmberApplication,
    io: CliSurfaceIo,
) {
    const program = createSessionProgram(io, async (command) => {
        if (command.kind !== "ask") throw new ValidationError("expected :ask --explain ID[,ID...] TEXT");
        await runExplanationCliInteraction(config, application, command.explainIds, command.text, io);
    });
    await program.parseAsync(argv, { from: "user" });
}

async function runExplanationCliInteraction(
    config: CliSurfaceConfig,
    application: EmberApplication,
    explainIds: string[],
    text: string,
    io: CliSurfaceIo,
) {
    const result = await withSigintCancellation((signal) =>
        application.interact(
            {
                kind: "message",
                principal: config.principal,
                scope: config.scope,
                text,
                purpose: "explain",
                explainIds,
                surfaceId: "local_cli",
                principalProvenance: "explicit_local_argument",
            },
            async ({ text }) => {
                await writeCliOutput(io.output, text);
                return { outcome: "confirmed", externalMessageId: null };
            },
            { signal },
        ),
    );
    if (result.diagnostics.providerFailure) io.error.write(`provider: ${result.diagnostics.providerFailure}\n`);
}

async function withSigintCancellation<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.once("SIGINT", cancel);
    try {
        return await operation(controller.signal);
    } finally {
        process.off("SIGINT", cancel);
    }
}
