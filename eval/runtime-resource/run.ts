#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, tmpdir, totalmem } from "node:os";
import { basename, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

import type { SpecialistEpisodeSpec } from "../../src/delegation/codex-specialist.ts";
import type { EpisodicRuntimeConfig, RuntimeObservation, WakeIntent } from "../../src/runtime/episodic-runtime.ts";

import { initialState } from "../../src/core/model.ts";
import { createSpecialistEpisode } from "../../src/delegation/codex-specialist.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { EpisodicRecordStore } from "../../src/runtime/episodic-runtime.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const RUNTIME_ENTRYPOINT = resolve(ROOT, "bin/ember-runtime.ts");
const CLI_ENTRYPOINT = resolve(ROOT, "bin/ember.ts");
const FIXTURE_CODEX = resolve(ROOT, "eval/runtime-resource/fixture-codex.ts");
const PRINCIPAL = "resource-evaluation-user";
const SCOPE = "eval:runtime-resource";
const FIXED_INITIAL_AT = "2026-09-04T16:00:00Z";
const FIXED_RUNTIME_AT = "2026-09-04T16:01:00Z";

if (process.platform !== "linux") {
    throw new Error("runtime resource evaluation requires Linux /proc process accounting");
}

const options = parseArgs(process.argv.slice(2));
const clockTicksPerSecond = readClockTicksPerSecond();
const provider = providerConfiguration(options);

const idle = await observeIdle(options.idleMs, options.sampleMs);
const cognition = await measureWorkload("foreground_cognition", options);
const wake = await measureWorkload("endogenous_wake", options);
const specialist = await measureWorkload("specialist_delegation", options);

const result = {
    resource_evaluation_version: 1,
    measured_at: new Date().toISOString(),
    ember_revision: gitRevision(),
    environment: {
        platform: platform(),
        release: release(),
        architecture: arch(),
        node: process.version,
        cpu_model: cpus()[0]?.model ?? "unknown",
        logical_cpu_count: cpus().length,
        total_memory_mib: round(totalmem() / 1024 / 1024),
        github_runner_image: process.env.ImageOS ?? null,
        github_runner_image_version: process.env.ImageVersion ?? null,
    },
    methodology: {
        repeat: options.repeat,
        warmup: options.warmup,
        idle_observation_ms: options.idleMs,
        sample_interval_ms: options.sampleMs,
        fixture_hold_ms: provider.mode === "fixture" ? options.holdMs : null,
        clock_ticks_per_second: clockTicksPerSecond,
        memory_metric: "Linux /proc VmRSS; root Ember process and descendants sampled separately",
        cpu_metric: "sampled cumulative /proc utime+stime converted to CPU ms and average wall-window percentage",
        process_metric: "maximum simultaneously observed root+descendant process count",
        provider_mode: provider.mode,
        provider_command: basename(provider.command),
    },
    idle,
    workloads: {
        foreground_cognition: cognition,
        endogenous_wake: wake,
        specialist_delegation: specialist,
    },
    interpretation: {
        idle_core_resident: false,
        fixture_external_process_is_codex_cost: provider.mode !== "fixture",
        note:
            provider.mode === "fixture"
                ? "Canonical fixture mode isolates Ember core cost. Descendant figures describe the bounded Node protocol fixture, not real Codex resource usage."
                : "External-provider mode attributes all descendants separately from the Ember root process; network/model latency remains part of the observed wall window.",
    },
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

interface CliOptions {
    repeat: number;
    warmup: number;
    holdMs: number;
    idleMs: number;
    sampleMs: number;
    providerCommand: string | null;
    providerArguments: string[];
}

type WorkloadName = "foreground_cognition" | "endogenous_wake" | "specialist_delegation";

interface PreparedWorkload {
    root: string;
    command: string;
    arguments_: string[];
    stdin: string | null;
}

interface ProcessInfo {
    pid: number;
    ppid: number;
    rssKib: number;
    cpuTicks: number;
    commandLine: string;
}

interface RawSample {
    elapsedMs: number;
    rootMaxRssKib: number;
    externalMaxRssKib: number;
    treeMaxRssKib: number;
    rootCpuMs: number;
    externalCpuMs: number;
    treeCpuMs: number;
    rootAverageCpuPercent: number;
    externalAverageCpuPercent: number;
    treeAverageCpuPercent: number;
    maxProcessCount: number;
    externalProcessObserved: boolean;
}

async function measureWorkload(name: WorkloadName, cli: CliOptions) {
    const samples: RawSample[] = [];
    for (let index = 0; index < cli.warmup + cli.repeat; index += 1) {
        const prepared = await prepareWorkload(name, cli);
        try {
            const sample = await runMeasured(prepared, cli.sampleMs);
            if (index >= cli.warmup) samples.push(sample);
        } finally {
            await rm(prepared.root, { recursive: true, force: true });
        }
    }
    return summarizeSamples(name, samples);
}

async function prepareWorkload(name: WorkloadName, cli: CliOptions): Promise<PreparedWorkload> {
    const root = await mkdtemp(join(tmpdir(), `ember-resource-${name}-`));
    const statePath = join(root, "ember.json");
    const recordsDirectory = join(root, "runtime-records");
    const configPath = join(root, "runtime.json");
    const workspace = join(root, "workspace");
    const configuredProvider = providerConfiguration(cli);

    await new StateStore(statePath).create(initialState("Ember", PRINCIPAL, FIXED_INITIAL_AT));
    await mkdir(workspace);

    const config: EpisodicRuntimeConfig = {
        config_version: 1,
        state_path: statePath,
        records_directory: recordsDirectory,
        principal: PRINCIPAL,
        active_scope: SCOPE,
        node_path: process.execPath,
        runtime_entrypoint: RUNTIME_ENTRYPOINT,
        codex_command: configuredProvider.command,
        codex_arguments: configuredProvider.arguments_,
        opportunity_timeout_seconds: 120,
        systemd_run_command: "/usr/bin/false",
        systemctl_command: "/usr/bin/false",
        stop_timeout_seconds: 30,
    };
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    if (name === "foreground_cognition") {
        return {
            root,
            command: process.execPath,
            arguments_: [
                CLI_ENTRYPOINT,
                "run",
                "--state",
                statePath,
                "--principal",
                PRINCIPAL,
                "--scope",
                SCOPE,
                "--provider",
                "codex",
                "--codex-command",
                configuredProvider.command,
                ...configuredProvider.arguments_.flatMap((argument) => ["--codex-arg", argument]),
                "--provider-timeout-seconds",
                "120",
            ],
            stdin: "resource evaluation cognition\n:quit\n",
        };
    }

    const records = new EpisodicRecordStore(recordsDirectory);
    if (name === "endogenous_wake") {
        const at = new Date().toISOString();
        const wakeId = `wake-resource-${randomUUID()}`;
        const intent: WakeIntent = {
            record_version: 1,
            wake_id: wakeId,
            principal: PRINCIPAL,
            active_scope: SCOPE,
            mechanism: "external_timing",
            due_at: at,
            created_at: at,
        };
        await records.createWake(intent);
        return {
            root,
            command: process.execPath,
            arguments_: [RUNTIME_ENTRYPOINT, "run-wake", "--config", configPath, "--wake-id", wakeId],
            stdin: null,
        };
    }

    const spec = specialistSpec(workspace, configuredProvider.command, configuredProvider.arguments_);
    await records.createSpecialistSpec(spec);
    await records.observeSpecialist(spec.episode_id, observation("launch_attempted"));
    await records.observeSpecialist(spec.episode_id, observation("launch_accepted"));
    return {
        root,
        command: process.execPath,
        arguments_: [RUNTIME_ENTRYPOINT, "run-specialist", "--config", configPath, "--episode-id", spec.episode_id],
        stdin: null,
    };
}

function specialistSpec(workspace: string, command: string, argumentPrefix: string[]): SpecialistEpisodeSpec {
    return createSpecialistEpisode({
        objective: "Inspect the bounded resource-evaluation workspace and report completion without modifying it",
        acceptance: ["No workspace artifact is changed", "A bounded completion report is returned"],
        context_projection: [
            {
                content: "This workspace exists only for deterministic runtime resource measurement.",
                provenance: "issue 82 resource evaluation",
                scope: SCOPE,
                currentness: "current for this evaluation sample",
            },
        ],
        authority_envelope: {
            principal: PRINCIPAL,
            grant: "Inspect only the selected resource-evaluation workspace",
            provenance: "explicit repository resource evaluation",
            currentness: "current for this evaluation sample",
            permitted_actions: ["inspect the selected workspace"],
            prohibited_actions: ["modify files", "network access", "access outside the selected workspace"],
            escalation_conditions: ["any additional authority or capability is required"],
        },
        runtime_capability: {
            filesystem: { scope: "selected_workspace", mode: "read_write" },
            network_reach: "not_established",
            tools: ["bounded evaluation provider"],
            credentials: "allowlisted_runtime_auth",
        },
        workspace: {
            path: workspace,
            expected_identity: "ephemeral runtime resource evaluation workspace",
            preserve_existing_changes: true,
        },
        runtime_policy: {
            command,
            argument_prefix: argumentPrefix,
            sandbox: "workspace-write",
            network: "no_additional_grant",
            configuration: "isolated",
            environment: "allowlisted_runtime_auth",
            timeout_seconds: 120,
            stdout_limit_bytes: 1024 * 1024,
            session_mode: "ephemeral",
        },
        currentness_basis: {
            objective_revision: "resource-evaluation-objective-1",
            context_revision: "resource-evaluation-context-1",
        },
    });
}

function observation(kind: string): RuntimeObservation {
    return {
        record_version: 1,
        observed_at: FIXED_RUNTIME_AT,
        kind,
    };
}

async function runMeasured(prepared: PreparedWorkload, sampleMs: number): Promise<RawSample> {
    const start = performance.now();
    const child = spawn(prepared.command, prepared.arguments_, {
        cwd: ROOT,
        env: { ...process.env, EMBER_TEST_NOW: FIXED_RUNTIME_AT },
        stdio: [prepared.stdin === null ? "ignore" : "pipe", "pipe", "pipe"],
    });
    if (child.pid === undefined) throw new Error("failed to observe measured Ember process pid");
    const rootPid = child.pid;
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
        stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
        stderr += chunk;
    });
    if (prepared.stdin !== null) child.stdin.end(prepared.stdin);

    let closed = false;
    let code: number | null = null;
    let signal: NodeJS.Signals | null = null;
    const terminal = new Promise<void>((resolve_, reject) => {
        child.once("error", reject);
        child.once("close", (code_, signal_) => {
            code = code_;
            signal = signal_;
            closed = true;
            resolve_();
        });
    });

    let rootMaxRssKib = 0;
    let externalMaxRssKib = 0;
    let treeMaxRssKib = 0;
    let maxProcessCount = 0;
    let externalProcessObserved = false;
    const maxCpuTicks = new Map<number, number>();

    while (!closed) {
        const snapshot = await processTree(rootPid);
        if (snapshot.length > 0) {
            const root = snapshot.find((process_) => process_.pid === rootPid);
            const external = snapshot.filter((process_) => process_.pid !== rootPid);
            const rootRss = root?.rssKib ?? 0;
            const externalRss = external.reduce((sum, process_) => sum + process_.rssKib, 0);
            rootMaxRssKib = Math.max(rootMaxRssKib, rootRss);
            externalMaxRssKib = Math.max(externalMaxRssKib, externalRss);
            treeMaxRssKib = Math.max(treeMaxRssKib, rootRss + externalRss);
            maxProcessCount = Math.max(maxProcessCount, snapshot.length);
            externalProcessObserved ||= external.length > 0;
            for (const process_ of snapshot) {
                maxCpuTicks.set(process_.pid, Math.max(maxCpuTicks.get(process_.pid) ?? 0, process_.cpuTicks));
            }
        }
        await delay(sampleMs);
    }
    await terminal;

    const elapsedMs = performance.now() - start;
    if (code !== 0) {
        throw new Error(
            `measured workload failed with ${code ?? signal ?? "unknown"}: ${stderr.trim() || stdout.trim() || "no diagnostic"}`,
        );
    }
    if (rootMaxRssKib === 0) throw new Error("measured Ember process exited before any RSS sample was observed");

    const rootTicks = maxCpuTicks.get(rootPid) ?? 0;
    let externalTicks = 0;
    for (const [pid, ticks] of maxCpuTicks) if (pid !== rootPid) externalTicks += ticks;
    const rootCpuMs = ticksToMs(rootTicks);
    const externalCpuMs = ticksToMs(externalTicks);
    const treeCpuMs = rootCpuMs + externalCpuMs;

    return {
        elapsedMs,
        rootMaxRssKib,
        externalMaxRssKib,
        treeMaxRssKib,
        rootCpuMs,
        externalCpuMs,
        treeCpuMs,
        rootAverageCpuPercent: percent(rootCpuMs, elapsedMs),
        externalAverageCpuPercent: percent(externalCpuMs, elapsedMs),
        treeAverageCpuPercent: percent(treeCpuMs, elapsedMs),
        maxProcessCount,
        externalProcessObserved,
    };
}

