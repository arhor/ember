import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { validateState } from "../src/core/model.ts";
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
    assert.match(first["MEMORY.md"], /interaction-mode: selective_proposal_authoring/);
    assert.match(first["MEMORY.md"], /source-revision: 0/);
});

test("supported USER.md content edit becomes an adopted supersession and regenerates views", async () => {
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const output = join(directory, "views");
    const { state, ids } = populatedState();
    await new StateStore(statePath).create(state);
    await command([
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
    const userPath = join(output, "USER.md");
    const before = await readFile(userPath, "utf8");
    await writeFile(userPath, before.replace("Prefer concise architectural rationale", "Prefer detailed answers"));

    const result = await command([
        "apply-materialized-edits",
        "--state",
        statePath,
        "--principal",
        PRINCIPAL,
        "--scope",
        SCOPE,
        "--input",
        output,
    ]);

    assert.equal(result.code, 0, result.stderr);
    const committed = await new StateStore(statePath).load();
    const old = committed.meanings.find((meaning) => meaning.meaningId === ids.preference)!;
    const replacement = committed.meanings.find((meaning) => meaning.supersedes === ids.preference)!;
    assert.deepEqual([old.currentness, old.supersededBy], ["superseded", replacement.meaningId]);
    assert.equal(replacement.content, "Prefer detailed answers");
    assert.deepEqual(replacement.sourceEvidenceIds, old.sourceEvidenceIds);
    assert.match(result.stdout, /"status": "adopted"/);
    assert.match(result.stdout, /"resulting_revision": 1/);
    assert.match(await readFile(userPath, "utf8"), /source-revision: 1/);
    assert.match(await readFile(join(output, "MEMORY.md"), "utf8"), /Prefer detailed answers/);
});

test("materialized edits fail closed for generated-view drift, stale bases, and metadata changes", async () => {
    for (const scenario of ["generated", "stale", "metadata", "structure"] as const) {
        const directory = await tempDir();
        const statePath = join(directory, "ember.json");
        const output = join(directory, "views");
        const { state } = populatedState();
        const store = new StateStore(statePath);
        await store.create(state);
        await command([
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
        const userPath = join(output, "USER.md");
        await writeFile(
            userPath,
            (await readFile(userPath, "utf8")).replace("Prefer concise architectural rationale", "Prefer detail"),
        );
        if (scenario === "generated") await writeFile(join(output, "SELF.md"), "unsupported drift\n");
        if (scenario === "metadata")
            await writeFile(
                userPath,
                (await readFile(userPath, "utf8")).replace(`scope: ${SCOPE}`, "scope: private:other"),
            );
        if (scenario === "structure")
            await writeFile(userPath, (await readFile(userPath, "utf8")).replace("# User understanding", "# Forged"));
        if (scenario === "stale") {
            const lease = await store.acquireWriteLease();
            await store.commit(state.revision, cloneState(state));
            await store.releaseWriteLease(lease);
        }

        const result = await command([
            "apply-materialized-edits",
            "--state",
            statePath,
            "--principal",
            PRINCIPAL,
            "--scope",
            SCOPE,
            "--input",
            output,
        ]);
        assert.equal(result.code, 2);
        assert.match(result.stderr, /generated-only|stale or changed|structure contains drift/);
        assert.equal(
            (await store.load()).meanings.some((meaning) => meaning.content === "Prefer detail"),
            false,
        );
    }
});

test("materialized edits cannot change identity, provenance, scope, or historical meaning", async () => {
    for (const replacement of [
        ["- Owner: <code>user:user-1</code>", "- Owner: <code>agent:stolen</code>"],
        [`- Scope: <code>${SCOPE}</code>`, "- Scope: <code>private:other</code>"],
        ["evidence-preference", "evidence-stolen"],
    ] as const) {
        const directory = await tempDir();
        const statePath = join(directory, "ember.json");
        const output = join(directory, "views");
        const { state, ids } = populatedState();
        await new StateStore(statePath).create(state);
        await command([
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
        const userPath = join(output, "USER.md");
        const preferenceEvidence = state.meanings.find((meaning) => meaning.meaningId === ids.preference)!
            .sourceEvidenceIds[0]!;
        const editPair =
            replacement[0] === "evidence-preference" ? [preferenceEvidence, "evidence-stolen"] : replacement;
        const edited = (await readFile(userPath, "utf8"))
            .replace("Prefer concise architectural rationale", "Changed")
            .replace(editPair[0], editPair[1]);
        await writeFile(userPath, edited);
        const result = await command([
            "apply-materialized-edits",
            "--state",
            statePath,
            "--principal",
            PRINCIPAL,
            "--scope",
            SCOPE,
            "--input",
            output,
        ]);
        assert.equal(result.code, 2);
        assert.match(result.stderr, /metadata or provenance changed/);
    }

    const { state, ids } = populatedState();
    supersede(state, PRINCIPAL, ids.preference, "New current preference", { reason: "changed" });
    const rendered = renderMarkdownStateViews(buildStateMaterialization(state, { principal: PRINCIPAL, scope: SCOPE }));
    rendered["USER.md"] = rendered["USER.md"].replace("Prefer concise architectural rationale", "Rewrite history");
    const { inspectMarkdownStateEdits } = await import("../src/persistence/markdown-state-materializer.ts");
    assert.throws(
        () =>
            inspectMarkdownStateEdits(
                buildStateMaterialization(state, { principal: PRINCIPAL, scope: SCOPE }),
                rendered,
                "2026-09-15T12:00:00Z",
            ),
        /generated-only/,
    );
});

test("Markdown v1 shows supersession and provenance without flattening stale meaning", () => {
    const { state, ids } = populatedState();
    const replacement = supersede(state, PRINCIPAL, ids.preference, "Prefer detailed rationale", {
        reason: "Preference changed",
    });
    const markdown = renderMarkdownStateViews(buildStateMaterialization(state, { principal: PRINCIPAL, scope: SCOPE }))[
        "USER.md"
    ];

    assert.equal(markdown.includes(`Meaning <code>${ids.preference}</code>`), true);
    assert.match(markdown, /Currentness: <code>superseded<\/code>/);
    assert.equal(markdown.includes(`superseded by <code>${replacement}</code>`), true);
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

test("all valid canonical strings stay inside their intended Markdown structure", () => {
    const { state, ids } = populatedState();
    const hostileScope = "private -->\n# forged scope `tick`";
    const preference = state.meanings.find((meaning) => meaning.meaningId === ids.preference)!;
    preference.scope = hostileScope;
    preference.slot = "slot `break`\n# forged slot";
    preference.content = "content\n# forged content --> `tick`";
    preference.uncertainty = "uncertain -->\n# forged uncertainty `tick`";
    for (const evidence of state.evidence.filter((item) => preference.sourceEvidenceIds.includes(item.evidenceId))) {
        evidence.scope = hostileScope;
    }
    validateState(state);

    const markdown = renderMarkdownStateViews(
        buildStateMaterialization(state, { principal: PRINCIPAL, scope: hostileScope }),
    )["USER.md"];

    assert.equal(markdown.match(/-->/gu)?.length, 1);
    assert.equal(markdown.includes("\n# forged"), false);
    assert.equal(markdown.includes("`break`"), false);
    assert.match(markdown, /private --&#62;&#10;&#35; forged scope &#96;tick&#96;/);
    assert.match(markdown, /content&#10;&#35; forged content --&#62; &#96;tick&#96;/);
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

test("explicit regeneration deterministically replaces an existing view without classifying drift", async () => {
    const directory = await tempDir();
    const materialization = buildStateMaterialization(populatedState().state, {
        principal: PRINCIPAL,
        scope: SCOPE,
    });
    await publishMarkdownStateViews(directory, join(directory, "ember.json"), materialization);
    const expected = await readFile(join(directory, "MEMORY.md"), "utf8");
    await writeFile(join(directory, "MEMORY.md"), "unclassified existing bytes\n");

    await publishMarkdownStateViews(directory, join(directory, "ember.json"), materialization);

    assert.equal(await readFile(join(directory, "MEMORY.md"), "utf8"), expected);
});

test("CLI refuses canonical target aliases before publishing any generated view", async () => {
    const directory = await tempDir();
    const statePath = join(directory, "MEMORY.md");
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
        directory,
    ]);

    assert.equal(result.code, 2);
    assert.match(result.stderr, /target aliases the canonical state path/);
    assert.equal(await readFile(statePath, "utf8"), before);
    for (const name of ["SELF.md", "USER.md", "RELATIONSHIP.md"]) {
        await assert.rejects(readFile(join(directory, name), "utf8"), { code: "ENOENT" });
    }
});
