#!/usr/bin/env node

import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, readdir, realpath } from "node:fs/promises";
import { arch, cpus, loadavg, platform, release, totalmem, uptime } from "node:os";
import { basename, delimiter, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "../..");
const RESOURCE_RUNNER = resolve(ROOT, "eval/runtime-resource/run.ts");

if (process.platform !== "linux") {
    throw new Error("constrained-host resource capture requires Linux");
}

const options = parseArgs(process.argv.slice(2));
const providerCommand = options.fixtureOnly
    ? null
    : (options.providerCommand ?? (await findExecutable("codex", false)));

if (!options.fixtureOnly && providerCommand === null) {
    throw new Error("Codex is not executable on PATH; use --provider-command or --fixture-only");
}

const environment = await hostEnvironment(providerCommand);
const before = await hostPressureSnapshot();
const fixture = await runResourceEvaluation([
    "--repeat",
    String(options.fixtureRepeat),
    "--warmup",
    String(options.warmup),
    "--idle-ms",
    String(options.idleMs),
    "--sample-ms",
    String(options.sampleMs),
    "--hold-ms",
    String(options.holdMs),
]);
const afterFixture = await hostPressureSnapshot();

const external =
    providerCommand === null
        ? null
        : await runResourceEvaluation([
              "--repeat",
              String(options.liveRepeat),
              "--warmup",
              String(options.warmup),
              "--idle-ms",
              String(options.idleMs),
              "--sample-ms",
              String(options.sampleMs),
              "--provider-command",
              providerCommand,
              ...options.providerArguments.flatMap((argument) => ["--provider-arg", argument]),
          ]);
const afterExternal = external === null ? null : await hostPressureSnapshot();

