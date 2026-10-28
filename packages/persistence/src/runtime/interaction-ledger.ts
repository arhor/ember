import type {
    TerminalDeliveryAttemptOutcome,
    InboundOccurrenceRecord,
    DeliveryAttemptRecord,
    DeliveryOrigin,
    DeliveryRecord,
    InteractionLedgerDocument,
    AcceptedInboundOccurrence,
    InboundAcceptance,
} from "@ember/application/runtime/interaction-boundary.ts";
import type { CognitionId, EvidenceId } from "@ember/domain/model.ts";

import {
    requireDelivery,
    latestDeliveryAttempt,
    retryAtForAttempt,
    emptyLedger,
    ledgerVersion,
    migrateLegacyLedger,
    migrateV2Ledger,
    deliveryRepresentation,
    validateDeliveryRepresentationText,
    normalizeExternal,
    validateInboundAcceptance,
    assertReplayMatches,
    validateLedger,
    validateV2Ledger,
    validateLegacyLedger,
    validateDeliveryOrigin,
    validateRetryMetadata,
    validateOpaque,
    validateNullableOpaque,
    errorCode,
    errorMessage,
} from "@ember/application/runtime/interaction-boundary.ts";
import { StoreUnavailable, ValidationError } from "@ember/domain/errors.ts";
import { nowUtc, isRfc3339Utc } from "@ember/domain/model.ts";
import { contentDigest } from "@ember/domain/util.ts";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { replaceFileDurably } from "../persistence/file-replacement.ts";
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
        if (ledgerVersion(value) === 1) {
            validateLegacyLedger(value);
            return migrateLegacyLedger(value);
        }
        if (ledgerVersion(value) === 2) {
            validateV2Ledger(value);
            return migrateV2Ledger(value);
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
                cognitionId: cognitionId,
                surface_id: input.surfaceId,
                assertedPrincipal: input.principal,
                principal_provenance: input.principalProvenance,
                scope: input.scope,
                contentDigest: contentDigest(input.text),
                first_received_at: receivedAt,
                last_received_at: receivedAt,
                receive_count: 1,
                external_occurrence_id: external.occurrenceId,
                external_message_id: external.messageId,
                externalThreadId: external.threadId,
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
            representationText,
            origin = { kind: "ordinary_cognition" },
        }: {
            cognitionId: CognitionId;
            expressionEvidenceId: EvidenceId;
            surfaceId: string;
            destinationId: string | null;
            representationText: string | null;
            origin?: DeliveryOrigin;
        },
        intendedAt = nowUtc(),
    ): Promise<DeliveryRecord> {
        validateOpaque(surfaceId, "delivery surface_id", 128);
        validateNullableOpaque(destinationId, "delivery destination_id");
        if (representationText !== null) validateDeliveryRepresentationText(representationText);
        validateDeliveryOrigin(origin);
        if (origin.kind === "proactive_contact" && representationText === null)
            throw new ValidationError("proactive delivery requires a retained representation");
        if (!isRfc3339Utc(intendedAt)) throw new ValidationError("delivery intended_at must be RFC 3339 UTC");

        return this.update((ledger) => {
            const existing =
                origin.kind === "proactive_contact"
                    ? ledger.deliveries.find(
                          (record) =>
                              record.origin.kind === "proactive_contact" &&
                              record.origin.contact_intent_id === origin.contact_intent_id,
                      )
                    : ledger.deliveries.find(
                          (record) =>
                              record.origin.kind === "ordinary_cognition" &&
                              record.cognitionId === cognitionId &&
                              record.expressionEvidenceId === expressionEvidenceId &&
                              record.surface_id === surfaceId &&
                              record.destination_id === destinationId,
                      );
            if (existing) {
                if (
                    existing.cognitionId !== cognitionId ||
                    existing.expressionEvidenceId !== expressionEvidenceId ||
                    existing.surface_id !== surfaceId ||
                    existing.destination_id !== destinationId ||
                    JSON.stringify(existing.origin) !== JSON.stringify(origin)
                )
                    throw new ValidationError("delivery replay conflicts with the established intent");
                if (representationText !== null) {
                    const representation = deliveryRepresentation(representationText);
                    if (existing.representation === null) existing.representation = representation;
                    else if (existing.representation.contentDigest !== representation.contentDigest)
                        throw new ValidationError("delivery representation conflicts with the established intent");
                }
                return structuredClone(existing);
            }

            const record: DeliveryRecord = {
                delivery_id: `delivery-${randomUUID()}`,
                cognitionId: cognitionId,
                expressionEvidenceId: expressionEvidenceId,
                surface_id: surfaceId,
                destination_id: destinationId,
                intended_at: intendedAt,
                origin: structuredClone(origin),
                send_fence: { status: "open" },
                representation: representationText === null ? null : deliveryRepresentation(representationText),
                attempts: [],
            };
            ledger.deliveries.push(record);
            return structuredClone(record);
        });
    }

    async fenceDelivery(deliveryId: string, basis: string, fencedAt?: string): Promise<DeliveryRecord> {
        validateOpaque(basis, "delivery fence basis");
        if (fencedAt !== undefined && !isRfc3339Utc(fencedAt))
            throw new ValidationError("delivery fenced_at must be RFC 3339 UTC");
        return this.update((ledger) => {
            const delivery = requireDelivery(ledger, deliveryId);
            if (delivery.send_fence.status === "no_further_send") {
                if (
                    delivery.send_fence.basis !== basis ||
                    (fencedAt !== undefined && delivery.send_fence.fenced_at !== fencedAt)
                )
                    throw new ValidationError("delivery fence replay conflicts with the established fence");
                return structuredClone(delivery);
            }
            delivery.send_fence = { status: "no_further_send", fenced_at: fencedAt ?? nowUtc(), basis };
            return structuredClone(delivery);
        });
    }

    async startDeliveryAttempt(deliveryId: string, attemptedAt = nowUtc()): Promise<DeliveryAttemptRecord> {
        if (!isRfc3339Utc(attemptedAt)) throw new ValidationError("delivery attempted_at must be RFC 3339 UTC");
        return this.update((ledger) => {
            const delivery = requireDelivery(ledger, deliveryId);
            if (delivery.send_fence.status === "no_further_send")
                throw new ValidationError("delivery is fenced against further sends");
            const latest = latestDeliveryAttempt(delivery);
            if (latest?.outcome === "confirmed")
                throw new ValidationError("confirmed delivery cannot be attempted again");
            if (latest?.outcome === "started")
                throw new ValidationError("delivery already has an unresolved started attempt");
            if (latest?.outcome === "uncertain")
                throw new ValidationError("uncertain delivery requires reconciliation before retry");
            if (latest?.outcome === "failed") {
                if (!latest.retryable) throw new ValidationError("failed delivery is not retryable");
                const retryAt = retryAtForAttempt(latest);
                if (retryAt !== null && Date.parse(attemptedAt) < Date.parse(retryAt))
                    throw new ValidationError("delivery retry is not due yet");
            }
            if (
                latest?.observedAt !== null &&
                latest !== null &&
                Date.parse(attemptedAt) < Date.parse(latest.observedAt)
            )
                throw new ValidationError("delivery attempt precedes the previous observation");
            const attempt: DeliveryAttemptRecord = {
                attempt_id: `attempt-${randomUUID()}`,
                attempted_at: attemptedAt,
                observedAt: null,
                outcome: "started",
                retryable: false,
                retry_after_seconds: null,
                external_message_id: null,
            };
            delivery.attempts.push(attempt);
            return structuredClone(attempt);
        });
    }

    async finishDeliveryAttempt(
        attemptId: string,
        outcome: TerminalDeliveryAttemptOutcome,
        {
            externalMessageId = null,
            retryable = false,
            retryAfterSeconds = null,
            observedAt = nowUtc(),
        }: {
            externalMessageId?: string | null;
            retryable?: boolean;
            retryAfterSeconds?: number | null;
            observedAt?: string;
        } = {},
    ): Promise<DeliveryAttemptRecord> {
        validateNullableOpaque(externalMessageId, "delivery external_message_id");
        validateRetryMetadata(outcome, retryable, retryAfterSeconds);
        if (!isRfc3339Utc(observedAt)) throw new ValidationError("delivery observedAt must be RFC 3339 UTC");
        return this.update((ledger) => {
            const attempt = ledger.deliveries
                .flatMap((delivery) => delivery.attempts)
                .find((item) => item.attempt_id === attemptId);
            if (!attempt) throw new ValidationError(`delivery attempt does not exist: ${attemptId}`);
            if (attempt.outcome !== "started") throw new ValidationError("delivery attempt is already terminal");
            if (Date.parse(observedAt) < Date.parse(attempt.attempted_at))
                throw new ValidationError("delivery observation precedes attempt start");
            Object.assign(attempt, {
                observedAt: observedAt,
                outcome,
                retryable,
                retry_after_seconds: retryAfterSeconds,
                external_message_id: externalMessageId,
            });
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
        await replaceFileDurably(this.path, `${JSON.stringify(ledger, null, 2)}\n`, {
            durabilityUncertainMessage:
                "interaction ledger replacement may be visible, but directory synchronization failed",
        });
    }
}
