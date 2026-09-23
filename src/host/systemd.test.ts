import assert from "node:assert/strict";
import test from "node:test";

import type { CommandRunner } from "./systemd.ts";

import { renderSystemdService, SystemdUserBackgroundHost } from "./systemd.ts";

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
