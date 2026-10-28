import type { InteractionEvent, Run, RunState } from "@ember/agent";

import assert from "node:assert/strict";
import test from "node:test";

import { DefaultAgent } from "./default-agent.ts";
import { InMemoryRunRepository, InMemorySessionRepository } from "./repositories.ts";

const event: InteractionEvent<string> = {
    id: "interaction",
    actor: { id: "user", kind: "user" },
    surface: { id: "test" },
    payload: "hello",
    timestamp: Temporal.Instant.from("2026-01-01T00:00:00Z"),
};

class RecordingRuns extends InMemoryRunRepository {
    readonly writes: Run[] = [];
    failState?: RunState;
    failure = new Error("storage unavailable");
    override async save(run: Run) {
        if (run.state === this.failState) throw this.failure;
        this.writes.push(run);
        await super.save(run);
    }
}

test("DefaultAgent should preserve typed output and completed runs when execution succeeds", async () => {
    // Given
    const runs = new RecordingRuns();
    const sessions = new InMemorySessionRepository();
    const agent = new DefaultAgent(
        "agent",
        { execute: async (input: InteractionEvent<string>) => input.payload.length },
        { runs, sessions },
    );
    // When
    const result = await agent.handle(event);
    const continued = await agent.handle({ ...event, sessionId: result.sessionId });
    // Then
    assert.equal(result.output, 5);
    assert.equal(continued.sessionId, result.sessionId);
    assert.notEqual(continued.runId, result.runId);
    assert.equal((await agent.getRun(result.runId!))?.state, "completed");
    assert.equal((await sessions.get(result.sessionId))?.agentId, "agent");
    assert.deepEqual(
        runs.writes.slice(0, 3).map((run) => run.state),
        ["queued", "running", "completed"],
    );
    assert.equal(await agent.getRun("missing"), undefined);
});

test("DefaultAgent should reject unknown sessions when a session ID is supplied", async () => {
    // Given
    const runs = new RecordingRuns();
    const agent = new DefaultAgent("agent", { execute: async () => assert.fail("must not execute") }, { runs });
    // When
    const operation = agent.handle({ ...event, sessionId: "missing" });
    // Then
    await assert.rejects(operation, /Session not found/);
    assert.deepEqual(runs.writes, []);
});

test("DefaultAgent should reject foreign sessions when repositories are shared", async () => {
    // Given
    const sessions = new InMemorySessionRepository();
    await sessions.save({ id: "session", agentId: "other" });
    const agent = new DefaultAgent("agent", { execute: async () => assert.fail("must not execute") }, { sessions });
    // When
    const operation = agent.handle({ ...event, sessionId: "session" });
    // Then
    await assert.rejects(operation, /does not belong/);
});

test("DefaultAgent should save cancellation without executing when already aborted", async () => {
    // Given
    const runs = new RecordingRuns();
    const signal = AbortSignal.abort();
    const agent = new DefaultAgent("agent", { execute: async () => assert.fail("must not execute") }, { runs });
    // When
    const operation = agent.handle(event, { signal });
    // Then
    await assert.rejects(operation, (error) => error === signal.reason);
    assert.deepEqual(
        runs.writes.map((run) => run.state),
        ["queued", "cancelled"],
    );
});

test("DefaultAgent should complete when executor succeeds despite cancellation", async () => {
    // Given
    const controller = new AbortController();
    const agent = new DefaultAgent("agent", {
        execute: async () => {
            controller.abort();
            return "done";
        },
    });
    // When
    const result = await agent.handle(event, { signal: controller.signal });
    // Then
    assert.equal(result.output, "done");
    assert.equal((await agent.getRun(result.runId!))?.state, "completed");
});

test("DefaultAgent should mark failed when executor throws an unrelated error after cancellation", async () => {
    // Given
    const controller = new AbortController();
    const failure = new Error("provider failed");
    const runs = new RecordingRuns();
    const agent = new DefaultAgent(
        "agent",
        {
            execute: async () => {
                controller.abort();
                throw failure;
            },
        },
        { runs },
    );
    // When
    const operation = agent.handle(event, { signal: controller.signal });
    // Then
    await assert.rejects(operation, (error) => error === failure);
    assert.equal((await agent.getRun(runs.writes[0]!.id))?.state, "failed");
});

test("DefaultAgent should mark cancelled when executor propagates the abort reason", async () => {
    // Given
    const controller = new AbortController();
    const runs = new RecordingRuns();
    const agent = new DefaultAgent(
        "agent",
        {
            execute: async (_event, context) => {
                assert.equal(context.signal, controller.signal);
                controller.abort();
                context.signal!.throwIfAborted();
            },
        },
        { runs },
    );
    // When
    const operation = agent.handle(event, { signal: controller.signal });
    // Then
    await assert.rejects(operation, (error) => error === controller.signal.reason);
    assert.equal(runs.writes.at(-1)?.state, "cancelled");
});

test("DefaultAgent should preserve both failures when terminal persistence fails", async () => {
    // Given
    const runs = new RecordingRuns();
    runs.failState = "failed";
    const failure = new Error("executor failed");
    const agent = new DefaultAgent(
        "agent",
        {
            execute: async () => {
                throw failure;
            },
        },
        { runs },
    );
    // When
    const operation = agent.handle(event);
    // Then
    await assert.rejects(operation, (error) => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.cause, failure);
        assert.deepEqual(error.errors, [failure, runs.failure]);
        return true;
    });
    assert.equal((await agent.getRun(runs.writes[0]!.id))?.state, "running");
});

test("DefaultAgent should retain last known state when completion persistence fails", async () => {
    // Given
    const runs = new RecordingRuns();
    runs.failState = "completed";
    const agent = new DefaultAgent("agent", { execute: async () => "done" }, { runs });
    // When
    const operation = agent.handle(event);
    // Then
    await assert.rejects(operation, (error) => error === runs.failure);
    assert.equal((await agent.getRun(runs.writes[0]!.id))?.state, "running");
    assert.deepEqual(
        runs.writes.map((run) => run.state),
        ["queued", "running"],
    );
});

test("DefaultAgent should avoid execution when initial run persistence fails", async () => {
    // Given
    const runs = new RecordingRuns();
    runs.failState = "queued";
    const agent = new DefaultAgent("agent", { execute: async () => assert.fail("must not execute") }, { runs });
    // When
    const operation = agent.handle(event);
    // Then
    await assert.rejects(operation, (error) => error === runs.failure);
    assert.deepEqual(runs.writes, []);
});

test("DefaultAgent should isolate concurrent runs when executions overlap", async () => {
    // Given
    const releases: Array<() => void> = [];
    const ready = Promise.withResolvers<void>();
    const agent = new DefaultAgent("agent", {
        execute: async (input: InteractionEvent<string>) => {
            await new Promise<void>((resolve) => {
                releases.push(resolve);
                if (releases.length === 2) ready.resolve();
            });
            return input.payload;
        },
    });
    // When
    const first = agent.handle(event);
    const second = agent.handle({ ...event, payload: "second" });
    await ready.promise;
    releases.forEach((release) => release());
    const results = await Promise.all([first, second]);
    // Then
    assert.deepEqual(
        results.map((result) => result.output),
        ["hello", "second"],
    );
    assert.notEqual(results[0]!.runId, results[1]!.runId);
    assert.equal((await agent.getRun(results[0]!.runId!))?.state, "completed");
    assert.equal((await agent.getRun(results[1]!.runId!))?.state, "completed");
});
