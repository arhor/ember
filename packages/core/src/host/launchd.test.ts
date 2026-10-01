import assert from "node:assert/strict";
import test from "node:test";

import { LaunchdTelegramResidentHost, renderLaunchAgent } from "./launchd.ts";

const launch = {
    jobId: "ember-telegram",
    executable: "/opt/node & tools/node",
    arguments: ["/opt/ember/bin/ember-telegram.ts", "serve", "--config", "/Users/me/telegram<local>.json"],
    workingDirectory: "/opt/ember",
    stopTimeoutSeconds: 90,
};

test("renderLaunchAgent should produce a login-scoped transport plist when given a validated launch", () => {
    // Given
    const input = launch;

    // When
    const plist = renderLaunchAgent(input);

    // Then
    assert.match(plist, /<key>Label<\/key>\s*<string>dev\.ember\.telegram<\/string>/);
    assert.match(plist, /<key>RunAtLoad<\/key>\s*<true\/>/);
    assert.match(plist, /<key>KeepAlive<\/key>\s*<true\/>/);
    assert.match(plist, /<key>ExitTimeOut<\/key>\s*<integer>90<\/integer>/);
    assert.match(plist, /<key>Umask<\/key>\s*<string>077<\/string>/);
    assert.match(plist, /\/opt\/node &amp; tools\/node/);
    assert.match(plist, /telegram&lt;local&gt;\.json/);
    assert.doesNotMatch(plist, /EnvironmentVariables|token_file|state_path/);
});

test("renderLaunchAgent should reject control characters when launch arguments are unsafe", () => {
    // Given
    const input = { ...launch, arguments: ["--config", "/tmp/config\nmalformed"] };

    // When
    const render = () => renderLaunchAgent(input);

    // Then
    assert.throws(render, /safe/);
});

test("renderLaunchAgent should reject invalid stop timeouts when launchd requires an integer", () => {
    // Given
    const input = { ...launch, stopTimeoutSeconds: 0.5 };

    // When
    const render = () => renderLaunchAgent(input);

    // Then
    assert.throws(render, /stop timeout/);
});

test("LaunchdTelegramResidentHost should install and activate a private per-user agent when service is absent", async () => {
    // Given
    const calls: string[][] = [];
    const writes: Array<{ path: string; mode: number }> = [];
    let installed = false;
    const host = new LaunchdTelegramResidentHost({
        home: "/Users/me",
        uid: 501,
        read: async () => (installed ? "plist" : null),
        write: async (path, _content, mode) => {
            writes.push({ path, mode });
            installed = true;
        },
        command: async (args) => {
            calls.push(args);
            return args[0] === "print"
                ? { code: 113, stdout: "", stderr: "Could not find service" }
                : { code: 0, stdout: "", stderr: "" };
        },
    });

    // When
    await host.install(host.render(launch));
    const activated = await host.activate(false);

    // Then
    assert.equal(activated, "confirmed");
    assert.deepEqual(writes, [{ path: "/Users/me/Library/LaunchAgents/dev.ember.telegram.plist", mode: 0o600 }]);
    assert.deepEqual(calls, [
        ["print", "gui/501/dev.ember.telegram"],
        ["bootstrap", "gui/501", "/Users/me/Library/LaunchAgents/dev.ember.telegram.plist"],
    ]);
});

test("LaunchdTelegramResidentHost should remove a stopped agent when uninstalling", async () => {
    // Given
    const calls: string[][] = [];
    const removed: string[] = [];
    const host = new LaunchdTelegramResidentHost({
        home: "/Users/me",
        uid: 501,
        command: async (args) => {
            calls.push(args);
            return { code: 0, stdout: "", stderr: "" };
        },
        remove: async (path) => {
            removed.push(path);
        },
    });

    // When
    const result = await host.uninstall();

    // Then
    assert.equal(result, "confirmed");
    assert.deepEqual(calls, [["bootout", "gui/501/dev.ember.telegram"]]);
    assert.deepEqual(removed, ["/Users/me/Library/LaunchAgents/dev.ember.telegram.plist"]);
});

test("LaunchdTelegramResidentHost should report unknown activity when launchctl fails unexpectedly", async () => {
    // Given
    const host = new LaunchdTelegramResidentHost({
        home: "/Users/me",
        uid: 501,
        read: async () => "plist",
        command: async () => ({ code: 5, stdout: "", stderr: "Permission denied" }),
    });

    // When
    const status = await host.inspect();

    // Then
    assert.deepEqual(status, { installed: "yes", active: "unknown" });
});

test("LaunchdTelegramResidentHost should treat a loaded idle agent as active during setup", async () => {
    // Given
    const host = new LaunchdTelegramResidentHost({
        home: "/Users/me",
        uid: 501,
        read: async () => "plist",
        command: async () => ({ code: 0, stdout: "state = waiting\n", stderr: "" }),
    });

    // When
    const status = await host.inspect();

    // Then
    assert.deepEqual(status, { installed: "yes", active: "yes" });
});
