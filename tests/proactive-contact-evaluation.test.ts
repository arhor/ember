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
    assert.equal(
        report.cases.find((item) => item.id === "confirmed-vs-uncertain-delivery")?.delivery_outcome,
        "blocked_uncertain->confirmed",
    );
});

test("live evaluation separates model contact observations from Ember policy assertions", async () => {
    const report = await runProactiveContactScenario(
        await loadProactiveContactScenario(SCENARIO),
        await tempDir(),
        async ({ id }) => (id === "useful-contact" ? "silent" : "contact"),
    );
    assert.equal(report.execution_mode, "live");
    assert.equal(report.ember_assertions_passed, false);
    assert.equal(report.model_observations_passed, false);
});

test("proactive-contact fixture rejects a missing required case", async () => {
    const scenario = await loadProactiveContactScenario(SCENARIO);
    scenario.cases.pop();
    await assert.rejects(runProactiveContactScenario(scenario, await tempDir()), /version-1 case contract/);
});
