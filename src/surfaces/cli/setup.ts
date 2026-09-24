import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { CliIo, ConfiguredRunArgs, DefaultRunArgs, SetupArgs } from "./model.ts";

import {
    defaultSetupConfigPath,
    loadSetupConfig,
    prepareConfiguredRun,
    setupMain as bootstrap,
} from "../../app/bootstrap.ts";
import { ValidationError } from "../../core/errors.ts";
import { runCliSurface } from "./surface.ts";

export { loadSetupConfig } from "../../app/bootstrap.ts";
export type { SetupConfig } from "../../app/bootstrap.ts";

export async function setupMain(args: SetupArgs, io: CliIo, dependencies?: Parameters<typeof bootstrap>[2]) {
    if (args.help) {
        io.output.write(SETUP_HELP);
        return 0;
    }
    const result = await bootstrap(args, io, dependencies);
    if (!args.intent) io.output.write(SETUP_HELP);
    if (result === 0 && args.intent) {
        const configPath = resolve(args.config ?? defaultSetupConfigPath());
        const config = await loadSetupConfig(configPath);
        if (!config) throw new ValidationError("setup configuration is unavailable after activation");
        const scope = `relationship:${config.principal}`;
        io.output.write(
            args.config === undefined
                ? "Run: ember\n"
                : `Run: ember run --config '${configPath.replaceAll("'", "'\\''")}' --scope '${scope.replaceAll("'", "'\\''")}'\n`,
        );
    }
    return result;
}

export async function setupRunMain(args: ConfiguredRunArgs | DefaultRunArgs, io: CliIo): Promise<number> {
    if (args.mode === "default" && !(await loadSetupConfig(defaultSetupConfigPath()))) {
        return await firstRun(io);
    }
    return await runConfigured(args, io);
}

async function runConfigured(
    args: ConfiguredRunArgs | DefaultRunArgs,
    io: CliIo,
    lines?: AsyncIterable<string>,
): Promise<number> {
    const config = await prepareConfiguredRun(args);
    return await runCliSurface(
        {
            ...config,
            ...(lines === undefined ? {} : { lines }),
            configuredSetupHandoff: async () => {
                const { runTelegramSetup } = await import("../telegram/setup.ts");
                const { telegramResidentHost } = await import("../../host/telegram-resident-host.ts");
                const setup = await loadSetupConfig(args.mode === "default" ? defaultSetupConfigPath() : args.config);
                if (!setup) throw new ValidationError("setup configuration is unavailable");
                return await runTelegramSetup({ setup, scope: config.scope }, io, {
                    residentHost: await telegramResidentHost(),
                });
            },
        },
        io,
    );
}

async function firstRun(io: CliIo): Promise<number> {
    const lines = createInterface({ input: io.input, crlfDelay: Infinity, terminal: false });
    const iterator = lines[Symbol.asyncIterator]();
    const ask = async (prompt: string): Promise<string> => {
        io.output.write(prompt);
        const answer = await iterator.next();
        if (answer.done)
            throw new ValidationError("first-run setup needs an explicit choice; run ember again to continue");
        return answer.value.trim();
    };
    try {
        io.output.write("Ember needs a continuity and a working cognition provider before conversation.\n");
        const choice = await ask("Create a new Ember or restore existing continuity? [create/restore]: ");
        if (choice !== "create" && choice !== "restore")
            throw new ValidationError("choose create or restore; no continuity was created");
        const state = choice === "restore" ? await ask("Absolute path to existing continuity state: ") : undefined;
        if (choice === "restore" && !state) throw new ValidationError("restore requires an existing state path");
        const principal = choice === "create" ? await ask("Local principal identifier: ") : undefined;
        if (choice === "create" && !principal) throw new ValidationError("create requires a principal identifier");
        const provider = await ask("Cognition provider [codex/cursor/claude-code]: ");
        if (provider !== "codex" && provider !== "cursor" && provider !== "claude-code")
            throw new ValidationError("select codex, cursor, or claude-code");
        const providerCommand =
            provider === "claude-code"
                ? undefined
                : (await ask("Provider executable (blank for installed default): ")) || undefined;
        const acceptContinuityRisk =
            choice === "restore"
                ? (await ask("Continue this existing lineage despite possible stale or forked copies? [yes/no]: ")) ===
                  "yes"
                : false;
        if (choice === "restore" && !acceptContinuityRisk)
            throw new ValidationError("restore requires explicit acknowledgement of continuity uncertainty");
        const result = await bootstrap(
            {
                config: undefined,
                state,
                principal,
                intent: choice === "create" ? "create-new" : "restore-existing",
                provider,
                providerCommand,
                model: undefined,
                providerTimeoutSeconds: undefined,
                acceptContinuityRisk,
                confirmProviderChange: false,
            },
            io,
        );
        if (result !== 0) return result;
        io.output.write("Machine setup is ready. Say hello to begin ordinary conversation.\n");
        return await runConfigured({ command: "run", mode: "default" }, io, {
            [Symbol.asyncIterator]: () => iterator,
        });
    } finally {
        lines.close();
    }
}

const SETUP_HELP = `ember setup [--config PATH] [--state PATH]
Defaults: ~/.ember/config/setup.json and ~/.ember/state/continuity.json.
Config and state path overrides are independent; an existing config retains its state binding.
Inspect first, then choose explicitly:
  --intent create-new --principal USER --provider codex|cursor|claude-code
  --intent restore-existing --state PATH --accept-continuity-risk --provider PROVIDER
  --intent use-existing [--state PATH] [--provider PROVIDER]
Restore attaches a local store and its sidecars; fork, snapshot age, and missing-history risks remain unresolved.
Options: --model MODEL, --provider-command EXECUTABLE (Codex/Cursor only),
  --provider-timeout-seconds SECONDS (default 60, maximum 120), --confirm-provider-change.
Provider credentials stay in provider-owned login stores; never pass secrets as options.
Rerun with the same intent or use-existing to reverify; existing continuity is never overwritten.
Use a separate config and state path to create another lineage. Ctrl-C requests cancellation.
`;
