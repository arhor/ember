import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { MemoryProposalGenerator } from "../../memory/memory-proposal-generation.ts";
import type { OnboardingProgressEvaluator } from "../../onboarding/progress-evaluator.ts";
import type { ClaudeCodeProviderOptions } from "../ai/claude-code.ts";
import type { AiExecutor } from "../ai/contract.ts";

import { emptyRequest } from "../../../tests/support.ts";
import { composeEmberApplication } from "./ember.ts";

const statePath = join("/tmp", "ember-composition-test", "state.json");

test("the composition root derives all application repositories from one state path", () => {
    const dependencies = composeEmberApplication(
        {
            statePath,
            provider: {
                kind: "process",
                command: "/not/invoked",
                arguments: [],
                timeoutSeconds: 30,
            },
        },
        { executor: providerStub },
    );

    assert.equal(dependencies.repositories.state.path, statePath);
    assert.equal(dependencies.repositories.conversation.path, `${statePath}.conversation.json`);
    assert.equal(dependencies.repositories.interactions.path, `${statePath}.interactions.json`);
    assert.equal(dependencies.repositories.onboarding.path, `${statePath}.onboarding.json`);
    assert.equal(dependencies.repositories.memoryProposalGenerations.path, `${statePath}.memory-proposals.json`);
    assert.equal(dependencies.repositories.actions.path, `${statePath}.actions.json`);
    assert.equal(dependencies.repositories.objectives.path, `${statePath}.objectives.json`);
    assert.equal(dependencies.repositories.proactiveContacts.path, `${statePath}.proactive-contacts.json`);
});

test("tests can supply deterministic application collaborators without process configuration", () => {
    const memoryProposalGenerator: MemoryProposalGenerator = async () => ({ contractVersion: 1, candidates: [] });
    const onboardingProgressEvaluator: OnboardingProgressEvaluator = async () => ({
        contractVersion: 1,
        outcomes: [],
    });
    const dependencies = composeEmberApplication(
        {
            statePath,
            expectedContinuityBinding: { lineageId: "lineage-1", establishedAt: "2026-09-21T00:00:00Z" },
            provider: {
                kind: "claude-code",
                command: "unused",
                arguments: [],
                timeoutSeconds: 17,
            },
        },
        {
            executor: providerStub,
            memoryProposalGenerator,
            memoryProposalProviderLabel: "fixture-memory-provider",
            onboardingProgressEvaluator,
            stateStoreOptions: {
                hostname: "test-host",
                pid: 42,
                now: () => "2026-09-21T00:00:00Z",
                uuid: () => "deterministic-id",
                kill: () => undefined,
                directorySync: async () => undefined,
            },
        },
    );

    assert.equal(dependencies.cognition.executor, providerStub);
    assert.equal(dependencies.cognition.providerLabel, "unused");
    assert.equal(dependencies.cognition.timeoutSeconds, 17);
    assert.equal(dependencies.postTurn.memoryProposalGenerator, memoryProposalGenerator);
    assert.equal(dependencies.postTurn.memoryProposalProviderLabel, "fixture-memory-provider");
    assert.equal(dependencies.postTurn.onboardingProgressEvaluator, onboardingProgressEvaluator);
    assert.deepEqual(dependencies.admission.expectedContinuityBinding, {
        lineageId: "lineage-1",
        establishedAt: "2026-09-21T00:00:00Z",
    });
    assert.equal(dependencies.repositories.state.host, "test-host");
    assert.equal(dependencies.repositories.state.pid, 42);
});

test("an empty configured Claude model invokes the provider factory with its default model", async () => {
    let options: ClaudeCodeProviderOptions | null = null;
    const dependencies = composeEmberApplication(
        {
            statePath,
            provider: {
                kind: "claude-code",
                command: "claude-code",
                arguments: [],
                model: "",
                timeoutSeconds: 60,
            },
        },
        {
            claudeProviderFactory: (received) => {
                options = received;
                return providerStub;
            },
        },
    );

    assert.deepEqual(await dependencies.cognition.executor(emptyRequest(), { timeoutSeconds: 60 }), {
        contractVersion: 1,
        reply: "unused",
        usedMeaningIds: [],
    });
    assert.deepEqual(options, {});
});

test("the composition root should label Ollama inference independently of an executable", () => {
    // Given
    const config = {
        statePath,
        provider: { kind: "ollama" as const, model: "qwen3:8b", baseUrl: "http://127.0.0.1:11435", timeoutSeconds: 60 },
    };

    // When
    const dependencies = composeEmberApplication(config, { executor: providerStub });

    // Then
    assert.equal(dependencies.cognition.providerLabel, "ollama");
    assert.equal(dependencies.cognition.timeoutSeconds, 60);
});

test("the composition root should label DeepSeek inference independently of an executable", () => {
    // Given
    const config = {
        statePath,
        provider: { kind: "deepseek" as const, model: "deepseek-chat", timeoutSeconds: 60 },
    };

    // When
    const dependencies = composeEmberApplication(config, { executor: providerStub });

    // Then
    assert.equal(dependencies.cognition.providerLabel, "deepseek");
    assert.equal(dependencies.cognition.timeoutSeconds, 60);
});

const providerStub: AiExecutor = async () => ({
    contractVersion: 1,
    reply: "unused",
    usedMeaningIds: [],
});
