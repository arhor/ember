import type { EnginePlugin } from "../../../packages/engine/src/index.ts";

/** Independent capability registered by application startup, without engine changes. */
export function uppercasePlugin(): EnginePlugin<string, string> {
    return {
        id: "uppercase",
        setup(registration) {
            registration.executor({ execute: async (interaction) => interaction.payload.toUpperCase() });
        },
    };
}
