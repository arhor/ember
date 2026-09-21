import type {
    ConversationMembershipIntent,
    DeliveryReconciliationResult,
    ExternalOccurrenceMetadata,
    PrincipalAssertionProvenance,
} from "../core/interaction-contract.ts";
import type { CognitionId, CognitionStatus } from "../core/model.ts";

import { ValidationError } from "../core/errors.ts";
import { PRINCIPAL_ASSERTION_PROVENANCE } from "../core/interaction-contract.ts";
import { ASCII_CONTROL_CHARACTER_PATTERN } from "../core/model.ts";
import { isNotBlankString, isObject } from "../util.ts";

// No Telegram/CLI transport object, AI SDK type, filesystem path, or concrete store may appear here; see docs/architecture/canonical-application-flow.md §5.
export interface InteractionEvent {
    kind: "message";
    principal: string;
    principalProvenance: PrincipalAssertionProvenance;
    scope: string;
    surfaceId: string;
    text: string;
    externalOccurrence?: ExternalOccurrenceMetadata;
    deliveryDestinationId?: string;
    conversationMembership?: ConversationMembershipIntent;
}

// delivery is null when initial delivery handling did not run; cognition completion is never inferred from it.
export interface InteractionResult {
    occurrenceId: string;
    cognitionId: CognitionId;
    cognitionStatus: CognitionStatus;
    replayed: boolean;
    deliveryId: string | null;
    delivery: DeliveryReconciliationResult | null;
    diagnostics: {
        providerFailure: string | null;
        memoryProposalFailure: string | null;
        onboardingProgressFailure: string | null;
    };
}

export interface DeliveryAddress {
    principal: string;
    scope: string;
    surfaceId: string;
    destinationId: string | null;
}

export type DeliveryObservation =
    | { outcome: "confirmed"; externalMessageId: string | null }
    | { outcome: "failed"; retryable: boolean; retryAfterSeconds: number | null }
    | { outcome: "uncertain"; externalMessageId: string | null };

export type TransportSend = (
    intent: { deliveryId: string; address: DeliveryAddress; text: string },
    options: { signal?: AbortSignal },
) => Promise<DeliveryObservation>;

export interface EmberApplication {
    interact(
        event: InteractionEvent,
        transport: TransportSend,
        options?: { signal?: AbortSignal },
    ): Promise<InteractionResult>;
    pendingDeliveries(address: DeliveryAddress): Promise<readonly string[]>;
    deliver(
        request: { deliveryId: string; address: DeliveryAddress },
        transport: TransportSend,
        options?: { signal?: AbortSignal },
    ): Promise<DeliveryReconciliationResult>;
}

const REQUIRED_EVENT_FIELDS = ["kind", "principal", "principalProvenance", "scope", "surfaceId", "text"];
const OPTIONAL_EVENT_FIELDS = ["externalOccurrence", "deliveryDestinationId", "conversationMembership"];
const ALLOWED_EVENT_FIELDS = new Set([...REQUIRED_EVENT_FIELDS, ...OPTIONAL_EVENT_FIELDS]);
const MAX_OPAQUE_LENGTH = 512;

function validateOpaque(value: unknown, label: string): asserts value is string {
    if (!isNotBlankString(value)) throw new ValidationError(`${label} must be non-empty`);
    if (value.length > MAX_OPAQUE_LENGTH) throw new ValidationError(`${label} exceeds maximum length`);
    if (ASCII_CONTROL_CHARACTER_PATTERN.test(value)) throw new ValidationError(`${label} contains control characters`);
}

// Shape only — principal authorization and continuity binding are the application coordinator's, not this contract's.
export function validateInteractionEvent(event: unknown): asserts event is InteractionEvent {
    if (!isObject(event)) throw new ValidationError("interaction event must be an object");
    if (!Object.keys(event).every((key) => ALLOWED_EVENT_FIELDS.has(key)))
        throw new ValidationError("interaction event contains unsupported fields");
    if (!REQUIRED_EVENT_FIELDS.every((key) => key in event))
        throw new ValidationError("interaction event is missing required fields");
    if (event.kind !== "message") throw new ValidationError("interaction event kind must be message");
    validateOpaque(event.principal, "interaction event principal");
    if (!PRINCIPAL_ASSERTION_PROVENANCE.includes(event.principalProvenance))
        throw new ValidationError("interaction event principal provenance is invalid");
    validateOpaque(event.scope, "interaction event scope");
    validateOpaque(event.surfaceId, "interaction event surfaceId");
    if (typeof event.text !== "string" || !event.text.trim())
        throw new ValidationError("interaction event text must be non-empty");
    if ("externalOccurrence" in event) {
        if (!isObject(event.externalOccurrence))
            throw new ValidationError("interaction event externalOccurrence must be an object");
        validateOpaque(event.externalOccurrence.occurrenceId, "interaction event externalOccurrence.occurrenceId");
    }
    if ("deliveryDestinationId" in event) {
        if (typeof event.deliveryDestinationId !== "string" || !event.deliveryDestinationId.trim())
            throw new ValidationError("interaction event deliveryDestinationId must be non-empty when present");
    }
    if ("conversationMembership" in event) {
        const membership = event.conversationMembership;
        if (!isObject(membership))
            throw new ValidationError("interaction event conversationMembership must be an object");
        if (membership.action === "continue") {
            if (membership.basis !== "ordinary_adjacency")
                throw new ValidationError("interaction event conversationMembership basis is invalid for continue");
        } else if (membership.action === "fresh") {
            if (membership.basis !== "explicit_boundary" && membership.basis !== "ambiguous_discourse")
                throw new ValidationError("interaction event conversationMembership basis is invalid for fresh");
        } else {
            throw new ValidationError("interaction event conversationMembership action is invalid");
        }
    }
}
