import type { Run, Session } from "@ember/agent";

/** save must atomically replace a record or reject without changing it. */
export interface SessionRepository {
    get(id: string): Promise<Session | undefined>;
    save(session: Session): Promise<void>;
}

/** save must atomically replace a record or reject without changing it. */
export interface RunRepository {
    get(id: string): Promise<Run | undefined>;
    save(run: Run): Promise<void>;
}

export class InMemorySessionRepository implements SessionRepository {
    readonly #records = new Map<string, Session>();
    async get(id: string): Promise<Session | undefined> {
        const record = this.#records.get(id);
        return record === undefined ? undefined : { ...record };
    }
    async save(session: Session): Promise<void> {
        this.#records.set(session.id, { ...session });
    }
}

export class InMemoryRunRepository implements RunRepository {
    readonly #records = new Map<string, Run>();
    async get(id: string): Promise<Run | undefined> {
        const record = this.#records.get(id);
        return record === undefined ? undefined : { ...record };
    }
    async save(run: Run): Promise<void> {
        this.#records.set(run.id, { ...run });
    }
}
