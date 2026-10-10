import { MAX_AI_TIMEOUT_SECONDS } from "@ember/core/ai/contract.ts";
import { ValidationError } from "@ember/core/errors.ts";
import { Command, InvalidArgumentError, Option } from "commander";

import type {
    ApplyMaterializedEditsArgs,
    CheckArgs,
    CliCommandArgs,
    CliIo,
    CorrectArgs,
    ExplainArgs,
    InitArgs,
    InspectArgs,
    LockStatusArgs,
    MaterializeArgs,
    QuarantineStaleLockArgs,
    RunArgs,
    SetupArgs,
    SetupGoogleCalendarArgs,
} from "./model.ts";

import { bindCommandIo } from "./command-io.ts";
import { Commands } from "./model.ts";
import { setupHelpText } from "./setup.ts";

const repeatableFlags = new Set(["--provider-arg", "--codex-arg", "--cursor-arg", "--surface", "--approval-evidence"]);

export function createProcessProgram(
    io: CliIo,
    argv: readonly string[],
    dispatch: (args: CliCommandArgs) => Promise<number>,
): Command {
    const program = bindCommandIo(new Command(), io);
    program
        .name("ember")
        .description(
            "With no subcommand, open the default interactive session. --diagnostics is accepted only by that session and by setup.",
        )
        .addHelpText("after", `\n${setupHelpText}`)
        .hook("preAction", (_thisCommand, actionCommand) => {
            assertSingularFlags(argv, actionCommand);
        });

    program
        .command(Commands.SETUP)
        .description("Inspect or activate machine setup. Run without --intent to inspect before choosing.")
        .addHelpText("after", `\n${setupHelpText}`)
        .option(
            "--config <path>",
            "Config path. Default ~/.ember/config/setup.json. Independent of --state; an existing config retains its state binding.",
            nonEmpty,
        )
        .option(
            "--state <path>",
            "State path. Default ~/.ember/state/continuity.json. Independent of --config.",
            nonEmpty,
        )
        .option("--principal <principal>", "Local principal. Required for --intent create-new.", nonEmpty)
        .addOption(
            new Option(
                "--intent <intent>",
                "create-new, restore-existing, or use-existing. Inspect first, then choose explicitly.",
            ).choices(["create-new", "restore-existing", "use-existing"]),
        )
        .addOption(
            new Option(
                "--provider <provider>",
                "codex, cursor, claude-code, ollama, or deepseek. There is no implicit provider default.",
            ).choices(["codex", "cursor", "claude-code", "ollama", "deepseek"]),
        )
        .option(
            "--provider-command <executable>",
            "Codex or Cursor executable. Claude Code, Ollama, and DeepSeek do not accept an executable override.",
            nonEmpty,
        )
        .option("--model <model>", "Model name. Required for Ollama and DeepSeek.", nonEmpty)
        .option("--provider-base-url <url>", "Ollama loopback URL only.", nonEmpty)
        .option(
            "--provider-timeout-seconds <seconds>",
            "Setup provider timeout in (0, 120] seconds. Default 60.",
            setupTimeout,
        )
        .option(
            "--accept-continuity-risk",
            "Required acknowledgement for restore-existing. Fork, snapshot age, and missing-history risks remain unresolved.",
        )
        .option("--confirm-provider-change", "Confirm a provider change for an existing setup.")
        .option(
            "--diagnostics",
            "Retain a redacted setup-probe log under ~/.ember/logs/setup/ only when verification fails.",
        )
        .action(async (options: SetupOptions) => {
            await dispatch(setupArgs(options));
        });

    program
        .command(Commands.SETUP_GOOGLE_CALENDAR)
        .description("Configure the Google Calendar read integration")
        .requiredOption("--setup-config <path>", "setup config path", nonEmpty)
        .requiredOption("--config <path>", "calendar config path", nonEmpty)
        .option("--client-id <id>", "OAuth client id", nonEmpty)
        .option("--client-secret-file <path>", "OAuth client secret file", nonEmpty)
        .option("--refresh-token-file <path>", "OAuth refresh token file", nonEmpty)
        .option("--calendar-id <id>", "calendar id", nonEmpty)
        .option("--calendar-label <label>", "calendar label", nonEmpty)
        .option("--timezone <timezone>", "calendar timezone", nonEmpty)
        .option("--scope <scope>", "calendar scope", nonEmpty)
        .option("--surface <surface>", "repeatable interaction surface", collect)
        .option("--disable", "disable the calendar integration")
        .option("--reconfigure", "reconfigure an existing calendar binding")
        .action(async (options: GoogleCalendarOptions) => {
            await dispatch(googleCalendarArgs(options));
        });

    program
        .command(Commands.INIT)
        .description("Initialize schema v1 continuity state")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--principal <principal>", "local principal", nonEmpty)
        .action(async (options: { state: string; principal: string }) => {
            await dispatch({
                command: Commands.INIT,
                state: options.state,
                principal: options.principal,
            } satisfies InitArgs);
        });

    program
        .command(Commands.RUN)
        .description("Open an explicit or configured interactive session")
        .option("--config <path>", "configured-run setup path; accepts only --config and --scope", nonEmpty)
        .option("--state <path>", "state path", nonEmpty)
        .option("--principal <principal>", "local principal", nonEmpty)
        .option("--scope <scope>", "active scope", nonEmpty)
        .addOption(new Option("--provider <provider>", "codex or cursor").choices(["codex", "cursor"]))
        .option("--provider-command <executable>", "process provider executable", nonEmpty)
        .option("--provider-arg <arg>", "repeatable process provider argument", collect)
        .option("--codex-command <executable>", "Codex executable", nonEmpty)
        .option("--codex-arg <arg>", "repeatable Codex argument", collect)
        .option("--cursor-command <executable>", "Cursor executable", nonEmpty)
        .option("--cursor-arg <arg>", "repeatable Cursor argument", collect)
        .option("--provider-timeout-seconds <seconds>", "provider timeout seconds", nonEmpty)
        .action(async (options: RunOptions) => {
            await dispatch(runArgs(options));
        });

    program
        .command(Commands.INSPECT)
        .description("Inspect continuity state")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--principal <principal>", "local principal", nonEmpty)
        .option("--json", "render inspection as JSON")
        .action(async (options: { state: string; principal: string; json?: boolean }) => {
            await dispatch({
                command: Commands.INSPECT,
                state: options.state,
                principal: options.principal,
                json: options.json === true,
            } satisfies InspectArgs);
        });

    program
        .command(Commands.MATERIALIZE)
        .description("Publish Markdown state views")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--principal <principal>", "local principal", nonEmpty)
        .requiredOption("--scope <scope>", "active scope", nonEmpty)
        .requiredOption("--output <path>", "output directory", nonEmpty)
        .action(async (options: { state: string; principal: string; scope: string; output: string }) => {
            await dispatch({ command: Commands.MATERIALIZE, ...options } satisfies MaterializeArgs);
        });

    program
        .command(Commands.APPLY_MATERIALIZED_EDITS)
        .description("Apply inspected Markdown edits with approval evidence")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--principal <principal>", "local principal", nonEmpty)
        .requiredOption("--scope <scope>", "active scope", nonEmpty)
        .requiredOption("--input <path>", "edited Markdown directory", nonEmpty)
        .option("--approval-evidence <id>", "repeatable approval evidence id, one per edit", collect)
        .action(async (options: ApplyOptions) => {
            await dispatch({
                command: Commands.APPLY_MATERIALIZED_EDITS,
                state: options.state,
                principal: options.principal,
                scope: options.scope,
                input: options.input,
                approvalEvidenceIds: options.approvalEvidence ?? [],
            } satisfies ApplyMaterializedEditsArgs);
        });

    program
        .command(Commands.EXPLAIN)
        .description("Explain one meaning")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--principal <principal>", "local principal", nonEmpty)
        .argument("<meaning-id>", "meaning id")
        .action(async (meaningId: string, options: { state: string; principal: string }) => {
            await dispatch({ command: Commands.EXPLAIN, meaningId, ...options } satisfies ExplainArgs);
        });

    program
        .command(Commands.CORRECT)
        .description("Supersede a fact or preference with corrective evidence")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--principal <principal>", "local principal", nonEmpty)
        .requiredOption("--text <text>", "replacement text", nonEmpty)
        .requiredOption("--reason <reason>", "correction reason", nonEmpty)
        .argument("<meaning-id>", "meaning id")
        .action(
            async (meaningId: string, options: { state: string; principal: string; text: string; reason: string }) => {
                await dispatch({ command: Commands.CORRECT, meaningId, ...options } satisfies CorrectArgs);
            },
        );

    program
        .command(Commands.CHECK)
        .description("Validate canonical state and report lock metadata")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .action(async (options: { state: string }) => {
            await dispatch({ command: Commands.CHECK, state: options.state } satisfies CheckArgs);
        });

    program
        .command(Commands.LOCK_STATUS)
        .description("Report cooperative lock status")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .action(async (options: { state: string }) => {
            await dispatch({ command: Commands.LOCK_STATUS, state: options.state } satisfies LockStatusArgs);
        });

    program
        .command(Commands.QUARANTINE_STALE_LOCK)
        .description("Quarantine a stale cooperative lock after an explicit quiescence assertion")
        .requiredOption("--state <path>", "state path", nonEmpty)
        .requiredOption("--owner-token <token>", "lock owner token", nonEmpty)
        .option("--confirm-quiescent", "assert that the previous owner is quiescent")
        .action(async (options: { state: string; ownerToken: string; confirmQuiescent?: boolean }) => {
            await dispatch({
                command: Commands.QUARANTINE_STALE_LOCK,
                state: options.state,
                ownerToken: options.ownerToken,
                confirmQuiescent: options.confirmQuiescent === true,
            } satisfies QuarantineStaleLockArgs);
        });

    return program;
}

