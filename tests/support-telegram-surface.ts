import type { TelegramSurfaceConfig } from "../src/apps/telegram/config.ts";
import type { EmberCompositionOverrides } from "../src/core/composition/ember.ts";

import {
    processTelegramUpdate as processUpdate,
    reconcileTelegramDeliveries as reconcileDeliveries,
    reconcileTelegramProactiveContacts as reconcileContacts,
    runTelegramPolling as runPolling,
} from "../src/apps/telegram/surface.ts";
import { composeTelegramSurface } from "../src/core/composition/telegram.ts";

type UpdateOptions = Partial<Parameters<typeof processUpdate>[3]> & EmberCompositionOverrides;
type PollOptions = Partial<Parameters<typeof runPolling>[2]> & EmberCompositionOverrides;

export function processTelegramUpdate(
    config: TelegramSurfaceConfig,
    api: Parameters<typeof processUpdate>[1],
    update: Parameters<typeof processUpdate>[2],
    options: UpdateOptions = {},
) {
    const services = composeTelegramSurface(config, options);
    return processUpdate(config, api, update, {
        application: options.application ?? services.application,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
}

export function runTelegramPolling(
    config: TelegramSurfaceConfig,
    api: Parameters<typeof runPolling>[1],
    options: PollOptions = {},
) {
    const services = composeTelegramSurface(config, options);
    return runPolling(config, api, { ...services, ...options });
}

export function reconcileTelegramDeliveries(
    config: TelegramSurfaceConfig,
    api: Parameters<typeof reconcileDeliveries>[1],
    options: Partial<Parameters<typeof reconcileDeliveries>[2]> = {},
) {
    const { repositories } = composeTelegramSurface(config);
    return reconcileDeliveries(config, api, { repositories, ...options });
}

export function reconcileTelegramProactiveContacts(
    config: TelegramSurfaceConfig,
    api: Parameters<typeof reconcileContacts>[1],
    options: Partial<Parameters<typeof reconcileContacts>[2]> = {},
) {
    const { repositories } = composeTelegramSurface(config);
    return reconcileContacts(config, api, { repositories, ...options });
}
