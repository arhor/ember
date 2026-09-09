import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { ProviderInvoker } from "../src/providers/contract.ts";
import type { TelegramSurfaceConfig, TelegramUpdate } from "../src/surfaces/telegram/surface.ts";

import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { InteractionLedgerStore, SurfaceDeliveryFailure } from "../src/runtime/interaction-boundary.ts";
import {
    createTelegramApi,
    deliverTelegramMessage,
    processTelegramUpdate,
    reconcileTelegramDeliveries,
    runTelegramPolling,
} from "../src/surfaces/telegram/surface.ts";

const PRINCIPAL = "max";
const CHAT_ID = 424242;
const TOKEN = "123456:abcdefghijklmnopqrstuvwxyzABCDE1234567890_-";

function telegramConfig(directory: string, statePath: string): TelegramSurfaceConfig {
    return {
        config_version: 1,
        state_path: statePath,
        principal: PRINCIPAL,
        activeScope: "private",
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

function update(updateId: number): TelegramUpdate {
    return {
        update_id: updateId,
        message: {
            message_id: updateId + 1000,
            date: 1_788_608_000,
            chat: { id: CHAT_ID, type: "private" },
            from: { id: CHAT_ID, is_bot: false, first_name: "Max", username: "max" },
            text: "hello",
        },
    };
}

function sentMessage(messageId: number) {
    return {
        message_id: messageId,
        date: 1_788_608_000,
        chat: { id: CHAT_ID, type: "private" },
    };
}

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-telegram-delivery-"));
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

function provider(calls: { value: number }): ProviderInvoker {
    return async () => {
        calls.value += 1;
        return { contractVersion: 1, reply: "telegram reply", usedMeaningIds: [] };
    };
}

function readyApi(overrides: Record<string, unknown> = {}) {
    return {
        getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
        getWebhookInfo: async () => ({ url: "", pending_update_count: 0 }),
        getUpdates: async () => [],
        sendMessage: async () => sentMessage(9999),
        ...overrides,
    } as Parameters<typeof runTelegramPolling>[1];
}

test("Telegram flood control exposes retry_after as a definite retryable delivery failure", async () => {
    let requests = 0;
    const api = createTelegramApi(TOKEN, {
        apiRoot: "https://telegram.example",
        fetch: async () => {
            requests += 1;
            return new Response(
                JSON.stringify({
                    ok: false,
                    error_code: 429,
                    description: "Too Many Requests: retry later",
                    parameters: { retry_after: 7 },
                }),
                { status: 429, headers: { "content-type": "application/json" } },
            );
        },
    });

    await assert.rejects(deliverTelegramMessage(api, CHAT_ID, "hello"), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "failed");
        assert.equal(error.retryable, true);
        assert.equal(error.retryAfterSeconds, 7);
        return true;
    });
    assert.equal(requests, 1);
});

test("durable Telegram cognition survives definite outbound failure and can acknowledge the inbound update", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        let sends = 0;
        const outcome = await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    throw new SurfaceDeliveryFailure("Telegram rate limited", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 30,
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(70),
            { provider: provider(providerCalls) },
        );

        assert.equal(outcome.kind, "processed");
        if (outcome.kind === "ignored") assert.fail("mapped Telegram update was ignored");
        assert.equal(outcome.deliveryFailure, "failed");
        assert.equal(providerCalls.value, 1);
        assert.equal(sends, 1);
        const state = await f.store.load();
        assert.equal(state.operations.cognitionEpisodes.length, 1);
        assert.equal(state.operations.cognitionEpisodes[0]?.status, "completed");
        assert.equal(state.operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences[0]?.external_occurrence_id, "update:70");
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "failed");
        assert.equal(ledger.deliveries[0]?.attempts[0]?.retryable, true);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.retry_after_seconds, 30);
    } finally {
        await f.close();
    }
});