interface SetupOptions {
    config?: string;
    state?: string;
    principal?: string;
    intent?: SetupArgs["intent"];
    provider?: SetupArgs["provider"];
    providerCommand?: string;
    model?: string;
    providerBaseUrl?: string;
    providerTimeoutSeconds?: number;
    acceptContinuityRisk?: boolean;
    confirmProviderChange?: boolean;
    diagnostics?: boolean;
}

interface GoogleCalendarOptions {
    setupConfig: string;
    config: string;
    clientId?: string;
    clientSecretFile?: string;
    refreshTokenFile?: string;
    calendarId?: string;
    calendarLabel?: string;
    timezone?: string;
    scope?: string;
    surface?: string[];
    disable?: boolean;
    reconfigure?: boolean;
}

interface RunOptions {
    config?: string;
    state?: string;
    principal?: string;
    scope?: string;
    provider?: "codex" | "cursor";
    providerCommand?: string;
    providerArg?: string[];
    codexCommand?: string;
    codexArg?: string[];
    cursorCommand?: string;
    cursorArg?: string[];
    providerTimeoutSeconds?: string;
}

interface ApplyOptions {
    state: string;
    principal: string;
    scope: string;
    input: string;
    approvalEvidence?: string[];
}

function setupArgs(options: SetupOptions): SetupArgs {
    return {
        command: Commands.SETUP,
        config: options.config,
        state: options.state,
        principal: options.principal,
        intent: options.intent,
        provider: options.provider,
        providerCommand: options.providerCommand,
        model: options.model,
        providerBaseUrl: options.providerBaseUrl,
        providerTimeoutSeconds: options.providerTimeoutSeconds,
        acceptContinuityRisk: options.acceptContinuityRisk === true,
        confirmProviderChange: options.confirmProviderChange === true,
        diagnostics: options.diagnostics === true,
    };
}

