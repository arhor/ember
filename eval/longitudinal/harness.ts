import { readFile } from "node:fs/promises";

import { initialState, validateState, type EmberState, type RuntimeId } from "../../src/core/model.ts";
import { inspectionView, type Projection } from "../../src/core/projection.ts";
import {
    attachDetail,
    rememberDelegatedReport,
    rememberDirectObservation,
    rememberEpisode,
    rememberExternalClaim,
    rememberFact,
    rememberInference,
    rememberPreference,
    rememberRelationship,
    supersede,
    undertake,
    withholdDetail,
} from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import type { ProviderRequest, ProviderResult } from "../../src/providers/contract.ts";
import { runCognition, startRuntime, stopRuntime } from "../../src/runtime/runtime.ts";

type ThreadControl = { mode: "fresh" } | { mode: "reuse"; episode: string };

export type MeaningReference = string | { group: string };

type StateAction =
    | { action: "remember_relationship"; as: string; scope: string; text: string; at: string }
    | { action: "remember_fact"; as: string; slot: string; scope: string; text: string; at: string }
    | {
          action: "remember_external_claim";
          as: string;
          source: string;
          slot: string;
          scope: string;
          text: string;
          at: string;
      }
    | { action: "remember_direct_observation"; as: string; slot: string; scope: string; text: string; at: string }
    | {
          action: "remember_delegated_report";
          as: string;
          delegate: string;
          slot: string;
          scope: string;
          text: string;
          derived_from: string[];
          at: string;
      }
    | {
          action: "remember_inference";
          as: string;
          slot: string;
          scope: string;
          text: string;
          derived_from: string[];
          at: string;
      }
    | { action: "remember_preference"; as: string; slot: string; scope: string; text: string; at: string }
    | { action: "undertake"; as: string; slot: string; scope: string; text: string; at: string }
    | { action: "remember_episode"; as: string; slot: string; scope: string; text: string; at: string }
    | { action: "attach_detail"; as: string; episode: string; text: string; at: string }
    | { action: "supersede"; as: string; meaning: string; text: string; reason?: string; at: string }
    | { action: "withhold_detail"; as: string; evidence: string; reason: string; at: string };

interface FactSeriesGenerator {
    generate: "remember_fact_series";
    as: string;
    count: number;
    slot_prefix: string;
    scope: string;
    text_prefix: string;
    start_at: string;
    interval_seconds: number;
}

type HistoryGenerator = FactSeriesGenerator;

interface MeaningExpectations {
    selected_meanings: string[];
    selected_meaning_groups?: string[];
    forbidden_meanings: string[];
    forbidden_meaning_groups?: string[];
    relevant_meanings?: MeaningReference[];
    irrelevant_meanings?: MeaningReference[];
    superseded_meanings?: MeaningReference[];
    unavailable_meanings?: MeaningReference[];
    reply_includes?: string[];
    reply_excludes?: string[];
}

export interface LongitudinalScenario {
    scenario_version: 1;
    id: string;
    description: string;
    ember: { name: string; principal: string; initial_at: string };
    history?: HistoryGenerator[];
    setup: StateAction[];
    backend_replacement?: {
        status: "same_backend_control" | "cross_provider";
        control_episode: string;
        replacement_episode: string;
    };
    episodes: Array<{
        id: string;
        at: string;
        scope: string;
        cognition_backend: string;
        restart_ember: boolean;
        external_thread: ThreadControl;
        changes?: StateAction[];
        input: string;
        purpose?: "ordinary" | "explain";
        explain?: string[];
        expect: MeaningExpectations;
    }>;
}

export interface HarnessProviderInvocation {
    scenarioId: string;
    episodeId: string;
    cognitionBackend: string;
    thread: { mode: "fresh" } | { mode: "reuse"; externalThreadId: string; sourceEpisode: string };
    request: ProviderRequest;
}

export interface BackendMetadata {
    backend: string;
    adapter: string;
    version: string;
    configuration: Record<string, string | number | boolean | null>;
}

export interface HarnessProviderOutput {
    result: ProviderResult;
    backend_metadata: BackendMetadata;
}

export type HarnessProvider = (invocation: HarnessProviderInvocation) => Promise<HarnessProviderOutput>;

