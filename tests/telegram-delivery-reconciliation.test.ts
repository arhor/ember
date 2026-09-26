import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import type { ConfiguredProactiveContactPolicy } from "../src/core/agency/configured-proactive-contact-policy.ts";
import type { ContactAttentionDecisionRecord } from "../src/core/agency/proactive-contact-attention-policy.ts";
import type { AiExecutor } from "../src/core/ai/contract.ts";
import type {
    ProactiveContactHandoffRevalidator,
    TelegramSurfaceConfig,
    TelegramUpdate,
} from "../src/apps/telegram/index.ts";

import { decideConfiguredProactiveContactHandoff } from "../src/core/agency/configured-proactive-contact-policy.ts";
import { ProactiveContactStore } from "../src/core/agency/proactive-contact-store.ts";
import { createEmberApplication } from "../src/app/application.ts";
import { composeEmberApplication } from "../src/composition/ember.ts";
import { initialState } from "../src/core/model.ts";
import { rememberFact } from "../src/core/semantics.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { InteractionLedgerStore, SurfaceDeliveryFailure } from "../src/runtime/interaction-boundary.ts";
import {
    createTelegramApi,
    deliverTelegramMessage,
    loadTelegramSurfaceConfig,
} from "../src/apps/telegram/index.ts";
import {
    processTelegramUpdate,
    reconcileTelegramDeliveries,
    reconcileTelegramProactiveContacts,
    runTelegramPolling,
} from "./support-telegram-surface.ts";

const PRINCIPAL = "max";
const CHAT_ID = 424242;
const TOKEN = "123456:abcdefghijklmnopqrstuvwxyzABCDE1234567890_-";

function telegramConfig(directory: string, statePath: string): TelegramSurfaceConfig {
    return {
        config_version: 1,
        state_path: statePath,
        principal: PRINCIPAL,
        activeScope: "private",
        chat_id: CHAT_ID,
        token_file: join(directory, "telegram.token"),
        poll_timeout_seconds: 30,
        provider_kind: "process",
        provider_command: "/bin/echo",
        provider_arguments: [],
        provider_timeout_seconds: 30,
        working_directory: directory,
        node_path: process.execPath,
        surface_entrypoint: resolve("bin/ember-telegram.ts"),
        stop_timeout_seconds: 45,
    };
}

function update(updateId: number): TelegramUpdate {
    return {
        update_id: updateId,
        message: {
            message_id: updateId + 1000,
            date: 1_788_608_000,
            chat: { id: CHAT_ID, type: "private" },
            from: { id: CHAT_ID, is_bot: false, first_name: "Max", username: "max" },
            text: "hello",
        },
    };
}

