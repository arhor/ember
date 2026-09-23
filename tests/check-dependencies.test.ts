import assert from "node:assert/strict";
import test from "node:test";

import { dependencyViolations } from "../scripts/check-dependencies.ts";

test("dependency checker should reject static AI imports anywhere in a surface-owned subtree", () => {
    // Given
    const source = 'import { generateText } from "../../ai/cognition.ts";';

    // When
    const violations = dependencyViolations("surfaces/telegram/ai-helper.ts", source);

    // Then
    assert.deepEqual(violations, [
        'surfaces/telegram/ai-helper.ts imports "../../ai/cognition.ts": surface-owned modules must not import AI SDK infrastructure',
    ]);
});

test("dependency checker should reject type-only AI imports in a surface-owned module", () => {
    // Given
    const source = 'type Executor = import("../../ai/contract.ts").AiExecutor;';

    // When
    const violations = dependencyViolations("surfaces/cli/provider-types.ts", source);

    // Then
    assert.equal(violations.length, 1);
    assert.match(violations[0]!, /must not import AI SDK infrastructure/);
});

test("dependency checker should reject dynamic AI imports when comments and whitespace follow the parenthesis", () => {
    // Given
    const source = 'const executor = await import( /* resolved lazily */\n  "../../ai/cognition.ts"\n);';

    // When
    const violations = dependencyViolations("surfaces/telegram/lazy-executor.ts", source);

    // Then
    assert.equal(violations.length, 1);
    assert.match(violations[0]!, /must not import AI SDK infrastructure/);
});

test("dependency checker should preserve explicit machine-setup infrastructure exceptions", () => {
    // Given
    const source = [
        'import { createAiSdkCognitionExecutor } from "../../ai/cognition.ts";',
        'import { StateStore } from "../../persistence/state-store.ts";',
    ].join("\n");

    // When
    const violations = dependencyViolations("surfaces/cli/setup.ts", source);

    // Then
    assert.deepEqual(violations, []);
});
