import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cognitionId, fixtureState, meaningId, type PersistentState } from "../src/model.ts";
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
    const candidate = supersedePreference(
        loaded,
        meaningId("meaning-preference-a"),
        "Prefer detailed architectural rationale",
    );
    const committed = await first.commit(loaded.revision, candidate, lease);
    await first.releaseWriteLease(lease);
    assert.equal(committed.revision, 1);

    const restarted = await new EvaluationStore(path).load();
    const old = restarted.meanings.find((meaning) => meaning.meaning_id === meaningId("meaning-preference-a"));
    const current = restarted.meanings.find(
        (meaning) => meaning.kind === "preference" && meaning.currentness === "current",
    );
    assert.equal(old?.currentness, "superseded");
    assert.equal(current?.content, "Prefer detailed architectural rationale");
    assert.notDeepEqual(current?.source_evidence_ids, old?.source_evidence_ids);
});

test("store validates a typed candidate again before replacing canonical state", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-ts-write-boundary-"));
    const path = join(directory, "continuity.json");
    const store = new EvaluationStore(path);
    await store.create(fixtureState());
    const lease = await store.acquireWriteLease();
    const loaded = await store.load();
    const candidate = structuredClone(loaded) as PersistentState;
    const mutable = candidate as unknown as { meanings: Array<Record<string, unknown>> };
    mutable.meanings.push({
        ...mutable.meanings[2],
        meaning_id: "meaning-preference-duplicate",
    });

    await assert.rejects(
        () => store.commit(loaded.revision, candidate, lease),
        /two current meanings share one semantic slot/,
    );
    await store.releaseWriteLease(lease);
    const unchanged = await new EvaluationStore(path).load();
    assert.equal(unchanged.revision, loaded.revision);
    assert.equal(unchanged.meanings.length, loaded.meanings.length);
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
    await assert.rejects(
        () =>
            invokeProvider(
                command,
                args,
                {
                    contract_version: 1,
                    cognition_id: cognitionId("cognition-timeout"),
                    projection,
                    input: { text: input.text },
                },
                { timeoutMs: 50, terminationGraceMs: 50 },
            ),
        /timed out/,
    );
});

test("restart reconstruction preserves corrected scoped meaning for a fresh provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-ts-restart-"));
    const path = join(directory, "continuity.json");
    const store = new EvaluationStore(path);
    await store.create(fixtureState());
    const lease = await store.acquireWriteLease();
    const before = await store.load();
    const candidate = supersedePreference(
        before,
        meaningId("meaning-preference-a"),
        "Prefer detailed architectural rationale",
    );
    await store.commit(before.revision, candidate, lease);
    await store.releaseWriteLease(lease);

    const restarted = await new EvaluationStore(path).load();
    const input = {
        text: "continue after restart",
        scope: "project:ember/docs",
        surface: "cli" as const,
    };
    const projection = buildProjection(restarted, "ordinary", input);
    assert.ok(projection.selection.meaning_ids.includes(meaningId("meaning-preference-a-successor")));
    assert.ok(!projection.selection.meaning_ids.includes(meaningId("meaning-preference-a")));
    assert.ok(!projection.selection.meaning_ids.includes(meaningId("meaning-fact")));
    assert.ok(!projection.selection.meaning_ids.includes(meaningId("meaning-episode")));

    const { command, args } = providerCommand();
    const result = await runCognition(command, args, restarted, input);
    assert.match(result.reply, /lineage-evaluation/);
    assert.deepEqual(result.used_meaning_ids, projection.selection.meaning_ids.slice(0, 2));
});
