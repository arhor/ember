"""Tiny dependency-free PEP 517 backend for the experimental slice."""

from __future__ import annotations

import base64
import csv
import hashlib
import io
import os
from pathlib import Path
import zipfile


NAME = "ember_continuity_slice"
VERSION = "0.1.0"


def _metadata() -> str:
    return (
        "Metadata-Version: 2.3\n"
        "Name: ember-continuity-slice\n"
        f"Version: {VERSION}\n"
        "Requires-Python: >=3.12\n"
        "Summary: Ember's experimental minimal continuity vertical slice\n"
    )


def prepare_metadata_for_build_wheel(metadata_directory: str, config_settings=None) -> str:
    dist_info = f"{NAME}-{VERSION}.dist-info"
    target = Path(metadata_directory, dist_info)
    target.mkdir(parents=True, exist_ok=True)
    Path(target, "METADATA").write_text(_metadata(), encoding="utf-8")
    Path(target, "WHEEL").write_text(
        "Wheel-Version: 1.0\nGenerator: ember_build\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
        encoding="utf-8",
    )
    return dist_info


def build_wheel(wheel_directory: str, config_settings=None, metadata_directory=None) -> str:
    filename = f"{NAME}-{VERSION}-py3-none-any.whl"
    target = Path(wheel_directory, filename)
    root = Path(__file__).resolve().parents[1]
    dist_info = f"{NAME}-{VERSION}.dist-info"
    records: list[tuple[str, str, str]] = []

    def add(archive: zipfile.ZipFile, path: str, payload: bytes) -> None:
        archive.writestr(path, payload)
        digest = base64.urlsafe_b64encode(hashlib.sha256(payload).digest()).rstrip(b"=").decode()
        records.append((path, f"sha256={digest}", str(len(payload))))

    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for source in sorted(Path(root, "src", "ember").glob("*.py")):
            add(archive, f"ember/{source.name}", source.read_bytes())
        add(archive, f"{dist_info}/METADATA", _metadata().encode())
        add(
            archive,
            f"{dist_info}/WHEEL",
            b"Wheel-Version: 1.0\nGenerator: ember_build\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
        )
        add(archive, f"{dist_info}/entry_points.txt", b"[console_scripts]\nember = ember.cli:main\n")
        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        writer.writerows(records + [(f"{dist_info}/RECORD", "", "")])
        archive.writestr(f"{dist_info}/RECORD", output.getvalue().encode())
    return filename


def build_sdist(sdist_directory: str, config_settings=None) -> str:
    raise RuntimeError("sdist creation is intentionally unsupported for the experimental slice")
