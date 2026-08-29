"""Schema-v1 construction and whole-document semantic validation."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import os
from typing import Any, Callable
import uuid

from ember.errors import ValidationError


SCHEMA_VERSION = 1
TOPOLOGY = "single-principal-single-writer"
CONSTITUTIVE_TEXT = (
    "Ember owns this lineage across temporary cognition loci and must not fabricate "
    "experience during inactive intervals."
)
MEANING_KINDS = {"relationship", "fact", "preference", "commitment", "episode_meta"}
SOURCE_ROLES = {
    "user_command",
    "ember_adoption",
    "ember_expression_via_provider",
    "runtime_observation",
    "fixture_fault",
}
CURRENTNESS = {"current", "superseded", "historical"}
COMMITMENT_LIFECYCLES = {"live", "fulfilled", "cancelled", "superseded", "renegotiated", "expired"}


def now_utc() -> str:
    """Return an RFC 3339 UTC timestamp, with a deterministic test override."""
    fixed = os.environ.get("EMBER_TEST_NOW")
    if fixed:
        _parse_timestamp(fixed, "EMBER_TEST_NOW")
        return fixed
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def content_digest(payload: str) -> str:
    return "sha256:" + hashlib.sha256(payload.encode("utf-8")).hexdigest()


def initial_state(name: str, principal: str, timestamp: str | None = None) -> dict[str, Any]:
    timestamp = timestamp or now_utc()
    state = {
        "schema_version": SCHEMA_VERSION,
        "revision": 0,
        "runtime_contract": {
            "local_principal": principal,
            "topology": TOPOLOGY,
        },
        "lineage": {
            "lineage_id": new_id("lineage"),
            "display_name": name,
            "established_at": timestamp,
            "constitutive_boundaries": [
                {
                    "boundary_id": "minimal-continuity-v1",
                    "text": CONSTITUTIVE_TEXT,
                }
            ],
        },
        "evidence": [],
        "meanings": [],
        "operations": {"runtime_episodes": [], "cognition_episodes": []},
    }
    validate_state(state)
    return state


def clone_state(state: dict[str, Any]) -> dict[str, Any]:
    return deepcopy(state)


def validate_state(state: dict[str, Any]) -> None:
    """Validate every supported schema and semantic invariant, or fail closed."""
    errors: list[str] = []

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    require(isinstance(state, dict), "state must be an object")
    if not isinstance(state, dict):
        raise ValidationError("state must be an object")
    require(
        set(state) == {"schema_version", "revision", "runtime_contract", "lineage", "evidence", "meanings", "operations"},
        "top-level fields do not match schema v1",
    )
    require(type(state.get("schema_version")) is int and state.get("schema_version") == SCHEMA_VERSION, "unsupported schema_version")
    require(type(state.get("revision")) is int and state.get("revision", -1) >= 0, "revision must be non-negative integer")

    contract = _object(state.get("runtime_contract"), "runtime_contract", errors)
    principal = contract.get("local_principal")
    require(_nonempty(principal), "runtime_contract.local_principal must be non-empty")
    require(contract.get("topology") == TOPOLOGY, "unsupported runtime topology")
    require(set(contract) == {"local_principal", "topology"}, "runtime_contract contains unsupported fields")

    lineage = _object(state.get("lineage"), "lineage", errors)
    require(_id(lineage.get("lineage_id"), "lineage-"), "lineage_id must be stable lineage ID")
    require(_nonempty(lineage.get("display_name")), "lineage display_name must be non-empty")
    _timestamp(lineage.get("established_at"), "lineage.established_at", errors)
    boundaries = lineage.get("constitutive_boundaries")
    require(isinstance(boundaries, list) and len(boundaries) == 1, "exactly one constitutive boundary is required")
    if isinstance(boundaries, list) and len(boundaries) == 1 and isinstance(boundaries[0], dict):
        require(boundaries[0] == {"boundary_id": "minimal-continuity-v1", "text": CONSTITUTIVE_TEXT}, "constitutive boundary must match the approved fixture")
    require(
        set(lineage) == {"lineage_id", "display_name", "established_at", "constitutive_boundaries"},
        "lineage contains unsupported fields",
    )

    evidence = state.get("evidence")
    meanings = state.get("meanings")
    operations = _object(state.get("operations"), "operations", errors)
    require(isinstance(evidence, list), "evidence must be a list")
    require(isinstance(meanings, list), "meanings must be a list")
    require(set(operations) == {"runtime_episodes", "cognition_episodes"}, "operations contains unsupported fields")
    runtimes = operations.get("runtime_episodes")
    cognitions = operations.get("cognition_episodes")
    require(isinstance(runtimes, list), "runtime_episodes must be a list")
    require(isinstance(cognitions, list), "cognition_episodes must be a list")
    evidence = evidence if isinstance(evidence, list) else []
    meanings = meanings if isinstance(meanings, list) else []
    runtimes = runtimes if isinstance(runtimes, list) else []
    cognitions = cognitions if isinstance(cognitions, list) else []

    all_ids: list[str] = []
    if _nonempty(lineage.get("lineage_id")):
        all_ids.append(lineage["lineage_id"])
    all_ids.append("minimal-continuity-v1")
    evidence_by_id: dict[str, dict[str, Any]] = {}
    meaning_by_id: dict[str, dict[str, Any]] = {}
    runtime_by_id: dict[str, dict[str, Any]] = {}
    cognition_by_id: dict[str, dict[str, Any]] = {}

    for index, item in enumerate(evidence):
        path = f"evidence[{index}]"
        ev = _object(item, path, errors)
        allowed_evidence_fields = {
            "evidence_id", "source_role", "source_actor", "asserted_principal",
            "occurred_at", "observed_at", "derived_from_evidence_ids", "scope",
            "payload_mode", "availability", "payload", "content_digest",
            "unavailable_reason", "related_meaning_id", "cognition_id", "provider_label",
        }
        require(set(ev).issubset(allowed_evidence_fields), f"{path} contains unsupported fields")
        ev_id = ev.get("evidence_id")
        require(_id(ev_id, "evidence-"), f"{path}.evidence_id is invalid")
        if _nonempty(ev_id):
            all_ids.append(ev_id)
            evidence_by_id[ev_id] = ev
        require(_one_of(ev.get("source_role"), SOURCE_ROLES), f"{path}.source_role is unsupported")
        require(_nonempty(ev.get("source_actor")), f"{path}.source_actor must be non-empty")
        require(_nonempty(ev.get("scope")), f"{path}.scope must be non-empty")
        _timestamp(ev.get("occurred_at"), f"{path}.occurred_at", errors)
        _timestamp(ev.get("observed_at"), f"{path}.observed_at", errors)
        _ordered(ev.get("occurred_at"), ev.get("observed_at"), f"{path} occurrence must not follow observation", errors)
        derived = ev.get("derived_from_evidence_ids")
        require(isinstance(derived, list) and all(_nonempty(value) for value in derived), f"{path}.derived_from_evidence_ids must be IDs")
        if "related_meaning_id" in ev:
            require(_nonempty(ev.get("related_meaning_id")), f"{path}.related_meaning_id must be an ID")
        if "cognition_id" in ev:
            require(_nonempty(ev.get("cognition_id")), f"{path}.cognition_id must be an ID")
        if "provider_label" in ev:
            require(_nonempty(ev.get("provider_label")), f"{path}.provider_label must be non-empty")
        mode = ev.get("payload_mode")
        require(_one_of(mode, {"retained_optional", "descriptor_only"}), f"{path}.payload_mode is invalid")
        if mode == "retained_optional":
            require(_one_of(ev.get("availability"), {"available", "unavailable"}), f"{path}.availability is invalid")
            if ev.get("availability") == "available":
                require(isinstance(ev.get("payload"), str), f"{path}.payload must be retained while available")
                require("unavailable_reason" not in ev, f"{path}.unavailable_reason is invalid while available")
                if isinstance(ev.get("payload"), str):
                    require(ev.get("content_digest") == content_digest(ev["payload"]), f"{path}.content_digest does not match payload")
            else:
                require("payload" not in ev and "content_digest" not in ev, f"{path} leaks unavailable payload or digest")
                require(_nonempty(ev.get("unavailable_reason")), f"{path}.unavailable_reason is required")
        elif mode == "descriptor_only":
            for forbidden in ("availability", "payload", "content_digest", "unavailable_reason"):
                require(forbidden not in ev, f"{path} descriptor-only evidence contains {forbidden}")
        if ev.get("source_role") == "user_command":
            require(ev.get("asserted_principal") == principal, f"{path} principal does not match runtime contract")
            require(ev.get("source_actor") == f"user:{principal}", f"{path} user actor does not match principal")
            require(derived == [], f"{path} user command cannot derive from another occurrence")
            require(mode == "retained_optional", f"{path} user command must use retained-optional payload")
        elif "asserted_principal" in ev:
            require(ev.get("asserted_principal") == principal, f"{path} asserted principal does not match runtime contract")
        if ev.get("source_role") == "ember_adoption":
            require(ev.get("source_actor") == "ember", f"{path} adoption must be Ember-owned evidence")
            require(isinstance(derived, list) and len(derived) == 1, f"{path} adoption needs exactly one requesting occurrence")
            require(mode == "descriptor_only", f"{path} adoption must be descriptor-only")
            require("related_meaning_id" not in ev and "cognition_id" not in ev and "provider_label" not in ev, f"{path} adoption contains unrelated role fields")
        if ev.get("source_role") == "ember_expression_via_provider":
            require(mode == "descriptor_only", f"{path} provider expression must be descriptor-only")
            require(ev.get("source_actor") == "ember", f"{path} provider expression actor must be Ember")
            require(_nonempty(ev.get("cognition_id")), f"{path} provider expression needs cognition_id")
            require(_nonempty(ev.get("provider_label")), f"{path} provider expression needs provider_label")
            require(derived == [], f"{path} provider expression cannot derive new evidence")
            require("related_meaning_id" not in ev, f"{path} provider expression cannot attach detail")
        if _one_of(ev.get("source_role"), {"runtime_observation", "fixture_fault"}):
            require(ev.get("source_actor") == "runtime", f"{path} runtime evidence actor must be runtime")
            require(mode == "descriptor_only", f"{path} runtime evidence must be descriptor-only")
        if ev.get("source_role") == "fixture_fault":
            require(isinstance(derived, list) and len(derived) == 1, f"{path} fixture fault needs exactly one affected occurrence")
            require(_nonempty(ev.get("related_meaning_id")), f"{path} fixture fault needs related episode meaning")

    current_slots: dict[tuple[str, str, str, str], str] = {}
    for index, item in enumerate(meanings):
        path = f"meanings[{index}]"
        meaning = _object(item, path, errors)
        require(
            set(meaning) == {
                "meaning_id", "kind", "owner", "slot", "scope", "content",
                "source_evidence_ids", "epistemic_role", "learned_at", "applicable_from",
                "applicable_until", "currentness", "prospective_lifecycle", "supersedes",
                "superseded_by", "uncertainty",
            },
            f"{path} fields do not match schema v1",
        )
        meaning_id = meaning.get("meaning_id")
        require(_id(meaning_id, "meaning-"), f"{path}.meaning_id is invalid")
        if _nonempty(meaning_id):
            all_ids.append(meaning_id)
            meaning_by_id[meaning_id] = meaning
        kind = meaning.get("kind")
        require(_one_of(kind, MEANING_KINDS), f"{path}.kind is unsupported")
        require(_nonempty(meaning.get("owner")), f"{path}.owner must be explicit")
        require(_nonempty(meaning.get("slot")), f"{path}.slot must be non-empty")
        require(_nonempty(meaning.get("scope")), f"{path}.scope must be explicit")
        require(_nonempty(meaning.get("content")), f"{path}.content must be non-empty")
        refs = meaning.get("source_evidence_ids")
        require(isinstance(refs, list) and len(refs) >= 1 and all(_nonempty(value) for value in refs), f"{path} needs source evidence")
        require(_nonempty(meaning.get("epistemic_role")), f"{path}.epistemic_role must be explicit")
        _timestamp(meaning.get("learned_at"), f"{path}.learned_at", errors)
        _timestamp(meaning.get("applicable_from"), f"{path}.applicable_from", errors)
        if meaning.get("applicable_until") is not None:
            _timestamp(meaning.get("applicable_until"), f"{path}.applicable_until", errors)
        require(_one_of(meaning.get("currentness"), CURRENTNESS), f"{path}.currentness is invalid")
        require("uncertainty" in meaning, f"{path}.uncertainty must be explicit")
        require("supersedes" in meaning and "superseded_by" in meaning, f"{path} supersession links must be explicit")
        require(meaning.get("supersedes") is None or _nonempty(meaning.get("supersedes")), f"{path}.supersedes must be an ID or null")
        require(meaning.get("superseded_by") is None or _nonempty(meaning.get("superseded_by")), f"{path}.superseded_by must be an ID or null")
        if kind == "relationship":
            require(meaning.get("owner") == f"relationship:{principal}", f"{path} relationship owner is invalid")
            require(meaning.get("slot") == "relationship", f"{path} relationship slot must be fixed")
            require(meaning.get("currentness") == "current", f"{path} relationship must remain current in v1")
            require(meaning.get("prospective_lifecycle") == "none", f"{path} relationship lifecycle is unsupported")
        elif _one_of(kind, {"fact", "preference"}):
            require(meaning.get("owner") == f"user:{principal}", f"{path} {kind} owner must be the supported user")
            require(_one_of(meaning.get("currentness"), {"current", "superseded"}), f"{path} {kind} currentness is invalid")
            require(meaning.get("prospective_lifecycle") == "none", f"{path} {kind} prospective lifecycle is invalid")
            require(meaning.get("applicable_until") is None, f"{path} {kind} applicability interval cannot be rewritten in v1")
        elif kind == "commitment":
            lifecycle = meaning.get("prospective_lifecycle")
            require(meaning.get("owner") == "ember", f"{path} commitment owner must be Ember")
            require(lifecycle == "live", f"{path} commitment discharge is unsupported without a named transition")
            require(meaning.get("currentness") == "current", f"{path} live commitment must be current")
            require(meaning.get("applicable_until") is None, f"{path} live commitment cannot have an applicability end")
        elif kind == "episode_meta":
            require(_one_of(meaning.get("owner"), {"ember", f"relationship:{principal}"}), f"{path} episode owner is invalid")
            require(meaning.get("currentness") == "current", f"{path} episode meta must be current")
            require(meaning.get("prospective_lifecycle") == "none", f"{path} episode meta lifecycle is invalid")
        if meaning.get("currentness") == "current":
            key = (str(kind), str(meaning.get("owner")), str(meaning.get("slot")), str(meaning.get("scope")))
            require(key not in current_slots, f"duplicate current meaning for {key}")
            current_slots[key] = str(meaning_id)
            require(meaning.get("superseded_by") is None, f"{path} current meaning cannot have a successor")
        if meaning.get("currentness") == "superseded":
            require(_nonempty(meaning.get("superseded_by")), f"{path} superseded meaning needs a successor")
        if not _one_of(kind, {"fact", "preference"}):
            require(meaning.get("supersedes") is None and meaning.get("superseded_by") is None, f"{path} kind does not support supersession")

    for index, item in enumerate(runtimes):
        path = f"runtime_episodes[{index}]"
        runtime = _object(item, path, errors)
        require(
            set(runtime) == {
                "runtime_id", "principal", "active_scope", "started_at",
                "last_durable_observation_at", "clean_stop_at", "stop_reason", "recovery_account",
            },
            f"{path} fields do not match schema v1",
        )
        runtime_id = runtime.get("runtime_id")
        require(_id(runtime_id, "runtime-"), f"{path}.runtime_id is invalid")
        if _nonempty(runtime_id):
            all_ids.append(runtime_id)
            runtime_by_id[runtime_id] = runtime
        require(runtime.get("principal") == principal, f"{path}.principal mismatch")
        require(_nonempty(runtime.get("active_scope")), f"{path}.active_scope must be explicit")
        _timestamp(runtime.get("started_at"), f"{path}.started_at", errors)
        _timestamp(runtime.get("last_durable_observation_at"), f"{path}.last_durable_observation_at", errors)
        _ordered(runtime.get("started_at"), runtime.get("last_durable_observation_at"), f"{path} durable observation precedes runtime start", errors)
        if runtime.get("clean_stop_at") is not None:
            _timestamp(runtime.get("clean_stop_at"), f"{path}.clean_stop_at", errors)
            _ordered(runtime.get("last_durable_observation_at"), runtime.get("clean_stop_at"), f"{path} clean stop precedes durable observation", errors)
            require(_nonempty(runtime.get("stop_reason")), f"{path}.stop_reason required for clean stop")
        else:
            require(runtime.get("stop_reason") is None, f"{path}.stop_reason without clean stop")
        recovery_account = runtime.get("recovery_account")
        require(isinstance(recovery_account, dict), f"{path}.recovery_account must be an object")
        if isinstance(recovery_account, dict):
            require(
                recovery_account.get("previous_runtime") is None or _nonempty(recovery_account.get("previous_runtime")),
                f"{path}.recovery_account.previous_runtime must be an ID or null",
            )
            require(_nonempty(recovery_account.get("current_runtime")), f"{path}.recovery_account.current_runtime must be an ID")

    for index, item in enumerate(cognitions):
        path = f"cognition_episodes[{index}]"
        cognition = _object(item, path, errors)
        require(
            set(cognition) == {
                "cognition_id", "runtime_id", "principal", "active_scope", "provider_label",
                "purpose", "started_at", "last_durable_observation_at", "status",
                "selected_meaning_ids", "selected_evidence_ids", "used_meaning_ids",
                "input_evidence_id", "expression_evidence_id", "delivery_status",
            },
            f"{path} fields do not match schema v1",
        )
        cognition_id = cognition.get("cognition_id")
        require(_id(cognition_id, "cognition-"), f"{path}.cognition_id is invalid")
        if _nonempty(cognition_id):
            all_ids.append(cognition_id)
            cognition_by_id[cognition_id] = cognition
        require(_nonempty(cognition.get("runtime_id")), f"{path}.runtime_id must be an ID")
        require(cognition.get("principal") == principal, f"{path}.principal mismatch")
        require(_nonempty(cognition.get("active_scope")), f"{path}.active_scope must be explicit")
        require(_one_of(cognition.get("purpose"), {"ordinary", "explain"}), f"{path}.purpose is invalid")
        require(_nonempty(cognition.get("provider_label")), f"{path}.provider_label is required")
        _timestamp(cognition.get("started_at"), f"{path}.started_at", errors)
        _timestamp(cognition.get("last_durable_observation_at"), f"{path}.last_durable_observation_at", errors)
        _ordered(cognition.get("started_at"), cognition.get("last_durable_observation_at"), f"{path} durable observation precedes cognition start", errors)
        require(_one_of(cognition.get("status"), {"started", "completed", "failed", "timed_out", "outcome_unknown"}), f"{path}.status is invalid")
        require(isinstance(cognition.get("selected_meaning_ids"), list) and all(_nonempty(value) for value in cognition.get("selected_meaning_ids", [])), f"{path}.selected_meaning_ids must be an ID list")
        require(isinstance(cognition.get("selected_evidence_ids"), list) and all(_nonempty(value) for value in cognition.get("selected_evidence_ids", [])), f"{path}.selected_evidence_ids must be an ID list")
        require(isinstance(cognition.get("used_meaning_ids"), list) and all(_nonempty(value) for value in cognition.get("used_meaning_ids", [])), f"{path}.used_meaning_ids must be an ID list")
        require(_nonempty(cognition.get("input_evidence_id")), f"{path}.input_evidence_id is required")
        require(_one_of(cognition.get("delivery_status"), {"not_attempted", "pending", "displayed"}), f"{path}.delivery_status is invalid")
        if cognition.get("status") == "completed":
            require(_nonempty(cognition.get("expression_evidence_id")), f"{path} completed cognition needs expression evidence")
            require(_one_of(cognition.get("delivery_status"), {"pending", "displayed"}), f"{path} completed cognition needs delivery state")
        else:
            require(cognition.get("expression_evidence_id") is None, f"{path} incomplete cognition cannot claim expression")
            require(cognition.get("delivery_status") == "not_attempted", f"{path} incomplete cognition cannot claim delivery")
            require(cognition.get("used_meaning_ids") == [], f"{path} incomplete cognition cannot claim used meanings")

    # Cross-reference validation assumes the record shapes checked above. Fail
    # closed here so malformed JSON can never escape as a raw Python exception.
    if errors:
        raise ValidationError("; ".join(dict.fromkeys(errors)))

    require(len(all_ids) == len(set(all_ids)), "all canonical IDs must be unique")

    for ev_id, ev in evidence_by_id.items():
        for parent in ev.get("derived_from_evidence_ids", []):
            require(parent in evidence_by_id, f"{ev_id} derives from absent evidence {parent}")
        related = ev.get("related_meaning_id")
        if related is not None:
            require(related in meaning_by_id, f"{ev_id} relates to absent meaning {related}")
        cognition_id = ev.get("cognition_id")
        if cognition_id is not None:
            require(cognition_id in cognition_by_id, f"{ev_id} refers to absent cognition {cognition_id}")
        if ev.get("payload_mode") == "retained_optional" and ev.get("availability") == "unavailable":
            related_id = ev.get("related_meaning_id")
            related = meaning_by_id.get(related_id)
            cited_as_governing = any(ev_id in meaning.get("source_evidence_ids", []) for meaning in meanings)
            faults = [
                candidate for candidate in evidence
                if candidate.get("source_role") == "fixture_fault"
                and candidate.get("derived_from_evidence_ids") == [ev_id]
                and candidate.get("related_meaning_id") == related_id
            ]
            require(ev.get("source_role") == "user_command", f"{ev_id} unavailable evidence must be attached user detail")
            require(related is not None and related.get("kind") == "episode_meta", f"{ev_id} unavailable evidence must relate to episode_meta")
            if related is not None:
                require(ev.get("scope") == related.get("scope"), f"{ev_id} unavailable detail scope mismatch")
            require(not cited_as_governing, f"{ev_id} governing evidence cannot degrade locally")
            require(len(faults) == 1, f"{ev_id} unavailable detail needs exactly one fixture-fault occurrence")
    for meaning_id, meaning in meaning_by_id.items():
        refs = meaning.get("source_evidence_ids", [])
        for ref in refs:
            require(ref in evidence_by_id, f"{meaning_id} cites absent evidence {ref}")
        predecessor = meaning.get("supersedes")
        successor = meaning.get("superseded_by")
        if predecessor is not None or successor is not None:
            require(meaning.get("kind") in {"fact", "preference"}, f"{meaning_id} kind cannot be superseded")
        if predecessor is not None:
            prior = meaning_by_id.get(predecessor)
            require(prior is not None, f"{meaning_id} supersedes absent meaning")
            if prior is not None:
                require(prior.get("superseded_by") == meaning_id, f"{meaning_id} predecessor link is not reciprocal")
                require(_same_slot(meaning, prior), f"{meaning_id} crosses kind, owner, slot, or scope")
                require(prior.get("currentness") == "superseded", f"{meaning_id} predecessor is not superseded")
        if successor is not None:
            later = meaning_by_id.get(successor)
            require(later is not None, f"{meaning_id} successor is absent")
            if later is not None:
                require(later.get("supersedes") == meaning_id, f"{meaning_id} successor link is not reciprocal")
                require(_same_slot(meaning, later), f"{meaning_id} successor crosses semantic slot")
            require(meaning.get("currentness") == "superseded", f"{meaning_id} with successor must be superseded")
        if meaning.get("kind") == "commitment":
            adoption_refs = [evidence_by_id.get(ref) for ref in refs]
            adoption_refs = [ev for ev in adoption_refs if ev and ev.get("source_role") == "ember_adoption"]
            require(len(adoption_refs) >= 1, f"{meaning_id} commitment needs Ember adoption evidence")
            for adoption in adoption_refs:
                parents = adoption.get("derived_from_evidence_ids", [])
                require(len(parents) == 1 and evidence_by_id.get(parents[0], {}).get("source_role") == "user_command", f"{meaning_id} adoption must derive from user request")
            require(meaning.get("epistemic_role") == "ember_commitment", f"{meaning_id} commitment epistemic role is invalid")
        else:
            require(meaning.get("epistemic_role") == "user_testimony", f"{meaning_id} epistemic role is invalid for the supported promotion path")
            require(
                all(evidence_by_id.get(ref, {}).get("source_role") == "user_command" for ref in refs),
                f"{meaning_id} supported remembered meaning must cite user-command evidence",
            )
    for meaning_id in meaning_by_id:
        seen: set[str] = set()
        cursor: str | None = meaning_id
        while cursor is not None:
            require(cursor not in seen, f"supersession cycle contains {cursor}")
            if cursor in seen:
                break
            seen.add(cursor)
            node = meaning_by_id.get(cursor)
            cursor = node.get("supersedes") if node else None

    for cognition_id, cognition in cognition_by_id.items():
        for meaning_id in cognition.get("selected_meaning_ids", []):
            require(meaning_id in meaning_by_id, f"{cognition_id} selected absent meaning {meaning_id}")
        require(
            set(cognition.get("used_meaning_ids", [])).issubset(set(cognition.get("selected_meaning_ids", []))),
            f"{cognition_id} used a meaning outside its selection",
        )
        for ev_id in cognition.get("selected_evidence_ids", []):
            require(ev_id in evidence_by_id, f"{cognition_id} selected absent evidence {ev_id}")
        input_evidence_id = cognition.get("input_evidence_id")
        require(input_evidence_id in evidence_by_id, f"{cognition_id} input evidence is absent")
        if input_evidence_id in evidence_by_id:
            require(evidence_by_id[input_evidence_id].get("source_role") == "user_command", f"{cognition_id} input evidence has wrong role")
            require(evidence_by_id[input_evidence_id].get("scope") == cognition.get("active_scope"), f"{cognition_id} input evidence scope mismatch")
        owning_runtime = runtime_by_id.get(cognition.get("runtime_id"))
        if owning_runtime is not None:
            require(cognition.get("active_scope") == owning_runtime.get("active_scope"), f"{cognition_id} scope differs from owning runtime")
            _ordered(owning_runtime.get("started_at"), cognition.get("started_at"), f"{cognition_id} starts before owning runtime", errors)
            _ordered(cognition.get("last_durable_observation_at"), owning_runtime.get("last_durable_observation_at"), f"{cognition_id} observation exceeds runtime durable boundary", errors)
        expression_id = cognition.get("expression_evidence_id")
        if expression_id is not None:
            expression = evidence_by_id.get(expression_id)
            require(expression is not None, f"{cognition_id} expression evidence is absent")
            if expression is not None:
                require(expression.get("source_role") == "ember_expression_via_provider", f"{cognition_id} expression evidence has wrong role")
                require(expression.get("cognition_id") == cognition_id, f"{cognition_id} expression back-reference mismatch")
                require(expression.get("scope") == cognition.get("active_scope"), f"{cognition_id} expression scope mismatch")
                require(expression.get("provider_label") == cognition.get("provider_label"), f"{cognition_id} provider label mismatch")

    referenced_expressions = [
        cognition.get("expression_evidence_id") for cognition in cognitions
        if cognition.get("expression_evidence_id") is not None
    ]
    for ev_id, ev in evidence_by_id.items():
        if ev.get("source_role") == "ember_expression_via_provider":
            require(referenced_expressions.count(ev_id) == 1, f"{ev_id} provider expression must belong to exactly one completed cognition")

    _validate_runtime_chain(runtimes, runtime_by_id, errors)

    if errors:
        raise ValidationError("; ".join(dict.fromkeys(errors)))


def _object(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return {}
    return value


def _nonempty(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _one_of(value: Any, allowed: set[str]) -> bool:
    return isinstance(value, str) and value in allowed


def _id(value: Any, prefix: str) -> bool:
    return _nonempty(value) and str(value).startswith(prefix)


def _timestamp(value: Any, path: str, errors: list[str]) -> None:
    try:
        _parse_timestamp(value, path)
    except (TypeError, ValueError):
        errors.append(f"{path} must be RFC 3339 UTC")


def _parse_timestamp(value: Any, path: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ValueError(path)
    parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    if parsed.tzinfo != timezone.utc:
        raise ValueError(path)
    return parsed


def _ordered(left: Any, right: Any, message: str, errors: list[str]) -> None:
    try:
        if _parse_timestamp(left, message) > _parse_timestamp(right, message):
            errors.append(message)
    except (TypeError, ValueError):
        return


def _same_slot(left: dict[str, Any], right: dict[str, Any]) -> bool:
    fields = ("kind", "owner", "slot", "scope")
    return all(left.get(field) == right.get(field) for field in fields)


def _validate_runtime_chain(
    runtimes: list[dict[str, Any]], runtime_by_id: dict[str, dict[str, Any]], errors: list[str]
) -> None:
    if not runtimes:
        return
    successors: dict[str, list[str]] = {runtime_id: [] for runtime_id in runtime_by_id}
    roots = 0
    for runtime in runtimes:
        runtime_id = runtime.get("runtime_id")
        account = runtime.get("recovery_account")
        if not isinstance(account, dict):
            continue
        expected_fields = {
            "previous_runtime", "current_runtime", "gap_kind",
            "last_durable_observation_at", "clean_stop_at", "restart_at",
            "ember_cognition_during_interval", "external_changes_during_interval",
        }
        if set(account) != expected_fields:
            errors.append(f"{runtime_id} recovery account fields do not match schema v1")
            continue
        if account.get("current_runtime") != runtime_id:
            errors.append(f"{runtime_id} recovery current_runtime mismatch")
        if account.get("restart_at") != runtime.get("started_at"):
            errors.append(f"{runtime_id} recovery restart_at mismatch")
        if account.get("external_changes_during_interval") != "unknown":
            errors.append(f"{runtime_id} recovery must keep external changes unknown")
        previous_id = account.get("previous_runtime")
        if previous_id is None:
            roots += 1
            expected = ("initial_start", None, None, "not_applicable")
        else:
            previous = runtime_by_id.get(previous_id)
            if previous is None:
                errors.append(f"{runtime_id} recovery refers to absent previous runtime")
                continue
            successors.setdefault(previous_id, []).append(runtime_id)
            if previous.get("clean_stop_at") is None:
                expected = (
                    "uncertain_interruption_boundary",
                    previous.get("last_durable_observation_at"),
                    None,
                    "unknown_after_last_durable_observation",
                )
            else:
                expected = (
                    "known_clean_stop_interval",
                    previous.get("last_durable_observation_at"),
                    previous.get("clean_stop_at"),
                    "none_in_supported_runtime",
                )
                _ordered(previous.get("clean_stop_at"), runtime.get("started_at"), f"{runtime_id} restart precedes prior clean stop", errors)
            _ordered(previous.get("last_durable_observation_at"), runtime.get("started_at"), f"{runtime_id} restart precedes prior durable boundary", errors)
        actual = (
            account.get("gap_kind"),
            account.get("last_durable_observation_at"),
            account.get("clean_stop_at"),
            account.get("ember_cognition_during_interval"),
        )
        if actual != expected:
            errors.append(f"{runtime_id} recovery account overstates or contradicts surviving lifecycle evidence")
    if roots != 1:
        errors.append("runtime recovery chain must contain exactly one initial start")
    if any(len(items) > 1 for items in successors.values()):
        errors.append("runtime recovery chain cannot fork in the supported topology")
    for runtime_id in runtime_by_id:
        seen: set[str] = set()
        cursor: str | None = runtime_id
        while cursor is not None:
            if cursor in seen:
                errors.append(f"runtime recovery chain contains cycle at {cursor}")
                break
            seen.add(cursor)
            node = runtime_by_id.get(cursor)
            account = node.get("recovery_account") if node else None
            cursor = account.get("previous_runtime") if isinstance(account, dict) else None
