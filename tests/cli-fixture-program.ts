import type { CliIo } from "@ember/cli/model.ts";

import { MAX_AI_TIMEOUT_SECONDS } from "@ember/application/ai/contract.ts";
import { Command, Option, InvalidArgumentError } from "@ember/cli/command-io.ts";
import { bindCommandIo } from "@ember/cli/command-io.ts";
import { ValidationError } from "@ember/domain/errors.ts";
export type RunArgs =
    | { command: "run"; mode: "configured"; config: string; scope: string }
    | {
          command: "run";
          mode: "explicit";
          state: string;
          principal: string;
          scope: string;
          providerKind: "codex" | "cursor" | "process";
          providerCommand: string;
          providerArgs: string[];
          providerTimeoutSeconds: number;
      };
export function fixtureProgram(io: CliIo, processFixtureArgv: string[], dispatch: (args: RunArgs) => Promise<number>) {
    const program = bindCommandIo(new Command(), io);
    program.hook("preAction", (_command, action) => assertSingularFlags(processFixtureArgv, action));
    program
        .command("run")
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

    return program;
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
            command: "run",
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
            command: "run",
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
            command: "run",
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
        command: "run",
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

const repeatableFlags = new Set(["--provider-arg", "--codex-arg", "--cursor-arg"]);
