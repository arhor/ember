import { randomUUID } from "node:crypto";

import { contentDigest, exactKeys, isNotBlankString, isObject } from "../util.ts";
import { ValidationError } from "./errors.ts";

declare const idBrand: unique symbol;
type Brand<Name extends string> = string & { readonly [idBrand]: Name };

export type LineageId = Brand<"LineageId">;
export type MeaningId = Brand<"MeaningId">;
export type EvidenceId = Brand<"EvidenceId">;
export type RuntimeId = Brand<"RuntimeId">;
export type CognitionId = Brand<"CognitionId">;
export type OpportunityId = Brand<"OpportunityId">;
export type Currentness = "current" | "superseded" | "historical";
export type MeaningKind = "relationship" | "fact" | "preference" | "commitment" | "episode_meta";
export type SourceRole =
    | "user_command"
    | "ember_adoption"
    | "ember_expression_via_provider"
    | "runtime_observation"
    | "external_claim"
    | "ember_inference"
    | "ember_observation"
    | "delegated_report"
    | "fixture_fault";
export type EpistemicRole =
    | "user_testimony"
    | "ember_inference"
    | "external_claim"
    | "direct_observation"
    | "delegated_report"
    | "ember_commitment";
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
    displayName: string;
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

export interface EmberAdoptionEvidence extends EvidenceBase {
    sourceRole: "ember_adoption";
    sourceActor: "ember";
    assertedPrincipal: string;
    derivedFromEvidenceIds: [EvidenceId];
    payloadMode: "descriptor_only";
}

export interface EmberExpressionEvidence extends EvidenceBase {
    sourceRole: "ember_expression_via_provider";
    sourceActor: "ember";
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

export interface EmberInferenceEvidence extends EvidenceBase {
    sourceRole: "ember_inference";
    sourceActor: "ember";
    derivedFromEvidenceIds: [EvidenceId, ...EvidenceId[]];
    payloadMode: "descriptor_only";
}

export interface EmberObservationEvidence extends EvidenceBase {
    sourceRole: "ember_observation";
    sourceActor: "ember";
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
    | EmberAdoptionEvidence
    | EmberExpressionEvidence
    | RuntimeObservationEvidence
    | ExternalClaimEvidence
    | EmberInferenceEvidence
    | EmberObservationEvidence
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
    owner: `user:${string}` | "ember" | `external:${string}` | `delegate:${string}`;
    epistemicRole: Exclude<EpistemicRole, "ember_commitment">;
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
    owner: "ember";
    currentness: "current" | "historical";
    prospectiveLifecycle: CommitmentLifecycle;
    supersedes: null;
    supersededBy: null;
    epistemicRole: "ember_commitment";
}

export interface EpisodeMetaMeaning extends MeaningBase {
    kind: "episode_meta";
    owner: "ember" | `relationship:${string}`;
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
    emberCognitionDuringInterval:
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
    "Ember owns this lineage across temporary cognition loci and must not fabricate experience during inactive intervals.";

export const ASCII_CONTROL_CHARACTER_CLASS = String.raw`[\u0000-\u001f\u007f]`;
export const ASCII_CONTROL_CHARACTER_PATTERN = new RegExp(ASCII_CONTROL_CHARACTER_CLASS);
export const ASCII_CONTROL_CHARACTERS_PATTERN = new RegExp(`${ASCII_CONTROL_CHARACTER_CLASS}+`, "g");

const TOP_FIELDS = ["evidence", "lineage", "meanings", "operations", "revision", "runtimeContract", "schemaVersion"];
const KINDS = new Set(["relationship", "fact", "preference", "commitment", "episode_meta"]);
const ROLES = new Set([
    "user_command",
    "ember_adoption",
    "ember_expression_via_provider",
    "runtime_observation",
    "external_claim",
    "ember_inference",
    "ember_observation",
    "delegated_report",
    "fixture_fault",
]);
const CURRENTNESS = new Set(["current", "superseded", "historical"]);
const OPPORTUNITY_DECISIONS = new Set(["cognition", "defer", "no_cognition"]);
const OPPORTUNITY_STATUSES = new Set([
    "evaluating",
    "decided",
    "failed",
    "timed_out",
    "cancellation_requested",
    "outcome_unknown",
]);

type IdPrefix = "lineage" | "meaning" | "evidence" | "runtime" | "cognition" | "opportunity";

export function newId(prefix: "lineage"): LineageId;
export function newId(prefix: "meaning"): MeaningId;
export function newId(prefix: "evidence"): EvidenceId;
export function newId(prefix: "runtime"): RuntimeId;
export function newId(prefix: "cognition"): CognitionId;
export function newId(prefix: "opportunity"): OpportunityId;
export function newId(prefix: IdPrefix): LineageId | MeaningId | EvidenceId | RuntimeId | CognitionId | OpportunityId {
    return `${prefix}-${randomUUID()}` as LineageId | MeaningId | EvidenceId | RuntimeId | CognitionId | OpportunityId;
}

export function nowUtc(): string {
    const fixed = process.env.EMBER_TEST_NOW;
    if (fixed) {
        requireTimestamp(fixed, "EMBER_TEST_NOW");
        return fixed;
    }
    return new Date().toISOString();
}

export function initialState(name: string, principal: string, timestamp = nowUtc()): EmberState {
    const state: EmberState = {
        schemaVersion: 1,
        revision: 0,
        runtimeContract: { localPrincipal: principal, topology: TOPOLOGY },
        lineage: {
            lineageId: newId("lineage"),
            displayName: name,
            establishedAt: timestamp,
            constitutiveBoundaries: [{ boundaryId: "minimal-continuity-v1", text: CONSTITUTIVE_TEXT }],
        },
        evidence: [],
        meanings: [],
        operations: { runtimeEpisodes: [], cognitionEpisodes: [], cognitionOpportunities: [] },
    };
    validateState(state);
    return state;
}

function safeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value);
}

function validId(value: unknown, prefix: string): boolean {
    return isNotBlankString(value) && value.startsWith(prefix);
}

