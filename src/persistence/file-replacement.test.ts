import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { DurabilityUncertain } from "../core/errors.ts";
import { replaceFileAtomically, replaceFileDurably } from "./file-replacement.ts";

test("atomic file replacement should publish complete replacement and clean temporary file", async () => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-file-replacement-")),
        path = join(directory, "record.json");
    await writeFile(path, "old\n");
    // When
    await replaceFileAtomically(path, "new\n");
    // Then
    assert.equal(await readFile(path, "utf8"), "new\n");
    assert.deepEqual(await readdir(directory), ["record.json"]);
});

test("atomic file replacement should clean temporary file when rename fails", async () => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-file-replacement-")),
        targetDirectory = join(directory, "target");
    await mkdir(targetDirectory);
    // When
    await assert.rejects(() => replaceFileAtomically(targetDirectory, "content\n"));
    // Then
    assert.deepEqual(await readdir(directory), ["target"]);
});

test("durable file replacement should report post-rename directory sync failure as uncertain", async () => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-file-replacement-")),
        path = join(directory, "record.json");
    await writeFile(path, "old\n");
    // When / Then
    await assert.rejects(
        () =>
            replaceFileDurably(path, "new\n", {
                durabilityUncertainMessage: "replacement durability is uncertain",
                directorySync: async () => {
                    throw new Error("directory sync failed");
                },
            }),
        (error: unknown) => {
            assert.ok(error instanceof DurabilityUncertain);
            assert.equal(error.replacementMayBeVisible, true);
            return true;
        },
    );
    assert.equal(await readFile(path, "utf8"), "new\n");
    assert.deepEqual(await readdir(directory), ["record.json"]);
});

test("durable file replacement should invoke directory sync after canonical replacement is visible", async () => {
    // Given
    const directory = await mkdtemp(join(tmpdir(), "ember-file-replacement-")),
        path = join(directory, "record.json"),
        observations: string[] = [];
    // When
    await replaceFileDurably(path, "new\n", {
        durabilityUncertainMessage: "replacement durability is uncertain",
        directorySync: async () => {
            observations.push(await readFile(path, "utf8"));
        },
    });
    // Then
    assert.deepEqual(observations, ["new\n"]);
});
