import type { SetupCompositionOverrides } from "@ember/composition/setup.ts";

import { EmberError } from "@ember/domain/errors.ts";

import type { CliIo } from "./model.ts";

import { setupRunMain } from "./setup.ts";

export interface CliMainOverrides {
    setupDependencies?: SetupCompositionOverrides;
}

export async function main(
    argv = process.argv.slice(2),
    io: CliIo = { input: process.stdin, output: process.stdout, error: process.stderr },
    overrides: CliMainOverrides = {},
): Promise<number> {
    if (argv.length === 1 && ["--help", "-h"].includes(argv[0]!)) {
        io.output.write(
            "Usage: ember [--diagnostics]\nOpen the shell. Use /help for commands and /use --config PATH [--scope SCOPE] to select a setup.\n",
        );
        return 0;
    }
    if (argv.length > 0 && !(argv.length === 1 && argv[0] === "--diagnostics")) {
        io.error.write(
            "ember: process subcommands and launch overrides were removed. Launch ember, then use /setup, /use, or /help.\n",
        );
        return 2;
    }
    try {
        return await setupRunMain({ diagnostics: argv[0] === "--diagnostics" }, io, overrides);
    } catch (error) {
        if (error instanceof EmberError || error instanceof SyntaxError || isOperationalSystemError(error)) {
            io.error.write(`ember: ${error.message}\n`);
            return 2;
        }
        throw error;
    }
}

export function isOperationalSystemError(error: unknown): error is Error & { code: string } {
    return (
        error instanceof Error && "code" in error && typeof error.code === "string" && /^E[A-Z0-9]+$/.test(error.code)
    );
}
