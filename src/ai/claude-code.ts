import type { LanguageModel } from "ai";
import type { ClaudeCodeSettings } from "ai-sdk-provider-claude-code";

import { claudeCode, isAuthenticationError } from "ai-sdk-provider-claude-code";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InferenceEvidenceSink } from "./cognition.ts";
import type { AiExecutor } from "./contract.ts";

import { ProviderError } from "../core/errors.ts";
import { createAiSdkCognitionExecutor } from "./cognition.ts";

const DEFAULT_MODEL = "sonnet";
const ALLOWED_OPTION_KEYS = new Set(["model", "inferenceEvidence"]);

export interface ClaudeCodeProviderOptions {
    model?: string;
    inferenceEvidence?: InferenceEvidenceSink;
}

export type ClaudeCodeModelAccess = <T>(operation: (model: LanguageModel) => Promise<T>) => Promise<T>;

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

export function createClaudeCodeExecutor(options: ClaudeCodeProviderOptions = {}): AiExecutor {
    return createClaudeCodeExecutorWithDependencies(options, productionDependencies);
}

/** @internal Deterministic adapter seam for contract tests. */
export function createClaudeCodeExecutorWithDependencies(
    options: ClaudeCodeProviderOptions,
    dependencies: ClaudeCodeProviderDependencies,
): AiExecutor {
    const withModel = createClaudeCodeModelAccessWithDependencies(options, dependencies);
    return (request, invocationOptions) =>
        withModel((model) => {
            const executor = createAiSdkCognitionExecutor(model, {
                ...(options.inferenceEvidence === undefined ? {} : { inferenceEvidence: options.inferenceEvidence }),
            });
            return executor(request, invocationOptions);
        });
}

export function createClaudeCodeModelAccess(options: ClaudeCodeProviderOptions = {}): ClaudeCodeModelAccess {
    return createClaudeCodeModelAccessWithDependencies(options, productionDependencies);
}

function createClaudeCodeModelAccessWithDependencies(
    options: ClaudeCodeProviderOptions,
    dependencies: ClaudeCodeProviderDependencies,
): ClaudeCodeModelAccess {
    validateOptions(options);
    const modelId = options.model ?? DEFAULT_MODEL;
    return async (operation) => {
        const directory = await dependencies.createTemporaryDirectory();
        try {
            const model = dependencies.createModel(modelId, claudeCodeSettings(directory, dependencies.environment));
            try {
                return await operation(model);
            } catch (error) {
                const cause = error instanceof ProviderError && error.cause !== undefined ? error.cause : error;
                if (isAuthenticationError(cause)) {
                    throw new ProviderError(
                        "Claude Code subscription authentication is unavailable; authenticate with `claude auth login`.",
                        { cause },
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
