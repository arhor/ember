import type { Run, Session } from "@ember/agent";
import type { RunRepository, SessionRepository } from "@ember/engine";

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { replaceFileDurably } from "./persistence/file-replacement.ts";

const states = new Set(["queued", "running", "completed", "failed", "cancelled"]);

/** Separate operational records: reopening never resumes a run or invokes cognition. */
abstract class FileRecords<T extends { readonly id: string }> {
    readonly directory: string;
    constructor(statePath: string, kind: string) {
        if (!statePath.trim()) throw new Error("Engine repository requires a state path");
        this.directory = join(`${statePath}.engine`, kind);
    }
    private path(id: string) {
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid engine record ID");
        return join(this.directory, `${id}.json`);
    }
    abstract validate(record: unknown): asserts record is T;
    async get(id: string): Promise<T | undefined> {
        let text: string;
        try {
            text = await readFile(this.path(id), "utf8");
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
            throw error;
        }
        const record: unknown = JSON.parse(text);
        this.validate(record);
        if (record.id !== id) throw new Error("Engine record identity mismatch");
        return record;
    }
    async save(record: T): Promise<void> {
        this.validate(record);
        const path = this.path(record.id);
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        await replaceFileDurably(path, `${JSON.stringify(record)}\n`, {
            mode: 0o600,
            durabilityUncertainMessage: "Engine record replacement may be visible but durability is uncertain",
        });
    }
}

export class FileSessionRepository extends FileRecords<Session> implements SessionRepository {
    constructor(statePath: string) {
        super(statePath, "sessions");
    }
    validate(record: unknown): asserts record is Session {
        if (
            typeof record !== "object" ||
            record === null ||
            !("id" in record) ||
            typeof record.id !== "string" ||
            !("agentId" in record) ||
            typeof record.agentId !== "string"
        )
            throw new Error("Invalid session record");
    }
}
export class FileRunRepository extends FileRecords<Run> implements RunRepository {
    constructor(statePath: string) {
        super(statePath, "runs");
    }
    validate(record: unknown): asserts record is Run {
        if (
            typeof record !== "object" ||
            record === null ||
            !("id" in record) ||
            typeof record.id !== "string" ||
            !("sessionId" in record) ||
            typeof record.sessionId !== "string" ||
            !("state" in record) ||
            typeof record.state !== "string" ||
            !states.has(record.state)
        )
            throw new Error("Invalid run record");
    }
}
