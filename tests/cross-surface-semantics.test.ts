import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import type { ProviderInvoker, ProviderRequest } from "../src/providers/contract.ts";
import type { TelegramSurfaceConfig, TelegramUpdate } from "../src/surfaces/telegram.ts";

import { main as cliMain } from "../src/cli/main.ts";
import { initialState } from "../src/core/model.ts";
import { rememberFact } from "../src/core/semantics.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { InteractionLedgerStore, runSurfaceInteraction } from "../src/runtime/interaction-boundary.ts";
import { startRuntime, stopRuntime } from "../src/runtime/runtime.ts";
import { TELEGRAM_SURFACE_ID, processTelegramUpdate } from "../src/surfaces/telegram.ts";

const PRINCIPAL = "max";
const SHARED_SCOPE = "surface:shared";
const PRIVATE_SCOPE = "surface:private";
const CHAT_ID = 424242;

function telegramConfig(directory: string, statePath: string): TelegramSurfaceConfig {
    return {
        config_version: 1,
        state_path: statePath,
        principal: PRINCIPAL,
        active_scope: SHARED_SCOPE,
        chat_id: CHAT_ID,
        token_file: join(directory, "telegram.token"),
        poll_timeout_seconds: 30,
        provider_kind: "process",
        provider_command: "/bin/echo",
        provider_arguments: [],
        provider_timeout_seconds: 30,
        working_directory: directory,
        node_path: process.execPath,
        surface_entrypoint: resolve("bin/ember-telegram.ts"),
        stop_timeout_seconds: 45,
    };
}

function telegramUpdate(updateId: number, text = "hello from Telegram"): TelegramUpdate {
    return {
        update_id: updateId,
        message: {
            message_id: updateId + 1000,
            date: 1_788_608_000,
            chat: { id: CHAT_ID, type: "private" },
            from: { id: CHAT_ID, is_bot: false, username: "max" },
            text,
        },
    };
}

function captureProvider(requests: ProviderRequest[]): ProviderInvoker {
    return async (_command, _args, request) => {
        requests.push(request);
        return { contract_version: 1, reply: "accepted", used_meaning_ids: [] };
    };
}

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-cross-surface-"));
    const statePath = join(directory, "ember.json");
    const state = initialState("Ember", PRINCIPAL);
    const sharedMeaningId = rememberFact(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "shared-note",
        SHARED_SCOPE,
        "This meaning is permitted on the shared surface scope",
    );
    const privateMeaningId = rememberFact(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "private-note",
        PRIVATE_SCOPE,
        "This meaning must not cross into the shared surface scope",
    );
    const store = new StateStore(statePath);
    await store.create(state);
    return {
        directory,
        statePath,
        store,
        sharedMeaningId,
        privateMeaningId,
        config: telegramConfig(directory, statePath),
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

async function runLocalSurface(
    store: StateStore,
    provider: ProviderInvoker,
    { purpose = "ordinary", explainIds = [] as string[] } = {},
) {
    const lease = await store.acquireWriteLease();
    try {
        const loaded = await store.load();
        const started = startRuntime(loaded, PRINCIPAL, SHARED_SCOPE);
        const state = await store.commit(loaded.revision, started.state);
        const result = await runSurfaceInteraction(store, state, {
            runtimeId: started.runtimeId,
            principal: PRINCIPAL,
            scope: SHARED_SCOPE,
            text: purpose === "explain" ? "Explain the requested meaning" : "hello from CLI",
            command: "fixture-provider",
            timeoutSeconds: 1,
            provider,
            purpose,
            explainIds,
            surfaceId: "local_cli",
            principalProvenance: "explicit_local_argument",
            deliver: () => {},
        });
        const stopped = stopRuntime(result.state, started.runtimeId, { reason: "cross_surface_test_complete" });
        await store.commit(result.state.revision, stopped);
        return result;
    } finally {
        await store.releaseWriteLease(lease);
    }
}

function memoryOutput(chunks: string[]) {
    return new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(String(chunk));
            callback();
        },
    });
}

