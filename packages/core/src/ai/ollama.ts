import type { LanguageModel } from "ai";

import { createOllama } from "ai-sdk-ollama";

export interface OllamaLanguageModelConfig {
    model: string;
    baseUrl?: string;
}

/** Creates an AI SDK model for an already-running, machine-local Ollama server. */
export function createOllamaLanguageModel({ model, baseUrl }: OllamaLanguageModelConfig): LanguageModel {
    return createOllama(baseUrl === undefined ? undefined : { baseURL: baseUrl })(model, {
        reliableObjectGeneration: false,
        reliableToolCalling: false,
    });
}
