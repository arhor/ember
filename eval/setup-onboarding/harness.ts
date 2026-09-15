import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { EmberState, EvidenceId, MeaningId, RuntimeId } from "../../src/core/model.ts";
import type { SetupConfig } from "../../src/surfaces/cli/setup.ts";

import { ValidationError } from "../../src/core/errors.ts";
import { initialState } from "../../src/core/model.ts";
import { applyOnboardingProgressDecision, createOnboardingWork } from "../../src/core/onboarding-work.ts";
import { OnboardingWorkStore } from "../../src/persistence/onboarding-work-store.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { runCognition, startRuntime, stopRuntime } from "../../src/runtime/runtime.ts";
import { setupMain } from "../../src/surfaces/cli/setup.ts";
import { runTelegramSetup } from "../../src/surfaces/telegram/setup.ts";
import { exactKeys, isObject } from "../../src/util.ts";

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
    expected: string;
    observed: string;
    passed: boolean;
}

const SECRET = "123456:Issue256SecretSentinel_abcdef";
const OLD_SECRET = "987654:OldHostSecretSentinel_abcdef";
const OLD_PROVIDER = "/old-host/bin/codex-secret-path";
const OLD_CHAT = "telegram:chat:998877";

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
    const passed = assertions.every((item) => item.passed);
    return { id: scenario.id, flow: scenario.flow, passed, assertions };
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

    const store = new StateStore(statePath);
    const lease = await store.acquireWriteLease();
    let state = await store.load();
    let runtime = startRuntime(state, s.principal, s.scope);
    state = await store.commit(state.revision, runtime.state);
    const defer = s.episodes[0]!;
    state = (
        await runCognition(store, state, cognition(runtime.runtimeId, s, defer, projections, { onboarding: "defer" }))
    ).state;
    state = await store.commit(state.revision, stopRuntime(state, runtime.runtimeId, { reason: "evaluation_restart" }));
    runtime = startRuntime(await store.load(), s.principal, s.scope);
    state = await store.commit(state.revision, runtime.state);
    const work = await new OnboardingWorkStore(statePath).load();
    const second = record(
        "deferred_work_survives_restart",
        !!work && work.topics.every((topic) => topic.status === "deferred"),
        work?.topics.map((topic) => topic.status).join(",") ?? "missing",
    );
    const learn = s.episodes[1]!;
    state = (await runCognition(store, state, cognition(runtime.runtimeId, s, learn, projections, { memory: true })))
        .state;
    const meaning = state.meanings.find((item) => item.slot === "response-style");
    const source = meaning && state.evidence.find((item) => item.evidenceId === meaning.sourceEvidenceIds[0]);
    const third = record(
        "ordinary_memory_adoption",
        fault !== "direct_memory" &&
            !!meaning &&
            source?.sourceRole === "user_command" &&
            meaning.sourceEvidenceIds.length > 0,
        meaning ? `meaning=${meaning.meaningId}; source=${source?.sourceRole ?? "none"}` : "missing",
    );
    const close = s.episodes[2]!;
    state = (
        await runCognition(store, state, cognition(runtime.runtimeId, s, close, projections, { onboarding: "close" }))
    ).state;
    await store.releaseWriteLease(lease);

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
    const telegram = await runTelegramSetup(
        {
            setup: JSON.parse(await readFile(configPath, "utf8")),
            scope: s.scope,
            configPath: `${directory}/config/telegram.json`,
            tokenPath: `${directory}/secrets/telegram.token`,
            unitPath: `${directory}/systemd/ember-telegram.service`,
        },
        io,
        {
            secretPrompt: async () => SECRET,
            confirm: async () => true,
            read: async (path) => files.get(path) ?? null,
            write: async (path, value, mode) => {
                files.set(path, value);
                modes.set(path, mode);
            },
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
            command: async (file, args) => {
                commands.push(`${file} ${args.join(" ")}`);
                return { code: args.includes("is-active") || args.includes("is-enabled") ? 1 : 0, signal: null };
            },
            verificationCode: () => "256256",
            observeRoundTrip: async () => true,
            resolveExecutable: async (value) => value,
        },
    );
    const fifth = record(
        "telegram_round_trip",
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
    return [first, second, third, fourth, fifth, sixth];
}

async function restore(s: SetupOnboardingScenario, directory: string, fault?: OracleFault): Promise<AssertionRecord[]> {
    const statePath = `${directory}/restored/continuity.json`,
        configPath = `${directory}/new-host/setup.json`;
    const bundle = await establishedBundle(s, statePath);
    const before = await readFile(statePath, "utf8"),
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
    await import("node:fs/promises").then(({ writeFile }) => writeFile(`${statePath}.onboarding.json`, sidecarBefore));
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
            createOnboardingWork(bundle.lineage.lineageId, s.principal, s.scope, s.episodes[0]!.at),
        );
    const store = new StateStore(statePath),
        lease = await store.acquireWriteLease();
    let state = await store.load();
    const started = startRuntime(state, s.principal, s.scope);
    state = await store.commit(state.revision, started.state);
    state = (
        await runCognition(store, state, {
            runtimeId: started.runtimeId,
            principal: s.principal,
            scope: s.scope,
            text: s.episodes[0]!.input,
            providerLabel: "restore-fixture",
            provider: async (request) => {
                projections.push(request.projection);
                return {
                    contractVersion: 1,
                    reply: "continued",
                    usedMeaningIds: request.projection.selection.meaning_ids,
                };
            },
            timeoutSeconds: 1,
            output: () => {},
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
    const e = record(
        "old_host_state_excluded",
        !all.includes(OLD_PROVIDER) && !all.includes(OLD_CHAT) && !all.includes(OLD_SECRET),
        `old_provider=${all.includes(OLD_PROVIDER)}; old_chat=${all.includes(OLD_CHAT)}; old_secret=${all.includes(OLD_SECRET)}`,
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
    state = (
        await runCognition(store, state, {
            runtimeId: started.runtimeId,
            principal: s.principal,
            scope: s.scope,
            text: "I prefer concise replies.",
            providerLabel: "bundle-builder",
            provider: async () => ({ contractVersion: 1, reply: "remembered", usedMeaningIds: [] }),
            timeoutSeconds: 1,
            output: () => {},
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
        })
    ).state;
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
        provider: async (request: any) => {
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
                      updates: (["forms_of_address", "expectations", "optional_capabilities"] as const).map(
                          (topic) => ({
                              topic,
                              action:
                                  options.onboarding === "defer"
                                      ? ("defer" as const)
                                      : topic === "optional_capabilities"
                                        ? ("decline" as const)
                                        : ("resolve" as const),
                              basis: episode.input,
                          }),
                      ),
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
    return { assertion, expected: "", observed, passed };
}
function quietIo(): any {
    return { input: process.stdin, output: { write: () => true }, error: { write: () => true } };
}
function text(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
