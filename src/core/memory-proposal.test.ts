import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryProposalCandidate } from "./memory-proposal.ts";
import type { EvidenceId } from "./model.ts";

import { assessMemoryProposal, resolveMemoryProposal } from "./memory-proposal.ts";
import { initialState } from "./model.ts";
import {
    attachDetail,
    rememberDirectObservation,
    rememberEpisode,
    rememberExternalClaim,
    rememberFact,
    rememberPreference,
    supersede,
    userEvidence,
    withholdDetail,
} from "./semantics.ts";

const PRINCIPAL = "user-1";
const SCOPE = "project:ember";

function candidate(evidenceId: EvidenceId, overrides: Partial<MemoryProposalCandidate> = {}): MemoryProposalCandidate {
    return {
        proposal_version: 1,
        proposal_id: "memory-proposal-1",
        proposed_at: "2026-09-11T12:00:00Z",
        kind: "preference",
        owner: `user:${PRINCIPAL}`,
        slot: "response-style",
        scope: SCOPE,
        content: "The user prefers concise responses",
        source_evidence_ids: [evidenceId],
        epistemic_role: "user_testimony",
        applicable_from: "2026-09-11T12:00:00Z",
        applicable_until: null,
        proposed_currentness: "current",
        confidence: { source: "high", proposition: "high", interpretation: "medium" },
        uncertainty: "The preference may be task-specific",
        supersedes_meaning_id: null,
        ...overrides,
    };
}

test("valid evidence-grounded candidate remains non-canonical and proposed", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "Please keep your answers short");
    const before = structuredClone(state);

    const result = assessMemoryProposal(state, candidate(evidence.evidenceId));

    assert.equal(result.status, "valid");
    if (result.status === "valid") {
        assert.equal(result.proposal.status, "proposed");
        assert.equal(result.proposal.resolution, null);
    }
    assert.deepEqual(state, before);
    assert.equal(state.meanings.length, 0);
});

test("missing, duplicate, and cross-scope evidence are invalid explicitly", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "Please keep your answers short");
    const other = userEvidence(state, PRINCIPAL, "project:private", "Private preference");

    assert.equal(assessMemoryProposal(state, candidate("evidence-missing" as EvidenceId)).status, "invalid");
    assert.deepEqual(
        assessMemoryProposal(
            state,
            candidate(evidence.evidenceId, { source_evidence_ids: [evidence.evidenceId, evidence.evidenceId] }),
        ),
        { status: "invalid", reason: "duplicate_evidence", detail: "source evidence IDs must be unique" },
    );
    const crossScope = assessMemoryProposal(state, candidate(other.evidenceId));
    assert.deepEqual(crossScope.status === "invalid" ? crossScope.reason : null, "evidence_scope_mismatch");
});

test("unavailable user detail cannot regenerate content through a proposal", () => {
    const state = initialState("Ember", PRINCIPAL);
    const episodeId = rememberEpisode(state, PRINCIPAL, "milestone", "ember", SCOPE, "A private milestone occurred");
    const detailId = attachDetail(state, PRINCIPAL, episodeId, "The unavailable exact private detail");
    withholdDetail(state, PRINCIPAL, detailId);

    const result = assessMemoryProposal(state, candidate(detailId));

    assert.deepEqual(result.status === "invalid" ? result.reason : null, "unavailable_evidence");
});

test("every evidence item must match canonical provenance and attributed source actor", () => {
    const state = initialState("Ember", PRINCIPAL);
    const user = userEvidence(state, PRINCIPAL, SCOPE, "A mixed source claim");
    rememberExternalClaim(state, PRINCIPAL, "source-b", "weather", SCOPE, "The forecast says rain");
    const external = state.evidence.at(-1)!;
    const externalCandidate = candidate(external.evidenceId, {
        kind: "fact",
        owner: "external:source-a",
        slot: "weather",
        epistemic_role: "external_claim",
    });

    const wrongActor = assessMemoryProposal(state, externalCandidate);
    const mixed = assessMemoryProposal(state, {
        ...externalCandidate,
        owner: "external:source-b",
        source_evidence_ids: [external.evidenceId, user.evidenceId],
    });

    assert.deepEqual(wrongActor.status === "invalid" ? wrongActor.reason : null, "semantic_mismatch");
    assert.deepEqual(mixed.status === "invalid" ? mixed.reason : null, "semantic_mismatch");
});

test("commitment proposal is an explicit unsupported state", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "You should promise to check tomorrow");

    const result = assessMemoryProposal(
        state,
        candidate(evidence.evidenceId, {
            kind: "commitment",
            owner: "ember",
            epistemic_role: "ember_commitment",
        }),
    );

    assert.equal(result.status, "unsupported");
    if (result.status === "unsupported") assert.equal(result.kind, "commitment");
});

