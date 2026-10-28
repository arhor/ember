import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FileRunRepository, FileSessionRepository } from "./engine-repositories.ts";

test("operational runs survive reopening without resuming execution or changing canonical state", async () => {
    // Given separate operational repositories and a canonical state path.
    const directory = await mkdtemp(join(tmpdir(), "ember-engine-"));
    const path = join(directory, "state.json");
    try {
        const sessions = new FileSessionRepository(path);
        const runs = new FileRunRepository(path);
        await sessions.save({ id: "session-1", agentId: "ember" });
        await runs.save({ id: "run-1", sessionId: "session-1", state: "running" });
        // When repositories reopen after a process stops.
        const restored = await new FileRunRepository(path).get("run-1");
        // Then the last observed state remains inspectable; canonical state was never created.
        assert.equal(restored?.state, "running");
        assert.equal((await new FileSessionRepository(path).get("session-1"))?.agentId, "ember");
        await assert.rejects(readFile(path), { code: "ENOENT" });
        assert.equal(await runs.get("missing"), undefined);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("record IDs cannot escape their repository directory", async () => {
    // Given a repository receiving an untrusted identifier.
    const runs = new FileRunRepository(join(tmpdir(), "ember-engine-path-test"));
    // When traversal is requested, then it fails before reading a file.
    await assert.rejects(runs.get("../state"), /Invalid engine record ID/);
});
