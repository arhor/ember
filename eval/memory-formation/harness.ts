import { readFile } from "node:fs/promises";

import type { MemoryProposalCandidate } from "../../src/core/memory-proposal.ts";
import type { Meaning, MeaningId, RuntimeId } from "../../src/core/model.ts";
import type {
    MemoryProposalGenerationOutcome,
    MemoryProposalGenerator,
    MemoryProposalGenerationRequest,
} from "../../src/memory/memory-proposal-generation.ts";

import { ValidationError } from "../../src/core/errors.ts";
import { initialState, isRfc3339Utc } from "../../src/core/model.ts";
import { MemoryProposalGenerationStore } from "../../src/persistence/memory-proposal-generation-store.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { runCognition, startRuntime, stopRuntime } from "../../src/runtime/runtime.ts";
import { exactKeys, isObject } from "../../src/util.ts";

export type ExpectedDecision = "adopted" | "rejected" | "invalid" | "no_proposal";

export interface MemoryFormationCandidateFixture {
    kind: "fact" | "preference" | "relationship" | "episode_meta";
    slot: string;
    content: string;
    source: "current_input" | "missing";
    confidence?: "high" | "medium" | "low";
    supersedes_episode?: string;
    scope?: string;
}

export interface MemoryFormationEpisode {
    id: string;
    at: string;
    input: string;
    restart?: boolean;
    candidate?: MemoryFormationCandidateFixture;
    expect: {
        decision: ExpectedDecision;
        live_decisions?: ExpectedDecision[];
        reason?: string;
        current_content?: string;
    };
}

export interface MemoryFormationScenario {
    scenario_version: 1;
    id: string;
    description: string;
    ember: { name: string; principal: string; scope: string; initial_at: string };
    episodes: MemoryFormationEpisode[];
}

export interface MemoryFormationGeneratorInvocation {
    scenarioId: string;
    episode: MemoryFormationEpisode;
    request: MemoryProposalGenerationRequest;
    scriptedResult: ReturnType<typeof scriptedGenerationResult>;
}

export type MemoryFormationGenerator = (
    invocation: MemoryFormationGeneratorInvocation,
) => ReturnType<MemoryProposalGenerator>;

export async function loadMemoryFormationScenario(path: string): Promise<MemoryFormationScenario> {
    const candidate: unknown = JSON.parse(await readFile(path, "utf8"));
    validateScenario(candidate);
    return candidate;
}

