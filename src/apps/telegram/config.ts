import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { WorkerLaunch } from "../../core/host/background.ts";

import { MAX_AI_TIMEOUT_SECONDS } from "../../core/ai/contract.ts";
import { ValidationError } from "../../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../../core/model.ts";
import { exactKeys, isObject } from "../../core/util.ts";

export type TelegramProviderConfig =
    | { kind: "codex" | "cursor"; command: string; model: string; timeout_seconds: number }
    | { kind: "claude-code"; model: string; timeout_seconds: number }
    | { kind: "ollama"; model: string; base_url?: string; timeout_seconds: number }
    | { kind: "deepseek"; model: string; timeout_seconds: number };

export interface TelegramSurfaceConfig {
    config_version: 1 | 2 | 3;
    google_calendar_config_path?: string;
    state_path: string;
    principal: string;
    activeScope: string;
    chat_id: number;
    token_file: string;
    poll_timeout_seconds: number;
    provider_kind: "process" | "codex" | "cursor" | "claude-code" | "ollama" | "deepseek";
    provider_command: string;
    provider_arguments: string[];
    provider_timeout_seconds: number;
    provider?: TelegramProviderConfig;
    proactive_contact_policy_path?: string;
    working_directory: string;
    node_path: string;
    surface_entrypoint: string;
    stop_timeout_seconds: number;
}

/** Only transport and recovery values cross into the conversational adapter. */
export type TelegramTransportConfig = Pick<
    TelegramSurfaceConfig,
    "principal" | "activeScope" | "chat_id" | "poll_timeout_seconds" | "state_path" | "proactive_contact_policy_path"
>;

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
    return normalizeTelegramSurfaceConfig(value);
}

export function telegramResidentLaunch(config: TelegramSurfaceConfig, configPath: string): WorkerLaunch {
    validateTelegramSurfaceConfig(config);
    requireAbsolutePath(configPath, "Telegram surface config path");
    return {
        jobId: "ember-telegram",
        executable: config.node_path,
        arguments: [config.surface_entrypoint, "serve", "--config", configPath],
        workingDirectory: config.working_directory,
        stopTimeoutSeconds: config.stop_timeout_seconds,
    };
}

