import type {
    CheckArgs,
    CliCommandArgs,
    CliIo,
    CorrectArgs,
    ExplainArgs,
    InitArgs,
    InspectArgs,
    InspectionView,
    LockStatusArgs,
    QuarantineStaleLockArgs,
    RunArgs,
} from "./model.ts";

import { EmberError, ValidationError } from "../../core/errors.ts";
import { initialState } from "../../core/model.ts";
import { explanationView, inspectionView } from "../../core/projection.ts";
import { supersede } from "../../core/semantics.ts";
import { MemoryProposalGenerationStore } from "../../persistence/memory-proposal-generation-store.ts";
import { StateStore } from "../../persistence/state-store.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../../providers/contract.ts";
import { interactionLedgerInspectionView, InteractionLedgerStore } from "../../runtime/interaction-boundary.ts";
import { assertUnreachable, cloneState } from "../../util.ts";
import { Commands, CommandSpecs } from "./model.ts";
import { runCliSurface } from "./surface.ts";

export async function main(
    argv = process.argv.slice(2),
    io: CliIo = { input: process.stdin, output: process.stdout, error: process.stderr },
): Promise<number> {
    try {
        const args = parseArgs(argv);
        switch (args.command) {
            case Commands.INIT:
                return await onInit(args, io);
            case Commands.RUN:
                return await onRun(args, io);
            case Commands.INSPECT: {
                return await onInspect(args, io);
            }
            case Commands.EXPLAIN: {
                return await onExplain(args, io);
            }
            case Commands.CORRECT: {
                return await onCorrect(args, io);
            }
            case Commands.CHECK: {
                return await onCheck(args, io);
            }
            case Commands.LOCK_STATUS: {
                return await onLockStatus(args, io);
            }
            case Commands.QUARANTINE_STALE_LOCK: {
                return await onQuarantineStaleLock(args, io);
            }
            default: {
                assertUnreachable(args);
            }
        }
    } catch (error) {
        if (error instanceof EmberError || error instanceof SyntaxError || isOperationalSystemError(error)) {
            io.error.write(`ember: ${error.message}\n`);
            return 2;
        }
        throw error;
    }
}

async function onCheck(args: CheckArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const state = await store.load();
    const lock = await store.lockStatus();
    io.output.write(`valid schema v1 revision ${state.revision}; lock ${JSON.stringify(lock)}\n`);
    return 0;
}

async function onLockStatus(args: LockStatusArgs, io: CliIo) {
    const status = await new StateStore(args.state).lockStatus();
    io.output.write(`${JSON.stringify(status, null, 2)}\n`);
    return 0;
}

async function onInit(args: InitArgs, io: CliIo) {
    await new StateStore(args.state).create(initialState(args.name, args.principal));
    io.output.write("initialized schema v1 continuity state\n");
    return 0;
}

async function onRun(args: RunArgs, io: CliIo) {
    return await runCliSurface(
        {
            statePath: args.state,
            principal: args.principal,
            scope: args.scope,
            providerKind: args.providerKind,
            providerCommand: args.providerCommand,
            providerArgs: args.providerArgs,
            providerTimeoutSeconds: args.providerTimeoutSeconds,
        },
        io,
    );
}

async function onInspect(args: InspectArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const state = await loadForPrincipal(store, args.principal);
    const view = {
        ...inspectionView(state),
        interactions: interactionLedgerInspectionView(await new InteractionLedgerStore(store.path).load()),
        memoryProposalGenerations: (await new MemoryProposalGenerationStore(store.path).load()).generations,
    };
    io.output.write(args.json ? `${JSON.stringify(view, null, 2)}\n` : renderInspection(view));
    return 0;
}

async function onExplain(args: ExplainArgs, io: CliIo) {
    const state = await loadForPrincipal(new StateStore(args.state), args.principal);
    io.output.write(`${JSON.stringify(explanationView(state, args.meaningId), null, 2)}\n`);
    return 0;
}

