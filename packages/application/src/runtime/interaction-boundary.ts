import type {
    DeliveryReconciliationResult,
    DeliveryReconciliationStatus,
    ExternalOccurrenceMetadata,
    PrincipalAssertionProvenance,
} from "@ember/domain/interaction-contract.ts";
import type { CognitionId, EvidenceId } from "@ember/domain/model.ts";
import type { Writable } from "node:stream";

import { ValidationError } from "@ember/domain/errors.ts";
import { PRINCIPAL_ASSERTION_PROVENANCE } from "@ember/domain/interaction-contract.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, isRfc3339Utc, nowUtc } from "@ember/domain/model.ts";
import { cloneState, contentDigest, exactKeys, isObject } from "@ember/domain/util.ts";

import type { CognitionRepositories } from "../app/cognition-execution.ts";

import { findCognition } from "../app/cognition-execution.ts";

const MAX_DELIVERY_REPRESENTATION_BYTES = 1024 * 1024;

export interface SurfaceDeliveryReceipt {
    externalMessageId?: string | null;
}

export type DeliveryAttemptOutcome = "started" | "confirmed" | "failed" | "uncertain";
export type TerminalDeliveryAttemptOutcome = Exclude<DeliveryAttemptOutcome, "started">;
export type SurfaceDelivery =
    | Writable
    | ((text: string) => void | SurfaceDeliveryReceipt | Promise<void | SurfaceDeliveryReceipt>);

export class SurfaceDeliveryFailure extends Error {
    readonly outcome: Exclude<TerminalDeliveryAttemptOutcome, "confirmed">;
    readonly externalMessageId: string | null;
    readonly retryable: boolean;
    readonly retryAfterSeconds: number | null;
    memoryProposalFailure: string | null = null;
    onboardingProgressFailure: string | null = null;

