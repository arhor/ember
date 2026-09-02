import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { loadLongitudinalScenario, runLongitudinalScenario } from "../eval/longitudinal/harness.ts";
import { initialState, validateState, type EvidenceId } from "../src/core/model.ts";
import { findEvidence, findMeaning, rememberDelegatedReport } from "../src/core/semantics.ts";
import type { ProjectedMeaning } from "../src/core/projection.ts";
import type { ProviderResult } from "../src/providers/contract.ts";
import { ROOT, tempDir } from "./support.ts";

const SCENARIO = join(ROOT, "test-fixtures", "longitudinal", "provenance-pressure.json");

test("longitudinal provenance pressure should preserve classes, derivation roots, correction, and history", async () => {
    // Given
    const directory = await tempDir();
    const scenario = await loadLongitudinalScenario(SCENARIO);

    // When
    const report = await runLongitudinalScenario(
        scenario,
        join(directory, "ember.json"),
        async invocation => {
            const selected = invocation.request.projection.meanings.map(item => item.content).join(" | ");
            const audit = invocation.episodeId === "mixed-provenance-baseline"
                ? "PROVENANCE_DISTINCT GREEN_ROOTS=2 RED_ROOTS=1 CORRELATED_NOT_INDEPENDENT"
                : invocation.episodeId === "corrected-user-testimony"
                    ? "PROVENANCE_DISTINCT GREEN_ROOTS=1 RED_ROOTS=2 CORRELATED_NOT_INDEPENDENT"
                    : "HISTORICAL_USER_TESTIMONY PROVENANCE_DISTINCT CORRELATED_NOT_INDEPENDENT";
            const externalThreadId = invocation.thread.mode === "fresh"
                ? `thread-${invocation.episodeId}`
                : invocation.thread.externalThreadId;
            return harnessOutput(invocation.cognitionBackend, {
                contract_version: 1,
                reply: `${selected} | ${audit}`,
                used_meaning_ids: invocation.request.projection.selection.meaning_ids,
                operational: { external_thread_id: externalThreadId },
            });
        },
    );

    // Then
    assert.equal(report.ember_assertions_passed, true);
    assert.equal(report.model_observations_passed, true);
    assert.equal(report.history.generated_action_count, 12);

    const baseline = report.episodes[0]!;
    const user = meaningWith(baseline.projection.meanings, "PROV_USER_OLD");
    const external = meaningWith(baseline.projection.meanings, "PROV_EXTERNAL_GREEN");
    const observation = meaningWith(baseline.projection.meanings, "PROV_OBSERVATION_RED");
    const delegateA = meaningWith(baseline.projection.meanings, "PROV_DELEGATE_A_GREEN");
    const delegateB = meaningWith(baseline.projection.meanings, "PROV_DELEGATE_B_GREEN");
    const inferenceA = meaningWith(baseline.projection.meanings, "PROV_INFERENCE_A_GREEN");
    const inferenceB = meaningWith(baseline.projection.meanings, "PROV_INFERENCE_B_GREEN");

    assert.equal(user.epistemic_role, "user_testimony");
    assert.equal(external.epistemic_role, "external_claim");
    assert.equal(observation.epistemic_role, "direct_observation");
    assert.equal(delegateA.epistemic_role, "delegated_report");
    assert.equal(delegateB.epistemic_role, "delegated_report");
    assert.equal(inferenceA.epistemic_role, "ember_inference");
    assert.equal(inferenceB.epistemic_role, "ember_inference");

    assert.equal(user.source_evidence[0]!.source_role, "user_command");
    assert.equal(external.source_evidence[0]!.source_role, "external_claim");
    assert.equal(external.source_evidence[0]!.source_actor, "external:release-dashboard");
    assert.equal(observation.source_evidence[0]!.source_role, "ember_observation");
    assert.equal(delegateA.source_evidence[0]!.source_role, "delegated_report");
    assert.equal(delegateA.source_evidence[0]!.source_actor, "delegate:codex-a");
    assert.equal(inferenceA.source_evidence[0]!.source_role, "ember_inference");
    assert.deepEqual(inferenceA.source_evidence.map(item => item.source_role), ["ember_inference", "delegated_report", "external_claim"]);
    assert.deepEqual(inferenceB.source_evidence.map(item => item.source_role), ["ember_inference", "delegated_report", "external_claim"]);

    const externalRoot = roots(external)[0]!;
    assert.deepEqual(roots(delegateA), [externalRoot]);
    assert.deepEqual(roots(delegateB), [externalRoot]);
    assert.deepEqual(roots(inferenceA), [externalRoot]);
    assert.deepEqual(roots(inferenceB), [externalRoot]);
    assert.equal(new Set([delegateA, delegateB, inferenceA, inferenceB].flatMap(roots)).size, 1);

    const greenRoots = new Set([user, external, delegateA, delegateB, inferenceA, inferenceB].flatMap(roots));
    const redRoots = new Set(roots(observation));
    assert.equal(greenRoots.size, 2);
    assert.equal(redRoots.size, 1);
    assert.equal([...greenRoots].some(id => redRoots.has(id)), false);
    assert.equal(baseline.projection.selection.evidence_ids.map(String).includes(externalRoot), true);
    assert.deepEqual(baseline.context_evaluation.omission_candidates.relevant_not_selected, []);
    assert.equal(baseline.context_evaluation.inclusion_candidates.irrelevant_selected.length, 12);

    const corrected = report.episodes[1]!;
    assert.equal(corrected.external_thread.mode, "reuse");
    assert.equal(corrected.provider_thread_id, baseline.provider_thread_id);
    assert.equal(corrected.projection.meanings.some(item => item.content.includes("PROV_USER_OLD")), false);
    const correctedUser = meaningWith(corrected.projection.meanings, "PROV_USER_NEW_RED");
    assert.equal(correctedUser.epistemic_role, "user_testimony");
    assert.equal(correctedUser.source_evidence[0]!.source_role, "user_command");
    const historicalOld = corrected.canonical_before.historical_meanings.find(item => item.content.includes("PROV_USER_OLD"));
    assert.ok(historicalOld);
    assert.equal(historicalOld.currentness, "superseded");
    assert.equal(historicalOld.epistemic_role, "user_testimony");
    assert.deepEqual(historicalOld.source_evidence_ids.map(String), user.source_evidence_ids.map(String));
    assert.deepEqual(corrected.context_evaluation.inclusion_candidates.superseded_selected, []);

    const historical = report.episodes[2]!;
    assert.equal(historical.external_thread.mode, "fresh");
    const historicalOldProjection = meaningWith(historical.projection.meanings, "PROV_USER_OLD");
    const historicalNewProjection = meaningWith(historical.projection.meanings, "PROV_USER_NEW_RED");
    assert.equal(historicalOldProjection.currentness, "superseded");
    assert.equal(historicalOldProjection.epistemic_role, "user_testimony");
    assert.equal(historicalOldProjection.source_evidence[0]!.source_role, "user_command");
    assert.equal(historicalNewProjection.currentness, "current");
    assert.equal(historicalNewProjection.epistemic_role, "user_testimony");
    assert.deepEqual(historical.context_evaluation.inclusion_candidates.superseded_selected, ["user_report_old"]);
    const historicalInference = meaningWith(historical.projection.meanings, "PROV_INFERENCE_A_GREEN");
    assert.deepEqual(roots(historicalInference), [externalRoot]);
});

