import { providerLabel } from "@ember/composition/provider-label.ts";
import assert from "node:assert/strict";
import test from "node:test";

test("providerLabel should return the executable basename when command contains a path", () => {
    // Given
    const command = "/opt/ember/bin/provider";

    // When
    const label = providerLabel(command);

    // Then
    assert.equal(label, "provider");
});
