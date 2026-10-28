export interface Agent<Input = unknown, Output = unknown> {
    readonly identity: string;

    handle(interaction: InteractionEvent<Input>, options?: InteractionOptions): Promise<InteractionResult<Output>>;
    getRun(runId: string): Promise<Run | undefined>;
}

export type InteractionEvent<T = unknown> = {
    readonly id: string;
    readonly actor: Actor;
    readonly surface: InteractionSurface;
    readonly payload: T;
    readonly sessionId?: string;
    readonly timestamp: Temporal.Instant;
};

export type InteractionOptions = {
    signal?: AbortSignal;
};

export type InteractionSurface = {
    readonly id: string;
};

export type Actor = {
    readonly id: string;
    readonly kind: "user" | "agent" | "system" | "service";
};

export interface InteractionResult<T = unknown> {
    readonly sessionId: string;
    readonly runId?: string;
    readonly output?: T;
}

export type RunState = "queued" | "running" | "completed" | "failed" | "cancelled";

/** Execution completion is independent of outward delivery. */
export type Run = {
    readonly id: string;
    readonly sessionId: string;
    readonly state: RunState;
};

export type Session = {
    readonly id: string;
    readonly agentId: string;
};
