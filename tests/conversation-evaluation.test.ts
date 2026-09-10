import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { loadConversationScenario, runConversationScenario } from "../eval/conversation/harness.ts";
import { RECENT_DIALOGUE_MAX_EXCHANGES } from "../src/core/conversation-context.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "eval", "conversation", "fixtures", "conversational-coherence.json");

test("conversation evaluation should expose bounded selection evidence when dialogue crosses semantic boundaries", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);

    // When
    const report = await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, projection }) => ({
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: projection.selection.meaning_ids,
            operational: { externalThreadId: `fresh-${episode.id}` },
        }),
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
    assert.equal(crossSurface?.fresh_provider_invocation, true);
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
        async ({ episode, projection }) => ({
            contractVersion: 1,
            reply:
                episode.id === "pronoun-resolution"
                    ? "MODEL_IGNORED_CONTEXT"
                    : (episode.scripted_reply ?? "No scripted reply required."),
            usedMeaningIds: projection.selection.meaning_ids,
            operational: { externalThreadId: `fresh-${episode.id}` },
        }),
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
    await runConversationScenario(scenario, join(directory, "ember.json"), async ({ episode, projection }) => {
        learnedAt ??= projection.meanings[0]?.learnedAt;
        sourceOccurredAt ??= projection.meanings[0]?.source_evidence[0]?.occurredAt;
        return {
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: projection.selection.meaning_ids,
            operational: { externalThreadId: `fresh-${episode.id}` },
        };
    });

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
    const run = runConversationScenario(scenario, join(directory, "ember.json"), async ({ episode, projection }) => {
        if (episode.id === "uncertain-delivery") throw unexpected;
        return {
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: projection.selection.meaning_ids,
            operational: { externalThreadId: `fresh-${episode.id}` },
        };
    });

    // Then
    await assert.rejects(run, (error) => error === unexpected);
});

test("conversation evaluation should reject duplicate episode ids when scenario is reusable input", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);
    scenario.episodes[1]!.id = scenario.episodes[0]!.id;

    // When
    const run = runConversationScenario(scenario, join(directory, "ember.json"), async () => {
        throw new Error("provider must not run");
    });

    // Then
    await assert.rejects(run, /conversation episode is invalid or duplicated/);
});

test("conversation evaluation should fail restart evidence when provider thread identity is reused", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadConversationScenario(SCENARIO);

    // When
    const report = await runConversationScenario(
        scenario,
        join(directory, "ember.json"),
        async ({ episode, projection }) => ({
            contractVersion: 1,
            reply: episode.scripted_reply ?? "No scripted reply required.",
            usedMeaningIds: projection.selection.meaning_ids,
            operational: { externalThreadId: "reused-provider-thread" },
        }),
    );

    // Then
    assert.equal(report.ember_assertions_passed, false);
    const restart = report.episodes.find((episode) => episode.id === "pressure-two-cross-surface-restart");
    assert.equal(restart?.fresh_provider_invocation, false);
    assert.equal(restart?.ember_assertions_passed, false);
});
