import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { SetupConfig } from "../../src/core/app/bootstrap.ts";
import type { RunCognitionOptions } from "../../src/core/app/cognition-execution.ts";
import type { MemoryProposalGenerator } from "../../src/core/memory/memory-proposal-generation.ts";
import type { EmberState, EvidenceId, MeaningId, RuntimeId } from "../../src/core/model.ts";
import type { OnboardingProgressEvaluator } from "../../src/core/onboarding/progress-evaluator.ts";

import { setupMain } from "../../src/apps/cli/setup.ts";
import { runTelegramSetup } from "../../src/apps/telegram/setup.ts";
import { executeCognition as runCoreCognition } from "../../src/core/app/cognition-execution.ts";
import { prepareCognition } from "../../src/core/app/cognition-preparation.ts";
import { runPostTurnFollowUps } from "../../src/core/app/post-turn.ts";
import { createFileBackedRepositoriesForState } from "../../src/core/composition/ember.ts";
import { ValidationError } from "../../src/core/errors.ts";
import { SystemdTelegramResidentHost } from "../../src/core/host/systemd.ts";
import { initialState } from "../../src/core/model.ts";
import { applyOnboardingProgressDecision, createOnboardingWork } from "../../src/core/onboarding-work.ts";
import { OnboardingWorkStore } from "../../src/core/persistence/onboarding-work-store.ts";
import { StateStore } from "../../src/core/persistence/state-store.ts";
import { startRuntime, stopRuntime } from "../../src/core/runtime-episode.ts";
import { exactKeys, isObject } from "../../src/core/util.ts";

export type SetupOnboardingFlow = "fresh-create" | "restore-existing";
export interface SetupOnboardingScenario {
    scenario_version: 1;
    id: string;
    description: string;
    flow: SetupOnboardingFlow;
    principal: string;
    scope: string;
    episodes: Array<{ id: string; at: string; input: string }>;
    assertions: Array<{ id: string; expected: string }>;
}
export type OracleFault = "lineage_replacement" | "newborn_onboarding" | "direct_memory" | "secret_leakage";
export interface AssertionRecord {
    assertion: string;
    responsibility: "ember" | "host";
    expected: string;
    observed: string;
    passed: boolean;
}

async function executeCognition(
    repositories: ReturnType<typeof createFileBackedRepositoriesForState>,
    state: EmberState,
    options: RunCognitionOptions & {
        memoryProposalGenerator?: MemoryProposalGenerator;
        memoryProposalProviderLabel?: string;
        onboardingProgressEvaluator?: OnboardingProgressEvaluator;
    },
) {
    const { memoryProposalGenerator, memoryProposalProviderLabel, onboardingProgressEvaluator, ...cognition } = options;
    const preparation = await prepareCognition(repositories, state, {
        runtimeId: cognition.runtimeId,
        principal: cognition.principal,
        scope: cognition.scope,
        surface: cognition.surface ?? "local_cli",
        text: cognition.text,
        ...(cognition.purpose === undefined ? {} : { purpose: cognition.purpose }),
        ...(cognition.explainIds === undefined ? {} : { explainIds: cognition.explainIds }),
        ...(cognition.conversationMembership === undefined
            ? {}
            : { conversationMembership: cognition.conversationMembership }),
    });
    const result = await runCoreCognition(repositories, state, { ...cognition, preparation });
    const diagnostics = await runPostTurnFollowUps(
        repositories,
        {
            ...(memoryProposalGenerator === undefined ? {} : { memoryProposalGenerator }),
            ...(memoryProposalProviderLabel === undefined ? {} : { memoryProposalProviderLabel }),
            ...(onboardingProgressEvaluator === undefined ? {} : { onboardingProgressEvaluator }),
        },
        result.state,
        preparation,
        {
            cognitionId: result.cognitionId,
            principal: cognition.principal,
            scope: cognition.scope,
            text: cognition.text,
        },
    );
    return { ...result, ...diagnostics, state: await repositories.state.load() };
}

