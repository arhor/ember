import { ValidationError } from "@ember/domain/errors.ts";
import { Command, InvalidArgumentError, Option } from "commander";

import type {
    ApplyMaterializedEditsArgs,
    CheckArgs,
    CliCommandArgs,
    CliIo,
    CorrectArgs,
    ExplainArgs,
    InspectArgs,
    LockStatusArgs,
    MaterializeArgs,
    QuarantineStaleLockArgs,
    SetupArgs,
    SetupGoogleCalendarArgs,
} from "./model.ts";

import { bindCommandIo } from "./command-io.ts";
import { Commands } from "./model.ts";
import { setupHelpText } from "./setup-help.ts";

const repeatableFlags = new Set(["--surface", "--approval-evidence"]);

export function createLocalProgram(
    io: CliIo,
    argv: readonly string[],
    dispatch: (args: CliCommandArgs) => Promise<number>,
): Command {
    const program = bindCommandIo(new Command(), io);
    program
        .name("/")
        .description("Local shell commands. Prefix commands with / or :.")
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

    program
        .command("use")
        .description("Select a verified setup for this shell")
        .requiredOption("--config <path>", "setup configuration", nonEmpty)
        .option("--scope <scope>", "active scope", nonEmpty)
        .action(async (options: { config: string; scope?: string }) => {
            await dispatch({ command: "use", ...options });
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
