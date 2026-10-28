import type { CapabilityJsonValue } from "./execution.ts";
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
    objective_step: null | {
        objective_id: `objective-${string}`;
        objective_revision: number;
        episode_id: `objective-episode-${string}`;
        step_id: string;
        acceptance_condition_ids: string[];
    };
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
        awareness_basis: "explicit_material_restatement";
        awareness_digest: `sha256:${string}`;
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
        recovery_binding: CapabilityJsonValue;
    };
}
