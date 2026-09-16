import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { CapabilityAuthorityDecision, CapabilityContext, CapabilityJsonValue } from "./execution.ts";

import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { isRfc3339Utc } from "../core/model.ts";
import { replaceFileDurably } from "../persistence/file-replacement.ts";
import { StateStore } from "../persistence/state-store.ts";
import { exactKeys, isNotBlankString, isObject } from "../util.ts";

export type ActionProposalStatus =
    | "pending"
    | "approved"
    | "rejected"
    | "withdrawn"
    | "superseded"
    | "executing"
    | "succeeded"
    | "failed"
    | "outcome_unknown";

export interface ActionProposalRecord {
    proposal_id: `action-proposal-${string}`;
    capability: string;
    principal: string;
    scope: string;
    purpose: string;
    consequence: string;
    payload: CapabilityJsonValue;
    payload_digest: `sha256:${string}`;
    target: { label: string; fingerprint: `sha256:${string}` };
    source_ids: string[];
    created_at: string;
    expires_at: string;
    status: ActionProposalStatus;
    presentations: Array<{
        presentation_id: `action-presentation-${string}`;
        principal: string;
        scope: string;
        surface: string;
        presented_at: string;
        payload_digest: `sha256:${string}`;
    }>;
    decision: null | {
        decision_id: `action-decision-${string}`;
        decision: "approved" | "rejected";
        principal: string;
        payload_digest: `sha256:${string}`;
        presentation_id: `action-presentation-${string}`;
        scope: string;
        surface: string;
        decided_at: string;
        authority_source_id: string;
    };
    invalidation: null | {
        invalidation_id: `action-invalidation-${string}`;
        kind: "withdrawn" | "superseded";
        principal: string;
        occurred_at: string;
        authority_source_id: string;
        reason: string;
    };
    attempt: null | {
        attempt_id: `action-attempt-${string}`;
        started_at: string;
        completed_at: string | null;
        outcome: "executing" | "succeeded" | "failed" | "outcome_unknown";
        phase: "prepared" | "submitted" | "terminal";
        evidence: CapabilityJsonValue | null;
    };
}

interface ActionProposalDocument {
    action_proposal_version: 1;
    proposals: ActionProposalRecord[];
}

export class ActionProposalStore {
    readonly path: string;
    private readonly lock: StateStore;

    constructor(canonicalStatePath: string) {
        if (!canonicalStatePath.trim()) throw new ValidationError("action proposal store requires a state path");
        this.path = `${canonicalStatePath}.actions.json`;
        this.lock = new StateStore(this.path);
    }

    async load(): Promise<ActionProposalDocument> {
        try {
            const value: unknown = JSON.parse(await readFile(this.path, "utf8"));
            validateDocument(value);
            return value;
        } catch (error) {
            if (errorCode(error) === "ENOENT") return { action_proposal_version: 1, proposals: [] };
            if (error instanceof ValidationError) throw error;
            throw new StoreUnavailable(`cannot read action proposal ledger: ${errorMessage(error)}`, { cause: error });
        }
    }

    async create(input: {
        capability: string;
        principal: string;
        scope: string;
        purpose: string;
        consequence: string;
        payload: CapabilityJsonValue;
        target: { label: string; fingerprint: `sha256:${string}` };
        sourceIds: readonly string[];
        createdAt: string;
        expiresAt: string;
    }): Promise<ActionProposalRecord> {
        if (
            !isRfc3339Utc(input.createdAt) ||
            !isRfc3339Utc(input.expiresAt) ||
            Date.parse(input.expiresAt) <= Date.parse(input.createdAt)
        )
            throw new ValidationError("action proposal requires a positive RFC 3339 UTC validity interval");
        for (const value of [
            input.capability,
            input.principal,
            input.scope,
            input.purpose,
            input.consequence,
            input.target.label,
        ])
            if (!isNotBlankString(value)) throw new ValidationError("action proposal text fields must be non-empty");
        if (!/^sha256:[0-9a-f]{64}$/.test(input.target.fingerprint))
            throw new ValidationError("action proposal target fingerprint is invalid");
        if (!input.sourceIds.length || !input.sourceIds.every(isNotBlankString))
            throw new ValidationError("action proposal requires source provenance");
        const proposal: ActionProposalRecord = {
            proposal_id: `action-proposal-${randomUUID()}`,
            capability: input.capability,
            principal: input.principal,
            scope: input.scope,
            purpose: input.purpose,
            consequence: input.consequence,
            payload: structuredClone(input.payload),
            payload_digest: boundPayloadDigest(input.payload, input.target.fingerprint),
            target: structuredClone(input.target),
            source_ids: [...input.sourceIds],
            created_at: input.createdAt,
            expires_at: input.expiresAt,
            status: "pending",
            presentations: [],
            decision: null,
            invalidation: null,
            attempt: null,
        };
        await this.mutate((document) => {
            document.proposals.push(proposal);
        });
        return structuredClone(proposal);
    }

