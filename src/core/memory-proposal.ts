import type {
    EmberInferenceEvidence,
    EmberState,
    EpistemicRole,
    EvidenceId,
    Meaning,
    MeaningId,
    MeaningKind,
} from "./model.ts";

import { contentDigest, exactKeys, isNotBlankString, isObject } from "../util.ts";
import { isRfc3339Utc, validateState } from "./model.ts";

export type MemoryProposalId = `memory-proposal-${string}`;
export type ProposableMeaningKind = Exclude<MeaningKind, "commitment">;
export type MemoryConfidence = "high" | "medium" | "low" | "not_applicable";

export interface MemoryProposalConfidence {
    source: MemoryConfidence;
    proposition: MemoryConfidence;
    interpretation: MemoryConfidence;
}

export interface MemoryProposalCandidate {
    proposal_version: 1;
    proposal_id: MemoryProposalId;
    proposed_at: string;
    kind: MeaningKind;
    owner: string;
    slot: string;
    scope: string;
    content: string;
    source_evidence_ids: EvidenceId[];
    epistemic_role: EpistemicRole;
    applicable_from: string;
    applicable_until: string | null;
    proposed_currentness: "current";
    confidence: MemoryProposalConfidence;
    uncertainty: string | null;
    supersedes_meaning_id: MeaningId | null;
}

interface MemoryProposalBase extends Omit<MemoryProposalCandidate, "kind"> {
    kind: ProposableMeaningKind;
}

export interface ProposedMemoryProposal extends MemoryProposalBase {
    status: "proposed";
    resolution: null;
}

export interface AdoptedMemoryProposal extends MemoryProposalBase {
    status: "adopted";
    resolution: {
        decided_at: string;
        meaning_id: MeaningId;
    };
}

export interface RejectedMemoryProposal extends MemoryProposalBase {
    status: "rejected";
    resolution: {
        decided_at: string;
        reason: MemoryProposalRejectionReason;
    };
}

export type MemoryProposal = ProposedMemoryProposal | AdoptedMemoryProposal | RejectedMemoryProposal;

export type MemoryProposalRejectionReason =
    | "stale_revision"
    | "duplicate"
    | "conflict_requires_supersession"
    | "supersession_stale"
    | "proposal_no_longer_valid"
    | "deterministic_id_collision"
    | "insufficient_confidence";

export interface MemoryProposalResolution {
    proposal: AdoptedMemoryProposal | RejectedMemoryProposal;
    state: EmberState;
}

export type InvalidMemoryProposalReason =
    | "invalid_representation"
    | "missing_evidence"
    | "duplicate_evidence"
    | "unavailable_evidence"
    | "evidence_scope_mismatch"
    | "semantic_mismatch"
    | "invalid_supersession";

export type MemoryProposalAssessment =
    | { status: "valid"; proposal: ProposedMemoryProposal }
    | { status: "invalid"; reason: InvalidMemoryProposalReason; detail: string }
    | { status: "unsupported"; kind: string; detail: string };

const CANDIDATE_FIELDS = [
    "applicable_from",
    "applicable_until",
    "confidence",
    "content",
    "epistemic_role",
    "kind",
    "owner",
    "proposal_id",
    "proposal_version",
    "proposed_at",
    "proposed_currentness",
    "scope",
    "slot",
    "source_evidence_ids",
    "supersedes_meaning_id",
    "uncertainty",
];
const CONFIDENCE_FIELDS = ["interpretation", "proposition", "source"];
const CONFIDENCE_VALUES = new Set<MemoryConfidence>(["high", "medium", "low", "not_applicable"]);
const EPISTEMIC_ROLES = new Set<EpistemicRole>([
    "user_testimony",
    "ember_inference",
    "external_claim",
    "direct_observation",
    "delegated_report",
    "ember_commitment",
]);
const PROPOSABLE_KINDS = new Set<ProposableMeaningKind>(["relationship", "fact", "preference", "episode_meta"]);
const MEANING_KINDS = new Set<MeaningKind>(["relationship", "fact", "preference", "commitment", "episode_meta"]);

/**
 * Checks a provider-independent candidate against existing durable Ember evidence.
 * The function is read-only: even a valid result is only a proposal and never a
 * canonical Meaning.
 */
