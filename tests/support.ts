import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { initialState } from "../src/core/model.ts";
import {
    attachDetail,
    rememberEpisode,
    rememberFact,
    rememberPreference,
    rememberRelationship,
    undertake,
} from "../src/core/semantics.ts";

export const PRINCIPAL = "user-1";
export const SCOPE = "project:ember/docs";
export const RELATIONSHIP_SCOPE = "relationship:user-1";
export const ROOT = resolve(import.meta.dirname, "..");
export const CLI = join(ROOT, "bin", "ember.ts");
export const PROVIDER = join(ROOT, "tests", "fixtures", "providers", "scripted-provider.ts");

export function populatedState() {
    const state = initialState("Ember", PRINCIPAL, "2026-08-29T10:00:00Z");
    const relationship = rememberRelationship(
        state,
        PRINCIPAL,
        "relationship:user-1",
        RELATIONSHIP_SCOPE,
        "Continuing collaborators",
    );
    const fact = rememberFact(
        state,
        PRINCIPAL,
        "user:user-1",
        "home-server",
        RELATIONSHIP_SCOPE,
        "Home server is a Raspberry Pi 5",
    );
    const preference = rememberPreference(
        state,
        PRINCIPAL,
        "user:user-1",
        "docs-rationale-detail",
        SCOPE,
        "Prefer concise architectural rationale",
    );
    const commitment = undertake(
        state,
        PRINCIPAL,
        "restart-provenance-check",
        SCOPE,
        "Check restart reconstruction preserves provenance without transcript replay",
    );
    const episode = rememberEpisode(
        state,
        PRINCIPAL,
        "first-continuity-experiment",
        "relationship:user-1",
        RELATIONSHIP_SCOPE,
        "The first continuity experiment received a nickname",
    );
    const detail = attachDetail(state, PRINCIPAL, episode, "Cinder");

    return {
        state,
        ids: {
            relationship,
            fact,
            preference,
            commitment,
            episode,
            detail,
        },
    };
}

export async function tempDir() {
    return mkdtemp(join(tmpdir(), "ember-ts-test-"));
}

export async function command(
    args: any,
    { stdin = "", now = "2026-08-29T10:00:00Z", fixtureFaults = false, env = {} } = {},
) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [CLI, ...args], {
            cwd: ROOT,
            env: {
                ...process.env,
                EMBER_TEST_NOW: now,
                ...(fixtureFaults ? { EMBER_ENABLE_FIXTURE_FAULTS: "1" } : {}),
                ...env,
            },
            stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "",
            stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (x) => (stdout += x));
        child.stderr.on("data", (x) => (stderr += x));
        child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
        child.stdin.end(stdin);
    });
}

export async function readJson(path: string) {
    return JSON.parse(await readFile(path, "utf8"));
}

export async function captureError(action: any) {
    try {
        await action();
        return null;
    } catch (error) {
        return error;
    }
}

export function emptyRequest() {
    return {
        contract_version: 1,
        cognition_id: "cognition-test",
        projection: { selection: { meaning_ids: [] } },
        input: { text: "hello" },
    };
}
