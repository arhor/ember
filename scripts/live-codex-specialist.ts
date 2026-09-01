#!/usr/bin/env node
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createSpecialistEpisode, runCodexSpecialist } from "../src/ember/codex-specialist.ts";

if (process.env.EMBER_RUN_LIVE_SPECIALIST !== "1") {
  process.stderr.write("Set EMBER_RUN_LIVE_SPECIALIST=1 to run the opt-in Codex specialist scenario.\n");
  process.exitCode = 2;
} else {
  const root = await mkdtemp(join(tmpdir(), "ember-live-specialist-"));
  const workspace = join(root, "controlled-workspace");
  await mkdir(workspace);
  await writeFile(join(workspace, "README.md"), "# Controlled Ember specialist fixture\n\nDo not access paths or services outside this directory.\n");
  const spec = createSpecialistEpisode({
    objective: "Create greeting.txt containing exactly: hello from bounded Codex specialist",
    acceptance: ["greeting.txt is the only changed artifact", "Its content is exactly the requested text followed by a newline"],
    context_projection: [{ content: "This is an ephemeral controlled fixture created for issue #60.", provenance: "Ember live validation harness", currentness: "current" }],
    authority_envelope: { principal: "local-user", grant: "Modify only the controlled workspace for this validation", permitted_actions: ["inspect files and create greeting.txt inside the selected workspace"], prohibited_actions: ["network access", "access outside the selected workspace", "modify any other file"], escalation_conditions: ["any additional access or consequential action is needed"] },
    workspace: { path: resolve(workspace), expected_identity: "ephemeral issue-60 controlled work fixture", preserve_existing_changes: true },
    currentness_basis: "live validation objective as launched",
  });
  try {
    const record = await runCodexSpecialist(spec, { recordPath: join(root, "episode.json"), timeoutSeconds: 180 });
    if (record.report_state === "ambiguous") throw new Error(`Codex returned an ambiguous boundary result: ${JSON.stringify(record.observations)}`);
    try { await access(join(workspace, "greeting.txt")); } catch {
      throw new Error(`Codex did not create the controlled artifact: ${JSON.stringify({ runtime_state: record.runtime_state, report_state: record.report_state, observations: record.observations, report: record.report })}`);
    }
    const content = await readFile(join(workspace, "greeting.txt"), "utf8");
    assert.equal(content, "hello from bounded Codex specialist\n");
    process.stdout.write(`${JSON.stringify({ episode_id: spec.episode_id, runtime_state: record.runtime_state, report_state: record.report_state, ember_disposition: record.ember_disposition, external_thread_recorded_as_operational_metadata: Boolean(record.external_thread_id), controlled_artifact_verified: true, report: record.report }, null, 2)}\n`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
