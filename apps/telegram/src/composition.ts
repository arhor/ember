import type { EmberCompositionOverrides } from "@ember/core/composition/ember.ts";

import { createEmberApplication } from "@ember/core/app/application.ts";
import { composeEmberApplication } from "@ember/core/composition/ember.ts";

import type { TelegramSurfaceConfig } from "./config.ts";

export function composeTelegramSurface(config: TelegramSurfaceConfig, overrides: EmberCompositionOverrides = {}) {
    const dependencies = composeEmberApplication(
        {
            statePath: config.state_path,
            provider: {
                kind: config.provider_kind,
                ...(config.provider_kind === "ollama" || config.provider_kind === "deepseek"
                    ? {}
                    : { command: config.provider_command }),
                ...(config.provider_kind === "ollama" || config.provider_kind === "deepseek"
                    ? {}
                    : { arguments: config.provider_arguments }),
                timeoutSeconds: config.provider_timeout_seconds,
                ...(config.provider?.model === undefined ? {} : { model: config.provider.model }),
                ...(config.provider?.kind === "ollama" && config.provider.base_url !== undefined
                    ? { baseUrl: config.provider.base_url }
                    : {}),
            },
            ...(config.google_calendar_config_path === undefined
                ? {}
                : { googleCalendarConfigPath: config.google_calendar_config_path }),
        },
        overrides,
    );
    return { application: createEmberApplication(dependencies), repositories: dependencies.repositories };
}
