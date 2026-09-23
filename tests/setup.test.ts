import assert from "node:assert/strict";
import { chmod, copyFile, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import { actionProposalConfirmation, ActionProposalStore } from "../src/capabilities/action-proposal.ts";
import { ProviderError } from "../src/core/errors.ts";
import { DurabilityUncertain } from "../src/core/errors.ts";
import { initialState } from "../src/core/model.ts";
import { createOnboardingWork } from "../src/core/onboarding-work.ts";
import { MemoryProposalGenerationStore } from "../src/persistence/memory-proposal-generation-store.ts";
import { OnboardingWorkStore } from "../src/persistence/onboarding-work-store.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { startRuntime, stopRuntime } from "../src/runtime/runtime.ts";
import { setupGoogleCalendarMain } from "../src/surfaces/cli/google-calendar-setup.ts";
import { loadSetupConfig, main, parseArgs, runCliSurface, setupMain as runSetup } from "../src/surfaces/cli/index.ts";
import { captureError, command, populatedState } from "./support.ts";

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

test("CLI parser should route Google Calendar setup when typed options are supplied", () => {
    // Given
    const argv = [
        "setup-google-calendar",
        "--setup-config",
        "/tmp/setup.json",
        "--config",
        "/tmp/calendar.json",
        "--surface",
        "local_cli",
        "--surface",
        "telegram_bot",
        "--disable",
    ];

    // When
    const parsed = parseArgs(argv);

    // Then
    assert.deepEqual(parsed, {
        command: "setup-google-calendar",
        setupConfig: "/tmp/setup.json",
        config: "/tmp/calendar.json",
        clientId: undefined,
        clientSecretFile: undefined,
        refreshTokenFile: undefined,
        calendarId: undefined,
        calendarLabel: undefined,
        timezone: undefined,
        scope: undefined,
        surfaces: ["local_cli", "telegram_bot"],
        disable: true,
        reconfigure: false,
    });
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
        assert.equal((await loadSetupConfig(config)).statePath, await realpath(state));
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
        const onboarding = JSON.parse(await readFile(`${f.state}.onboarding.json`, "utf8"));
        assert.equal(onboarding.lineage_id, state.lineage.lineageId);
        assert.equal(onboarding.status, "active");
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

test("setup should preserve a v2 Google Calendar binding when setup is rerun", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const existing = await loadSetupConfig(f.config);
    const calendarPath = join(f.directory, "google-calendar.json");
    await writeFile(
        f.config,
        `${JSON.stringify({ ...existing, version: 2, googleCalendarConfigPath: calendarPath }, null, 2)}\n`,
    );
    // When
    await setupMain([...f.args, "--intent", "use-existing", "--provider", "codex"], capture(), verified);
    const rerun = await loadSetupConfig(f.config);

    // Then
    assert.equal(rerun.version, 2);
    assert.equal(rerun.googleCalendarConfigPath, calendarPath);
});

test("Google Calendar setup should preserve continuity when config path overlaps canonical state", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const before = await readFile(f.state, "utf8");

    // When
    const result = await main(
        ["setup-google-calendar", "--setup-config", f.config, "--config", f.state, "--disable"],
        capture(),
    );

    // Then
    assert.equal(result, 2);
    assert.equal(await readFile(f.state, "utf8"), before);
});

test("Google Calendar setup should preserve continuity when config path aliases canonical state", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const alias = join(f.directory, "calendar-alias.json");
    await symlink(f.state, alias);
    const before = await readFile(f.state, "utf8");

    // When
    const result = await main(
        ["setup-google-calendar", "--setup-config", f.config, "--config", alias, "--disable"],
        capture(),
    );

    // Then
    assert.equal(result, 2);
    assert.equal(await readFile(f.state, "utf8"), before);
});

test("Google Calendar setup should preserve continuity when refresh-token path overlaps a state sidecar", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const clientSecret = join(f.directory, "client-secret.json");
    await writeFile(clientSecret, "secret", { mode: 0o600 });
    const before = await readFile(f.state, "utf8");

    // When
    const result = await main(
        [
            "setup-google-calendar",
            "--setup-config",
            f.config,
            "--config",
            join(f.directory, "calendar.json"),
            "--client-id",
            "client",
            "--client-secret-file",
            clientSecret,
            "--refresh-token-file",
            `${f.state}.conversation.json`,
            "--calendar-id",
            "primary",
            "--calendar-label",
            "Personal",
            "--timezone",
            "UTC",
            "--scope",
            "private",
            "--surface",
            "local_cli",
        ],
        capture(),
    );

    // Then
    assert.equal(result, 2);
    assert.equal(await readFile(f.state, "utf8"), before);
    await assert.rejects(stat(`${f.state}.conversation.json`), { code: "ENOENT" });
});

