#!/usr/bin/env node
import {
    createTelegramApi,
    deleteTelegramWebhook,
    loadTelegramSurfaceConfig,
    readTelegramBotToken,
    runTelegramPolling,
    telegramResidentLaunch,
    verifyTelegramLongPollingReady,
} from "../src/apps/telegram/index.ts";
import { composeTelegramSurface } from "../src/core/composition/telegram.ts";
import { ValidationError } from "../src/core/errors.ts";

interface TelegramCliArgs {
    command:
        | "serve"
        | "check"
        | "delete-webhook"
        | "render-unit"
        | "service-install"
        | "service-uninstall"
        | "service-start"
        | "service-stop"
        | "service-status";
    config: string;
}

async function main(argv = process.argv.slice(2)): Promise<number> {
    try {
        const args = parseArgs(argv);
        const config = await loadTelegramSurfaceConfig(args.config);
        if (args.command === "render-unit" || args.command.startsWith("service-")) {
            const { telegramResidentHost } = await import("../src/core/host/telegram-resident-host.ts");
            const host = await telegramResidentHost();
            if (args.command === "render-unit") {
                process.stdout.write(host.render(telegramResidentLaunch(config, args.config)));
                return 0;
            }
            if (args.command === "service-status") {
                process.stdout.write(`${JSON.stringify(await host.inspect())}\n`);
                return 0;
            }
            if (args.command === "service-install") {
                const { active } = await host.inspect();
                if (active === "unknown") throw new ValidationError("resident service activity is unknown");
                if (active === "yes" && (await host.stop()) !== "confirmed")
                    throw new ValidationError("resident service could not be stopped before installation");
                await host.install(host.render(telegramResidentLaunch(config, args.config)));
                const activated = await host.activate(active === "yes");
                process.stdout.write(`${activated}\n`);
                return activated === "confirmed" ? 0 : 2;
            }
            const result =
                args.command === "service-uninstall"
                    ? await host.uninstall()
                    : args.command === "service-start"
                      ? await host.start()
                      : await host.stop();
            process.stdout.write(`${result}\n`);
            return result === "confirmed" ? 0 : 2;
        }

        const token = await readTelegramBotToken(config.token_file);
        const api = createTelegramApi(token);
        if (args.command === "check") {
            const { bot, webhook } = await verifyTelegramLongPollingReady(api);
            process.stdout.write(
                `Telegram bot ${bot.username ? `@${bot.username}` : bot.id} is ready for long polling; pending updates ${webhook.pending_update_count}\n`,
            );
            return 0;
        }
        if (args.command === "delete-webhook") {
            await deleteTelegramWebhook(api);
            process.stdout.write("Telegram webhook removed without dropping pending updates\n");
            return 0;
        }

        process.chdir(config.working_directory);
        const services = composeTelegramSurface(config);
        const controller = new AbortController();
        const stop = () => controller.abort();
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
        try {
            process.stdout.write("Telegram surface starting\n");
            await runTelegramPolling(config, api, {
                ...services,
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

function parseArgs(argv: string[]): TelegramCliArgs {
    const command = argv[0];
    if (
        ![
            "serve",
            "check",
            "delete-webhook",
            "render-unit",
            "service-install",
            "service-uninstall",
            "service-start",
            "service-stop",
            "service-status",
        ].includes(command ?? "")
    )
        throw new ValidationError("unsupported Telegram command");
    if (argv.length !== 3 || argv[1] !== "--config" || !argv[2])
        throw new ValidationError(`expected ${command} --config /ABSOLUTE/PATH/telegram.json`);
    return { command: command as TelegramCliArgs["command"], config: argv[2] };
}

process.exitCode = await main();
