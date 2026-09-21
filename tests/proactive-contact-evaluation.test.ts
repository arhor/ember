import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { loadProactiveContactScenario, runProactiveContactScenario } from "../eval/proactive-contact/harness.ts";
import { tempDir } from "./support.ts";

const SCENARIO = resolve("eval/proactive-contact/fixtures/proactive-contact.json");

test("proactive-contact evaluation covers contact, silence, restart, duplication, currentness, and delivery truth", async () => {
    const report = await runProactiveContactScenario(await loadProactiveContactScenario(SCENARIO), await tempDir());
    assert.equal(report.passed, true);
    assert.equal(report.scorecard_input, true);
    assert.equal(report.metrics.contact_precision, 1);
    assert.equal(report.metrics.contact_recall, 1);
    assert.equal(report.metrics.unwanted_interruption.errors, 0);
    assert.equal(report.metrics.deliberate_silence.accuracy, 1);
    assert.equal(report.metrics.stale_contact_suppression.accuracy, 1);
    assert.equal(report.metrics.duplicate_suppression.accuracy, 1);
    assert.equal(report.metrics.delivery_uncertainty_handling.accuracy, 1);
    assert.equal(report.metrics.restart_outcome.accuracy, 1);
    assert.ok(report.cases.every((item) => item.source_evidence_ids.length > 0));
    assert.ok(report.cases.every((item) => item.source_evidence_ids.every((id) => id.startsWith("evidence-"))));
    assert.ok(report.cases.every((item) => item.grounding_meaning_ids.every((id) => id.startsWith("meaning-"))));
    assert.deepEqual(
        report.cases.map((item) => [item.contact_policy_outcome, item.contact_policy_basis]),
        report.cases.map((item) => [item.expected_policy.outcome, item.expected_policy.basis]),
    );
    const currentness = report.cases.find((item) => item.id === "remembered-currentness-change");
    assert.equal(currentness?.grounding_meaning_ids.length, 2);
    assert.deepEqual(
        Array.isArray(currentness?.policy_decision)
            ? currentness.policy_decision.map((decision) => [decision.outcome, decision.basis])
            : null,
        [
            ["suppress", "superseded_intent"],
            ["admit", "current_authorized_intent"],
        ],
    );
    assert.equal(
        new Set(
            Array.isArray(currentness?.policy_decision)
                ? currentness.policy_decision.map((decision) => decision.contact_intent_id)
                : [],
        ).size,
        2,
    );
    const restart = report.cases.find((item) => item.id === "restart-before-delivery");
    assert.match(restart?.delivery_outcome ?? "", /^delivery-/);
    assert.equal(Array.isArray(restart?.policy_decision) ? restart.policy_decision.length : 0, 2);
    assert.equal(
        report.cases.find((item) => item.id === "confirmed-vs-uncertain-delivery")?.delivery_outcome,
        "blocked_uncertain->blocked_uncertain",
    );
});

test("a wrong low-value live observation fails only model assertions", async () => {
    const report = await runProactiveContactScenario(
        await loadProactiveContactScenario(SCENARIO),
        await tempDir(),
        async ({ id }) => (id === "useful-contact" ? "contact" : "contact"),
    );
    assert.equal(report.execution_mode, "live");
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, false);
    assert.equal(report.cases.find((item) => item.id === "low-value-silence")?.ember_assertions_passed, true);
});

test("proactive-contact fixture rejects a missing required case", async () => {
    const scenario = await loadProactiveContactScenario(SCENARIO);
    scenario.cases.pop();
    await assert.rejects(runProactiveContactScenario(scenario, await tempDir()), /version-1 case contract/);
});
