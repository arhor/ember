import { access, mkdir, open, readFile, rename, unlink, type FileHandle } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { ConcurrentWriter, DurabilityUncertain, StaleRevision, StoreExists, StoreUnavailable } from "../core/errors.ts";
import { isRfc3339Utc, cloneState, nowUtc, validateState, type EmberState } from "../core/model.ts";

const decoder = new TextDecoder("utf-8", { fatal: true });

export interface LockMetadata {
    lock_version: 1;
    owner_token: string;
    pid: number;
    hostname: string;
    acquired_at: string;
}

export type LockStatus =
    | { status: "absent" }
    | { status: "malformed"; reason: string }
    | { status: "indeterminate"; error: string }
    | { status: "valid"; metadata: LockMetadata }
    | { status: "foreign_host"; metadata: LockMetadata; liveness: "indeterminate" }
    | { status: "live"; metadata: LockMetadata; liveness: "alive" }
    | { status: "apparently_stale"; metadata: LockMetadata; liveness: "absent" }
    | { status: "permission_denied"; metadata: LockMetadata; liveness: "indeterminate" }
    | { status: "indeterminate"; metadata: LockMetadata; liveness: "indeterminate"; error: string };

export interface WriteLease {
    handle: FileHandle;
    metadata: LockMetadata;
}

export interface StateStoreOptions {
    hostname?: string;
    pid?: number;
    kill?: (pid: number, signal?: NodeJS.Signals | 0) => boolean | void;
    now?: () => string;
    uuid?: () => string;
    directorySync?: (directory: string) => Promise<void>;
}

export class StateStore {
    readonly path: string;
    readonly lockPath: string;
    readonly host: string;
    readonly pid: number;
    readonly kill: (pid: number, signal?: NodeJS.Signals | 0) => boolean | void;
    readonly now: () => string;
    readonly uuid: () => string;
    directorySync: (directory: string) => Promise<void>;
    lease: WriteLease | null = null;

    constructor(path: string, options: StateStoreOptions = {}) {
        this.path = path;
        this.lockPath = `${path}.lock`;
        this.host = options.hostname ?? hostname();
        this.pid = options.pid ?? process.pid;
        this.kill = options.kill ?? process.kill.bind(process);
        this.now = options.now ?? nowUtc;
        this.uuid = options.uuid ?? randomUUID;
        this.directorySync = options.directorySync ?? syncDirectory;
    }

    async create(state: EmberState) {
        validateState(state);
        await mkdir(dirname(this.path), { recursive: true });
        const lease = await this.acquireWriteLease();
        try {
            try {
                await access(this.path);
                throw new StoreExists(`continuity store already exists: ${this.path}`);
            } catch (error) {
                if (error instanceof StoreExists) throw error;
                if (errorCode(error) !== "ENOENT") throw error;
            }
            await this.replaceDocument(state);
        } finally {
            await this.releaseWriteLease(lease);
        }
    }

    async load(): Promise<EmberState> {
        let bytes: Buffer;
        try {
            bytes = await readFile(this.path);
        } catch (error) {
            throw new StoreUnavailable(
                errorCode(error) === "ENOENT"
                    ? `continuity store is unavailable: ${this.path}`
                    : `cannot read continuity store ${this.path}: ${errorMessage(error)}`,
                { cause: error },
            );
        }
        let text: string;
        try {
            text = decoder.decode(bytes);
        } catch (error) {
            throw new StoreUnavailable(`continuity store is not valid UTF-8: ${errorMessage(error)}`, { cause: error });
        }
        let state: unknown;
        try {
            state = JSON.parse(text);
        } catch (error) {
            throw new StoreUnavailable(`continuity store is not complete valid UTF-8 JSON: ${errorMessage(error)}`, {
                cause: error,
            });
        }
        validateState(state);
        return state;
    }

    async acquireWriteLease(): Promise<WriteLease> {
        if (this.lease) return this.lease;
        await mkdir(dirname(this.path), { recursive: true });
        let handle: FileHandle;
        try {
            handle = await open(this.lockPath, "wx", 0o600);
        } catch (error) {
            if (errorCode(error) !== "EEXIST") throw error;
            const diagnosis = await this.lockStatus();
            throw new ConcurrentWriter(`continuity store lock is ${diagnosis.status}: ${this.lockPath}`, {
                cause: error,
                diagnosis,
            });
        }
        const metadata: LockMetadata = {
            lock_version: 1,
            owner_token: this.uuid(),
            pid: this.pid,
            hostname: this.host,
            acquired_at: this.now(),
        };
        try {
            await handle.writeFile(`${JSON.stringify(metadata)}\n`, { encoding: "utf8" });
            await handle.sync();
        } catch (error) {
            await handle.close().catch(() => {});
            await unlink(this.lockPath).catch(() => {});
            throw error;
        }
        this.lease = { handle, metadata };
        return this.lease;
    }

    async releaseWriteLease(lease: WriteLease | null = this.lease) {
        if (!lease || lease !== this.lease)
            throw new ConcurrentWriter("write lease is not owned by this store instance");
        const parsed = await readLock(this.lockPath);
        if (parsed.status !== "valid" || parsed.metadata.owner_token !== lease.metadata.owner_token) {
            await lease.handle.close().catch(() => {});
            this.lease = null;
            throw new ConcurrentWriter("lock owner token changed; preserving lock for diagnosis", {
                diagnosis: parsed,
            });
        }
        await lease.handle.close();
        this.lease = null;
        await unlink(this.lockPath);
    }