function googleCalendarArgs(options: GoogleCalendarOptions): SetupGoogleCalendarArgs {
    return {
        command: Commands.SETUP_GOOGLE_CALENDAR,
        setupConfig: options.setupConfig,
        config: options.config,
        clientId: options.clientId,
        clientSecretFile: options.clientSecretFile,
        refreshTokenFile: options.refreshTokenFile,
        calendarId: options.calendarId,
        calendarLabel: options.calendarLabel,
        timezone: options.timezone,
        scope: options.scope,
        surfaces: options.surface ?? [],
        disable: options.disable === true,
        reconfigure: options.reconfigure === true,
    };
}

function runArgs(options: RunOptions): RunArgs {
    if (options.config !== undefined) {
        if (
            present(options.state) ||
            present(options.principal) ||
            present(options.provider) ||
            present(options.providerCommand) ||
            present(options.providerArg) ||
            present(options.codexCommand) ||
            present(options.codexArg) ||
            present(options.cursorCommand) ||
            present(options.cursorArg) ||
            present(options.providerTimeoutSeconds)
        )
            throw new ValidationError("configured run accepts only --config PATH and --scope SCOPE");
        return {
            command: Commands.RUN,
            mode: "configured",
            config: options.config,
            scope: required(options.scope, "--scope"),
        };
    }
    const timeout = Number(required(options.providerTimeoutSeconds, "--provider-timeout-seconds"));
    if (!Number.isFinite(timeout) || timeout <= 0)
        throw new ValidationError("--provider-timeout-seconds must be a positive finite number");
    if (timeout > MAX_AI_TIMEOUT_SECONDS)
        throw new ValidationError(`--provider-timeout-seconds must not exceed ${MAX_AI_TIMEOUT_SECONDS}`);
    const state = required(options.state, "--state");
    const principal = required(options.principal, "--principal");
    const scope = required(options.scope, "--scope");
    if (options.provider === "codex") {
        if (
            present(options.providerCommand) ||
            present(options.providerArg) ||
            present(options.cursorCommand) ||
            present(options.cursorArg)
        )
            throw new ValidationError("process and Cursor options cannot be combined with --provider codex");
        return {
            command: Commands.RUN,
            mode: "explicit",
            state,
            principal,
            scope,
            providerKind: "codex",
            providerCommand: options.codexCommand ?? "codex",
            providerArgs: options.codexArg ?? [],
            providerTimeoutSeconds: timeout,
        };
    }
    if (options.provider === "cursor") {
        if (
            present(options.providerCommand) ||
            present(options.providerArg) ||
            present(options.codexCommand) ||
            present(options.codexArg)
        )
            throw new ValidationError("process and Codex options cannot be combined with --provider cursor");
        return {
            command: Commands.RUN,
            mode: "explicit",
            state,
            principal,
            scope,
            providerKind: "cursor",
            providerCommand: options.cursorCommand ?? "cursor-agent",
            providerArgs: options.cursorArg ?? [],
            providerTimeoutSeconds: timeout,
        };
    }
    if (present(options.codexCommand) || present(options.codexArg))
        throw new ValidationError("--codex-command and --codex-arg require --provider codex");
    if (present(options.cursorCommand) || present(options.cursorArg))
        throw new ValidationError("--cursor-command and --cursor-arg require --provider cursor");
    return {
        command: Commands.RUN,
        mode: "explicit",
        state,
        principal,
        scope,
        providerKind: "process",
        providerCommand: required(options.providerCommand, "--provider-command"),
        providerArgs: options.providerArg ?? [],
        providerTimeoutSeconds: timeout,
    };
}