const SECRET = "123456:Issue256SecretSentinel_abcdef";
const OLD_SECRET = "987654:OldHostSecretSentinel_abcdef";
const OLD_PROVIDER = "/old-host/bin/codex-secret-path";
const OLD_CHAT = "telegram:chat:998877";
const FLOW_CONTRACTS = {
    "fresh-create": {
        episodes: ["defer", "learn", "close"],
        assertions: [
            "provider_failure_retry_preserves_candidate",
            "lineage_after_verified_probe",
            "deferred_work_survives_restart",
            "ordinary_memory_adoption",
            "provider_replacement_preserves_continuity",
            "telegram_setup_completion",
            "secret_containment",
        ],
    },
    "restore-existing": {
        episodes: ["resume"],
        assertions: [
            "restore_bytes_preserved_before_conversation",
            "lineage_and_meaning_identity_preserved",
            "original_provenance_projected",
            "no_newborn_onboarding",
            "old_host_state_not_transferred",
        ],
    },
} as const;

export async function loadSetupOnboardingScenario(path: string): Promise<SetupOnboardingScenario> {
    if (!isAbsolute(path)) throw new ValidationError("setup/onboarding scenario path must be absolute");
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    validateSetupOnboardingScenario(value);
    return value;
}

export function validateSetupOnboardingScenario(value: unknown): asserts value is SetupOnboardingScenario {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "scenario_version",
            "id",
            "description",
            "flow",
            "principal",
            "scope",
            "episodes",
            "assertions",
        ])
    )
        throw new ValidationError("setup/onboarding scenario contains missing or unsupported fields");
    if (
        value.scenario_version !== 1 ||
        !text(value.id) ||
        !text(value.description) ||
        !["fresh-create", "restore-existing"].includes(String(value.flow)) ||
        !text(value.principal) ||
        !text(value.scope) ||
        !Array.isArray(value.episodes) ||
        !Array.isArray(value.assertions)
    )
        throw new ValidationError("setup/onboarding scenario header is invalid");
    const episodeIds = new Set<string>();
    for (const episode of value.episodes) {
        if (
            !isObject(episode) ||
            !exactKeys(episode, ["id", "at", "input"]) ||
            !text(episode.id) ||
            episodeIds.has(episode.id) ||
            !text(episode.at) ||
            Number.isNaN(Date.parse(episode.at)) ||
            !text(episode.input)
        )
            throw new ValidationError("setup/onboarding episode is invalid or duplicated");
        episodeIds.add(episode.id);
    }
    const assertionIds = new Set<string>();
    for (const assertion of value.assertions) {
        if (
            !isObject(assertion) ||
            !exactKeys(assertion, ["id", "expected"]) ||
            !text(assertion.id) ||
            assertionIds.has(assertion.id) ||
            !text(assertion.expected)
        )
            throw new ValidationError("setup/onboarding assertion is invalid or duplicated");
        assertionIds.add(assertion.id);
    }
    const contract = FLOW_CONTRACTS[value.flow as SetupOnboardingFlow];
    if (
        episodeIds.size !== contract.episodes.length ||
        !contract.episodes.every((id) => episodeIds.has(id)) ||
        assertionIds.size !== contract.assertions.length ||
        !contract.assertions.every((id) => assertionIds.has(id))
    )
        throw new ValidationError("setup/onboarding scenario does not satisfy its flow-specific contract");
}

export async function runSetupOnboardingScenario(
    scenario: SetupOnboardingScenario,
    directory: string,
    fault?: OracleFault,
) {
    validateSetupOnboardingScenario(scenario);
    if (!isAbsolute(directory)) throw new ValidationError("evaluation directory must be absolute");
    const assertions =
        scenario.flow === "fresh-create"
            ? await fresh(scenario, directory, fault)
            : await restore(scenario, directory, fault);
    const declared = new Map(scenario.assertions.map((item) => [item.id, item.expected]));
    if (assertions.some((item) => !declared.has(item.assertion)) || declared.size !== assertions.length)
        throw new ValidationError("fixture assertions do not match the flow oracle");
    for (const assertion of assertions) assertion.expected = declared.get(assertion.assertion)!;
    const emberAssertionsPassed = assertions
        .filter((item) => item.responsibility === "ember")
        .every((item) => item.passed);
    const hostAssertionsPassed = assertions
        .filter((item) => item.responsibility === "host")
        .every((item) => item.passed);
    return {
        id: scenario.id,
        flow: scenario.flow,
        ember_assertions_passed: emberAssertionsPassed,
        host_assertions_passed: hostAssertionsPassed,
        passed: emberAssertionsPassed && hostAssertionsPassed,
        assertions,
    };
}

