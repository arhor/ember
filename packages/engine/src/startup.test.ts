import type { InteractionEvent } from "@ember/agent";

import assert from "node:assert/strict";
import test from "node:test";

import type { PluginSetup } from "./startup.ts";

import { uppercasePlugin } from "../../../tests/fixtures/plugins/uppercase.ts";
import { EngineBuilder } from "./startup.ts";

const event: InteractionEvent<string> = {
    id: "event",
    actor: { id: "user", kind: "user" },
    surface: { id: "test" },
    payload: "hello",
    timestamp: Temporal.Instant.from("2026-01-01T00:00:00Z"),
};

test("EngineBuilder should compose an external capability when registered at startup", async () => {
    // Given
    const builder = new EngineBuilder<string, string>().register(uppercasePlugin());
    // When
    const engine = await builder.start("agent");
    const result = await engine.handle(event);
    await engine.close();
    // Then
    assert.equal(result.output, "HELLO");
    assert.equal((await engine.getRun(result.runId!))?.state, "completed");
    await assert.rejects(engine.handle(event), /closed/);
    assert.throws(() => builder.register(uppercasePlugin()), /closed/);
});

test("EngineBuilder should reject invalid dependencies before setup when plugins cannot be ordered", async () => {
    // Given
    let setups = 0;
    const missing = new EngineBuilder().register({
        id: "a",
        dependencies: ["missing"],
        setup: () => {
            setups++;
        },
    });
    const cycle = new EngineBuilder()
        .register({
            id: "a",
            dependencies: ["b"],
            setup: () => {
                setups++;
            },
        })
        .register({
            id: "b",
            dependencies: ["a"],
            setup: () => {
                setups++;
            },
        });
    // When
    const outcomes = await Promise.allSettled([missing.start("agent"), cycle.start("agent")]);
    // Then
    assert.equal(setups, 0);
    assert.ok(outcomes.every((result) => result.status === "rejected"));
    assert.throws(
        () => new EngineBuilder().register({ id: "a", setup() {} }).register({ id: "a", setup() {} }),
        /Duplicate/,
    );
});

test("EngineBuilder should clean up partially initialized plugins when singleton registration conflicts", async () => {
    // Given
    const cleaned: string[] = [];
    const builder = new EngineBuilder()
        .register({
            id: "first",
            setup(registration) {
                registration.onCleanup(() => {
                    cleaned.push("first");
                });
                registration.executor({ execute: async () => undefined });
            },
        })
        .register({
            id: "second",
            setup(registration) {
                registration.onCleanup(() => {
                    cleaned.push("second");
                });
                registration.executor({ execute: async () => undefined });
            },
        });
    // When
    const operation = builder.start("agent");
    // Then
    await assert.rejects(operation, /Conflicting executor/);
    assert.deepEqual(cleaned, ["second", "first"]);
});

test("EngineBuilder should order hooks and reverse cleanup when dependencies precede their registrants", async () => {
    // Given
    const calls: string[] = [];
    let retained!: PluginSetup<string, string>;
    const builder = new EngineBuilder<string, string>()
        .register({
            id: "dependent",
            dependencies: ["base"],
            setup(registration) {
                retained = registration;
                registration.hook({
                    beforeExecute() {
                        calls.push("dependent-before");
                    },
                    afterExecute() {
                        calls.push("dependent-after");
                    },
                });
                registration.onCleanup(() => {
                    calls.push("dependent-cleanup");
                });
            },
        })
        .register({
            id: "base",
            setup(registration) {
                registration.executor({
                    execute: async () => {
                        calls.push("execute");
                        return "ok";
                    },
                });
                registration.hook({
                    beforeExecute() {
                        calls.push("base-before");
                    },
                    afterExecute() {
                        calls.push("base-after");
                    },
                });
                registration.onCleanup(() => {
                    calls.push("base-cleanup");
                });
            },
        });
    // When
    const engine = await builder.start("agent");
    await engine.handle(event);
    await Promise.all([engine.close(), engine.close()]);
    // Then
    assert.deepEqual(calls, [
        "base-before",
        "dependent-before",
        "execute",
        "base-after",
        "dependent-after",
        "dependent-cleanup",
        "base-cleanup",
    ]);
    assert.throws(() => retained.observe(() => {}), /closed/);
});

