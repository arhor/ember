import { spawn } from "node:child_process";
import type { LongitudinalScenario } from "../longitudinal/harness.ts";

type ScenarioAction = LongitudinalScenario["setup"][number];
type ScenarioEpisode = LongitudinalScenario["episodes"][number];

interface InspectionSnapshot {
    lineage: { lineage_id: string };
    current_meanings: Array<{ meaning_id: string }>;
    runtime_episodes: Array<{
        runtime_id: string;
        recovery_account: {
            gap_kind: string;
            ember_cognition_during_interval: string;
        };
    }>;
    cognition_episodes: Array<{
        status: string;
        delivery_status: string;
        selected_meaning_ids: string[];
        external_provider_thread_id?: string | null;
    }>;
}

export interface ProcessRestartHarnessOptions {
    statePath: string;
    cliPath: string;
    cwd: string;
    codexCommand: string;
    codexArguments?: string[];
    timeoutSeconds: number;
    environment?: NodeJS.ProcessEnv;
    executionMode: "fixture" | "live";
}

export interface ProcessRestartObservation {
    assertion: string;
    passed: boolean;
    expected: unknown;
    observed: unknown;
}

export interface ProcessRestartReport {
    report_version: 1;
    scenario_id: string;
    description: string;
    execution_mode: "fixture" | "live";
    sanitized: true;
    ember_assertions_passed: boolean;
    model_observations_passed: boolean;
    passed: boolean;
    ember_assertions: ProcessRestartObservation[];
    model_observations: ProcessRestartObservation[];
}

interface ChildResult {
    pid: number;
    code: number | null;
    signal: NodeJS.Signals | null;
    stdout: string;
    stderr: string;
}

