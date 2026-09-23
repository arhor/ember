import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "src");
const violations: string[] = [];

for (const file of await sourceFiles(sourceRoot)) {
    const source = await readFile(file, "utf8");
    const owner = relative(sourceRoot, file).replaceAll("\\", "/");
    if (owner.endsWith(".test.ts") || owner.endsWith(".test-d.ts")) continue;

    for (const specifier of importSpecifiers(source)) {
        const target = resolvedOwner(file, specifier);
        if (owner.startsWith("core/") && target?.startsWith("surfaces/"))
            reject(owner, specifier, "core must not import a concrete surface");

        if (owner.match(/^surfaces\/[^/]+\/surface\.ts$/)) {
            if (
                specifier === "ai" ||
                specifier.startsWith("ai/") ||
                specifier.startsWith("@ai-sdk/") ||
                target?.startsWith("ai/")
            )
                reject(owner, specifier, "conversational surfaces must not import AI SDK infrastructure");
            if (target?.match(/^persistence\/.+-store\.ts$/))
                reject(owner, specifier, "conversational surfaces must not import concrete canonical persistence");
        }

        if (isSemanticOwner(owner) && isAiSdkImport(specifier, target))
            reject(owner, specifier, "domain semantics must not import AI SDK types or runtime code");

        if (owner.startsWith("ai/") && target?.startsWith("persistence/"))
            reject(owner, specifier, "AI infrastructure must not own canonical persistence mutation");
        if (owner.startsWith("ai/") && target === "core/semantics.ts")
            reject(owner, specifier, "AI infrastructure must not own canonical semantic mutation");

        if (owner.startsWith("app/") && target?.startsWith("surfaces/"))
            reject(owner, specifier, "application orchestration must not import concrete surfaces");
    }
}

if (violations.length) {
    process.stderr.write(`Dependency boundary violations:\n${violations.map((item) => `- ${item}`).join("\n")}\n`);
    process.exitCode = 1;
}

function reject(owner: string, specifier: string, reason: string) {
    violations.push(`${owner} imports ${JSON.stringify(specifier)}: ${reason}`);
}

function isSemanticOwner(owner: string) {
    return /^(?:core|agency|capabilities|delegation|memory|objectives|onboarding)\//.test(owner);
}

function isAiSdkImport(specifier: string, target: string | null) {
    return (
        specifier === "ai" ||
        specifier.startsWith("ai/") ||
        specifier.startsWith("@ai-sdk/") ||
        target?.startsWith("ai/")
    );
}

function resolvedOwner(importer: string, specifier: string) {
    if (!specifier.startsWith(".")) return null;
    const target = relative(sourceRoot, resolve(dirname(importer), specifier)).replaceAll("\\", "/");
    return target.startsWith("../") ? null : target;
}

function importSpecifiers(source: string) {
    const specifiers: string[] = [];
    const pattern =
        /(?:\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?|\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+|\bimport\s*\()(["'])([^"']+)\1/g;
    for (const match of source.matchAll(pattern)) specifiers.push(match[2]!);
    return specifiers;
}

async function sourceFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
        else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
    }
    return files;
}