async function onCorrect(args: CorrectArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const lease = await store.acquireWriteLease();
    try {
        const state = await loadForPrincipal(store, args.principal);
        const candidate = cloneState(state);
        const id = supersede(candidate, args.principal, args.meaningId, args.text, { reason: args.reason });
        await store.commit(state.revision, candidate);
        io.output.write(`${id}\n`);
        return 0;
    } finally {
        await store.releaseWriteLease(lease);
    }
}

async function onQuarantineStaleLock(args: QuarantineStaleLockArgs, io: CliIo) {
    const destination = await new StateStore(args.state).quarantineStaleLock({
        ownerToken: args.ownerToken,
        confirmQuiescent: args.confirmQuiescent,
    });
    io.output.write(`${destination}\n`);
    return 0;
}

async function loadForPrincipal(store: StateStore, principal: string) {
    const state = await store.load();
    if (principal !== state.runtimeContract.localPrincipal)
        throw new ValidationError("asserted principal does not match initialized local principal");
    return state;
}

function renderInspection({
    cognitionEpisodes,
    currentMeanings,
    gaps,
    historical_meanings,
    interactions: { deliveries, inbound_occurrences },
    lineage: { constitutiveBoundaries, displayName, lineageId },
    memoryProposalGenerations,
    revision,
    runtimeEpisodes,
}: InspectionView) {
    let text = `Lineage ${lineageId} (${displayName}), revision ${revision}\nConstitutive boundaries:\n`;
    for (const boundary of constitutiveBoundaries) {
        text += `  ${boundary.boundaryId}: ${boundary.text}\n`;
    }
    const sections: Array<[string, Array<unknown>]> = [
        ["Current meanings", currentMeanings],
        ["Historical/superseded meanings", historical_meanings],
        ["Unavailable gaps", gaps],
        ["Runtime episodes", runtimeEpisodes],
        ["Cognition episodes", cognitionEpisodes],
        ["Interaction occurrences", inbound_occurrences],
        ["Delivery records", deliveries],
        ["Memory proposal generations", memoryProposalGenerations],
    ];
    for (const [label, items] of sections) {
        text += `${label}:\n`;
        for (const item of items) {
            text += `  ${JSON.stringify(item)}\n`;
        }
    }
    return text;
}

type RawValue = string | string[] | boolean | undefined;

