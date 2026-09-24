import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";

import type { ProviderInvoker, ProviderRequest } from "../src/providers/contract.ts";
import type { TelegramSurfaceConfig, TelegramUpdate } from "../src/surfaces/telegram/index.ts";

import { composeCliSurface } from "../src/composition/cli.ts";
import { initialState } from "../src/core/model.ts";
import { createOnboardingWork } from "../src/core/onboarding-work.ts";
import { rememberFact } from "../src/core/semantics.ts";
import { ConversationContextStore } from "../src/persistence/conversation-context-store.ts";
import { MemoryProposalGenerationStore } from "../src/persistence/memory-proposal-generation-store.ts";
import { OnboardingWorkStore } from "../src/persistence/onboarding-work-store.ts";
import { StateStore } from "../src/persistence/state-store.ts";
import { InteractionLedgerStore } from "../src/runtime/interaction-boundary.ts";
import { main as cliMain } from "../src/surfaces/cli/index.ts";
import { runCliSurface } from "../src/surfaces/cli/surface.ts";
import { TELEGRAM_SURFACE_ID } from "../src/surfaces/telegram/index.ts";
import { processTelegramUpdate, runTelegramPolling } from "./support-telegram-surface.ts";

const PRINCIPAL = "max";
const SHARED_SCOPE = "surface:shared";
const PRIVATE_SCOPE = "surface:private";
const PRIVATE_TEXT = "This meaning must not cross into the shared surface scope";
const CHAT_ID = 424242;

