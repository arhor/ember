import assert from "node:assert/strict";
import test from "node:test";

import { UnavailableBackgroundHost } from "./background.ts";

const JOB = {
    jobId: "opaque-work-1",
    executable: "/usr/bin/node",
    arguments: ["worker.ts"],
};

test("foreground composition can expose background work as unsupported without a service manager", async () => {
    const host = new UnavailableBackgroundHost();

    assert.equal((await host.start(JOB)).state, "unsupported");
    assert.equal((await host.scheduleWake(JOB, "2026-09-23T12:00:00Z")).state, "unsupported");
    assert.equal((await host.inspect(JOB.jobId)).state, "unsupported");
    assert.equal((await host.stop(JOB.jobId)).state, "unsupported");
});
