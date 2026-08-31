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

export interface ProviderErrorOptions extends ErrorOptions {
  outcome?: ProviderOutcome;
  terminationConfirmed?: boolean;
  externalThreadId?: string;
  termination?: ProviderTermination;
}

export class ProviderError extends EmberError {
  readonly outcome: ProviderOutcome;
  readonly terminationConfirmed: boolean;
  readonly externalThreadId: string | null;
  readonly termination: ProviderTermination | null;

  constructor(
    message: string,
    { outcome = "failed", terminationConfirmed = true, externalThreadId, termination, cause }: ProviderErrorOptions = {},
  ) {
    super(message, { cause });
    this.outcome = outcome;
    this.terminationConfirmed = terminationConfirmed;
    this.externalThreadId = externalThreadId ?? null;
    this.termination = termination ?? null;
  }
}
