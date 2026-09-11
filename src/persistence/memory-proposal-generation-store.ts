import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { EvidenceId } from "../core/model.ts";
import type { MemoryProposalGenerationOutcome } from "../memory/memory-proposal-generation.ts";

import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { isRfc3339Utc } from "../core/model.ts";
import { exactKeys, isNotBlankString, isObject } from "../util.ts";
import { replaceFileDurably } from "./file-replacement.ts";

export type MemoryProposalGenerationStatus =
    | "generating"
    | "completed"
    | "failed"
    | "timed_out"
    | "cancellation_requested"
    | "outcome_unknown";

export interface MemoryProposalGenerationRecord {
    generation_id: `memory-generation-${string}`;
    proposed_at: string;
    completed_at: string | null;
    principal: string;
    scope: string;
    provider_label: string;
    source_evidence_ids: EvidenceId[];
    status: MemoryProposalGenerationStatus;
    outcomes: MemoryProposalGenerationOutcome[];
    failure: string | null;
}

export interface MemoryProposalGenerationDocument {
    memory_proposal_generation_version: 1;
    generations: MemoryProposalGenerationRecord[];
}

export class MemoryProposalGenerationStore {
    readonly path: string;

    constructor(canonicalStatePath: string) {
        this.path = `${canonicalStatePath}.memory-proposals.json`;
    }

    async load(): Promise<MemoryProposalGenerationDocument> {
        try {
            const parsed: unknown = JSON.parse(await readFile(this.path, "utf8"));
            validateMemoryProposalGenerationDocument(parsed);
            return parsed;
        } catch (error) {
            if (errorCode(error) === "ENOENT") {
                return { memory_proposal_generation_version: 1, generations: [] };
            }
            if (error instanceof ValidationError) throw error;
            throw new StoreUnavailable(`cannot read memory proposal generation ledger: ${errorMessage(error)}`, {
                cause: error,
            });
        }
    }

    async append(record: MemoryProposalGenerationRecord) {
        const document = await this.load();
        if (document.generations.some((item) => item.generation_id === record.generation_id))
            throw new ValidationError(`memory proposal generation already exists: ${record.generation_id}`);
        document.generations.push(structuredClone(record));
        await this.replace(document);
    }

    async complete(
        generationId: string,
        update: Pick<MemoryProposalGenerationRecord, "completed_at" | "status" | "outcomes" | "failure">,
    ) {
        const document = await this.load();
        const record = document.generations.find((item) => item.generation_id === generationId);
        if (!record) throw new ValidationError(`memory proposal generation does not exist: ${generationId}`);
        if (record.status !== "generating")
            throw new ValidationError(`memory proposal generation is already terminal: ${generationId}`);
        Object.assign(record, structuredClone(update));
        await this.replace(document);
    }

    private async replace(document: MemoryProposalGenerationDocument) {
        validateMemoryProposalGenerationDocument(document);
        await mkdir(dirname(this.path), { recursive: true });
        await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            durabilityUncertainMessage:
                "memory proposal ledger replacement may be visible, but directory synchronization failed",
        });
    }
}

export function validateMemoryProposalGenerationDocument(
    value: unknown,
): asserts value is MemoryProposalGenerationDocument {
    if (
        !isObject(value) ||
        !exactKeys(value, ["generations", "memory_proposal_generation_version"]) ||
        value.memory_proposal_generation_version !== 1 ||
        !Array.isArray(value.generations)
    ) {
        throw new ValidationError("memory proposal generation document is invalid");
    }
    const ids = new Set<string>();
    for (const record of value.generations) {
        if (
            !isObject(record) ||
            !exactKeys(record, [
                "completed_at",
                "failure",
                "generation_id",
                "outcomes",
                "principal",
                "proposed_at",
                "provider_label",
                "scope",
                "source_evidence_ids",
                "status",
            ]) ||
            !isNotBlankString(record.generation_id) ||
            !record.generation_id.startsWith("memory-generation-") ||
            ids.has(record.generation_id) ||
            !isRfc3339Utc(record.proposed_at) ||
            !isNotBlankString(record.principal) ||
            !isNotBlankString(record.scope) ||
            !isNotBlankString(record.provider_label) ||
            !Array.isArray(record.source_evidence_ids) ||
            !record.source_evidence_ids.every(isNotBlankString) ||
            !Array.isArray(record.outcomes) ||
            !["generating", "completed", "failed", "timed_out", "cancellation_requested", "outcome_unknown"].includes(
                String(record.status),
            )
        ) {
            throw new ValidationError("memory proposal generation record is invalid");
        }
        ids.add(record.generation_id);
        if (record.status === "generating") {
            if (record.completed_at !== null || record.failure !== null || record.outcomes.length !== 0)
                throw new ValidationError("generating memory proposal record contains a terminal outcome");
        } else if (!isRfc3339Utc(record.completed_at)) {
            throw new ValidationError("terminal memory proposal record requires completion time");
        }
        if (record.status === "completed" && record.failure !== null)
            throw new ValidationError("completed memory proposal record cannot contain failure");
        if (record.status !== "completed" && record.status !== "generating" && !isNotBlankString(record.failure))
            throw new ValidationError("failed memory proposal record requires a bounded failure description");
    }
}

function errorCode(error: unknown) {
    return isObject(error) && typeof error.code === "string" ? error.code : null;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