export async function runProcessRestartScenario(
    scenario: LongitudinalScenario,
    options: ProcessRestartHarnessOptions,
): Promise<ProcessRestartReport> {
    validateProcessRestartScenario(scenario);
    if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
        throw new Error("process-restart provider timeout must be a positive finite number");
    }

    const [baselineEpisode, restartedEpisode] = scenario.episodes;
    const baseEnvironment = options.environment ?? process.env;
    const runArguments = (episode: ScenarioEpisode) => [
        "run",
        "--state",
        options.statePath,
        "--principal",
        scenario.ember.principal,
        "--scope",
        episode.scope,
        "--provider",
        "codex",
        "--codex-command",
        options.codexCommand,
        ...(options.codexArguments ?? []).flatMap((value) => ["--codex-arg", value]),
        "--provider-timeout-seconds",
        String(options.timeoutSeconds),
    ];

    const initialized = await runCli(
        options,
        ["init", "--state", options.statePath, "--name", scenario.ember.name, "--principal", scenario.ember.principal],
        "",
        scenario.ember.initial_at,
        baseEnvironment,
    );
    requireSuccessfulProcess("initialization", initialized);

    const setupCommands = scenario.setup.map((action) => actionToCli(action, scenario.ember.principal));
    const baseline = await runCli(
        options,
        runArguments(baselineEpisode),
        [...setupCommands, baselineEpisode.input, ":quit", ""].join("\n"),
        baselineEpisode.at,
        baseEnvironment,
    );
    requireSuccessfulProcess("baseline Ember process", baseline);
    const aliases = parseSetupAliases(baseline.stdout, scenario.setup);
    requireExpectationAliases(baselineEpisode, aliases);
    requireExpectationAliases(restartedEpisode, aliases);
    const baselineReply = extractRunReply(baseline.stdout, scenario.setup.length);
    const baselineView = await inspectState(options, scenario, baselineEpisode.at, baseEnvironment);

    const restarted = await runCli(
        options,
        runArguments(restartedEpisode),
        [restartedEpisode.input, ":quit", ""].join("\n"),
        restartedEpisode.at,
        baseEnvironment,
    );
    requireSuccessfulProcess("restarted Ember process", restarted);
    const restartedReply = extractRunReply(restarted.stdout, 0);
    const restartedView = await inspectState(options, scenario, restartedEpisode.at, baseEnvironment);

    const baselineRuntime = requireLast(baselineView.runtime_episodes, "baseline runtime evidence");
    const restartedRuntime = requireLast(restartedView.runtime_episodes, "restarted runtime evidence");
    const baselineCognition = requireLast(baselineView.cognition_episodes, "baseline cognition evidence");
    const restartedCognition = requireLast(restartedView.cognition_episodes, "restarted cognition evidence");
    const baselineThreadId = baselineCognition.external_provider_thread_id ?? null;
    const restartedThreadId = restartedCognition.external_provider_thread_id ?? null;
    const reverseAliases = new Map([...aliases.entries()].map(([alias, id]) => [id, alias]));

    const selectedAliases = (cognition: InspectionSnapshot["cognition_episodes"][number]) =>
        cognition.selected_meaning_ids.map((id) => reverseAliases.get(id) ?? "<unaliased>").sort();
    const expectedBaseline = baselineEpisode.expect.selected_meanings.slice().sort();
    const expectedRestarted = restartedEpisode.expect.selected_meanings.slice().sort();
    const forbiddenBaseline = baselineEpisode.expect.forbidden_meanings;
    const forbiddenRestarted = restartedEpisode.expect.forbidden_meanings;
    const baselineSelected = selectedAliases(baselineCognition);
    const restartedSelected = selectedAliases(restartedCognition);
    const expectedCurrentAliases = scenario.setup.map((action) => action.as).sort();
    const restartedCurrentAliases = restartedView.current_meanings
        .map((meaning) => reverseAliases.get(meaning.meaning_id) ?? "<unaliased>")
        .sort();

    const emberAssertions: ProcessRestartObservation[] = [
        observation(
            "baseline selected meanings",
            expectedBaseline,
            baselineSelected,
            sameJson(expectedBaseline, baselineSelected),
        ),
        observation(
            "baseline forbidden meanings absent",
            [],
            forbiddenBaseline.filter((alias) => baselineSelected.includes(alias)),
            forbiddenBaseline.every((alias) => !baselineSelected.includes(alias)),
        ),
        observation(
            "complete Ember process restarted",
            true,
            baseline.pid !== restarted.pid,
            baseline.pid !== restarted.pid,
        ),
        observation(
            "Ember runtime restarted",
            true,
            baselineRuntime.runtime_id !== restartedRuntime.runtime_id,
            baselineRuntime.runtime_id !== restartedRuntime.runtime_id,
        ),
        observation(
            "lineage preserved across process restart",
            true,
            baselineView.lineage.lineage_id === restartedView.lineage.lineage_id,
            baselineView.lineage.lineage_id === restartedView.lineage.lineage_id,
        ),
        observation(
            "restart recovery records clean downtime",
            "known_clean_stop_interval",
            restartedRuntime.recovery_account.gap_kind,
            restartedRuntime.recovery_account.gap_kind === "known_clean_stop_interval",
        ),
        observation(
            "restart recovery records no supported cognition during downtime",
            "none_in_supported_runtime",
            restartedRuntime.recovery_account.ember_cognition_during_interval,
            restartedRuntime.recovery_account.ember_cognition_during_interval === "none_in_supported_runtime",
        ),
        observation(
            "durable meanings remain canonical across process restart",
            expectedCurrentAliases,
            restartedCurrentAliases,
            sameJson(expectedCurrentAliases, restartedCurrentAliases),
        ),
        observation(
            "restarted selected meanings",
            expectedRestarted,
            restartedSelected,
            sameJson(expectedRestarted, restartedSelected),
        ),
        observation(
            "restarted forbidden meanings absent",
            [],
            forbiddenRestarted.filter((alias) => restartedSelected.includes(alias)),
            forbiddenRestarted.every((alias) => !restartedSelected.includes(alias)),
        ),
        observation(
            "baseline cognition completed",
            "completed/displayed",
            `${baselineCognition.status}/${baselineCognition.delivery_status}`,
            baselineCognition.status === "completed" && baselineCognition.delivery_status === "displayed",
        ),
        observation(
            "restarted cognition completed",
            "completed/displayed",
            `${restartedCognition.status}/${restartedCognition.delivery_status}`,
            restartedCognition.status === "completed" && restartedCognition.delivery_status === "displayed",
        ),
        observation(
            "baseline fresh provider thread observed",
            true,
            baselineThreadId !== null,
            baselineThreadId !== null,
        ),
        observation(
            "restarted fresh provider thread observed",
            true,
            restartedThreadId !== null,
            restartedThreadId !== null,
        ),
        observation(
            "fresh provider thread changed across process restart",
            true,
            baselineThreadId !== null && restartedThreadId !== null && baselineThreadId !== restartedThreadId,
            baselineThreadId !== null && restartedThreadId !== null && baselineThreadId !== restartedThreadId,
        ),
    ];

    const modelObservations: ProcessRestartObservation[] = [
        ...replyObservations(baselineEpisode, baselineReply),
        ...replyObservations(restartedEpisode, restartedReply),
    ];
    const emberAssertionsPassed = emberAssertions.every((item) => item.passed);
    const modelObservationsPassed = modelObservations.every((item) => item.passed);
    return {
        report_version: 1,
        scenario_id: scenario.id,
        description: scenario.description,
        execution_mode: options.executionMode,
        sanitized: true,
        ember_assertions_passed: emberAssertionsPassed,
        model_observations_passed: modelObservationsPassed,
        passed: emberAssertionsPassed && modelObservationsPassed,
        ember_assertions: emberAssertions,
        model_observations: modelObservations,
    };
}

