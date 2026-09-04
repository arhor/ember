import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../core/errors.ts";
import { cloneState, initialState, type MeaningId } from "../core/model.ts";
import { undertake } from "../core/semantics.ts";
import { startRuntime, stopRuntime } from "../runtime/runtime.ts";
import {
    evaluateCognitionOpportunity,
    type CognitionOpportunityEvaluator,
    type CognitionOpportunityMechanism,
    type CognitionOpportunityRequest,
} from "./cognition-opportunity.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";

function startedState(withCommitment = false) {
    const state = initialState("Ember", PRINCIPAL, "2026-09-03T05:00:00Z");
    const commitment = withCommitment
        ? undertake(
              state,
              PRINCIPAL,
              "endogenous-follow-up",
              SCOPE,
              "Revisit the unresolved endogenous cognition boundary",
          )
        : null;
    const started = startRuntime(state, PRINCIPAL, SCOPE);
    return { ...started, commitment };
}

const selectLiveCommitment: CognitionOpportunityEvaluator = async (request) => {
    const commitment = request.projection.meanings.find(
        (meaning) => meaning.kind === "commitment" && meaning.prospective_lifecycle === "live",
    );
    return commitment
        ? { contract_version: 1, decision: "cognition", selected_meaning_ids: [commitment.meaning_id] }
        : { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
};

test("identical topic-free opportunity mechanism should decide from bounded Ember state", async () => {
    // Given
    const quiet = startedState(false);
    const concerned = startedState(true);
    const quietBefore = cloneState(quiet.state);
    const concernedBefore = cloneState(concerned.state);
    const common = {
        principal: PRINCIPAL,
        scope: SCOPE,
        mechanism: "foreground_probe" as const,
        evaluator: selectLiveCommitment,
    };

    // When
    const quietDecision = await evaluateCognitionOpportunity(quiet.state, { ...common, runtimeId: quiet.runtimeId });
    const concernedDecision = await evaluateCognitionOpportunity(concerned.state, {
        ...common,
        runtimeId: concerned.runtimeId,
    });

    // Then
    assert.equal(quietDecision.decision, "no_cognition");
    assert.deepEqual(quietDecision.selected_meaning_ids, []);
    assert.equal(concernedDecision.decision, "cognition");
    assert.deepEqual(concernedDecision.selected_meaning_ids, [concerned.commitment]);
    assert.equal(quietDecision.mechanism, concernedDecision.mechanism);
    assert.deepEqual(quiet.state, quietBefore);
    assert.deepEqual(concerned.state, concernedBefore);
});

test("decision request should contain no trigger topic, mechanism, or synthetic current input", async () => {
    // Given
    const fixture = startedState(false);
    let captured: CognitionOpportunityRequest | null = null;
    const evaluator: CognitionOpportunityEvaluator = async (request) => {
        captured = request;
        return { contract_version: 1, decision: "no_cognition", selected_meaning_ids: [] };
    };

    // When
    await evaluateCognitionOpportunity(fixture.state, {
        runtimeId: fixture.runtimeId,
        principal: PRINCIPAL,
        scope: SCOPE,
        mechanism: "runtime_start",
        evaluator,
    });

    // Then
    assert.ok(captured);
    assert.equal(captured.projection.purpose, "endogenous_decision");
    assert.equal("current_input" in captured.projection, false);
    assert.equal("mechanism" in captured, false);
    assert.doesNotMatch(JSON.stringify(captured), /runtime_start/);
    assert.equal(fixture.state.evidence.length, 0);
});

test("evaluator should not select meaning outside the bounded projection", async () => {
    // Given
    const fixture = startedState(false);
    const evaluator: CognitionOpportunityEvaluator = async () => ({
        contract_version: 1,
        decision: "cognition",
        selected_meaning_ids: ["meaning-not-projected" as MeaningId],
    });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator,
        }),
        (error) => error instanceof ValidationError && /outside its projection/.test(error.message),
    );
});

test("evaluator mutation should not enlarge the validated projection envelope", async () => {
    // Given
    const fixture = startedState(false);
    const injected = "meaning-injected-by-evaluator" as MeaningId;
    const evaluator: CognitionOpportunityEvaluator = async (request) => {
        request.projection.selection.meaning_ids.push(injected);
        return { contract_version: 1, decision: "cognition", selected_meaning_ids: [injected] };
    };

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "foreground_probe",
            evaluator,
        }),
        (error) => error instanceof ValidationError && /outside its projection/.test(error.message),
    );
});

test("intentional no cognition should not carry a fabricated selected reason", async () => {
    // Given
    const fixture = startedState(true);
    const evaluator: CognitionOpportunityEvaluator = async (request) => ({
        contract_version: 1,
        decision: "no_cognition",
        selected_meaning_ids: [request.projection.meanings[0].meaning_id],
    });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "idle_opportunity",
            evaluator,
        }),
        (error) => error instanceof ValidationError && /no_cognition must not select/.test(error.message),
    );
});

test("cognition opportunity should reject topic-shaped mechanism values at runtime", async () => {
    // Given
    const fixture = startedState(false);

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(fixture.state, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "revisit-project-x" as CognitionOpportunityMechanism,
            evaluator: selectLiveCommitment,
        }),
        (error) => error instanceof ValidationError && /mechanism is invalid/.test(error.message),
    );
});

test("cognition opportunity should reject stopped runtime loci", async () => {
    // Given
    const fixture = startedState(false);
    const stopped = stopRuntime(fixture.state, fixture.runtimeId, { reason: "test stop" });

    // When / Then
    await assert.rejects(
        evaluateCognitionOpportunity(stopped, {
            runtimeId: fixture.runtimeId,
            principal: PRINCIPAL,
            scope: SCOPE,
            mechanism: "runtime_start",
            evaluator: selectLiveCommitment,
        }),
        (error) => error instanceof ValidationError && /requires an active runtime/.test(error.message),
    );
});
