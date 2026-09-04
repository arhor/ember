#!/usr/bin/env node

import assert from "node:assert/strict";

import { createCodexOpportunityEvaluator } from "../../src/agency/codex-opportunity-evaluator.ts";
import { evaluateCognitionOpportunity } from "../../src/agency/cognition-opportunity.ts";
import { initialState } from "../../src/core/model.ts";
import { undertake } from "../../src/core/semantics.ts";
import { startRuntime } from "../../src/runtime/runtime.ts";

if (process.env.EMBER_RUN_LIVE_ENDOGENOUS !== "1") {
    process.stderr.write(
        "Set EMBER_RUN_LIVE_ENDOGENOUS=1 to run the subscription-backed Codex opportunity evaluation.\n",
    );
    process.exit(2);
}

const PRINCIPAL = "user-1";
const SCOPE = "project:ember/endogenous-evaluation";
const evaluator = createCodexOpportunityEvaluator({
    command: process.env.EMBER_CODEX_COMMAND ?? "codex",
    timeoutSeconds: 120,
});

const quietState = initialState("Ember", PRINCIPAL);
const quietRuntime = startRuntime(quietState, PRINCIPAL, SCOPE);
const quiet = await evaluateCognitionOpportunity(quietRuntime.state, {
    runtimeId: quietRuntime.runtimeId,
    principal: PRINCIPAL,
    scope: SCOPE,
    mechanism: "foreground_probe",
    evaluator,
});

const concernedState = initialState("Ember", PRINCIPAL);
undertake(
    concernedState,
    PRINCIPAL,
    "unresolved-endogenous-evaluation",
    SCOPE,
    "Revisit the unresolved endogenous decision boundary before continuing the implementation roadmap",
);
const concernedRuntime = startRuntime(concernedState, PRINCIPAL, SCOPE);
const concerned = await evaluateCognitionOpportunity(concernedRuntime.state, {
    runtimeId: concernedRuntime.runtimeId,
    principal: PRINCIPAL,
    scope: SCOPE,
    mechanism: "foreground_probe",
    evaluator,
});

assert.equal(quiet.decision, "no_cognition", "quiet state should permit successful no_cognition");
assert.notEqual(concerned.decision, "no_cognition", "live current commitment should influence the endogenous decision");
assert.ok(concerned.selected_meaning_ids.length > 0, "positive decision should identify projected grounding meaning");

process.stdout.write(
    `${JSON.stringify(
        {
            evaluation_version: 1,
            backend: "codex exec",
            mechanism: "foreground_probe",
            trigger_topic_present: false,
            scenarios: [
                {
                    name: "quiet-state",
                    projected_meaning_count: quiet.projected_meaning_ids.length,
                    decision: quiet.decision,
                    selected_meaning_count: quiet.selected_meaning_ids.length,
                },
                {
                    name: "live-current-commitment",
                    projected_meaning_count: concerned.projected_meaning_ids.length,
                    decision: concerned.decision,
                    selected_meaning_count: concerned.selected_meaning_ids.length,
                },
            ],
            raw_reasoning_retained: false,
        },
        null,
        2,
    )}\n`,
);
