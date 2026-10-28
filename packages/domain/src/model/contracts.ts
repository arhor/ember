declare const idBrand: unique symbol;
type Brand<Name extends string> = string & { readonly [idBrand]: Name };

export type LineageId = Brand<"LineageId">;
export type AgentActor = `agent:${string}`;
export type MeaningId = Brand<"MeaningId">;
export type EvidenceId = Brand<"EvidenceId">;
export type RuntimeId = Brand<"RuntimeId">;
export type CognitionId = Brand<"CognitionId">;
export type OpportunityId = Brand<"OpportunityId">;
export type Currentness = "current" | "superseded" | "historical";
export type MeaningKind = "relationship" | "fact" | "preference" | "commitment" | "episode_meta";
export type SourceRole =
    | "user_command"
    | "agent_adoption"
    | "agent_expression_via_provider"
    | "runtime_observation"
    | "external_claim"
    | "agent_inference"
    | "agent_observation"
    | "delegated_report"
    | "fixture_fault";
export type EpistemicRole =
    | "user_testimony"
    | "agent_inference"
    | "external_claim"
    | "direct_observation"
    | "delegated_report"
    | "agent_commitment";
export type CognitionStatus =
    | "started"
    | "completed"
    | "failed"
    | "timed_out"
    | "cancellation_requested"
    | "outcome_unknown";
export type DeliveryStatus = "not_attempted" | "pending" | "displayed";
export type CognitionPurpose = "ordinary" | "explain";
export type CommitmentLifecycle = "live" | "fulfilled" | "cancelled";
export const COGNITION_OPPORTUNITY_MECHANISMS = [
    "foreground_probe",
    "runtime_start",
    "idle_opportunity",
    "external_timing",
] as const;
export type CognitionOpportunityMechanism = (typeof COGNITION_OPPORTUNITY_MECHANISMS)[number];
export type CognitionOpportunityDecision = "cognition" | "defer" | "no_cognition";
export type CognitionOpportunityStatus =
    | "evaluating"
    | "decided"
    | "failed"
    | "timed_out"
    | "cancellation_requested"
    | "outcome_unknown";

export interface RuntimeContract {
    localPrincipal: string;
    topology: typeof TOPOLOGY;
}

export interface ConstitutiveBoundary {
    boundaryId: "minimal-continuity-v1";
    text: string;
}

export interface Lineage {
    lineageId: LineageId;
    establishedAt: string;
    constitutiveBoundaries: ConstitutiveBoundary[];
}

interface EvidenceBase {
    evidenceId: EvidenceId;
    sourceRole: SourceRole;
    sourceActor: string;
    assertedPrincipal?: string;
    occurredAt: string;
    observedAt: string;
    derivedFromEvidenceIds: EvidenceId[];
    scope: string;
    relatedMeaningId?: MeaningId;
    cognitionId?: CognitionId;
    providerLabel?: string;
}

export interface AvailableUserEvidence extends EvidenceBase {
    sourceRole: "user_command";
    sourceActor: `user:${string}`;
    assertedPrincipal: string;
    derivedFromEvidenceIds: [];
    payloadMode: "retained_optional";
    availability: "available";
    payload: string;
    contentDigest: `sha256:${string}`;
    unavailableReason?: never;
}

export interface UnavailableUserDetailEvidence extends EvidenceBase {
    sourceRole: "user_command";
    sourceActor: `user:${string}`;
    assertedPrincipal: string;
    derivedFromEvidenceIds: [];
    payloadMode: "retained_optional";
    availability: "unavailable";
    relatedMeaningId: MeaningId;
    unavailableReason: string;
    payload?: never;
    contentDigest?: never;
}

export interface AgentAdoptionEvidence extends EvidenceBase {
    sourceRole: "agent_adoption";
    sourceActor: AgentActor;
    assertedPrincipal: string;
    derivedFromEvidenceIds: [EvidenceId];
    payloadMode: "descriptor_only";
}

