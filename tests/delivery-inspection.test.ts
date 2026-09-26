import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { main as cliMain } from "../src/apps/cli/index.ts";
import { createEmberApplication } from "../src/core/app/application.ts";
import { composeEmberApplication } from "../src/core/composition/ember.ts";
import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";

const PRINCIPAL = "max";
const SCOPE = "private";
const RETAINED_REPLY = "retained delivery representation must stay private";

test("CLI inspection redacts retained delivery representation while exposing recovery metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-inspection-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState(PRINCIPAL));
    const application = createEmberApplication(
        composeEmberApplication(
            {
                statePath,
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                executor: async () => ({
                    contractVersion: 1,
                    reply: RETAINED_REPLY,
                    usedMeaningIds: [],
                }),
            },
        ),
    );
    const result = await application.interact(
        {
            kind: "message",
            principal: PRINCIPAL,
            scope: SCOPE,
            text: "please answer",
            surfaceId: "messaging:test",
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: { occurrenceId: "update-inspection" },
            deliveryDestinationId: "chat-inspection",
        },
        async () => ({ outcome: "failed", retryable: true, retryAfterSeconds: null, externalMessageId: null }),
    );
    assert.equal(result.delivery?.status, "retryable_failure");

    try {
        let output = "";
        let error = "";
        const code = await cliMain(["inspect", "--state", statePath, "--principal", PRINCIPAL, "--json"], {
            input: Readable.from([]),
            output: new Writable({
                write(chunk, _encoding, callback) {
                    output += chunk.toString();
                    callback();
                },
            }),
            error: new Writable({
                write(chunk, _encoding, callback) {
                    error += chunk.toString();
                    callback();
                },
            }),
        });

        assert.equal(code, 0, error);
        assert.equal(output.includes(RETAINED_REPLY), false);
        const inspected = JSON.parse(output) as {
            interactions: {
                deliveries: Array<{
                    representation: { available: boolean; contentDigest: string | null };
                }>;
            };
        };
        assert.equal(inspected.interactions.deliveries[0]?.representation.available, true);
        assert.match(inspected.interactions.deliveries[0]?.representation.contentDigest ?? "", /^sha256:[0-9a-f]{64}$/);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
