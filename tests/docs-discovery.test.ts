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
} from "../scripts/docs-discovery.ts";

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(TEST_ROOT, "../scripts/docs-discovery.ts");
const REPOSITORY_ROOT = resolve(TEST_ROOT, "..");

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

test("preserves CRLF body bytes and treats plain scalars literally", () => {
    const text =
        "---\r\nsummary: literal # not a comment\r\nread_when:\r\n  - quoted: text\r\nrole: guide\r\ndiscovery_status: current\r\n---\r\n\r\n# Body\r\nText\r\n";
    const { metadata, body } = parseFrontmatter(text);
    assert.equal(metadata.summary, "literal # not a comment");
    assert.deepEqual(metadata.read_when, ["quoted: text"]);
    assert.equal(body, "\r\n# Body\r\nText\r\n");
});

test("rejects unsupported YAML forms and malformed subset syntax", () => {
    const invalidFrontmatter = [
        "summary: [inline]",
        "summary: {nested: mapping}",
        "summary: &anchor value",
        "summary: *alias",
        "summary: |\n  block",
        "summary: >\n  folded",
        "summary:\n    - over-indented",
        "summary: value\n  nested: mapping",
        "summary: one\nsummary: two",
        "summary: 'unterminated",
        'summary: "unterminated',
    ];
    for (const frontmatter of invalidFrontmatter) {
        assert.throws(() => parseFrontmatter(`---\n${frontmatter}\n---\n# Title\n`), FrontmatterError, frontmatter);
    }
});

test("rejects missing or unterminated frontmatter", () => {
    assert.throws(() => parseFrontmatter("# No frontmatter\n"), FrontmatterError);
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

test("heading projection uses one-to-three-space indentation and line-oriented Markdown contexts", () => {
    const body = `
# Title
 ## One space
  ### Two spaces with *inline* [link](target) ###
   #### Three spaces
    ## Four spaces ignored
- ## List context ignored
<div>
### HTML context remains visible
</div>
\`\`\`md
### Hidden
\`\`\`
~~~unusual-info
#### Also hidden
~~~
#### Deep visible ####
##### H5 ignored
`;
    assert.deepEqual(extractHeadings(body), [
        "# Title",
        "## One space",
        "### Two spaces with *inline* [link](target)",
        "#### Three spaces",
        "### HTML context remains visible",
        "#### Deep visible",
    ]);
});

test("heading fences require matching markers, sufficient length, and bare closing lines", () => {
    const body = [
        "````nonstandard info",
        "### Hidden",
        "```",
        "#### Still hidden after short close",
        "```` trailing text",
        "## Still hidden after decorated close",
        "`````   ",
        "## Visible",
    ].join("\n");
    assert.deepEqual(extractHeadings(body), ["## Visible"]);
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

function runCli(...args) {
    return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
        cwd: REPOSITORY_ROOT,
        encoding: "utf8",
    });
}

test("CLI supports default, deep, and all catalogue modes", () => {
    const defaultResult = runCli("list");
    const deepResult = runCli("list", "--deep");
    const allResult = runCli("list", "--all");
    assert.equal(defaultResult.status, 0);
    assert.equal(deepResult.status, 0);
    assert.equal(allResult.status, 0);
    assert.ok(deepResult.stdout.length > defaultResult.stdout.length);
    assert.ok(allResult.stdout.length > deepResult.stdout.length);
});

test("CLI reports usage errors with exit code 2", () => {
    for (const [args, diagnostic] of [
        [[], /Usage:/],
        [["unknown"], /unknown command: unknown/],
        [["check", "--deep"], /check does not accept arguments/],
        [["list", "--unknown"], /unknown argument: --unknown/],
        [["list", "--deep", "--all"], /mutually exclusive/],
        [["list", "--headings"], /requires at least one PATH/],
        [["list", "--deep", "--headings", "docs/vision.md"], /cannot be combined/],
    ]) {
        const completed = runCli(...args);
        assert.equal(completed.status, 2, args.join(" "));
        assert.match(completed.stderr, diagnostic);
    }
});

test("CLI treats every argument following --headings as a requested path", () => {
    const completed = runCli("list", "--headings", "docs/vision.md", "docs/missing.md", "--deep");
    assert.equal(completed.status, 1);
    assert.match(completed.stdout, /^docs\/vision\.md\n/m);
    assert.match(completed.stderr, /docs\/missing\.md: participating document does not exist/);
    assert.match(completed.stderr, /heading paths must be participating docs\/\*\*\/\*\.md files: --deep/);
});
