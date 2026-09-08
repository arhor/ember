import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { ProviderInvoker } from "../providers/contract.ts";
import type { TelegramSurfaceConfig, TelegramUpdate } from "./telegram.ts";

import { initialState } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { SurfaceDeliveryFailure } from "../runtime/interaction-boundary.ts";
import {
    TELEGRAM_SURFACE_ID,
    createTelegramApi,
    deliverTelegramMessage,
    processTelegramUpdate,
    renderTelegramSurfaceUnit,
    runTelegramPolling,
    selectTelegramInbound,
    verifyTelegramLongPollingReady,
} from "./telegram.ts";

const PRINCIPAL = "max";
const CHAT_ID = 424242;
const TOKEN = "123456:abcdefghijklmnopqrstuvwxyzABCDE1234567890_-";
const API_ROOT = "https://telegram.example";

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

function update(updateId: number, text = "hello"): TelegramUpdate {
    return {
        update_id: updateId,
        message: {
            message_id: updateId + 1000,
            date: 1_788_608_000,
            chat: { id: CHAT_ID, type: "private" },
            from: { id: CHAT_ID, is_bot: false, first_name: "Max", username: "max" },
            text,
        },
    };
}

function sentMessage(messageId = 9001) {
    return {
        message_id: messageId,
        date: 1_788_608_000,
        chat: { id: CHAT_ID, type: "private" },
    };
}

function successfulResponse(result: unknown) {
    return new Response(JSON.stringify({ ok: true, result }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

function apiWithFetch(fetch_: typeof fetch) {
    return createTelegramApi(TOKEN, { apiRoot: API_ROOT, fetch: fetch_ });
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

function readyApi(overrides: Record<string, unknown> = {}) {
    return {
        getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember", username: "ember_bot" }),
        getWebhookInfo: async () => ({ url: "", pending_update_count: 0 }),
        getUpdates: async () => [],
        sendMessage: async () => sentMessage(),
        ...overrides,
    } as Parameters<typeof runTelegramPolling>[1];
}

async function expectUncertainDelivery(run: () => Promise<unknown>) {
    await assert.rejects(run(), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "uncertain");
        return true;
    });
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

test("evidence-bearing Telegram fields remain runtime validated after adopting generated types", () => {
    const config = telegramConfig("/tmp", "/tmp/ember.json");
    const malformed = update(43) as unknown as Record<string, unknown>;
    const message = malformed.message as Record<string, unknown>;
    message.message_id = 0;
    assert.throws(() => selectTelegramInbound(malformed as unknown as TelegramUpdate, config), /message id is invalid/);
});

test("unmapped Telegram input is ignored before Ember runtime work", async () => {
    const f = await fixture();
    try {
        const foreign = update(50);
        foreign.message!.chat.id = CHAT_ID + 1;
        foreign.message!.from!.id = CHAT_ID + 1;
        const outcome = await processTelegramUpdate(
            f.config,
            { sendMessage: async () => sentMessage() } as Parameters<typeof processTelegramUpdate>[1],
            foreign,
        );
        assert.deepEqual(outcome, { kind: "ignored", updateId: 50 });
        const state = await f.store.load();
        assert.equal(state.operations.runtimeEpisodes.length, 0);
        assert.equal(state.operations.cognitionEpisodes.length, 0);
    } finally {
        await f.close();
    }
});

test("replayed Telegram update reuses cognition and does not send a second response", async () => {
    const f = await fixture();
    try {
        const calls = { provider: 0, send: 0 };
        const provider: ProviderInvoker = async (request) => {
            calls.provider += 1;
            assert.equal(request.projection.surface, TELEGRAM_SURFACE_ID);
            const projection = JSON.stringify(request.projection);
            assert.equal(projection.includes("update:77"), false);
            assert.equal(projection.includes(String(CHAT_ID)), false);
            return { contractVersion: 1, reply: "telegram reply", usedMeaningIds: [] };
        };
        const api = {
            sendMessage: async (params: unknown) => {
                calls.send += 1;
                assert.deepEqual(params, { chat_id: CHAT_ID, text: "telegram reply\n" });
                return sentMessage();
            },
        } as Parameters<typeof processTelegramUpdate>[1];

        const first = await processTelegramUpdate(f.config, api, update(77), { provider });
        const second = await processTelegramUpdate(f.config, api, update(77), { provider });
        assert.equal(first.kind, "processed");
        assert.equal(second.kind, "replayed");
        assert.equal(calls.provider, 1);
        assert.equal(calls.send, 1);

        const state = await f.store.load();
        assert.equal(state.operations.cognitionEpisodes.length, 1);
        assert.equal(state.evidence.filter((evidence) => evidence.sourceRole === "user_command").length, 1);
        assert.equal(state.operations.runtimeEpisodes.length, 2);
        assert.ok(state.operations.runtimeEpisodes.every((runtime) => runtime.cleanStopAt !== null));

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

test("generated Bot API client serializes the explicit offset and message-only filter", async () => {
    const requests: Array<{ url: string; body: URLSearchParams }> = [];
    const api = apiWithFetch(async (input, init) => {
        requests.push({ url: String(input), body: new URLSearchParams(String(init?.body)) });
        return successfulResponse([update(12)]);
    });

    const updates = await api.getUpdates({ offset: 12, timeout: 30, allowed_updates: ["message"] });
    assert.equal(updates[0]?.update_id, 12);
    assert.equal(requests.length, 1);
    assert.match(requests[0]!.url, /\/getUpdates$/);
    assert.equal(requests[0]!.body.get("offset"), "12");
    assert.equal(requests[0]!.body.get("timeout"), "30");
    assert.equal(requests[0]!.body.get("allowed_updates"), '["message"]');
});

test("polling advances acknowledgement offset only after durable processing", async () => {
    const f = await fixture();
    try {
        let polls = 0;
        let providerCalls = 0;
        let sends = 0;
        const provider: ProviderInvoker = async () => {
            providerCalls += 1;
            return { contractVersion: 1, reply: "ack reply", usedMeaningIds: [] };
        };
        const api = readyApi({
            getUpdates: async (params: { offset?: number; timeout?: number; allowed_updates?: string[] }) => {
                polls += 1;
                assert.equal(params.timeout, 30);
                assert.deepEqual(params.allowed_updates, ["message"]);
                if (polls === 1) {
                    assert.equal(params.offset, undefined);
                    return [update(88)];
                }
                assert.equal(params.offset, 89);
                throw new Error("stop-after-offset-proof");
            },
            sendMessage: async () => {
                sends += 1;
                return sentMessage(9002);
            },
        });

        await assert.rejects(runTelegramPolling(f.config, api, { provider }), /stop-after-offset-proof/);
        assert.equal(polls, 2);
        assert.equal(providerCalls, 1);
        assert.equal(sends, 1);
    } finally {
        await f.close();
    }
});

test("processing failure before durable handoff leaves an update unacknowledged", async () => {
    const f = await fixture();
    try {
        await rm(f.statePath);
        let polls = 0;
        const api = readyApi({
            getUpdates: async (params: { offset?: number }) => {
                polls += 1;
                assert.equal(params.offset, undefined);
                return [update(89)];
            },
        });

        await assert.rejects(runTelegramPolling(f.config, api), /continuity store is unavailable/);
        assert.equal(polls, 1);
    } finally {
        await f.close();
    }
});

test("successful sendMessage records one confirmed external message id", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return successfulResponse(sentMessage(9100));
    });

    const receipt = await deliverTelegramMessage(api, CHAT_ID, "hello");
    assert.deepEqual(receipt, { externalMessageId: "9100" });
    assert.equal(calls, 1);
});

test("Telegram 400 is a definite failed delivery with exactly one HTTP attempt", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: chat not found" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    });

    await assert.rejects(deliverTelegramMessage(api, CHAT_ID, "hello"), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "failed");
        assert.equal(error.retryable, false);
        assert.match(error.message, /chat not found/);
        return true;
    });
    assert.equal(calls, 1);
});