test("Google Calendar setup should preserve a foreign config when disable uses another lineage", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const configPath = join(f.directory, "foreign-calendar.json");
    const foreign = calendarConfig("lineage-foreign", "user-secret-marker", f.directory);
    await writeFile(configPath, `${JSON.stringify(foreign)}\n`);
    const before = await readFile(configPath, "utf8");

    // When
    const result = await main(
        ["setup-google-calendar", "--setup-config", f.config, "--config", configPath, "--disable"],
        capture(),
    );

    // Then
    assert.equal(result, 2);
    assert.equal(await readFile(configPath, "utf8"), before);
});

test("Google Calendar setup should preserve a foreign config when reconfigure uses another lineage", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const configPath = join(f.directory, "foreign-calendar.json");
    const foreign = calendarConfig("lineage-foreign", "user-secret-marker", f.directory);
    await writeFile(configPath, `${JSON.stringify(foreign)}\n`);
    const before = await readFile(configPath, "utf8");

    // When
    const result = await main(
        ["setup-google-calendar", "--setup-config", f.config, "--config", configPath, "--reconfigure"],
        capture(),
    );

    // Then
    assert.equal(result, 2);
    assert.equal(await readFile(configPath, "utf8"), before);
});

test("Google Calendar setup should retain staged token when config publication is durability-uncertain", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const configPath = join(f.directory, "calendar.json");
    const canonicalConfigPath = join(await realpath(dirname(configPath)), basename(configPath));
    const secretPath = join(f.directory, "client-secret");
    const tokenPath = join(f.directory, "refresh-token");
    await writeFile(secretPath, "client-secret", { mode: 0o600 });
    const args = parseArgs([
        "setup-google-calendar",
        "--setup-config",
        f.config,
        "--config",
        configPath,
        "--client-id",
        "client",
        "--client-secret-file",
        secretPath,
        "--refresh-token-file",
        tokenPath,
        "--calendar-id",
        "primary",
        "--calendar-label",
        "Personal",
        "--timezone",
        "UTC",
        "--scope",
        "private",
        "--surface",
        "local_cli",
    ]);
    assert.equal(args.command, "setup-google-calendar");

    // When
    const failure = await captureError(() =>
        setupGoogleCalendarMain(args, capture(), {
            authorize: async () => ({ code: "code", redirectUri: "http://127.0.0.1/callback" }),
            fetch: async () => new Response(JSON.stringify({ refresh_token: "refresh-secret" }), { status: 200 }),
            verify: async () => {},
            write: async (path, content) => {
                await writeFile(path, content, { mode: 0o600 });
                if (path === canonicalConfigPath) throw new DurabilityUncertain("directory sync failed");
            },
        }),
    );

    // Then
    assert.ok(failure instanceof DurabilityUncertain);
    assert.equal((await readFile(tokenPath, "utf8")).trim(), "refresh-secret");
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).refresh_token_file, tokenPath);
});

test("Google Calendar setup should recover binding when initial config publication preceded setup failure", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const setup = await loadSetupConfig(f.config);
    const configPath = join(f.directory, "calendar.json");
    await writeFile(configPath, `${JSON.stringify(calendarConfig(setup.lineageId, setup.principal, f.directory))}\n`);
    const args = parseArgs(["setup-google-calendar", "--setup-config", f.config, "--config", configPath]);
    assert.equal(args.command, "setup-google-calendar");

    // When
    const result = await setupGoogleCalendarMain(args, capture(), { verify: async () => {} });

    // Then
    assert.equal(result, 0);
    const recovered = await loadSetupConfig(f.config);
    assert.equal(recovered.version, 2);
    assert.equal(recovered.googleCalendarConfigPath, join(await realpath(dirname(configPath)), basename(configPath)));
});