export function assessMemoryProposal(state: EmberState, candidate: unknown): MemoryProposalAssessment {
    validateState(state);
    const representationError = validateRepresentation(candidate);
    if (representationError) {
        return { status: "invalid", reason: "invalid_representation", detail: representationError };
    }

    const represented = candidate as MemoryProposalCandidate;
    if (!PROPOSABLE_KINDS.has(represented.kind as ProposableMeaningKind)) {
        return {
            status: "unsupported",
            kind: represented.kind,
            detail: "commitments require an Ember-owned undertaking boundary and cannot be formed as memory proposals",
        };
    }

    const typed = represented as MemoryProposalCandidate & { kind: ProposableMeaningKind };
    const evidenceIds = typed.source_evidence_ids;
    if (new Set(evidenceIds).size !== evidenceIds.length) {
        return invalid("duplicate_evidence", "source evidence IDs must be unique");
    }
    const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence]));
    const evidence = evidenceIds.map((id) => evidenceById.get(id));
    if (evidence.some((item) => item === undefined)) {
        return invalid("missing_evidence", "every source evidence ID must resolve in durable Ember evidence");
    }
    if (evidence.some((item) => item!.scope !== typed.scope)) {
        return invalid("evidence_scope_mismatch", "proposal evidence cannot cross the proposed scope");
    }
    if (evidence.some((item) => item!.sourceRole === "user_command" && item!.availability === "unavailable")) {
        return invalid(
            "unavailable_evidence",
            "unavailable user evidence cannot ground a content-bearing memory proposal",
        );
    }

    const semanticError = validateKindSemantics(state.runtimeContract.localPrincipal, typed);
    if (semanticError) return invalid("semantic_mismatch", semanticError);
    const provenanceError = validateProvenance(typed, evidence as NonNullable<(typeof evidence)[number]>[]);
    if (provenanceError) return invalid("semantic_mismatch", provenanceError);

    const supersessionError = validateSupersession(state, typed);
    if (supersessionError) return invalid("invalid_supersession", supersessionError);

    return { status: "valid", proposal: { ...typed, status: "proposed", resolution: null } };
}

/**
 * Deterministically resolves an assessed proposal against one canonical revision.
 * The input state and proposal remain unchanged; callers may commit the returned
 * state with the same expected revision through the canonical state store.
 */
export function resolveMemoryProposal(
    state: EmberState,
    proposal: ProposedMemoryProposal,
    expectedRevision: number,
    { decidedAt }: { decidedAt: string },
): MemoryProposalResolution {
    validateState(state);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
        throw new TypeError("expectedRevision must be a non-negative safe integer");
    if (!isRfc3339Utc(decidedAt)) throw new TypeError("decidedAt must be RFC 3339 UTC");

    const candidate = proposalCandidate(proposal);
    const reassessment = assessMemoryProposal(state, candidate);
    if (state.revision !== expectedRevision) return rejected(state, proposal, decidedAt, "stale_revision");
    if (reassessment.status !== "valid") {
        const reason =
            reassessment.status === "invalid" && reassessment.reason === "invalid_supersession"
                ? "supersession_stale"
                : "proposal_no_longer_valid";
        return rejected(state, proposal, decidedAt, reason);
    }

    const current = currentSlotMeanings(state, proposal);
    if (current.some((meaning) => sameMeaning(meaning, proposal)))
        return rejected(state, proposal, decidedAt, "duplicate");
    if (proposal.supersedes_meaning_id === null) {
        if (current.length > 0) return rejected(state, proposal, decidedAt, "conflict_requires_supersession");
    }
    if (Object.values(proposal.confidence).some((confidence) => confidence === "low"))
        return rejected(state, proposal, decidedAt, "insufficient_confidence");

    const nextState = structuredClone(state);
    let sourceEvidenceIds = [...proposal.source_evidence_ids];
    const meaningId = deterministicAdoptionId("meaning", state, proposal, decidedAt) as MeaningId;
    if (state.meanings.some((meaning) => meaning.meaningId === meaningId))
        return rejected(state, proposal, decidedAt, "deterministic_id_collision");
    if (proposal.epistemic_role === "ember_inference") {
        const evidenceId = deterministicAdoptionId("evidence", state, proposal, decidedAt) as EvidenceId;
        if (state.evidence.some((evidence) => evidence.evidenceId === evidenceId))
            return rejected(state, proposal, decidedAt, "deterministic_id_collision");
        const inference: EmberInferenceEvidence = {
            evidenceId,
            sourceRole: "ember_inference",
            sourceActor: "ember",
            occurredAt: decidedAt,
            observedAt: decidedAt,
            derivedFromEvidenceIds: sourceEvidenceIds as [EvidenceId, ...EvidenceId[]],
            scope: proposal.scope,
            payloadMode: "descriptor_only",
        };
        nextState.evidence.push(inference);
        sourceEvidenceIds = [inference.evidenceId];
    }

    const meaning = proposalMeaning(proposal, meaningId, sourceEvidenceIds, decidedAt);
    if (proposal.supersedes_meaning_id !== null) {
        const old = nextState.meanings.find((item) => item.meaningId === proposal.supersedes_meaning_id)!;
        old.currentness = "superseded";
        old.supersededBy = meaningId;
    }
    nextState.meanings.push(meaning);
    validateState(nextState);
    return {
        proposal: { ...proposal, status: "adopted", resolution: { decided_at: decidedAt, meaning_id: meaningId } },
        state: nextState,
    };
}

