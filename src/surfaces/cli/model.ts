import type { Readable, Writable } from "node:stream";

import { inspectionView } from "../../core/projection.ts";
import { MemoryProposalGenerationStore } from "../../persistence/memory-proposal-generation-store.ts";
import { interactionLedgerInspectionView } from "../../runtime/interaction-boundary.ts";

export interface CliIo {
    input: Readable;
    output: Writable;
    error: Writable;
}

export interface CommandSpec {
    flags: string[];
    booleans?: string[];
    repeatable?: string[];
    positionals: number;
}

export const Commands = {
    INIT: "init",
    RUN: "run",
    INSPECT: "inspect",
    EXPLAIN: "explain",
    CORRECT: "correct",
    CHECK: "check",
    LOCK_STATUS: "lock-status",
    QUARANTINE_STALE_LOCK: "quarantine-stale-lock",
    QUARANTINE_STALE_LOCK1: "quarantine-stale-lock1",
} as const;

export const CommandSpecs = {
    [Commands.INIT]: {
        flags: ["--state", "--name", "--principal"],
        positionals: 0,
    },
    [Commands.RUN]: {
        flags: [
            "--state",
            "--principal",
            "--scope",
            "--provider",
            "--provider-command",
            "--provider-arg",
            "--codex-command",
            "--codex-arg",
            "--cursor-command",
            "--cursor-arg",
            "--provider-timeout-seconds",
        ],
        repeatable: ["--provider-arg", "--codex-arg", "--cursor-arg"],
        positionals: 0,
    },
    [Commands.INSPECT]: {
        flags: ["--state", "--principal", "--json"],
        booleans: ["--json"],
        positionals: 0,
    },
    [Commands.EXPLAIN]: {
        flags: ["--state", "--principal"],
        positionals: 1,
    },
    [Commands.CORRECT]: {
        flags: ["--state", "--principal", "--text", "--reason"],
        positionals: 1,
    },
    [Commands.CHECK]: {
        flags: ["--state"],
        positionals: 0,
    },
    [Commands.LOCK_STATUS]: {
        flags: ["--state"],
        positionals: 0,
    },
    [Commands.QUARANTINE_STALE_LOCK]: {
        flags: ["--state", "--owner-token", "--confirm-quiescent"],
        booleans: ["--confirm-quiescent"],
        positionals: 0,
    },
} as Record<string, CommandSpec>;

export type InitArgs = {
    command: typeof Commands.INIT;
    state: string;
    name: string;
    principal: string;
};

export type RunArgs = {
    command: typeof Commands.RUN;
    state: string;
    principal: string;
    scope: string;
    providerKind: "process" | "codex" | "cursor";
    providerCommand: string;
    providerArgs: string[];
    providerTimeoutSeconds: number;
};

export type InspectArgs = {
    command: typeof Commands.INSPECT;
    state: string;
    principal: string;
    json: boolean;
};

export type ExplainArgs = {
    command: typeof Commands.EXPLAIN;
    state: string;
    principal: string;
    meaningId: string;
};

export type CorrectArgs = {
    command: typeof Commands.CORRECT;
    state: string;
    principal: string;
    meaningId: string;
    text: string;
    reason: string;
};

export type CheckArgs = {
    command: typeof Commands.CHECK;
    state: string;
};

export type LockStatusArgs = {
    command: typeof Commands.LOCK_STATUS;
    state: string;
};

export type QuarantineStaleLockArgs = {
    command: typeof Commands.QUARANTINE_STALE_LOCK;
    state: string;
    ownerToken: string;
    confirmQuiescent: boolean;
};

export type CliCommandArgs =
    | InitArgs
    | RunArgs
    | InspectArgs
    | ExplainArgs
    | CorrectArgs
    | CheckArgs
    | LockStatusArgs
    | QuarantineStaleLockArgs;

export type InspectionView = ReturnType<typeof inspectionView> & {
    interactions: ReturnType<typeof interactionLedgerInspectionView>;
    memoryProposalGenerations: Awaited<ReturnType<MemoryProposalGenerationStore["load"]>>["generations"];
};
