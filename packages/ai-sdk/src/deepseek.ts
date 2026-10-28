import type { LanguageModel } from "ai";

import { createDeepSeek } from "@ai-sdk/deepseek";

export interface DeepSeekLanguageModelConfig {
    model: string;
}

/** Creates an AI SDK model for the hosted DeepSeek API; reads DEEPSEEK_API_KEY from process.env. */
export function createDeepSeekLanguageModel({ model }: DeepSeekLanguageModelConfig): LanguageModel {
    return createDeepSeek()(model);
}