export interface AgentExpressionEvidence extends EvidenceBase {
    sourceRole: "agent_expression_via_provider";
    sourceActor: AgentActor;
    assertedPrincipal: string;
    derivedFromEvidenceIds: [];
    payloadMode: "descriptor_only";
    cognitionId: CognitionId;
    providerLabel: string;
}

export interface RuntimeObservationEvidence extends EvidenceBase {
    sourceRole: "runtime_observation";
    sourceActor: "runtime";
    payloadMode: "descriptor_only";
}

export interface ExternalClaimEvidence extends EvidenceBase {
    sourceRole: "external_claim";
    sourceActor: `external:${string}`;
    derivedFromEvidenceIds: [];
    payloadMode: "descriptor_only";
}

export interface AgentInferenceEvidence extends EvidenceBase {
    sourceRole: "agent_inference";
    sourceActor: AgentActor;
    derivedFromEvidenceIds: [EvidenceId, ...EvidenceId[]];
    payloadMode: "descriptor_only";
}

export interface AgentObservationEvidence extends EvidenceBase {
    sourceRole: "agent_observation";
    sourceActor: AgentActor;
    derivedFromEvidenceIds: [];
    payloadMode: "descriptor_only";
}

export interface DelegatedReportEvidence extends EvidenceBase {
    sourceRole: "delegated_report";
    sourceActor: `delegate:${string}`;
    derivedFromEvidenceIds: EvidenceId[];
    payloadMode: "descriptor_only";
}

export interface FixtureFaultEvidence extends EvidenceBase {
    sourceRole: "fixture_fault";
    sourceActor: "runtime";
    assertedPrincipal: string;
    derivedFromEvidenceIds: [EvidenceId];
    payloadMode: "descriptor_only";
    relatedMeaningId: MeaningId;
}

export type Evidence =
    | AvailableUserEvidence
    | UnavailableUserDetailEvidence
    | AgentAdoptionEvidence
    | AgentExpressionEvidence
    | RuntimeObservationEvidence
    | ExternalClaimEvidence
    | AgentInferenceEvidence
    | AgentObservationEvidence
    | DelegatedReportEvidence
    | FixtureFaultEvidence;

interface MeaningBase {
    meaningId: MeaningId;
    kind: MeaningKind;
    owner: string;
    slot: string;
    scope: string;
    content: string;
    sourceEvidenceIds: EvidenceId[];
    epistemicRole: EpistemicRole;
    learnedAt: string;
    applicableFrom: string;
    applicableUntil: string | null;
    currentness: Currentness;
    prospectiveLifecycle: "none" | CommitmentLifecycle;
    supersedes: MeaningId | null;
    supersededBy: MeaningId | null;
    uncertainty: string | null;
}

export interface RelationshipMeaning extends MeaningBase {
    kind: "relationship";
    owner: `relationship:${string}`;
    epistemicRole: "user_testimony";
    currentness: "current";
    prospectiveLifecycle: "none";
    supersedes: null;
    supersededBy: null;
}

export interface FactMeaning extends MeaningBase {
    kind: "fact";
    owner: `user:${string}` | AgentActor | `external:${string}` | `delegate:${string}`;
    epistemicRole: Exclude<EpistemicRole, "agent_commitment">;
    currentness: "current" | "superseded";
    prospectiveLifecycle: "none";
}

export interface PreferenceMeaning extends MeaningBase {
    kind: "preference";
    owner: `user:${string}`;
    epistemicRole: "user_testimony";
    currentness: "current" | "superseded";
    prospectiveLifecycle: "none";
}

export interface CommitmentMeaning extends MeaningBase {
    kind: "commitment";
    owner: AgentActor;
    currentness: "current" | "historical";
    prospectiveLifecycle: CommitmentLifecycle;
    supersedes: null;
    supersededBy: null;
    epistemicRole: "agent_commitment";
}

