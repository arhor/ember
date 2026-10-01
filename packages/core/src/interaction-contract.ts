export const PRINCIPAL_ASSERTION_PROVENANCE = ["explicit_local_argument", "configured_surface_mapping"] as const;
export type PrincipalAssertionProvenance = (typeof PRINCIPAL_ASSERTION_PROVENANCE)[number];

export interface ExternalOccurrenceMetadata {
    occurrenceId: string;
    messageId?: string | null;
    threadId?: string | null;
    correlationId?: string | null;
    occurredAt?: string | null;
}

export type ConversationMembershipIntent =
    | { action: "continue"; basis: "ordinary_adjacency" }
    | { action: "fresh"; basis: "explicit_boundary" | "ambiguous_discourse" };

export type DeliveryReconciliationStatus =
    | "confirmed"
    | "retry_later"
    | "retryable_failure"
    | "failed_non_retryable"
    | "blocked_uncertain"
    | "blocked_missing_representation"
    | "withdrawn";

export interface DeliveryReconciliationResult {
    deliveryId: string;
    status: DeliveryReconciliationStatus;
    attemptId: string | null;
    retryAt: string | null;
}
