import type { ProjectedConversationContext } from "./conversation-context.ts";
import type {
    CognitionId,
    CognitionPurpose,
    EmberState,
    Evidence,
    EvidenceId,
    Meaning,
    MeaningId,
    RecoveryAccount,
    RuntimeEpisode,
    RuntimeId,
} from "./model.ts";

import { cloneState } from "../util.ts";
import { emptyConversationContext } from "./conversation-context.ts";
import { ValidationError } from "./errors.ts";
import { validateState } from "./model.ts";
import { findMeaning } from "./semantics.ts";

export type ProjectedEvidence = Omit<Evidence, "payload" | "contentDigest"> & {
    payload?: string;
};

export type ProjectedMeaning = Meaning & {
    applicability?: "current_live" | "last_known_live_needs_currentness_check";
    source_evidence: ProjectedEvidence[];
    requested_detail_evidence?: ProjectedEvidence[];
};

export interface ProjectionGap {
    gapKind: "unavailable_detail";
    meaningId: MeaningId;
    evidenceId: EvidenceId;
    reason: string;
    claim: string;
}

export interface Projection {
    projection_version: 1;
    purpose: CognitionPurpose;
    validatedRevision: number;
    lineage: EmberState["lineage"];
    principal: string;
    activeScope: string;
    surface: string;
    current_time: string;
    current_input: string;
    recoveryAccount: RecoveryAccount;
    conversation_context?: ProjectedConversationContext;
    meanings: ProjectedMeaning[];
    gaps: ProjectionGap[];
    selection: {
        meaning_ids: MeaningId[];
        evidence_ids: EvidenceId[];
        explicit_explain_ids: string[];
        raw_transcript_included: false;
    };
}

export interface BuildProjectionOptions {
    principal: string;
    scope: string;
    surface?: string;
    currentInput: string;
    currentTime: string;
    runtimeId: RuntimeId | string;
    purpose?: CognitionPurpose;
    explainIds?: Array<MeaningId | string>;
    conversationContext?: ProjectedConversationContext;
}

export function buildProjection(
    state: EmberState,
    {
        principal,
        scope,
        surface = "local_cli",
        currentInput,
        currentTime,
        runtimeId,
        purpose = "ordinary",
        explainIds = [],
        conversationContext = emptyConversationContext(),
    }: BuildProjectionOptions,
): Projection {
    validateState(state);
    if (principal !== state.runtimeContract.localPrincipal) {
        throw new ValidationError("projection principal does not match runtime contract");
    }
    if (typeof surface !== "string" || !surface.trim()) {
        throw new ValidationError("projection surface must be non-empty");
    }
    if (!["ordinary", "explain"].includes(purpose)) {
        throw new ValidationError("projection purpose must be ordinary or explain");
    }
    const runtime = findRuntime(state, runtimeId);
    const selected = new Map<MeaningId, Meaning>();
    const explicit = [...new Set(explainIds)];

    for (const m of state.meanings) {
        if (
            (m.kind === "relationship" && m.owner === `relationship:${principal}`) ||
            ((m.kind === "fact" || m.kind === "preference") && m.currentness === "current" && m.scope === scope) ||
            (m.kind === "commitment" &&
                m.currentness === "current" &&
                m.prospectiveLifecycle === "live" &&
                m.scope === scope)
        ) {
            selected.set(m.meaningId, m);
        }
    }
    if (purpose === "explain") {
        for (const id of explicit) {
            const m = findMeaning(state, id);
            selected.set(m.meaningId, m);
            for (const linked of [m.supersedes, m.supersededBy]) {
                if (linked) {
                    selected.set(linked, findMeaning(state, linked));
                }
            }
        }
    }

    const evidenceById = new Map(state.evidence.map((e) => [e.evidenceId, e]));
    const selectedEvidence = new Map<EvidenceId, Evidence>();
    const gaps: ProjectionGap[] = [];
    const projected: ProjectedMeaning[] = [];

    for (const m of selected.values()) {
        const item = cloneState(m) as ProjectedMeaning;
        if (m.kind === "commitment" && m.currentness === "current" && m.prospectiveLifecycle === "live") {
            item.applicability =
                runtime.recoveryAccount.gapKind === "initial_start"
                    ? "current_live"
                    : "last_known_live_needs_currentness_check";
        }
        const descriptors: ProjectedEvidence[] = [];
        for (const ev of evidenceLineage(m.sourceEvidenceIds, evidenceById)) {
            descriptors.push(projectEvidence(ev, purpose === "explain"));
            selectedEvidence.set(ev.evidenceId, ev);
        }
        item.source_evidence = descriptors;
        projected.push(item);
        if (purpose === "explain" && explicit.includes(m.meaningId)) {
            for (const ev of state.evidence) {
                if (ev.relatedMeaningId !== m.meaningId) {
                    continue;
                }
                selectedEvidence.set(ev.evidenceId, ev);
                if (ev.payloadMode === "retained_optional" && ev.availability === "unavailable") {
                    gaps.push({
                        gapKind: "unavailable_detail",
                        meaningId: m.meaningId,
                        evidenceId: ev.evidenceId,
                        reason: ev.unavailableReason,
                        claim: "the episode is supported, but this detail cannot be recovered from this store",
                    });
                } else if (ev.sourceRole === "user_command") {
                    (item.requested_detail_evidence ??= []).push(projectEvidence(ev, true));
                }
            }
        }
    }

    return {
        projection_version: 1,
        purpose,
        validatedRevision: state.revision,
        lineage: cloneState(state.lineage),
        principal,
        activeScope: scope,
        surface,
        current_time: currentTime,
        current_input: currentInput,
        recoveryAccount: cloneState(runtime.recoveryAccount),
        conversation_context: cloneState(conversationContext),
        meanings: projected,
        gaps,
        selection: {
            meaning_ids: [...selected.keys()],
            evidence_ids: [...selectedEvidence.keys()],
            explicit_explain_ids: explicit,
            raw_transcript_included: false,
        },
    };
}

