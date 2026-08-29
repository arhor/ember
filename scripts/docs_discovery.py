#!/usr/bin/env python3
"""Deterministic, zero-dependency documentation discovery for Ember."""

from __future__ import annotations

import argparse
import ast
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
import re
import sys
from typing import Iterable, Mapping, Sequence

ALLOWED_ROLES = frozenset(
    {
        "foundation",
        "decision",
        "design",
        "scenario",
        "research",
        "guide",
        "reference",
        "evidence",
        "source",
    }
)
DEFAULT_ROLES = frozenset({"foundation", "decision", "design", "scenario", "research", "guide"})
DEEP_ROLES = frozenset({"reference", "evidence", "source"})
ALLOWED_DISCOVERY_STATUSES = frozenset({"current", "superseded", "historical"})

# V1 has no generated Markdown exclusions. Keep exclusions explicit here if that changes.
EXCLUDED_PATHS: frozenset[str] = frozenset()

_FRONTMATTER_DELIMITER = "---"
_TOP_LEVEL_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$")
_LIST_ITEM_RE = re.compile(r"^  -(?:\s+(.*))?$")
_FENCE_OPEN_RE = re.compile(r"^[ ]{0,3}(`{3,}|~{3,})(?:.*)$")
_HEADING_RE = re.compile(r"^[ ]{0,3}(#{1,4})\s+(.+?)\s*$")


class FrontmatterError(ValueError):
    """Raised when a document uses unsupported or malformed frontmatter."""


@dataclass(frozen=True)
class Document:
    path: str
    metadata: Mapping[str, object]
    body: str

    @property
    def summary(self) -> str:
        return str(self.metadata["summary"])

    @property
    def read_when(self) -> tuple[str, ...]:
        value = self.metadata["read_when"]
        assert isinstance(value, list)
        return tuple(str(item) for item in value)

    @property
    def role(self) -> str:
        return str(self.metadata["role"])

    @property
    def discovery_status(self) -> str:
        return str(self.metadata["discovery_status"])

    @property
    def superseded_by(self) -> str | None:
        value = self.metadata.get("superseded_by")
        return str(value) if value is not None else None


def _parse_scalar(raw: str, *, line_number: int) -> str:
    value = raw.strip()
    if not value:
        raise FrontmatterError(f"line {line_number}: expected a non-empty scalar value")
    if value[0] in {'"', "'"}:
        try:
            parsed = ast.literal_eval(value)
        except (SyntaxError, ValueError) as exc:
            raise FrontmatterError(f"line {line_number}: invalid quoted string") from exc
        if not isinstance(parsed, str):
            raise FrontmatterError(f"line {line_number}: quoted scalar must be a string")
        return parsed
    if value[0] in "[{&*!>|" or value in {"---", "..."}:
        raise FrontmatterError(
            f"line {line_number}: unsupported YAML construct; use plain or quoted strings and block lists"
        )
    return value