export function isRfc3339Utc(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
    if (!match) {
        return false;
    }
    const year = Number(match[1]!);
    const month = Number(match[2]!);
    const day = Number(match[3]!);
    const hour = Number(match[4]!);
    const minute = Number(match[5]!);
    const second = Number(match[6]!);
    const fraction = match[7] ?? "";
    const millisecond = Number(fraction.slice(0, 3).padEnd(3, "0"));
    const instant = new Date(0);

    instant.setUTCFullYear(year, month - 1, day);
    instant.setUTCHours(hour, minute, second, millisecond);

    return (
        instant.getUTCFullYear() === year &&
        instant.getUTCMonth() === month - 1 &&
        instant.getUTCDate() === day &&
        instant.getUTCHours() === hour &&
        instant.getUTCMinutes() === minute &&
        instant.getUTCSeconds() === second &&
        instant.getUTCMilliseconds() === millisecond
    );
}

function requireTimestamp(value: unknown, path: string): asserts value is string {
    if (!isRfc3339Utc(value)) {
        throw new ValidationError(`${path} must be RFC 3339 UTC`);
    }
}

function sameSlot(a: Record<string, any>, b: Record<string, any>) {
    return ["kind", "owner", "slot", "scope"].every((key) => a[key] === b[key]);
}

