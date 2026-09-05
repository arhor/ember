import type { Writable } from "node:stream";

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import type { CognitionId, CognitionStatus, EmberState, EvidenceId } from "../core/model.ts";
import type { StateStore } from "../persistence/state-store.ts";
import type { RunCognitionOptions } from "./runtime.ts";

import { DurabilityUncertain, StoreUnavailable, ValidationError } from "../core/errors.ts";
import {
    ASCII_CONTROL_CHARACTER_PATTERN,
    cloneState,
    contentDigest,
    isRfc3339Utc,
    newId,
    nowUtc,
} from "../core/model.ts";
import { findRuntime } from "../core/projection.ts";
import { requirePrincipal } from "../core/semantics.ts";
import { findCognition, runCognition } from "./runtime.ts";

export const PRINCIPAL_ASSERTION_PROVENANCE = ["explicit_local_argument", "configured_surface_mapping"] as const;
export type PrincipalAssertionProvenance = (typeof PRINCIPAL_ASSERTION_PROVENANCE)[number];

const MAX_DELIVERY_REPRESENTATION_BYTES = 1024 * 1024;

export interface ExternalOccurrenceMetadata {
    occurrenceId: string;
    messageId?: string | null;
    threadId?: string | null;
    correlationId?: string | null;
    occurredAt?: string | null;
}

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
}

export interface SurfaceInteractionOptions extends Omit<
    RunCognitionOptions,
    "cognitionId" | "hooks" | "output" | "surface"