    async present(input: {
        proposalId: string;
        principal: string;
        scope: string;
        surface: string;
        presentedAt: string;
    }): Promise<ActionProposalRecord> {
        return this.mutate((document) => {
            const proposal = requiredProposal(document, input.proposalId);
            if (
                proposal.status !== "pending" ||
                proposal.principal !== input.principal ||
                proposal.scope !== input.scope ||
                !isNotBlankString(input.surface) ||
                !isRfc3339Utc(input.presentedAt) ||
                Date.parse(input.presentedAt) > Date.parse(proposal.expires_at)
            )
                throw new ValidationError("action proposal cannot be presented in this authority context");
            proposal.presentations.push({
                presentation_id: `action-presentation-${randomUUID()}`,
                principal: input.principal,
                scope: input.scope,
                surface: input.surface,
                presented_at: input.presentedAt,
                payload_digest: proposal.payload_digest,
            });
            return structuredClone(proposal);
        });
    }

    async decide(input: {
        proposalId: string;
        decision: "approved" | "rejected";
        principal: string;
        payloadDigest: string;
        scope: string;
        surface: string;
        presentationId: string;
        decidedAt: string;
        authoritySourceId: string;
    }): Promise<ActionProposalRecord> {
        return this.mutate((document) => {
            const proposal = requiredProposal(document, input.proposalId);
            if (proposal.status !== "pending")
                throw new ValidationError("only a pending action proposal can be decided");
            const decidedAt = Date.parse(input.decidedAt);
            const presentation = proposal.presentations.find(
                (candidate) => candidate.presentation_id === input.presentationId,
            );
            if (
                (input.decision !== "approved" && input.decision !== "rejected") ||
                proposal.principal !== input.principal ||
                proposal.payload_digest !== input.payloadDigest ||
                !presentation ||
                presentation.principal !== input.principal ||
                presentation.scope !== input.scope ||
                presentation.surface !== input.surface ||
                proposal.scope !== input.scope ||
                !isRfc3339Utc(input.decidedAt) ||
                decidedAt < Date.parse(proposal.created_at) ||
                decidedAt > Date.parse(proposal.expires_at) ||
                !isNotBlankString(input.authoritySourceId)
            )
                throw new ValidationError("action decision does not match the current proposal authority boundary");
            proposal.decision = {
                decision_id: `action-decision-${randomUUID()}`,
                decision: input.decision,
                principal: input.principal,
                payload_digest: proposal.payload_digest,
                presentation_id: presentation.presentation_id,
                scope: input.scope,
                surface: input.surface,
                decided_at: input.decidedAt,
                authority_source_id: input.authoritySourceId,
            };
            proposal.status = input.decision === "approved" ? "approved" : "rejected";
            return structuredClone(proposal);
        });
    }

    async invalidate(input: {
        proposalId: string;
        kind: "withdrawn" | "superseded";
        principal: string;
        occurredAt: string;
        authoritySourceId: string;
        reason: string;
    }): Promise<ActionProposalRecord> {
        return this.mutate((document) => {
            const proposal = requiredProposal(document, input.proposalId);
            if (proposal.status !== "approved")
                throw new ValidationError("only an approved, not-yet-started proposal can be invalidated");
            if (
                (input.kind !== "withdrawn" && input.kind !== "superseded") ||
                proposal.principal !== input.principal ||
                !isRfc3339Utc(input.occurredAt) ||
                Date.parse(input.occurredAt) < Date.parse(proposal.decision!.decided_at) ||
                !isNotBlankString(input.authoritySourceId) ||
                !isNotBlankString(input.reason)
            )
                throw new ValidationError("action invalidation does not match the current proposal authority boundary");
            proposal.invalidation = {
                invalidation_id: `action-invalidation-${randomUUID()}`,
                kind: input.kind,
                principal: input.principal,
                occurred_at: input.occurredAt,
                authority_source_id: input.authoritySourceId,
                reason: input.reason,
            };
            proposal.status = input.kind;
            return structuredClone(proposal);
        });
    }

