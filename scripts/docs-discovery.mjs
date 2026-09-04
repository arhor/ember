#!/usr/bin/env node
/** Deterministic, zero-dependency documentation discovery for Ember. */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { cwd, stderr, stdout } from "node:process";
import { dirname, extname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const ALLOWED_ROLES = new Set([
    "foundation",
    "decision",
    "design",
    "scenario",
    "research",
    "guide",
    "reference",
    "evidence",
    "source",
]);
export const DEFAULT_ROLES = new Set(["foundation", "decision", "design", "scenario", "research", "guide"]);
export const DEEP_ROLES = new Set(["reference", "evidence", "source"]);
export const ALLOWED_DISCOVERY_STATUSES = new Set(["current", "superseded", "historical"]);

// V1 has no generated Markdown exclusions. Keep exclusions explicit here if that changes.
export const EXCLUDED_PATHS = new Set();

const FRONTMATTER_DELIMITER = "---";
const TOP_LEVEL_RE = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s*(.*))?$/;
const LIST_ITEM_RE = /^  -(?:\s+(.*))?$/;
const FENCE_OPEN_RE = /^[ ]{0,3}(`{3,}|~{3,})(?:.*)$/;
const HEADING_RE = /^[ ]{0,3}(#{1,4})\s+(.+?)\s*$/;

export class FrontmatterError extends Error {
    constructor(message) {
        super(message);
        this.name = "FrontmatterError";
    }
}

export class Document {
    constructor(path, metadata, body) {
        this.path = path;
        this.metadata = metadata;
        this.body = body;
    }

    get summary() {
        return String(this.metadata.summary);
    }

    get readWhen() {
        return this.metadata.read_when.map(String);
    }

    get role() {
        return String(this.metadata.role);
    }

    get discoveryStatus() {
        return String(this.metadata.discovery_status);
    }

    get supersededBy() {
        const value = this.metadata.superseded_by;
        return value == null ? null : String(value);
    }
}

function splitLinesKeepEnds(text) {
    const lines = text.match(/[^\r\n]*(?:\r\n|\n|$)/g) ?? [];
    if (lines.at(-1) === "") {
        lines.pop();
    }
    return lines;
}

function stripLineEnding(line) {
    return line.replace(/(?:\r\n|\n)$/, "");
}

function parseQuotedString(value, lineNumber) {
    if (value.startsWith('"')) {
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed !== "string") {
                throw new Error("not a string");
            }
            return parsed;
        } catch {
            throw new FrontmatterError(`line ${lineNumber}: invalid quoted string`);
        }
    }

    if (!value.endsWith("'") || value.length < 2) {
        throw new FrontmatterError(`line ${lineNumber}: invalid quoted string`);
    }
    const inner = value.slice(1, -1);
    const invalidQuote = inner.replaceAll("''", "").includes("'");
    if (invalidQuote) {
        throw new FrontmatterError(`line ${lineNumber}: invalid quoted string`);
    }
    return inner.replaceAll("''", "'");
}

function parseScalar(raw, { lineNumber }) {
    const value = raw.trim();
    if (!value) {
        throw new FrontmatterError(`line ${lineNumber}: expected a non-empty scalar value`);
    }
    if (value.startsWith('"') || value.startsWith("'")) {
        return parseQuotedString(value, lineNumber);
    }
    if ("[{&*!>|".includes(value[0]) || value === "---" || value === "...") {
        throw new FrontmatterError(
            `line ${lineNumber}: unsupported YAML construct; use plain or quoted strings and block lists`,
        );
    }
    return value;
}

export function parseFrontmatter(text) {
    const lines = splitLinesKeepEnds(text);
    if (lines.length === 0 || stripLineEnding(lines[0]) !== FRONTMATTER_DELIMITER) {
        throw new FrontmatterError("frontmatter must start on the first line with '---'");
    }

    let closingIndex = -1;
    for (let index = 1; index < lines.length; index += 1) {
        if (stripLineEnding(lines[index]) === FRONTMATTER_DELIMITER) {
            closingIndex = index;
            break;
        }
    }
    if (closingIndex === -1) {
        throw new FrontmatterError("frontmatter is missing its closing '---'");
    }

    const metadata = {};
    let activeListKey = null;

    for (let index = 1; index < closingIndex; index += 1) {
        const lineNumber = index + 1;
        const line = stripLineEnding(lines[index]);
        if (!line.trim()) {
            continue;
        }

        const listMatch = line.match(LIST_ITEM_RE);
        if (listMatch) {
            if (activeListKey === null) {
                throw new FrontmatterError(`line ${lineNumber}: list item has no preceding list key`);
            }
            const item = parseScalar(listMatch[1] ?? "", { lineNumber });
            metadata[activeListKey].push(item);
            continue;
        }

        if (line.startsWith(" ") || line.startsWith("\t")) {
            throw new FrontmatterError(
                `line ${lineNumber}: unsupported indentation; lists must use exactly two spaces before '-'`,
            );
        }

        const fieldMatch = line.match(TOP_LEVEL_RE);
        if (!fieldMatch) {
            throw new FrontmatterError(
                `line ${lineNumber}: unsupported frontmatter syntax; use 'key: value' or a block list`,
            );
        }

        const [, key, rawValue] = fieldMatch;
        if (Object.hasOwn(metadata, key)) {
            throw new FrontmatterError(`line ${lineNumber}: duplicate frontmatter key '${key}'`);
        }

        if (rawValue == null || !rawValue.trim()) {
            metadata[key] = [];
            activeListKey = key;
        } else {
            metadata[key] = parseScalar(rawValue, { lineNumber });
            activeListKey = null;
        }
    }

    return { metadata, body: lines.slice(closingIndex + 1).join("") };
}

function compareStrings(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

function toRepositoryPath(root, absolutePath) {
    return relative(root, absolutePath).split(sep).join("/");
}

export function parseDocument(path, root) {
    const { metadata, body } = parseFrontmatter(readFileSync(path, "utf8"));
    return new Document(toRepositoryPath(root, path), metadata, body);
}

function walkMarkdown(directory, paths) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const entryPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            walkMarkdown(entryPath, paths);
        } else if (entry.isFile() && extname(entry.name) === ".md") {
            paths.push(entryPath);
        }
    }
}

export function discoverPaths(root, excludedPaths = EXCLUDED_PATHS) {
    const docsRoot = join(root, "docs");
    const paths = [];
    walkMarkdown(docsRoot, paths);
    return paths
        .filter((path) => !excludedPaths.has(toRepositoryPath(root, path)))
        .sort((a, b) => compareStrings(toRepositoryPath(root, a), toRepositoryPath(root, b)));
}

function validateRepoRelativePath(value, { field, documentPath }) {
    if (
        posix.isAbsolute(value) ||
        value.includes("\\") ||
        !value.startsWith("docs/") ||
        posix.normalize(value) !== value ||
        value.split("/").includes("..")
    ) {
        return `${documentPath}: ${field} must be a normalized repository-relative path under docs/`;
    }
    return null;
}

export function validateDocumentShape(document) {
    const { metadata } = document;
    const errors = [];

    const summary = metadata.summary;
    if (typeof summary !== "string" || !summary.trim()) {
        errors.push(`${document.path}: summary must be a non-empty string`);
    } else if (summary.includes("\n") || summary.includes("\r")) {
        errors.push(`${document.path}: summary must be single-line`);
    }

    const readWhen = metadata.read_when;
    if (!Array.isArray(readWhen) || readWhen.length === 0) {
        errors.push(`${document.path}: read_when must be a non-empty block list`);
    } else {
        const normalizedHints = [];
        readWhen.forEach((hint, index) => {
            if (typeof hint !== "string" || !hint.trim()) {
                errors.push(`${document.path}: read_when item ${index + 1} must be a non-empty string`);
            } else {
                normalizedHints.push(hint.trim());
            }
        });
        if (normalizedHints.length !== new Set(normalizedHints).size) {
            errors.push(`${document.path}: read_when contains an exact duplicate after trimming`);
        }
    }

    const role = metadata.role;
    if (!ALLOWED_ROLES.has(role)) {
        errors.push(`${document.path}: role must be one of ${[...ALLOWED_ROLES].sort().join(", ")}`);
    }

    const status = metadata.discovery_status;
    if (!ALLOWED_DISCOVERY_STATUSES.has(status)) {
        errors.push(
            `${document.path}: discovery_status must be one of ${[...ALLOWED_DISCOVERY_STATUSES].sort().join(", ")}`,
        );
    }

    const supersededBy = metadata.superseded_by;
    if (status === "superseded") {
        if (typeof supersededBy !== "string" || !supersededBy.trim()) {
            errors.push(`${document.path}: superseded documents require superseded_by`);
        } else {
            const pathError = validateRepoRelativePath(supersededBy, {
                field: "superseded_by",
                documentPath: document.path,
            });
            if (pathError) {
                errors.push(pathError);
            }
            if (supersededBy === document.path) {
                errors.push(`${document.path}: superseded_by cannot point to the document itself`);
            }
        }
    } else if (supersededBy != null) {
        errors.push(`${document.path}: superseded_by is only allowed when discovery_status is superseded`);
    }

    return errors;
}

export function loadCorpus(root, excludedPaths = EXCLUDED_PATHS) {
    const documents = [];
    const errors = [];
    let paths;
    try {
        paths = discoverPaths(root, excludedPaths);
    } catch (error) {
        return { documents, errors: [`docs/: ${error.message}`] };
    }

    for (const path of paths) {
        const repoPath = toRepositoryPath(root, path);
        try {
            const document = parseDocument(path, root);
            documents.push(document);
            errors.push(...validateDocumentShape(document));
        } catch (error) {
            errors.push(`${repoPath}: ${error.message}`);
        }
    }
    return { documents, errors };
}

export function validateCorpus(documents, errors = []) {
    const byPath = new Map(documents.map((document) => [document.path, document]));
    const validationErrors = [...errors];
    const warnings = [];

    for (const document of documents) {
        const targetPath = document.supersededBy;
        if (!targetPath) {
            continue;
        }
        const target = byPath.get(targetPath);
        if (!target) {
            validationErrors.push(
                `${document.path}: superseded_by target '${targetPath}' is not a participating document`,
            );
            continue;
        }
        if (target.discoveryStatus === "historical") {
            validationErrors.push(`${document.path}: superseded_by target '${targetPath}' cannot be historical`);
        }
    }

    for (const document of documents) {
        if (document.discoveryStatus !== "superseded" || !document.supersededBy) {
            continue;
        }
        const visited = [];
        let current = document;
        while (current.discoveryStatus === "superseded" && current.supersededBy) {
            if (visited.includes(current.path)) {
                validationErrors.push(
                    `${document.path}: supersession cycle detected: ${[...visited, current.path].join(" -> ")}`,
                );
                current = null;
                break;
            }
            visited.push(current.path);
            const nextDocument = byPath.get(current.supersededBy);
            if (!nextDocument) {
                current = null;
                break;
            }
            current = nextDocument;
        }
        if (current && current.discoveryStatus !== "current") {
            validationErrors.push(`${document.path}: supersession chain must terminate at a current document`);
        }
    }

    const hintOwners = new Map();
    for (const document of documents) {
        if (!Array.isArray(document.metadata.read_when)) {
            continue;
        }
        for (const hint of document.metadata.read_when) {
            if (typeof hint !== "string" || !hint.trim()) {
                continue;
            }
            const key = hint.trim();
            const owners = hintOwners.get(key) ?? [];
            owners.push(document.path);
            hintOwners.set(key, owners);
        }
    }
    for (const [hint, owners] of [...hintOwners.entries()].sort(([a], [b]) => compareStrings(a, b))) {
        if (owners.length > 1) {
            warnings.push(`duplicate read_when hint across documents: '${hint}' (${owners.sort().join(", ")})`);
        }
    }

    return { errors: [...new Set(validationErrors)].sort(), warnings };
}

export function selectDocuments(documents, { deep = false, allDocuments = false } = {}) {
    const ordered = [...documents].sort((a, b) => compareStrings(a.path, b.path));
    if (allDocuments) {
        return ordered;
    }
    const allowedRoles = new Set(DEFAULT_ROLES);
    if (deep) {
        for (const role of DEEP_ROLES) {
            allowedRoles.add(role);
        }
    }
    return ordered.filter((document) => document.discoveryStatus === "current" && allowedRoles.has(document.role));
}

export function renderCatalogue(documents) {
    const blocks = documents.map((document) => {
        const lines = [
            `${document.path} [${document.role}, ${document.discoveryStatus}]`,
            `  Summary: ${document.summary}`,
            `  Read when: ${document.readWhen.join("; ")}`,
        ];
        if (document.supersededBy) {
            lines.push(`  Superseded by: ${document.supersededBy}`);
        }
        return lines.join("\n");
    });
    return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}

export function extractHeadings(body) {
    const headings = [];
    let fenceChar = null;
    let fenceLength = 0;

    for (const rawLine of body.split(/\r?\n/)) {
        if (fenceChar !== null) {
            const indentMatch = rawLine.match(/^ */);
            const indent = indentMatch?.[0].length ?? 0;
            const stripped = rawLine.slice(indent);
            if (indent <= 3) {
                const escaped = fenceChar === "`" ? "`" : "~";
                const closeRe = new RegExp(`^${escaped}{${fenceLength},}\\s*$`);
                if (closeRe.test(stripped)) {
                    fenceChar = null;
                    fenceLength = 0;
                }
            }
            continue;
        }

        const fenceMatch = rawLine.match(FENCE_OPEN_RE);
        if (fenceMatch) {
            const marker = fenceMatch[1];
            fenceChar = marker[0];
            fenceLength = marker.length;
            continue;
        }

        const headingMatch = rawLine.match(HEADING_RE);
        if (!headingMatch) {
            continue;
        }
        const [, hashes, rawTitle] = headingMatch;
        const title = rawTitle.replace(/\s+#+\s*$/, "").trim();
        if (title) {
            headings.push(`${hashes} ${title}`);
        }
    }

    return headings;
}

function normalizeRequestedPath(raw) {
    const value = raw.replaceAll("\\", "/");
    if (posix.isAbsolute(value) || value.split("/").includes("..") || posix.normalize(value) !== value) {
        throw new Error(`invalid repository-relative path: ${raw}`);
    }
    if (!value.startsWith("docs/") || posix.extname(value) !== ".md") {
        throw new Error(`heading paths must be participating docs/**/*.md files: ${raw}`);
    }
    if (EXCLUDED_PATHS.has(value)) {
        throw new Error(`path is excluded from discovery: ${raw}`);
    }
    return value;
}

export function renderHeadings(root, requestedPaths) {
    const blocks = [];
    const errors = [];
    for (const raw of requestedPaths) {
        let repoPath;
        try {
            repoPath = normalizeRequestedPath(raw);
        } catch (error) {
            errors.push(error.message);
            continue;
        }
        const path = join(root, ...repoPath.split("/"));
        if (!existsSync(path) || !statSync(path).isFile()) {
            errors.push(`${repoPath}: participating document does not exist`);
            continue;
        }
        let document;
        try {
            document = parseDocument(path, root);
        } catch (error) {
            errors.push(`${repoPath}: ${error.message}`);
            continue;
        }
        const shapeErrors = validateDocumentShape(document);
        if (shapeErrors.length > 0) {
            errors.push(...shapeErrors);
            continue;
        }
        const headings = extractHeadings(document.body);
        const lines = [repoPath, ...headings.map((heading) => `  ${heading}`)];
        if (headings.length === 0) {
            lines.push("  (no H1-H4 headings)");
        }
        blocks.push(lines.join("\n"));
    }
    return {
        output: blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`,
        errors,
    };
}

