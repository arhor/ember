import type { CognitionId, MeaningId } from "../core/model.ts";
import type { Projection } from "../core/projection.ts";

import { ProviderError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";

export const CONTRACT_VERSION = 1;
export const MAX_STDOUT_BYTES = 1024 * 1024;
export const MAX_STDERR_BYTES = 64 * 1024;
export const MAX_PROVIDER_TIMEOUT_SECONDS = 2_147_483_647 / 1000;

export interface ProviderRequest {
    contractVersion: 1;
    cognitionId: CognitionId;
    projection: Projection;
    input: { text: string };
}

export interface ProviderResult {
    contractVersion: 1;
    reply: string;
    usedMeaningIds: MeaningId[];
    operational?: {
        externalThreadId: string;
    };
}

export interface ProviderInvocationOptions {
    timeoutSeconds: number;
    signal?: AbortSignal;
}

export type ProviderInvoker = (
    command: string,
    arguments_: string[],
    request: ProviderRequest,
    options: ProviderInvocationOptions,
) => Promise<ProviderResult>;

export function validateProviderResult(
    result: unknown,
    selected: ReadonlySet<MeaningId | string>,
): asserts result is ProviderResult {
    if (result === null || typeof result !== "object" || Array.isArray(result))
        throw new ProviderError("provider result must be an object");
    const object = result as Record<string, unknown>;
    const fields = Object.keys(object).sort();
    const requiredFields = ["contractVersion", "reply", "usedMeaningIds"].sort();
    const allowedFields = [...requiredFields, "operational"].sort();
    if (
        JSON.stringify(fields) !== JSON.stringify(requiredFields) &&
        JSON.stringify(fields) !== JSON.stringify(allowedFields)
    )
        throw new ProviderError("provider result contains missing or unsupported fields");
    if (!Number.isSafeInteger(object.contractVersion) || object.contractVersion !== 1)
        throw new ProviderError("provider result contractVersion is unsupported");
    if (typeof object.reply !== "string" || !object.reply.trim())
        throw new ProviderError("provider reply must be non-empty");
    if (!Array.isArray(object.usedMeaningIds) || !object.usedMeaningIds.every((v) => typeof v === "string"))
        throw new ProviderError("usedMeaningIds must be a string list");
    if (new Set(object.usedMeaningIds).size !== object.usedMeaningIds.length)
        throw new ProviderError("usedMeaningIds must not contain duplicates");
    if (!object.usedMeaningIds.every((id) => selected.has(id as string)))
        throw new ProviderError("provider claimed a meaning outside its projection");
    if ("operational" in object) {
        if (object.operational === null || typeof object.operational !== "object" || Array.isArray(object.operational))
            throw new ProviderError("provider operational evidence must be an object");
        const operational = object.operational as Record<string, unknown>;
        if (JSON.stringify(Object.keys(operational).sort()) !== JSON.stringify(["externalThreadId"]))
            throw new ProviderError("provider operational evidence contains missing or unsupported fields");
        if (
            typeof operational.externalThreadId !== "string" ||
            !operational.externalThreadId.trim() ||
            operational.externalThreadId.length > 512 ||
            ASCII_CONTROL_CHARACTER_PATTERN.test(operational.externalThreadId)
        )
            throw new ProviderError("provider external thread ID is invalid");
    }
}
