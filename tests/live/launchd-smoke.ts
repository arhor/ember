import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { renderLaunchAgent } from "../../src/core/host/launchd.ts";

const run = promisify(execFile);

if (process.env.EMBER_RUN_LIVE_LAUNCHD !== "1") {
    process.stdout.write("skipped: set EMBER_RUN_LIVE_LAUNCHD=1 to run the isolated launchd smoke\n");
} else if (process.platform !== "darwin" || process.getuid === undefined) {
    process.stdout.write("skipped: launchd smoke requires macOS with a local user id\n");
} else {
    await access("/bin/launchctl");
    const domain = `gui/${process.getuid()}`;
    try {
        await run("/bin/launchctl", ["print", domain]);
    } catch {
        process.stdout.write("skipped: no accessible GUI login domain\n");
        process.exit(0);
    }

    const label = `dev.ember.smoke.${randomUUID()}`;
    const target = `${domain}/${label}`;
    const directory = await mkdtemp(join(tmpdir(), "ember-launchd-smoke-"));
    const path = join(directory, `${label}.plist`);
    let bootstrapped = false;
    try {
        await writeFile(
            path,
            renderLaunchAgent(
                { jobId: label, executable: "/bin/sleep", arguments: ["60"], stopTimeoutSeconds: 5 },
                label,
            ),
            { mode: 0o600 },
        );
        await run("/bin/launchctl", ["bootstrap", domain, path]);
        bootstrapped = true;
        const { stdout } = await run("/bin/launchctl", ["print", target]);
        assert.ok(stdout.startsWith(target));
        assert.match(stdout, /umask = 77/);
        assert.match(stdout, /exit timeout = 5/);
        process.stdout.write(`launchd bootstrap and print confirmed for ${label}\n`);
    } finally {
        if (bootstrapped) {
            await run("/bin/launchctl", ["bootout", target]);
            process.stdout.write(`launchd bootout confirmed for ${label}\n`);
        }
        await rm(directory, { recursive: true, force: true });
    }
}
