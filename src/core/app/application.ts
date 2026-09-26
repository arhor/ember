import type { EmberApplicationDependencies } from "../composition/ember.ts";
import type { ExternalOccurrenceMetadata, PrincipalAssertionProvenance } from "../interaction-contract.ts";
import type { CognitionId, CognitionStatus, EmberState } from "../model.ts";
import type { InteractionRepositories, SurfaceDelivery } from "../runtime/interaction-boundary.ts";
import type { RunCognitionOptions } from "./cognition-execution.ts";
import type { PreparedCognition } from "./cognition-preparation.ts";
import type {
    DeliveryAddress,
    EmberApplication,
    InteractionEvent,
    InteractionResult,
    TransportSend,
} from "./contract.ts";

import { ValidationError } from "../errors.ts";
import { newId } from "../model.ts";
import { findRuntime } from "../projection.ts";
import { startRuntime, stopRuntime, stopRuntimeAfterFailure } from "../runtime-episode.ts";
import { reconcileSurfaceDelivery, SurfaceDeliveryFailure } from "../runtime/interaction-boundary.ts";
import { requirePrincipal } from "../semantics.ts";
import { executePreparedCognition, findCognition, validateCognitionInvocation } from "./cognition-execution.ts";
import { prepareCognition } from "./cognition-preparation.ts";
import { validateDeliveryObservation, validateInteractionEvent } from "./contract.ts";
import { runPostTurnFollowUps } from "./post-turn.ts";

/** The only production entry point for an ordinary user interaction. */
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
        const expectedContinuity = dependencies.admission.expectedContinuityBinding;
        if (
            expectedContinuity !== undefined &&
            (state.lineage.lineageId !== expectedContinuity.lineageId ||
                state.lineage.establishedAt !== expectedContinuity.establishedAt)
        )
            throw new ValidationError("continuity no longer matches setup binding");
        const started = startRuntime(state, event.principal, event.scope);
        runtimeId = started.runtimeId;
        state = await store.commit(state.revision, started.state);

        const address = addressFor(event);
        const result = await executeInteraction(dependencies.repositories, state, {
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
            ...(event.purpose === undefined ? {} : { purpose: event.purpose }),
            ...(event.explainIds === undefined ? {} : { explainIds: event.explainIds }),
            ...(event.trustedHostSetupAvailable === undefined
                ? {}
                : { trustedHostSetupAvailable: event.trustedHostSetupAvailable }),
            executor: dependencies.cognition.executor,
            ...(dependencies.cognition.selectCapabilities === undefined
                ? {}
                : { selectCapabilities: dependencies.cognition.selectCapabilities }),
            providerLabel: dependencies.cognition.providerLabel,
            timeoutSeconds: dependencies.cognition.timeoutSeconds,
            ...(event.purpose === "explain"
                ? {}
                : {
                      postTurn: (
                          committedState: EmberState,
                          cognitionId: CognitionId,
                          preparation: PreparedCognition,
                      ) =>
                          runPostTurnFollowUps(
                              dependencies.repositories,
                              dependencies.postTurn,
                              committedState,
                              preparation,
                              {
                                  cognitionId,
                                  principal: event.principal,
                                  scope: event.scope,
                                  text: event.text,
                              },
                          ),
                  }),
            ...(options.signal === undefined ? {} : { signal: options.signal }),
            prepareCognition: (currentState, surface) =>
                prepareCognition(dependencies.repositories, currentState, {
                    runtimeId: started.runtimeId,
                    principal: event.principal,
                    scope: event.scope,
                    surface,
                    text: event.text,
                    ...(event.purpose === undefined ? {} : { purpose: event.purpose }),
                    ...(event.explainIds === undefined ? {} : { explainIds: event.explainIds }),
                    ...(event.conversationMembership === undefined
                        ? {}
                        : { conversationMembership: event.conversationMembership }),
                }),
            deliver: async (text) => {
                const deliveryId = await deliveryIdForText(dependencies, resultAddressKey(address), text);
                return observeDelivery(transport, deliveryId, address, text, options.signal);
            },
        });
        stopReason =
            result.providerFailure !== null
                ? "application_provider_failure"
                : result.delivery !== null && result.delivery.status !== "confirmed"
                  ? "application_delivery_failure"
                  : "application_interaction_complete";
        return {
            occurrenceId: result.occurrenceId,
            cognitionId: result.cognitionId,
            cognitionStatus: result.cognitionStatus,
            replayed: result.replayed,
            ...(result.setupIntent === undefined ? {} : { setupIntent: result.setupIntent }),
            deliveryId: result.deliveryId,
            delivery: result.replayed ? null : result.delivery,
            diagnostics: {
                providerFailure: result.providerFailure,
                memoryProposalFailure: result.memoryProposalFailure,
                onboardingProgressFailure: result.onboardingProgressFailure,
            },
        };
    } finally {
        try {
            if (runtimeId !== null) {
                const current = await store.load();
                const runtime = current.operations.runtimeEpisodes.find((item) => item.runtimeId === runtimeId);
                if (runtime?.cleanStopAt === null) {
                    const stop =
                        stopReason === "application_interaction_failed" ? stopRuntimeAfterFailure : stopRuntime;
                    const stopped = stop(current, runtimeId, { reason: stopReason });
                    await store.commit(current.revision, stopped);
                }
            }
        } finally {
            await store.releaseWriteLease(lease);
        }
    }
}

