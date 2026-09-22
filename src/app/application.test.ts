import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { EmberApplicationDependencies } from "../composition/ember.ts";
import type { ProviderRequest } from "../providers/contract.ts";
import type { InteractionEvent } from "./contract.ts";

import { composeEmberApplication } from "../composition/ember.ts";
import { ProviderError, ValidationError } from "../core/errors.ts";
import { initialState } from "../core/model.ts";
import { createOnboardingWork } from "../core/onboarding-work.ts";
import { ConversationContextStore } from "../persistence/conversation-context-store.ts";
import { MemoryProposalGenerationStore } from "../persistence/memory-proposal-generation-store.ts";
import { OnboardingWorkStore } from "../persistence/onboarding-work-store.ts";
import { InteractionLedgerStore } from "../runtime/interaction-boundary.ts";
import { createEmberApplication } from "./application.ts";

const PRINCIPAL = "max";
const SCOPE = "private";

test("CLI- and Telegram-shaped requests follow the same application coordinator path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-"));
    try {
        const requests: ProviderRequest[] = [];
        const dependencies = composeEmberApplication(
            {
                statePath: join(directory, "state.json"),
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                provider: async (request) => {
                    requests.push(request);
                    return { contractVersion: 1, reply: "same reply", usedMeaningIds: [] };
                },
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
                provider: async () => ({ contractVersion: 1, reply: "reply", usedMeaningIds: [] }),
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

test("malformed transport observations become uncertain and do not enter ledger validation", async () => {
    const fixture = await applicationFixture();
    try {
        await assert.rejects(
            fixture.application.interact(event("telegram", "configured_surface_mapping"), async () => {
                return { outcome: "garbage", externalMessageId: null } as never;
            }),
            ValidationError,
        );
        const ledger = await fixture.dependencies.repositories.interactions.load();
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "uncertain");
    } finally {
        await fixture.close();
    }
});

test("provider failure is persisted before the runtime stops and releases its writer lease", async () => {
    const fixture = await applicationFixture({
        provider: async () => {
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

test("provider cancellation evidence survives application runtime cleanup", async () => {
    const controller = new AbortController();
    const fixture = await applicationFixture({
        provider: async (_request, options) => {
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

async function applicationFixture({ provider }: Pick<EmberApplicationDependencies["cognition"], "provider"> = {}) {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-review-"));
    const dependencies = composeEmberApplication(
        {
            statePath: join(directory, "state.json"),
            provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
        },
        {
            provider: provider ?? (async () => ({ contractVersion: 1, reply: "reply", usedMeaningIds: [] })),
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
