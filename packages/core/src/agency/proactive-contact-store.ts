import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { DeliveryReconciliationStatus } from "../interaction-contract.ts";
import type { CognitionId, EvidenceId, MeaningId } from "../model.ts";
import type {
    ContactAttentionDecisionRecord,
    ContactReconsiderationCondition,
} from "./proactive-contact-attention-policy.ts";

import { StoreUnavailable, ValidationError } from "../errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, isRfc3339Utc, nowUtc } from "../model.ts";
import { replaceFileDurably } from "../persistence/file-replacement.ts";
import { contentDigest, exactKeys, isObject } from "../util.ts";

const MAX_REPRESENTATION_BYTES = 1024 * 1024;

export type ProactiveContactDisposition =
    | "pending"
    | "deferred"
    | "suppressed"
    | "handed_off"
    | "satisfied"
    | "superseded"
    | "cancelled";

export interface ProactiveContactHandoff {
    assessment_id: `contact-policy-${string}`;
    surface_id: string;
    delivery_id: string;
    representation_digest: `sha256:${string}`;
    handed_off_at: string;
}

export interface ProactiveContactDeliveryObservation {
    delivery_id: string;
    attempt_id: string | null;
    status: DeliveryReconciliationStatus;
    observed_at: string;
}

export interface ProactiveContactIntentRecord {
    contact_intent_id: `contact-intent-${string}`;
    purpose: string;
    principal: string;
    scope: string;
    source: {
        cognition_id: CognitionId;
        expression_evidence_id: EvidenceId;
        opportunity_id: string | null;
        evidence_ids: string[];
        grounding_meaning_ids: MeaningId[];
        source_revision: number;
    };
    grounding_currentness: {
        status: "current" | "stale" | "unknown";
        evidence_ids: string[];
        assessed_at: string;
    };
    representation: {
        text: string;
        digest: `sha256:${string}`;
        currentness: "current" | "stale" | "unknown";
        evidence_ids: string[];
        classification: string;
    };
    urgency: "ordinary" | "time_sensitive";
    urgency_meaning_ids: MeaningId[];
    expires_at: string | null;
    satisfaction_boundary: "transport_acceptance" | "recipient_acknowledgement" | "independent_resolution";
    disposition: ProactiveContactDisposition;
    created_at: string;
    updated_at: string;
    next_step_owner: string | null;
    reconsideration: ContactReconsiderationCondition | null;
    policy_decisions: ContactAttentionDecisionRecord[];
    handoff: ProactiveContactHandoff | null;
    delivery_observations: ProactiveContactDeliveryObservation[];
}

export interface ProactiveContactDocument {
    proactive_contacts_version: 1;
    intents: ProactiveContactIntentRecord[];
}

export interface CreateProactiveContactIntent {
    contactIntentId?: `contact-intent-${string}`;
    purpose: string;
    principal: string;
    scope: string;
    source: ProactiveContactIntentRecord["source"];
    groundingCurrentness: ProactiveContactIntentRecord["grounding_currentness"];
    representation: Omit<ProactiveContactIntentRecord["representation"], "digest"> & {
        digest?: `sha256:${string}`;
    };
    urgency: ProactiveContactIntentRecord["urgency"];
    urgencyMeaningIds: MeaningId[];
    expiresAt: string | null;
    satisfactionBoundary: ProactiveContactIntentRecord["satisfaction_boundary"];
    createdAt?: string;
}

export interface CommitProactiveContactHandoff {
    contactIntentId: `contact-intent-${string}`;
    assessmentId: `contact-policy-${string}`;
    surfaceId: string;
    deliveryId: string;
    representationDigest: `sha256:${string}`;
    handedOffAt?: string;
}

export class ProactiveContactStore {
    readonly path: string;

    constructor(statePath: string) {
        if (!statePath.trim()) throw new ValidationError("proactive contact store requires a state path");
        this.path = `${statePath}.proactive-contacts.json`;
    }

