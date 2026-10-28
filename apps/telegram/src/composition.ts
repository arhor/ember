import type { EmberCompositionOverrides } from "@ember/composition/ember.ts";

import {
    decideConfiguredProactiveContactHandoff,
    loadConfiguredProactiveContactPolicy,
} from "@ember/composition/agency/configured-proactive-contact-policy.ts";
import { composeCliSurface } from "@ember/composition/cli.ts";

import type { TelegramSurfaceConfig } from "./config.ts";
import type { ProactiveContactHandoffRevalidator } from "./surface.ts";

import { TELEGRAM_SURFACE_ID } from "./surface.ts";

export function composeTelegramSurface(config: TelegramSurfaceConfig, overrides: EmberCompositionOverrides = {}) {
    const services = composeCliSurface(
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
    const revalidateProactiveContact: ProactiveContactHandoffRevalidator | undefined =
        config.proactive_contact_policy_path
            ? async (state, intent, consideredAt) =>
                  decideConfiguredProactiveContactHandoff({
                      state,
                      statePath: config.state_path,
                      intent,
                      consideredAt,
                      surfaceId: TELEGRAM_SURFACE_ID,
                      policy: await loadConfiguredProactiveContactPolicy(config.proactive_contact_policy_path!),
                  })
            : undefined;
    return { ...services, ...(revalidateProactiveContact === undefined ? {} : { revalidateProactiveContact }) };
}