export async function runMemoryFormationScenario(
    scenario: MemoryFormationScenario,
    statePath: string,
    generator?: MemoryFormationGenerator,
) {
    validateScenario(scenario);
    const liveEvaluation = generator !== undefined;
    const store = new StateStore(statePath);
    await store.create(initialState(scenario.ember.name, scenario.ember.principal, scenario.ember.initial_at));
    const lease = await store.acquireWriteLease();
    const previousNow = process.env.EMBER_TEST_NOW;
    let state = await store.load();
    let runtimeId: RuntimeId | null = null;
    const adoptedByEpisode = new Map<string, MeaningId>();
    const episodes = [];
    let finalProjectedEvidenceIds: string[] = [];

    try {
        for (const episode of scenario.episodes) {
            process.env.EMBER_TEST_NOW = episode.at;
            if (runtimeId === null || episode.restart) {
                if (runtimeId !== null) {
                    state = stopRuntime(state, runtimeId, { reason: `memory_formation_eval:${episode.id}` });
                    state = await store.commit((await store.load()).revision, state);
                }
                state = await store.load();
                const started = startRuntime(state, scenario.ember.principal, scenario.ember.scope);
                state = await store.commit(state.revision, started.state);
                runtimeId = started.runtimeId;
            }

            let projectedBytes = 0;
            let projectedEvidenceIds: string[] = [];
            let memoryGeneratorInvoked = false;
            const beforeLedgerCount = (await new MemoryProposalGenerationStore(store.path).load()).generations.length;
            const result = await runCognition(store, state, {
                runtimeId,
                principal: scenario.ember.principal,
                scope: scenario.ember.scope,
                text: episode.input,
                providerLabel: "memory-formation-evaluation-provider",
                provider: async (request) => ({
                    contractVersion: 1,
                    reply: "Acknowledged.",
                    usedMeaningIds: request.projection.selection.meaning_ids,
                }),
                timeoutSeconds: 300,
                output: () => {},
                memoryProposalProviderLabel: generator
                    ? "live-memory-formation-generator"
                    : "scripted-memory-formation-generator",
                memoryProposalGenerator: async (request) => {
                    memoryGeneratorInvoked = true;
                    projectedBytes = Buffer.byteLength(JSON.stringify(request.projection), "utf8");
                    projectedEvidenceIds = request.projection.selection.source_evidence_ids.map(String);
                    const scriptedResult = scriptedGenerationResult(scenario, episode, request, adoptedByEpisode);
                    return generator
                        ? generator({ scenarioId: scenario.id, episode, request, scriptedResult })
                        : scriptedResult;
                },
            });
            state = result.state;
            if (result.memoryProposalFailure) throw new Error(result.memoryProposalFailure);

            const ledger = await new MemoryProposalGenerationStore(store.path).load();
            const record = ledger.generations[beforeLedgerCount];
            if (!record || record.status !== "completed")
                throw new Error(`episode ${episode.id} has no completed generation`);
            const observedDecision = decisionFromOutcomes(record.outcomes);
            const observedReason = reasonFromOutcomes(record.outcomes);
            const adopted = record.outcomes.find((outcome) => outcome.status === "adopted");
            if (adopted?.status === "adopted" && adopted.proposal.status === "adopted")
                adoptedByEpisode.set(episode.id, adopted.proposal.resolution.meaning_id);
            const currentMatches = episode.expect.current_content
                ? state.meanings.some(
                      (meaning) =>
                          meaning.currentness === "current" && meaning.content === episode.expect.current_content,
                  )
                : true;
            const provenance =
                adopted?.status === "adopted" && adopted.proposal.status === "adopted"
                    ? inspectProvenance(
                          state.meanings,
                          state.evidence,
                          adopted.proposal.resolution.meaning_id,
                          scenario.ember.principal,
                          scenario.ember.scope,
                      )
                    : null;
            const allowedDecisions = liveEvaluation
                ? (episode.expect.live_decisions ?? [episode.expect.decision])
                : [episode.expect.decision];
            const exactScriptedExpectationPassed =
                observedDecision === episode.expect.decision &&
                (episode.expect.reason === undefined || observedReason === episode.expect.reason) &&
                currentMatches;
            const liveModelObservationPassed = allowedDecisions.includes(observedDecision) && currentMatches;
            const assertionPassed =
                memoryGeneratorInvoked &&
                (provenance?.passed ?? true) &&
                (liveEvaluation || exactScriptedExpectationPassed);
            episodes.push({
                id: episode.id,
                restart: episode.restart ?? false,
                memory_generator_invoked: memoryGeneratorInvoked,
                memory_generator_invoked_after_restart: episode.restart ? memoryGeneratorInvoked : null,
                expected_decision: episode.expect.decision,
                allowed_live_decisions: episode.expect.live_decisions ?? [episode.expect.decision],
                observed_decision: observedDecision,
                observed_reason: observedReason,
                adoption_decisions: record.outcomes,
                source_evidence_ids: record.source_evidence_ids,
                provenance,
                bounded_projection_size_bytes: projectedBytes,
                projected_source_evidence_ids: projectedEvidenceIds,
                current_meaning_count: state.meanings.filter((meaning) => meaning.currentness === "current").length,
                ember_assertions_passed: assertionPassed,
                model_observations_passed: liveEvaluation ? liveModelObservationPassed : true,
            });
            finalProjectedEvidenceIds = projectedEvidenceIds;
        }
    } finally {
        if (previousNow === undefined) delete process.env.EMBER_TEST_NOW;
        else process.env.EMBER_TEST_NOW = previousNow;
        await store.releaseWriteLease(lease);
    }

    const metrics = calculateMetrics(episodes, state.meanings);
    const firstAdoption = episodes.find((episode) => episode.observed_decision === "adopted" && episode.provenance);
    const contextPersistence = {
        adopted_source_still_projected: firstAdoption
            ? firstAdoption.source_evidence_ids.some((id) => finalProjectedEvidenceIds.includes(id))
            : null,
        adopted_meaning_still_available: firstAdoption
            ? state.meanings.some((meaning) => meaning.meaningId === firstAdoption.provenance?.meaning_id)
            : false,
    };
    return {
        report_version: 1,
        evaluation_mode: liveEvaluation ? "live" : "deterministic",
        scenario_id: scenario.id,
        description: scenario.description,
        scorecard_input: true,
        ember_assertions_passed:
            episodes.every((episode) => episode.ember_assertions_passed) &&
            (liveEvaluation
                ? metrics.duplicate_adoption.count === 0 && metrics.scope_provenance_violations.count === 0
                : metrics.all_zero),
        model_observations_passed: episodes.every((episode) => episode.model_observations_passed),
        metrics,
        context_size: {
            projection_bytes_by_episode: Object.fromEntries(
                episodes.map((episode) => [episode.id, episode.bounded_projection_size_bytes]),
            ),
            min_bytes: Math.min(...episodes.map((episode) => episode.bounded_projection_size_bytes)),
            max_bytes: Math.max(...episodes.map((episode) => episode.bounded_projection_size_bytes)),
        },
        context_persistence: contextPersistence,
        episodes,
    };
}