test("CLI Calendar authority should refresh when config is disabled between cognition turns", async (t) => {
    // Given
    const f = await fixture(t);
    const state = initialState("user-secret-marker");
    await new StateStore(f.state).create(state);
    const configPath = join(f.directory, "calendar.json");
    const calendar = calendarConfig(state.lineage.lineageId, "user-secret-marker", f.directory);
    await writeFile(configPath, `${JSON.stringify(calendar)}\n`);
    const selectedCounts: number[] = [];
    const io = capture("first\nsecond\n:quit\n");

    // When
    await runCliSurface(
        {
            statePath: f.state,
            principal: "user-secret-marker",
            scope: "private",
            providerKind: "claude-code",
            providerCommand: "claude-code",
            providerArgs: [],
            providerTimeoutSeconds: 30,
            googleCalendarConfigPath: configPath,
            claudeProviderFactory: () => async (_request, options) => {
                selectedCounts.push(options.capabilities?.length ?? 0);
                if (selectedCounts.length === 1)
                    await writeFile(configPath, `${JSON.stringify({ ...calendar, enabled: false })}\n`);
                return success;
            },
        },
        io,
    );

    // Then
    assert.deepEqual(selectedCounts, [3, 0]);
});

test("ordinary CLI conversation uses the shared application coordinator lifecycle", async (t) => {
    const f = await fixture(t);
    await new StateStore(f.state).create(initialState("user"));
    const io = capture("Hello\n:quit\n");

    assert.equal(
        await runCliSurface(
            {
                statePath: f.state,
                principal: "user",
                scope: "relationship:user",
                providerKind: "claude-code",
                providerCommand: "claude-code",
                providerArgs: [],
                providerTimeoutSeconds: 30,
                claudeProviderFactory: () => async () => success,
                memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
            },
            io,
        ),
        0,
    );

    const state = await new StateStore(f.state).load();
    assert.equal(io.text(), "PROBE_REPLY_NOT_RETAINED\n");
    assert.equal(state.operations.runtimeEpisodes.length, 1);
    assert.equal(state.operations.runtimeEpisodes[0]?.stopReason, "application_interaction_complete");
});

test("ordinary CLI conversation preserves the configured memory proposal provider label", async (t) => {
    const f = await fixture(t);
    const state = initialState("user");
    await new StateStore(f.state).create(state);
    await new OnboardingWorkStore(f.state).save(
        createOnboardingWork(state.lineage.lineageId, "user", "relationship:user", "2026-01-01T00:00:00.000Z"),
    );

    await runCliSurface(
        {
            statePath: f.state,
            principal: "user",
            scope: "relationship:user",
            providerKind: "claude-code",
            providerCommand: "claude-code",
            providerArgs: [],
            providerTimeoutSeconds: 30,
            claudeProviderFactory: () => async () => success,
            memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
            memoryProposalProviderLabel: "configured-memory-provider",
        },
        capture("Hello\n:quit\n"),
    );

    const ledger = await new MemoryProposalGenerationStore(f.state).load();
    assert.equal(ledger.generations.length, 1);
    assert.equal(ledger.generations[0]?.provider_label, "configured-memory-provider");
});

test("CLI action command should durably approve an exact pending calendar proposal when it was shown in the same scope", async (t) => {
    // Given
    const f = await fixture(t);
    const state = initialState("user-secret-marker");
    await new StateStore(f.state).create(state);
    const actions = new ActionProposalStore(f.state);
    const proposal = await actions.create({
        capability: "googleCalendarCreateEvent",
        principal: "user-secret-marker",
        scope: "private",
        purpose: "Keep an appointment",
        consequence: "Create one calendar event",
        payload: {
            title: "Dentist",
            start: "2026-09-18T08:00:00Z",
            end: "2026-09-18T09:00:00Z",
            timezone: "Europe/Warsaw",
        },
        target: { label: "Personal", fingerprint: `sha256:${"a".repeat(64)}` },
        sourceIds: ["cognition-test-proposal"],
        createdAt: "2020-01-01T00:00:00Z",
        expiresAt: "2099-01-01T00:00:00Z",
    });
    const io = capture(
        `:show-action ${proposal.proposal_id}\n:approve-action ${proposal.proposal_id} ${proposal.payload_digest} ${JSON.stringify(actionProposalConfirmation(proposal))}\n:quit\n`,
    );

    // When
    await runCliSurface(
        {
            statePath: f.state,
            principal: "user-secret-marker",
            scope: "private",
            providerKind: "claude-code",
            providerCommand: "claude-code",
            providerArgs: [],
            providerTimeoutSeconds: 30,
            claudeProviderFactory: () => async () => success,
        },
        io,
    );

    // Then
    assert.match(io.text(), /"status":"approved"/);
    assert.equal((await actions.load()).proposals[0]!.status, "approved");
});