interface AssertionObservation {
    assertion: string;
    passed: boolean;
    expected: unknown;
    observed: unknown;
}

interface ContextEvaluation {
    declared: {
        relevant: string[];
        irrelevant: string[];
        superseded: string[];
        unavailable: string[];
        forbidden: string[];
    };
    selected_meanings: string[];
    omission_candidates: {
        relevant_not_selected: string[];
    };
    inclusion_candidates: {
        irrelevant_selected: string[];
        superseded_selected: string[];
        forbidden_selected: string[];
    };
    degradation_signals: {
        unavailable_selected: string[];
        unavailable_with_projection_gap: string[];
    };
}

export interface LongitudinalReport {
    report_version: 1;
    scenario_id: string;
    description: string;
    lineage_id: string;
    history: {
        generated_action_count: number;
        groups: Record<string, string[]>;
    };
    ember_assertions_passed: boolean;
    model_observations_passed: boolean;
    episodes: Array<{
        episode_id: string;
        runtime_id: string;
        cognition_backend: string;
        backend_metadata: BackendMetadata;
        external_thread: HarnessProviderInvocation["thread"];
        provider_thread_id: string | null;
        canonical_before: ReturnType<typeof inspectionView>;
        projection: Projection;
        context_evaluation: ContextEvaluation;
        provider_result: ProviderResult;
        canonical_after: ReturnType<typeof inspectionView>;
        ember_assertions: AssertionObservation[];
        model_observations: AssertionObservation[];
    }>;
}

interface ExpandedHistory {
    actions: StateAction[];
    groups: Map<string, string[]>;
}

interface ResolvedReferences {
    aliases: string[];
    ids: string[];
}

export async function loadLongitudinalScenario(path: string): Promise<LongitudinalScenario> {
    const candidate: unknown = JSON.parse(await readFile(path, "utf8"));
    validateScenario(candidate);
    return candidate;
}

