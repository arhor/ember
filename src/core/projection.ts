import { ValidationError } from "./errors.ts";
import {
  cloneState,
  validateState,
  type CognitionId,
  type CognitionPurpose,
  type EmberState,
  type Evidence,
  type EvidenceId,
  type Meaning,
  type MeaningId,
  type RecoveryAccount,
  type RuntimeEpisode,
  type RuntimeId,
} from "./model.ts";
import { findMeaning } from "./semantics.ts";

export type ProjectedEvidence = Omit<Evidence, "payload" | "content_digest"> & {
  payload?: string;
};

export type ProjectedMeaning = Meaning & {
  applicability?: "current_live" | "last_known_live_needs_currentness_check";
  source_evidence: ProjectedEvidence[];
  requested_detail_evidence?: ProjectedEvidence[];
};

export interface ProjectionGap {
  gap_kind: "unavailable_detail";
  meaning_id: MeaningId;
  evidence_id: EvidenceId;
  reason: string;
  claim: string;
}

export interface Projection {
  projection_version: 1;
  purpose: CognitionPurpose;
  validated_revision: number;
  lineage: EmberState["lineage"];
  principal: string;
  active_scope: string;
  surface: "local_cli";
  current_time: string;
  current_input: string;
  recovery_account: RecoveryAccount;
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
  currentInput: string;
  currentTime: string;
  runtimeId: RuntimeId | string;
  purpose?: CognitionPurpose;
  explainIds?: Array<MeaningId | string>;
}