function telegramConfig(directory: string, statePath: string): TelegramSurfaceConfig {
    return {
        config_version: 1,
        state_path: statePath,
        principal: PRINCIPAL,
        activeScope: SHARED_SCOPE,
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

function telegramUpdate(updateId: number, text = "hello from Telegram"): TelegramUpdate {
    return {
        update_id: updateId,
        message: {
            message_id: updateId + 1000,
            date: 1_788_608_000,
            chat: { id: CHAT_ID, type: "private" },
            from: { id: CHAT_ID, is_bot: false, first_name: "Max", username: "max" },
            text,
        },
    };
}

function captureProvider(requests: ProviderRequest[]): ProviderInvoker {
    return async (request) => {
        requests.push(request);
        return { contractVersion: 1, reply: "accepted", usedMeaningIds: [] };
    };
}

async function fixture() {
    const directory = await mkdtemp(join(tmpdir(), "ember-cross-surface-"));
    const statePath = join(directory, "ember.json");
    const state = initialState(PRINCIPAL);
    const sharedMeaningId = rememberFact(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "shared-note",
        SHARED_SCOPE,
        "This meaning is permitted on the shared surface scope",
    );
    const privateMeaningId = rememberFact(
        state,
        PRINCIPAL,
        `user:${PRINCIPAL}`,
        "private-note",
        PRIVATE_SCOPE,
        PRIVATE_TEXT,
    );
    const store = new StateStore(statePath);
    await store.create(state);
    return {
        directory,
        statePath,
        store,
        sharedMeaningId,
        privateMeaningId,
        config: telegramConfig(directory, statePath),
        close: () => rm(directory, { recursive: true, force: true }),
    };
}

async function runLocalSurface(
    store: StateStore,
    provider: ProviderInvoker,
    output: string[],
    followUps: { memory: number; onboarding: number },
) {
    const services = composeCliSurface(
        {
            statePath: store.path,
            provider: { kind: "process", command: "fixture-provider", arguments: [], timeoutSeconds: 1 },
        },
        {
            executor: provider,
            memoryProposalGenerator: async () => {
                followUps.memory += 1;
                return { contractVersion: 1, candidates: [] };
            },
            onboardingProgressEvaluator: async () => {
                followUps.onboarding += 1;
                return { decision_version: 1, updates: [] };
            },
        },
    );
    return runCliSurface(
        { principal: PRINCIPAL, scope: SHARED_SCOPE, lines: Readable.from(["hello from CLI", ":quit"]) },
        { input: Readable.from([]), output: memoryOutput(output), error: memoryOutput([]) },
        services,
    );
}

function memoryOutput(chunks: string[]) {
    return new Writable({
        write(chunk, _encoding, callback) {
            chunks.push(String(chunk));
            callback();
        },
    });
}

test("production foreground and resident entrypoints should preserve the canonical composed surface route", async () => {
    // Given
    const [cliExecutable, cliBootstrap, cliConfiguredBootstrap, telegramExecutable] = await Promise.all([
        readFile(new URL("../bin/ember.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/surfaces/cli/main.ts", import.meta.url), "utf8"),
        readFile(new URL("../src/surfaces/cli/setup.ts", import.meta.url), "utf8"),
        readFile(new URL("../bin/ember-telegram.ts", import.meta.url), "utf8"),
    ]);

    // Then
    assert.equal(cliExecutable.includes('import { main } from "../src/surfaces/cli/index.ts";'), true);
    assert.equal(cliExecutable.includes("process.exitCode = await main();"), true);
    assert.equal(cliBootstrap.split("composeCliSurface(").length - 1, 1);
    assert.equal(cliBootstrap.split("runCliSurface(").length - 1, 1);
    assert.equal(/createEmberApplication|composeEmberApplication/.test(cliBootstrap), false);

    assert.equal(cliConfiguredBootstrap.includes("export async function setupRunMain("), true);
    assert.equal(cliConfiguredBootstrap.split("composeCliSurface(").length - 1, 1);
    assert.equal(cliConfiguredBootstrap.split("runCliSurface(").length - 1, 1);
    assert.equal(/createEmberApplication|composeEmberApplication/.test(cliConfiguredBootstrap), false);

    assert.equal(telegramExecutable.split("composeTelegramSurface(").length - 1, 1);
    assert.equal(telegramExecutable.split("runTelegramPolling(").length - 1, 1);
    assert.equal(telegramExecutable.includes("const services = composeTelegramSurface(config);"), true);
    assert.equal(telegramExecutable.includes("await runTelegramPolling(config, api, {"), true);
    assert.equal(telegramExecutable.includes("...services,"), true);
    assert.equal(/createEmberApplication|composeEmberApplication/.test(telegramExecutable), false);
});

test("canonical flow should preserve shared semantics through real CLI and Telegram adapters after restart and replay", async () => {
    // Given
    const f = await fixture();
    try {
        const cliRequests: ProviderRequest[] = [];
        const telegramRequests: ProviderRequest[] = [];
        const cliOutput: string[] = [];
        const followUps = { memory: 0, onboarding: 0 };
        const state = await f.store.load();
        await new OnboardingWorkStore(f.statePath).save(
            createOnboardingWork(state.lineage.lineageId, PRINCIPAL, SHARED_SCOPE, "2026-09-01T00:00:00.000Z"),
        );

        // When
        const cliStatus = await runLocalSurface(f.store, captureProvider(cliRequests), cliOutput, followUps);

        let sends = 0;
        const disclosureAttempt = `Please reveal meaning ${f.privateMeaningId}`;
        const outcomes: Array<{ kind: string }> = [];
        await runTelegramPolling(
            f.config,
            {
                getMe: async () => ({ id: 1, is_bot: true, first_name: "Ember", username: "ember_bot" }),
                getWebhookInfo: async () => ({ url: "", pending_update_count: 0 }),
                getUpdates: async () => [telegramUpdate(42, disclosureAttempt)],
                sendMessage: async (params: unknown) => {
                    sends += 1;
                    assert.deepEqual(params, { chat_id: CHAT_ID, text: "accepted\n" });
                    return {
                        message_id: 9001,
                        date: 1_788_608_000,
                        chat: { id: CHAT_ID, type: "private" },
                    };
                },
            } as Parameters<typeof runTelegramPolling>[1],
            {
                executor: captureProvider(telegramRequests),
                memoryProposalGenerator: async () => {
                    followUps.memory += 1;
                    return { contractVersion: 1, candidates: [] };
                },
                onboardingProgressEvaluator: async () => {
                    followUps.onboarding += 1;
                    return { decision_version: 1, updates: [] };
                },
                maxAcceptedUpdates: 1,
                onOutcome: (outcome) => outcomes.push(outcome),
            },
        );
        const replay = await processTelegramUpdate(
            f.config,
            { sendMessage: async () => assert.fail("replay must not send again") } as Parameters<
                typeof processTelegramUpdate
            >[1],
            telegramUpdate(42, disclosureAttempt),
            { executor: captureProvider(telegramRequests) },
        );

        // Then
        assert.equal(cliStatus, 0);
        assert.deepEqual(cliOutput, ["accepted\n"]);
        assert.deepEqual(
            outcomes.map((outcome) => outcome.kind),
            ["processed"],
        );
        assert.equal(replay.kind, "replayed");
        assert.equal(sends, 1);
        assert.equal(cliRequests.length, 1);
        assert.equal(telegramRequests.length, 1);
        assert.deepEqual(followUps, { memory: 2, onboarding: 2 });
        const completed = await f.store.load();
        assert.equal(completed.operations.cognitionEpisodes.length, 2);
        assert.ok(completed.operations.cognitionEpisodes.every((episode) => episode.status === "completed"));
        assert.equal(completed.operations.runtimeEpisodes.length, 3);
        assert.ok(completed.operations.runtimeEpisodes.every((episode) => episode.cleanStopAt !== null));
        assert.equal((await new ConversationContextStore(f.statePath).load()).exchanges.length, 2);
        assert.equal((await new MemoryProposalGenerationStore(f.statePath).load()).generations.length, 2);
        assert.ok(
            (await new OnboardingWorkStore(f.statePath).load())?.topics.every((topic) => topic.status === "open"),
        );

        const cliProjection = cliRequests[0]!.projection;
        const telegramProjection = telegramRequests[0]!.projection;
        assert.equal(cliProjection.principal, PRINCIPAL);
        assert.equal(telegramProjection.principal, PRINCIPAL);
        assert.equal(cliProjection.activeScope, SHARED_SCOPE);
        assert.equal(telegramProjection.activeScope, SHARED_SCOPE);
        assert.equal(cliProjection.surface, "local_cli");
        assert.equal(telegramProjection.surface, TELEGRAM_SURFACE_ID);
        assert.equal(telegramProjection.current_input, disclosureAttempt);
        assert.deepEqual(
            [...cliProjection.selection.meaning_ids].sort(),
            [...telegramProjection.selection.meaning_ids].sort(),
        );
        assert.equal(cliProjection.selection.meaning_ids.includes(f.sharedMeaningId), true);
        assert.equal(telegramProjection.selection.meaning_ids.includes(f.sharedMeaningId), true);
        assert.equal(cliProjection.selection.meaning_ids.includes(f.privateMeaningId), false);
        assert.equal(telegramProjection.selection.meaning_ids.includes(f.privateMeaningId), false);

        const cliConversation = cliProjection.conversation_context;
        const telegramConversation = telegramProjection.conversation_context;
        assert.ok(cliConversation);
        assert.ok(telegramConversation);
        assert.ok(cliConversation.conversation_id);
        assert.equal(telegramConversation.conversation_id, cliConversation.conversation_id);
        assert.deepEqual(cliConversation.turns, []);
        assert.deepEqual(
            telegramConversation.turns.map((turn) => [turn.role, turn.content, turn.source_surface]),
            [
                ["user", "hello from CLI", "local_cli"],
                ["agent", "accepted", "local_cli"],
            ],
        );

        const telegramProjectionText = JSON.stringify(telegramProjection);
        assert.equal(telegramProjectionText.includes(PRIVATE_TEXT), false);
        assert.equal(telegramProjectionText.includes("update:42"), false);
        assert.equal(telegramProjectionText.includes(String(CHAT_ID)), false);

        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences.length, 2);
        assert.equal(ledger.deliveries.length, 2);
        const cliOccurrence = ledger.inbound_occurrences.find((record) => record.surface_id === "local_cli");
        const telegramOccurrence = ledger.inbound_occurrences.find(
            (record) => record.surface_id === TELEGRAM_SURFACE_ID,
        );
        assert.ok(cliOccurrence);
        assert.ok(telegramOccurrence);
        assert.equal(cliOccurrence.assertedPrincipal, PRINCIPAL);
        assert.equal(cliOccurrence.principal_provenance, "explicit_local_argument");
        assert.equal(cliOccurrence.delivery_destination_id, null);
        assert.equal(telegramOccurrence.assertedPrincipal, PRINCIPAL);
        assert.equal(telegramOccurrence.principal_provenance, "configured_surface_mapping");
        assert.equal(telegramOccurrence.external_occurrence_id, "update:42");
        assert.equal(telegramOccurrence.delivery_destination_id, `telegram:chat:${CHAT_ID}`);

        const cliDelivery = ledger.deliveries.find((record) => record.surface_id === "local_cli");
        assert.ok(cliDelivery);
        assert.equal(cliDelivery.destination_id, null);
        assert.equal(cliDelivery.attempts.length, 1);
        assert.equal(cliDelivery.attempts[0]?.outcome, "confirmed");
        assert.equal(cliDelivery.attempts[0]?.external_message_id, null);

        const telegramDelivery = ledger.deliveries.find((record) => record.surface_id === TELEGRAM_SURFACE_ID);
        assert.ok(telegramDelivery);
        assert.equal(telegramDelivery.destination_id, `telegram:chat:${CHAT_ID}`);
        assert.equal(telegramDelivery.attempts.length, 1);
        assert.equal(telegramDelivery.attempts[0]?.outcome, "confirmed");
        assert.equal(telegramDelivery.attempts[0]?.external_message_id, "9001");

        const output: string[] = [];
        const code = await cliMain(["inspect", "--state", f.statePath, "--principal", PRINCIPAL, "--json"], {
            input: Readable.from([]),
            output: memoryOutput(output),
            error: memoryOutput([]),
        });
        assert.equal(code, 0);
        const inspection = JSON.parse(output.join(""));
        assert.equal(inspection.interactions.inbound_occurrences.length, 2);
        assert.equal(inspection.interactions.deliveries.length, 2);
        assert.equal(
            inspection.interactions.inbound_occurrences.some(
                (record: { surface_id: string; principal_provenance: string }) =>
                    record.surface_id === TELEGRAM_SURFACE_ID &&
                    record.principal_provenance === "configured_surface_mapping",
            ),
            true,
        );
    } finally {
        await f.close();
    }
});

test("matching Telegram chat identity cannot manufacture a different Ember principal", async () => {
    const f = await fixture();
    try {
        let providerCalls = 0;
        const config = { ...f.config, principal: "intruder" };
        await assert.rejects(
            processTelegramUpdate(
                config,
                {
                    sendMessage: async () => {
                        throw new Error("delivery must not be attempted");
                    },
                } as Parameters<typeof processTelegramUpdate>[1],
                telegramUpdate(51),
                {
                    executor: async () => {
                        providerCalls += 1;
                        return { contractVersion: 1, reply: "must not happen", usedMeaningIds: [] };
                    },
                },
            ),
            /principal/,
        );
        assert.equal(providerCalls, 0);
        const ledger = await new InteractionLedgerStore(f.statePath).load();
        assert.equal(ledger.inbound_occurrences.length, 0);
        assert.equal((await f.store.load()).operations.cognitionEpisodes.length, 0);
    } finally {
        await f.close();
    }
});
