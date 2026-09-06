import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import type { ProviderProcessChild, ProviderProcessExecution } from "./process-lifecycle.ts";

import { createProviderProcessExecution, runProviderProcess } from "./process-lifecycle.ts";

class TestChild extends EventEmitter implements ProviderProcessChild {
    readonly stdin = new PassThrough();
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    readonly signals: (NodeJS.Signals | number | undefined)[] = [];

    kill(signal?: NodeJS.Signals | number): boolean {
        this.signals.push(signal);
        return true;
    }

    close(code: number | null = 0, signal: NodeJS.Signals | null = null) {
        this.emit("close", code, signal);
    }
}

test("public execution interface represents one provider process run", async () => {
    const child = new TestChild();
    const execution: ProviderProcessExecution = createProviderProcessExecution({
        command: "provider",
        arguments_: [],
        spawnImpl: () => child,
        spawnOptions: {},
        stdin: "request",
        timeoutSeconds: 1,
        maxStdoutBytes: 1024,
        maxStderrBytes: 1024,
        terminationGraceMs: 10,
        finalTerminationMs: 20,
    });

    const firstRun = execution.run();
    const secondRun = execution.run();
    assert.equal(firstRun, secondRun);

    child.stdout.write("reply");
    child.close();

    const result = await firstRun;
    assert.equal(result.spawned, true);
    if (!result.spawned) return;
    assert.equal(result.stdout.toString("utf8"), "reply");
});

test("shared lifecycle captures bounded output and normal exit", async () => {
    const child = new TestChild();
    const completed = runProviderProcess({
        command: "provider",
        arguments_: [],
        spawnImpl: () => child,
        spawnOptions: {},
        stdin: "request",
        timeoutSeconds: 1,
        maxStdoutBytes: 1024,
        maxStderrBytes: 4,
        terminationGraceMs: 10,
        finalTerminationMs: 20,
    });

    child.stdout.write("reply");
    child.stderr.write("diagnostic");
    child.close();

    const result = await completed;
    assert.equal(result.spawned, true);
    if (!result.spawned) return;
    assert.equal(result.stdout.toString("utf8"), "reply");
    assert.equal(result.stderr.toString("utf8"), "diag");
    assert.equal(result.terminationReason, null);
    assert.equal(result.terminationConfirmed, true);
});

test("shared lifecycle escalates termination and reports an unconfirmed timeout", async () => {
    const child = new TestChild();
    const result = await runProviderProcess({
        command: "provider",
        arguments_: [],
        spawnImpl: () => child,
        spawnOptions: {},
        stdin: "request",
        timeoutSeconds: 0.001,
        maxStdoutBytes: 1024,
        maxStderrBytes: 1024,
        terminationGraceMs: 1,
        finalTerminationMs: 5,
    });

    assert.equal(result.spawned, true);
    if (!result.spawned) return;
    assert.equal(result.terminationReason, "timeout");
    assert.equal(result.terminationConfirmed, false);
    assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
});

test("shared lifecycle terminates when stdout crosses its byte limit", async () => {
    const child = new TestChild();
    const completed = runProviderProcess({
        command: "provider",
        arguments_: [],
        spawnImpl: () => child,
        spawnOptions: {},
        stdin: "request",
        timeoutSeconds: 1,
        maxStdoutBytes: 4,
        maxStderrBytes: 1024,
        terminationGraceMs: 10,
        finalTerminationMs: 20,
    });

    child.stdout.write("12345");
    child.close(0, "SIGTERM");

    const result = await completed;
    assert.equal(result.spawned, true);
    if (!result.spawned) return;
    assert.equal(result.outputLimited, true);
    assert.equal(result.terminationReason, "output_limit");
    assert.equal(result.terminationConfirmed, true);
    assert.deepEqual(child.signals, ["SIGTERM"]);
});
