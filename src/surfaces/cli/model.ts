import type { Readable, Writable } from "node:stream";

import type { SetupIntent } from "../../app/bootstrap.ts";

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
    SETUP: "setup",
    SETUP_GOOGLE_CALENDAR: "setup-google-calendar",
    INIT: "init",
    RUN: "run",
    INSPECT: "inspect",
    MATERIALIZE: "materialize",
    APPLY_MATERIALIZED_EDITS: "apply-materialized-edits",
    EXPLAIN: "explain",
    CORRECT: "correct",
    CHECK: "check",
    LOCK_STATUS: "lock-status",
    QUARANTINE_STALE_LOCK: "quarantine-stale-lock",
} as const;

export const CommandSpecs = {
    [Commands.SETUP]: {
        flags: [
            "--config",
            "--state",
            "--principal",
            "--intent",
            "--provider",
            "--provider-command",
            "--model",
            "--provider-base-url",
            "--provider-timeout-seconds",
            "--accept-continuity-risk",
            "--confirm-provider-change",
            "--diagnostics",
            "--help",
        ],
        booleans: ["--accept-continuity-risk", "--confirm-provider-change", "--diagnostics", "--help"],
        positionals: 0,
    },
    [Commands.SETUP_GOOGLE_CALENDAR]: {
        flags: [
            "--setup-config",
            "--config",
            "--client-id",
            "--client-secret-file",
            "--refresh-token-file",
            "--calendar-id",
            "--calendar-label",
            "--timezone",
            "--scope",
            "--surface",
            "--disable",
            "--reconfigure",
        ],
        booleans: ["--disable", "--reconfigure"],
        repeatable: ["--surface"],
        positionals: 0,
    },
    [Commands.INIT]: {
        flags: ["--state", "--principal"],
        positionals: 0,
    },
    [Commands.RUN]: {
        flags: [
            "--config",
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
    [Commands.MATERIALIZE]: {
        flags: ["--state", "--principal", "--scope", "--output"],
        positionals: 0,
    },
    [Commands.APPLY_MATERIALIZED_EDITS]: {
        flags: ["--state", "--principal", "--scope", "--input", "--approval-evidence"],
        repeatable: ["--approval-evidence"],
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
    principal: string;
};

export type SetupArgs = {
    command: typeof Commands.SETUP;
    config: string | undefined;
    state: string | undefined;
    principal: string | undefined;
    intent: SetupIntent | undefined;
    provider: "codex" | "cursor" | "claude-code" | "ollama" | undefined;
    providerCommand: string | undefined;
    model: string | undefined;
    providerBaseUrl?: string | undefined;
    providerTimeoutSeconds: number | undefined;
    acceptContinuityRisk: boolean;
    confirmProviderChange: boolean;
    diagnostics?: boolean;
    help: boolean;
};

export type SetupGoogleCalendarArgs = {
    command: typeof Commands.SETUP_GOOGLE_CALENDAR;
    setupConfig: string;
    config: string;
    clientId: string | undefined;
    clientSecretFile: string | undefined;
    refreshTokenFile: string | undefined;
    calendarId: string | undefined;
    calendarLabel: string | undefined;
    timezone: string | undefined;
    scope: string | undefined;
    surfaces: string[];
    disable: boolean;
    reconfigure: boolean;
};

export type ConfiguredRunArgs = {
    command: typeof Commands.RUN;
    mode: "configured";
    config: string;
    scope: string;
};

export type DefaultRunArgs = {
    command: typeof Commands.RUN;
    mode: "default";
};

export type ExplicitRunArgs = {
    command: typeof Commands.RUN;
    mode: "explicit";
    state: string;
    principal: string;
    scope: string;
    providerKind: "process" | "codex" | "cursor";
    providerCommand: string;
    providerArgs: string[];
    providerTimeoutSeconds: number;
};

export type RunArgs = ExplicitRunArgs | ConfiguredRunArgs | DefaultRunArgs;

export type InspectArgs = {
    command: typeof Commands.INSPECT;
    state: string;
    principal: string;
    json: boolean;
};

export type MaterializeArgs = {
    command: typeof Commands.MATERIALIZE;
    state: string;
    principal: string;
    scope: string;
    output: string;
};

export type ApplyMaterializedEditsArgs = {
    command: typeof Commands.APPLY_MATERIALIZED_EDITS;
    state: string;
    principal: string;
    scope: string;
    input: string;
    approvalEvidenceIds: string[];
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
    | SetupArgs
    | SetupGoogleCalendarArgs
    | InitArgs
    | RunArgs
    | InspectArgs
    | MaterializeArgs
    | ApplyMaterializedEditsArgs
    | ExplainArgs
    | CorrectArgs
    | CheckArgs
    | LockStatusArgs
    | QuarantineStaleLockArgs;
