import { EngineBuilder } from "@ember/engine";
import assert from "node:assert/strict";
import test from "node:test";

import type { McpCapabilitySource } from "./ai-sdk.ts";

import { createMcpPlugin } from "./plugin.ts";

test("MCP plugin should close its source when engine shuts down", async () => {
    // Given
    let closed = 0;
    let registered: McpCapabilitySource | undefined;
    const source: McpCapabilitySource = {
        discover: async () => [],
        bind: () => {
            throw new Error("unused");
        },
        close: async () => {
            closed++;
        },
    };
    const builder = new EngineBuilder()
        .register(
            createMcpPlugin({
                id: "mcp",
                open: async () => source,
                register(value) {
                    registered = value;
                },
            }),
        )
        .register({
            id: "execution",
            setup(registration) {
                registration.executor({ execute: async () => "ok" });
            },
        });

    // When
    const engine = await builder.start("fixture");
    await engine.close();
    await engine.close();

    // Then
    assert.equal(registered, source);
    assert.equal(closed, 1);
});

test("MCP plugin should close its source when capability registration fails", async () => {
    // Given
    let closed = 0;
    const source: McpCapabilitySource = {
        discover: async () => [],
        bind: () => {
            throw new Error("unused");
        },
        close: async () => {
            closed++;
        },
    };
    const builder = new EngineBuilder().register(
        createMcpPlugin({
            id: "mcp",
            open: async () => source,
            register() {
                throw new Error("registration failed");
            },
        }),
    );

    // When
    const started = builder.start("fixture");

    // Then
    await assert.rejects(started, /registration failed/);
    assert.equal(closed, 1);
});
