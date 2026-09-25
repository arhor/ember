export class EmberError extends Error {
    constructor(message: string, options: ErrorOptions = {}) {
        super(message, options);
        this.name = this.constructor.name;
    }
}

export class ValidationError extends EmberError {}
export class StoreUnavailable extends EmberError {}
export class StoreExists extends EmberError {}
export class StaleRevision extends EmberError {}

export interface PartialPublicationOptions extends ErrorOptions {
    publishedArtifacts: string[];
    failedArtifact: string;
}

export class PartialPublication extends EmberError {
    readonly publishedArtifacts: string[];
    readonly failedArtifact: string;

    constructor(message: string, { publishedArtifacts, failedArtifact, cause }: PartialPublicationOptions) {
        super(message, { cause });
        this.publishedArtifacts = publishedArtifacts;
        this.failedArtifact = failedArtifact;
    }
}

export class DurabilityUncertain extends EmberError {
    readonly replacementMayBeVisible = true;
}

export interface ConcurrentWriterOptions extends ErrorOptions {
    diagnosis?: unknown;
}

export class ConcurrentWriter extends EmberError {
    readonly diagnosis: unknown;

    constructor(message: string, options: ConcurrentWriterOptions = {}) {
        super(message, options);
        this.diagnosis = options.diagnosis;
    }
}

export type ProviderOutcome = "failed" | "timed_out" | "cancellation_requested" | "outcome_unknown";
export type ProviderTerminationReason = "timeout" | "explicit_cancellation" | "output_limit";

export interface ProviderTermination {
    reason: ProviderTerminationReason;
    directChildExitObserved: boolean;
}

/** A closed classification of why an AI SDK invocation failed; safe to log unredacted. */
export type ProviderFailureCategory =
    | "cancellation"
    | "timeout"
    | "provider_api"
    | "retry_exhausted"
    | "invalid_output"
    | "invalid_tool_call"
    | "unknown";

export interface ProviderErrorOptions extends ErrorOptions {
    outcome?: ProviderOutcome | undefined;
    terminationConfirmed?: boolean | undefined;
    externalThreadId?: string | undefined;
    termination?: ProviderTermination | undefined;
    statusCode?: number | undefined;
    category?: ProviderFailureCategory | undefined;
}

export class ProviderError extends EmberError {
    readonly outcome: ProviderOutcome;
    readonly terminationConfirmed: boolean;
    readonly externalThreadId: string | null;
    readonly termination: ProviderTermination | null;
    readonly statusCode: number | null;
    readonly category: ProviderFailureCategory | null;

    constructor(
        message: string,
        {
            outcome = "failed",
            terminationConfirmed = true,
            externalThreadId,
            termination,
            statusCode,
            category,
            cause,
        }: ProviderErrorOptions = {},
    ) {
        super(message, { cause });
        this.outcome = outcome;
        this.terminationConfirmed = terminationConfirmed;
        this.externalThreadId = externalThreadId ?? null;
        this.termination = termination ?? null;
        this.statusCode = statusCode ?? null;
        this.category = category ?? null;
    }
}
