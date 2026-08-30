import { access, mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { ConcurrentWriter, DurabilityUncertain, StaleRevision, StoreExists, StoreUnavailable, ValidationError } from "./errors.mjs";
import { cloneState, isRfc3339Utc, nowUtc, validateState } from "./model.mjs";

const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

export class StateStore {
  constructor(path, options = {}) {
    this.path = path;
    this.lockPath = `${path}.lock`;
    this.host = options.hostname ?? hostname();
    this.pid = options.pid ?? process.pid;
    this.kill = options.kill ?? process.kill.bind(process);
    this.now = options.now ?? nowUtc;
    this.uuid = options.uuid ?? randomUUID;
    this.directorySync = options.directorySync ?? syncDirectory;
    this.lease = null;
  }

  async create(state) {
    validateState(state); await mkdir(dirname(this.path), { recursive: true });
    const lease = await this.acquireWriteLease();
    try {
      try { await access(this.path); throw new StoreExists(`continuity store already exists: ${this.path}`); }
      catch (error) { if (error instanceof StoreExists) throw error; if (error.code !== "ENOENT") throw error; }
      await this.replaceDocument(state);
    } finally { await this.releaseWriteLease(lease); }
  }

  async load() {
    let bytes;
    try { bytes = await readFile(this.path); }
    catch (error) { throw new StoreUnavailable(error.code === "ENOENT" ? `continuity store is unavailable: ${this.path}` : `cannot read continuity store ${this.path}: ${error.message}`, { cause: error }); }
    let text;
    try { text = decoder.decode(bytes); }
    catch (error) { throw new StoreUnavailable(`continuity store is not valid UTF-8: ${error.message}`, { cause: error }); }
    let state;
    try { state = JSON.parse(text); }
    catch (error) { throw new StoreUnavailable(`continuity store is not complete valid UTF-8 JSON: ${error.message}`, { cause: error }); }
    validateState(state); return state;
  }

  async acquireWriteLease() {
    if (this.lease) return this.lease;
    await mkdir(dirname(this.path), { recursive: true });
    let handle;
    try { handle = await open(this.lockPath, "wx", 0o600); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      const diagnosis = await this.lockStatus();
      throw new ConcurrentWriter(`continuity store lock is ${diagnosis.status}: ${this.lockPath}`, { cause: error, diagnosis });
    }
    const metadata = { lock_version: 1, owner_token: this.uuid(), pid: this.pid, hostname: this.host, acquired_at: this.now() };
    try { await handle.writeFile(`${JSON.stringify(metadata)}\n`, { encoding: "utf8" }); await handle.sync(); }
    catch (error) { await handle.close().catch(() => {}); await unlink(this.lockPath).catch(() => {}); throw error; }
    this.lease = { handle, metadata }; return this.lease;
  }

  async releaseWriteLease(lease = this.lease) {
    if (!lease || lease !== this.lease) throw new ConcurrentWriter("write lease is not owned by this store instance");
    const parsed = await readLock(this.lockPath);
    if (parsed.status !== "valid" || parsed.metadata.owner_token !== lease.metadata.owner_token) {
      await lease.handle.close().catch(() => {}); this.lease = null;
      throw new ConcurrentWriter("lock owner token changed; preserving lock for diagnosis", { diagnosis: parsed });
    }
    await lease.handle.close(); this.lease = null; await unlink(this.lockPath);
  }

  async commit(expectedRevision, candidate, lease = this.lease) {
    if (!lease || lease !== this.lease) throw new ConcurrentWriter("commit requires the cooperating writer lease");
    const lock = await readLock(this.lockPath);
    if (lock.status !== "valid" || lock.metadata.owner_token !== lease.metadata.owner_token) throw new ConcurrentWriter("lock owner token changed before commit", { diagnosis: lock });
    const current = await this.load();
    if (current.revision !== expectedRevision) throw new StaleRevision(`expected revision ${expectedRevision}, found ${current.revision}`);
    const committed = cloneState(candidate); committed.revision = expectedRevision + 1; validateState(committed);
    await this.replaceDocument(committed); return committed;
  }

  async replaceDocument(state) {
    validateState(state);
    const directory = dirname(this.path), temporary = join(directory, `.${basename(this.path)}.${process.pid}.${this.uuid()}.tmp`);
    let handle; let replaced = false;
    try {
      handle = await open(temporary, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8" }); await handle.sync(); await handle.close(); handle = null;
      await rename(temporary, this.path); replaced = true;
      try { await this.directorySync(directory); }
      catch (error) { throw new DurabilityUncertain("canonical replacement may be visible, but directory synchronization failed; reload and validate the path before making a durability claim", { cause: error }); }
    } finally { if (handle) await handle.close().catch(() => {}); if (!replaced) await unlink(temporary).catch(() => {}); }
  }

  async lockStatus() {
    const parsed = await readLock(this.lockPath);
    if (parsed.status !== "valid") return parsed;
    const metadata = parsed.metadata;
    if (metadata.hostname !== this.host) return { ...parsed, status: "foreign_host", liveness: "indeterminate" };
    try { this.kill(metadata.pid, 0); return { ...parsed, status: "live", liveness: "alive" }; }
    catch (error) {
      if (error.code === "ESRCH") return { ...parsed, status: "apparently_stale", liveness: "absent" };
      if (error.code === "EPERM") return { ...parsed, status: "permission_denied", liveness: "indeterminate" };
      return { ...parsed, status: "indeterminate", liveness: "indeterminate", error: error.message };
    }
  }

  async quarantineStaleLock({ ownerToken, confirmQuiescent }) {
    if (confirmQuiescent !== true) throw new ConcurrentWriter("stale-lock quarantine requires explicit quiescence confirmation");
    const first = await this.lockStatus();
    if (first.status !== "apparently_stale") throw new ConcurrentWriter(`lock cannot be quarantined: ${first.status}`, { diagnosis: first });
    if (first.metadata.owner_token !== ownerToken) throw new ConcurrentWriter("lock owner token does not match expected token", { diagnosis: first });
    const second = await readLock(this.lockPath);
    if (second.status !== "valid" || second.metadata.owner_token !== ownerToken) throw new ConcurrentWriter("lock changed before quarantine", { diagnosis: second });
    if (second.metadata.hostname !== this.host) throw new ConcurrentWriter("lock host changed before quarantine", { diagnosis: second });
    try { this.kill(second.metadata.pid, 0); throw new ConcurrentWriter("lock PID is live; quarantine refused", { diagnosis: second }); }
    catch (error) { if (error instanceof ConcurrentWriter) throw error; if (error.code !== "ESRCH") throw new ConcurrentWriter("lock liveness is indeterminate; quarantine refused", { cause: error, diagnosis: second }); }
    const destination = `${this.lockPath}.quarantine.${Date.now()}.${this.uuid()}`; await rename(this.lockPath, destination); return destination;
  }
}

async function syncDirectory(directory) { const handle = await open(directory, "r"); try { await handle.sync(); } finally { await handle.close(); } }

export async function readLock(path) {
  let bytes; try { bytes = await readFile(path); } catch (error) { if (error.code === "ENOENT") return { status: "absent" }; return { status: "indeterminate", error: error.message }; }
  let text; try { text = decoder.decode(bytes); } catch { return { status: "malformed", reason: "lock metadata is not valid UTF-8" }; }
  let metadata; try { metadata = JSON.parse(text); } catch { return { status: "malformed", reason: "lock metadata is not valid JSON" }; }
  const exact = metadata && typeof metadata === "object" && !Array.isArray(metadata) && JSON.stringify(Object.keys(metadata).sort()) === JSON.stringify(["acquired_at","hostname","lock_version","owner_token","pid"].sort());
  if (!exact || metadata.lock_version !== 1 || !Number.isSafeInteger(metadata.pid) || metadata.pid <= 0 || typeof metadata.owner_token !== "string" || !metadata.owner_token || typeof metadata.hostname !== "string" || !metadata.hostname || !isRfc3339Utc(metadata.acquired_at)) return { status: "malformed", reason: "lock metadata fields are invalid" };
  return { status: "valid", metadata };
}
