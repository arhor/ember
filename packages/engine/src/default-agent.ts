import type { Agent, InteractionEvent, InteractionOptions, InteractionResult, Run } from "@ember/agent";

import { randomUUID } from "node:crypto";

import type { ExecutionExtensions } from "./extensions.ts";
import type { RunRepository, SessionRepository } from "./repositories.ts";
import type { RunExecutor } from "./run-executor.ts";

import { notifyRun } from "./extensions.ts";
import { InMemoryRunRepository, InMemorySessionRepository } from "./repositories.ts";
import { failRun, transitionRun } from "./run-lifecycle.ts";
import { resolveSession } from "./session.ts";

export interface DefaultAgentOptions<Input = unknown, Output = unknown> extends ExecutionExtensions<Input, Output> {
    sessions?: SessionRepository;
    runs?: RunRepository;
}

/** Generic execution owner; domain admission and delivery belong to the executor. */
export class DefaultAgent<Input = unknown, Output = unknown> implements Agent<Input, Output> {
    readonly identity: string;
    readonly #executor: RunExecutor<Input, Output>;
    readonly #sessions: SessionRepository;
    readonly #runs: RunRepository;
    readonly #extensions: ExecutionExtensions<Input, Output>;

    constructor(
        identity: string,
        executor: RunExecutor<Input, Output>,
        options: DefaultAgentOptions<Input, Output> = {},
    ) {
        this.identity = identity;
        this.#extensions = { ...options, hooks: [...(options.hooks ?? [])], observers: [...(options.observers ?? [])] };
        this.#executor = executor;
        this.#sessions = options.sessions ?? new InMemorySessionRepository();
        this.#runs = options.runs ?? new InMemoryRunRepository();
    }

    async handle(
        interaction: InteractionEvent<Input>,
        options: InteractionOptions = {},
    ): Promise<InteractionResult<Output>> {
        const session = await resolveSession(this.#sessions, this.identity, interaction.sessionId);
        let run: Run = { id: randomUUID(), sessionId: session.id, state: "queued" };
        await this.#runs.save(run);
        await notifyRun(this.#extensions, run);

        let output: Output;
        try {
            options.signal?.throwIfAborted();
            run = await transitionRun(this.#runs, run, "running");
            await notifyRun(this.#extensions, run);
            options.signal?.throwIfAborted();
            const context = { runId: run.id, sessionId: session.id, signal: options.signal };
            const hookContext = { interaction, context };
            for (const hook of this.#extensions.hooks ?? []) await hook.beforeExecute?.(hookContext);
            options.signal?.throwIfAborted();
            output = await this.#executor.execute(interaction, context);
            for (const hook of this.#extensions.hooks ?? []) await hook.afterExecute?.(hookContext, output);
        } catch (error) {
            const failed = await failRun(this.#runs, run, error, options.signal);
            await notifyRun(this.#extensions, failed);
            throw error;
        }

        // A failed completion write must not misrepresent successful execution as failed.
        const completed = await transitionRun(this.#runs, run, "completed");
        await notifyRun(this.#extensions, completed);
        return { sessionId: session.id, runId: run.id, output };
    }

    getRun(runId: string): Promise<Run | undefined> {
        return this.#runs.get(runId);
    }
}