test("long polling advances update offset after durable cognition even when reply delivery failed", async () => {
    const f = await fixture();
    try {
        let polls = 0;
        let sends = 0;
        const providerCalls = { value: 0 };
        const api = readyApi({
            getUpdates: async ({ offset }: { offset?: number }) => {
                polls += 1;
                if (polls === 1) {
                    assert.equal(offset, undefined);
                    return [update(80)];
                }
                assert.equal(offset, 81);
                throw new Error("offset-proof-complete");
            },
            sendMessage: async () => {
                sends += 1;
                throw new SurfaceDeliveryFailure("retry later", {
                    outcome: "failed",
                    retryable: true,
                    retryAfterSeconds: 300,
                });
            },
        });

        await assert.rejects(
            runTelegramPolling(f.config, api, { provider: provider(providerCalls) }),
            /offset-proof-complete/,
        );
        assert.equal(polls, 2);
        assert.equal(providerCalls.value, 1);
        assert.equal(sends, 1);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences[0]?.receive_count, 1);
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
    } finally {
        await f.close();
    }
});

test("reconciliation runs before every idle poll", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    throw new SurfaceDeliveryFailure("flood control", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 0,
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(85),
            { provider: provider(providerCalls) },
        );

        let polls = 0;
        let reconciliationSends = 0;
        const api = readyApi({
            getUpdates: async () => {
                polls += 1;
                if (polls === 1) return [];
                throw new Error("second-idle-poll-observed");
            },
            sendMessage: async () => {
                reconciliationSends += 1;
                if (reconciliationSends === 1)
                    throw new SurfaceDeliveryFailure("still rate limited", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 0,
                    });
                return sentMessage(8500);
            },
        });

        await assert.rejects(runTelegramPolling(f.config, api), /second-idle-poll-observed/);
        assert.equal(polls, 2);
        assert.equal(reconciliationSends, 2);
        assert.equal(providerCalls.value, 1);
    } finally {
        await f.close();
    }
});

test("uncertain Telegram send remains blocked across reconciliation instead of being duplicated", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        let initialSends = 0;
        const outcome = await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    initialSends += 1;
                    throw new SurfaceDeliveryFailure("connection vanished after send may have crossed boundary", {
                        outcome: "uncertain",
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(90),
            { provider: provider(providerCalls) },
        );
        assert.equal(outcome.kind, "processed");
        if (outcome.kind === "ignored") assert.fail("mapped Telegram update was ignored");
        assert.equal(outcome.deliveryFailure, "uncertain");

        let reconciliationSends = 0;
        const results = await reconcileTelegramDeliveries(f.config, {
            sendMessage: async () => {
                reconciliationSends += 1;
                return sentMessage(9999);
            },
        } as Parameters<typeof reconcileTelegramDeliveries>[1]);

        assert.equal(initialSends, 1);
        assert.equal(reconciliationSends, 0);
        assert.equal(providerCalls.value, 1);
        assert.equal(results.length, 1);
        assert.equal(results[0]?.status, "blocked_uncertain");
        assert.equal((await f.store.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
    } finally {
        await f.close();
    }
});

test("Telegram retry_after gates redelivery and later retries the retained representation without new cognition", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        let sends = 0;
        await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    throw new SurfaceDeliveryFailure("flood control", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 10,
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(100),
            { provider: provider(providerCalls) },
        );
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        const failed = ledger.deliveries[0]!.attempts[0]!;
        assert.equal(failed.observedAt === null, false);
        const beforeDue = new Date(Date.parse(failed.observedAt!) + 9_000).toISOString();
        const due = new Date(Date.parse(failed.observedAt!) + 10_000).toISOString();

        let retrySends = 0;
        const api = {
            sendMessage: async (params: unknown) => {
                retrySends += 1;
                assert.deepEqual(params, { chat_id: CHAT_ID, text: "telegram reply\n" });
                return sentMessage(10001);
            },
        } as Parameters<typeof reconcileTelegramDeliveries>[1];
        const early = await reconcileTelegramDeliveries(f.config, api, { observedAt: beforeDue });
        assert.equal(early[0]?.status, "retry_later");
        assert.equal(retrySends, 0);

        const retried = await reconcileTelegramDeliveries(f.config, api, { observedAt: due });
        assert.equal(retried[0]?.status, "confirmed");
        assert.equal(retrySends, 1);
        assert.equal(sends, 1);
        assert.equal(providerCalls.value, 1);
        assert.equal((await f.store.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "displayed");
    } finally {
        await f.close();
    }
});