async function observeIdle(durationMs: number, sampleMs: number) {
    const started = performance.now();
    let maxResidentProcesses = 0;
    let maxResidentRssKib = 0;
    while (performance.now() - started < durationMs) {
        const processes = await allProcesses();
        const residents = processes.filter((process_) => process_.commandLine.includes(RUNTIME_ENTRYPOINT));
        maxResidentProcesses = Math.max(maxResidentProcesses, residents.length);
        maxResidentRssKib = Math.max(
            maxResidentRssKib,
            residents.reduce((sum, process_) => sum + process_.rssKib, 0),
        );
        await delay(sampleMs);
    }
    if (maxResidentProcesses !== 0) {
        throw new Error(`idle baseline observed ${maxResidentProcesses} resident ember-runtime process(es)`);
    }
    return {
        observation_ms: durationMs,
        max_ember_runtime_process_count: maxResidentProcesses,
        max_ember_runtime_rss_kib: maxResidentRssKib,
        ember_runtime_cpu_ms: 0,
        interpretation: "No Ember Node worker is resident between episodic activations.",
    };
}

async function processTree(rootPid: number): Promise<ProcessInfo[]> {
    const processes = await allProcesses();
    const byPid = new Map(processes.map((process_) => [process_.pid, process_]));
    if (!byPid.has(rootPid)) return [];
    const wanted = new Set([rootPid]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const process_ of processes) {
            if (wanted.has(process_.ppid) && !wanted.has(process_.pid)) {
                wanted.add(process_.pid);
                changed = true;
            }
        }
    }
    return processes.filter((process_) => wanted.has(process_.pid));
}

