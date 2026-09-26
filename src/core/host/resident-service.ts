import type { WorkerLaunch } from "./background.ts";

export type ServiceState = "yes" | "no" | "unknown";
export type ServiceActionResult = "confirmed" | "failed" | "uncertain";

/** Trusted host operations for an optional resident transport process. */
export interface ResidentServiceHost {
    render(launch: WorkerLaunch): string;
    readDefinition(): Promise<string | null>;
    inspect(): Promise<{ installed: ServiceState; active: ServiceState }>;
    isActive(): Promise<ServiceActionResult>;
    stop(): Promise<ServiceActionResult>;
    start(): Promise<ServiceActionResult>;
    install(content: string): Promise<void>;
    uninstall(): Promise<ServiceActionResult>;
    activate(wasActive: boolean): Promise<ServiceActionResult>;
}