function present(value: string | string[] | undefined): boolean {
    if (value === undefined) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
}

function required(value: string | undefined, flag: string): string {
    if (!value) throw new ValidationError(`${flag} is required`);
    return value;
}

function nonEmpty(value: string): string {
    if (value.length === 0) throw new InvalidArgumentError("a value is required");
    return value;
}

function setupTimeout(value: string): number {
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120)
        throw new InvalidArgumentError("setup provider timeout must be in (0, 120] seconds");
    return timeout;
}

function collect(value: string, previous: string[] | undefined): string[] {
    if (value.length === 0) throw new InvalidArgumentError("a value is required");
    return [...(previous ?? []), value];
}

function assertSingularFlags(argv: readonly string[], command: Command) {
    const options = new Map(command.options.flatMap((option) => (option.long ? [[option.long, option] as const] : [])));
    const seen = new Set<string>();
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index]!;
        if (!token.startsWith("--")) continue;
        const equals = token.indexOf("=");
        const flag = equals === -1 ? token : token.slice(0, equals);
        if (flag === "--help") continue;
        const option = options.get(flag);
        if (!option) continue;
        const repeatable = repeatableFlags.has(flag);
        if (!repeatable) {
            if (seen.has(flag)) throw new ValidationError(`${flag} must not be repeated`);
            seen.add(flag);
        }
        if ((option.required || repeatable) && equals === -1) index += 1;
    }
}
