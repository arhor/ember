import assert from "node:assert/strict";
import test from "node:test";

import { dependencyViolations } from "../scripts/check-dependencies.ts";

test("dependency checker should reject composition and AI runtime imports when used by conversational adapters", () => {
    // Given
    const owners = ["surfaces/cli/surface.ts", "surfaces/telegram/surface.ts", "surfaces/cli/ordinary-helper.ts"];
    const specifiers = ["../../app/application.ts", "../../composition/ember.ts", "../../ai/cognition.ts"];

    // When
    const results = owners.flatMap((owner) =>
        specifiers.map((specifier) => dependencyViolations(owner, `import type { X } from "${specifier}";`)),
    );

    // Then
    assert.equal(results.length, 9);
    for (const violations of results) assert.equal(violations.length, 1);
});

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

test("dependency checker should reject type-only AI runtime imports in a surface-owned module", () => {
    // Given
    const source = 'type ExecutorOptions = import("../../ai/cognition.ts").AiSdkProviderOptions;';

    // When
    const violations = dependencyViolations("surfaces/cli/provider-types.ts", source);

    // Then
    assert.equal(violations.length, 1);
    assert.match(violations[0]!, /must not import AI SDK infrastructure/);
});

test("dependency checker should allow the Ember-owned AI execution contract outside AI infrastructure", () => {
    // Given
    const sources = [
        ["memory/provider-memory-proposal-generator.ts", 'import type { AiExecutor } from "../ai/contract.ts";'],
        ["surfaces/cli/main.ts", 'import { MAX_AI_TIMEOUT_SECONDS } from "../../ai/contract.ts";'],
    ] as const;

    // When
    const violations = sources.flatMap(([owner, source]) => dependencyViolations(owner, source));

    // Then
    assert.deepEqual(violations, []);
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

test("dependency checker should reject dynamic AI imports when a comment separates import from the parenthesis", () => {
    // Given
    const source = 'const executor = await import/* lazy */("../../ai/cognition.ts");';

    // When
    const violations = dependencyViolations("surfaces/telegram/lazy-executor.ts", source);

    // Then
    assert.equal(violations.length, 1);
    assert.match(violations[0]!, /must not import AI SDK infrastructure/);
});

test("dependency checker should reject static template-literal dynamic AI imports", () => {
    // Given
    const source = "const executor = await import(`../../ai/cognition.ts`);";

    // When
    const violations = dependencyViolations("surfaces/telegram/lazy-executor.ts", source);

    // Then
    assert.equal(violations.length, 1);
    assert.match(violations[0]!, /must not import AI SDK infrastructure/);
});

test("dependency checker should reject non-static dynamic imports when ownership cannot be resolved", () => {
    // Given
    const source = "const executor = await import(`../../ai/${moduleName}.ts`);";

    // When
    const violations = dependencyViolations("surfaces/telegram/lazy-executor.ts", source);

    // Then
    assert.deepEqual(violations, [
        'surfaces/telegram/lazy-executor.ts imports "<dynamic>": non-static dynamic imports cannot be verified by the dependency checker',
    ]);
});

test("dependency checker should reject AI and persistence imports after CLI bootstrap extraction", () => {
    // Given
    const source = [
        'import { createAiSdkCognitionExecutor } from "../../ai/cognition.ts";',
        'import { StateStore } from "../../persistence/state-store.ts";',
    ].join("\n");

    // When
    const violations = dependencyViolations("surfaces/cli/setup.ts", source);

    // Then
    assert.equal(violations.length, 2);
    assert.match(violations[0]!, /must not import AI SDK infrastructure/);
    assert.match(violations[1]!, /must not import concrete canonical persistence/);
});