test("provenance validation should reject epistemic laundering and cyclic derivation", () => {
    // Given
    const state = initialState("Ember", "user-1", "2026-09-02T08:00:00Z");
    const first = rememberDelegatedReport(state, "user-1", "codex-a", "a", "project:ember/provenance", "A", []);
    const firstEvidenceId = findMeaning(state, first).source_evidence_ids[0]!;
    const second = rememberDelegatedReport(state, "user-1", "codex-b", "b", "project:ember/provenance", "B", [firstEvidenceId]);
    const secondMeaning = findMeaning(state, second);
    const secondEvidenceId = secondMeaning.source_evidence_ids[0]!;

    // When / Then: attribution cannot be rewritten into user testimony.
    (secondMeaning as { epistemic_role: string }).epistemic_role = "user_testimony";
    assert.throws(() => validateState(state), /user testimony owner|user testimony must cite/);
    (secondMeaning as { epistemic_role: string }).epistemic_role = "delegated_report";
    validateState(state);

    // When / Then: correlated evidence must remain an acyclic derivation graph.
    const firstEvidence = findEvidence(state, firstEvidenceId);
    (firstEvidence.derived_from_evidence_ids as EvidenceId[]).push(secondEvidenceId);
    assert.throws(() => validateState(state), /evidence derivation cycle/);
});

test("provenance derivation should not cross evidence scopes or partially mutate state", () => {
    // Given
    const state = initialState("Ember", "user-1", "2026-09-02T08:00:00Z");
    const privateReport = rememberDelegatedReport(state, "user-1", "codex-private", "private", "project:private", "Private report", []);
    const privateEvidenceId = findMeaning(state, privateReport).source_evidence_ids[0]!;
    const evidenceCount = state.evidence.length;
    const meaningCount = state.meanings.length;

    // When / Then
    assert.throws(
        () => rememberDelegatedReport(state, "user-1", "codex-public", "public", "project:public", "Derived public report", [privateEvidenceId]),
        /evidence derivation cannot cross scope/,
    );
    assert.equal(state.evidence.length, evidenceCount);
    assert.equal(state.meanings.length, meaningCount);
    validateState(state);
});

test("canonical validation should reject cross-scope provenance edges", () => {
    // Given
    const state = initialState("Ember", "user-1", "2026-09-02T08:00:00Z");
    const root = rememberDelegatedReport(state, "user-1", "codex-a", "root", "project:ember/provenance", "Root", []);
    const rootEvidenceId = findMeaning(state, root).source_evidence_ids[0]!;
    const child = rememberDelegatedReport(state, "user-1", "codex-b", "child", "project:ember/provenance", "Child", [rootEvidenceId]);
    const rootEvidence = findEvidence(state, rootEvidenceId);

    // When
    rootEvidence.scope = "project:private";

    // Then
    assert.throws(() => validateState(state), /derivation crosses evidence scope|source evidence scope mismatch/);
    assert.ok(findMeaning(state, child));
});

function meaningWith(meanings: ProjectedMeaning[], marker: string): ProjectedMeaning {
    const meaning = meanings.find(item => item.content.includes(marker));
    assert.ok(meaning, `missing projected meaning with marker ${marker}`);
    return meaning;
}

function roots(meaning: ProjectedMeaning): string[] {
    const ids = new Set(meaning.source_evidence.map(item => String(item.evidence_id)));
    return meaning.source_evidence
        .filter(item => item.derived_from_evidence_ids.length === 0)
        .map(item => String(item.evidence_id))
        .filter(id => ids.has(id))
        .sort();
}

function harnessOutput(backend: string, result: ProviderResult) {
    return {
        result,
        backend_metadata: {
            backend,
            adapter: "test-provider",
            version: "1",
            configuration: { deterministic: true },
        },
    };
}