export async function runLongitudinalScenario(
    scenario: LongitudinalScenario,
    statePath: string,
    provider: HarnessProvider,
): Promise<LongitudinalReport> {
    validateScenario(scenario);
    const history = expandHistory(scenario.history ?? []);
    const aliases = new Map<string, string>();
    let state = initialState(scenario.ember.name, scenario.ember.principal, scenario.ember.initial_at);
    applyActions(state, history.actions, scenario.ember.principal, aliases);
    applyActions(state, scenario.setup, scenario.ember.principal, aliases);
    const store = new StateStore(statePath);
    await store.create(state);
    const lease = await store.acquireWriteLease();
    const episodeThreads = new Map<string, string>();
    const reports: LongitudinalReport["episodes"] = [];
    let runtimeId: string | null = null;
    try {
        for (const episode of scenario.episodes) {
            state = await store.load();
            if (episode.changes?.length) {
                const changed = structuredClone(state);
                applyActions(changed, episode.changes, scenario.ember.principal, aliases);
                state = await store.commit(state.revision, changed);
            }
            if (runtimeId === null || episode.restart_ember) {
                if (runtimeId !== null) {
                    state = await withFixedTime(episode.at, () =>
                        stopRuntime(state, runtimeId!, { reason: `longitudinal_restart_before:${episode.id}` }),
                    );
                    state = await store.commit((await store.load()).revision, state);
                }
                const started = await withFixedTime(episode.at, () =>
                    startRuntime(state, scenario.ember.principal, episode.scope),
                );
                state = await store.commit(state.revision, started.state);
                runtimeId = started.runtimeId;
            }
            const canonicalBefore = inspectionView(state);
            const thread = resolveThread(episode.external_thread, episodeThreads);
            const previouslyObservedThreadIds = new Set(episodeThreads.values());
            let observedRequest: ProviderRequest | null = null;
            let observedResult: ProviderResult | null = null;
            let observedBackendMetadata: BackendMetadata | null = null;
            let reply = "";
            const result = await withFixedTime(episode.at, () =>
                runCognition(store, state, {
                    runtimeId: runtimeId as RuntimeId,
                    principal: scenario.ember.principal,
                    scope: episode.scope,
                    text: episode.input,
                    command: "longitudinal-provider",
                    timeoutSeconds: 300,
                    purpose: episode.purpose ?? "ordinary",
                    explainIds: (episode.explain ?? []).map((alias) => requireAlias(aliases, alias)),
                    provider: async (_command, _arguments, request) => {
                        observedRequest = request;
                        const output = await provider({
                            scenarioId: scenario.id,
                            episodeId: episode.id,
                            cognitionBackend: episode.cognition_backend,
                            thread,
                            request,
                        });
                        validateBackendMetadata(output.backend_metadata, episode.cognition_backend);
                        observedBackendMetadata = output.backend_metadata;
                        observedResult = output.result;
                        return output.result;
                    },
                    output: (text) => {
                        reply += text;
                    },
                }),
            );
            if (
                result.providerFailure !== null ||
                observedRequest === null ||
                observedResult === null ||
                observedBackendMetadata === null
            ) {
                throw new Error(
                    `episode ${episode.id} provider failed: ${result.providerFailure ?? "no provider evidence"}`,
                );
            }
            state = result.state;
            const providerResult = observedResult as ProviderResult;
            const request = observedRequest as ProviderRequest;
            const backendMetadata = observedBackendMetadata as BackendMetadata;
            const providerThreadId = providerResult.operational?.external_thread_id ?? null;
            if (providerThreadId !== null) episodeThreads.set(episode.id, providerThreadId);
            const expectedSelected = resolveReferences(
                expectationReferences(episode.expect.selected_meanings, episode.expect.selected_meaning_groups),
                aliases,
                history.groups,
            ).ids.sort();
            const observedSelected = request.projection.selection.meaning_ids.map(String).sort();
            const forbidden = resolveReferences(
                expectationReferences(episode.expect.forbidden_meanings, episode.expect.forbidden_meaning_groups),
                aliases,
                history.groups,
            );
            const forbiddenIds = forbidden.ids;
            const contextEvaluation = evaluateContext(episode.expect, aliases, history.groups, request.projection);
            const emberAssertions: AssertionObservation[] = [
                observation(
                    "selected meanings",
                    expectedSelected,
                    observedSelected,
                    sameJson(expectedSelected, observedSelected),
                ),
                observation(
                    "forbidden meanings absent",
                    [],
                    forbiddenIds.filter((id) => observedSelected.includes(id)),
                    forbiddenIds.every((id) => !observedSelected.includes(id)),
                ),
                observation(
                    "lineage remains canonical",
                    canonicalBefore.lineage.lineage_id,
                    request.projection.lineage.lineage_id,
                    canonicalBefore.lineage.lineage_id === request.projection.lineage.lineage_id,
                ),
                observation(
                    "raw transcript excluded",
                    false,
                    request.projection.selection.raw_transcript_included,
                    request.projection.selection.raw_transcript_included === false,
                ),
                observation(
                    "backend routing is truthful",
                    episode.cognition_backend,
                    backendMetadata.backend,
                    backendMetadata.backend === episode.cognition_backend,
                ),
            ];
            appendClassificationAssertions(emberAssertions, episode.expect, aliases, history.groups, canonicalBefore);
            if (thread.mode === "fresh") {
                emberAssertions.push(
                    observation(
                        "fresh provider thread observed",
                        "non-null thread id",
                        providerThreadId,
                        providerThreadId !== null,
                    ),
                    observation(
                        "fresh provider thread is new",
                        "thread id absent from earlier episodes",
                        providerThreadId,
                        providerThreadId !== null && !previouslyObservedThreadIds.has(providerThreadId),
                    ),
                );
            }
            if (episode.restart_ember && reports.length > 0) {
                emberAssertions.push(
                    observation(
                        "Ember runtime restarted",
                        "different runtime id",
                        runtimeId,
                        reports.at(-1)!.runtime_id !== runtimeId,
                    ),
                );
            }
            if (thread.mode === "reuse") {
                emberAssertions.push(
                    observation(
                        "provider thread explicitly reused",
                        thread.externalThreadId,
                        providerThreadId,
                        providerThreadId === thread.externalThreadId,
                    ),
                );
            }
            const modelObservations = [
                ...(episode.expect.reply_includes ?? []).map((text) =>
                    observation(
                        `reply includes ${JSON.stringify(text)}`,
                        true,
                        reply.includes(text),
                        reply.includes(text),
                    ),
                ),
                ...(episode.expect.reply_excludes ?? []).map((text) =>
                    observation(
                        `reply excludes ${JSON.stringify(text)}`,
                        false,
                        reply.includes(text),
                        !reply.includes(text),
                    ),
                ),
            ];
            reports.push({
                episode_id: episode.id,
                runtime_id: runtimeId,
                cognition_backend: episode.cognition_backend,
                backend_metadata: backendMetadata,
                external_thread: thread,
                provider_thread_id: providerThreadId,
                canonical_before: canonicalBefore,
                projection: request.projection,
                context_evaluation: contextEvaluation,
                provider_result: providerResult,
                canonical_after: inspectionView(state),
                ember_assertions: emberAssertions,
                model_observations: modelObservations,
            });
        }
        applyReplacementAssertions(scenario, reports);
    } finally {
        await store.releaseWriteLease(lease);
    }
    return {
        report_version: 1,
        scenario_id: scenario.id,
        description: scenario.description,
        lineage_id: state.lineage.lineage_id,
        history: {
            generated_action_count: history.actions.length,
            groups: Object.fromEntries(history.groups),
        },
        ember_assertions_passed: reports.every((report) => report.ember_assertions.every((item) => item.passed)),
        model_observations_passed: reports.every((report) => report.model_observations.every((item) => item.passed)),
        episodes: reports,
    };
}

