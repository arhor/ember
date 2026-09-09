import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
    const source = await readFile(path, "utf8");
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`expected text not found in ${path}: ${before.slice(0, 80)}`);
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`expected unique text in ${path}`);
    await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await replaceOnce(
    "src/providers/ai-sdk.ts",
    `            error: new ProviderError(\n                status === undefined\n                    ? "AI SDK provider API call failed"\n                    : \`AI SDK provider API call failed (HTTP \${status})\`,\n            ),`,
    `            error: new ProviderError(\n                status === undefined\n                    ? "AI SDK provider API call failed"\n                    : \`AI SDK provider API call failed (HTTP \${status})\`,\n                { cause: error },\n            ),`,
);
await replaceOnce(
    "src/providers/ai-sdk.ts",
    `            error: new ProviderError("AI SDK provider request exhausted its retry policy"),`,
    `            error: new ProviderError("AI SDK provider request exhausted its retry policy", {\n                cause: error.lastError,\n            }),`,
);
await replaceOnce(
    "src/providers/ai-sdk.ts",
    `            error: new ProviderError("AI SDK provider failed"),`,
    `            error: new ProviderError("AI SDK provider failed", { cause: error }),`,
);

const packageJsonPath = "package.json";
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
packageJson.scripts = Object.fromEntries(
    Object.entries(packageJson.scripts).flatMap(([key, value]) =>
        key === "smoke:cursor"
            ? [[key, value], ["smoke:claude", "node tests/live/claude-code-smoke.ts"]]
            : [[key, value]],
    ),
);
packageJson.dependencies = {
    "@ai-sdk/mcp": packageJson.dependencies["@ai-sdk/mcp"],
    ai: packageJson.dependencies.ai,
    "ai-sdk-provider-claude-code": "4.3.1",
    "node-telegram-bot-api": packageJson.dependencies["node-telegram-bot-api"],
};
await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

await replaceOnce(
    "docs/architecture/claude-code-subscription-cognition-reprobe.md",
    "**Result:** **viable for bounded one-shot subscription-backed cognition**, with a\nruntime-specific production adapter still required.",
    "**Result:** **viable for bounded one-shot subscription-backed cognition**. Issue #204\nnow implements the production path through Vercel AI SDK and\n`ai-sdk-provider-claude-code`, rather than a hand-written Claude process adapter.",
);
await replaceOnce(
    "docs/architecture/claude-code-subscription-cognition-reprobe.md",
    `The evidence warrants [#204](https://github.com/arhor/ember/issues/204), a separate task\nto implement the **Claude Code one-shot cognition adapter** behind \`ProviderInvoker\`.\n\nThat task should prove rather than assume:\n\n- schema-constrained \`ProviderResult\` extraction with the supported Claude surface;\n- the narrowest environment allowlist compatible with subscription login;\n- the best truthful isolation policy using the then-current safe/restricted surfaces;\n- complete tool/MCP suppression and unattended permission behavior;\n- bounded stdout/stderr and lifecycle parsing;\n- timeout, explicit cancellation, kill escalation, and unconfirmed termination mapping;\n- whether no-session one-shot operation should omit continuation evidence entirely;\n- deterministic malformed-output, provenance, output-bound, and lifecycle tests; and\n- an opt-in authenticated smoke using a real Ember \`ProviderRequest\`.\n\nThe adapter remains optional external-runtime infrastructure. It does not replace the\nVercel AI SDK direction selected in #180 for Ember's preferred future in-process model\nand tool infrastructure.`,
    `Issue [#204](https://github.com/arhor/ember/issues/204) implements the production\npath through Vercel AI SDK and \`ai-sdk-provider-claude-code\`. The implementation uses\nthe provider's Agent SDK integration for process/protocol ownership, AI SDK structured\noutput for the \`ProviderResult\` candidate, and Ember's existing semantic validation\nafterward.\n\nThe fixed production policy is documented in\n[Claude Code cognition through Vercel AI SDK](claude-code-ai-sdk-provider.md), including\nsubscription-only environment handling, filesystem/tool/MCP/skill/plugin isolation,\nno-session one-shot defaults, deterministic tests, and the opt-in authenticated smoke.\n\nThis follow-up changes one architectural conclusion from the original re-probe: a\nsubscription-backed external runtime does not necessarily require Ember to own a custom\nprocess adapter. A maintained AI SDK provider can be the thinner mechanical boundary\nwhen it removes real lifecycle/protocol plumbing without taking Ember semantics.`,
);

