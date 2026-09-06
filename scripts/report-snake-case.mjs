import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import ts from "typescript";

const ROOTS = ["src", "bin", "eval", "experiments", "tests"];
const SOURCE_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const SNAKE_CASE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

const files = [];
for (const root of ROOTS) {
    await collect(root);
}

const findings = [];
for (const path of files.sort()) {
    const text = await readFile(path, "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
    visit(source);

    function visit(node) {
        if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
            const name = propertyName(node.name);
            if (name && SNAKE_CASE.test(name)) {
                const pos = source.getLineAndCharacterOfPosition(node.name.getStart(source));
                findings.push(`${path}:${pos.line + 1}:${pos.character + 1} ${owner(node)}.${name}`);
            }
        }
        ts.forEachChild(node, visit);
    }
}

console.log(`snake_case property declarations: ${findings.length}`);
for (const finding of findings) {
    console.log(finding);
}

async function collect(path) {
    let entries;
    try {
        entries = await readdir(path, { withFileTypes: true });
    } catch (error) {
        if (error?.code === "ENOENT") return;
        throw error;
    }
    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const child = join(path, entry.name);
        if (entry.isDirectory()) {
            await collect(child);
        } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
            files.push(child);
        }
    }
}

function propertyName(name) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return null;
}

function owner(node) {
    let current = node.parent;
    while (current) {
        if ((ts.isInterfaceDeclaration(current) || ts.isClassDeclaration(current) || ts.isTypeAliasDeclaration(current)) && current.name) {
            return current.name.text;
        }
        if (ts.isTypeLiteralNode(current)) return "<type-literal>";
        current = current.parent;
    }
    return "<anonymous>";
}

function scriptKind(path) {
    switch (extname(path)) {
        case ".js":
        case ".mjs":
        case ".cjs":
            return ts.ScriptKind.JS;
        default:
            return ts.ScriptKind.TS;
    }
}
