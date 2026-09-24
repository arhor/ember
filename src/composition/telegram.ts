import type { TelegramSurfaceConfig } from "../surfaces/telegram/config.ts";
import type { EmberCompositionOverrides } from "./ember.ts";

import { createEmberApplication } from "../app/application.ts";
import { composeEmberApplication } from "./ember.ts";

export function composeTelegramSurface(config: TelegramSurfaceConfig, overrides: EmberCompositionOverrides = {}) {
    const dependencies = composeEmberApplication(
        {
            statePath: config.state_path,
            provider: {
                kind: config.provider_kind,
                command: config.provider_command,
                arguments: config.provider_arguments,
                timeoutSeconds: config.provider_timeout_seconds,
                ...(config.provider?.model === undefined ? {} : { model: config.provider.model }),
            },
            ...(config.google_calendar_config_path === undefined
                ? {}
                : { googleCalendarConfigPath: config.google_calendar_config_path }),
        },
        overrides,
    );
    return { application: createEmberApplication(dependencies), repositories: dependencies.repositories };
}