export function inspectionView(state: EmberState) {
    validateState(state);
    const current = state.meanings.filter((m) => m.currentness === "current").map(cloneState);
    const historical = state.meanings.filter((m) => m.currentness !== "current").map(cloneState);
    const gaps = state.evidence
        .filter((e) => e.payloadMode === "retained_optional" && e.availability === "unavailable")
        .map((e) => ({
            gapKind: "unavailable_detail" as const,
            evidenceId: e.evidenceId,
            meaningId: e.relatedMeaningId,
            reason: e.unavailableReason,
        }));
    return {
        schemaVersion: state.schemaVersion,
        revision: state.revision,
        lineage: cloneState(state.lineage),
        currentMeanings: current,
        historical_meanings: historical,
        live_commitments: current
            .filter((m) => m.kind === "commitment" && m.prospectiveLifecycle === "live")
            .map(cloneState),
        closed_commitments: historical
            .filter(
                (m) =>
                    m.kind === "commitment" &&
                    (m.prospectiveLifecycle === "fulfilled" || m.prospectiveLifecycle === "cancelled"),
            )
            .map(cloneState),
        gaps,
        runtimeEpisodes: cloneState(state.operations.runtimeEpisodes),
        cognitionEpisodes: cloneState(state.operations.cognitionEpisodes),
        cognitionOpportunities: cloneState(state.operations.cognitionOpportunities ?? []),
    };
}

export function explanationView(state: EmberState, id: MeaningId | string) {
    validateState(state);
    const m = cloneState(findMeaning(state, id));
    const byId = new Map(state.evidence.map((e) => [e.evidenceId, e]));
    const source = evidenceLineage(m.sourceEvidenceIds, byId).map(cloneState);
    const linked: Partial<Record<"supersedes" | "supersededBy", Meaning>> = {};
    for (const field of ["supersedes", "supersededBy"] as const) {
        const meaningId = m[field];
        if (meaningId) {
            linked[field] = cloneState(findMeaning(state, meaningId));
        }
    }
    return {
        meaning: m,
        source_evidence: source,
        related_detail_evidence: state.evidence.filter((e) => e.relatedMeaningId === m.meaningId).map(cloneState),
        linked_meanings: linked,
        selected_by_cognition_ids: state.operations.cognitionEpisodes
            .filter((c) => c.selectedMeaningIds.includes(m.meaningId))
            .map((c) => c.cognitionId),
    };
}

function evidenceLineage(ids: EvidenceId[], byId: Map<EvidenceId, Evidence>): Evidence[] {
    const result: Evidence[] = [];
    const seen = new Set<EvidenceId>();
    const visit = (id: EvidenceId): void => {
        if (seen.has(id)) {
            return;
        }
        const evidence = byId.get(id);
        if (!evidence) {
            throw new ValidationError(`evidence lineage refers to absent evidence ${id}`);
        }
        seen.add(id);
        result.push(evidence);
        for (const parent of evidence.derivedFromEvidenceIds) {
            visit(parent);
        }
    };
    for (const id of ids) {
        visit(id);
    }
    return result;
}

function projectEvidence(ev: Evidence, includePayload: boolean): ProjectedEvidence {
    const result = cloneState(ev) as ProjectedEvidence;

    delete (result as { payload?: string }).payload;
    delete (result as { contentDigest?: string }).contentDigest;

    if (includePayload && ev.payloadMode === "retained_optional" && ev.availability === "available") {
        result.payload = ev.payload;
    }
    return result;
}

export function findRuntime(state: EmberState, id: RuntimeId | string): RuntimeEpisode {
    const value = state.operations.runtimeEpisodes.find((r) => r.runtimeId === id);
    if (!value) {
        throw new ValidationError(`runtime does not exist: ${id}`);
    }
    return value;
}

export type { CognitionId };
