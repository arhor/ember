import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    Document,
    FrontmatterError,
    extractHeadings,
    loadCorpus,
    parseFrontmatter,
    renderCatalogue,
    renderHeadings,
    selectDocuments,
    validateCorpus,
    validateDocumentShape,
} from "../scripts/docs-discovery.mjs";

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(TEST_ROOT, "../scripts/docs-discovery.mjs");

function docText({
    summary = "Useful routing summary.",
    readWhen = ["Changing the behavior this document governs"],
    role = "research",
    status = "current",
    supersededBy = null,
    body = "# Title\n\n## Section\n",
} = {}) {
    const lines = [
        "---",
        `summary: ${JSON.stringify(summary)}`,
        "read_when:",
        ...readWhen.map((hint) => `  - ${JSON.stringify(hint)}`),
        `role: ${role}`,
        `discovery_status: ${status}`,
    ];
    if (supersededBy !== null) {
        lines.push(`superseded_by: ${supersededBy}`);
    }
    lines.push("---", "", body);
    return lines.join("\n");
}

function makeRepo() {
    const root = mkdtempSync(join(tmpdir(), "ember-docs-"));
    writeFileSync(join(root, "README.md"), "# Repo\n", "utf8");
    mkdirSync(join(root, "docs"));
    return root;
}

function writeDoc(root, relativePath, content) {
    const path = join(root, ...relativePath.split("/"));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
    return path;
}