    async load(): Promise<ProactiveContactDocument> {
        let text: string;
        try {
            text = await readFile(this.path, "utf8");
        } catch (error) {
            if (errorCode(error) === "ENOENT") return emptyDocument();
            throw new StoreUnavailable(`cannot read proactive contact store ${this.path}: ${errorMessage(error)}`, {
                cause: error,
            });
        }
        let value: unknown;
        try {
            value = JSON.parse(text);
        } catch (error) {
            throw new StoreUnavailable(`proactive contact store is not valid JSON: ${errorMessage(error)}`, {
                cause: error,
            });
        }
        validateProactiveContactDocument(value);
        return value;
    }

    async createIntent(input: CreateProactiveContactIntent): Promise<ProactiveContactIntentRecord> {
        const createdAt = input.createdAt ?? nowUtc();
        const digest = contentDigest(input.representation.text);
        const record: ProactiveContactIntentRecord = {
            contact_intent_id: input.contactIntentId ?? `contact-intent-${randomUUID()}`,
            purpose: input.purpose,
            principal: input.principal,
            scope: input.scope,
            source: structuredClone(input.source),
            grounding_currentness: structuredClone(input.groundingCurrentness),
            representation: {
                ...structuredClone(input.representation),
                digest: input.representation.digest ?? digest,
            },
            urgency: input.urgency,
            urgency_meaning_ids: [...input.urgencyMeaningIds],
            expires_at: input.expiresAt,
            satisfaction_boundary: input.satisfactionBoundary,
            disposition: "pending",
            created_at: createdAt,
            updated_at: createdAt,
            next_step_owner: "ember_attention_policy",
            reconsideration: null,
            policy_decisions: [],
            handoff: null,
            delivery_observations: [],
        };
        validateProactiveContactIntent(record);
        return this.update((document) => {
            const existing = document.intents.find((intent) => intent.contact_intent_id === record.contact_intent_id);
            if (existing) {
                if (JSON.stringify(existing) !== JSON.stringify(record))
                    throw new ValidationError("proactive contact intent replay conflicts with the established intent");
                return structuredClone(existing);
            }
            document.intents.push(record);
            return structuredClone(record);
        });
    }

    async recordPolicyDecision(decision: ContactAttentionDecisionRecord): Promise<ProactiveContactIntentRecord> {
        validateContactAttentionDecision(decision);
        return this.update((document) => {
            const intent = requireIntent(document, decision.contact_intent_id);
            const existing = intent.policy_decisions.find((item) => item.assessment_id === decision.assessment_id);
            if (existing) {
                if (JSON.stringify(existing) !== JSON.stringify(decision))
                    throw new ValidationError("contact policy decision replay conflicts with the established decision");
                return structuredClone(intent);
            }
            if (!["pending", "deferred"].includes(intent.disposition))
                throw new ValidationError("contact policy decision requires a pending or deferred intent");
            if (decision.source_revision !== intent.source.source_revision)
                throw new ValidationError("contact policy decision source revision differs from the intent");
            intent.policy_decisions.push(structuredClone(decision));
            intent.updated_at = decision.considered_at;
            if (decision.outcome === "defer") {
                intent.disposition = "deferred";
                intent.next_step_owner = decision.next_step_owner;
                intent.reconsideration = structuredClone(decision.reconsideration);
            } else if (decision.outcome === "suppress") {
                intent.disposition = "suppressed";
                intent.next_step_owner = null;
                intent.reconsideration = null;
            } else {
                intent.next_step_owner = "surface_delivery";
                intent.reconsideration = null;
            }
            return structuredClone(intent);
        });
    }

    async adoptHandoff(input: CommitProactiveContactHandoff): Promise<ProactiveContactIntentRecord> {
        return this.commitHandoff(input);
    }