test("CLI and Telegram preserve one principal and the same least-sufficient scope while keeping transport metadata operational", async () => {
    const f = await fixture();
    try {
        const cliRequests: ProviderRequest[] = [];
        const telegramRequests: ProviderRequest[] = [];
        await runLocalSurface(f.store, captureProvider(cliRequests));

        let sends = 0;
        const outcome = await processTelegramUpdate(
            f.config,
            {
                sendMessage: async (chatId: number, text: string) => {
                    sends += 1;
                    assert.equal(chatId, CHAT_ID);
                    assert.equal(text, "accepted\n");
                    return { message_id: 9001, chat: { id: CHAT_ID, type: "private" } };
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            telegramUpdate(42),
            { provider: captureProvider(telegramRequests) },
        );

        assert.equal(outcome.kind, "processed");
        assert.equal(sends, 1);
        assert.equal(cliRequests.length, 1);
        assert.equal(telegramRequests.length, 1);

        const cliProjection = cliRequests[0]!.projection;
        const telegramProjection = telegramRequests[0]!.projection;
        assert.equal(cliProjection.principal, PRINCIPAL);
        assert.equal(telegramProjection.principal, PRINCIPAL);
        assert.equal(cliProjection.active_scope, SHARED_SCOPE);
        assert.equal(telegramProjection.active_scope, SHARED_SCOPE);
        assert.equal(cliProjection.surface, "local_cli");
        assert.equal(telegramProjection.surface, TELEGRAM_SURFACE_ID);
        assert.deepEqual(
            [...cliProjection.selection.meaning_ids].sort(),
            [...telegramProjection.selection.meaning_ids].sort(),
        );
        assert.equal(cliProjection.selection.meaning_ids.includes(f.sharedMeaningId), true);
        assert.equal(telegramProjection.selection.meaning_ids.includes(f.sharedMeaningId), true);
        assert.equal(cliProjection.selection.meaning_ids.includes(f.privateMeaningId), false);
        assert.equal(telegramProjection.selection.meaning_ids.includes(f.privateMeaningId), false);

        const telegramProjectionText = JSON.stringify(telegramProjection);
        assert.equal(telegramProjectionText.includes("update:42"), false);
        assert.equal(telegramProjectionText.includes(String(CHAT_ID)), false);

        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences.length, 2);
        assert.equal(ledger.deliveries.length, 2);
        const cliOccurrence = ledger.inbound_occurrences.find((record) => record.surface_id === "local_cli");
        const telegramOccurrence = ledger.inbound_occurrences.find(
            (record) => record.surface_id === TELEGRAM_SURFACE_ID,
        );
        assert.ok(cliOccurrence);
        assert.ok(telegramOccurrence);
        assert.equal(cliOccurrence.asserted_principal, PRINCIPAL);
        assert.equal(cliOccurrence.principal_provenance, "explicit_local_argument");
        assert.equal(cliOccurrence.delivery_destination_id, null);
        assert.equal(telegramOccurrence.asserted_principal, PRINCIPAL);
        assert.equal(telegramOccurrence.principal_provenance, "configured_surface_mapping");
        assert.equal(telegramOccurrence.external_occurrence_id, "update:42");
        assert.equal(telegramOccurrence.delivery_destination_id, `telegram:chat:${CHAT_ID}`);

        const telegramDelivery = ledger.deliveries.find((record) => record.surface_id === TELEGRAM_SURFACE_ID);
        assert.ok(telegramDelivery);
        assert.equal(telegramDelivery.destination_id, `telegram:chat:${CHAT_ID}`);
        assert.equal(telegramDelivery.attempts.length, 1);
        assert.equal(telegramDelivery.attempts[0]?.outcome, "confirmed");
        assert.equal(telegramDelivery.attempts[0]?.external_message_id, "9001");

        const output: string[] = [];
        const code = await cliMain(
            ["inspect", "--state", f.statePath, "--principal", PRINCIPAL, "--json"],
            { input: Readable.from([]), output: memoryOutput(output), error: memoryOutput([]) },
        );
        assert.equal(code, 0);
        const inspection = JSON.parse(output.join(""));
        assert.equal(inspection.interactions.inbound_occurrences.length, 2);
        assert.equal(inspection.interactions.deliveries.length, 2);
        assert.equal(
            inspection.interactions.inbound_occurrences.some(
                (record: { surface_id: string; principal_provenance: string }) =>
                    record.surface_id === TELEGRAM_SURFACE_ID &&
                    record.principal_provenance === "configured_surface_mapping",
            ),
            true,
        );
    } finally {
        await f.close();
    }
});

test("matching Telegram chat identity cannot manufacture a different Ember principal", async () => {
    const f = await fixture();
    try {
        let providerCalls = 0;
        const config = { ...f.config, principal: "intruder" };
        await assert.rejects(
            processTelegramUpdate(
                config,
                {
                    sendMessage: async () => {
                        throw new Error("delivery must not be attempted");
                    },
                } as Parameters<typeof processTelegramUpdate>[1],
                telegramUpdate(51),
                {
                    provider: async () => {
                        providerCalls += 1;
                        return { contract_version: 1, reply: "must not happen", used_meaning_ids: [] };
                    },
                },
            ),
            /principal/,
        );
        assert.equal(providerCalls, 0);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences.length, 0);
        assert.equal((await f.store.load()).operations.cognition_episodes.length, 0);
    } finally {
        await f.close();
    }
});

test("explicit explanation cannot widen the active scope on any interaction surface", async () => {
    const f = await fixture();
    try {
        let providerCalls = 0;
        const provider: ProviderInvoker = async () => {
            providerCalls += 1;
            return { contract_version: 1, reply: "must not happen", used_meaning_ids: [] };
        };

        await assert.rejects(
            runLocalSurface(f.store, provider, { purpose: "explain", explainIds: [f.privateMeaningId] }),
            /outside active scope/,
        );
        assert.equal(providerCalls, 0);
        assert.equal((await f.store.load()).operations.cognition_episodes.length, 0);
    } finally {
        await f.close();
    }
});