interface InteractionExecutionOptions extends Omit<RunCognitionOptions, "cognitionId" | "surface" | "preparation"> {
    surfaceId: string;
    principalProvenance: PrincipalAssertionProvenance;
    externalOccurrence?: ExternalOccurrenceMetadata | null;
    deliveryDestinationId?: string | null;
    deliver?: SurfaceDelivery;
    prepareCognition?: (state: EmberState, surface: string) => Promise<PreparedCognition>;
    postTurn?: (
        state: EmberState,
        cognitionId: CognitionId,
        preparation: PreparedCognition,
    ) => Promise<{ memoryProposalFailure: string | null; onboardingProgressFailure: string | null }>;
}

interface InteractionExecutionResult {
    state: EmberState;
    providerFailure: string | null;
    memoryProposalFailure: string | null;
    onboardingProgressFailure: string | null;
    cognitionId: CognitionId;
    cognitionStatus: CognitionStatus;
    occurrenceId: string;
    deliveryId: string | null;
    delivery: InteractionResult["delivery"];
    replayed: boolean;
    setupIntent?: "telegram" | null;
}

async function executeInteraction(
    repositories: InteractionRepositories,
    state: EmberState,
    options: InteractionExecutionOptions,
): Promise<InteractionExecutionResult> {
    const store = repositories.state;
    const ledger = repositories.interactions;
    requirePrincipal(state, options.principal);
    findRuntime(state, options.runtimeId);
    const plannedCognitionId = newId("cognition");
    const accepted = await ledger.acceptInbound(
        {
            surfaceId: options.surfaceId,
            principal: options.principal,
            principalProvenance: options.principalProvenance,
            scope: options.scope,
            text: options.text,
            externalOccurrence: options.externalOccurrence ?? null,
            deliveryDestinationId: options.deliveryDestinationId ?? null,
        },
        plannedCognitionId,
    );
    const cognitionId = accepted.record.cognitionId;
    const current = await store.load();
    const existing = current.operations.cognitionEpisodes.find((episode) => episode.cognitionId === cognitionId);
    if (existing) {
        let delivery = (await ledger.load()).deliveries.find((item) => item.cognitionId === cognitionId) ?? null;
        if (delivery === null && existing.status === "completed" && existing.expressionEvidenceId !== null) {
            delivery = await ledger.createDeliveryIntent({
                cognitionId,
                expressionEvidenceId: existing.expressionEvidenceId,
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
            memoryProposalFailure: null,
            onboardingProgressFailure: null,
            cognitionId,
            cognitionStatus: existing.status,
            occurrenceId: accepted.record.occurrence_id,
            deliveryId: delivery?.delivery_id ?? null,
            delivery: null,
            replayed: true,
        };
    }

    const cognitionState = accepted.replayed ? current : state;
    validateCognitionInvocation(cognitionState, {
        runtimeId: options.runtimeId,
        principal: options.principal,
        scope: options.scope,
        surface: options.surfaceId,
        text: options.text,
        providerLabel: options.providerLabel,
        executor: options.executor,
        timeoutSeconds: options.timeoutSeconds,
        cognitionId,
    });
    const preparation = options.prepareCognition
        ? await options.prepareCognition(cognitionState, options.surfaceId)
        : await prepareCognition(repositories, cognitionState, {
              runtimeId: options.runtimeId,
              principal: options.principal,
              scope: options.scope,
              surface: options.surfaceId,
              text: options.text,
              ...(options.purpose === undefined ? {} : { purpose: options.purpose }),
              ...(options.explainIds === undefined ? {} : { explainIds: options.explainIds }),
              ...(options.conversationMembership === undefined
                  ? {}
                  : { conversationMembership: options.conversationMembership }),
          });
    const cognitionOptions = {
        runtimeId: options.runtimeId,
        principal: options.principal,
        scope: options.scope,
        surface: options.surfaceId,
        text: options.text,
        providerLabel: options.providerLabel,
        executor: options.executor,
        ...(options.selectCapabilities === undefined ? {} : { selectCapabilities: options.selectCapabilities }),
        timeoutSeconds: options.timeoutSeconds,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.purpose === undefined ? {} : { purpose: options.purpose }),
        ...(options.explainIds === undefined ? {} : { explainIds: options.explainIds }),
        ...(options.trustedHostSetupAvailable === undefined
            ? {}
            : { trustedHostSetupAvailable: options.trustedHostSetupAvailable }),
        ...(options.conversationMembership === undefined
            ? {}
            : { conversationMembership: options.conversationMembership }),
        cognitionId,
        preparation,
    };
    validateCognitionInvocation(cognitionState, cognitionOptions);
    const committed = await executePreparedCognition(repositories, cognitionState, cognitionOptions);
    let deliveryId: string | null = null;
    let delivery = null;
    let postTurnDiagnostics: { memoryProposalFailure: string | null; onboardingProgressFailure: string | null } = {
        memoryProposalFailure: null,
        onboardingProgressFailure: null,
    };
    if (committed.expressionText !== null) {
        const cognition = findCognition(committed.state, cognitionId);
        if (cognition.expressionEvidenceId === null)
            throw new ValidationError("completed cognition is missing expression evidence");
        const intent = await ledger.createDeliveryIntent({
            cognitionId,
            expressionEvidenceId: cognition.expressionEvidenceId,
            surfaceId: accepted.record.surface_id,
            destinationId: accepted.record.delivery_destination_id,
            representationText: committed.expressionText,
        });
        deliveryId = intent.delivery_id;
        if (options.postTurn !== undefined)
            postTurnDiagnostics = await options.postTurn(committed.state, cognitionId, preparation);
        delivery = await reconcileSurfaceDelivery(repositories, intent.delivery_id, options.deliver ?? process.stdout);
    }
    const latestState = await store.load();
    const cognition = findCognition(latestState, cognitionId);
    return {
        ...committed,
        ...postTurnDiagnostics,
        state: latestState,
        cognitionStatus: cognition.status,
        occurrenceId: accepted.record.occurrence_id,
        deliveryId,
        delivery,
        replayed: accepted.replayed,
    };
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
                record.origin.kind === "ordinary_cognition" &&
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
        return await reconcileSurfaceDelivery(dependencies.repositories, deliveryId, async (text) =>
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
    validateDeliveryObservation(observation);
    if (observation.outcome === "confirmed") return { externalMessageId: observation.externalMessageId };
    throw new SurfaceDeliveryFailure(`transport reported ${observation.outcome} delivery`, {
        outcome: observation.outcome,
        externalMessageId: observation.externalMessageId,
        retryable: observation.outcome === "failed" ? observation.retryable : false,
        retryAfterSeconds: observation.outcome === "failed" ? observation.retryAfterSeconds : null,
    });
}