test("supersession must target the current meaning in the same semantic slot", () => {
    const state = initialState("Ember", PRINCIPAL);
    const oldId = rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "city", SCOPE, "The user lives in Paris");
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "I moved to Warsaw");
    const valid = assessMemoryProposal(
        state,
        candidate(evidence.evidenceId, {
            kind: "fact",
            slot: "city",
            content: "The user lives in Warsaw",
            supersedes_meaning_id: oldId,
        }),
    );
    const wrongSlot = assessMemoryProposal(
        state,
        candidate(evidence.evidenceId, {
            kind: "fact",
            supersedes_meaning_id: oldId,
        }),
    );

    assert.equal(valid.status, "valid");
    assert.deepEqual(wrongSlot.status === "invalid" ? wrongSlot.reason : null, "invalid_supersession");
});

test("v1 supersession rejects non-user-testimony facts", () => {
    const state = initialState("Ember", PRINCIPAL);
    const oldId = rememberDirectObservation(state, PRINCIPAL, "build-status", SCOPE, "The build failed");
    const evidence = state.evidence.at(-1)!;

    const result = assessMemoryProposal(
        state,
        candidate(evidence.evidenceId, {
            kind: "fact",
            owner: "ember",
            slot: "build-status",
            content: "The build passed",
            epistemic_role: "direct_observation",
            supersedes_meaning_id: oldId,
        }),
    );

    assert.deepEqual(result.status === "invalid" ? result.reason : null, "invalid_supersession");
});

test("v1 fact and preference proposals reject a finite applicability end", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "This preference is only for today");

    for (const kind of ["fact", "preference"] as const) {
        const result = assessMemoryProposal(
            state,
            candidate(evidence.evidenceId, {
                kind,
                applicable_until: "2026-09-12T00:00:00Z",
            }),
        );

        assert.deepEqual(result.status === "invalid" ? result.reason : null, "semantic_mismatch");
    }
});

test("unknown shapes and unknown proposal kinds are invalid rather than silently coerced", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "Please keep your answers short");
    const malformed = { ...candidate(evidence.evidenceId), providerMetadata: {} };
    const unknown = { ...candidate(evidence.evidenceId), kind: "belief" };

    assert.equal(assessMemoryProposal(state, malformed).status, "invalid");
    assert.equal(assessMemoryProposal(state, unknown).status, "invalid");
});

function proposed(state: ReturnType<typeof initialState>, value: MemoryProposalCandidate) {
    const result = assessMemoryProposal(state, value);
    assert.equal(result.status, "valid");
    if (result.status !== "valid") throw new Error("expected a valid proposal");
    return result.proposal;
}

test("adoption creates canonical meaning from durable evidence without mutating inputs", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "Please keep your answers short");
    const proposal = proposed(state, candidate(evidence.evidenceId));
    const before = structuredClone(state);

    const result = resolveMemoryProposal(state, proposal, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });

    assert.equal(result.proposal.status, "adopted");
    assert.deepEqual(state, before);
    assert.equal(result.state.meanings.length, 1);
    assert.deepEqual(result.state.meanings[0]!.sourceEvidenceIds, [evidence.evidenceId]);
    assert.equal(result.state.meanings[0]!.learnedAt, "2026-09-11T12:01:00Z");
});

test("adoption is repeatable for identical deterministic inputs", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "The build log reports a recurring issue");
    const proposal = proposed(
        state,
        candidate(evidence.evidenceId, {
            kind: "fact",
            owner: "ember",
            slot: "build-pattern",
            content: "The failure appears recurrent",
            epistemic_role: "ember_inference",
        }),
    );

    const first = resolveMemoryProposal(state, proposal, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });
    const second = resolveMemoryProposal(state, proposal, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });

    assert.deepEqual(first, second);
});

test("duplicate and implicit conflict proposals are rejected explicitly", () => {
    const state = initialState("Ember", PRINCIPAL);
    const existingId = rememberPreference(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "response-style",
        SCOPE,
        "The user prefers concise responses",
    );
    const existing = state.meanings.find((meaning) => meaning.meaningId === existingId)!;
    const duplicate = proposed(
        state,
        candidate(existing.sourceEvidenceIds[0]!, {
            applicable_from: existing.applicableFrom,
            uncertainty: existing.uncertainty,
        }),
    );
    const correctionEvidence = userEvidence(state, PRINCIPAL, SCOPE, "Please be detailed now");
    const conflict = proposed(
        state,
        candidate(correctionEvidence.evidenceId, { content: "The user prefers detailed responses" }),
    );

    const duplicateResult = resolveMemoryProposal(state, duplicate, state.revision, {
        decidedAt: "2026-09-11T12:01:00Z",
    });
    const conflictResult = resolveMemoryProposal(state, conflict, state.revision, {
        decidedAt: "2026-09-11T12:01:00Z",
    });

    assert.equal(
        duplicateResult.proposal.status === "rejected" && duplicateResult.proposal.resolution.reason,
        "duplicate",
    );
    assert.equal(
        conflictResult.proposal.status === "rejected" && conflictResult.proposal.resolution.reason,
        "conflict_requires_supersession",
    );
    assert.deepEqual(duplicateResult.state, state);
    assert.deepEqual(conflictResult.state, state);
});

