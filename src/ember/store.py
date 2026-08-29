"""Single-writer JSON persistence with validation and honest durability limits."""

from __future__ import annotations

from contextlib import contextmanager
from copy import deepcopy
import errno
import fcntl
import json
import os
from pathlib import Path
import tempfile
from typing import Any, Iterator

from ember.errors import (
    ConcurrentWriter,
    DurabilityUncertain,
    StaleRevision,
    StoreExists,
    StoreUnavailable,
)
from ember.model import validate_state


class StateStore:
    """Persistence boundary for one canonical continuity document."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.lock_path = self.path.with_name(self.path.name + ".lock")
        self._lock_file = None

    def create(self, state: dict[str, Any]) -> None:
        validate_state(state)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.writer():
            if self.path.exists():
                raise StoreExists(f"continuity store already exists: {self.path}")
            self._replace_document(state)

    def load(self) -> dict[str, Any]:
        try:
            raw = self.path.read_text(encoding="utf-8")
        except FileNotFoundError as error:
            raise StoreUnavailable(f"continuity store is unavailable: {self.path}") from error
        except OSError as error:
            raise StoreUnavailable(f"cannot read continuity store {self.path}: {error}") from error
        try:
            state = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise StoreUnavailable(f"continuity store is not complete valid UTF-8 JSON: {error}") from error
        validate_state(state)
        return state

    def commit(self, expected_revision: int, candidate: dict[str, Any]) -> dict[str, Any]:
        if self._lock_file is None:
            raise ConcurrentWriter("commit requires the cooperating writer lock")
        current = self.load()
        if current["revision"] != expected_revision:
            raise StaleRevision(
                f"expected revision {expected_revision}, found {current['revision']}"
            )
        committed = deepcopy(candidate)
        committed["revision"] = expected_revision + 1
        validate_state(committed)
        self._replace_document(committed)
        return committed

    @contextmanager
    def writer(self) -> Iterator[None]:
        if self._lock_file is not None:
            yield
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        lock_file = self.lock_path.open("a+b")
        try:
            try:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError as error:
                if error.errno in {errno.EACCES, errno.EAGAIN}:
                    raise ConcurrentWriter(f"another Ember writer owns {self.lock_path}") from error
                raise
            self._lock_file = lock_file
            yield
        finally:
            if self._lock_file is lock_file:
                self._lock_file = None
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
            lock_file.close()

    def _replace_document(self, state: dict[str, Any]) -> None:
        payload = json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        descriptor = None
        temp_path: Path | None = None
        try:
            descriptor, temp_name = tempfile.mkstemp(
                prefix=f".{self.path.name}.", suffix=".tmp", dir=self.path.parent
            )
            temp_path = Path(temp_name)
            with os.fdopen(descriptor, "w", encoding="utf-8") as output:
                descriptor = None
                output.write(payload)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temp_path, self.path)
            temp_path = None
            try:
                directory_fd = os.open(self.path.parent, os.O_RDONLY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
            except OSError as error:
                raise DurabilityUncertain(
                    "canonical replacement may be visible, but directory synchronization failed; "
                    "reload and validate the path before making a durability claim"
                ) from error
        finally:
            if descriptor is not None:
                os.close(descriptor)
            if temp_path is not None:
                try:
                    temp_path.unlink()
                except FileNotFoundError:
                    pass