test("Calendar setup should reject ordinary setup mutation while OAuth holds the setup lease", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const secretPath = join(f.directory, "client-secret");
    await writeFile(secretPath, "secret", { mode: 0o600 });
    let authorizeStarted!: () => void;
    let authorizeContinue!: () => void;
    const started = new Promise<void>((resolvePromise) => (authorizeStarted = resolvePromise));
    const proceed = new Promise<void>((resolvePromise) => (authorizeContinue = resolvePromise));
    const args = calendarSetupArgs(f, join(f.directory, "calendar.json"), secretPath);
    const calendarSetup = setupGoogleCalendarMain(args, capture(), {
        authorize: async () => {
            authorizeStarted();
            await proceed;
            return { code: "code", redirectUri: "http://127.0.0.1/callback" };
        },
        fetch: async () => new Response(JSON.stringify({ refresh_token: "token" }), { status: 200 }),
        verify: async () => {},
        random: (size) => new Uint8Array(size).fill(1),
    });
    await started;

    // When
    const concurrent = await captureError(() =>
        setupMain(
            [...f.args, "--intent", "use-existing", "--provider", "cursor", "--confirm-provider-change"],
            capture(),
            verified,
        ),
    );
    authorizeContinue();
    await calendarSetup;

    // Then
    assert.match(String(concurrent), /writer lock|concurrent/i);
    const setup = await loadSetupConfig(f.config);
    assert.equal(setup.provider.kind, "codex");
    assert.equal(setup.version, 2);
});

test("Calendar setup should share the ordinary setup lease when setup path uses a symlink alias", async (t) => {
    // Given
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const aliasDirectory = join(f.directory, "setup-alias");
    await symlink(f.directory, aliasDirectory);
    const secretPath = join(f.directory, "alias-client-secret");
    await writeFile(secretPath, "secret", { mode: 0o600 });
    const args = calendarSetupArgs(f, join(f.directory, "alias-calendar.json"), secretPath);
    args.setupConfig = join(aliasDirectory, "setup.json");
    let authorizeStarted!: () => void;
    let authorizeContinue!: () => void;
    const started = new Promise<void>((resolvePromise) => (authorizeStarted = resolvePromise));
    const proceed = new Promise<void>((resolvePromise) => (authorizeContinue = resolvePromise));
    const calendarSetup = setupGoogleCalendarMain(args, capture(), {
        authorize: async () => {
            authorizeStarted();
            await proceed;
            return { code: "code", redirectUri: "http://127.0.0.1/callback" };
        },
        fetch: async () => new Response(JSON.stringify({ refresh_token: "token" }), { status: 200 }),
        verify: async () => {},
        random: (size) => new Uint8Array(size).fill(2),
    });
    await started;

    // When
    const concurrent = await captureError(() =>
        setupMain(
            [...f.args, "--intent", "use-existing", "--provider", "cursor", "--confirm-provider-change"],
            capture(),
            verified,
        ),
    );
    authorizeContinue();
    await calendarSetup;

    // Then
    assert.match(String(concurrent), /writer lock|concurrent/i);
    assert.equal((await loadSetupConfig(f.config)).provider.kind, "codex");
});

