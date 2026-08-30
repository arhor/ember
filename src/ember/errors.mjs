export class EmberError extends Error {
  constructor(message, options = {}) { super(message, options); this.name = this.constructor.name; }
}
export class ValidationError extends EmberError {}
export class StoreUnavailable extends EmberError {}
export class StoreExists extends EmberError {}
export class StaleRevision extends EmberError {}
export class DurabilityUncertain extends EmberError {
  constructor(message, options = {}) { super(message, options); this.replacementMayBeVisible = true; }
}
export class ConcurrentWriter extends EmberError {
  constructor(message, options = {}) { super(message, options); this.diagnosis = options.diagnosis; }
}
export class ProviderError extends EmberError {
  constructor(message, { outcome = "failed", terminationConfirmed = true, cause } = {}) {
    super(message, { cause }); this.outcome = outcome; this.terminationConfirmed = terminationConfirmed;
  }
}
