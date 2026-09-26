import type { TransportOptions, Update } from "node-telegram-bot-api";

import { Api, NetworkError, ParseError, TelegramApiError, TimeoutError } from "node-telegram-bot-api";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { ContactAttentionDecisionRecord } from "../../agency/proactive-contact-attention-policy.ts";
import type { ProactiveContactIntentRecord } from "../../agency/proactive-contact-store.ts";
import type { EmberApplication } from "../../app/contract.ts";
import type { SurfaceRepositories } from "../../app/surface-repositories.ts";
import type { CognitionId, EmberState } from "../../core/model.ts";

type TelegramRepositories = SurfaceRepositories;

import {
    decideConfiguredProactiveContactHandoff,
    loadConfiguredProactiveContactPolicy,
} from "../../agency/configured-proactive-contact-policy.ts";
import { ValidationError } from "../../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, nowUtc } from "../../core/model.ts";
import { reconcileSurfaceDelivery, SurfaceDeliveryFailure } from "../../runtime/interaction-boundary.ts";
import { isObject } from "../../core/util.ts";

export const TELEGRAM_SURFACE_ID = "telegram_bot";
export const TELEGRAM_BOT_API_VERSION = "10.3";
export const TELEGRAM_BOT_API_BASE_URL = "https://api.telegram.org";

import type { TelegramTransportConfig } from "./config.ts";

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
          memoryProposalFailure: string | null;
          onboardingProgressFailure: string | null;
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

export type ProactiveContactHandoffRevalidator = (
    state: EmberState,
    intent: ProactiveContactIntentRecord,
    consideredAt: string,
) => ContactAttentionDecisionRecord | Promise<ContactAttentionDecisionRecord>;

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
    { messageThreadId = null, signal }: { messageThreadId?: number | null; signal?: AbortSignal | undefined } = {},
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
        if (
            error instanceof NetworkError ||
            error instanceof TimeoutError ||
            error instanceof ParseError ||
            signal?.aborted
        )
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

export async function readTelegramBotToken(path: string) {
    requireAbsolutePath(path, "Telegram token file");
    const token = (await readFile(path, "utf8")).trim();
    validateTelegramToken(token);
    return token;
}

export function selectTelegramInbound(
    update: TelegramUpdate,
    config: TelegramTransportConfig,
): TelegramInboundMessage | null {
    validateTelegramUpdateEvidence(update);
    const message = "message" in update ? update.message : undefined;
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
    config: TelegramTransportConfig,
    api: TelegramDeliveryApi,
    update: TelegramUpdate,
    {
        application,
        signal,
    }: {
        application: EmberApplication;
        signal?: AbortSignal | undefined;
    },
): Promise<TelegramUpdateOutcome> {
    const inbound = selectTelegramInbound(update, config);
    if (inbound === null) return { kind: "ignored", updateId: update.update_id };

    const result = await application.interact(
        {
            kind: "message",
            principal: config.principal,
            scope: config.activeScope,
            text: inbound.text,
            surfaceId: TELEGRAM_SURFACE_ID,
            principalProvenance: "configured_surface_mapping",
            externalOccurrence: inbound.externalOccurrence,
            deliveryDestinationId: inbound.deliveryDestinationId,
        },
        async ({ address, text }, options) => {
            const destination = parseTelegramDestination(address.destinationId);
            if (destination.chatId !== inbound.chatId || destination.messageThreadId !== inbound.messageThreadId)
                throw new ValidationError("application delivery address differs from the accepted Telegram message");
            try {
                const receipt = await deliverTelegramMessage(api, destination.chatId, text, {
                    messageThreadId: destination.messageThreadId,
                    ...(options.signal === undefined ? {} : { signal: options.signal }),
                });
                return { outcome: "confirmed", externalMessageId: receipt.externalMessageId };
            } catch (error) {
                if (!(error instanceof SurfaceDeliveryFailure)) throw error;
                return error.outcome === "failed"
                    ? {
                          outcome: "failed",
                          externalMessageId: error.externalMessageId,
                          retryable: error.retryable,
                          retryAfterSeconds: error.retryAfterSeconds,
                      }
                    : { outcome: "uncertain", externalMessageId: error.externalMessageId };
            }
        },
        signal === undefined ? {} : { signal },
    );
    return {
        kind: result.replayed ? "replayed" : "processed",
        updateId: update.update_id,
        cognitionId: result.cognitionId,
        providerFailure: result.diagnostics.providerFailure,
        memoryProposalFailure: result.diagnostics.memoryProposalFailure,
        onboardingProgressFailure: result.diagnostics.onboardingProgressFailure,
        deliveryFailure:
            result.delivery?.status === "blocked_uncertain"
                ? "uncertain"
                : result.delivery?.status === "failed_non_retryable" || result.delivery?.status === "retryable_failure"
                  ? "failed"
                  : null,
    };
}