test("Calendar setup should preserve first lineage claim when config target uses a symlink alias", async (t) => {
    // Given
    const first = await fixture(t);
    const second = await fixture(t);
    await setupMain(first.create, capture(), verified);
    await setupMain(second.create, capture(), verified);
    const sharedConfig = join(first.directory, "shared-calendar.json");
    const aliasDirectory = join(second.directory, "calendar-alias");
    await symlink(first.directory, aliasDirectory);
    const aliasedConfig = join(aliasDirectory, "shared-calendar.json");
    const firstSecret = join(first.directory, "first-secret");
    const secondSecret = join(second.directory, "second-secret");
    await writeFile(firstSecret, "secret", { mode: 0o600 });
    await writeFile(secondSecret, "secret", { mode: 0o600 });
    let authorizeStarted!: () => void;
    let authorizeContinue!: () => void;
    const started = new Promise<void>((resolvePromise) => (authorizeStarted = resolvePromise));
    const proceed = new Promise<void>((resolvePromise) => (authorizeContinue = resolvePromise));
    const dependencies = {
        authorize: async () => {
            authorizeStarted();
            await proceed;
            return { code: "code", redirectUri: "http://127.0.0.1/callback" };
        },
        fetch: async () => new Response(JSON.stringify({ refresh_token: "token" }), { status: 200 }),
        verify: async () => {},
        random: (size: number) => new Uint8Array(size).fill(1),
    };
    const firstSetup = setupGoogleCalendarMain(
        calendarSetupArgs(first, sharedConfig, firstSecret),
        capture(),
        dependencies,
    );
    await started;

    // When
    const racingFailure = await captureError(() =>
        setupGoogleCalendarMain(calendarSetupArgs(second, aliasedConfig, secondSecret), capture(), {
            ...dependencies,
            authorize: async () => ({ code: "code", redirectUri: "http://127.0.0.1/callback" }),
        }),
    );
    authorizeContinue();
    await firstSetup;
    const retryFailure = await captureError(() =>
        setupGoogleCalendarMain(calendarSetupArgs(second, aliasedConfig, secondSecret), capture(), {
            ...dependencies,
            authorize: async () => ({ code: "code", redirectUri: "http://127.0.0.1/callback" }),
        }),
    );

    // Then
    assert.match(String(racingFailure), /writer lock|concurrent/i);
    assert.match(String(retryFailure), /different setup binding/);
    const claimed = JSON.parse(await readFile(sharedConfig, "utf8"));
    assert.equal(claimed.setup_lineage_id, (await loadSetupConfig(first.config)).lineageId);
});

function calendarConfig(lineage: string, principal: string, directory: string) {
    return {
        config_version: 1,
        enabled: true,
        setup_lineage_id: lineage,
        principal,
        scope: "private",
        surfaces: ["local_cli"],
        authority_source_id: "authority:foreign",
        calendar_id: "primary",
        calendar_label: "Personal",
        timezone: "UTC",
        client_id: "client",
        client_secret_file: join(directory, "foreign-secret"),
        refresh_token_file: join(directory, "foreign-token"),
    };
}

function calendarSetupArgs(f: Awaited<ReturnType<typeof fixture>>, configPath: string, secretPath: string) {
    const args = parseArgs([
        "setup-google-calendar",
        "--setup-config",
        f.config,
        "--config",
        configPath,
        "--client-id",
        "client",
        "--client-secret-file",
        secretPath,
        "--refresh-token-file",
        join(f.directory, "refresh-token"),
        "--calendar-id",
        "primary",
        "--calendar-label",
        "Personal",
        "--timezone",
        "UTC",
        "--scope",
        "private",
        "--surface",
        "local_cli",
    ]);
    assert.equal(args.command, "setup-google-calendar");
    return args;
}

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
    await assert.rejects(stat(`${f.state}.onboarding.json`), { code: "ENOENT" });
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

test("cancellation during requested continuity persistence prevents creation and remains recoverable", async (t) => {
    const f = await fixture(t),
        controller = new AbortController();
    let requestedWrites = 0;
    assert.equal(
        await setupMain(f.create, capture(), {
            ...verified,
            signal: controller.signal,
            persistConfig: async (path, config) => {
                const snapshot = `${JSON.stringify(config, null, 2)}\n`;
                if (config.continuity === "requested") {
                    requestedWrites++;
                    if (requestedWrites === 1) controller.abort();
                }
                await writeFile(path, snapshot, { mode: 0o600 });
            },
        }),
        2,
    );
    const config = await loadSetupConfig(f.config);
    assert.equal(requestedWrites, 2);
    assert.equal(config.verification, "verified");
    assert.equal(config.continuity, "pending");
    assert.equal(config.cancellationRequested, true);
    await assert.rejects(stat(f.state), { code: "ENOENT" });
    assert.equal(await setupMain(f.create, capture(), verified), 0);
    assert.equal((await new StateStore(f.state).load()).lineage.lineageId, config.lineageId);
});

