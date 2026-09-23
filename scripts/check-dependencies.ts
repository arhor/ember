import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(root, "src");
const surfaceAiExceptions = new Set(["surfaces/cli/setup.ts"]);
const surfacePersistenceExceptions = new Set([
    "surfaces/cli/google-calendar-setup.ts",
    "surfaces/cli/main.ts",
    "surfaces/cli/setup.ts",
    "surfaces/telegram/setup.ts",
]);

export function dependencyViolations(owner: string, source: string): string[] {
    const violations: string[] = [];
    for (const specifier of importSpecifiers(source)) {
        const target = resolvedOwner(owner, specifier);
        if (owner.startsWith("core/") && target?.startsWith("surfaces/"))
            reject(specifier, "core must not import a concrete surface");

        if (owner.startsWith("surfaces/")) {
            if (!surfaceAiExceptions.has(owner) && isAiSdkImport(specifier, target))
                reject(specifier, "surface-owned modules must not import AI SDK infrastructure");
            if (!surfacePersistenceExceptions.has(owner) && target?.match(/^persistence\/.+-store\.ts$/))
                reject(specifier, "surface-owned modules must not import concrete canonical persistence");
        }

        if (isSemanticOwner(owner) && isAiSdkImport(specifier, target))
            reject(specifier, "domain semantics must not import AI SDK types or runtime code");

        if (owner.startsWith("ai/") && target?.startsWith("persistence/"))
            reject(specifier, "AI infrastructure must not own canonical persistence mutation");
        if (owner.startsWith("ai/") && target === "core/semantics.ts")
            reject(specifier, "AI infrastructure must not own canonical semantic mutation");

        if (owner.startsWith("app/") && target?.startsWith("surfaces/"))
            reject(specifier, "application orchestration must not import concrete surfaces");
    }
    return violations;

    function reject(specifier: string, reason: string) {
        violations.push(`${owner} imports ${JSON.stringify(specifier)}: ${reason}`);
    }
}

async function main() {
    const violations: string[] = [];
    for (const file of await sourceFiles(sourceRoot)) {
        const owner = relative(sourceRoot, file).replaceAll("\\", "/");
        if (owner.endsWith(".test.ts") || owner.endsWith(".test-d.ts")) continue;
        violations.push(...dependencyViolations(owner, await readFile(file, "utf8")));
    }
    if (!violations.length) return;
    process.stderr.write(`Dependency boundary violations:\n${violations.map((item) => `- ${item}`).join("\n")}\n`);
    process.exitCode = 1;
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

function resolvedOwner(owner: string, specifier: string) {
    if (!specifier.startsWith(".")) return null;
    const target = relative(sourceRoot, resolve(dirname(resolve(sourceRoot, owner)), specifier)).replaceAll("\\", "/");
    return target.startsWith("../") ? null : target;
}

function importSpecifiers(source: string) {
    const specifiers: string[] = [];
    const declarationPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?(["'])([^"'\r\n]+)\1/g;
    const importCallPattern =
        /\b(?:import|require)\s*\(\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))\s*)*(["'])([^"'\r\n]+)\1/g;
    for (const pattern of [declarationPattern, importCallPattern])
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