await replaceOnce(
    "docs/architecture/vercel-ai-sdk-modular-cognition-evaluation.md",
    "2. **Use AI SDK below an adapter boundary for direct model APIs.** It can remove\n   provider HTTP/stream parsing, structured-output plumbing, tool-schema conversion,\n   usage/finish normalization, retries, mocks, telemetry hooks, and much\n   provider-specific SDK glue.",
    "2. **Use AI SDK below an adapter boundary when a provider removes real model/runtime\n   plumbing.** This includes direct model APIs and, as #204 now proves for Claude Code,\n   an agent-runtime provider that maps a subscription-backed Agent SDK into AI SDK. It\n   can remove provider transport/protocol parsing, structured-output plumbing,\n   usage/finish normalization, retries, mocks, telemetry hooks, and provider-specific\n   glue without owning Ember semantics.",
);
await replaceOnce(
    "docs/architecture/vercel-ai-sdk-modular-cognition-evaluation.md",
    "### What it does not remove from current Codex/Cursor adapters\n\nAI SDK does not make the current subscription-backed external runtimes disappear.",
    "### What it does not remove from current Codex/Cursor adapters\n\nIssue #204 adds an important qualification: subscription-backed execution by itself is\nnot evidence that Ember must own a custom process adapter. `ai-sdk-provider-claude-code`\nnow removes Claude's process/protocol and structured-output plumbing through the official\nAgent SDK while preserving Ember's `ProviderInvoker` boundary.\n\nThat does not make the current Codex/Cursor subscription-backed external runtimes\ndisappear.",
);
await replaceOnce(
    "docs/architecture/vercel-ai-sdk-modular-cognition-evaluation.md",
    "The adoption trigger remains concrete. AI SDK should first be used when Ember actually\nadds a **direct model API backend** or an in-process tool loop. Wrapping the existing\nCodex/Cursor CLI adapters in AI SDK would add an interface without removing their\nprocess, authentication, workspace, session, output-bound, cancellation, and\nuncertainty mechanics.",
    "The adoption trigger remains concrete, and has now fired in production: AI SDK should\nbe used when it removes material provider/runtime mechanics, whether that is a direct\nmodel API, an in-process tool loop, or an agent-runtime provider such as the Claude Code\nprovider adopted in #204. Wrapping the existing Codex/Cursor CLI adapters in AI SDK\nwould still add an interface without removing their process, authentication, workspace,\nsession, output-bound, cancellation, and uncertainty mechanics.",
);

await replaceOnce(
    "docs/architecture/composable-agent-infrastructure-strategy.md",
    "1. **Immediate posture: defer production adoption until an earned feature needs the\n   mechanics.** Research alone adds no production dependency.\n2. **Likely first adoption: use Vercel AI SDK as Ember's primary reusable agent\n   infrastructure toolkit.** Prefer its provider, structured-output, streaming, tool,\n   bounded-loop, MCP, testing, and telemetry mechanics before considering a second\n   overlapping agent SDK.",
    "1. **Immediate posture: Vercel AI SDK is now the production primary toolkit where an\n   earned feature needs its mechanics.** #188 adopted shared AI SDK cognition mechanics,\n   and #204 demonstrates a subscription-backed Claude runtime provider on the same seam.\n2. **Continue using Vercel AI SDK as Ember's primary reusable agent infrastructure\n   toolkit.** Prefer its provider, structured-output, streaming, tool, bounded-loop, MCP,\n   testing, and telemetry mechanics before considering a second overlapping agent SDK.",
);
await replaceOnce(
    "docs/architecture/composable-agent-infrastructure-strategy.md",
    "**Prefer AI SDK for a future direct-provider backend.** Keep CLI adapters for current subscription-backed runtimes.",
    "**Prefer AI SDK when a provider removes real integration plumbing, including subscription-backed agent runtimes.** Keep custom CLI adapters where no suitable provider has earned replacement.",
);
await replaceOnce(
    "docs/architecture/composable-agent-infrastructure-strategy.md",
    "The adoption trigger remains concrete. AI SDK should first be used when Ember actually\nadds a **direct model API backend** or an in-process tool loop. Wrapping the existing\nCodex/Cursor CLI adapters in AI SDK would add an interface without removing their\nprocess, authentication, workspace, session, output-bound, cancellation, and\nuncertainty mechanics.",
    "The adoption trigger remains concrete and is now demonstrated by production code.\nAI SDK is appropriate when a provider or primitive removes material integration\nmechanics without taking Ember semantics. #204 does exactly that for Claude Code through\n`ai-sdk-provider-claude-code`; the existing Codex/Cursor adapters remain custom because\nwrapping them in AI SDK would still leave Ember owning their process, authentication,\nworkspace, session, output-bound, cancellation, and uncertainty mechanics.",
);

await replaceOnce(
    "docs/architecture/cognition-adapter-contract-decision.md",
    "The existing seam is therefore the smallest common contract currently justified by evidence. The duplicated-looking process mechanics inside `src/providers/codex.ts` and `src/providers/cursor.ts` remain adapter-local because extracting them today would require a hook-heavy lifecycle framework that obscures the differences Ember must preserve.",
    "The existing seam is therefore the smallest common contract currently justified by evidence. The duplicated-looking process mechanics inside `src/providers/codex.ts` and `src/providers/cursor.ts` remain adapter-local because extracting them today would require a hook-heavy lifecycle framework that obscures the differences Ember must preserve. Issue #204 adds a third production backend through Vercel AI SDK and `ai-sdk-provider-claude-code`; because that backend delegates process/protocol mechanics to the provider rather than repeating Codex/Cursor lifecycle code, it strengthens rather than triggers the case for a shared Ember process framework.",
);
