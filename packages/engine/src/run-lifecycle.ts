import type { Run, RunState } from "@ember/agent";

import type { RunRepository } from "./repositories.ts";

const transitions: Record<RunState, readonly RunState[]> = {
    queued: ["running", "failed", "cancelled"],
    running: ["completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
};

export async function transitionRun(repository: RunRepository, run: Run, state: RunState): Promise<Run> {
    if (!transitions[run.state].includes(state)) throw new Error(`Invalid run transition: ${run.state} -> ${state}`);
    const updated = { ...run, state };
    await repository.save(updated);
    return updated;
}

export async function failRun(repository: RunRepository, run: Run, error: unknown, signal?: AbortSignal): Promise<Run> {
    const cancelled =
        signal?.aborted === true &&
        (error === signal.reason || (error instanceof Error && error.name === "AbortError"));
    try {
        return await transitionRun(repository, run, cancelled ? "cancelled" : "failed");
    } catch (persistenceError) {
        throw new AggregateError(
            [error, persistenceError],
            "Execution failed and its terminal state could not be saved",
            { cause: error },
        );
    }
}
