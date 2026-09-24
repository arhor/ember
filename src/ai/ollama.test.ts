import assert from "node:assert/strict";
import test from "node:test";

import { createOllamaLanguageModel } from "./ollama.ts";

test("createOllamaLanguageModel should expose the configured model through the AI SDK when a loopback endpoint is selected", () => {
    // Given
    const model = createOllamaLanguageModel({ model: "qwen3:8b", baseUrl: "http://127.0.0.1:11435" });

    // When
    const identity = {
        provider: model.provider,
        modelId: model.modelId,
        specificationVersion: model.specificationVersion,
    };

    // Then
    assert.deepEqual(identity, { provider: "ollama", modelId: "qwen3:8b", specificationVersion: "v4" });
});