function expandHistory(generators: HistoryGenerator[]): ExpandedHistory {
    const actions: StateAction[] = [];
    const groups = new Map<string, string[]>();
    for (const generator of generators) {
        const aliases: string[] = [];
        const start = Date.parse(generator.start_at);
        for (let index = 0; index < generator.count; index += 1) {
            const ordinal = String(index + 1).padStart(4, "0");
            const alias = `${generator.as}.${ordinal}`;
            aliases.push(alias);
            actions.push({
                action: "remember_fact",
                as: alias,
                slot: `${generator.slot_prefix}-${ordinal}`,
                scope: generator.scope,
                text: `${generator.text_prefix} ${ordinal}`,
                at: new Date(start + index * generator.interval_seconds * 1000).toISOString(),
            });
        }
        groups.set(generator.as, aliases);
    }
    return { actions, groups };
}

function applyActions(state: EmberState, actions: StateAction[], principal: string, aliases: Map<string, string>) {
    for (const item of actions) {
        if (aliases.has(item.as)) throw new Error(`duplicate scenario alias: ${item.as}`);
        const id = withFixedTimeSync(item.at, () => {
            switch (item.action) {
                case "remember_relationship":
                    return rememberRelationship(state, principal, `relationship:${principal}`, item.scope, item.text);
                case "remember_fact":
                    return rememberFact(state, principal, `user:${principal}`, item.slot, item.scope, item.text);
                case "remember_external_claim":
                    return rememberExternalClaim(state, principal, item.source, item.slot, item.scope, item.text);
                case "remember_direct_observation":
                    return rememberDirectObservation(state, principal, item.slot, item.scope, item.text);
                case "remember_delegated_report":
                    return rememberDelegatedReport(
                        state,
                        principal,
                        item.delegate,
                        item.slot,
                        item.scope,
                        item.text,
                        resolveEvidenceAliases(state, aliases, item.derived_from),
                    );
                case "remember_inference":
                    return rememberInference(
                        state,
                        principal,
                        item.slot,
                        item.scope,
                        item.text,
                        resolveEvidenceAliases(state, aliases, item.derived_from),
                    );
                case "remember_preference":
                    return rememberPreference(state, principal, `user:${principal}`, item.slot, item.scope, item.text);
                case "undertake":
                    return undertake(state, principal, item.slot, item.scope, item.text);
                case "remember_episode":
                    return rememberEpisode(
                        state,
                        principal,
                        item.slot,
                        `relationship:${principal}`,
                        item.scope,
                        item.text,
                    );
                case "attach_detail":
                    return attachDetail(state, principal, requireAlias(aliases, item.episode), item.text);
                case "supersede":
                    return supersede(state, principal, requireAlias(aliases, item.meaning), item.text, {
                        reason: item.reason,
                    });
                case "withhold_detail":
                    return withholdDetail(state, principal, requireAlias(aliases, item.evidence), {
                        reason: item.reason,
                    });
            }
        });
        aliases.set(item.as, id);
    }
    validateState(state);
}

