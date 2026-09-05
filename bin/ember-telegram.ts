#!/usr/bin/env node
import { ValidationError } from "../src/core/errors.ts";
import {
    TelegramBotApi,
    loadTelegramSurfaceConfig,
    readTelegramBotToken,
    renderTelegramSurfaceUnit,
    runTelegramPolling,
} from "../src/surfaces/telegram.ts";

interface TelegramCliArgs {
    command: "serve" | "check" | "delete-webhook" | "render-unit";
    config: string;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
    try {
        const args = parseArgs(argv);
        const config = await loadTelegramSurfaceConfig(args.config);
        if (args.command === "render-unit") {
            process.stdout.write(renderTelegramSurfaceUnit(config, args.config));
            return 0;
        }

        const token = await readTelegramBotToken(config.token_file);
        const api = new TelegramBotApi(token);
        if (args.command === "check") {
            const { bot, webhook } = await api.verifyLongPollingReady();
            process.stdout.write(
                `Telegram bot ${bot.username ? `@${bot.username}` : bot.id} is ready for long polling; pending updates ${webhook.pending_update_count}\n`,
            );
            return 0;
        }
        if (args.command === "delete-webhook") {
            await api.deleteWebhook();
            process.stdout.write("Telegram webhook removed without dropping pending updates\n");
            return 0;
        }

        process.chdir(config.working_directory);
        const controller = new AbortController();
        const stop = () => controller.abort();
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        try {
            const { bot } = await api.verifyLongPollingReady(controller.signal);
            process.stdout.write(`Telegram surface started for ${bot.username ? `@${bot.username}` : bot.id}\n`);
            await runTelegramPolling(config, api, {
                signal: controller.signal,
                onOutcome: (outcome) => {
                    if (outcome.kind !== "ignored" && outcome.providerFailure)
                        process.stderr.write(`telegram provider: ${outcome.providerFailure}\n`);
                },
            });
            process.stdout.write("Telegram surface stopped\n");
            return 0;
        } finally {
            process.off("SIGINT", stop);
            process.off("SIGTERM", stop);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`ember-telegram: ${message}\n`);
        return 2;
    }
}

export function parseArgs(argv: string[]): TelegramCliArgs {
    const command = argv[0];
    if (!["serve", "check", "delete-webhook", "render-unit"].includes(command ?? ""))
        throw new ValidationError("expected serve, check, delete-webhook, or render-unit command");
    if (argv.length !== 3 || argv[1] !== "--config" || !argv[2])
        throw new ValidationError(`expected ${command} --config /ABSOLUTE/PATH/telegram.json`);
    return { command: command as TelegramCliArgs["command"], config: argv[2] };
}

if (import.meta.main) process.exitCode = await main();
