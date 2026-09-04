import assert from "node:assert/strict";
import test from "node:test";

import { populatedState, PRINCIPAL, SCOPE } from "../../tests/support.ts";
import { startRuntime } from "../runtime/runtime.ts";
import { buildProjection } from "./projection.ts";

test("ordinary projection should not resolve unused explain IDs", () => {
    // Given
    const { state } = populatedState();
    const started = startRuntime(state, PRINCIPAL, SCOPE, { timestamp: "2026-08-30T11:00:00Z" });

    // When
    const projection = buildProjection(started.state, {
        principal: PRINCIPAL,
        scope: SCOPE,
        currentInput: "Continue",
        currentTime: "2026-08-30T11:00:01Z",
        runtimeId: started.runtimeId,
        purpose: "ordinary",
        explainIds: ["meaning-not-present"],
    });

    // Then
    assert.deepEqual(projection.selection.explicit_explain_ids, ["meaning-not-present"]);
});
