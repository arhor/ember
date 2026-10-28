import type { Session } from "@ember/agent";

import { randomUUID } from "node:crypto";

import type { SessionRepository } from "./repositories.ts";

export async function resolveSession(repository: SessionRepository, agentId: string, id?: string): Promise<Session> {
    if (id !== undefined) {
        const session = await repository.get(id);
        if (session === undefined) throw new Error(`Session not found: ${id}`);
        if (session.agentId !== agentId) throw new Error(`Session does not belong to agent: ${id}`);
        return session;
    }
    const session: Session = { id: randomUUID(), agentId };
    await repository.save(session);
    return session;
}
