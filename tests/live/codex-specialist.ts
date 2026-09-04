#!/usr/bin/env node
import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createSpecialistEpisode, runCodexSpecialist } from "../../src/delegation/codex-specialist.ts";

if (process.env.EMBER_RUN_LIVE_SPECIALIST !== "1") {
    process.stderr.write("Set EMBER_RUN_LIVE_SPECIALIST=1 to run the opt-in Codex specialist scenario.\n");
    process.exitCode = 2;
} else {
    const root = await mkdtemp(join(tmpdir(), "ember-live-specialist-"));
    const workspace = join(root, "controlled-workspace");
    await mkdir(workspace);
    await writeFile(
        join(workspace, "README.md"),
        "# Controlled Ember specialist fixture\n\nDo not access paths or services outside this directory.\n",
    );
    const baseline = await workspaceSnapshot(workspace);
    const spec = createSpecialistEpisode({
        objective: "Create greeting.txt containing exactly: hello from bounded Codex specialist",
        acceptance: [
            "greeting.txt is the only changed artifact",
            "Its content is exactly the requested text followed by a newline",
        ],
        context_projection: [
            {
                content: "This is an ephemeral controlled fixture for specialist authority/context validation.",
                provenance: "Ember live validation harness",
                scope: "project:ephemeral-specialist-validation",
                currentness: "current",
            },
        ],
        authority_envelope: {
            principal: "local-user",
            grant: "Modify only the controlled workspace for this validation",
            provenance: "explicit invocation of the controlled live validation harness by local-user",
            currentness: "current for this live validation attempt",
            permitted_actions: ["inspect files and create greeting.txt inside the selected workspace"],
            prohibited_actions: ["network access", "access outside the selected workspace", "modify any other file"],
            escalation_conditions: ["any additional access or consequential action is needed"],
        },
        runtime_capability: {
            filesystem: { scope: "selected_workspace", mode: "read_write" },
            network_reach: "not_established",
            tools: ["Codex runtime-selected workspace tools"],
            credentials: "allowlisted_runtime_auth",
        },
        workspace: {
            path: resolve(workspace),
            expected_identity: "ephemeral controlled work fixture",
            preserve_existing_changes: true,
        },
        runtime_policy: {
            command: "codex",
            argument_prefix: [],
            sandbox: "workspace-write",
            network: "no_additional_grant",
            configuration: "isolated",
            environment: "allowlisted_runtime_auth",
            timeout_seconds: 180,
            stdout_limit_bytes: 1024 * 1024,
            session_mode: "ephemeral",
        },
        currentness_basis: {
            objective_revision: "live-validation-objective-1",
            context_revision: "live-validation-context-1",
        },
    });

    try {
        const record = await runCodexSpecialist(spec, { recordPath: join(root, "episode.json") });
        assert.deepEqual(
            [record.runtime_state, record.report_state, record.report?.objective_disposition],
            ["exited", "reported_success", "completed"],
            `Codex did not return a successful report: ${JSON.stringify(record.observations)}`,
        );
        const expected = [
            ...baseline,
            ["greeting.txt", "file", Buffer.from("hello from bounded Codex specialist\n").toString("base64")],
        ].sort((left, right) => (left[0]! < right[0]! ? -1 : left[0]! > right[0]! ? 1 : 0));
        assert.deepEqual(
            await workspaceSnapshot(workspace),
            expected,
            "controlled workspace contained a collateral or unexpected change",
        );
        process.stdout.write(
            `${JSON.stringify(
                {
                    episode_id: spec.episode_id,
                    runtime_state: record.runtime_state,
                    report_state: record.report_state,
                    ember_disposition: record.ember_disposition,
                    report_provenance: record.report_provenance,
                    external_thread_recorded_as_operational_metadata: Boolean(record.external_thread_id),
                    controlled_artifact_verified: true,
                    report: record.report,
                },
                null,
                2,
            )}\n`,
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

async function workspaceSnapshot(root: string, relative = ""): Promise<string[][]> {
    const entries: string[][] = [];
    for (const name of (await readdir(join(root, relative))).sort()) {
        const path = join(relative, name);
        const metadata = await lstat(join(root, path));
        if (metadata.isDirectory()) entries.push([path, "directory"], ...(await workspaceSnapshot(root, path)));
        else if (metadata.isFile()) entries.push([path, "file", (await readFile(join(root, path))).toString("base64")]);
        else entries.push([path, "other"]);
    }
    return entries;
}
