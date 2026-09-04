import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { StaleRevision } from "../core/errors.ts";
import type { StateStore } from "../persistence/state-store.ts";
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

export interface SpecialistAuthorityCheckpoint {
    status: "current" | "revoked" | "superseded" | "uncertain";
    provenance: string;
    reason: string;
}

export interface SpecialistReintegrationCheckpoint extends SpecialistCurrentnessCheckpoint {
    ember_revision: number;
    authority: SpecialistAuthorityCheckpoint;
}

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
    checkpoint: SpecialistReintegrationCheckpoint;
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
    store: StateStore,
    recordPath: string,
    checkpoint: SpecialistReintegrationCheckpoint,
    options: {
        decision?: SpecialistSemanticDecision;
        corroboratingRecordPaths?: string[];
        now?: () => string;
    } = {},
): Promise<SpecialistReintegrationInspection> {
    validateReintegrationCheckpoint(checkpoint);
    validateDecision(options.decision);

    const existingLease = store.lease;
    const lease = existingLease ?? (await store.acquireWriteLease());
    try {
        const currentState = await store.load();
        if (currentState.revision !== checkpoint.ember_revision) {
            throw new StaleRevision(
                `specialist reintegration checkpoint revision ${checkpoint.ember_revision} is stale; current Ember revision is ${currentState.revision}`,
            );
        }
        return await reintegrateAtCurrentRevision(recordPath, checkpoint, options);
    } finally {
        if (existingLease === null) await store.releaseWriteLease(lease);
    }
}

