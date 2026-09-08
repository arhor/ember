import type { FileHandle } from "node:fs/promises";

import { randomUUID } from "node:crypto";
import { mkdir, open, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { DurabilityUncertain } from "../core/errors.ts";

export interface AtomicFileReplacementOptions {
    mode?: number;
}

export interface DurableFileReplacementOptions extends AtomicFileReplacementOptions {
    directorySync?: (directory: string) => Promise<void>;
    durabilityUncertainMessage: string;
}

export async function replaceFileAtomically(
    path: string,
    content: string,
    { mode = 0o600 }: AtomicFileReplacementOptions = {},
) {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const temporary = temporaryPath(path);
    let replaced = false;
    try {
        await writeFile(temporary, content, { encoding: "utf8", mode, flag: "wx" });
        await rename(temporary, path);
        replaced = true;
    } finally {
        if (!replaced) await unlink(temporary).catch(() => {});
    }
}

export async function replaceFileDurably(
    path: string,
    content: string,
    {
        mode = 0o600,
        directorySync = syncDirectory,
        durabilityUncertainMessage,
    }: DurableFileReplacementOptions,
) {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const temporary = temporaryPath(path);
    let handle: FileHandle | null = null;
    let replaced = false;
    try {
        handle = await open(temporary, "wx", mode);
        await handle.writeFile(content, { encoding: "utf8" });
        await handle.sync();
        await handle.close();
        handle = null;
        await rename(temporary, path);
        replaced = true;
        try {
            await directorySync(directory);
        } catch (error) {
            throw new DurabilityUncertain(durabilityUncertainMessage, { cause: error });
        }
    } finally {
        if (handle) await handle.close().catch(() => {});
        if (!replaced) await unlink(temporary).catch(() => {});
    }
}

export async function syncDirectory(directory: string) {
    const handle = await open(directory, "r");
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

function temporaryPath(path: string) {
    const directory = dirname(path);
    return join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
}
