import type { BootstrapEvent } from "@ember/application/app/bootstrap.ts";
import type { SetupCompositionOverrides } from "@ember/composition/setup.ts";

import { bootstrapContinuity, prepareConfiguredRun } from "@ember/application/app/bootstrap.ts";
import { composeCliSurface } from "@ember/composition/cli.ts";
import { composeSetupDependencies } from "@ember/composition/setup.ts";
import { EmberError, ValidationError } from "@ember/domain/errors.ts";
import { createSetupDiagnostics } from "@ember/host/setup-diagnostics.ts";
import { defaultSetupConfigPath, loadSetupConfig } from "@ember/host/setup.ts";
import { CommanderError } from "commander";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { CliIo, ConfiguredRunArgs, DefaultRunArgs, SetupArgs } from "./model.ts";

import { splitCommand } from "./commands.ts";
import { setupGoogleCalendarMain } from "./google-calendar-setup.ts";
import { createProcessProgram } from "./process-program.ts";
import { runCliSurface } from "./surface.ts";

export async function setupMain(args: SetupArgs, io: CliIo, dependencies: SetupCompositionOverrides = {}) {
    const result = await bootstrapForCli(args, io, dependencies);
    if (!args.intent) io.output.write(setupHelpText);
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
    args: SetupArgs | Omit<SetupArgs, "command">,
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
        const diagnostics = args.diagnostics
            ? await createSetupDiagnostics().catch((error) => {
                  io.error.write(
                      `Diagnostics could not be enabled: ${error instanceof Error ? error.constructor.name : "host failure"}. Continuing without a diagnostic log.\n`,
                  );
                  return undefined;
              })
            : undefined;
        let diagnosticWrites = Promise.resolve();
        const recordDiagnostic = (event: BootstrapEvent) => {
            if (!diagnostics || !("diagnostic" in event) || event.diagnostic === undefined) return;
            diagnosticWrites = diagnosticWrites.then(() => diagnostics.record(event.diagnostic!));
        };
        const result = await bootstrapContinuity(
            args,
            composeSetupDependencies(
                (event) => {
                    recordDiagnostic(event);
                    presentBootstrapEvent(event, io, diagnostics?.path);
                },
                {
                    ...overrides,
                    signal: controller.signal,
                },
            ),
        );
        await diagnosticWrites.catch(() => {
            io.error.write("Diagnostics could not be written; no provider payload was retained.\n");
        });
        if (result === 0 && diagnostics) await diagnostics.discard().catch(() => {});
        return result;
    } finally {
        process.off("SIGINT", cancel);
        process.off("SIGTERM", cancel);
        overrides.signal?.removeEventListener("abort", cancel);
    }
}

function presentBootstrapEvent(event: BootstrapEvent, io: CliIo, diagnosticsPath?: string): void {
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
                `Cognition verification ${event.outcome}; setup is not ready. Check provider-owned authentication and retry setup.${diagnosticsPath === undefined ? " Raw provider diagnostics are not retained." : ` Redacted diagnostics: ${diagnosticsPath}`}\n`,
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
            io.output.write("Cognition verified; continuity available. Ready for ordinary conversation.\n");
            break;
        case "cancelled_after_activation":
            io.output.write("Cancellation requested after activation; committed continuity remains available.\n");
            break;
    }
}

