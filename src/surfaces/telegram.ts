import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { TransportOptions, Update } from "node-telegram-bot-api";

import { Api, NetworkError, ParseError, TelegramApiError, TimeoutError } from "node-telegram-bot-api";

import type { CognitionId } from "../core/model.ts";
import type { ProviderInvoker } from "../providers/contract.ts";

import { ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";
import { StateStore } from "../persistence/state-store.ts";
import { createCodexProvider } from "../providers/codex.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";
import { createCursorProvider } from "../providers/cursor.ts";
import { createProcessProvider, providerLabel } from "../providers/process.ts";
import {
    InteractionLedgerStore,
    SurfaceDeliveryFailure,
    reconcileSurfaceDelivery,
    runSurfaceInteraction,
} from "../runtime/interaction-boundary.ts";
import { startRuntime, stopRuntime } from "../runtime/runtime.ts";
import { exactKeys, isObject } from "../util.ts";

export const TELEGRAM_SURFACE_ID = "telegram_bot";
export const TELEGRAM_BOT_API_VERSION = "10.3";
export const TELEGRAM_BOT_API_BASE_URL = "https://api.telegram.org";

export interface TelegramSurfaceConfig {
    config_version: 1;
    state_path: string;
    principal: string;
    activeScope: string;
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

export type TelegramUpdate = Update;

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
          deliveryFailure: "failed" | "uncertain" | null;
      };

interface TelegramApiFactoryOptions {
    apiRoot?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
}

type TelegramDeliveryApi = Pick<Api, "sendMessage">;
type TelegramPreflightApi = Pick<Api, "getMe" | "getWebhookInfo">;
type TelegramPollingApi = Pick<Api, "getMe" | "getWebhookInfo" | "getUpdates" | "sendMessage">;

export function createTelegramApi(token: string, options: TelegramApiFactoryOptions = {}) {
    validateTelegramToken(token);
    const apiRoot = (options.apiRoot ?? TELEGRAM_BOT_API_BASE_URL).replace(/\/$/, "");
    if (!/^https:\/\//.test(apiRoot)) throw new ValidationError("Telegram Bot API base URL must use HTTPS");

    const transport: TransportOptions = { apiRoot, maxRetries: 0 };
    if (options.fetch !== undefined) transport.fetch = options.fetch;
    if (options.timeoutMs !== undefined) transport.timeoutMs = options.timeoutMs;
    return new Api(token, transport);
}

export async function verifyTelegramLongPollingReady(api: TelegramPreflightApi, signal?: AbortSignal) {
    const bot = await api.getMe(signal);
    validateTelegramUserEvidence(bot, "getMe result");
    if (!bot.is_bot) throw new ValidationError("configured Telegram token does not identify a bot");

    const webhook = await api.getWebhookInfo(signal);
    validateTelegramWebhookEvidence(webhook);
    if (webhook.url)
        throw new ValidationError(
            "Telegram bot has an active webhook; remove it explicitly before starting Ember long polling",
        );
    return { bot, webhook };
}

export async function deleteTelegramWebhook(api: Pick<Api, "deleteWebhook">, signal?: AbortSignal) {
    const deleted = await api.deleteWebhook({ drop_pending_updates: false }, signal);
    if (deleted !== true) throw new ValidationError("Telegram deleteWebhook returned an invalid result");
}

export async function deliverTelegramMessage(
    api: TelegramDeliveryApi,
    chatId: number,
    text: string,
    { messageThreadId = null, signal }: { messageThreadId?: number | null; signal?: AbortSignal } = {},
) {
    validateChatId(chatId);
    if (typeof text !== "string" || !text.length) throw new ValidationError("Telegram delivery text must be non-empty");
    if (messageThreadId !== null && (!Number.isSafeInteger(messageThreadId) || messageThreadId <= 0))
        throw new ValidationError("Telegram message thread id is invalid");

    try {
        const sent = await api.sendMessage(
            {
                chat_id: chatId,
                text,
                ...(messageThreadId === null ? {} : { message_thread_id: messageThreadId }),
            },
            signal,
        );
        if (!isObject(sent) || !Number.isSafeInteger(sent.message_id) || (sent.message_id as number) <= 0)
            throw new SurfaceDeliveryFailure("Telegram sendMessage returned an invalid message id", {
                outcome: "uncertain",
            });
        return { externalMessageId: String(sent.message_id) };
    } catch (error) {
        if (error instanceof SurfaceDeliveryFailure) throw error;
        if (error instanceof TelegramApiError) {
            const retryAfter = telegramRetryAfter(error.retryAfter);
            const rejected = error.errorCode < 500;
            const retryable = rejected && error.errorCode === 429 && retryAfter !== null;
            throw new SurfaceDeliveryFailure(
                rejected
                    ? `Telegram sendMessage rejected the request: ${error.description}`
                    : `Telegram sendMessage outcome is uncertain: ${error.description}`,
                {
                    outcome: rejected ? "failed" : "uncertain",
                    retryable,
                    retryAfterSeconds: retryable ? retryAfter : null,
                    cause: error,
                },
            );
        }
        if (error instanceof NetworkError || error instanceof TimeoutError || error instanceof ParseError || signal?.aborted)
            throw new SurfaceDeliveryFailure("Telegram sendMessage delivery outcome is uncertain", {
                outcome: "uncertain",
                cause: error,
            });
        throw new SurfaceDeliveryFailure("Telegram sendMessage delivery outcome is uncertain", {
            outcome: "uncertain",
            cause: error,
        });
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
    validateTelegramUpdateEvidence(update);
    const message = update.message;
    if (message === undefined) return null;
    if (message.chat.type !== "private" || message.chat.id !== config.chat_id) return null;
    if (message.from === undefined || message.from.is_bot || message.from.id !== config.chat_id) return null;
    if (typeof message.text !== "string" || !message.text.trim()) return null;

    const threadId = message.message_thread_id ?? null;
    const occurredAt = telegramTimestamp(message.date, "Telegram message date");
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
    api: TelegramDeliveryApi,
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
        const started = startRuntime(state, config.principal, config.activeScope);
        runtimeId = started.runtimeId;
        state = await store.commit(state.revision, started.state);
        const selectedProvider = provider ?? providerForConfig(config);
        try {
            const result = await runSurfaceInteraction(store, state, {
                runtimeId,
                principal: config.principal,
                scope: config.activeScope,
                text: inbound.text,
                providerLabel: providerLabel(config.provider_command),
                provider: selectedProvider,
                timeoutSeconds: config.provider_timeout_seconds,
                signal,
                surfaceId: TELEGRAM_SURFACE_ID,
                principalProvenance: "configured_surface_mapping",
                externalOccurrence: inbound.externalOccurrence,
                deliveryDestinationId: inbound.deliveryDestinationId,
                deliver: (text) =>
                    deliverTelegramMessage(api, inbound.chatId, text, {
                        messageThreadId: inbound.messageThreadId,
                        signal,
                    }),
            });
            stopReason = result.providerFailure === null ? "telegram_update_complete" : "telegram_provider_failure";
            return {
                kind: result.replayed ? "replayed" : "processed",
                updateId: update.update_id,
                cognitionId: result.cognitionId,
                providerFailure: result.providerFailure,
                deliveryFailure: null,
            };
        } catch (error) {
            if (!(error instanceof SurfaceDeliveryFailure)) throw error;
            const ledger = await new InteractionLedgerStore(config.state_path).load();
            const occurrence = ledger.inbound_occurrences.find(
                (record) =>
                    record.surface_id === TELEGRAM_SURFACE_ID &&
                    record.external_occurrence_id === inbound.externalOccurrence.occurrenceId,
            );
            if (!occurrence)
                throw new AggregateError([error], "Telegram delivery failed after its inbound occurrence was lost");
            stopReason = "telegram_delivery_failure";
            return {
                kind: "processed",
                updateId: update.update_id,
                cognitionId: occurrence.cognitionId,
                providerFailure: null,
                deliveryFailure: error.outcome,
            };
        }
    } finally {
        try {
            if (runtimeId !== null) {
                const current = await store.load();
                const runtime = current.operations.runtimeEpisodes.find((episode) => episode.runtimeId === runtimeId);
                if (runtime?.cleanStopAt === null) {
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

export async function reconcileTelegramDeliveries(
    config: TelegramSurfaceConfig,
    api: TelegramDeliveryApi,
    { signal, observedAt }: { signal?: AbortSignal; observedAt?: string } = {},
) {
    validateTelegramSurfaceConfig(config);
    const store = new StateStore(config.state_path);
    const lease = await store.acquireWriteLease();
    try {
        const state = await store.load();
        const ledger = await new InteractionLedgerStore(config.state_path).load();
        const pendingCognitionIds = new Set(
            state.operations.cognitionEpisodes
                .filter((cognition) => cognition.status === "completed" && cognition.deliveryStatus !== "displayed")
                .map((cognition) => cognition.cognitionId),
        );
        const results = [];
        for (const delivery of ledger.deliveries) {
            if (signal?.aborted) break;
            if (delivery.surface_id !== TELEGRAM_SURFACE_ID || !pendingCognitionIds.has(delivery.cognitionId)) continue;
            const destination = parseTelegramDestination(delivery.destination_id);
            if (destination.chatId !== config.chat_id)
                throw new ValidationError("Telegram delivery destination no longer matches configured private chat");
            results.push(
                await reconcileSurfaceDelivery(
                    store,
                    delivery.delivery_id,
                    (text) =>
                        deliverTelegramMessage(api, destination.chatId, text, {
                            messageThreadId: destination.messageThreadId,
                            signal,
                        }),
                    observedAt === undefined ? {} : { observedAt },
                ),
            );
        }
        return results;
    } finally {
        await store.releaseWriteLease(lease);
    }
}

export async function runTelegramPolling(
    config: TelegramSurfaceConfig,
    api: TelegramPollingApi,
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
    try {
        await verifyTelegramLongPollingReady(api, signal);
    } catch (error) {
        if (signal?.aborted) return;
        throw error;
    }

    let offset: number | undefined;
    let acceptedCount = 0;
    while (!signal?.aborted) {
        await reconcileTelegramDeliveries(config, api, { signal });
        if (signal?.aborted) return;

        let updates: TelegramUpdate[];
        try {
            const value = await api.getUpdates(
                {
                    ...(offset === undefined ? {} : { offset }),
                    timeout: config.poll_timeout_seconds,
                    allowed_updates: ["message"],
                },
                signal,
            );
            validateTelegramUpdates(value);
            updates = value;
        } catch (error) {
            if (signal?.aborted) return;
            throw error;
        }

        for (const update of updates) {
            if (signal?.aborted) return;
            const outcome = await processTelegramUpdate(config, api, update, { provider });
            onOutcome?.(outcome);
            if (outcome.kind !== "ignored") acceptedCount += 1;
            offset = update.update_id + 1;
            if (maxAcceptedUpdates !== undefined && acceptedCount >= maxAcceptedUpdates) return;
            if (signal?.aborted) return;
        }
    }
}

export function renderTelegramSurfaceUnit(config: TelegramSurfaceConfig, configPath: string) {
    validateTelegramSurfaceConfig(config);
    requireAbsolutePath(configPath, "Telegram surface config path");
    return `[Unit]\nDescription=Ember Telegram messaging surface\nWants=network-online.target\nAfter=network-online.target\n\n[Service]\nType=exec\nWorkingDirectory=${systemdQuote(config.working_directory)}\nExecStart=${systemdQuote(config.node_path)} ${systemdQuote(config.surface_entrypoint)} serve --config ${systemdQuote(configPath)}\nRestart=on-failure\nRestartSec=5s\nKillMode=mixed\nTimeoutStopSec=${config.stop_timeout_seconds}s\nUMask=0077\n\n[Install]\nWantedBy=default.target\n`;
}

export function validateTelegramSurfaceConfig(value: unknown): asserts value is TelegramSurfaceConfig {
    if (!isObject(value)) throw new ValidationError("Telegram surface config must be an object");
    const fields = [
        "activeScope",
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
    ];
    if (!exactKeys(value, fields)) throw new ValidationError("Telegram surface config contains unsupported fields");
    if (value.config_version !== 1) throw new ValidationError("Telegram surface config version is unsupported");
    validateOpaque(value.principal, "Telegram principal", 256);
    validateOpaque(value.activeScope, "Telegram active scope", 256);
    validateChatId(value.chat_id);
    requireAbsolutePath(value.state_path, "Telegram state path");
    requireAbsolutePath(value.token_file, "Telegram token file");
    requireAbsolutePath(value.provider_command, "Telegram provider command");
    requireAbsolutePath(value.working_directory, "Telegram working directory");
    requireAbsolutePath(value.node_path, "Telegram Node path");
    requireAbsolutePath(value.surface_entrypoint, "Telegram surface entrypoint");
    if (!["process", "codex", "cursor"].includes(value.provider_kind as string))
        throw new ValidationError("Telegram provider kind is unsupported");
    if (!Array.isArray(value.provider_arguments) || value.provider_arguments.some((arg) => typeof arg !== "string"))
        throw new ValidationError("Telegram provider arguments must be a string list");
    for (const argument of value.provider_arguments as string[]) {
        if (ASCII_CONTROL_CHARACTER_PATTERN.test(argument))
            throw new ValidationError("Telegram provider argument contains a control character");
    }
    validatePollTimeout(value.poll_timeout_seconds);
    if (
        typeof value.provider_timeout_seconds !== "number" ||
        !Number.isFinite(value.provider_timeout_seconds) ||
        value.provider_timeout_seconds <= 0 ||
        value.provider_timeout_seconds > MAX_PROVIDER_TIMEOUT_SECONDS
    )
        throw new ValidationError(`Telegram provider timeout must be in (0, ${MAX_PROVIDER_TIMEOUT_SECONDS}]`);
    if (
        typeof value.stop_timeout_seconds !== "number" ||
        !Number.isSafeInteger(value.stop_timeout_seconds) ||
        value.stop_timeout_seconds < 1 ||
        value.stop_timeout_seconds > 3600
    )
        throw new ValidationError("Telegram stop timeout must be an integer between 1 and 3600 seconds");
}

function providerForConfig(config: TelegramSurfaceConfig): ProviderInvoker {
    const adapter = { command: config.provider_command, arguments_: config.provider_arguments };
    if (config.provider_kind === "codex") return createCodexProvider(adapter);
    if (config.provider_kind === "cursor") return createCursorProvider(adapter);
    return createProcessProvider(adapter);
}

function validateTelegramUpdates(value: unknown): asserts value is TelegramUpdate[] {
    if (!Array.isArray(value)) throw new ValidationError("Telegram getUpdates returned a non-list result");
    for (const update of value) validateTelegramUpdateEvidence(update);
    for (let index = 1; index < value.length; index += 1) {
        if (value[index]!.update_id <= value[index - 1]!.update_id)
            throw new ValidationError("Telegram getUpdates returned non-increasing update ids");
    }
}

function validateTelegramUpdateEvidence(value: unknown): asserts value is TelegramUpdate {
    const record = requireProtocolRecord(value, "Telegram update");
    if (!Number.isSafeInteger(record.update_id) || (record.update_id as number) < 0)
        throw new ValidationError("Telegram update id is invalid");
    if (record.message !== undefined) validateTelegramMessageEvidence(record.message);
}

function validateTelegramMessageEvidence(value: unknown) {
    const record = requireProtocolRecord(value, "Telegram message");
    if (!Number.isSafeInteger(record.message_id) || (record.message_id as number) <= 0)
        throw new ValidationError("Telegram message id is invalid");
    telegramTimestamp(record.date, "Telegram message date");
    validateTelegramChatEvidence(record.chat, "Telegram message chat");
    if (record.from !== undefined) validateTelegramUserEvidence(record.from, "Telegram message sender");
    if (record.message_thread_id !== undefined) {
        if (!Number.isSafeInteger(record.message_thread_id) || (record.message_thread_id as number) <= 0)
            throw new ValidationError("Telegram message thread id is invalid");
    }
    if (record.text !== undefined && typeof record.text !== "string")
        throw new ValidationError("Telegram message text is invalid");
}

function validateTelegramUserEvidence(value: unknown, field: string) {
    const record = requireProtocolRecord(value, field);
    if (!Number.isSafeInteger(record.id) || (record.id as number) <= 0)
        throw new ValidationError(`${field} id is invalid`);
    if (typeof record.is_bot !== "boolean") throw new ValidationError(`${field} is_bot is invalid`);
    if (record.username !== undefined && typeof record.username !== "string")
        throw new ValidationError(`${field} username is invalid`);
}

function validateTelegramChatEvidence(value: unknown, field: string) {
    const record = requireProtocolRecord(value, field);
    if (!Number.isSafeInteger(record.id) || record.id === 0) throw new ValidationError(`${field} id is invalid`);
    if (typeof record.type !== "string" || !record.type) throw new ValidationError(`${field} type is invalid`);
}

function validateTelegramWebhookEvidence(value: unknown) {
    const record = requireProtocolRecord(value, "getWebhookInfo result");
    if (typeof record.url !== "string") throw new ValidationError("Telegram getWebhookInfo returned invalid url");
    if (!Number.isSafeInteger(record.pending_update_count) || (record.pending_update_count as number) < 0)
        throw new ValidationError("Telegram getWebhookInfo returned invalid pending_update_count");
}

function telegramRetryAfter(value: unknown) {
    return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function telegramTimestamp(value: unknown, field: string) {
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new ValidationError(`${field} is invalid`);
    const date = new Date((value as number) * 1000);
    if (Number.isNaN(date.getTime())) throw new ValidationError(`${field} is invalid`);
    return date.toISOString();
}

function parseTelegramDestination(value: string | null) {
    if (value === null) throw new ValidationError("Telegram delivery is missing a destination");
    const match = /^telegram:chat:(\d+)(?::thread:(\d+))?$/.exec(value);
    if (!match) throw new ValidationError("Telegram delivery destination is invalid");
    const chatId = Number(match[1]);
    const messageThreadId = match[2] === undefined ? null : Number(match[2]);
    validateChatId(chatId);
    if (messageThreadId !== null && (!Number.isSafeInteger(messageThreadId) || messageThreadId <= 0))
        throw new ValidationError("Telegram delivery thread is invalid");
    return { chatId, messageThreadId };
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

function requireProtocolRecord(value: unknown, field: string): Record<string, unknown> {
    if (!isObject(value)) throw new ValidationError(`${field} must be an object`);
    return value;
}

function systemdQuote(value: string) {
    return `"${value.replaceAll("%", "%%").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
