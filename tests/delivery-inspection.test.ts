import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { SurfaceDeliveryFailure, runSurfaceInteraction } from "../src/runtime/interaction-boundary.ts";
import { startRuntime } from "../src/runtime/runtime.ts";
import { main as cliMain } from "../src/surfaces/cli/index.ts";

const PRINCIPAL = "max";
const SCOPE = "private";
const RETAINED_REPLY = "retained delivery representation must stay private";

test("CLI inspection redacts retained delivery representation while exposing recovery metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-delivery-inspection-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState("Ember", PRINCIPAL));
    const lease = await store.acquireWriteLease();
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, PRINCIPAL, SCOPE);
        const state = await store.commit(loaded.revision, started.state);
        await assert.rejects(
            runSurfaceInteraction(store, state, {
                runtimeId: started.runtimeId,
                principal: PRINCIPAL,
                scope: SCOPE,
                text: "please answer",
                providerLabel: "fixture-provider",
                timeoutSeconds: 1,
                provider: async () => ({
                    contractVersion: 1,
                    reply: RETAINED_REPLY,
                    usedMeaningIds: [],
                }),
                surfaceId: "messaging:test",
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: { occurrenceId: "update-inspection" },
                deliveryDestinationId: "chat-inspection",
                deliver: () => {
                    throw new SurfaceDeliveryFailure("definite retryable transport failure", {
                        outcome: "failed",
                        retryable: true,
                    });
                },
            }),
            /definite retryable transport failure/,
        );
    } finally {
        await store.releaseWriteLease(lease);
    }

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
