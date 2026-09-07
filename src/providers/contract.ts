import type { CognitionId, MeaningId } from "../core/model.ts";
import type { Projection } from "../core/projection.ts";

import { ProviderError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";
import { exactKeys, isObject } from "../util.ts";

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

export type ProviderInvoker = (request: ProviderRequest, options: ProviderInvocationOptions) => Promise<ProviderResult>;

export function validateProviderResult(
    result: unknown,
    selected: ReadonlySet<MeaningId | string>,
): asserts result is ProviderResult {
    if (!isObject(result)) throw new ProviderError("provider result must be an object");
    const requiredFields = ["contractVersion", "reply", "usedMeaningIds"];
    const allowedFields = [...requiredFields, "operational"];
    if (!exactKeys(result, requiredFields) && !exactKeys(result, allowedFields))
        throw new ProviderError("provider result contains missing or unsupported fields");
    if (!Number.isSafeInteger(result.contractVersion) || result.contractVersion !== 1)
        throw new ProviderError("provider result contractVersion is unsupported");
    if (typeof result.reply !== "string" || !result.reply.trim())
        throw new ProviderError("provider reply must be non-empty");
    if (!Array.isArray(result.usedMeaningIds) || !result.usedMeaningIds.every((v) => typeof v === "string"))
        throw new ProviderError("usedMeaningIds must be a string list");
    if (new Set(result.usedMeaningIds).size !== result.usedMeaningIds.length)
        throw new ProviderError("usedMeaningIds must not contain duplicates");
    if (!result.usedMeaningIds.every((id) => selected.has(id as string)))
        throw new ProviderError("provider claimed a meaning outside its projection");
    if ("operational" in result) {
        if (!isObject(result.operational)) throw new ProviderError("provider operational evidence must be an object");
        if (!exactKeys(result.operational, ["externalThreadId"]))
            throw new ProviderError("provider operational evidence contains missing or unsupported fields");
        if (
            typeof result.operational.externalThreadId !== "string" ||
            !result.operational.externalThreadId.trim() ||
            result.operational.externalThreadId.length > 512 ||
            ASCII_CONTROL_CHARACTER_PATTERN.test(result.operational.externalThreadId)
        )
            throw new ProviderError("provider external thread ID is invalid");
    }
}
