import assert from "node:assert/strict";
import test from "node:test";

import { createDeepSeekLanguageModel } from "./deepseek.ts";

test("createDeepSeekLanguageModel should expose the configured model through the AI SDK", () => {
    // Given
    const model = createDeepSeekLanguageModel({ model: "deepseek-chat" });

    // When
    const identity = {
        provider: model.provider,
        modelId: model.modelId,
        specificationVersion: model.specificationVersion,
    };

    // Then
    assert.deepEqual(identity, { provider: "deepseek.chat", modelId: "deepseek-chat", specificationVersion: "v4" });
});
