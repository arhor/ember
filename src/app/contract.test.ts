import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { InteractionEvent, InteractionResult } from "./contract.ts";

import { ValidationError } from "../core/errors.ts";
import { newId } from "../core/model.ts";
import { validateInteractionEvent } from "./contract.ts";

const cliEvent: InteractionEvent = {
    kind: "message",
    principal: "maksim",
    principalProvenance: "explicit_local_argument",
    scope: "ordinary",
    surfaceId: "local_cli",
    text: "hello",
};

const telegramEvent: InteractionEvent = {
    kind: "message",
    principal: "maksim",
    principalProvenance: "configured_surface_mapping",
    scope: "ordinary",
    surfaceId: "telegram_bot",
    text: "hello",
    externalOccurrence: { occurrenceId: "12345" },
    deliveryDestinationId: "chat-98765",
};

test("an ordinary CLI message satisfies the contract without transport-specific fields", () => {
    assert.doesNotThrow(() => validateInteractionEvent(cliEvent));
});

test("an ordinary Telegram message satisfies the contract with its occurrence/destination evidence", () => {
    assert.doesNotThrow(() => validateInteractionEvent(telegramEvent));
});

test("an event missing a required field is rejected", () => {
    const { text: _text, ...withoutText } = cliEvent;
    assert.throws(() => validateInteractionEvent(withoutText), ValidationError);
});

test("an event with an unsupported field is rejected", () => {
    assert.throws(() => validateInteractionEvent({ ...cliEvent, sessionId: "s-1" }), ValidationError);
});

test("an event whose kind is not 'message' is rejected", () => {
    assert.throws(() => validateInteractionEvent({ ...cliEvent, kind: "wake" }), ValidationError);
});

test("an event with an unsupported principal provenance is rejected", () => {
    assert.throws(
        () => validateInteractionEvent({ ...cliEvent, principalProvenance: "bot_api_token" }),
        ValidationError,
    );
});

test("an event with a malformed conversationMembership intent is rejected", () => {
    assert.throws(
        () =>
            validateInteractionEvent({
                ...cliEvent,
                conversationMembership: { action: "continue", basis: "ambiguous_discourse" },
            }),
        ValidationError,
    );
});

test("cognition completion can be represented with delivery left unresolved", () => {
    const result: InteractionResult = {
        occurrenceId: "occurrence-1",
        cognitionId: newId("cognition"),
        cognitionStatus: "completed",
        replayed: false,
        deliveryId: null,
        delivery: null,
        diagnostics: { providerFailure: null, memoryProposalFailure: null, onboardingProgressFailure: null },
    };
    assert.equal(result.cognitionStatus, "completed");
    assert.equal(result.delivery, null);
});

test("the contract module only imports transport-neutral core/utility collaborators", async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(join(here, "contract.ts"), "utf8");
    const importPaths = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]!);
    assert.ok(importPaths.length > 0, "expected the contract module to import its collaborators");
    for (const path of importPaths) {
        assert.ok(
            path.startsWith("../core/") || path === "../util.ts",
            `unexpected transport/provider/persistence import in the application contract: ${path}`,
        );
    }
});

test("core/interaction-contract.ts stays a leaf so the reused types carry no transitive runtime/SDK dependency", async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(join(here, "..", "core", "interaction-contract.ts"), "utf8");
    assert.ok(!/^import /m.test(source), "expected core/interaction-contract.ts to have no imports of its own");
});
