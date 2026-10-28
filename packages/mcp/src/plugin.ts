import type { EnginePlugin } from "@ember/engine";

import type { McpCapabilitySource } from "./ai-sdk.ts";

/** Opens a capability source at startup and releases it on shutdown or setup failure. */
export function createMcpPlugin<Input, Output>(options: {
    id: string;
    dependencies?: readonly string[];
    open(): Promise<McpCapabilitySource>;
    register(source: McpCapabilitySource): void | Promise<void>;
}): EnginePlugin<Input, Output> {
    return {
        id: options.id,
        ...(options.dependencies ? { dependencies: options.dependencies } : {}),
        async setup(registration) {
            const source = await options.open();
            registration.onCleanup(() => source.close());
            await options.register(source);
        },
    };
}
