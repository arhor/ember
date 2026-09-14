import type { Api, Message, Update } from "node-telegram-bot-api";
import type { Readable, Writable } from "node:stream";

import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { openSync } from "node:fs";
import { chmod, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { ReadStream, WriteStream } from "node:tty";

import type { SetupConfig } from "../cli/setup.ts";
import type { TelegramProviderConfig, TelegramSurfaceConfig } from "./surface.ts";

import { ValidationError } from "../../core/errors.ts";
import { replaceFileDurably } from "../../persistence/file-replacement.ts";
import { InteractionLedgerStore } from "../../runtime/interaction-boundary.ts";
import {
    createTelegramApi,
    renderTelegramSurfaceUnit,
    validateTelegramToken,
    verifyTelegramLongPollingReady,
} from "./surface.ts";

export type TelegramSetupStage =
    | "token_storage"
    | "bot_preflight"
    | "mapping"
    | "configuration"
    | "unit_installation"
    | "activation"
    | "round_trip";
export type TelegramSetupTruth = "not_attempted" | "confirmed" | "declined" | "failed" | "uncertain";

export interface TelegramSetupResult {
    status: "complete" | "configured_inactive" | "cancelled" | "failed" | "uncertain";
    stages: Record<TelegramSetupStage, TelegramSetupTruth>;
}

export interface TelegramSetupBinding {
    setup: SetupConfig;
    scope: string;
    configPath?: string;
    tokenPath?: string;
    unitPath?: string;
}

export interface TelegramSetupIo {
    input: Readable;
    output: Writable;
    error: Writable;
}

export interface TelegramSetupDependencies {
    secretPrompt?: (prompt: string) => Promise<string | null>;
    confirm?: (prompt: string) => Promise<boolean>;
    api?: (token: string) => Pick<Api, "getMe" | "getWebhookInfo" | "getUpdates">;
    read?: (path: string) => Promise<string | null>;
    write?: (path: string, value: string, mode: number) => Promise<void>;
    chmod?: (path: string, mode: number) => Promise<void>;
    command?: (file: string, args: string[]) => Promise<{ code: number | null; signal: string | null }>;
    observeRoundTrip?: (statePath: string, updateId: number) => Promise<boolean>;
    verificationCode?: () => string;
    nodePath?: string;
    workingDirectory?: string;
    surfaceEntrypoint?: string;
}

const stageDefaults = (): Record<TelegramSetupStage, TelegramSetupTruth> => ({
    token_storage: "not_attempted",
    bot_preflight: "not_attempted",
    mapping: "not_attempted",
    configuration: "not_attempted",
    unit_installation: "not_attempted",
    activation: "not_attempted",
    round_trip: "not_attempted",
});

export async function runTelegramSetup(
    binding: TelegramSetupBinding,
    io: TelegramSetupIo,
    dependencies: TelegramSetupDependencies = {},
): Promise<TelegramSetupResult> {
    const stages = stageDefaults();
    const configPath = binding.configPath ?? join(homedir(), ".ember", "config", "telegram.json");
    const tokenPath = binding.tokenPath ?? join(homedir(), ".ember", "secrets", "telegram.token");
    const unitPath = binding.unitPath ?? join(homedir(), ".config", "systemd", "user", "ember-telegram.service");
    const read = dependencies.read ?? readOptional;
    const write = dependencies.write ?? writeSecretSafe;
    const confirm = dependencies.confirm ?? trustedConfirm;

    try {
        const existingToken = await read(tokenPath);
        let token = existingToken?.trim() ?? null;
        if (token !== null && !(await confirm("Reuse the existing Telegram bot token?"))) {
            if (!(await confirm("Replace the existing Telegram bot token?")))
                return { status: "cancelled", stages: { ...stages, token_storage: "declined" } };
            token = null;
        }
        if (token === null) {
            token = await (dependencies.secretPrompt ?? maskedSecretPrompt)("BotFather token: ");
            if (token === null) return { status: "cancelled", stages };
            // Validation occurs before the only durable write and never includes the value in diagnostics.
            validateTelegramToken(token);
            await write(tokenPath, `${token}\n`, 0o600);
        } else await (dependencies.chmod ?? chmod)(tokenPath, 0o600);
        stages.token_storage = "confirmed";

        const api = (dependencies.api ? dependencies.api(token) : createTelegramApi(token)) as Pick<
            Api,
            "getMe" | "getWebhookInfo" | "getUpdates"
        >;
        await verifyTelegramLongPollingReady(api);
        stages.bot_preflight = "confirmed";

        const code = dependencies.verificationCode?.() ?? String(randomInt(100_000, 1_000_000));
        io.output.write(`Send this verification code privately to the bot: ${code}\n`);
        const updates = await api.getUpdates({ timeout: 30, allowed_updates: ["message"] });
        const candidates = matchingPrivateUpdates(updates, code);
        if (!candidates.length)
            throw new ValidationError("no matching private Telegram verification message was found");
        let selected: PrivateMessageUpdate | null = null;
        for (const candidate of candidates) {
            const message = candidate.message!;
            io.output.write(
                `Candidate: chat ${message.chat.id}, user ${message.from?.username ? `@${message.from.username}` : message.from?.id}, update ${candidate.update_id}\n`,
            );
            if (
                await confirm(
                    `Map this private chat to Ember principal ${binding.setup.principal} in scope ${binding.scope}?`,
                )
            ) {
                selected = candidate;
                break;
            }
        }
        if (selected === null) return { status: "cancelled", stages: { ...stages, mapping: "declined" } };
        stages.mapping = "confirmed";

        const config = telegramV2Config(binding, tokenPath, selected.message!.chat.id, dependencies);
        const serialized = `${JSON.stringify(serializableV2(config), null, 2)}\n`;
        const existingConfig = await read(configPath);
        if (
            existingConfig !== null &&
            existingConfig !== serialized &&
            !(await confirm("Replace drifted Telegram configuration?"))
        )
            return { status: "cancelled", stages: { ...stages, configuration: "declined" } };
        if (existingConfig !== serialized) await write(configPath, serialized, 0o600);
        stages.configuration = "confirmed";

        const unit = renderTelegramSurfaceUnit(config, configPath);
        const existingUnit = await read(unitPath);
        const command = dependencies.command ?? runCommand;
        const [enabled, active] = await Promise.all([
            command("systemctl", ["--user", "is-enabled", "ember-telegram.service"]),
            command("systemctl", ["--user", "is-active", "ember-telegram.service"]),
        ]);
        io.output.write(
            `Existing Telegram service: installed ${enabled.code === 0 ? "yes" : enabled.code === null ? "unknown" : "no"}; active ${active.code === 0 ? "yes" : active.code === null ? "unknown" : "no"}.\n`,
        );
        if (!(await confirm("Install and start the Telegram user service?")))
            return {
                status: "configured_inactive",
                stages: { ...stages, unit_installation: "declined", activation: "declined" },
            };
        if (
            existingUnit !== null &&
            existingUnit !== unit &&
            !(await confirm("Replace the drifted Telegram systemd unit?"))
        )
            return { status: "configured_inactive", stages: { ...stages, unit_installation: "declined" } };
        if (existingUnit !== unit) await write(unitPath, unit, 0o600);
        stages.unit_installation = "confirmed";

        for (const args of [
            ["--user", "daemon-reload"],
            ["--user", "enable", "--now", "ember-telegram.service"],
        ]) {
            const outcome = await command("systemctl", args);
            if (outcome.code !== 0) {
                stages.activation = outcome.code === null ? "uncertain" : "failed";
                return { status: outcome.code === null ? "uncertain" : "failed", stages };
            }
        }
        stages.activation = "confirmed";
        stages.round_trip = (await (dependencies.observeRoundTrip ?? observeConfirmedRoundTrip)(
            binding.setup.statePath,
            selected.update_id,
        ))
            ? "confirmed"
            : "uncertain";
        return { status: stages.round_trip === "confirmed" ? "complete" : "uncertain", stages };
    } catch (error) {
        io.error.write(`Telegram setup did not complete: ${safeError(error)}\n`);
        const current = (Object.keys(stages) as TelegramSetupStage[]).find(
            (stage) => stages[stage] === "not_attempted",
        );
        if (current) stages[current] = "failed";
        return { status: "failed", stages };
    }
}

function telegramV2Config(
    binding: TelegramSetupBinding,
    tokenPath: string,
    chatId: number,
    dependencies: TelegramSetupDependencies,
): TelegramSurfaceConfig {
    const provider: TelegramProviderConfig = {
        kind: binding.setup.provider.kind,
        command: resolve(binding.setup.provider.command),
        model: binding.setup.provider.model,
        timeout_seconds: binding.setup.provider.timeoutSeconds,
    };
    return {
        config_version: 2,
        state_path: binding.setup.statePath,
        principal: binding.setup.principal,
        activeScope: binding.scope,
        chat_id: chatId,
        token_file: tokenPath,
        poll_timeout_seconds: 30,
        provider,
        provider_kind: provider.kind,
        provider_command: provider.command,
        provider_arguments: provider.model ? ["--model", provider.model] : [],
        provider_timeout_seconds: provider.timeout_seconds,
        working_directory: dependencies.workingDirectory ?? process.cwd(),
        node_path: dependencies.nodePath ?? process.execPath,
        surface_entrypoint: dependencies.surfaceEntrypoint ?? resolve("bin/ember-telegram.ts"),
        stop_timeout_seconds: 90,
    };
}

function serializableV2(config: TelegramSurfaceConfig) {
    const {
        provider_kind: _kind,
        provider_command: _command,
        provider_arguments: _args,
        provider_timeout_seconds: _timeout,
        ...value
    } = config;
    return value;
}

type PrivateMessageUpdate = Update & { message: Message };

function matchingPrivateUpdates(updates: Update[], code: string): PrivateMessageUpdate[] {
    return updates.filter((update): update is PrivateMessageUpdate => {
        const message = "message" in update ? update.message : undefined;
        return (
            message?.chat.type === "private" &&
            message.from !== undefined &&
            !message.from.is_bot &&
            message.from.id === message.chat.id &&
            message.text?.trim() === code
        );
    });
}

async function observeConfirmedRoundTrip(statePath: string, updateId: number) {
    const ledger = await new InteractionLedgerStore(statePath).load();
    const occurrence = ledger.inbound_occurrences.find(
        (value) => value.surface_id === "telegram_bot" && value.external_occurrence_id === `update:${updateId}`,
    );
    if (!occurrence) return false;
    return ledger.deliveries.some(
        (delivery) =>
            delivery.cognitionId === occurrence.cognitionId &&
            delivery.attempts.some((attempt) => attempt.outcome === "confirmed"),
    );
}

async function readOptional(path: string) {
    try {
        return await readFile(path, "utf8");
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
        throw error;
    }
}

async function writeSecretSafe(path: string, value: string, mode: number) {
    await replaceFileDurably(path, value, {
        mode,
        durabilityUncertainMessage: `durability is uncertain for ${dirname(path)}`,
    });
}

async function runCommand(file: string, args: string[]) {
    return await new Promise<{ code: number | null; signal: string | null }>((resolveResult, reject) => {
        const child = spawn(file, args, { stdio: "ignore", shell: false });
        child.once("error", reject);
        child.once("close", (code, signal) => resolveResult({ code, signal }));
    });
}

async function maskedSecretPrompt(prompt: string): Promise<string | null> {
    const input = new ReadStream(openSync("/dev/tty", "r"));
    const output = new WriteStream(openSync("/dev/tty", "w"));
    output.write(prompt);
    input.setRawMode(true);
    let value = "";
    try {
        for await (const chunk of input) {
            for (const byte of Buffer.from(chunk as Buffer)) {
                if (byte === 3) return null;
                if (byte === 10 || byte === 13) {
                    output.write("\n");
                    return value;
                }
                if (byte === 127) value = value.slice(0, -1);
                else if (byte >= 32) value += String.fromCharCode(byte);
            }
        }
        return null;
    } finally {
        input.setRawMode(false);
        input.destroy();
        output.end();
    }
}

async function trustedConfirm(prompt: string) {
    const input = new ReadStream(openSync("/dev/tty", "r"));
    const output = new WriteStream(openSync("/dev/tty", "w"));
    const lines = createInterface({ input, output });
    try {
        return (await lines.question(`${prompt} [y/N] `)).trim().toLowerCase() === "y";
    } finally {
        lines.close();
        input.destroy();
        output.end();
    }
}

function safeError(error: unknown) {
    return error instanceof ValidationError
        ? error.message
        : "a trusted-host operation failed; inspect local service state";
}
