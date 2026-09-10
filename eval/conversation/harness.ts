import { readFile } from "node:fs/promises";

import type { MeaningId, RuntimeId } from "../../src/core/model.ts";
import type { Projection } from "../../src/core/projection.ts";
import type { ProviderResult } from "../../src/providers/contract.ts";

import { ProviderError, ValidationError } from "../../src/core/errors.ts";
import { initialState, isRfc3339Utc } from "../../src/core/model.ts";
import { rememberFact } from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { runCognition, startRuntime, stopRuntime } from "../../src/runtime/runtime.ts";
import { exactKeys, isObject } from "../../src/util.ts";

export interface ConversationEpisode {
    id: string;
    at: string;
    surface: string;
    input: string;
    restart?: boolean;
    fresh_conversation?: boolean;
    provider_outcome?: "failed" | "outcome_unknown";
    delivery_outcome?: "displayed" | "uncertain";
    scripted_reply?: string;
    expect: {
        selected_turns?: string[];
        excluded_turns?: string[];
        selected_meanings?: string[];
        reply_includes?: string[];
        reference_resolution?: { reply_includes: string[] };
    };
}

export interface ConversationScenario {
    scenario_version: 1;
    id: string;
    description: string;
    ember: { name: string; principal: string; scope: string; initial_at: string };
    meanings: Array<{ as: string; slot: string; text: string }>;
    episodes: ConversationEpisode[];
}

export interface ConversationProviderInvocation {
    scenarioId: string;
    episode: ConversationEpisode;
    projection: Projection;
}

export type ConversationProvider = (invocation: ConversationProviderInvocation) => Promise<ProviderResult>;

export interface ConversationProviderControl {
    invocation_mode: "fresh";
    external_thread_identity: "optional" | "required";
}

export async function loadConversationScenario(path: string): Promise<ConversationScenario> {
    const candidate: unknown = JSON.parse(await readFile(path, "utf8"));
    validateScenario(candidate);
    return candidate;
}

