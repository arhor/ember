import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createScanner, SyntaxKind } from "typescript/unstable/ast";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = [
    { directory: resolve(root, "bin"), ownerPrefix: "bin" },
    { directory: resolve(root, "scripts"), ownerPrefix: "scripts" },
    { directory: resolve(root, "apps/cli/src"), ownerPrefix: "apps/cli" },
    { directory: resolve(root, "apps/cli/bin"), ownerPrefix: "apps/cli/bin" },
    { directory: resolve(root, "apps/telegram/src"), ownerPrefix: "apps/telegram" },
    { directory: resolve(root, "apps/telegram/bin"), ownerPrefix: "apps/telegram/bin" },
];
const surfaceAiExceptions = new Set<string>();
const surfacePersistenceExceptions = new Set(["apps/cli/google-calendar-setup.ts", "apps/cli/local-commands.ts"]);
const surfaceBootstrapAndCommandModules = new Set([
    "apps/cli/main.ts",
    "apps/cli/local-commands.ts",
    "apps/cli/setup.ts",
    "apps/cli/google-calendar-setup.ts",
    "apps/cli/commands.ts",
    "apps/telegram/config.ts",
    "apps/telegram/composition.ts",
]);

// Consumer-owned contracts keep infrastructure dependencies pointing inward.
const packageDependencies: Record<string, readonly string[]> = {
    agent: [],
    engine: ["agent"],
    domain: [],
    application: ["agent", "engine", "domain"],
    persistence: ["agent", "engine", "domain", "application"],
    "ai-sdk": ["agent", "engine", "domain", "application"],
    mcp: ["agent", "engine", "domain", "application"],
    "google-calendar": ["agent", "engine", "domain", "application"],
    host: ["agent", "engine", "domain", "application"],
    composition: [
        "agent",
        "engine",
        "domain",
        "application",
        "persistence",
        "ai-sdk",
        "mcp",
        "google-calendar",
        "host",
    ],
};