export function validateState(state: unknown): asserts state is EmberState {
    const errors: string[] = [];
    const require = (condition: unknown, message: string) => {
        if (!condition) {
            errors.push(message);
        }
    };
    require(isObject(state), "state must be an object");
    if (!isObject(state)) {
        throw new ValidationError("state must be an object");
    }
    require(exactKeys(state, TOP_FIELDS), "top-level fields do not match schema v1");
    require(safeInteger(state.schemaVersion) && state.schemaVersion === 1, "unsupported schemaVersion");
    require(safeInteger(state.revision) && state.revision >= 0, "revision must be non-negative safe integer");

    const contract = isObject(state.runtimeContract) ? state.runtimeContract : {};
    require(isObject(state.runtimeContract), "runtimeContract must be an object");
    require(exactKeys(contract, ["localPrincipal", "topology"]), "runtimeContract contains unsupported fields");

    const principal = contract.localPrincipal;
    require(isNotBlankString(principal), "runtimeContract.localPrincipal must be non-empty");
    require(contract.topology === TOPOLOGY, "unsupported runtime topology");

    const lineage = isObject(state.lineage) ? state.lineage : {};
    require(isObject(state.lineage), "lineage must be an object");
    require(exactKeys(lineage, [
        "lineageId",
        "displayName",
        "establishedAt",
        "constitutiveBoundaries",
    ]), "lineage contains unsupported fields");
    require(validId(lineage.lineageId, "lineage-"), "lineageId must be stable lineage ID");
    require(isNotBlankString(lineage.displayName), "lineage displayName must be non-empty");
    require(isRfc3339Utc(lineage.establishedAt), "lineage.establishedAt must be RFC 3339 UTC");
    require(Array.isArray(lineage.constitutiveBoundaries) &&
        lineage.constitutiveBoundaries.length === 1, "exactly one constitutive boundary is required");
    if (Array.isArray(lineage.constitutiveBoundaries) && lineage.constitutiveBoundaries.length === 1) {
        require(JSON.stringify(lineage.constitutiveBoundaries[0]) ===
            JSON.stringify({
                boundaryId: "minimal-continuity-v1",
                text: CONSTITUTIVE_TEXT,
            }), "constitutive boundary must match the approved fixture");
    }

    require(Array.isArray(state.evidence), "evidence must be a list");
    require(Array.isArray(state.meanings), "meanings must be a list");
    const operations = isObject(state.operations) ? state.operations : {};
    require(isObject(state.operations), "operations must be an object");
    const legacyOperationFields = ["runtimeEpisodes", "cognitionEpisodes"];
    const currentOperationFields = [...legacyOperationFields, "cognitionOpportunities"];
    require(exactKeys(operations, legacyOperationFields) ||
        exactKeys(operations, currentOperationFields), "operations contains unsupported fields");
    require(Array.isArray(operations.runtimeEpisodes), "runtimeEpisodes must be a list");
    require(Array.isArray(operations.cognitionEpisodes), "cognitionEpisodes must be a list");
    if ("cognitionOpportunities" in operations) {
        require(Array.isArray(operations.cognitionOpportunities), "cognitionOpportunities must be a list");
    }

    const evidence: Record<string, any>[] = Array.isArray(state.evidence) ? state.evidence : [];
    const meanings: Record<string, any>[] = Array.isArray(state.meanings) ? state.meanings : [];
    const runtimes: Record<string, any>[] = Array.isArray(operations.runtimeEpisodes) ? operations.runtimeEpisodes : [];
    const cognitions: Record<string, any>[] = Array.isArray(operations.cognitionEpisodes)
        ? operations.cognitionEpisodes
        : [];
    const opportunities: Record<string, any>[] = Array.isArray(operations.cognitionOpportunities)
        ? operations.cognitionOpportunities
        : [];
    const allIds: string[] = isNotBlankString(lineage.lineageId)
        ? [lineage.lineageId, "minimal-continuity-v1"]
        : ["minimal-continuity-v1"];
    const evById = new Map<string, Record<string, any>>();
    const meaningById = new Map<string, Record<string, any>>();
    const runtimeById = new Map<string, Record<string, any>>();
    const cognitionById = new Map<string, Record<string, any>>();
    const opportunityById = new Map<string, Record<string, any>>();

    const evAllowed = new Set([
        "evidenceId",
        "sourceRole",
        "sourceActor",
        "assertedPrincipal",
        "occurredAt",
        "observedAt",
        "derivedFromEvidenceIds",
        "scope",
        "payloadMode",
        "availability",
        "payload",
        "contentDigest",
        "unavailableReason",
        "relatedMeaningId",
        "cognitionId",
        "providerLabel",
    ]);
    evidence.forEach((raw, index) => {
        const path = `evidence[${index}]`;
        const ev = isObject(raw) ? raw : {};
        require(isObject(raw), `${path} must be an object`);
        require(Object.keys(ev).every((k) => evAllowed.has(k)), `${path} contains unsupported fields`);
        require(validId(ev.evidenceId, "evidence-"), `${path}.evidenceId is invalid`);
        if (isNotBlankString(ev.evidenceId)) {
            allIds.push(ev.evidenceId);
            evById.set(ev.evidenceId, ev);
        }
        require(ROLES.has(ev.sourceRole), `${path}.sourceRole is unsupported`);
        require(isNotBlankString(ev.sourceActor), `${path}.sourceActor must be non-empty`);
        require(isNotBlankString(ev.scope), `${path}.scope must be non-empty`);
        require(isRfc3339Utc(ev.occurredAt), `${path}.occurredAt must be RFC 3339 UTC`);
        require(isRfc3339Utc(ev.observedAt), `${path}.observedAt must be RFC 3339 UTC`);
        if (isRfc3339Utc(ev.occurredAt) && isRfc3339Utc(ev.observedAt))
            require(Date.parse(ev.occurredAt) <=
                Date.parse(ev.observedAt), `${path} occurrence must not follow observation`);
        require(Array.isArray(ev.derivedFromEvidenceIds) &&
            ev.derivedFromEvidenceIds.every(isNotBlankString), `${path}.derivedFromEvidenceIds must be IDs`);
        if ("relatedMeaningId" in ev)
            require(isNotBlankString(ev.relatedMeaningId), `${path}.relatedMeaningId must be an ID`);
        if ("cognitionId" in ev) require(isNotBlankString(ev.cognitionId), `${path}.cognitionId must be an ID`);
        if ("providerLabel" in ev)
            require(isNotBlankString(ev.providerLabel), `${path}.providerLabel must be non-empty`);
        require(["retained_optional", "descriptor_only"].includes(ev.payloadMode), `${path}.payloadMode is invalid`);
        if (ev.payloadMode === "retained_optional") {
            require(["available", "unavailable"].includes(ev.availability), `${path}.availability is invalid`);
            if (ev.availability === "available") {
                require(typeof ev.payload === "string", `${path}.payload must be retained while available`);
                require(!("unavailableReason" in ev), `${path}.unavailableReason is invalid while available`);
                if (typeof ev.payload === "string")
                    require(ev.contentDigest ===
                        contentDigest(ev.payload), `${path}.contentDigest does not match payload`);
            } else {
                require(!("payload" in ev) && !("contentDigest" in ev), `${path} leaks unavailable payload or digest`);
                require(isNotBlankString(ev.unavailableReason), `${path}.unavailableReason is required`);
            }
        } else if (ev.payloadMode === "descriptor_only") {
            for (const f of ["availability", "payload", "contentDigest", "unavailableReason"])
                require(!(f in ev), `${path} descriptor-only evidence contains ${f}`);
        }
        const derived = Array.isArray(ev.derivedFromEvidenceIds) ? ev.derivedFromEvidenceIds : [];
        if (ev.sourceRole === "user_command") {
            require(ev.assertedPrincipal === principal, `${path} principal does not match runtime contract`);
            require(ev.sourceActor === `user:${principal}`, `${path} user actor does not match principal`);
            require(derived.length === 0, `${path} user command cannot derive from another occurrence`);
            require(ev.payloadMode === "retained_optional", `${path} user command must use retained-optional payload`);
        } else if ("assertedPrincipal" in ev)
            require(ev.assertedPrincipal === principal, `${path} asserted principal does not match runtime contract`);
        if (ev.sourceRole === "ember_adoption") {
            require(ev.sourceActor === "ember", `${path} adoption must be Ember-owned evidence`);
            require(derived.length === 1, `${path} adoption needs exactly one requesting occurrence`);
            require(ev.payloadMode === "descriptor_only", `${path} adoption must be descriptor-only`);
        }
        if (ev.sourceRole === "ember_expression_via_provider") {
            require(ev.payloadMode === "descriptor_only", `${path} provider expression must be descriptor-only`);
            require(ev.sourceActor === "ember", `${path} provider expression actor must be Ember`);
            require(isNotBlankString(ev.cognitionId), `${path} provider expression needs cognitionId`);
            require(isNotBlankString(ev.providerLabel), `${path} provider expression needs providerLabel`);
            require(derived.length === 0, `${path} provider expression cannot derive new evidence`);
            require(!("relatedMeaningId" in ev), `${path} provider expression cannot attach detail`);
        }
        if (ev.sourceRole === "external_claim") {
            require(typeof ev.sourceActor === "string" &&
                ev.sourceActor.startsWith("external:") &&
                ev.sourceActor.length > "external:".length, `${path} external claim actor must identify its source`);
            require(derived.length === 0, `${path} external claim is a source occurrence, not a derivative`);
            require(ev.payloadMode === "descriptor_only", `${path} external claim must be descriptor-only`);
        }
        if (ev.sourceRole === "ember_inference") {
            require(ev.sourceActor === "ember", `${path} inference actor must be Ember`);
            require(derived.length >= 1, `${path} inference needs source evidence`);
            require(ev.payloadMode === "descriptor_only", `${path} inference must be descriptor-only`);
        }
        if (ev.sourceRole === "ember_observation") {
            require(ev.sourceActor === "ember", `${path} direct observation actor must be Ember`);
            require(derived.length === 0, `${path} direct observation cannot masquerade as a derivative`);
            require(ev.payloadMode === "descriptor_only", `${path} direct observation must be descriptor-only`);
        }
        if (ev.sourceRole === "delegated_report") {
            require(typeof ev.sourceActor === "string" &&
                ev.sourceActor.startsWith("delegate:") &&
                ev.sourceActor.length >
                    "delegate:".length, `${path} delegated report actor must identify its delegate`);
            require(ev.payloadMode === "descriptor_only", `${path} delegated report must be descriptor-only`);
        }
        if (["runtime_observation", "fixture_fault"].includes(ev.sourceRole)) {
            require(ev.sourceActor === "runtime", `${path} runtime evidence actor must be runtime`);
            require(ev.payloadMode === "descriptor_only", `${path} runtime evidence must be descriptor-only`);
        }
        if (ev.sourceRole === "fixture_fault") {
            require(derived.length === 1, `${path} fixture fault needs exactly one affected occurrence`);
            require(isNotBlankString(ev.relatedMeaningId), `${path} fixture fault needs related episode meaning`);
        }
    });

    const slots = new Map<string, string>();
    const meaningFields = [
        "meaningId",
        "kind",
        "owner",
        "slot",
        "scope",
        "content",
        "sourceEvidenceIds",
        "epistemicRole",
        "learnedAt",
        "applicableFrom",
        "applicableUntil",
        "currentness",
        "prospectiveLifecycle",
        "supersedes",
        "supersededBy",
        "uncertainty",
    ];
    meanings.forEach((raw, index) => {
        const path = `meanings[${index}]`;
        const m = isObject(raw) ? raw : {};
        require(isObject(raw), `${path} must be an object`);
        require(exactKeys(m, meaningFields), `${path} fields do not match schema v1`);
        require(validId(m.meaningId, "meaning-"), `${path}.meaningId is invalid`);
        if (isNotBlankString(m.meaningId)) {
            allIds.push(m.meaningId);
            meaningById.set(m.meaningId, m);
        }
        require(KINDS.has(m.kind), `${path}.kind is unsupported`);
        for (const f of ["owner", "slot", "scope", "content", "epistemicRole"])
            require(isNotBlankString(m[f]), `${path}.${f} must be non-empty`);
        require(Array.isArray(m.sourceEvidenceIds) &&
            m.sourceEvidenceIds.length > 0 &&
            m.sourceEvidenceIds.every(isNotBlankString), `${path} needs source evidence`);
        require(isRfc3339Utc(m.learnedAt), `${path}.learnedAt must be RFC 3339 UTC`);
        require(isRfc3339Utc(m.applicableFrom), `${path}.applicableFrom must be RFC 3339 UTC`);
        if (m.applicableUntil !== null)
            require(isRfc3339Utc(m.applicableUntil), `${path}.applicableUntil must be RFC 3339 UTC`);
        require(CURRENTNESS.has(m.currentness), `${path}.currentness is invalid`);
        require("uncertainty" in m, `${path}.uncertainty must be explicit`);
        if (m.kind === "relationship") {
            require(m.owner === `relationship:${principal}`, `${path} relationship owner is invalid`);
            require(m.slot === "relationship", `${path} relationship slot must be fixed`);
            require(m.currentness === "current", `${path} relationship must remain current in v1`);
            require(m.prospectiveLifecycle === "none", `${path} relationship lifecycle is unsupported`);
        } else if (m.kind === "fact") {
            require(m.owner === `user:${principal}` ||
                m.owner === "ember" ||
                (typeof m.owner === "string" &&
                    m.owner.startsWith("external:") &&
                    m.owner.length > "external:".length) ||
                (typeof m.owner === "string" &&
                    m.owner.startsWith("delegate:") &&
                    m.owner.length > "delegate:".length), `${path} fact owner is invalid`);
            require(["current", "superseded"].includes(m.currentness), `${path} fact currentness is invalid`);
            require(m.prospectiveLifecycle === "none", `${path} fact prospective lifecycle is invalid`);
            require(m.applicableUntil === null, `${path} fact applicability interval cannot be rewritten in v1`);
            if (m.currentness === "superseded")
                require(m.epistemicRole ===
                    "user_testimony", `${path} only user testimony supports supersession in v1`);
        } else if (m.kind === "preference") {
            require(m.owner === `user:${principal}`, `${path} preference owner must be the supported user`);
            require(["current", "superseded"].includes(m.currentness), `${path} preference currentness is invalid`);
            require(m.prospectiveLifecycle === "none", `${path} preference prospective lifecycle is invalid`);
            require(m.applicableUntil === null, `${path} preference applicability interval cannot be rewritten in v1`);
        } else if (m.kind === "commitment") {
            require(m.owner === "ember", `${path} commitment owner must be Ember`);
            require(["live", "fulfilled", "cancelled"].includes(
                m.prospectiveLifecycle,
            ), `${path} commitment lifecycle is invalid`);
            if (m.prospectiveLifecycle === "live") {
                require(m.currentness === "current", `${path} live commitment must be current`);
                require(m.applicableUntil === null, `${path} live commitment cannot have applicability end`);
            } else {
                require(m.currentness === "historical", `${path} discharged commitment must be historical`);
                require(isRfc3339Utc(m.applicableUntil), `${path} discharged commitment needs applicability end`);
            }
        } else if (m.kind === "episode_meta") {
            require(["ember", `relationship:${principal}`].includes(m.owner), `${path} episode owner is invalid`);
            require(m.currentness === "current", `${path} episode meta must be current`);
            require(m.prospectiveLifecycle === "none", `${path} episode meta lifecycle is invalid`);
        }
        if (m.currentness === "current") {
            const key = JSON.stringify([m.kind, m.owner, m.slot, m.scope]);
            require(!slots.has(key), `duplicate current meaning for ${key}`);
            slots.set(key, m.meaningId);
            require(m.supersededBy === null, `${path} current meaning cannot have a successor`);
        }
        if (m.currentness === "superseded")
            require(isNotBlankString(m.supersededBy), `${path} superseded meaning needs a successor`);
        if (!["fact", "preference"].includes(m.kind))
            require(m.supersedes === null && m.supersededBy === null, `${path} kind does not support supersession`);
    });

    const recoveryFields = [
        "previousRuntime",
        "currentRuntime",
        "gapKind",
        "lastDurableObservationAt",
        "cleanStopAt",
        "restartAt",
        "emberCognitionDuringInterval",
        "externalChangesDuringInterval",
    ];
    const runtimeFields = [
        "runtimeId",
        "principal",
        "activeScope",
        "startedAt",
        "lastDurableObservationAt",
        "cleanStopAt",
        "stopReason",
        "recoveryAccount",
    ];
    runtimes.forEach((raw, index) => {
        const p = `runtimeEpisodes[${index}]`;
        const r = isObject(raw) ? raw : {};
        require(isObject(raw), `${p} must be an object`);
        require(exactKeys(r, runtimeFields), `${p} fields do not match schema v1`);
        require(validId(r.runtimeId, "runtime-"), `${p}.runtimeId is invalid`);
        if (isNotBlankString(r.runtimeId)) {
            allIds.push(r.runtimeId);
            runtimeById.set(r.runtimeId, r);
        }
        require(r.principal === principal, `${p}.principal mismatch`);
        require(isNotBlankString(r.activeScope), `${p}.activeScope must be explicit`);
        require(isRfc3339Utc(r.startedAt), `${p}.startedAt must be RFC 3339 UTC`);
        require(isRfc3339Utc(r.lastDurableObservationAt), `${p}.lastDurableObservationAt must be RFC 3339 UTC`);
        if (isRfc3339Utc(r.startedAt) && isRfc3339Utc(r.lastDurableObservationAt))
            require(Date.parse(r.startedAt) <=
                Date.parse(r.lastDurableObservationAt), `${p} durable observation precedes runtime start`);
        if (r.cleanStopAt !== null) {
            require(isRfc3339Utc(r.cleanStopAt), `${p}.cleanStopAt must be RFC 3339 UTC`);
            if (isRfc3339Utc(r.lastDurableObservationAt) && isRfc3339Utc(r.cleanStopAt)) {
                require(Date.parse(r.lastDurableObservationAt) <=
                    Date.parse(r.cleanStopAt), `${p} clean stop precedes durable observation`);
            }
            require(isNotBlankString(r.stopReason), `${p}.stopReason required for clean stop`);
        } else require(r.stopReason === null, `${p}.stopReason without clean stop`);
        require(isObject(r.recoveryAccount), `${p}.recoveryAccount must be an object`);
        if (isObject(r.recoveryAccount))
            require(exactKeys(
                r.recoveryAccount,
                recoveryFields,
            ), `${r.runtimeId} recovery account fields do not match schema v1`);
    });

    const cognitionFields = [
        "cognitionId",
        "runtimeId",
        "principal",
        "activeScope",
        "providerLabel",
        "purpose",
        "startedAt",
        "lastDurableObservationAt",
        "status",
        "selectedMeaningIds",
        "selectedEvidenceIds",
        "usedMeaningIds",
        "inputEvidenceId",
        "expressionEvidenceId",
        "deliveryStatus",
    ];
    const cognitionFieldsWithOperationalEvidence = [
        ...cognitionFields,
        "externalProviderThreadId",
        "providerTermination",
    ];

    for (let index = 0; index < cognitions.length; index++) {
        const raw = cognitions[index];
        const p = `cognitionEpisodes[${index}]`;
        const c = isObject(raw) ? raw : {};

        require(isObject(raw), `${p} must be an object`);
        require(exactKeys(c, cognitionFields) ||
            exactKeys(c, cognitionFieldsWithOperationalEvidence), `${p} fields do not match schema v1`);
        require(validId(c.cognitionId, "cognition-"), `${p}.cognitionId is invalid`);
        if (isNotBlankString(c.cognitionId)) {
            allIds.push(c.cognitionId);
            cognitionById.set(c.cognitionId, c);
        }
        require(isNotBlankString(c.runtimeId), `${p}.runtimeId must be an ID`);
        require(c.principal === principal, `${p}.principal mismatch`);
        require(isNotBlankString(c.activeScope), `${p}.activeScope must be explicit`);
        require(["ordinary", "explain"].includes(c.purpose), `${p}.purpose is invalid`);
        require(isNotBlankString(c.providerLabel), `${p}.providerLabel is required`);
        require(isRfc3339Utc(c.startedAt), `${p}.startedAt must be RFC 3339 UTC`);
        require(isRfc3339Utc(c.lastDurableObservationAt), `${p}.lastDurableObservationAt must be RFC 3339 UTC`);
        require(["started", "completed", "failed", "timed_out", "cancellation_requested", "outcome_unknown"].includes(
            c.status,
        ), `${p}.status is invalid`);
        if ("externalProviderThreadId" in c && c.externalProviderThreadId !== null) {
            require(typeof c.externalProviderThreadId === "string" &&
                c.externalProviderThreadId.length > 0 &&
                c.externalProviderThreadId.length <= 512 &&
                !ASCII_CONTROL_CHARACTER_PATTERN.test(
                    c.externalProviderThreadId,
                ), `${p}.externalProviderThreadId is invalid`);
        }
        if ("providerTermination" in c && c.providerTermination !== null) {
            require(isObject(c.providerTermination) &&
                exactKeys(c.providerTermination, [
                    "reason",
                    "directChildExitObserved",
                ]), `${p}.providerTermination is invalid`);
            if (isObject(c.providerTermination)) {
                require(["timeout", "explicit_cancellation", "output_limit"].includes(
                    c.providerTermination.reason,
                ), `${p}.providerTermination.reason is invalid`);
                require(typeof c.providerTermination.directChildExitObserved ===
                    "boolean", `${p}.providerTermination.directChildExitObserved is invalid`);
                const reason = c.providerTermination.reason;
                const observed = c.providerTermination.directChildExitObserved;
                const consistent =
                    c.status === "timed_out"
                        ? reason === "timeout" && observed === true
                        : c.status === "cancellation_requested"
                          ? reason === "explicit_cancellation"
                          : c.status === "failed"
                            ? reason === "output_limit" && observed === true
                            : c.status === "outcome_unknown"
                              ? observed === false
                              : false;
                require(consistent, `${p}.providerTermination contradicts cognition status`);
            }
        }
        for (const f of ["selectedMeaningIds", "selectedEvidenceIds", "usedMeaningIds"]) {
            require(Array.isArray(c[f]) && c[f].every(isNotBlankString), `${p}.${f} must be an ID list`);
        }
        require(isNotBlankString(c.inputEvidenceId), `${p}.inputEvidenceId is required`);
        require(["not_attempted", "pending", "displayed"].includes(c.deliveryStatus), `${p}.deliveryStatus is invalid`);
        if (c.status === "completed") {
            require(isNotBlankString(c.expressionEvidenceId), `${p} completed cognition needs expression evidence`);
            require(["pending", "displayed"].includes(
                c.deliveryStatus,
            ), `${p} completed cognition needs delivery state`);
        } else {
            require(c.expressionEvidenceId === null, `${p} incomplete cognition cannot claim expression`);
            require(c.deliveryStatus === "not_attempted", `${p} incomplete cognition cannot claim delivery`);
            require(Array.isArray(c.usedMeaningIds) &&
                c.usedMeaningIds.length === 0, `${p} incomplete cognition cannot claim used meanings`);
        }
    }

    const opportunityFields = [
        "opportunityId",
        "runtimeId",
        "principal",
        "activeScope",
        "mechanism",
        "observedAt",
        "lastDurableObservationAt",
        "validatedRevision",
        "projectedMeaningIds",
        "projectedEvidenceIds",
        "status",
        "decision",
        "selectedMeaningIds",
        "interruptionStatus",
        "providerTermination",
    ];
    for (let index = 0; index < opportunities.length; index++) {
        const raw = opportunities[index];
        const p = `cognitionOpportunities[${index}]`;
        const o = isObject(raw) ? raw : {};
        require(isObject(raw), `${p} must be an object`);
        require(exactKeys(o, opportunityFields), `${p} fields do not match schema v1`);
        require(validId(o.opportunityId, "opportunity-"), `${p}.opportunityId is invalid`);
        if (isNotBlankString(o.opportunityId)) {
            allIds.push(o.opportunityId);
            opportunityById.set(o.opportunityId, o);
        }
        require(isNotBlankString(o.runtimeId), `${p}.runtimeId must be an ID`);
        require(o.principal === principal, `${p}.principal mismatch`);
        require(isNotBlankString(o.activeScope), `${p}.activeScope must be explicit`);
        require((COGNITION_OPPORTUNITY_MECHANISMS as readonly unknown[]).includes(
            o.mechanism,
        ), `${p}.mechanism is invalid`);
        require(isRfc3339Utc(o.observedAt), `${p}.observedAt must be RFC 3339 UTC`);
        require(isRfc3339Utc(o.lastDurableObservationAt), `${p}.lastDurableObservationAt must be RFC 3339 UTC`);
        if (isRfc3339Utc(o.observedAt) && isRfc3339Utc(o.lastDurableObservationAt)) {
            require(Date.parse(o.observedAt) <=
                Date.parse(o.lastDurableObservationAt), `${p} durable observation precedes opportunity observation`);
        }
        require(safeInteger(o.validatedRevision) &&
            o.validatedRevision >= 0, `${p}.validatedRevision must be a non-negative safe integer`);
        for (const f of ["projectedMeaningIds", "projectedEvidenceIds", "selectedMeaningIds"]) {
            require(Array.isArray(o[f]) && o[f].every(isNotBlankString), `${p}.${f} must be an ID list`);
            if (Array.isArray(o[f]))
                require(new Set(o[f]).size === o[f].length, `${p}.${f} must not contain duplicates`);
        }
        require(OPPORTUNITY_STATUSES.has(o.status), `${p}.status is invalid`);
        require(o.decision === null || OPPORTUNITY_DECISIONS.has(o.decision), `${p}.decision is invalid`);
        require(o.interruptionStatus === "not_attempted", `${p}.interruptionStatus must remain not_attempted in v1`);
        require(o.providerTermination === null ||
            (isObject(o.providerTermination) &&
                exactKeys(o.providerTermination, [
                    "reason",
                    "directChildExitObserved",
                ])), `${p}.providerTermination is invalid`);
        if (isObject(o.providerTermination)) {
            require(["timeout", "explicit_cancellation", "output_limit"].includes(
                o.providerTermination.reason,
            ), `${p}.providerTermination.reason is invalid`);
            require(typeof o.providerTermination.directChildExitObserved ===
                "boolean", `${p}.providerTermination.directChildExitObserved is invalid`);
        }
        if (o.status === "decided") {
            require(OPPORTUNITY_DECISIONS.has(o.decision), `${p} decided opportunity needs a decision`);
            require(o.providerTermination === null, `${p} decided opportunity cannot claim provider termination`);
            if (o.decision === "no_cognition")
                require(Array.isArray(o.selectedMeaningIds) &&
                    o.selectedMeaningIds.length === 0, `${p} no_cognition must not select a meaning`);
            if (o.decision === "cognition" || o.decision === "defer")
                require(Array.isArray(o.selectedMeaningIds) &&
                    o.selectedMeaningIds.length > 0, `${p} ${o.decision} must select at least one meaning`);
        } else {
            require(o.decision === null, `${p} non-decided opportunity cannot claim a decision`);
            require(Array.isArray(o.selectedMeaningIds) &&
                o.selectedMeaningIds.length === 0, `${p} non-decided opportunity cannot claim selected meanings`);
            if (o.status === "evaluating")
                require(o.providerTermination ===
                    null, `${p} evaluating opportunity cannot claim provider termination`);
            if (o.status === "timed_out")
                require(isObject(o.providerTermination) &&
                    o.providerTermination.reason === "timeout" &&
                    o.providerTermination.directChildExitObserved ===
                        true, `${p} timeout termination evidence contradicts status`);
            if (o.status === "cancellation_requested" && isObject(o.providerTermination))
                require(o.providerTermination.reason ===
                    "explicit_cancellation", `${p} cancellation termination evidence contradicts status`);
            if (o.status === "outcome_unknown" && isObject(o.providerTermination))
                require(o.providerTermination.directChildExitObserved ===
                    false, `${p} unknown outcome cannot claim confirmed child exit`);
            if (o.status === "failed" && isObject(o.providerTermination))
                require(o.providerTermination.reason === "output_limit" &&
                    o.providerTermination.directChildExitObserved ===
                        true, `${p} failure termination evidence contradicts status`);
        }
    }

    if (errors.length) {
        throw new ValidationError([...new Set(errors)].join("; "));
    }
    require(allIds.length === new Set(allIds).size, "all canonical IDs must be unique");

    for (const [id, ev] of evById) {
        for (const parent of ev.derivedFromEvidenceIds) {
            const source = evById.get(parent);
            require(!!source, `${id} derives from absent evidence ${parent}`);
            if (source) {
                require(source.scope === ev.scope, `${id} derivation crosses evidence scope`);
            }
        }
        if (ev.relatedMeaningId !== undefined) {
            require(meaningById.has(ev.relatedMeaningId), `${id} relates to absent meaning ${ev.relatedMeaningId}`);
        }
        if (ev.cognitionId !== undefined) {
            require(cognitionById.has(ev.cognitionId), `${id} refers to absent cognition ${ev.cognitionId}`);
        }
        if (ev.payloadMode === "retained_optional" && ev.availability === "unavailable") {
            const related = meaningById.get(ev.relatedMeaningId);
            const cited = meanings.some((m) => m.sourceEvidenceIds.includes(id));
            const faults = evidence.filter(
                (f) =>
                    f.sourceRole === "fixture_fault" &&
                    JSON.stringify(f.derivedFromEvidenceIds) === JSON.stringify([id]) &&
                    f.relatedMeaningId === ev.relatedMeaningId,
            );
            require(ev.sourceRole === "user_command", `${id} unavailable evidence must be attached user detail`);
            require(related?.kind === "episode_meta", `${id} unavailable evidence must relate to episode_meta`);
            if (related) {
                require(ev.scope === related.scope, `${id} unavailable detail scope mismatch`);
            }
            require(!cited, `${id} governing evidence cannot degrade locally`);
            require(faults.length === 1, `${id} unavailable detail needs exactly one fixture-fault occurrence`);
        }
    }

    for (const [id, m] of meaningById) {
        for (const ref of m.sourceEvidenceIds) require(evById.has(ref), `${id} cites absent evidence ${ref}`);
        if (m.supersedes !== null) {
            const prior = meaningById.get(m.supersedes);
            require(!!prior, `${id} supersedes absent meaning`);
            if (prior) {
                require(prior.supersededBy === id, `${id} predecessor link is not reciprocal`);
                require(sameSlot(m, prior), `${id} crosses kind, owner, slot, or scope`);
                require(prior.currentness === "superseded", `${id} predecessor is not superseded`);
            }
        }
        if (m.supersededBy !== null) {
            const later = meaningById.get(m.supersededBy);
            require(!!later, `${id} successor is absent`);
            if (later) {
                require(later.supersedes === id, `${id} successor link is not reciprocal`);
                require(sameSlot(m, later), `${id} successor crosses semantic slot`);
            }
        }
        const refs = m.sourceEvidenceIds.map((ref: string) => evById.get(ref));
        require(refs.every(
            (ev: Record<string, any> | undefined) => ev?.scope === m.scope,
        ), `${id} source evidence scope mismatch`);
        if (m.kind === "commitment") {
            const adoptions = refs.filter((ev: Record<string, any> | undefined) => ev?.sourceRole === "ember_adoption");
            const transitions = refs.filter((ev: Record<string, any> | undefined) => ev?.sourceRole === "user_command");
            require(adoptions.length >= 1, `${id} commitment needs Ember adoption evidence`);
            for (const a of adoptions) {
                require(a!.derivedFromEvidenceIds.length === 1 &&
                    evById.get(a!.derivedFromEvidenceIds[0])?.sourceRole ===
                        "user_command", `${id} adoption must derive from user request`);
            }
            require(m.epistemicRole === "ember_commitment", `${id} commitment epistemic role is invalid`);
            if (m.prospectiveLifecycle === "live") {
                require(transitions.length === 0, `${id} live commitment cannot cite discharge evidence`);
            } else {
                require(transitions.length ===
                    1, `${id} discharged commitment needs exactly one attributable transition occurrence`);
                if (transitions.length === 1) {
                    require(transitions[0]!.observedAt ===
                        m.applicableUntil, `${id} discharge evidence must establish applicability end`);
                }
            }
        } else if (m.kind === "fact") {
            if (m.epistemicRole === "user_testimony") {
                require(m.owner === `user:${principal}`, `${id} user testimony owner must be the supported user`);
                require(refs.every(
                    (ev: Record<string, any> | undefined) => ev?.sourceRole === "user_command",
                ), `${id} user testimony must cite user-command evidence`);
            } else if (m.epistemicRole === "ember_inference") {
                require(m.owner === "ember", `${id} Ember inference must be Ember-owned`);
                require(refs.every(
                    (ev: Record<string, any> | undefined) => ev?.sourceRole === "ember_inference",
                ), `${id} Ember inference must cite inference evidence`);
            } else if (m.epistemicRole === "direct_observation") {
                require(m.owner === "ember", `${id} direct observation must be Ember-owned`);
                require(refs.every(
                    (ev: Record<string, any> | undefined) => ev?.sourceRole === "ember_observation",
                ), `${id} direct observation must cite Ember observation evidence`);
            } else if (m.epistemicRole === "external_claim") {
                require(typeof m.owner === "string" &&
                    m.owner.startsWith("external:"), `${id} external claim owner must identify its source`);
                require(refs.every(
                    (ev: Record<string, any> | undefined) =>
                        ev?.sourceRole === "external_claim" && ev.sourceActor === m.owner,
                ), `${id} external claim must retain matching external source evidence`);
            } else if (m.epistemicRole === "delegated_report") {
                require(typeof m.owner === "string" &&
                    m.owner.startsWith("delegate:"), `${id} delegated report owner must identify its delegate`);
                require(refs.every(
                    (ev: Record<string, any> | undefined) =>
                        ev?.sourceRole === "delegated_report" && ev.sourceActor === m.owner,
                ), `${id} delegated report must retain matching delegate evidence`);
            } else {
                require(false, `${id} fact epistemic role is unsupported`);
            }
        } else {
            require(m.epistemicRole ===
                "user_testimony", `${id} epistemic role is invalid for supported promotion path`);
            require(refs.every(
                (ev: Record<string, any> | undefined) => ev?.sourceRole === "user_command",
            ), `${id} supported remembered meaning must cite user-command evidence`);
        }
    }

    const visitedEvidence = new Set<string>();
    const visitingEvidence = new Set<string>();
    const visitEvidence = (cursor: string): void => {
        if (visitingEvidence.has(cursor)) {
            require(false, `evidence derivation cycle contains ${cursor}`);
            return;
        }
        if (visitedEvidence.has(cursor)) {
            return;
        }
        visitingEvidence.add(cursor);
        for (const parent of evById.get(cursor)?.derivedFromEvidenceIds ?? []) {
            visitEvidence(parent);
        }
        visitingEvidence.delete(cursor);
        visitedEvidence.add(cursor);
    };
    for (const start of evById.keys()) {
        visitEvidence(start);
    }

    const cycleCursor = findCycle(meaningById, (it) => it?.supersedes);
    require(!cycleCursor, `supersession cycle contains ${cycleCursor}`);

    for (const [id, c] of cognitionById) {
        for (const mid of c.selectedMeaningIds) {
            require(meaningById.has(mid), `${id} selected absent meaning ${mid}`);
        }
        require(c.usedMeaningIds.every((mid: string) =>
            c.selectedMeaningIds.includes(mid),
        ), `${id} used a meaning outside its selection`);
        for (const eid of c.selectedEvidenceIds) {
            require(evById.has(eid), `${id} selected absent evidence ${eid}`);
        }
        require(evById.get(c.inputEvidenceId)?.sourceRole === "user_command", `${id} input evidence has wrong role`);
        require(evById.get(c.inputEvidenceId)?.scope === c.activeScope, `${id} input evidence scope mismatch`);
        const runtime = runtimeById.get(c.runtimeId);
        require(!!runtime, `${id} owning runtime is absent`);
        if (runtime) {
            require(c.activeScope === runtime.activeScope, `${id} scope differs from owning runtime`);
        }
        if (c.expressionEvidenceId) {
            const expression = evById.get(c.expressionEvidenceId);
            require(expression?.sourceRole ===
                "ember_expression_via_provider", `${id} expression evidence has wrong role`);
            require(expression?.cognitionId === id, `${id} expression back-reference mismatch`);
            require(expression?.scope === c.activeScope, `${id} expression scope mismatch`);
            require(expression?.providerLabel === c.providerLabel, `${id} provider label mismatch`);
        }
    }

    for (const [id, o] of opportunityById) {
        const runtime = runtimeById.get(o.runtimeId);
        require(!!runtime, `${id} owning runtime is absent`);
        if (runtime) {
            require(o.activeScope === runtime.activeScope, `${id} scope differs from owning runtime`);
            require(isRfc3339Utc(o.observedAt) &&
                isRfc3339Utc(runtime.startedAt) &&
                Date.parse(runtime.startedAt) <= Date.parse(o.observedAt), `${id} opportunity precedes owning runtime`);
            if (runtime.cleanStopAt !== null && isRfc3339Utc(o.lastDurableObservationAt)) {
                require(Date.parse(o.lastDurableObservationAt) <=
                    Date.parse(runtime.cleanStopAt), `${id} opportunity observation follows clean runtime stop`);
            }
        }
        require(o.validatedRevision <= state.revision, `${id} validated revision is newer than canonical state`);
        for (const mid of o.projectedMeaningIds) {
            require(meaningById.has(mid), `${id} projected absent meaning ${mid}`);
        }
        for (const eid of o.projectedEvidenceIds) {
            require(evById.has(eid), `${id} projected absent evidence ${eid}`);
        }
        require(o.selectedMeaningIds.every((mid: string) =>
            o.projectedMeaningIds.includes(mid),
        ), `${id} selected a meaning outside its projection`);
    }

    const expressionRefs = cognitions.map((c) => c.expressionEvidenceId).filter(Boolean);
    for (const [id, ev] of evById) {
        if (ev.sourceRole === "ember_expression_via_provider") {
            require(expressionRefs.filter((x) => x === id).length ===
                1, `${id} provider expression must belong to exactly one completed cognition`);
        }
    }
    validateRuntimeChain(runtimes, runtimeById, require);
    if (errors.length) {
        throw new ValidationError([...new Set(errors)].join("; "));
    }
}

