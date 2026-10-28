import type { EnginePlugin, RunRepository, SessionRepository } from "@ember/engine";

import { EngineBuilder } from "@ember/engine";
import { randomUUID } from "node:crypto";

import type { EmberApplication, InteractionEvent, InteractionResult, TransportSend } from "./contract.ts";
import type { EmberApplicationDependencies } from "./dependencies.ts";

import { createEmberApplication } from "./application.ts";

export interface EmberInteraction {
    readonly event: InteractionEvent;
    readonly transport: TransportSend;
}

/** Generic execution bookkeeping wraps, and never replaces, Ember admission and delivery truth. */
export async function createEngineApplication(
    identity: string,
    dependencies: EmberApplicationDependencies,
    options: {
        sessions?: SessionRepository;
        runs?: RunRepository;
        plugins?: readonly EnginePlugin<EmberInteraction, InteractionResult>[];
    } = {},
) {
    const application = createEmberApplication(dependencies);
    const builder = new EngineBuilder<EmberInteraction, InteractionResult>();
    builder.register({
        id: "ember.application",
        setup(registration) {
            registration.executor({
                execute: (interaction, context) =>
                    application.interact(
                        interaction.payload.event,
                        interaction.payload.transport,
                        context.signal === undefined ? {} : { signal: context.signal },
                    ),
            });
            if (options.sessions) registration.sessions(options.sessions);
            if (options.runs) registration.runs(options.runs);
        },
    });
    for (const plugin of options.plugins ?? []) builder.register(plugin);
    const agent = await builder.start(identity);
    const composed: EmberApplication = {
        async interact(event, transport, interactionOptions = {}) {
            const result = await agent.handle(
                {
                    id: randomUUID(),
                    actor: { id: event.principal, kind: "user" },
                    surface: { id: event.surfaceId },
                    payload: { event, transport },
                    timestamp: Temporal.Now.instant(),
                },
                interactionOptions,
            );
            if (!result.output) throw new Error("Ember execution completed without an interaction result");
            return result.output;
        },
        pendingDeliveries: application.pendingDeliveries,
        deliver: application.deliver,
    };
    return { application: composed, agent, close: () => agent.close() };
}
