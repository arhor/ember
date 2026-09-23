export interface WorkerLaunch {
    jobId: string;
    executable: string;
    arguments: string[];
    workingDirectory?: string;
    stopTimeoutSeconds?: number;
}

export type HostJobState = "running" | "stopped" | "absent" | "failed" | "unknown" | "unsupported";

export interface HostObservation {
    jobId: string;
    state: HostJobState;
    observedAt: string;
    detail?: string;
}

export interface BackgroundHost {
    start(job: WorkerLaunch): Promise<HostObservation>;
    scheduleWake(job: WorkerLaunch, dueAt: string): Promise<HostObservation>;
    inspect(jobId: string): Promise<HostObservation>;
    stop(jobId: string): Promise<HostObservation>;
}

export class UnavailableBackgroundHost implements BackgroundHost {
    async start(job: WorkerLaunch): Promise<HostObservation> {
        return unsupported(job.jobId);
    }

    async scheduleWake(job: WorkerLaunch): Promise<HostObservation> {
        return unsupported(job.jobId);
    }

    async inspect(jobId: string): Promise<HostObservation> {
        return unsupported(jobId);
    }

    async stop(jobId: string): Promise<HostObservation> {
        return unsupported(jobId);
    }
}

function unsupported(jobId: string): HostObservation {
    return {
        jobId,
        state: "unsupported",
        observedAt: new Date().toISOString(),
        detail: "no background host is configured",
    };
}
