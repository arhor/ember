import assert from "node:assert/strict";
import test from "node:test";

import type { MemoryProposalCandidate } from "./memory-proposal.ts";
import type { EvidenceId } from "./model.ts";

import { assessMemoryProposal } from "./memory-proposal.ts";
import { initialState } from "./model.ts";
import {
    attachDetail,
    rememberDirectObservation,
    rememberEpisode,
    rememberExternalClaim,
    rememberFact,
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
