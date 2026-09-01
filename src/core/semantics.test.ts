import test from "node:test";
import assert from "node:assert/strict";
import { validateState } from "./model.ts";
import { withholdDetail } from "./semantics.ts";
import { populatedState, PRINCIPAL } from "../../tests/support.ts";

test("withholding optional detail should preserve unrelated valid evidence metadata", () => {
  // Given
  const { state, ids } = populatedState();
  const detail = state.evidence.find(evidence => evidence.evidence_id === ids.detail);
  assert.ok(detail);
  detail.provider_label = "preserved-descriptor";
  validateState(state);

  // When
  withholdDetail(state, PRINCIPAL, ids.detail);
  const unavailable = state.evidence.find(evidence => evidence.evidence_id === ids.detail);

  // Then
  assert.ok(unavailable);
  assert.equal(unavailable.provider_label, "preserved-descriptor");
  assert.equal("payload" in unavailable, false);
  assert.equal("content_digest" in unavailable, false);
});