function sentMessage(messageId: number) {
    return {
        message_id: messageId,
        date: 1_788_608_000,
        chat: { id: CHAT_ID, type: "private" },
    };
}

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-telegram-delivery-"));
    const statePath = join(directory, "ember.json");
    const store = new StateStore(statePath);
    await store.create(initialState(PRINCIPAL));
    return {
        directory,
        statePath,
        store,
        config: telegramConfig(directory, statePath),
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

function provider(calls: { value: number }): AiExecutor {
    return async () => {
        calls.value += 1;
        return { contractVersion: 1, reply: "telegram reply", usedMeaningIds: [] };
    };
}

function readyApi(overrides: Record<string, unknown> = {}) {
    return {
        getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember" }),
        getWebhookInfo: async () => ({ url: "", pending_update_count: 0 }),
        getUpdates: async () => [],
        sendMessage: async () => sentMessage(9999),
        ...overrides,
    } as Parameters<typeof runTelegramPolling>[1];
}

function configuredPolicy(
    attention: ConfiguredProactiveContactPolicy["attention"] = {
        kind: "always_available",
        source_id: "configured-policy:attention",
    },
): ConfiguredProactiveContactPolicy {
    return {
        policy_version: 1,
        authority: { status: "authorized", source_id: "configured-policy:standing-authority" },
        attention,
        surface: { preference_rank: 0, source_id: "configured-policy:telegram-ready" },
    };
}

function withConfiguredPolicy(config: TelegramSurfaceConfig, policyPath: string): TelegramSurfaceConfig {
    return {
        ...config,
        config_version: 2,
        provider: {
            kind: "codex",
            command: config.provider_command,
            model: "",
            timeout_seconds: config.provider_timeout_seconds,
        },
        proactive_contact_policy_path: policyPath,
    };
}

async function createAdmittedContact(f: Awaited<ReturnType<typeof fixture>>, suffix = "release") {
    const lease = await f.store.acquireWriteLease();
    let groundingMeaningId: ReturnType<typeof rememberFact>;
    try {
        const loaded = await f.store.load();
        groundingMeaningId = rememberFact(
            loaded,
            PRINCIPAL,
            `user:${PRINCIPAL}`,
            `proactive-grounding-${suffix}`,
            "private",
            `Current grounding for ${suffix}`,
        );
        await f.store.commit(loaded.revision, loaded);
    } finally {
        await f.store.releaseWriteLease(lease);
    }
    const application = createEmberApplication(
        composeEmberApplication(
            {
                statePath: f.statePath,
                provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
            },
            {
                executor: async () => ({ contractVersion: 1, reply: "source expression", usedMeaningIds: [] }),
            },
        ),
    );
    const interaction = await application.interact(
        {
            kind: "message",
            principal: PRINCIPAL,
            scope: "private",
            text: "internal cognition source",
            surfaceId: "internal:test",
            principalProvenance: "explicit_local_argument",
        },
        async () => ({ outcome: "confirmed", externalMessageId: "internal-display" }),
    );
    const state = await f.store.load();
    const cognition = state.operations.cognitionEpisodes.find((item) => item.cognitionId === interaction.cognitionId)!;
    const contacts = new ProactiveContactStore(f.statePath);
    const contactIntentId = `contact-intent-${suffix}` as const;
    const assessmentId = `contact-policy-${suffix}` as const;
    const created = await contacts.createIntent({
        contactIntentId,
        purpose: "Notify the principal about the release",
        principal: PRINCIPAL,
        scope: "private",
        source: {
            cognition_id: cognition.cognitionId,
            expression_evidence_id: cognition.expressionEvidenceId!,
            opportunity_id: `opportunity-${suffix}`,
            evidence_ids: [`evidence-source-${suffix}`],
            grounding_meaning_ids: [groundingMeaningId],
            source_revision: state.revision,
        },
        groundingCurrentness: {
            status: "current",
            evidence_ids: [`evidence-grounding-${suffix}`],
            assessed_at: "2026-09-17T12:00:00Z",
        },
        representation: {
            text: `proactive message ${suffix}`,
            currentness: "current",
            evidence_ids: [`evidence-representation-${suffix}`],
            classification: "private",
        },
        urgency: "ordinary",
        urgencyMeaningIds: [],
        expiresAt: null,
        satisfactionBoundary: "transport_acceptance",
        createdAt: "2026-09-17T12:00:00Z",
    });
    const decision: ContactAttentionDecisionRecord = {
        assessment_id: assessmentId,
        contact_intent_id: contactIntentId,
        considered_at: "2026-09-17T12:01:00Z",
        source_revision: state.revision,
        current_revision: state.revision,
        outcome: "admit",
        basis: "current_authorized_intent",
        interruption: "interrupt",
        selected_surface_id: "telegram_bot",
        next_step_owner: null,
        reconsideration: null,
        evidence: {
            grounding_meaning_ids: [groundingMeaningId],
            representation_evidence_ids: [`evidence-representation-${suffix}`],
            authority: { status: "authorized", evidence_ids: [`evidence-authority-${suffix}`] },
            attention: { status: "available", evidence_ids: [`evidence-attention-${suffix}`] },
            occurrence: { status: "distinct", related_intent_id: null, evidence_ids: [`evidence-distinct-${suffix}`] },
            surfaces: [
                {
                    surface_id: "telegram_bot",
                    preference_rank: 1,
                    status: "eligible",
                    evidence_ids: [`evidence-surface-${suffix}`],
                },
            ],
            supersession_evidence_ids: [],
        },
    };
    await contacts.recordPolicyDecision(decision);
    const revalidate: ProactiveContactHandoffRevalidator = (currentState, currentIntent, consideredAt) => ({
        ...decision,
        assessment_id: `contact-policy-${suffix}-revalidated`,
        contact_intent_id: currentIntent.contact_intent_id,
        considered_at: consideredAt,
        current_revision: currentState.revision,
    });
    return { contacts, created, assessmentId, cognition, decision, revalidate };
}

test("Telegram flood control exposes retry_after as a definite retryable delivery failure", async () => {
    let requests = 0;
    const api = createTelegramApi(TOKEN, {
        apiRoot: "https://telegram.example",
        fetch: async () => {
            requests += 1;
            return new Response(
                JSON.stringify({
                    ok: false,
                    error_code: 429,
                    description: "Too Many Requests: retry later",
                    parameters: { retry_after: 7 },
                }),
                { status: 429, headers: { "content-type": "application/json" } },
            );
        },
    });

    await assert.rejects(deliverTelegramMessage(api, CHAT_ID, "hello"), (error: unknown) => {
        assert.ok(error instanceof SurfaceDeliveryFailure);
        assert.equal(error.outcome, "failed");
        assert.equal(error.retryable, true);
        assert.equal(error.retryAfterSeconds, 7);
        return true;
    });
    assert.equal(requests, 1);
});

test("durable Telegram cognition survives definite outbound failure and can acknowledge the inbound update", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        let sends = 0;
        const outcome = await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    throw new SurfaceDeliveryFailure("Telegram rate limited", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 30,
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(70),
            { executor: provider(providerCalls) },
        );

        assert.equal(outcome.kind, "processed");
        if (outcome.kind === "ignored") assert.fail("mapped Telegram update was ignored");
        assert.equal(outcome.deliveryFailure, "failed");
        assert.equal(providerCalls.value, 1);
        assert.equal(sends, 1);
        const state = await f.store.load();
        assert.equal(state.operations.cognitionEpisodes.length, 1);
        assert.equal(state.operations.cognitionEpisodes[0]?.status, "completed");
        assert.equal(state.operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences[0]?.external_occurrence_id, "update:70");
        assert.equal(ledger.deliveries[0]?.attempts[0]?.outcome, "failed");
        assert.equal(ledger.deliveries[0]?.attempts[0]?.retryable, true);
        assert.equal(ledger.deliveries[0]?.attempts[0]?.retry_after_seconds, 30);
    } finally {
        await f.close();
    }
});

