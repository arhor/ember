import type { CognitionId, EmberState } from "@ember/domain/model.ts";

import { ValidationError } from "@ember/domain/errors.ts";
import { startRuntime, stopRuntime } from "@ember/domain/runtime-episode.ts";
import { contentDigest } from "@ember/domain/util.ts";

import type { InteractionEvent, EmberApplication, TransportSend } from "../app/contract.ts";
import type { SurfaceRepositories } from "../app/surface-repositories.ts";
import type { SessionCommand, CommandContext } from "./contract.ts";
import type { CommandJournal, CommandRecord } from "./journal.ts";

import { validateInteractionEvent, validateDeliveryObservation } from "../app/contract.ts";
import { executeCommand, validateCommandScope } from "./execute.ts";

export interface ConversationCommandService {
    assertOrdinaryAdmission(event: InteractionEvent): Promise<void>;
    reconcile(
        context: {
            principal: string;
            scope: string;
            surfaceId: string;
            acceptsDestination(destinationId: string): boolean;
        },
        send: TransportSend,
    ): Promise<void>;
    execute(
        event: InteractionEvent,
        send: TransportSend,
        options?: { signal?: AbortSignal },
    ): Promise<{
        replayed: boolean;
        cognitionId?: CognitionId;
        providerFailure?: string | null;
        memoryProposalFailure?: string | null;
        deliveryFailure: "failed" | "uncertain" | null;
    }>;
}

