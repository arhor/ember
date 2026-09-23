import assert from "node:assert/strict";
import test from "node:test";

import type { CommandRunner } from "./systemd.ts";

import { renderSystemdService, SystemdTelegramResidentHost, SystemdUserBackgroundHost } from "./systemd.ts";

const CONFIG = {
    systemd_run_command: "/usr/bin/systemd-run",
    systemctl_command: "/usr/bin/systemctl",
};
const JOB = {
    jobId: "ember-wake-opaque-1",
    executable: "/usr/bin/node",
    arguments: ["/opt/ember/runtime.ts", "run-wake", "--wake-id", "opaque-1"],
};

test("systemd scheduling maps an opaque job to a timer without leaking its unit names", async () => {
    const calls: Array<{ command: string; arguments_: string[] }> = [];
    const host = new SystemdUserBackgroundHost(CONFIG, capturingRunner(calls));

    const observation = await host.scheduleWake(JOB, "2026-09-04T10:00:00.250Z");

    assert.equal(observation.jobId, JOB.jobId);
    assert.equal(observation.state, "scheduled");
    assert.ok(calls[0]!.arguments_.includes("--on-calendar=2026-09-04 10:00:01 UTC"));
    assert.ok(calls[0]!.arguments_.includes(`--unit=${JOB.jobId}`));
});

test("systemd inspection maps timer and service units back to one logical host state", async () => {
    const inspected: string[] = [];
    const runner: CommandRunner = async (_command, arguments_) => {
        const unit = arguments_[2]!;
        inspected.push(unit);
        return {
            code: 0,
            signal: null,
            stdout: unit.endsWith(".timer") ? "loaded\nactive\n" : "not-found\ninactive\n",
            stderr: "",
        };
    };
    const host = new SystemdUserBackgroundHost(CONFIG, runner);

    const observation = await host.inspect(JOB.jobId);

    assert.equal(observation.state, "scheduled");
    assert.deepEqual(inspected.sort(), [`${JOB.jobId}.service`, `${JOB.jobId}.timer`].sort());
});

test("systemd stop treats an absent timer as benign for a service-only job", async () => {
    const stopped: string[] = [];
    const runner: CommandRunner = async (_command, arguments_) => {
        const unit = arguments_.at(-1)!;
        stopped.push(unit);
        return unit.endsWith(".timer")
            ? { code: 5, signal: null, stdout: "", stderr: `Unit ${unit} not loaded.` }
            : { code: 0, signal: null, stdout: "", stderr: "" };
    };
    const host = new SystemdUserBackgroundHost(CONFIG, runner);

    const observation = await host.stop(JOB.jobId);

    assert.equal(observation.state, "stopped");
    assert.deepEqual(stopped.sort(), [`${JOB.jobId}.service`, `${JOB.jobId}.timer`].sort());
});

test("systemd stop preserves a non-absence control failure", async () => {
    const runner: CommandRunner = async (_command, arguments_) => ({
        code: arguments_.at(-1)!.endsWith(".service") ? 1 : 0,
        signal: null,
        stdout: "",
        stderr: arguments_.at(-1)!.endsWith(".service") ? "Access denied" : "",
    });
    const host = new SystemdUserBackgroundHost(CONFIG, runner);

    await assert.rejects(host.stop(JOB.jobId), /Access denied/);
});

test("systemd service rendering keeps host syntax out of the runtime", () => {
    const unit = renderSystemdService({
        description: "Ember reconciliation",
        launch: JOB,
        restart: "no",
        wantedBy: "default.target",
    });

    assert.match(unit, /Type=oneshot/);
    assert.match(unit, /Restart=no/);
    assert.match(unit, /"run-wake" "--wake-id"/);
});

function capturingRunner(calls: Array<{ command: string; arguments_: string[] }>): CommandRunner {
    return async (command, arguments_) => {
        calls.push({ command, arguments_: [...arguments_] });
        return { code: 0, signal: null, stdout: "", stderr: "" };
    };
}