test("long polling advances update offset after durable cognition even when reply delivery failed", async () => {
    const f = await fixture();
    try {
        let polls = 0;
        let sends = 0;
        const providerCalls = { value: 0 };
        const api = readyApi({
            getUpdates: async ({ offset }: { offset?: number }) => {
                polls += 1;
                if (polls === 1) {
                    assert.equal(offset, undefined);
                    return [update(80)];
                }
                assert.equal(offset, 81);
                throw new Error("offset-proof-complete");
            },
            sendMessage: async () => {
                sends += 1;
                throw new SurfaceDeliveryFailure("retry later", {
                    outcome: "failed",
                    retryable: true,
                    retryAfterSeconds: 300,
                });
            },
        });

        await assert.rejects(
            runTelegramPolling(f.config, api, { executor: provider(providerCalls) }),
            /offset-proof-complete/,
        );
        assert.equal(polls, 2);
        assert.equal(providerCalls.value, 1);
        assert.equal(sends, 1);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences[0]?.receive_count, 1);
        assert.equal(ledger.deliveries[0]?.attempts.length, 1);
    } finally {
        await f.close();
    }
});

test("reconciliation runs before every idle poll", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    throw new SurfaceDeliveryFailure("flood control", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 0,
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(85),
            { executor: provider(providerCalls) },
        );

        let polls = 0;
        let reconciliationSends = 0;
        const api = readyApi({
            getUpdates: async () => {
                polls += 1;
                if (polls === 1) return [];
                throw new Error("second-idle-poll-observed");
            },
            sendMessage: async () => {
                reconciliationSends += 1;
                if (reconciliationSends === 1)
                    throw new SurfaceDeliveryFailure("still rate limited", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 0,
                    });
                return sentMessage(8500);
            },
        });

        await assert.rejects(runTelegramPolling(f.config, api), /second-idle-poll-observed/);
        assert.equal(polls, 2);
        assert.equal(reconciliationSends, 2);
        assert.equal(providerCalls.value, 1);
    } finally {
        await f.close();
    }
});

