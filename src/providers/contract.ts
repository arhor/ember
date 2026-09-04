import { ProviderError } from "../core/errors.ts";
import type { CognitionId, MeaningId } from "../core/model.ts";
import type { Projection } from "../core/projection.ts";

export const CONTRACT_VERSION = 1;
export const MAX_STDOUT_BYTES = 1024 * 1024;
export const MAX_STDERR_BYTES = 64 * 1024;
export const MAX_PROVIDER_TIMEOUT_SECONDS = 2_147_483_647 / 1000;

export interface ProviderRequest {
    contract_version: 1;
    cognition_id: CognitionId;
    projection: Projection;
    input: { text: string };
}

export interface ProviderResult {
    contract_version: 1;
    reply: string;
    used_meaning_ids: MeaningId[];
    operational?: {
        external_thread_id: string;
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
    const requiredFields = ["contract_version", "reply", "used_meaning_ids"].sort();
    const allowedFields = [...requiredFields, "operational"].sort();
    if (
        JSON.stringify(fields) !== JSON.stringify(requiredFields) &&
        JSON.stringify(fields) !== JSON.stringify(allowedFields)
    )
        throw new ProviderError("provider result contains missing or unsupported fields");
    if (!Number.isSafeInteger(object.contract_version) || object.contract_version !== 1)
        throw new ProviderError("provider result contract_version is unsupported");
    if (typeof object.reply !== "string" || !object.reply.trim())
        throw new ProviderError("provider reply must be non-empty");
    if (!Array.isArray(object.used_meaning_ids) || !object.used_meaning_ids.every((v) => typeof v === "string"))
        throw new ProviderError("used_meaning_ids must be a string list");
    if (new Set(object.used_meaning_ids).size !== object.used_meaning_ids.length)
        throw new ProviderError("used_meaning_ids must not contain duplicates");
    if (!object.used_meaning_ids.every((id) => selected.has(id as string)))
        throw new ProviderError("provider claimed a meaning outside its projection");
    if ("operational" in object) {
        if (object.operational === null || typeof object.operational !== "object" || Array.isArray(object.operational))
            throw new ProviderError("provider operational evidence must be an object");
        const operational = object.operational as Record<string, unknown>;
        if (JSON.stringify(Object.keys(operational).sort()) !== JSON.stringify(["external_thread_id"]))
            throw new ProviderError("provider operational evidence contains missing or unsupported fields");
        if (
            typeof operational.external_thread_id !== "string" ||
            !operational.external_thread_id.trim() ||
            operational.external_thread_id.length > 512 ||
            /[\u0000-\u001f\u007f]/.test(operational.external_thread_id)
        )
            throw new ProviderError("provider external thread ID is invalid");
    }
}
