import type { ActionProposalRecord } from "@ember/domain/capabilities/action-proposal.ts";
import type {
    CapabilityAuthorityDecision,
    CapabilityContext,
    CapabilityJsonValue,
} from "@ember/domain/capabilities/execution.ts";
export type { ActionProposalStatus, ActionProposalRecord } from "@ember/domain/capabilities/action-proposal.ts";
interface ActionProposalDocument {
    action_proposal_version: 1;
    proposals: ActionProposalRecord[];
}
export interface ActionProposalStore {
    readonly path: string;
    load(): Promise<ActionProposalDocument>;
    create(input: {
        capability: string;
        principal: string;
        scope: string;
        purpose: string;
        consequence: string;
        payload: CapabilityJsonValue;
        target: {
            label: string;
            fingerprint: `sha256:${string}`;
        };
        sourceIds: readonly string[];
        objectiveStep?: NonNullable<ActionProposalRecord["objective_step"]>;
        createdAt: string;
        expiresAt: string;
    }): Promise<ActionProposalRecord>;
    present(input: {
        proposalId: string;
        principal: string;
        scope: string;
        surface: string;
        presentedAt: string;
    }): Promise<ActionProposalRecord>;
    decide(input: {
        proposalId: string;
        decision: "approved" | "rejected";
        principal: string;
        payloadDigest: string;
        scope: string;
        surface: string;
        presentationId: string;
        decidedAt: string;
        authoritySourceId: string;
        materialConfirmation: string;
    }): Promise<ActionProposalRecord>;
    invalidate(input: {
        proposalId: string;
        kind: "withdrawn" | "superseded";
        principal: string;
        occurredAt: string;
        authoritySourceId: string;
        reason: string;
    }): Promise<ActionProposalRecord>;
    authorize(
        proposalId: string,
        capability: string,
        payload: CapabilityJsonValue,
        context: Pick<CapabilityContext, "principal" | "scope">,
        now: string,
    ): Promise<CapabilityAuthorityDecision>;
    correlate(
        proposalId: string,
        capability: string,
        payload: CapabilityJsonValue,
        context: Pick<CapabilityContext, "principal" | "scope">,
    ): Promise<ActionProposalRecord | null>;
    beginAttempt(proposalId: string, now: string, recoveryBinding: CapabilityJsonValue): Promise<ActionProposalRecord>;
    markSubmitted(proposalId: string): Promise<ActionProposalRecord>;
    completeAttempt(
        proposalId: string,
        outcome: "succeeded" | "failed" | "outcome_unknown",
        completedAt: string,
        evidence: CapabilityJsonValue,
    ): Promise<ActionProposalRecord>;
    get(proposalId: string): Promise<ActionProposalRecord | null>;
}
