import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { ProviderInvoker } from "../providers/contract.ts";

import { initialState } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { SurfaceDeliveryFailure } from "../runtime/interaction-boundary.ts";
import {
    TELEGRAM_SURFACE_ID,
    TelegramBotApi,
    type TelegramSurfaceConfig,
    type TelegramUpdate,
    processTelegramUpdate,
    renderTelegramSurfaceUnit,
    runTelegramPolling,
    selectTelegramInbound,
} from "./telegram.ts";

const PRINCIPAL = "max";
const CHAT_ID = 424242;
const TOKEN = "123456:abcdefghijklmnopqrstuvwxyzABCDE1234567890_-";

function telegramConfig(directory: string, statePath: string): TelegramSurfaceConfig {
    return {
        config_version: 1,
        state_path: statePath,
        principal: PRINCIPAL,
        active_scope: "private",
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

function update(updateId: number, text = "hello"): TelegramUpdate {
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

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-telegram-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState("Ember", PRINCIPAL));
    return {
        directory,
        statePath,
        store,
        config: telegramConfig(directory, statePath),
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

test("configured private Telegram message maps to the shared surface boundary", () => {
    const config = telegramConfig("/tmp", "/tmp/ember.json");
    const inbound = selectTelegramInbound(update(42), config);
    assert.ok(inbound);
    assert.equal(inbound.updateId, 42);
    assert.equal(inbound.text, "hello");
    assert.equal(inbound.externalOccurrence.occurrenceId, "update:42");
    assert.equal(inbound.externalOccurrence.messageId, "1042");
    assert.equal(inbound.deliveryDestinationId, `telegram:chat:${CHAT_ID}`);
});

test("unmapped or non-private Telegram input is ignored before Ember runtime work", async () => {
    const f = await fixture();
    try {
        const foreign = update(50);
        foreign.message!.chat.id = CHAT_ID + 1;
        foreign.message!.from!.id = CHAT_ID + 1;
        const outcome = await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    throw new Error("must not deliver ignored input");
                },
            } as Pick<TelegramBotApi, "sendMessage">,
            foreign,
        );
        assert.deepEqual(outcome, { kind: "ignored", updateId: 50 });
        const state = await f.store.load();
        assert.equal(state.operations.runtime_episodes.length, 0);
        assert.equal(state.operations.cognition_episodes.length, 0);
    } finally {
        await f.close();
    }
});

test("replayed Telegram update reuses cognition and does not send a second response", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, send: 0 };
        const provider: ProviderInvoker = async (_command, _args, request) => {
            calls.provider += 1;
            assert.equal(request.projection.surface, TELEGRAM_SURFACE_ID);
            const projection = JSON.stringify(request.projection);
            assert.equal(projection.includes("update:77"), false);
            assert.equal(projection.includes(String(CHAT_ID)), false);
            return { contract_version: 1, reply: "telegram reply", used_meaning_ids: [] };
        };
        const api = {
            sendMessage: async (chatId: number, text: string) => {
                calls.send += 1;
                assert.equal(chatId, CHAT_ID);
                assert.equal(text, "telegram reply\n");
                return { message_id: 9001, chat: { id: CHAT_ID, type: "private" } };
            },
        } as Pick<TelegramBotApi, "sendMessage">;

        const first = await processTelegramUpdate(f.config, api, update(77), { provider });
        const second = await processTelegramUpdate(f.config, api, update(77), { provider });
        assert.equal(first.kind, "processed");
        assert.equal(second.kind, "replayed");
        assert.equal(calls.provider, 1);
        assert.equal(calls.send, 1);

        const state = await f.store.load();
        assert.equal(state.operations.cognition_episodes.length, 1);
        assert.equal(state.evidence.filter((evidence) => evidence.source_role === "user_command").length, 1);
        assert.equal(state.operations.runtime_episodes.length, 2);
        assert.ok(state.operations.runtime_episodes.every((runtime) => runtime.clean_stop_at !== null));

        const ledger = JSON.parse(await readFile(`${f.statePath}.interactions.json`, "utf8"));
        assert.equal(ledger.inbound_occurrences.length, 1);
        assert.equal(ledger.inbound_occurrences[0].receive_count, 2);
        assert.equal(ledger.inbound_occurrences[0].external_occurrence_id, "update:77");
        assert.equal(ledger.deliveries.length, 1);
        assert.equal(ledger.deliveries[0].attempts.length, 1);
        assert.equal(ledger.deliveries[0].attempts[0].outcome, "confirmed");
        assert.equal(ledger.deliveries[0].attempts[0].external_message_id, "9001");
    } finally {
        await f.close();
    }
});

