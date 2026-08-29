"""Foreground lifecycle, reconciliation, cognition, and delivery transitions."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Sequence, TextIO

from ember.errors import ProviderError, StaleRevision, ValidationError
from ember.model import new_id, now_utc, validate_state
from ember.projection import build_projection
from ember.provider import CONTRACT_VERSION, invoke_provider, provider_label
from ember.semantics import user_evidence
from ember.store import StateStore


def start_runtime(
    state: dict[str, Any], principal: str, scope: str, *, timestamp: str | None = None
) -> tuple[dict[str, Any], str]:
    _require_principal(state, principal)
    if not scope.strip():
        raise ValidationError("active scope must be non-empty")
    timestamp = timestamp or now_utc()
    candidate = deepcopy(state)
    previous = _latest_runtime(candidate)
    if previous is None:
        recovery = {
            "previous_runtime": None,
            "current_runtime": None,
            "gap_kind": "initial_start",
            "last_durable_observation_at": None,
            "clean_stop_at": None,
            "restart_at": timestamp,
            "ember_cognition_during_interval": "not_applicable",
            "external_changes_during_interval": "unknown",
        }
    elif previous["clean_stop_at"] is not None:
        recovery = {
            "previous_runtime": previous["runtime_id"],
            "current_runtime": None,
            "gap_kind": "known_clean_stop_interval",
            "last_durable_observation_at": previous["last_durable_observation_at"],
            "clean_stop_at": previous["clean_stop_at"],
            "restart_at": timestamp,
            "ember_cognition_during_interval": "none_in_supported_runtime",
            "external_changes_during_interval": "unknown",
        }
    else:
        recovery = {
            "previous_runtime": previous["runtime_id"],
            "current_runtime": None,
            "gap_kind": "uncertain_interruption_boundary",
            "last_durable_observation_at": previous["last_durable_observation_at"],
            "clean_stop_at": None,
            "restart_at": timestamp,
            "ember_cognition_during_interval": "unknown_after_last_durable_observation",
            "external_changes_during_interval": "unknown",
        }
        for cognition in candidate["operations"]["cognition_episodes"]:
            if cognition["runtime_id"] == previous["runtime_id"] and cognition["status"] == "started":
                cognition["status"] = "outcome_unknown"
    runtime_id = new_id("runtime")
    recovery["current_runtime"] = runtime_id
    candidate["operations"]["runtime_episodes"].append(
        {
            "runtime_id": runtime_id,
            "principal": principal,
            "active_scope": scope,
            "started_at": timestamp,
            "last_durable_observation_at": timestamp,
            "clean_stop_at": None,
            "stop_reason": None,
            "recovery_account": recovery,
        }
    )
    validate_state(candidate)
    return candidate, runtime_id


def stop_runtime(
    state: dict[str, Any], runtime_id: str, *, reason: str, timestamp: str | None = None
) -> dict[str, Any]:
    timestamp = timestamp or now_utc()
    candidate = deepcopy(state)
    runtime = _find_runtime(candidate, runtime_id)
    if runtime["clean_stop_at"] is not None:
        raise ValidationError("runtime is already stopped")
    runtime["last_durable_observation_at"] = timestamp
    runtime["clean_stop_at"] = timestamp
    runtime["stop_reason"] = reason
    validate_state(candidate)
    return candidate


def run_cognition(
    store: StateStore,
    state: dict[str, Any],
    *,
    runtime_id: str,
    principal: str,
    scope: str,
    text: str,
    command: str,
    arguments: Sequence[str],
    timeout_seconds: float,
    output: TextIO,
    purpose: str = "ordinary",
    explain_ids: Sequence[str] = (),
) -> tuple[dict[str, Any], str | None]:
    """Perform one provider episode, retaining semantics but never reply bytes."""
    _require_principal(state, principal)
    timestamp = now_utc()
    projection = build_projection(
        state,
        principal=principal,
        scope=scope,
        current_input=text,
        current_time=timestamp,
        runtime_id=runtime_id,
        purpose=purpose,
        explain_ids=explain_ids,
    )
    cognition_id = new_id("cognition")
    label = provider_label(command)
    started = deepcopy(state)
    input_occurrence = user_evidence(started, principal, scope, text, timestamp=timestamp)
    _find_runtime(started, runtime_id)["last_durable_observation_at"] = timestamp
    started["operations"]["cognition_episodes"].append(
        {
            "cognition_id": cognition_id,
            "runtime_id": runtime_id,
            "principal": principal,
            "active_scope": scope,
            "provider_label": label,
            "purpose": purpose,
            "started_at": timestamp,
            "last_durable_observation_at": timestamp,
            "status": "started",
            "selected_meaning_ids": projection["selection"]["meaning_ids"],
            "selected_evidence_ids": projection["selection"]["evidence_ids"],
            "used_meaning_ids": [],
            "input_evidence_id": input_occurrence["evidence_id"],
            "expression_evidence_id": None,
            "delivery_status": "not_attempted",
        }
    )
    state = store.commit(state["revision"], started)
    request = {
        "contract_version": CONTRACT_VERSION,
        "cognition_id": cognition_id,
        "projection": projection,
        "input": {"text": text},
    }
    try:
        result = invoke_provider(command, arguments, request, timeout_seconds=timeout_seconds)
    except ProviderError as error:
        current = store.load()
        if current["revision"] != state["revision"]:
            raise StaleRevision("canonical revision changed during provider failure") from error
        failed = deepcopy(current)
        cognition = _find_cognition(failed, cognition_id)
        cognition["status"] = error.outcome
        cognition["last_durable_observation_at"] = now_utc()
        _find_runtime(failed, runtime_id)["last_durable_observation_at"] = cognition["last_durable_observation_at"]
        state = store.commit(current["revision"], failed)
        return state, str(error)

    current = store.load()
    if current["revision"] != state["revision"]:
        raise StaleRevision("canonical revision changed during provider call")
    completed = deepcopy(current)
    cognition = _find_cognition(completed, cognition_id)
    expression_id = new_id("evidence")
    completed_at = now_utc()
    completed["evidence"].append(
        {
            "evidence_id": expression_id,
            "source_role": "ember_expression_via_provider",
            "source_actor": "ember",
            "asserted_principal": principal,
            "occurred_at": completed_at,
            "observed_at": completed_at,
            "derived_from_evidence_ids": [],
            "scope": scope,
            "payload_mode": "descriptor_only",
            "cognition_id": cognition_id,
            "provider_label": label,
        }
    )
    cognition["status"] = "completed"
    cognition["last_durable_observation_at"] = completed_at
    cognition["used_meaning_ids"] = result["used_meaning_ids"]
    cognition["expression_evidence_id"] = expression_id
    cognition["delivery_status"] = "pending"
    _find_runtime(completed, runtime_id)["last_durable_observation_at"] = completed_at
    state = store.commit(current["revision"], completed)

    output.write(result["reply"] + "\n")
    output.flush()
    displayed = deepcopy(state)
    cognition = _find_cognition(displayed, cognition_id)
    cognition["delivery_status"] = "displayed"
    cognition["last_durable_observation_at"] = now_utc()
    _find_runtime(displayed, runtime_id)["last_durable_observation_at"] = cognition["last_durable_observation_at"]
    state = store.commit(state["revision"], displayed)
    return state, None


def _require_principal(state: dict[str, Any], principal: str) -> None:
    if principal != state["runtime_contract"]["local_principal"]:
        raise ValidationError("asserted principal does not match initialized local principal")


def _find_runtime(state: dict[str, Any], runtime_id: str) -> dict[str, Any]:
    for runtime in state["operations"]["runtime_episodes"]:
        if runtime["runtime_id"] == runtime_id:
            return runtime
    raise ValidationError(f"runtime does not exist: {runtime_id}")


def _find_cognition(state: dict[str, Any], cognition_id: str) -> dict[str, Any]:
    for cognition in state["operations"]["cognition_episodes"]:
        if cognition["cognition_id"] == cognition_id:
            return cognition
    raise ValidationError(f"cognition does not exist: {cognition_id}")


def _latest_runtime(state: dict[str, Any]) -> dict[str, Any] | None:
    runtimes = state["operations"]["runtime_episodes"]
    if not runtimes:
        return None
    referenced = {
        runtime["recovery_account"]["previous_runtime"]
        for runtime in runtimes
        if runtime["recovery_account"]["previous_runtime"] is not None
    }
    tails = [runtime for runtime in runtimes if runtime["runtime_id"] not in referenced]
    if len(tails) != 1:
        raise ValidationError("runtime recovery chain has no unique current tail")
    return tails[0]