    async authorize(
        proposalId: string,
        capability: string,
        payload: CapabilityJsonValue,
        context: Pick<CapabilityContext, "principal" | "scope">,
        now: string,
    ): Promise<CapabilityAuthorityDecision> {
        const proposal = await this.correlate(proposalId, capability, payload, context);
        if (!proposal) return { status: "denied", reason: "action proposal does not exist" };
        if (!isRfc3339Utc(now) || Date.parse(now) > Date.parse(proposal.expires_at))
            return { status: "denied", reason: "action proposal approval is stale" };
        if (proposal.status === "pending")
            return { status: "approval_required", reason: `proposal ${proposal.proposal_id} requires exact approval` };
        if (proposal.status !== "approved" || proposal.decision?.decision !== "approved")
            return { status: "denied", reason: `action proposal is not execution eligible: ${proposal.status}` };
        return {
            status: "authorized",
            basis: "fresh_approval",
            sourceId: proposal.decision.decision_id,
            current: true,
        };
    }

    async correlate(
        proposalId: string,
        capability: string,
        payload: CapabilityJsonValue,
        context: Pick<CapabilityContext, "principal" | "scope">,
    ): Promise<ActionProposalRecord | null> {
        const proposal = (await this.load()).proposals.find((candidate) => candidate.proposal_id === proposalId);
        if (
            !proposal ||
            proposal.capability !== capability ||
            proposal.principal !== context.principal ||
            proposal.scope !== context.scope ||
            proposal.payload_digest !== boundPayloadDigest(payload, proposal.target.fingerprint)
        )
            return null;
        return structuredClone(proposal);
    }

    async beginAttempt(proposalId: string, now: string): Promise<ActionProposalRecord> {
        return this.mutate((document) => {
            const proposal = requiredProposal(document, proposalId);
            if (
                proposal.status !== "approved" ||
                proposal.attempt !== null ||
                !isRfc3339Utc(now) ||
                Date.parse(now) > Date.parse(proposal.expires_at)
            )
                throw new ValidationError("action proposal is no longer execution eligible");
            proposal.status = "executing";
            proposal.attempt = {
                attempt_id: `action-attempt-${randomUUID()}`,
                started_at: now,
                completed_at: null,
                outcome: "executing",
                phase: "prepared",
                evidence: null,
            };
            return structuredClone(proposal);
        });
    }

    async markSubmitted(proposalId: string): Promise<ActionProposalRecord> {
        return this.mutate((document) => {
            const proposal = requiredProposal(document, proposalId);
            if (proposal.status !== "executing" || proposal.attempt?.phase !== "prepared")
                throw new ValidationError("action proposal does not have a prepared attempt");
            proposal.attempt.phase = "submitted";
            return structuredClone(proposal);
        });
    }

    async completeAttempt(
        proposalId: string,
        outcome: "succeeded" | "failed" | "outcome_unknown",
        completedAt: string,
        evidence: CapabilityJsonValue,
    ): Promise<ActionProposalRecord> {
        return this.mutate((document) => {
            const proposal = requiredProposal(document, proposalId);
            if (
                proposal.status !== "executing" ||
                proposal.attempt?.outcome !== "executing" ||
                !isRfc3339Utc(completedAt) ||
                Date.parse(completedAt) < Date.parse(proposal.attempt.started_at)
            )
                throw new ValidationError("action proposal does not have an executing attempt");
            proposal.status = outcome;
            proposal.attempt.outcome = outcome;
            proposal.attempt.phase = "terminal";
            proposal.attempt.completed_at = completedAt;
            proposal.attempt.evidence = structuredClone(evidence);
            return structuredClone(proposal);
        });
    }