    async commitHandoff(input: CommitProactiveContactHandoff): Promise<ProactiveContactIntentRecord> {
        validateId(input.contactIntentId, "contact-intent-", "contact intent id");
        validateId(input.assessmentId, "contact-policy-", "contact policy assessment id");
        validateId(input.deliveryId, "delivery-", "delivery id");
        validateOpaque(input.surfaceId, "contact handoff surface id");
        validateDigest(input.representationDigest, "contact handoff representation digest");
        if (input.handedOffAt !== undefined) validateTimestamp(input.handedOffAt, "contact handoff timestamp");
        return this.update((document) => {
            const intent = requireIntent(document, input.contactIntentId);
            if (intent.handoff !== null) {
                const same =
                    intent.handoff.assessment_id === input.assessmentId &&
                    intent.handoff.surface_id === input.surfaceId &&
                    intent.handoff.delivery_id === input.deliveryId &&
                    intent.handoff.representation_digest === input.representationDigest &&
                    (input.handedOffAt === undefined || intent.handoff.handed_off_at === input.handedOffAt);
                if (!same) throw new ValidationError("contact handoff replay conflicts with the established handoff");
                return structuredClone(intent);
            }
            const handedOffAt = input.handedOffAt ?? nowUtc();
            const handoff: ProactiveContactHandoff = {
                assessment_id: input.assessmentId,
                surface_id: input.surfaceId,
                delivery_id: input.deliveryId,
                representation_digest: input.representationDigest,
                handed_off_at: handedOffAt,
            };
            if (!["pending", "deferred"].includes(intent.disposition))
                throw new ValidationError("contact handoff requires a pending or deferred intent");
            const decision = intent.policy_decisions.find((item) => item.assessment_id === input.assessmentId);
            if (decision?.outcome !== "admit")
                throw new ValidationError("contact handoff requires its admitted assessment");
            if (decision.selected_surface_id !== input.surfaceId)
                throw new ValidationError("contact handoff surface differs from the admitted surface");
            if (intent.representation.digest !== input.representationDigest)
                throw new ValidationError("contact handoff representation digest differs from the intent");
            if (Date.parse(handedOffAt) < Date.parse(decision.considered_at))
                throw new ValidationError("contact handoff precedes its policy assessment");
            intent.handoff = handoff;
            intent.disposition = "handed_off";
            intent.next_step_owner = "surface_delivery";
            intent.reconsideration = null;
            intent.updated_at = handedOffAt;
            return structuredClone(intent);
        });
    }

    async recordReconciliationOutcome(
        contactIntentId: `contact-intent-${string}`,
        observation: ProactiveContactDeliveryObservation,
    ): Promise<ProactiveContactIntentRecord> {
        validateDeliveryObservation(observation);
        return this.update((document) => {
            const intent = requireIntent(document, contactIntentId);
            if (intent.handoff === null || intent.handoff.delivery_id !== observation.delivery_id)
                throw new ValidationError("delivery observation does not match the contact handoff");
            const existing = intent.delivery_observations.find(
                (item) =>
                    item.delivery_id === observation.delivery_id &&
                    item.attempt_id === observation.attempt_id &&
                    item.status === observation.status,
            );
            if (existing) {
                return structuredClone(intent);
            }
            if (!["handed_off", "satisfied"].includes(intent.disposition))
                throw new ValidationError("delivery observation requires a handed-off contact intent");
            intent.delivery_observations.push(structuredClone(observation));
            if (observation.status === "confirmed" && intent.satisfaction_boundary === "transport_acceptance") {
                intent.disposition = "satisfied";
                intent.next_step_owner = null;
            }
            intent.updated_at = observation.observed_at;
            return structuredClone(intent);
        });
    }

    private async update<T>(mutate: (document: ProactiveContactDocument) => T): Promise<T> {
        const document = await this.load();
        const result = mutate(document);
        validateProactiveContactDocument(document);
        await replaceFileDurably(this.path, `${JSON.stringify(document, null, 2)}\n`, {
            durabilityUncertainMessage:
                "proactive contact replacement may be visible, but directory synchronization failed",
        });
        return result;
    }
}

export async function createProactiveContactIntent(store: ProactiveContactStore, input: CreateProactiveContactIntent) {
    return store.createIntent(input);
}

