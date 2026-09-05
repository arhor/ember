import type { Writable } from "node:stream";

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import type { CognitionId, CognitionStatus, EmberState, EvidenceId } from "../core/model.ts";
import type { StateStore } from "../persistence/state-store.ts";
import type { RunCognitionOptions } from "./runtime.ts";

import { DurabilityUncertain, StoreUnavailable, ValidationError } from "../core/errors.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN, contentDigest, isRfc3339Utc, newId, nowUtc } from "../core/model.ts";
import { findRuntime } from "../core/projection.ts";
import { requirePrincipal } from "../core/semantics.ts";
import { findCognition, runCognition } from "./runtime.ts";

export const PRINCIPAL_ASSERTION_PROVENANCE = ["explicit_local_argument", "configured_surface_mapping"] as const;
export type PrincipalAssertionProvenance = (typeof PRINCIPAL_ASSERTION_PROVENANCE)[number];

export interface ExternalOccurrenceMetadata {
    occurrenceId: string;
    messageId?: string | null;
    threadId?: string | null;
    correlationId?: string | null;
    occurredAt?: string | null;
}

export interface SurfaceInteractionOptions extends Omit<
    RunCognitionOptions,
    "cognitionId" | "hooks" | "output" | "surface"
> {
    surfaceId: string;
    principalProvenance: PrincipalAssertionProvenance;
    externalOccurrence?: ExternalOccurrenceMetadata | null;
    deliveryDestinationId?: string | null;
    output?: Writable | ((text: string) => void | Promise<void>);
}

export interface SurfaceInteractionResult {
    state: EmberState;
    providerFailure: string | null;
    cognitionId: CognitionId;
    cognitionStatus: CognitionStatus;
    occurrenceId: string;
    deliveryId: string | null;
    replayed: boolean;
}

export interface InboundOccurrenceRecord {
    occurrence_id: string;
    cognition_id: CognitionId;
    surface_id: string;
    asserted_principal: string;
    principal_provenance: PrincipalAssertionProvenance;
    scope: string;
    content_digest: `sha256:${string}`;
    first_received_at: string;
    last_received_at: string;
    receive_count: number;
    external_occurrence_id: string | null;
    external_message_id: string | null;
    external_thread_id: string | null;
    external_correlation_id: string | null;
    external_occurred_at: string | null;
    delivery_destination_id: string | null;
}

export type DeliveryAttemptOutcome = "confirmed" | "failed" | "uncertain";

export interface DeliveryAttemptRecord {
    attempt_id: string;
    attempted_at: string;
    outcome: DeliveryAttemptOutcome;
    external_message_id: string | null;
}

export interface DeliveryRecord {
    delivery_id: string;
    cognition_id: CognitionId;
    expression_evidence_id: EvidenceId;
    surface_id: string;
    destination_id: string | null;
    intended_at: string;
    attempts: DeliveryAttemptRecord[];
}

export interface InteractionLedgerDocument {
    ledger_version: 1;
    inbound_occurrences: InboundOccurrenceRecord[];
    deliveries: DeliveryRecord[];
}

interface AcceptedInboundOccurrence {
    record: InboundOccurrenceRecord;
    replayed: boolean;
}

interface InboundAcceptance {
    surfaceId: string;
    principal: string;
    principalProvenance: PrincipalAssertionProvenance;
    scope: string;
    text: string;
    externalOccurrence: ExternalOccurrenceMetadata | null;
    deliveryDestinationId: string | null;
}

export class InteractionLedgerStore {
    readonly path: string;

    constructor(statePath: string) {
        if (!statePath.trim()) throw new ValidationError("interaction ledger requires a state path");
        this.path = `${statePath}.interactions.json`;
    }

    async load(): Promise<InteractionLedgerDocument> {
        let text: string;
        try {
            text = await readFile(this.path, "utf8");
        } catch (error) {
            if (errorCode(error) === "ENOENT") return emptyLedger();
            throw new StoreUnavailable(`cannot read interaction ledger ${this.path}: ${errorMessage(error)}`, {
                cause: error,
            });
        }

        let value: unknown;
        try {
            value = JSON.parse(text);
        } catch (error) {
            throw new StoreUnavailable(`interaction ledger is not valid JSON: ${errorMessage(error)}`, {
                cause: error,
            });
        }
        validateLedger(value);
        return value;
    }

