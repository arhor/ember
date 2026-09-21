import type { EmberApplicationDependencies } from "../composition/ember.ts";
import type { DeliveryReconciliationResult } from "../core/interaction-contract.ts";
import type {
    DeliveryAddress,
    EmberApplication,
    InteractionEvent,
    InteractionResult,
    TransportSend,
} from "./contract.ts";

import { ValidationError } from "../core/errors.ts";
import {
    reconcileSurfaceDelivery,
    runSurfaceInteraction,
    SurfaceDeliveryFailure,
} from "../runtime/interaction-boundary.ts";
import { startRuntime, stopRuntime } from "../runtime/runtime.ts";
import { validateInteractionEvent } from "./contract.ts";

/**
 * The transport-neutral ordinary-interaction facade. During the strangler migration it
 * deliberately delegates to the existing interaction boundary so that occurrence,
 * cognition, post-turn, and delivery semantics continue to have one implementation.
 */
export function createEmberApplication(dependencies: EmberApplicationDependencies): EmberApplication {
    return {
        interact: (event, transport, options) => interact(dependencies, event, transport, options),
        pendingDeliveries: (address) => pendingDeliveries(dependencies, address),
        deliver: (request, transport, options) =>
            deliver(dependencies, request.deliveryId, request.address, transport, options),
    };
}

async function interact(
    dependencies: EmberApplicationDependencies,
    event: InteractionEvent,
    transport: TransportSend,
    options: { signal?: AbortSignal } = {},
): Promise<InteractionResult> {
    validateInteractionEvent(event);
    const store = dependencies.repositories.state;
    const lease = await store.acquireWriteLease();
    let runtimeId: ReturnType<typeof startRuntime>["runtimeId"] | null = null;
    let stopReason = "application_interaction_failed";
    try {
        let state = await store.load();
        const started = startRuntime(state, event.principal, event.scope);
        runtimeId = started.runtimeId;
        state = await store.commit(state.revision, started.state);

        const onboarding = await dependencies.repositories.onboarding.load();
        const onboardingActive = onboarding?.status === "active" && onboarding.scope === event.scope;
        const address = addressFor(event);
        const result = await runSurfaceInteraction(store, state, {
            runtimeId,
            principal: event.principal,
            scope: event.scope,
            text: event.text,
            surfaceId: event.surfaceId,
            principalProvenance: event.principalProvenance,
            ...(event.externalOccurrence === undefined ? {} : { externalOccurrence: event.externalOccurrence }),
            ...(event.deliveryDestinationId === undefined
                ? {}
                : { deliveryDestinationId: event.deliveryDestinationId }),
            ...(event.conversationMembership === undefined
                ? {}
                : { conversationMembership: event.conversationMembership }),
            provider: dependencies.cognition.provider,
            providerLabel: dependencies.cognition.providerLabel,
            timeoutSeconds: dependencies.cognition.timeoutSeconds,
            ...(onboardingActive && dependencies.postTurn.memoryProposalGenerator !== undefined
                ? { memoryProposalGenerator: dependencies.postTurn.memoryProposalGenerator }
                : {}),
            ...(onboardingActive && dependencies.postTurn.onboardingProgressEvaluator !== undefined
                ? { onboardingProgressEvaluator: dependencies.postTurn.onboardingProgressEvaluator }
                : {}),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
            deliver: async (text) => {
                const deliveryId = await deliveryIdForText(dependencies, resultAddressKey(address), text);
                return observeDelivery(transport, deliveryId, address, text, options.signal);
            },
        });
        stopReason =
            result.providerFailure === null ? "application_interaction_complete" : "application_provider_failure";
        return {
            occurrenceId: result.occurrenceId,
            cognitionId: result.cognitionId,
            cognitionStatus: result.cognitionStatus,
            replayed: result.replayed,
            deliveryId: result.deliveryId,
            delivery:
                result.replayed || result.deliveryId === null
                    ? null
                    : await deliveryResult(dependencies, result.deliveryId),
            diagnostics: {
                providerFailure: result.providerFailure,
                memoryProposalFailure: result.memoryProposalFailure,
                onboardingProgressFailure: result.onboardingProgressFailure,
            },
        };
    } finally {
        if (runtimeId !== null) {
            const current = await store.load();
            const runtime = current.operations.runtimeEpisodes.find((item) => item.runtimeId === runtimeId);
            if (runtime?.cleanStopAt === null)
                await store.commit(current.revision, stopRuntime(current, runtimeId, { reason: stopReason }));
        }
        await store.releaseWriteLease(lease);
    }
}