export async function recordProactiveContactPolicyDecision(
    store: ProactiveContactStore,
    decision: ContactAttentionDecisionRecord,
) {
    return store.recordPolicyDecision(decision);
}

export async function commitProactiveContactHandoff(
    store: ProactiveContactStore,
    input: CommitProactiveContactHandoff,
) {
    return store.commitHandoff(input);
}

export async function adoptProactiveContactHandoff(store: ProactiveContactStore, input: CommitProactiveContactHandoff) {
    return store.adoptHandoff(input);
}

export async function recordProactiveContactReconciliation(
    store: ProactiveContactStore,
    contactIntentId: `contact-intent-${string}`,
    observation: ProactiveContactDeliveryObservation,
) {
    return store.recordReconciliationOutcome(contactIntentId, observation);
}

export function proactiveContactInspectionView(document: ProactiveContactDocument) {
    validateProactiveContactDocument(document);
    return {
        proactive_contacts_version: document.proactive_contacts_version,
        intents: document.intents.map(({ representation, ...intent }) => ({
            ...structuredClone(intent),
            representation: {
                available: true,
                digest: representation.digest,
                currentness: representation.currentness,
                evidence_ids: [...representation.evidence_ids],
                classification: representation.classification,
            },
        })),
    };
}

function emptyDocument(): ProactiveContactDocument {
    return { proactive_contacts_version: 1, intents: [] };
}

export function validateProactiveContactDocument(value: unknown): asserts value is ProactiveContactDocument {
    if (!isObject(value) || !exactKeys(value, ["intents", "proactive_contacts_version"]))
        throw new ValidationError("proactive contact document is invalid");
    if (value.proactive_contacts_version !== 1)
        throw new ValidationError("proactive contact document version is unsupported");
    if (!Array.isArray(value.intents)) throw new ValidationError("proactive contact intents must be a list");
    const intentIds = new Set<string>();
    const deliveryIds = new Set<string>();
    for (const intent of value.intents) {
        validateProactiveContactIntent(intent);
        if (intentIds.has(intent.contact_intent_id)) throw new ValidationError("duplicate proactive contact intent id");
        intentIds.add(intent.contact_intent_id);
        if (intent.handoff !== null) {
            if (deliveryIds.has(intent.handoff.delivery_id))
                throw new ValidationError("proactive contact delivery is correlated to multiple intents");
            deliveryIds.add(intent.handoff.delivery_id);
        }
    }
}

