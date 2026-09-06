import assert from "node:assert/strict";
import test from "node:test";

import { populatedState, PRINCIPAL } from "../../tests/support.ts";
import { validateState } from "./model.ts";
import { withholdDetail } from "./semantics.ts";

test("withholding optional detail should preserve unrelated valid evidence metadata", () => {
    // Given
    const { state, ids } = populatedState();
    const detail = state.evidence.find((evidence) => evidence.evidenceId === ids.detail);
    assert.ok(detail);
    detail.providerLabel = "preserved-descriptor";
    validateState(state);

    // When
    withholdDetail(state, PRINCIPAL, ids.detail);
    const unavailable = state.evidence.find((evidence) => evidence.evidenceId === ids.detail);

    // Then
    assert.ok(unavailable);
    assert.equal(unavailable.providerLabel, "preserved-descriptor");
    assert.equal("payload" in unavailable, false);
    assert.equal("contentDigest" in unavailable, false);
});
