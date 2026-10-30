import type { EmberApplication } from "@ember/application/app/contract.ts";

import { createConversationCommandService } from "@ember/application/commands/service.ts";
import { FileCommandJournal } from "@ember/persistence/runtime/command-journal.ts";

import type { EmberCompositionConfig, EmberCompositionOverrides } from "./ember.ts";

import { parseConversationCommand } from "./command-parser.ts";
import { startEmberApplication, composeEmberApplication } from "./ember.ts";

/** Lazy startup preserves synchronous assembly while all execution enters the engine. */
export function composeCliSurface(config: EmberCompositionConfig, overrides: EmberCompositionOverrides = {}) {
    const dependencies = composeEmberApplication(config, overrides);
    let started: ReturnType<typeof startEmberApplication> | undefined;
    let closed = false;
    const start = () => {
        if (closed) throw new Error("Application is closed");
        return (started ??= startEmberApplication(config, overrides, dependencies));
    };
    const application: EmberApplication = {
        async interact(...args) {
            return (await start()).application.interact(...args);
        },
        async pendingDeliveries(...args) {
            return (await start()).application.pendingDeliveries(...args);
        },
        async deliver(...args) {
            return (await start()).application.deliver(...args);
        },
    };
    const commands = createConversationCommandService({
        application,
        repositories: dependencies.repositories,
        journal: new FileCommandJournal(config.statePath),
        parse: parseConversationCommand,
        ...(dependencies.admission.expectedContinuityBinding === undefined
            ? {}
            : { expectedContinuityBinding: dependencies.admission.expectedContinuityBinding }),
    });
    return {
        commands,
        application,
        repositories: dependencies.repositories,
        async close() {
            closed = true;
            if (started) await (await started).close();
        },
    };
}
