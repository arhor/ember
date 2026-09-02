import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  inspectSpecialistEpisode,
  reconcileSpecialistResult,
  type SpecialistCurrentnessCheckpoint,
  type SpecialistDisposition,
  type SpecialistEpisodeRecord,
  type SpecialistReportProvenance,
} from "./codex-specialist.ts";

export type SpecialistReintegrationOutcome = "integrated" | "withheld" | "rejected";
export type SpecialistResultShape = "complete" | "partial" | "failed" | "ambiguous_effect";

export interface SpecialistSemanticDecision {
  disposition: "accepted" | "qualified" | "rejected";
  reason: string;
  current_context_re_evaluation?: string;
}

export interface SpecialistEvidenceSourceGroup {
  basis_fingerprint: string;
  context_revision: string;
  episode_ids: string[];
}

export interface SpecialistReintegrationDecision {
  decision_version: 1;
  decision_id: string;
  decided_at: string;
  outcome: SpecialistReintegrationOutcome;
  requested_disposition: SpecialistSemanticDecision["disposition"] | null;
  resulting_disposition: SpecialistDisposition;
  result_shape: SpecialistResultShape;
  reason: string;
  checkpoint: SpecialistCurrentnessCheckpoint;
  report_provenance: SpecialistReportProvenance;
  corroboration: {
    considered_episode_ids: string[];
    source_groups: SpecialistEvidenceSourceGroup[];
    independence: "not_established";
  };
  canonical_mutation: {
    eligibility: "eligible_after_ember_decision" | "not_eligible";
    decision_id: string;
  };
}

export interface SpecialistReintegrationAudit {
  audit_version: 1;
  history: SpecialistReintegrationDecision[];
}

export interface SpecialistReintegrationInspection {
  record: SpecialistEpisodeRecord;
  audit: SpecialistReintegrationAudit | null;
  latest_decision: SpecialistReintegrationDecision | null;
}

interface PersistedSpecialistRecord extends SpecialistEpisodeRecord {
  reintegration?: SpecialistReintegrationAudit;
}

export async function reintegrateSpecialistResult(
  recordPath: string,
  checkpoint: SpecialistCurrentnessCheckpoint,
  options: {
    decision?: SpecialistSemanticDecision;
    corroboratingRecordPaths?: string[];
    now?: () => string;
  } = {},
): Promise<SpecialistReintegrationInspection> {
  const before = await inspectSpecialistEpisode(recordPath);
  requireFinalAttributedReport(before);
  validateDecision(options.decision);

  const resultShape = classifyResult(before);
  const now = options.now ?? (() => new Date().toISOString());
  let reconciled = await reconcileSpecialistResult(recordPath, checkpoint, { now });
  const applicability = reconciled.currentness_evaluation?.applicability;
  if (!applicability) throw new Error("specialist currentness evaluation was not recorded");

  const supporting = await loadCorroboratingRecords(before, options.corroboratingRecordPaths ?? []);
  const corroboration = buildCorroboration([before, ...supporting]);
  const requestedDisposition = options.decision?.disposition ?? null;

  let outcome: SpecialistReintegrationOutcome;
  let resultingDisposition = reconciled.ember_disposition;
  let reason: string;

  if (applicability === "rejected") {
    outcome = "rejected";
    resultingDisposition = "rejected";
    reason = reconciled.currentness_evaluation!.reason;
  } else if (applicability === "stale") {
    outcome = "withheld";
    resultingDisposition = "stale";
    reason = `${reconciled.currentness_evaluation!.reason}; historical specialist success is preserved but is not current completion`;
  } else if (reconciled.recovery.effect_state === "effects_possible") {
    outcome = "withheld";
    reason = "specialist effects remain ambiguous and require independent reconciliation before current reliance or canonical mutation";
  } else if (applicability === "requires_re_evaluation") {
    const reEvaluationReason = options.decision?.current_context_re_evaluation;
    if (!options.decision || !reEvaluationReason) {
      outcome = "withheld";
      resultingDisposition = "requires_re_evaluation";
      reason = `${reconciled.currentness_evaluation!.reason}; Ember has not yet recorded a semantic re-evaluation against the changed context`;
    } else if (resultShape === "partial" && options.decision.disposition === "accepted") {
      outcome = "withheld";
      resultingDisposition = "requires_re_evaluation";
      reason = "a partial specialist result cannot establish full objective completion; Ember may qualify or reject the usable remainder after re-evaluation";
    } else {
      reconciled = await reconcileSpecialistResult(recordPath, checkpoint, {
        now,
        re_evaluation: {
          disposition: options.decision.disposition,
          reason: reEvaluationReason,
        },
      });
      resultingDisposition = reconciled.ember_disposition;
      outcome = options.decision.disposition === "rejected" ? "rejected" : "integrated";
      reason = options.decision.reason;
    }
  } else if (!options.decision) {
    outcome = "withheld";
    reason = "the specialist report is current but remains evidence awaiting an Ember-owned semantic decision";
  } else if (resultShape === "partial" && options.decision.disposition === "accepted") {
    outcome = "withheld";
    reason = "a partial specialist result cannot establish full objective completion; Ember may qualify or reject the usable remainder";
  } else {
    outcome = options.decision.disposition === "rejected" ? "rejected" : "integrated";
    resultingDisposition = options.decision.disposition;
    reason = options.decision.reason;
  }

  const decidedAt = now();
  const decisionId = `reintegration-${randomUUID()}`;
  const decision: SpecialistReintegrationDecision = {
    decision_version: 1,
    decision_id: decisionId,
    decided_at: decidedAt,
    outcome,
    requested_disposition: requestedDisposition,
    resulting_disposition: resultingDisposition,
    result_shape: resultShape,
    reason,
    checkpoint: structuredClone(checkpoint),
    report_provenance: structuredClone(before.report_provenance!),
    corroboration,
    canonical_mutation: {
      eligibility: outcome === "integrated" ? "eligible_after_ember_decision" : "not_eligible",
      decision_id: decisionId,
    },
  };

  await persistDecision(recordPath, decision, resultingDisposition);
  return inspectSpecialistReintegration(recordPath);
}

