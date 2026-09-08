import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { join, matchesGlob } from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";

import { parseArgs } from "../src/cli/main.ts";
import { validateState } from "../src/core/model.ts";
import { buildProjection } from "../src/core/projection.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { validateProviderResult } from "../src/providers/contract.ts";
import { createProcessProvider as createTestProcessProvider, invokeProvider } from "../src/providers/process.ts";
import { runCognition, startRuntime } from "../src/runtime/runtime.ts";
import { cloneState } from "../src/util.ts";
import {
    captureError,
    command,
    emptyRequest,
    populatedState,
    PRINCIPAL,
    PROVIDER,
    readJson,
    ROOT,
    SCOPE,
    tempDir,
} from "./support.ts";

async function providerError(mode, request = emptyRequest(), timeoutSeconds = 1) {
    return captureError(() =>
        invokeProvider(process.execPath, [PROVIDER, "--mode", mode], request, { timeoutSeconds }),
    );
}
async function startedStore() {
    const directory = await tempDir(),
        path = join(directory, "ember.json"),
        store = new StateStore(path),
        { state } = populatedState();
    await store.create(state);
    const lease = await store.acquireWriteLease(),
        loaded = await store.load(),
        started = startRuntime(loaded, PRINCIPAL, SCOPE, { timestamp: "2026-08-29T10:00:00Z" }),
        committed = await store.commit(loaded.revision, started.state);
    return { directory, path, store, lease, state: committed, runtimeId: started.runtimeId };
}

test("scripted provider should stay outside automatic discovery when repository tests run", () => {
    // Given
    const automaticDiscoveryPattern = join(ROOT, "tests", "*.test.ts");
    // When
    const providerIsDiscovered = matchesGlob(PROVIDER, automaticDiscoveryPattern);
    // Then
    assert.equal(providerIsDiscovered, false);
});

