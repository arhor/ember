import type { AiExecutor } from "@ember/application/ai/contract.ts";
import type { EnginePlugin } from "@ember/engine";
import type { LanguageModel } from "ai";

import type { AiSdkProviderOptions } from "./cognition.ts";

import { createAiSdkCognitionExecutor } from "./cognition.ts";

/** Supplies cognition to application composition, which retains admission and authority policy. */
export function createAiSdkPlugin<Input, Output>(options: {
    id: string;
    dependencies?: readonly string[];
    model: LanguageModel;
    providerOptions?: AiSdkProviderOptions;
    register(executor: AiExecutor): void | Promise<void>;
}): EnginePlugin<Input, Output> {
    return {
        id: options.id,
        ...(options.dependencies ? { dependencies: options.dependencies } : {}),
        setup() {
            return options.register(createAiSdkCognitionExecutor(options.model, options.providerOptions));
        },
    };
}

/** Registers an already configured cognition adapter, including process-backed providers. */
export function createCognitionPlugin<Input, Output>(options: {
    id: string;
    dependencies?: readonly string[];
    executor: AiExecutor;
    register(executor: AiExecutor): void | Promise<void>;
}): EnginePlugin<Input, Output> {
    return {
        id: options.id,
        ...(options.dependencies ? { dependencies: options.dependencies } : {}),
        setup() {
            return options.register(options.executor);
        },
    };
}