async function fresh(s: SetupOnboardingScenario, directory: string, fault?: OracleFault): Promise<AssertionRecord[]> {
    const configPath = `${directory}/config/setup.json`,
        statePath = `${directory}/state/continuity.json`;
    const projections: unknown[] = [];
    let probes = 0;
    const io = quietIo();
    const provider = () => async (request: any) => {
        probes++;
        projections.push(request.projection);
        return {
            contractVersion: 1 as const,
            reply: "verified",
            usedMeaningIds: request.projection.selection.meaning_ids,
        };
    };
    const recoveryConfigPath = `${directory}/recovery/setup.json`;
    const recoveryStatePath = `${directory}/recovery/continuity.json`;
    const recoveryArgs = {
        command: "setup" as const,
        config: recoveryConfigPath,
        state: recoveryStatePath,
        intent: "create-new" as const,
        principal: s.principal,
        provider: "codex" as const,
        providerCommand: "/fixture/codex",
        model: undefined,
        providerTimeoutSeconds: undefined,
        acceptContinuityRisk: false,
        confirmProviderChange: false,
        help: false,
    };
    const failedCode = await setupMain(recoveryArgs, io, {
        provider: () => async () => {
            throw new Error("deterministic verification failure");
        },
    });
    const pendingLineage = (JSON.parse(await readFile(recoveryConfigPath, "utf8")) as SetupConfig).lineageId;
    const stateAbsentAfterFailure = !(await pathExists(recoveryStatePath));
    const onboardingAbsentAfterFailure = !(await pathExists(`${recoveryStatePath}.onboarding.json`));
    const retryCode = await setupMain(recoveryArgs, io, {
        provider: () => async (request: any) => ({
            contractVersion: 1,
            reply: "verified after retry",
            usedMeaningIds: request.projection.selection.meaning_ids,
        }),
    });
    const recoveredConfig = JSON.parse(await readFile(recoveryConfigPath, "utf8")) as SetupConfig;
    const recoveredState = await new StateStore(recoveryStatePath).load();
    const recovery = record(
        "provider_failure_retry_preserves_candidate",
        failedCode === 2 &&
            stateAbsentAfterFailure &&
            onboardingAbsentAfterFailure &&
            retryCode === 0 &&
            recoveredConfig.lineageId === pendingLineage &&
            recoveredState.lineage.lineageId === pendingLineage,
        `failure_exit=${failedCode}; state_absent=${stateAbsentAfterFailure}; onboarding_absent=${onboardingAbsentAfterFailure}; retry_exit=${retryCode}; candidate_preserved=${recoveredConfig.lineageId === pendingLineage}`,
    );
    const code = await setupMain(
        {
            command: "setup",
            config: configPath,
            state: statePath,
            intent: "create-new",
            principal: s.principal,
            provider: "codex",
            providerCommand: "/fixture/codex",
            model: undefined,
            providerTimeoutSeconds: undefined,
            acceptContinuityRisk: false,
            confirmProviderChange: false,
            help: false,
        },
        io,
        { provider },
    );
    const config = JSON.parse(await readFile(configPath, "utf8")) as SetupConfig;
    const created = await new StateStore(statePath).load();
    const lineageBefore = created.lineage.lineageId;
    const first = record(
        "lineage_after_verified_probe",
        code === 0 && probes === 1 && created.revision === 0 && config.verification === "verified",
        `exit=${code}; probes=${probes}; revision=${created.revision}`,
    );

    let store = new StateStore(statePath);
    let lease = await store.acquireWriteLease();
    let state = await store.load();
    let runtime = startRuntime(state, s.principal, s.scope);
    state = await store.commit(state.revision, runtime.state);
    const defer = scenarioEpisode(s, "defer");
    state = (
        await executeCognition(
            createFileBackedRepositoriesForState(store),
            state,
            cognition(runtime.runtimeId, s, defer, projections, { onboarding: "defer" }),
        )
    ).state;
    state = await store.commit(state.revision, stopRuntime(state, runtime.runtimeId, { reason: "evaluation_restart" }));
    await store.releaseWriteLease(lease);
    store = new StateStore(statePath);
    lease = await store.acquireWriteLease();
    runtime = startRuntime(await store.load(), s.principal, s.scope);
    state = await store.commit(state.revision, runtime.state);
    const work = await new OnboardingWorkStore(statePath).load();
    const second = record(
        "deferred_work_survives_restart",
        !!work && work.topics.every((topic) => topic.status === "deferred"),
        work?.topics.map((topic) => topic.status).join(",") ?? "missing",
    );
    const learn = scenarioEpisode(s, "learn");
    state = (
        await executeCognition(
            createFileBackedRepositoriesForState(store),
            state,
            cognition(runtime.runtimeId, s, learn, projections, { memory: true }),
        )
    ).state;
    const meaning = state.meanings.find((item) => item.slot === "response-style");
    const close = scenarioEpisode(s, "close");
    state = (
        await executeCognition(
            createFileBackedRepositoriesForState(store),
            state,
            cognition(runtime.runtimeId, s, close, projections, { onboarding: "close" }),
        )
    ).state;
    await store.releaseWriteLease(lease);
    const observedMeaning = meaning ? structuredClone(meaning) : undefined;
    if (fault === "direct_memory" && observedMeaning)
        observedMeaning.sourceEvidenceIds = ["evidence-direct-unprovenanced" as EvidenceId];
    const observedSource =
        observedMeaning && state.evidence.find((item) => item.evidenceId === observedMeaning.sourceEvidenceIds[0]);
    const third = record(
        "ordinary_memory_adoption",
        !!observedMeaning &&
            observedSource?.sourceRole === "user_command" &&
            observedMeaning.sourceEvidenceIds.length > 0,
        observedMeaning
            ? `meaning=${observedMeaning.meaningId}; source=${observedSource?.sourceRole ?? "missing"}`
            : "missing",
    );

    await setupMain(
        {
            command: "setup",
            config: configPath,
            state: statePath,
            intent: "use-existing",
            provider: "cursor",
            providerCommand: "/fixture/cursor",
            principal: undefined,
            model: undefined,
            providerTimeoutSeconds: undefined,
            acceptContinuityRisk: false,
            confirmProviderChange: true,
            help: false,
        },
        io,
        { provider },
    );
    const after = await new StateStore(statePath).load();
    if (fault === "lineage_replacement") after.lineage.lineageId = "lineage-replaced" as any;
    const fourth = record(
        "provider_replacement_preserves_continuity",
        after.lineage.lineageId === lineageBefore &&
            after.meanings.some((item) => item.meaningId === meaning?.meaningId),
        `lineage=${after.lineage.lineageId}; meaning=${after.meanings.some((item) => item.meaningId === meaning?.meaningId)}`,
    );

    const files = new Map<string, string>();
    const modes = new Map<string, number>();
    const commands: string[] = [];
    const read = async (path: string) => files.get(path) ?? null;
    const write = async (path: string, value: string, mode: number) => {
        files.set(path, value);
        modes.set(path, mode);
    };
    const residentHost = new SystemdTelegramResidentHost({
        read,
        write,
        command: async (file, args) => {
            commands.push(`${file} ${args.join(" ")}`);
            return { code: args.includes("is-active") || args.includes("is-enabled") ? 1 : 0, signal: null };
        },
    });
    const telegram = await runTelegramSetup(
        {
            setup: JSON.parse(await readFile(configPath, "utf8")),
            scope: s.scope,
            configPath: `${directory}/config/telegram.json`,
            tokenPath: `${directory}/secrets/telegram.token`,
        },
        io,
        {
            secretPrompt: async () => SECRET,
            confirm: async () => true,
            read,
            write,
            residentHost,
            chmod: async () => {},
            api: () =>
                ({
                    getMe: async () => ({ id: 1, is_bot: true, first_name: "Fixture" }),
                    getWebhookInfo: async () => ({ url: "", has_custom_certificate: false, pending_update_count: 0 }),
                    getUpdates: async () => [
                        {
                            update_id: 42,
                            message: {
                                message_id: 1,
                                date: 1,
                                text: "256256",
                                chat: { id: 7, type: "private" },
                                from: { id: 7, is_bot: false, first_name: "User" },
                            },
                        },
                    ],
                }) as any,
            verificationCode: () => "256256",
            observeRoundTrip: async () => true,
            resolveExecutable: async (value) => value,
        },
    );
    const fifth = record(
        "telegram_setup_completion",
        telegram.status === "complete" && Object.values(telegram.stages).every((value) => value === "confirmed"),
        `${telegram.status}:${Object.values(telegram.stages).join(",")}`,
    );
    if (fault === "secret_leakage") files.set(`${directory}/config/leak.txt`, SECRET);
    const allowed = `${directory}/secrets/telegram.token`;
    const leaked = [...files].filter(([path, value]) => path !== allowed && value.includes(SECRET));
    const disk = [
        await readFile(configPath, "utf8"),
        await readFile(statePath, "utf8"),
        JSON.stringify(projections),
        commands.join("\n"),
    ].join("\n");
    const sixth = record(
        "secret_containment",
        files.get(allowed)?.trim() === SECRET &&
            modes.get(allowed) === 0o600 &&
            leaked.length === 0 &&
            !disk.includes(SECRET),
        `token_mode=${modes.get(allowed)?.toString(8)}; leaked_locations=${leaked.length}; leaked_evidence=${disk.includes(SECRET)}`,
    );
    return [recovery, first, second, third, fourth, fifth, sixth];
}

