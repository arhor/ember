import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { CognitionOpportunityEvaluator } from "./cognition-opportunity.ts";

import {
    parseSelectivityWorkload,
    runEndogenousSelectivityEvaluation,
    scriptedSelectivityEvaluator,
} from "./endogenous-selectivity-evaluation.ts";

const SCRIPTED_BACKEND = {
    label: "scripted-structural-control",
    external_model: false,
    runtime_version: null,
    model_version: null,
} as const;

async function workload() {
    const raw = await readFile(
        new URL("../../eval/endogenous/fixtures/selectivity-workload.json", import.meta.url),
        "utf8",
    );
    return parseSelectivityWorkload(JSON.parse(raw));
}

test("issue 79 baseline should remain reproducible with attention control disabled", async () => {
    const result = await runEndogenousSelectivityEvaluation(
        await workload(),
        scriptedSelectivityEvaluator,
        SCRIPTED_BACKEND,
        { attentionControl: "disabled" },
    );

    assert.deepEqual(result.workload, { case_count: 6, opportunity_count: 25 });
    assert.equal(result.policy.trigger_topic_present, false);
    assert.equal(result.policy.attention_control, "disabled");
    assert.equal(result.policy.max_model_backed_evaluator_attempts_per_opportunity, 1);
    assert.equal(result.counts.evaluator_calls, 25);
    assert.equal(result.counts.attention_deferred_repeated_projection, 0);
    assert.equal(result.counts.external_model_evaluator_attempts, 0);

    assert.deepEqual(
        [
            result.counts.intentional_silence,
            result.counts.worthwhile_cognition,
            result.counts.worthwhile_deferred_attention,
            result.counts.false_positive_cognition,
            result.counts.missed_worthwhile,
            result.counts.evaluator_failures,
        ],
        [19, 3, 0, 3, 0, 0],
    );
    assert.deepEqual(result.counts.false_positive_categories, {
        trivial_repetition: 3,
        stale_concern_revival: 0,
        post_hoc_fabricated_motive: 0,
        unnecessary_user_interruption: 0,
    });
    assert.deepEqual(result.counts.interruptions, {
        deliver: 2,
        defer: 1,
        suppress: 3,
        no_delivery: 19,
    });
    assert.equal(result.latency_ms.sample_count, 25);
    assert.deepEqual(result.rates.false_positive_cognition, { numerator: 3, denominator: 25 });
});

test("repeated-projection control should remove issue 79 repetition without suppressing first useful cognition", async () => {
    const result = await runEndogenousSelectivityEvaluation(
        await workload(),
        scriptedSelectivityEvaluator,
        SCRIPTED_BACKEND,
    );

    assert.equal(result.policy.attention_control, "repeated_projection");
    assert.equal(result.counts.evaluator_calls, 22);
    assert.equal(result.counts.attention_deferred_repeated_projection, 3);
    assert.equal(result.counts.external_model_evaluator_attempts, 0);
    assert.deepEqual(
        [
            result.counts.intentional_silence,
            result.counts.worthwhile_cognition,
            result.counts.worthwhile_deferred_attention,
            result.counts.false_positive_cognition,
            result.counts.missed_worthwhile,
            result.counts.evaluator_failures,
        ],
        [19, 3, 3, 0, 0, 0],
    );
    assert.deepEqual(result.counts.false_positive_categories, {
        trivial_repetition: 0,
        stale_concern_revival: 0,
        post_hoc_fabricated_motive: 0,
        unnecessary_user_interruption: 0,
    });
    assert.deepEqual(result.counts.interruptions, {
        deliver: 2,
        defer: 1,
        suppress: 0,
        no_delivery: 22,
    });
    assert.deepEqual(result.rates.intentional_silence, { numerator: 19, denominator: 25 });
    assert.deepEqual(result.rates.false_positive_cognition, { numerator: 0, denominator: 25 });
    assert.equal(result.latency_ms.sample_count, 22);
    assert.equal(result.local_process_resources.external_child_process_resources, "not_observed_by_harness");
});

test("long quiet period should remain silent without model-written motives", async () => {
    const result = await runEndogenousSelectivityEvaluation(
        await workload(),
        scriptedSelectivityEvaluator,
        SCRIPTED_BACKEND,
    );
    const quiet = result.observations.filter((item) => item.case_id === "quiet-stretch");

    assert.equal(quiet.length, 12);
    assert.ok(quiet.every((item) => item.decision === "no_cognition"));
    assert.ok(quiet.every((item) => item.classification === "intentional_silence"));
    assert.ok(quiet.every((item) => item.selected_meaning_count === 0));
    assert.ok(quiet.every((item) => item.attention_outcome === "evaluate"));
    assert.ok(quiet.every((item) => item.evaluator_latency_ms !== null));
    assert.ok(quiet.every((item) => item.interruption_outcome === "no_delivery"));
});