export async function runConversationScenario(
    scenario: ConversationScenario,
    statePath: string,
    provider: ConversationProvider,
    providerControl: ConversationProviderControl,
) {
    validateScenario(scenario);
    validateProviderControl(providerControl);
    const state = initialState(scenario.ember.name, scenario.ember.principal, scenario.ember.initial_at);
    const meaningIds = new Map<string, MeaningId>();
    withFixedTime(scenario.ember.initial_at, () => {
        for (const meaning of scenario.meanings) {
            meaningIds.set(
                meaning.as,
                rememberFact(
                    state,
                    scenario.ember.principal,
                    `user:${scenario.ember.principal}`,
                    meaning.slot,
                    scenario.ember.scope,
                    meaning.text,
                ),
            );
        }
    });
    const store = new StateStore(statePath);
    await store.create(state);
    const lease = await store.acquireWriteLease();
    const episodes = [];
    let currentState = state;
    let runtimeId: RuntimeId | null = null;
    const previousNow = process.env.EMBER_TEST_NOW;
    const providerThreadIds = new Set<string>();
    try {
        for (const episode of scenario.episodes) {
            process.env.EMBER_TEST_NOW = episode.at;
            if (runtimeId === null || episode.restart) {
                if (runtimeId !== null) {
                    currentState = stopRuntime(currentState, runtimeId, { reason: `conversation_eval:${episode.id}` });
                    currentState = await store.commit((await store.load()).revision, currentState);
                }
                currentState = await store.load();
                const started = startRuntime(currentState, scenario.ember.principal, scenario.ember.scope);
                currentState = await store.commit(currentState.revision, started.state);
                runtimeId = started.runtimeId;
            }

            let projection: Projection | null = null;
            let reply: string | null = null;
            let providerFailure: string | null = null;
            let deliveryOutcome: "not_attempted" | "displayed" | "uncertain" = "not_attempted";
            let providerThreadId: string | null = null;
            const injectedDeliveryUncertainty = new Error(`fixture delivery uncertain: ${episode.id}`);
            try {
                const result = await runCognition(store, currentState, {
                    runtimeId: runtimeId!,
                    principal: scenario.ember.principal,
                    scope: scenario.ember.scope,
                    surface: episode.surface,
                    text: episode.input,
                    providerLabel: "conversation-evaluation-provider",
                    timeoutSeconds: 300,
                    conversationMembership: episode.fresh_conversation
                        ? { action: "fresh", basis: "explicit_boundary" }
                        : { action: "continue", basis: "ordinary_adjacency" },
                    provider: async (request) => {
                        projection = request.projection;
                        if (episode.provider_outcome) {
                            throw new ProviderError(`fixture ${episode.provider_outcome}`, {
                                outcome: episode.provider_outcome,
                                terminationConfirmed: episode.provider_outcome === "failed",
                            });
                        }
                        const result = await provider({
                            scenarioId: scenario.id,
                            episode,
                            projection: request.projection,
                        });
                        reply = result.reply;
                        providerThreadId = result.operational?.externalThreadId ?? null;
                        return result;
                    },
                    output: () => {
                        if (episode.delivery_outcome === "uncertain") throw injectedDeliveryUncertainty;
                    },
                });
                currentState = result.state;
                providerFailure = result.providerFailure;
                if (result.providerFailure === null) deliveryOutcome = "displayed";
            } catch (error) {
                if (error !== injectedDeliveryUncertainty) throw error;
                currentState = await store.load();
                deliveryOutcome = "uncertain";
            }
            if (projection === null) throw new Error(`episode ${episode.id} did not expose a projection`);

            const evaluatedProjection = projection as unknown as Projection;
            const context = evaluatedProjection.conversation_context!;
            const selectedContents = context.turns.map((turn) => turn.content);
            const expectedMeaningIds = (episode.expect.selected_meanings ?? []).map((alias) => {
                const id = meaningIds.get(alias);
                if (!id) throw new ValidationError(`unknown meaning alias: ${alias}`);
                return id;
            });
            const selectedTurnMatches = (episode.expect.selected_turns ?? []).map((text) => ({
                text,
                passed: selectedContents.some((content) => content.includes(text)),
            }));
            const irrelevantTurnMatches = (episode.expect.excluded_turns ?? []).filter((text) =>
                selectedContents.some((content) => content.includes(text)),
            );
            const replyMatches = (episode.expect.reply_includes ?? []).map((text) => ({
                text,
                passed: reply?.includes(text) ?? false,
            }));
            const referenceMatches = (episode.expect.reference_resolution?.reply_includes ?? []).map((text) => ({
                text,
                passed: reply?.includes(text) ?? false,
            }));
            const externalThreadIdentityObservation =
                providerThreadId === null
                    ? "not_exposed"
                    : providerThreadIds.has(providerThreadId)
                      ? "reused"
                      : "fresh";
            if (providerThreadId !== null) providerThreadIds.add(providerThreadId);
            const providerObservationsPassed =
                reply === null ||
                providerControl.external_thread_identity === "optional" ||
                externalThreadIdentityObservation === "fresh";
            const selectedCanonical = evaluatedProjection.selection.meaning_ids.map(String);
            const assertions = [
                ...selectedTurnMatches.map((item) => item.passed),
                irrelevantTurnMatches.length === 0,
                expectedMeaningIds.every((id) => selectedCanonical.includes(id)),
            ];
            episodes.push({
                id: episode.id,
                surface: episode.surface,
                restart: episode.restart ?? false,
                conversation_id: context.conversation_id,
                provider_failure: providerFailure,
                delivery_outcome: deliveryOutcome,
                provider_invocation_mode: providerControl.invocation_mode,
                provider_thread_id: providerThreadId,
                external_thread_identity_observation: externalThreadIdentityObservation,
                reply,
                successful_reference_resolution:
                    referenceMatches.length === 0 ? null : referenceMatches.every((item) => item.passed),
                reply_observations_passed: replyMatches.every((item) => item.passed),
                irrelevant_context_inclusion: irrelevantTurnMatches,
                selected_conversation_evidence_ids: context.selection.selected_evidence_ids,
                selected_conversation_turns: context.turns,
                selected_canonical_meaning_ids: selectedCanonical,
                bounded_projection_size_bytes: Buffer.byteLength(JSON.stringify(evaluatedProjection), "utf8"),
                context_bound: {
                    max_exchanges: context.selection.max_exchanges,
                    max_turn_bytes: context.selection.max_turn_bytes,
                    excluded_older_exchange_count: context.selection.excluded_older_exchange_count,
                    truncated_turn_count: context.selection.truncated_turn_count,
                },
                restart_outcome: episode.restart ? (context.selection.membership?.action ?? null) : null,
                cross_surface_outcome:
                    context.turns.length > 0 && context.turns.at(-1)?.source_surface !== episode.surface
                        ? "continued"
                        : null,
                ember_assertions_passed: assertions.every(Boolean),
                provider_observations_passed: providerObservationsPassed,
                model_observations_passed:
                    replyMatches.every((item) => item.passed) && referenceMatches.every((item) => item.passed),
            });
        }
    } finally {
        if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previousNow;
        await store.releaseWriteLease(lease);
    }
    return {
        report_version: 1,
        scenario_id: scenario.id,
        description: scenario.description,
        scorecard_input: true,
        ember_assertions_passed: episodes.every((episode) => episode.ember_assertions_passed),
        provider_observations_passed: episodes.every((episode) => episode.provider_observations_passed),
        model_observations_passed: episodes.every((episode) => episode.model_observations_passed),
        episodes,
    };
}