async function allProcesses(): Promise<ProcessInfo[]> {
    let entries;
    try {
        entries = await readdir("/proc", { withFileTypes: true });
    } catch (error) {
        throw new Error(`cannot read Linux /proc: ${error instanceof Error ? error.message : String(error)}`);
    }
    const processes = await Promise.all(
        entries
            .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
            .map((entry) => readProcess(Number(entry.name))),
    );
    return processes.filter((process_): process_ is ProcessInfo => process_ !== null);
}

async function readProcess(pid: number): Promise<ProcessInfo | null> {
    try {
        const [stat, status, commandLine] = await Promise.all([
            readFile(`/proc/${pid}/stat`, "utf8"),
            readFile(`/proc/${pid}/status`, "utf8"),
            readFile(`/proc/${pid}/cmdline`, "utf8"),
        ]);
        const rest = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/);
        const ppid = Number(rest[1]);
        const userTicks = Number(rest[11]);
        const systemTicks = Number(rest[12]);
        const rssKib = Number(/^VmRSS:\s+(\d+)\s+kB$/m.exec(status)?.[1] ?? 0);
        if (![ppid, userTicks, systemTicks, rssKib].every(Number.isFinite)) return null;
        return {
            pid,
            ppid,
            rssKib,
            cpuTicks: userTicks + systemTicks,
            commandLine: commandLine.replaceAll("\0", " ").trim(),
        };
    } catch {
        return null;
    }
}

