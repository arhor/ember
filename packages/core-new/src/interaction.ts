export type Interaction<T = unknown> = {
    readonly id: string;
    readonly actor: Actor;
    readonly source: InteractionSource;
    readonly payload: T;
    readonly timestamp: Temporal.Instant;
}

export type InteractionSource = {
    readonly id: string;
}

export type Actor = {
    readonly id: string;
    readonly kind: "user" | "agent" | "system" | "service";
}
