"""Explicit, provenance-preserving semantic transitions for the v1 fixture."""

from __future__ import annotations

from typing import Any

from ember.errors import ValidationError
from ember.model import content_digest, new_id, now_utc, validate_state


def user_evidence(
    state: dict[str, Any], principal: str, scope: str, payload: str, *, timestamp: str | None = None
) -> dict[str, Any]:
    _require_principal(state, principal)
    timestamp = timestamp or now_utc()
    evidence = {
        "evidence_id": new_id("evidence"),
        "source_role": "user_command",
        "source_actor": f"user:{principal}",
        "asserted_principal": principal,
        "occurred_at": timestamp,
        "observed_at": timestamp,
        "derived_from_evidence_ids": [],
        "scope": scope,
        "payload_mode": "retained_optional",
        "availability": "available",
        "payload": payload,
        "content_digest": content_digest(payload),
    }
    state["evidence"].append(evidence)
    return evidence


def remember_relationship(
    state: dict[str, Any], principal: str, owner: str, scope: str, text: str
) -> str:
    if owner != f"relationship:{principal}":
        raise ValidationError("relationship owner must match relationship:<principal>")
    _ensure_no_current(state, "relationship", owner, "relationship", scope)
    evidence = user_evidence(state, principal, scope, text)
    meaning = _meaning(
        "relationship", owner, "relationship", scope, text, evidence["evidence_id"], "user_testimony"
    )
    state["meanings"].append(meaning)
    validate_state(state)
    return meaning["meaning_id"]


def remember_fact(
    state: dict[str, Any], principal: str, owner: str, slot: str, scope: str, text: str
) -> str:
    _require_user_owner(principal, owner)
    _ensure_no_current(state, "fact", owner, slot, scope)
    evidence = user_evidence(state, principal, scope, text)
    meaning = _meaning("fact", owner, slot, scope, text, evidence["evidence_id"], "user_testimony")
    state["meanings"].append(meaning)
    validate_state(state)
    return meaning["meaning_id"]


def remember_preference(
    state: dict[str, Any], principal: str, owner: str, slot: str, scope: str, text: str
) -> str:
    _require_user_owner(principal, owner)
    _ensure_no_current(state, "preference", owner, slot, scope)
    evidence = user_evidence(state, principal, scope, text)
    meaning = _meaning(
        "preference", owner, slot, scope, text, evidence["evidence_id"], "user_testimony"
    )
    state["meanings"].append(meaning)
    validate_state(state)
    return meaning["meaning_id"]


def remember_episode(
    state: dict[str, Any], principal: str, slot: str, owner: str, scope: str, summary: str
) -> str:
    if owner not in {"ember", f"relationship:{principal}"}:
        raise ValidationError("episode owner must be ember or relationship:<principal>")
    _ensure_no_current(state, "episode_meta", owner, slot, scope)
    evidence = user_evidence(state, principal, scope, summary)
    meaning = _meaning(
        "episode_meta", owner, slot, scope, summary, evidence["evidence_id"], "user_testimony"
    )
    state["meanings"].append(meaning)
    validate_state(state)
    return meaning["meaning_id"]


def undertake(
    state: dict[str, Any], principal: str, slot: str, scope: str, text: str
) -> str:
    _ensure_no_current(state, "commitment", "ember", slot, scope)
    request = user_evidence(state, principal, scope, text)
    timestamp = now_utc()
    adoption = {
        "evidence_id": new_id("evidence"),
        "source_role": "ember_adoption",
        "source_actor": "ember",
        "asserted_principal": principal,
        "occurred_at": timestamp,
        "observed_at": timestamp,
        "derived_from_evidence_ids": [request["evidence_id"]],
        "scope": scope,
        "payload_mode": "descriptor_only",
    }
    state["evidence"].append(adoption)
    meaning = _meaning(
        "commitment", "ember", slot, scope, text, adoption["evidence_id"], "ember_commitment"
    )
    meaning["prospective_lifecycle"] = "live"
    state["meanings"].append(meaning)
    validate_state(state)
    return meaning["meaning_id"]


def supersede(
    state: dict[str, Any], principal: str, meaning_id: str, text: str, *, reason: str | None = None
) -> str:
    old = find_meaning(state, meaning_id)
    if old["kind"] not in {"fact", "preference"}:
        raise ValidationError("only fact and preference correction/supersession is supported")
    if old["currentness"] != "current" or old["superseded_by"] is not None:
        raise ValidationError("only a current, unsuperseded meaning can be superseded")
    _require_user_owner(principal, old["owner"])
    payload = text if reason is None else f"Correction: {text}\nReason: {reason}"
    evidence = user_evidence(state, principal, old["scope"], payload)
    replacement = _meaning(
        old["kind"],
        old["owner"],
        old["slot"],
        old["scope"],
        text,
        evidence["evidence_id"],
        "user_testimony",
    )
    replacement["supersedes"] = old["meaning_id"]
    old["currentness"] = "superseded"
    old["superseded_by"] = replacement["meaning_id"]
    state["meanings"].append(replacement)
    validate_state(state)
    return replacement["meaning_id"]


