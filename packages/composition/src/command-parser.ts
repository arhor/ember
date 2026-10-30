import type { SessionCommand } from "@ember/application/commands/contract.ts";

import { commandCatalogue } from "@ember/application/commands/catalogue.ts";
import { splitCommand } from "@ember/application/commands/tokenize.ts";
import { ValidationError } from "@ember/domain/errors.ts";
import { Command, CommanderError } from "commander";

export interface CommandOutput {
    output: { write(text: string): unknown };
    error: { write(text: string): unknown };
}

export function createConversationProgram(
    io: CommandOutput,
    dispatch: (command: SessionCommand) => Promise<void>,
    local = false,
): Command {
    const program = new Command()
        .name(":")
        .helpCommand(false)
        .exitOverride()
        .configureOutput({
            writeOut: (text) => {
                io.output.write(text);
            },
            writeErr: (text) => {
                io.error.write(text);
            },
            outputError() {},
        });
    let remember: Command | undefined;
    for (const descriptor of commandCatalogue) {
        if (descriptor.kind === "help" || (descriptor.fixture && !local)) continue;
        const parts = descriptor.name.split(" ");
        if (parts.length > 1 && !remember)
            remember = program.command("remember").description("Record relationship, fact, or episode meaning");
        const command = (parts.length > 1 ? remember! : program)
            .command(parts.at(-1)!, { hidden: descriptor.fixture === true })
            .description(descriptor.description);
        const alias = parts.at(-1)!.replaceAll("-", "_");
        if (alias !== parts.at(-1)) command.alias(alias);
        for (const argument of descriptor.arguments)
            command.argument(
                argument,
                argument === "<slot>" && descriptor.kind === "remember-fact"
                    ? "fact slot"
                    : argument.replace(/[<>]/g, "").replaceAll("-", " "),
            );
        if (descriptor.explain) command.requiredOption("--explain <ids>", "comma-separated meaning ids");
        command.action(async (...values: unknown[]) => {
            const invocation: Record<string, unknown> = { kind: descriptor.kind };
            descriptor.fields.forEach((field, index) => {
                invocation[field] = Array.isArray(values[index]) ? values[index].join(" ") : values[index];
            });
            if (descriptor.explain) {
                invocation.explainIds = (values[descriptor.fields.length] as { explain: string }).explain
                    .split(",")
                    .filter(Boolean);
                if (!(invocation.explainIds as string[]).length)
                    throw new ValidationError("at least one explanation ID is required");
            }
            await dispatch(invocation as SessionCommand);
        });
    }
    if (local)
        program
            .command("quit")
            .description("End the interactive session")
            .action(async () => dispatch({ kind: "quit" }));
    return program;
}

export async function parseConversationCommand(
    line: string,
): Promise<{ command: SessionCommand | null; text: string }> {
    let text = "";
    let command: SessionCommand | null = null;
    const io = {
        output: {
            write(value: string) {
                text += value;
            },
        },
        error: {
            write(value: string) {
                text += value;
            },
        },
    };
    try {
        const argv = splitCommand(line.slice(1));
        if (argv.length === 1 && argv[0] === "help") {
            const { conversationHelp } = await import("@ember/application/commands/catalogue.ts");
            return { command: null, text: conversationHelp() };
        }
        await createConversationProgram(io, async (value) => {
            command = value;
        }).parseAsync(argv, { from: "user" });
    } catch (error) {
        if (error instanceof CommanderError) {
            if (error.exitCode !== 0) text += "command rejected: " + error.message + "\nUse /help for commands.\n";
        } else if (error instanceof ValidationError) text += "command rejected: " + error.message + "\n";
        else throw error;
    }
    return { command, text };
}
