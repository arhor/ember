import type { EmberState } from "@ember/domain/model.ts";
export interface LockMetadata {
    lock_version: 1;
    owner_token: string;
    pid: number;
    hostname: string;
    acquired_at: string;
}
export type LockStatus =
    | {
          status: "absent";
      }
    | {
          status: "malformed";
          reason: string;
      }
    | {
          status: "indeterminate";
          error: string;
      }
    | {
          status: "valid";
          metadata: LockMetadata;
      }
    | {
          status: "foreign_host";
          metadata: LockMetadata;
          liveness: "indeterminate";
      }
    | {
          status: "live";
          metadata: LockMetadata;
          liveness: "alive";
      }
    | {
          status: "apparently_stale";
          metadata: LockMetadata;
          liveness: "absent";
      }
    | {
          status: "permission_denied";
          metadata: LockMetadata;
          liveness: "indeterminate";
      }
    | {
          status: "indeterminate";
          metadata: LockMetadata;
          liveness: "indeterminate";
          error: string;
      };
/** Opaque ownership token returned by the configured state repository. */
export type WriteLease = object;
export interface StateStoreOptions {
    hostname?: string;
    pid?: number;
    kill?: (pid: number, signal?: NodeJS.Signals | 0) => boolean | void;
    now?: () => string;
    uuid?: () => string;
    directorySync?: (directory: string) => Promise<void>;
}
export interface StateStore {
    readonly lease?: WriteLease | null;
    create(state: EmberState): Promise<void>;
    load(): Promise<EmberState>;
    acquireWriteLease(): Promise<WriteLease>;
    releaseWriteLease(lease?: WriteLease | null): Promise<void>;
    commit(expectedRevision: number, candidate: EmberState, lease?: WriteLease | null): Promise<EmberState>;
    replaceDocument(state: EmberState): Promise<void>;
    lockStatus(): Promise<LockStatus>;
    quarantineStaleLock({
        ownerToken,
        confirmQuiescent,
    }: {
        ownerToken: string;
        confirmQuiescent: boolean;
    }): Promise<string>;
}
