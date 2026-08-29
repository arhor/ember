from __future__ import annotations

from contextlib import contextmanager
from copy import deepcopy
import io
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from typing import Iterator, Sequence

from ember.model import initial_state
from ember.semantics import (
    attach_detail,
    remember_episode,
    remember_fact,
    remember_preference,
    remember_relationship,
    undertake,
)


PRINCIPAL = "user-1"
SCOPE = "project:ember/docs"
RELATIONSHIP_SCOPE = "relationship:user-1"
ROOT = Path(__file__).resolve().parents[1]
PROVIDER = ROOT / "tests" / "fixtures" / "scripted_provider.py"


def populated_state():
    state = initial_state("Ember", PRINCIPAL, "2026-08-29T10:00:00Z")
    relationship_id = remember_relationship(
        state, PRINCIPAL, "relationship:user-1", RELATIONSHIP_SCOPE, "Continuing collaborators"
    )
    fact_id = remember_fact(
        state,
        PRINCIPAL,
        "user:user-1",
        "home-server",
        RELATIONSHIP_SCOPE,
        "Home server is a Raspberry Pi 5",
    )
    preference_id = remember_preference(
        state,
        PRINCIPAL,
        "user:user-1",
        "docs-rationale-detail",
        SCOPE,
        "Prefer concise architectural rationale",
    )
    commitment_id = undertake(
        state,
        PRINCIPAL,
        "restart-provenance-check",
        SCOPE,
        "Check restart reconstruction preserves provenance without transcript replay",
    )
    episode_id = remember_episode(
        state,
        PRINCIPAL,
        "first-continuity-experiment",
        "relationship:user-1",
        RELATIONSHIP_SCOPE,
        "The first continuity experiment received a nickname",
    )
    detail_id = attach_detail(state, PRINCIPAL, episode_id, "Cinder")
    return state, {
        "relationship": relationship_id,
        "fact": fact_id,
        "preference": preference_id,
        "commitment": commitment_id,
        "episode": episode_id,
        "detail": detail_id,
    }


def command(arguments: Sequence[str], *, stdin: str = "", now: str = "2026-08-29T10:00:00Z", fixture_faults: bool = False):
    environment = os.environ.copy()
    environment["PYTHONPATH"] = str(ROOT / "src")
    environment["EMBER_TEST_NOW"] = now
    if fixture_faults:
        environment["EMBER_ENABLE_FIXTURE_FAULTS"] = "1"
    return subprocess.run(
        [sys.executable, "-m", "ember", *arguments],
        input=stdin,
        text=True,
        capture_output=True,
        cwd=ROOT,
        env=environment,
        check=False,
    )
