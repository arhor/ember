import type { EmberCompositionConfig, EmberCompositionOverrides } from "./ember.ts";

import { createEmberApplication } from "../core/app/application.ts";
import { composeEmberApplication } from "./ember.ts";

export function composeCliSurface(config: EmberCompositionConfig, overrides: EmberCompositionOverrides = {}) {
    const dependencies = composeEmberApplication(config, overrides);
    return { application: createEmberApplication(dependencies), repositories: dependencies.repositories };
}
