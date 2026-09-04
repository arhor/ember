import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { buildCodexPrompt, invokeCodexExec } from "../experiments/external-agent-runtime/codex-provider.ts";
import { runProbe } from "../experiments/external-agent-runtime/probe.ts";
import { buildProjection } from "../src/core/projection.ts";
import { startRuntime } from "../src/runtime/runtime.ts";
import { populatedState, PRINCIPAL, SCOPE, tempDir } from "./support.ts";

test("external runtime probe should summarize JSONL lifecycle when child exits successfully", async () => {
    // Given
    const script =
        "process.stdout.write(JSON.stringify({type:'started'})+'\\n'+JSON.stringify({type:'completed'})+'\\n')";

    // When
    const result = await runProbe({
        command: process.execPath,
        arguments_: ["-e", script],
        cwd: process.cwd(),
        timeoutMs: 1_000,
    });

    // Then
    assert.deepEqual(
        [result.exit_code, result.exit_signal, result.jsonl_event_types],
        [0, null, ["started", "completed"]],
    );
});

test("external runtime probe should report only direct-child termination when cancellation is requested", async () => {
    // Given
    const script = "setInterval(()=>{},1000)";

    // When
    const result = await runProbe({
        command: process.execPath,
        arguments_: ["-e", script],
        cwd: process.cwd(),
        timeoutMs: 1_000,
        cancelAfterMs: 20,
    });

    // Then
    assert.deepEqual(
        [result.termination_reason, result.direct_child_exit_observed, result.exit_signal],
        ["explicit_cancel", true, "SIGTERM"],
    );
});

test("external runtime probe should force direct-child termination when graceful cancellation is ignored", async () => {
    // Given
    const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        kill: (signal?: NodeJS.Signals | number) => boolean;
    };
    Object.assign(child, {
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        kill: (signal?: NodeJS.Signals | number) => {
            if (signal === "SIGKILL") setImmediate(() => child.emit("close", null, "SIGKILL"));
            return true;
        },
    });

    // When
    const result = await runProbe({
        command: "fixture",
        arguments_: [],
        cwd: process.cwd(),
        timeoutMs: 2_000,
        cancelAfterMs: 5,
        terminationGraceMs: 5,
        finalTerminationMs: 50,
        spawnImpl: () => child,
    });

    // Then
    assert.deepEqual(
        [result.termination_reason, result.direct_child_exit_observed, result.exit_signal],
        ["explicit_cancel", true, "SIGKILL"],
    );
});

test("external runtime probe should distinguish timeout when deadline triggers termination", async () => {
    // Given
    const script = "setInterval(()=>{},1000)";

    // When
    const result = await runProbe({
        command: process.execPath,
        arguments_: ["-e", script],
        cwd: process.cwd(),
        timeoutMs: 20,
    });

    // Then
    assert.deepEqual([result.termination_reason, result.direct_child_exit_observed], ["timeout", true]);
});

test("external runtime probe should report unconfirmed when direct child termination is never observed", async () => {
    // Given
    const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
        kill: (signal?: NodeJS.Signals | number) => boolean;
    };
    Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });

    // When
    const result = await runProbe({
        command: "fixture",
        arguments_: [],
        cwd: process.cwd(),
        timeoutMs: 100,
        cancelAfterMs: 5,
        terminationGraceMs: 5,
        finalTerminationMs: 20,
        spawnImpl: () => child,
    });

    // Then
    assert.deepEqual(
        [result.termination_reason, result.direct_child_exit_observed, result.exit_code, result.exit_signal],
        ["explicit_cancel", false, null, null],
    );
});

test("Codex experiment adapter should return validated provider result when bounded Ember request is supplied", async () => {
    // Given
    const { state } = populatedState();
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-08-31T10:00:00Z" });
    const projection = buildProjection(started.state, {
        principal: PRINCIPAL,
        scope: SCOPE,
        currentInput: "Which server?",
        currentTime: "2026-08-31T10:00:01Z",
        runtimeId: started.runtimeId,
    });
    const request = {
        contract_version: 1 as const,
        cognition_id: "cognition-adapter-test" as const,
        projection,
        input: { text: "Which server?" },
    };
    const used = projection.selection.meaning_ids[0];
    const fakeCodex = `process.stdin.resume();process.stdin.on('end',()=>{const result={contract_version:1,reply:'bounded answer',used_meaning_ids:['${used}']};process.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(result)}})+'\\n');});`;

    // When
    const result = await invokeCodexExec(request, {
        command: process.execPath,
        argumentPrefix: ["-e", fakeCodex],
        cwd: await tempDir(),
    });

    // Then
    assert.deepEqual(
        [result, buildCodexPrompt(request).includes(JSON.stringify(request))],
        [{ contract_version: 1, reply: "bounded answer", used_meaning_ids: [used] }, true],
    );
});