export async function inspectSpecialistReintegration(recordPath: string): Promise<SpecialistReintegrationInspection> {
  const record = await inspectSpecialistEpisode(recordPath);
  const persisted = JSON.parse(await readFile(recordPath, "utf8")) as PersistedSpecialistRecord;
  const audit = persisted.reintegration ?? null;
  validateAudit(audit);
  return {
    record,
    audit: audit === null ? null : structuredClone(audit),
    latest_decision: audit?.history.at(-1) ? structuredClone(audit.history.at(-1)!) : null,
  };
}

function classifyResult(record: SpecialistEpisodeRecord): SpecialistResultShape {
  if (record.recovery.effect_state === "effects_possible" || record.report?.possible_effects.length) {
    return "ambiguous_effect";
  }
  if (record.report?.objective_disposition === "completed") return "complete";
  if (!record.report) return "failed";
  if (
    record.report.artifacts_changed.length
    || record.report.artifacts_inspected.length
    || record.report.checks.length
    || record.report.known_effects.length
    || record.known_effects.length
  ) return "partial";
  return "failed";
}

async function loadCorroboratingRecords(
  primary: SpecialistEpisodeRecord,
  paths: string[],
): Promise<SpecialistEpisodeRecord[]> {
  const records: SpecialistEpisodeRecord[] = [];
  const seenEpisodes = new Set([primary.specification.episode_id]);
  for (const path of paths) {
    const record = await inspectSpecialistEpisode(path);
    requireFinalAttributedReport(record);
    if (record.specification.objective !== primary.specification.objective) {
      throw new Error("corroborating specialist episode must address the same objective");
    }
    if (seenEpisodes.has(record.specification.episode_id)) continue;
    seenEpisodes.add(record.specification.episode_id);
    records.push(record);
  }
  return records;
}

function buildCorroboration(records: SpecialistEpisodeRecord[]) {
  const groups = new Map<string, SpecialistEvidenceSourceGroup>();
  for (const record of records) {
    const fingerprint = evidenceBasisFingerprint(record);
    const group = groups.get(fingerprint);
    if (group) {
      group.episode_ids.push(record.specification.episode_id);
    } else {
      groups.set(fingerprint, {
        basis_fingerprint: fingerprint,
        context_revision: record.specification.currentness_basis.context_revision,
        episode_ids: [record.specification.episode_id],
      });
    }
  }
  return {
    considered_episode_ids: records.map(record => record.specification.episode_id),
    source_groups: [...groups.values()].map(group => ({ ...group, episode_ids: [...group.episode_ids] })),
    independence: "not_established" as const,
  };
}

function evidenceBasisFingerprint(record: SpecialistEpisodeRecord): string {
  const source = {
    context_revision: record.specification.currentness_basis.context_revision,
    context_sources: record.specification.context_projection
      .map(item => ({ provenance: item.provenance, scope: item.scope, currentness: item.currentness }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    authority_provenance: record.specification.authority_envelope.provenance,
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(source)).digest("hex")}`;
}

async function persistDecision(
  recordPath: string,
  decision: SpecialistReintegrationDecision,
  resultingDisposition: SpecialistDisposition,
) {
  const record = JSON.parse(await readFile(recordPath, "utf8")) as PersistedSpecialistRecord;
  record.ember_disposition = resultingDisposition;
  const audit = record.reintegration ?? { audit_version: 1 as const, history: [] };
  validateAudit(audit);
  audit.history.push(structuredClone(decision));
  record.reintegration = audit;
  const temporary = `${recordPath}.${process.pid}.reintegration.tmp`;
  await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, recordPath);
}

function requireFinalAttributedReport(record: SpecialistEpisodeRecord) {
  if (record.runtime_state !== "exited" || !["reported_success", "reported_failure"].includes(record.report_state)) {
    throw new Error("specialist reintegration requires a final report and observed exit");
  }
  if (!record.report || !record.report_provenance) {
    throw new Error("specialist reintegration requires attributed specialist report evidence");
  }
}

function validateDecision(decision: SpecialistSemanticDecision | undefined) {
  if (!decision) return;
  if (!["accepted", "qualified", "rejected"].includes(decision.disposition)) {
    throw new Error("specialist semantic decision disposition is invalid");
  }
  if (!bounded(decision.reason, 8192)) throw new Error("specialist semantic decision reason is invalid");
  if (decision.current_context_re_evaluation !== undefined && !bounded(decision.current_context_re_evaluation, 8192)) {
    throw new Error("specialist current-context re-evaluation reason is invalid");
  }
}

function validateAudit(audit: SpecialistReintegrationAudit | null) {
  if (audit === null) return;
  if (audit.audit_version !== 1 || !Array.isArray(audit.history)) {
    throw new Error("specialist reintegration audit is invalid");
  }
  for (const decision of audit.history) {
    if (
      decision.decision_version !== 1
      || !bounded(decision.decision_id, 512)
      || !bounded(decision.decided_at, 512)
      || !["integrated", "withheld", "rejected"].includes(decision.outcome)
      || !bounded(decision.reason, 8192)
      || decision.canonical_mutation.decision_id !== decision.decision_id
    ) throw new Error("specialist reintegration decision is invalid");
  }
}

function bounded(value: unknown, bytes: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && Buffer.byteLength(value) <= bytes;
}
