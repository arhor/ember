import assert from "node:assert/strict";
import { chmod, copyFile, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { ProviderError } from "../src/core/errors.ts";
import { initialState } from "../src/core/model.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { loadSetupConfig, main, parseArgs, runCliSurface, setupMain as runSetup } from "../src/surfaces/cli/index.ts";
import { command, populatedState } from "./support.ts";

const success = { contractVersion: 1, reply: "PROBE_REPLY_NOT_RETAINED", usedMeaningIds: [] };
async function setupMain(argv, io, dependencies) {
    const args = parseArgs(["setup", ...argv]);
    assert.equal(args.command, "setup");
    return await runSetup(args, io, dependencies);
}
function capture(input = ":quit\n") {
    let output = "",
        error = "";
    return {
        input: Readable.from([input]),
        output: new Writable({
            write(chunk, _encoding, callback) {
                output += chunk;
                callback();
            },
        }),
        error: new Writable({
            write(chunk, _encoding, callback) {
                error += chunk;
                callback();
            },
        }),
        text: () => output + error,
    };
}
async function fixture(t) {
    const directory = await mkdtemp(join(tmpdir(), "ember-setup-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const config = join(directory, "setup.json"),
        state = join(directory, "continuity.json");
    return {
        directory,
        config,
        state,
        args: ["--config", config, "--state", state],
        create: [
            "--config",
            config,
            "--state",
            state,
            "--intent",
            "create-new",
            "--principal",
            "user-secret-marker",
            "--provider",
            "codex",
        ],
    };
}
const verified = { provider: () => async () => success };

test("one CLI parser produces typed setup and discriminated run arguments", () => {
    const setup = parseArgs([
        "setup",
        "--intent",
        "restore-existing",
        "--provider",
        "claude-code",
        "--provider-timeout-seconds",
        "30",
        "--accept-continuity-risk",
    ]);
    assert.equal(setup.command, "setup");
    assert.equal(setup.intent, "restore-existing");
    assert.equal(setup.provider, "claude-code");
    assert.equal(setup.providerTimeoutSeconds, 30);
    assert.equal(setup.acceptContinuityRisk, true);
    assert.equal(parseArgs(["setup", "--help"]).help, true);
    assert.equal(parseArgs(["setup"]).intent, undefined);
    assert.deepEqual(parseArgs(["run", "--config", "host.json", "--scope", "test"]), {
        command: "run",
        mode: "configured",
        config: "host.json",
        scope: "test",
    });
    const explicit = parseArgs([
        "run",
        "--state",
        "state.json",
        "--principal",
        "user",
        "--scope",
        "test",
        "--provider-command",
        "fixture",
        "--provider-arg",
        "--config",
        "--provider-timeout-seconds",
        "1",
    ]);
    assert.equal(explicit.mode, "explicit");
    assert.deepEqual(explicit.providerArgs, ["--config"]);
});

test("unified CLI parser rejects invalid setup and mixed configured-run options", () => {
    for (const args of [
        ["setup", "--config"],
        ["setup", "--state", ""],
        ["setup", "extra"],
        ["setup", "--help", "--help"],
        ["setup", "--intent", "automatic"],
        ["setup", "--provider", "unknown"],
        ["setup", "--unknown"],
        ["run", "--config", "host.json"],
        ["run", "--config", "host.json", "--scope", "test", "extra"],
        ["run", "--config", "a", "--config", "b", "--scope", "test"],
        ...[
            "--state",
            "--principal",
            "--provider",
            "--provider-command",
            "--provider-arg",
            "--codex-command",
            "--codex-arg",
            "--cursor-command",
            "--cursor-arg",
            "--provider-timeout-seconds",
        ].map((flag) => ["run", "--config", "host.json", "--scope", "test", flag, "value"]),
    ])
        assert.throws(() => parseArgs(args), undefined, args.join(" "));
});

for (const override of ["none", "config", "state"]) {
    test(`application home separates config and state with independent ${override} override`, async (t) => {
        const f = await fixture(t),
            executable = join(f.directory, "codex.ts");
        await copyFile(resolve("tests/fixtures/providers/scripted-codex.ts"), executable);
        await chmod(executable, 0o700);
        // Isolate the child CLI's user home; no real provider login or user files participate.
        const env = {
            HOME: f.directory,
            XDG_CONFIG_HOME: join(f.directory, "xdg-config"),
            XDG_STATE_HOME: join(f.directory, "xdg-state"),
        };
        const config = override === "config" ? f.config : join(f.directory, ".ember", "config", "setup.json");
        const state = override === "state" ? f.state : join(f.directory, ".ember", "state", "continuity.json");
        const options = override === "config" ? ["--config", config] : override === "state" ? ["--state", state] : [];
        const result = await command(
            [
                "setup",
                ...options,
                "--intent",
                "create-new",
                "--principal",
                "user",
                "--provider",
                "codex",
                "--provider-command",
                executable,
            ],
            { env },
        );
        assert.equal(result.code, 0, JSON.stringify(result));
        assert.equal((await loadSetupConfig(config)).statePath, state);
        const before = await readFile(state, "utf8");
        const rerun = await command(["setup", "--config", config, "--intent", "use-existing"], { env });
        assert.equal(rerun.code, 0, JSON.stringify(rerun));
        assert.equal(await readFile(state, "utf8"), before);
        await assert.rejects(stat(env.XDG_CONFIG_HOME), { code: "ENOENT" });
        await assert.rejects(stat(env.XDG_STATE_HOME), { code: "ENOENT" });
    });
}

test("setup inspection distinguishes absent/configured hosts without choosing a lineage or probing", async (t) => {
    const f = await fixture(t),
        io = capture();
    assert.equal(await main(["setup", ...f.args], io), 0);
    assert.match(io.text(), /configuration: absent; continuity: absent/);
    assert.match(io.text(), /restore-existing/);
    assert.match(io.text(), /create-new/);
    assert.equal(await loadSetupConfig(f.config), null);
    await assert.rejects(stat(f.state), { code: "ENOENT" });
    await setupMain(f.create, capture(), verified);
    const before = await readFile(f.config, "utf8"),
        rerun = capture();
    assert.equal(await main(["setup", ...f.args], rerun), 0);
    assert.match(rerun.text(), /configuration: present; continuity: loadable/);
    assert.match(rerun.text(), /does not reverify/);
    assert.equal(await readFile(f.config, "utf8"), before);
});

for (const kind of ["codex", "cursor", "claude-code"]) {
    test(`setup configures ${kind}, probes synthetic context, and initializes only after verification`, async (t) => {
        const f = await fixture(t),
            io = capture();
        let calls = 0;
        assert.equal(
            await setupMain([...f.create.slice(0, -1), kind], io, {
                provider: (config) => async (request, options) => {
                    calls++;
                    assert.equal(config.kind, kind);
                    assert.equal(options.timeoutSeconds, 60);
                    await assert.rejects(stat(f.state), { code: "ENOENT" });
                    assert.equal((await loadSetupConfig(f.config)).verification, "requested");
                    assert.deepEqual(request.projection.meanings, []);
                    assert.deepEqual(request.projection.selection.meaning_ids, []);
                    assert.doesNotMatch(JSON.stringify(request), /user-secret-marker/);
                    assert.ok(!JSON.stringify(request).includes(f.directory));
                    return success;
                },
            }),
            0,
        );
        assert.equal(calls, 1);
        const config = await loadSetupConfig(f.config),
            state = await new StateStore(f.state).load();
        assert.equal(config.verification, "verified");
        assert.equal(config.continuity, "available");
        assert.equal(config.lineageId, state.lineage.lineageId);
        assert.deepEqual(state.meanings, []);
        assert.deepEqual(state.operations.cognitionEpisodes, []);
        assert.equal((await stat(f.config)).mode & 0o777, 0o600);
        assert.doesNotMatch(await readFile(f.state, "utf8"), /provider|PROBE_REPLY|setup.json/);
        assert.doesNotMatch(await readFile(f.config, "utf8"), /PROBE_REPLY/);
        assert.doesNotMatch(io.text(), /PROBE_REPLY/);
        assert.equal(await main(["run", "--config", f.config, "--scope", "test"], capture()), 0);
    });
}

test("rerun verifies again while preserving canonical bytes and rejects an implicit provider replacement", async (t) => {
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const before = await readFile(f.state, "utf8");
    await setupMain(f.create, capture(), verified);
    assert.equal(await readFile(f.state, "utf8"), before);
    const rerun = [...f.args, "--intent", "use-existing", "--provider", "cursor"];
    await assert.rejects(setupMain(rerun, capture(), verified), /confirm-provider-change/);
    assert.equal(await setupMain([...rerun, "--confirm-provider-change"], capture(), verified), 0);
    assert.equal((await loadSetupConfig(f.config)).provider.kind, "cursor");
    assert.equal(await readFile(f.state, "utf8"), before);
});

test("restore attaches validated state without rewriting meaning or sidecars and requires a continuity choice", async (t) => {
    const f = await fixture(t),
        { state } = populatedState();
    await new StateStore(f.state).create(state);
    await writeFile(`${f.state}.conversation.json`, "retained sidecar");
    const before = await readFile(f.state, "utf8");
    const args = [...f.args, "--intent", "restore-existing", "--provider", "codex"];
    await assert.rejects(setupMain(args, capture(), verified), /accept-continuity-risk/);
    assert.equal(await setupMain([...args, "--accept-continuity-risk"], capture(), verified), 0);
    assert.equal(await readFile(f.state, "utf8"), before);
    assert.equal(await readFile(`${f.state}.conversation.json`, "utf8"), "retained sidecar");
    assert.equal((await loadSetupConfig(f.config)).lineageId, state.lineage.lineageId);
});

test("create-new never overwrites an existing unconfigured lineage; use-existing explicitly attaches it", async (t) => {
    const f = await fixture(t),
        state = initialState("user-secret-marker");
    await new StateStore(f.state).create(state);
    await assert.rejects(setupMain(f.create, capture(), verified), /refuses existing state/);
    assert.equal(
        await setupMain([...f.args, "--intent", "use-existing", "--provider", "codex"], capture(), verified),
        0,
    );
    assert.deepEqual(await new StateStore(f.state).load(), state);
});

for (const outcome of ["failed", "timed_out", "cancellation_requested", "outcome_unknown"]) {
    test(`probe ${outcome} is recoverable and never creates continuity or retains raw diagnostics`, async (t) => {
        const f = await fixture(t),
            io = capture();
        assert.equal(
            await setupMain(f.create, io, {
                provider: () => async () => {
                    throw new ProviderError("RAW_AUTH_SECRET", { outcome, terminationConfirmed: false });
                },
            }),
            2,
        );
        const config = await loadSetupConfig(f.config);
        assert.equal(config.verification, outcome);
        assert.equal(config.continuity, "pending");
        await assert.rejects(stat(f.state), { code: "ENOENT" });
        assert.doesNotMatch(io.text() + (await readFile(f.config, "utf8")), /RAW_AUTH_SECRET/);
        assert.equal(await main(["run", "--config", f.config, "--scope", "test"], capture()), 2);
        assert.equal(await setupMain(f.create, capture(), verified), 0);
        assert.equal((await new StateStore(f.state).load()).lineage.lineageId, config.lineageId);
    });
}

test("a malformed successful response does not establish readiness", async (t) => {
    const f = await fixture(t);
    assert.equal(
        await setupMain(f.create, capture(), {
            provider: () => async () => ({ ...success, usedMeaningIds: ["meaning-invented"] }),
        }),
        2,
    );
    assert.equal((await loadSetupConfig(f.config)).verification, "failed");
    await assert.rejects(stat(f.state), { code: "ENOENT" });
});

test("failed re-verification revokes readiness without changing canonical continuity", async (t) => {
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const before = await readFile(f.state, "utf8");
    assert.equal(
        await setupMain([...f.args, "--intent", "use-existing"], capture(), {
            provider: () => async () => {
                throw new ProviderError("expired");
            },
        }),
        2,
    );
    assert.equal(await readFile(f.state, "utf8"), before);
    assert.equal(await main(["run", "--config", f.config, "--scope", "test"], capture()), 2);
});

test("cancellation before and during verification is recorded without canonical creation", async (t) => {
    for (const before of [true, false]) {
        const f = await fixture(t),
            controller = new AbortController();
        if (before) controller.abort();
        assert.equal(
            await setupMain(f.create, capture(), {
                signal: controller.signal,
                provider: () => async (_request, options) => {
                    assert.equal(before, false);
                    controller.abort();
                    assert.equal(options.signal.aborted, true);
                    throw new ProviderError("cancelled", { outcome: "cancellation_requested" });
                },
            }),
            2,
        );
        assert.equal((await loadSetupConfig(f.config)).cancellationRequested, true);
        await assert.rejects(stat(f.state), { code: "ENOENT" });
    }
});

test("cancellation after a successful probe preserves verified cognition but does not activate state", async (t) => {
    const f = await fixture(t),
        controller = new AbortController();
    assert.equal(
        await setupMain(f.create, capture(), {
            signal: controller.signal,
            provider: () => async () => {
                controller.abort();
                return success;
            },
        }),
        2,
    );
    const config = await loadSetupConfig(f.config);
    assert.equal(config.verification, "verified");
    assert.equal(config.continuity, "pending");
    assert.equal(config.cancellationRequested, true);
    await assert.rejects(stat(f.state), { code: "ENOENT" });
});

test("cancellation during the final availability write is persisted after committed continuity", async (t) => {
    const f = await fixture(t),
        controller = new AbortController();
    let availableWrites = 0;
    assert.equal(
        await setupMain(f.create, capture(), {
            ...verified,
            signal: controller.signal,
            persistConfig: async (path, config) => {
                const snapshot = `${JSON.stringify(config, null, 2)}\n`;
                if (config.continuity === "available") {
                    availableWrites++;
                    if (availableWrites === 1) controller.abort();
                }
                await writeFile(path, snapshot, { mode: 0o600 });
            },
        }),
        2,
    );
    const config = await loadSetupConfig(f.config);
    assert.equal(availableWrites, 2);
    assert.equal(config.continuity, "available");
    assert.equal(config.cancellationRequested, true);
    assert.equal((await new StateStore(f.state).load()).lineage.lineageId, config.lineageId);
});

test("configured run checks lineage establishment under the acquired state lease", async (t) => {
    const f = await fixture(t),
        state = initialState("user"),
        store = new StateStore(f.state);
    await store.create(state);
    await assert.rejects(
        runCliSurface(
            {
                statePath: f.state,
                principal: "user",
                scope: "test",
                providerKind: "process",
                providerCommand: "unused",
                providerArgs: [],
                providerTimeoutSeconds: 1,
                expectedContinuityBinding: {
                    lineageId: state.lineage.lineageId,
                    establishedAt: "2026-01-01T00:00:00Z",
                },
            },
            capture(),
        ),
        /continuity no longer matches setup binding/,
    );
    assert.equal((await store.load()).revision, 0);
    assert.deepEqual(await store.lockStatus(), { status: "absent" });
});

test("missing previously available or possibly created state is never silently recreated", async (t) => {
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    await rm(f.state);
    await assert.rejects(setupMain(f.create, capture(), verified), /missing state will not be recreated/);
    const config = await loadSetupConfig(f.config);
    config.continuity = "requested";
    await writeFile(f.config, JSON.stringify(config));
    await assert.rejects(setupMain(f.create, capture(), verified), /missing state will not be recreated/);
});

test("activation race preserves other lineage, records uncertainty, and blocks blind retry", async (t) => {
    const f = await fixture(t),
        other = initialState("user-secret-marker");
    assert.equal(
        await setupMain(f.create, capture(), {
            provider: () => async () => {
                await new StateStore(f.state).create(other);
                return success;
            },
        }),
        2,
    );
    assert.deepEqual(await new StateStore(f.state).load(), other);
    assert.equal((await loadSetupConfig(f.config)).continuity, "outcome_unknown");
    await assert.rejects(setupMain(f.create, capture(), verified), /no longer matches/);
});

test("concurrent setup fails closed and preserves the first setup operation", async (t) => {
    const f = await fixture(t);
    assert.equal(
        await setupMain(f.create, capture(), {
            provider: () => async () => {
                await assert.rejects(setupMain(f.create, capture(), verified), /lock is live/);
                return success;
            },
        }),
        0,
    );
});

test("invalid configuration, state, and path aliases fail without replacing files", async (t) => {
    const f = await fixture(t);
    await writeFile(f.config, "{broken");
    assert.equal(await main(["setup", ...f.create], capture()), 2);
    assert.equal(await readFile(f.config, "utf8"), "{broken");
    await rm(f.config);
    await assert.rejects(setupMain(["--config", f.state, "--state", f.state], capture(), verified), /separate paths/);
    await assert.rejects(
        setupMain(["--config", `${f.state}.lock`, "--state", f.state], capture(), verified),
        /separate paths/,
    );
    await symlink(f.directory, join(f.directory, "alias"));
    await assert.rejects(
        setupMain(["--config", join(f.directory, "alias", "continuity.json"), "--state", f.state], capture(), verified),
        /separate paths/,
    );
    await writeFile(f.state, "{broken");
    assert.equal(await main(["setup", ...f.args], capture()), 2);
    assert.equal(await readFile(f.state, "utf8"), "{broken");
});

test("setup rejects control characters in config and state paths before persistence", async (t) => {
    const f = await fixture(t);
    for (const [flag, path] of [
        ["--config", `${f.config}\nunsafe`],
        ["--state", `${f.state}\nunsafe`],
    ]) {
        const args = [...f.create],
            index = args.indexOf(flag);
        args[index + 1] = path;
        await assert.rejects(setupMain(args, capture(), verified), /contain no control characters/);
        await assert.rejects(stat(path), { code: "ENOENT" });
    }
    assert.equal(await loadSetupConfig(f.config), null);
    await assert.rejects(stat(f.state), { code: "ENOENT" });
});

test("setup rejects unsupported, repeated, secret, and unbounded options", async (t) => {
    const f = await fixture(t);
    for (const extra of [
        ["--api-key", "secret"],
        ["--provider", "cursor"],
        ["--provider-timeout-seconds", "121"],
        ["--provider-timeout-seconds", "NaN"],
        ["--provider-timeout-seconds", "0"],
    ]) {
        assert.equal(await main(["setup", ...f.create, ...extra], capture()), 2);
    }
    assert.equal(await loadSetupConfig(f.config), null);
});

test("configuration validation rejects coercible enum values and unsupported credential fields", async (t) => {
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const config = await loadSetupConfig(f.config);
    for (const invalid of [
        { ...config, intent: [config.intent] },
        { ...config, verification: [config.verification] },
        { ...config, continuity: [config.continuity] },
        { ...config, provider: { ...config.provider, kind: [config.provider.kind] } },
        { ...config, provider: { ...config.provider, apiKey: "secret" } },
    ]) {
        await writeFile(f.config, JSON.stringify(invalid));
        await assert.rejects(loadSetupConfig(f.config), /invalid machine-local|setup provider/);
    }
});

test("restart reconciles a matching committed lineage after an interrupted activation", async (t) => {
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const before = await readFile(f.state, "utf8"),
        config = await loadSetupConfig(f.config);
    config.continuity = "requested";
    await writeFile(f.config, JSON.stringify(config));
    assert.equal(await setupMain([...f.args, "--intent", "use-existing"], capture(), verified), 0);
    assert.equal((await loadSetupConfig(f.config)).continuity, "available");
    assert.equal(await readFile(f.state, "utf8"), before);
});

for (const kind of ["codex", "cursor"]) {
    test(`actual CLI setup and configured conversation use the ${kind} production adapter with a deterministic executable`, async (t) => {
        const f = await fixture(t);
        const executable = join(f.directory, `${kind}.ts`);
        await copyFile(resolve(`tests/fixtures/providers/scripted-${kind}.ts`), executable);
        await chmod(executable, 0o700);
        const result = await command(["setup", ...f.create.slice(0, -1), kind, "--provider-command", executable]);
        assert.equal(result.code, 0, JSON.stringify(result));
        const run = await command(["run", "--config", f.config, "--scope", "test"], { stdin: "hello\n:quit\n" });
        assert.equal(run.code, 0, run.stderr);
        assert.match(run.stdout, new RegExp(`${kind.toUpperCase()}_CLI_RESPONSE`));
        const before = await readFile(f.state, "utf8");
        const rerun = await command(["setup", ...f.args, "--intent", "use-existing"]);
        assert.equal(rerun.code, 0, rerun.stderr);
        assert.equal(await readFile(f.state, "utf8"), before);
    });
}