function validateProactiveContactIntent(value: unknown): asserts value is ProactiveContactIntentRecord {
    if (!isObject(value)) throw new ValidationError("proactive contact intent must be an object");
    const fields = [
        "contact_intent_id",
        "purpose",
        "principal",
        "scope",
        "source",
        "grounding_currentness",
        "representation",
        "urgency",
        "urgency_meaning_ids",
        "expires_at",
        "satisfaction_boundary",
        "disposition",
        "created_at",
        "updated_at",
        "next_step_owner",
        "reconsideration",
        "policy_decisions",
        "handoff",
        "delivery_observations",
    ];
    if (!exactKeys(value, fields)) throw new ValidationError("proactive contact intent contains unsupported fields");
    validateId(value.contact_intent_id, "contact-intent-", "contact intent id");
    validateOpaque(value.purpose, "contact purpose", 4096);
    validateOpaque(value.principal, "contact principal", 256);
    validateOpaque(value.scope, "contact scope", 256);
    validateSource(value.source);
    validateCurrentness(value.grounding_currentness, "contact grounding currentness");
    validateRepresentation(value.representation);
    if (!(["ordinary", "time_sensitive"] as unknown[]).includes(value.urgency))
        throw new ValidationError("contact urgency is invalid");
    validateStringList(value.urgency_meaning_ids, "contact urgency meaning ids");
    const source = value.source as ProactiveContactIntentRecord["source"];
    const urgencyIds = value.urgency_meaning_ids as string[];
    if (!urgencyIds.every((id) => source.grounding_meaning_ids.includes(id as MeaningId)))
        throw new ValidationError("contact urgency must be grounded in source meanings");
    if (value.urgency === "time_sensitive" && urgencyIds.length === 0)
        throw new ValidationError("time-sensitive contact requires urgency grounding");
    if (value.urgency === "ordinary" && urgencyIds.length !== 0)
        throw new ValidationError("ordinary contact cannot claim urgency grounding");
    if (value.expires_at !== null) validateTimestamp(value.expires_at, "contact expiry");
    if (
        !(["transport_acceptance", "recipient_acknowledgement", "independent_resolution"] as unknown[]).includes(
            value.satisfaction_boundary,
        )
    )
        throw new ValidationError("contact satisfaction boundary is invalid");
    if (
        !(
            ["pending", "deferred", "suppressed", "handed_off", "satisfied", "superseded", "cancelled"] as unknown[]
        ).includes(value.disposition)
    )
        throw new ValidationError("contact disposition is invalid");
    validateTimestamp(value.created_at, "contact creation time");
    validateTimestamp(value.updated_at, "contact update time");
    if (Date.parse(value.updated_at as string) < Date.parse(value.created_at as string))
        throw new ValidationError("contact update precedes creation");
    if (value.expires_at !== null && Date.parse(value.expires_at as string) <= Date.parse(value.created_at as string))
        throw new ValidationError("contact expiry must follow creation");
    if (value.next_step_owner !== null) validateOpaque(value.next_step_owner, "contact next-step owner");
    if (value.reconsideration !== null) validateReconsideration(value.reconsideration);
    if (!Array.isArray(value.policy_decisions)) throw new ValidationError("contact policy decisions must be a list");
    const assessments = new Set<string>();
    for (const decision of value.policy_decisions) {
        validateContactAttentionDecision(decision);
        if (decision.contact_intent_id !== value.contact_intent_id)
            throw new ValidationError("contact policy decision belongs to another intent");
        if (assessments.has(decision.assessment_id)) throw new ValidationError("duplicate contact policy assessment");
        assessments.add(decision.assessment_id);
    }
    if (value.handoff !== null) {
        validateHandoff(value.handoff);
        const handoff = value.handoff as ProactiveContactHandoff;
        const decision = (value.policy_decisions as ContactAttentionDecisionRecord[]).find(
            (item) => item.assessment_id === handoff.assessment_id,
        );
        if (decision?.outcome !== "admit" || decision.selected_surface_id !== handoff.surface_id)
            throw new ValidationError("contact handoff does not match an admitted assessment");
        if (
            (value.representation as ProactiveContactIntentRecord["representation"]).digest !==
            handoff.representation_digest
        )
            throw new ValidationError("contact handoff digest does not match retained representation");
    }
    if (["handed_off", "satisfied"].includes(value.disposition as string) && value.handoff === null)
        throw new ValidationError("contact disposition requires a handoff");
    if (["pending", "deferred", "suppressed"].includes(value.disposition as string) && value.handoff !== null)
        throw new ValidationError("contact disposition cannot retain a handoff");
    if (!Array.isArray(value.delivery_observations))
        throw new ValidationError("contact delivery observations must be a list");
    for (const observation of value.delivery_observations) {
        validateDeliveryObservation(observation);
        if (
            value.handoff === null ||
            observation.delivery_id !== (value.handoff as ProactiveContactHandoff).delivery_id
        )
            throw new ValidationError("contact delivery observation does not match its handoff");
    }
}

function validateSource(value: unknown) {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "cognition_id",
            "evidence_ids",
            "expression_evidence_id",
            "grounding_meaning_ids",
            "opportunity_id",
            "source_revision",
        ])
    )
        throw new ValidationError("contact source is invalid");
    validateId(value.cognition_id, "cognition-", "contact source cognition id");
    validateId(value.expression_evidence_id, "evidence-", "contact source expression evidence id");
    if (value.opportunity_id !== null) validateOpaque(value.opportunity_id, "contact source opportunity id");
    validateStringList(value.evidence_ids, "contact source evidence ids", true);
    validateStringList(value.grounding_meaning_ids, "contact grounding meaning ids", true);
    if (!Number.isSafeInteger(value.source_revision) || (value.source_revision as number) < 0)
        throw new ValidationError("contact source revision is invalid");
}

