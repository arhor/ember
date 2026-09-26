import type { CapabilityBinding, CapabilityExecutionLedger } from "../../capabilities/execution.ts";
import type { CognitionId, MeaningId } from "../model.ts";
import type { Projection } from "../projection.ts";

import { ProviderError } from "../errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../model.ts";
import { exactKeys, isObject } from "../util.ts";

export const AI_EXECUTION_CONTRACT_VERSION = 1;
export const MAX_STDOUT_BYTES = 1024 * 1024;
export const MAX_STDERR_BYTES = 64 * 1024;
export const MAX_AI_TIMEOUT_SECONDS = 2_147_483_647 / 1000;

export interface AiExecutionRequest {
    contractVersion: 1;
    cognitionId: CognitionId;
    projection: Projection;
    input: { text: string };
}

export interface AiExecutionResult {
    contractVersion: 1;
    reply: string;
    usedMeaningIds: MeaningId[];
    setupIntent?: "telegram" | null;
    operational?: {
        externalThreadId: string;
    };
}

export interface AiStreamObservation {
    kind: "provisional_text_snapshot";
    text: string;
}

export interface AiStreamObserver {
    observe(observation: AiStreamObservation): void | PromiseLike<void>;
}

export interface AiExecutionOptions {
    timeoutSeconds: number;
    signal?: AbortSignal | undefined;
    stream?: AiStreamObserver | undefined;
    capabilities?: readonly CapabilityBinding[] | undefined;
    capabilityLedger?: CapabilityExecutionLedger | undefined;
}

export type CapabilitySelector = (
    request: AiExecutionRequest,
    options: { signal?: AbortSignal | undefined },
) => readonly CapabilityBinding[] | Promise<readonly CapabilityBinding[]>;

// Transport and process launch configuration belongs inside the concrete provider adapter, not this semantic seam.
export type AiExecutor = (request: AiExecutionRequest, options: AiExecutionOptions) => Promise<AiExecutionResult>;

export function validateAiExecutionResult(
    result: unknown,
    selected: ReadonlySet<MeaningId | string>,
): asserts result is AiExecutionResult {
    if (!isObject(result)) throw new ProviderError("provider result must be an object");
    const requiredFields = ["contractVersion", "reply", "usedMeaningIds"];
    const allowedFields = [...requiredFields, "operational", "setupIntent"];
    if (
        !Object.keys(result).every((key) => allowedFields.includes(key)) ||
        !requiredFields.every((key) => key in result)
    )
        throw new ProviderError("provider result contains missing or unsupported fields");
    if ("setupIntent" in result && result.setupIntent !== null && result.setupIntent !== "telegram")
        throw new ProviderError("provider setup intent is invalid");
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
