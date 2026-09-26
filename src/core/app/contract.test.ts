import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { DeliveryObservation, InteractionEvent, InteractionResult } from "./contract.ts";

import { ValidationError } from "../errors.ts";
import { newId } from "../model.ts";
import { validateDeliveryObservation, validateInteractionEvent } from "./contract.ts";

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

test("Telegram correlation metadata beyond occurrenceId is fully validated, not just passed through", () => {
    const withMalformedThreadId = {
        ...telegramEvent,
        externalOccurrence: { occurrenceId: "12345", threadId: "\u0000" },
    };
    assert.throws(() => validateInteractionEvent(withMalformedThreadId), ValidationError);

    const withMalformedOccurredAt = {
        ...telegramEvent,
        externalOccurrence: { occurrenceId: "12345", occurredAt: "not-a-timestamp" },
    };
    assert.throws(() => validateInteractionEvent(withMalformedOccurredAt), ValidationError);

    const withUnsupportedNestedField = {
        ...telegramEvent,
        externalOccurrence: { occurrenceId: "12345", chatTitle: "General" },
    };
    assert.throws(() => validateInteractionEvent(withUnsupportedNestedField), ValidationError);

    const withFullCorrelationMetadata = {
        ...telegramEvent,
        externalOccurrence: {
            occurrenceId: "12345",
            messageId: "msg-1",
            threadId: "thread-1",
            correlationId: "corr-1",
            occurredAt: "2026-09-21T00:00:00Z",
        },
    };
    assert.doesNotThrow(() => validateInteractionEvent(withFullCorrelationMetadata));
});

test("an explicit undefined on an optional nested externalOccurrence field is rejected, not treated as absent", () => {
    assert.throws(
        () =>
            validateInteractionEvent({
                ...telegramEvent,
                externalOccurrence: { occurrenceId: "12345", messageId: undefined },
            }),
        ValidationError,
    );
    assert.throws(
        () =>
            validateInteractionEvent({
                ...telegramEvent,
                externalOccurrence: { occurrenceId: "12345", occurredAt: undefined },
            }),
        ValidationError,
    );
    assert.doesNotThrow(() =>
        validateInteractionEvent({
            ...telegramEvent,
            externalOccurrence: { occurrenceId: "12345" },
        }),
    );
});

test("a confirmed or uncertain delivery observation may carry an external message ID", () => {
    const confirmed: DeliveryObservation = { outcome: "confirmed", externalMessageId: "msg-1" };
    const uncertain: DeliveryObservation = { outcome: "uncertain", externalMessageId: null };
    assert.doesNotThrow(() => validateDeliveryObservation(confirmed));
    assert.doesNotThrow(() => validateDeliveryObservation(uncertain));
});

test("an explicit undefined externalMessageId on a delivery observation is rejected, since the field is required", () => {
    assert.throws(
        () => validateDeliveryObservation({ outcome: "confirmed", externalMessageId: undefined }),
        ValidationError,
    );
    assert.throws(
        () =>
            validateDeliveryObservation({
                outcome: "failed",
                retryable: false,
                retryAfterSeconds: null,
                externalMessageId: undefined,
            }),
        ValidationError,
    );
});

test("a failed delivery observation preserves external message evidence alongside retry metadata", () => {
    const failed: DeliveryObservation = {
        outcome: "failed",
        retryable: true,
        retryAfterSeconds: 30,
        externalMessageId: "rejected-message-1",
    };
    assert.doesNotThrow(() => validateDeliveryObservation(failed));
});

test("retryAfterSeconds is only valid for a retryable definite failure", () => {
    assert.throws(
        () =>
            validateDeliveryObservation({
                outcome: "failed",
                retryable: false,
                retryAfterSeconds: 30,
                externalMessageId: null,
            }),
        ValidationError,
    );
    assert.throws(
        () =>
            validateDeliveryObservation({
                outcome: "failed",
                retryable: true,
                retryAfterSeconds: -1,
                externalMessageId: null,
            }),
        ValidationError,
    );
    assert.doesNotThrow(() =>
        validateDeliveryObservation({
            outcome: "failed",
            retryable: false,
            retryAfterSeconds: null,
            externalMessageId: null,
        }),
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
            path.startsWith("../") || path === "../util.ts",
            `unexpected transport/provider/persistence import in the application contract: ${path}`,
        );
    }
});

test("core/interaction-contract.ts stays a leaf so the reused types carry no transitive runtime/SDK dependency", async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = await readFile(join(here, "..", "interaction-contract.ts"), "utf8");
    assert.ok(!/^import /m.test(source), "expected core/interaction-contract.ts to have no imports of its own");
});