function validateRuntimeChain(
    runtimes: Record<string, any>[],
    byId: Map<string, Record<string, any>>,
    require: (condition: unknown, message: string) => void,
) {
    if (!runtimes.length) {
        return;
    }
    let roots = 0;
    const successors = new Map([...byId.keys()].map((k) => [k, [] as string[]]));
    for (const r of runtimes) {
        const a = r.recoveryAccount;
        if (!isObject(a)) {
            continue;
        }
        require(a.currentRuntime === r.runtimeId, `${r.runtimeId} recovery currentRuntime mismatch`);
        require(a.restartAt === r.startedAt, `${r.runtimeId} recovery restartAt mismatch`);
        require(a.externalChangesDuringInterval ===
            "unknown", `${r.runtimeId} recovery must keep external changes unknown`);
        let expected: [string, string | null, string | null, string];
        if (a.previousRuntime === null) {
            roots++;
            expected = ["initial_start", null, null, "not_applicable"];
        } else {
            const p = byId.get(a.previousRuntime);
            require(!!p, `${r.runtimeId} recovery refers to absent previous runtime`);
            if (!p) {
                continue;
            }
            successors.get(p.runtimeId)!.push(r.runtimeId);
            expected =
                p.cleanStopAt === null
                    ? [
                          "uncertain_interruption_boundary",
                          p.lastDurableObservationAt,
                          null,
                          "unknown_after_last_durable_observation",
                      ]
                    : [
                          "known_clean_stop_interval",
                          p.lastDurableObservationAt,
                          p.cleanStopAt,
                          "none_in_supported_runtime",
                      ];
            if (isRfc3339Utc(p.lastDurableObservationAt) && isRfc3339Utc(r.startedAt)) {
                require(Date.parse(p.lastDurableObservationAt) <=
                    Date.parse(r.startedAt), `${r.runtimeId} restart precedes prior durable boundary`);
            }
            if (p.cleanStopAt && isRfc3339Utc(r.startedAt)) {
                require(Date.parse(p.cleanStopAt) <=
                    Date.parse(r.startedAt), `${r.runtimeId} restart precedes prior clean stop`);
            }
        }
        require(JSON.stringify([
            a.gapKind,
            a.lastDurableObservationAt,
            a.cleanStopAt,
            a.emberCognitionDuringInterval,
        ]) ===
            JSON.stringify(
                expected,
            ), `${r.runtimeId} recovery account overstates or contradicts surviving lifecycle evidence`);
    }
    require(roots === 1, "runtime recovery chain must contain exactly one initial start");
    require([...successors.values()].every(
        (items) => items.length <= 1,
    ), "runtime recovery chain cannot fork in supported topology");

    const cycleCursor = findCycle(byId, (it) => it?.recoveryAccount?.previousRuntime);
    require(!cycleCursor, `runtime recovery chain contains cycle at ${cycleCursor}`);
}

function findCycle<K, V>(
    map: ReadonlyMap<K, V>,
    selector: (value: V | null | undefined) => K | null | undefined,
): K | null {
    for (const key of map.keys()) {
        const seen = new Set<K>();
        let cursor: K | null = key;
        while (cursor !== null) {
            if (seen.has(cursor)) {
                return cursor;
            }
            seen.add(cursor);
            cursor = selector(map.get(cursor)) ?? null;
        }
    }
    return null;
}