test("explicit supersession preserves historical meaning, links, and correction provenance", () => {
    const state = initialState("Ember", PRINCIPAL);
    const oldId = rememberFact(state, PRINCIPAL, `user:${PRINCIPAL}`, "city", SCOPE, "The user lives in Paris");
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "I moved to Warsaw");
    const proposal = proposed(
        state,
        candidate(evidence.evidenceId, {
            kind: "fact",
            slot: "city",
            content: "The user lives in Warsaw",
            supersedes_meaning_id: oldId,
        }),
    );

    const result = resolveMemoryProposal(state, proposal, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });
    assert.equal(result.proposal.status, "adopted");
    if (result.proposal.status !== "adopted") return;
    const old = result.state.meanings.find((meaning) => meaning.meaningId === oldId)!;
    const replacement = result.state.meanings.find(
        (meaning) => meaning.meaningId === result.proposal.resolution.meaning_id,
    )!;
    assert.deepEqual([old.currentness, old.supersededBy], ["superseded", replacement.meaningId]);
    assert.deepEqual([replacement.supersedes, replacement.sourceEvidenceIds], [oldId, [evidence.evidenceId]]);
});

test("explicit no-op supersession is rejected without manufacturing correction history", () => {
    const state = initialState("Ember", PRINCIPAL);
    const oldId = rememberPreference(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "response-style",
        SCOPE,
        "The user prefers concise responses",
    );
    const old = state.meanings.find((meaning) => meaning.meaningId === oldId)!;
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "I still prefer concise responses");
    const proposal = proposed(
        state,
        candidate(evidence.evidenceId, {
            applicable_from: old.applicableFrom,
            uncertainty: old.uncertainty,
            supersedes_meaning_id: oldId,
        }),
    );

    const result = resolveMemoryProposal(state, proposal, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });

    assert.equal(result.proposal.status === "rejected" && result.proposal.resolution.reason, "duplicate");
    assert.deepEqual(result.state, state);
    assert.deepEqual([old.currentness, old.supersededBy], ["current", null]);
});

test("stale revision and stale supersession fail closed without canonical mutation", () => {
    const state = initialState("Ember", PRINCIPAL);
    const oldId = rememberPreference(state, PRINCIPAL, `user:${PRINCIPAL}`, "style", SCOPE, "Concise");
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "Detailed instead");
    const proposal = proposed(
        state,
        candidate(evidence.evidenceId, { slot: "style", content: "Detailed", supersedes_meaning_id: oldId }),
    );

    const staleRevision = resolveMemoryProposal(state, proposal, state.revision + 1, {
        decidedAt: "2026-09-11T12:01:00Z",
    });
    const changed = structuredClone(state);
    supersede(changed, PRINCIPAL, oldId, "Another correction");
    const staleTarget = resolveMemoryProposal(changed, proposal, changed.revision, {
        decidedAt: "2026-09-11T12:01:00Z",
    });

    assert.equal(
        staleRevision.proposal.status === "rejected" && staleRevision.proposal.resolution.reason,
        "stale_revision",
    );
    assert.equal(
        staleTarget.proposal.status === "rejected" && staleTarget.proposal.resolution.reason,
        "supersession_stale",
    );
    assert.deepEqual(staleRevision.state, state);
    assert.deepEqual(staleTarget.state, changed);
});

test("low-confidence proposals are rejected and Ember inference adoption creates derived provenance", () => {
    const state = initialState("Ember", PRINCIPAL);
    const evidence = userEvidence(state, PRINCIPAL, SCOPE, "The build log reports a recurring issue");
    const weak = proposed(
        state,
        candidate(evidence.evidenceId, {
            confidence: { source: "high", proposition: "low", interpretation: "medium" },
        }),
    );
    const inference = proposed(
        state,
        candidate(evidence.evidenceId, {
            kind: "fact",
            owner: "ember",
            slot: "build-pattern",
            content: "The failure appears recurrent",
            epistemic_role: "ember_inference",
        }),
    );

    const rejected = resolveMemoryProposal(state, weak, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });
    const adopted = resolveMemoryProposal(state, inference, state.revision, { decidedAt: "2026-09-11T12:01:00Z" });

    assert.equal(
        rejected.proposal.status === "rejected" && rejected.proposal.resolution.reason,
        "insufficient_confidence",
    );
    assert.equal(adopted.proposal.status, "adopted");
    const derived = adopted.state.evidence.at(-1)!;
    assert.equal(derived.sourceRole, "ember_inference");
    assert.deepEqual(derived.derivedFromEvidenceIds, [evidence.evidenceId]);
    assert.deepEqual(adopted.state.meanings[0]!.sourceEvidenceIds, [derived.evidenceId]);
});
