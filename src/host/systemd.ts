import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import type { BackgroundHost, HostObservation, WorkerLaunch } from "./background.ts";

import { ValidationError } from "../core/errors.ts";
import { isRfc3339Utc } from "../core/model.ts";
import { replaceFileAtomically } from "../persistence/file-replacement.ts";

export interface SystemdHostConfig {
    systemd_run_command: string;
    systemctl_command: string;
}

export interface CommandResult {
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}

export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

export class SystemdUserBackgroundHost implements BackgroundHost {
    private readonly config: SystemdHostConfig;
    private readonly runner: CommandRunner;

    constructor(config: SystemdHostConfig, runner: CommandRunner = runCommand) {
        requireAbsolute(config.systemd_run_command, "systemd_run_command");
        requireAbsolute(config.systemctl_command, "systemctl_command");
        this.config = config;
        this.runner = runner;
    }

    async start(job: WorkerLaunch) {
        validateLaunch(job);
        await this.run(this.config.systemd_run_command, launchArguments(job));
        return observation(job.jobId, "running");
    }

    async scheduleWake(job: WorkerLaunch, dueAt: string) {
        validateLaunch(job);
        if (!isRfc3339Utc(dueAt)) throw new ValidationError("wake due time must be RFC 3339 UTC");
        await this.run(this.config.systemd_run_command, [
            "--user",
            "--collect",
            `--unit=${job.jobId}`,
            `--on-calendar=${systemdCalendarTimestamp(dueAt)}`,
            "--property=Type=exec",
            "--property=Restart=no",
            ...jobCommand(job),
        ]);
        return observation(job.jobId, "scheduled");
    }

    async inspect(jobId: string): Promise<HostObservation> {
        validateJobId(jobId);
        const [service, timer] = await Promise.all([
            this.inspectUnit(`${jobId}.service`),
            this.inspectUnit(`${jobId}.timer`),
        ]);
        if (service === "running") return observation(jobId, "running");
        if (timer === "running") return observation(jobId, "scheduled");
        if (service === "failed" || timer === "failed") return observation(jobId, "failed");
        if (service === "unknown" || timer === "unknown") return observation(jobId, "unknown");
        if (service === "absent" && timer === "absent") return observation(jobId, "absent");
        return observation(jobId, "stopped");
    }

    async stop(jobId: string) {
        validateJobId(jobId);
        await this.run(this.config.systemctl_command, ["--user", "stop", `${jobId}.timer`, `${jobId}.service`]);
        return observation(jobId, "stopped");
    }

    private async inspectUnit(
        unitName: string,
    ): Promise<Exclude<HostObservation["state"], "scheduled" | "unsupported">> {
        const result = await this.runner(this.config.systemctl_command, [
            "--user",
            "show",
            unitName,
            "--property=LoadState",
            "--property=ActiveState",
            "--value",
        ]);
        const values = result.stdout.trim().split(/\r?\n/).filter(Boolean);
        if (
            values.includes("not-found") ||
            (result.code !== 0 && /not found|not-found|could not be found/i.test(result.stderr))
        )
            return "absent";
        if (values.includes("failed")) return "failed";
        if (values.some((value) => ["active", "activating", "reloading"].includes(value))) return "running";
        if (values.some((value) => ["inactive", "deactivating"].includes(value))) return "stopped";
        return "unknown";
    }

    async reloadAndEnable(unitName: string) {
        validateJobId(unitName);
        await this.run(this.config.systemctl_command, ["--user", "daemon-reload"]);
        await this.run(this.config.systemctl_command, ["--user", "enable", "--now", unitName]);
    }

    private async run(command: string, args: string[]) {
        const result = await this.runner(command, args);
        if (result.code !== 0)
            throw new Error(
                `${command} failed with ${result.code ?? result.signal ?? "unknown"}: ${result.stderr.trim()}`,
            );
        return result;
    }
}