> {
    surfaceId: string;
    principalProvenance: PrincipalAssertionProvenance;
    externalOccurrence?: ExternalOccurrenceMetadata | null;
    deliveryDestinationId?: string | null;
    deliver?: SurfaceDelivery;
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

export interface DeliveryRepresentation {
    text: string;
    content_digest: `sha256:${string}`;
}

export interface DeliveryAttemptRecord {
    attempt_id: string;
    attempted_at: string;
    observed_at: string | null;
    outcome: DeliveryAttemptOutcome;
    retryable: boolean;
    retry_after_seconds: number | null;
    external_message_id: string | null;
}

export interface DeliveryRecord {
    delivery_id: string;
    cognition_id: CognitionId;
    expression_evidence_id: EvidenceId;
    surface_id: string;
    destination_id: string | null;
    intended_at: string;
    representation: DeliveryRepresentation | null;
    attempts: DeliveryAttemptRecord[];
}

export interface InteractionLedgerDocument {
    ledger_version: 2;
    inbound_occurrences: InboundOccurrenceRecord[];
    deliveries: DeliveryRecord[];
}

interface LegacyDeliveryAttemptRecord {
    attempt_id: string;
    attempted_at: string;
    outcome: Exclude<TerminalDeliveryAttemptOutcome, "started">;
    external_message_id: string | null;
}

interface LegacyDeliveryRecord {
    delivery_id: string;
    cognition_id: CognitionId;
    expression_evidence_id: EvidenceId;
    surface_id: string;
    destination_id: string | null;
    intended_at: string;
    attempts: LegacyDeliveryAttemptRecord[];
}

interface LegacyInteractionLedgerDocument {
    ledger_version: 1;
    inbound_occurrences: InboundOccurrenceRecord[];
    deliveries: LegacyDeliveryRecord[];
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

export type DeliveryReconciliationStatus =
    | "confirmed"
    | "retry_later"
    | "retryable_failure"
    | "failed_non_retryable"
    | "blocked_uncertain"
    | "blocked_missing_representation";

export interface DeliveryReconciliationResult {
    deliveryId: string;
    status: DeliveryReconciliationStatus;
    attemptId: string | null;
    retryAt: string | null;
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
        if (ledgerVersion(value) === 1) {
            validateLegacyLedger(value);
            return migrateLegacyLedger(value);
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
            representationText,
        }: {
            cognitionId: CognitionId;
            expressionEvidenceId: EvidenceId;
            surfaceId: string;
            destinationId: string | null;
            representationText: string | null;
        },
        intendedAt = nowUtc(),
    ): Promise<DeliveryRecord> {
        validateOpaque(surfaceId, "delivery surface_id", 128);
        validateNullableOpaque(destinationId, "delivery destination_id");
        if (representationText !== null) validateDeliveryRepresentationText(representationText);
        if (!isRfc3339Utc(intendedAt)) throw new ValidationError("delivery intended_at must be RFC 3339 UTC");

        return this.update((ledger) => {
            const existing = ledger.deliveries.find(
                (record) =>
                    record.cognition_id === cognitionId &&
                    record.expression_evidence_id === expressionEvidenceId &&
                    record.surface_id === surfaceId &&
                    record.destination_id === destinationId,
            );
            if (existing) {
                if (representationText !== null) {
                    const representation = deliveryRepresentation(representationText);
                    if (existing.representation === null) existing.representation = representation;
                    else if (existing.representation.content_digest !== representation.content_digest)
                        throw new ValidationError("delivery representation conflicts with the established intent");
                }
                return structuredClone(existing);
            }

            const record: DeliveryRecord = {
                delivery_id: `delivery-${randomUUID()}`,
                cognition_id: cognitionId,
                expression_evidence_id: expressionEvidenceId,
                surface_id: surfaceId,
                destination_id: destinationId,
                intended_at: intendedAt,
                representation: representationText === null ? null : deliveryRepresentation(representationText),
                attempts: [],
            };
            ledger.deliveries.push(record);
            return structuredClone(record);
        });
    }

    async startDeliveryAttempt(deliveryId: string, attemptedAt = nowUtc()): Promise<DeliveryAttemptRecord> {
        if (!isRfc3339Utc(attemptedAt)) throw new ValidationError("delivery attempted_at must be RFC 3339 UTC");
        return this.update((ledger) => {
            const delivery = requireDelivery(ledger, deliveryId);
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
                latest?.observed_at !== null &&
                latest !== null &&
                Date.parse(attemptedAt) < Date.parse(latest.observed_at)
            )
                throw new ValidationError("delivery attempt precedes the previous observation");
            const attempt: DeliveryAttemptRecord = {
                attempt_id: `attempt-${randomUUID()}`,
                attempted_at: attemptedAt,
                observed_at: null,
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
        if (!isRfc3339Utc(observedAt)) throw new ValidationError("delivery observed_at must be RFC 3339 UTC");
        return this.update((ledger) => {
            const attempt = ledger.deliveries
                .flatMap((delivery) => delivery.attempts)
                .find((item) => item.attempt_id === attemptId);
            if (!attempt) throw new ValidationError(`delivery attempt does not exist: ${attemptId}`);
            if (attempt.outcome !== "started") throw new ValidationError("delivery attempt is already terminal");
            if (Date.parse(observedAt) < Date.parse(attempt.attempted_at))
                throw new ValidationError("delivery observation precedes attempt start");
            Object.assign(attempt, {
                observed_at: observedAt,
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
        deliver = process.stdout,
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
                representationText: null,
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
    const deliveryOutput = async (text: string) => {
        if (deliveryId === null) throw new ValidationError("delivery output has no durable delivery intent");
        const attempt = await ledger.startDeliveryAttempt(deliveryId);
        let externalMessageId: string | null = null;
        try {
            externalMessageId = await performSurfaceDelivery(deliver, text);
        } catch (error) {
            const failure = error instanceof SurfaceDeliveryFailure ? error : null;
            try {
                await ledger.finishDeliveryAttempt(attempt.attempt_id, failure?.outcome ?? "uncertain", {
                    externalMessageId: failure?.externalMessageId ?? externalMessageId,
                    retryable: failure?.retryable ?? false,
                    retryAfterSeconds: failure?.retryAfterSeconds ?? null,
                });
            } catch (ledgerError) {
                throw new AggregateError([error, ledgerError], "delivery failed and its outcome could not be recorded");
            }
            throw error;
        }
        await ledger.finishDeliveryAttempt(attempt.attempt_id, "confirmed", { externalMessageId });
    };

    const result = await runCognition(store, accepted.replayed ? current : state, {
        ...cognitionOptions,
        surface: surfaceId,
        cognitionId,
        output: deliveryOutput,
        hooks: {
            afterExpressionCommit: async (committed, outputText) => {
                const cognition = findCognition(committed, cognitionId);
                if (cognition.expression_evidence_id === null)
                    throw new ValidationError("completed cognition is missing expression evidence");
                const intent = await ledger.createDeliveryIntent({
                    cognitionId,
                    expressionEvidenceId: cognition.expression_evidence_id,
                    surfaceId: accepted.record.surface_id,
                    destinationId: accepted.record.delivery_destination_id,
                    representationText: outputText,
                });
                deliveryId = intent.delivery_id;
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
}

export async function reconcileSurfaceDelivery(
    store: StateStore,
    deliveryId: string,
    deliver: SurfaceDelivery,
    { observedAt = nowUtc() }: { observedAt?: string } = {},
): Promise<DeliveryReconciliationResult> {
    if (!isRfc3339Utc(observedAt)) throw new ValidationError("delivery reconciliation time must be RFC 3339 UTC");
    const ledger = new InteractionLedgerStore(store.path);
    let document = await ledger.load();
    let delivery = requireDelivery(document, deliveryId);
    const state = await store.load();
    const cognition = findCognition(state, delivery.cognition_id);
    if (cognition.status !== "completed" || cognition.expression_evidence_id !== delivery.expression_evidence_id)
        throw new ValidationError("delivery does not refer to a completed matching cognition");
    if (cognition.delivery_status === "displayed") {
        return resultFor(delivery, "confirmed", latestDeliveryAttempt(delivery)?.attempt_id ?? null, null);
    }

    let latest = latestDeliveryAttempt(delivery);
    if (latest?.outcome === "started") {
        await ledger.finishDeliveryAttempt(latest.attempt_id, "uncertain", { observedAt });
        return resultFor(delivery, "blocked_uncertain", latest.attempt_id, null);
    }
    if (latest?.outcome === "confirmed") {
        await markCanonicalDeliveryDisplayed(store, delivery.cognition_id);
        return resultFor(delivery, "confirmed", latest.attempt_id, null);
    }
    if (latest?.outcome === "uncertain") {
        return resultFor(delivery, "blocked_uncertain", latest.attempt_id, null);
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
    await markCanonicalDeliveryDisplayed(store, delivery.cognition_id);
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
                content_digest: representation?.content_digest ?? null,
            },
        })),
    };
}

async function performSurfaceDelivery(deliver: SurfaceDelivery, text: string) {
    if (typeof deliver === "function") {
        const receipt = await deliver(text);
        if (receipt === undefined) return null;
        if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt))
            throw new ValidationError("surface delivery receipt must be an object");
        const externalMessageId = receipt.externalMessageId ?? null;
        validateNullableOpaque(externalMessageId, "delivery external_message_id");
        return externalMessageId;
    }
    await writeDeliveryOutput(deliver, text);
    return null;
}

async function writeDeliveryOutput(output: Writable, text: string) {
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

async function markCanonicalDeliveryDisplayed(store: StateStore, cognitionId: CognitionId) {
    const current = await store.load();
    const cognition = findCognition(current, cognitionId);
    if (cognition.delivery_status === "displayed") return current;
    if (cognition.status !== "completed") throw new ValidationError("only completed cognition can reconcile delivery");
    const candidate = cloneState(current);
    findCognition(candidate, cognitionId).delivery_status = "displayed";
    return store.commit(current.revision, candidate);
}

function findDeliveryForCognition(ledger: InteractionLedgerDocument, cognitionId: CognitionId) {
    return ledger.deliveries.find((record) => record.cognition_id === cognitionId) ?? null;
}

function requireDelivery(ledger: InteractionLedgerDocument, deliveryId: string) {
    const delivery = ledger.deliveries.find((record) => record.delivery_id === deliveryId);
    if (!delivery) throw new ValidationError(`delivery does not exist: ${deliveryId}`);
    return delivery;
}

function latestDeliveryAttempt(delivery: DeliveryRecord) {
    return delivery.attempts.at(-1) ?? null;
}

function retryAtForAttempt(attempt: DeliveryAttemptRecord) {
    if (attempt.outcome !== "failed" || !attempt.retryable || attempt.retry_after_seconds === null) return null;
    if (attempt.observed_at === null) throw new ValidationError("retryable terminal delivery is missing observed_at");
    return new Date(Date.parse(attempt.observed_at) + attempt.retry_after_seconds * 1000).toISOString();
}

function resultFor(
    delivery: DeliveryRecord,
    status: DeliveryReconciliationStatus,
    attemptId: string | null,
    retryAt: string | null,
): DeliveryReconciliationResult {
    return { deliveryId: delivery.delivery_id, status, attemptId, retryAt };
}

function emptyLedger(): InteractionLedgerDocument {
    return { ledger_version: 2, inbound_occurrences: [], deliveries: [] };
}

function ledgerVersion(value: unknown) {
    return value !== null && typeof value === "object" && !Array.isArray(value) && "ledger_version" in value
        ? (value as { ledger_version?: unknown }).ledger_version
        : undefined;
}

function migrateLegacyLedger(legacy: LegacyInteractionLedgerDocument): InteractionLedgerDocument {
    return {
        ledger_version: 2,
        inbound_occurrences: structuredClone(legacy.inbound_occurrences),
        deliveries: legacy.deliveries.map((delivery) => ({
            delivery_id: delivery.delivery_id,
            cognition_id: delivery.cognition_id,
            expression_evidence_id: delivery.expression_evidence_id,
            surface_id: delivery.surface_id,
            destination_id: delivery.destination_id,
            intended_at: delivery.intended_at,
            representation: null,
            attempts: delivery.attempts.map((attempt) => ({
                attempt_id: attempt.attempt_id,
                attempted_at: attempt.attempted_at,
                observed_at: attempt.attempted_at,
                outcome: attempt.outcome,
                retryable: false,
                retry_after_seconds: null,
                external_message_id: attempt.external_message_id,
            })),
        })),
    };
}

function deliveryRepresentation(text: string): DeliveryRepresentation {
    validateDeliveryRepresentationText(text);
    return { text, content_digest: contentDigest(text) };
}

function validateDeliveryRepresentationText(text: string) {
    if (typeof text !== "string" || !text.length || Buffer.byteLength(text, "utf8") > MAX_DELIVERY_REPRESENTATION_BYTES)
        throw new ValidationError("delivery representation text is invalid");
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
    if (ledger.ledger_version !== 2) throw new ValidationError("interaction ledger version is unsupported");
    if (!Array.isArray(ledger.inbound_occurrences))
        throw new ValidationError("interaction ledger inbound_occurrences must be a list");
    if (!Array.isArray(ledger.deliveries)) throw new ValidationError("interaction ledger deliveries must be a list");
    validateLedgerRecords(ledger.inbound_occurrences, ledger.deliveries, validateDeliveryRecord);
}

function validateLegacyLedger(value: unknown): asserts value is LegacyInteractionLedgerDocument {
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
    validateLedgerRecords(ledger.inbound_occurrences, ledger.deliveries, validateLegacyDeliveryRecord);
}

function validateLedgerRecords(inbound: unknown[], deliveries: unknown[], validateDelivery: (value: unknown) => void) {
    const occurrenceIds = new Set<string>();
    const cognitionIds = new Set<string>();
    const externalKeys = new Set<string>();
    for (const raw of inbound) {
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
    for (const raw of deliveries) {
        validateDelivery(raw);
        const record = raw as { delivery_id: string; attempts: Array<{ attempt_id: string }> };
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
        "representation",
        "attempts",
    ].sort();
    if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(fields))
        throw new ValidationError("delivery record contains unsupported fields");
    validateDeliveryIdentityFields(record);
    if (record.representation !== null) validateDeliveryRepresentation(record.representation);
    if (!Array.isArray(record.attempts)) throw new ValidationError("delivery attempts must be a list");
    for (const attempt of record.attempts) validateDeliveryAttempt(attempt);
}

function validateLegacyDeliveryRecord(value: unknown) {
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
    validateDeliveryIdentityFields(record);
    if (!Array.isArray(record.attempts)) throw new ValidationError("delivery attempts must be a list");
    for (const attempt of record.attempts) validateLegacyDeliveryAttempt(attempt);
}

function validateDeliveryIdentityFields(record: Record<string, unknown>) {
    if (typeof record.delivery_id !== "string" || !record.delivery_id.startsWith("delivery-"))
        throw new ValidationError("delivery_id is invalid");
    if (typeof record.cognition_id !== "string" || !record.cognition_id.startsWith("cognition-"))
        throw new ValidationError("delivery cognition_id is invalid");
    if (typeof record.expression_evidence_id !== "string" || !record.expression_evidence_id.startsWith("evidence-"))
        throw new ValidationError("delivery expression_evidence_id is invalid");
    validateOpaque(record.surface_id, "delivery surface_id", 128);
    validateNullableOpaque(record.destination_id, "delivery destination_id");
    if (!isRfc3339Utc(record.intended_at)) throw new ValidationError("delivery intended_at is invalid");
}

function validateDeliveryRepresentation(value: unknown) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("delivery representation must be an object");
    const representation = value as Record<string, unknown>;
    if (JSON.stringify(Object.keys(representation).sort()) !== JSON.stringify(["content_digest", "text"]))
        throw new ValidationError("delivery representation contains unsupported fields");
    validateDeliveryRepresentationText(representation.text as string);
    if (representation.content_digest !== contentDigest(representation.text as string))
        throw new ValidationError("delivery representation content_digest does not match text");
}

function validateDeliveryAttempt(value: unknown) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new ValidationError("delivery attempt must be an object");
    const attempt = value as Record<string, unknown>;
    const fields = [
        "attempt_id",
        "attempted_at",
        "observed_at",
        "outcome",
        "retryable",
        "retry_after_seconds",
        "external_message_id",
    ].sort();
    if (JSON.stringify(Object.keys(attempt).sort()) !== JSON.stringify(fields))
        throw new ValidationError("delivery attempt contains unsupported fields");
    if (typeof attempt.attempt_id !== "string" || !attempt.attempt_id.startsWith("attempt-"))
        throw new ValidationError("delivery attempt_id is invalid");
    if (!isRfc3339Utc(attempt.attempted_at)) throw new ValidationError("delivery attempted_at is invalid");
    if (!["started", "confirmed", "failed", "uncertain"].includes(attempt.outcome as string))
        throw new ValidationError("delivery attempt outcome is invalid");
    validateNullableOpaque(attempt.external_message_id, "delivery external_message_id");
    if (attempt.outcome === "started") {
        if (attempt.observed_at !== null || attempt.retryable !== false || attempt.retry_after_seconds !== null)
            throw new ValidationError("started delivery attempt contains terminal metadata");
        if (attempt.external_message_id !== null)
            throw new ValidationError("started delivery attempt cannot have an external message id");
        return;
    }
    if (!isRfc3339Utc(attempt.observed_at)) throw new ValidationError("delivery observed_at is invalid");
    if (Date.parse(attempt.observed_at as string) < Date.parse(attempt.attempted_at as string))
        throw new ValidationError("delivery observation precedes attempt start");
    validateRetryMetadata(
        attempt.outcome as TerminalDeliveryAttemptOutcome,
        attempt.retryable,
        attempt.retry_after_seconds as number | null,
    );
}

function validateLegacyDeliveryAttempt(value: unknown) {
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

function validateRetryMetadata(
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