    async commit(
        expectedRevision: number,
        candidate: EmberState,
        lease: WriteLease | null = this.lease,
    ): Promise<EmberState> {
        if (!lease || lease !== this.lease) throw new ConcurrentWriter("commit requires the cooperating writer lease");
        const lock = await readLock(this.lockPath);
        if (lock.status !== "valid" || lock.metadata.owner_token !== lease.metadata.owner_token)
            throw new ConcurrentWriter("lock owner token changed before commit", { diagnosis: lock });
        const current = await this.load();
        if (current.revision !== expectedRevision)
            throw new StaleRevision(`expected revision ${expectedRevision}, found ${current.revision}`);
        const committed = cloneState(candidate);
        committed.revision = expectedRevision + 1;
        validateState(committed);
        await this.replaceDocument(committed);
        return committed;
    }

    async replaceDocument(state: EmberState) {
        validateState(state);
        const directory = dirname(this.path);
        const temporary = join(directory, `.${basename(this.path)}.${process.pid}.${this.uuid()}.tmp`);
        let handle: FileHandle | null = null;
        let replaced = false;
        try {
            handle = await open(temporary, "wx", 0o600);
            await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" });
            await handle.sync();
            await handle.close();
            handle = null;
            await rename(temporary, this.path);
            replaced = true;
            try {
                await this.directorySync(directory);
            } catch (error) {
                throw new DurabilityUncertain(
                    "canonical replacement may be visible, but directory synchronization failed; reload and validate the path before making a durability claim",
                    { cause: error },
                );
            }
        } finally {
            if (handle) await handle.close().catch(() => {});
            if (!replaced) await unlink(temporary).catch(() => {});
        }
    }

    async lockStatus(): Promise<LockStatus> {
        const parsed = await readLock(this.lockPath);
        if (parsed.status !== "valid") return parsed;
        const metadata = parsed.metadata;
        if (metadata.hostname !== this.host) return { ...parsed, status: "foreign_host", liveness: "indeterminate" };
        try {
            this.kill(metadata.pid, 0);
            return { ...parsed, status: "live", liveness: "alive" };
        } catch (error) {
            if (errorCode(error) === "ESRCH") return { ...parsed, status: "apparently_stale", liveness: "absent" };
            if (errorCode(error) === "EPERM")
                return { ...parsed, status: "permission_denied", liveness: "indeterminate" };
            return { ...parsed, status: "indeterminate", liveness: "indeterminate", error: errorMessage(error) };
        }
    }

    async quarantineStaleLock({ ownerToken, confirmQuiescent }: { ownerToken: string; confirmQuiescent: boolean }) {
        if (confirmQuiescent !== true)
            throw new ConcurrentWriter("stale-lock quarantine requires explicit quiescence confirmation");
        const first = await this.lockStatus();
        if (first.status !== "apparently_stale")
            throw new ConcurrentWriter(`lock cannot be quarantined: ${first.status}`, { diagnosis: first });
        if (first.metadata.owner_token !== ownerToken)
            throw new ConcurrentWriter("lock owner token does not match expected token", { diagnosis: first });
        const second = await readLock(this.lockPath);
        if (second.status !== "valid" || second.metadata.owner_token !== ownerToken)
            throw new ConcurrentWriter("lock changed before quarantine", { diagnosis: second });
        if (second.metadata.hostname !== this.host)
            throw new ConcurrentWriter("lock host changed before quarantine", { diagnosis: second });
        try {
            this.kill(second.metadata.pid, 0);
            throw new ConcurrentWriter("lock PID is live; quarantine refused", { diagnosis: second });
        } catch (error) {
            if (error instanceof ConcurrentWriter) throw error;
            if (errorCode(error) !== "ESRCH")
                throw new ConcurrentWriter("lock liveness is indeterminate; quarantine refused", {
                    cause: error,
                    diagnosis: second,
                });
        }
        const destination = `${this.lockPath}.quarantine.${Date.now()}.${this.uuid()}`;
        await rename(this.lockPath, destination);
        return destination;
    }
}

async function syncDirectory(directory: string) {
    const handle = await open(directory, "r");
    try {
        await handle.sync();
    } finally {
        await handle.close();
    }
}

export async function readLock(path: string): Promise<LockStatus> {
    let bytes: Buffer;
    try {
        bytes = await readFile(path);
    } catch (error) {
        if (errorCode(error) === "ENOENT") return { status: "absent" };
        return { status: "indeterminate", error: errorMessage(error) };
    }
    let text: string;
    try {
        text = decoder.decode(bytes);
    } catch {
        return { status: "malformed", reason: "lock metadata is not valid UTF-8" };
    }
    let metadata: unknown;
    try {
        metadata = JSON.parse(text);
    } catch {
        return { status: "malformed", reason: "lock metadata is not valid JSON" };
    }
    const exact =
        metadata !== null &&
        typeof metadata === "object" &&
        !Array.isArray(metadata) &&
        JSON.stringify(Object.keys(metadata).sort()) ===
            JSON.stringify(["acquired_at", "hostname", "lock_version", "owner_token", "pid"].sort());
    const m = metadata as Partial<LockMetadata>;
    if (
        !exact ||
        m.lock_version !== 1 ||
        !Number.isSafeInteger(m.pid) ||
        (m.pid ?? 0) <= 0 ||
        typeof m.owner_token !== "string" ||
        !m.owner_token ||
        typeof m.hostname !== "string" ||
        !m.hostname ||
        !isRfc3339Utc(m.acquired_at)
    )
        return { status: "malformed", reason: "lock metadata fields are invalid" };
    return { status: "valid", metadata: m as LockMetadata };
}

function errorCode(error: unknown) {
    return error !== null &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
}
function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
