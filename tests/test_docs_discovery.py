from __future__ import annotations

import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "docs_discovery.py"
spec = importlib.util.spec_from_file_location("docs_discovery", MODULE_PATH)
assert spec and spec.loader
docs_discovery = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = docs_discovery
spec.loader.exec_module(docs_discovery)


def doc_text(
    *,
    summary: str = "Useful routing summary.",
    read_when: tuple[str, ...] = ("Changing the behavior this document governs",),
    role: str = "research",
    status: str = "current",
    superseded_by: str | None = None,
    body: str = "# Title\n\n## Section\n",
) -> str:
    lines = [
        "---",
        f'summary: "{summary}"',
        "read_when:",
        *(f'  - "{hint}"' for hint in read_when),
        f"role: {role}",
        f"discovery_status: {status}",
    ]
    if superseded_by is not None:
        lines.append(f"superseded_by: {superseded_by}")
    lines.extend(["---", "", body])
    return "\n".join(lines)


class DocsDiscoveryTests(unittest.TestCase):
    def make_repo(self) -> tuple[tempfile.TemporaryDirectory[str], Path]:
        temp = tempfile.TemporaryDirectory()
        root = Path(temp.name)
        (root / "README.md").write_text("# Repo\n", encoding="utf-8")
        (root / "docs").mkdir()
        return temp, root

    def write_doc(self, root: Path, relative: str, content: str) -> Path:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_parses_documented_frontmatter_subset_and_preserves_hint_order(self) -> None:
        metadata, body = docs_discovery.parse_frontmatter(
            doc_text(read_when=("First task", "Second task"), body="# Body\n")
        )
        self.assertEqual(metadata["summary"], "Useful routing summary.")
        self.assertEqual(metadata["read_when"], ["First task", "Second task"])
        self.assertEqual(metadata["role"], "research")
        self.assertEqual(body, "\n# Body\n")

    def test_allows_unrelated_simple_frontmatter_fields_for_role_specific_lifecycle(self) -> None:
        text = doc_text().replace("role: research", "status: accepted\nrole: decision")
        metadata, _ = docs_discovery.parse_frontmatter(text)
        self.assertEqual(metadata["status"], "accepted")
        self.assertEqual(metadata["role"], "decision")

    def test_rejects_missing_or_unsupported_frontmatter(self) -> None:
        with self.assertRaises(docs_discovery.FrontmatterError):
            docs_discovery.parse_frontmatter("# No frontmatter\n")
        with self.assertRaises(docs_discovery.FrontmatterError):
            docs_discovery.parse_frontmatter("---\nsummary: [inline]\n---\n# Title\n")
        with self.assertRaises(docs_discovery.FrontmatterError):
            docs_discovery.parse_frontmatter("---\nsummary: x\n# no terminator\n")

    def test_validates_required_fields_duplicate_hints_and_status_rules(self) -> None:
        metadata, body = docs_discovery.parse_frontmatter(
            doc_text(
                summary=" ",
                read_when=("Same", " Same "),
                role="unknown",
                status="historical",
                superseded_by="docs/new.md",
            )
        )
        document = docs_discovery.Document("docs/bad.md", metadata, body)
        errors = docs_discovery.validate_document_shape(document)
        joined = "\n".join(errors)
        self.assertIn("summary must be a non-empty string", joined)
        self.assertIn("exact duplicate", joined)
        self.assertIn("role must be one of", joined)
        self.assertIn("superseded_by is only allowed", joined)

    def test_validates_supersession_target_and_cycle(self) -> None:
        temp, root = self.make_repo()
        with temp:
            self.write_doc(
                root,
                "docs/old.md",
                doc_text(status="superseded", superseded_by="docs/new.md", role="design"),
            )
            self.write_doc(root, "docs/new.md", doc_text(role="design"))
            documents, parse_errors = docs_discovery.load_corpus(root)
            errors, _ = docs_discovery.validate_corpus(documents, parse_errors)
            self.assertEqual(errors, [])

            self.write_doc(
                root,
                "docs/new.md",
                doc_text(status="superseded", superseded_by="docs/old.md", role="design"),
            )
            documents, parse_errors = docs_discovery.load_corpus(root)
            errors, _ = docs_discovery.validate_corpus(documents, parse_errors)
            self.assertTrue(any("supersession cycle" in error for error in errors))

    def test_filters_default_deep_and_all_without_semantic_matching(self) -> None:
        documents = []
        for path, role, status in [
            ("docs/a.md", "foundation", "current"),
            ("docs/b.md", "research", "current"),
            ("docs/c.md", "evidence", "current"),
            ("docs/d.md", "source", "current"),
            ("docs/e.md", "design", "historical"),
        ]:
            metadata, body = docs_discovery.parse_frontmatter(doc_text(role=role, status=status))
            documents.append(docs_discovery.Document(path, metadata, body))

        self.assertEqual(
            [doc.path for doc in docs_discovery.select_documents(documents)],
            ["docs/a.md", "docs/b.md"],
        )
        self.assertEqual(
            [doc.path for doc in docs_discovery.select_documents(documents, deep=True)],
            ["docs/a.md", "docs/b.md", "docs/c.md", "docs/d.md"],
        )
        self.assertEqual(
            [doc.path for doc in docs_discovery.select_documents(documents, all_documents=True)],
            ["docs/a.md", "docs/b.md", "docs/c.md", "docs/d.md", "docs/e.md"],
        )

    def test_catalogue_sorting_and_rendering_are_deterministic(self) -> None:
        documents = []
        for path in ["docs/z.md", "docs/a.md"]:
            metadata, body = docs_discovery.parse_frontmatter(doc_text())
            documents.append(docs_discovery.Document(path, metadata, body))
        first = docs_discovery.render_catalogue(docs_discovery.select_documents(documents))
        second = docs_discovery.render_catalogue(docs_discovery.select_documents(list(reversed(documents))))
        self.assertEqual(first, second)
        self.assertLess(first.index("docs/a.md"), first.index("docs/z.md"))

    def test_heading_projection_uses_h1_to_h4_and_ignores_fenced_code(self) -> None:
        body = textwrap.dedent(
            """
            # Title
            ## Visible
            ```md
            ### Hidden
            ```
            ~~~~
            #### Also hidden
            ~~~~
            #### Deep visible ####
            ##### H5 ignored
            """
        )
        self.assertEqual(
            docs_discovery.extract_headings(body),
            ["# Title", "## Visible", "#### Deep visible"],
        )

    def test_explicit_exclusions_are_applied_by_exact_repository_path(self) -> None:
        temp, root = self.make_repo()
        with temp:
            self.write_doc(root, "docs/include.md", doc_text())
            self.write_doc(root, "docs/generated.md", "generated without frontmatter\n")
            documents, parse_errors = docs_discovery.load_corpus(
                root, frozenset({"docs/generated.md"})
            )
            errors, _ = docs_discovery.validate_corpus(documents, parse_errors)
            self.assertEqual(errors, [])
            self.assertEqual([doc.path for doc in documents], ["docs/include.md"])

    def test_missing_metadata_cannot_silently_disappear_from_corpus(self) -> None:
        temp, root = self.make_repo()
        with temp:
            self.write_doc(root, "docs/good.md", doc_text())
            self.write_doc(root, "docs/bad.md", "# Missing frontmatter\n")
            documents, parse_errors = docs_discovery.load_corpus(root)
            errors, _ = docs_discovery.validate_corpus(documents, parse_errors)
            self.assertEqual([doc.path for doc in documents], ["docs/good.md"])
            self.assertTrue(any("docs/bad.md" in error for error in errors))

    def test_heading_projection_rejects_non_participating_or_invalid_paths(self) -> None:
        temp, root = self.make_repo()
        with temp:
            self.write_doc(root, "docs/good.md", doc_text())
            _, errors = docs_discovery.render_headings(root, ["README.md", "docs/../README.md"])
            self.assertEqual(len(errors), 2)

    def test_cli_fails_actionably_when_not_run_from_repository_root(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            completed = subprocess.run(
                [sys.executable, str(MODULE_PATH), "check"],
                cwd=temp,
                text=True,
                capture_output=True,
                check=False,
            )
        self.assertEqual(completed.returncode, 2)
        self.assertIn("run from the Ember repository root", completed.stderr)


if __name__ == "__main__":
    unittest.main()
