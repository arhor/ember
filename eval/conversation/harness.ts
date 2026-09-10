import { readFile } from "node:fs/promises";

import type { MeaningId, RuntimeId } from "../../src/core/model.ts";
import type { Projection } from "../../src/core/projection.ts";
import type { ProviderResult } from "../../src/providers/contract.ts";

import { ProviderError, ValidationError } from "../../src/core/errors.ts";
import { initialState } from "../../src/core/model.ts";
import { rememberFact } from "../../src/core/semantics.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { runCognition, startRuntime, stopRuntime } from "../../src/runtime/runtime.ts";

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

export async function loadConversationScenario(path: string): Promise<ConversationScenario> {
    const candidate: unknown = JSON.parse(await readFile(path, "utf8"));
    validateScenario(candidate);
    return candidate;
}

export async function runConversationScenario(
    scenario: ConversationScenario,
    statePath: string,
    provider: ConversationProvider,
) {
    validateScenario(scenario);
    const state = initialState(scenario.ember.name, scenario.ember.principal, scenario.ember.initial_at);
    const meaningIds = new Map<string, MeaningId>();
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
    const store = new StateStore(statePath);
    await store.create(state);
    const lease = await store.acquireWriteLease();
    const episodes = [];
    let currentState = state;
    let runtimeId: RuntimeId | null = null;
    const previousNow = process.env.EMBER_TEST_NOW;
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
                        return result;
                    },
                    output: () => {
                        if (episode.delivery_outcome === "uncertain") throw new Error("fixture delivery uncertain");
                    },
                });
                currentState = result.state;
                providerFailure = result.providerFailure;
            } catch (error) {
                if (episode.delivery_outcome !== "uncertain") throw error;
                currentState = await store.load();
                providerFailure = "delivery uncertain";
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
                reply,
                successful_reference_resolution:
                    replyMatches.length === 0 ? null : replyMatches.every((item) => item.passed),
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
                model_observations_passed: replyMatches.length === 0 || replyMatches.every((item) => item.passed),
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
        model_observations_passed: episodes.every((episode) => episode.model_observations_passed),
        episodes,
    };
}

function validateScenario(value: unknown): asserts value is ConversationScenario {
    if (!value || typeof value !== "object") throw new ValidationError("conversation scenario must be an object");
    const scenario = value as Partial<ConversationScenario>;
    if (scenario.scenario_version !== 1 || typeof scenario.id !== "string" || !scenario.id.trim())
        throw new ValidationError("conversation scenario header is invalid");
    if (!scenario.ember || !Array.isArray(scenario.meanings) || !Array.isArray(scenario.episodes))
        throw new ValidationError("conversation scenario sections are invalid");
    if (scenario.episodes.length === 0) throw new ValidationError("conversation scenario must contain episodes");
}
