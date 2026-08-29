from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "docs_discovery.py"
spec = importlib.util.spec_from_file_location("docs_discovery_repository_test", MODULE_PATH)
assert spec and spec.loader
docs_discovery = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = docs_discovery
spec.loader.exec_module(docs_discovery)


class RepositoryDiscoveryContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.documents, parse_errors = docs_discovery.load_corpus(ROOT)
        cls.errors, cls.warnings = docs_discovery.validate_corpus(cls.documents, parse_errors)
        cls.by_path = {document.path: document for document in cls.documents}
        cls.default = {
            document.path for document in docs_discovery.select_documents(cls.documents)
        }
        cls.deep = {
            document.path
            for document in docs_discovery.select_documents(cls.documents, deep=True)
        }
        cls.all_documents = {
            document.path
            for document in docs_discovery.select_documents(cls.documents, all_documents=True)
        }

    def test_complete_repository_corpus_is_valid_without_duplicate_hint_warnings(self) -> None:
        self.assertEqual(self.errors, [])
        self.assertEqual(self.warnings, [])

    def test_representative_roles_and_supersession_match_governance(self) -> None:
        self.assertEqual(self.by_path["docs/vision.md"].role, "foundation")
        self.assertEqual(
            self.by_path["docs/architecture/design-directions.md"].role, "design"
        )
        initial = self.by_path["docs/architecture/initial-model.md"]
        self.assertEqual(initial.role, "design")
        self.assertEqual(initial.discovery_status, "superseded")
        self.assertEqual(
            initial.superseded_by, "docs/architecture/design-directions.md"
        )
        self.assertEqual(
            self.by_path["docs/research/memory-and-remembering.md"].role,
            "research",
        )
        self.assertEqual(
            self.by_path["docs/research/memory-and-remembering-references.md"].role,
            "evidence",
        )
        self.assertEqual(
            self.by_path[
                "docs/research/source-material/memory-and-remembering-deep-research.md"
            ].role,
            "source",
        )
        self.assertEqual(self.by_path["docs/research/openclaw.md"].role, "reference")

    def test_default_deep_and_history_views_keep_distinct_purposes(self) -> None:
        default_expected = {
            "docs/vision.md",
            "docs/principles.md",
            "docs/architecture/design-directions.md",
            "docs/documentation-discovery.md",
            "docs/documentation-discovery-guide.md",
            "docs/research/README.md",
            "docs/research/memory-and-remembering.md",
        }
        self.assertTrue(default_expected <= self.default)

        deep_only_expected = {
            "docs/documentation-discovery-evaluation.md",
            "docs/research/openclaw.md",
            "docs/research/memory-and-remembering-references.md",
            "docs/research/source-material/memory-and-remembering-deep-research.md",
        }
        self.assertTrue(deep_only_expected.isdisjoint(self.default))
        self.assertTrue(deep_only_expected <= self.deep)

        self.assertNotIn("docs/architecture/initial-model.md", self.default)
        self.assertNotIn("docs/architecture/initial-model.md", self.deep)
        self.assertIn("docs/architecture/initial-model.md", self.all_documents)

    def test_v1_has_no_generated_markdown_exclusions(self) -> None:
        self.assertEqual(docs_discovery.EXCLUDED_PATHS, frozenset())


if __name__ == "__main__":
    unittest.main()