test("Telegram resident host should render a private restartable unit when given a launch specification", () => {
    // Given
    const host = new SystemdTelegramResidentHost();
    const launch = {
        jobId: "ember-telegram",
        executable: "/usr/bin/node",
        arguments: ["/opt/ember/bin/ember-telegram.ts", "serve", "--config", "/home/user/telegram%.json"],
        workingDirectory: "/opt/ember",
        stopTimeoutSeconds: 30,
    };

    // When
    const unit = host.render(launch);

    // Then
    assert.match(unit, /Wants=network-online\.target\nAfter=network-online\.target/);
    assert.match(unit, /Type=exec\nWorkingDirectory="\/opt\/ember"/);
    assert.match(
        unit,
        /ExecStart="\/usr\/bin\/node" "\/opt\/ember\/bin\/ember-telegram\.ts" "serve" "--config" "\/home\/user\/telegram%%\.json"/,
    );
    assert.match(unit, /Restart=on-failure\nRestartSec=5s\nKillMode=mixed\nTimeoutStopSec=30s\nUMask=0077/);
    assert.match(unit, /WantedBy=default.target/);
    assert.equal(unit.includes("12345:secret-token"), false);
});

test("Telegram resident host should preserve service lifecycle commands when activating a stopped service", async () => {
    // Given
    const calls: Array<[string, string[]]> = [];
    const host = new SystemdTelegramResidentHost({
        command: async (command, args) => {
            calls.push([command, args]);
            return { code: 0, signal: null };
        },
    });

    // When
    const status = await host.inspect();
    const stopped = await host.stop();
    const activated = await host.activate(false);

    // Then
    assert.deepEqual(status, { installed: "yes", active: "yes" });
    assert.equal(stopped, "confirmed");
    assert.equal(activated, "confirmed");
    assert.deepEqual(calls, [
        ["systemctl", ["--user", "is-enabled", "ember-telegram.service"]],
        ["systemctl", ["--user", "is-active", "ember-telegram.service"]],
        ["systemctl", ["--user", "stop", "ember-telegram.service"]],
        ["systemctl", ["--user", "daemon-reload"]],
        ["systemctl", ["--user", "enable", "--now", "ember-telegram.service"]],
    ]);
});

test("Telegram resident host should report uncertain activation when daemon reload is interrupted", async () => {
    // Given
    const calls: string[] = [];
    const host = new SystemdTelegramResidentHost({
        command: async (_command, args) => {
            calls.push(args[1]!);
            return { code: null, signal: "SIGTERM" };
        },
    });

    // When
    const result = await host.activate(true);

    // Then
    assert.equal(result, "uncertain");
    assert.deepEqual(calls, ["daemon-reload"]);
});

test("Telegram resident host should install a private unit at its own definition path", async () => {
    // Given
    const writes: Array<{ path: string; content: string; mode: number }> = [];
    const host = new SystemdTelegramResidentHost({
        write: async (path, content, mode) => {
            writes.push({ path, content, mode });
        },
    });

    // When
    await host.install("[Unit]\n");

    // Then
    assert.equal(writes.length, 1);
    assert.match(writes[0]!.path, /\/\.config\/systemd\/user\/ember-telegram\.service$/);
    assert.equal(writes[0]!.content, "[Unit]\n");
    assert.equal(writes[0]!.mode, 0o600);
});

test("Telegram resident host should read the same definition it installs", async () => {
    // Given
    const paths: string[] = [];
    const host = new SystemdTelegramResidentHost({
        read: async (path) => {
            paths.push(path);
            return "[Unit]\n";
        },
        write: async (path) => {
            paths.push(path);
        },
    });

    // When
    const existing = await host.readDefinition();
    await host.install(existing!);

    // Then
    assert.equal(existing, "[Unit]\n");
    assert.equal(paths.length, 2);
    assert.equal(paths[0], paths[1]);
});