function validateCurrentness(value: unknown, field: string) {
    if (!isObject(value) || !exactKeys(value, ["assessed_at", "evidence_ids", "status"]))
        throw new ValidationError(`${field} is invalid`);
    if (!(["current", "stale", "unknown"] as unknown[]).includes(value.status))
        throw new ValidationError(`${field} status is invalid`);
    validateStringList(value.evidence_ids, `${field} evidence ids`, true);
    validateTimestamp(value.assessed_at, `${field} assessment time`);
}

function validateRepresentation(value: unknown) {
    if (!isObject(value) || !exactKeys(value, ["classification", "currentness", "digest", "evidence_ids", "text"]))
        throw new ValidationError("contact representation is invalid");
    if (
        typeof value.text !== "string" ||
        !value.text.length ||
        Buffer.byteLength(value.text, "utf8") > MAX_REPRESENTATION_BYTES
    )
        throw new ValidationError("contact representation text is invalid");
    validateDigest(value.digest, "contact representation digest");
    if (value.digest !== contentDigest(value.text))
        throw new ValidationError("contact representation digest does not match text");
    if (!(["current", "stale", "unknown"] as unknown[]).includes(value.currentness))
        throw new ValidationError("contact representation currentness is invalid");
    validateStringList(value.evidence_ids, "contact representation evidence ids", true);
    validateOpaque(value.classification, "contact representation classification");
}

function validateContactAttentionDecision(value: unknown): asserts value is ContactAttentionDecisionRecord {
    if (!isObject(value)) throw new ValidationError("contact policy decision must be an object");
    if (
        !exactKeys(value, [
            "assessment_id",
            "basis",
            "considered_at",
            "contact_intent_id",
            "current_revision",
            "evidence",
            "interruption",
            "next_step_owner",
            "outcome",
            "reconsideration",
            "selected_surface_id",
            "source_revision",
        ])
    )
        throw new ValidationError("contact policy decision contains unsupported fields");
    validateId(value.assessment_id, "contact-policy-", "contact policy assessment id");
    validateId(value.contact_intent_id, "contact-intent-", "contact policy intent id");
    validateTimestamp(value.considered_at, "contact policy consideration time");
    if (!Number.isSafeInteger(value.source_revision) || (value.source_revision as number) < 0)
        throw new ValidationError("contact policy source revision is invalid");
    if (!Number.isSafeInteger(value.current_revision) || (value.current_revision as number) < 0)
        throw new ValidationError("contact policy current revision is invalid");
    validatePolicyEvidence(value.evidence);
    if (!(["admit", "defer", "suppress"] as unknown[]).includes(value.outcome))
        throw new ValidationError("contact policy outcome is invalid");
    if (typeof value.basis !== "string") throw new ValidationError("contact policy basis is invalid");
    if (value.outcome === "admit") {
        if (
            value.interruption !== "interrupt" ||
            typeof value.selected_surface_id !== "string" ||
            value.next_step_owner !== null ||
            value.reconsideration !== null
        )
            throw new ValidationError("admitted contact policy decision is invalid");
    } else {
        if (value.interruption !== "remain_silent" || value.selected_surface_id !== null)
            throw new ValidationError("silent contact policy decision is invalid");
        if (value.outcome === "defer") {
            if (typeof value.next_step_owner !== "string" || value.reconsideration === null)
                throw new ValidationError("deferred contact policy decision is invalid");
            validateReconsideration(value.reconsideration);
        } else if (value.next_step_owner !== null || value.reconsideration !== null) {
            throw new ValidationError("suppressed contact policy decision is invalid");
        }
    }
}

