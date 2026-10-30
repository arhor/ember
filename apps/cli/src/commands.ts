import type { SurfaceRepositories } from "@ember/application/app/surface-repositories.ts";
import type { EmberState, RuntimeId } from "@ember/domain/model.ts";
import type { Writable } from "node:stream";

import { executeCommand } from "@ember/application/commands/execute.ts";
import { EmberError, ValidationError } from "@ember/domain/errors.ts";
import { startRuntime, stopRuntime } from "@ember/domain/runtime-episode.ts";
import { CommanderError } from "commander";

import type { SessionCommand } from "./session-program.ts";
import type { CliSurfaceConfig } from "./surface.ts";

type CliStateRepository = SurfaceRepositories["state"];
type OperatorCommand = Exclude<SessionCommand, { kind: "ask" | "quit" }>;

export async function runLeasedOperator(
    config: CliSurfaceConfig,
    io: { output: Writable; error: Writable },
    repositories: SurfaceRepositories,
    work: (state: EmberState, runtimeId: RuntimeId) => Promise<void>,
) {
    await withCliLease(repositories.state, config, async (state, runtimeId) => {
        try {
            await work(state, runtimeId);
        } catch (error) {
            if (error instanceof CommanderError) {
                if (error.exitCode !== 0) io.error.write(`command rejected: ${error.message}\n`);
                return;
            }
            if (error instanceof EmberError) io.error.write(`command rejected: ${error.message}\n`);
            else throw error;
        }
    });
}

export async function executeOperatorCommand(
    command: OperatorCommand,
    state: EmberState,
    runtimeId: RuntimeId,
    config: CliSurfaceConfig,
    io: { output: Writable; error: Writable },
    repositories: SurfaceRepositories,
) {
    const result = await executeCommand(command, state, runtimeId, { ...config, surfaceId: "local_cli" }, repositories);
    io.output.write(result.text);
}

async function withCliLease(
    store: CliStateRepository,
    config: CliSurfaceConfig,
    work: (state: EmberState, runtimeId: RuntimeId) => Promise<void>,
) {
    const lease = await store.acquireWriteLease();
    let runtimeId: RuntimeId | null = null;
    let stopReason = "cli_interaction_complete";
    try {
        let state = await loadConfiguredState(store, config);
        const started = startRuntime(state, config.principal, config.scope);
        runtimeId = started.runtimeId;
        state = await store.commit(state.revision, started.state);
        await work(state, runtimeId);
    } catch (error) {
        stopReason = "cli_failure";
        throw error;
    } finally {
        if (runtimeId !== null) {
            const current = await store.load();
            const episode = current.operations.runtimeEpisodes.find((item) => item.runtimeId === runtimeId);
            if (episode?.cleanStopAt === null)
                await store.commit(current.revision, stopRuntime(current, runtimeId, { reason: stopReason }));
        }
        await store.releaseWriteLease(lease);
    }
}

export async function loadConfiguredState(store: CliStateRepository, config: CliSurfaceConfig) {
    const state = await loadForPrincipal(store, config.principal);
    if (
        config.expectedContinuityBinding !== undefined &&
        (state.lineage.lineageId !== config.expectedContinuityBinding.lineageId ||
            state.lineage.establishedAt !== config.expectedContinuityBinding.establishedAt)
    )
        throw new ValidationError("continuity no longer matches setup binding");
    return state;
}

async function loadForPrincipal(store: CliStateRepository, principal: string) {
    const state = await store.load();
    if (principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("asserted principal does not match initialized local principal");
    return state;
}

export { splitCommand } from "@ember/application/commands/tokenize.ts";
