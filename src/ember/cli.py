"""Exact foreground CLI surface for the minimal continuity experiment."""

from __future__ import annotations

import argparse
from copy import deepcopy
import json
import math
import os
import shlex
import sys
from typing import Any, Callable, Sequence, TextIO

from ember.errors import EmberError, ValidationError
from ember.model import initial_state, now_utc
from ember.projection import explanation_view, inspection_view
from ember.runtime import run_cognition, start_runtime, stop_runtime
from ember.semantics import (
    attach_detail,
    remember_episode,
    remember_fact,
    remember_preference,
    remember_relationship,
    supersede,
    undertake,
    withhold_detail,
)
from ember.store import StateStore


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="ember", description="Experimental Ember continuity slice")
    commands = root.add_subparsers(dest="command", required=True)

    init = commands.add_parser("init", help="create a new continuity lineage")
    init.add_argument("--state", required=True)
    init.add_argument("--name", required=True)
    init.add_argument("--principal", required=True)

    run = commands.add_parser("run", help="start one foreground interaction episode")
    run.add_argument("--state", required=True)
    run.add_argument("--principal", required=True)
    run.add_argument("--scope", required=True)
    run.add_argument("--provider-command", required=True)
    run.add_argument("--provider-arg", action="append", default=[])
    run.add_argument("--provider-timeout-seconds", type=_positive_finite_float, required=True)

    inspect = commands.add_parser("inspect", help="inspect semantic state")
    inspect.add_argument("--state", required=True)
    inspect.add_argument("--principal", required=True)
    inspect.add_argument("--json", action="store_true")

    explain = commands.add_parser("explain", help="trace one meaning to evidence and changes")
    explain.add_argument("--state", required=True)
    explain.add_argument("--principal", required=True)
    explain.add_argument("meaning_id")

    correct = commands.add_parser("correct", help="supersede a current fact or preference")
    correct.add_argument("--state", required=True)
    correct.add_argument("--principal", required=True)
    correct.add_argument("meaning_id")
    correct.add_argument("--text", required=True)
    correct.add_argument("--reason", required=True)

    check = commands.add_parser("check", help="validate canonical state without rendering payloads")
    check.add_argument("--state", required=True)
    return root


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "init":
            StateStore(args.state).create(initial_state(args.name, args.principal))
            print("initialized schema v1 continuity state")
        elif args.command == "run":
            return _run(args, sys.stdin, sys.stdout, sys.stderr)
        elif args.command == "inspect":
            state = _load_for_principal(StateStore(args.state), args.principal)
            view = inspection_view(state)
            if args.json:
                print(json.dumps(view, ensure_ascii=False, indent=2, sort_keys=True))
            else:
                _render_inspection(view, sys.stdout)
        elif args.command == "explain":
            state = _load_for_principal(StateStore(args.state), args.principal)
            print(json.dumps(explanation_view(state, args.meaning_id), ensure_ascii=False, indent=2, sort_keys=True))
        elif args.command == "correct":
            store = StateStore(args.state)
            with store.writer():
                state = _load_for_principal(store, args.principal)
                candidate = deepcopy(state)
                replacement_id = supersede(
                    candidate, args.principal, args.meaning_id, args.text, reason=args.reason
                )
                store.commit(state["revision"], candidate)
            print(replacement_id)
        elif args.command == "check":
            state = StateStore(args.state).load()
            print(f"valid schema v1 revision {state['revision']}")
        return 0
    except EmberError as error:
        print(f"ember: {error}", file=sys.stderr)
        return 2


def _run(args: argparse.Namespace, input_stream: TextIO, output: TextIO, error: TextIO) -> int:
    store = StateStore(args.state)
    with store.writer():
        state = _load_for_principal(store, args.principal)
        started, runtime_id = start_runtime(state, args.principal, args.scope)
        state = store.commit(state["revision"], started)
        output.write(f"runtime {runtime_id} started\n")
        output.flush()
        stop_reason = "input_eof"
        for raw_line in input_stream:
            line = raw_line.rstrip("\r\n")
            if not line.strip():
                continue
            if line == ":quit":
                stop_reason = "explicit_cli_exit"
                break
            try:
                if line.startswith(":"):
                    if line.startswith(":ask "):
                        state, provider_failure = _ask(args, store, state, runtime_id, line, output)
                        if provider_failure:
                            print(f"provider: {provider_failure}", file=error)
                    else:
                        state, result_id = _semantic_command(
                            store, state, runtime_id, args.principal, args.scope, line
                        )
                        output.write(result_id + "\n")
                        output.flush()
                else:
                    state, provider_failure = run_cognition(
                        store,
                        state,
                        runtime_id=runtime_id,
                        principal=args.principal,
                        scope=args.scope,
                        text=line,
                        command=args.provider_command,
                        arguments=args.provider_arg,
                        timeout_seconds=args.provider_timeout_seconds,
                        output=output,
                    )
                    if provider_failure:
                        print(f"provider: {provider_failure}", file=error)
            except EmberError as command_error:
                print(f"command rejected: {command_error}", file=error)
        stopped = stop_runtime(state, runtime_id, reason=stop_reason)
        store.commit(state["revision"], stopped)
    return 0