export async function installSystemdUnit(
    host: SystemdUserBackgroundHost,
    unitDirectory: string,
    unitName: string,
    content: string,
) {
    requireAbsolute(unitDirectory, "systemd user unit directory");
    validateJobId(unitName);
    await mkdir(unitDirectory, { recursive: true });
    const unitPath = join(unitDirectory, unitName);
    await replaceFileAtomically(unitPath, content, { mode: 0o600 });
    await host.reloadAndEnable(unitName);
    return unitPath;
}

export function renderSystemdService(spec: {
    description: string;
    launch: WorkerLaunch;
    restart: "no" | "on-failure";
    wantedBy?: string;
    after?: string[];
}) {
    validateLaunch(spec.launch);
    const after = spec.after?.length ? `${spec.after.map((item) => `Wants=${item}\nAfter=${item}`).join("\n")}\n` : "";
    const install = spec.wantedBy ? `\n[Install]\nWantedBy=${spec.wantedBy}\n` : "";
    return `[Unit]\nDescription=${spec.description}\n${after}\n[Service]\nType=${spec.restart === "no" ? "oneshot" : "exec"}\n${spec.launch.workingDirectory ? `WorkingDirectory=${systemdQuote(spec.launch.workingDirectory)}\n` : ""}ExecStart=${jobCommand(spec.launch).map(systemdQuote).join(" ")}\nRestart=${spec.restart}\n${spec.restart === "on-failure" ? "RestartSec=5s\nKillMode=mixed\n" : ""}${spec.launch.stopTimeoutSeconds ? `TimeoutStopSec=${spec.launch.stopTimeoutSeconds}s\n` : ""}UMask=0077\n${install}`;
}

function launchArguments(job: WorkerLaunch) {
    return [
        "--user",
        "--collect",
        `--unit=${job.jobId}`,
        "--property=Type=exec",
        "--property=Restart=no",
        ...(job.stopTimeoutSeconds
            ? ["--property=KillMode=mixed", `--property=TimeoutStopSec=${job.stopTimeoutSeconds}s`]
            : []),
        ...jobCommand(job),
    ];
}

function jobCommand(job: WorkerLaunch) {
    return [job.executable, ...job.arguments];
}

function observation(jobId: string, state: HostObservation["state"]): HostObservation {
    return { jobId, state, observedAt: new Date().toISOString() };
}

function validateLaunch(job: WorkerLaunch) {
    validateJobId(job.jobId);
    requireAbsolute(job.executable, "worker executable");
    if (job.workingDirectory !== undefined) requireAbsolute(job.workingDirectory, "worker working directory");
    if (job.arguments.some(hasUnsafeControlCharacter))
        throw new ValidationError("worker argument contains a control character");
    if (
        job.stopTimeoutSeconds !== undefined &&
        (!Number.isFinite(job.stopTimeoutSeconds) || job.stopTimeoutSeconds <= 0)
    )
        throw new ValidationError("worker stop timeout must be positive");
}

function validateJobId(value: string) {
    if (!/^[A-Za-z0-9_.@:-]{1,255}$/.test(value)) throw new ValidationError("background job id is invalid");
}

function requireAbsolute(value: string, field: string) {
    if (!isAbsolute(value) || hasUnsafeControlCharacter(value))
        throw new ValidationError(`${field} must be a safe absolute path`);
}

function hasUnsafeControlCharacter(value: string) {
    return value.includes("\0") || value.includes("\r") || value.includes("\n");
}

function systemdCalendarTimestamp(value: string) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new ValidationError("systemd calendar timestamp is invalid");
    const fraction = /\.(\d+)Z$/.exec(value)?.[1];
    const wholeSecond = Math.floor(parsed / 1000) * 1000;
    const roundedUp = wholeSecond + (fraction && /[1-9]/.test(fraction) ? 1000 : 0);
    const normalized = new Date(roundedUp).toISOString();
    return `${normalized.slice(0, 10)} ${normalized.slice(11, 19)} UTC`;
}

function systemdQuote(value: string) {
    return `"${value.replaceAll("%", "%%").replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function runCommand(command: string, args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
        child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
    });
}
