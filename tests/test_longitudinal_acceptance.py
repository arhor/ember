from __future__ import annotations

import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

from tests.support import PRINCIPAL, PROVIDER, RELATIONSHIP_SCOPE, SCOPE, command


class MinimalContinuityAcceptanceTests(unittest.TestCase):
    def test_minimal_continuity_slice_should_preserve_truthful_meaning_when_complete_process_restarts(self):
        # Given
        with TemporaryDirectory() as directory:
            state_path = str(Path(directory, "ember.json"))
            capture_path = str(Path(directory, "last-request.json"))
            counter_path = str(Path(directory, "provider-count.txt"))
            init = command(["init", "--state", state_path, "--name", "Ember", "--principal", PRINCIPAL], now="2026-08-29T08:00:00Z")
            provider_args = ["--provider-command", sys.executable, "--provider-arg=" + str(PROVIDER), "--provider-arg=--capture", "--provider-arg=" + capture_path, "--provider-arg=--counter", "--provider-arg=" + counter_path, "--provider-timeout-seconds", "2"]
            first_input = "\n".join([
                f":remember relationship relationship:{PRINCIPAL} {RELATIONSHIP_SCOPE} Ember and user-1 are continuing collaborators",
                f":remember fact user:{PRINCIPAL} home-server {RELATIONSHIP_SCOPE} The home server is a Raspberry Pi 5",
                f":prefer user:{PRINCIPAL} docs-rationale-detail {SCOPE} Prefer concise architectural rationale",
                f":undertake restart-provenance-check {SCOPE} Check whether restart reconstruction preserves provenance without transcript replay",
                f":remember episode first-continuity-experiment relationship:{PRINCIPAL} {RELATIONSHIP_SCOPE} The first continuity experiment received a nickname",
                "Initial provider expression before the complete stop",
                ":quit",
                "",
            ])
            first = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, *provider_args], stdin=first_input, now="2026-08-29T09:00:00Z")
            first_view = self._inspect(state_path)
            initial_lineage_id = first_view["lineage"]["lineage_id"]
            fact_id = self._meaning(first_view, "fact", "home-server")["meaning_id"]
            preference_a_id = self._meaning(first_view, "preference", "docs-rationale-detail")["meaning_id"]
            episode_id = self._meaning(first_view, "episode_meta", "first-continuity-experiment")["meaning_id"]
            attach = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, *provider_args], stdin=f":attach-detail {episode_id} Cinder\n:quit\n", now="2026-08-29T10:00:00Z")
            canonical_after_attach = json.loads(Path(state_path).read_text(encoding="utf-8"))
            detail_id = next(item["evidence_id"] for item in canonical_after_attach["evidence"] if item.get("related_meaning_id") == episode_id and item["source_role"] == "user_command")
            replace = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, *provider_args], stdin=f":supersede {preference_a_id} Prefer detailed architectural rationale\n:quit\n", now="2026-08-29T11:00:00Z")
            withhold = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, *provider_args], stdin=f":fixture-withhold {detail_id}\n:quit\n", now="2026-08-29T12:00:00Z", fixture_faults=True)
            # When
            final_input = f":ask --explain {fact_id},{preference_a_id},{episode_id} Continue from durable state and explain the unavailable nickname\n:quit\n"
            restarted = command(["run", "--state", state_path, "--principal", PRINCIPAL, "--scope", SCOPE, *provider_args], stdin=final_input, now="2026-08-30T12:00:00Z")
            final_view = self._inspect(state_path)
            canonical_text = Path(state_path).read_text(encoding="utf-8")
            request = json.loads(Path(capture_path).read_text(encoding="utf-8"))
            current_by_slot = {item["slot"]: item for item in final_view["current_meanings"]}
            historical_by_id = {item["meaning_id"]: item for item in final_view["historical_meanings"]}
            final_runtime = final_view["runtime_episodes"][-1]
            final_cognition = final_view["cognition_episodes"][-1]
            projected_by_id = {item["meaning_id"]: item for item in request["projection"]["meanings"]}
            projected_relationship = next(item for item in request["projection"]["meanings"] if item["kind"] == "relationship")
            projected_fact = projected_by_id[fact_id]
            projected_commitment = next(item for item in request["projection"]["meanings"] if item["kind"] == "commitment")
            fact_source = projected_fact["source_evidence"][0]
            commitment_roles = {item["source_role"] for item in projected_commitment["source_evidence"]}
            # Then
            self.assertEqual(
                (
                    [0, 0, 0, 0, 0, 0],
                    "2",
                    "Prefer detailed architectural rationale",
                    "superseded",
                    "user_testimony",
                    "live",
                    "known_clean_stop_interval",
                    "none_in_supported_runtime",
                    "unavailable_detail",
                    False,
                    "superseded",
                    "current",
                    "displayed",
                    True,
                    1,
                    "relationship:user-1",
                    "user:user-1",
                    "relationship:user-1",
                    "user:user-1",
                    "last_known_live_needs_currentness_check",
                    {"ember_adoption", "user_command"},
                    False,
                    False,
                    True,
                ),
                (
                    [init.returncode, first.returncode, attach.returncode, replace.returncode, withhold.returncode, restarted.returncode],
                    Path(counter_path).read_text(encoding="utf-8"),
                    current_by_slot["docs-rationale-detail"]["content"],
                    historical_by_id[preference_a_id]["currentness"],
                    current_by_slot["home-server"]["epistemic_role"] if "home-server" in current_by_slot else projected_by_id[fact_id]["epistemic_role"],
                    current_by_slot["restart-provenance-check"]["prospective_lifecycle"],
                    final_runtime["recovery_account"]["gap_kind"],
                    final_runtime["recovery_account"]["ember_cognition_during_interval"],
                    request["projection"]["gaps"][0]["gap_kind"],
                    request["projection"]["selection"]["raw_transcript_included"],
                    projected_by_id[preference_a_id]["currentness"],
                    projected_by_id[current_by_slot["docs-rationale-detail"]["meaning_id"]]["currentness"],
                    final_cognition["delivery_status"],
                    initial_lineage_id == final_view["lineage"]["lineage_id"] == request["projection"]["lineage"]["lineage_id"],
                    len(request["projection"]["lineage"]["constitutive_boundaries"]),
                    projected_relationship["owner"],
                    projected_fact["owner"],
                    projected_fact["scope"],
                    fact_source["source_actor"],
                    projected_commitment["applicability"],
                    commitment_roles,
                    "Cinder" in canonical_text,
                    "REPLY_ONLY_TOKEN" in canonical_text,
                    "REPLY_ONLY_TOKEN" in restarted.stdout and "none_in_supported_runtime" in restarted.stdout,
                ),
            )

    def _inspect(self, state_path):
        inspected = command(["inspect", "--state", state_path, "--principal", PRINCIPAL, "--json"])
        self.assertEqual(0, inspected.returncode, inspected.stderr)
        return json.loads(inspected.stdout)

    def _meaning(self, view, kind, slot):
        return next(item for item in view["current_meanings"] if item["kind"] == kind and item["slot"] == slot)


if __name__ == "__main__":
    unittest.main()