function printDiagnostics(errors, warnings) {
    for (const warning of warnings) {
        stderr.write(`warning: ${warning}\n`);
    }
    for (const error of errors) {
        stderr.write(`error: ${error}\n`);
    }
}

function ensureRepoRoot(root) {
    const expectedRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    let actualRoot;
    try {
        actualRoot = resolve(root);
    } catch (error) {
        return `cannot resolve current directory: ${error.message}`;
    }
    if (actualRoot !== expectedRoot) {
        return `run from the Ember repository root: ${expectedRoot}`;
    }
    if (!existsSync(join(root, "README.md")) || !existsSync(join(root, "docs"))) {
        return "repository root is missing README.md or docs/";
    }
    return null;
}

function usage() {
    return [
        "Usage:",
        "  node scripts/docs-discovery.mjs list [--deep | --all]",
        "  node scripts/docs-discovery.mjs list --headings PATH [PATH ...]",
        "  node scripts/docs-discovery.mjs check",
    ].join("\n");
}

function parseCliArgs(argv) {
    if (argv.length === 0) {
        throw new Error(usage());
    }
    const [command, ...rest] = argv;
    if (command === "check") {
        if (rest.length > 0) {
            throw new Error(`check does not accept arguments\n${usage()}`);
        }
        return { command, deep: false, all: false, headings: null };
    }
    if (command !== "list") {
        throw new Error(`unknown command: ${command}\n${usage()}`);
    }

    let deep = false;
    let all = false;
    let headings = null;
    for (let index = 0; index < rest.length; index += 1) {
        const argument = rest[index];
        if (argument === "--deep") {
            deep = true;
        } else if (argument === "--all") {
            all = true;
        } else if (argument === "--headings") {
            headings = rest.slice(index + 1);
            if (headings.length === 0) {
                throw new Error("--headings requires at least one PATH");
            }
            break;
        } else {
            throw new Error(`unknown argument: ${argument}\n${usage()}`);
        }
    }
    if (deep && all) {
        throw new Error("--deep and --all are mutually exclusive");
    }
    if (headings && (deep || all)) {
        throw new Error("--headings cannot be combined with --deep or --all");
    }
    return { command, deep, all, headings };
}

export function main(argv = process.argv.slice(2)) {
    const root = cwd();
    const rootError = ensureRepoRoot(root);
    if (rootError) {
        stderr.write(`error: ${rootError}\n`);
        return 2;
    }

    let args;
    try {
        args = parseCliArgs(argv);
    } catch (error) {
        stderr.write(`error: ${error.message}\n`);
        return 2;
    }

    if (args.command === "list" && args.headings) {
        const { output, errors } = renderHeadings(root, args.headings);
        if (output) {
            stdout.write(output);
        }
        printDiagnostics(errors, []);
        return errors.length > 0 ? 1 : 0;
    }

    const loaded = loadCorpus(root);
    const { errors, warnings } = validateCorpus(loaded.documents, loaded.errors);
    printDiagnostics(errors, warnings);

    if (args.command === "check") {
        if (errors.length > 0) {
            return 1;
        }
        stdout.write(`OK: ${loaded.documents.length} participating documentation files validated.\n`);
        return 0;
    }

    if (errors.length > 0) {
        return 1;
    }
    const selected = selectDocuments(loaded.documents, {
        deep: args.deep,
        allDocuments: args.all,
    });
    stdout.write(renderCatalogue(selected));
    return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main();
}
