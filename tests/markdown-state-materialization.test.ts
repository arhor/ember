import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { supersede } from "../src/core/semantics.ts";
import { buildStateMaterialization } from "../src/core/state-materialization.ts";
import { publishMarkdownStateViews, renderMarkdownStateViews } from "../src/persistence/markdown-state-materializer.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { cloneState } from "../src/util.ts";
import { command, populatedState, PRINCIPAL, RELATIONSHIP_SCOPE, SCOPE, tempDir } from "./support.ts";

test("Markdown v1 is deterministic and carries stable semantic and evidence references", () => {
    const { state, ids } = populatedState();
    const policy = { principal: PRINCIPAL, scope: SCOPE };
    const first = renderMarkdownStateViews(buildStateMaterialization(state, policy));
    const second = renderMarkdownStateViews(buildStateMaterialization(cloneState(state), policy));

    assert.deepEqual(second, first);
    assert.match(first["SELF.md"], new RegExp(ids.commitment));
    assert.match(first["USER.md"], new RegExp(ids.preference));
    assert.match(first["MEMORY.md"], /interaction-mode: generated_only/);
    assert.match(first["MEMORY.md"], /source-revision: 0/);
});

test("Markdown v1 shows supersession and provenance without flattening stale meaning", () => {
    const { state, ids } = populatedState();
    const replacement = supersede(state, PRINCIPAL, ids.preference, "Prefer detailed rationale", {
        reason: "Preference changed",
    });
    const markdown = renderMarkdownStateViews(buildStateMaterialization(state, { principal: PRINCIPAL, scope: SCOPE }))[
        "USER.md"
    ];

    assert.equal(markdown.includes(`Meaning \`${ids.preference}\``), true);
    assert.match(markdown, /Currentness: `superseded`/);
    assert.equal(markdown.includes(`superseded by \`${replacement}\``), true);
    assert.match(markdown, /Source evidence:/);
});

test("materialization excludes other scopes and all retained evidence payloads", () => {
    const { state, ids } = populatedState();
    const secret = state.evidence.find((item) => item.evidenceId === ids.detail);
    assert.equal(secret.payload, "Cinder");

    const scoped = renderMarkdownStateViews(buildStateMaterialization(state, { principal: PRINCIPAL, scope: SCOPE }));
    const relationship = renderMarkdownStateViews(
        buildStateMaterialization(state, { principal: PRINCIPAL, scope: RELATIONSHIP_SCOPE }),
    );

    assert.equal(JSON.stringify(scoped).includes("Cinder"), false);
    assert.equal(scoped["MEMORY.md"].includes(ids.fact), false);
    assert.equal(relationship["MEMORY.md"].includes(ids.fact), true);
    assert.equal(JSON.stringify(relationship).includes("Cinder"), false);
});

test("CLI publishes generated-only views as private files without changing canonical state", async () => {
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const output = join(directory, "views");
    const { state } = populatedState();
    await new StateStore(statePath).create(state);
    const before = await readFile(statePath, "utf8");

    const result = await command([
        "materialize",
        "--state",
        statePath,
        "--principal",
        PRINCIPAL,
        "--scope",
        SCOPE,
        "--output",
        output,
    ]);

    assert.equal(result.code, 0, result.stderr);
    assert.equal(await readFile(statePath, "utf8"), before);
    assert.match(await readFile(join(output, "MEMORY.md"), "utf8"), /Generated-only inspection view/);
    assert.equal((await stat(join(output, "MEMORY.md"))).mode & 0o777, 0o600);
});

test("publishing unchanged state replaces drift deterministically", async () => {
    const directory = await tempDir();
    const materialization = buildStateMaterialization(populatedState().state, {
        principal: PRINCIPAL,
        scope: SCOPE,
    });
    await publishMarkdownStateViews(directory, materialization);
    const expected = await readFile(join(directory, "MEMORY.md"), "utf8");
    await writeFile(join(directory, "MEMORY.md"), "drift\n");

    await publishMarkdownStateViews(directory, materialization);

    assert.equal(await readFile(join(directory, "MEMORY.md"), "utf8"), expected);
});
