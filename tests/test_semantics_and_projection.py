from __future__ import annotations

from copy import deepcopy
import json
import unittest

from ember.errors import ValidationError
from ember.model import new_id, validate_state
from ember.projection import build_projection, explanation_view, inspection_view
from ember.runtime import start_runtime, stop_runtime
from ember.semantics import find_meaning, supersede, user_evidence, withhold_detail
from tests.support import PRINCIPAL, RELATIONSHIP_SCOPE, SCOPE, populated_state


class SemanticTransitionTests(unittest.TestCase):
    def test_commitment_should_preserve_user_request_and_ember_adoption_when_created(self):
        # Given
        state, ids = populated_state()
        commitment = find_meaning(state, ids["commitment"])
        # When
        adoption = next(item for item in state["evidence"] if item["evidence_id"] in commitment["source_evidence_ids"])
        request = next(item for item in state["evidence"] if item["evidence_id"] == adoption["derived_from_evidence_ids"][0])
        # Then
        self.assertEqual(("ember_adoption", "user_command", "ember"), (adoption["source_role"], request["source_role"], commitment["owner"]))

    def test_supersession_should_keep_a_historical_and_make_b_current_when_slot_matches_exactly(self):
        # Given
        state, ids = populated_state()
        original = deepcopy(find_meaning(state, ids["preference"]))
        # When
        replacement_id = supersede(state, PRINCIPAL, ids["preference"], "Prefer detailed architectural rationale")
        replacement = find_meaning(state, replacement_id)
        changed_original = find_meaning(state, ids["preference"])
        # Then
        self.assertEqual(("superseded", replacement_id, "current", original["content"], original["source_evidence_ids"], original["applicable_until"]), (changed_original["currentness"], changed_original["superseded_by"], replacement["currentness"], changed_original["content"], changed_original["source_evidence_ids"], changed_original["applicable_until"]))

    def test_supersession_should_refuse_change_when_meaning_kind_is_not_correctable(self):
        # Given
        state, ids = populated_state()
        # When
        try:
            supersede(state, PRINCIPAL, ids["relationship"], "Different relationship")
        except ValidationError as caught:
            error = caught
        else:
            error = None
        # Then
        self.assertIsInstance(error, ValidationError)

    def test_optional_detail_should_leave_typed_gap_when_payload_is_withheld(self):
        # Given
        state, ids = populated_state()
        before = json.dumps(state, ensure_ascii=False)
        # When
        withhold_detail(state, PRINCIPAL, ids["detail"])
        after = json.dumps(state, ensure_ascii=False)
        view = inspection_view(state)
        # Then
        self.assertEqual((1, 0, ids["episode"]), (before.count("Cinder"), after.count("Cinder"), view["gaps"][0]["meaning_id"]))

    def test_optional_detail_should_reject_deletion_label_when_fault_reason_claims_deletion(self):
        # Given
        state, ids = populated_state()
        # When
        try:
            withhold_detail(state, PRINCIPAL, ids["detail"], reason="privacy deletion")
        except ValidationError as caught:
            error = caught
        else:
            error = None
        # Then
        self.assertIn("unsupported", str(error))