test("provider adapter should accept one result when result uses only selected meanings", async () => {
    // Given
    const { state } = populatedState(),
        started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-08-29T10:00:00Z" }),
        projection = buildProjection(started.state, {
            principal: PRINCIPAL,
            scope: SCOPE,
            currentInput: "hello",
            currentTime: "2026-08-29T10:00:01Z",
            runtimeId: started.runtimeId,
        }),
        request = { contractVersion: 1, cognitionId: "cognition-test", projection, input: { text: "hello" } };
    // When
    const result = await invokeProvider(process.execPath, [PROVIDER], request, { timeoutSeconds: 1 });
    // Then
    assert.deepEqual(new Set(result.usedMeaningIds), new Set(projection.selection.meaning_ids));
});
test("provider adapter should reject result when provider requests canonical mutation", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("unknown-field", request);
    // Then
    assert.match(error.message, /unsupported fields/);
});
test("provider adapter should reject output when stdout contains extra data", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("extra", request);
    // Then
    assert.match(error.message, /exactly one JSON object/);
});
test("provider adapter should report timeout when fresh process exceeds limit", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("timeout", request, 0.03);
    // Then
    assert.equal(error.outcome, "timed_out");
});
test("provider adapter should preserve timeout when cancellation follows termination", async () => {
    // Given
    const controller = new AbortController(),
        child = new EventEmitter();
    Object.assign(child, {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: () => {
            setTimeout(() => child.emit("close", null, "SIGTERM"), 10);
            return true;
        },
    });
    // When
    const pending = captureError(() =>
        invokeProvider("fixture", [], emptyRequest(), {
            timeoutSeconds: 0.005,
            signal: controller.signal,
            spawnImpl: () => child,
            terminationGraceMs: 50,
            finalTerminationMs: 100,
        }),
    );
    setTimeout(() => controller.abort(), 7);
    const error = await pending;
    // Then
    assert.deepEqual(
        [error.outcome, error.termination],
        ["timed_out", { reason: "timeout", directChildExitObserved: true }],
    );
});
test("provider adapter should preserve output limit when cancellation follows termination", async () => {
    // Given
    const controller = new AbortController(),
        child = new EventEmitter();
    Object.assign(child, {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: () => {
            setTimeout(() => child.emit("close", null, "SIGTERM"), 10);
            return true;
        },
    });
    // When
    const pending = captureError(() =>
        invokeProvider("fixture", [], emptyRequest(), {
            timeoutSeconds: 1,
            signal: controller.signal,
            spawnImpl: () => {
                setImmediate(() => {
                    child.stdout.write(Buffer.alloc(1024 * 1024 + 1));
                    setTimeout(() => controller.abort(), 1);
                });
                return child;
            },
            terminationGraceMs: 50,
            finalTerminationMs: 100,
        }),
    );
    const error = await pending;
    // Then
    assert.deepEqual(
        [error.outcome, error.termination],
        ["failed", { reason: "output_limit", directChildExitObserved: true }],
    );
});
test("provider adapter should close local pipes and report unknown when termination is unconfirmed", async () => {
    // Given
    const child = new EventEmitter(),
        signals = [];
    Object.assign(child, {
        stdin: new PassThrough(),
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: (signal) => {
            signals.push(signal);
            return true;
        },
    });
    // When
    const error = await captureError(() =>
        invokeProvider("fixture", [], emptyRequest(), {
            timeoutSeconds: 0.005,
            spawnImpl: () => child,
            terminationGraceMs: 5,
            finalTerminationMs: 20,
        }),
    );
    // Then
    assert.deepEqual(
        [
            error.outcome,
            error.terminationConfirmed,
            signals,
            child.stdin.destroyed,
            child.stdout.destroyed,
            child.stderr.destroyed,
            child.stdout.listenerCount("data"),
            child.stderr.listenerCount("data"),
        ],
        ["outcome_unknown", false, ["SIGTERM", "SIGKILL"], true, true, true, 0, 0],
    );
});
test("provider adapter should reject timeout when value is not finite", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await captureError(() =>
        invokeProvider(process.execPath, [PROVIDER], request, { timeoutSeconds: NaN }),
    );
    // Then
    assert.match(error.message, /positive finite/);
});
test("provider adapter should reject result when boolean impersonates contract version", async () => {
    // Given
    const result = { contractVersion: true, reply: "text", usedMeaningIds: [] };
    // When
    const error = await captureError(() => validateProviderResult(result, new Set()));
    // Then
    assert.match(error.message, /unsupported/);
});
test("provider adapter should reject output when stdout is malformed JSON", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("malformed", request);
    // Then
    assert.match(error.message, /exactly one JSON object/);
});
test("provider adapter should reject output when reply is empty", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("empty", request);
    // Then
    assert.match(error.message, /non-empty/);
});
test("provider adapter should reject output when stdout exceeds contract limit", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("oversized", request);
    // Then
    assert.match(error.message, /exceeds 1 MiB/);
});
test("provider adapter should reject output when stdout is invalid UTF-8", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("invalid-utf8", request);
    // Then
    assert.match(error.message, /not UTF-8/);
});
test("provider adapter should drain stderr while retaining bounded diagnostic when child is noisy", async () => {
    // Given
    const request = emptyRequest();
    // When
    const error = await providerError("noisy-nonzero", request);
    // Then
    assert.ok(error.message.length <= 65536 + 100);
});
test("runtime should preserve semantic state and inspection when provider fails", async () => {
    // Given
    const fixture = await startedStore(),
        before = cloneState(fixture.state.meanings);
    // When
    const result = await runCognition(fixture.store, fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "fail safely",
            providerLabel: process.execPath,
            provider: createTestProcessProvider({
                command: process.execPath,
                arguments_: [PROVIDER, "--mode", "nonzero"],
            }),
            timeoutSeconds: 1,
            output: () => {},
        }),
        serialized = await readFile(fixture.path, "utf8");
    await fixture.store.releaseWriteLease(fixture.lease);
    // Then
    assert.deepEqual(
        [
            result.state.meanings,
            result.state.operations.cognitionEpisodes.at(-1).status,
            serialized.includes("provider diagnostic"),
            serialized.includes("fail safely"),
        ],
        [before, "failed", false, true],
    );
});
test("runtime should preserve pending delivery when output fails after expression commit", async () => {
    // Given
    const fixture = await startedStore();
    // When
    const error = await captureError(() =>
            runCognition(fixture.store, fixture.state, {
                runtimeId: fixture.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "render",
                providerLabel: process.execPath,
                provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
                timeoutSeconds: 1,
                output: () => {
                    throw new Error("display failed");
                },
            }),
        ),
        persisted = (await fixture.store.load()).operations.cognitionEpisodes.at(-1);
    await fixture.store.releaseWriteLease(fixture.lease);
    // Then
    assert.deepEqual(
        [error.message, persisted.status, persisted.deliveryStatus, Boolean(persisted.expressionEvidenceId)],
        ["display failed", "completed", "pending", true],
    );
});
test("runtime should preserve pending delivery when stdout fails asynchronously after accepting write", async () => {
    // Given
    const fixture = await startedStore(),
        output = new Writable({
            write(_chunk, _encoding, callback) {
                setImmediate(() => callback(new Error("async display failed")));
            },
        });
    // When
    const error = await captureError(() =>
            runCognition(fixture.store, fixture.state, {
                runtimeId: fixture.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "render",
                providerLabel: process.execPath,
                provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
                timeoutSeconds: 1,
                output,
            }),
        ),
        persisted = (await fixture.store.load()).operations.cognitionEpisodes.at(-1);
    await fixture.store.releaseWriteLease(fixture.lease);
    // Then
    assert.deepEqual([error.message, persisted.deliveryStatus], ["async display failed", "pending"]);
});
test("runtime should commit displayed only when stdout write callback completes", async () => {
    // Given
    const fixture = await startedStore();
    let flushed = false,
        observed = false;
    const output = new Writable({
        write(_chunk, _encoding, callback) {
            setTimeout(() => {
                flushed = true;
                callback();
            }, 5);
        },
    });
    // When
    const result = await runCognition(fixture.store, fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        text: "render",
        providerLabel: process.execPath,
        provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
        timeoutSeconds: 1,
        output,
        hooks: {
            afterDisplay: () => {
                observed = flushed;
            },
        },
    });
    await fixture.store.releaseWriteLease(fixture.lease);
    // Then
    assert.deepEqual([observed, result.state.operations.cognitionEpisodes.at(-1).deliveryStatus], [true, "displayed"]);
});
test("runtime should keep delivery unknown when crash follows display before status commit", async () => {
    // Given
    const fixture = await startedStore();
    let output = "";
    // When
    const error = await captureError(() =>
            runCognition(fixture.store, fixture.state, {
                runtimeId: fixture.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "display",
                providerLabel: process.execPath,
                provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
                timeoutSeconds: 1,
                output: (text) => {
                    output += text;
                },
                hooks: {
                    afterDisplay: () => {
                        throw new Error("simulated crash");
                    },
                },
            }),
        ),
        persisted = (await fixture.store.load()).operations.cognitionEpisodes.at(-1);
    await fixture.store.releaseWriteLease(fixture.lease);
    // Then
    assert.deepEqual(
        [error.message, output.includes("CONTINUITY_RESPONSE"), persisted.deliveryStatus],
        ["simulated crash", true, "pending"],
    );
});
test("state validator should reject orphan expression when second descriptor targets one cognition", async () => {
    // Given
    const fixture = await startedStore(),
        result = await runCognition(fixture.store, fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "one",
            providerLabel: process.execPath,
            provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
            timeoutSeconds: 1,
            output: () => {},
        }),
        duplicate = cloneState(result.state.evidence.find((e) => e.sourceRole === "ember_expression_via_provider"));
    duplicate.evidenceId += "-orphan";
    result.state.evidence.push(duplicate);
    await fixture.store.releaseWriteLease(fixture.lease);
    // When
    const error = await captureError(() => validateState(result.state));
    // Then
    assert.match(error.message, /exactly one completed cognition/);
});
test("state validator should reject cognition when scope differs from owning runtime", async () => {
    // Given
    const fixture = await startedStore(),
        result = await runCognition(fixture.store, fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "scope",
            providerLabel: process.execPath,
            provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
            timeoutSeconds: 1,
            output: () => {},
        });
    result.state.operations.cognitionEpisodes.at(-1).activeScope = "project:other";
    await fixture.store.releaseWriteLease(fixture.lease);
    // When
    const error = await captureError(() => validateState(result.state));
    // Then
    assert.match(error.message, /scope differs from owning runtime/);
});
test("state validator should reject provider termination when status contradicts it", async () => {
    // Given
    const fixture = await startedStore(),
        result = await runCognition(fixture.store, fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "one",
            providerLabel: process.execPath,
            provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
            timeoutSeconds: 1,
            output: () => {},
        });
    await fixture.store.releaseWriteLease(fixture.lease);
    const variants = [];
    for (const [status, reason, observed] of [
        ["completed", "timeout", true],
        ["timed_out", "explicit_cancellation", true],
        ["failed", "output_limit", false],
    ]) {
        const state = cloneState(result.state),
            episode = state.operations.cognitionEpisodes.at(-1);
        episode.status = status;
        episode.providerTermination = { reason, directChildExitObserved: observed };
        if (status !== "completed") {
            episode.expressionEvidenceId = null;
            episode.deliveryStatus = "not_attempted";
            episode.usedMeaningIds = [];
            state.evidence = state.evidence.filter((e) => e.sourceRole !== "ember_expression_via_provider");
        }
        variants.push(state);
    }
    // When
    const errors = await Promise.all(variants.map((state) => captureError(() => validateState(state))));
    // Then
    assert.ok(errors.every((error) => /providerTermination contradicts cognition status/.test(error.message)));
});
test("state validator should accept cancellation when invocation ends before child exit is observable", async () => {
    // Given
    const fixture = await startedStore(),
        result = await runCognition(fixture.store, fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "one",
            providerLabel: process.execPath,
            provider: createTestProcessProvider({ command: process.execPath, arguments_: [PROVIDER] }),
            timeoutSeconds: 1,
            output: () => {},
        }),
        state = cloneState(result.state),
        episode = state.operations.cognitionEpisodes.at(-1);
    await fixture.store.releaseWriteLease(fixture.lease);
    episode.status = "cancellation_requested";
    episode.providerTermination = { reason: "explicit_cancellation", directChildExitObserved: false };
    episode.expressionEvidenceId = null;
    episode.deliveryStatus = "not_attempted";
    episode.usedMeaningIds = [];
    state.evidence = state.evidence.filter((e) => e.sourceRole !== "ember_expression_via_provider");
    // When
    const validated = () => validateState(state);
    // Then
    assert.doesNotThrow(validated);
});
test("CLI run should reject timeout before runtime start when value is infinite", async () => {
    // Given
    const directory = await tempDir(),
        path = join(directory, "ember.json");
    await command(["init", "--state", path, "--name", "Ember", "--principal", PRINCIPAL]);
    // When
    const attempted = await command([
            "run",
            "--state",
            path,
            "--principal",
            PRINCIPAL,
            "--scope",
            SCOPE,
            "--provider-command",
            process.execPath,
            "--provider-timeout-seconds",
            "Infinity",
        ]),
        state = await readJson(path);
    // Then
    assert.deepEqual([attempted.code, state.operations.runtimeEpisodes], [2, []]);
});
test("CLI run should reject malformed quote and stop cleanly when command parser fails", async () => {
    // Given
    const directory = await tempDir(),
        path = join(directory, "ember.json");
    await command(["init", "--state", path, "--name", "Ember", "--principal", PRINCIPAL]);
    // When
    const attempted = await command(
            [
                "run",
                "--state",
                path,
                "--principal",
                PRINCIPAL,
                "--scope",
                SCOPE,
                "--provider-command",
                process.execPath,
                "--provider-timeout-seconds",
                "1",
            ],
            { stdin: ":prefer 'unterminated\n" },
        ),
        state = await readJson(path);
    // Then
    assert.deepEqual(
        [
            attempted.code,
            attempted.stderr.includes("command rejected"),
            state.operations.runtimeEpisodes.at(-1).stopReason,
        ],
        [0, true, "input_eof"],
    );
});
test("CLI correct should create attributable successor when current fact is corrected", async () => {
    // Given
    const directory = await tempDir(),
        path = join(directory, "ember.json");
    await command(["init", "--state", path, "--name", "Ember", "--principal", PRINCIPAL]);
    await command(
        [
            "run",
            "--state",
            path,
            "--principal",
            PRINCIPAL,
            "--scope",
            SCOPE,
            "--provider-command",
            process.execPath,
            "--provider-arg",
            PROVIDER,
            "--provider-timeout-seconds",
            "1",
        ],
        { stdin: `:remember fact user:${PRINCIPAL} server ${SCOPE} "It is a Pi 4"\n:quit\n` },
    );
    const before = JSON.parse((await command(["inspect", "--state", path, "--principal", PRINCIPAL, "--json"])).stdout),
        original = before.currentMeanings.find((m) => m.slot === "server").meaningId;
    // When
    const corrected = await command([
            "correct",
            "--state",
            path,
            "--principal",
            PRINCIPAL,
            original,
            "--text",
            "It is a Pi 5",
            "--reason",
            "The user corrected the model",
        ]),
        after = JSON.parse((await command(["inspect", "--state", path, "--principal", PRINCIPAL, "--json"])).stdout),
        explained = await command(["explain", "--state", path, "--principal", PRINCIPAL, corrected.stdout.trim()]);
    // Then
    assert.deepEqual(
        [
            corrected.code,
            after.currentMeanings.find((m) => m.slot === "server").content,
            after.historical_meanings.find((m) => m.meaningId === original).currentness,
            explained.stdout.includes("The user corrected the model"),
        ],
        [0, "It is a Pi 5", "superseded", true],
    );
});
test("CLI should refuse wrong principal before rendering when inspection is requested", async () => {
    // Given
    const directory = await tempDir(),
        path = join(directory, "ember.json"),
        secret = "PRIVATE_FIXTURE_TEXT";
    await command(["init", "--state", path, "--name", "Ember", "--principal", PRINCIPAL]);
    const established = await command(
        [
            "run",
            "--state",
            path,
            "--principal",
            PRINCIPAL,
            "--scope",
            SCOPE,
            "--provider-command",
            process.execPath,
            "--provider-arg",
            PROVIDER,
            "--provider-timeout-seconds",
            "1",
        ],
        { stdin: `:remember fact user:${PRINCIPAL} private ${SCOPE} ${secret}\n:quit\n` },
    );
    // When
    const inspected = await command(["inspect", "--state", path, "--principal", "intruder", "--json"]);
    // Then
    assert.deepEqual(
        [established.code, inspected.code, (inspected.stdout + inspected.stderr).includes(secret)],
        [0, 2, false],
    );
});
test("CLI check should fail closed when state is semantically incomplete", async () => {
    // Given
    const directory = await tempDir(),
        path = join(directory, "ember.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, revision: 0 }));
    // When
    const checked = await command(["check", "--state", path]);
    // Then
    assert.deepEqual([checked.code, checked.stderr.includes("schema v1")], [2, true]);
});
test("CLI check should report typed failure when state is invalid UTF-8", async () => {
    // Given
    const directory = await tempDir(),
        path = join(directory, "ember.json");
    await writeFile(path, Buffer.from([0xff, 0xfe]));
    // When
    const checked = await command(["check", "--state", path]);
    // Then
    assert.deepEqual(
        [checked.code, checked.stderr.includes("not valid UTF-8"), checked.stderr.includes("stack")],
        [2, true, false],
    );
});
test("CLI check should report lock metadata and liveness when cooperating writer is live", async () => {
    // Given
    const fixture = await startedStore();
    // When
    const checked = await command(["check", "--state", fixture.path]);
    await fixture.store.releaseWriteLease(fixture.lease);
    // Then
    assert.deepEqual(
        [
            checked.code,
            checked.stdout.includes('"status":"live"'),
            checked.stdout.includes('"owner_token"'),
            checked.stdout.includes('"liveness":"alive"'),
        ],
        [0, true, true, true],
    );
});
test("CLI parser should reject option when flag is unknown for command", async () => {
    // Given
    const args = ["check", "--state", "/tmp/ember.json", "--typo", "ignored"];
    // When
    const error = await captureError(() => parseArgs(args));
    // Then
    assert.match(error.message, /unsupported option/);
});
test("CLI parser should reject arguments when surplus positional is present", async () => {
    // Given
    const args = ["init", "surplus", "--state", "/tmp/ember.json", "--name", "Ember", "--principal", PRINCIPAL];
    // When
    const error = await captureError(() => parseArgs(args));
    // Then
    assert.match(error.message, /0 positional arguments/);
});
test("CLI parser should reject option when singular flag is duplicated", async () => {
    // Given
    const args = ["check", "--state", "/tmp/a.json", "--state", "/tmp/b.json"];
    // When
    const error = await captureError(() => parseArgs(args));
    // Then
    assert.match(error.message, /must not be repeated/);
});
test("CLI init should report typed failure when state parent is not a directory", async () => {
    // Given
    const path = "/dev/null/ember.json";
    // When
    const attempted = await command(["init", "--state", path, "--name", "Ember", "--principal", PRINCIPAL]);
    // Then
    assert.deepEqual(
        [attempted.code, attempted.stderr.startsWith("ember: "), attempted.stderr.includes("\n    at ")],
        [2, true, false],
    );
});