export interface EpisodeMetaMeaning extends MeaningBase {
    kind: "episode_meta";
    owner: AgentActor | `relationship:${string}`;
    epistemicRole: "user_testimony";
    currentness: "current";
    prospectiveLifecycle: "none";
    supersedes: null;
    supersededBy: null;
}

export type Meaning = RelationshipMeaning | FactMeaning | PreferenceMeaning | CommitmentMeaning | EpisodeMetaMeaning;

export interface RecoveryAccount {
    previousRuntime: RuntimeId | null;
    currentRuntime: RuntimeId;
    gapKind: "initial_start" | "known_clean_stop_interval" | "uncertain_interruption_boundary";
    lastDurableObservationAt: string | null;
    cleanStopAt: string | null;
    restartAt: string;
    agentCognitionDuringInterval:
        | "not_applicable"
        | "none_in_supported_runtime"
        | "unknown_after_last_durable_observation";
    externalChangesDuringInterval: "unknown";
}

export interface RuntimeEpisode {
    runtimeId: RuntimeId;
    principal: string;
    activeScope: string;
    startedAt: string;
    lastDurableObservationAt: string;
    cleanStopAt: string | null;
    stopReason: string | null;
    recoveryAccount: RecoveryAccount;
}

export type ProviderTermination = {
    reason: "timeout" | "explicit_cancellation" | "output_limit";
    directChildExitObserved: boolean;
};

export interface CognitionEpisode {
    cognitionId: CognitionId;
    runtimeId: RuntimeId;
    principal: string;
    activeScope: string;
    providerLabel: string;
    purpose: CognitionPurpose;
    startedAt: string;
    lastDurableObservationAt: string;
    status: CognitionStatus;
    selectedMeaningIds: MeaningId[];
    selectedEvidenceIds: EvidenceId[];
    usedMeaningIds: MeaningId[];
    inputEvidenceId: EvidenceId;
    expressionEvidenceId: EvidenceId | null;
    deliveryStatus: DeliveryStatus;
    externalProviderThreadId?: string | null;
    providerTermination?: ProviderTermination | null;
}

export interface CognitionOpportunityOccurrence {
    opportunityId: OpportunityId;
    runtimeId: RuntimeId;
    principal: string;
    activeScope: string;
    mechanism: CognitionOpportunityMechanism;
    observedAt: string;
    lastDurableObservationAt: string;
    validatedRevision: number;
    projectedMeaningIds: MeaningId[];
    projectedEvidenceIds: EvidenceId[];
    status: CognitionOpportunityStatus;
    decision: CognitionOpportunityDecision | null;
    selectedMeaningIds: MeaningId[];
    interruptionStatus: "not_attempted";
    providerTermination: ProviderTermination | null;
}

export interface EmberState {
    schemaVersion: 1;
    revision: number;
    runtimeContract: RuntimeContract;
    lineage: Lineage;
    evidence: Evidence[];
    meanings: Meaning[];
    operations: {
        runtimeEpisodes: RuntimeEpisode[];
        cognitionEpisodes: CognitionEpisode[];
        cognitionOpportunities?: CognitionOpportunityOccurrence[];
    };
}

export const SCHEMA_VERSION = 1;
export const TOPOLOGY = "single-principal-single-writer" as const;
export const CONSTITUTIVE_TEXT =
    "The continuing agent owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.";
export const LEGACY_CONSTITUTIVE_TEXT =
    "Ember owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.";

export const ASCII_CONTROL_CHARACTER_CLASS = String.raw`[\u0000-\u001f\u007f]`;
export const ASCII_CONTROL_CHARACTER_PATTERN = new RegExp(ASCII_CONTROL_CHARACTER_CLASS);
export const ASCII_CONTROL_CHARACTERS_PATTERN = new RegExp(`${ASCII_CONTROL_CHARACTER_CLASS}+`, "g");