export async function setupRunMain(args: ConfiguredRunArgs | DefaultRunArgs, io: CliIo): Promise<number> {
    if (args.mode !== "default") return await runConfigured(args, io);
    const lines = createInterface({ input: io.input, crlfDelay: Infinity, terminal: false });
    const iterator = lines[Symbol.asyncIterator]();
    const conversationBoundary = { fresh: true };
    try {
        while (true) {
            const next = await iterator.next();
            if (next.done) return 0;
            const line = next.value;
            if (!line.trim()) continue;
            if (line === "/quit" || line === ":quit") return 0;
            if (line === "/help" || line === ":help") {
                io.output.write(
                    "/setup [options] — configure continuity and provider\n/setup google-calendar [options] — configure Calendar\n/new-conversation — start fresh on the next message\n/quit — exit\nOther session commands are available with / or : prefixes.\n",
                );
                continue;
            }
            if (line.startsWith("/setup ") || line === "/setup") {
                try {
                    await runInteractiveSetupCommand(line, io, args.diagnostics === true, iterator);
                } catch (error) {
                    if (!(error instanceof EmberError) && !(error instanceof CommanderError)) throw error;
                    io.error.write(`setup: ${error.message}\n`);
                }
                continue;
            }
            if (line.startsWith("/") || line.startsWith(":")) {
                const name = line.slice(1).split(/\s/)[0];
                if (
                    ![
                        "remember",
                        "prefer",
                        "supersede",
                        "undertake",
                        "attach-detail",
                        "fixture-withhold",
                        "ask",
                        "show-action",
                        "approve-action",
                        "reject-action",
                        "withdraw-action",
                        "supersede-action",
                        "new-conversation",
                        "quit",
                        "--help",
                    ].includes(name!)
                ) {
                    io.error.write("Unknown command. Use /help.\n");
                    continue;
                }
                if (line === "/new-conversation" || line === ":new-conversation") {
                    conversationBoundary.fresh = true;
                    continue;
                }
            }
            try {
                const config = await loadSetupConfig(defaultSetupConfigPath());
                if (!config || config.verification !== "verified" || config.continuity !== "available") {
                    io.error.write("Run /setup before sending a message, then resend your message.\n");
                    continue;
                }
                let setupRequested = false;
                let setupLine = "/setup";
                async function* conversationLines() {
                    yield line;
                    while (true) {
                        const item = await iterator.next();
                        if (item.done) return;
                        if (item.value === "/setup" || item.value.startsWith("/setup ")) {
                            setupRequested = true;
                            setupLine = item.value;
                            return;
                        }
                        yield item.value;
                    }
                }
                const status = await runConfigured(args, io, conversationLines(), conversationBoundary);
                if (!setupRequested) return status;
                await runInteractiveSetupCommand(setupLine, io, args.diagnostics === true, iterator);
            } catch (error) {
                if (!(error instanceof EmberError) && !(error instanceof CommanderError)) throw error;
                io.error.write(`configuration: ${error.message}; run /setup to inspect configuration.\n`);
            }
        }
    } finally {
        lines.close();
    }
}

async function runInteractiveSetupCommand(
    line: string,
    io: CliIo,
    diagnostics: boolean,
    iterator: AsyncIterator<string>,
) {
    if (line === "/setup" && !(await loadSetupConfig(defaultSetupConfigPath())))
        return await interactiveSetup(io, diagnostics, iterator);
    const argv = splitCommand(line.slice(1));
    if (argv[1] === "google-calendar") argv.splice(0, 2, "setup-google-calendar");
    const program = createProcessProgram(io, argv, async (args) => {
        if (args.command === "setup") return await setupMain(args, io);
        if (args.command === "setup-google-calendar") return await setupGoogleCalendarMain(args, io);
        throw new ValidationError("expected /setup");
    });
    await program.parseAsync(argv, { from: "user" });
    return 0;
}

async function runConfigured(
    args: ConfiguredRunArgs | DefaultRunArgs,
    io: CliIo,
    lines?: AsyncIterable<string>,
    conversationBoundary = { fresh: true },
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
            ...(config.providerCommand === undefined ? {} : { command: config.providerCommand }),
            ...(config.providerKind === "ollama" || config.providerKind === "deepseek"
                ? {}
                : { arguments: config.providerArgs }),
            timeoutSeconds: config.providerTimeoutSeconds,
            ...(config.providerModel === undefined ? {} : { model: config.providerModel }),
            ...(config.providerBaseUrl === undefined ? {} : { baseUrl: config.providerBaseUrl }),
        },
        ...(config.googleCalendarConfigPath === undefined
            ? {}
            : { googleCalendarConfigPath: config.googleCalendarConfigPath }),
    });
    try {
        return await runCliSurface(
            {
                conversationBoundary,
                principal: config.principal,
                scope: config.scope,
                ...(config.expectedContinuityBinding === undefined
                    ? {}
                    : { expectedContinuityBinding: config.expectedContinuityBinding }),
                ...(lines === undefined ? {} : { lines }),
            },
            io,
            services,
        );
    } finally {
        await services.close();
    }
}