function summarizeSamples(name: WorkloadName, samples: RawSample[]) {
    if (samples.length === 0) throw new Error(`no retained samples for ${name}`);
    return {
        sample_count: samples.length,
        elapsed_ms: summarize(samples.map((sample) => sample.elapsedMs)),
        ember_root_max_rss_kib: summarize(samples.map((sample) => sample.rootMaxRssKib)),
        external_descendants_max_rss_kib: summarize(samples.map((sample) => sample.externalMaxRssKib)),
        total_tree_max_rss_kib: summarize(samples.map((sample) => sample.treeMaxRssKib)),
        ember_root_cpu_ms: summarize(samples.map((sample) => sample.rootCpuMs)),
        external_descendants_cpu_ms: summarize(samples.map((sample) => sample.externalCpuMs)),
        total_tree_cpu_ms: summarize(samples.map((sample) => sample.treeCpuMs)),
        ember_root_average_cpu_percent: summarize(samples.map((sample) => sample.rootAverageCpuPercent)),
        external_descendants_average_cpu_percent: summarize(
            samples.map((sample) => sample.externalAverageCpuPercent),
        ),
        total_tree_average_cpu_percent: summarize(samples.map((sample) => sample.treeAverageCpuPercent)),
        max_process_count: summarize(samples.map((sample) => sample.maxProcessCount)),
        external_process_observed_in_every_sample: samples.every((sample) => sample.externalProcessObserved),
    };
}