async function pendingDeliveries(dependencies: EmberApplicationDependencies, address: DeliveryAddress) {
    const ledger = await dependencies.repositories.interactions.load();
    const occurrenceCognitionIds = new Set(
        ledger.inbound_occurrences
            .filter(
                (record) =>
                    record.assertedPrincipal === address.principal &&
                    record.scope === address.scope &&
                    record.surface_id === address.surfaceId &&
                    record.delivery_destination_id === address.destinationId,
            )
            .map((record) => record.cognitionId),
    );
    return ledger.deliveries
        .filter(
            (record) =>
                occurrenceCognitionIds.has(record.cognitionId) &&
                record.surface_id === address.surfaceId &&
                record.destination_id === address.destinationId &&
                record.send_fence.status === "open" &&
                record.attempts.at(-1)?.outcome !== "confirmed",
        )
        .map((record) => record.delivery_id);
}

async function deliver(
    dependencies: EmberApplicationDependencies,
    deliveryId: string,
    address: DeliveryAddress,
    transport: TransportSend,
    options: { signal?: AbortSignal } = {},
) {
    const pending = await pendingDeliveries(dependencies, address);
    if (!pending.includes(deliveryId))
        throw new ValidationError("delivery does not match the supplied address or is not pending");
    const store = dependencies.repositories.state;
    const lease = await store.acquireWriteLease();
    try {
        return await reconcileSurfaceDelivery(store, deliveryId, async (text) =>
            observeDelivery(transport, deliveryId, address, text, options.signal),
        );
    } finally {
        await store.releaseWriteLease(lease);
    }
}

function addressFor(event: InteractionEvent): DeliveryAddress {
    return {
        principal: event.principal,
        scope: event.scope,
        surfaceId: event.surfaceId,
        destinationId: event.deliveryDestinationId ?? null,
    };
}

function resultAddressKey(address: DeliveryAddress) {
    return `${address.surfaceId}\u0000${address.destinationId ?? ""}`;
}

async function deliveryIdForText(
    dependencies: EmberApplicationDependencies,
    addressKey: string,
    text: string,
): Promise<string> {
    const ledger = await dependencies.repositories.interactions.load();
    const delivery = ledger.deliveries.findLast(
        (record) =>
            resultAddressKey({
                principal: "",
                scope: "",
                surfaceId: record.surface_id,
                destinationId: record.destination_id,
            }) === addressKey &&
            record.representation?.text === text &&
            record.attempts.at(-1)?.outcome === "started",
    );
    if (!delivery) throw new ValidationError("delivery callback has no matching durable intent");
    return delivery.delivery_id;
}

async function observeDelivery(
    transport: TransportSend,
    deliveryId: string,
    address: DeliveryAddress,
    text: string,
    signal?: AbortSignal,
) {
    const observation = await transport({ deliveryId, address, text }, signal === undefined ? {} : { signal });
    if (observation.outcome === "confirmed") return { externalMessageId: observation.externalMessageId };
    throw new SurfaceDeliveryFailure(`transport reported ${observation.outcome} delivery`, {
        outcome: observation.outcome,
        externalMessageId: observation.externalMessageId,
        retryable: observation.outcome === "failed" ? observation.retryable : false,
        retryAfterSeconds: observation.outcome === "failed" ? observation.retryAfterSeconds : null,
    });
}

async function deliveryResult(
    dependencies: EmberApplicationDependencies,
    deliveryId: string,
): Promise<DeliveryReconciliationResult> {
    const ledger = await dependencies.repositories.interactions.load();
    const delivery = ledger.deliveries.find((record) => record.delivery_id === deliveryId);
    if (!delivery) throw new ValidationError(`delivery does not exist: ${deliveryId}`);
    const attempt = delivery.attempts.at(-1);
    if (!attempt) throw new ValidationError("initial delivery handling did not record an attempt");
    if (attempt.outcome === "confirmed")
        return { deliveryId, status: "confirmed", attemptId: attempt.attempt_id, retryAt: null };
    if (attempt.outcome === "uncertain")
        return { deliveryId, status: "blocked_uncertain", attemptId: attempt.attempt_id, retryAt: null };
    if (attempt.outcome === "failed" && !attempt.retryable)
        return { deliveryId, status: "failed_non_retryable", attemptId: attempt.attempt_id, retryAt: null };
    const retryAt =
        attempt.outcome === "failed" && attempt.observedAt !== null && attempt.retry_after_seconds !== null
            ? new Date(Date.parse(attempt.observedAt) + attempt.retry_after_seconds * 1000).toISOString()
            : null;
    return { deliveryId, status: "retryable_failure", attemptId: attempt.attempt_id, retryAt };
}
