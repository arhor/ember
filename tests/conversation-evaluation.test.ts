import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { loadConversationScenario, runConversationScenario } from "../eval/conversation/harness.ts";
import { RECENT_DIALOGUE_MAX_EXCHANGES } from "../src/core/conversation-context.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "eval", "conversation", "fixtures", "conversational-coherence.json");
const OPTIONAL_FRESH_PROVIDER = { invocation_mode: "fresh", external_thread_identity: "optional" } as const;

test("conversation evaluation should expose bounded selection evidence when dialogue crosses semantic boundaries", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);

    // When
    const report = await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, request }) => ({
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: request.projection.selection.meaning_ids,
            operational: { externalThreadId: `fresh-${episode.id}` },
        }),
        OPTIONAL_FRESH_PROVIDER,
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.scorecard_input, true);
    const pressure = report.episodes.find((episode) => episode.id === "pressure-bound");
    assert.ok(pressure);
    assert.equal(pressure.context_bound.max_exchanges, RECENT_DIALOGUE_MAX_EXCHANGES);
    assert.equal(pressure.context_bound.excluded_older_exchange_count, 3);
    assert.equal(pressure.irrelevant_context_inclusion.length, 0);
    assert.equal(
        pressure.selected_conversation_turns.some((turn) => turn.content.includes("blue deployment binder")),
        false,
    );
    assert.ok(pressure.bounded_projection_size_bytes > 0);
    const similarHistory = report.episodes.find((episode) => episode.id === "same-trajectory-similar-history");
    assert.equal(similarHistory?.conversation_id, pressure.conversation_id);
    const crossSurface = report.episodes.find((episode) => episode.id === "pressure-two-cross-surface-restart");
    assert.equal(crossSurface?.restart_outcome, "continued");
    assert.equal(crossSurface?.cross_surface_outcome, "continued");
    assert.equal(crossSurface?.provider_invocation_mode, "fresh");
    assert.equal(crossSurface?.external_thread_identity_observation, "fresh");
    assert.ok(crossSurface?.provider_thread_id);
    const failed = report.episodes.find((episode) => episode.id === "after-failed-cognition");
    assert.equal(
        failed?.selected_conversation_turns.some(
            (turn) => turn.role === "user" && turn.content.includes("secret confirmation"),
        ),
        true,
    );
    assert.equal(
        failed?.selected_conversation_turns.some(
            (turn) => turn.role === "ember" && turn.content.includes("secret confirmation"),
        ),
        false,
    );
    const uncertain = report.episodes.find((episode) => episode.id === "after-uncertain-delivery");
    const uncertainExpression = uncertain?.selected_conversation_turns.find((turn) => turn.content.includes("Cinder"));
    assert.equal(uncertainExpression?.delivery_status, "pending");
    assert.equal(uncertainExpression?.user_awareness, "unknown");
    const uncertainDelivery = report.episodes.find((episode) => episode.id === "uncertain-delivery");
    assert.equal(uncertainDelivery?.provider_failure, null);
    assert.equal(uncertainDelivery?.delivery_outcome, "uncertain");
    assert.equal(new Set(report.episodes.map((episode) => episode.selected_canonical_meaning_ids.join(","))).size, 1);
    assert.equal(report.episodes.filter((episode) => episode.successful_reference_resolution !== null).length, 4);
    assert.equal(
        report.episodes.find((episode) => episode.id === "topic-continuation-one")?.successful_reference_resolution,
        null,
    );
});

test("conversation evaluation should separate model observations when provider ignores selected context", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);

    // When
    const report = await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, request }) => ({
            contractVersion: 1,
            reply:
                episode.id === "pronoun-resolution"
                    ? "MODEL_IGNORED_CONTEXT"
                    : (episode.scripted_reply ?? "No scripted reply required."),
            usedMeaningIds: request.projection.selection.meaning_ids,
            operational: { externalThreadId: `fresh-${episode.id}` },
        }),
        OPTIONAL_FRESH_PROVIDER,
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, false);
});