export function parseArgs(argv: string[]): CliCommandArgs {
    if (!argv.length) {
        throw new ValidationError("a command is required");
    }
    const command = argv[0]!;
    const spec = CommandSpecs[command];
    if (!spec) {
        throw new ValidationError(`unsupported command: ${command}`);
    }
    const allowed = new Set(spec.flags);
    const booleans = new Set(spec.booleans ?? []);
    const repeatable = new Set(spec.repeatable ?? []);
    const values: Record<string, RawValue> = {};
    const positionals: string[] = [];

    for (let i = 1; i < argv.length; i++) {
        const item = argv[i]!;
        if (!item.startsWith("--")) {
            positionals.push(item);
            continue;
        }
        if (!allowed.has(item)) {
            throw new ValidationError(`unsupported option for ${command}: ${item}`);
        }
        if (item in values && !repeatable.has(item)) {
            throw new ValidationError(`${item} must not be repeated`);
        }
        if (booleans.has(item)) {
            values[item] = true;
            continue;
        }
        if (i + 1 >= argv.length) {
            throw new ValidationError(`${item} requires a value`);
        }
        if (repeatable.has(item)) {
            const current = values[item];
            const list = Array.isArray(current) ? current : [];
            list.push(argv[++i]!);
            values[item] = list;
        } else {
            values[item] = argv[++i]!;
        }
    }
    if (positionals.length !== spec.positionals) {
        throw new ValidationError(
            `${command} requires ${spec.positionals} positional argument${spec.positionals === 1 ? "" : "s"}`,
        );
    }

    function required(flag: string): string {
        const value = values[flag];
        if (typeof value !== "string" || !value) {
            throw new ValidationError(`${flag} is required`);
        }
        return value;
    }

    if (command === "init") {
        return { command, state: required("--state"), name: required("--name"), principal: required("--principal") };
    }
    if (command === "run") {
        const timeout = Number(required("--provider-timeout-seconds"));
        if (!Number.isFinite(timeout) || timeout <= 0) {
            throw new ValidationError("--provider-timeout-seconds must be a positive finite number");
        }
        if (timeout > MAX_PROVIDER_TIMEOUT_SECONDS) {
            throw new ValidationError(`--provider-timeout-seconds must not exceed ${MAX_PROVIDER_TIMEOUT_SECONDS}`);
        }
        const provider = values["--provider"];
        if (provider !== undefined && provider !== "codex" && provider !== "cursor") {
            throw new ValidationError("--provider supports codex or cursor");
        }
        if (provider === "codex") {
            if (
                values["--provider-command"] !== undefined ||
                values["--provider-arg"] !== undefined ||
                values["--cursor-command"] !== undefined ||
                values["--cursor-arg"] !== undefined
            ) {
                throw new ValidationError("process and Cursor options cannot be combined with --provider codex");
            }
            return {
                command,
                state: required("--state"),
                principal: required("--principal"),
                scope: required("--scope"),
                providerKind: "codex",
                providerCommand: typeof values["--codex-command"] === "string" ? values["--codex-command"] : "codex",
                providerArgs: Array.isArray(values["--codex-arg"]) ? (values["--codex-arg"] as string[]) : [],
                providerTimeoutSeconds: timeout,
            };
        }
        if (provider === "cursor") {
            if (
                values["--provider-command"] !== undefined ||
                values["--provider-arg"] !== undefined ||
                values["--codex-command"] !== undefined ||
                values["--codex-arg"] !== undefined
            ) {
                throw new ValidationError("process and Codex options cannot be combined with --provider cursor");
            }
            return {
                command,
                state: required("--state"),
                principal: required("--principal"),
                scope: required("--scope"),
                providerKind: "cursor",
                providerCommand:
                    typeof values["--cursor-command"] === "string" ? values["--cursor-command"] : "cursor-agent",
                providerArgs: Array.isArray(values["--cursor-arg"]) ? (values["--cursor-arg"] as string[]) : [],
                providerTimeoutSeconds: timeout,
            };
        }
        if (values["--codex-command"] !== undefined || values["--codex-arg"] !== undefined) {
            throw new ValidationError("--codex-command and --codex-arg require --provider codex");
        }
        if (values["--cursor-command"] !== undefined || values["--cursor-arg"] !== undefined) {
            throw new ValidationError("--cursor-command and --cursor-arg require --provider cursor");
        }
        return {
            command,
            state: required("--state"),
            principal: required("--principal"),
            scope: required("--scope"),
            providerKind: "process",
            providerCommand: required("--provider-command"),
            providerArgs: Array.isArray(values["--provider-arg"]) ? (values["--provider-arg"] as string[]) : [],
            providerTimeoutSeconds: timeout,
        };
    }
    if (command === "inspect") {
        return {
            command,
            state: required("--state"),
            principal: required("--principal"),
            json: values["--json"] === true,
        };
    }
    if (command === "explain") {
        return { command, state: required("--state"), principal: required("--principal"), meaningId: positionals[0]! };
    }
    if (command === "correct") {
        return {
            command,
            state: required("--state"),
            principal: required("--principal"),
            meaningId: positionals[0]!,
            text: required("--text"),
            reason: required("--reason"),
        };
    }
    if (command === "check" || command === "lock-status") {
        return { command, state: required("--state") };
    }
    return {
        command: "quarantine-stale-lock",
        state: required("--state"),
        ownerToken: required("--owner-token"),
        confirmQuiescent: values["--confirm-quiescent"] === true,
    };
}

function isOperationalSystemError(error: unknown): error is Error & { code: string } {
    return (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string" &&
        /^E[A-Z0-9]+$/.test(error.code)
    );
}
