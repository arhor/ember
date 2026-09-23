import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import { createAiSdkCognitionExecutor } from "../src/ai/cognition.ts";
import { createProcessLanguageModel } from "../src/ai/process.ts";
import { ProviderError, ValidationError } from "../src/core/errors.ts";
import { buildProjection } from "../src/core/projection.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../src/providers/contract.ts";
import { invokeProvider } from "../src/providers/process.ts";
import { startRuntime } from "../src/runtime/runtime.ts";
import { parseArgs } from "../src/surfaces/cli/index.ts";
import { emptyRequest, populatedState, PRINCIPAL, SCOPE } from "./support.ts";

const OVERSIZED_TIMEOUT = MAX_PROVIDER_TIMEOUT_SECONDS + 1;

test("provider adapter should reject timeout before spawn when delay exceeds Node timer range", async () => {
    // Given
    const spawnCalls = [];
    const request = {
        contractVersion: 1,
        cognitionId: "cognition-test",
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

test("process provider should preserve an already-fired timeout when invocation has not spawned", async () => {
    // Given
    const signal = AbortSignal.abort(new DOMException("deadline elapsed", "TimeoutError"));
    let spawned = false;

    // When
    let error: unknown;
    try {
        await invokeProvider("fixture", [], emptyRequest(), {
            timeoutSeconds: 60,
            signal,
            spawnImpl: () => {
                spawned = true;
                throw new Error("must not spawn");
            },
        });
    } catch (caught) {
        error = caught;
    }

    // Then
    assert.ok(error instanceof ProviderError);
    assert.equal(error.outcome, "timed_out");
    assert.deepEqual(error.termination, { reason: "timeout", directChildExitObserved: false });
    assert.equal(spawned, false);
});

test("process AI bridge should honor call timeout when model configuration is longer", async () => {
    // Given
    const { state } = populatedState();
    const started = startRuntime(state, PRINCIPAL, SCOPE);
    const projection = buildProjection(started.state, {
        principal: PRINCIPAL,
        scope: SCOPE,
        currentInput: "hello",
        runtimeId: started.runtimeId,
    });
    const child = new EventEmitter();
    Object.assign(child, {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: (signal: unknown) => {
            queueMicrotask(() => child.emit("close", null, signal));
            return true;
        },
    });
    const executor = createAiSdkCognitionExecutor(
        createProcessLanguageModel({
            command: "fixture",
            timeoutSeconds: 60,
            terminationGraceMs: 5,
            finalTerminationMs: 10,
            spawnImpl: () => child as never,
        }),
    );

    // When
    let error: unknown;
    try {
        await executor(
            { contractVersion: 1, cognitionId: "cognition-process-timeout", projection, input: { text: "hello" } },
            { timeoutSeconds: 0.01 },
        );
    } catch (caught) {
        error = caught;
    }

    // Then
    assert.ok(error instanceof ProviderError);
    assert.equal(error.outcome, "timed_out");
    assert.deepEqual(error.termination, { reason: "timeout", directChildExitObserved: true });
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