export function dependencyViolations(owner: string, source: string): string[] {
    const violations: string[] = [];
    if (
        /^(?:app|core|agency|capabilities|delegation|memory|objectives|runtime)\//.test(owner) &&
        /systemd|systemctl|launchctl|raspberry/i.test(source)
    )
        violations.push(
            `${owner}: application and semantic modules must not contain platform-specific service ownership`,
        );
    for (const reference of importReferences(source)) {
        if (reference.specifier === null) {
            reject("<dynamic>", "non-static dynamic imports cannot be verified by the dependency checker");
            continue;
        }
        const specifier = reference.specifier;
        const target = resolvedOwner(owner, specifier);
        const ownerPackage = owner.match(/^packages\/([^/]+)\//)?.[1];
        const targetPackage = target?.match(/^packages\/([^/]+)\//)?.[1];
        if (ownerPackage) {
            const allowed = packageDependencies[ownerPackage];
            if (targetPackage === "core") reject(specifier, "extracted packages must not depend on legacy core");
            else if (targetPackage && targetPackage !== ownerPackage && (!allowed || !allowed.includes(targetPackage)))
                reject(specifier, "package dependency must point inward through consumer-owned contracts");
            if (ownerPackage === "agent" && !specifier.startsWith("."))
                reject(specifier, "agent contracts must not import runtime or external packages");
            if (["engine", "domain", "application"].includes(ownerPackage) && isAiSdkImport(specifier, target))
                reject(
                    specifier,
                    "generic execution and domain/application contracts must not import AI SDK infrastructure",
                );
        }
        if (owner.startsWith("apps/") && !owner.includes("/bin/") && !surfaceBootstrapAndCommandModules.has(owner)) {
            if (
                targetPackage &&
                ["composition", "persistence", "ai-sdk", "host", "mcp", "google-calendar"].includes(targetPackage)
            )
                reject(specifier, "conversational adapters must receive composed collaborators");
        }
        if (targetPackage === "core" && !ownerPackage) reject(specifier, "legacy core is retired");
        if (ownerPackage && target?.startsWith("apps/"))
            reject(specifier, "core package modules must not import a concrete surface");
        if (
            (owner.startsWith("apps/cli/") && target?.startsWith("apps/telegram/")) ||
            (owner.startsWith("apps/telegram/") && target?.startsWith("apps/cli/"))
        )
            reject(specifier, "one concrete app must not import another concrete app");

        if (owner.startsWith("apps/")) {
            if (!surfaceAiExceptions.has(owner) && isAiSdkImport(specifier, target))
                reject(specifier, "surface-owned modules must not import AI SDK infrastructure");
            if (!surfacePersistenceExceptions.has(owner) && target?.match(/^persistence\/.+-store\.ts$/))
                reject(specifier, "surface-owned modules must not import concrete canonical persistence");
        }

        if (
            (owner.startsWith("apps/cli/") || owner.startsWith("apps/telegram/")) &&
            !surfaceBootstrapAndCommandModules.has(owner)
        ) {
            if (target === "app/application.ts" || target?.startsWith("composition/"))
                reject(specifier, "conversational adapters must receive a composed application");
            if (target?.startsWith("providers/") || target?.startsWith("ai/providers/"))
                reject(specifier, "conversational adapters must not construct cognition providers");
            if (target?.startsWith("persistence/"))
                reject(specifier, "conversational adapters must not construct canonical persistence");
        }

        if (isSemanticOwner(owner) && isAiSdkImport(specifier, target))
            reject(specifier, "domain semantics must not import AI SDK types or runtime code");

        if (owner.startsWith("ai/") && target?.startsWith("persistence/"))
            reject(specifier, "AI infrastructure must not own canonical persistence mutation");
        if (owner.startsWith("ai/") && target === "core/semantics.ts")
            reject(specifier, "AI infrastructure must not own canonical semantic mutation");

        if (owner.startsWith("app/") && target?.startsWith("apps/"))
            reject(specifier, "application orchestration must not import concrete surfaces");
        if (/^(?:app|core|agency|capabilities|delegation|memory|objectives|runtime)\//.test(owner)) {
            if (target === "host/systemd.ts" || target === "host/launchd.ts")
                reject(
                    specifier,
                    "application and semantic modules must use host contracts, not service-manager adapters",
                );
        }
    }
    return violations;

    function reject(specifier: string, reason: string) {
        violations.push(`${owner} imports ${JSON.stringify(specifier)}: ${reason}`);
    }
}

async function main() {
    const violations: string[] = [];
    const packageRoots = (await readdir(resolve(root, "packages"), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
            directory: resolve(root, "packages", entry.name, "src"),
            ownerPrefix: `packages/${entry.name}`,
        }));
    for (const sourceRoot of [...sourceRoots, ...packageRoots]) {
        for (const file of await sourceFiles(sourceRoot.directory)) {
            const relativeOwner = relative(sourceRoot.directory, file).replaceAll("\\", "/");
            const owner = sourceRoot.ownerPrefix ? `${sourceRoot.ownerPrefix}/${relativeOwner}` : relativeOwner;
            if (owner.endsWith(".test.ts") || owner.endsWith(".test-d.ts")) continue;
            violations.push(...dependencyViolations(owner, await readFile(file, "utf8")));
        }
    }
    if (!violations.length) return;
    process.stderr.write(`Dependency boundary violations:\n${violations.map((item) => `- ${item}`).join("\n")}\n`);
    process.exitCode = 1;
}

function isSemanticOwner(owner: string) {
    return /^(?:core|agency|capabilities|delegation|memory|objectives)\//.test(owner);
}

function isAiSdkImport(specifier: string, target: string | null) {
    return (
        specifier === "ai" ||
        specifier.startsWith("ai/") ||
        specifier.startsWith("@ai-sdk/") ||
        specifier.startsWith("ai-sdk-") ||
        target?.startsWith("packages/ai-sdk/") ||
        (target?.startsWith("ai/") && target !== "ai/contract.ts")
    );
}

function resolvedOwner(owner: string, specifier: string) {
    if (specifier === "@ember/cli") return "apps/cli/index.ts";
    if (specifier.startsWith("@ember/cli/")) return `apps/cli/${specifier.slice("@ember/cli/".length)}`;
    if (specifier === "@ember/telegram") return "apps/telegram/index.ts";
    if (specifier.startsWith("@ember/telegram/")) return `apps/telegram/${specifier.slice("@ember/telegram/".length)}`;
    const workspace = specifier.match(/^@ember\/([^/]+)(?:\/(.*))?$/);
    if (workspace) return `packages/${workspace[1]}/${workspace[2] ?? "index.ts"}`;
    if (!specifier.startsWith(".")) return null;
    if (owner.startsWith("packages/")) {
        const physical = resolve("/", dirname(owner.replace(/^(packages\/[^/]+)\//, "$1/src/")), specifier);
        return physical.slice(1).replace(/^(packages\/[^/]+)\/src\//, "$1/");
    }
    const target = resolve("/", dirname(owner), specifier).slice(1).replaceAll("\\", "/");
    return target.startsWith("../") ? null : target;
}

function importReferences(source: string) {
    const tokens = scanTokens(source);

    const references: Array<{ specifier: string | null }> = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index]!;
        if (token.kind === SyntaxKind.ImportKeyword) {
            const next = tokens[index + 1];
            if (next?.kind === SyntaxKind.OpenParenToken) {
                references.push({ specifier: staticModuleSpecifier(tokens[index + 2]) });
                continue;
            }
            if (next?.kind === SyntaxKind.StringLiteral) {
                references.push({ specifier: next.value });
                continue;
            }
            addFromClause(index);
        } else if (token.kind === SyntaxKind.ExportKeyword) addFromClause(index);
        else if (token.kind === SyntaxKind.Identifier && token.value === "require") {
            if (tokens[index + 1]?.kind === SyntaxKind.OpenParenToken)
                references.push({ specifier: staticModuleSpecifier(tokens[index + 2]) });
        }
    }
    return references;

    function addFromClause(start: number) {
        for (let index = start + 1; index < tokens.length; index += 1) {
            const token = tokens[index]!;
            if (token.kind === SyntaxKind.SemicolonToken) return;
            if (token.kind === SyntaxKind.FromKeyword) {
                const specifier = tokens[index + 1];
                if (specifier?.kind === SyntaxKind.StringLiteral) references.push({ specifier: specifier.value });
                return;
            }
        }
    }
}

function scanTokens(source: string) {
    const scanner = createScanner(true, undefined, source);
    const tokens: Array<{ kind: SyntaxKind; value: string }> = [];
    const templateBraceDepths: number[] = [];
    let previousEnd = -1;
    for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
        const previousKind = tokens.at(-1)?.kind;
        if (kind === SyntaxKind.SlashToken && canPrecedeRegularExpression(previousKind))
            kind = scanner.reScanSlashToken();
        if (kind === SyntaxKind.CloseBraceToken && templateBraceDepths.length) {
            const templateIndex = templateBraceDepths.length - 1;
            if (templateBraceDepths[templateIndex]! === 0) {
                kind = scanner.reScanTemplateToken(false);
                if (kind === SyntaxKind.TemplateTail) templateBraceDepths.pop();
            } else templateBraceDepths[templateIndex] = templateBraceDepths[templateIndex]! - 1;
        } else if (kind === SyntaxKind.TemplateHead) templateBraceDepths.push(0);
        else if (kind === SyntaxKind.OpenBraceToken && templateBraceDepths.length)
            templateBraceDepths[templateBraceDepths.length - 1] = templateBraceDepths.at(-1)! + 1;

        const tokenEnd = scanner.getTokenEnd();
        if (tokenEnd <= previousEnd) throw new Error(`dependency scanner did not advance at byte ${tokenEnd}`);
        previousEnd = tokenEnd;
        tokens.push({
            kind,
            value:
                kind === SyntaxKind.Identifier ||
                kind === SyntaxKind.StringLiteral ||
                kind === SyntaxKind.NoSubstitutionTemplateLiteral
                    ? scanner.getTokenValue()
                    : "",
        });
    }
    return tokens;
}

function canPrecedeRegularExpression(kind: SyntaxKind | undefined) {
    return (
        kind === SyntaxKind.EqualsToken ||
        kind === SyntaxKind.OpenParenToken ||
        kind === SyntaxKind.OpenBracketToken ||
        kind === SyntaxKind.OpenBraceToken ||
        kind === SyntaxKind.CommaToken ||
        kind === SyntaxKind.ColonToken ||
        kind === SyntaxKind.SemicolonToken ||
        kind === SyntaxKind.ReturnKeyword ||
        kind === SyntaxKind.ThrowKeyword ||
        kind === SyntaxKind.CaseKeyword ||
        kind === SyntaxKind.EqualsGreaterThanToken ||
        kind === SyntaxKind.QuestionToken ||
        kind === SyntaxKind.QuestionQuestionToken ||
        kind === SyntaxKind.BarBarToken ||
        kind === SyntaxKind.AmpersandAmpersandToken
    );
}

function staticModuleSpecifier(token: { kind: SyntaxKind; value: string } | undefined) {
    if (token?.kind === SyntaxKind.StringLiteral || token?.kind === SyntaxKind.NoSubstitutionTemplateLiteral)
        return token.value;
    return null;
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
