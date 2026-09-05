import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { CognitionId } from "../core/model.ts";
import type { ProviderInvoker } from "../providers/contract.ts";

import { ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { invokeCodexProvider } from "../providers/codex.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";
import { invokeCursorProvider } from "../providers/cursor.ts";
import { SurfaceDeliveryFailure, runSurfaceInteraction } from "../runtime/interaction-boundary.ts";
import { startRuntime, stopRuntime } from "../runtime/runtime.ts";

export const TELEGRAM_SURFACE_ID = "telegram_bot";
export const TELEGRAM_BOT_API_VERSION = "10.3";
export const TELEGRAM_BOT_API_BASE_URL = "https://api.telegram.org";

export interface TelegramSurfaceConfig {
    config_version: 1;
    state_path: string;
    principal: string;
    active_scope: string;
    chat_id: number;
    token_file: string;
    poll_timeout_seconds: number;
    provider_kind: "process" | "codex" | "cursor";
    provider_command: string;
    provider_arguments: string[];
    provider_timeout_seconds: number;
    working_directory: string;
    node_path: string;
    surface_entrypoint: string;
    stop_timeout_seconds: number;
}

export interface TelegramUser {
    id: number;
    is_bot: boolean;
    username?: string;
}

export interface TelegramChat {
    id: number;
    type: string;
}

export interface TelegramMessage {
    message_id: number;
    date: number;
    chat: TelegramChat;
    from?: TelegramUser;
    message_thread_id?: number;
    text?: string;
}

export interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

export interface TelegramWebhookInfo {
    url: string;
    pending_update_count: number;
}

export interface TelegramSentMessage {
    message_id: number;
    chat: TelegramChat;
}

export interface TelegramInboundMessage {
    updateId: number;
    text: string;
    chatId: number;
    messageThreadId: number | null;
    externalOccurrence: {
        occurrenceId: string;
        messageId: string;
        threadId: string | null;
        occurredAt: string;
    };
    deliveryDestinationId: string;
}

export type TelegramUpdateOutcome =
    | { kind: "ignored"; updateId: number }
    | {
          kind: "processed" | "replayed";
          updateId: number;
          cognitionId: CognitionId;
          providerFailure: string | null;
      };

export type TelegramFetch = (url: string, init: RequestInit) => Promise<Response>;

export class TelegramApiError extends Error {
    readonly outcome: "rejected" | "uncertain";
    readonly errorCode: number | null;

    constructor(message: string, outcome: "rejected" | "uncertain", errorCode: number | null = null) {
        super(message);
        this.name = "TelegramApiError";
        this.outcome = outcome;
        this.errorCode = errorCode;
    }
}

export class TelegramBotApi {
    readonly token: string;
    readonly baseUrl: string;
    readonly fetch_: TelegramFetch;

    constructor(
        token: string,
        {
            baseUrl = TELEGRAM_BOT_API_BASE_URL,
            fetch_ = defaultFetch,
        }: { baseUrl?: string; fetch_?: TelegramFetch } = {},
    ) {
        validateTelegramToken(token);
        if (!/^https:\/\//.test(baseUrl)) throw new ValidationError("Telegram Bot API base URL must use HTTPS");
        this.token = token;
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.fetch_ = fetch_;
    }

    async getMe(signal?: AbortSignal): Promise<TelegramUser> {
        const value = await this.call("getMe", {}, signal);
        return validateTelegramUser(value, "getMe result");
    }

    async getWebhookInfo(signal?: AbortSignal): Promise<TelegramWebhookInfo> {
        const value = await this.call("getWebhookInfo", {}, signal);
        const record = requireApiRecord(value, "getWebhookInfo result");
        if (typeof record.url !== "string")
            throw new TelegramApiError("Telegram getWebhookInfo returned invalid url", "uncertain");
        if (!Number.isSafeInteger(record.pending_update_count) || (record.pending_update_count as number) < 0)
            throw new TelegramApiError("Telegram getWebhookInfo returned invalid pending_update_count", "uncertain");
        return { url: record.url, pending_update_count: record.pending_update_count as number };
    }

    async deleteWebhook(signal?: AbortSignal): Promise<void> {
        const value = await this.call("deleteWebhook", { drop_pending_updates: false }, signal);
        if (value !== true)
            throw new TelegramApiError("Telegram deleteWebhook returned an invalid result", "uncertain");
    }

    async getUpdates({
        offset,
        timeoutSeconds,
        signal,
    }: {
        offset?: number;
        timeoutSeconds: number;
        signal?: AbortSignal;
    }): Promise<TelegramUpdate[]> {
        if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0))
            throw new ValidationError("Telegram update offset must be a non-negative safe integer");
        validatePollTimeout(timeoutSeconds);
        const value = await this.call(
            "getUpdates",
            {
                ...(offset === undefined ? {} : { offset }),
                timeout: timeoutSeconds,
                allowed_updates: ["message"],
            },
            signal,
        );
        if (!Array.isArray(value))
            throw new TelegramApiError("Telegram getUpdates returned a non-list result", "uncertain");
        const updates = value.map(validateTelegramUpdate);
        for (let index = 1; index < updates.length; index += 1) {
            if (updates[index]!.update_id <= updates[index - 1]!.update_id)
                throw new TelegramApiError("Telegram getUpdates returned non-increasing update ids", "uncertain");
        }
        return updates;
    }

    async sendMessage(
        chatId: number,
        text: string,
        { messageThreadId = null, signal }: { messageThreadId?: number | null; signal?: AbortSignal } = {},
    ): Promise<TelegramSentMessage> {
        validateChatId(chatId);
        if (typeof text !== "string" || !text.length)
            throw new ValidationError("Telegram delivery text must be non-empty");
        if (messageThreadId !== null && (!Number.isSafeInteger(messageThreadId) || messageThreadId <= 0))
            throw new ValidationError("Telegram message thread id is invalid");
        try {
            const value = await this.call(
                "sendMessage",
                {
                    chat_id: chatId,
                    text,
                    ...(messageThreadId === null ? {} : { message_thread_id: messageThreadId }),
                },
                signal,
            );
            const record = requireApiRecord(value, "sendMessage result");
            if (!Number.isSafeInteger(record.message_id) || (record.message_id as number) <= 0)
                throw new TelegramApiError("Telegram sendMessage returned an invalid message id", "uncertain");
            const chat = validateTelegramChat(record.chat, "sendMessage chat");
            return { message_id: record.message_id as number, chat };
        } catch (error) {
            if (error instanceof SurfaceDeliveryFailure) throw error;
            if (error instanceof TelegramApiError) {
                throw new SurfaceDeliveryFailure(error.message, {
                    outcome: error.outcome === "rejected" ? "failed" : "uncertain",
                });
            }
            throw new SurfaceDeliveryFailure("Telegram sendMessage delivery outcome is uncertain");
        }
    }

    async verifyLongPollingReady(signal?: AbortSignal) {
        const bot = await this.getMe(signal);
        if (!bot.is_bot) throw new ValidationError("configured Telegram token does not identify a bot");
        const webhook = await this.getWebhookInfo(signal);
        if (webhook.url)
            throw new ValidationError(
                "Telegram bot has an active webhook; remove it explicitly before starting Ember long polling",
            );
        return { bot, webhook };
    }

    private async call(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
        let response: Response;
        try {
            response = await this.fetch_(`${this.baseUrl}/bot${this.token}/${method}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
                signal,
            });
        } catch (error) {
            if (signal?.aborted) throw error;
            throw new TelegramApiError(`Telegram ${method} request outcome is uncertain`, "uncertain");
        }

        let value: unknown;
        try {
            value = await response.json();
        } catch {
            throw new TelegramApiError(`Telegram ${method} returned unreadable JSON`, "uncertain");
        }
        const envelope = requireApiRecord(value, `${method} response`);
        const ok = envelope.ok;
        if (ok !== true) {
            const code = Number.isSafeInteger(envelope.error_code)
                ? (envelope.error_code as number)
                : response.status || null;
            const description = typeof envelope.description === "string" ? `: ${envelope.description}` : "";
            const outcome = response.status >= 500 ? "uncertain" : "rejected";
            throw new TelegramApiError(`Telegram ${method} rejected the request${description}`, outcome, code);
        }
        if (!response.ok)
            throw new TelegramApiError(
                `Telegram ${method} returned HTTP ${response.status} despite an ok payload`,
                response.status >= 500 ? "uncertain" : "rejected",
                response.status,
            );
        return envelope.result;
    }
}

export async function loadTelegramSurfaceConfig(path: string): Promise<TelegramSurfaceConfig> {
    requireAbsolutePath(path, "Telegram surface config path");
    let value: unknown;
    try {
        value = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
        if (error instanceof SyntaxError) throw new ValidationError("Telegram surface config is not valid JSON");
        throw error;
    }
    validateTelegramSurfaceConfig(value);
    return value;
}

export async function readTelegramBotToken(path: string) {
    requireAbsolutePath(path, "Telegram token file");
    const token = (await readFile(path, "utf8")).trim();
    validateTelegramToken(token);
    return token;
}

export function selectTelegramInbound(
    update: TelegramUpdate,
    config: TelegramSurfaceConfig,
): TelegramInboundMessage | null {
    validateTelegramSurfaceConfig(config);
    const message = update.message;
    if (message === undefined) return null;
    if (message.chat.type !== "private" || message.chat.id !== config.chat_id) return null;
    if (message.from === undefined || message.from.is_bot || message.from.id !== config.chat_id) return null;
    if (typeof message.text !== "string" || !message.text.trim()) return null;

    const threadId = message.message_thread_id ?? null;
    if (threadId !== null && (!Number.isSafeInteger(threadId) || threadId <= 0)) return null;
    const occurredAt = new Date(message.date * 1000).toISOString();
    const destination =
        threadId === null ? `telegram:chat:${message.chat.id}` : `telegram:chat:${message.chat.id}:thread:${threadId}`;
    return {
        updateId: update.update_id,
        text: message.text,
        chatId: message.chat.id,
        messageThreadId: threadId,
        externalOccurrence: {
            occurrenceId: `update:${update.update_id}`,
            messageId: String(message.message_id),
            threadId: threadId === null ? null : String(threadId),
            occurredAt,
        },
        deliveryDestinationId: destination,
    };
}

export async function processTelegramUpdate(
    config: TelegramSurfaceConfig,
    api: Pick<TelegramBotApi, "sendMessage">,
    update: TelegramUpdate,
    { provider, signal }: { provider?: ProviderInvoker; signal?: AbortSignal } = {},
): Promise<TelegramUpdateOutcome> {
    validateTelegramSurfaceConfig(config);
    const inbound = selectTelegramInbound(update, config);
    if (inbound === null) return { kind: "ignored", updateId: update.update_id };

    const store = new StateStore(config.state_path);
    const lease = await store.acquireWriteLease();
    let runtimeId: ReturnType<typeof startRuntime>["runtimeId"] | null = null;
    let stopReason = "telegram_update_failed";
    try {
        let state = await store.load();
        const started = startRuntime(state, config.principal, config.active_scope);
        runtimeId = started.runtimeId;
        state = await store.commit(state.revision, started.state);
        const selectedProvider = provider ?? providerForConfig(config.provider_kind);
        const result = await runSurfaceInteraction(store, state, {
            runtimeId,
            principal: config.principal,
            scope: config.active_scope,
            text: inbound.text,
            command: config.provider_command,
            arguments_: config.provider_arguments,
            timeoutSeconds: config.provider_timeout_seconds,
            signal,
            ...(selectedProvider === undefined ? {} : { provider: selectedProvider }),
            surfaceId: TELEGRAM_SURFACE_ID,
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: inbound.externalOccurrence,
            deliveryDestinationId: inbound.deliveryDestinationId,
            deliver: async (text) => {
                const sent = await api.sendMessage(inbound.chatId, text, {
                    messageThreadId: inbound.messageThreadId,
                    signal,
                });
                return { externalMessageId: String(sent.message_id) };
            },
        });
        stopReason = result.providerFailure === null ? "telegram_update_complete" : "telegram_provider_failure";
        return {
            kind: result.replayed ? "replayed" : "processed",
            updateId: update.update_id,
            cognitionId: result.cognitionId,
            providerFailure: result.providerFailure,
        };
    } finally {
        try {
            if (runtimeId !== null) {
                const current = await store.load();
                const runtime = current.operations.runtime_episodes.find((episode) => episode.runtime_id === runtimeId);
                if (runtime?.clean_stop_at === null) {
                    const stopped = stopRuntime(current, runtimeId, {
                        reason: signal?.aborted ? "telegram_surface_shutdown" : stopReason,
                    });
                    await store.commit(current.revision, stopped);
                }
            }
        } finally {
            await store.releaseWriteLease(lease);
        }
    }
}

export async function runTelegramPolling(
    config: TelegramSurfaceConfig,
    api: Pick<TelegramBotApi, "getUpdates" | "sendMessage" | "verifyLongPollingReady">,
    {
        provider,
        signal,
        onOutcome,
        maxAcceptedUpdates,
    }: {
        provider?: ProviderInvoker;
        signal?: AbortSignal;
        onOutcome?: (outcome: TelegramUpdateOutcome) => void;
        maxAcceptedUpdates?: number;
    } = {},
) {
    validateTelegramSurfaceConfig(config);
    if (maxAcceptedUpdates !== undefined && (!Number.isSafeInteger(maxAcceptedUpdates) || maxAcceptedUpdates < 1))
        throw new ValidationError("max accepted Telegram updates must be a positive safe integer");
    await api.verifyLongPollingReady(signal);
    let offset: number | undefined;
    let acceptedCount = 0;
    while (!signal?.aborted) {
        let updates: TelegramUpdate[];
        try {
            updates = await api.getUpdates({ offset, timeoutSeconds: config.poll_timeout_seconds, signal });
        } catch (error) {
            if (signal?.aborted) return;
            throw error;
        }
        for (const update of updates) {
            if (signal?.aborted) return;
            let outcome: TelegramUpdateOutcome;
            try {
                outcome = await processTelegramUpdate(config, api, update, { provider, signal });
            } catch (error) {
                if (signal?.aborted) return;
                throw error;
            }
            onOutcome?.(outcome);
            if (outcome.kind !== "ignored") acceptedCount += 1;
            offset = update.update_id + 1;
            if (maxAcceptedUpdates !== undefined && acceptedCount >= maxAcceptedUpdates) return;
        }
    }
}

export function renderTelegramSurfaceUnit(config: TelegramSurfaceConfig, configPath: string) {
    validateTelegramSurfaceConfig(config);
    requireAbsolutePath(configPath, "Telegram surface config path");
    return `[Unit]\nDescription=Ember Telegram messaging surface\nWants=network-online.target\nAfter=network-online.target\n\n[Service]\nType=exec\nWorkingDirectory=${systemdQuote(config.working_directory)}\nExecStart=${systemdQuote(config.node_path)} ${systemdQuote(config.surface_entrypoint)} serve --config ${systemdQuote(configPath)}\nRestart=on-failure\nRestartSec=5s\nKillMode=mixed\nTimeoutStopSec=${config.stop_timeout_seconds}s\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;
}

export function validateTelegramSurfaceConfig(value: unknown): asserts value is TelegramSurfaceConfig {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("Telegram surface config must be an object");
    const config = value as Record<string, unknown>;
    const fields = [
        "active_scope",
        "chat_id",
        "config_version",
        "node_path",
        "poll_timeout_seconds",
        "principal",
        "provider_arguments",
        "provider_command",
        "provider_kind",
        "provider_timeout_seconds",
        "state_path",
        "stop_timeout_seconds",
        "surface_entrypoint",
        "token_file",
        "working_directory",
    ].sort();
    if (JSON.stringify(Object.keys(config).sort()) !== JSON.stringify(fields))
        throw new ValidationError("Telegram surface config contains unsupported fields");
    if (config.config_version !== 1) throw new ValidationError("Telegram surface config version is unsupported");
    validateOpaque(config.principal, "Telegram principal", 256);
    validateOpaque(config.active_scope, "Telegram active scope", 256);
    validateChatId(config.chat_id);
    requireAbsolutePath(config.state_path, "Telegram state path");
    requireAbsolutePath(config.token_file, "Telegram token file");
    requireAbsolutePath(config.provider_command, "Telegram provider command");
    requireAbsolutePath(config.working_directory, "Telegram working directory");
    requireAbsolutePath(config.node_path, "Telegram Node path");
    requireAbsolutePath(config.surface_entrypoint, "Telegram surface entrypoint");
    if (!["process", "codex", "cursor"].includes(config.provider_kind as string))
        throw new ValidationError("Telegram provider kind is unsupported");
    if (!Array.isArray(config.provider_arguments) || config.provider_arguments.some((arg) => typeof arg !== "string"))
        throw new ValidationError("Telegram provider arguments must be a string list");
    for (const argument of config.provider_arguments as string[]) {
        if (ASCII_CONTROL_CHARACTER_PATTERN.test(argument))
            throw new ValidationError("Telegram provider argument contains a control character");
    }
    validatePollTimeout(config.poll_timeout_seconds);
    if (
        typeof config.provider_timeout_seconds !== "number" ||
        !Number.isFinite(config.provider_timeout_seconds) ||
        config.provider_timeout_seconds <= 0 ||
        config.provider_timeout_seconds > MAX_PROVIDER_TIMEOUT_SECONDS
    )
        throw new ValidationError(`Telegram provider timeout must be in (0, ${MAX_PROVIDER_TIMEOUT_SECONDS}]`);
    if (
        typeof config.stop_timeout_seconds !== "number" ||
        !Number.isSafeInteger(config.stop_timeout_seconds) ||
        config.stop_timeout_seconds < 1 ||
        config.stop_timeout_seconds > 3600
    )
        throw new ValidationError("Telegram stop timeout must be an integer between 1 and 3600 seconds");
}

function providerForConfig(kind: TelegramSurfaceConfig["provider_kind"]): ProviderInvoker | undefined {
    if (kind === "codex") return invokeCodexProvider;
    if (kind === "cursor") return invokeCursorProvider;
    return undefined;
}

function validateTelegramUpdate(value: unknown): TelegramUpdate {
    const record = requireApiRecord(value, "Telegram update");
    if (!Number.isSafeInteger(record.update_id) || (record.update_id as number) < 0)
        throw new TelegramApiError("Telegram update id is invalid", "uncertain");
    const update: TelegramUpdate = { update_id: record.update_id as number };
    if (record.message !== undefined) update.message = validateTelegramMessage(record.message);
    return update;
}

function validateTelegramMessage(value: unknown): TelegramMessage {
    const record = requireApiRecord(value, "Telegram message");
    if (!Number.isSafeInteger(record.message_id) || (record.message_id as number) <= 0)
        throw new TelegramApiError("Telegram message id is invalid", "uncertain");
    if (!Number.isSafeInteger(record.date) || (record.date as number) < 0)
        throw new TelegramApiError("Telegram message date is invalid", "uncertain");
    const message: TelegramMessage = {
        message_id: record.message_id as number,
        date: record.date as number,
        chat: validateTelegramChat(record.chat, "Telegram message chat"),
    };
    if (record.from !== undefined) message.from = validateTelegramUser(record.from, "Telegram message sender");
    if (record.message_thread_id !== undefined) {
        if (!Number.isSafeInteger(record.message_thread_id) || (record.message_thread_id as number) <= 0)
            throw new TelegramApiError("Telegram message thread id is invalid", "uncertain");
        message.message_thread_id = record.message_thread_id as number;
    }
    if (record.text !== undefined) {
        if (typeof record.text !== "string")
            throw new TelegramApiError("Telegram message text is invalid", "uncertain");
        message.text = record.text;
    }
    return message;
}

function validateTelegramUser(value: unknown, field: string): TelegramUser {
    const record = requireApiRecord(value, field);
    if (!Number.isSafeInteger(record.id) || (record.id as number) <= 0)
        throw new TelegramApiError(`${field} id is invalid`, "uncertain");
    if (typeof record.is_bot !== "boolean") throw new TelegramApiError(`${field} is_bot is invalid`, "uncertain");
    const user: TelegramUser = { id: record.id as number, is_bot: record.is_bot };
    if (record.username !== undefined) {
        if (typeof record.username !== "string")
            throw new TelegramApiError(`${field} username is invalid`, "uncertain");
        user.username = record.username;
    }
    return user;
}

function validateTelegramChat(value: unknown, field: string): TelegramChat {
    const record = requireApiRecord(value, field);
    if (!Number.isSafeInteger(record.id)) throw new TelegramApiError(`${field} id is invalid`, "uncertain");
    if (typeof record.type !== "string" || !record.type)
        throw new TelegramApiError(`${field} type is invalid`, "uncertain");
    return { id: record.id as number, type: record.type };
}

function validateTelegramToken(token: string) {
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token))
        throw new ValidationError("Telegram bot token has an invalid shape");
}

function validatePollTimeout(value: unknown) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 60)
        throw new ValidationError("Telegram poll timeout must be an integer between 1 and 60 seconds");
}

function validateChatId(value: unknown) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
        throw new ValidationError("Telegram chat id must be a positive safe integer");
}

function validateOpaque(value: unknown, field: string, maxLength: number) {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        value.length > maxLength ||
        ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    )
        throw new ValidationError(`${field} is invalid`);
}

function requireAbsolutePath(value: unknown, field: string): asserts value is string {
    if (typeof value !== "string" || !isAbsolute(value) || ASCII_CONTROL_CHARACTER_PATTERN.test(value))
        throw new ValidationError(`${field} must be an absolute path without control characters`);
}

function requireApiRecord(value: unknown, field: string): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new TelegramApiError(`${field} must be an object`, "uncertain");
    return value as Record<string, unknown>;
}

function systemdQuote(value: string) {
    return `"${value.replaceAll("%", "%%").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function defaultFetch(url: string, init: RequestInit) {
    return fetch(url, init);
}
