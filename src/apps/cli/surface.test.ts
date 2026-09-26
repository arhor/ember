import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import type { EmberApplication, InteractionEvent } from "../../core/app/contract.ts";

import { composeCliSurface } from "../../core/composition/cli.ts";
import { initialState } from "../../core/model.ts";
import { StateStore } from "../../core/persistence/state-store.ts";
import { runCliSurface } from "./surface.ts";

test("CLI surface should deliver through an injected application when reading ordinary input", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-cli-injected-app-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    await new StateStore(statePath).create(initialState("principal"));
    const { repositories } = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "unused", arguments: [], timeoutSeconds: 1 },
    });
    let received: InteractionEvent | undefined;
    let output = "";
    const application = {
        async interact(event, deliver) {
            received = event;
            await deliver(
                {
                    deliveryId: "fixture-delivery",
                    address: { principal: "principal", scope: "private", surfaceId: "local_cli", destinationId: null },
                    text: "fixture response\n",
                },
                {},
            );
            return {
                diagnostics: { providerFailure: null, memoryProposalFailure: null, onboardingProgressFailure: null },
            };
        },
    } as EmberApplication;
    const io = {
        input: Readable.from(["hello\n:quit\n"]),
        output: new Writable({
            write(chunk, _encoding, callback) {
                output += String(chunk);
                callback();
            },
        }),
        error: new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            },
        }),
    };

    // When
    const status = await runCliSurface({ principal: "principal", scope: "private" }, io, {
        application,
        repositories,
    });

    // Then
    assert.equal(status, 0);
    assert.equal(received?.text, "hello");
    assert.equal(received?.surfaceId, "local_cli");
    assert.equal(output, "fixture response\n");
});

test("CLI setup should require local confirmation when cognition proposes Telegram", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-cli-setup-declined-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    await new StateStore(statePath).create(initialState("principal"));
    const { repositories } = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "unused", arguments: [], timeoutSeconds: 1 },
    });
    let handoffs = 0;
    let output = "";
    const application = {
        async interact() {
            return {
                occurrenceId: "occurrence-setup",
                replayed: false,
                setupIntent: "telegram",
                diagnostics: { providerFailure: null, memoryProposalFailure: null, onboardingProgressFailure: null },
            };
        },
    } as EmberApplication;
    const io = {
        input: Readable.from(["Can we set up Telegram?\n", "no\n", ":quit\n"]),
        output: new Writable({
            write(chunk, _encoding, callback) {
                output += String(chunk);
                callback();
            },
        }),
        error: new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            },
        }),
    };

    // When
    const status = await runCliSurface(
        {
            principal: "principal",
            scope: "private",
            trustedHostSetup: async () => {
                handoffs++;
                return { status: "complete" };
            },
        },
        io,
        { application, repositories },
    );

    // Then
    assert.equal(status, 0);
    assert.equal(handoffs, 0);
    assert.match(output, /Telegram setup cancelled/);
});

test("CLI setup should keep proposal occurrence separate from explicit local confirmation", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-cli-setup-confirmed-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    await new StateStore(statePath).create(initialState("principal"));
    const { repositories } = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "unused", arguments: [], timeoutSeconds: 1 },
    });
    let request: import("../../core/app/contract.ts").TrustedHostSetupRequest | undefined;
    let output = "";
    const application = {
        async interact() {
            return {
                occurrenceId: "occurrence-setup",
                replayed: false,
                setupIntent: "telegram",
                diagnostics: { providerFailure: null, memoryProposalFailure: null, onboardingProgressFailure: null },
            };
        },
    } as EmberApplication;
    const io = {
        input: Readable.from(["Can we set up Telegram?\n", "yes\n", ":quit\n"]),
        output: new Writable({
            write(chunk, _encoding, callback) {
                output += String(chunk);
                callback();
            },
        }),
        error: new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            },
        }),
    };

    // When
    const status = await runCliSurface(
        {
            principal: "principal",
            scope: "private",
            trustedHostSetup: async (value) => {
                request = value;
                return { status: "configured_inactive" };
            },
        },
        io,
        { application, repositories },
    );

    // Then
    assert.equal(status, 0);
    assert.deepEqual(request, {
        intent: "telegram",
        principal: "principal",
        scope: "private",
        proposalOccurrenceId: "occurrence-setup",
        confirmedBy: { principal: "principal", provenance: "explicit_local_prompt", response: "yes" },
    });
    assert.match(output, /Telegram setup: configured_inactive/);
});