async function interactiveSetup(io: CliIo, diagnostics: boolean, iterator: AsyncIterator<string>): Promise<number> {
    const ask = async (prompt: string): Promise<string> => {
        io.output.write(prompt);
        const answer = await iterator.next();
        if (answer.done) throw new ValidationError("setup needs an explicit choice; run ember again to continue");
        const text = answer.value.trim();
        if (text === "/cancel") throw new ValidationError("setup cancelled");
        return text;
    };
    io.output.write("Ember needs a continuity and a working cognition provider before conversation.\n");
    const choice = await ask("Create a new Ember or restore existing continuity? [create/restore]: ");
    if (choice !== "create" && choice !== "restore")
        throw new ValidationError("choose create or restore; no continuity was created");
    const state = choice === "restore" ? await ask("Absolute path to existing continuity state: ") : undefined;
    if (choice === "restore" && !state) throw new ValidationError("restore requires an existing state path");
    const principal = choice === "create" ? await ask("Local principal identifier: ") : undefined;
    if (choice === "create" && !principal) throw new ValidationError("create requires a principal identifier");
    const provider = await ask("Cognition provider [codex/cursor/claude-code/ollama/deepseek]: ");
    if (
        provider !== "codex" &&
        provider !== "cursor" &&
        provider !== "claude-code" &&
        provider !== "ollama" &&
        provider !== "deepseek"
    )
        throw new ValidationError("select codex, cursor, claude-code, ollama, or deepseek");
    const providerCommand =
        provider === "claude-code" || provider === "ollama" || provider === "deepseek"
            ? undefined
            : (await ask("Provider executable (blank for installed default): ")) || undefined;
    const model =
        provider === "ollama"
            ? await ask("Ollama model name: ")
            : provider === "deepseek"
              ? await ask("DeepSeek model name: ")
              : undefined;
    if (provider === "ollama" && !model) throw new ValidationError("Ollama requires an explicit model name");
    if (provider === "deepseek" && !model) throw new ValidationError("DeepSeek requires an explicit model name");
    const providerBaseUrl =
        provider === "ollama"
            ? (await ask("Ollama base URL (blank for http://127.0.0.1:11434): ")) || undefined
            : undefined;
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
            model,
            providerBaseUrl,
            providerTimeoutSeconds: undefined,
            acceptContinuityRisk,
            confirmProviderChange: false,
            diagnostics,
        },
        io,
    );
    return result;
}

export const setupHelpText = `ember setup [--config PATH] [--state PATH]
Defaults: ~/.ember/config/setup.json and ~/.ember/state/continuity.json.
Config and state path overrides are independent; an existing config retains its state binding.
Inspect first, then choose explicitly:
  --intent create-new --principal USER --provider codex|cursor|claude-code|ollama|deepseek
  --intent restore-existing --state PATH --accept-continuity-risk --provider PROVIDER
  --intent use-existing [--state PATH] [--provider PROVIDER]
Restore attaches a local store and its sidecars; fork, snapshot age, and missing-history risks remain unresolved.
Options: --model MODEL (required for Ollama and DeepSeek), --provider-base-url LOOPBACK_URL (Ollama only),
  --provider-command EXECUTABLE (Codex/Cursor only),
  --provider-timeout-seconds SECONDS (default 60, maximum 120), --confirm-provider-change, --diagnostics.
Provider credentials stay in provider-owned login stores or DEEPSEEK_API_KEY in the environment; never pass secrets as options.
--diagnostics retains a redacted setup-probe log under ~/.ember/logs/setup/ only when verification fails.
Rerun with the same intent or use-existing to reverify; existing continuity is never overwritten.
Use a separate config and state path to create another lineage. Ctrl-C requests cancellation.
`;
