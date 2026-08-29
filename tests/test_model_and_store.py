from __future__ import annotations

from copy import deepcopy
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest import mock

from ember.errors import DurabilityUncertain, StaleRevision, StoreExists, StoreUnavailable, ValidationError
from ember.model import initial_state, new_id, validate_state
from ember.runtime import start_runtime
from ember.semantics import user_evidence
from ember.store import StateStore
from tests.support import PRINCIPAL, populated_state


class StateValidatorTests(unittest.TestCase):
    def test_state_validator_should_accept_state_when_schema_and_invariants_are_complete(self):
        # Given
        state, _ = populated_state()
        # When
        validate_state(state)
        # Then
        self.assertEqual(1, state["schema_version"])

    def test_state_validator_should_reject_state_when_two_current_meanings_share_exact_slot(self):
        # Given
        state, ids = populated_state()
        duplicate = deepcopy(next(item for item in state["meanings"] if item["meaning_id"] == ids["preference"]))
        duplicate["meaning_id"] = duplicate["meaning_id"] + "-duplicate"
        state["meanings"].append(duplicate)
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("duplicate current meaning", str(error))

    def test_state_validator_should_reject_state_when_evidence_reference_is_absent(self):
        # Given
        state, ids = populated_state()
        meaning = next(item for item in state["meanings"] if item["meaning_id"] == ids["fact"])
        meaning["source_evidence_ids"] = ["evidence-absent"]
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("cites absent evidence", str(error))

    def test_state_validator_should_reject_state_when_unavailable_evidence_leaks_payload(self):
        # Given
        state, ids = populated_state()
        evidence = next(item for item in state["evidence"] if item["evidence_id"] == ids["detail"])
        evidence["availability"] = "unavailable"
        evidence["unavailable_reason"] = "fixture detail payload unavailable"
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("leaks unavailable payload or digest", str(error))

    def test_state_validator_should_reject_state_when_governing_fact_evidence_becomes_unavailable(self):
        # Given
        state, ids = populated_state()
        fact = next(item for item in state["meanings"] if item["meaning_id"] == ids["fact"])
        evidence = next(item for item in state["evidence"] if item["evidence_id"] == fact["source_evidence_ids"][0])
        evidence["availability"] = "unavailable"
        evidence["unavailable_reason"] = "source unavailable"
        evidence.pop("payload")
        evidence.pop("content_digest")
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("governing evidence cannot degrade locally", str(error))

    def test_state_validator_should_reject_state_when_unattached_evidence_claims_unavailability(self):
        # Given
        state, _ = populated_state()
        evidence = next(item for item in state["evidence"] if item["source_role"] == "user_command")
        evidence["availability"] = "unavailable"
        evidence["unavailable_reason"] = "source unavailable"
        evidence.pop("payload")
        evidence.pop("content_digest")
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("must relate to episode_meta", str(error))

    def test_state_validator_should_reject_state_when_supersession_crosses_scope(self):
        # Given
        state, ids = populated_state()
        old = next(item for item in state["meanings"] if item["meaning_id"] == ids["preference"])
        later = deepcopy(old)
        later["meaning_id"] = later["meaning_id"] + "-later"
        later["scope"] = "project:other"
        later["supersedes"] = old["meaning_id"]
        old["currentness"] = "superseded"
        old["superseded_by"] = later["meaning_id"]
        state["meanings"].append(later)
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("crosses kind, owner, slot, or scope", str(error))

    def test_state_validator_should_reject_state_when_principal_binding_is_changed(self):
        # Given
        state, _ = populated_state()
        state["runtime_contract"]["local_principal"] = "intruder"
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("principal", str(error))

    def test_state_validator_should_reject_state_when_constitutive_boundary_becomes_meaning(self):
        # Given
        state, ids = populated_state()
        meaning = next(item for item in state["meanings"] if item["meaning_id"] == ids["fact"])
        meaning["kind"] = "constitutive"
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("kind is unsupported", str(error))

    def test_state_validator_should_reject_state_when_json_boolean_impersonates_integer_version(self):
        # Given
        state, _ = populated_state()
        state["schema_version"] = True
        state["revision"] = True
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("unsupported schema_version", str(error))

    def test_state_validator_should_reject_state_when_adoption_retains_payload(self):
        # Given
        state, _ = populated_state()
        adoption = next(item for item in state["evidence"] if item["source_role"] == "ember_adoption")
        adoption.update({"payload_mode": "retained_optional", "availability": "available", "payload": "duplicated request", "content_digest": "sha256:wrong"})
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("adoption must be descriptor-only", str(error))

    def test_state_validator_should_reject_state_when_current_meaning_has_past_applicability_end(self):
        # Given
        state, ids = populated_state()
        fact = next(item for item in state["meanings"] if item["meaning_id"] == ids["fact"])
        fact["applicable_until"] = "2026-08-28T10:00:00Z"
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("applicability interval cannot be rewritten", str(error))

    def test_state_validator_should_reject_state_when_commitment_claims_discharge_without_occurrence(self):
        # Given
        state, ids = populated_state()
        commitment = next(item for item in state["meanings"] if item["meaning_id"] == ids["commitment"])
        commitment["currentness"] = "historical"
        commitment["prospective_lifecycle"] = "fulfilled"
        # When
        error = self._validation_error(state)
        # Then
        self.assertIn("discharge is unsupported", str(error))

    def test_state_validator_should_return_typed_failure_when_nested_json_shapes_are_malformed(self):
        # Given
        base, ids = populated_state()
        with_cognition, runtime_id = start_runtime(base, PRINCIPAL, "project:ember/docs", timestamp="2026-08-29T10:00:00Z")
        input_evidence = user_evidence(with_cognition, PRINCIPAL, "project:ember/docs", "input", timestamp="2026-08-29T10:00:00Z")
        with_cognition["operations"]["cognition_episodes"].append({"cognition_id": new_id("cognition"), "runtime_id": runtime_id, "principal": PRINCIPAL, "active_scope": "project:ember/docs", "provider_label": "provider", "purpose": "ordinary", "started_at": "2026-08-29T10:00:00Z", "last_durable_observation_at": "2026-08-29T10:00:00Z", "status": "started", "selected_meaning_ids": [], "selected_evidence_ids": [], "used_meaning_ids": [], "input_evidence_id": input_evidence["evidence_id"], "expression_evidence_id": None, "delivery_status": "not_attempted"})
        variants = []
        for field, value in (("source_evidence_ids", None), ("source_evidence_ids", [["nested"]])):
            candidate = deepcopy(base)
            next(item for item in candidate["meanings"] if item["meaning_id"] == ids["fact"])[field] = value
            variants.append(candidate)
        candidate = deepcopy(base)
        candidate["evidence"][0]["derived_from_evidence_ids"] = None
        variants.append(candidate)
        for field in ("selected_meaning_ids", "selected_evidence_ids", "used_meaning_ids"):
            candidate = deepcopy(with_cognition)
            candidate["operations"]["cognition_episodes"][0][field] = None
            variants.append(candidate)
        candidate = deepcopy(base)
        candidate["operations"]["runtime_episodes"] = ["not-an-object"]
        variants.append(candidate)
        candidate = deepcopy(base)
        candidate["operations"]["cognition_episodes"] = [7]
        variants.append(candidate)
        candidate = deepcopy(base)
        candidate["meanings"][0]["currentness"] = []
        variants.append(candidate)
        candidate = deepcopy(base)
        candidate["evidence"][0]["payload_mode"] = {}
        variants.append(candidate)
        # When
        failures = [self._validation_error(candidate) for candidate in variants]
        # Then
        self.assertEqual([ValidationError] * len(variants), [type(error) for error in failures])

    def _validation_error(self, state):
        try:
            validate_state(state)
        except ValidationError as error:
            return error
        self.fail("validation unexpectedly succeeded")