function resolveEvidenceAliases(state: EmberState, aliases: Map<string, string>, references: string[]): string[] {
    if (!Array.isArray(references)) throw new Error("provenance derivation references must be an array");
    const ids = references.flatMap((alias) => {
        const id = requireAlias(aliases, alias);
        if (id.startsWith("evidence-")) return [id];
        const meaning = state.meanings.find((item) => String(item.meaning_id) === id);
        if (!meaning) throw new Error(`provenance derivation alias does not resolve to meaning or evidence: ${alias}`);
        return meaning.source_evidence_ids.map(String);
    });
    return [...new Set(ids)];
}

function evaluateContext(
    expectations: MeaningExpectations,
    aliases: Map<string, string>,
    groups: Map<string, string[]>,
    projection: Projection,
): ContextEvaluation {
    const relevant = resolveReferences(expectations.relevant_meanings ?? [], aliases, groups);
    const irrelevant = resolveReferences(expectations.irrelevant_meanings ?? [], aliases, groups);
    const superseded = resolveReferences(expectations.superseded_meanings ?? [], aliases, groups);
    const unavailable = resolveReferences(expectations.unavailable_meanings ?? [], aliases, groups);
    const forbidden = resolveReferences(
        expectationReferences(expectations.forbidden_meanings, expectations.forbidden_meaning_groups),
        aliases,
        groups,
    );
    const selectedIds = new Set(projection.selection.meaning_ids.map(String));
    const projectionGapIds = new Set(projection.gaps.map((item) => String(item.meaning_id)));
    const aliasById = new Map([...aliases].map(([alias, id]) => [id, alias]));

    return {
        declared: {
            relevant: relevant.aliases,
            irrelevant: irrelevant.aliases,
            superseded: superseded.aliases,
            unavailable: unavailable.aliases,
            forbidden: forbidden.aliases,
        },
        selected_meanings: projection.selection.meaning_ids.map((id) => aliasById.get(String(id)) ?? String(id)),
        omission_candidates: {
            relevant_not_selected: filterAliases(relevant, (id) => !selectedIds.has(id)),
        },
        inclusion_candidates: {
            irrelevant_selected: filterAliases(irrelevant, (id) => selectedIds.has(id)),
            superseded_selected: filterAliases(superseded, (id) => selectedIds.has(id)),
            forbidden_selected: filterAliases(forbidden, (id) => selectedIds.has(id)),
        },
        degradation_signals: {
            unavailable_selected: filterAliases(unavailable, (id) => selectedIds.has(id)),
            unavailable_with_projection_gap: filterAliases(unavailable, (id) => projectionGapIds.has(id)),
        },
    };
}

function appendClassificationAssertions(
    assertions: AssertionObservation[],
    expectations: MeaningExpectations,
    aliases: Map<string, string>,
    groups: Map<string, string[]>,
    canonicalBefore: ReturnType<typeof inspectionView>,
) {
    if (expectations.superseded_meanings) {
        const declared = resolveReferences(expectations.superseded_meanings, aliases, groups);
        const supersededIds = new Set(
            canonicalBefore.historical_meanings
                .filter((item) => item.currentness === "superseded")
                .map((item) => String(item.meaning_id)),
        );
        const observed = filterAliases(declared, (id) => supersededIds.has(id));
        assertions.push(
            observation(
                "declared superseded meanings are superseded",
                declared.aliases,
                observed,
                sameJson(declared.aliases, observed),
            ),
        );
    }
    if (expectations.unavailable_meanings) {
        const declared = resolveReferences(expectations.unavailable_meanings, aliases, groups);
        const unavailableIds = new Set(canonicalBefore.gaps.map((item) => String(item.meaning_id)));
        const observed = filterAliases(declared, (id) => unavailableIds.has(id));
        assertions.push(
            observation(
                "declared unavailable meanings have unavailable evidence",
                declared.aliases,
                observed,
                sameJson(declared.aliases, observed),
            ),
        );
    }
}

