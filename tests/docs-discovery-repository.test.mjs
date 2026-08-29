import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXCLUDED_PATHS,
  loadCorpus,
  selectDocuments,
  validateCorpus,
} from "../scripts/docs-discovery.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const loaded = loadCorpus(ROOT);
const validation = validateCorpus(loaded.documents, loaded.errors);
const byPath = new Map(loaded.documents.map((document) => [document.path, document]));
const defaultPaths = new Set(selectDocuments(loaded.documents).map((document) => document.path));
const deepPaths = new Set(
  selectDocuments(loaded.documents, { deep: true }).map((document) => document.path),
);
const allPaths = new Set(
  selectDocuments(loaded.documents, { allDocuments: true }).map((document) => document.path),
);

function assertSubset(expected, actual) {
  for (const value of expected) {
    assert.ok(actual.has(value), `expected ${value} to be present`);
  }
}

test("complete repository corpus is valid without duplicate hint warnings", () => {
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.warnings, []);
});

test("representative roles and supersession match governance", () => {
  assert.equal(byPath.get("docs/vision.md").role, "foundation");
  assert.equal(byPath.get("docs/architecture/design-directions.md").role, "design");

  const initial = byPath.get("docs/architecture/initial-model.md");
  assert.equal(initial.role, "design");
  assert.equal(initial.discoveryStatus, "superseded");
  assert.equal(initial.supersededBy, "docs/architecture/design-directions.md");

  assert.equal(byPath.get("docs/research/memory-and-remembering.md").role, "research");
  assert.equal(byPath.get("docs/research/memory-and-remembering-references.md").role, "evidence");
  assert.equal(
    byPath.get("docs/research/source-material/memory-and-remembering-deep-research.md").role,
    "source",
  );
  assert.equal(byPath.get("docs/research/openclaw.md").role, "reference");
});

test("default, deep, and history views keep distinct purposes", () => {
  assertSubset(
    new Set([
      "docs/vision.md",
      "docs/principles.md",
      "docs/architecture/design-directions.md",
      "docs/documentation-discovery.md",
      "docs/documentation-discovery-guide.md",
      "docs/research/README.md",
      "docs/research/memory-and-remembering.md",
    ]),
    defaultPaths,
  );

  const deepOnlyExpected = new Set([
    "docs/documentation-discovery-evaluation.md",
    "docs/research/openclaw.md",
    "docs/research/memory-and-remembering-references.md",
    "docs/research/source-material/memory-and-remembering-deep-research.md",
  ]);
  for (const value of deepOnlyExpected) {
    assert.ok(!defaultPaths.has(value), `expected ${value} to stay out of default discovery`);
  }
  assertSubset(deepOnlyExpected, deepPaths);

  assert.ok(!defaultPaths.has("docs/architecture/initial-model.md"));
  assert.ok(!deepPaths.has("docs/architecture/initial-model.md"));
  assert.ok(allPaths.has("docs/architecture/initial-model.md"));
});

test("v1 has no generated Markdown exclusions", () => {
  assert.deepEqual(EXCLUDED_PATHS, new Set());
});