function validateScenario(value: unknown): asserts value is ConversationScenario {
    if (!isObject(value)) throw new ValidationError("conversation scenario must be an object");
    const scenario = value as Partial<ConversationScenario>;
    if (!exactKeys(value, ["scenario_version", "id", "description", "ember", "meanings", "episodes"]))
        throw new ValidationError("conversation scenario contains missing or unsupported fields");
    if (scenario.scenario_version !== 1 || !isNonEmptyString(scenario.id) || !isNonEmptyString(scenario.description))
        throw new ValidationError("conversation scenario header is invalid");
    if (
        !isObject(scenario.ember) ||
        !exactKeys(scenario.ember, ["name", "principal", "scope", "initial_at"]) ||
        !isNonEmptyString(scenario.ember.name) ||
        !isNonEmptyString(scenario.ember.principal) ||
        !isNonEmptyString(scenario.ember.scope) ||
        !isRfc3339Utc(scenario.ember.initial_at)
    )
        throw new ValidationError("conversation scenario Ember identity is invalid");
    if (!Array.isArray(scenario.meanings) || !Array.isArray(scenario.episodes))
        throw new ValidationError("conversation scenario sections are invalid");
    if (scenario.episodes.length === 0) throw new ValidationError("conversation scenario must contain episodes");
    const aliases = new Set<string>();
    for (const meaning of scenario.meanings) {
        if (
            !isObject(meaning) ||
            !exactKeys(meaning, ["as", "slot", "text"]) ||
            !isNonEmptyString(meaning.as) ||
            aliases.has(meaning.as) ||
            !isNonEmptyString(meaning.slot) ||
            !isNonEmptyString(meaning.text)
        )
            throw new ValidationError("conversation scenario meaning is invalid or duplicated");
        aliases.add(meaning.as);
    }
    const episodeIds = new Set<string>();
    let previousTimestamp = Date.parse(scenario.ember.initial_at);
    for (const episode of scenario.episodes) {
        if (
            !isObject(episode) ||
            !hasOnlyKeys(episode, [
                "id",
                "at",
                "surface",
                "input",
                "restart",
                "fresh_conversation",
                "provider_outcome",
                "delivery_outcome",
                "scripted_reply",
                "expect",
            ]) ||
            !isNonEmptyString(episode.id) ||
            episodeIds.has(episode.id) ||
            !isRfc3339Utc(episode.at) ||
            !isNonEmptyString(episode.surface) ||
            !isNonEmptyString(episode.input) ||
            (episode.restart !== undefined && typeof episode.restart !== "boolean") ||
            (episode.fresh_conversation !== undefined && typeof episode.fresh_conversation !== "boolean") ||
            (episode.provider_outcome !== undefined &&
                !["failed", "outcome_unknown"].includes(episode.provider_outcome)) ||
            (episode.delivery_outcome !== undefined &&
                !["displayed", "uncertain"].includes(episode.delivery_outcome)) ||
            (episode.scripted_reply !== undefined && !isNonEmptyString(episode.scripted_reply))
        )
            throw new ValidationError("conversation episode is invalid or duplicated");
        const timestamp = Date.parse(episode.at);
        if (timestamp <= previousTimestamp)
            throw new ValidationError("conversation episode timestamps must be strictly increasing");
        previousTimestamp = timestamp;
        episodeIds.add(episode.id);
        validateExpectations(episode.id, episode.expect, aliases);
    }
}

function validateProviderControl(value: unknown): asserts value is ConversationProviderControl {
    if (
        !isObject(value) ||
        !exactKeys(value, ["invocation_mode", "external_thread_identity"]) ||
        value.invocation_mode !== "fresh" ||
        !["optional", "required"].includes(value.external_thread_identity as string)
    )
        throw new ValidationError("conversation provider control is invalid");
}

function validateExpectations(episodeId: string, value: unknown, aliases: Set<string>) {
    if (
        !isObject(value) ||
        !hasOnlyKeys(value, [
            "selected_turns",
            "excluded_turns",
            "selected_meanings",
            "reply_includes",
            "reference_resolution",
        ])
    )
        throw new ValidationError(`episode ${episodeId} expectations are invalid`);
    for (const field of ["selected_turns", "excluded_turns", "reply_includes"] as const) {
        if (value[field] !== undefined && !isStringList(value[field]))
            throw new ValidationError(`episode ${episodeId} ${field} must contain non-empty strings`);
    }
    if (
        value.selected_meanings !== undefined &&
        (!isStringList(value.selected_meanings) || value.selected_meanings.some((alias) => !aliases.has(alias)))
    )
        throw new ValidationError(`episode ${episodeId} selected_meanings contains an unknown alias`);
    if (
        value.reference_resolution !== undefined &&
        (!isObject(value.reference_resolution) ||
            !exactKeys(value.reference_resolution, ["reply_includes"]) ||
            !isStringList(value.reference_resolution.reply_includes))
    )
        throw new ValidationError(`episode ${episodeId} reference_resolution is invalid`);
}

function hasOnlyKeys(value: object, allowed: string[]) {
    return Object.keys(value).every((key) => allowed.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && Boolean(value.trim());
}

function isStringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(isNonEmptyString) && new Set(value).size === value.length;
}

function withFixedTime<T>(timestamp: string, action: () => T): T {
    const previous = process.env.EMBER_TEST_NOW;
    process.env.EMBER_TEST_NOW = timestamp;
    try {
        return action();
    } finally {
        if (previous === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previous;
    }
}
