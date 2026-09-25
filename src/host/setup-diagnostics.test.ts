import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createSetupDiagnostics } from "./setup-diagnostics.ts";

test("setup diagnostics should retain only allowlisted redacted records when a probe fails", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-setup-diagnostics-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const diagnostics = await createSetupDiagnostics(directory);

    // When
    await diagnostics.record({
        event: "probe_failed",
        at: "2026-09-24T12:00:00Z",
        provider: "ollama",
        outcome: "failed",
        errorClass: "ProviderError",
        category: "provider_api",
        configuredTimeoutSeconds: 60,
        durationMs: 42,
        statusCode: 404,
    });

    // Then
    const [directoryStats, fileStats, text] = await Promise.all([
        stat(directory),
        stat(diagnostics.path),
        readFile(diagnostics.path, "utf8"),
    ]);
    assert.equal(directoryStats.mode & 0o777, 0o700);
    assert.equal(fileStats.mode & 0o777, 0o600);
    assert.deepEqual(JSON.parse(text), {
        event: "probe_failed",
        at: "2026-09-24T12:00:00Z",
        provider: "ollama",
        outcome: "failed",
        errorClass: "ProviderError",
        category: "provider_api",
        configuredTimeoutSeconds: 60,
        durationMs: 42,
        statusCode: 404,
    });
});

test("setup diagnostics should remove its transient log when a probe succeeds", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-setup-diagnostics-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const diagnostics = await createSetupDiagnostics(directory);
    await diagnostics.record({
        event: "probe_started",
        at: "2026-09-24T12:00:00Z",
        provider: "codex",
        modelConfigured: false,
        node: "v26.8.1",
        platform: "darwin",
    });

    // When
    await diagnostics.discard();

    // Then
    await assert.rejects(stat(diagnostics.path), { code: "ENOENT" });
});