test("uncertain Telegram send remains blocked across reconciliation instead of being duplicated", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        let initialSends = 0;
        const outcome = await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    initialSends += 1;
                    throw new SurfaceDeliveryFailure("connection vanished after send may have crossed boundary", {
                        outcome: "uncertain",
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(90),
            { executor: provider(providerCalls) },
        );
        assert.equal(outcome.kind, "processed");
        if (outcome.kind === "ignored") assert.fail("mapped Telegram update was ignored");
        assert.equal(outcome.deliveryFailure, "uncertain");

        let reconciliationSends = 0;
        const results = await reconcileTelegramDeliveries(f.config, {
            sendMessage: async () => {
                reconciliationSends += 1;
                return sentMessage(9999);
            },
        } as Parameters<typeof reconcileTelegramDeliveries>[1]);

        assert.equal(initialSends, 1);
        assert.equal(reconciliationSends, 0);
        assert.equal(providerCalls.value, 1);
        assert.equal(results.length, 1);
        assert.equal(results[0]?.status, "blocked_uncertain");
        assert.equal((await f.store.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "pending");
    } finally {
        await f.close();
    }
});

test("Telegram retry_after gates redelivery and later retries the retained representation without new cognition", async () => {
    const f = await fixture();
    try {
        const providerCalls = { value: 0 };
        let sends = 0;
        await processTelegramUpdate(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    throw new SurfaceDeliveryFailure("flood control", {
                        outcome: "failed",
                        retryable: true,
                        retryAfterSeconds: 10,
                    });
                },
            } as Parameters<typeof processTelegramUpdate>[1],
            update(100),
            { executor: provider(providerCalls) },
        );
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        const failed = ledger.deliveries[0]!.attempts[0]!;
        assert.equal(failed.observedAt === null, false);
        const beforeDue = new Date(Date.parse(failed.observedAt!) + 9_000).toISOString();
        const due = new Date(Date.parse(failed.observedAt!) + 10_000).toISOString();

        let retrySends = 0;
        const api = {
            sendMessage: async (params: unknown) => {
                retrySends += 1;
                assert.deepEqual(params, { chat_id: CHAT_ID, text: "telegram reply\n" });
                return sentMessage(10001);
            },
        } as Parameters<typeof reconcileTelegramDeliveries>[1];
        const early = await reconcileTelegramDeliveries(f.config, api, { observedAt: beforeDue });
        assert.equal(early[0]?.status, "retry_later");
        assert.equal(retrySends, 0);

        const retried = await reconcileTelegramDeliveries(f.config, api, { observedAt: due });
        assert.equal(retried[0]?.status, "confirmed");
        assert.equal(retrySends, 1);
        assert.equal(sends, 1);
        assert.equal(providerCalls.value, 1);
        assert.equal((await f.store.load()).operations.cognitionEpisodes[0]?.deliveryStatus, "displayed");
    } finally {
        await f.close();
    }
});

test("an admitted proactive contact creates one Telegram delivery and becomes satisfied on confirmation", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f);
        let sends = 0;
        const results = await reconcileTelegramProactiveContacts(
            f.config,
            {
                sendMessage: async ({ text }: { text: string }) => {
                    sends += 1;
                    assert.equal(text, "proactive message release");
                    return sentMessage(7001);
                },
            } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:02:00Z", revalidateBeforeHandoff: contact.revalidate },
        );
        assert.equal(results[0]?.status, "confirmed");
        assert.equal(sends, 1);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.disposition, "satisfied");
        assert.equal(intent.handoff?.surface_id, "telegram_bot");
        assert.equal(intent.policy_decisions.at(-1)?.assessment_id, "contact-policy-release-revalidated");
        const proactive = (await new InteractionLedgerStore(f.statePath).load()).deliveries.filter(
            (delivery) => delivery.origin.kind === "proactive_contact",
        );
        assert.equal(proactive.length, 1);
        assert.equal(proactive[0]?.attempts[0]?.outcome, "confirmed");

        const replay = await reconcileTelegramProactiveContacts(f.config, readyApi(), {
            observedAt: "2026-09-17T12:03:00Z",
        });
        assert.deepEqual(replay, []);
        assert.equal(sends, 1);
    } finally {
        await f.close();
    }
});

