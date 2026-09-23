#!/usr/bin/env node
import { claudeCode } from "ai-sdk-provider-claude-code";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createAiSdkMemoryProposalGenerator } from "../../src/ai/memory-proposals.ts";
import { prepareCognition } from "../../src/app/cognition-preparation.ts";
import { runPostTurnFollowUps } from "../../src/app/post-turn.ts";
import { createFileBackedRepositoriesForState } from "../../src/composition/ember.ts";
import { initialState } from "../../src/core/model.ts";
import { MemoryProposalGenerationStore } from "../../src/persistence/memory-proposal-generation-store.ts";
import { StateStore } from "../../src/persistence/state-store.ts";
import { runCognition, startRuntime } from "../../src/runtime/runtime.ts";

if (process.env.EMBER_RUN_LIVE_MEMORY_PROPOSAL !== "1") {
    process.stdout.write("skipped: set EMBER_RUN_LIVE_MEMORY_PROPOSAL=1 to run the live memory-proposal smoke\n");
    process.exit(0);
}

const principal = "user-1";
const scope = "relationship:user-1";
const directory = await mkdtemp(join(tmpdir(), "ember-live-memory-proposal-"));
const store = new StateStore(join(directory, "ember.json"));
await store.create(initialState(principal));
const lease = await store.acquireWriteLease();

try {
    let state = await store.load();
    const started = startRuntime(state, principal, scope);
    state = await store.commit(state.revision, started.state);
    const model = claudeCode("sonnet", {
        cwd: directory,
        maxTurns: 1,
        permissionPrompts: "none",
        tools: [],
        allowedTools: [],
        mcpServers: {},
        strictMcpConfig: true,
        settingSources: [],
        skills: [],
        plugins: [],
        agents: {},
        persistSession: false,
        streamingInput: "off",
        logger: false,
    });
    const repositories = createFileBackedRepositoriesForState(store);
    const text = "Please remember that I prefer concise answers without decorative headings.";
    const preparation = await prepareCognition(repositories, state, {
        runtimeId: started.runtimeId,
        principal,
        scope,
        surface: "local_cli",
        text,
    });
    const result = await runCognition(repositories, state, {
        runtimeId: started.runtimeId,
        principal,
        scope,
        text,
        providerLabel: "scripted-live-memory-smoke",
        executor: async () => ({ contractVersion: 1, reply: "I’ll keep that in mind.", usedMeaningIds: [] }),
        timeoutSeconds: 120,
        preparation,
    });
    const diagnostics = await runPostTurnFollowUps(
        repositories,
        {
            memoryProposalProviderLabel: "claude-code-ai-sdk",
            memoryProposalGenerator: createAiSdkMemoryProposalGenerator(model, { timeoutSeconds: 120 }),
        },
        result.state,
        preparation,
        { cognitionId: result.cognitionId, principal, scope, text },
    );
    if (diagnostics.memoryProposalFailure) throw new Error(diagnostics.memoryProposalFailure);
    const ledger = await new MemoryProposalGenerationStore(store.path).load();
    assert.equal(ledger.generations.length, 1);
    assert.equal(ledger.generations[0]?.status, "completed");
    assert.ok(ledger.generations[0]!.outcomes.some((outcome) => outcome.status === "adopted"));
    const completedState = await store.load();
    assert.ok(completedState.meanings.some((meaning) => meaning.content.toLowerCase().includes("concise")));
    process.stdout.write(
        `${JSON.stringify({
            generation_status: ledger.generations[0]?.status,
            proposal_outcomes: ledger.generations[0]?.outcomes.map((outcome) => outcome.status),
            adopted_meaning_count: completedState.meanings.length,
        })}\n`,
    );
} finally {
    await store.releaseWriteLease(lease).catch(() => {});
    await rm(directory, { recursive: true, force: true });
}
