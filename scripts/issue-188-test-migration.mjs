#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import * as ts from "typescript";

const roots = ["src", "tests"];
const files = [];

for (const root of roots) await collect(root);

let changedFiles = 0;
let processFactoryCallSites = 0;
let migratedOptionObjects = 0;
let migratedProviderCallbacks = 0;

for (const file of files) {
    let source = await readFile(file, "utf8");
    const before = source;

    const callbackPatterns = [
        [/async\s*\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*,\s*options\s*\)\s*=>/g, "async (request, options) =>"],
        [/async\s*\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*\)\s*=>/g, "async (request) =>"],
        [/\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*,\s*options\s*\)\s*=>/g, "(request, options) =>"],
        [/\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*\)\s*=>/g, "(request) =>"],
    ];
    for (const [pattern, replacement] of callbackPatterns) {
        const matches = source.match(pattern)?.length ?? 0;
        migratedProviderCallbacks += matches;
        source = source.replace(pattern, replacement);
    }

    if (file === "tests/fixtures/providers/endogenous-restart-worker.ts") {
        const oldWrapper = /provider:\s*async \(command, arguments_, request, options\) => \{\s*const providerResult = await invokeCodexProvider\(command, arguments_, request, \{/m;
        if (oldWrapper.test(source)) {
            source = source.replace(
                oldWrapper,
                "provider: async (request, options) => {\n                          const providerResult = await invokeCodexProvider(codexCommand, codexArguments, request, {",
            );
            migratedProviderCallbacks += 1;
        }
    }

    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const edits = [];
    let needsProcessFactoryImport = false;

    function visit(node) {
        if (ts.isObjectLiteralExpression(node)) migrateObject(node);
        ts.forEachChild(node, visit);
    }

    function migrateObject(node) {
        const properties = new Map();
        for (const property of node.properties) {
            if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
            const name = propertyName(property.name);
            if (name) properties.set(name, property);
        }
        const commandProperty = properties.get("command");
        if (!commandProperty || !ts.isPropertyAssignment(commandProperty)) return;

        const parent = node.parent;
        const directCall = ts.isCallExpression(parent) ? callName(parent.expression) : null;
        const isDirectCognitionOptions =
            directCall === "runCognition" || directCall === "runSurfaceInteraction";
        const isCognitionOptionsHelper =
            properties.has("runtimeId") &&
            properties.has("principal") &&
            properties.has("scope") &&
            properties.has("text") &&
            properties.has("timeoutSeconds") &&
            properties.has("provider");
        if (!isDirectCognitionOptions && !isCognitionOptionsHelper) return;

        const commandText = commandProperty.initializer.getText(sourceFile);
        edits.push({
            start: commandProperty.getStart(sourceFile),
            end: commandProperty.end,
            text: `providerLabel: ${commandText}`,
        });

        const argumentsProperty = properties.get("arguments_");
        let argumentsText = "[]";
        if (argumentsProperty && ts.isPropertyAssignment(argumentsProperty)) {
            argumentsText = argumentsProperty.initializer.getText(sourceFile);
            let end = argumentsProperty.end;
            if (source[end] === ",") end += 1;
            edits.push({ start: argumentsProperty.getStart(sourceFile), end, text: "" });
        }

        if (isDirectCognitionOptions && !properties.has("provider")) {
            const timeoutProperty = properties.get("timeoutSeconds");
            if (!timeoutProperty) throw new Error(`${file}: cognition options lack timeoutSeconds`);
            const indentation = indentationAt(source, timeoutProperty.getStart(sourceFile));
            edits.push({
                start: timeoutProperty.getStart(sourceFile),
                end: timeoutProperty.getStart(sourceFile),
                text: `provider: createTestProcessProvider({ command: ${commandText}, arguments_: ${argumentsText} }),\n${indentation}`,
            });
            needsProcessFactoryImport = true;
            processFactoryCallSites += 1;
        }
        migratedOptionObjects += 1;
    }

    visit(sourceFile);

    if (needsProcessFactoryImport) addProcessFactoryImport(edits, sourceFile, file);

    edits.sort((left, right) => right.start - left.start);
    for (const edit of edits) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);

    if (source !== before) {
        await writeFile(file, source);
        changedFiles += 1;
    }
}

console.log(
    JSON.stringify({ changedFiles, migratedOptionObjects, migratedProviderCallbacks, processFactoryCallSites }, null, 2),
);

async function collect(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
        const child = `${path}/${entry.name}`;
        if (entry.isDirectory()) {
            await collect(child);
            continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
        if (entry.name.endsWith(".test.ts") || child.startsWith("tests/fixtures/")) files.push(child);
    }
}

function propertyName(name) {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
    return null;
}

function callName(expression) {
    if (ts.isIdentifier(expression)) return expression.text;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    return null;
}

function indentationAt(source, offset) {
    const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
    return source.slice(lineStart, offset).match(/^\s*/)?.[0] ?? "";
}

function addProcessFactoryImport(edits, sourceFile, file) {
    let importPath = relative(dirname(file), "src/providers/process.ts").replaceAll("\\", "/");
    if (!importPath.startsWith(".")) importPath = `./${importPath}`;

    const existing = sourceFile.statements.find(
        (statement) =>
            ts.isImportDeclaration(statement) &&
            ts.isStringLiteral(statement.moduleSpecifier) &&
            statement.moduleSpecifier.text === importPath,
    );
    if (existing && ts.isImportDeclaration(existing)) {
        const clause = existing.importClause;
        const bindings = clause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
            const existingNames = bindings.elements.map((element) => element.getText(sourceFile));
            if (!existingNames.some((name) => name.includes("createProcessProvider"))) {
                edits.push({
                    start: existing.getStart(sourceFile),
                    end: existing.end,
                    text: `import { createProcessProvider as createTestProcessProvider, ${existingNames.join(", ")} } from ${JSON.stringify(importPath)};`,
                });
            }
            return;
        }
    }

    const imports = sourceFile.statements.filter(ts.isImportDeclaration);
    const insertAt = imports.length ? imports.at(-1).end : 0;
    edits.push({
        start: insertAt,
        end: insertAt,
        text: `${insertAt ? "\n" : ""}import { createProcessProvider as createTestProcessProvider } from ${JSON.stringify(importPath)};`,
    });
}
