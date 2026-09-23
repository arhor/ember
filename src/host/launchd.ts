import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import type { WorkerLaunch } from "./background.ts";
import type { ResidentServiceHost, ServiceActionResult, ServiceState } from "./resident-service.ts";

import { ValidationError } from "../core/errors.ts";
import { replaceFileDurably } from "../persistence/file-replacement.ts";

const LABEL = "dev.ember.telegram";

interface CommandResult {
    code: number | null;
    stdout: string;
    stderr: string;
}

type Command = (args: string[]) => Promise<CommandResult>;

export class LaunchdTelegramResidentHost implements ResidentServiceHost {
    private readonly definitionPath: string;
    private readonly target: string;
    private readonly domain: string;
    private readonly command: Command;
    private readonly read: (path: string) => Promise<string | null>;
    private readonly write: (path: string, content: string, mode: number) => Promise<void>;
    private readonly remove: (path: string) => Promise<void>;

    constructor(
        options: {
            home?: string;
            uid?: number;
            command?: Command;
            read?: (path: string) => Promise<string | null>;
            write?: (path: string, content: string, mode: number) => Promise<void>;
            remove?: (path: string) => Promise<void>;
        } = {},
    ) {
        this.definitionPath = join(options.home ?? homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
        this.domain = `gui/${options.uid ?? process.getuid?.()}`;
        if (!/^gui\/\d+$/.test(this.domain)) throw new ValidationError("launchd requires a local user id");
        this.target = `${this.domain}/${LABEL}`;
        this.command = options.command ?? runLaunchctl;
        this.read = options.read ?? readOptional;
        this.write = options.write ?? writePrivate;
        this.remove = options.remove ?? unlink;
    }

    render(launch: WorkerLaunch): string {
        return renderLaunchAgent(launch);
    }

    readDefinition(): Promise<string | null> {
        return this.read(this.definitionPath);
    }

    async inspect(): Promise<{ installed: ServiceState; active: ServiceState }> {
        const [definition, service] = await Promise.all([this.readDefinition(), this.command(["print", this.target])]);
        return {
            installed: definition === null ? "no" : "yes",
            // A loaded KeepAlive agent may be throttled now and restart during mapping discovery.
            active: service.code === 0 ? "yes" : absent(service) ? "no" : "unknown",
        };
    }

    async isActive(): Promise<ServiceActionResult> {
        const { active } = await this.inspect();
        return active === "yes" ? "confirmed" : active === "no" ? "failed" : "uncertain";
    }

    async stop(): Promise<ServiceActionResult> {
        const result = await this.command(["bootout", this.target]);
        return result.code === 0 || absent(result) ? "confirmed" : result.code === null ? "uncertain" : "failed";
    }

    async start(): Promise<ServiceActionResult> {
        if ((await this.readDefinition()) === null) return "failed";
        return actionResult(await this.command(["bootstrap", this.domain, this.definitionPath]));
    }

    async install(content: string): Promise<void> {
        await this.write(this.definitionPath, content, 0o600);
    }

    async uninstall(): Promise<ServiceActionResult> {
        const stopped = await this.stop();
        if (stopped !== "confirmed") return stopped;
        try {
            await this.remove(this.definitionPath);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return "confirmed";
    }

    async activate(wasActive: boolean): Promise<ServiceActionResult> {
        // Setup has already booted out an active agent before rewriting its plist.
        if (!wasActive) {
            const result = await this.command(["print", this.target]);
            if (result.code === 0) {
                const stopped = await this.stop();
                if (stopped !== "confirmed") return stopped;
            } else if (!absent(result)) return result.code === null ? "uncertain" : "failed";
        }
        return this.start();
    }
}

export function renderLaunchAgent(launch: WorkerLaunch, label = LABEL): string {
    if (!/^[A-Za-z0-9.-]{1,255}$/.test(label)) throw new ValidationError("launchd label is invalid");
    if (!isAbsolute(launch.executable) || launch.arguments.some(unsafe) || unsafe(launch.executable))
        throw new ValidationError("launchd executable and arguments must be safe");
    if (launch.workingDirectory && (!isAbsolute(launch.workingDirectory) || unsafe(launch.workingDirectory)))
        throw new ValidationError("launchd working directory must be a safe absolute path");
    if (
        launch.stopTimeoutSeconds !== undefined &&
        (!Number.isSafeInteger(launch.stopTimeoutSeconds) || launch.stopTimeoutSeconds <= 0)
    )
        throw new ValidationError("launchd stop timeout must be a positive integer");
    const args = [launch.executable, ...launch.arguments]
        .map((value) => `        <string>${xml(value)}</string>`)
        .join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n    <key>Label</key>\n    <string>${label}</string>\n    <key>ProgramArguments</key>\n    <array>\n${args}\n    </array>\n${launch.workingDirectory ? `    <key>WorkingDirectory</key>\n    <string>${xml(launch.workingDirectory)}</string>\n` : ""}    <key>RunAtLoad</key>\n    <true/>\n    <key>KeepAlive</key>\n    <true/>\n    <key>ThrottleInterval</key>\n    <integer>5</integer>\n    <key>Umask</key>\n    <string>077</string>\n${launch.stopTimeoutSeconds === undefined ? "" : `    <key>ExitTimeOut</key>\n    <integer>${launch.stopTimeoutSeconds}</integer>\n`}</dict>\n</plist>\n`;
}

function unsafe(value: string) {
    return [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
    });
}

function xml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

function absent(result: CommandResult) {
    return (
        result.code !== null &&
        result.code !== 0 &&
        /could not find service|service not found|no such process/i.test(result.stderr)
    );
}

function actionResult(result: CommandResult): ServiceActionResult {
    return result.code === 0 ? "confirmed" : result.code === null ? "uncertain" : "failed";
}

async function readOptional(path: string) {
    try {
        return await readFile(path, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
    }
}

async function writePrivate(path: string, content: string, mode: number) {
    await replaceFileDurably(path, content, {
        mode,
        durabilityUncertainMessage: `durability is uncertain for ${dirname(path)}`,
    });
}

function runLaunchctl(args: string[]): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        const child = spawn("/bin/launchctl", args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
        child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
        child.once("error", reject);
        child.once("close", (code) => resolve({ code, stdout, stderr }));
    });
}