function validatePolicyEvidence(value: unknown) {
    if (
        !isObject(value) ||
        !exactKeys(value, [
            "attention",
            "authority",
            "grounding_meaning_ids",
            "occurrence",
            "representation_evidence_ids",
            "supersession_evidence_ids",
            "surfaces",
        ])
    )
        throw new ValidationError("contact policy evidence is invalid");
    validateStringList(value.grounding_meaning_ids, "contact policy grounding ids", true);
    validateStringList(value.representation_evidence_ids, "contact policy representation evidence", true);
    validateStringList(value.supersession_evidence_ids, "contact policy supersession evidence");
    if (!isObject(value.authority) || !exactKeys(value.authority, ["evidence_ids", "status"]))
        throw new ValidationError("contact policy authority evidence is invalid");
    if (!(["authorized", "unknown", "denied"] as unknown[]).includes(value.authority.status))
        throw new ValidationError("contact policy authority status is invalid");
    validateStringList(value.authority.evidence_ids, "contact policy authority evidence", true);
    if (!isObject(value.attention)) throw new ValidationError("contact policy attention evidence is invalid");
    if (value.attention.status === "available") {
        if (!exactKeys(value.attention, ["evidence_ids", "status"]))
            throw new ValidationError("contact policy attention evidence is invalid");
    } else if (value.attention.status === "quiet_period") {
        if (!exactKeys(value.attention, ["ends_at", "evidence_ids", "starts_at", "status", "window_id"]))
            throw new ValidationError("contact policy quiet-period evidence is invalid");
        validateOpaque(value.attention.window_id, "contact policy quiet-period id");
        validateTimestamp(value.attention.starts_at, "contact policy quiet-period start");
        validateTimestamp(value.attention.ends_at, "contact policy quiet-period end");
        if (Date.parse(value.attention.ends_at as string) <= Date.parse(value.attention.starts_at as string))
            throw new ValidationError("contact policy quiet period must have positive duration");
    } else throw new ValidationError("contact policy attention status is invalid");
    validateStringList(value.attention.evidence_ids, "contact policy attention evidence", true);
    if (!isObject(value.occurrence) || !exactKeys(value.occurrence, ["evidence_ids", "related_intent_id", "status"]))
        throw new ValidationError("contact policy occurrence evidence is invalid");
    if (!(["distinct", "confirmed_duplicate", "identity_uncertain"] as unknown[]).includes(value.occurrence.status))
        throw new ValidationError("contact policy occurrence status is invalid");
    if (value.occurrence.related_intent_id !== null)
        validateId(value.occurrence.related_intent_id, "contact-intent-", "related contact intent id");
    if (value.occurrence.status === "distinct" && value.occurrence.related_intent_id !== null)
        throw new ValidationError("distinct contact occurrence cannot name a related intent");
    if (value.occurrence.status !== "distinct" && value.occurrence.related_intent_id === null)
        throw new ValidationError("non-distinct contact occurrence requires a related intent");
    validateStringList(value.occurrence.evidence_ids, "contact policy occurrence evidence", true);
    if (!Array.isArray(value.surfaces) || value.surfaces.length === 0)
        throw new ValidationError("contact policy surfaces are invalid");
    const surfaceIds = new Set<string>();
    for (const surface of value.surfaces) {
        if (!isObject(surface) || !exactKeys(surface, ["evidence_ids", "preference_rank", "status", "surface_id"]))
            throw new ValidationError("contact policy surface evidence is invalid");
        validateOpaque(surface.surface_id, "contact policy surface id");
        if (surfaceIds.has(surface.surface_id)) throw new ValidationError("contact policy contains duplicate surfaces");
        surfaceIds.add(surface.surface_id);
        if (!Number.isSafeInteger(surface.preference_rank) || (surface.preference_rank as number) < 0)
            throw new ValidationError("contact policy surface preference rank is invalid");
        if (!(["eligible", "temporarily_unavailable", "ineligible"] as unknown[]).includes(surface.status))
            throw new ValidationError("contact policy surface status is invalid");
        validateStringList(surface.evidence_ids, "contact policy surface evidence", true);
    }
}

