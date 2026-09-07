#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";

const roots = ["src", "tests"];
const files = [];
for (const root of roots) await collect(root);

let changedFiles = 0;
let migratedOptionObjects = 0;
let migratedProviderCallbacks = 0;
let processFactoryCallSites = 0;

for (const file of files) {
    let source = await readFile(file, "utf8");
    const before = source;

    for (const [pattern, replacement] of [
        [/async\s*\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*,\s*options\s*\)\s*=>/g, "async (request, options) =>"],
        [/async\s*\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*\)\s*=>/g, "async (request) =>"],
        [/\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*,\s*options\s*\)\s*=>/g, "(request, options) =>"],
        [/\(\s*_command\s*,\s*_(?:args|arguments)\s*,\s*request\s*\)\s*=>/g, "(request) =>"],
    ]) {
        const count = source.match(pattern)?.length ?? 0;
        migratedProviderCallbacks += count;
        source = source.replace(pattern, replacement);
    }

    if (file === "tests/fixtures/providers/endogenous-restart-worker.ts") {
        const pattern = /provider:\s*async \(command, arguments_, request, options\) => \{\s*const providerResult = await invokeCodexProvider\(command, arguments_, request, \{/m;
        if (pattern.test(source)) {
            source = source.replace(
                pattern,
                "provider: async (request, options) => {\n                          const providerResult = await invokeCodexProvider(codexCommand, codexArguments, request, {",
            );
            migratedProviderCallbacks += 1;
        }
    }

    if (file === "src/runtime/interaction-boundary.test.ts") {
        source = replaceUnique(
            source,
            '        command: "fixture-provider",\n        timeoutSeconds: 1,\n        provider,',
            '        providerLabel: "fixture-provider",\n        timeoutSeconds: 1,\n        provider,',
            "interaction test options helper",
        );
        migratedOptionObjects += 1;
    }

    let needsProcessFactory = false;
    const ranges = findCognitionOptionRanges(source).sort((left, right) => right.start - left.start);
    for (const range of ranges) {
        const object = source.slice(range.start, range.end);
        const migrated = migrateOptionsObject(object);
        if (!migrated.changed) continue;
        source = source.slice(0, range.start) + migrated.text + source.slice(range.end);
        migratedOptionObjects += 1;
        if (migrated.needsProcessFactory) {
            needsProcessFactory = true;
            processFactoryCallSites += 1;
        }
    }

    if (needsProcessFactory) source = ensureProcessFactoryImport(source, file);

    if (source !== before) {
        await writeFile(file, source);
        changedFiles += 1;
    }
}

await updateDoc("docs/architecture/composable-agent-infrastructure-strategy.md", (source) => {
    source = source.replace(
        "**Preserve request/result semantics.** A direct API backend may later justify removing process-shaped `command`/arguments from the invocation call.",
        "**Preserve request/result semantics.** Invocation is now semantic-only; process launch configuration stays inside concrete adapter construction.",
    );
    source = source.replace(
        "A future direct-provider implementation should converge conceptually on:",
        "The earned cognition invocation boundary now has this shape:",
    );
    source = source.replace(
        "The current code is already close to the right shape. The main future pressure is the\nprocess-shaped `ProviderInvoker` signature. Do not change it until a direct provider\nspike proves the need.",
        "The direct-provider proof from #186/#188 resolved the process-shaped invocation pressure.\nKeep the semantic `ProviderInvoker` narrow and adapter-independent.",
    );
    return source;
});

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

async function updateDoc(path, transform) {
    const source = await readFile(path, "utf8");
    const result = transform(source);
    if (result !== source) await writeFile(path, result);
}

function migrateOptionsObject(object) {
    const lines = object.split("\n");
    let commandIndex = -1;
    let commandExpression = null;
    let indentation = null;
    let argumentsIndex = -1;
    let argumentsExpression = "[]";
    let hasProvider = false;

    for (let index = 0; index < lines.length; index += 1) {
        const command = /^(\s*)command:\s*(.+),\s*$/.exec(lines[index]);
        if (command) {
            commandIndex = index;
            indentation = command[1];
            commandExpression = command[2];
            continue;
        }
        const arguments_ = /^(\s*)arguments_:\s*(.+),\s*$/.exec(lines[index]);
        if (arguments_) {
            argumentsIndex = index;
            argumentsExpression = arguments_[2];
            continue;
        }
        if (/^\s*provider(?:\s*:|,)\s*/.test(lines[index])) hasProvider = true;
    }

    if (commandIndex < 0 || commandExpression === null || indentation === null) {
        return { changed: false, text: object, needsProcessFactory: false };
    }

    lines[commandIndex] = `${indentation}providerLabel: ${commandExpression},`;
    if (argumentsIndex >= 0) lines.splice(argumentsIndex, 1);

    if (!hasProvider) {
        const labelIndex = argumentsIndex >= 0 && argumentsIndex < commandIndex ? commandIndex - 1 : commandIndex;
        lines.splice(
            labelIndex + 1,
            0,
            `${indentation}provider: createTestProcessProvider({ command: ${commandExpression}, arguments_: ${argumentsExpression} }),`,
        );
    }

    return { changed: true, text: lines.join("\n"), needsProcessFactory: !hasProvider };
}

function findCognitionOptionRanges(source) {
    const ranges = [];
    for (const name of ["runCognition", "runSurfaceInteraction"]) {
        const needle = `${name}(`;
        let from = 0;
        while (true) {
            const call = source.indexOf(needle, from);
            if (call < 0) break;
            const openParen = call + name.length;
            const objectStart = thirdArgumentObjectStart(source, openParen);
            if (objectStart !== null) {
                const objectEnd = findMatching(source, objectStart, "{", "}");
                if (objectEnd !== null) ranges.push({ start: objectStart, end: objectEnd + 1 });
            }
            from = openParen + 1;
        }
    }
    return deduplicateRanges(ranges);
}

function thirdArgumentObjectStart(source, openParen) {
    let parenDepth = 1;
    let braceDepth = 0;
    let bracketDepth = 0;
    let commas = 0;
    for (let index = openParen + 1; index < source.length; index += 1) {
        const skipped = skipLiteralOrComment(source, index);
        if (skipped !== index) {
            index = skipped - 1;
            continue;
        }
        const char = source[index];
        if (char === "(") parenDepth += 1;
        else if (char === ")") {
            parenDepth -= 1;
            if (parenDepth === 0) return null;
        } else if (char === "{") braceDepth += 1;
        else if (char === "}") braceDepth -= 1;
        else if (char === "[") bracketDepth += 1;
        else if (char === "]") bracketDepth -= 1;
        else if (char === "," && parenDepth === 1 && braceDepth === 0 && bracketDepth === 0) {
            commas += 1;
            if (commas === 2) {
                let cursor = index + 1;
                while (/\s/.test(source[cursor] ?? "")) cursor += 1;
                return source[cursor] === "{" ? cursor : null;
            }
        }
    }
    return null;
}

function findMatching(source, start, open, close) {
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
        const skipped = skipLiteralOrComment(source, index);
        if (skipped !== index) {
            index = skipped - 1;
            continue;
        }
        if (source[index] === open) depth += 1;
        else if (source[index] === close) {
            depth -= 1;
            if (depth === 0) return index;
        }
    }
    return null;
}

function skipLiteralOrComment(source, index) {
    const char = source[index];
    if (char === "/" && source[index + 1] === "/") {
        const end = source.indexOf("\n", index + 2);
        return end < 0 ? source.length : end;
    }
    if (char === "/" && source[index + 1] === "*") {
        const end = source.indexOf("*/", index + 2);
        return end < 0 ? source.length : end + 2;
    }
    if (char !== "'" && char !== '"' && char !== "`") return index;
    const quote = char;
    for (let cursor = index + 1; cursor < source.length; cursor += 1) {
        if (source[cursor] === "\\") {
            cursor += 1;
            continue;
        }
        if (source[cursor] === quote) return cursor + 1;
    }
    return source.length;
}

function deduplicateRanges(ranges) {
    const seen = new Set();
    return ranges.filter(({ start, end }) => {
        const key = `${start}:${end}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function ensureProcessFactoryImport(source, file) {
    let importPath = relative(dirname(file), "src/providers/process.ts").replaceAll("\\", "/");
    if (!importPath.startsWith(".")) importPath = `./${importPath}`;
    const module = JSON.stringify(importPath);
    const escaped = escapeRegExp(module);
    const pattern = new RegExp(`import \\{([^}]*)\\} from ${escaped};`);
    const match = pattern.exec(source);
    if (match) {
        if (match[1].includes("createProcessProvider")) return source;
        const members = match[1].trim();
        return source.replace(
            pattern,
            `import { createProcessProvider as createTestProcessProvider, ${members} } from ${module};`,
        );
    }
    return `import { createProcessProvider as createTestProcessProvider } from ${module};\n${source}`;
}

function replaceUnique(source, before, after, label) {
    const first = source.indexOf(before);
    if (first < 0) return source;
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: source is not unique`);
    return source.slice(0, first) + after + source.slice(first + before.length);
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
