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
    assert.equal(pressure.context_bound.excluded_older_exchange_count, 1);
    assert.equal(pressure.irrelevant_context_inclusion.length, 0);
    assert.ok(pressure.bounded_projection_size_bytes > 0);
    const crossSurface = report.episodes.find((episode) => episode.id === "pressure-two-cross-surface-restart");
    assert.equal(crossSurface?.restart_outcome, "continued");
    assert.equal(crossSurface?.cross_surface_outcome, "continued");
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
