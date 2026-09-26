import { randomUUID } from "node:crypto";
import { appendFile, chmod, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { SetupProbeDiagnostic } from "../app/bootstrap.ts";

export interface SetupDiagnostics {
    readonly path: string;
    record(event: SetupProbeDiagnostic): Promise<void>;
    discard(): Promise<void>;
}

/**
 * Opt-in host-local diagnostics for a setup probe. Records are deliberately
 * allowlisted by SetupProbeDiagnostic and never include provider payloads.
 */
export async function createSetupDiagnostics(
    directory = join(homedir(), ".ember", "logs", "setup"),
): Promise<SetupDiagnostics> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const path = join(directory, `probe-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID()}.jsonl`);

    return {
        path,
        async record(event) {
            await appendFile(path, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
            await chmod(path, 0o600);
        },
        async discard() {
            await rm(path, { force: true });
        },
    };
}
