import assert from "node:assert/strict";
import test from "node:test";

import { codexArgumentEvidence } from "./evidence.ts";

test("Codex argument evidence should preserve model selection when explicit configuration is supplied", () => {
    // Given
    const arguments_ = ["--model", "gpt-5.6", "-c", "model_reasoning_effort=high", "--profile=continuity-eval"];

    // When
    const evidence = codexArgumentEvidence(arguments_);

    // Then
    assert.deepEqual(JSON.parse(evidence.explicit_arguments_sanitized), arguments_);
    assert.deepEqual(JSON.parse(evidence.model_selection), [
        "--model=gpt-5.6",
        "model_reasoning_effort=high",
        "--profile=continuity-eval",
    ]);
});

test("Codex argument evidence should redact secrets and unknown values when explicit configuration may contain credentials", () => {
    // Given
    const arguments_ = [
        "--api-key",
        "-private-key",
        "-c",
        "api_token=private-token",
        "--unknown",
        "private-value",
        "positional-secret",
    ];

    // When
    const evidence = codexArgumentEvidence(arguments_);

    // Then
    assert.deepEqual(JSON.parse(evidence.explicit_arguments_sanitized), [
        "--api-key",
        "<redacted>",
        "-c",
        "api_token=<redacted>",
        "--unknown",
        "<redacted>",
        "<redacted-positional>",
    ]);
    assert.equal(evidence.model_selection, "runtime_default");
    assert.equal(JSON.stringify(evidence).includes("private"), false);
});

test("Codex argument evidence should remain valid bounded JSON when explicit configuration is oversized", () => {
    // Given
    const arguments_ = Array.from({ length: 100 }, (_, index) => [
        "--model",
        `model-${index}-${"x".repeat(500)}`,
    ]).flat();

    // When
    const evidence = codexArgumentEvidence(arguments_);

    // Then
    assert.ok(Buffer.byteLength(evidence.explicit_arguments_sanitized, "utf8") <= 4096);
    assert.equal(JSON.parse(evidence.explicit_arguments_sanitized).at(-1), "<truncated>");
});
