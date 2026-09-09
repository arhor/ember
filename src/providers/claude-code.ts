import type { LanguageModel } from "ai";
import type { ClaudeCodeSettings } from "ai-sdk-provider-claude-code";

import { claudeCode, isAuthenticationError } from "ai-sdk-provider-claude-code";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InferenceEvidenceSink } from "./ai-sdk.ts";
import type { ProviderInvoker } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { createAiSdkProvider } from "./ai-sdk.ts";

const DEFAULT_MODEL = "sonnet";
const ALLOWED_OPTION_KEYS = new Set(["model", "inferenceEvidence"]);

export interface ClaudeCodeProviderOptions {
    model?: string;
    inferenceEvidence?: InferenceEvidenceSink;
}

interface ClaudeCodeProviderDependencies {
    createModel(model: string, settings: ClaudeCodeSettings): LanguageModel;
    createTemporaryDirectory(): Promise<string>;
    removeTemporaryDirectory(directory: string): Promise<void>;
    environment: NodeJS.ProcessEnv;
}

const productionDependencies: ClaudeCodeProviderDependencies = {
    createModel: (model, settings) => claudeCode(model, settings),
    createTemporaryDirectory: () => mkdtemp(join(tmpdir(), "ember-claude-code-")),
    removeTemporaryDirectory: (directory) => rm(directory, { recursive: true, force: true }),
    environment: process.env,
};

export function createClaudeCodeProvider(options: ClaudeCodeProviderOptions = {}): ProviderInvoker {
    return createClaudeCodeProviderWithDependencies(options, productionDependencies);
}

/** @internal Deterministic adapter seam for contract tests. */
export function createClaudeCodeProviderWithDependencies(
    options: ClaudeCodeProviderOptions,
    dependencies: ClaudeCodeProviderDependencies,
): ProviderInvoker {
    validateOptions(options);
    const modelId = options.model ?? DEFAULT_MODEL;

    return async (request, invocationOptions) => {
        const directory = await dependencies.createTemporaryDirectory();
        try {
            const model = dependencies.createModel(modelId, claudeCodeSettings(directory, dependencies.environment));
            const provider = createAiSdkProvider(model, {
                ...(options.inferenceEvidence === undefined ? {} : { inferenceEvidence: options.inferenceEvidence }),
            });
            try {
                return await provider(request, invocationOptions);
            } catch (error) {
                if (error instanceof ProviderError && error.cause !== undefined && isAuthenticationError(error.cause)) {
                    throw new ProviderError(
                        "Claude Code subscription authentication is unavailable; authenticate with `claude auth login`.",
                        { cause: error.cause },
                    );
                }
                throw error;
            }
        } finally {
            try {
                await dependencies.removeTemporaryDirectory(directory);
            } catch {
                // Temporary-workspace cleanup is operational hygiene, not cognition truth.
            }
        }
    };
}

function claudeCodeSettings(cwd: string, environment: NodeJS.ProcessEnv): ClaudeCodeSettings {
    return {
        cwd,
        maxTurns: 1,
        permissionPrompts: "none",
        tools: [],
        allowedTools: [],
        mcpServers: {},
        strictMcpConfig: true,
        settingSources: [],
        skills: [],
        plugins: [],
        agents: {},
        persistSession: false,
        streamingInput: "off",
        logger: false,
        env: subscriptionOnlyEnvironment(environment),
    };
}

function subscriptionOnlyEnvironment(environment: NodeJS.ProcessEnv): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_AUTH_TOKEN: undefined,
        CLAUDE_CODE_OAUTH_TOKEN: undefined,
        CLAUDE_CODE_USE_BEDROCK: undefined,
        CLAUDE_CODE_USE_VERTEX: undefined,
        CLAUDE_CODE_USE_FOUNDRY: undefined,
        GCLOUD_PROJECT: undefined,
        CLOUD_ML_REGION: undefined,
    };

    for (const key of Object.keys(environment)) {
        if (key.startsWith("ANTHROPIC_") || key.startsWith("AWS_") || key.startsWith("GOOGLE_")) {
            result[key] = undefined;
        }
    }
    return result;
}

function validateOptions(options: ClaudeCodeProviderOptions) {
    for (const key of Object.keys(options)) {
        if (!ALLOWED_OPTION_KEYS.has(key)) {
            throw new ProviderError(`unsupported Claude Code provider option: ${key}`);
        }
    }
    if (options.model !== undefined && options.model.trim().length === 0) {
        throw new ProviderError("Claude Code model must be a non-empty string");
    }
}
