import type { BackgroundHost, HostJobState, HostObservation, WorkerLaunch } from "../src/host/background.ts";

export class FakeBackgroundHost implements BackgroundHost {
    readonly calls: Array<
        | { operation: "start"; job: WorkerLaunch }
        | { operation: "scheduleWake"; job: WorkerLaunch; dueAt: string }
        | { operation: "inspect"; jobId: string }
        | { operation: "stop"; jobId: string }
    > = [];
    private readonly states = new Map<string, HostJobState>();

    start(job: WorkerLaunch): Promise<HostObservation> {
        this.calls.push({ operation: "start", job: structuredClone(job) });
        this.states.set(job.jobId, "running");
        return Promise.resolve(observation(job.jobId, "running"));
    }

    scheduleWake(job: WorkerLaunch, dueAt: string): Promise<HostObservation> {
        this.calls.push({ operation: "scheduleWake", job: structuredClone(job), dueAt });
        this.states.set(job.jobId, "scheduled");
        return Promise.resolve(observation(job.jobId, "scheduled"));
    }

    inspect(jobId: string): Promise<HostObservation> {
        this.calls.push({ operation: "inspect", jobId });
        return Promise.resolve(observation(jobId, this.states.get(jobId) ?? "absent"));
    }

    stop(jobId: string): Promise<HostObservation> {
        this.calls.push({ operation: "stop", jobId });
        this.states.set(jobId, "stopped");
        return Promise.resolve(observation(jobId, "stopped"));
    }

    setState(jobId: string, state: HostJobState) {
        this.states.set(jobId, state);
    }
}

function observation(jobId: string, state: HostJobState): HostObservation {
    return { jobId, state, observedAt: "2026-09-24T00:00:00Z" };
}