function scriptedGenerationResult(
    scenario: MemoryFormationScenario,
    episode: MemoryFormationEpisode,
    request: MemoryProposalGenerationRequest,
    adoptedByEpisode: Map<string, MeaningId>,
) {
    if (!episode.candidate) return { contractVersion: 1 as const, candidates: [] };
    const fixture = episode.candidate;
    const currentInput = request.projection.turns.findLast(
        (turn) => turn.role === "user" && turn.content === episode.input,
    );
    const owner =
        fixture.kind === "relationship"
            ? `relationship:${scenario.ember.principal}`
            : `user:${scenario.ember.principal}`;
    const confidence = fixture.confidence ?? "high";
    const candidate: MemoryProposalCandidate = {
        proposal_version: 1,
        proposal_id: "memory-proposal-fixture",
        proposed_at: request.proposedAt,
        kind: fixture.kind,
        owner,
        slot: fixture.slot,
        scope: fixture.scope ?? scenario.ember.scope,
        content: fixture.content,
        source_evidence_ids: [
            fixture.source === "missing"
                ? ("evidence-not-in-projection" as MemoryProposalCandidate["source_evidence_ids"][number])
                : currentInput!.evidence_id,
        ],
        epistemic_role: "user_testimony",
        applicable_from: request.proposedAt,
        applicable_until: null,
        proposed_currentness: "current",
        confidence: { source: "high", proposition: confidence, interpretation: confidence },
        uncertainty: confidence === "low" ? "The statement is ambiguous and should remain transient." : null,
        supersedes_meaning_id: fixture.supersedes_episode
            ? (adoptedByEpisode.get(fixture.supersedes_episode) ?? null)
            : null,
    };
    return { contractVersion: 1 as const, candidates: [candidate] };
}

function decisionFromOutcomes(outcomes: MemoryProposalGenerationOutcome[]): ExpectedDecision {
    if (outcomes.length === 0) return "no_proposal";
    if (outcomes.some((outcome) => outcome.status === "adopted")) return "adopted";
    if (outcomes.some((outcome) => outcome.status === "rejected")) return "rejected";
    return "invalid";
}

function reasonFromOutcomes(outcomes: MemoryProposalGenerationOutcome[]) {
    const outcome = outcomes[0];
    if (!outcome) return null;
    if (outcome.status === "invalid" || outcome.status === "unsupported")
        return outcome.assessment.status === "invalid" ? outcome.assessment.reason : outcome.assessment.kind;
    if (outcome.status === "rejected" && outcome.proposal.status === "rejected")
        return outcome.proposal.resolution.reason;
    return null;
}

function inspectProvenance(
    meanings: Meaning[],
    evidence: Array<{
        evidenceId: string;
        sourceRole: string;
        sourceActor: string;
        assertedPrincipal?: string;
        scope: string;
    }>,
    meaningId: MeaningId,
    principal: string,
    expectedScope: string,
) {
    const meaning = meanings.find((item) => item.meaningId === meaningId)!;
    const roots = meaning.sourceEvidenceIds.map((id) => evidence.find((item) => item.evidenceId === id));
    const expectedOwner = meaning.kind === "relationship" ? `relationship:${principal}` : `user:${principal}`;
    return {
        meaning_id: meaningId,
        meaning_scope: meaning.scope,
        meaning_owner: meaning.owner,
        source_evidence_ids: meaning.sourceEvidenceIds,
        source_roles: roots.map((item) => item?.sourceRole ?? "missing"),
        source_scopes: roots.map((item) => item?.scope ?? "missing"),
        source_actors: roots.map((item) => item?.sourceActor ?? "missing"),
        passed:
            meaning.scope === expectedScope &&
            meaning.owner === expectedOwner &&
            roots.length > 0 &&
            roots.every(
                (item) =>
                    item?.sourceRole === "user_command" &&
                    item.sourceActor === `user:${principal}` &&
                    item.assertedPrincipal === principal &&
                    item.scope === expectedScope,
            ),
    };
}

