import type { MemoryProposalGenerationOutcome } from "@ember/application/memory/memory-proposal-generation.ts";
import type { EvidenceId } from "@ember/domain/model.ts";
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
export interface MemoryProposalGenerationStore {
    readonly path: string;
    load(): Promise<MemoryProposalGenerationDocument>;
    append(record: MemoryProposalGenerationRecord): Promise<void>;
    complete(
        generationId: string,
        update: Pick<MemoryProposalGenerationRecord, "completed_at" | "status" | "outcomes" | "failure">,
    ): Promise<void>;
}