def parse_frontmatter(text: str) -> tuple[dict[str, object], str]:
    """Parse Ember's documented YAML subset and return metadata plus body."""
    lines = text.splitlines(keepends=True)
    if not lines or lines[0].rstrip("\r\n") != _FRONTMATTER_DELIMITER:
        raise FrontmatterError("frontmatter must start on the first line with '---'")

    closing_index: int | None = None
    for index in range(1, len(lines)):
        if lines[index].rstrip("\r\n") == _FRONTMATTER_DELIMITER:
            closing_index = index
            break
    if closing_index is None:
        raise FrontmatterError("frontmatter is missing its closing '---'")

    metadata: dict[str, object] = {}
    active_list_key: str | None = None

    for index in range(1, closing_index):
        line_number = index + 1
        line = lines[index].rstrip("\r\n")
        if not line.strip():
            continue

        list_match = _LIST_ITEM_RE.match(line)
        if list_match:
            if active_list_key is None:
                raise FrontmatterError(f"line {line_number}: list item has no preceding list key")
            item_raw = list_match.group(1) or ""
            item = _parse_scalar(item_raw, line_number=line_number)
            current = metadata[active_list_key]
            assert isinstance(current, list)
            current.append(item)
            continue

        if line.startswith((" ", "\t")):
            raise FrontmatterError(
                f"line {line_number}: unsupported indentation; lists must use exactly two spaces before '-'"
            )

        field_match = _TOP_LEVEL_RE.match(line)
        if not field_match:
            raise FrontmatterError(
                f"line {line_number}: unsupported frontmatter syntax; use 'key: value' or a block list"
            )

        key, raw_value = field_match.groups()
        if key in metadata:
            raise FrontmatterError(f"line {line_number}: duplicate frontmatter key '{key}'")

        if raw_value is None or not raw_value.strip():
            metadata[key] = []
            active_list_key = key
        else:
            metadata[key] = _parse_scalar(raw_value, line_number=line_number)
            active_list_key = None

    body = "".join(lines[closing_index + 1 :])
    return metadata, body


def parse_document(path: Path, root: Path) -> Document:
    relative = path.relative_to(root).as_posix()
    metadata, body = parse_frontmatter(path.read_text(encoding="utf-8"))
    return Document(path=relative, metadata=metadata, body=body)


def discover_paths(root: Path, excluded_paths: frozenset[str] = EXCLUDED_PATHS) -> list[Path]:
    docs_root = root / "docs"
    paths = [path for path in docs_root.rglob("*.md") if path.is_file()]
    return sorted(
        (path for path in paths if path.relative_to(root).as_posix() not in excluded_paths),
        key=lambda path: path.relative_to(root).as_posix(),
    )


def _validate_repo_relative_path(value: str, *, field: str, document_path: str) -> str | None:
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not value.startswith("docs/"):
        return f"{document_path}: {field} must be a normalized repository-relative path under docs/"
    if path.as_posix() != value:
        return f"{document_path}: {field} must use normalized '/' separators"
    return None


def validate_document_shape(document: Document) -> list[str]:
    metadata = document.metadata
    errors: list[str] = []

    summary = metadata.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        errors.append(f"{document.path}: summary must be a non-empty string")
    elif "\n" in summary or "\r" in summary:
        errors.append(f"{document.path}: summary must be single-line")

    read_when = metadata.get("read_when")
    if not isinstance(read_when, list) or not read_when:
        errors.append(f"{document.path}: read_when must be a non-empty block list")
    else:
        normalized_hints: list[str] = []
        for index, hint in enumerate(read_when, start=1):
            if not isinstance(hint, str) or not hint.strip():
                errors.append(f"{document.path}: read_when item {index} must be a non-empty string")
                continue
            normalized_hints.append(hint.strip())
        if len(normalized_hints) != len(set(normalized_hints)):
            errors.append(f"{document.path}: read_when contains an exact duplicate after trimming")

    role = metadata.get("role")
    if role not in ALLOWED_ROLES:
        errors.append(
            f"{document.path}: role must be one of {', '.join(sorted(ALLOWED_ROLES))}"
        )

    status = metadata.get("discovery_status")
    if status not in ALLOWED_DISCOVERY_STATUSES:
        errors.append(
            f"{document.path}: discovery_status must be one of {', '.join(sorted(ALLOWED_DISCOVERY_STATUSES))}"
        )

    superseded_by = metadata.get("superseded_by")
    if status == "superseded":
        if not isinstance(superseded_by, str) or not superseded_by.strip():
            errors.append(f"{document.path}: superseded documents require superseded_by")
        else:
            path_error = _validate_repo_relative_path(
                superseded_by, field="superseded_by", document_path=document.path
            )
            if path_error:
                errors.append(path_error)
            if superseded_by == document.path:
                errors.append(f"{document.path}: superseded_by cannot point to the document itself")
    elif superseded_by is not None:
        errors.append(
            f"{document.path}: superseded_by is only allowed when discovery_status is superseded"
        )

    return errors


