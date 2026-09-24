import type { AiExecutor } from "../ai/contract.ts";
import type { BootstrapDependencies, SetupConfig, SetupProvider } from "../app/bootstrap.ts";

import { createCodexLanguageModel } from "../ai/codex.ts";
import { createAiSdkCognitionExecutor } from "../ai/cognition.ts";
import { createCursorLanguageModel } from "../ai/cursor.ts";
import { createOllamaLanguageModel } from "../ai/ollama.ts";
import {
    defaultSetupConfigPath,
    defaultSetupStatePath,
    exists,
    loadSetupConfig,
    resolveSetupPath,
    writeConfig,
} from "../host/setup.ts";
import { loadGoogleCalendarConfig } from "../integrations/google-calendar/read.ts";
import { OnboardingWorkStore } from "../persistence/onboarding-work-store.ts";
import { StateStore } from "../persistence/state-store.ts";

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
        createOnboardingStore: (path) => new OnboardingWorkStore(path),
        provider: overrides.provider ?? setupProvider,
        loadGoogleCalendarConfig,
        ...(overrides.signal ? { signal: overrides.signal } : {}),
        onProgress,
    };
}

export function setupProvider(config: SetupProvider): AiExecutor {
    if (config.kind === "claude-code")
        return async (request, options) => {
            const { createClaudeCodeExecutor } = await import("../ai/claude-code.ts");
            return await createClaudeCodeExecutor(config.model ? { model: config.model } : {})(request, options);
        };
    if (config.kind === "ollama")
        return createAiSdkCognitionExecutor(
            createOllamaLanguageModel({
                model: config.model,
                ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
            }),
        );
    const options = {
        command: config.command,
        arguments_: config.model ? ["--model", config.model] : [],
        timeoutSeconds: config.timeoutSeconds,
    };
    return createAiSdkCognitionExecutor(
        config.kind === "codex" ? createCodexLanguageModel(options) : createCursorLanguageModel(options),
    );
}