def _semantic_command(
    store: StateStore,
    state: dict[str, Any],
    runtime_id: str,
    principal: str,
    active_scope: str,
    line: str,
) -> tuple[dict[str, Any], str]:
    parts = _split_command(line)
    candidate = deepcopy(state)
    if parts[:2] == [":remember", "relationship"] and len(parts) >= 5:
        result = remember_relationship(candidate, principal, parts[2], parts[3], " ".join(parts[4:]))
    elif parts[:2] == [":remember", "fact"] and len(parts) >= 6:
        result = remember_fact(candidate, principal, parts[2], parts[3], parts[4], " ".join(parts[5:]))
    elif parts and parts[0] == ":prefer" and len(parts) >= 5:
        result = remember_preference(candidate, principal, parts[1], parts[2], parts[3], " ".join(parts[4:]))
    elif parts and parts[0] == ":supersede" and len(parts) >= 3:
        result = supersede(candidate, principal, parts[1], " ".join(parts[2:]))
    elif parts and parts[0] == ":undertake" and len(parts) >= 4:
        result = undertake(candidate, principal, parts[1], parts[2], " ".join(parts[3:]))
    elif parts[:2] == [":remember", "episode"] and len(parts) >= 6:
        result = remember_episode(candidate, principal, parts[2], parts[3], parts[4], " ".join(parts[5:]))
    elif parts and parts[0] == ":attach-detail" and len(parts) >= 3:
        result = attach_detail(candidate, principal, parts[1], " ".join(parts[2:]))
    elif parts and parts[0] == ":fixture-withhold" and len(parts) == 2:
        if os.environ.get("EMBER_ENABLE_FIXTURE_FAULTS") != "1":
            raise ValidationError("fixture fault command is available only to the deterministic test harness")
        result = withhold_detail(candidate, principal, parts[1])
    else:
        raise ValidationError("unsupported or malformed semantic command")
    current_runtime = next(
        runtime for runtime in candidate["operations"]["runtime_episodes"]
        if runtime["runtime_id"] == runtime_id
    )
    if current_runtime["clean_stop_at"] is None:
        current_runtime["last_durable_observation_at"] = now_utc()
    committed = store.commit(state["revision"], candidate)
    return committed, result


def _ask(
    args: argparse.Namespace,
    store: StateStore,
    state: dict[str, Any],
    runtime_id: str,
    line: str,
    output: TextIO,
) -> tuple[dict[str, Any], str | None]:
    parts = _split_command(line)
    if len(parts) < 4 or parts[0:2] != [":ask", "--explain"]:
        raise ValidationError("expected :ask --explain ID[,ID...] TEXT")
    explain_ids = [item for item in parts[2].split(",") if item]
    if not explain_ids:
        raise ValidationError("at least one explanation ID is required")
    return run_cognition(
        store,
        state,
        runtime_id=runtime_id,
        principal=args.principal,
        scope=args.scope,
        text=" ".join(parts[3:]),
        command=args.provider_command,
        arguments=args.provider_arg,
        timeout_seconds=args.provider_timeout_seconds,
        output=output,
        purpose="explain",
        explain_ids=explain_ids,
    )


def _load_for_principal(store: StateStore, principal: str) -> dict[str, Any]:
    state = store.load()
    if principal != state["runtime_contract"]["local_principal"]:
        raise ValidationError("asserted principal does not match initialized local principal")
    return state


def _render_inspection(view: dict[str, Any], output: TextIO) -> None:
    output.write(
        f"Lineage {view['lineage']['lineage_id']} ({view['lineage']['display_name']}), revision {view['revision']}\n"
    )
    output.write("Constitutive boundaries:\n")
    for boundary in view["lineage"]["constitutive_boundaries"]:
        output.write(f"  {boundary['boundary_id']}: {boundary['text']}\n")
    for label, key in (
        ("Current meanings", "current_meanings"),
        ("Historical/superseded meanings", "historical_meanings"),
        ("Unavailable gaps", "gaps"),
        ("Runtime episodes", "runtime_episodes"),
        ("Cognition episodes", "cognition_episodes"),
    ):
        output.write(label + ":\n")
        for item in view[key]:
            output.write("  " + json.dumps(item, ensure_ascii=False, sort_keys=True) + "\n")


def _split_command(line: str) -> list[str]:
    try:
        return shlex.split(line)
    except ValueError as error:
        raise ValidationError(f"malformed quoted command: {error}") from error


def _positive_finite_float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed) or parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive finite number")
    return parsed
