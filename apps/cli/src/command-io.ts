import type { Writable } from "node:stream";

import { Command } from "commander";

export function bindCommandIo(
    command: Command,
    io: { output: Writable; error: Writable },
    suppressErrors = false,
): Command {
    command.exitOverride();
    command.configureOutput({
        writeOut: (text) => {
            io.output.write(text);
        },
        writeErr: (text) => {
            io.error.write(text);
        },
        ...(suppressErrors ? { outputError() {} } : {}),
    });
    return command;
}