test("polling hands an admitted contact to Telegram when supplied an agency revalidator", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "production-worker");
        let polls = 0;
        let sends = 0;
        const api = readyApi({
            getUpdates: async () => {
                polls += 1;
                throw new Error("stop-after-proactive-handoff");
            },
            sendMessage: async ({ text }: { text: string }) => {
                sends += 1;
                assert.equal(text, "proactive message production-worker");
                return sentMessage(7010);
            },
        });

        await assert.rejects(
            runTelegramPolling(f.config, api, { revalidateProactiveContact: contact.revalidate }),
            /stop-after-proactive-handoff/,
        );
        assert.equal(polls, 1);
        assert.equal(sends, 1);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.disposition, "satisfied");
        assert.notEqual(intent.policy_decisions.at(-1)?.assessment_id, contact.assessmentId);
        assert.equal(intent.handoff?.assessment_id, intent.policy_decisions.at(-1)?.assessment_id);
    } finally {
        await f.close();
    }
});

test("production polling should hand an admitted contact to Telegram when configured policy is current", async () => {
    // Given
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "configured-production-worker");
        const policyPath = join(f.directory, "proactive-contact-policy.json");
        const surfaceConfigPath = join(f.directory, "telegram.json");
        await writeFile(policyPath, JSON.stringify(configuredPolicy()), "utf8");
        await writeFile(surfaceConfigPath, JSON.stringify(withConfiguredPolicy(f.config, policyPath)), "utf8");
        const productionConfig = await loadTelegramSurfaceConfig(surfaceConfigPath);
        let polls = 0;
        let sends = 0;
        const api = readyApi({
            getUpdates: async () => {
                polls += 1;
                throw new Error("stop-after-configured-proactive-handoff");
            },
            sendMessage: async ({ text }: { text: string }) => {
                sends += 1;
                assert.equal(text, "proactive message configured-production-worker");
                return sentMessage(7013);
            },
        });

        // When
        await assert.rejects(runTelegramPolling(productionConfig, api), /stop-after-configured-proactive-handoff/);

        // Then
        assert.equal(polls, 1);
        assert.equal(sends, 1);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.disposition, "satisfied");
        assert.equal(
            intent.policy_decisions.at(-1)?.evidence.authority.evidence_ids[0],
            "configured-policy:standing-authority",
        );
        assert.equal(intent.handoff?.assessment_id, intent.policy_decisions.at(-1)?.assessment_id);
    } finally {
        await f.close();
    }
});

test("production polling should suppress an admitted contact when configured authority is revoked", async () => {
    // Given
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "configured-authority-revoked");
        const policyPath = join(f.directory, "proactive-contact-policy.json");
        const surfaceConfigPath = join(f.directory, "telegram.json");
        await writeFile(policyPath, JSON.stringify(configuredPolicy()), "utf8");
        await writeFile(surfaceConfigPath, JSON.stringify(withConfiguredPolicy(f.config, policyPath)), "utf8");
        const productionConfig = await loadTelegramSurfaceConfig(surfaceConfigPath);
        await writeFile(
            policyPath,
            JSON.stringify({
                ...configuredPolicy(),
                authority: { status: "denied", source_id: "configured-policy:authority-revoked" },
            }),
            "utf8",
        );
        let sends = 0;
        const api = readyApi({
            getUpdates: async () => {
                throw new Error("stop-after-authority-revalidation");
            },
            sendMessage: async () => {
                sends += 1;
                return sentMessage(7014);
            },
        });

        // When
        await assert.rejects(runTelegramPolling(productionConfig, api), /stop-after-authority-revalidation/);

        // Then
        assert.equal(sends, 0);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.disposition, "suppressed");
        assert.equal(intent.policy_decisions.at(-1)?.basis, "authority_denied");
        assert.equal(
            (await new InteractionLedgerStore(f.statePath).load()).deliveries.some(
                (delivery) => delivery.origin.kind === "proactive_contact",
            ),
            false,
        );
    } finally {
        await f.close();
    }
});