export function validateTelegramSurfaceConfig(value: unknown): asserts value is TelegramSurfaceConfig {
    if (!isObject(value)) throw new ValidationError("Telegram surface config must be an object");
    const legacyFields = [
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
    const v2Fields = legacyFields.filter((field) => !field.startsWith("provider_")).concat("provider");
    const structuredFields = value.config_version === 3 ? [...v2Fields, "google_calendar_config_path"] : v2Fields;
    const optionalPolicyFields = [...structuredFields, "proactive_contact_policy_path"];
    if (
        (value.config_version !== 1 || !exactKeys(value, legacyFields)) &&
        ((value.config_version !== 2 && value.config_version !== 3) ||
            (!exactKeys(value, structuredFields) &&
                !exactKeys(value, optionalPolicyFields) &&
                !exactKeys(value, [
                    ...structuredFields,
                    "provider_kind",
                    "provider_command",
                    "provider_arguments",
                    "provider_timeout_seconds",
                ]) &&
                !exactKeys(value, [
                    ...optionalPolicyFields,
                    "provider_kind",
                    "provider_command",
                    "provider_arguments",
                    "provider_timeout_seconds",
                ])))
    )
        throw new ValidationError("Telegram surface config contains unsupported fields or version");
    validateOpaque(value.principal, "Telegram principal", 256);
    validateOpaque(value.activeScope, "Telegram active scope", 256);
    validateChatId(value.chat_id);
    requireAbsolutePath(value.state_path, "Telegram state path");
    requireAbsolutePath(value.token_file, "Telegram token file");
    requireAbsolutePath(value.working_directory, "Telegram working directory");
    requireAbsolutePath(value.node_path, "Telegram Node path");
    requireAbsolutePath(value.surface_entrypoint, "Telegram surface entrypoint");
    if (value.config_version === 3)
        requireAbsolutePath(value.google_calendar_config_path, "Google Calendar config path");
    if (value.proactive_contact_policy_path !== undefined)
        requireAbsolutePath(value.proactive_contact_policy_path, "proactive contact policy path");
    if (value.config_version === 1) validateLegacyProvider(value);
    else validateStructuredProvider(value.provider);
    validatePollTimeout(value.poll_timeout_seconds);
    if (
        typeof providerTimeout(value) !== "number" ||
        !Number.isFinite(providerTimeout(value)) ||
        providerTimeout(value) <= 0 ||
        providerTimeout(value) > MAX_AI_TIMEOUT_SECONDS
    )
        throw new ValidationError(`Telegram provider timeout must be in (0, ${MAX_AI_TIMEOUT_SECONDS}]`);
    if (
        typeof value.stop_timeout_seconds !== "number" ||
        !Number.isSafeInteger(value.stop_timeout_seconds) ||
        value.stop_timeout_seconds < 1 ||
        value.stop_timeout_seconds > 3600
    )
        throw new ValidationError("Telegram stop timeout must be an integer between 1 and 3600 seconds");
}

function validateLegacyProvider(value: Record<string, unknown>) {
    requireAbsolutePath(value.provider_command, "Telegram provider command");
    if (!["process", "codex", "cursor"].includes(value.provider_kind as string))
        throw new ValidationError("Telegram provider kind is unsupported");
    if (!Array.isArray(value.provider_arguments) || value.provider_arguments.some((arg) => typeof arg !== "string"))
        throw new ValidationError("Telegram provider arguments must be a string list");
    for (const argument of value.provider_arguments as string[])
        if (ASCII_CONTROL_CHARACTER_PATTERN.test(argument))
            throw new ValidationError("Telegram provider argument contains a control character");
}

function validateStructuredProvider(value: unknown): asserts value is TelegramProviderConfig {
    if (!isObject(value)) throw new ValidationError("Telegram provider configuration is invalid");
    if (!["codex", "cursor", "claude-code", "ollama", "deepseek"].includes(String(value.kind)))
        throw new ValidationError("Telegram provider kind is unsupported");
    const fields =
        value.kind === "claude-code" || value.kind === "deepseek"
            ? ["kind", "model", "timeout_seconds"]
            : value.kind === "ollama"
              ? value.base_url === undefined
                  ? ["kind", "model", "timeout_seconds"]
                  : ["kind", "model", "base_url", "timeout_seconds"]
              : ["kind", "command", "model", "timeout_seconds"];
    if (!exactKeys(value, fields)) throw new ValidationError("Telegram provider configuration is invalid");
    if (value.kind !== "claude-code" && value.kind !== "ollama" && value.kind !== "deepseek")
        requireAbsolutePath(value.command, "Telegram provider command");
    if (typeof value.model !== "string" || ASCII_CONTROL_CHARACTER_PATTERN.test(value.model))
        throw new ValidationError("Telegram provider model is invalid");
    if (
        value.kind === "ollama" &&
        (!value.model.trim() || (value.base_url !== undefined && !isLoopbackUrl(value.base_url)))
    )
        throw new ValidationError("Telegram Ollama provider configuration is invalid");
}

function providerTimeout(value: Record<string, unknown>) {
    return value.config_version !== 1 && isObject(value.provider)
        ? value.provider.timeout_seconds
        : value.provider_timeout_seconds;
}

function normalizeTelegramSurfaceConfig(config: TelegramSurfaceConfig): TelegramSurfaceConfig {
    if (config.config_version === 1) return config;
    const provider = config.provider!;
    return {
        ...config,
        provider_kind: provider.kind,
        provider_command:
            provider.kind === "claude-code" || provider.kind === "ollama" || provider.kind === "deepseek"
                ? provider.kind
                : provider.command,
        provider_arguments: provider.model ? ["--model", provider.model] : [],
        provider_timeout_seconds: provider.timeout_seconds,
    };
}

function isLoopbackUrl(value: unknown): boolean {
    if (typeof value !== "string" || ASCII_CONTROL_CHARACTER_PATTERN.test(value)) return false;
    try {
        const url = new URL(value);
        return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    } catch {
        return false;
    }
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