    async acceptInbound(
        input: InboundAcceptance,
        cognitionId: CognitionId,
        receivedAt = nowUtc(),
    ): Promise<AcceptedInboundOccurrence> {
        validateInboundAcceptance(input, receivedAt);
        return this.update((ledger) => {
            const external = normalizeExternal(input.externalOccurrence);
            if (external.occurrenceId !== null) {
                const existing = ledger.inbound_occurrences.find(
                    (record) =>
                        record.surface_id === input.surfaceId &&
                        record.external_occurrence_id === external.occurrenceId,
                );
                if (existing) {
                    assertReplayMatches(existing, input, external);
                    existing.last_received_at = receivedAt;
                    existing.receive_count += 1;
                    return { record: structuredClone(existing), replayed: true };
                }
            }

            const record: InboundOccurrenceRecord = {
                occurrence_id: `occurrence-${randomUUID()}`,
                cognition_id: cognitionId,
                surface_id: input.surfaceId,
                asserted_principal: input.principal,
                principal_provenance: input.principalProvenance,
                scope: input.scope,
                content_digest: contentDigest(input.text),
                first_received_at: receivedAt,
                last_received_at: receivedAt,
                receive_count: 1,
                external_occurrence_id: external.occurrenceId,
                external_message_id: external.messageId,
                external_thread_id: external.threadId,
                external_correlation_id: external.correlationId,
                external_occurred_at: external.occurredAt,
                delivery_destination_id: input.deliveryDestinationId,
            };
            ledger.inbound_occurrences.push(record);
            return { record: structuredClone(record), replayed: false };
        });
    }

    async createDeliveryIntent(
        {
            cognitionId,
            expressionEvidenceId,
            surfaceId,
            destinationId,
        }: {
            cognitionId: CognitionId;
            expressionEvidenceId: EvidenceId;
            surfaceId: string;
            destinationId: string | null;
        },
        intendedAt = nowUtc(),
    ): Promise<DeliveryRecord> {
        validateOpaque(surfaceId, "delivery surface_id", 128);
        validateNullableOpaque(destinationId, "delivery destination_id");
        if (!isRfc3339Utc(intendedAt)) throw new ValidationError("delivery intended_at must be RFC 3339 UTC");

        return this.update((ledger) => {
            const existing = ledger.deliveries.find(
                (record) =>
                    record.cognition_id === cognitionId &&
                    record.expression_evidence_id === expressionEvidenceId &&
                    record.surface_id === surfaceId &&
                    record.destination_id === destinationId,
            );
            if (existing) return structuredClone(existing);

            const record: DeliveryRecord = {
                delivery_id: `delivery-${randomUUID()}`,
                cognition_id: cognitionId,
                expression_evidence_id: expressionEvidenceId,
                surface_id: surfaceId,
                destination_id: destinationId,
                intended_at: intendedAt,
                attempts: [],
            };
            ledger.deliveries.push(record);
            return structuredClone(record);
        });
    }

    async recordDeliveryAttempt(
        deliveryId: string,
        outcome: DeliveryAttemptOutcome,
        {
            externalMessageId = null,
            attemptedAt = nowUtc(),
        }: { externalMessageId?: string | null; attemptedAt?: string } = {},
    ): Promise<DeliveryAttemptRecord> {
        if (!["confirmed", "failed", "uncertain"].includes(outcome))
            throw new ValidationError("delivery attempt outcome is invalid");
        validateNullableOpaque(externalMessageId, "delivery external_message_id");
        if (!isRfc3339Utc(attemptedAt)) throw new ValidationError("delivery attempted_at must be RFC 3339 UTC");

        return this.update((ledger) => {
            const delivery = ledger.deliveries.find((record) => record.delivery_id === deliveryId);
            if (!delivery) throw new ValidationError(`delivery does not exist: ${deliveryId}`);
            const attempt: DeliveryAttemptRecord = {
                attempt_id: `attempt-${randomUUID()}`,
                attempted_at: attemptedAt,
                outcome,
                external_message_id: externalMessageId,
            };
            delivery.attempts.push(attempt);
            return structuredClone(attempt);
        });
    }

    private async update<T>(mutate: (ledger: InteractionLedgerDocument) => T): Promise<T> {
        const ledger = await this.load();
        const result = mutate(ledger);
        validateLedger(ledger);
        await this.replace(ledger);
        return result;
    }