test("Bot API long polling sends explicit offset and message-only update filter", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const api = new TelegramBotApi(TOKEN, {
        baseUrl: "https://telegram.example",
        fetch_: async (url, init) => {
            requests.push({ url, body: JSON.parse(String(init.body)) });
            return new Response(
                JSON.stringify({
                    ok: true,
                    result: [
                        {
                            update_id: 12,
                            message: {
                                message_id: 99,
                                date: 1_788_608_000,
                                chat: { id: CHAT_ID, type: "private" },
                                from: { id: CHAT_ID, is_bot: false },
                                text: "hello",
                            },
                        },
                    ],
                }),
                { status: 200, headers: { "content-type": "application/json" } },
            );
        },
    });

    const updates = await api.getUpdates({ offset: 12, timeoutSeconds: 30 });
    assert.equal(updates[0]?.update_id, 12);
    assert.equal(requests.length, 1);
    assert.match(requests[0]!.url, /\/getUpdates$/);
    assert.deepEqual(requests[0]!.body, { offset: 12, timeout: 30, allowed_updates: ["message"] });
});

test("polling advances acknowledgement offset only after an update is processed", async () => {
    const f = await fixture();
    try {
        let polls = 0;
        let providerCalls = 0;
        let sends = 0;
        const provider: ProviderInvoker = async () => {
            providerCalls += 1;
            return { contract_version: 1, reply: "ack reply", used_meaning_ids: [] };
        };
        const api = {
            verifyLongPollingReady: async () => ({
                bot: { id: 1, is_bot: true },
                webhook: { url: "", pending_update_count: 0 },
            }),
            getUpdates: async ({ offset }: { offset?: number }) => {
                polls += 1;
                if (polls === 1) {
                    assert.equal(offset, undefined);
                    return [update(88)];
                }
                assert.equal(offset, 89);
                throw new Error("stop-after-offset-proof");
            },
            sendMessage: async () => {
                sends += 1;
                return { message_id: 9002, chat: { id: CHAT_ID, type: "private" } };
            },
        } as Pick<TelegramBotApi, "getUpdates" | "sendMessage" | "verifyLongPollingReady">;

        await assert.rejects(runTelegramPolling(f.config, api, { provider }), /stop-after-offset-proof/);
        assert.equal(polls, 2);
        assert.equal(providerCalls, 1);
        assert.equal(sends, 1);
    } finally {
        await f.close();
    }
});

test("Telegram API rejection is a definite failed delivery attempt", async () => {
    const api = new TelegramBotApi(TOKEN, {
        baseUrl: "https://telegram.example",
        fetch_: async () =>
            new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: chat not found" }), {
                status: 400,
                headers: { "content-type": "application/json" },
            }),
    });

    await assert.rejects(api.sendMessage(CHAT_ID, "hello"), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "failed");
        assert.match(error.message, /chat not found/);
        return true;
    });
});

test("network loss during Telegram send remains uncertain", async () => {
    const api = new TelegramBotApi(TOKEN, {
        baseUrl: "https://telegram.example",
        fetch_: async () => {
            throw new Error("socket disappeared");
        },
    });

    await assert.rejects(api.sendMessage(CHAT_ID, "hello"), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "uncertain");
        assert.equal(error.message.includes(TOKEN), false);
        return true;
    });
});

test("long polling refuses to start while a webhook owns updates", async () => {
    let call = 0;
    const api = new TelegramBotApi(TOKEN, {
        baseUrl: "https://telegram.example",
        fetch_: async () => {
            call += 1;
            const result =
                call === 1
                    ? { id: 1, is_bot: true, username: "ember_bot" }
                    : { url: "https://example.test/hook", pending_update_count: 0 };
            return new Response(JSON.stringify({ ok: true, result }), {
                status: 200,
                headers: { "content-type": "application/json" },
            });
        },
    });

    await assert.rejects(api.verifyLongPollingReady(), /active webhook/);
});

test("systemd unit keeps token and chat identifiers out of process arguments", () => {
    const config = telegramConfig("/var/lib/ember", "/var/lib/ember/ember.json");
    const unit = renderTelegramSurfaceUnit(config, "/var/lib/ember/telegram.json");
    assert.match(unit, /Type=exec/);
    assert.match(unit, /Restart=on-failure/);
    assert.match(unit, /KillMode=mixed/);
    assert.match(unit, /ember-telegram\.ts\" serve --config/);
    assert.equal(unit.includes(TOKEN), false);
    assert.equal(unit.includes(String(CHAT_ID)), false);
});