test("configured handoff policy should defer ordinary contact when current UTC time is quiet", async () => {
    // Given
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "configured-quiet-hours");
        const state = await f.store.load();
        const intent = (await contact.contacts.load()).intents[0]!;
        const grounding = state.meanings.find(
            (meaning) => meaning.meaningId === intent.source.grounding_meaning_ids[0],
        )!;
        const quietStart = new Date(grounding.applicableFrom);
        quietStart.setUTCDate(quietStart.getUTCDate() + 1);
        quietStart.setUTCHours(22, 0, 0, 0);
        const consideredAt = new Date(quietStart);
        consideredAt.setUTCHours(23, 30, 0, 0);
        const quietEnd = new Date(quietStart);
        quietEnd.setUTCDate(quietEnd.getUTCDate() + 1);
        quietEnd.setUTCHours(7, 0, 0, 0);

        // When
        const decision = await decideConfiguredProactiveContactHandoff({
            state,
            statePath: f.statePath,
            intent,
            consideredAt: consideredAt.toISOString(),
            surfaceId: "telegram_bot",
            policy: configuredPolicy({
                kind: "daily_quiet_hours_utc",
                source_id: "configured-policy:quiet-hours",
                window_id: "principal-night-utc",
                starts_at: "22:00",
                ends_at: "07:00",
            }),
        });

        // Then
        assert.equal(decision.outcome, "defer");
        assert.equal(decision.basis, "quiet_period");
        assert.deepEqual(decision.evidence.attention, {
            status: "quiet_period",
            window_id: "principal-night-utc",
            starts_at: quietStart.toISOString(),
            ends_at: quietEnd.toISOString(),
            evidence_ids: ["configured-policy:quiet-hours"],
        });
    } finally {
        await f.close();
    }
});

test("production polling keeps an admitted contact pending without a current agency observation", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "production-fail-safe");
        let polls = 0;
        let sends = 0;
        const api = readyApi({
            getUpdates: async () => {
                polls += 1;
                throw new Error("stop-after-fail-safe-pass");
            },
            sendMessage: async () => {
                sends += 1;
                return sentMessage(7011);
            },
        });

        await assert.rejects(runTelegramPolling(f.config, api), /stop-after-fail-safe-pass/);
        assert.equal(polls, 1);
        assert.equal(sends, 0);
        assert.equal((await contact.contacts.load()).intents[0]?.disposition, "pending");
        assert.equal(
            (await new InteractionLedgerStore(f.statePath).load()).deliveries.some(
                (delivery) => delivery.origin.kind === "proactive_contact",
            ),
            false,
        );
    } finally {
        await f.close();
    }
});

test("a quiet period that begins during downtime blocks polling recovery from an old admission", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "new-quiet-period");
        assert.equal(contact.decision.evidence.attention.status, "available");
        let polls = 0;
        let sends = 0;
        const api = readyApi({
            getUpdates: async () => {
                polls += 1;
                throw new Error("stop-after-quiet-period-pass");
            },
            sendMessage: async () => {
                sends += 1;
                return sentMessage(7012);
            },
        });

        await assert.rejects(
            runTelegramPolling(f.config, api, {
                revalidateProactiveContact: (state, intent, consideredAt) => ({
                    ...contact.decision,
                    assessment_id: "contact-policy-new-quiet-period-revalidated",
                    contact_intent_id: intent.contact_intent_id,
                    considered_at: consideredAt,
                    current_revision: state.revision,
                    outcome: "defer",
                    basis: "quiet_period",
                    interruption: "remain_silent",
                    selected_surface_id: null,
                    next_step_owner: "ember_attention_policy",
                    reconsideration: {
                        kind: "not_before",
                        at: new Date(Date.parse(consideredAt) + 60 * 60 * 1000).toISOString(),
                    },
                    evidence: {
                        ...contact.decision.evidence,
                        attention: {
                            status: "quiet_period",
                            window_id: "quiet-window-began-during-downtime",
                            starts_at: new Date(Date.parse(consideredAt) - 60 * 1000).toISOString(),
                            ends_at: new Date(Date.parse(consideredAt) + 60 * 60 * 1000).toISOString(),
                            evidence_ids: ["evidence-current-quiet-period"],
                        },
                    },
                }),
            }),
            /stop-after-quiet-period-pass/,
        );
        assert.equal(polls, 1);
        assert.equal(sends, 0);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.disposition, "deferred");
        assert.equal(intent.policy_decisions.at(-1)?.basis, "quiet_period");
        assert.equal(intent.policy_decisions.at(-1)?.evidence.attention.status, "quiet_period");
        assert.equal(
            (await new InteractionLedgerStore(f.statePath).load()).deliveries.some(
                (delivery) => delivery.origin.kind === "proactive_contact",
            ),
            false,
        );
    } finally {
        await f.close();
    }
});

