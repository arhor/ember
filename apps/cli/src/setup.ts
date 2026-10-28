import type { BootstrapEvent } from "@ember/application/app/bootstrap.ts";
import type { SetupCompositionOverrides } from "@ember/composition/setup.ts";

import { bootstrapContinuity, prepareConfiguredRun } from "@ember/application/app/bootstrap.ts";
import { composeCliSurface } from "@ember/composition/cli.ts";
import { composeSetupDependencies } from "@ember/composition/setup.ts";
import { EmberError, ValidationError } from "@ember/domain/errors.ts";
import { createSetupDiagnostics } from "@ember/host/setup-diagnostics.ts";
import { defaultSetupConfigPath, loadSetupConfig } from "@ember/host/setup.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";
import { CommanderError } from "commander";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

import type { CliMainOverrides } from "./main.ts";
import type { CliIo, ShellOptions, SetupArgs } from "./model.ts";

import { splitCommand } from "./commands.ts";
import { loadConfiguredState } from "./commands.ts";
import { setupGoogleCalendarMain } from "./google-calendar-setup.ts";
import { executeLocalCommand } from "./local-commands.ts";
import { createLocalProgram } from "./local-program.ts";
import { createSessionProgram } from "./session-program.ts";
import { setupHelpText } from "./setup-help.ts";
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
                : `Select: /use --config '${configPath.replaceAll("'", "'\\''")}' --scope '${scope.replaceAll("'", "'\\''")}'\n`,
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

export async function setupRunMain(args: ShellOptions, io: CliIo, overrides: CliMainOverrides = {}): Promise<number> {
    const lines = createInterface({ input: io.input, crlfDelay: Infinity, terminal: false });
    const iterator = lines[Symbol.asyncIterator]();
    const boundary = { fresh: true };
    let selection: { mode: "configured"; config: string; scope: string } | { mode: "default" } = { mode: "default" };
    let selectedPath = defaultSetupConfigPath();
    let pending: string | undefined;
    const localNames = createLocalProgram(io, [], async () => 0).commands.map((command) => command.name());
    const sessionNames = createSessionProgram(io, async () => {}).commands.map((command) => command.name());
    const isLocal = (line: string) => {
        if (!/^[/:]/.test(line)) return false;
        try {
            const argv = splitCommand(line.slice(1));
            return (
                !sessionNames.includes(argv[0]!) ||
                argv.some((token) => ["--help", "-h"].includes(token)) ||
                ["quit", "new-conversation"].includes(argv[0]!)
            );
        } catch {
            return true;
        }
    };
    try {
        while (true) {
            const next = pending === undefined ? await iterator.next() : { done: false, value: pending };
            pending = undefined;
            if (next.done) return 0;
            const line = next.value!;
            if (!line.trim()) continue;
            try {
                if (/^[/:]/.test(line)) {
                    const argv = splitCommand(line.slice(1));
                    if (argv.length === 1 && argv[0] === "quit") return 0;
                    if (argv.length === 1 && argv[0] === "new-conversation") {
                        boundary.fresh = true;
                        continue;
                    }
                    if (argv.length === 1 && ["help", "--help", "-h"].includes(argv[0]!)) {
                        createLocalProgram(io, [], async () => 0).outputHelp();
                        createSessionProgram(io, async () => {}).outputHelp();
                        continue;
                    }
                    if (argv[0] === "setup" && argv[1] === "google-calendar")
                        argv.splice(0, 2, "setup-google-calendar");
                    if (localNames.includes(argv[0]!)) {
                        if (argv.length === 1 && argv[0] === "setup" && !(await loadSetupConfig(selectedPath))) {
                            await interactiveSetup(
                                io,
                                args.diagnostics === true,
                                iterator,
                                selectedPath,
                                overrides.setupDependencies,
                            );
                            continue;
                        }
                        const program = createLocalProgram(io, argv, async (command) => {
                            if (command.command === "use") {
                                const config = await loadSetupConfig(resolve(command.config));
                                if (!config) throw new ValidationError("setup configuration is unavailable");
                                const candidate = {
                                    mode: "configured" as const,
                                    config: resolve(command.config),
                                    scope: command.scope ?? `relationship:${config.principal}`,
                                };
                                const prepared = await prepareConfiguredRun(
                                    candidate,
                                    composeSetupDependencies(() => {}),
                                );
                                const store = new StateStore(prepared.statePath);
                                const lease = await store.acquireWriteLease();
                                try {
                                    await loadConfiguredState(store, prepared);
                                } finally {
                                    await store.releaseWriteLease(lease);
                                }
                                selection = candidate;
                                selectedPath = candidate.config;
                                boundary.fresh = true;
                                io.output.write(`Selected ${selectedPath}; scope ${candidate.scope}\n`);
                                return 0;
                            }
                            if (command.command === "setup") {
                                command.config ??= selectedPath;
                                command.diagnostics ||= args.diagnostics === true;
                                return await setupMain(command, io, overrides.setupDependencies);
                            }
                            if (command.command === "setup-google-calendar")
                                return await setupGoogleCalendarMain(command, io);
                            return await executeLocalCommand(command, io);
                        });
                        await program.parseAsync(argv, { from: "user" });
                        continue;
                    }
                    // Command help is local even when runtime configuration is broken.
                    if (!sessionNames.includes(argv[0]!) || argv.includes("--help") || argv.includes("-h")) {
                        await createSessionProgram(io, async () => {}).parseAsync(argv, { from: "user" });
                        continue;
                    }
                }
                const config = await loadSetupConfig(selectedPath);
                if (!config || config.verification !== "verified" || config.continuity !== "available") {
                    io.error.write("Run /setup before sending a message, then resend your message.\n");
                    continue;
                }
                async function* conversationLines() {
                    yield line;
                    while (true) {
                        const item = await iterator.next();
                        if (item.done) return;
                        if (isLocal(item.value)) {
                            pending = item.value;
                            return;
                        }
                        yield item.value;
                    }
                }
                await runConfigured(selection, io, conversationLines(), boundary);
                if (pending === undefined) return 0;
            } catch (error) {
                if (error instanceof CommanderError) {
                    if (error.exitCode !== 0) io.error.write(`command rejected: ${error.message}\n`);
                } else if (
                    error instanceof Error &&
                    (error instanceof EmberError ||
                        error instanceof SyntaxError ||
                        ("code" in error && /^E[A-Z0-9]+$/.test(String(error.code))))
                )
                    io.error.write(`command rejected: ${error.message}\n`);
                else throw error;
            }
        }
    } finally {
        lines.close();
    }
}

async function runConfigured(
    args: { mode: "configured"; config: string; scope: string } | { mode: "default" },
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

async function interactiveSetup(
    io: CliIo,
    diagnostics: boolean,
    iterator: AsyncIterator<string>,
    configPath: string,
    overrides: SetupCompositionOverrides = {},
): Promise<number> {
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
            config: configPath,
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
        overrides,
    );
    return result;
}

export { setupHelpText } from "./setup-help.ts";
