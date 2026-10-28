import type { AiExecutor } from "@ember/application/ai/contract.ts";
import type { BootstrapDependencies, SetupConfig, SetupProvider } from "@ember/application/app/bootstrap.ts";

import { createCodexLanguageModel } from "@ember/ai-sdk/codex.ts";
import { createAiSdkCognitionExecutor } from "@ember/ai-sdk/cognition.ts";
import { createCursorLanguageModel } from "@ember/ai-sdk/cursor.ts";
import { createDeepSeekLanguageModel } from "@ember/ai-sdk/deepseek.ts";
import { createOllamaLanguageModel } from "@ember/ai-sdk/ollama.ts";
import { loadGoogleCalendarConfig } from "@ember/google-calendar/read.ts";
import {
    defaultSetupConfigPath,
    defaultSetupStatePath,
    exists,
    loadSetupConfig,
    resolveSetupPath,
    writeConfig,
} from "@ember/host/setup.ts";
import { StateStore } from "@ember/persistence/persistence/state-store.ts";

export interface SetupCompositionOverrides {
    provider?: (config: SetupProvider) => AiExecutor;
    signal?: AbortSignal;
    persistConfig?: (path: string, config: SetupConfig) => Promise<void>;
}

export function composeSetupDependencies(
    onProgress: BootstrapDependencies["onProgress"],
    overrides: SetupCompositionOverrides = {},
): BootstrapDependencies {
    return {
        defaultConfigPath: defaultSetupConfigPath,
        defaultStatePath: defaultSetupStatePath,
        resolvePath: resolveSetupPath,
        exists,
        loadConfig: loadSetupConfig,
        persistConfig: overrides.persistConfig ?? writeConfig,
        createStateStore: (path) => new StateStore(path),
        provider: overrides.provider ?? setupProvider,
        loadGoogleCalendarConfig,
        ...(overrides.signal ? { signal: overrides.signal } : {}),
        onProgress,
    };
}

export function setupProvider(config: SetupProvider): AiExecutor {
    if (config.kind === "claude-code")
        return async (request, options) => {
            const { createClaudeCodeExecutor } = await import("@ember/ai-sdk/claude-code.ts");
            return await createClaudeCodeExecutor(config.model ? { model: config.model } : {})(request, options);
        };
    if (config.kind === "ollama")
        return createAiSdkCognitionExecutor(
            createOllamaLanguageModel({
                model: config.model,
                ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
            }),
        );
    if (config.kind === "deepseek")
        return createAiSdkCognitionExecutor(createDeepSeekLanguageModel({ model: config.model }));
    const options = {
        command: config.command,
        arguments_: config.model ? ["--model", config.model] : [],
        timeoutSeconds: config.timeoutSeconds,
    };
    return createAiSdkCognitionExecutor(
        config.kind === "codex" ? createCodexLanguageModel(options) : createCursorLanguageModel(options),
    );
}
