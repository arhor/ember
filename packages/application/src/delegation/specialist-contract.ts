export type SpecialistRuntimeState =
    | "not_started"
    | "running"
    | "cancellation_requested"
    | "timed_out"
    | "exited"
    | "lost";
export type SpecialistReportState = "none" | "reported_success" | "reported_failure" | "ambiguous";
export type SpecialistDisposition =
    | "unresolved"
    | "blocked"
    | "accepted"
    | "qualified"
    | "rejected"
    | "stale"
    | "requires_re_evaluation";
export type SpecialistApplicability = "still_applicable" | "stale" | "requires_re_evaluation" | "rejected";
export type SpecialistEffectState = "no_effect_established" | "effects_possible" | "effects_known";
export type SpecialistRetryState =
    | "not_applicable"
    | "safe_without_reconciliation"
    | "prohibited_pending_reconciliation";

export interface SpecialistDerivationBasis {
    objective_revision: string;
    context_revision: string;
}

export interface SpecialistCurrentnessCheckpoint extends SpecialistDerivationBasis {
    objective_status: "current" | "superseded" | "cancelled";
}

export interface SpecialistCurrentnessEvaluation {
    checked_at: string;
    started_from: SpecialistDerivationBasis;
    checked_against: SpecialistCurrentnessCheckpoint;
    applicability: SpecialistApplicability;
    reason: string;
    resolution?: {
        decided_at: string;
        disposition: "accepted" | "qualified" | "rejected";
        reason: string;
    };
}

export interface SpecialistContextItem {
    content: string;
    provenance: string;
    scope: string;
    currentness: string;
}

export interface SpecialistRuntimeCapability {
    filesystem: {
        scope: "selected_workspace";
        mode: "read_write";
    };
    network_reach: "not_established";
    tools: string[];
    credentials: "allowlisted_runtime_auth";
}

export interface SpecialistExpansionRequest {
    kind: "additional_context" | "additional_authority" | "additional_capability";
    request: string;
    purpose: string;
    consequence: string;
    requires_decision_from: string;
}

export interface SpecialistEpisodeSpec {
    contractVersion: 2;
    episode_id: string;
    objective: string;
    acceptance: string[];
    context_projection: SpecialistContextItem[];
    authority_envelope: {
        principal: string;
        grant: string;
        provenance: string;
        currentness: string;
        permitted_actions: string[];
        prohibited_actions: string[];
        escalation_conditions: string[];
    };
    runtime_capability: SpecialistRuntimeCapability;
    workspace: { path: string; expected_identity: string; preserve_existing_changes: boolean };
    runtime_policy: {
        command: string;
        argument_prefix: string[];
        sandbox: "workspace-write";
        network: "no_additional_grant";
        configuration: "isolated";
        environment: "allowlisted_runtime_auth";
        timeout_seconds: number;
        stdout_limit_bytes: number;
        session_mode: "ephemeral";
    };
    currentness_basis: SpecialistDerivationBasis;
}

export interface SpecialistReport {
    contractVersion: 1;
    summary: string;
    objective_disposition: "completed" | "blocked" | "failed";
    artifacts_changed: string[];
    artifacts_inspected: string[];
    checks: Array<{ command: string; outcome: string }>;
    known_effects: string[];
    possible_effects: string[];
    blockers: string[];
    requested_follow_up: string[];
    expansion_requests: SpecialistExpansionRequest[];
}

export interface SpecialistObservation {
    observedAt: string;
    kind:
        | "specification_persisted"
        | "launch_attempted"
        | "child_started"
        | "thread_observed"
        | "cancellation_requested"
        | "timeout_observed"
        | "output_limit_observed"
        | "child_exit_observed"
        | "report_received"
        | "boundary_failure"
        | "recovery_reconciled";
    detail?: string;
}

export interface SpecialistTermination {
    reason: "explicit_cancellation" | "timeout" | "output_limit" | "boundary_failure";
    directChildExitObserved: boolean;
    all_specialist_work_stopped: "unknown" | "established";
}

export interface SpecialistRecoveryState {
    effect_state: SpecialistEffectState;
    continued_work_state: "not_applicable" | "unknown" | "stopped" | "made_harmless";
    retry_state: SpecialistRetryState;
    reconciliation_required: string | null;
}

export interface SpecialistReportProvenance {
    sourceRole: "specialist_report";
    source: "codex_specialist";
    episode_id: string;
}

export interface SpecialistEpisodeRecord {
    record_version: 3;
    specification: SpecialistEpisodeSpec;
    runtime_state: SpecialistRuntimeState;
    report_state: SpecialistReportState;
    agent_disposition: SpecialistDisposition;
    externalThreadId?: string;
    report?: SpecialistReport;
    report_provenance?: SpecialistReportProvenance;
    currentness_evaluation?: SpecialistCurrentnessEvaluation;
    termination?: SpecialistTermination;
    recovery: SpecialistRecoveryState;
    known_effects: string[];
    possible_effects: string[];
    observations: SpecialistObservation[];
}
