import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
interface AtomicFileReplacementOptions {
    mode?: number;
    temporaryId?: () => string;
}
export async function replaceFileAtomically(
    path: string,
    content: string,
    { mode = 0o600, temporaryId = randomUUID }: AtomicFileReplacementOptions = {},
) {
    const directory = dirname(path);
    await mkdir(directory, { recursive: true });
    const temporary = temporaryPath(path, temporaryId());
    let replaced = false;
    try {
        await writeFile(temporary, content, { encoding: "utf8", mode, flag: "wx" });
        await rename(temporary, path);
        replaced = true;
    } finally {
        if (!replaced) await unlink(temporary).catch(() => {});
    }
}

function temporaryPath(path: string, id: string) {
    const directory = dirname(path);
    return join(directory, `.${basename(path)}.${process.pid}.${id}.tmp`);
}