    private async replace(ledger: InteractionLedgerDocument) {
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
        let handle = null as Awaited<ReturnType<typeof open>> | null;
        let replaced = false;
        try {
            handle = await open(temporary, "wx", 0o600);
            await handle.writeFile(`${JSON.stringify(ledger, null, 2)}\n`, "utf8");
            await handle.sync();
            await handle.close();
            handle = null;
            await rename(temporary, this.path);
            replaced = true;
            try {
                const directory = await open(dirname(this.path), "r");
                try {
                    await directory.sync();
                } finally {
                    await directory.close();
                }
            } catch (error) {
                throw new DurabilityUncertain(
                    "interaction ledger replacement may be visible, but directory synchronization failed",
                    { cause: error },
                );
            }
        } finally {
            if (handle) await handle.close().catch(() => {});
            if (!replaced) await unlink(temporary).catch(() => {});
        }
    }
}

export async function runSurfaceInteraction(
    store: StateStore,
    state: EmberState,
    options: SurfaceInteractionOptions,
): Promise<SurfaceInteractionResult> {
    const {
        surfaceId,
        principalProvenance,
        externalOccurrence = null,
        deliveryDestinationId = null,
        output = process.stdout,
        ...cognitionOptions
    } = options;
    requirePrincipal(state, cognitionOptions.principal);
    findRuntime(state, cognitionOptions.runtimeId);

    const ledger = new InteractionLedgerStore(store.path);
    const plannedCognitionId = newId("cognition");
    const accepted = await ledger.acceptInbound(
        {
            surfaceId,
            principal: cognitionOptions.principal,
            principalProvenance,
            scope: cognitionOptions.scope,
            text: cognitionOptions.text,
            externalOccurrence,
            deliveryDestinationId,
        },
        plannedCognitionId,
    );
    const cognitionId = accepted.record.cognition_id;
    const current = await store.load();
    const existing = current.operations.cognition_episodes.find((episode) => episode.cognition_id === cognitionId);
    if (existing) {
        let delivery = findDeliveryForCognition(await ledger.load(), cognitionId);
        if (delivery === null && existing.status === "completed" && existing.expression_evidence_id !== null) {
            delivery = await ledger.createDeliveryIntent({
                cognitionId,
                expressionEvidenceId: existing.expression_evidence_id,
                surfaceId: accepted.record.surface_id,
                destinationId: accepted.record.delivery_destination_id,
            });
        }
        return {
            state: current,
            providerFailure:
                existing.status === "completed"
                    ? null
                    : `transport replay suppressed; existing cognition status is ${existing.status}`,
            cognitionId,
            cognitionStatus: existing.status,
            occurrenceId: accepted.record.occurrence_id,
            deliveryId: delivery?.delivery_id ?? null,
            replayed: true,
        };
    }

    let deliveryId: string | null = null;
    let deliveryAttemptRecorded = false;
    try {
        const result = await runCognition(store, accepted.replayed ? current : state, {
            ...cognitionOptions,
            surface: surfaceId,
            cognitionId,
            output,
            hooks: {
                afterExpressionCommit: async (committed) => {
                    const cognition = findCognition(committed, cognitionId);
                    if (cognition.expression_evidence_id === null)
                        throw new ValidationError("completed cognition is missing expression evidence");
                    const intent = await ledger.createDeliveryIntent({
                        cognitionId,
                        expressionEvidenceId: cognition.expression_evidence_id,
                        surfaceId: accepted.record.surface_id,
                        destinationId: accepted.record.delivery_destination_id,
                    });
                    deliveryId = intent.delivery_id;
                },
                afterDisplay: async () => {
                    if (deliveryId === null) throw new ValidationError("delivery display has no delivery intent");
                    await ledger.recordDeliveryAttempt(deliveryId, "confirmed");
                    deliveryAttemptRecorded = true;
                },
            },
        });
        const cognition = findCognition(result.state, cognitionId);
        return {
            ...result,
            cognitionStatus: cognition.status,
            occurrenceId: accepted.record.occurrence_id,
            deliveryId,
            replayed: accepted.replayed,
        };
    } catch (error) {
        if (deliveryId !== null && !deliveryAttemptRecorded) {
            try {
                await ledger.recordDeliveryAttempt(deliveryId, "uncertain");
            } catch (ledgerError) {
                throw new AggregateError(
                    [error, ledgerError],
                    "delivery failed and its uncertainty could not be recorded",
                );
            }
        }
        throw error;
    }
}