function validateProcessRestartScenario(scenario: LongitudinalScenario) {
    if (scenario.episodes.length !== 2) throw new Error("process-restart scenario requires exactly two episodes");
    const [baseline, restarted] = scenario.episodes;
    if (baseline.restart_ember || !restarted.restart_ember)
        throw new Error("process-restart scenario must mark only the second episode as restart_ember");
    if (baseline.external_thread.mode !== "fresh" || restarted.external_thread.mode !== "fresh")
        throw new Error("process-restart scenario requires fresh provider threads in both episodes");
    if (baseline.cognition_backend !== "codex" || restarted.cognition_backend !== "codex")
        throw new Error("process-restart scenario currently requires the Codex cognition backend");
    if (
        baseline.purpose !== undefined ||
        restarted.purpose !== undefined ||
        baseline.explain?.length ||
        restarted.explain?.length
    ) {
        throw new Error("process-restart scenario currently supports ordinary cognition only");
    }
    if (baseline.changes?.length || restarted.changes?.length)
        throw new Error("process-restart scenario currently supports setup-only durable state");
    for (const action of scenario.setup) {
        if (action.at !== baseline.at)
            throw new Error("process-restart scenario setup actions must use the baseline episode timestamp");
        if (!["remember_relationship", "remember_fact", "remember_preference", "undertake"].includes(action.action)) {
            throw new Error(`process-restart scenario setup action is unsupported: ${action.action}`);
        }
    }
}

function actionToCli(action: ScenarioAction, principal: string): string {
    switch (action.action) {
        case "remember_relationship":
            return [
                ":remember",
                "relationship",
                quoteToken(`relationship:${principal}`),
                quoteToken(action.scope),
                quoteToken(action.text),
            ].join(" ");
        case "remember_fact":
            return [
                ":remember",
                "fact",
                quoteToken(`user:${principal}`),
                quoteToken(action.slot),
                quoteToken(action.scope),
                quoteToken(action.text),
            ].join(" ");
        case "remember_preference":
            return [
                ":prefer",
                quoteToken(`user:${principal}`),
                quoteToken(action.slot),
                quoteToken(action.scope),
                quoteToken(action.text),
            ].join(" ");
        case "undertake":
            return [":undertake", quoteToken(action.slot), quoteToken(action.scope), quoteToken(action.text)].join(" ");
        default:
            throw new Error(`unsupported process-restart setup action: ${action.action}`);
    }
}

