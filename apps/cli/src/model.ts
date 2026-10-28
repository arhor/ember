import type { SetupIntent } from "@ember/application/app/bootstrap.ts";
import type { Readable, Writable } from "node:stream";

export interface CliIo {
    input: Readable;
    output: Writable;
    error: Writable;
}

export const Commands = {
    SETUP: "setup",
    SETUP_GOOGLE_CALENDAR: "setup-google-calendar",
    INSPECT: "inspect",
    MATERIALIZE: "materialize",
    APPLY_MATERIALIZED_EDITS: "apply-materialized-edits",
    EXPLAIN: "explain",
    CORRECT: "correct",
    CHECK: "check",
    LOCK_STATUS: "lock-status",
    QUARANTINE_STALE_LOCK: "quarantine-stale-lock",
} as const;

export type SetupArgs = {
    command: typeof Commands.SETUP;
    config: string | undefined;
    state: string | undefined;
    principal: string | undefined;
    intent: SetupIntent | undefined;
    provider: "codex" | "cursor" | "claude-code" | "ollama" | "deepseek" | undefined;
    providerCommand: string | undefined;
    model: string | undefined;
    providerBaseUrl?: string | undefined;
    providerTimeoutSeconds: number | undefined;
    acceptContinuityRisk: boolean;
    confirmProviderChange: boolean;
    diagnostics?: boolean;
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

export type UseArgs = { command: "use"; config: string; scope?: string };
export type ShellOptions = { diagnostics?: boolean };

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
    | UseArgs
    | SetupArgs
    | SetupGoogleCalendarArgs
    | InspectArgs
    | MaterializeArgs
    | ApplyMaterializedEditsArgs
    | ExplainArgs
    | CorrectArgs
    | CheckArgs
    | LockStatusArgs
    | QuarantineStaleLockArgs;
