import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ProviderRequest } from "../providers/contract.ts";
import type { InteractionEvent } from "./contract.ts";

import { composeEmberApplication } from "../composition/ember.ts";
import { initialState } from "../core/model.ts";
import { createEmberApplication } from "./application.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

test("CLI- and Telegram-shaped requests follow the same application coordinator path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-"));
    try {
        const requests: ProviderRequest[] = [];
        const dependencies = composeEmberApplication(
            {
                statePath: join(directory, "state.json"),
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                provider: async (request) => {
                    requests.push(request);
                    return { contractVersion: 1, reply: "same reply", usedMeaningIds: [] };
                },
            },
        );
        await dependencies.repositories.state.create(initialState(PRINCIPAL));
        const application = createEmberApplication(dependencies);
        const delivered: Array<{ surfaceId: string; text: string }> = [];
        const transport = async (intent: { address: { surfaceId: string }; text: string }) => {
            delivered.push({ surfaceId: intent.address.surfaceId, text: intent.text });
            return { outcome: "confirmed" as const, externalMessageId: null };
        };

        const cli = await application.interact(event("local_cli", "explicit_local_argument"), transport);
        const telegram = await application.interact(
            {
                ...event("telegram", "configured_surface_mapping"),
                externalOccurrence: { occurrenceId: "update-1", messageId: "message-1", threadId: null },
                deliveryDestinationId: "chat-1",
            },
            transport,
        );

        assert.equal(requests.length, 2);
        assert.deepEqual(
            requests.map((request) => request.input.text),
            ["same input", "same input"],
        );
        assert.deepEqual(
            requests.map((request) => request.projection.surface),
            ["local_cli", "telegram"],
        );
        assert.deepEqual(delivered, [
            { surfaceId: "local_cli", text: "same reply\n" },
            { surfaceId: "telegram", text: "same reply\n" },
        ]);
        assert.equal(cli.cognitionStatus, "completed");
        assert.equal(telegram.cognitionStatus, "completed");
        assert.equal(cli.delivery?.status, "confirmed");
        assert.equal(telegram.delivery?.status, "confirmed");
        assert.equal(cli.diagnostics.providerFailure, null);
        assert.equal(telegram.diagnostics.providerFailure, null);

        const state = await dependencies.repositories.state.load();
        assert.equal(state.operations.cognitionEpisodes.length, 2);
        assert.equal(state.operations.runtimeEpisodes.length, 2);
        assert.ok(state.operations.runtimeEpisodes.every((runtime) => runtime.cleanStopAt !== null));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

function event(surfaceId: string, principalProvenance: InteractionEvent["principalProvenance"]): InteractionEvent {
    return {
        kind: "message",
        principal: PRINCIPAL,
        principalProvenance,
        scope: SCOPE,
        surfaceId,
        text: "same input",
    };
}
