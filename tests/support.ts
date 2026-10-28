import type { CliMainOverrides } from "@ember/cli/main.ts";
import type { CliIo } from "@ember/cli/model.ts";

import { prepareConfiguredRun } from "@ember/application/app/bootstrap.ts";
import { setupGoogleCalendarMain } from "@ember/cli/google-calendar-setup.ts";
import { executeLocalCommand } from "@ember/cli/local-commands.ts";
import { createLocalProgram } from "@ember/cli/local-program.ts";
import { main as shellMain } from "@ember/cli/main.ts";
import { setupMain } from "@ember/cli/setup.ts";
import { runCliSurface } from "@ember/cli/surface.ts";
import { composeCliSurface } from "@ember/composition/cli.ts";
import { composeSetupDependencies } from "@ember/composition/setup.ts";
import { initialState } from "@ember/domain/model.ts";
import {
    attachDetail,
    rememberEpisode,
    rememberFact,
    rememberPreference,
    rememberRelationship,
    undertake,
} from "@ember/domain/semantics.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";

import { fixtureProgram } from "./cli-fixture-program.ts";

export const PRINCIPAL = "user-1";
export const SCOPE = "project:ember/docs";
export const RELATIONSHIP_SCOPE = "relationship:user-1";
export const ROOT = resolve(import.meta.dirname, "..");
export const CLI = join(ROOT, "apps", "cli", "bin", "ember.ts");
export const PROVIDER = join(ROOT, "tests", "fixtures", "providers", "scripted-provider.ts");

export function populatedState() {
    const state = initialState(PRINCIPAL, "2026-08-29T10:00:00Z");
    const relationship = rememberRelationship(
        state,
        PRINCIPAL,
        "relationship:user-1",
        RELATIONSHIP_SCOPE,
        "Continuing collaborators",
    );
    const fact = rememberFact(
        state,
        PRINCIPAL,
        "user:user-1",
        "home-server",
        RELATIONSHIP_SCOPE,
        "Home server is a Raspberry Pi 5",
    );
    const preference = rememberPreference(
        state,
        PRINCIPAL,
        "user:user-1",
        "docs-rationale-detail",
        SCOPE,
        "Prefer concise architectural rationale",
    );
    const commitment = undertake(
        state,
        PRINCIPAL,
        "restart-provenance-check",
        SCOPE,
        "Check restart reconstruction preserves provenance without transcript replay",
    );
    const episode = rememberEpisode(
        state,
        PRINCIPAL,
        "first-continuity-experiment",
        "relationship:user-1",
        RELATIONSHIP_SCOPE,
        "The first continuity experiment received a nickname",
    );
    const detail = attachDetail(state, PRINCIPAL, episode, "Cinder");

    return {
        state,
        ids: {
            relationship,
            fact,
            preference,
            commitment,
            episode,
            detail,
        },
    };
}

export async function tempDir() {
    return mkdtemp(join(tmpdir(), "ember-ts-test-"));
}

export async function command(
    args: any,
    { stdin = "", now = "2026-08-29T10:00:00Z", fixtureFaults = false, env = {} } = {},
) {
    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            [args.length && !args[0].startsWith("--") ? join(ROOT, "tests", "cli-fixture-runner.ts") : CLI, ...args],
            {
                cwd: ROOT,
                env: {
                    ...process.env,
                    EMBER_TEST_NOW: now,
                    ...(fixtureFaults ? { EMBER_ENABLE_FIXTURE_FAULTS: "1" } : {}),
                    ...env,
                },
                stdio: ["pipe", "pipe", "pipe"],
            },
        );
        let stdout = "",
            stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (x) => (stdout += x));
        child.stderr.on("data", (x) => (stderr += x));
        child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
        child.stdin.end(stdin);
    });
}

export async function readJson(path: string) {
    return JSON.parse(await readFile(path, "utf8"));
}

