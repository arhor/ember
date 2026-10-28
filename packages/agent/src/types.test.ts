import assert from "node:assert/strict";
import test from "node:test";

import type { Agent, InteractionEvent, RunState } from "./index.ts";

test("Agent should preserve payload and output types when implemented without a provider", async () => {
    // Given
    const agent: Agent<{ text: string }, { length: number }> = {
        identity: "example",
        async handle(interaction) {
            return { sessionId: "session", output: { length: interaction.payload.text.length } };
        },
        async getRun() {
            return undefined;
        },
    };
    const interaction: InteractionEvent<{ text: string }> = {
        id: "interaction",
        actor: { id: "user", kind: "user" },
        surface: { id: "test" },
        payload: { text: "hello" },
        timestamp: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    };

    // When
    const result = await agent.handle(interaction);

    // Then
    assert.equal(result.output?.length, 5);
});

// Compile-time checks are verified with the package's test typecheck configuration.
const validState: RunState = "completed";
// @ts-expect-error Run states must belong to the engine lifecycle.
const invalidState: RunState = "delivered";
void validState;
void invalidState;
