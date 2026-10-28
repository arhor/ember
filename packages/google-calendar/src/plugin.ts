import type { CapabilitySelector } from "@ember/application/ai/contract.ts";
import type { EnginePlugin } from "@ember/engine";

/** Registers policy-bound capabilities; registration itself grants no authority. */
export function createGoogleCalendarPlugin<Input, Output>(options: {
    id: string;
    dependencies?: readonly string[];
    selectCapabilities: CapabilitySelector;
    register(selector: CapabilitySelector): void | Promise<void>;
}): EnginePlugin<Input, Output> {
    return {
        id: options.id,
        ...(options.dependencies ? { dependencies: options.dependencies } : {}),
        setup() {
            return options.register(options.selectCapabilities);
        },
    };
}