function findDeliveryForCognition(ledger: InteractionLedgerDocument, cognitionId: CognitionId) {
    return ledger.deliveries.find((record) => record.cognition_id === cognitionId) ?? null;
}

function emptyLedger(): InteractionLedgerDocument {
    return { ledger_version: 1, inbound_occurrences: [], deliveries: [] };
}

function normalizeExternal(value: ExternalOccurrenceMetadata | null) {
    return {
        occurrenceId: value?.occurrenceId ?? null,
        messageId: value?.messageId ?? null,
        threadId: value?.threadId ?? null,
        correlationId: value?.correlationId ?? null,
        occurredAt: value?.occurredAt ?? null,
    };
}

function validateInboundAcceptance(input: InboundAcceptance, receivedAt: string) {
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
            throw new ValidationError("external occurred_at must be RFC 3339 UTC");
    }
}

function assertReplayMatches(
    existing: InboundOccurrenceRecord,
    input: InboundAcceptance,
    external: ReturnType<typeof normalizeExternal>,
) {
    const expected = {
        surface_id: input.surfaceId,
        asserted_principal: input.principal,
        principal_provenance: input.principalProvenance,
        scope: input.scope,
        content_digest: contentDigest(input.text),
        external_occurrence_id: external.occurrenceId,
        external_message_id: external.messageId,
        external_thread_id: external.threadId,
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

function validateLedger(value: unknown): asserts value is InteractionLedgerDocument {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("interaction ledger must be an object");
    const ledger = value as Record<string, unknown>;
    if (
        JSON.stringify(Object.keys(ledger).sort()) !==
        JSON.stringify(["deliveries", "inbound_occurrences", "ledger_version"])
    )
        throw new ValidationError("interaction ledger contains unsupported fields");
    if (ledger.ledger_version !== 1) throw new ValidationError("interaction ledger version is unsupported");
    if (!Array.isArray(ledger.inbound_occurrences))
        throw new ValidationError("interaction ledger inbound_occurrences must be a list");
    if (!Array.isArray(ledger.deliveries)) throw new ValidationError("interaction ledger deliveries must be a list");

    const occurrenceIds = new Set<string>();
    const cognitionIds = new Set<string>();
    const externalKeys = new Set<string>();
    for (const raw of ledger.inbound_occurrences) {
        validateInboundRecord(raw);
        const record = raw as InboundOccurrenceRecord;
        if (occurrenceIds.has(record.occurrence_id)) throw new ValidationError("duplicate interaction occurrence_id");
        occurrenceIds.add(record.occurrence_id);
        if (cognitionIds.has(record.cognition_id)) throw new ValidationError("duplicate interaction cognition_id");
        cognitionIds.add(record.cognition_id);
        if (record.external_occurrence_id !== null) {
            const key = JSON.stringify([record.surface_id, record.external_occurrence_id]);
            if (externalKeys.has(key)) throw new ValidationError("duplicate external occurrence correlation key");
            externalKeys.add(key);
        }
    }

    const deliveryIds = new Set<string>();
    const attemptIds = new Set<string>();
    for (const raw of ledger.deliveries) {
        validateDeliveryRecord(raw);
        const record = raw as DeliveryRecord;
        if (deliveryIds.has(record.delivery_id)) throw new ValidationError("duplicate delivery_id");
        deliveryIds.add(record.delivery_id);
        for (const attempt of record.attempts) {
            if (attemptIds.has(attempt.attempt_id)) throw new ValidationError("duplicate delivery attempt_id");
            attemptIds.add(attempt.attempt_id);
        }
    }
}

function validateInboundRecord(value: unknown) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("interaction occurrence must be an object");
    const record = value as Record<string, unknown>;
    const fields = [
        "occurrence_id",
        "cognition_id",
        "surface_id",
        "asserted_principal",
        "principal_provenance",
        "scope",
        "content_digest",
        "first_received_at",
        "last_received_at",
        "receive_count",
        "external_occurrence_id",
        "external_message_id",
        "external_thread_id",
        "external_correlation_id",
        "external_occurred_at",
        "delivery_destination_id",
    ].sort();
    if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(fields))
        throw new ValidationError("interaction occurrence contains unsupported fields");
    if (typeof record.occurrence_id !== "string" || !record.occurrence_id.startsWith("occurrence-"))
        throw new ValidationError("interaction occurrence_id is invalid");
    if (typeof record.cognition_id !== "string" || !record.cognition_id.startsWith("cognition-"))
        throw new ValidationError("interaction cognition_id is invalid");
    validateOpaque(record.surface_id, "interaction surface_id", 128);
    validateOpaque(record.asserted_principal, "interaction asserted_principal", 256);
    validateOpaque(record.scope, "interaction scope", 256);
    if (!PRINCIPAL_ASSERTION_PROVENANCE.includes(record.principal_provenance as PrincipalAssertionProvenance))
        throw new ValidationError("interaction principal provenance is invalid");
    if (typeof record.content_digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(record.content_digest))
        throw new ValidationError("interaction content_digest is invalid");
    if (!isRfc3339Utc(record.first_received_at) || !isRfc3339Utc(record.last_received_at))
        throw new ValidationError("interaction receipt timestamps are invalid");
    if (Date.parse(record.first_received_at as string) > Date.parse(record.last_received_at as string))
        throw new ValidationError("interaction last receipt precedes first receipt");
    if (!Number.isSafeInteger(record.receive_count) || (record.receive_count as number) < 1)
        throw new ValidationError("interaction receive_count is invalid");
    validateNullableOpaque(record.external_occurrence_id, "interaction external_occurrence_id");
    validateNullableOpaque(record.external_message_id, "interaction external_message_id");
    validateNullableOpaque(record.external_thread_id, "interaction external_thread_id");
    validateNullableOpaque(record.external_correlation_id, "interaction external_correlation_id");
    if (record.external_occurred_at !== null && !isRfc3339Utc(record.external_occurred_at))
        throw new ValidationError("interaction external_occurred_at is invalid");
    validateNullableOpaque(record.delivery_destination_id, "interaction delivery_destination_id");
}

