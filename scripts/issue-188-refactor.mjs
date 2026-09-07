#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";

const resetPaths = [
    "src/cli/main.ts",
    "src/surfaces/telegram.ts",
    "eval/longitudinal/harness.ts",
];

execFileSync("git", ["checkout", "origin/master", "--", ...resetPaths], { stdio: "inherit" });

async function update(path, transform) {
    const source = await readFile(path, "utf8");
    const result = transform(source);
    if (result === source) throw new Error(`${path}: transform made no change`);
    await writeFile(path, result);
}

function replaceOnce(source, before, after, label) {
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`${label}: expected source not found`);
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: expected source is not unique`);
    return source.slice(0, first) + after + source.slice(first + before.length);
}

await update("src/cli/main.ts", (source) => {
    source = replaceOnce(
        source,
        'import { invokeCodexProvider } from "../providers/codex.ts";\nimport { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";\nimport { invokeCursorProvider } from "../providers/cursor.ts";',
        'import { createCodexProvider } from "../providers/codex.ts";\nimport { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";\nimport { createCursorProvider } from "../providers/cursor.ts";\nimport { createProcessProvider, providerLabel } from "../providers/process.ts";',
        "CLI provider imports",
    );
    const invocation = `                            command: args.providerCommand,\n                            arguments_: args.providerArgs,\n                            timeoutSeconds: args.providerTimeoutSeconds,\n                            signal,\n                            provider:\n                                args.providerKind === "codex"\n                                    ? invokeCodexProvider\n                                    : args.providerKind === "cursor"\n                                      ? invokeCursorProvider\n                                      : undefined,`;
    source = replaceOnce(
        source,
        invocation,
        `                            ...configuredCognitionProvider(args),\n                            timeoutSeconds: args.providerTimeoutSeconds,\n                            signal,`,
        "CLI ordinary cognition invocation",
    );
    const explainInvocation = `        command: args.providerCommand,\n        arguments_: args.providerArgs,\n        timeoutSeconds: args.providerTimeoutSeconds,\n        signal,\n        provider:\n            args.providerKind === "codex"\n                ? invokeCodexProvider\n                : args.providerKind === "cursor"\n                  ? invokeCursorProvider\n                  : undefined,`;
    source = replaceOnce(
        source,
        explainInvocation,
        `        ...configuredCognitionProvider(args),\n        timeoutSeconds: args.providerTimeoutSeconds,\n        signal,`,
        "CLI explain cognition invocation",
    );
    source = replaceOnce(
        source,
        `async function loadForPrincipal(store: StateStore, principal: string) {`,
        `function configuredCognitionProvider(args: Extract<CliArgs, { command: "run" }>) {\n    const config = { command: args.providerCommand, arguments_: args.providerArgs };\n    return {\n        providerLabel: providerLabel(args.providerCommand),\n        provider:\n            args.providerKind === "codex"\n                ? createCodexProvider(config)\n                : args.providerKind === "cursor"\n                  ? createCursorProvider(config)\n                  : createProcessProvider(config),\n    };\n}\n\nasync function loadForPrincipal(store: StateStore, principal: string) {`,
        "CLI provider configuration helper",
    );
    return source;
});

await update("src/surfaces/telegram.ts", (source) => {
    source = replaceOnce(
        source,
        'import { invokeCodexProvider } from "../providers/codex.ts";\nimport { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";\nimport { invokeCursorProvider } from "../providers/cursor.ts";',
        'import { createCodexProvider } from "../providers/codex.ts";\nimport { MAX_PROVIDER_TIMEOUT_SECONDS } from "../providers/contract.ts";\nimport { createCursorProvider } from "../providers/cursor.ts";\nimport { createProcessProvider, providerLabel } from "../providers/process.ts";',
        "Telegram provider imports",
    );
    source = replaceOnce(
        source,
        `        const selectedProvider = provider ?? providerForConfig(config.provider_kind);`,
        `        const selectedProvider = provider ?? providerForConfig(config);`,
        "Telegram provider selection",
    );
    source = replaceOnce(
        source,
        `                command: config.provider_command,\n                arguments_: config.provider_arguments,\n                timeoutSeconds: config.provider_timeout_seconds,\n                signal,\n                provider: selectedProvider,`,
        `                providerLabel: providerLabel(config.provider_command),\n                provider: selectedProvider,\n                timeoutSeconds: config.provider_timeout_seconds,\n                signal,`,
        "Telegram cognition invocation",
    );
    source = replaceOnce(
        source,
        `function providerForConfig(kind: TelegramSurfaceConfig["provider_kind"]): ProviderInvoker | undefined {\n    if (kind === "codex") return invokeCodexProvider;\n    if (kind === "cursor") return invokeCursorProvider;\n    return undefined;\n}`,
        `function providerForConfig(config: TelegramSurfaceConfig): ProviderInvoker {\n    const adapter = { command: config.provider_command, arguments_: config.provider_arguments };\n    if (config.provider_kind === "codex") return createCodexProvider(adapter);\n    if (config.provider_kind === "cursor") return createCursorProvider(adapter);\n    return createProcessProvider(adapter);\n}`,
        "Telegram provider factory",
    );
    return source;
});

await update("eval/longitudinal/harness.ts", (source) => {
    source = replaceOnce(
        source,
        `                    text: episode.input,\n                    command: "longitudinal-provider",\n                    timeoutSeconds: 300,`,
        `                    text: episode.input,\n                    providerLabel: "longitudinal-provider",\n                    timeoutSeconds: 300,`,
        "longitudinal provider label",
    );
    source = replaceOnce(
        source,
        `                    provider: async (_command, _arguments, request) => {`,
        `                    provider: async (request) => {`,
        "longitudinal provider signature",
    );
    return source;
});

await update("docs/architecture/cognition-adapter-contract-decision.md", (source) => {
    source = replaceOnce(
        source,
        'summary: "Issue #92 decision that Ember\'s existing ProviderRequest/ProviderResult/ProviderInvoker seam is the earned common cognition-backend contract, while Codex and Cursor retain separate runtime adapters and lifecycle mechanics."',
        'summary: "Issue #92 decision, updated by #188, that Ember\'s ProviderRequest/ProviderResult and semantic ProviderInvoker seam are the earned common cognition-backend contract while process launch and lifecycle mechanics remain adapter-local."',
        "#92 discovery summary",
    );
    source = replaceOnce(
        source,
        `### \`ProviderInvoker\`\n\nAt the Ember runtime boundary, the common operation is intentionally small:\n\n\`\`\`text\n(command, explicit arguments, bounded request, timeout/cancellation options)\n    -> validated ProviderResult or typed ProviderError\n\`\`\`\n\nThis is enough for CLI, Telegram, longitudinal evaluation, and the runtime cognition path to select Codex, Cursor, or the deterministic process provider without making those consumers understand vendor-specific sessions or output protocols.`,
        `### \`ProviderInvoker\`\n\nAt the Ember runtime boundary, the common operation is intentionally semantic:\n\n\`\`\`text\n(bounded request, timeout/cancellation options)\n    -> validated ProviderResult or typed ProviderError\n\`\`\`\n\nExecutable commands, argument prefixes, workspaces, and other launch details are adapter-construction concerns. Codex, Cursor, and the deterministic process backend close over those mechanics before entering \`runCognition\`; the in-process AI SDK adapter uses the same invoker shape without synthetic process placeholders.\n\n\`runCognition\` receives a separate explicit \`providerLabel\` for stable cognition and expression-evidence diagnostics, so provider identity does not have to be inferred from subprocess configuration.`,
        "#92 ProviderInvoker section",
    );
    return source;
});

await update("docs/architecture/composable-agent-infrastructure-strategy.md", (source) =>
    replaceOnce(
        source,
        `The current \`ProviderInvoker\` still includes CLI \`command\` and argument parameters\nbecause all proven production backends are external processes. Do not refactor that\nspeculatively. A successful direct-AI-SDK spike is the evidence required by issue\n#92's revisit trigger.`,
        `Issue #186 and the merged in-process AI SDK adapter supplied the direct-provider\nevidence anticipated by #92. Issue #188 therefore narrows \`ProviderInvoker\` to the\nEmber-owned \`(request, options) -> result\` operation; Codex, Cursor, and deterministic\nprocess launch configuration is now closed over by adapter construction instead of\nflowing through \`runCognition\`.`,
        "#180 ProviderInvoker revisit note",
    ),
);

await update("docs/architecture/ai-sdk-cognition-adapter-boundary.md", (source) =>
    replaceOnce(
        source,
        `First, the current \`ProviderInvoker\` function still carries \`command\` and \`arguments_\`\nbecause all previous production backends were external processes. The in-process AI\nSDK adapter has no truthful use for those parameters and ignores them.`,
        `First, the in-process adapter proved that \`command\` and \`arguments_\` were transport\nartifacts rather than shared cognition semantics. Issue #188 follows that evidence by\nnarrowing \`ProviderInvoker\` to \`(request, options) => Promise<ProviderResult>\`; AI SDK\ninvocation no longer accepts or ignores synthetic process placeholders, while Codex\nand Cursor close over launch configuration in adapter factories.`,
        "#186 ProviderInvoker evidence note",
    ),
);

console.log("issue #188 cleanup transformations applied");