async function reintegrateAtCurrentRevision(
    recordPath: string,
    checkpoint: SpecialistReintegrationCheckpoint,
    options: {
        decision?: SpecialistSemanticDecision;
        corroboratingRecordPaths?: string[];
        now?: () => string;
    },
): Promise<SpecialistReintegrationInspection> {
    const before = (await inspectSpecialistEpisode(recordPath)) as PersistedSpecialistRecord;
    requireFinalAttributedReport(before);
    validateAudit(before.reintegration ?? null, before);

    const supporting = await loadCorroboratingRecords(before, options.corroboratingRecordPaths ?? []);
    const corroboration = buildCorroboration([before, ...supporting]);
    const resultShape = classifyResult(before);
    const now = options.now ?? (() => new Date().toISOString());
    const currentness = toCurrentnessCheckpoint(checkpoint);
    const explicitRejection = options.decision?.disposition === "rejected";
    const candidatePath = `${recordPath}.${process.pid}.${randomUUID()}.reintegration-candidate`;
    await writeFile(candidatePath, `${JSON.stringify(before, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    try {
        let reconciled = (await reconcileSpecialistResult(candidatePath, currentness, {
            now,
            disposition: explicitRejection ? "rejected" : undefined,
        })) as PersistedSpecialistRecord;
        const applicability = reconciled.currentness_evaluation?.applicability;
        if (!applicability) throw new Error("specialist currentness evaluation was not recorded");

        const requestedDisposition = options.decision?.disposition ?? null;
        let outcome: SpecialistReintegrationOutcome;
        let reason: string;

        if (applicability === "rejected") {
            outcome = "rejected";
            reason = reconciled.currentness_evaluation!.reason;
        } else if (explicitRejection) {
            outcome = "rejected";
            reason = options.decision!.reason;
        } else if (applicability === "stale") {
            outcome = "withheld";
            reason = `${reconciled.currentness_evaluation!.reason}; historical specialist success is preserved but is not current completion`;
        } else if (checkpoint.authority.status !== "current") {
            outcome = "withheld";
            reason = `current authority is ${checkpoint.authority.status}: ${checkpoint.authority.reason}`;
        } else if (reconciled.recovery.effect_state === "effects_possible") {
            outcome = "withheld";
            reason =
                "specialist effects remain ambiguous and require independent reconciliation before current reliance or canonical mutation";
        } else if (applicability === "requires_re_evaluation") {
            const reEvaluationReason = options.decision?.current_context_re_evaluation;
            if (!options.decision || !reEvaluationReason) {
                outcome = "withheld";
                reason = `${reconciled.currentness_evaluation!.reason}; Ember has not yet recorded a semantic re-evaluation against the changed context`;
            } else if (options.decision.disposition === "accepted" && resultShape !== "complete") {
                outcome = "withheld";
                reason = `${resultShape} specialist result cannot establish full objective completion; Ember may qualify or reject the usable evidence after re-evaluation`;
            } else {
                reconciled = (await reconcileSpecialistResult(candidatePath, currentness, {
                    now,
                    re_evaluation: {
                        disposition: options.decision.disposition,
                        reason: reEvaluationReason,
                    },
                })) as PersistedSpecialistRecord;
                outcome = "integrated";
                reason = options.decision.reason;
            }
        } else if (!options.decision) {
            outcome = "withheld";
            reason = "the specialist report is current but remains evidence awaiting an Ember-owned semantic decision";
        } else if (options.decision.disposition === "accepted" && resultShape !== "complete") {
            outcome = "withheld";
            reason = `${resultShape} specialist result cannot establish full objective completion; Ember may qualify or reject the usable evidence`;
        } else {
            reconciled = (await reconcileSpecialistResult(candidatePath, currentness, {
                now,
                disposition: options.decision.disposition,
            })) as PersistedSpecialistRecord;
            outcome = "integrated";
            reason = options.decision.reason;
        }

        const decisionId = `reintegration-${randomUUID()}`;
        const decision: SpecialistReintegrationDecision = {
            decision_version: 1,
            decision_id: decisionId,
            decided_at: now(),
            outcome,
            requested_disposition: requestedDisposition,
            resulting_disposition: reconciled.ember_disposition,
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

        const persisted = reconciled as PersistedSpecialistRecord;
        const audit = structuredClone(before.reintegration ?? { audit_version: 1 as const, history: [] });
        audit.history.push(decision);
        persisted.reintegration = audit;
        validateAudit(audit, persisted);
        await persistReintegration(recordPath, before, persisted);
        return inspectSpecialistReintegration(recordPath);
    } finally {
        await rm(candidatePath, { force: true });
    }
}

export async function inspectSpecialistReintegration(recordPath: string): Promise<SpecialistReintegrationInspection> {
    const record = (await inspectSpecialistEpisode(recordPath)) as PersistedSpecialistRecord;
    const audit = record.reintegration ?? null;
    validateAudit(audit, record);
    return {
        record,
        audit: audit === null ? null : structuredClone(audit),
        latest_decision: audit?.history.at(-1) ? structuredClone(audit.history.at(-1)!) : null,
    };
}

function classifyResult(record: SpecialistEpisodeRecord): SpecialistResultShape {
    if (record.recovery.effect_state === "effects_possible") return "ambiguous_effect";
    if (record.report?.objective_disposition === "completed") return "complete";
    if (!record.report) return "failed";
    if (
        record.report.artifacts_changed.length ||
        record.report.artifacts_inspected.length ||
        record.report.checks.length ||
        record.report.known_effects.length ||
        record.known_effects.length
    )
        return "partial";
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
        considered_episode_ids: records.map((record) => record.specification.episode_id),
        source_groups: [...groups.values()].map((group) => ({ ...group, episode_ids: [...group.episode_ids] })),
        independence: "not_established" as const,
    };
}

function evidenceBasisFingerprint(record: SpecialistEpisodeRecord): string {
    const source = {
        context_revision: record.specification.currentness_basis.context_revision,
        context_sources: record.specification.context_projection
            .map((item) => ({ provenance: item.provenance, scope: item.scope, currentness: item.currentness }))
            .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    };
    return `sha256:${createHash("sha256").update(JSON.stringify(source)).digest("hex")}`;
}

async function persistReintegration(
    recordPath: string,
    expectedBefore: PersistedSpecialistRecord,
    next: PersistedSpecialistRecord,
) {
    const current = JSON.parse(await readFile(recordPath, "utf8")) as PersistedSpecialistRecord;
    if (JSON.stringify(current) !== JSON.stringify(expectedBefore)) {
        throw new Error("specialist episode changed before reintegration could be committed");
    }
    const temporary = `${recordPath}.${process.pid}.reintegration.tmp`;
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
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

function validateReintegrationCheckpoint(checkpoint: SpecialistReintegrationCheckpoint) {
    if (
        !Number.isSafeInteger(checkpoint.ember_revision) ||
        checkpoint.ember_revision < 0 ||
        !["current", "superseded", "cancelled"].includes(checkpoint.objective_status) ||
        !bounded(checkpoint.objective_revision, 8192) ||
        !bounded(checkpoint.context_revision, 8192) ||
        !checkpoint.authority ||
        !["current", "revoked", "superseded", "uncertain"].includes(checkpoint.authority.status) ||
        !bounded(checkpoint.authority.provenance, 8192) ||
        !bounded(checkpoint.authority.reason, 8192)
    )
        throw new Error("specialist reintegration checkpoint is invalid");
}

function toCurrentnessCheckpoint(checkpoint: SpecialistReintegrationCheckpoint): SpecialistCurrentnessCheckpoint {
    return {
        objective_revision: checkpoint.objective_revision,
        context_revision: checkpoint.context_revision,
        objective_status: checkpoint.objective_status,
    };
}

function sameCheckpoint(left: SpecialistCurrentnessCheckpoint, right: SpecialistCurrentnessCheckpoint) {
    return (
        left.objective_revision === right.objective_revision &&
        left.context_revision === right.context_revision &&
        left.objective_status === right.objective_status
    );
}

function validateDecision(decision: SpecialistSemanticDecision | undefined) {
    if (!decision) return;
    if (!["accepted", "qualified", "rejected"].includes(decision.disposition)) {
        throw new Error("specialist semantic decision disposition is invalid");
    }
    if (!bounded(decision.reason, 8192)) throw new Error("specialist semantic decision reason is invalid");
    if (
        decision.current_context_re_evaluation !== undefined &&
        !bounded(decision.current_context_re_evaluation, 8192)
    ) {
        throw new Error("specialist current-context re-evaluation reason is invalid");
    }
}

function validateAudit(audit: SpecialistReintegrationAudit | null, record: SpecialistEpisodeRecord) {
    if (audit === null) return;
    if (audit.audit_version !== 1 || !Array.isArray(audit.history)) invalidAudit();
    for (const decision of audit.history) validateAuditDecision(decision, record.specification.episode_id);
    const latest = audit.history.at(-1);
    if (!latest) return;
    if (latest.resulting_disposition !== record.ember_disposition) invalidAudit();
    if (!record.report_provenance || !sameProvenance(latest.report_provenance, record.report_provenance))
        invalidAudit();
    if (
        !record.currentness_evaluation ||
        !sameCheckpoint(latest.checkpoint, record.currentness_evaluation.checked_against)
    )
        invalidAudit();
}

function validateAuditDecision(decision: SpecialistReintegrationDecision, episodeId: string) {
    if (!decision || typeof decision !== "object") invalidAudit();
    if (
        decision.decision_version !== 1 ||
        !bounded(decision.decision_id, 512) ||
        !bounded(decision.decided_at, 512) ||
        !["integrated", "withheld", "rejected"].includes(decision.outcome) ||
        !(
            decision.requested_disposition === null ||
            ["accepted", "qualified", "rejected"].includes(decision.requested_disposition)
        ) ||
        !["unresolved", "blocked", "accepted", "qualified", "rejected", "stale", "requires_re_evaluation"].includes(
            decision.resulting_disposition,
        ) ||
        !["complete", "partial", "failed", "ambiguous_effect"].includes(decision.result_shape) ||
        !bounded(decision.reason, 8192) ||
        !decision.checkpoint ||
        !decision.report_provenance ||
        decision.report_provenance.source_role !== "specialist_report" ||
        decision.report_provenance.source !== "codex_specialist" ||
        decision.report_provenance.episode_id !== episodeId ||
        !validCorroboration(decision.corroboration, episodeId) ||
        !decision.canonical_mutation ||
        !["eligible_after_ember_decision", "not_eligible"].includes(decision.canonical_mutation.eligibility) ||
        decision.canonical_mutation.decision_id !== decision.decision_id
    )
        invalidAudit();
    validateReintegrationCheckpoint(decision.checkpoint);

    const eligible = decision.canonical_mutation.eligibility === "eligible_after_ember_decision";
    if (eligible !== (decision.outcome === "integrated")) invalidAudit();
    if (decision.outcome === "integrated") {
        if (!decision.requested_disposition || decision.requested_disposition !== decision.resulting_disposition)
            invalidAudit();
        if (!["accepted", "qualified"].includes(decision.resulting_disposition)) invalidAudit();
        if (decision.checkpoint.authority.status !== "current" || decision.result_shape === "ambiguous_effect")
            invalidAudit();
        if (decision.resulting_disposition === "accepted" && decision.result_shape !== "complete") invalidAudit();
    } else if (decision.outcome === "rejected") {
        if (decision.resulting_disposition !== "rejected") invalidAudit();
    } else if (!["unresolved", "stale", "requires_re_evaluation"].includes(decision.resulting_disposition)) {
        invalidAudit();
    }
}

function validCorroboration(value: SpecialistReintegrationDecision["corroboration"], primaryEpisodeId: string) {
    if (
        !value ||
        value.independence !== "not_established" ||
        !Array.isArray(value.considered_episode_ids) ||
        !Array.isArray(value.source_groups)
    ) {
        return false;
    }
    if (!uniqueBoundedStrings(value.considered_episode_ids) || !value.considered_episode_ids.includes(primaryEpisodeId))
        return false;
    const grouped: string[] = [];
    for (const group of value.source_groups) {
        if (
            !group ||
            !/^sha256:[0-9a-f]{64}$/.test(group.basis_fingerprint) ||
            !bounded(group.context_revision, 8192) ||
            !Array.isArray(group.episode_ids) ||
            !group.episode_ids.length ||
            !uniqueBoundedStrings(group.episode_ids)
        )
            return false;
        grouped.push(...group.episode_ids);
    }
    return (
        uniqueBoundedStrings(grouped) &&
        grouped.length === value.considered_episode_ids.length &&
        grouped.every((id) => value.considered_episode_ids.includes(id))
    );
}

function uniqueBoundedStrings(values: string[]) {
    return values.every((value) => bounded(value, 8192)) && new Set(values).size === values.length;
}

function sameProvenance(left: SpecialistReportProvenance, right: SpecialistReportProvenance) {
    return (
        left.source_role === right.source_role && left.source === right.source && left.episode_id === right.episode_id
    );
}

function invalidAudit(): never {
    throw new Error("specialist reintegration audit is invalid");
}

function bounded(value: unknown, bytes: number): value is string {
    return typeof value === "string" && value.trim().length > 0 && Buffer.byteLength(value) <= bytes;
}