    async get(proposalId: string): Promise<ActionProposalRecord | null> {
        const proposal = (await this.load()).proposals.find((candidate) => candidate.proposal_id === proposalId);
        return proposal ? structuredClone(proposal) : null;
    }

    private async mutate<T>(update: (document: ActionProposalDocument) => T): Promise<T> {
        const lease = await this.lock.acquireWriteLease();
        try {
            const document = await this.load();
            const result = update(document);
            await this.replace(document);
            return result;
        } finally {
            await this.lock.releaseWriteLease(lease);
        }
    }

    private async replace(document: ActionProposalDocument) {
        validateDocument(document);
        await mkdir(dirname(this.path), { recursive: true });
        await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            durabilityUncertainMessage: "action proposal ledger replacement may be visible without durable sync",
        });
    }
}

export function payloadDigest(payload: CapabilityJsonValue): `sha256:${string}` {
    return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

function boundPayloadDigest(payload: CapabilityJsonValue, targetFingerprint: string): `sha256:${string}` {
    return payloadDigest({ payload, targetFingerprint });
}

function requiredProposal(document: ActionProposalDocument, proposalId: string) {
    const proposal = document.proposals.find((candidate) => candidate.proposal_id === proposalId);
    if (!proposal) throw new ValidationError(`action proposal does not exist: ${proposalId}`);
    return proposal;
}

function validateDocument(value: unknown): asserts value is ActionProposalDocument {
    if (
        !isObject(value) ||
        !exactKeys(value, ["action_proposal_version", "proposals"]) ||
        value.action_proposal_version !== 1 ||
        !Array.isArray(value.proposals)
    )
        throw new ValidationError("action proposal document is invalid");
    const ids = new Set<string>();
    for (const proposal of value.proposals) {
        if (!validProposal(proposal) || ids.has(proposal.proposal_id))
            throw new ValidationError("action proposal record is invalid");
        ids.add(proposal.proposal_id);
    }
}

function validProposal(value: unknown): value is ActionProposalRecord {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "attempt",
            "capability",
            "consequence",
            "created_at",
            "decision",
            "expires_at",
            "invalidation",
            "payload",
            "payload_digest",
            "presentations",
            "principal",
            "proposal_id",
            "purpose",
            "scope",
            "source_ids",
            "status",
            "target",
        ]) ||
        !isNotBlankString(value.proposal_id) ||
        !value.proposal_id.startsWith("action-proposal-") ||
        ![
            "pending",
            "approved",
            "rejected",
            "withdrawn",
            "superseded",
            "executing",
            "succeeded",
            "failed",
            "outcome_unknown",
        ].includes(String(value.status)) ||
        !isRfc3339Utc(value.created_at) ||
        !isRfc3339Utc(value.expires_at) ||
        !Array.isArray(value.source_ids) ||
        !value.source_ids.every(isNotBlankString) ||
        !isObject(value.target) ||
        !exactKeys(value.target, ["fingerprint", "label"]) ||
        !isNotBlankString(value.target.label) ||
        typeof value.target.fingerprint !== "string" ||
        !/^sha256:[0-9a-f]{64}$/.test(value.target.fingerprint) ||
        !Array.isArray(value.presentations) ||
        !value.presentations.every((presentation) => validPresentation(presentation, value)) ||
        typeof value.payload_digest !== "string" ||
        value.payload_digest !== boundPayloadDigest(value.payload as CapabilityJsonValue, value.target.fingerprint)
    )
        return false;
    if (!validDecision(value.decision, value) || !validInvalidation(value.invalidation, value)) return false;
    if (!validAttempt(value.attempt, value)) return false;
    if (value.status === "pending")
        return value.decision === null && value.invalidation === null && value.attempt === null;
    if (value.status === "approved")
        return value.decision?.decision === "approved" && value.invalidation === null && value.attempt === null;
    if (value.status === "rejected")
        return value.decision?.decision === "rejected" && value.invalidation === null && value.attempt === null;
    if (value.status === "withdrawn" || value.status === "superseded")
        return (
            value.decision?.decision === "approved" &&
            value.invalidation?.kind === value.status &&
            value.attempt === null
        );
    return (
        value.decision?.decision === "approved" &&
        value.invalidation === null &&
        value.attempt?.outcome === value.status
    );
}