test("only the latest policy decision may nominate Telegram for a new handoff", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "latest-policy");
        await contact.contacts.recordPolicyDecision({
            ...contact.decision,
            assessment_id: "contact-policy-latest-policy-deferred",
            considered_at: "2026-09-17T12:01:30Z",
            outcome: "defer",
            basis: "quiet_period",
            interruption: "remain_silent",
            selected_surface_id: null,
            next_step_owner: "ember_attention_policy",
            reconsideration: { kind: "not_before", at: "2026-09-17T13:00:00Z" },
        });
        let revalidations = 0;
        let sends = 0;
        const deferred = await reconcileTelegramProactiveContacts(
            f.config,
            { sendMessage: async () => (sends += 1) } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            {
                observedAt: "2026-09-17T12:02:00Z",
                revalidateBeforeHandoff: (...args) => {
                    revalidations += 1;
                    return contact.revalidate(...args);
                },
            },
        );
        assert.deepEqual(deferred, []);

        await contact.contacts.recordPolicyDecision({
            ...contact.decision,
            assessment_id: "contact-policy-latest-policy-other-surface",
            considered_at: "2026-09-17T12:02:30Z",
            selected_surface_id: "another_surface",
        });
        const otherSurface = await reconcileTelegramProactiveContacts(
            f.config,
            { sendMessage: async () => (sends += 1) } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            {
                observedAt: "2026-09-17T12:03:00Z",
                revalidateBeforeHandoff: (...args) => {
                    revalidations += 1;
                    return contact.revalidate(...args);
                },
            },
        );
        assert.deepEqual(otherSurface, []);
        assert.equal(revalidations, 0);
        assert.equal(sends, 0);
        assert.equal(
            (await new InteractionLedgerStore(f.statePath).load()).deliveries.some(
                (delivery) => delivery.origin.kind === "proactive_contact",
            ),
            false,
        );
    } finally {
        await f.close();
    }
});

test("an admitted intent stays pending when no fresh pre-handoff policy decision is available", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "needs-revalidation");
        let sends = 0;
        const results = await reconcileTelegramProactiveContacts(
            f.config,
            { sendMessage: async () => (sends += 1) } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:02:00Z" },
        );
        assert.deepEqual(results, []);
        assert.equal(sends, 0);
        assert.equal((await contact.contacts.load()).intents[0]?.disposition, "pending");
    } finally {
        await f.close();
    }
});

test("fresh pre-handoff policy may defer an old admission without creating a delivery", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "fresh-defer");
        let sends = 0;
        const results = await reconcileTelegramProactiveContacts(
            f.config,
            { sendMessage: async () => (sends += 1) } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            {
                observedAt: "2026-09-17T12:02:00Z",
                revalidateBeforeHandoff: (state, intent, consideredAt) => ({
                    ...contact.decision,
                    assessment_id: "contact-policy-fresh-defer-revalidated",
                    contact_intent_id: intent.contact_intent_id,
                    considered_at: consideredAt,
                    current_revision: state.revision,
                    outcome: "defer",
                    basis: "quiet_period",
                    interruption: "remain_silent",
                    selected_surface_id: null,
                    next_step_owner: "ember_attention_policy",
                    reconsideration: { kind: "not_before", at: "2026-09-17T13:00:00Z" },
                }),
            },
        );
        assert.deepEqual(results, []);
        assert.equal(sends, 0);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.disposition, "deferred");
        assert.equal(intent.policy_decisions.at(-1)?.outcome, "defer");
        assert.equal(
            (await new InteractionLedgerStore(f.statePath).load()).deliveries.some(
                (delivery) => delivery.origin.kind === "proactive_contact",
            ),
            false,
        );
    } finally {
        await f.close();
    }
});

