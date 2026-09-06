import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOTS = ["src", "bin", "eval", "experiments", "tests"];
const SOURCE_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);
const SNAKE = String.raw`[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+`;
const PROPERTY_KEY = new RegExp(String.raw`^\s*(?:readonly\s+)?(${SNAKE})\??\s*:`);
const MEMBER_ACCESS = new RegExp(String.raw`\.(${SNAKE})\b`, "g");
const BRACKET_ACCESS = new RegExp(String.raw`\[\s*["'](${SNAKE})["']\s*\]`, "g");

const files = [];
for (const root of ROOTS) await collect(root);

const names = new Map();
for (const path of files.sort()) {
    const text = await readFile(path, "utf8");
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const key = PROPERTY_KEY.exec(line)?.[1];
        if (key) record(key, path, index + 1, "key");
        for (const match of line.matchAll(MEMBER_ACCESS)) record(match[1], path, index + 1, "member");
        for (const match of line.matchAll(BRACKET_ACCESS)) record(match[1], path, index + 1, "bracket");
    }
}

console.log(`snake_case property-like names: ${names.size}`);
for (const [name, occurrences] of [...names].sort(([left], [right]) => left.localeCompare(right))) {
    console.log(`\n${name} (${occurrences.length})`);
    for (const occurrence of occurrences.slice(0, 20)) console.log(`  ${occurrence}`);
    if (occurrences.length > 20) console.log(`  ... ${occurrences.length - 20} more`);
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
        if (entry.isDirectory()) await collect(child);
        else if (SOURCE_EXTENSIONS.has(extname(entry.name))) files.push(child);
    }
}

function record(name, path, line, kind) {
    const occurrences = names.get(name) ?? [];
    occurrences.push(`${path}:${line} ${kind}`);
    names.set(name, occurrences);
}