def load_corpus(root: Path, excluded_paths: frozenset[str] = EXCLUDED_PATHS) -> tuple[list[Document], list[str]]:
    documents: list[Document] = []
    errors: list[str] = []
    for path in discover_paths(root, excluded_paths):
        relative = path.relative_to(root).as_posix()
        try:
            document = parse_document(path, root)
        except (OSError, UnicodeError, FrontmatterError) as exc:
            errors.append(f"{relative}: {exc}")
            continue
        documents.append(document)
        errors.extend(validate_document_shape(document))
    return documents, errors


def validate_corpus(documents: Sequence[Document], errors: list[str]) -> tuple[list[str], list[str]]:
    by_path = {document.path: document for document in documents}
    validation_errors = list(errors)
    warnings: list[str] = []

    for document in documents:
        target_path = document.superseded_by
        if not target_path:
            continue
        target = by_path.get(target_path)
        if target is None:
            validation_errors.append(
                f"{document.path}: superseded_by target '{target_path}' is not a participating document"
            )
            continue
        if target.discovery_status == "historical":
            validation_errors.append(
                f"{document.path}: superseded_by target '{target_path}' cannot be historical"
            )

    for document in documents:
        if document.discovery_status != "superseded" or not document.superseded_by:
            continue
        visited: list[str] = []
        current = document
        while current.discovery_status == "superseded" and current.superseded_by:
            if current.path in visited:
                cycle = " -> ".join(visited + [current.path])
                validation_errors.append(f"{document.path}: supersession cycle detected: {cycle}")
                break
            visited.append(current.path)
            next_document = by_path.get(current.superseded_by)
            if next_document is None:
                break
            current = next_document
        else:
            if current.discovery_status != "current":
                validation_errors.append(
                    f"{document.path}: supersession chain must terminate at a current document"
                )

    hint_owners: dict[str, list[str]] = {}
    for document in documents:
        read_when = document.metadata.get("read_when")
        if not isinstance(read_when, list):
            continue
        for hint in read_when:
            if isinstance(hint, str) and hint.strip():
                hint_owners.setdefault(hint.strip(), []).append(document.path)
    for hint, owners in sorted(hint_owners.items()):
        if len(owners) > 1:
            warnings.append(
                f"duplicate read_when hint across documents: {hint!r} ({', '.join(sorted(owners))})"
            )

    return sorted(set(validation_errors)), warnings


def select_documents(documents: Sequence[Document], *, deep: bool = False, all_documents: bool = False) -> list[Document]:
    ordered = sorted(documents, key=lambda document: document.path)
    if all_documents:
        return ordered
    allowed_roles = DEFAULT_ROLES | (DEEP_ROLES if deep else frozenset())
    return [
        document
        for document in ordered
        if document.discovery_status == "current" and document.role in allowed_roles
    ]