async function restore(s: SetupOnboardingScenario, directory: string, fault?: OracleFault): Promise<AssertionRecord[]> {
    const oldStatePath = `${directory}/old-host/state/continuity.json`,
        statePath = `${directory}/restored/continuity.json`,
        configPath = `${directory}/new-host/setup.json`;
    const bundle = await establishedBundle(s, oldStatePath);
    const before = await readFile(oldStatePath, "utf8"),
        openWork = createOnboardingWork(bundle.lineage.lineageId, s.principal, s.scope, "2025-01-01T00:01:00Z"),
        closedWork = applyOnboardingProgressDecision(
            openWork,
            {
                decision_version: 1,
                updates: openWork.topics.map(({ topic }) => ({
                    topic,
                    action: "decline",
                    basis: "completed on old host",
                })),
            },
            "evidence-restore-closed",
            "2025-01-01T00:02:00Z",
        ),
        sidecarBefore = `${JSON.stringify(closedWork, null, 2)}\n`;
    await writeFile(`${oldStatePath}.onboarding.json`, sidecarBefore);
    const oldSetupPath = `${directory}/old-host/config/setup.json`,
        oldTelegramPath = `${directory}/old-host/config/telegram.json`,
        oldTokenPath = `${directory}/old-host/secrets/telegram.token`;
    await mkdir(`${directory}/old-host/config`, { recursive: true });
    await mkdir(`${directory}/old-host/secrets`, { recursive: true });
    await writeFile(oldSetupPath, JSON.stringify({ provider_command: OLD_PROVIDER }));
    await writeFile(oldTelegramPath, JSON.stringify({ mapping: OLD_CHAT, token_file: oldTokenPath }));
    await writeFile(oldTokenPath, `${OLD_SECRET}\n`, { mode: 0o600 });
    await mkdir(`${directory}/restored`, { recursive: true });
    await copyFile(oldStatePath, statePath);
    await copyFile(`${oldStatePath}.onboarding.json`, `${statePath}.onboarding.json`);
    const projections: any[] = [];
    const io = quietIo();
    await setupMain(
        {
            command: "setup",
            config: configPath,
            state: statePath,
            intent: "restore-existing",
            provider: "cursor",
            providerCommand: "/new-host/bin/cursor",
            principal: undefined,
            model: undefined,
            providerTimeoutSeconds: undefined,
            acceptContinuityRisk: true,
            confirmProviderChange: false,
            help: false,
        },
        io,
        {
            provider: () => async (request: any) => {
                projections.push(request.projection);
                return {
                    contractVersion: 1,
                    reply: "verified",
                    usedMeaningIds: request.projection.selection.meaning_ids,
                };
            },
        },
    );
    const a = record(
        "restore_bytes_preserved_before_conversation",
        (await readFile(statePath, "utf8")) === before &&
            (await readFile(`${statePath}.onboarding.json`, "utf8")) === sidecarBefore,
        "canonical and sidecar byte comparison",
    );
    if (fault === "newborn_onboarding")
        await new OnboardingWorkStore(statePath).save(
            createOnboardingWork(bundle.lineage.lineageId, s.principal, s.scope, scenarioEpisode(s, "resume").at),
        );
    const store = new StateStore(statePath),
        lease = await store.acquireWriteLease();
    let state = await store.load();
    const started = startRuntime(state, s.principal, s.scope);
    state = await store.commit(state.revision, started.state);
    state = (
        await executeCognition(createFileBackedRepositoriesForState(store), state, {
            runtimeId: started.runtimeId,
            principal: s.principal,
            scope: s.scope,
            text: scenarioEpisode(s, "resume").input,
            providerLabel: "restore-fixture",
            executor: async (request) => {
                projections.push(request.projection);
                return {
                    contractVersion: 1,
                    reply: "continued",
                    usedMeaningIds: request.projection.selection.meaning_ids,
                };
            },
            timeoutSeconds: 1,
        })
    ).state;
    await store.releaseWriteLease(lease);
    const meaning = bundle.meanings[0]!;
    const b = record(
        "lineage_and_meaning_identity_preserved",
        state.lineage.lineageId === bundle.lineage.lineageId &&
            state.lineage.establishedAt === bundle.lineage.establishedAt &&
            state.meanings.some((item) => item.meaningId === meaning.meaningId),
        `lineage=${state.lineage.lineageId}; meaning=${meaning.meaningId}`,
    );
    const ordinary = projections.at(-1);
    const c = record(
        "original_provenance_projected",
        ordinary.selection.meaning_ids.includes(meaning.meaningId) &&
            ordinary.selection.evidence_ids.includes(meaning.sourceEvidenceIds[0]),
        `meaning=${ordinary.selection.meaning_ids.join(",")}; evidence=${ordinary.selection.evidence_ids.join(",")}`,
    );
    const onboarding = await new OnboardingWorkStore(statePath).load();
    const d = record(
        "no_newborn_onboarding",
        onboarding?.status === "closed" && onboarding.lineage_id === bundle.lineage.lineageId,
        onboarding === null ? "absent" : onboarding.status,
    );
    const config = await readFile(configPath, "utf8");
    const all = `${config}\n${JSON.stringify(state)}\n${JSON.stringify(projections)}`;
    const oldHostSource = [
        await readFile(oldSetupPath, "utf8"),
        await readFile(oldTelegramPath, "utf8"),
        await readFile(oldTokenPath, "utf8"),
    ].join("\n");
    const e = record(
        "old_host_state_not_transferred",
        oldHostSource.includes(OLD_PROVIDER) &&
            oldHostSource.includes(OLD_CHAT) &&
            oldHostSource.includes(OLD_SECRET) &&
            !all.includes(OLD_PROVIDER) &&
            !all.includes(OLD_CHAT) &&
            !all.includes(OLD_SECRET),
        `source_complete=${oldHostSource.includes(OLD_PROVIDER) && oldHostSource.includes(OLD_CHAT) && oldHostSource.includes(OLD_SECRET)}; old_provider_imported=${all.includes(OLD_PROVIDER)}; old_chat_imported=${all.includes(OLD_CHAT)}; old_secret_imported=${all.includes(OLD_SECRET)}`,
    );
    return [a, b, c, d, e];
}