export async function reconcileTelegramDeliveries(
    config: TelegramTransportConfig,
    api: TelegramDeliveryApi,
    {
        signal,
        observedAt,
        repositories,
    }: {
        signal?: AbortSignal | undefined;
        observedAt?: string;
        repositories: TelegramRepositories;
    },
) {
    const store = repositories.state;
    const lease = await store.acquireWriteLease();
    try {
        const state = await store.load();
        const ledger = await repositories.interactions.load();
        const pendingCognitionIds = new Set(
            state.operations.cognitionEpisodes
                .filter((cognition) => cognition.status === "completed" && cognition.deliveryStatus !== "displayed")
                .map((cognition) => cognition.cognitionId),
        );
        const results = [];
        for (const delivery of ledger.deliveries) {
            if (signal?.aborted) break;
            if (
                delivery.origin.kind !== "ordinary_cognition" ||
                delivery.surface_id !== TELEGRAM_SURFACE_ID ||
                !pendingCognitionIds.has(delivery.cognitionId)
            )
                continue;
            const destination = parseTelegramDestination(delivery.destination_id);
            if (destination.chatId !== config.chat_id)
                throw new ValidationError("Telegram delivery destination no longer matches configured private chat");
            results.push(
                await reconcileSurfaceDelivery(
                    repositories,
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

export async function reconcileTelegramProactiveContacts(
    config: TelegramTransportConfig,
    api: TelegramDeliveryApi,
    {
        signal,
        observedAt = nowUtc(),
        revalidateBeforeHandoff,
        repositories,
    }: {
        signal?: AbortSignal | undefined;
        observedAt?: string;
        revalidateBeforeHandoff?: ProactiveContactHandoffRevalidator;
        repositories: TelegramRepositories;
    },
) {
    const store = repositories.state;
    const lease = await store.acquireWriteLease();
    try {
        const state = await store.load();
        const contacts = repositories.proactiveContacts;
        const ledger = repositories.interactions;
        const document = await contacts.load();
        const results = [];
        for (const intent of document.intents) {
            if (signal?.aborted) break;
            let lifecycleIntent = intent;
            const latestDecision = intent.policy_decisions.at(-1);
            const selectedForTelegram =
                intent.handoff?.surface_id === TELEGRAM_SURFACE_ID ||
                (["pending", "deferred"].includes(intent.disposition) &&
                    latestDecision?.outcome === "admit" &&
                    latestDecision.selected_surface_id === TELEGRAM_SURFACE_ID);
            if (!selectedForTelegram || intent.disposition === "satisfied") continue;
            if (state.runtimeContract.localPrincipal !== config.principal)
                throw new ValidationError("Telegram proactive principal differs from initialized local principal");
            if (intent.principal !== config.principal)
                throw new ValidationError("proactive contact principal does not match Telegram configuration");
            if (intent.scope !== config.activeScope)
                throw new ValidationError("proactive contact scope does not match Telegram configuration");
            const destinationId = `telegram:chat:${config.chat_id}`;
            const currentLedger = await ledger.load();
            let delivery = currentLedger.deliveries.find(
                (item) =>
                    item.origin.kind === "proactive_contact" &&
                    item.origin.contact_intent_id === intent.contact_intent_id,
            );
            if (intent.handoff !== null) {
                if (delivery === undefined || delivery.delivery_id !== intent.handoff.delivery_id)
                    throw new ValidationError("proactive contact handoff has no matching delivery correlation");
            } else {
                if (revalidateBeforeHandoff === undefined) continue;
                const freshDecision = await revalidateBeforeHandoff(
                    structuredClone(state),
                    structuredClone(intent),
                    observedAt,
                );
                if (
                    freshDecision.contact_intent_id !== intent.contact_intent_id ||
                    freshDecision.considered_at !== observedAt ||
                    freshDecision.current_revision !== state.revision
                )
                    throw new ValidationError("proactive handoff revalidation is not current for this intent");
                lifecycleIntent = await contacts.recordPolicyDecision(freshDecision);
                if (freshDecision.outcome !== "admit" || freshDecision.selected_surface_id !== TELEGRAM_SURFACE_ID)
                    continue;
            }
            if (delivery === undefined) {
                const freshDecision = lifecycleIntent.policy_decisions.at(-1);
                if (freshDecision?.outcome !== "admit" || freshDecision.selected_surface_id !== TELEGRAM_SURFACE_ID)
                    throw new ValidationError("Telegram proactive contact is missing its current admitted assessment");
                delivery = await ledger.createDeliveryIntent({
                    cognitionId: intent.source.cognition_id,
                    expressionEvidenceId: intent.source.expression_evidence_id,
                    surfaceId: TELEGRAM_SURFACE_ID,
                    destinationId,
                    representationText: intent.representation.text,
                    origin: {
                        kind: "proactive_contact",
                        contact_intent_id: intent.contact_intent_id,
                        policy_assessment_id: freshDecision.assessment_id,
                    },
                });
            }
            if (delivery === undefined) throw new ValidationError("proactive contact delivery could not be resolved");
            if (delivery.origin.kind !== "proactive_contact")
                throw new ValidationError("proactive delivery origin conflicts with the contact correlation");
            const deliveryOrigin = delivery.origin;
            if (
                deliveryOrigin.contact_intent_id !== intent.contact_intent_id ||
                !lifecycleIntent.policy_decisions.some(
                    (decision) =>
                        decision.assessment_id === deliveryOrigin.policy_assessment_id &&
                        decision.outcome === "admit" &&
                        decision.selected_surface_id === TELEGRAM_SURFACE_ID,
                )
            )
                throw new ValidationError("proactive delivery origin conflicts with the contact correlation");
            if (delivery.surface_id !== TELEGRAM_SURFACE_ID)
                throw new ValidationError("proactive delivery surface conflicts with Telegram selection");
            if (delivery.destination_id !== destinationId)
                throw new ValidationError("proactive delivery destination no longer matches configured private chat");
            if (delivery.representation?.contentDigest !== intent.representation.digest)
                throw new ValidationError("proactive delivery representation digest differs from the contact intent");
            if (intent.handoff === null) {
                await contacts.adoptHandoff({
                    contactIntentId: intent.contact_intent_id,
                    assessmentId: deliveryOrigin.policy_assessment_id,
                    surfaceId: TELEGRAM_SURFACE_ID,
                    deliveryId: delivery.delivery_id,
                    representationDigest: intent.representation.digest,
                    handedOffAt: observedAt,
                });
            }
            const result = await reconcileSurfaceDelivery(
                repositories,
                delivery.delivery_id,
                (text) => deliverTelegramMessage(api, config.chat_id, text, { signal }),
                { observedAt },
            );
            await contacts.recordReconciliationOutcome(intent.contact_intent_id, {
                delivery_id: delivery.delivery_id,
                attempt_id: result.attemptId,
                status: result.status,
                observed_at: observedAt,
            });
            results.push(result);
        }
        return results;
    } finally {
        await store.releaseWriteLease(lease);
    }
}

export async function runTelegramPolling(
    config: TelegramTransportConfig,
    api: TelegramPollingApi,
    {
        application,
        repositories,
        signal,
        onOutcome,
        maxAcceptedUpdates,
        revalidateProactiveContact,
    }: {
        application: EmberApplication;
        repositories: TelegramRepositories;
        signal?: AbortSignal;
        onOutcome?: (outcome: TelegramUpdateOutcome) => void;
        maxAcceptedUpdates?: number;
        revalidateProactiveContact?: ProactiveContactHandoffRevalidator;
    },
) {
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
    const configuredRevalidator = config.proactive_contact_policy_path
        ? async (state: EmberState, intent: ProactiveContactIntentRecord, consideredAt: string) =>
              decideConfiguredProactiveContactHandoff({
                  state,
                  statePath: config.state_path,
                  intent,
                  consideredAt,
                  surfaceId: TELEGRAM_SURFACE_ID,
                  policy: await loadConfiguredProactiveContactPolicy(config.proactive_contact_policy_path!),
              })
        : undefined;
    const proactiveRevalidator = revalidateProactiveContact ?? configuredRevalidator;
    while (!signal?.aborted) {
        await reconcileTelegramDeliveries(config, api, { signal, repositories });
        await reconcileTelegramProactiveContacts(config, api, {
            signal,
            repositories,
            ...(proactiveRevalidator === undefined ? {} : { revalidateBeforeHandoff: proactiveRevalidator }),
        });
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
            const outcome = await processTelegramUpdate(config, api, update, { application });
            onOutcome?.(outcome);
            if (outcome.kind !== "ignored") acceptedCount += 1;
            offset = update.update_id + 1;
            if (maxAcceptedUpdates !== undefined && acceptedCount >= maxAcceptedUpdates) return;
            if (signal?.aborted) return;
        }
    }
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

export function validateTelegramToken(token: string) {
    if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token))
        throw new ValidationError("Telegram bot token has an invalid shape");
}

function validateChatId(value: unknown) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
        throw new ValidationError("Telegram chat id must be a positive safe integer");
}

function requireAbsolutePath(value: unknown, field: string): asserts value is string {
    if (typeof value !== "string" || !isAbsolute(value) || ASCII_CONTROL_CHARACTER_PATTERN.test(value))
        throw new ValidationError(`${field} must be an absolute path without control characters`);
}

function requireProtocolRecord(value: unknown, field: string): Record<string, unknown> {
    if (!isObject(value)) throw new ValidationError(`${field} must be an object`);
    return value;
}