export function createConversationCommandService(dependencies: {
    repositories: SurfaceRepositories;
    journal: CommandJournal;
    application: EmberApplication;
    parse(line: string): Promise<{ command: SessionCommand | null; text: string }>;
    expectedContinuityBinding?: CommandContext["expectedContinuityBinding"];
}): ConversationCommandService {
    const { repositories, journal } = dependencies;
    const validateCurrentState = (state: EmberState, event: InteractionEvent, record?: CommandRecord) => {
        if (event.principal !== state.runtimeContract.localPrincipal)
            throw new ValidationError("asserted principal does not match initialized local principal");
        const current = { lineageId: state.lineage.lineageId, establishedAt: state.lineage.establishedAt };
        for (const binding of [dependencies.expectedContinuityBinding, record?.continuity]) {
            if (binding && (binding.lineageId !== current.lineageId || binding.establishedAt !== current.establishedAt))
                throw new ValidationError("continuity no longer matches command binding");
        }
        return current;
    };
    const service: ConversationCommandService = {
        async assertOrdinaryAdmission(event) {
            const lease = await journal.acquireWriteLease();
            try {
                const key = JSON.stringify([event.surfaceId, event.externalOccurrence?.occurrenceId]);
                if ((await journal.load()).commands.some((record) => record.key === key))
                    throw new ValidationError("conflicting command replay");
            } finally {
                await journal.releaseWriteLease(lease);
            }
        },
        async reconcile(context, send) {
            const lease = await journal.acquireWriteLease();
            let events: InteractionEvent[];
            try {
                events = (await journal.load()).commands
                    .filter(
                        (record) =>
                            record.mode === "command" &&
                            record.status === "completed" &&
                            record.event.surfaceId === context.surfaceId &&
                            record.event.principal === context.principal &&
                            record.event.scope === context.scope &&
                            record.event.deliveryDestinationId !== undefined &&
                            context.acceptsDestination(record.event.deliveryDestinationId) &&
                            (record.delivery === "pending" ||
                                (record.delivery === "failed" &&
                                    record.retryAt !== null &&
                                    record.retryAt <= Date.now())),
                    )
                    .map((record) => record.event);
            } finally {
                await journal.releaseWriteLease(lease);
            }
            for (const event of events) await service.execute(event, send);
        },
        async execute(event, send, options = {}) {
            validateInteractionEvent(event);
            const parsed = await dependencies.parse(event.text);
            const key = JSON.stringify([event.surfaceId, event.externalOccurrence?.occurrenceId]);
            if (!event.externalOccurrence)
                throw new ValidationError("remote commands require stable occurrence identity");
            const digest = contentDigest(JSON.stringify(event));
            const lease = await journal.acquireWriteLease();
            try {
                const document = await journal.load();
                let record = document.commands.find((candidate) => candidate.key === key);
                const replayed = record !== undefined;
                if (record && record.digest !== digest) throw new ValidationError("conflicting command replay");

                if (record) {
                    const stateLease = await repositories.state.acquireWriteLease();
                    try {
                        validateCurrentState(await repositories.state.load(), event, record);
                    } finally {
                        await repositories.state.releaseWriteLease(stateLease);
                    }
                }
                const runAsk = async (): Promise<Awaited<ReturnType<ConversationCommandService["execute"]>>> => {
                    if (parsed.command?.kind !== "ask" || !record)
                        throw new ValidationError("conflicting command replay");
                    const result = await dependencies.application.interact(
                        {
                            ...event,
                            text: parsed.command.text,
                            purpose: "explain",
                            explainIds: parsed.command.explainIds,
                        },
                        send,
                        options,
                    );
                    record.status = "completed";
                    await journal.save(document);
                    return {
                        replayed: result.replayed,
                        cognitionId: result.cognitionId,
                        providerFailure: result.diagnostics.providerFailure,
                        memoryProposalFailure: result.diagnostics.memoryProposalFailure,
                        deliveryFailure:
                            result.delivery?.status === "blocked_uncertain"
                                ? "uncertain"
                                : result.delivery?.status === "failed_non_retryable" ||
                                    result.delivery?.status === "retryable_failure"
                                  ? "failed"
                                  : null,
                    };
                };
                if (record?.mode === "interaction") return await runAsk();
                if (record?.status === "admitted" && record.mode === "command")
                    throw new ValidationError("command outcome is uncertain; reconcile before retrying");
                if (!record) {
                    const ledger = await repositories.interactions.load();
                    if (
                        parsed.command?.kind !== "ask" &&
                        ledger.inbound_occurrences.some(
                            (occurrence) =>
                                occurrence.surface_id === event.surfaceId &&
                                occurrence.external_occurrence_id === event.externalOccurrence!.occurrenceId,
                        )
                    )
                        throw new ValidationError("conflicting interaction replay");

                    // Bind admission to the current continuity, including help and rejection replies.
                    let continuity: CommandRecord["continuity"];
                    const stateLease = await repositories.state.acquireWriteLease();
                    try {
                        const state = await repositories.state.load();
                        continuity = validateCurrentState(state, event);
                        if (parsed.command?.kind === "ask") {
                            try {
                                validateCommandScope(parsed.command, state, {
                                    principal: event.principal,
                                    scope: event.scope,
                                    surfaceId: event.surfaceId,
                                });
                            } catch (error) {
                                if (!(error instanceof ValidationError)) throw error;
                                parsed.command = null;
                                parsed.text = "command rejected: " + error.message + "\n";
                            }
                        }
                    } finally {
                        await repositories.state.releaseWriteLease(stateLease);
                    }
                    if (parsed.command?.kind === "ask") {
                        record = {
                            continuity,
                            mode: "interaction",
                            event,
                            attempts: [],
                            retryAt: null,
                            key,
                            digest,
                            status: "admitted",
                            text: "",
                            delivery: "pending",
                        };
                        document.commands.push(record);
                        await journal.save(document);
                        return await runAsk();
                    }
                    record = {
                        continuity,
                        mode: "command",
                        event,
                        attempts: [],
                        retryAt: null,
                        key,
                        digest,
                        status: "admitted",
                        text: null,
                        delivery: "pending",
                    };
                    document.commands.push(record);
                    await journal.save(document);
                    let text = parsed.text;
                    if (parsed.command) {
                        const command = parsed.command;
                        if (command.kind === "quit") {
                            text = "command rejected: quit is local to the CLI\n";
                        } else {
                            const stateLease = await repositories.state.acquireWriteLease();
                            let runtimeId: ReturnType<typeof startRuntime>["runtimeId"] | null = null;
                            try {
                                const state = await repositories.state.load();
                                validateCurrentState(state, event, record);
                                const started = startRuntime(state, event.principal, event.scope);
                                runtimeId = started.runtimeId;
                                const committed = await repositories.state.commit(state.revision, started.state);
                                text += (
                                    await executeCommand(
                                        command,
                                        committed,
                                        runtimeId,
                                        {
                                            principal: event.principal,
                                            scope: event.scope,
                                            surfaceId: event.surfaceId,
                                        },
                                        repositories,
                                    )
                                ).text;
                            } catch (error) {
                                if (!(error instanceof ValidationError)) throw error;
                                text += "command rejected: " + error.message + "\n";
                            } finally {
                                try {
                                    if (runtimeId) {
                                        const state = await repositories.state.load();
                                        await repositories.state.commit(
                                            state.revision,
                                            stopRuntime(state, runtimeId, { reason: "command_complete" }),
                                        );
                                    }
                                } finally {
                                    await repositories.state.releaseWriteLease(stateLease);
                                }
                            }
                        }
                    }
                    record.text = text;
                    record.status = "completed";
                    await journal.save(document);
                }
                if (record.delivery === "confirmed") return { replayed, deliveryFailure: null };
                if (record.delivery === "started" || record.delivery === "uncertain") {
                    record.delivery = "uncertain";
                    await journal.save(document);
                    return { replayed, deliveryFailure: "uncertain" };
                }
                if (record.delivery === "failed" && (record.retryAt === null || record.retryAt > Date.now()))
                    return { replayed, deliveryFailure: "failed" };
                const deliveryLease = await repositories.state.acquireWriteLease();
                try {
                    validateCurrentState(await repositories.state.load(), event, record);
                    record.attempts.push({ startedAt: new Date().toISOString(), observation: null });
                    record.delivery = "started";
                    await journal.save(document);
                    try {
                        const observation = await send(
                            {
                                deliveryId: "command:" + key,
                                address: {
                                    principal: event.principal,
                                    scope: event.scope,
                                    surfaceId: event.surfaceId,
                                    destinationId: event.deliveryDestinationId ?? null,
                                },
                                text: record.text || "Command completed.\n",
                            },
                            options,
                        );
                        validateDeliveryObservation(observation);
                        record.attempts.at(-1)!.observation = observation;
                        record.retryAt =
                            observation.outcome === "failed" && observation.retryable
                                ? Date.now() + (observation.retryAfterSeconds ?? 1) * 1000
                                : null;
                        record.delivery = observation.outcome;
                        await journal.save(document);
                        return {
                            replayed,
                            deliveryFailure: observation.outcome === "confirmed" ? null : observation.outcome,
                        };
                    } catch (error) {
                        record.delivery = "uncertain";
                        await journal.save(document);
                        throw error;
                    }
                } finally {
                    await repositories.state.releaseWriteLease(deliveryLease);
                }
            } finally {
                await journal.releaseWriteLease(lease);
            }
        },
    };
    return service;
}