def attach_detail(
    state: dict[str, Any], principal: str, episode_id: str, detail: str
) -> str:
    if not detail.strip():
        raise ValidationError("optional detail must be non-empty")
    episode = find_meaning(state, episode_id)
    if episode["kind"] != "episode_meta":
        raise ValidationError("optional detail can be attached only to episode_meta")
    if any(ev.get("related_meaning_id") == episode_id for ev in state["evidence"]):
        raise ValidationError("episode already has optional detail evidence")
    evidence = user_evidence(state, principal, episode["scope"], detail)
    evidence["related_meaning_id"] = episode_id
    validate_state(state)
    return evidence["evidence_id"]


def withhold_detail(
    state: dict[str, Any], principal: str, evidence_id: str, *, reason: str = "fixture detail payload unavailable"
) -> str:
    _require_principal(state, principal)
    evidence = find_evidence(state, evidence_id)
    if evidence.get("related_meaning_id") is None:
        raise ValidationError("fixture fault can withhold only attached episode detail")
    if evidence.get("payload_mode") != "retained_optional" or evidence.get("availability") != "available":
        raise ValidationError("detail evidence is not currently available")
    if "delet" in reason.lower():
        raise ValidationError("privacy deletion semantics are unsupported by the fixture fault")
    if not reason.strip() or evidence.get("payload", "") in reason:
        raise ValidationError("unavailability reason must not reveal the detail")
    evidence["availability"] = "unavailable"
    evidence["unavailable_reason"] = reason
    evidence.pop("payload", None)
    evidence.pop("content_digest", None)
    timestamp = now_utc()
    fault = {
        "evidence_id": new_id("evidence"),
        "source_role": "fixture_fault",
        "source_actor": "runtime",
        "asserted_principal": principal,
        "occurred_at": timestamp,
        "observed_at": timestamp,
        "derived_from_evidence_ids": [evidence_id],
        "scope": evidence["scope"],
        "payload_mode": "descriptor_only",
        "related_meaning_id": evidence["related_meaning_id"],
    }
    state["evidence"].append(fault)
    validate_state(state)
    return fault["evidence_id"]


def find_meaning(state: dict[str, Any], meaning_id: str) -> dict[str, Any]:
    for meaning in state["meanings"]:
        if meaning["meaning_id"] == meaning_id:
            return meaning
    raise ValidationError(f"meaning does not exist: {meaning_id}")


def find_evidence(state: dict[str, Any], evidence_id: str) -> dict[str, Any]:
    for evidence in state["evidence"]:
        if evidence["evidence_id"] == evidence_id:
            return evidence
    raise ValidationError(f"evidence does not exist: {evidence_id}")


def _meaning(
    kind: str,
    owner: str,
    slot: str,
    scope: str,
    content: str,
    source_evidence_id: str,
    epistemic_role: str,
) -> dict[str, Any]:
    if not all(value.strip() for value in (owner, slot, scope, content)):
        raise ValidationError("owner, slot, scope, and content must be non-empty")
    timestamp = now_utc()
    return {
        "meaning_id": new_id("meaning"),
        "kind": kind,
        "owner": owner,
        "slot": slot,
        "scope": scope,
        "content": content,
        "source_evidence_ids": [source_evidence_id],
        "epistemic_role": epistemic_role,
        "learned_at": timestamp,
        "applicable_from": timestamp,
        "applicable_until": None,
        "currentness": "current",
        "prospective_lifecycle": "none",
        "supersedes": None,
        "superseded_by": None,
        "uncertainty": None,
    }


def _require_principal(state: dict[str, Any], principal: str) -> None:
    if principal != state["runtime_contract"]["local_principal"]:
        raise ValidationError("asserted principal does not match the initialized local principal")


def _require_user_owner(principal: str, owner: str) -> None:
    if owner != f"user:{principal}":
        raise ValidationError("fact or preference owner must match user:<principal>")


def _ensure_no_current(
    state: dict[str, Any], kind: str, owner: str, slot: str, scope: str
) -> None:
    if not all(value.strip() for value in (owner, slot, scope)):
        raise ValidationError("owner, slot, and scope must be non-empty")
    for meaning in state["meanings"]:
        if (
            meaning["kind"] == kind
            and meaning["owner"] == owner
            and meaning["slot"] == slot
            and meaning["scope"] == scope
            and meaning["currentness"] == "current"
        ):
            raise ValidationError("a current meaning already occupies this exact semantic slot")
