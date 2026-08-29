from __future__ import annotations

from copy import deepcopy
import io
import json
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest import mock

from ember.errors import ProviderError
from ember.model import initial_state
from ember.projection import build_projection
from ember.provider import invoke_provider, validate_result
from ember.runtime import run_cognition, start_runtime
from ember.store import StateStore
from tests.support import PRINCIPAL, PROVIDER, ROOT, SCOPE, command, populated_state


class ProviderContractTests(unittest.TestCase):
    def test_provider_adapter_should_accept_one_result_when_result_uses_only_selected_meanings(self):
        # Given
        state, _ = populated_state()
        state, runtime_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        projection = build_projection(state, principal=PRINCIPAL, scope=SCOPE, current_input="hello", current_time="2026-08-29T10:00:01Z", runtime_id=runtime_id)
        request = {"contract_version": 1, "cognition_id": "cognition-test", "projection": projection, "input": {"text": "hello"}}
        # When
        result = invoke_provider(sys.executable, [str(PROVIDER)], request, timeout_seconds=1)
        # Then
        self.assertEqual(set(projection["selection"]["meaning_ids"]), set(result["used_meaning_ids"]))

    def test_provider_adapter_should_reject_result_when_provider_requests_canonical_mutation(self):
        # Given
        state, _ = populated_state()
        state, runtime_id = start_runtime(state, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
        projection = build_projection(state, principal=PRINCIPAL, scope=SCOPE, current_input="hello", current_time="2026-08-29T10:00:01Z", runtime_id=runtime_id)
        request = {"contract_version": 1, "cognition_id": "cognition-test", "projection": projection, "input": {"text": "hello"}}
        # When
        error = self._provider_error(request, "unknown-field")
        # Then
        self.assertIn("unsupported fields", str(error))

    def test_provider_adapter_should_reject_output_when_stdout_contains_extra_data(self):
        # Given
        request = self._empty_request()
        # When
        error = self._provider_error(request, "extra")
        # Then
        self.assertIn("extra stdout", str(error))

    def test_provider_adapter_should_report_timeout_when_fresh_process_exceeds_limit(self):
        # Given
        request = self._empty_request()
        # When
        error = self._provider_error(request, "timeout", timeout=0.02)
        # Then
        self.assertEqual("timed_out", error.outcome)

    def test_provider_adapter_should_reject_timeout_when_value_is_not_finite(self):
        # Given
        request = self._empty_request()
        # When
        try:
            invoke_provider(sys.executable, [str(PROVIDER)], request, timeout_seconds=float("nan"))
        except ProviderError as caught:
            error = caught
        else:
            error = None
        # Then
        self.assertIn("positive", str(error))

    def test_provider_adapter_should_reject_result_when_boolean_impersonates_contract_version(self):
        # Given
        result = {"contract_version": True, "reply": "text", "used_meaning_ids": []}
        # When
        try:
            validate_result(result, set())
        except ProviderError as caught:
            error = caught
        else:
            error = None
        # Then
        self.assertIn("unsupported", str(error))

    def test_provider_adapter_should_reject_output_when_stdout_is_malformed_json(self):
        # Given
        request = self._empty_request()
        # When
        error = self._provider_error(request, "malformed")
        # Then
        self.assertIn("not one JSON object", str(error))

    def test_provider_adapter_should_reject_output_when_reply_is_empty(self):
        # Given
        request = self._empty_request()
        # When
        error = self._provider_error(request, "empty")
        # Then
        self.assertIn("non-empty", str(error))

    def test_provider_adapter_should_reject_output_when_stdout_exceeds_contract_limit(self):
        # Given
        request = self._empty_request()
        # When
        error = self._provider_error(request, "oversized")
        # Then
        self.assertIn("exceeds 1 MiB", str(error))

    def test_runtime_should_preserve_semantic_state_and_inspection_when_provider_fails(self):
        # Given
        state, _ = populated_state()
        semantic_before = deepcopy(state["meanings"])
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                loaded = store.load()
                started, runtime_id = start_runtime(loaded, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
                started = store.commit(loaded["revision"], started)
                current, failure = run_cognition(store, started, runtime_id=runtime_id, principal=PRINCIPAL, scope=SCOPE, text="fail safely", command=sys.executable, arguments=[str(PROVIDER), "--mode", "nonzero"], timeout_seconds=1, output=io.StringIO())
            serialized = Path(directory, "ember.json").read_text(encoding="utf-8")
        # Then
        self.assertEqual((semantic_before, "failed", False, True), (current["meanings"], current["operations"]["cognition_episodes"][-1]["status"], "provider diagnostic" in serialized, "fail safely" in serialized))

    def test_runtime_should_preserve_pending_delivery_when_output_fails_after_expression_commit(self):
        # Given
        state, _ = populated_state()
        broken_output = _BrokenOutput()
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                loaded = store.load()
                started, runtime_id = start_runtime(loaded, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
                started = store.commit(loaded["revision"], started)
                try:
                    run_cognition(store, started, runtime_id=runtime_id, principal=PRINCIPAL, scope=SCOPE, text="render", command=sys.executable, arguments=[str(PROVIDER)], timeout_seconds=1, output=broken_output)
                except OSError as caught:
                    error = caught
                else:
                    error = None
                persisted = store.load()["operations"]["cognition_episodes"][-1]
        # Then
        self.assertEqual((OSError, "completed", "pending", True), (type(error), persisted["status"], persisted["delivery_status"], persisted["expression_evidence_id"] is not None))

    def test_runtime_should_keep_delivery_unknown_when_display_commit_fails_after_reply_is_written(self):
        # Given
        state, _ = populated_state()
        output = io.StringIO()
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                loaded = store.load()
                started, runtime_id = start_runtime(loaded, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
                started = store.commit(loaded["revision"], started)
                original_commit = store.commit
                calls = {"count": 0}
                def fail_third_commit(expected_revision, candidate):
                    calls["count"] += 1
                    if calls["count"] == 3:
                        raise OSError("simulated display-status crash")
                    return original_commit(expected_revision, candidate)
                with mock.patch.object(store, "commit", side_effect=fail_third_commit):
                    try:
                        run_cognition(store, started, runtime_id=runtime_id, principal=PRINCIPAL, scope=SCOPE, text="display", command=sys.executable, arguments=[str(PROVIDER)], timeout_seconds=1, output=output)
                    except OSError as caught:
                        error = caught
                    else:
                        error = None
                persisted = store.load()["operations"]["cognition_episodes"][-1]
        # Then
        self.assertEqual((OSError, True, "pending"), (type(error), "REPLY_ONLY_TOKEN" in output.getvalue(), persisted["delivery_status"]))

    def test_state_validator_should_reject_orphan_expression_when_second_descriptor_targets_one_cognition(self):
        # Given
        state, _ = populated_state()
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                loaded = store.load()
                started, runtime_id = start_runtime(loaded, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
                started = store.commit(loaded["revision"], started)
                completed, _ = run_cognition(store, started, runtime_id=runtime_id, principal=PRINCIPAL, scope=SCOPE, text="one expression", command=sys.executable, arguments=[str(PROVIDER)], timeout_seconds=1, output=io.StringIO())
            duplicate = deepcopy(next(item for item in completed["evidence"] if item["source_role"] == "ember_expression_via_provider"))
            duplicate["evidence_id"] = duplicate["evidence_id"] + "-orphan"
            completed["evidence"].append(duplicate)
            try:
                from ember.model import validate_state
                validate_state(completed)
            except Exception as caught:
                error = caught
            else:
                error = None
        # Then
        self.assertIn("exactly one completed cognition", str(error))

    def test_state_validator_should_reject_cognition_when_scope_differs_from_owning_runtime(self):
        # Given
        state, _ = populated_state()
        # When
        with TemporaryDirectory() as directory:
            store = StateStore(Path(directory, "ember.json"))
            store.create(state)
            with store.writer():
                loaded = store.load()
                started, runtime_id = start_runtime(loaded, PRINCIPAL, SCOPE, timestamp="2026-08-29T10:00:00Z")
                started = store.commit(loaded["revision"], started)
                completed, _ = run_cognition(store, started, runtime_id=runtime_id, principal=PRINCIPAL, scope=SCOPE, text="scope", command=sys.executable, arguments=[str(PROVIDER)], timeout_seconds=1, output=io.StringIO())
            completed["operations"]["cognition_episodes"][-1]["active_scope"] = "project:other"
            try:
                from ember.model import validate_state
                validate_state(completed)
            except Exception as caught:
                error = caught
            else:
                error = None
        # Then
        self.assertIn("scope differs from owning runtime", str(error))

    def _provider_error(self, request, mode, timeout=1):
        try:
            invoke_provider(sys.executable, [str(PROVIDER), "--mode", mode], request, timeout_seconds=timeout)
        except ProviderError as error:
            return error
        self.fail("provider unexpectedly succeeded")

    def _empty_request(self):
        return {
            "contract_version": 1,
            "cognition_id": "cognition-test",
            "projection": {"selection": {"meaning_ids": []}},
            "input": {"text": "hello"},
        }


class CliIntegrationTests(unittest.TestCase):
    def test_cli_run_should_reject_timeout_before_runtime_start_when_value_is_infinite(self):
        # Given
        with TemporaryDirectory() as directory:
            state_path = str(Path(directory, "ember.json"))
            command(["init", "--state", state_path, "--name", "Ember", "--principal", PRINCIPAL])
            # When
            attempted = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, "--provider-command", sys.executable, "--provider-timeout-seconds", "inf"])
            state = json.loads(Path(state_path).read_text(encoding="utf-8"))
            # Then
            self.assertEqual((2, []), (attempted.returncode, state["operations"]["runtime_episodes"]))

    def test_cli_run_should_reject_malformed_quote_and_stop_cleanly_when_command_parser_fails(self):
        # Given
        with TemporaryDirectory() as directory:
            state_path = str(Path(directory, "ember.json"))
            command(["init", "--state", state_path, "--name", "Ember", "--principal", PRINCIPAL])
            # When
            attempted = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, "--provider-command", sys.executable, "--provider-timeout-seconds", "1"], stdin=":prefer 'unterminated\n")
            state = json.loads(Path(state_path).read_text(encoding="utf-8"))
            # Then
            self.assertEqual((0, True, "input_eof"), (attempted.returncode, "command rejected" in attempted.stderr, state["operations"]["runtime_episodes"][-1]["stop_reason"]))
    def test_cli_correct_should_create_attributable_successor_when_current_fact_is_corrected(self):
        # Given
        with TemporaryDirectory() as directory:
            state_path = str(Path(directory, "ember.json"))
            command(["init", "--state", state_path, "--name", "Ember", "--principal", PRINCIPAL])
            command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, "--provider-command", sys.executable, "--provider-arg=" + str(PROVIDER), "--provider-timeout-seconds", "1"], stdin=f":remember fact user:{PRINCIPAL} server {SCOPE} It is a Pi 4\n:quit\n")
            before = json.loads(command(["inspect", "--state", state_path, "--principal", PRINCIPAL, "--json"]).stdout)
            original_id = next(item["meaning_id"] for item in before["current_meanings"] if item["slot"] == "server")
            # When
            corrected = command(["correct", "--state", state_path, "--principal", PRINCIPAL, original_id, "--text", "It is a Pi 5", "--reason", "The user corrected the model"])
            after = json.loads(command(["inspect", "--state", state_path, "--principal", PRINCIPAL, "--json"]).stdout)
            explained = command(["explain", "--state", state_path, "--principal", PRINCIPAL, corrected.stdout.strip()])
            current = next(item for item in after["current_meanings"] if item["slot"] == "server")
            historical = next(item for item in after["historical_meanings"] if item["meaning_id"] == original_id)
            # Then
            self.assertEqual((0, "It is a Pi 5", "superseded", original_id, True), (corrected.returncode, current["content"], historical["currentness"], current["supersedes"], "The user corrected the model" in explained.stdout))

    def test_cli_should_refuse_wrong_principal_before_rendering_when_inspection_is_requested(self):
        # Given
        secret = "PRIVATE_FIXTURE_TEXT"
        # When
        with TemporaryDirectory() as directory:
            state_path = str(Path(directory, "ember.json"))
            command(["init", "--state", state_path, "--name", "Ember", "--principal", PRINCIPAL])
            established = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, "--provider-command", sys.executable, "--provider-arg=" + str(PROVIDER), "--provider-timeout-seconds", "1"], stdin=f":remember fact user:{PRINCIPAL} private {SCOPE} {secret}\n:quit\n")
            inspected = command(["inspect", "--state", state_path, "--principal", "intruder", "--json"])
        # Then
        self.assertEqual((0, 2, False), (established.returncode, inspected.returncode, secret in inspected.stdout + inspected.stderr))

    def test_cli_check_should_fail_closed_when_state_is_semantically_incomplete(self):
        # Given
        malformed = {"schema_version": 1, "revision": 0}
        # When
        with TemporaryDirectory() as directory:
            state_path = Path(directory, "ember.json")
            state_path.write_text(json.dumps(malformed), encoding="utf-8")
            checked = command(["check", "--state", str(state_path)])
        # Then
        self.assertEqual((2, True), (checked.returncode, "schema v1" in checked.stderr))


if __name__ == "__main__":
    unittest.main()


class _BrokenOutput:
    def write(self, value):
        raise OSError("simulated display failure")

    def flush(self):
        raise AssertionError("flush must not happen after failed write")
