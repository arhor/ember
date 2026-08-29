"""Typed failures exposed by the continuity slice."""


class EmberError(Exception):
    """Base class for expected, truthfully reportable slice failures."""


class ValidationError(EmberError):
    """Canonical state violates schema-v1 semantic invariants."""


class StoreUnavailable(EmberError):
    """The canonical continuity document cannot be loaded."""


class StoreExists(EmberError):
    """Initialization would overwrite an existing lineage."""


class StaleRevision(EmberError):
    """A candidate state was derived from a non-current revision."""


class DurabilityUncertain(EmberError):
    """Replacement may be visible, but directory synchronization failed."""


class ConcurrentWriter(EmberError):
    """Another cooperating writer owns the store lock."""


class ProviderError(EmberError):
    """A one-shot cognition provider failed its wire contract."""

    def __init__(self, message: str, *, outcome: str = "failed") -> None:
        super().__init__(message)
        self.outcome = outcome
