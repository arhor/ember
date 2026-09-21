import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ProviderRequest } from "../providers/contract.ts";
import type { InteractionEvent } from "./contract.ts";

import { composeEmberApplication } from "../composition/ember.ts";
import { ValidationError } from "../core/errors.ts";
import { initialState } from "../core/model.ts";
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
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});

test("the coordinator uses independently supplied persistence collaborators", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-repositories-"));
    try {
        const statePath = join(directory, "state.json");
        const dependencies = composeEmberApplication(
            {
                statePath,
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            { provider: async () => ({ contractVersion: 1, reply: "reply", usedMeaningIds: [] }) },
        );
        dependencies.repositories.conversation = new ConversationContextStore(join(directory, "dialogue"));
        dependencies.repositories.interactions = new InteractionLedgerStore(join(directory, "delivery"));
        dependencies.repositories.onboarding = new OnboardingWorkStore(join(directory, "onboarding"));
        dependencies.repositories.memoryProposalGenerations = new MemoryProposalGenerationStore(
            join(directory, "memory"),
        );
        await dependencies.repositories.state.create(initialState(PRINCIPAL));

        const result = await createEmberApplication(dependencies).interact(
            event("local_cli", "explicit_local_argument"),
            async () => ({ outcome: "confirmed", externalMessageId: null }),
        );

        assert.equal(result.cognitionStatus, "completed");
        assert.equal((await dependencies.repositories.conversation.load()).exchanges.length, 1);
        assert.equal((await dependencies.repositories.interactions.load()).deliveries.length, 1);
        await assert.rejects(access(`${statePath}.conversation.json`));
        await assert.rejects(access(`${statePath}.interactions.json`));
        assert.equal(dependencies.repositories.onboarding.path, join(directory, "onboarding.onboarding.json"));
        assert.equal(
            dependencies.repositories.memoryProposalGenerations.path,
            join(directory, "memory.memory-proposals.json"),
        );
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
        const lease = await store.acquireWriteLease();
        await store.releaseWriteLease(lease);
    } finally {
        await fixture.close();
    }
});

async function applicationFixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-application-review-"));
    const dependencies = composeEmberApplication(
        {
            statePath: join(directory, "state.json"),
            provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
        },
        {
            provider: async () => ({ contractVersion: 1, reply: "reply", usedMeaningIds: [] }),
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