async function establishedBundle(s: SetupOnboardingScenario, path: string): Promise<EmberState> {
    const store = new StateStore(path);
    await store.create(initialState(s.principal, "2025-01-01T00:00:00Z"));
    const lease = await store.acquireWriteLease();
    let state = await store.load();
    const started = startRuntime(state, s.principal, s.scope);
    state = await store.commit(state.revision, started.state);
    const repositories = createFileBackedRepositoriesForState(store);
    const text = "I prefer concise replies.";
    const preparation = await prepareCognition(repositories, state, {
        runtimeId: started.runtimeId,
        principal: s.principal,
        scope: s.scope,
        surface: "local_cli",
        text,
    });
    const result = await executeCognition(repositories, state, {
        runtimeId: started.runtimeId,
        principal: s.principal,
        scope: s.scope,
        text,
        providerLabel: "bundle-builder",
        executor: async () => ({ contractVersion: 1, reply: "remembered", usedMeaningIds: [] }),
        timeoutSeconds: 1,
        preparation,
    });
    await runPostTurnFollowUps(
        repositories,
        {
            memoryProposalGenerator: async (request) => ({
                contractVersion: 1,
                candidates: [
                    {
                        proposal_version: 1,
                        proposal_id: "memory-proposal-restore",
                        proposed_at: request.proposedAt,
                        kind: "preference",
                        owner: `user:${s.principal}`,
                        slot: "response-style",
                        scope: s.scope,
                        content: "The user prefers concise replies",
                        source_evidence_ids: [request.projection.selection.source_evidence_ids[0]!],
                        epistemic_role: "user_testimony",
                        applicable_from: request.proposedAt,
                        applicable_until: null,
                        proposed_currentness: "current",
                        confidence: { source: "high", proposition: "high", interpretation: "high" },
                        uncertainty: null,
                        supersedes_meaning_id: null,
                    },
                ],
            }),
        },
        result.state,
        preparation,
        { cognitionId: result.cognitionId, principal: s.principal, scope: s.scope, text: "I prefer concise replies." },
    );
    state = await store.load();
    await store.releaseWriteLease(lease);
    return state;
}