export async function captureProcessCommand(argv: string[]): Promise<any> {
    if (argv.length === 0 || (argv.length === 1 && argv[0] === "--diagnostics")) {
        return {
            command: "run",
            mode: "default",
            ...(argv[0] === "--diagnostics" ? { diagnostics: true } : {}),
        };
    }
    const delegated =
        argv[0] === "--diagnostics" && argv[1] === "setup" ? ["setup", "--diagnostics", ...argv.slice(2)] : argv;
    let captured: any;
    const io = {
        input: Readable.from([]),
        output: new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            },
        }),
        error: new Writable({
            write(_chunk, _encoding, callback) {
                callback();
            },
        }),
    };
    const parser =
        delegated[0] === "run"
            ? (_io: any, _argv: any, dispatch: any) => fixtureProgram(_io, _argv, dispatch)
            : createLocalProgram;
    const program = parser(io, delegated, async (args: any) => {
        captured = args;
        return 0;
    });
    try {
        await program.parseAsync(delegated, { from: "user" });
    } catch (error) {
        if (!(error instanceof Error && "exitCode" in error && error.exitCode === 0)) throw error;
    }
    if (!captured) return undefined;
    return captured;
}

export async function captureError(action: any) {
    try {
        await action();
        return null;
    } catch (error) {
        return error;
    }
}

export function emptyRequest() {
    return {
        contractVersion: 1,
        cognitionId: "cognition-test",
        projection: { selection: { meaning_ids: [] } },
        input: { text: "hello" },
    };
}

// Provider integration fixtures exercise explicit composition without exposing a raw
// state/provider launch interface in the shipped executable.
export async function fixtureMain(argv: string[], io: CliIo, overrides: CliMainOverrides = {}): Promise<number> {
    if (argv.length === 0 || argv[0]?.startsWith("--")) return await shellMain(argv, io, overrides);
    try {
        if (argv[0] === "init") {
            await new StateStore(argv[argv.indexOf("--state") + 1]!).create(
                initialState(argv[argv.indexOf("--principal") + 1]!),
            );
            io.output.write("initialized schema v1 continuity state\n");
            return 0;
        }
        if (argv[0] === "run") {
            const args = await captureProcessCommand(argv);
            if (args.mode === "configured") {
                const prepared = await prepareConfiguredRun(
                    args,
                    composeSetupDependencies(() => {}),
                );
                const services = composeCliSurface({
                    statePath: prepared.statePath,
                    provider: {
                        kind: prepared.providerKind,
                        ...(prepared.providerCommand === undefined ? {} : { command: prepared.providerCommand }),
                        arguments: prepared.providerArgs,
                        timeoutSeconds: prepared.providerTimeoutSeconds,
                        ...(prepared.providerModel ? { model: prepared.providerModel } : {}),
                    },
                });
                try {
                    return await runCliSurface(prepared, io, services);
                } finally {
                    await services.close();
                }
            }
            const services = composeCliSurface({
                statePath: args.state,
                provider: {
                    kind: args.providerKind,
                    command: args.providerCommand,
                    arguments: args.providerArgs,
                    timeoutSeconds: args.providerTimeoutSeconds,
                },
            });
            try {
                return await runCliSurface({ principal: args.principal, scope: args.scope }, io, services);
            } finally {
                await services.close();
            }
        }
        let status = 0;
        const parser = createLocalProgram(io, argv, async (args) => {
            if (args.command === "setup") status = await setupMain(args, io, overrides.setupDependencies);
            else if (args.command === "setup-google-calendar") status = await setupGoogleCalendarMain(args, io);
            else if (args.command === "use") throw new Error("fixture selection must use the executable shell");
            else status = await executeLocalCommand(args, io);
            return status;
        });
        try {
            await parser.parseAsync(argv, { from: "user" });
        } catch (error) {
            if (!(error instanceof Error && "exitCode" in error && error.exitCode === 0)) throw error;
        }
        return status;
    } catch (error) {
        if (error instanceof Error) {
            io.error.write(`ember: ${error.message}\n`);
            return 2;
        }
        throw error;
    }
}
