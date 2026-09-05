#!/usr/bin/env node
import { resolve } from "node:path";

import type { TelegramSurfaceConfig, TelegramUpdate } from "../../../src/surfaces/telegram.ts";

import { SurfaceDeliveryFailure } from "../../../src/runtime/interaction-boundary.ts";
import { processTelegramUpdate } from "../../../src/surfaces/telegram.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const PROVIDER = resolve(import.meta.dirname, "../providers/scripted-provider.ts");

const args = process.argv.slice(2);
const value = (flag: string) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : null;
};
const required = (flag: string) => {
    const result = value(flag);
    if (!result) throw new Error(`${flag} is required`);
    return result;
};
const integer = (flag: string) => {
    const result = Number(required(flag));
    if (!Number.isSafeInteger(result)) throw new Error(`${flag} must be a safe integer`);
    return result;
};

const statePath = required("--state");
const principal = required("--principal");
const scope = required("--scope");
const chatId = integer("--chat-id");
const updateId = integer("--update-id");
const capturePath = required("--capture");
const counterPath = required("--counter");
const text = required("--text");
const delivery = required("--delivery");
if (delivery !== "confirmed" && delivery !== "uncertain") throw new Error("--delivery must be confirmed or uncertain");

const config: TelegramSurfaceConfig = {
    config_version: 1,
    state_path: statePath,
    principal,
    active_scope: scope,
    chat_id: chatId,
    token_file: `${statePath}.telegram-token`,
    poll_timeout_seconds: 30,
    provider_kind: "process",
    provider_command: process.execPath,
    provider_arguments: [PROVIDER, "--capture", capturePath, "--counter", counterPath],
    provider_timeout_seconds: 2,
    working_directory: ROOT,
    node_path: process.execPath,
    surface_entrypoint: resolve(ROOT, "bin/ember-telegram.ts"),
    stop_timeout_seconds: 45,
};

const update: TelegramUpdate = {
    update_id: updateId,
    message: {
        message_id: updateId + 1000,
        date: 1_788_608_000,
        chat: { id: chatId, type: "private" },
        from: { id: chatId, is_bot: false, username: "fixture-user" },
        text,
    },
};

let sends = 0;
let sentText: string | null = null;
const outcome = await processTelegramUpdate(
    config,
    {
        sendMessage: async (actualChatId: number, output: string) => {
            sends += 1;
            sentText = output;
            if (actualChatId !== chatId) throw new Error(`unexpected Telegram chat: ${actualChatId}`);
            if (delivery === "uncertain")
                throw new SurfaceDeliveryFailure("fixture transport lost delivery acknowledgement", {
                    outcome: "uncertain",
                });
            return { message_id: updateId + 5000, chat: { id: chatId, type: "private" } };
        },
    } as Parameters<typeof processTelegramUpdate>[1],
    update,
);

process.stdout.write(
    JSON.stringify({
        outcome,
        sends,
        sent_text: sentText,
    }),
);