class StateStoreTests(unittest.TestCase):
    def test_state_store_should_round_trip_complete_document_when_commit_succeeds(self):
        # Given
        state = initial_state("Ember", PRINCIPAL, "2026-08-29T10:00:00Z")
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                candidate = deepcopy(store.load())
                candidate["lineage"]["display_name"] = "Ember"
                committed = store.commit(0, candidate)
            loaded = store.load()
        # Then
        self.assertEqual((1, committed), (loaded["revision"], loaded))

    def test_state_store_should_reject_stale_candidate_when_revision_changed(self):
        # Given
        state = initial_state("Ember", PRINCIPAL, "2026-08-29T10:00:00Z")
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                store.commit(0, deepcopy(state))
                try:
                    store.commit(0, deepcopy(state))
                except StaleRevision as caught:
                    error = caught
                else:
                    error = None
        # Then
        self.assertIsInstance(error, StaleRevision)

    def test_state_store_should_refuse_overwrite_when_lineage_already_exists(self):
        # Given
        state = initial_state("Ember", PRINCIPAL, "2026-08-29T10:00:00Z")
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            try:
                store.create(state)
            except StoreExists as caught:
                error = caught
            else:
                error = None
        # Then
        self.assertIsInstance(error, StoreExists)

    def test_state_store_should_ignore_orphan_temporary_file_when_canonical_document_is_complete(self):
        # Given
        state = initial_state("Ember", PRINCIPAL, "2026-08-29T10:00:00Z")
        # When
        with TemporaryDirectory() as directory:
            path = Path(directory, "ember.json")
            store = StateStore(path)
            store.create(state)
            Path(directory, ".ember.json.interrupted.tmp").write_text("{", encoding="utf-8")
            loaded = store.load()
        # Then
        self.assertEqual(state, loaded)

    def test_state_store_should_report_uncertain_durability_when_directory_sync_fails_after_replace(self):
        # Given
        state = initial_state("Ember", PRINCIPAL, "2026-08-29T10:00:00Z")
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer(), mock.patch("ember.store.os.fsync", side_effect=[None, OSError("sync")]):
                try:
                    store.commit(0, deepcopy(state))
                except DurabilityUncertain as caught:
                    error = caught
                else:
                    error = None
            exposed = store.load()
        # Then
        self.assertEqual((DurabilityUncertain, 1), (type(error), exposed["revision"]))

    def test_state_store_should_fail_closed_when_canonical_json_is_partial(self):
        # Given
        partial = "{\"schema_version\": 1"
        # When
        with TemporaryDirectory() as directory:
            path = Path(directory, "ember.json")
            path.write_text(partial, encoding="utf-8")
            try:
                StateStore(path).load()
            except StoreUnavailable as caught:
                error = caught
            else:
                error = None
        # Then
        self.assertIsInstance(error, StoreUnavailable)

    def test_state_store_should_report_unavailable_when_canonical_file_is_invalid_utf8(self):
        # Given
        invalid_utf8 = b"\xff\xfe"
        # When
        with TemporaryDirectory() as directory:
            path = Path(directory, "ember.json")
            path.write_bytes(invalid_utf8)
            try:
                StateStore(path).load()
            except StoreUnavailable as caught:
                error = caught
            else:
                error = None
        # Then
        self.assertIn("not valid UTF-8", str(error))


if __name__ == "__main__":
    unittest.main()
