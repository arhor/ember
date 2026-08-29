"""Deterministic least-sufficient projections and semantic inspection views."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Iterable

from ember.errors import ValidationError
from ember.model import validate_state
from ember.semantics import find_meaning


def build_projection(
    state: dict[str, Any],
    *,
    principal: str,
    scope: str,
    current_input: str,
    current_time: str,
    runtime_id: str,
    purpose: str = "ordinary",
    explain_ids: Iterable[str] = (),
) -> dict[str, Any]:
    validate_state(state)
    if principal != state["runtime_contract"]["local_principal"]:
        raise ValidationError("projection principal does not match runtime contract")
    if purpose not in {"ordinary", "explain"}:
        raise ValidationError("projection purpose must be ordinary or explain")
    runtime = _find_runtime(state, runtime_id)
    selected: dict[str, dict[str, Any]] = {}
    explicit = list(dict.fromkeys(explain_ids))

    for meaning in state["meanings"]:
        if meaning["kind"] == "relationship" and meaning["owner"] == f"relationship:{principal}":
            selected[meaning["meaning_id"]] = meaning
        elif (
            meaning["kind"] in {"fact", "preference"}
            and meaning["currentness"] == "current"
            and meaning["scope"] == scope
        ):
            selected[meaning["meaning_id"]] = meaning
        elif (
            meaning["kind"] == "commitment"
            and meaning["prospective_lifecycle"] == "live"
            and meaning["scope"] == scope
        ):
            selected[meaning["meaning_id"]] = meaning

    if purpose == "explain":
        for meaning_id in explicit:
            meaning = find_meaning(state, meaning_id)
            selected[meaning_id] = meaning
            for linked in (meaning.get("supersedes"), meaning.get("superseded_by")):
                if linked:
                    selected[linked] = find_meaning(state, linked)

    evidence_by_id = {item["evidence_id"]: item for item in state["evidence"]}
    selected_evidence: dict[str, dict[str, Any]] = {}
    gaps: list[dict[str, Any]] = []
    projected_meanings: list[dict[str, Any]] = []
    for meaning in selected.values():
        item = deepcopy(meaning)
        if meaning["kind"] == "commitment" and meaning["prospective_lifecycle"] == "live":
            item["applicability"] = (
                "current_live"
                if runtime["recovery_account"]["gap_kind"] == "initial_start"
                else "last_known_live_needs_currentness_check"
            )
        descriptors = []
        for evidence_id in meaning["source_evidence_ids"]:
            evidence = evidence_by_id[evidence_id]
            descriptor = _evidence_projection(evidence, include_payload=purpose == "explain")
            descriptors.append(descriptor)
            selected_evidence[evidence_id] = evidence
            for parent_id in evidence.get("derived_from_evidence_ids", []):
                parent = evidence_by_id[parent_id]
                selected_evidence[parent_id] = parent
                descriptors.append(_evidence_projection(parent, include_payload=purpose == "explain"))
        item["source_evidence"] = descriptors
        projected_meanings.append(item)

        if purpose == "explain" and meaning["meaning_id"] in explicit:
            for evidence in state["evidence"]:
                if evidence.get("related_meaning_id") != meaning["meaning_id"]:
                    continue
                selected_evidence[evidence["evidence_id"]] = evidence
                if evidence.get("payload_mode") == "retained_optional" and evidence.get("availability") == "unavailable":
                    gaps.append(
                        {
                            "gap_kind": "unavailable_detail",
                            "meaning_id": meaning["meaning_id"],
                            "evidence_id": evidence["evidence_id"],
                            "reason": evidence["unavailable_reason"],
                            "claim": "the episode is supported, but this detail cannot be recovered from this store",
                        }
                    )
                elif evidence.get("source_role") == "user_command":
                    item.setdefault("requested_detail_evidence", []).append(
                        _evidence_projection(evidence, include_payload=True)
                    )

    return {
        "projection_version": 1,
        "purpose": purpose,
        "validated_revision": state["revision"],
        "lineage": deepcopy(state["lineage"]),
        "principal": principal,
        "active_scope": scope,
        "surface": "local_cli",
        "current_time": current_time,
        "current_input": current_input,
        "recovery_account": deepcopy(runtime["recovery_account"]),
        "meanings": projected_meanings,
        "gaps": gaps,
        "selection": {
            "meaning_ids": list(selected),
            "evidence_ids": list(selected_evidence),
            "explicit_explain_ids": explicit,
            "raw_transcript_included": False,
        },
    }


def inspection_view(state: dict[str, Any]) -> dict[str, Any]:
    validate_state(state)
    current = [deepcopy(item) for item in state["meanings"] if item["currentness"] == "current"]
    historical = [deepcopy(item) for item in state["meanings"] if item["currentness"] != "current"]
    gaps = []
    for evidence in state["evidence"]:
        if evidence.get("payload_mode") == "retained_optional" and evidence.get("availability") == "unavailable":
            gaps.append(
                {
                    "gap_kind": "unavailable_detail",
                    "evidence_id": evidence["evidence_id"],
                    "meaning_id": evidence.get("related_meaning_id"),
                    "reason": evidence["unavailable_reason"],
                }
            )
    return {
        "schema_version": state["schema_version"],
        "revision": state["revision"],
        "lineage": deepcopy(state["lineage"]),
        "current_meanings": current,
        "historical_meanings": historical,
        "live_commitments": [
            deepcopy(item)
            for item in current
            if item["kind"] == "commitment" and item["prospective_lifecycle"] == "live"
        ],
        "discharged_commitments": [
            deepcopy(item)
            for item in historical
            if item["kind"] == "commitment" and item["prospective_lifecycle"] != "live"
        ],
        "gaps": gaps,
        "runtime_episodes": deepcopy(state["operations"]["runtime_episodes"]),
        "cognition_episodes": deepcopy(state["operations"]["cognition_episodes"]),
    }


def explanation_view(state: dict[str, Any], meaning_id: str) -> dict[str, Any]:
    validate_state(state)
    meaning = deepcopy(find_meaning(state, meaning_id))
    evidence_by_id = {item["evidence_id"]: item for item in state["evidence"]}
    source = []
    for evidence_id in meaning["source_evidence_ids"]:
        evidence = evidence_by_id[evidence_id]
        source.append(deepcopy(evidence))
        source.extend(deepcopy(evidence_by_id[parent]) for parent in evidence["derived_from_evidence_ids"])
    related = [
        deepcopy(item) for item in state["evidence"] if item.get("related_meaning_id") == meaning_id
    ]
    selected_by = [
        item["cognition_id"]
        for item in state["operations"]["cognition_episodes"]
        if meaning_id in item["selected_meaning_ids"]
    ]
    linked = {}
    for field in ("supersedes", "superseded_by"):
        if meaning.get(field):
            linked[field] = deepcopy(find_meaning(state, meaning[field]))
    return {
        "meaning": meaning,
        "source_evidence": source,
        "related_detail_evidence": related,
        "linked_meanings": linked,
        "selected_by_cognition_ids": selected_by,
    }


def _evidence_projection(evidence: dict[str, Any], *, include_payload: bool) -> dict[str, Any]:
    descriptor = {
        key: deepcopy(value)
        for key, value in evidence.items()
        if key not in {"payload", "content_digest"}
    }
    if include_payload and evidence.get("availability") == "available":
        descriptor["payload"] = evidence["payload"]
    return descriptor


def _find_runtime(state: dict[str, Any], runtime_id: str) -> dict[str, Any]:
    for runtime in state["operations"]["runtime_episodes"]:
        if runtime["runtime_id"] == runtime_id:
            return runtime
    raise ValidationError(f"runtime does not exist: {runtime_id}")