function withRepo(fn) {
    const root = makeRepo();
    try {
        fn(root);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
}

test("parses documented frontmatter subset and preserves hint order", () => {
    const { metadata, body } = parseFrontmatter(docText({ readWhen: ["First task", "Second task"], body: "# Body\n" }));
    assert.equal(metadata.summary, "Useful routing summary.");
    assert.deepEqual(metadata.read_when, ["First task", "Second task"]);
    assert.equal(metadata.role, "research");
    assert.equal(body, "\n# Body\n");
});

test("allows unrelated simple frontmatter fields for role-specific lifecycle", () => {
    const text = docText().replace("role: research", "status: accepted\nrole: decision");
    const { metadata } = parseFrontmatter(text);
    assert.equal(metadata.status, "accepted");
    assert.equal(metadata.role, "decision");
});

test("supports YAML-style single quoted scalar strings", () => {
    const { metadata } = parseFrontmatter(
        docText().replace('summary: "Useful routing summary."', "summary: 'Reader''s routing summary.'"),
    );
    assert.equal(metadata.summary, "Reader's routing summary.");
});

test("rejects missing, unsupported, or unterminated frontmatter", () => {
    assert.throws(() => parseFrontmatter("# No frontmatter\n"), FrontmatterError);
    assert.throws(() => parseFrontmatter("---\nsummary: [inline]\n---\n# Title\n"), FrontmatterError);
    assert.throws(() => parseFrontmatter("---\nsummary: x\n# no terminator\n"), FrontmatterError);
});

test("validates required fields, duplicate hints, and status rules", () => {
    const { metadata, body } = parseFrontmatter(
        docText({
            summary: " ",
            readWhen: ["Same", " Same "],
            role: "unknown",
            status: "historical",
            supersededBy: "docs/new.md",
        }),
    );
    const errors = validateDocumentShape(new Document("docs/bad.md", metadata, body));
    const joined = errors.join("\n");
    assert.match(joined, /summary must be a non-empty string/);
    assert.match(joined, /exact duplicate/);
    assert.match(joined, /role must be one of/);
    assert.match(joined, /superseded_by is only allowed/);
});

test("validates supersession target and cycle", () => {
    withRepo((root) => {
        writeDoc(root, "docs/old.md", docText({ status: "superseded", supersededBy: "docs/new.md", role: "design" }));
        writeDoc(root, "docs/new.md", docText({ role: "design" }));
        let loaded = loadCorpus(root);
        let validation = validateCorpus(loaded.documents, loaded.errors);
        assert.deepEqual(validation.errors, []);

        writeDoc(root, "docs/new.md", docText({ status: "superseded", supersededBy: "docs/old.md", role: "design" }));
        loaded = loadCorpus(root);
        validation = validateCorpus(loaded.documents, loaded.errors);
        assert.ok(validation.errors.some((error) => error.includes("supersession cycle")));
    });
});

test("filters default, deep, and all without semantic matching", () => {
    const documents = [
        ["docs/a.md", "foundation", "current"],
        ["docs/b.md", "research", "current"],
        ["docs/c.md", "evidence", "current"],
        ["docs/d.md", "source", "current"],
        ["docs/e.md", "design", "historical"],
    ].map(([path, role, status]) => {
        const { metadata, body } = parseFrontmatter(docText({ role, status }));
        return new Document(path, metadata, body);
    });

    assert.deepEqual(
        selectDocuments(documents).map((doc) => doc.path),
        ["docs/a.md", "docs/b.md"],
    );
    assert.deepEqual(
        selectDocuments(documents, { deep: true }).map((doc) => doc.path),
        ["docs/a.md", "docs/b.md", "docs/c.md", "docs/d.md"],
    );
    assert.deepEqual(
        selectDocuments(documents, { allDocuments: true }).map((doc) => doc.path),
        ["docs/a.md", "docs/b.md", "docs/c.md", "docs/d.md", "docs/e.md"],
    );
});

test("catalogue sorting and rendering are deterministic", () => {
    const documents = ["docs/z.md", "docs/a.md"].map((path) => {
        const { metadata, body } = parseFrontmatter(docText());
        return new Document(path, metadata, body);
    });
    const first = renderCatalogue(selectDocuments(documents));
    const second = renderCatalogue(selectDocuments([...documents].reverse()));
    assert.equal(first, second);
    assert.ok(first.indexOf("docs/a.md") < first.indexOf("docs/z.md"));
});

test("heading projection uses H1-H4 and ignores fenced code", () => {
    const body = `
# Title
## Visible
\`\`\`md
### Hidden
\`\`\`
~~~~
#### Also hidden
~~~~
#### Deep visible ####
##### H5 ignored
`;
    assert.deepEqual(extractHeadings(body), ["# Title", "## Visible", "#### Deep visible"]);
});

test("explicit exclusions are applied by exact repository path", () => {
    withRepo((root) => {
        writeDoc(root, "docs/include.md", docText());
        writeDoc(root, "docs/generated.md", "generated without frontmatter\n");
        const loaded = loadCorpus(root, new Set(["docs/generated.md"]));
        const validation = validateCorpus(loaded.documents, loaded.errors);
        assert.deepEqual(validation.errors, []);
        assert.deepEqual(
            loaded.documents.map((doc) => doc.path),
            ["docs/include.md"],
        );
    });
});

test("missing metadata cannot silently disappear from corpus", () => {
    withRepo((root) => {
        writeDoc(root, "docs/good.md", docText());
        writeDoc(root, "docs/bad.md", "# Missing frontmatter\n");
        const loaded = loadCorpus(root);
        const validation = validateCorpus(loaded.documents, loaded.errors);
        assert.deepEqual(
            loaded.documents.map((doc) => doc.path),
            ["docs/good.md"],
        );
        assert.ok(validation.errors.some((error) => error.includes("docs/bad.md")));
    });
});

test("heading projection rejects non-participating or invalid paths", () => {
    withRepo((root) => {
        writeDoc(root, "docs/good.md", docText());
        const { errors } = renderHeadings(root, ["README.md", "docs/../README.md"]);
        assert.equal(errors.length, 2);
    });
});

test("CLI fails actionably when not run from repository root", () => {
    const temp = mkdtempSync(join(tmpdir(), "ember-cli-"));
    try {
        const completed = spawnSync(process.execPath, [SCRIPT_PATH, "check"], {
            cwd: temp,
            encoding: "utf8",
        });
        assert.equal(completed.status, 2);
        assert.match(completed.stderr, /run from the Ember repository root/);
    } finally {
        rmSync(temp, { recursive: true, force: true });
    }
});