for (const phase of ["initial", "verification"] as const) {
    test(`cancellation during ${phase} persistence records cancellation before returning`, async (t) => {
        const f = await fixture(t),
            controller = new AbortController();
        let writes = 0;
        assert.equal(
            await setupMain(f.create, capture(), {
                ...verified,
                signal: controller.signal,
                persistConfig: async (path, config) => {
                    const snapshot = `${JSON.stringify(config, null, 2)}\n`;
                    const targeted = phase === "initial" ? writes === 0 : config.verification === "verified";
                    writes++;
                    if (targeted) controller.abort();
                    await writeFile(path, snapshot, { mode: 0o600 });
                },
            }),
            2,
        );
        const config = await loadSetupConfig(f.config);
        assert.equal(config.cancellationRequested, true);
        assert.equal(config.continuity, "pending");
        assert.equal(config.verification, phase === "initial" ? "not_attempted" : "verified");
        await assert.rejects(stat(f.state), { code: "ENOENT" });
    });
}

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

test("configured CLI rejects a replacement lineage inside the application-owned interaction lease", async (t) => {
    const f = await fixture(t);
    const original = initialState("user");
    const replacement = initialState("user");
    const store = new StateStore(f.state);
    await store.create(original);
    let providerCalls = 0;
    const io = capture();
    io.input = Readable.from(
        (async function* () {
            await writeFile(f.state, `${JSON.stringify(replacement)}\n`);
            yield "Hello\n";
        })(),
    );

    assert.equal(
        await runCliSurface(
            {
                statePath: f.state,
                principal: "user",
                scope: "relationship:user",
                expectedContinuityBinding: {
                    lineageId: original.lineage.lineageId,
                    establishedAt: original.lineage.establishedAt,
                },
                providerKind: "claude-code",
                providerCommand: "claude-code",
                providerArgs: [],
                providerTimeoutSeconds: 30,
                claudeProviderFactory: () => async () => {
                    providerCalls++;
                    return success;
                },
            },
            io,
        ),
        0,
    );

    assert.match(io.text(), /continuity no longer matches setup binding/);
    assert.equal(providerCalls, 0);
    assert.deepEqual(await store.load(), replacement);
    assert.deepEqual(await store.lockStatus(), { status: "absent" });
});

test(":setup telegram is local, keeps no runtime open, and resumes conversation", async (t) => {
    const f = await fixture(t);
    const state = initialState("user");
    const store = new StateStore(f.state);
    await store.create(state);
    let handoffs = 0;
    let permitQuit!: () => void;
    let resumed!: () => void;
    let waiting!: () => void;
    const permitQuitPromise = new Promise<void>((resolvePermit) => (permitQuit = resolvePermit));
    const resumedPromise = new Promise<void>((resolveResumed) => (resumed = resolveResumed));
    const waitingPromise = new Promise<void>((resolveWaiting) => (waiting = resolveWaiting));
    const io = capture();
    io.input = Readable.from(
        (async function* () {
            yield ":setup telegram\n";
            await resumedPromise;
            waiting();
            await permitQuitPromise;
            yield ":quit\n";
        })(),
    );
    const running = runCliSurface(
        {
            statePath: f.state,
            principal: "user",
            scope: "relationship:user",
            providerKind: "process",
            providerCommand: "unused",
            providerArgs: [],
            providerTimeoutSeconds: 1,
            configuredSetupHandoff: async () => {
                handoffs++;
                assert.deepEqual(await store.lockStatus(), { status: "absent" });
                resumed();
                return {
                    status: "cancelled",
                    stages: {
                        token_storage: "not_attempted",
                        bot_preflight: "not_attempted",
                        mapping: "not_attempted",
                        configuration: "not_attempted",
                        unit_installation: "not_attempted",
                        activation: "not_attempted",
                        round_trip: "not_attempted",
                    },
                };
            },
        },
        io,
    );
    await waitingPromise;
    assert.deepEqual(await store.lockStatus(), { status: "absent" });
    const telegramLease = await store.acquireWriteLease();
    const beforeTelegram = await store.load();
    const telegram = startRuntime(beforeTelegram, "user", "relationship:user");
    assert.equal(telegram.state.operations.runtimeEpisodes.at(-1)?.recoveryAccount.gapKind, "initial_start");
    const telegramStarted = await store.commit(beforeTelegram.revision, telegram.state);
    await store.commit(
        telegramStarted.revision,
        stopRuntime(telegramStarted, telegram.runtimeId, { reason: "telegram_update_complete" }),
    );
    await store.releaseWriteLease(telegramLease);
    permitQuit();
    assert.equal(await running, 0);
    assert.equal(handoffs, 1);
    const final = await store.load();
    assert.equal(final.operations.runtimeEpisodes.length, 1);
    assert.ok(final.operations.runtimeEpisodes.every((episode) => episode.cleanStopAt !== null));
    assert.equal(
        final.operations.runtimeEpisodes.some(
            (episode) => episode.recoveryAccount.gapKind === "uncertain_interruption_boundary",
        ),
        false,
    );
    assert.match(io.text(), /Telegram setup: cancelled\. Resuming conversation\./);
});

