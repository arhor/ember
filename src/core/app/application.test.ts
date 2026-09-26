import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { EmberApplicationDependencies } from "../../composition/ember.ts";
import type { AiExecutionRequest } from "../ai/contract.ts";
import type { InteractionEvent } from "./contract.ts";

import { composeEmberApplication } from "../../composition/ember.ts";
import { ConversationContextStore } from "../../persistence/conversation-context-store.ts";
import { MemoryProposalGenerationStore } from "../../persistence/memory-proposal-generation-store.ts";
import { OnboardingWorkStore } from "../../persistence/onboarding-work-store.ts";
import { InteractionLedgerStore } from "../../runtime/interaction-boundary.ts";
import { ProviderError } from "../errors.ts";
import { initialState } from "../model.ts";
import { createOnboardingWork } from "../onboarding-work.ts";
import { createEmberApplication } from "./application.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

test("CLI- and Telegram-shaped requests follow the same application coordinator path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-"));
    try {
        const requests: AiExecutionRequest[] = [];
        const dependencies = composeEmberApplication(
            {
                statePath: join(directory, "state.json"),
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                executor: async (request) => {
                    requests.push(request);
                    return { contractVersion: 1, reply: "same reply", usedMeaningIds: [] };
                },
                memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
            },
        );
        await dependencies.repositories.state.create(initialState(PRINCIPAL));
        const application = createEmberApplication(dependencies);
        const delivered: Array<{ surfaceId: string; text: string }> = [];
        const transport = async (intent: { address: { surfaceId: string }; text: string }) => {
            delivered.push({ surfaceId: intent.address.surfaceId, text: intent.text });
            return { outcome: "confirmed" as const, externalMessageId: null };
        };

        const cli = await application.interact(event("local_cli", "explicit_local_argument"), transport);
        const telegram = await application.interact(
            {
                ...event("telegram", "configured_surface_mapping"),
                externalOccurrence: { occurrenceId: "update-1", messageId: "message-1", threadId: null },
                deliveryDestinationId: "chat-1",
            },
            transport,
        );

        assert.equal(requests.length, 2);
        assert.deepEqual(
            requests.map((request) => request.input.text),
            ["same input", "same input"],
        );
        assert.deepEqual(
            requests.map((request) => request.projection.surface),
            ["local_cli", "telegram"],
        );
        assert.deepEqual(delivered, [
            { surfaceId: "local_cli", text: "same reply\n" },
            { surfaceId: "telegram", text: "same reply\n" },
        ]);
        assert.equal(cli.cognitionStatus, "completed");
        assert.equal(telegram.cognitionStatus, "completed");
        assert.equal(cli.delivery?.status, "confirmed");
        assert.equal(telegram.delivery?.status, "confirmed");
        assert.equal(cli.diagnostics.providerFailure, null);
        assert.equal(telegram.diagnostics.providerFailure, null);

        const state = await dependencies.repositories.state.load();
        assert.equal(state.operations.cognitionEpisodes.length, 2);
        assert.equal(state.operations.runtimeEpisodes.length, 2);
        assert.ok(state.operations.runtimeEpisodes.every((runtime) => runtime.cleanStopAt !== null));
        assert.ok(
            state.operations.runtimeEpisodes.every(
                (runtime) => runtime.stopReason === "application_interaction_complete",
            ),
        );
        assert.equal(dependencies.repositories.state.lease, null);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("application interaction should form memory without evaluating onboarding when onboarding is absent", async () => {
    // Given
    const fixture = await applicationFixture();
    let memoryGenerations = 0;
    let onboardingEvaluations = 0;
    fixture.dependencies.postTurn.memoryProposalGenerator = async () => {
        memoryGenerations += 1;
        return { contractVersion: 1, candidates: [] };
    };
    fixture.dependencies.postTurn.onboardingProgressEvaluator = async () => {
        onboardingEvaluations += 1;
        return { decision_version: 1, updates: [] };
    };

    try {
        // When
        const result = await fixture.application.interact(event("local_cli", "explicit_local_argument"), async () => ({
            outcome: "confirmed",
            externalMessageId: null,
        }));

        // Then
        assert.equal(result.cognitionStatus, "completed");
        assert.equal(memoryGenerations, 1);
        assert.equal(onboardingEvaluations, 0);
        assert.equal((await fixture.dependencies.repositories.memoryProposalGenerations.load()).generations.length, 1);
    } finally {
        await fixture.close();
    }
});

test("the coordinator uses independently supplied persistence collaborators", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-repositories-"));
    try {
        const statePath = join(directory, "state.json");
        const state = initialState(PRINCIPAL, "2026-09-21T20:00:00Z");
        const composed = composeEmberApplication(
            {
                statePath,
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                executor: async () => ({ contractVersion: 1, reply: "reply", usedMeaningIds: [] }),
                memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
                onboardingProgressEvaluator: async () => ({
                    decision_version: 1,
                    updates: [{ topic: "forms_of_address", action: "resolve", basis: "same" }],
                }),
            },
        );
        const conversation = new ConversationContextStore(join(directory, "dialogue"));
        const interactions = new InteractionLedgerStore(join(directory, "delivery"));
        const onboarding = new OnboardingWorkStore(join(directory, "onboarding"));
        const memoryProposalGenerations = new MemoryProposalGenerationStore(join(directory, "memory"));
        const dependencies: EmberApplicationDependencies = {
            ...composed,
            repositories: {
                ...composed.repositories,
                conversation: {
                    load: conversation.load.bind(conversation),
                    activeConversation: conversation.activeConversation.bind(conversation),
                    startFreshConversation: conversation.startFreshConversation.bind(conversation),
                    recordAcceptedInput: conversation.recordAcceptedInput.bind(conversation),
                    recordCommittedExpression: conversation.recordCommittedExpression.bind(conversation),
                },
                interactions: {
                    load: interactions.load.bind(interactions),
                    acceptInbound: interactions.acceptInbound.bind(interactions),
                    createDeliveryIntent: interactions.createDeliveryIntent.bind(interactions),
                    fenceDelivery: interactions.fenceDelivery.bind(interactions),
                    startDeliveryAttempt: interactions.startDeliveryAttempt.bind(interactions),
                    finishDeliveryAttempt: interactions.finishDeliveryAttempt.bind(interactions),
                },
                onboarding: {
                    load: onboarding.load.bind(onboarding),
                    save: onboarding.save.bind(onboarding),
                },
                memoryProposalGenerations: {
                    append: memoryProposalGenerations.append.bind(memoryProposalGenerations),
                    complete: memoryProposalGenerations.complete.bind(memoryProposalGenerations),
                },
            },
        };
        await dependencies.repositories.state.create(state);
        await dependencies.repositories.onboarding.save(
            createOnboardingWork(state.lineage.lineageId, PRINCIPAL, SCOPE, "2026-09-21T20:00:00Z"),
        );

        const result = await createEmberApplication(dependencies).interact(
            event("local_cli", "explicit_local_argument"),
            async () => ({ outcome: "confirmed", externalMessageId: null }),
        );

        assert.equal(result.cognitionStatus, "completed");
        assert.equal((await conversation.load()).exchanges.length, 1);
        assert.equal((await interactions.load()).deliveries.length, 1);
        assert.equal((await onboarding.load())?.topics[0]?.status, "resolved");
        assert.equal((await memoryProposalGenerations.load()).generations.length, 1);
        await assert.rejects(access(`${statePath}.conversation.json`));
        await assert.rejects(access(`${statePath}.interactions.json`));
        await assert.rejects(access(`${statePath}.onboarding.json`));
        await assert.rejects(access(`${statePath}.memory-proposals.json`));
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

for (const expected of [
    {
        observation: { outcome: "failed" as const, retryable: true, retryAfterSeconds: 2, externalMessageId: null },
        status: "retryable_failure",
    },
    {
        observation: { outcome: "uncertain" as const, externalMessageId: null },
        status: "blocked_uncertain",
    },
]) {
    test(`initial ${expected.observation.outcome} delivery is returned as an application result`, async () => {
        const fixture = await applicationFixture();
        try {
            const result = await fixture.application.interact(
                event("telegram", "configured_surface_mapping"),
                async () => expected.observation,
            );

            assert.equal(result.cognitionStatus, "completed");
            assert.equal(result.delivery?.status, expected.status);
            assert.ok(result.occurrenceId);
            assert.ok(result.deliveryId);
            assert.deepEqual(result.diagnostics, {
                providerFailure: null,
                memoryProposalFailure: null,
                onboardingProgressFailure: null,
            });
            const state = await fixture.dependencies.repositories.state.load();
            assert.equal(state.operations.runtimeEpisodes.at(-1)?.stopReason, "application_delivery_failure");
            assert.equal(fixture.dependencies.repositories.state.lease, null);
        } finally {
            await fixture.close();
        }
    });
}

test("malformed transport observations become uncertain delivery evidence", async () => {
    const fixture = await applicationFixture();
    try {
        const result = await fixture.application.interact(event("telegram", "configured_surface_mapping"), async () => {
            return { outcome: "garbage", externalMessageId: null } as never;
        });
        assert.equal(result.delivery?.status, "blocked_uncertain");
        const ledger = await fixture.dependencies.repositories.interactions.load();
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "uncertain");
    } finally {
        await fixture.close();
    }
});

test("provider failure is persisted before the runtime stops and releases its writer lease", async () => {
    const fixture = await applicationFixture({
        executor: async () => {
            throw new ProviderError("fixture provider failed");
        },
    });
    try {
        const result = await fixture.application.interact(event("local_cli", "explicit_local_argument"), async () =>
            assert.fail("failed cognition must not be delivered"),
        );

        assert.match(result.diagnostics.providerFailure ?? "", /fixture provider failed/);
        assert.equal(result.cognitionStatus, "failed");
        const state = await fixture.dependencies.repositories.state.load();
        assert.equal(state.operations.cognitionEpisodes.at(-1)?.status, "failed");
        assert.equal(state.operations.runtimeEpisodes.at(-1)?.stopReason, "application_provider_failure");
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("application interaction should preserve successful cognition when post-turn follow-ups fail", async () => {
    // Given
    const fixture = await applicationFixture();
    try {
        fixture.dependencies.postTurn.onboardingProgressEvaluator = async () => {
            throw new Error("progress unavailable");
        };
        fixture.dependencies.postTurn.memoryProposalGenerator = async () => {
            throw new Error("reflection unavailable");
        };
        const state = await fixture.dependencies.repositories.state.load();
        await fixture.dependencies.repositories.onboarding.save(
            createOnboardingWork(state.lineage.lineageId, PRINCIPAL, SCOPE, "2026-09-22T10:00:00Z"),
        );
        let delivered = false;

        // When
        const result = await fixture.application.interact(event("local_cli", "explicit_local_argument"), async () => {
            delivered = true;
            return { outcome: "confirmed", externalMessageId: null };
        });

        // Then
        assert.equal(result.cognitionStatus, "completed");
        assert.equal(result.delivery?.status, "confirmed");
        assert.equal(delivered, true);
        assert.deepEqual(result.diagnostics, {
            providerFailure: null,
            memoryProposalFailure: "reflection unavailable",
            onboardingProgressFailure: "progress unavailable",
        });
        const completed = await fixture.dependencies.repositories.state.load();
        assert.equal(completed.operations.cognitionEpisodes.at(-1)?.status, "completed");
        assert.equal(completed.operations.runtimeEpisodes.at(-1)?.stopReason, "application_interaction_complete");
    } finally {
        await fixture.close();
    }
});

test("provider cancellation evidence survives application runtime cleanup", async () => {
    const controller = new AbortController();
    const fixture = await applicationFixture({
        executor: async (_request, options) => {
            controller.abort();
            assert.equal(options.signal?.aborted, true);
            throw new ProviderError("fixture cancellation requested", {
                outcome: "cancellation_requested",
                termination: { reason: "explicit_cancellation", directChildExitObserved: true },
            });
        },
    });
    try {
        const result = await fixture.application.interact(
            event("local_cli", "explicit_local_argument"),
            async () => assert.fail("cancelled cognition must not be delivered"),
            { signal: controller.signal },
        );

        assert.equal(result.cognitionStatus, "cancellation_requested");
        const state = await fixture.dependencies.repositories.state.load();
        const cognition = state.operations.cognitionEpisodes.at(-1);
        assert.equal(cognition?.status, "cancellation_requested");
        assert.deepEqual(cognition?.providerTermination, {
            reason: "explicit_cancellation",
            directChildExitObserved: true,
        });
        assert.equal(state.operations.runtimeEpisodes.at(-1)?.stopReason, "application_provider_failure");
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("a post-start application error records unknown cognition and a failed runtime stop", async () => {
    const fixture = await applicationFixture();
    try {
        fixture.dependencies.repositories.conversation.recordAcceptedInput = async () => {
            throw new Error("fixture post-start application failure");
        };

        await assert.rejects(
            fixture.application.interact(event("local_cli", "explicit_local_argument"), async () =>
                assert.fail("application failure must not be delivered"),
            ),
            /fixture post-start application failure/,
        );
        const state = await fixture.dependencies.repositories.state.load();
        assert.equal(state.operations.cognitionEpisodes.at(-1)?.status, "outcome_unknown");
        assert.equal(state.operations.runtimeEpisodes.at(-1)?.stopReason, "application_interaction_failed");
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("ordinary pending delivery lookup excludes proactive-contact deliveries", async () => {
    const fixture = await applicationFixture();
    try {
        const result = await fixture.application.interact(
            { ...event("telegram", "configured_surface_mapping"), deliveryDestinationId: "chat-1" },
            async () => ({
                outcome: "failed",
                retryable: true,
                retryAfterSeconds: null,
                externalMessageId: null,
            }),
        );
        const state = await fixture.dependencies.repositories.state.load();
        const cognition = state.operations.cognitionEpisodes.find((item) => item.cognitionId === result.cognitionId)!;
        const proactive = await fixture.dependencies.repositories.interactions.createDeliveryIntent({
            cognitionId: result.cognitionId,
            expressionEvidenceId: cognition.expressionEvidenceId!,
            surfaceId: "telegram",
            destinationId: "chat-1",
            representationText: "proactive\n",
            origin: {
                kind: "proactive_contact",
                contact_intent_id: "contact-intent-fixture",
                policy_assessment_id: "contact-policy-fixture",
            },
        });

        const pending = await fixture.application.pendingDeliveries({
            principal: PRINCIPAL,
            scope: SCOPE,
            surfaceId: "telegram",
            destinationId: "chat-1",
        });
        assert.deepEqual(pending, [result.deliveryId]);
        assert.ok(!pending.includes(proactive.delivery_id));
    } finally {
        await fixture.close();
    }
});

test("runtime-stop persistence failure still releases the writer lease", async () => {
    const fixture = await applicationFixture();
    try {
        const store = fixture.dependencies.repositories.state;
        const commit = store.commit.bind(store);
        store.commit = async (expectedRevision, candidate) => {
            if (candidate.operations.runtimeEpisodes.at(-1)?.cleanStopAt !== null)
                throw new Error("fixture stop write failure");
            return commit(expectedRevision, candidate);
        };

        await assert.rejects(
            fixture.application.interact(event("local_cli", "explicit_local_argument"), async () => ({
                outcome: "confirmed",
                externalMessageId: null,
            })),
            /fixture stop write failure/,
        );
        assert.equal(store.lease, null);
        const interrupted = await store.load();
        assert.equal(interrupted.operations.runtimeEpisodes.at(-1)?.cleanStopAt, null);
        assert.equal(interrupted.operations.runtimeEpisodes.at(-1)?.stopReason, null);

        store.commit = commit;
        await fixture.application.interact(event("local_cli", "explicit_local_argument"), async () => ({
            outcome: "confirmed",
            externalMessageId: null,
        }));
        const recovered = await store.load();
        const recovery = recovered.operations.runtimeEpisodes.at(-1)?.recoveryAccount;
        assert.equal(recovery?.gapKind, "uncertain_interruption_boundary");
        assert.equal(recovery?.previousRuntime, interrupted.operations.runtimeEpisodes.at(-1)?.runtimeId);
        assert.equal(store.lease, null);
    } finally {
        await fixture.close();
    }
});

test("one interaction lease excludes cross-surface mutation and recovery until delivery finishes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-interleaving-"));
    const statePath = join(directory, "state.json");
    const config = {
        statePath,
        provider: { kind: "process" as const, command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
    };
    const intentCommitted = Promise.withResolvers<void>();
    const allowAttempt = Promise.withResolvers<void>();
    const transportStarted = Promise.withResolvers<void>();
    const allowTransport = Promise.withResolvers<void>();
    const laterRequests: AiExecutionRequest[] = [];
    const first = composeEmberApplication(config, {
        executor: async () => ({ contractVersion: 1, reply: "first reply", usedMeaningIds: [] }),
        memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
    });
    const second = composeEmberApplication(config, {
        executor: async (request) => {
            laterRequests.push(request);
            return { contractVersion: 1, reply: "second reply", usedMeaningIds: [] };
        },
        memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
    });
    await first.repositories.state.create(initialState(PRINCIPAL));
    const createIntent = first.repositories.interactions.createDeliveryIntent.bind(first.repositories.interactions);
    first.repositories.interactions.createDeliveryIntent = async (...arguments_) => {
        const intent = await createIntent(...arguments_);
        intentCommitted.resolve();
        await allowAttempt.promise;
        return intent;
    };
    const firstApplication = createEmberApplication(first);
    const secondApplication = createEmberApplication(second);
    const address = { principal: PRINCIPAL, scope: SCOPE, surfaceId: "local_cli", destinationId: null };

    try {
        const firstInteraction = firstApplication.interact(event("local_cli", "explicit_local_argument"), async () => {
            transportStarted.resolve();
            await allowTransport.promise;
            return { outcome: "confirmed", externalMessageId: null };
        });
        await intentCommitted.promise;
        const retained = (await first.repositories.interactions.load()).deliveries[0];
        assert.ok(retained);
        assert.equal(retained.representation?.text, "first reply\n");
        assert.deepEqual(retained.attempts, []);

        await assert.rejects(
            secondApplication.interact(
                {
                    ...event("telegram", "configured_surface_mapping"),
                    externalOccurrence: { occurrenceId: "update-blocked" },
                    deliveryDestinationId: "chat-1",
                },
                async () => assert.fail("blocked turn must not send"),
            ),
            /continuity store lock is/,
        );
        await assert.rejects(
            secondApplication.deliver({ deliveryId: retained.delivery_id, address }, async () =>
                assert.fail("blocked recovery must not send"),
            ),
            /continuity store lock is/,
        );

        allowAttempt.resolve();
        await transportStarted.promise;
        const inFlight = await first.repositories.interactions.load();
        assert.equal(inFlight.deliveries[0]?.attempts[0]?.outcome, "started");
        await assert.rejects(
            secondApplication.interact(
                {
                    ...event("telegram", "configured_surface_mapping"),
                    externalOccurrence: { occurrenceId: "update-in-flight" },
                    deliveryDestinationId: "chat-1",
                },
                async () => assert.fail("in-flight competing turn must not send"),
            ),
            /continuity store lock is/,
        );
        await assert.rejects(
            secondApplication.deliver({ deliveryId: retained.delivery_id, address }, async () =>
                assert.fail("in-flight recovery must not send"),
            ),
            /continuity store lock is/,
        );

        allowTransport.resolve();
        const completed = await firstInteraction;
        assert.equal(completed.delivery?.status, "confirmed");
        await secondApplication.interact(
            {
                ...event("telegram", "configured_surface_mapping"),
                externalOccurrence: { occurrenceId: "update-after-release" },
                deliveryDestinationId: "chat-1",
            },
            async () => ({ outcome: "confirmed", externalMessageId: null }),
        );
        assert.equal(laterRequests.length, 1);
        assert.equal(laterRequests[0]?.projection.conversation_context?.turns[1]?.delivery_status, "displayed");
    } finally {
        allowAttempt.resolve();
        allowTransport.resolve();
        await rm(directory, { recursive: true, force: true });
    }
});

test("application interaction should create distinct occurrences when local inputs have identical text", async () => {
    // Given
    const fixture = await applicationFixture();
    try {
        const deliveries: string[] = [];
        const transport = async ({ text }: { text: string }) => {
            deliveries.push(text);
            return { outcome: "confirmed" as const, externalMessageId: null };
        };

        // When
        const first = await fixture.application.interact(event("local_cli", "explicit_local_argument"), transport);
        const second = await fixture.application.interact(event("local_cli", "explicit_local_argument"), transport);

        // Then
        assert.notEqual(first.occurrenceId, second.occurrenceId);
        assert.notEqual(first.cognitionId, second.cognitionId);
        assert.deepEqual(deliveries, ["reply\n", "reply\n"]);
        const ledger = await fixture.dependencies.repositories.interactions.load();
        assert.equal(ledger.inbound_occurrences.length, 2);
        assert.equal(ledger.deliveries.length, 2);
    } finally {
        await fixture.close();
    }
});

test("application interaction should suppress repeated cognition when external occurrence is replayed", async () => {
    // Given
    let providerCalls = 0;
    const fixture = await applicationFixture({
        executor: async () => {
            providerCalls += 1;
            return { contractVersion: 1, reply: "reply", usedMeaningIds: [] };
        },
    });
    try {
        const telegramEvent = {
            ...event("telegram", "configured_surface_mapping"),
            externalOccurrence: { occurrenceId: "update-42", messageId: "message-7", threadId: "chat-1" },
            deliveryDestinationId: "chat-1",
        };
        let deliveries = 0;
        const transport = async () => {
            deliveries += 1;
            return { outcome: "confirmed" as const, externalMessageId: "outbound-message-7" };
        };

        // When
        const first = await fixture.application.interact(telegramEvent, transport);
        const replay = await fixture.application.interact(telegramEvent, transport);

        // Then
        assert.equal(providerCalls, 1);
        assert.equal(deliveries, 1);
        assert.equal(replay.replayed, true);
        assert.equal(replay.occurrenceId, first.occurrenceId);
        assert.equal(replay.cognitionId, first.cognitionId);
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("application interaction should create distinct cognition when transport occurrence IDs differ", async () => {
    // Given
    let providerCalls = 0;
    const fixture = await applicationFixture({
        executor: async () => {
            providerCalls += 1;
            return { contractVersion: 1, reply: "reply", usedMeaningIds: [] };
        },
    });
    try {
        const transport = async () => ({ outcome: "confirmed" as const, externalMessageId: null });
        const base = {
            ...event("telegram", "configured_surface_mapping"),
            deliveryDestinationId: "chat-1",
        };

        // When
        const first = await fixture.application.interact(
            { ...base, externalOccurrence: { occurrenceId: "update-1" } },
            transport,
        );
        const second = await fixture.application.interact(
            { ...base, externalOccurrence: { occurrenceId: "update-2" } },
            transport,
        );

        // Then
        assert.equal(providerCalls, 2);
        assert.notEqual(first.occurrenceId, second.occurrenceId);
        assert.notEqual(first.cognitionId, second.cognitionId);
        const ledger = await fixture.dependencies.repositories.interactions.load();
        assert.equal(ledger.inbound_occurrences.length, 2);
    } finally {
        await fixture.close();
    }
});

test("application interaction should reject conflicting metadata when external occurrence is replayed", async () => {
    // Given
    const fixture = await applicationFixture();
    try {
        const original = {
            ...event("telegram", "configured_surface_mapping"),
            externalOccurrence: { occurrenceId: "update-9", messageId: "message-9" },
            deliveryDestinationId: "chat-9",
        };
        await fixture.application.interact(original, async () => ({
            outcome: "confirmed",
            externalMessageId: null,
        }));

        // When
        const replay = fixture.application.interact({ ...original, text: "changed payload" }, async () => ({
            outcome: "confirmed",
            externalMessageId: null,
        }));

        // Then
        await assert.rejects(replay, /replay conflicts with the established occurrence metadata/);
        const ledger = await fixture.dependencies.repositories.interactions.load();
        assert.equal(ledger.inbound_occurrences.length, 1);
        assert.equal(ledger.inbound_occurrences[0]?.receive_count, 1);
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("application interaction should preserve conversation when cognition preflight is invalid", async () => {
    // Given
    const fixture = await applicationFixture();
    try {
        fixture.dependencies.cognition.providerLabel = "   ";
        const before = await fixture.dependencies.repositories.conversation.load();

        // When
        const interaction = fixture.application.interact(
            {
                ...event("local_cli", "explicit_local_argument"),
                conversationMembership: { action: "fresh", basis: "explicit_boundary" },
            },
            async () => assert.fail("invalid cognition must not be delivered"),
        );

        // Then
        await assert.rejects(interaction, /provider label must be non-empty/);
        assert.deepEqual(await fixture.dependencies.repositories.conversation.load(), before);
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("application interaction should reject principal before accepting occurrence when assertion mismatches", async () => {
    // Given
    let providerCalls = 0;
    const fixture = await applicationFixture({
        executor: async () => {
            providerCalls += 1;
            return { contractVersion: 1, reply: "unexpected", usedMeaningIds: [] };
        },
    });
    try {
        const invalidEvent = {
            ...event("telegram", "configured_surface_mapping"),
            principal: "intruder",
            externalOccurrence: { occurrenceId: "unauthorized-update" },
        };

        // When
        const interaction = fixture.application.interact(invalidEvent, async () =>
            assert.fail("unauthorized interaction must not be delivered"),
        );

        // Then
        await assert.rejects(interaction, /principal/);
        assert.equal(providerCalls, 0);
        assert.equal((await fixture.dependencies.repositories.interactions.load()).inbound_occurrences.length, 0);
        assert.equal(fixture.dependencies.repositories.state.lease, null);
    } finally {
        await fixture.close();
    }
});

test("application interaction should retain delivery representation before post-turn work begins", async () => {
    // Given
    const fixture = await applicationFixture();
    let inspected = false;
    try {
        fixture.dependencies.postTurn.memoryProposalGenerator = async () => {
            const ledger = await fixture.dependencies.repositories.interactions.load();
            assert.equal(ledger.deliveries[0]?.representation?.text, "reply\n");
            assert.deepEqual(ledger.deliveries[0]?.attempts, []);
            inspected = true;
            return { contractVersion: 1, candidates: [] };
        };

        // When
        const result = await fixture.application.interact(event("local_cli", "explicit_local_argument"), async () => ({
            outcome: "confirmed",
            externalMessageId: null,
        }));

        // Then
        assert.equal(inspected, true);
        assert.equal(result.delivery?.status, "confirmed");
        assert.equal(result.diagnostics.memoryProposalFailure, null);
    } finally {
        await fixture.close();
    }
});

async function applicationFixture({ executor }: Pick<EmberApplicationDependencies["cognition"], "executor"> = {}) {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-review-"));
    const dependencies = composeEmberApplication(
        {
            statePath: join(directory, "state.json"),
            provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
        },
        {
            executor: executor ?? (async () => ({ contractVersion: 1, reply: "reply", usedMeaningIds: [] })),
            memoryProposalGenerator: async () => ({ contractVersion: 1, candidates: [] }),
        },
    );
    await dependencies.repositories.state.create(initialState(PRINCIPAL));
    return {
        dependencies,
        application: createEmberApplication(dependencies),
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

function event(surfaceId: string, principalProvenance: InteractionEvent["principalProvenance"]): InteractionEvent {
    return {
        kind: "message",
        principal: PRINCIPAL,
        principalProvenance,
        scope: SCOPE,
        surfaceId,
        text: "same input",
    };
}

test("application should hand remote Telegram setup to a trusted local host when cognition proposes it", async () => {
    // Given
    const fixture = await applicationFixture({
        executor: async () => ({
            contractVersion: 1,
            reply: "I can help connect Telegram.",
            usedMeaningIds: [],
            setupIntent: "telegram",
        }),
    });
    let delivered = "";
    try {
        // When
        const result = await fixture.application.interact(
            event("telegram_bot", "configured_surface_mapping"),
            async ({ text }) => {
                delivered = text;
                return { outcome: "confirmed", externalMessageId: null };
            },
        );

        // Then
        assert.equal(result.setupIntent, "telegram");
        assert.match(delivered, /open Ember on the trusted local host/);
        assert.match(delivered, /never in chat/);
        assert.equal(result.delivery?.status, "confirmed");
    } finally {
        await fixture.close();
    }
});