interface MetricsEpisode {
    id: string;
    expected_decision: ExpectedDecision;
    observed_decision: ExpectedDecision;
    ember_assertions_passed: boolean;
    model_observations_passed: boolean;
    provenance: { passed: boolean } | null;
}

function calculateMetrics(episodes: MetricsEpisode[], meanings: Meaning[]) {
    const falseAdoption = episodes.filter(
        (episode) => episode.expected_decision !== "adopted" && episode.observed_decision === "adopted",
    ).length;
    const missedAdoption = episodes.filter(
        (episode) => episode.expected_decision === "adopted" && episode.observed_decision !== "adopted",
    ).length;
    const duplicateSlots = new Map<string, number>();
    for (const meaning of meanings.filter((item) => item.currentness === "current")) {
        const key = [meaning.kind, meaning.owner, meaning.slot, meaning.scope].join("\u0000");
        duplicateSlots.set(key, (duplicateSlots.get(key) ?? 0) + 1);
    }
    const duplicateAdoption = [...duplicateSlots.values()].filter((count) => count > 1).length;
    const correctionErrors = episodes.filter(
        (episode) => episode.id.includes("correction") && !episode.model_observations_passed,
    ).length;
    const staleMemoryRevival = episodes.filter(
        (episode) => episode.id.includes("stale-revival") && episode.observed_decision === "adopted",
    ).length;
    const scopeProvenanceViolations = episodes.filter(
        (episode) => episode.provenance && !episode.provenance.passed,
    ).length;
    return {
        false_adoption: metric(
            falseAdoption,
            episodes.filter((episode) => episode.expected_decision !== "adopted").length,
        ),
        missed_adoption: metric(
            missedAdoption,
            episodes.filter((episode) => episode.expected_decision === "adopted").length,
        ),
        duplicate_adoption: { count: duplicateAdoption },
        correction_supersession: {
            errors: correctionErrors,
            cases: episodes.filter((episode) => episode.id.includes("correction")).length,
            accuracy:
                1 -
                correctionErrors / Math.max(1, episodes.filter((episode) => episode.id.includes("correction")).length),
        },
        stale_memory_revival: { count: staleMemoryRevival },
        scope_provenance_violations: { count: scopeProvenanceViolations },
        all_zero: [
            falseAdoption,
            missedAdoption,
            duplicateAdoption,
            correctionErrors,
            staleMemoryRevival,
            scopeProvenanceViolations,
        ].every((count) => count === 0),
    };
}

function metric(count: number, opportunities: number) {
    return { count, opportunities, rate: count / Math.max(1, opportunities) };
}

function validateScenario(value: unknown): asserts value is MemoryFormationScenario {
    if (!isObject(value) || !exactKeys(value, ["scenario_version", "id", "description", "ember", "episodes"]))
        throw new ValidationError("memory formation scenario contains missing or unsupported fields");
    if (
        value.scenario_version !== 1 ||
        !nonBlank(value.id) ||
        !nonBlank(value.description) ||
        !Array.isArray(value.episodes)
    )
        throw new ValidationError("memory formation scenario header is invalid");
    if (
        !isObject(value.ember) ||
        !exactKeys(value.ember, ["name", "principal", "scope", "initial_at"]) ||
        !nonBlank(value.ember.name) ||
        !nonBlank(value.ember.principal) ||
        !nonBlank(value.ember.scope) ||
        !isRfc3339Utc(value.ember.initial_at)
    )
        throw new ValidationError("memory formation scenario Ember identity is invalid");
    const ids = new Set<string>();
    for (const episode of value.episodes) {
        if (
            !isObject(episode) ||
            !nonBlank(episode.id) ||
            ids.has(episode.id) ||
            !isRfc3339Utc(episode.at) ||
            !nonBlank(episode.input) ||
            !isObject(episode.expect) ||
            !["adopted", "rejected", "invalid", "no_proposal"].includes(String(episode.expect.decision)) ||
            (episode.expect.live_decisions !== undefined &&
                (!Array.isArray(episode.expect.live_decisions) ||
                    episode.expect.live_decisions.length === 0 ||
                    !episode.expect.live_decisions.every((decision) =>
                        ["adopted", "rejected", "invalid", "no_proposal"].includes(String(decision)),
                    ) ||
                    (episode.expect.decision === "adopted"
                        ? episode.expect.live_decisions.some((decision) => decision !== "adopted")
                        : episode.expect.live_decisions.includes("adopted"))))
        )
            throw new ValidationError("memory formation episode is invalid or duplicated");
        ids.add(episode.id);
    }
}

function nonBlank(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}
