import type { CommandJournalDocument, CommandJournal } from "@ember/application/commands/journal.ts";
import type { WriteLease } from "@ember/application/ports/persistence/state-store.ts";

import { validateInteractionEvent, validateDeliveryObservation } from "@ember/application/app/contract.ts";
import { ValidationError } from "@ember/domain/errors.ts";
import { contentDigest, isObject } from "@ember/domain/util.ts";
import { readFile } from "node:fs/promises";

import { replaceFileDurably } from "../persistence/file-replacement.ts";
import { StateStore } from "../persistence/state-store.ts";

export class FileCommandJournal implements CommandJournal {
    readonly path: string;
    private readonly lock: StateStore;
    constructor(statePath: string) {
        this.path = statePath + ".commands.json";
        this.lock = new StateStore(this.path);
    }
    acquireWriteLease() {
        return this.lock.acquireWriteLease();
    }
    releaseWriteLease(lease: WriteLease) {
        if (lease !== this.lock.lease) throw new ValidationError("command journal lease mismatch");
        return this.lock.releaseWriteLease();
    }
    async load(): Promise<CommandJournalDocument> {
        let value: unknown;
        try {
            value = JSON.parse(await readFile(this.path, "utf8"));
        } catch (error) {
            if (isObject(error) && error.code === "ENOENT") return { version: 1, commands: [] };
            throw error;
        }
        if (!isObject(value) || value.version !== 1 || !Array.isArray(value.commands))
            throw new ValidationError("invalid command journal");
        const keys = new Set<string>();
        for (const record of value.commands) {
            if (
                !isObject(record) ||
                typeof record.key !== "string" ||
                !isObject(record.continuity) ||
                typeof record.continuity.lineageId !== "string" ||
                typeof record.continuity.establishedAt !== "string" ||
                keys.has(record.key) ||
                typeof record.digest !== "string" ||
                !["command", "interaction"].includes(String(record.mode)) ||
                !Array.isArray(record.attempts) ||
                !(record.retryAt === null || (typeof record.retryAt === "number" && Number.isFinite(record.retryAt))) ||
                !["admitted", "completed"].includes(String(record.status)) ||
                !["pending", "started", "confirmed", "failed", "uncertain"].includes(String(record.delivery)) ||
                !(record.text === null || typeof record.text === "string") ||
                (record.status === "completed" && typeof record.text !== "string")
            )
                throw new ValidationError("invalid command journal record");
            validateInteractionEvent(record.event);
            if (
                !record.event.externalOccurrence ||
                record.key !== JSON.stringify([record.event.surfaceId, record.event.externalOccurrence.occurrenceId]) ||
                record.digest !== contentDigest(JSON.stringify(record.event))
            )
                throw new ValidationError("invalid command journal correlation");
            for (const attempt of record.attempts) {
                if (
                    !isObject(attempt) ||
                    typeof attempt.startedAt !== "string" ||
                    !Number.isFinite(Date.parse(attempt.startedAt))
                )
                    throw new ValidationError("invalid command delivery attempt");
                if (attempt.observation !== null) validateDeliveryObservation(attempt.observation);
            }
            keys.add(record.key);
        }
        return value as unknown as CommandJournalDocument;
    }
    async save(document: CommandJournalDocument) {
        if (!this.lock.lease) throw new ValidationError("command journal requires a writer lease");
        await replaceFileDurably(this.path, JSON.stringify(document) + "\n", {
            durabilityUncertainMessage: "command journal durability is uncertain",
        });
    }
}
