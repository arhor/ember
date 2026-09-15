import type {
    CheckArgs,
    ApplyMaterializedEditsArgs,
    CliCommandArgs,
    CliIo,
    CorrectArgs,
    ExplainArgs,
    InitArgs,
    InspectArgs,
    MaterializeArgs,
    LockStatusArgs,
    QuarantineStaleLockArgs,
    RunArgs,
} from "./model.ts";

import { EmberError, ValidationError } from "../../core/errors.ts";
import { assessMemoryProposal, resolveMemoryProposal } from "../../core/memory-proposal.ts";
import { initialState, nowUtc } from "../../core/model.ts";
import { explanationView, inspectionView } from "../../core/projection.ts";
import { supersede } from "../../core/semantics.ts";
import { buildStateMaterialization } from "../../core/state-materialization.ts";
import {
    inspectMarkdownStateEdits,
    publishMarkdownStateViews,
    readMarkdownStateViews,
} from "../../persistence/markdown-state-materializer.ts";
import { MemoryProposalGenerationStore } from "../../persistence/memory-proposal-generation-store.ts";
import { StateStore } from "../../persistence/state-store.ts";
import { MAX_PROVIDER_TIMEOUT_SECONDS } from "../../providers/contract.ts";
import { interactionLedgerInspectionView, InteractionLedgerStore } from "../../runtime/interaction-boundary.ts";
import { assertUnreachable, cloneState } from "../../util.ts";
import { Commands, CommandSpecs } from "./model.ts";
import { setupMain, setupRunMain } from "./setup.ts";
import { runCliSurface } from "./surface.ts";

export async function main(
    argv = process.argv.slice(2),
    io: CliIo = { input: process.stdin, output: process.stdout, error: process.stderr },
): Promise<number> {
    try {
        const args = parseArgs(argv);
        switch (args.command) {
            case Commands.SETUP:
                return await setupMain(args, io);
            case Commands.INIT:
                return await onInit(args, io);
            case Commands.RUN:
                return await onRun(args, io);
            case Commands.INSPECT: {
                return await onInspect(args, io);
            }
            case Commands.MATERIALIZE: {
                return await onMaterialize(args, io);
            }
            case Commands.APPLY_MATERIALIZED_EDITS: {
                return await onApplyMaterializedEdits(args, io);
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
                assertUnreachable();
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

async function onInit(args: InitArgs, io: CliIo) {
    await new StateStore(args.state).create(initialState(args.principal));
    io.output.write("initialized schema v1 continuity state\n");
    return 0;
}

async function onRun(args: RunArgs, io: CliIo) {
    if (args.mode === "configured") return await setupRunMain(args, io);
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

async function onMaterialize(args: MaterializeArgs, io: CliIo) {
    const state = await loadForPrincipal(new StateStore(args.state), args.principal);
    const files = await publishMarkdownStateViews(
        args.output,
        args.state,
        buildStateMaterialization(state, { principal: args.principal, scope: args.scope }),
    );
    io.output.write(
        `materialized Markdown v1 revision ${state.revision}:\n${files.map((file) => `  ${file}`).join("\n")}\n`,
    );
    return 0;
}

async function onApplyMaterializedEdits(args: ApplyMaterializedEditsArgs, io: CliIo) {
    const store = new StateStore(args.state);
    const lease = await store.acquireWriteLease();
    try {
        const state = await loadForPrincipal(store, args.principal);
        const materialization = buildStateMaterialization(state, { principal: args.principal, scope: args.scope });
        const inspection = inspectMarkdownStateEdits(
            materialization,
            await readMarkdownStateViews(args.input),
            nowUtc(),
        );
        let candidate = state;
        const outcomes = [];
        for (const proposalCandidate of inspection.proposals) {
            const assessment = assessMemoryProposal(candidate, proposalCandidate);
            if (assessment.status !== "valid")
                throw new ValidationError(`materialized edit proposal was ${assessment.status}: ${assessment.detail}`);
            const resolution = resolveMemoryProposal(candidate, assessment.proposal, state.revision, {
                decidedAt: proposalCandidate.proposed_at,
            });
            outcomes.push(resolution.proposal);
            if (resolution.proposal.status !== "adopted")
                throw new ValidationError(`materialized edit was rejected: ${resolution.proposal.resolution.reason}`);
            candidate = resolution.state;
        }
        const committed = await store.commit(state.revision, candidate);
        await publishMarkdownStateViews(
            args.input,
            args.state,
            buildStateMaterialization(committed, { principal: args.principal, scope: args.scope }),
        );
        io.output.write(
            `${JSON.stringify({ ...inspection, proposals: outcomes, resulting_revision: committed.revision }, null, 2)}\n`,
        );
        return 0;
    } finally {
        await store.releaseWriteLease(lease);
    }
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

type InspectionView = ReturnType<typeof inspectionView> & {
    interactions: ReturnType<typeof interactionLedgerInspectionView>;
    memoryProposalGenerations: Awaited<ReturnType<MemoryProposalGenerationStore["load"]>>["generations"];
};

function renderInspection({
    cognitionEpisodes,
    currentMeanings,
    gaps,
    historical_meanings,
    interactions: { deliveries, inbound_occurrences },
    lineage: { constitutiveBoundaries, lineageId },
    memoryProposalGenerations,
    revision,
    runtimeEpisodes,
}: InspectionView) {
    let text = `Lineage ${lineageId}, revision ${revision}\nConstitutive boundaries:\n`;
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

    function optional(flag: string): string | undefined {
        return values[flag] === undefined ? undefined : required(flag);
    }

    if (command === Commands.SETUP) {
        const intent = optional("--intent");
        if (
            intent !== undefined &&
            intent !== "create-new" &&
            intent !== "restore-existing" &&
            intent !== "use-existing"
        )
            throw new ValidationError("--intent requires create-new, restore-existing, or use-existing");
        const provider = optional("--provider");
        if (provider !== undefined && provider !== "codex" && provider !== "cursor" && provider !== "claude-code")
            throw new ValidationError("--provider supports codex, cursor, or claude-code for setup");
        const timeoutValue = optional("--provider-timeout-seconds");
        const timeout = timeoutValue === undefined ? undefined : Number(timeoutValue);
        if (timeout !== undefined && (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120))
            throw new ValidationError("setup provider timeout must be in (0, 120] seconds");
        return {
            command,
            config: optional("--config"),
            state: optional("--state"),
            principal: optional("--principal"),
            intent,
            provider,
            providerCommand: optional("--provider-command"),
            model: optional("--model"),
            providerTimeoutSeconds: timeout,
            acceptContinuityRisk: values["--accept-continuity-risk"] === true,
            confirmProviderChange: values["--confirm-provider-change"] === true,
            help: values["--help"] === true,
        };
    }

    if (command === "init") {
        return { command, state: required("--state"), principal: required("--principal") };
    }
    if (command === "run") {
        if (values["--config"] !== undefined) {
            if (Object.keys(values).some((flag) => flag !== "--config" && flag !== "--scope"))
                throw new ValidationError("configured run accepts only --config PATH and --scope SCOPE");
            return { command, mode: "configured", config: required("--config"), scope: required("--scope") };
        }
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
                mode: "explicit",
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
                mode: "explicit",
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
            mode: "explicit",
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
    if (command === "materialize") {
        return {
            command,
            state: required("--state"),
            principal: required("--principal"),
            scope: required("--scope"),
            output: required("--output"),
        };
    }
    if (command === "apply-materialized-edits") {
        return {
            command,
            state: required("--state"),
            principal: required("--principal"),
            scope: required("--scope"),
            input: required("--input"),
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