function validateReconsideration(value: unknown): asserts value is ContactReconsiderationCondition {
    if (!isObject(value)) throw new ValidationError("contact reconsideration is invalid");
    if (value.kind === "not_before") {
        if (!exactKeys(value, ["at", "kind"])) throw new ValidationError("contact reconsideration is invalid");
        validateTimestamp(value.at, "contact reconsideration time");
    } else if (value.kind === "evidence_change") {
        if (
            !exactKeys(value, ["kind", "signal"]) ||
            !(
                [
                    "representation_currentness",
                    "successor_established_or_representation_revalidated",
                    "authority",
                    "occurrence_identity",
                    "surface_eligibility",
                ] as unknown[]
            ).includes(value.signal)
        )
            throw new ValidationError("contact reconsideration is invalid");
    } else throw new ValidationError("contact reconsideration is invalid");
}

function validateHandoff(value: unknown) {
    if (
        !isObject(value) ||
        !exactKeys(value, ["assessment_id", "delivery_id", "handed_off_at", "representation_digest", "surface_id"])
    )
        throw new ValidationError("contact handoff is invalid");
    validateId(value.assessment_id, "contact-policy-", "contact handoff assessment id");
    validateId(value.delivery_id, "delivery-", "contact handoff delivery id");
    validateOpaque(value.surface_id, "contact handoff surface id");
    validateDigest(value.representation_digest, "contact handoff representation digest");
    validateTimestamp(value.handed_off_at, "contact handoff timestamp");
}

function validateDeliveryObservation(value: unknown): asserts value is ProactiveContactDeliveryObservation {
    if (!isObject(value) || !exactKeys(value, ["attempt_id", "delivery_id", "observed_at", "status"]))
        throw new ValidationError("contact delivery observation is invalid");
    validateId(value.delivery_id, "delivery-", "contact delivery observation delivery id");
    if (value.attempt_id !== null) validateId(value.attempt_id, "attempt-", "contact delivery observation attempt id");
    if (
        !(
            [
                "confirmed",
                "retry_later",
                "retryable_failure",
                "failed_non_retryable",
                "blocked_uncertain",
                "blocked_missing_representation",
                "withdrawn",
            ] as unknown[]
        ).includes(value.status)
    )
        throw new ValidationError("contact delivery observation status is invalid");
    validateTimestamp(value.observed_at, "contact delivery observation time");
}

function requireIntent(document: ProactiveContactDocument, id: string) {
    const intent = document.intents.find((item) => item.contact_intent_id === id);
    if (!intent) throw new ValidationError(`proactive contact intent does not exist: ${id}`);
    return intent;
}

function validateStringList(value: unknown, field: string, requireNonEmpty = false): asserts value is string[] {
    if (!Array.isArray(value) || (requireNonEmpty && value.length === 0))
        throw new ValidationError(`${field} is invalid`);
    const seen = new Set<string>();
    for (const item of value) {
        validateOpaque(item, field);
        if (seen.has(item)) throw new ValidationError(`${field} contains duplicates`);
        seen.add(item);
    }
}

function validateId(value: unknown, prefix: string, field: string): asserts value is string {
    if (
        typeof value !== "string" ||
        !value.startsWith(prefix) ||
        value.length === prefix.length ||
        ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    )
        throw new ValidationError(`${field} is invalid`);
}

function validateOpaque(value: unknown, field: string, maxLength = 512): asserts value is string {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        value.length > maxLength ||
        ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    )
        throw new ValidationError(`${field} is invalid`);
}

function validateDigest(value: unknown, field: string): asserts value is `sha256:${string}` {
    if (typeof value !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value))
        throw new ValidationError(`${field} is invalid`);
}

function validateTimestamp(value: unknown, field: string): asserts value is string {
    if (!isRfc3339Utc(value)) throw new ValidationError(`${field} must be RFC 3339 UTC`);
}

function errorCode(error: unknown) {
    return error !== null && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
