"""Fresh-process, versioned cognition provider adapter."""

from __future__ import annotations

import json
import math
from pathlib import Path
import subprocess
import tempfile
from typing import Any, Sequence

from ember.errors import ProviderError


CONTRACT_VERSION = 1
MAX_STDOUT_BYTES = 1024 * 1024
MAX_STDERR_BYTES = 64 * 1024


def invoke_provider(
    command: str,
    arguments: Sequence[str],
    request: dict[str, Any],
    *,
    timeout_seconds: float,
) -> dict[str, Any]:
    if not math.isfinite(timeout_seconds) or timeout_seconds <= 0:
        raise ProviderError("provider timeout must be positive")
    wire = json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    with tempfile.TemporaryFile() as stdout_file, tempfile.TemporaryFile() as stderr_file:
        try:
            completed = subprocess.run(
                [command, *arguments],
                input=wire,
                stdout=stdout_file,
                stderr=stderr_file,
                timeout=timeout_seconds,
                check=False,
                shell=False,
            )
        except subprocess.TimeoutExpired as error:
            stderr_file.seek(0)
            diagnostic = _diagnostic(stderr_file.read(MAX_STDERR_BYTES))
            suffix = f": {diagnostic}" if diagnostic else ""
            raise ProviderError(f"provider timed out{suffix}", outcome="timed_out") from error
        except OSError as error:
            raise ProviderError(f"provider is unavailable: {error}", outcome="failed") from error
        stdout_file.seek(0)
        stdout = stdout_file.read(MAX_STDOUT_BYTES + 1)
        stderr_file.seek(0)
        stderr = stderr_file.read(MAX_STDERR_BYTES)

    diagnostic = _diagnostic(stderr)
    if completed.returncode != 0:
        suffix = f": {diagnostic}" if diagnostic else ""
        raise ProviderError(
            f"provider exited with status {completed.returncode}{suffix}", outcome="failed"
        )
    if len(stdout) > MAX_STDOUT_BYTES:
        raise ProviderError("provider stdout exceeds 1 MiB", outcome="failed")
    try:
        text = stdout.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ProviderError("provider stdout is not UTF-8", outcome="failed") from error
    decoder = json.JSONDecoder()
    try:
        result, end = decoder.raw_decode(text)
    except json.JSONDecodeError as error:
        raise ProviderError(f"provider stdout is not one JSON object: {error}", outcome="failed") from error
    if text[end:].strip():
        raise ProviderError("provider emitted extra stdout after its JSON object", outcome="failed")
    validate_result(result, set(request["projection"]["selection"]["meaning_ids"]))
    return result


def validate_result(result: Any, selected_meaning_ids: set[str]) -> None:
    if not isinstance(result, dict):
        raise ProviderError("provider result must be an object", outcome="failed")
    if set(result) != {"contract_version", "reply", "used_meaning_ids"}:
        raise ProviderError("provider result contains missing or unsupported fields", outcome="failed")
    if type(result.get("contract_version")) is not int or result.get("contract_version") != CONTRACT_VERSION:
        raise ProviderError("provider result contract_version is unsupported", outcome="failed")
    if not isinstance(result.get("reply"), str) or not result["reply"].strip():
        raise ProviderError("provider reply must be non-empty", outcome="failed")
    used = result.get("used_meaning_ids")
    if not isinstance(used, list) or not all(isinstance(value, str) for value in used):
        raise ProviderError("used_meaning_ids must be a string list", outcome="failed")
    if len(used) != len(set(used)):
        raise ProviderError("used_meaning_ids must not contain duplicates", outcome="failed")
    if not set(used).issubset(selected_meaning_ids):
        raise ProviderError("provider claimed a meaning outside its projection", outcome="failed")


def provider_label(command: str) -> str:
    return Path(command).name or command


def _diagnostic(payload: bytes | str | None) -> str:
    if payload is None:
        return ""
    if isinstance(payload, str):
        payload = payload.encode("utf-8", errors="replace")
    return payload[:MAX_STDERR_BYTES].decode("utf-8", errors="replace").strip()
