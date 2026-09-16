import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { CapabilityAuthorityDecision, CapabilityContext, CapabilityJsonValue } from "./execution.ts";

import { StoreUnavailable, ValidationError } from "../core/errors.ts";
import { isRfc3339Utc } from "../core/model.ts";
import { replaceFileDurably } from "../persistence/file-replacement.ts";
import { exactKeys, isNotBlankString, isObject } from "../util.ts";

export type ActionProposalStatus =
    | "pending"
    | "approved"
    | "rejected"
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
    source_ids: string[];
    created_at: string;
    expires_at: string;
    status: ActionProposalStatus;
    decision: null | {
        decision_id: `action-decision-${string}`;
        decision: "approved" | "rejected";
        principal: string;
        payload_digest: `sha256:${string}`;
        decided_at: string;
        authority_source_id: string;
    };
    attempt: null | {
        attempt_id: `action-attempt-${string}`;
        started_at: string;
        completed_at: string | null;
        outcome: "executing" | "succeeded" | "failed" | "outcome_unknown";
        evidence: CapabilityJsonValue | null;
    };
}

interface ActionProposalDocument {
    action_proposal_version: 1;
    proposals: ActionProposalRecord[];
}

export class ActionProposalStore {
    readonly path: string;

    constructor(canonicalStatePath: string) {
        if (!canonicalStatePath.trim()) throw new ValidationError("action proposal store requires a state path");
        this.path = `${canonicalStatePath}.actions.json`;
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
        sourceIds: readonly string[];
        createdAt: string;
        expiresAt: string;
    }): Promise<ActionProposalRecord> {
        if (!isRfc3339Utc(input.createdAt) || !isRfc3339Utc(input.expiresAt) || input.expiresAt <= input.createdAt)
            throw new ValidationError("action proposal requires a positive RFC 3339 UTC validity interval");
        for (const value of [input.capability, input.principal, input.scope, input.purpose, input.consequence])
            if (!isNotBlankString(value)) throw new ValidationError("action proposal text fields must be non-empty");
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
            payload_digest: payloadDigest(input.payload),
            source_ids: [...input.sourceIds],
            created_at: input.createdAt,
            expires_at: input.expiresAt,
            status: "pending",
            decision: null,
            attempt: null,
        };
        const document = await this.load();
        document.proposals.push(proposal);
        await this.replace(document);
        return structuredClone(proposal);
    }

    async decide(input: {
        proposalId: string;
        decision: "approved" | "rejected";
        principal: string;
        payloadDigest: string;
        decidedAt: string;
        authoritySourceId: string;
    }): Promise<ActionProposalRecord> {
        const document = await this.load();
        const proposal = requiredProposal(document, input.proposalId);
        if (proposal.status !== "pending") throw new ValidationError("only a pending action proposal can be decided");
        if (
            (input.decision !== "approved" && input.decision !== "rejected") ||
            proposal.principal !== input.principal ||
            proposal.payload_digest !== input.payloadDigest ||
            !isRfc3339Utc(input.decidedAt) ||
            input.decidedAt < proposal.created_at ||
            input.decidedAt > proposal.expires_at ||
            !isNotBlankString(input.authoritySourceId)
        )
            throw new ValidationError("action decision does not match the current proposal authority boundary");
        proposal.decision = {
            decision_id: `action-decision-${randomUUID()}`,
            decision: input.decision,
            principal: input.principal,
            payload_digest: proposal.payload_digest,
            decided_at: input.decidedAt,
            authority_source_id: input.authoritySourceId,
        };
        proposal.status = input.decision === "approved" ? "approved" : "rejected";
        await this.replace(document);
        return structuredClone(proposal);
    }

    async authorize(
        proposalId: string,
        capability: string,
        payload: CapabilityJsonValue,
        context: Pick<CapabilityContext, "principal" | "scope">,
        now: string,
    ): Promise<CapabilityAuthorityDecision> {
        const proposal = (await this.load()).proposals.find((candidate) => candidate.proposal_id === proposalId);
        if (!proposal) return { status: "denied", reason: "action proposal does not exist" };
        if (
            proposal.capability !== capability ||
            proposal.principal !== context.principal ||
            proposal.scope !== context.scope ||
            proposal.payload_digest !== payloadDigest(payload)
        )
            return {
                status: "denied",
                reason: "action proposal does not match capability, payload, principal, and scope",
            };
        if (now > proposal.expires_at) return { status: "denied", reason: "action proposal approval is stale" };
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

    async beginAttempt(proposalId: string, now: string): Promise<ActionProposalRecord> {
        const document = await this.load();
        const proposal = requiredProposal(document, proposalId);
        if (proposal.status !== "approved" || proposal.attempt !== null || now > proposal.expires_at)
            throw new ValidationError("action proposal is no longer execution eligible");
        proposal.status = "executing";
        proposal.attempt = {
            attempt_id: `action-attempt-${randomUUID()}`,
            started_at: now,
            completed_at: null,
            outcome: "executing",
            evidence: null,
        };
        await this.replace(document);
        return structuredClone(proposal);
    }

    async completeAttempt(
        proposalId: string,
        outcome: "succeeded" | "failed" | "outcome_unknown",
        completedAt: string,
        evidence: CapabilityJsonValue,
    ): Promise<ActionProposalRecord> {
        const document = await this.load();
        const proposal = requiredProposal(document, proposalId);
        if (proposal.status !== "executing" || proposal.attempt?.outcome !== "executing")
            throw new ValidationError("action proposal does not have an executing attempt");
        proposal.status = outcome;
        proposal.attempt.outcome = outcome;
        proposal.attempt.completed_at = completedAt;
        proposal.attempt.evidence = structuredClone(evidence);
        await this.replace(document);
        return structuredClone(proposal);
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
            "payload",
            "payload_digest",
            "principal",
            "proposal_id",
            "purpose",
            "scope",
            "source_ids",
            "status",
        ]) ||
        !isNotBlankString(value.proposal_id) ||
        !value.proposal_id.startsWith("action-proposal-") ||
        !["pending", "approved", "rejected", "executing", "succeeded", "failed", "outcome_unknown"].includes(
            String(value.status),
        ) ||
        !isRfc3339Utc(value.created_at) ||
        !isRfc3339Utc(value.expires_at) ||
        !Array.isArray(value.source_ids) ||
        !value.source_ids.every(isNotBlankString) ||
        typeof value.payload_digest !== "string" ||
        value.payload_digest !== payloadDigest(value.payload as CapabilityJsonValue)
    )
        return false;
    if (value.decision !== null && (!isObject(value.decision) || !isNotBlankString(value.decision.decision_id)))
        return false;
    if (value.attempt !== null && (!isObject(value.attempt) || !isNotBlankString(value.attempt.attempt_id)))
        return false;
    return true;
}

function errorCode(error: unknown) {
    return isObject(error) && typeof error.code === "string" ? error.code : null;
}
function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