function deterministicAdoptionId(
    prefix: "meaning" | "evidence",
    state: EmberState,
    proposal: ProposedMemoryProposal,
    decidedAt: string,
): string {
    const digest = contentDigest(
        JSON.stringify([
            "memory-adoption-v1",
            prefix,
            state.lineage.lineageId,
            state.revision,
            proposal.proposal_id,
            proposal.proposed_at,
            decidedAt,
        ]),
    );
    return `${prefix}-${digest.slice("sha256:".length)}`;
}

function rejected(
    state: EmberState,
    proposal: ProposedMemoryProposal,
    decidedAt: string,
    reason: MemoryProposalRejectionReason,
): MemoryProposalResolution {
    return {
        proposal: { ...proposal, status: "rejected", resolution: { decided_at: decidedAt, reason } },
        state: structuredClone(state),
    };
}

function proposalCandidate(proposal: ProposedMemoryProposal): MemoryProposalCandidate {
    const { status: _status, resolution: _resolution, ...candidate } = proposal;
    return candidate;
}

function currentSlotMeanings(state: EmberState, proposal: ProposedMemoryProposal): Meaning[] {
    return state.meanings.filter(
        (meaning) =>
            meaning.currentness === "current" &&
            meaning.kind === proposal.kind &&
            meaning.owner === proposal.owner &&
            meaning.slot === proposal.slot &&
            meaning.scope === proposal.scope,
    );
}

function sameMeaning(meaning: Meaning, proposal: ProposedMemoryProposal): boolean {
    return (
        meaning.content === proposal.content &&
        meaning.epistemicRole === proposal.epistemic_role &&
        meaning.uncertainty === proposal.uncertainty
    );
}

function proposalMeaning(
    proposal: ProposedMemoryProposal,
    meaningId: MeaningId,
    sourceEvidenceIds: EvidenceId[],
    learnedAt: string,
): Meaning {
    const base = {
        meaningId,
        owner: proposal.owner,
        slot: proposal.slot,
        scope: proposal.scope,
        content: proposal.content,
        sourceEvidenceIds,
        epistemicRole: proposal.epistemic_role,
        learnedAt,
        applicableFrom: proposal.applicable_from,
        applicableUntil: proposal.applicable_until,
        currentness: "current" as const,
        prospectiveLifecycle: "none" as const,
        supersedes: proposal.supersedes_meaning_id,
        supersededBy: null,
        uncertainty: proposal.uncertainty,
    };
    return { ...base, kind: proposal.kind } as Meaning;
}

function invalid(reason: InvalidMemoryProposalReason, detail: string): MemoryProposalAssessment {
    return { status: "invalid", reason, detail };
}

function validateRepresentation(value: unknown): string | null {
    if (!isObject(value) || !exactKeys(value, CANDIDATE_FIELDS)) return "proposal fields do not match version 1";
    if (value.proposal_version !== 1) return "proposal_version must be 1";
    if (!isNotBlankString(value.proposal_id) || !value.proposal_id.startsWith("memory-proposal-"))
        return "proposal_id must be a memory-proposal ID";
    if (!isRfc3339Utc(value.proposed_at) || !isRfc3339Utc(value.applicable_from))
        return "proposal timestamps must be RFC 3339 UTC";
    if (value.applicable_until !== null && !isRfc3339Utc(value.applicable_until))
        return "applicable_until must be null or RFC 3339 UTC";
    if (!MEANING_KINDS.has(value.kind as MeaningKind)) return "kind is not a supported canonical meaning family";
    for (const field of ["owner", "slot", "scope", "content"])
        if (!isNotBlankString(value[field])) return `${field} must be non-empty`;
    if (!Array.isArray(value.source_evidence_ids) || value.source_evidence_ids.length === 0)
        return "at least one source evidence ID is required";
    if (!value.source_evidence_ids.every(isNotBlankString)) return "source evidence IDs must be strings";
    if (!EPISTEMIC_ROLES.has(value.epistemic_role as EpistemicRole)) return "epistemic_role is unsupported";
    if (value.proposed_currentness !== "current") return "proposed_currentness must be current";
    if (!isObject(value.confidence) || !exactKeys(value.confidence, CONFIDENCE_FIELDS))
        return "confidence must expose source, proposition, and interpretation dimensions";
    if (!Object.values(value.confidence).every((item) => CONFIDENCE_VALUES.has(item as MemoryConfidence)))
        return "confidence contains an unsupported value";
    if (value.uncertainty !== null && !isNotBlankString(value.uncertainty))
        return "uncertainty must be null or a non-empty explanation";
    if (value.supersedes_meaning_id !== null && !isNotBlankString(value.supersedes_meaning_id))
        return "supersedes_meaning_id must be null or a meaning ID";
    return null;
}

