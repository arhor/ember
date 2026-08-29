#!/usr/bin/env python3
"""Deterministic one-shot provider used only by the continuity probe."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import time


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", default="valid")
    parser.add_argument("--capture")
    parser.add_argument("--counter")
    args = parser.parse_args()
    request_bytes = sys.stdin.buffer.read()
    if args.mode == "timeout":
        time.sleep(2)
        return 0
    if args.mode == "nonzero":
        print("provider diagnostic that must not persist", file=sys.stderr)
        return 7
    if args.mode == "malformed":
        sys.stdout.write("not-json")
        return 0
    if args.mode == "extra":
        sys.stdout.write('{"contract_version":1,"reply":"one","used_meaning_ids":[]} trailing')
        return 0
    if args.mode == "oversized":
        sys.stdout.write("x" * (1024 * 1024 + 1))
        return 0
    request = json.loads(request_bytes.decode("utf-8"))
    if args.mode == "empty":
        sys.stdout.write(json.dumps({"contract_version": 1, "reply": "", "used_meaning_ids": []}))
        return 0
    if args.capture:
        Path(args.capture).write_bytes(request_bytes)
    if args.counter:
        counter = Path(args.counter)
        prior = int(counter.read_text(encoding="utf-8")) if counter.exists() else 0
        counter.write_text(str(prior + 1), encoding="utf-8")
    meanings = request["projection"]["meanings"]
    current = [item for item in meanings if item["currentness"] == "current"]
    historical = [item for item in meanings if item["currentness"] == "superseded"]
    relationships = [item for item in meanings if item["kind"] == "relationship"]
    testimony = [item for item in meanings if item["epistemic_role"] == "user_testimony"]
    commitments = [item for item in meanings if item["kind"] == "commitment"]
    gaps = request["projection"]["gaps"]
    recovery = request["projection"]["recovery_account"]
    lineage = request["projection"]["lineage"]
    boundary_count = len(lineage["constitutive_boundaries"])
    downtime_claim = recovery["ember_cognition_during_interval"]
    reply = (
        f"REPLY_ONLY_TOKEN: recognised lineage {lineage['lineage_id']} with {boundary_count} constitutive boundary; "
        f"{len(relationships)} relationship meanings and {len(testimony)} user-testimony meanings are attributable; "
        f"{len(commitments)} live commitment meanings remain qualified; "
        f"{len(current)} current meanings and {len(historical)} superseded meanings are labelled; "
        f"recovery is {recovery['gap_kind']} with cognition claim {downtime_claim}; "
        f"{len(gaps)} requested detail is explicitly unavailable; external changes remain unknown."
    )
    result = {
        "contract_version": 1,
        "reply": reply,
        "used_meaning_ids": request["projection"]["selection"]["meaning_ids"],
    }
    if args.mode == "unknown-field":
        result["canonical_mutation"] = {"lineage": "replace"}
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    return 0


raise SystemExit(main())