test("unchanged current concern should defer before repeated evaluator work", async () => {
    const result = await runEndogenousSelectivityEvaluation(
        await workload(),
        scriptedSelectivityEvaluator,
        SCRIPTED_BACKEND,
    );
    const repeated = result.observations.filter((item) => item.case_id === "repeated-current-concern");

    assert.equal(repeated.length, 4);
    assert.deepEqual(
        repeated.map((item) => item.decision),
        ["cognition", "defer", "defer", "defer"],
    );
    assert.deepEqual(
        repeated.map((item) => item.classification),
        [
            "worthwhile_cognition",
            "worthwhile_deferred_attention",
            "worthwhile_deferred_attention",
            "worthwhile_deferred_attention",
        ],
    );
    assert.deepEqual(
        repeated.map((item) => item.attention_outcome),
        ["evaluate", "defer_repeated_projection", "defer_repeated_projection", "defer_repeated_projection"],
    );
    assert.deepEqual(
        repeated.map((item) => item.interruption_outcome),
        ["deliver", "no_delivery", "no_delivery", "no_delivery"],
    );
    assert.equal(repeated[0].evaluator_latency_ms === null, false);
    assert.ok(repeated.slice(1).every((item) => item.evaluator_latency_ms === null));
    assert.ok(repeated.every((item) => item.false_positive_categories.length === 0));
});

test("quiet-period useful cognition should remain separate from user interruption", async () => {
    const result = await runEndogenousSelectivityEvaluation(
        await workload(),
        scriptedSelectivityEvaluator,
        SCRIPTED_BACKEND,
    );
    const [observation] = result.observations.filter((item) => item.case_id === "current-ordinary-quiet-period");

    assert.equal(observation.classification, "worthwhile_cognition");
    assert.equal(observation.interruption_outcome, "defer");
    assert.deepEqual(observation.false_positive_categories, []);
});

test("rubric should identify a fabricated motive and the first unnecessary interruption it causes", async () => {
    const fabricateFromLiveConcern: CognitionOpportunityEvaluator = async (request) => {
        const commitment = request.projection.meanings.find((item) => item.kind === "commitment");
        return commitment
            ? { contract_version: 1, decision: "cognition", selected_meaning_ids: [commitment.meaning_id] }
            : { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
    };

    const result = await runEndogenousSelectivityEvaluation(
        await workload(),
        fabricateFromLiveConcern,
        SCRIPTED_BACKEND,
        { attentionControl: "disabled" },
    );
    const irrelevant = result.observations.filter((item) => item.case_id === "irrelevant-live-concern");

    assert.ok(irrelevant.every((item) => item.classification === "false_positive_cognition"));
    assert.ok(irrelevant.every((item) => item.false_positive_categories.includes("post_hoc_fabricated_motive")));
    assert.equal(
        irrelevant.filter((item) => item.false_positive_categories.includes("unnecessary_user_interruption")).length,
        1,
    );
    assert.deepEqual(
        irrelevant.map((item) => item.interruption_outcome),
        ["deliver", "suppress", "suppress", "suppress"],
    );
});

test("rubric should identify cognition that revives a resolved concern from a lingering consequence", async () => {
    const reviveFromConsequence: CognitionOpportunityEvaluator = async (request) => {
        const commitment = request.projection.meanings.find((item) => item.kind === "commitment");
        const urgency = request.projection.meanings.find(
            (item) => item.kind === "fact" && item.slot === "release-window",
        );
        if (!commitment && urgency) {
            return { contract_version: 1, decision: "cognition", selected_meaning_ids: [urgency.meaning_id] };
        }
        return { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
    };

    const result = await runEndogenousSelectivityEvaluation(await workload(), reviveFromConsequence, SCRIPTED_BACKEND, {
        attentionControl: "disabled",
    });
    const resolved = result.observations.filter((item) => item.case_id === "resolved-concern");

    assert.ok(resolved.every((item) => item.classification === "false_positive_cognition"));
    assert.ok(resolved.every((item) => item.false_positive_categories.includes("stale_concern_revival")));
    assert.equal(
        resolved.filter((item) => item.false_positive_categories.includes("unnecessary_user_interruption")).length,
        1,
    );
});

test("workload parser should reject malformed or duplicate cases", async () => {
    const valid = await workload();
    const duplicate = structuredClone(valid);
    duplicate.cases[1].case_id = duplicate.cases[0].case_id;
    assert.throws(() => parseSelectivityWorkload(duplicate), /case_id must be unique/);

    const invalidCount = structuredClone(valid);
    invalidCount.cases[0].opportunities = 0;
    assert.throws(() => parseSelectivityWorkload(invalidCount), /opportunities must be a positive/);
});