function summarize(values: number[]) {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const median =
        sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
    return {
        median: round(median),
        min: round(sorted[0]!),
        max: round(sorted.at(-1)!),
        samples: values.map(round),
    };
}

function providerConfiguration(cli: CliOptions) {
    if (cli.providerCommand !== null) {
        return { mode: "external" as const, command: cli.providerCommand, arguments_: [...cli.providerArguments] };
    }
    return {
        mode: "fixture" as const,
        command: process.execPath,
        arguments_: [FIXTURE_CODEX, "--hold-ms", String(cli.holdMs)],
    };
}

function readClockTicksPerSecond() {
    try {
        const value = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim());
        if (Number.isFinite(value) && value > 0) return value;
    } catch {}
    return 100;
}

function ticksToMs(ticks: number) {
    return (ticks / clockTicksPerSecond) * 1_000;
}

function percent(cpuMs: number, elapsedMs: number) {
    return elapsedMs <= 0 ? 0 : (cpuMs / elapsedMs) * 100;
}

function gitRevision() {
    try {
        return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    } catch {
        return process.env.GITHUB_SHA ?? "unknown";
    }
}

function round(value: number) {
    return Math.round(value * 100) / 100;
}

function parseArgs(args: string[]): CliOptions {
    const parsed: CliOptions = {
        repeat: 5,
        warmup: 1,
        holdMs: 1_200,
        idleMs: 1_500,
        sampleMs: 10,
        providerCommand: null,
        providerArguments: [],
    };
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === "--repeat") parsed.repeat = positiveInteger(args[++index], argument);
        else if (argument === "--warmup") parsed.warmup = nonNegativeInteger(args[++index], argument);
        else if (argument === "--hold-ms") parsed.holdMs = positiveInteger(args[++index], argument);
        else if (argument === "--idle-ms") parsed.idleMs = positiveInteger(args[++index], argument);
        else if (argument === "--sample-ms") parsed.sampleMs = positiveInteger(args[++index], argument);
        else if (argument === "--provider-command") parsed.providerCommand = requiredValue(args[++index], argument);
        else if (argument === "--provider-arg") parsed.providerArguments.push(requiredValue(args[++index], argument));
        else throw new Error(`unknown runtime resource evaluation argument: ${argument}`);
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