function validateKindSemantics(principal: string, proposal: MemoryProposalCandidate): string | null {
    if (["fact", "preference"].includes(proposal.kind) && proposal.applicable_until !== null)
        return "fact and preference proposals require an open applicability interval in v1";
    if (proposal.kind === "relationship") {
        if (proposal.owner !== `relationship:${principal}` || proposal.slot !== "relationship")
            return "relationship proposals require the current principal relationship owner and fixed slot";
        if (proposal.epistemic_role !== "user_testimony") return "relationship proposals require user testimony";
    } else if (proposal.kind === "preference") {
        if (proposal.owner !== `user:${principal}`) return "preference proposals require the current user owner";
        if (proposal.epistemic_role !== "user_testimony") return "preference proposals require user testimony";
    } else if (proposal.kind === "episode_meta") {
        if (!["ember", `relationship:${principal}`].includes(proposal.owner))
            return "episode proposals require Ember or the current relationship owner";
        if (proposal.epistemic_role !== "user_testimony") return "episode proposals require user testimony in v1";
    } else if (proposal.kind === "fact") {
        if (proposal.epistemic_role === "ember_commitment") return "facts cannot carry commitment provenance";
        const ownerMatchesRole =
            (proposal.epistemic_role === "user_testimony" && proposal.owner === `user:${principal}`) ||
            (proposal.epistemic_role === "ember_inference" && proposal.owner === "ember") ||
            (proposal.epistemic_role === "direct_observation" && proposal.owner === "ember") ||
            (proposal.epistemic_role === "external_claim" && proposal.owner.startsWith("external:")) ||
            (proposal.epistemic_role === "delegated_report" && proposal.owner.startsWith("delegate:"));
        if (!ownerMatchesRole) return "fact owner and epistemic role do not preserve attribution";
    }
    return null;
}

function validateProvenance(proposal: MemoryProposalCandidate, evidence: EmberState["evidence"]): string | null {
    if (proposal.epistemic_role === "ember_inference") return null;

    const matches = evidence.every((item) => {
        if (proposal.epistemic_role === "user_testimony") return item.sourceRole === "user_command";
        if (proposal.epistemic_role === "direct_observation") return item.sourceRole === "ember_observation";
        if (proposal.epistemic_role === "external_claim")
            return item.sourceRole === "external_claim" && item.sourceActor === proposal.owner;
        if (proposal.epistemic_role === "delegated_report")
            return item.sourceRole === "delegated_report" && item.sourceActor === proposal.owner;
        return false;
    });
    if (!matches) return "every cited evidence item must preserve the proposal's epistemic role and source actor";
    return null;
}

function validateSupersession(state: EmberState, proposal: MemoryProposalCandidate): string | null {
    const targetId = proposal.supersedes_meaning_id;
    if (targetId === null) return null;
    if (!(["fact", "preference"] as MeaningKind[]).includes(proposal.kind))
        return `${proposal.kind} proposals do not support supersession in v1`;
    if (
        proposal.epistemic_role !== "user_testimony" ||
        proposal.owner !== `user:${state.runtimeContract.localPrincipal}`
    )
        return "v1 supersession supports only user-owned user-testimony facts and preferences";
    const target = state.meanings.find((meaning) => meaning.meaningId === targetId);
    if (!target) return "supersession target does not exist";
    if (target.currentness !== "current") return "supersession target must still be current";
    if (target.epistemicRole !== "user_testimony" || target.owner !== `user:${state.runtimeContract.localPrincipal}`)
        return "v1 supersession target must be user-owned user testimony";
    if (
        target.kind !== proposal.kind ||
        target.owner !== proposal.owner ||
        target.slot !== proposal.slot ||
        target.scope !== proposal.scope
    )
        return "supersession target must occupy the same semantic slot";
    return null;
}