test("Telegram 429 exposes retry_after but the API client does not retry", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return new Response(
            JSON.stringify({
                ok: false,
                error_code: 429,
                description: "Too Many Requests: retry later",
                parameters: { retry_after: 7 },
            }),
            { status: 429, headers: { "content-type": "application/json" } },
        );
    });

    await assert.rejects(deliverTelegramMessage(api, CHAT_ID, "hello"), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "failed");
        assert.equal(error.retryable, true);
        assert.equal(error.retryAfterSeconds, 7);
        return true;
    });
    assert.equal(calls, 1);
});

test("Telegram 5xx envelope remains uncertain with exactly one HTTP attempt", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return new Response(JSON.stringify({ ok: false, error_code: 500, description: "Internal Server Error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
        });
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("bare HTTP 5xx remains uncertain with exactly one HTTP attempt", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return new Response("bad gateway", { status: 502 });
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("malformed Telegram JSON remains uncertain with exactly one HTTP attempt", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return new Response("{", { status: 200, headers: { "content-type": "application/json" } });
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("malformed successful sendMessage evidence remains uncertain", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        return successfulResponse({ chat: { id: CHAT_ID, type: "private" } });
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("body-read failure after send may have crossed the boundary remains uncertain", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        const response = new Response("", { status: 200 });
        Object.defineProperty(response, "text", {
            value: async () => {
                throw new Error("response body disappeared");
            },
        });
        return response;
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("network loss during send remains uncertain with exactly one HTTP attempt", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        throw new Error("socket disappeared");
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("transport timeout during send remains uncertain with exactly one HTTP attempt", async () => {
    let calls = 0;
    const api = apiWithFetch(async () => {
        calls += 1;
        throw new DOMException("synthetic timeout", "AbortError");
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello"));
    assert.equal(calls, 1);
});

test("caller abort after send begins remains uncertain and is never retried", async () => {
    let calls = 0;
    const controller = new AbortController();
    const api = apiWithFetch(async () => {
        calls += 1;
        controller.abort(new DOMException("shutdown", "AbortError"));
        throw controller.signal.reason;
    });

    await expectUncertainDelivery(() => deliverTelegramMessage(api, CHAT_ID, "hello", { signal: controller.signal }));
    assert.equal(calls, 1);
});

test("long polling fails closed while a webhook owns updates and never deletes it", async () => {
    const methods: string[] = [];
    const api = apiWithFetch(async (input) => {
        const method = String(input).split("/").at(-1)!;
        methods.push(method);
        if (method === "getMe") return successfulResponse({ id: 1, is_bot: true, first_name: "Ember" });
        if (method === "getWebhookInfo")
            return successfulResponse({ url: "https://example.test/hook", pending_update_count: 0 });
        throw new Error(`unexpected Telegram method ${method}`);
    });

    await assert.rejects(verifyTelegramLongPollingReady(api), /active webhook/);
    assert.deepEqual(methods, ["getMe", "getWebhookInfo"]);
});

test("webhook status fields remain runtime validated", async () => {
    const api = apiWithFetch(async (input) => {
        const method = String(input).split("/").at(-1)!;
        return method === "getMe"
            ? successfulResponse({ id: 1, is_bot: true, first_name: "Ember" })
            : successfulResponse({ url: "", pending_update_count: -1 });
    });

    await assert.rejects(verifyTelegramLongPollingReady(api), /pending_update_count/);
});

test("idle shutdown aborts getUpdates promptly", async () => {
    const f = await fixture();
    try {
        const controller = new AbortController();
        let enteredPoll!: () => void;
        const pollEntered = new Promise<void>((resolve) => {
            enteredPoll = resolve;
        });
        const api = readyApi({
            getUpdates: async (_params: unknown, signal?: AbortSignal) => {
                enteredPoll();
                return await new Promise<never>((_resolve, reject) => {
                    signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
                });
            },
        });

        const running = runTelegramPolling(f.config, api, { signal: controller.signal });
        await pollEntered;
        controller.abort(new DOMException("shutdown", "AbortError"));
        await running;
    } finally {
        await f.close();
    }
});

test("shutdown drains an admitted handler and never acknowledges it with a later poll", async () => {
    const f = await fixture();
    try {
        const controller = new AbortController();
        let providerEntered!: () => void;
        let releaseProvider!: () => void;
        const entered = new Promise<void>((resolve) => {
            providerEntered = resolve;
        });
        const released = new Promise<void>((resolve) => {
            releaseProvider = resolve;
        });
        let providerCalls = 0;
        let sends = 0;
        let polls = 0;
        const provider: ProviderInvoker = async (_request, options) => {
            providerCalls += 1;
            assert.equal(options.signal, undefined);
            providerEntered();
            await released;
            return { contractVersion: 1, reply: "drained reply", usedMeaningIds: [] };
        };
        const api = readyApi({
            getUpdates: async (params: { offset?: number }) => {
                polls += 1;
                assert.equal(params.offset, undefined);
                return [update(120), update(121)];
            },
            sendMessage: async () => {
                sends += 1;
                return sentMessage(9200);
            },
        });

        const running = runTelegramPolling(f.config, api, { provider, signal: controller.signal });
        await entered;
        controller.abort(new DOMException("shutdown", "AbortError"));
        releaseProvider();
        await running;

        assert.equal(providerCalls, 1);
        assert.equal(sends, 1);
        assert.equal(polls, 1);
        const ledger = JSON.parse(await readFile(`${f.statePath}.interactions.json`, "utf8"));
        assert.equal(ledger.inbound_occurrences.length, 1);
        assert.equal(ledger.inbound_occurrences[0].external_occurrence_id, "update:120");
    } finally {
        await f.close();
    }
});

test("writer lease remains released while the worker waits in getUpdates", async () => {
    const f = await fixture();
    try {
        const controller = new AbortController();
        let probeSucceeded = false;
        const api = readyApi({
            getUpdates: async () => {
                const probe = new StateStore(f.statePath);
                const lease = await probe.acquireWriteLease();
                await probe.releaseWriteLease(lease);
                probeSucceeded = true;
                controller.abort(new DOMException("probe complete", "AbortError"));
                throw controller.signal.reason;
            },
        });

        await runTelegramPolling(f.config, api, { signal: controller.signal });
        assert.equal(probeSucceeded, true);
    } finally {
        await f.close();
    }
});

test("systemd unit keeps token and chat identifiers out of process arguments", () => {
    const config = telegramConfig("/var/lib/ember", "/var/lib/ember/ember.json");
    const unit = renderTelegramSurfaceUnit(config, "/var/lib/ember/telegram.json");
    assert.match(unit, /Type=exec/);
    assert.match(unit, /Restart=on-failure/);
    assert.match(unit, /KillMode=mixed/);
    assert.match(unit, /ember-telegram\.ts" serve --config/);
    assert.equal(unit.includes(TOKEN), false);
    assert.equal(unit.includes(String(CHAT_ID)), false);
});