test("proactive Telegram retry reuses one handoff and retained representation", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "retry");
        let sends = 0;
        const failed = await reconcileTelegramProactiveContacts(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    throw new SurfaceDeliveryFailure("retryable", { outcome: "failed", retryable: true });
                },
            } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:02:00Z", revalidateBeforeHandoff: contact.revalidate },
        );
        assert.equal(failed[0]?.status, "retryable_failure");
        assert.equal((await contact.contacts.load()).intents[0]?.disposition, "handed_off");

        const confirmed = await reconcileTelegramProactiveContacts(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    return sentMessage(7002);
                },
            } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:03:00Z", revalidateBeforeHandoff: contact.revalidate },
        );
        assert.equal(confirmed[0]?.status, "confirmed");
        assert.equal(sends, 2);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        const proactive = ledger.deliveries.filter((delivery) => delivery.origin.kind === "proactive_contact");
        assert.equal(proactive.length, 1);
        assert.deepEqual(
            proactive[0]?.attempts.map((attempt) => attempt.outcome),
            ["failed", "confirmed"],
        );
    } finally {
        await f.close();
    }
});

test("uncertain proactive Telegram delivery stays handed off and is never resent automatically", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "uncertain");
        let sends = 0;
        const uncertain = await reconcileTelegramProactiveContacts(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    throw new SurfaceDeliveryFailure("submission outcome is unknown", { outcome: "uncertain" });
                },
            } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:02:00Z", revalidateBeforeHandoff: contact.revalidate },
        );
        assert.equal(uncertain[0]?.status, "blocked_uncertain");
        const handedOff = (await contact.contacts.load()).intents[0]!;
        assert.equal(handedOff.disposition, "handed_off");
        const deliveryId = handedOff.handoff?.delivery_id;

        const recovered = await reconcileTelegramProactiveContacts(
            f.config,
            {
                sendMessage: async () => {
                    sends += 1;
                    return sentMessage(7004);
                },
            } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:03:00Z" },
        );
        assert.equal(recovered[0]?.status, "blocked_uncertain");
        assert.equal(sends, 1);
        const proactive = (await new InteractionLedgerStore(f.statePath).load()).deliveries.filter(
            (delivery) => delivery.origin.kind === "proactive_contact",
        );
        assert.equal(proactive.length, 1);
        assert.equal(proactive[0]?.delivery_id, deliveryId);
        assert.equal(proactive[0]?.attempts.length, 1);
        assert.equal(proactive[0]?.attempts[0]?.outcome, "uncertain");
    } finally {
        await f.close();
    }
});

test("a proactive delivery created before intent-side handoff is adopted, and confirmed evidence is not resent", async () => {
    const f = await fixture();
    try {
        const contact = await createAdmittedContact(f, "adopt");
        const ledger = new InteractionLedgerStore(f.statePath);
        const delivery = await ledger.createDeliveryIntent({
            cognitionId: contact.created.source.cognition_id,
            expressionEvidenceId: contact.created.source.expression_evidence_id,
            surfaceId: "telegram_bot",
            destinationId: `telegram:chat:${CHAT_ID}`,
            representationText: contact.created.representation.text,
            origin: {
                kind: "proactive_contact",
                contact_intent_id: contact.created.contact_intent_id,
                policy_assessment_id: contact.assessmentId,
            },
        });
        const attempt = await ledger.startDeliveryAttempt(delivery.delivery_id, "2026-09-17T12:02:00Z");
        await ledger.finishDeliveryAttempt(attempt.attempt_id, "confirmed", {
            externalMessageId: "7003",
            observedAt: "2026-09-17T12:02:01Z",
        });

        let sends = 0;
        const result = await reconcileTelegramProactiveContacts(
            f.config,
            { sendMessage: async () => (sends += 1) } as Parameters<typeof reconcileTelegramProactiveContacts>[1],
            { observedAt: "2026-09-17T12:03:00Z", revalidateBeforeHandoff: contact.revalidate },
        );
        assert.equal(result[0]?.status, "confirmed");
        assert.equal(sends, 0);
        const intent = (await contact.contacts.load()).intents[0]!;
        assert.equal(intent.handoff?.delivery_id, delivery.delivery_id);
        assert.equal(intent.disposition, "satisfied");
    } finally {
        await f.close();
    }
});
