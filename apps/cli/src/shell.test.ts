import { initialState } from "@ember/domain/model.ts";
import { rememberFact } from "@ember/domain/semantics.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { main } from "./main.ts";

function capture(input = "") {
    let stdout = "",
        stderr = "";
    return {
        input: Readable.from([input]),
        output: new Writable({
            write(chunk, _encoding, done) {
                stdout += chunk;
                done();
            },
        }),
        error: new Writable({
            write(chunk, _encoding, done) {
                stderr += chunk;
                done();
            },
        }),
        stdout: () => stdout,
        stderr: () => stderr,
    };
}

for (const command of [
    "init",
    "run",
    "setup",
    "inspect",
    "check",
    "materialize",
    "apply-materialized-edits",
    "explain",
    "correct",
    "lock-status",
    "quarantine-stale-lock",
    "setup-google-calendar",
]) {
    test(`CLI should reject ${command} when supplied as a process subcommand`, async () => {
        // Given
        const io = capture();
        // When
        const status = await main([command], io);
        // Then
        assert.equal(status, 2);
        assert.match(io.stderr(), /removed/);
        assert.match(io.stderr(), /\/help/);
        assert.equal(io.stdout(), "");
    });
}

test("shell should show command help when no runtime is configured", async () => {
    // Given
    const io = capture("/help\n:inspect --help\n/remember fact --help\n/quit\n");
    // When
    const status = await main([], io);
    // Then
    assert.equal(status, 0);
    assert.match(io.stdout(), /quarantine-stale-lock/);
    assert.match(io.stdout(), /approve-action/);
    assert.match(io.stdout(), /--json/);
    assert.match(io.stdout(), /fact slot/);
    assert.equal(io.stderr(), "");
});

test("shell should inspect and correct state when commands arrive through piped input", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-shell-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const path = join(directory, "state.json");
    const state = initialState("user");
    const id = rememberFact(state, "user", "user:user", "location", "private", "Old place");
    await new StateStore(path).create(state);
    const flags = `--state ${JSON.stringify(path)} --principal user`;
    const io = capture(
        `/correct ${id} ${flags} --text 'New place' --reason 'Moved home'\n/explain ${id} ${flags}\n:inspect ${flags} --json\n/check --state ${JSON.stringify(path)}\n/quit\n`,
    );
    // When
    const status = await main([], io);
    const current = await new StateStore(path).load();
    // Then
    assert.equal(status, 0);
    assert.equal(io.stderr(), "");
    assert.match(io.stdout(), /New place/);
    assert.ok(current.evidence.some((evidence) => evidence.payload?.includes("Moved home")));
    assert.match(io.stdout(), /valid schema/);
    assert.equal(current.operations.cognitionEpisodes.length, 0);
    assert.equal(current.operations.runtimeEpisodes.length, 0);
});

test("shell should keep recovery usable when state and selected setup are broken", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-shell-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    const config = join(directory, "broken.json");
    await writeFile(statePath, "invalid json");
    await writeFile(config, "invalid json");
    const io = capture(
        `/use --config ${JSON.stringify(config)}\n/check --state ${JSON.stringify(statePath)}\n/lock-status --state ${JSON.stringify(statePath)}\n/quit\n`,
    );
    // When
    const status = await main([], io);
    // Then
    assert.equal(status, 0);
    assert.match(io.stderr(), /command rejected/);
    assert.match(io.stdout(), /absent/);
    assert.equal(await readFile(statePath, "utf8"), "invalid json");
});

test("shell should preserve the selected setup when a later selection has a broken binding", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-shell-select-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    const configPath = join(directory, "config.json");
    const brokenPath = join(directory, "broken.json");
    const state = initialState("user");
    await new StateStore(statePath).create(state);
    const config = {
        version: 1,
        intent: "use-existing",
        statePath,
        principal: "user",
        lineageId: state.lineage.lineageId,
        establishedAt: state.lineage.establishedAt,
        provider: { kind: "codex", command: "provider-must-never-run", model: "", timeoutSeconds: 1 },
        verification: "verified",
        continuity: "available",
        cancellationRequested: false,
        updatedAt: state.lineage.establishedAt,
    };
    await writeFile(configPath, JSON.stringify(config));
    await writeFile(brokenPath, JSON.stringify({ ...config, lineageId: "lineage-wrong" }));
    const io = capture(
        `/use --config ${JSON.stringify(configPath)}\n/use --config ${JSON.stringify(brokenPath)}\n/remember fact user:user test private 'Selected state'\n/quit\n`,
    );
    // When
    const status = await main([], io);
    const current = await new StateStore(statePath).load();
    // Then
    assert.equal(status, 0);
    assert.match(io.stdout(), /scope relationship:user/);
    assert.match(io.stderr(), /continuity no longer matches setup binding/);
    assert.ok(current.meanings.some((meaning) => meaning.content === "Selected state"));
    assert.equal(current.operations.cognitionEpisodes.length, 0);
});

test("shell should target the selected setup when setup inspection omits a config", async (t) => {
    // Given
    const directory = await realpath(await mkdtemp(join(tmpdir(), "ember-shell-setup-")));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const statePath = join(directory, "state.json");
    const configPath = join(directory, "config.json");
    const state = initialState("user");
    await new StateStore(statePath).create(state);
    const config = {
        version: 1,
        intent: "use-existing",
        statePath,
        principal: "user",
        lineageId: state.lineage.lineageId,
        establishedAt: state.lineage.establishedAt,
        provider: { kind: "codex", command: "provider-must-never-run", model: "", timeoutSeconds: 1 },
        verification: "verified",
        continuity: "available",
        cancellationRequested: false,
        updatedAt: state.lineage.establishedAt,
    };
    await writeFile(configPath, JSON.stringify(config));
    const io = capture(`/use --config ${JSON.stringify(configPath)} --scope custom\n:setup\n/quit\n`);
    // When
    const status = await main([], io);
    // Then
    assert.equal(status, 0);
    assert.equal(io.stderr(), "");
    assert.match(io.stdout(), /scope custom/);
    assert.match(io.stdout(), /Machine configuration: present; continuity: loadable/);
    assert.deepEqual(await new StateStore(statePath).load(), state);
    assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), config);
});

test("shell should report a live writer lock when diagnostic commands run before runtime startup", async (t) => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-shell-lock-"));
    const path = join(directory, "state.json");
    const store = new StateStore(path);
    const state = initialState("user");
    await store.create(state);
    const lease = await store.acquireWriteLease();
    t.after(async () => {
        await store.releaseWriteLease(lease);
        await rm(directory, { recursive: true, force: true });
    });
    const io = capture(
        `/inspect --state ${JSON.stringify(path)} --principal user --json\n/check --state ${JSON.stringify(path)}\n/lock-status --state ${JSON.stringify(path)}\n/quit\n`,
    );
    // When
    const status = await main([], io);
    // Then
    assert.equal(status, 0);
    assert.equal(io.stderr(), "");
    assert.match(io.stdout(), /live/);
    assert.match(io.stdout(), /owner_token/);
    assert.deepEqual(await store.load(), state);
});