function quoteToken(value: string) {
    if (/[\r\n]/.test(value)) throw new Error("process-restart scenario values must not contain newlines");
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function parseSetupAliases(stdout: string, setup: ScenarioAction[]) {
    const lines = stdout.split(/\r?\n/);
    if (!lines[0]?.startsWith("runtime ")) throw new Error("baseline process did not report a runtime start");
    const aliases = new Map<string, string>();
    for (let index = 0; index < setup.length; index += 1) {
        const id = lines[index + 1];
        if (typeof id !== "string" || !id.startsWith("meaning-"))
            throw new Error(`setup action ${setup[index].as} did not return a meaning id`);
        aliases.set(setup[index].as, id);
    }
    return aliases;
}

function requireExpectationAliases(episode: ScenarioEpisode, aliases: Map<string, string>) {
    for (const alias of [...episode.expect.selected_meanings, ...episode.expect.forbidden_meanings]) {
        if (!aliases.has(alias)) throw new Error(`episode ${episode.id} references unknown setup alias: ${alias}`);
    }
}

function extractRunReply(stdout: string, setupCount: number) {
    const lines = stdout.split(/\r?\n/);
    return lines
        .slice(1 + setupCount)
        .join("\n")
        .trim();
}

async function inspectState(
    options: ProcessRestartHarnessOptions,
    scenario: LongitudinalScenario,
    at: string,
    environment: NodeJS.ProcessEnv,
): Promise<InspectionSnapshot> {
    const result = await runCli(
        options,
        ["inspect", "--state", options.statePath, "--principal", scenario.ember.principal, "--json"],
        "",
        at,
        environment,
    );
    requireSuccessfulProcess("state inspection", result);
    const parsed: unknown = JSON.parse(result.stdout);
    if (!isInspectionSnapshot(parsed)) throw new Error("state inspection returned an unexpected shape");
    return parsed;
}

function isInspectionSnapshot(value: unknown): value is InspectionSnapshot {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const candidate = value as Partial<InspectionSnapshot>;
    return (
        candidate.lineage !== undefined &&
        typeof candidate.lineage.lineage_id === "string" &&
        Array.isArray(candidate.current_meanings) &&
        Array.isArray(candidate.runtime_episodes) &&
        Array.isArray(candidate.cognition_episodes)
    );
}

async function runCli(
    options: ProcessRestartHarnessOptions,
    args: string[],
    stdin: string,
    at: string,
    environment: NodeJS.ProcessEnv,
): Promise<ChildResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [options.cliPath, ...args], {
            cwd: options.cwd,
            env: { ...environment, EMBER_TEST_NOW: at },
            stdio: ["pipe", "pipe", "pipe"],
        });
        if (child.pid === undefined) {
            reject(new Error("failed to observe Ember child process pid"));
            return;
        }
        const pid = child.pid;
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
        child.on("error", reject);
        child.on("close", (code, signal) => resolve({ pid, code, signal, stdout, stderr }));
        child.stdin.end(stdin);
    });
}

function requireSuccessfulProcess(label: string, result: ChildResult) {
    if (result.code === 0) return;
    const diagnostic = result.stderr
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .trim()
        .slice(0, 4096);
    throw new Error(
        `${label} exited with ${result.signal ? `signal ${result.signal}` : `status ${result.code}`}${diagnostic ? `: ${diagnostic}` : ""}`,
    );
}

function replyObservations(episode: ScenarioEpisode, reply: string): ProcessRestartObservation[] {
    return [
        ...(episode.expect.reply_includes ?? []).map((text) =>
            observation(
                `${episode.id} reply includes ${JSON.stringify(text)}`,
                true,
                reply.includes(text),
                reply.includes(text),
            ),
        ),
        ...(episode.expect.reply_excludes ?? []).map((text) =>
            observation(
                `${episode.id} reply excludes ${JSON.stringify(text)}`,
                false,
                reply.includes(text),
                !reply.includes(text),
            ),
        ),
    ];
}

function observation(
    assertion: string,
    expected: unknown,
    observed: unknown,
    passed: boolean,
): ProcessRestartObservation {
    return { assertion, expected, observed, passed };
}

function requireLast<T>(items: T[], label: string): T {
    const value = items.at(-1);
    if (value === undefined) throw new Error(`${label} is absent`);
    return value;
}

function sameJson(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right);
}