const result = {
    constrained_host_resource_evaluation_version: 1,
    measured_at: new Date().toISOString(),
    environment,
    methodology: {
        fixture_repeat: options.fixtureRepeat,
        live_repeat: external === null ? null : options.liveRepeat,
        warmup: options.warmup,
        idle_observation_ms: options.idleMs,
        sample_interval_ms: options.sampleMs,
        fixture_hold_ms: options.holdMs,
        provider_mode: external === null ? "fixture_only" : "fixture_and_external",
        privacy_boundary:
            "Hostnames, usernames, network addresses, environment variables, service names, and credential paths are not recorded.",
    },
    host_pressure: {
        before,
        after_fixture: afterFixture,
        after_external: afterExternal,
    },
    fixture,
    external,
    interpretation: {
        fixture_comparison_role:
            "The fixture run preserves the issue #82 workload boundary for platform comparison without model/network variance.",
        external_comparison_role:
            external === null
                ? "No external provider run was requested."
                : "The external run measures the real provider process tree separately from the Ember root; remote latency remains part of wall time.",
    },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

interface Options {
    fixtureRepeat: number;
    liveRepeat: number;
    warmup: number;
    holdMs: number;
    idleMs: number;
    sampleMs: number;
    fixtureOnly: boolean;
    providerCommand: string | null;
    providerArguments: string[];
}

interface MemorySnapshot {
    mem_total_mib: number | null;
    mem_available_mib: number | null;
    swap_total_mib: number | null;
    swap_free_mib: number | null;
    swap_used_mib: number | null;
}

async function runResourceEvaluation(arguments_: string[]) {
    const { stdout, stderr } = await execFileAsync(process.execPath, [RESOURCE_RUNNER, ...arguments_], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
    });
    if (stderr.trim()) process.stderr.write(stderr);
    try {
        return JSON.parse(stdout) as unknown;
    } catch (error) {
        throw new Error(
            `runtime resource runner emitted invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

async function hostEnvironment(providerCommand: string | null) {
    const [deviceModel, osRelease, systemdUserManager] = await Promise.all([
        readOptionalText("/proc/device-tree/model", true),
        readOsRelease(),
        systemdUserManagerState(),
    ]);
    const codexVersion = providerCommand === null ? null : await executableVersion(providerCommand);
    return {
        device_model: deviceModel,
        os_release: osRelease,
        platform: platform(),
        kernel_release: release(),
        architecture: arch(),
        node: process.version,
        cpu_model: cpus()[0]?.model ?? "unknown",
        logical_cpu_count: cpus().length,
        total_memory_mib: round(totalmem() / 1024 / 1024),
        systemd_user_manager: systemdUserManager,
        external_provider: providerCommand === null ? null : basename(providerCommand),
        external_provider_version: codexVersion,
    };
}

async function hostPressureSnapshot() {
    const [memory, temperature, throttled, runningUserServices, processCount] = await Promise.all([
        memorySnapshot(),
        cpuTemperatureCelsius(),
        raspberryPiThrottledState(),
        runningUserServiceCount(),
        processCountSnapshot(),
    ]);
    const load = loadavg();
    return {
        observed_at: new Date().toISOString(),
        uptime_seconds: round(uptime()),
        load_average: {
            one_minute: round(load[0] ?? 0),
            five_minutes: round(load[1] ?? 0),
            fifteen_minutes: round(load[2] ?? 0),
        },
        memory,
        cpu_temperature_celsius: temperature,
        raspberry_pi_throttled: throttled,
        running_user_service_count: runningUserServices,
        process_count: processCount,
    };
}

async function memorySnapshot(): Promise<MemorySnapshot> {
    const text = await readFile("/proc/meminfo", "utf8");
    const values = new Map<string, number>();
    for (const line of text.split("\n")) {
        const match = /^(\w+):\s+(\d+)\s+kB$/.exec(line);
        if (match) values.set(match[1]!, Number(match[2]));
    }
    const total = values.get("MemTotal");
    const available = values.get("MemAvailable");
    const swapTotal = values.get("SwapTotal");
    const swapFree = values.get("SwapFree");
    return {
        mem_total_mib: kibToMib(total),
        mem_available_mib: kibToMib(available),
        swap_total_mib: kibToMib(swapTotal),
        swap_free_mib: kibToMib(swapFree),
        swap_used_mib: swapTotal === undefined || swapFree === undefined ? null : round((swapTotal - swapFree) / 1024),
    };
}

async function cpuTemperatureCelsius() {
    const text = await readOptionalText("/sys/class/thermal/thermal_zone0/temp");
    if (text === null) return null;
    const value = Number(text);
    return Number.isFinite(value) ? round(value / 1000) : null;
}

async function raspberryPiThrottledState() {
    const executable = await findExecutable("vcgencmd", false);
    if (executable === null) return null;
    try {
        const { stdout } = await execFileAsync(executable, ["get_throttled"], { encoding: "utf8" });
        const match = /throttled=(0x[0-9a-f]+)/i.exec(stdout);
        return match?.[1]?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}

async function runningUserServiceCount() {
    const systemctl = await findExecutable("systemctl", false);
    if (systemctl === null) return null;
    try {
        const { stdout } = await execFileAsync(
            systemctl,
            ["--user", "list-units", "--type=service", "--state=running", "--no-legend", "--no-pager"],
            { encoding: "utf8" },
        );
        return stdout.split("\n").filter((line) => line.trim()).length;
    } catch {
        return null;
    }
}

async function systemdUserManagerState() {
    const systemctl = await findExecutable("systemctl", false);
    if (systemctl === null) return "unavailable";
    try {
        await execFileAsync(systemctl, ["--user", "show-environment"], { encoding: "utf8" });
        return "available";
    } catch {
        return "unavailable";
    }
}

async function processCountSnapshot() {
    try {
        const entries = await readdir("/proc", { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name)).length;
    } catch {
        return null;
    }
}

async function readOsRelease() {
    const text = await readOptionalText("/etc/os-release");
    if (text === null) return null;
    const match = /^PRETTY_NAME=(.*)$/m.exec(text);
    if (!match) return null;
    return unquote(match[1]!.trim());
}

async function executableVersion(executable: string) {
    try {
        const { stdout, stderr } = await execFileAsync(executable, ["--version"], {
            encoding: "utf8",
            timeout: 10_000,
        });
        const value = stdout.trim() || stderr.trim();
        return value ? value.split("\n")[0] : null;
    } catch {
        return null;
    }
}

async function readOptionalText(path: string, stripNul = false) {
    try {
        const text = await readFile(path, "utf8");
        return (stripNul ? text.replaceAll("\0", "") : text).trim();
    } catch {
        return null;
    }
}

function findExecutable(name: string): Promise<string>;
function findExecutable(name: string, required: true): Promise<string>;
function findExecutable(name: string, required: false): Promise<string | null>;
async function findExecutable(name: string, required = true): Promise<string | null> {
    for (const directory of (process.env.PATH ?? "").split(delimiter)) {
        if (!directory) continue;
        const candidate = resolve(directory, name);
        try {
            await access(candidate, constants.X_OK);
            return await realpath(candidate);
        } catch {}
    }
    if (required) throw new Error(`${name} is not executable on PATH`);
    return null;
}

function parseArgs(args: string[]): Options {
    const parsed: Options = {
        fixtureRepeat: 5,
        liveRepeat: 3,
        warmup: 1,
        holdMs: 1_200,
        idleMs: 1_500,
        sampleMs: 10,
        fixtureOnly: false,
        providerCommand: null,
        providerArguments: [],
    };
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--fixture-repeat") parsed.fixtureRepeat = positiveInteger(args[++index], argument);
        else if (argument === "--live-repeat") parsed.liveRepeat = positiveInteger(args[++index], argument);
        else if (argument === "--warmup") parsed.warmup = nonNegativeInteger(args[++index], argument);
        else if (argument === "--hold-ms") parsed.holdMs = positiveInteger(args[++index], argument);
        else if (argument === "--idle-ms") parsed.idleMs = positiveInteger(args[++index], argument);
        else if (argument === "--sample-ms") parsed.sampleMs = positiveInteger(args[++index], argument);
        else if (argument === "--fixture-only") parsed.fixtureOnly = true;
        else if (argument === "--provider-command") parsed.providerCommand = requiredValue(args[++index], argument);
        else if (argument === "--provider-arg") parsed.providerArguments.push(requiredValue(args[++index], argument));
        else throw new Error(`unknown constrained-host resource argument: ${argument}`);
    }
    if (parsed.fixtureOnly && parsed.providerCommand !== null) {
        throw new Error("--fixture-only cannot be combined with --provider-command");
    }
    if (parsed.fixtureOnly && parsed.providerArguments.length > 0) {
        throw new Error("--fixture-only cannot be combined with --provider-arg");
    }
    if (parsed.providerCommand === null && parsed.providerArguments.length > 0) {
        throw new Error("--provider-arg requires --provider-command");
    }
    return parsed;
}

function positiveInteger(value: string | undefined, flag: string) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer`);
    return parsed;
}

function nonNegativeInteger(value: string | undefined, flag: string) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${flag} must be a non-negative integer`);
    return parsed;
}

function requiredValue(value: string | undefined, flag: string) {
    if (!value) throw new Error(`${flag} requires a value`);
    return value;
}

function kibToMib(value: number | undefined) {
    return value === undefined ? null : round(value / 1024);
}

function unquote(value: string) {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
    }
    return value;
}

function round(value: number) {
    return Math.round(value * 100) / 100;
}