function validateDeliveryRecord(value: unknown) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("delivery record must be an object");
    const record = value as Record<string, unknown>;
    const fields = [
        "delivery_id",
        "cognition_id",
        "expression_evidence_id",
        "surface_id",
        "destination_id",
        "intended_at",
        "attempts",
    ].sort();
    if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(fields))
        throw new ValidationError("delivery record contains unsupported fields");
    if (typeof record.delivery_id !== "string" || !record.delivery_id.startsWith("delivery-"))
        throw new ValidationError("delivery_id is invalid");
    if (typeof record.cognition_id !== "string" || !record.cognition_id.startsWith("cognition-"))
        throw new ValidationError("delivery cognition_id is invalid");
    if (typeof record.expression_evidence_id !== "string" || !record.expression_evidence_id.startsWith("evidence-"))
        throw new ValidationError("delivery expression_evidence_id is invalid");
    validateOpaque(record.surface_id, "delivery surface_id", 128);
    validateNullableOpaque(record.destination_id, "delivery destination_id");
    if (!isRfc3339Utc(record.intended_at)) throw new ValidationError("delivery intended_at is invalid");
    if (!Array.isArray(record.attempts)) throw new ValidationError("delivery attempts must be a list");
    for (const attempt of record.attempts) validateDeliveryAttempt(attempt);
}

function validateDeliveryAttempt(value: unknown) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("delivery attempt must be an object");
    const attempt = value as Record<string, unknown>;
    if (
        JSON.stringify(Object.keys(attempt).sort()) !==
        JSON.stringify(["attempt_id", "attempted_at", "external_message_id", "outcome"])
    )
        throw new ValidationError("delivery attempt contains unsupported fields");
    if (typeof attempt.attempt_id !== "string" || !attempt.attempt_id.startsWith("attempt-"))
        throw new ValidationError("delivery attempt_id is invalid");
    if (!isRfc3339Utc(attempt.attempted_at)) throw new ValidationError("delivery attempted_at is invalid");
    if (!["confirmed", "failed", "uncertain"].includes(attempt.outcome as string))
        throw new ValidationError("delivery attempt outcome is invalid");
    validateNullableOpaque(attempt.external_message_id, "delivery external_message_id");
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

function validateNullableOpaque(value: unknown, field: string) {
    if (value !== null) validateOpaque(value, field);
}

function errorCode(error: unknown) {
    return error !== null &&
        typeof error === "object" &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}