test("CLI should continue automatic memory reflection when onboarding closes", async (t) => {
    // Given
    const f = await fixture(t);
    const state = initialState("user");
    await new StateStore(f.state).create(state);
    await new OnboardingWorkStore(f.state).save(
        createOnboardingWork(state.lineage.lineageId, "user", "relationship:user", "2026-01-01T00:00:00.000Z"),
    );
    const counter = join(f.directory, "reflection-count.txt");
    const io = capture("Finish onboarding\nSecond ordinary turn\n:quit\n");

    // When
    assert.equal(
        await runCliSurface(
            {
                statePath: f.state,
                principal: "user",
                scope: "relationship:user",
                providerKind: "process",
                providerCommand: process.execPath,
                providerArgs: [
                    resolve("tests/fixtures/providers/scripted-onboarding-provider.ts"),
                    "--reflection-counter",
                    counter,
                ],
                providerTimeoutSeconds: 2,
            },
            io,
        ),
        0,
    );

    // Then
    assert.equal((await new OnboardingWorkStore(f.state).load())?.status, "closed");
    assert.equal(await readFile(counter, "utf8"), "2");
    assert.equal(io.text().match(/PRIMARY_RESPONSE/g)?.length, 2);
    const runtimes = (await new StateStore(f.state).load()).operations.runtimeEpisodes;
    assert.equal(runtimes.length, 2);
    assert.ok(runtimes.every((runtime) => runtime.stopReason === "application_interaction_complete"));
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

test("restart activates matching pending onboarding work after continuity was committed", async (t) => {
    const f = await fixture(t);
    await setupMain(f.create, capture(), verified);
    const onboardingPath = `${f.state}.onboarding.json`;
    const onboarding = JSON.parse(await readFile(onboardingPath, "utf8"));
    onboarding.status = "pending_activation";
    await writeFile(onboardingPath, JSON.stringify(onboarding));
    const config = await loadSetupConfig(f.config);
    config.continuity = "available";
    await writeFile(f.config, JSON.stringify(config));

    assert.equal(await main(["run", "--config", f.config, "--scope", "test"], capture()), 2);
    assert.equal(await setupMain([...f.args, "--intent", "use-existing"], capture(), verified), 0);
    assert.equal(JSON.parse(await readFile(onboardingPath, "utf8")).status, "active");
    assert.equal((await loadSetupConfig(f.config)).continuity, "available");
});

for (const kind of ["codex", "cursor"]) {
    test(`actual CLI setup and configured conversation use the ${kind} production adapter with a deterministic executable`, async (t) => {
        const f = await fixture(t);
        const executable = join(f.directory, `${kind}.ts`);
        await copyFile(resolve(`tests/fixtures/providers/scripted-${kind}.ts`), executable);
        await chmod(executable, 0o700);
        const result = await command(["setup", ...f.create.slice(0, -1), kind, "--provider-command", executable]);
        assert.equal(result.code, 0, JSON.stringify(result));
        assert.match(result.stdout, /--scope 'relationship:user-secret-marker'/);
        const run = await command(["run", "--config", f.config, "--scope", "relationship:user-secret-marker"], {
            stdin: "hello\n:quit\n",
        });
        assert.equal(run.code, 0, run.stderr);
        assert.match(run.stdout, new RegExp(`${kind.toUpperCase()}_CLI_RESPONSE`));
        const before = await readFile(f.state, "utf8");
        const rerun = await command(["setup", ...f.args, "--intent", "use-existing"]);
        assert.equal(rerun.code, 0, rerun.stderr);
        assert.equal(await readFile(f.state, "utf8"), before);
    });
}
