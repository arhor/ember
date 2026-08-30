import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cognitionId, fixtureState, meaningId } from "../src/model.ts";
import { buildProjection } from "../src/projection.ts";
import { invokeProvider } from "../src/provider.ts";
import { runCognition } from "../src/runtime.ts";
import { supersedePreference } from "../src/semantics.ts";
import { EvaluationStore } from "../src/store.ts";

const fixture = fileURLToPath(new URL("../fixtures/provider.mjs", import.meta.url));

function providerCommand() {
  const command = process.env.EMBER_EVAL_PROVIDER_COMMAND ?? process.execPath;
  const prefix = JSON.parse(process.env.EMBER_EVAL_PROVIDER_PREFIX_ARGS ?? "[]") as string[];
  return { command, args: [...prefix, fixture] };
}

test("exclusive-create locking and fsync-rename-fsync replacement survive a fresh store instance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ember-ts-eval-"));
  const path = join(directory, "continuity.json");
  const first = new EvaluationStore(path);
  await first.create(fixtureState());

  const lease = await first.acquireWriteLease();
  const competing = new EvaluationStore(path);
  await assert.rejects(() => competing.acquireWriteLease(), /concurrent writer/);
  const loaded = await first.load();
  const candidate = supersedePreference(loaded, meaningId("meaning-preference-a"), "Prefer detailed architectural rationale");
  const committed = await first.commit(loaded.revision, candidate, lease);
  await first.releaseWriteLease(lease);
  assert.equal(committed.revision, 1);

  const restarted = await new EvaluationStore(path).load();
  assert.equal(restarted.revision, 1);
  assert.equal(restarted.meanings.find((meaning) => meaning.kind === "preference" && meaning.currentness === "current")?.content, "Prefer detailed architectural rationale");
});

test("provider subprocess uses bounded one-shot JSON and preserves projection separation", async () => {
  const state = fixtureState();
  const input = { text: "continue", scope: "project:ember/docs", surface: "cli" as const };
  const projection = buildProjection(state, "ordinary", input);
  const { command, args } = providerCommand();
  const result = await invokeProvider(command, args, {
    contract_version: 1,
    cognition_id: cognitionId("cognition-provider"),
    projection,
    input: { text: input.text },
  });
  assert.match(result.reply, /lineage-evaluation/);
  assert.deepEqual(result.used_meaning_ids, projection.selection.meaning_ids.slice(0, 2));
});

test("provider timeout terminates the direct child", async () => {
  const state = fixtureState();
  const input = { text: "hang", scope: "project:ember/docs", surface: "cli" as const };
  const projection = buildProjection(state, "ordinary", input);
  const { command, args } = providerCommand();
  await assert.rejects(() => invokeProvider(command, args, {
    contract_version: 1,
    cognition_id: cognitionId("cognition-timeout"),
    projection,
    input: { text: input.text },
  }, { timeoutMs: 50, terminationGraceMs: 50 }), /timed out/);
});

test("complete restart reconstruction feeds a newly built projection to a fresh provider", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ember-ts-restart-"));
  const path = join(directory, "continuity.json");
  await new EvaluationStore(path).create(fixtureState());
  const restarted = await new EvaluationStore(path).load();
  const { command, args } = providerCommand();
  const result = await runCognition(command, args, restarted, { text: "continue after restart", scope: "project:ember/docs", surface: "cli" });
  assert.match(result.reply, /lineage-evaluation/);
  assert.equal(restarted.lineage.lineage_id, "lineage-evaluation");
});