class LifecycleAndProjectionTests(unittest.TestCase):
    def test_recovery_should_report_clean_interval_when_prior_runtime_stopped_explicitly(self):
        # Given
        state, _ = populated_state()
        first, first_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        stopped = stop_runtime(first, first_id, reason="explicit_cli_exit", timestamp="2026-08-29T11:00:00Z")
        # When
        restarted, second_id = start_runtime(stopped, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        recovery = restarted["operations"]["runtime_episodes"][-1]["recovery_account"]
        # Then
        self.assertEqual(("known_clean_stop_interval", "none_in_supported_runtime", "unknown"), (recovery["gap_kind"], recovery["ember_cognition_during_interval"], recovery["external_changes_during_interval"]))

    def test_recovery_should_preserve_uncertainty_when_prior_runtime_has_no_clean_stop(self):
        # Given
        state, _ = populated_state()
        open_state, _ = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        # When
        restarted, _ = start_runtime(open_state, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        recovery = restarted["operations"]["runtime_episodes"][-1]["recovery_account"]
        # Then
        self.assertEqual(("uncertain_interruption_boundary", "unknown_after_last_durable_observation"), (recovery["gap_kind"], recovery["ember_cognition_during_interval"]))

    def test_recovery_should_follow_explicit_runtime_links_when_storage_list_is_reordered(self):
        # Given
        state, _ = populated_state()
        first, first_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        stopped = stop_runtime(first, first_id, reason="explicit_cli_exit", timestamp="2026-08-29T11:00:00Z")
        second, second_id = start_runtime(stopped, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        second["operations"]["runtime_episodes"].reverse()
        # When
        third, third_id = start_runtime(second, PRINCIPAL, SCOPE, timestamp="2026-08-31T11:00:00Z")
        recovery = next(item for item in third["operations"]["runtime_episodes"] if item["runtime_id"] == third_id)["recovery_account"]
        # Then
        self.assertEqual((second_id, "uncertain_interruption_boundary"), (recovery["previous_runtime"], recovery["gap_kind"]))

    def test_state_validator_should_reject_recovery_when_clean_gap_claims_continuous_cognition(self):
        # Given
        state, _ = populated_state()
        first, first_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        stopped = stop_runtime(first, first_id, reason="explicit_cli_exit", timestamp="2026-08-29T11:00:00Z")
        restarted, _ = start_runtime(stopped, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        restarted["operations"]["runtime_episodes"][-1]["recovery_account"]["ember_cognition_during_interval"] = "continuous"
        # When
        try:
            validate_state(restarted)
        except ValidationError as caught:
            error = caught
        else:
            error = None
        # Then
        self.assertIn("overstates or contradicts", str(error))

    def test_recovery_should_mark_started_cognition_unknown_when_prior_runtime_ended_abruptly(self):
        # Given
        state, _ = populated_state()
        open_state, runtime_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        input_evidence = user_evidence(open_state, PRINCIPAL, SCOPE, "An input whose outcome was not durably recorded", timestamp="2026-08-29T10:01:00Z")
        open_state["operations"]["runtime_episodes"][0]["last_durable_observation_at"] = "2026-08-29T10:01:00Z"
        cognition_id = new_id("cognition")
        open_state["operations"]["cognition_episodes"].append({"cognition_id": cognition_id, "runtime_id": runtime_id, "principal": PRINCIPAL, "active_scope": SCOPE, "provider_label": "scripted_provider.py", "purpose": "ordinary", "started_at": "2026-08-29T10:01:00Z", "last_durable_observation_at": "2026-08-29T10:01:00Z", "status": "started", "selected_meaning_ids": [], "selected_evidence_ids": [], "used_meaning_ids": [], "input_evidence_id": input_evidence["evidence_id"], "expression_evidence_id": None, "delivery_status": "not_attempted"})
        validate_state(open_state)
        # When
        recovered, _ = start_runtime(open_state, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        cognition = next(item for item in recovered["operations"]["cognition_episodes"] if item["cognition_id"] == cognition_id)
        # Then
        self.assertEqual(("outcome_unknown", "uncertain_interruption_boundary"), (cognition["status"], recovered["operations"]["runtime_episodes"][-1]["recovery_account"]["gap_kind"]))

    def test_state_validator_should_reject_clean_gap_when_restart_clock_precedes_stop(self):
        # Given
        state, _ = populated_state()
        first, first_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T12:00:00Z")
        stopped = stop_runtime(first, first_id, reason="explicit_cli_exit", timestamp="2026-08-29T13:00:00Z")
        # When
        try:
            start_runtime(stopped, PRINCIPAL, SCOPE, timestamp="2026-08-29T11:00:00Z")
        except ValidationError as caught:
            error = caught
        else:
            error = None
        # Then
        self.assertIn("restart precedes", str(error))

    def test_ordinary_projection_should_include_current_b_and_exclude_historical_a_when_scope_matches(self):
        # Given
        state, ids = populated_state()
        replacement_id = supersede(state, PRINCIPAL, ids["preference"], "Prefer detailed architectural rationale")
        started, runtime_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        # When
        projection = build_projection(started, principal=PRINCIPAL, scope=SCOPE, current_input="Continue", current_time="2026-08-30T11:00:01Z", runtime_id=runtime_id)
        selected = projection["selection"]["meaning_ids"]
        # Then
        self.assertEqual((True, False, False), (replacement_id in selected, ids["preference"] in selected, ids["fact"] in selected))

    def test_explain_projection_should_label_history_provenance_commitment_and_gap_when_ids_are_requested(self):
        # Given
        state, ids = populated_state()
        replacement_id = supersede(state, PRINCIPAL, ids["preference"], "Prefer detailed architectural rationale")
        withhold_detail(state, PRINCIPAL, ids["detail"])
        first, first_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        stopped = stop_runtime(first, first_id, reason="explicit_cli_exit", timestamp="2026-08-29T11:00:00Z")
        restarted, runtime_id = start_runtime(stopped, PRINCIPAL, SCOPE, timestamp="2026-08-30T11:00:00Z")
        # When
        projection = build_projection(restarted, principal=PRINCIPAL, scope=SCOPE, current_input="Explain continuation", current_time="2026-08-30T11:00:01Z", runtime_id=runtime_id, purpose="explain", explain_ids=[ids["fact"], ids["preference"], ids["episode"]])
        by_id = {item["meaning_id"]: item for item in projection["meanings"]}
        # Then
        self.assertEqual(("user_testimony", "superseded", "current", "last_known_live_needs_currentness_check", "unavailable_detail", False), (by_id[ids["fact"]]["epistemic_role"], by_id[ids["preference"]]["currentness"], by_id[replacement_id]["currentness"], by_id[ids["commitment"]]["applicability"], projection["gaps"][0]["gap_kind"], projection["selection"]["raw_transcript_included"]))


if __name__ == "__main__":
    unittest.main()
