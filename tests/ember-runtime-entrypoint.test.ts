import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { EpisodicRuntimeConfig, WakeIntent } from "../src/core/runtime/episodic-runtime.ts";

import { main } from "../bin/ember-runtime.ts";
import { EpisodicRecordStore } from "../src/core/runtime/episodic-runtime.ts";
import { PRINCIPAL, ROOT, SCOPE, tempDir } from "./support.ts";

test("run-wake dispatch does not require systemd configuration", async () => {
    const root = await tempDir();
    const configPath = join(root, "runtime.json");
    const config: EpisodicRuntimeConfig = {
        config_version: 1,
        state_path: join(root, "state.json"),
        records_directory: join(root, "records"),
        principal: PRINCIPAL,
        activeScope: SCOPE,
        node_path: process.execPath,
        runtime_entrypoint: join(ROOT, "bin", "ember-runtime.ts"),
        codex_command: "/usr/bin/false",
        codex_arguments: [],
        opportunity_timeout_seconds: 60,
        stop_timeout_seconds: 30,
    };
    await writeFile(configPath, `${JSON.stringify(config)}\n`);
    const intent: WakeIntent = {
        record_version: 1,
        wake_id: "wake-portable-worker",
        principal: PRINCIPAL,
        activeScope: SCOPE,
        mechanism: "external_timing",
        due_at: "2026-09-24T10:00:00Z",
        created_at: "2026-09-24T09:00:00Z",
    };
    const records = new EpisodicRecordStore(config.records_directory);
    await records.createWake(intent);
    await records.observeWake(intent.wake_id, {
        record_version: 1,
        kind: "dispatching",
        observedAt: "2026-09-24T10:00:00Z",
    });

    assert.equal(
        await main(["run-wake", "--config", configPath, "--wake-id", intent.wake_id], new AbortController().signal),
        0,
    );
});