export function buildProjection(
  state: EmberState,
  { principal, scope, currentInput, currentTime, runtimeId, purpose = "ordinary", explainIds = [] }: BuildProjectionOptions,
): Projection {
  validateState(state);
  if (principal !== state.runtime_contract.local_principal) throw new ValidationError("projection principal does not match runtime contract");
  if (!["ordinary", "explain"].includes(purpose)) throw new ValidationError("projection purpose must be ordinary or explain");
  const runtime = findRuntime(state, runtimeId);
  const selected = new Map<MeaningId, Meaning>();
  const explicit = [...new Set(explainIds)];

  for (const m of state.meanings) {
    if (m.kind === "relationship" && m.owner === `relationship:${principal}`) selected.set(m.meaning_id, m);
    else if ((m.kind === "fact" || m.kind === "preference") && m.currentness === "current" && m.scope === scope) selected.set(m.meaning_id, m);
    else if (m.kind === "commitment" && m.currentness === "current" && m.prospective_lifecycle === "live" && m.scope === scope) selected.set(m.meaning_id, m);
  }
  if (purpose === "explain") {
    for (const id of explicit) {
      const m = findMeaning(state, id);
      selected.set(m.meaning_id, m);
      for (const linked of [m.supersedes, m.superseded_by]) if (linked) selected.set(linked, findMeaning(state, linked));
    }
  }

  const evidenceById = new Map(state.evidence.map(e => [e.evidence_id, e]));
  const selectedEvidence = new Map<EvidenceId, Evidence>();
  const gaps: ProjectionGap[] = [];
  const projected: ProjectedMeaning[] = [];

  for (const m of selected.values()) {
    const item = cloneState(m) as ProjectedMeaning;
    if (m.kind === "commitment" && m.currentness === "current" && m.prospective_lifecycle === "live") {
      item.applicability = runtime.recovery_account.gap_kind === "initial_start" ? "current_live" : "last_known_live_needs_currentness_check";
    }
    const descriptors: ProjectedEvidence[] = [];
    for (const ev of evidenceLineage(m.source_evidence_ids, evidenceById)) {
      descriptors.push(projectEvidence(ev, purpose === "explain"));
      selectedEvidence.set(ev.evidence_id, ev);
    }
    item.source_evidence = descriptors;
    projected.push(item);
    if (purpose === "explain" && explicit.includes(m.meaning_id)) {
      for (const ev of state.evidence) {
        if (ev.related_meaning_id !== m.meaning_id) continue;
        selectedEvidence.set(ev.evidence_id, ev);
        if (ev.payload_mode === "retained_optional" && ev.availability === "unavailable") {
          gaps.push({
            gap_kind: "unavailable_detail",
            meaning_id: m.meaning_id,
            evidence_id: ev.evidence_id,
            reason: ev.unavailable_reason,
            claim: "the episode is supported, but this detail cannot be recovered from this store",
          });
        } else if (ev.source_role === "user_command") {
          (item.requested_detail_evidence ??= []).push(projectEvidence(ev, true));
        }
      }
    }
  }

  return {
    projection_version: 1,
    purpose,
    validated_revision: state.revision,
    lineage: cloneState(state.lineage),
    principal,
    active_scope: scope,
    surface: "local_cli",
    current_time: currentTime,
    current_input: currentInput,
    recovery_account: cloneState(runtime.recovery_account),
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
  const current = state.meanings.filter(m => m.currentness === "current").map(cloneState);
  const historical = state.meanings.filter(m => m.currentness !== "current").map(cloneState);
  const gaps = state.evidence
    .filter(e => e.payload_mode === "retained_optional" && e.availability === "unavailable")
    .map(e => ({ gap_kind: "unavailable_detail" as const, evidence_id: e.evidence_id, meaning_id: e.related_meaning_id, reason: e.unavailable_reason }));
  return {
    schema_version: state.schema_version,
    revision: state.revision,
    lineage: cloneState(state.lineage),
    current_meanings: current,
    historical_meanings: historical,
    live_commitments: current.filter(m => m.kind === "commitment" && m.prospective_lifecycle === "live").map(cloneState),
    closed_commitments: historical.filter(m => m.kind === "commitment" && (m.prospective_lifecycle === "fulfilled" || m.prospective_lifecycle === "cancelled")).map(cloneState),
    gaps,
    runtime_episodes: cloneState(state.operations.runtime_episodes),
    cognition_episodes: cloneState(state.operations.cognition_episodes),
    cognition_opportunities: cloneState(state.operations.cognition_opportunities ?? []),
  };
}

export function explanationView(state: EmberState, id: MeaningId | string) {
  validateState(state);
  const m = cloneState(findMeaning(state, id));
  const byId = new Map(state.evidence.map(e => [e.evidence_id, e]));
  const source = evidenceLineage(m.source_evidence_ids, byId).map(cloneState);
  const linked: Partial<Record<"supersedes" | "superseded_by", Meaning>> = {};
  for (const field of ["supersedes", "superseded_by"] as const) if (m[field]) linked[field] = cloneState(findMeaning(state, m[field]!));
  return {
    meaning: m,
    source_evidence: source,
    related_detail_evidence: state.evidence.filter(e => e.related_meaning_id === m.meaning_id).map(cloneState),
    linked_meanings: linked,
    selected_by_cognition_ids: state.operations.cognition_episodes.filter(c => c.selected_meaning_ids.includes(m.meaning_id)).map(c => c.cognition_id),
  };
}

function evidenceLineage(ids: EvidenceId[], byId: Map<EvidenceId, Evidence>): Evidence[] {
  const result: Evidence[] = [];
  const seen = new Set<EvidenceId>();
  const visit = (id: EvidenceId): void => {
    if (seen.has(id)) return;
    const evidence = byId.get(id);
    if (!evidence) throw new ValidationError(`evidence lineage refers to absent evidence ${id}`);
    seen.add(id);
    result.push(evidence);
    for (const parent of evidence.derived_from_evidence_ids) visit(parent);
  };
  for (const id of ids) visit(id);
  return result;
}

function projectEvidence(ev: Evidence, includePayload: boolean): ProjectedEvidence {
  const result = cloneState(ev) as ProjectedEvidence;
  delete (result as { payload?: string }).payload;
  delete (result as { content_digest?: string }).content_digest;
  if (includePayload && ev.payload_mode === "retained_optional" && ev.availability === "available") result.payload = ev.payload;
  return result;
}

export function findRuntime(state: EmberState, id: RuntimeId | string): RuntimeEpisode {
  const value = state.operations.runtime_episodes.find(r => r.runtime_id === id);
  if (!value) throw new ValidationError(`runtime does not exist: ${id}`);
  return value;
}

export type { CognitionId };
