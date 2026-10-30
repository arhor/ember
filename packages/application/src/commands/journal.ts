import type { InteractionEvent, DeliveryObservation } from "../app/contract.ts";
import type { WriteLease } from "../ports/persistence/state-store.ts";

export interface CommandRecord {
    continuity: { lineageId: string; establishedAt: string };
    mode: "command" | "interaction";
    event: InteractionEvent;
    attempts: Array<{ startedAt: string; observation: DeliveryObservation | null }>;
    retryAt: number | null;
    key: string;
    digest: string;
    status: "admitted" | "completed";
    text: string | null;
    delivery: "pending" | "started" | "confirmed" | "failed" | "uncertain";
}
export interface CommandJournalDocument {
    version: 1;
    commands: CommandRecord[];
}
export interface CommandJournal {
    acquireWriteLease(): Promise<WriteLease>;
    releaseWriteLease(lease: WriteLease): Promise<void>;
    load(): Promise<CommandJournalDocument>;
    save(document: CommandJournalDocument): Promise<void>;
}
