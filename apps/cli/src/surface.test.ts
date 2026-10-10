import type { EmberApplication, InteractionEvent } from "@ember/core/app/contract.ts";

import { composeCliSurface } from "@ember/core/composition/cli.ts";
import { initialState } from "@ember/core/model.ts";
import { StateStore } from "@ember/core/persistence/state-store.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

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

test("CLI surface should end the session when quit has a space after the colon", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cli-quit-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    await new StateStore(statePath).create(initialState("principal"));
    const { repositories } = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "unused", arguments: [], timeoutSeconds: 1 },
    });
    let interactions = 0;
    const application = {
        async interact() {
            interactions += 1;
            return {
                diagnostics: { providerFailure: null, memoryProposalFailure: null, onboardingProgressFailure: null },
            };
        },
    } as EmberApplication;
    const io = silentIo(Readable.from([]));

    const status = await runCliSurface(
        { principal: "principal", scope: "private", lines: readableLines([": quit"]) },
        io,
        { application, repositories },
    );

    assert.equal(status, 0);
    assert.equal(interactions, 0);
});

test("CLI surface should remember a relationship when the colon is followed by a space", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cli-remember-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    await new StateStore(statePath).create(initialState("principal"));
    const { repositories } = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "unused", arguments: [], timeoutSeconds: 1 },
    });
    let output = "";
    const io = silentIo(Readable.from([]), (text) => {
        output += text;
    });

    const status = await runCliSurface(
        {
            principal: "principal",
            scope: "private",
            lines: readableLines([
                ": remember relationship relationship:principal private Ember and principal are continuing collaborators",
                ":quit",
            ]),
        },
        io,
        {
            application: { async interact() {} } as EmberApplication,
            repositories,
        },
    );

    assert.equal(status, 0);
    assert.match(output, /^meaning-/);
});

test("CLI surface should keep fixture withholding gated and continue after a rejected command", async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "ember-cli-fixture-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    await new StateStore(statePath).create(initialState("principal"));
    const { repositories } = composeCliSurface({
        statePath,
        provider: { kind: "process", command: "unused", arguments: [], timeoutSeconds: 1 },
    });
    let error = "";
    const io = silentIo(
        Readable.from([]),
        () => {},
        (text) => {
            error += text;
        },
    );
    const previous = process.env.EMBER_ENABLE_FIXTURE_FAULTS;
    delete process.env.EMBER_ENABLE_FIXTURE_FAULTS;
    t.after(() => {
        if (previous === undefined) delete process.env.EMBER_ENABLE_FIXTURE_FAULTS;
        else process.env.EMBER_ENABLE_FIXTURE_FAULTS = previous;
    });

    const status = await runCliSurface(
        {
            principal: "principal",
            scope: "private",
            lines: readableLines([":fixture-withhold detail-1", ":quit"]),
        },
        io,
        {
            application: { async interact() {} } as EmberApplication,
            repositories,
        },
    );

    assert.equal(status, 0);
    assert.match(error, /fixture fault command is available only to deterministic test harness/);
});

function readableLines(lines: string[]): AsyncIterable<string> {
    return {
        async *[Symbol.asyncIterator]() {
            yield* lines;
        },
    };
}

function silentIo(
    input: Readable,
    onOutput: (text: string) => void = () => {},
    onError: (text: string) => void = () => {},
) {
    return {
        input,
        output: new Writable({
            write(chunk, _encoding, callback) {
                onOutput(String(chunk));
                callback();
            },
        }),
        error: new Writable({
            write(chunk, _encoding, callback) {
                onError(String(chunk));
                callback();
            },
        }),
    };
}
