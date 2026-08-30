import { access, mkdir, open, readFile, rename, unlink, type FileHandle } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { parsePersistentState, validatePersistentState } from "./validation.ts";
import type { PersistentState } from "./model.ts";

interface Lease { handle: FileHandle; ownerToken: string }

export class EvaluationStore {
  readonly path: string;
  readonly lockPath: string;
  private lease: Lease | null = null;

  constructor(path: string) {
    this.path = path;
    this.lockPath = `${path}.lock`;
  }

  async create(state: PersistentState): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const lease = await this.acquireWriteLease();
    try {
      try {
        await access(this.path);
        throw new Error(`continuity store already exists: ${this.path}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("continuity store already exists")) throw error;
        if (errorCode(error) !== "ENOENT") throw error;
      }
      await this.replaceDocument(state);
    } finally {
      await this.releaseWriteLease(lease);
    }
  }

  async load(): Promise<PersistentState> {
    return parsePersistentState(await readFile(this.path, "utf8"));
  }

  async acquireWriteLease(): Promise<Lease> {
    if (this.lease) return this.lease;
    await mkdir(dirname(this.path), { recursive: true });
    let handle: FileHandle;
    try {
      handle = await open(this.lockPath, "wx", 0o600);
    } catch (error) {
      if (errorCode(error) === "EEXIST") throw new Error(`concurrent writer: ${this.lockPath}`);
      throw error;
    }
    const ownerToken = randomUUID();
    await handle.writeFile(`${JSON.stringify({ lock_version: 1, owner_token: ownerToken, pid: process.pid })}\n`, "utf8");
    await handle.sync();
    this.lease = { handle, ownerToken };
    return this.lease;
  }

  async releaseWriteLease(lease: Lease = this.requireLease()): Promise<void> {
    if (lease !== this.lease) throw new Error("write lease is not owned by this store");
    const metadata: unknown = JSON.parse(await readFile(this.lockPath, "utf8"));
    if (!isOwner(metadata, lease.ownerToken)) throw new Error("lock owner token changed");
    await lease.handle.close();
    this.lease = null;
    await unlink(this.lockPath);
  }

  async commit(expectedRevision: number, candidate: PersistentState, lease: Lease = this.requireLease()): Promise<PersistentState> {
    if (lease !== this.lease) throw new Error("commit requires the cooperating writer lease");
    const current = await this.load();
    if (current.revision !== expectedRevision) throw new Error(`stale revision: expected ${expectedRevision}, found ${current.revision}`);
    const committed = validatePersistentState({ ...candidate, revision: expectedRevision + 1 });
    await this.replaceDocument(committed);
    return committed;
  }

  private requireLease(): Lease {
    if (!this.lease) throw new Error("write lease is not held");
    return this.lease;
  }

  private async replaceDocument(state: PersistentState): Promise<void> {
    const validated = validatePersistentState(state);
    const directory = dirname(this.path);
    const temporary = join(directory, `.${basename(this.path)}.${process.pid}.${randomUUID()}.tmp`);
    let handle: FileHandle | null = null;
    let replaced = false;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(validated, null, 2)}\n`, "utf8");
      await handle.sync();
      await handle.close();
      handle = null;
      await rename(temporary, this.path);
      replaced = true;
      await syncDirectory(directory);
    } finally {
      if (handle) await handle.close().catch(() => {});
      if (!replaced) await unlink(temporary).catch(() => {});
    }
  }
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined;
}

function isOwner(value: unknown, token: string): boolean {
  return typeof value === "object" && value !== null && "owner_token" in value && (value as { owner_token?: unknown }).owner_token === token;
}
