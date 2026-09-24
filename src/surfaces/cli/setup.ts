import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { BootstrapEvent } from "../../app/bootstrap.ts";
import type { SetupCompositionOverrides } from "../../composition/setup.ts";
import type { CliIo, ConfiguredRunArgs, DefaultRunArgs, SetupArgs } from "./model.ts";

import { bootstrapContinuity, prepareConfiguredRun } from "../../app/bootstrap.ts";
import { composeCliSurface } from "../../composition/cli.ts";
import { composeSetupDependencies } from "../../composition/setup.ts";
import { ValidationError } from "../../core/errors.ts";
import { defaultSetupConfigPath, loadSetupConfig } from "../../host/setup.ts";
import { runCliSurface } from "./surface.ts";

export async function setupMain(args: SetupArgs, io: CliIo, dependencies: SetupCompositionOverrides = {}) {
    if (args.help) {
        io.output.write(SETUP_HELP);
        return 0;
    }
    const result = await bootstrapForCli(args, io, dependencies);
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

async function bootstrapForCli(
    args: SetupArgs | Omit<SetupArgs, "command" | "help">,
    io: CliIo,
    overrides: SetupCompositionOverrides = {},
) {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    overrides.signal?.addEventListener("abort", cancel, { once: true });
    if (overrides.signal?.aborted) cancel();
    try {
        return await bootstrapContinuity(
            args,
            composeSetupDependencies((event) => presentBootstrapEvent(event, io), {
                ...overrides,
                signal: controller.signal,
            }),
        );
    } finally {
        process.off("SIGINT", cancel);
        process.off("SIGTERM", cancel);
        overrides.signal?.removeEventListener("abort", cancel);
    }
}

function presentBootstrapEvent(event: BootstrapEvent, io: CliIo): void {
    switch (event.kind) {
        case "inspection":
            io.output.write(
                `Machine configuration: ${event.configured ? "present" : "absent"}; continuity: ${event.continuity ? "loadable" : "absent"}.\n`,
            );
            if (event.verification !== undefined)
                io.output.write(
                    `Last probe: ${event.verification}; continuity operation: ${event.operation}. This inspection does not reverify cognition.\n`,
                );
            break;
        case "cancelled_before_cognition":
            io.output.write("Setup cancelled before cognition; continuity unchanged.\n");
            break;
        case "verifying":
            io.output.write("Verifying cognition. Authentication remains owned by the selected provider runtime.\n");
            break;
        case "verification_failed":
            io.error.write(
                `Cognition verification ${event.outcome}; setup is not ready. Check provider-owned authentication and retry setup. Raw provider diagnostics are not retained.\n`,
            );
            break;
        case "cancelled_after_probe":
            io.output.write(
                "Cancellation requested; cognition returned successfully, continuity activation was not attempted.\n",
            );
            break;
        case "cancelled_before_activation":
            io.output.write("Setup cancelled before continuity activation; continuity unchanged.\n");
            break;
        case "activation_failed":
            io.error.write(
                "Continuity activation did not complete; inspect the state and setup record before retrying. Existing state was not reset.\n",
            );
            break;
        case "ready":
            io.output.write(
                "Cognition verified; continuity available. Ready for ordinary conversation and progressive onboarding.\n",
            );
            break;
        case "cancelled_after_activation":
            io.output.write("Cancellation requested after activation; committed continuity remains available.\n");
            break;
    }
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
    const config = await prepareConfiguredRun(
        args,
        composeSetupDependencies(() => {}),
    );
    const services = composeCliSurface({
        statePath: config.statePath,
        ...(config.expectedContinuityBinding === undefined
            ? {}
            : { expectedContinuityBinding: config.expectedContinuityBinding }),
        provider: {
            kind: config.providerKind,
            command: config.providerCommand,
            arguments: config.providerArgs,
            timeoutSeconds: config.providerTimeoutSeconds,
            ...(config.providerModel === undefined ? {} : { model: config.providerModel }),
        },
        ...(config.googleCalendarConfigPath === undefined
            ? {}
            : { googleCalendarConfigPath: config.googleCalendarConfigPath }),
    });
    return await runCliSurface(
        {
            principal: config.principal,
            scope: config.scope,
            ...(config.expectedContinuityBinding === undefined
                ? {}
                : { expectedContinuityBinding: config.expectedContinuityBinding }),
            ...(lines === undefined ? {} : { lines }),
            trustedHostSetup: async (request) => {
                if (
                    request.intent !== "telegram" ||
                    request.principal !== config.principal ||
                    request.scope !== config.scope ||
                    !request.proposalOccurrenceId ||
                    request.confirmedBy.principal !== config.principal ||
                    request.confirmedBy.provenance !== "explicit_local_prompt" ||
                    request.confirmedBy.response !== "yes"
                )
                    throw new ValidationError("Telegram setup requires attributable local confirmation");
                const { runTelegramSetup } = await import("../telegram/setup.ts");
                const { telegramResidentHost } = await import("../../host/telegram-resident-host.ts");
                const setup = await loadSetupConfig(args.mode === "default" ? defaultSetupConfigPath() : args.config);
                if (!setup) throw new ValidationError("setup configuration is unavailable");
                let residentHost;
                try {
                    residentHost = await telegramResidentHost();
                } catch (error) {
                    if (error instanceof ValidationError) return { status: "unsupported_host" };
                    throw error;
                }
                return await runTelegramSetup({ setup, scope: config.scope }, io, {
                    residentHost,
                });
            },
        },
        io,
        services,
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
        const result = await bootstrapForCli(
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