test("conversation evaluation should pin canonical setup evidence when scenario time precedes wall clock", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);
    let learnedAt: string | undefined;
    let sourceOccurredAt: string | undefined;

    // When
    await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, request }) => {
            learnedAt ??= request.projection.meanings[0]?.learnedAt;
            sourceOccurredAt ??= request.projection.meanings[0]?.source_evidence[0]?.occurredAt;
            return {
                contractVersion: 1,
                reply: episode.scripted_reply ?? "No scripted reply required.",
                usedMeaningIds: request.projection.selection.meaning_ids,
                operational: { externalThreadId: `fresh-${episode.id}` },
            };
        },
        OPTIONAL_FRESH_PROVIDER,
    );

    // Then
    assert.equal(learnedAt, scenario.ember.initial_at);
    assert.equal(sourceOccurredAt, scenario.ember.initial_at);
});

test("conversation evaluation should propagate unrelated provider errors when delivery fixture is uncertain", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);
    const unexpected = new Error("unexpected provider regression");

    // When
    const run = runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, request }) => {
            if (episode.id === "uncertain-delivery") throw unexpected;
            return {
                contractVersion: 1,
                reply: episode.scripted_reply ?? "No scripted reply required.",
                usedMeaningIds: request.projection.selection.meaning_ids,
                operational: { externalThreadId: `fresh-${episode.id}` },
            };
        },
        OPTIONAL_FRESH_PROVIDER,
    );

    // Then
    await assert.rejects(run, (error) => error === unexpected);
});

test("conversation evaluation should reject duplicate episode ids when scenario is reusable input", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);
    scenario.episodes[1]!.id = scenario.episodes[0]!.id;

    // When
    const run = runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async () => {
            throw new Error("provider must not run");
        },
        OPTIONAL_FRESH_PROVIDER,
    );

    // Then
    await assert.rejects(run, /conversation episode is invalid or duplicated/);
});

test("conversation evaluation should separate required thread evidence from Ember assertions when identity is reused", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);

    // When
    const report = await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, request }) => ({
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: request.projection.selection.meaning_ids,
            operational: { externalThreadId: "reused-provider-thread" },
        }),
        { invocation_mode: "fresh", external_thread_identity: "required" },
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.provider_observations_passed, false);
    const restart = report.episodes.find((episode) => episode.id === "pressure-two-cross-surface-restart");
    assert.equal(restart?.provider_invocation_mode, "fresh");
    assert.equal(restart?.external_thread_identity_observation, "reused");
    assert.equal(restart?.ember_assertions_passed, true);
    assert.equal(restart?.provider_observations_passed, false);
});

test("conversation evaluation should accept fresh providers when optional thread identity is absent", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);

    // When
    const report = await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, request }) => ({
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: request.projection.selection.meaning_ids,
        }),
        OPTIONAL_FRESH_PROVIDER,
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.provider_observations_passed, true);
    const restart = report.episodes.find((episode) => episode.id === "pressure-two-cross-surface-restart");
    assert.equal(restart?.provider_invocation_mode, "fresh");
    assert.equal(restart?.provider_thread_id, null);
    assert.equal(restart?.external_thread_identity_observation, "not_exposed");
});

test("conversation evaluation should preserve runtime cognition identity when provider receives request", async () => {
    // Given
    const directory = await tempDir();
    const statePath = join(directory, "ember.json");
    const scenario = await loadConversationScenario(SCENARIO);
    scenario.episodes = [scenario.episodes[0]!];
    let providerCognitionId: string | undefined;

    // When
    await runConversationScenario(
        scenario,
        statePath,
        async ({ episode, request }) => {
            providerCognitionId = request.cognitionId;
            return {
                contractVersion: 1,
                reply: episode.scripted_reply ?? "No scripted reply required.",
                usedMeaningIds: request.projection.selection.meaning_ids,
            };
        },
        OPTIONAL_FRESH_PROVIDER,
    );
    const persisted = await new StateStore(statePath).load();

    // Then
    assert.equal(providerCognitionId, persisted.operations.cognitionEpisodes[0]?.cognitionId);
});