def render_catalogue(documents: Sequence[Document]) -> str:
    blocks: list[str] = []
    for document in documents:
        lines = [
            f"{document.path} [{document.role}, {document.discovery_status}]",
            f"  Summary: {document.summary}",
            f"  Read when: {'; '.join(document.read_when)}",
        ]
        if document.superseded_by:
            lines.append(f"  Superseded by: {document.superseded_by}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def extract_headings(body: str) -> list[str]:
    headings: list[str] = []
    fence_char: str | None = None
    fence_length = 0

    for raw_line in body.splitlines():
        if fence_char is not None:
            stripped = raw_line.lstrip(" ")
            if len(raw_line) - len(stripped) <= 3:
                match = re.match(rf"^{re.escape(fence_char)}{{{fence_length},}}\s*$", stripped)
                if match:
                    fence_char = None
                    fence_length = 0
            continue

        fence_match = _FENCE_OPEN_RE.match(raw_line)
        if fence_match:
            marker = fence_match.group(1)
            fence_char = marker[0]
            fence_length = len(marker)
            continue

        heading_match = _HEADING_RE.match(raw_line)
        if not heading_match:
            continue
        hashes, title = heading_match.groups()
        title = re.sub(r"\s+#+\s*$", "", title).strip()
        if title:
            headings.append(f"{hashes} {title}")

    return headings


def _normalize_requested_path(raw: str) -> str:
    value = raw.replace("\\", "/")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or path.as_posix() != value:
        raise ValueError(f"invalid repository-relative path: {raw}")
    if not value.startswith("docs/") or path.suffix != ".md":
        raise ValueError(f"heading paths must be participating docs/**/*.md files: {raw}")
    if value in EXCLUDED_PATHS:
        raise ValueError(f"path is excluded from discovery: {raw}")
    return value


def render_headings(root: Path, requested_paths: Sequence[str]) -> tuple[str, list[str]]:
    blocks: list[str] = []
    errors: list[str] = []
    for raw in requested_paths:
        try:
            relative = _normalize_requested_path(raw)
        except ValueError as exc:
            errors.append(str(exc))
            continue
        path = root / relative
        if not path.is_file():
            errors.append(f"{relative}: participating document does not exist")
            continue
        try:
            document = parse_document(path, root)
        except (OSError, UnicodeError, FrontmatterError) as exc:
            errors.append(f"{relative}: {exc}")
            continue
        shape_errors = validate_document_shape(document)
        if shape_errors:
            errors.extend(shape_errors)
            continue
        headings = extract_headings(document.body)
        lines = [relative]
        lines.extend(f"  {heading}" for heading in headings)
        if not headings:
            lines.append("  (no H1-H4 headings)")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks) + ("\n" if blocks else ""), errors


def _print_diagnostics(errors: Iterable[str], warnings: Iterable[str]) -> None:
    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    for error in errors:
        print(f"error: {error}", file=sys.stderr)


def _ensure_repo_root(root: Path) -> str | None:
    expected_root = Path(__file__).resolve().parent.parent
    try:
        actual_root = root.resolve()
    except OSError as exc:
        return f"cannot resolve current directory: {exc}"
    if actual_root != expected_root:
        return f"run from the Ember repository root: {expected_root}"
    if not (root / "README.md").is_file() or not (root / "docs").is_dir():
        return "repository root is missing README.md or docs/"
    return None


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="render the deterministic documentation catalogue")
    mode = list_parser.add_mutually_exclusive_group()
    mode.add_argument("--deep", action="store_true", help="include current reference/evidence/source documents")
    mode.add_argument("--all", action="store_true", help="include all roles and discovery statuses")
    list_parser.add_argument(
        "--headings",
        nargs="+",
        metavar="PATH",
        help="render H1-H4 headings for explicitly selected participating documents",
    )

    subparsers.add_parser("check", help="validate the complete participating documentation corpus")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    root = Path.cwd()
    root_error = _ensure_repo_root(root)
    if root_error:
        print(f"error: {root_error}", file=sys.stderr)
        return 2

    args = _build_parser().parse_args(argv)

    if args.command == "list" and args.headings:
        if args.deep or args.all:
            print("error: --headings cannot be combined with --deep or --all", file=sys.stderr)
            return 2
        output, errors = render_headings(root, args.headings)
        if output:
            sys.stdout.write(output)
        _print_diagnostics(errors, [])
        return 1 if errors else 0

    documents, parse_errors = load_corpus(root)
    errors, warnings = validate_corpus(documents, parse_errors)
    _print_diagnostics(errors, warnings)

    if args.command == "check":
        if errors:
            return 1
        print(f"OK: {len(documents)} participating documentation files validated.")
        return 0

    if errors:
        return 1
    selected = select_documents(documents, deep=args.deep, all_documents=args.all)
    sys.stdout.write(render_catalogue(selected))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