    constructor(
        message: string,
        {
            outcome = "uncertain",
            externalMessageId = null,
            retryable = false,
            retryAfterSeconds = null,
            cause,
        }: {
            outcome?: Exclude<TerminalDeliveryAttemptOutcome, "confirmed">;
            externalMessageId?: string | null;
            retryable?: boolean;
            retryAfterSeconds?: number | null;
            cause?: unknown;
        } = {},
    ) {
        super(message, { cause });
        validateNullableOpaque(externalMessageId, "delivery external_message_id");
        validateRetryMetadata(outcome, retryable, retryAfterSeconds);
        this.name = "SurfaceDeliveryFailure";
        this.outcome = outcome;
        this.externalMessageId = externalMessageId;
        this.retryable = retryable;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    withCognitionDiagnostics({
        memoryProposalFailure,
        onboardingProgressFailure,
    }: {
        memoryProposalFailure: string | null;
        onboardingProgressFailure: string | null;
    }) {
        this.memoryProposalFailure = memoryProposalFailure;
        this.onboardingProgressFailure = onboardingProgressFailure;
        return this;
    }
}

export interface InteractionRepositories extends CognitionRepositories {
    interactions: Pick<
        InteractionLedgerStore,
        "load" | "acceptInbound" | "createDeliveryIntent" | "startDeliveryAttempt" | "finishDeliveryAttempt"
    >;
}

export interface InboundOccurrenceRecord {
    occurrence_id: string;
    cognitionId: CognitionId;
    surface_id: string;
    assertedPrincipal: string;
    principal_provenance: PrincipalAssertionProvenance;
    scope: string;
    contentDigest: `sha256:${string}`;
    first_received_at: string;
    last_received_at: string;
    receive_count: number;
    external_occurrence_id: string | null;
    external_message_id: string | null;
    externalThreadId: string | null;
    external_correlation_id: string | null;
    external_occurred_at: string | null;
    delivery_destination_id: string | null;
}

export interface DeliveryRepresentation {
    text: string;
    contentDigest: `sha256:${string}`;
}

export interface DeliveryAttemptIdentity {
    attempt_id: string;
    attempted_at: string;
    external_message_id: string | null;
}

export interface DeliveryAttemptRecord extends DeliveryAttemptIdentity {
    observedAt: string | null;
    outcome: DeliveryAttemptOutcome;
    retryable: boolean;
    retry_after_seconds: number | null;
}

export type DeliveryOrigin =
    | { kind: "ordinary_cognition" }
    | {
          kind: "proactive_contact";
          contact_intent_id: `contact-intent-${string}`;
          policy_assessment_id: `contact-policy-${string}`;
      };

export type DeliverySendFence =
    | { status: "open" }
    | {
          status: "no_further_send";
          fenced_at: string;
          basis: string;
      };

export interface DeliveryRecordIdentity {
    delivery_id: string;
    cognitionId: CognitionId;
    expressionEvidenceId: EvidenceId;
    surface_id: string;
    destination_id: string | null;
    intended_at: string;
}

export interface DeliveryRecord extends DeliveryRecordIdentity {
    origin: DeliveryOrigin;
    send_fence: DeliverySendFence;
    representation: DeliveryRepresentation | null;
    attempts: DeliveryAttemptRecord[];
}

export interface InteractionLedgerSharedFields {
    inbound_occurrences: InboundOccurrenceRecord[];
}

export interface InteractionLedgerDocument extends InteractionLedgerSharedFields {
    ledger_version: 3;
    deliveries: DeliveryRecord[];
}

export interface V2DeliveryRecord extends DeliveryRecordIdentity {
    representation: DeliveryRepresentation | null;
    attempts: DeliveryAttemptRecord[];
}

export interface V2InteractionLedgerDocument extends InteractionLedgerSharedFields {
    ledger_version: 2;
    deliveries: V2DeliveryRecord[];
}

export interface LegacyDeliveryAttemptRecord extends DeliveryAttemptIdentity {
    outcome: TerminalDeliveryAttemptOutcome;
}

export interface LegacyDeliveryRecord extends DeliveryRecordIdentity {
    attempts: LegacyDeliveryAttemptRecord[];
}

export interface LegacyInteractionLedgerDocument extends InteractionLedgerSharedFields {
    ledger_version: 1;
    deliveries: LegacyDeliveryRecord[];
}

export interface AcceptedInboundOccurrence {
    record: InboundOccurrenceRecord;
    replayed: boolean;
}

export interface InboundAcceptance {
    surfaceId: string;
    principal: string;
    principalProvenance: PrincipalAssertionProvenance;
    scope: string;
    text: string;
    externalOccurrence: ExternalOccurrenceMetadata | null;
    deliveryDestinationId: string | null;
}

export interface InteractionLedgerStore {
    readonly path: string;
    load(): Promise<InteractionLedgerDocument>;
    acceptInbound(
        input: InboundAcceptance,
        cognitionId: CognitionId,
        receivedAt?: string,
    ): Promise<AcceptedInboundOccurrence>;
    createDeliveryIntent(
        {
            cognitionId,
            expressionEvidenceId,
            surfaceId,
            destinationId,
            representationText,
            origin,
        }: {
            cognitionId: CognitionId;
            expressionEvidenceId: EvidenceId;
            surfaceId: string;
            destinationId: string | null;
            representationText: string | null;
            origin?: DeliveryOrigin;
        },
        intendedAt?: string,
    ): Promise<DeliveryRecord>;
    fenceDelivery(deliveryId: string, basis: string, fencedAt?: string): Promise<DeliveryRecord>;
    startDeliveryAttempt(deliveryId: string, attemptedAt?: string): Promise<DeliveryAttemptRecord>;
    finishDeliveryAttempt(
        attemptId: string,
        outcome: TerminalDeliveryAttemptOutcome,
        {
            externalMessageId,
            retryable,
            retryAfterSeconds,
            observedAt,
        }?: {
            externalMessageId?: string | null;
            retryable?: boolean;
            retryAfterSeconds?: number | null;
            observedAt?: string;
        },
    ): Promise<DeliveryAttemptRecord>;
}

export async function reconcileSurfaceDelivery(
    repositories: Pick<InteractionRepositories, "state" | "interactions">,
    deliveryId: string,
    deliver: SurfaceDelivery,
    { observedAt = nowUtc() }: { observedAt?: string } = {},
): Promise<DeliveryReconciliationResult> {
    const store = repositories.state;
    if (!isRfc3339Utc(observedAt)) throw new ValidationError("delivery reconciliation time must be RFC 3339 UTC");
    const ledger = repositories.interactions;
    let document = await ledger.load();
    let delivery = requireDelivery(document, deliveryId);
    const state = await store.load();
    const cognition = findCognition(state, delivery.cognitionId);
    if (cognition.status !== "completed" || cognition.expressionEvidenceId !== delivery.expressionEvidenceId)
        throw new ValidationError("delivery does not refer to a completed matching cognition");
    if (delivery.origin.kind === "ordinary_cognition" && cognition.deliveryStatus === "displayed") {
        return resultFor(delivery, "confirmed", latestDeliveryAttempt(delivery)?.attempt_id ?? null, null);
    }

    let latest = latestDeliveryAttempt(delivery);
    if (latest?.outcome === "started") {
        await ledger.finishDeliveryAttempt(latest.attempt_id, "uncertain", { observedAt });
        return resultFor(delivery, "blocked_uncertain", latest.attempt_id, null);
    }
    if (latest?.outcome === "confirmed") {
        if (delivery.origin.kind === "ordinary_cognition")
            await markCanonicalDeliveryDisplayed(store, delivery.cognitionId);
        return resultFor(delivery, "confirmed", latest.attempt_id, null);
    }
    if (latest?.outcome === "uncertain") {
        return resultFor(delivery, "blocked_uncertain", latest.attempt_id, null);
    }
    if (delivery.send_fence.status === "no_further_send") {
        return resultFor(delivery, "withdrawn", latest?.attempt_id ?? null, null);
    }
    if (latest?.outcome === "failed" && !latest.retryable) {
        return resultFor(delivery, "failed_non_retryable", latest.attempt_id, null);
    }
    if (delivery.representation === null) {
        return resultFor(delivery, "blocked_missing_representation", latest?.attempt_id ?? null, null);
    }
    if (latest?.outcome === "failed") {
        const retryAt = retryAtForAttempt(latest);
        if (retryAt !== null && Date.parse(observedAt) < Date.parse(retryAt))
            return resultFor(delivery, "retry_later", latest.attempt_id, retryAt);
    }

    const attempt = await ledger.startDeliveryAttempt(deliveryId, observedAt);
    let externalMessageId: string | null = null;
    try {
        externalMessageId = await performSurfaceDelivery(deliver, delivery.representation.text);
    } catch (error) {
        const failure = error instanceof SurfaceDeliveryFailure ? error : null;
        const terminal = await ledger.finishDeliveryAttempt(attempt.attempt_id, failure?.outcome ?? "uncertain", {
            externalMessageId: failure?.externalMessageId ?? externalMessageId,
            retryable: failure?.retryable ?? false,
            retryAfterSeconds: failure?.retryAfterSeconds ?? null,
            observedAt,
        });
        const retryAt = terminal.outcome === "failed" ? retryAtForAttempt(terminal) : null;
        if (terminal.outcome === "uncertain")
            return resultFor(delivery, "blocked_uncertain", terminal.attempt_id, null);
        if (!terminal.retryable) return resultFor(delivery, "failed_non_retryable", terminal.attempt_id, null);
        return resultFor(delivery, "retryable_failure", terminal.attempt_id, retryAt);
    }
    const terminal = await ledger.finishDeliveryAttempt(attempt.attempt_id, "confirmed", {
        externalMessageId,
        observedAt,
    });
    if (delivery.origin.kind === "ordinary_cognition")
        await markCanonicalDeliveryDisplayed(store, delivery.cognitionId);
    document = await ledger.load();
    delivery = requireDelivery(document, deliveryId);
    latest = latestDeliveryAttempt(delivery);
    return resultFor(delivery, "confirmed", latest?.attempt_id ?? terminal.attempt_id, null);
}

export function interactionLedgerInspectionView(ledger: InteractionLedgerDocument) {
    validateLedger(ledger);
    return {
        ledger_version: ledger.ledger_version,
        inbound_occurrences: structuredClone(ledger.inbound_occurrences),
        deliveries: ledger.deliveries.map(({ representation, ...delivery }) => ({
            ...structuredClone(delivery),
            representation: {
                available: representation !== null,
                contentDigest: representation?.contentDigest ?? null,
            },
        })),
    };
}

export async function performSurfaceDelivery(deliver: SurfaceDelivery, text: string) {
    if (typeof deliver === "function") {
        const receipt = await deliver(text);
        if (receipt === undefined) return null;
        if (!isObject(receipt)) throw new ValidationError("surface delivery receipt must be an object");
        const externalMessageId = receipt.externalMessageId ?? null;
        validateNullableOpaque(externalMessageId, "delivery external_message_id");
        return externalMessageId;
    }
    await writeDeliveryOutput(deliver, text);
    return null;
}

export async function writeDeliveryOutput(output: Writable, text: string) {
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (error?: Error | null) => {
            if (settled) return;
            settled = true;
            if (error) {
                setImmediate(() => output.off("error", onError));
                reject(error);
            } else {
                output.off("error", onError);
                resolve();
            }
        };
        const onError = (error: Error) => finish(error);
        output.once("error", onError);
        try {
            output.write(text, (error) => finish(error));
        } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export async function markCanonicalDeliveryDisplayed(
    store: InteractionRepositories["state"],
    cognitionId: CognitionId,
) {
    const current = await store.load();
    const cognition = findCognition(current, cognitionId);
    if (cognition.deliveryStatus === "displayed") return current;
    if (cognition.status !== "completed") throw new ValidationError("only completed cognition can reconcile delivery");
    const candidate = cloneState(current);
    findCognition(candidate, cognitionId).deliveryStatus = "displayed";
    return store.commit(current.revision, candidate);
}

export function requireDelivery(ledger: InteractionLedgerDocument, deliveryId: string) {
    const delivery = ledger.deliveries.find((record) => record.delivery_id === deliveryId);
    if (!delivery) throw new ValidationError(`delivery does not exist: ${deliveryId}`);
    return delivery;
}

export function latestDeliveryAttempt(delivery: DeliveryRecord) {
    return delivery.attempts.at(-1) ?? null;
}

export function retryAtForAttempt(attempt: DeliveryAttemptRecord) {
    if (attempt.outcome !== "failed" || !attempt.retryable || attempt.retry_after_seconds === null) return null;
    if (attempt.observedAt === null) throw new ValidationError("retryable terminal delivery is missing observedAt");
    return new Date(Date.parse(attempt.observedAt) + attempt.retry_after_seconds * 1000).toISOString();
}

export function resultFor(
    delivery: DeliveryRecord,
    status: DeliveryReconciliationStatus,
    attemptId: string | null,
    retryAt: string | null,
): DeliveryReconciliationResult {
    return { deliveryId: delivery.delivery_id, status, attemptId, retryAt };
}

export function emptyLedger(): InteractionLedgerDocument {
    return { ledger_version: 3, inbound_occurrences: [], deliveries: [] };
}

export function ledgerVersion(value: unknown) {
    return isObject(value) && "ledger_version" in value ? value.ledger_version : undefined;
}

export function migrateLegacyLedger(legacy: LegacyInteractionLedgerDocument): InteractionLedgerDocument {
    return {
        ledger_version: 3,
        inbound_occurrences: structuredClone(legacy.inbound_occurrences),
        deliveries: legacy.deliveries.map((delivery) => ({
            delivery_id: delivery.delivery_id,
            cognitionId: delivery.cognitionId,
            expressionEvidenceId: delivery.expressionEvidenceId,
            surface_id: delivery.surface_id,
            destination_id: delivery.destination_id,
            intended_at: delivery.intended_at,
            origin: { kind: "ordinary_cognition" },
            send_fence: { status: "open" },
            representation: null,
            attempts: delivery.attempts.map((attempt) => ({
                attempt_id: attempt.attempt_id,
                attempted_at: attempt.attempted_at,
                observedAt: attempt.attempted_at,
                outcome: attempt.outcome,
                retryable: false,
                retry_after_seconds: null,
                external_message_id: attempt.external_message_id,
            })),
        })),
    };
}

export function migrateV2Ledger(legacy: V2InteractionLedgerDocument): InteractionLedgerDocument {
    return {
        ledger_version: 3,
        inbound_occurrences: structuredClone(legacy.inbound_occurrences),
        deliveries: legacy.deliveries.map((delivery) => ({
            ...structuredClone(delivery),
            origin: { kind: "ordinary_cognition" },
            send_fence: { status: "open" },
        })),
    };
}

export function deliveryRepresentation(text: string): DeliveryRepresentation {
    validateDeliveryRepresentationText(text);
    return { text, contentDigest: contentDigest(text) };
}

export function validateDeliveryRepresentationText(text: string) {
    if (typeof text !== "string" || !text.length || Buffer.byteLength(text, "utf8") > MAX_DELIVERY_REPRESENTATION_BYTES)
        throw new ValidationError("delivery representation text is invalid");
}

export function normalizeExternal(value: ExternalOccurrenceMetadata | null) {
    return {
        occurrenceId: value?.occurrenceId ?? null,
        messageId: value?.messageId ?? null,
        threadId: value?.threadId ?? null,
        correlationId: value?.correlationId ?? null,
        occurredAt: value?.occurredAt ?? null,
    };
}

export function validateInboundAcceptance(input: InboundAcceptance, receivedAt: string) {
    validateOpaque(input.surfaceId, "surface_id", 128);
    validateOpaque(input.principal, "asserted principal", 256);
    validateOpaque(input.scope, "interaction scope", 256);
    validateNullableOpaque(input.deliveryDestinationId, "delivery destination_id");
    if (!PRINCIPAL_ASSERTION_PROVENANCE.includes(input.principalProvenance))
        throw new ValidationError("principal assertion provenance is invalid");
    if (typeof input.text !== "string" || !input.text.trim())
        throw new ValidationError("surface input text must be non-empty");
    if (!isRfc3339Utc(receivedAt)) throw new ValidationError("interaction received_at must be RFC 3339 UTC");
    if (input.externalOccurrence !== null) {
        validateOpaque(input.externalOccurrence.occurrenceId, "external occurrence_id");
        validateNullableOpaque(input.externalOccurrence.messageId ?? null, "external message_id");
        validateNullableOpaque(input.externalOccurrence.threadId ?? null, "external thread_id");
        validateNullableOpaque(input.externalOccurrence.correlationId ?? null, "external correlation_id");
        if (input.externalOccurrence.occurredAt != null && !isRfc3339Utc(input.externalOccurrence.occurredAt))
            throw new ValidationError("external occurredAt must be RFC 3339 UTC");
    }
}

export function assertReplayMatches(
    existing: InboundOccurrenceRecord,
    input: InboundAcceptance,
    external: ReturnType<typeof normalizeExternal>,
) {
    const expected = {
        surface_id: input.surfaceId,
        assertedPrincipal: input.principal,
        principal_provenance: input.principalProvenance,
        scope: input.scope,
        contentDigest: contentDigest(input.text),
        external_occurrence_id: external.occurrenceId,
        external_message_id: external.messageId,
        externalThreadId: external.threadId,
        external_correlation_id: external.correlationId,
        external_occurred_at: external.occurredAt,
        delivery_destination_id: input.deliveryDestinationId,
    };
    const actual = Object.fromEntries(
        Object.keys(expected).map((key) => [key, existing[key as keyof typeof existing]]),
    );
    if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new ValidationError("external occurrence replay conflicts with the established occurrence metadata");
}

export function validateLedger(value: unknown): asserts value is InteractionLedgerDocument {
    if (!isObject(value)) throw new ValidationError("interaction ledger must be an object");
    if (!exactKeys(value, ["deliveries", "inbound_occurrences", "ledger_version"]))
        throw new ValidationError("interaction ledger contains unsupported fields");
    if (value.ledger_version !== 3) throw new ValidationError("interaction ledger version is unsupported");
    if (!Array.isArray(value.inbound_occurrences))
        throw new ValidationError("interaction ledger inbound_occurrences must be a list");
    if (!Array.isArray(value.deliveries)) throw new ValidationError("interaction ledger deliveries must be a list");
    validateLedgerRecords(value.inbound_occurrences, value.deliveries, validateDeliveryRecord);
}

export function validateV2Ledger(value: unknown): asserts value is V2InteractionLedgerDocument {
    if (!isObject(value)) throw new ValidationError("interaction ledger must be an object");
    if (!exactKeys(value, ["deliveries", "inbound_occurrences", "ledger_version"]))
        throw new ValidationError("interaction ledger contains unsupported fields");
    if (value.ledger_version !== 2) throw new ValidationError("interaction ledger version is unsupported");
    if (!Array.isArray(value.inbound_occurrences))
        throw new ValidationError("interaction ledger inbound_occurrences must be a list");
    if (!Array.isArray(value.deliveries)) throw new ValidationError("interaction ledger deliveries must be a list");
    validateLedgerRecords(value.inbound_occurrences, value.deliveries, validateV2DeliveryRecord);
}

export function validateLegacyLedger(value: unknown): asserts value is LegacyInteractionLedgerDocument {
    if (!isObject(value)) throw new ValidationError("interaction ledger must be an object");
    if (!exactKeys(value, ["deliveries", "inbound_occurrences", "ledger_version"]))
        throw new ValidationError("interaction ledger contains unsupported fields");
    if (value.ledger_version !== 1) throw new ValidationError("interaction ledger version is unsupported");
    if (!Array.isArray(value.inbound_occurrences))
        throw new ValidationError("interaction ledger inbound_occurrences must be a list");
    if (!Array.isArray(value.deliveries)) throw new ValidationError("interaction ledger deliveries must be a list");
    validateLedgerRecords(value.inbound_occurrences, value.deliveries, validateLegacyDeliveryRecord);
}

export function validateLedgerRecords(
    inbound: unknown[],
    deliveries: unknown[],
    validateDelivery: (value: unknown) => void,
) {
    const occurrenceIds = new Set<string>();
    const cognitionIds = new Set<string>();
    const externalKeys = new Set<string>();
    for (const raw of inbound) {
        validateInboundRecord(raw);
        const record = raw as InboundOccurrenceRecord;
        if (occurrenceIds.has(record.occurrence_id)) throw new ValidationError("duplicate interaction occurrence_id");
        occurrenceIds.add(record.occurrence_id);
        if (cognitionIds.has(record.cognitionId)) throw new ValidationError("duplicate interaction cognitionId");
        cognitionIds.add(record.cognitionId);
        if (record.external_occurrence_id !== null) {
            const key = JSON.stringify([record.surface_id, record.external_occurrence_id]);
            if (externalKeys.has(key)) throw new ValidationError("duplicate external occurrence correlation key");
            externalKeys.add(key);
        }
    }

    const deliveryIds = new Set<string>();
    const attemptIds = new Set<string>();
    const proactiveIntentIds = new Set<string>();
    for (const raw of deliveries) {
        validateDelivery(raw);
        const record = raw as { delivery_id: string; attempts: Array<{ attempt_id: string }> };
        if (deliveryIds.has(record.delivery_id)) throw new ValidationError("duplicate delivery_id");
        deliveryIds.add(record.delivery_id);
        const origin = (raw as DeliveryRecord).origin;
        if (origin?.kind === "proactive_contact") {
            if (proactiveIntentIds.has(origin.contact_intent_id))
                throw new ValidationError("duplicate proactive contact delivery");
            proactiveIntentIds.add(origin.contact_intent_id);
        }
        for (const attempt of record.attempts) {
            if (attemptIds.has(attempt.attempt_id)) throw new ValidationError("duplicate delivery attempt_id");
            attemptIds.add(attempt.attempt_id);
        }
    }
}

export function validateInboundRecord(value: unknown) {
    if (!isObject(value)) throw new ValidationError("interaction occurrence must be an object");
    const fields = [
        "occurrence_id",
        "cognitionId",
        "surface_id",
        "assertedPrincipal",
        "principal_provenance",
        "scope",
        "contentDigest",
        "first_received_at",
        "last_received_at",
        "receive_count",
        "external_occurrence_id",
        "external_message_id",
        "externalThreadId",
        "external_correlation_id",
        "external_occurred_at",
        "delivery_destination_id",
    ];
    if (!exactKeys(value, fields)) throw new ValidationError("interaction occurrence contains unsupported fields");
    if (typeof value.occurrence_id !== "string" || !value.occurrence_id.startsWith("occurrence-"))
        throw new ValidationError("interaction occurrence_id is invalid");
    if (typeof value.cognitionId !== "string" || !value.cognitionId.startsWith("cognition-"))
        throw new ValidationError("interaction cognitionId is invalid");
    validateOpaque(value.surface_id, "interaction surface_id", 128);
    validateOpaque(value.assertedPrincipal, "interaction assertedPrincipal", 256);
    validateOpaque(value.scope, "interaction scope", 256);
    if (!PRINCIPAL_ASSERTION_PROVENANCE.includes(value.principal_provenance as PrincipalAssertionProvenance))
        throw new ValidationError("interaction principal provenance is invalid");
    if (typeof value.contentDigest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(value.contentDigest))
        throw new ValidationError("interaction contentDigest is invalid");
    if (!isRfc3339Utc(value.first_received_at) || !isRfc3339Utc(value.last_received_at))
        throw new ValidationError("interaction receipt timestamps are invalid");
    if (Date.parse(value.first_received_at as string) > Date.parse(value.last_received_at as string))
        throw new ValidationError("interaction last receipt precedes first receipt");
    if (!Number.isSafeInteger(value.receive_count) || (value.receive_count as number) < 1)
        throw new ValidationError("interaction receive_count is invalid");
    validateNullableOpaque(value.external_occurrence_id, "interaction external_occurrence_id");
    validateNullableOpaque(value.external_message_id, "interaction external_message_id");
    validateNullableOpaque(value.externalThreadId, "interaction externalThreadId");
    validateNullableOpaque(value.external_correlation_id, "interaction external_correlation_id");
    if (value.external_occurred_at !== null && !isRfc3339Utc(value.external_occurred_at))
        throw new ValidationError("interaction external_occurred_at is invalid");
    validateNullableOpaque(value.delivery_destination_id, "interaction delivery_destination_id");
}

const DELIVERY_IDENTITY_FIELDS = [
    "delivery_id",
    "cognitionId",
    "expressionEvidenceId",
    "surface_id",
    "destination_id",
    "intended_at",
] as const;

export function validateDeliveryRecord(value: unknown) {
    if (!isObject(value)) throw new ValidationError("delivery record must be an object");
    const fields = [...DELIVERY_IDENTITY_FIELDS, "origin", "send_fence", "representation", "attempts"];
    if (!exactKeys(value, fields)) throw new ValidationError("delivery record contains unsupported fields");
    validateDeliveryIdentityFields(value);
    validateDeliveryOrigin(value.origin);
    validateDeliverySendFence(value.send_fence);
    if (value.representation !== null) validateDeliveryRepresentation(value.representation);
    if (!Array.isArray(value.attempts)) throw new ValidationError("delivery attempts must be a list");
    for (const attempt of value.attempts) validateDeliveryAttempt(attempt);
}

export function validateV2DeliveryRecord(value: unknown) {
    if (!isObject(value)) throw new ValidationError("delivery record must be an object");
    const fields = [...DELIVERY_IDENTITY_FIELDS, "representation", "attempts"];
    if (!exactKeys(value, fields)) throw new ValidationError("delivery record contains unsupported fields");
    validateDeliveryIdentityFields(value);
    if (value.representation !== null) validateDeliveryRepresentation(value.representation);
    if (!Array.isArray(value.attempts)) throw new ValidationError("delivery attempts must be a list");
    for (const attempt of value.attempts) validateDeliveryAttempt(attempt);
}

export function validateDeliveryOrigin(value: unknown): asserts value is DeliveryOrigin {
    if (!isObject(value)) throw new ValidationError("delivery origin must be an object");
    if (value.kind === "ordinary_cognition") {
        if (!exactKeys(value, ["kind"]))
            throw new ValidationError("ordinary delivery origin contains unsupported fields");
        return;
    }
    if (value.kind !== "proactive_contact" || !exactKeys(value, ["contact_intent_id", "kind", "policy_assessment_id"]))
        throw new ValidationError("delivery origin is invalid");
    if (typeof value.contact_intent_id !== "string" || !value.contact_intent_id.startsWith("contact-intent-"))
        throw new ValidationError("delivery proactive contact intent id is invalid");
    if (typeof value.policy_assessment_id !== "string" || !value.policy_assessment_id.startsWith("contact-policy-"))
        throw new ValidationError("delivery proactive policy assessment id is invalid");
}

export function validateDeliverySendFence(value: unknown): asserts value is DeliverySendFence {
    if (!isObject(value)) throw new ValidationError("delivery send fence must be an object");
    if (value.status === "open") {
        if (!exactKeys(value, ["status"])) throw new ValidationError("open delivery fence contains unsupported fields");
        return;
    }
    if (value.status !== "no_further_send" || !exactKeys(value, ["basis", "fenced_at", "status"]))
        throw new ValidationError("delivery send fence is invalid");
    if (!isRfc3339Utc(value.fenced_at)) throw new ValidationError("delivery fenced_at is invalid");
    validateOpaque(value.basis, "delivery fence basis");
}

export function validateLegacyDeliveryRecord(value: unknown) {
    if (!isObject(value)) throw new ValidationError("delivery record must be an object");
    const fields = [...DELIVERY_IDENTITY_FIELDS, "attempts"];
    if (!exactKeys(value, fields)) throw new ValidationError("delivery record contains unsupported fields");
    validateDeliveryIdentityFields(value);
    if (!Array.isArray(value.attempts)) throw new ValidationError("delivery attempts must be a list");
    for (const attempt of value.attempts) validateLegacyDeliveryAttempt(attempt);
}

export function validateDeliveryIdentityFields(record: Record<string, unknown>) {
    if (typeof record.delivery_id !== "string" || !record.delivery_id.startsWith("delivery-"))
        throw new ValidationError("delivery_id is invalid");
    if (typeof record.cognitionId !== "string" || !record.cognitionId.startsWith("cognition-"))
        throw new ValidationError("delivery cognitionId is invalid");
    if (typeof record.expressionEvidenceId !== "string" || !record.expressionEvidenceId.startsWith("evidence-"))
        throw new ValidationError("delivery expressionEvidenceId is invalid");
    validateOpaque(record.surface_id, "delivery surface_id", 128);
    validateNullableOpaque(record.destination_id, "delivery destination_id");
    if (!isRfc3339Utc(record.intended_at)) throw new ValidationError("delivery intended_at is invalid");
}

export function validateDeliveryRepresentation(value: unknown) {
    if (!isObject(value)) throw new ValidationError("delivery representation must be an object");
    if (!exactKeys(value, ["contentDigest", "text"]))
        throw new ValidationError("delivery representation contains unsupported fields");
    validateDeliveryRepresentationText(value.text as string);
    if (value.contentDigest !== contentDigest(value.text as string))
        throw new ValidationError("delivery representation contentDigest does not match text");
}

const DELIVERY_ATTEMPT_IDENTITY_FIELDS = ["attempt_id", "attempted_at", "external_message_id"] as const;

export function validateDeliveryAttempt(value: unknown) {
    if (!isObject(value)) throw new ValidationError("delivery attempt must be an object");
    const fields = [...DELIVERY_ATTEMPT_IDENTITY_FIELDS, "observedAt", "outcome", "retryable", "retry_after_seconds"];
    if (!exactKeys(value, fields)) throw new ValidationError("delivery attempt contains unsupported fields");
    validateDeliveryAttemptIdentityFields(value);
    if (!["started", "confirmed", "failed", "uncertain"].includes(value.outcome as string))
        throw new ValidationError("delivery attempt outcome is invalid");
    if (value.outcome === "started") {
        if (value.observedAt !== null || value.retryable !== false || value.retry_after_seconds !== null)
            throw new ValidationError("started delivery attempt contains terminal metadata");
        if (value.external_message_id !== null)
            throw new ValidationError("started delivery attempt cannot have an external message id");
        return;
    }
    if (!isRfc3339Utc(value.observedAt)) throw new ValidationError("delivery observedAt is invalid");
    if (Date.parse(value.observedAt as string) < Date.parse(value.attempted_at as string))
        throw new ValidationError("delivery observation precedes attempt start");
    validateRetryMetadata(
        value.outcome as TerminalDeliveryAttemptOutcome,
        value.retryable,
        value.retry_after_seconds as number | null,
    );
}

export function validateLegacyDeliveryAttempt(value: unknown) {
    if (!isObject(value)) throw new ValidationError("delivery attempt must be an object");
    const fields = [...DELIVERY_ATTEMPT_IDENTITY_FIELDS, "outcome"];
    if (!exactKeys(value, fields)) throw new ValidationError("delivery attempt contains unsupported fields");
    validateDeliveryAttemptIdentityFields(value);
    if (!["confirmed", "failed", "uncertain"].includes(value.outcome as string))
        throw new ValidationError("delivery attempt outcome is invalid");
}

export function validateDeliveryAttemptIdentityFields(attempt: Record<string, unknown>) {
    if (typeof attempt.attempt_id !== "string" || !attempt.attempt_id.startsWith("attempt-"))
        throw new ValidationError("delivery attempt_id is invalid");
    if (!isRfc3339Utc(attempt.attempted_at)) throw new ValidationError("delivery attempted_at is invalid");
    validateNullableOpaque(attempt.external_message_id, "delivery external_message_id");
}

export function validateRetryMetadata(
    outcome: TerminalDeliveryAttemptOutcome,
    retryable: unknown,
    retryAfterSeconds: unknown,
) {
    if (typeof retryable !== "boolean") throw new ValidationError("delivery retryable flag is invalid");
    if (retryable && outcome !== "failed")
        throw new ValidationError("only a definite failed delivery may be retryable");
    if (retryAfterSeconds !== null) {
        if (!retryable || !Number.isSafeInteger(retryAfterSeconds) || (retryAfterSeconds as number) < 0)
            throw new ValidationError("delivery retry_after_seconds is invalid");
    }
}

export function validateOpaque(value: unknown, field: string, maxLength = 512): asserts value is string {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        value.length > maxLength ||
        ASCII_CONTROL_CHARACTER_PATTERN.test(value)
    )
        throw new ValidationError(`${field} is invalid`);
}

export function validateNullableOpaque(value: unknown, field: string) {
    if (value !== null) validateOpaque(value, field);
}

export function errorCode(error: unknown) {
    return error !== null &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
