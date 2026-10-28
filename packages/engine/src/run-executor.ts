import type { InteractionEvent } from "@ember/agent";

export type RunContext = {
    readonly runId: string;
    readonly sessionId: string;
    readonly signal?: AbortSignal | undefined;
};

export interface RunExecutor<Input = unknown, Output = unknown> {
    execute(interaction: InteractionEvent<Input>, context: RunContext): Promise<Output>;
}
