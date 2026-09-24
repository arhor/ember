import { lstat, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

import type { SetupConfig } from "../app/bootstrap.ts";

import { safeText, validateSetupProvider } from "../app/bootstrap-validation.ts";
import { ValidationError } from "../core/errors.ts";
import { isRfc3339Utc, nowUtc } from "../core/model.ts";
import { replaceFileDurably } from "../persistence/file-replacement.ts";
import { exactKeys, isObject } from "../util.ts";

export function defaultSetupConfigPath(): string {
    return join(homedir(), ".ember", "config", "setup.json");
}

export function defaultSetupStatePath(): string {
    return join(homedir(), ".ember", "state", "continuity.json");
}

export async function loadSetupConfig(path: string): Promise<SetupConfig | null> {
    let text: string;
    try {
        text = await readFile(path, "utf8");
    } catch (error) {
        if (hasCode(error, "ENOENT")) return null;
        throw new ValidationError("cannot read machine-local setup configuration");
    }
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new ValidationError("invalid machine-local setup JSON; preserve it for recovery");
    }
    if (
        !isObject(value) ||
        !exactKeys(
            value,
            value.version === 2
                ? [
                      "version",
                      "googleCalendarConfigPath",
                      "intent",
                      "statePath",
                      "principal",
                      "lineageId",
                      "establishedAt",
                      "provider",
                      "verification",
                      "continuity",
                      "cancellationRequested",
                      "updatedAt",
                  ]
                : [
                      "version",
                      "intent",
                      "statePath",
                      "principal",
                      "lineageId",
                      "establishedAt",
                      "provider",
                      "verification",
                      "continuity",
                      "cancellationRequested",
                      "updatedAt",
                  ],
        ) ||
        (value.version !== 1 && value.version !== 2) ||
        (value.version === 2 &&
            (!safeText(value.googleCalendarConfigPath) || !isAbsolute(value.googleCalendarConfigPath))) ||
        typeof value.cancellationRequested !== "boolean" ||
        typeof value.intent !== "string" ||
        !["create-new", "restore-existing", "use-existing"].includes(String(value.intent)) ||
        !safeText(value.statePath) ||
        !isAbsolute(value.statePath) ||
        !safeText(value.principal) ||
        !safeText(value.lineageId) ||
        !value.lineageId.startsWith("lineage-") ||
        !isRfc3339Utc(value.establishedAt) ||
        !isRfc3339Utc(value.updatedAt) ||
        typeof value.verification !== "string" ||
        ![
            "not_attempted",
            "requested",
            "verified",
            "failed",
            "timed_out",
            "cancellation_requested",
            "outcome_unknown",
        ].includes(String(value.verification)) ||
        typeof value.continuity !== "string" ||
        !["pending", "requested", "available", "outcome_unknown"].includes(String(value.continuity)) ||
        !isObject(value.provider) ||
        !exactKeys(
            value.provider,
            value.provider.kind === "ollama"
                ? value.provider.baseUrl === undefined
                    ? ["kind", "model", "timeoutSeconds"]
                    : ["kind", "model", "baseUrl", "timeoutSeconds"]
                : ["kind", "command", "model", "timeoutSeconds"],
        )
    )
        throw new ValidationError("invalid machine-local setup configuration; preserve it for recovery");
    validateSetupProvider(value.provider);
    return value as unknown as SetupConfig;
}

function validateLocalPath(path: string, label: string): void {
    if (!isAbsolute(path) || !safeText(path))
        throw new ValidationError(`${label} path must be absolute and contain no control characters`);
}

export async function exists(path: string): Promise<boolean> {
    try {
        await lstat(path);
        return true;
    } catch (error) {
        if (hasCode(error, "ENOENT")) return false;
        throw error;
    }
}

function hasCode(error: unknown, code: string): boolean {
    return isObject(error) && error.code === code;
}

// Resolve parent aliases even for not-yet-created files before comparing destinations.
async function physicalPath(path: string): Promise<string> {
    try {
        return await realpath(path);
    } catch (error) {
        if (!hasCode(error, "ENOENT")) throw error;
        const parent = dirname(path);
        if (parent === path) throw error;
        return join(await physicalPath(parent), basename(path));
    }
}

export async function writeConfig(path: string, config: SetupConfig): Promise<void> {
    config.updatedAt = nowUtc();
    await replaceFileDurably(path, `${JSON.stringify(config, null, 2)}\n`, {
        durabilityUncertainMessage: "setup configuration may be visible; inspect it before retrying",
    });
}

export async function resolveSetupPath(path: string, label: string): Promise<string> {
    const requested = resolve(path);
    validateLocalPath(requested, label);
    const physical = await physicalPath(requested);
    validateLocalPath(physical, label);
    return physical;
}