test("EngineBuilder should retain successful execution when observers fail", async () => {
    // Given
    const states: string[] = [];
    const builder = new EngineBuilder<string, string>().register(uppercasePlugin()).register({
        id: "observer",
        setup(registration) {
            registration.observe(() => {
                throw new Error("observer failed");
            });
            registration.observe((notification) => {
                states.push(notification.run.state);
            });
        },
    });
    // When
    const engine = await builder.start("agent");
    const result = await engine.handle(event);
    await engine.close();
    // Then
    assert.equal(result.output, "HELLO");
    assert.deepEqual(states, ["queued", "running", "completed"]);
    assert.equal(engine.diagnostics.length, 3);
});

test("EngineBuilder should fail the run before execution when a hook rejects", async () => {
    // Given
    const states: string[] = [];
    const builder = new EngineBuilder<string, string>().register({
        id: "failure",
        setup(registration) {
            registration.executor({ execute: async () => assert.fail("execution must not run") });
            registration.hook({
                beforeExecute() {
                    throw new Error("hook rejected");
                },
            });
            registration.observe((notification) => {
                states.push(notification.run.state);
            });
        },
    });
    const engine = await builder.start("agent");
    // When
    const operation = engine.handle(event);
    // Then
    await assert.rejects(operation, /hook rejected/);
    assert.deepEqual(states, ["queued", "running", "failed"]);
    await engine.close();
});

test("EngineBuilder should await admitted work before cleanup when shutdown overlaps execution", async () => {
    // Given
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    let cleaned = false;
    const engine = await new EngineBuilder<string, string>()
        .register({
            id: "slow",
            setup(registration) {
                registration.executor({
                    execute: async () => {
                        entered.resolve();
                        await released.promise;
                        return "done";
                    },
                });
                registration.onCleanup(() => {
                    cleaned = true;
                });
            },
        })
        .start("agent");
    // When
    const operation = engine.handle(event);
    await entered.promise;
    const closing = engine.close();
    const cleanedWhileExecuting = cleaned;
    released.resolve();
    await operation;
    await closing;
    // Then
    assert.equal(cleanedWhileExecuting, false);
    assert.equal(cleaned, true);
});

test("EngineBuilder should preserve prototype setup methods when a plugin is a class instance", async () => {
    // Given
    class ClassPlugin {
        readonly id = "class-plugin";
        readonly output = "class-output";
        setup(registration: PluginSetup<string, string>) {
            registration.executor({ execute: async () => this.output });
        }
    }
    const builder = new EngineBuilder<string, string>().register(new ClassPlugin());
    // When
    const engine = await builder.start("agent");
    const result = await engine.handle(event);
    await engine.close();
    // Then
    assert.equal(result.output, "class-output");
});

test("EngineBuilder should preserve startup failure and continue rollback when cleanup throws", async () => {
    // Given
    const cleaned: string[] = [];
    const startupFailure = new Error("setup failed");
    const cleanupFailure = new Error("cleanup failed");
    const builder = new EngineBuilder()
        .register({
            id: "base",
            setup(registration) {
                registration.onCleanup(() => {
                    cleaned.push("base");
                });
            },
        })
        .register({
            id: "failed",
            setup(registration) {
                registration.onCleanup(() => {
                    cleaned.push("failed");
                    throw cleanupFailure;
                });
                throw startupFailure;
            },
        });
    // When
    const result = await builder.start("agent").catch((error: unknown) => error);
    // Then
    assert.ok(result instanceof AggregateError);
    assert.deepEqual(result.errors, [startupFailure, cleanupFailure]);
    assert.deepEqual(cleaned, ["failed", "base"]);
});