function validDecision(value: unknown, proposal: Record<string, unknown>) {
    if (value === null) return true;
    return (
        isObject(value) &&
        exactKeys(value, [
            "authority_source_id",
            "decided_at",
            "decision",
            "decision_id",
            "payload_digest",
            "presentation_id",
            "principal",
            "scope",
            "surface",
        ]) &&
        isNotBlankString(value.decision_id) &&
        value.decision_id.startsWith("action-decision-") &&
        (value.decision === "approved" || value.decision === "rejected") &&
        value.principal === proposal.principal &&
        value.payload_digest === proposal.payload_digest &&
        isNotBlankString(value.presentation_id) &&
        value.presentation_id.startsWith("action-presentation-") &&
        value.scope === proposal.scope &&
        isNotBlankString(value.surface) &&
        Array.isArray(proposal.presentations) &&
        proposal.presentations.some(
            (presentation) =>
                isObject(presentation) &&
                presentation.presentation_id === value.presentation_id &&
                presentation.principal === value.principal &&
                presentation.scope === value.scope &&
                presentation.surface === value.surface,
        ) &&
        isRfc3339Utc(value.decided_at) &&
        Date.parse(value.decided_at) >= Date.parse(proposal.created_at as string) &&
        Date.parse(value.decided_at) <= Date.parse(proposal.expires_at as string) &&
        isNotBlankString(value.authority_source_id)
    );
}

function validPresentation(value: unknown, proposal: Record<string, unknown>) {
    return (
        isObject(value) &&
        exactKeys(value, ["payload_digest", "presentation_id", "presented_at", "principal", "scope", "surface"]) &&
        isNotBlankString(value.presentation_id) &&
        value.presentation_id.startsWith("action-presentation-") &&
        value.principal === proposal.principal &&
        value.scope === proposal.scope &&
        isNotBlankString(value.surface) &&
        isRfc3339Utc(value.presented_at) &&
        Date.parse(value.presented_at) <= Date.parse(proposal.expires_at as string) &&
        value.payload_digest === proposal.payload_digest
    );
}

function validInvalidation(value: unknown, proposal: Record<string, unknown>) {
    if (value === null) return true;
    const decision = proposal.decision;
    return (
        isObject(value) &&
        exactKeys(value, ["authority_source_id", "invalidation_id", "kind", "occurred_at", "principal", "reason"]) &&
        isNotBlankString(value.invalidation_id) &&
        value.invalidation_id.startsWith("action-invalidation-") &&
        (value.kind === "withdrawn" || value.kind === "superseded") &&
        value.principal === proposal.principal &&
        isRfc3339Utc(value.occurred_at) &&
        isObject(decision) &&
        Date.parse(value.occurred_at) >= Date.parse(decision.decided_at as string) &&
        isNotBlankString(value.authority_source_id) &&
        isNotBlankString(value.reason)
    );
}

function validAttempt(value: unknown, proposal: Record<string, unknown>) {
    if (value === null) return true;
    if (
        !isObject(value) ||
        !exactKeys(value, ["attempt_id", "completed_at", "evidence", "outcome", "phase", "started_at"]) ||
        !isNotBlankString(value.attempt_id) ||
        !value.attempt_id.startsWith("action-attempt-") ||
        !isRfc3339Utc(value.started_at) ||
        Date.parse(value.started_at) > Date.parse(proposal.expires_at as string) ||
        !["executing", "succeeded", "failed", "outcome_unknown"].includes(String(value.outcome)) ||
        !["prepared", "submitted", "terminal"].includes(String(value.phase))
    )
        return false;
    if (value.outcome === "executing")
        return (
            (value.phase === "prepared" || value.phase === "submitted") &&
            value.completed_at === null &&
            value.evidence === null
        );
    return (
        value.phase === "terminal" &&
        isRfc3339Utc(value.completed_at) &&
        Date.parse(value.completed_at) >= Date.parse(value.started_at) &&
        value.evidence !== null
    );
}

function errorCode(error: unknown) {
    return isObject(error) && typeof error.code === "string" ? error.code : null;
}
function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