function filterAliases(references: ResolvedReferences, include: (id: string) => boolean) {
    return references.aliases.filter((_, index) => include(references.ids[index]!));
}

function expectationReferences(aliases: string[], groupNames: string[] | undefined): MeaningReference[] {
    return [...aliases, ...(groupNames ?? []).map((group) => ({ group }))];
}

function resolveReferences(
    references: MeaningReference[],
    aliases: Map<string, string>,
    groups: Map<string, string[]>,
): ResolvedReferences {
    const expanded = references.flatMap((reference) => {
        if (typeof reference === "string") return [reference];
        const members = groups.get(reference.group);
        if (!members) throw new Error(`unknown scenario meaning group: ${reference.group}`);
        return members;
    });
    const uniqueAliases = [...new Set(expanded)];
    return { aliases: uniqueAliases, ids: uniqueAliases.map((alias) => requireAlias(aliases, alias)) };
}

function resolveThread(control: ThreadControl, threads: Map<string, string>): HarnessProviderInvocation["thread"] {
    if (control.mode === "fresh") return control;
    const externalThreadId = threads.get(control.episode);
    if (externalThreadId === undefined)
        throw new Error(`cannot reuse absent provider thread from episode: ${control.episode}`);
    return { mode: "reuse", externalThreadId, sourceEpisode: control.episode };
}

function requireAlias(aliases: Map<string, string>, alias: string): string {
    const id = aliases.get(alias);
    if (id === undefined) throw new Error(`unknown scenario alias: ${alias}`);
    return id;
}

function observation(assertion: string, expected: unknown, observed: unknown, passed: boolean): AssertionObservation {
    return { assertion, expected, observed, passed };
}

function sameJson(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function applyReplacementAssertions(scenario: LongitudinalScenario, reports: LongitudinalReport["episodes"]) {
    const comparison = scenario.backend_replacement;
    if (!comparison) return;
    const control = reports.find((item) => item.episode_id === comparison.control_episode)!;
    const replacement = reports.find((item) => item.episode_id === comparison.replacement_episode)!;
    const controlDurable = durableContinuityView(control.canonical_before);
    const replacementDurable = durableContinuityView(replacement.canonical_before);
    replacement.ember_assertions.push(
        observation(
            "replacement preserves lineage and durable meaning",
            controlDurable,
            replacementDurable,
            sameJson(controlDurable, replacementDurable),
        ),
        observation(
            "replacement receives the same selected meanings",
            control.projection.selection.meaning_ids,
            replacement.projection.selection.meaning_ids,
            sameJson(control.projection.selection.meaning_ids, replacement.projection.selection.meaning_ids),
        ),
        observation(
            comparison.status === "cross_provider"
                ? "replacement uses a different backend"
                : "fresh-thread control uses the same backend",
            comparison.status === "cross_provider" ? "different backend" : control.cognition_backend,
            replacement.cognition_backend,
            comparison.status === "cross_provider"
                ? control.cognition_backend !== replacement.cognition_backend
                : control.cognition_backend === replacement.cognition_backend,
        ),
    );
}

function durableContinuityView(view: ReturnType<typeof inspectionView>) {
    return {
        lineage: view.lineage,
        current_meanings: view.current_meanings,
        historical_meanings: view.historical_meanings,
        live_commitments: view.live_commitments,
        gaps: view.gaps,
    };
}

function validateBackendMetadata(value: BackendMetadata, expectedBackend: string) {
    if (!value || typeof value !== "object" || value.backend !== expectedBackend)
        throw new Error(`backend metadata must identify selected backend: ${expectedBackend}`);
    if (
        typeof value.adapter !== "string" ||
        !value.adapter.trim() ||
        typeof value.version !== "string" ||
        !value.version.trim()
    )
        throw new Error("backend metadata adapter and version must be non-empty");
    if (!value.configuration || typeof value.configuration !== "object" || Array.isArray(value.configuration))
        throw new Error("backend metadata configuration must be an object");
    if (
        Object.keys(value.configuration).some((key) =>
            /(?:thread|session|conversation).*id|(?:thread|session|conversation)_id/i.test(key),
        )
    )
        throw new Error("backend metadata configuration must not contain runtime session identifiers");
    if (
        Object.values(value.configuration).some(
            (item) => item !== null && !["string", "number", "boolean"].includes(typeof item),
        )
    )
        throw new Error("backend metadata configuration values must be scalar");
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > 16 * 1024)
        throw new Error("backend metadata exceeds 16 KiB");
}

