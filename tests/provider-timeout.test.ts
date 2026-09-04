import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/cli/main.ts";
import { ProviderError, ValidationError } from "../src/core/errors.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../src/providers/contract.ts";
import { invokeProvider } from "../src/providers/process.ts";

const OVERSIZED_TIMEOUT = MAX_PROVIDER_TIMEOUT_SECONDS + 1;

test("provider adapter should reject timeout before spawn when delay exceeds Node timer range", async () => {
    // Given
    const spawnCalls = [];
    const request = {
        contract_version: 1,
        cognition_id: "cognition-test",
        projection: { selection: { meaning_ids: [] } },
        input: { text: "hello" },
    };
    // When
    let error = null;
    try {
        await invokeProvider("fixture", [], request, {
            timeoutSeconds: OVERSIZED_TIMEOUT,
            spawnImpl: () => {
                spawnCalls.push(true);
                throw new Error("must not spawn");
            },
        });
    } catch (caught) {
        error = caught;
    }
    // Then
    assert.deepEqual(
        [error instanceof ProviderError, spawnCalls.length, /must not exceed/.test(error?.message ?? "")],
        [true, 0, true],
    );
});

test("CLI parser should reject timeout before runtime start when delay exceeds Node timer range", () => {
    // Given
    const args = [
        "run",
        "--state",
        "/tmp/ember.json",
        "--principal",
        "user-1",
        "--scope",
        "project:ember/docs",
        "--provider-command",
        "node",
        "--provider-timeout-seconds",
        String(OVERSIZED_TIMEOUT),
    ];
    // When
    let error = null;
    try {
        parseArgs(args);
    } catch (caught) {
        error = caught;
    }
    // Then
    assert.deepEqual([error instanceof ValidationError, /must not exceed/.test(error?.message ?? "")], [true, true]);
});