function cognition(
    runtimeId: RuntimeId,
    s: SetupOnboardingScenario,
    episode: SetupOnboardingScenario["episodes"][number],
    projections: unknown[],
    options: { onboarding?: "defer" | "close"; memory?: boolean },
) {
    return {
        runtimeId,
        principal: s.principal,
        scope: s.scope,
        text: episode.input,
        providerLabel: "fixture-provider",
        executor: async (request: any) => {
            projections.push(request.projection);
            return {
                contractVersion: 1 as const,
                reply: "ordinary work completed",
                usedMeaningIds: request.projection.selection.meaning_ids,
            };
        },
        timeoutSeconds: 1,
        output: () => {},
        ...(options.onboarding
            ? {
                  onboardingProgressEvaluator: async () => ({
                      decision_version: 1 as const,
                      updates: (
                          ["forms_of_address", "agent_personality", "expectations", "optional_capabilities"] as const
                      ).map((topic) => ({
                          topic,
                          action:
                              options.onboarding === "defer"
                                  ? ("defer" as const)
                                  : topic === "optional_capabilities"
                                    ? ("decline" as const)
                                    : ("resolve" as const),
                          basis: episode.input,
                      })),
                  }),
              }
            : {}),
        ...(options.memory
            ? {
                  memoryProposalGenerator: async (request: any) => ({
                      contractVersion: 1 as const,
                      candidates: [
                          {
                              proposal_version: 1,
                              proposal_id: "memory-proposal-fresh",
                              proposed_at: request.proposedAt,
                              kind: "preference",
                              owner: `user:${s.principal}`,
                              slot: "response-style",
                              scope: s.scope,
                              content: "The user prefers concise replies",
                              source_evidence_ids: [request.projection.selection.source_evidence_ids[0] as EvidenceId],
                              epistemic_role: "user_testimony",
                              applicable_from: request.proposedAt,
                              applicable_until: null,
                              proposed_currentness: "current",
                              confidence: { source: "high", proposition: "high", interpretation: "high" },
                              uncertainty: null,
                              supersedes_meaning_id: null as MeaningId | null,
                          },
                      ],
                  }),
              }
            : {}),
    };
}
function record(assertion: string, passed: boolean, observed: string): AssertionRecord {
    const hostAssertions = new Set([
        "provider_failure_retry_preserves_candidate",
        "lineage_after_verified_probe",
        "telegram_setup_completion",
        "secret_containment",
        "restore_bytes_preserved_before_conversation",
        "old_host_state_not_transferred",
    ]);
    return {
        assertion,
        responsibility: hostAssertions.has(assertion) ? "host" : "ember",
        expected: "",
        observed,
        passed,
    };
}
function quietIo(): any {
    return { input: process.stdin, output: { write: () => true }, error: { write: () => true } };
}
function text(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function scenarioEpisode(scenario: SetupOnboardingScenario, id: string) {
    const episode = scenario.episodes.find((candidate) => candidate.id === id);
    if (!episode) throw new ValidationError(`setup/onboarding scenario is missing episode ${id}`);
    return episode;
}

async function pathExists(path: string) {
    try {
        await lstat(path);
        return true;
    } catch (error) {
        if (isObject(error) && error.code === "ENOENT") return false;
        throw error;
    }
}