function withFixedTimeSync<T>(timestamp: string, action: () => T): T {
    const previous = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = timestamp;
    try {
        return action();
    } finally {
        if (previous === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previous;
    }
}

async function withFixedTime<T>(timestamp: string, action: () => T | Promise<T>): Promise<T> {
    const previous = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = timestamp;
    try {
        return await action();
    } finally {
        if (previous === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previous;
    }
}

function validateScenario(value: unknown): asserts value is LongitudinalScenario {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error("longitudinal scenario must be an object");
    const scenario = value as Partial<LongitudinalScenario>;
    if (
        scenario.scenario_version !== 1 ||
        typeof scenario.id !== "string" ||
        !scenario.id.trim() ||
        typeof scenario.description !== "string"
    )
        throw new Error("longitudinal scenario header is invalid");
    if (
        !scenario.ember ||
        typeof scenario.ember.name !== "string" ||
        typeof scenario.ember.principal !== "string" ||
        typeof scenario.ember.initial_at !== "string"
    )
        throw new Error("longitudinal scenario Ember identity is invalid");
    if (!Array.isArray(scenario.setup) || !Array.isArray(scenario.episodes) || scenario.episodes.length < 2)
        throw new Error("longitudinal scenario requires setup and at least two episodes");
    if (scenario.history !== undefined && !Array.isArray(scenario.history))
        throw new Error("longitudinal scenario history must be an array");
    const aliases = new Set<string>();
    const historyGroups = new Set<string>();
    for (const generator of scenario.history ?? []) {
        validateHistoryGenerator(generator, aliases, historyGroups);
    }
    const episodeIds = new Set<string>();
    for (const action of [...scenario.setup, ...scenario.episodes.flatMap((episode) => episode.changes ?? [])]) {
        if (
            !action ||
            typeof action !== "object" ||
            typeof action.action !== "string" ||
            typeof action.as !== "string" ||
            typeof action.at !== "string"
        )
            throw new Error("longitudinal scenario action is invalid");
        if (aliases.has(action.as)) throw new Error(`duplicate scenario alias: ${action.as}`);
        aliases.add(action.as);
    }
    for (const episode of scenario.episodes) {
        if (
            !episode ||
            typeof episode.id !== "string" ||
            episodeIds.has(episode.id) ||
            typeof episode.at !== "string" ||
            typeof episode.scope !== "string" ||
            typeof episode.cognition_backend !== "string" ||
            !episode.cognition_backend.trim() ||
            typeof episode.restart_ember !== "boolean" ||
            typeof episode.input !== "string"
        )
            throw new Error("longitudinal episode is invalid");
        episodeIds.add(episode.id);
        if (!episode.external_thread || !["fresh", "reuse"].includes(episode.external_thread.mode))
            throw new Error(`episode ${episode.id} thread control is invalid`);
        if (episode.external_thread.mode === "reuse" && !episodeIds.has(episode.external_thread.episode))
            throw new Error(`episode ${episode.id} must reuse an earlier episode`);
        if (
            !episode.expect ||
            !Array.isArray(episode.expect.selected_meanings) ||
            !Array.isArray(episode.expect.forbidden_meanings)
        )
            throw new Error(`episode ${episode.id} expectations are invalid`);
        for (const field of ["selected_meanings", "forbidden_meanings"] as const) {
            if (episode.expect[field].some((alias) => typeof alias !== "string" || !alias.trim()))
                throw new Error(`episode ${episode.id} ${field} must contain non-empty aliases`);
        }
        for (const field of ["selected_meaning_groups", "forbidden_meaning_groups"] as const) {
            const groupNames = episode.expect[field];
            if (groupNames === undefined) continue;
            if (
                !Array.isArray(groupNames) ||
                groupNames.some((group) => typeof group !== "string" || !group.trim() || !historyGroups.has(group))
            )
                throw new Error(`episode ${episode.id} ${field} contains an invalid history group`);
        }
        for (const field of [
            "relevant_meanings",
            "irrelevant_meanings",
            "superseded_meanings",
            "unavailable_meanings",
        ] as const) {
            const references = episode.expect[field];
            if (references === undefined) continue;
            if (!Array.isArray(references)) throw new Error(`episode ${episode.id} ${field} must be an array`);
            for (const reference of references) validateMeaningReference(reference, historyGroups, episode.id, field);
        }
    }
    if (scenario.backend_replacement) {
        const comparison = scenario.backend_replacement;
        if (!["same_backend_control", "cross_provider"].includes(comparison.status))
            throw new Error("backend replacement comparison is invalid");
        const controlIndex = scenario.episodes.findIndex((item) => item.id === comparison.control_episode);
        const replacementIndex = scenario.episodes.findIndex((item) => item.id === comparison.replacement_episode);
        if (controlIndex < 0 || replacementIndex <= controlIndex)
            throw new Error("backend replacement must compare an earlier control with a later replacement episode");
        const control = scenario.episodes[controlIndex]!;
        const replacement = scenario.episodes[replacementIndex]!;
        if (control.external_thread.mode !== "fresh" || replacement.external_thread.mode !== "fresh")
            throw new Error("backend replacement comparison requires fresh external threads");
        if (replacement.changes?.length)
            throw new Error("backend replacement episode must not change canonical meaning before comparison");
        if (comparison.status === "same_backend_control" && control.cognition_backend !== replacement.cognition_backend)
            throw new Error("same-backend control must use one cognition backend");
        if (comparison.status === "cross_provider" && control.cognition_backend === replacement.cognition_backend)
            throw new Error("cross-provider comparison must use different cognition backends");
    }
}

function validateHistoryGenerator(value: unknown, aliases: Set<string>, groups: Set<string>) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("longitudinal history generator is invalid");
    const generator = value as Partial<HistoryGenerator>;
    if (generator.generate !== "remember_fact_series" || typeof generator.as !== "string" || !generator.as.trim())
        throw new Error("longitudinal history generator header is invalid");
    if (groups.has(generator.as)) throw new Error(`duplicate longitudinal history group: ${generator.as}`);
    if (!Number.isInteger(generator.count) || generator.count! < 1 || generator.count! > 5_000)
        throw new Error("longitudinal history generator count must be an integer from 1 to 5000");
    if (
        ![generator.slot_prefix, generator.scope, generator.text_prefix, generator.start_at].every(
            (item) => typeof item === "string" && item.trim(),
        )
    )
        throw new Error("longitudinal history generator text fields must be non-empty");
    if (!Number.isInteger(generator.interval_seconds) || generator.interval_seconds! < 1)
        throw new Error("longitudinal history generator interval_seconds must be a positive integer");
    const start = Date.parse(generator.start_at!);
    const last = start + (generator.count! - 1) * generator.interval_seconds! * 1000;
    if (!Number.isFinite(start) || !Number.isFinite(last) || Number.isNaN(new Date(last).getTime()))
        throw new Error("longitudinal history generator timestamps must stay within the supported date range");
    groups.add(generator.as);
    for (let index = 0; index < generator.count!; index += 1) {
        const alias = `${generator.as}.${String(index + 1).padStart(4, "0")}`;
        if (aliases.has(alias)) throw new Error(`duplicate scenario alias: ${alias}`);
        aliases.add(alias);
    }
}

function validateMeaningReference(reference: unknown, groups: Set<string>, episodeId: string, field: string) {
    if (typeof reference === "string" && reference.trim()) return;
    if (reference && typeof reference === "object" && !Array.isArray(reference)) {
        const keys = Object.keys(reference);
        const group = (reference as { group?: unknown }).group;
        if (keys.length === 1 && typeof group === "string" && group.trim() && groups.has(group)) return;
    }
    throw new Error(`episode ${episodeId} ${field} contains an invalid meaning reference`);
}
