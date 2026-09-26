import type { Readable, Writable } from "node:stream";

import { createInterface } from "node:readline";

import type { EmberApplication, TrustedHostSetupRequest, TrustedHostSetupResult } from "../../app/contract.ts";
import type { SurfaceRepositories } from "../../app/surface-repositories.ts";

import { EmberError, ValidationError } from "../../core/errors.ts";
import { loadConfiguredState, runCliCommand, splitCommand } from "./commands.ts";

export interface CliSurfaceConfig {
    lines?: AsyncIterable<string>;
    principal: string;
    scope: string;
    expectedContinuityBinding?: { lineageId: string; establishedAt: string };
    trustedHostSetup?: (request: TrustedHostSetupRequest) => Promise<TrustedHostSetupResult>;
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
        if (line === ":quit") return 0;
        if (!line.startsWith(":")) {
            try {
                const result = await runOrdinaryCliInteraction(config, application, line, io);
                if (result.setupIntent === "telegram" && !result.replayed && config.trustedHostSetup) {
                    io.output.write("Start Telegram setup on this host? [yes/no]: ");
                    const answer = await iterator.next();
                    if (answer.done || answer.value.trim().toLowerCase() !== "yes") {
                        io.output.write("Telegram setup cancelled.\n");
                    } else {
                        try {
                            const setup = await config.trustedHostSetup({
                                intent: "telegram",
                                principal: config.principal,
                                scope: config.scope,
                                proposalOccurrenceId: result.occurrenceId,
                                confirmedBy: {
                                    principal: config.principal,
                                    provenance: "explicit_local_prompt",
                                    response: "yes",
                                },
                            });
                            io.output.write(`Telegram setup: ${setup.status}. Resuming conversation.\n`);
                        } catch {
                            io.error.write("Telegram setup failed at the trusted host. Resuming conversation.\n");
                        }
                    }
                }
            } catch (error) {
                if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
                else throw error;
            }
            continue;
        }
        if (line.startsWith(":ask ")) {
            try {
                await runExplanationCliInteraction(config, application, line, io);
            } catch (error) {
                if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
                else throw error;
            }
            continue;
        }
        await runCliCommand(line, config, io, repositories);
    }
    return 0;
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
                trustedHostSetupAvailable: config.trustedHostSetup !== undefined,
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

async function runExplanationCliInteraction(
    config: CliSurfaceConfig,
    application: EmberApplication,
    line: string,
    io: CliSurfaceIo,
) {
    const parts = splitCommand(line);
    if (parts.length < 4 || parts[0] !== ":ask" || parts[1] !== "--explain")
        throw new ValidationError("expected :ask --explain ID[,ID...] TEXT");
    const ids = parts[2]!.split(",").filter(Boolean);
    if (!ids.length) throw new ValidationError("at least one explanation ID is required");
    const result = await withSigintCancellation((signal) =>
        application.interact(
            {
                kind: "message",
                principal: config.principal,
                scope: config.scope,
                text: parts.slice(3).join(" "),
                purpose: "explain",
                explainIds: ids,
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
